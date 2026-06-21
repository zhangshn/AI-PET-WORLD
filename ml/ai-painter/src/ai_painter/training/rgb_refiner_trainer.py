from __future__ import annotations

from contextlib import nullcontext
import json
from pathlib import Path
import random
import time

from .checkpoint import save_checkpoint
from .dataset import WorldSceneDataset
from .losses import build_image_loss
from .rgb_refiner_model import build_rgb_refiner
from .structure_guided_model import build_structure_guided_unet
from .torch_runtime import require_torch


def train_rgb_refiner(config: dict[str, object], *, dataset_root: Path, structure_checkpoint: Path, output_dir: Path, max_epochs: int | None = None) -> dict[str, object]:
    torch = require_torch()
    seed = int(config.get("seed", 20260616))
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_set = WorldSceneDataset(dataset_root, "train", blueprint_version="v1", allow_manual_review=True, augment=True)
    validation_set = WorldSceneDataset(dataset_root, "validation", blueprint_version="v1", allow_manual_review=True)
    batch_size = int(config.get("batchSize", 2))
    train_loader = torch.utils.data.DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=device.type == "cuda")
    validation_loader = torch.utils.data.DataLoader(validation_set, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=device.type == "cuda")
    structure_state = torch.load(structure_checkpoint, map_location=device, weights_only=False)
    structure_model = build_structure_guided_unet(structure_state["config"]).to(device)
    structure_model.load_state_dict(structure_state["model"])
    structure_model.eval()
    for parameter in structure_model.parameters():
        parameter.requires_grad_(False)
    model = build_rgb_refiner(config).to(device)
    parameter_count = sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad)
    optimizer = torch.optim.AdamW(model.parameters(), lr=float(config.get("learningRate", 0.00015)), weight_decay=0.0001)
    use_amp = bool(config.get("mixedPrecision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    epochs = max_epochs or int(config.get("maxEpochs", 220))
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = output_dir / "training-log.jsonl"
    best_loss = float("inf")
    step = 0
    started = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        total = 0.0
        for batch in train_loader:
            condition = batch["condition"].to(device, non_blocking=True)
            target = batch["target"].to(device, non_blocking=True)
            with torch.inference_mode():
                base_rgb, _ = structure_model(condition)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                prediction = model(condition, base_rgb)
                image_loss, loss_parts = build_image_loss(prediction, target, torch, config, condition)
                residual_loss = torch.nn.functional.l1_loss(prediction, base_rgb) * float(config.get("residualPenalty", 0.08))
                loss = image_loss + residual_loss
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            total += float(loss.detach().cpu())
            step += 1
        validation_loss = evaluate(model, structure_model, validation_loader, device, torch, use_amp, config)
        record = {
            "epoch": epoch,
            "step": step,
            "trainLoss": total / len(train_loader),
            "validationLoss": validation_loss,
            "seconds": round(time.time() - started, 2),
            "device": str(device),
            "lastLossParts": {name: float(value.detach().cpu()) for name, value in loss_parts.items()},
        }
        append_json(log_path, record)
        save_checkpoint(output_dir / "latest.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=validation_loss, config=config)
        if validation_loss < best_loss:
            best_loss = validation_loss
            save_checkpoint(output_dir / "best.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=validation_loss, config=config)

    summary = {
        "status": "completed",
        "trainingVersion": config.get("trainingVersion"),
        "modelVersion": config.get("modelVersion"),
        "epochs": epochs,
        "steps": step,
        "bestValidationLoss": best_loss,
        "device": str(device),
        "parameterCount": parameter_count,
        "trainSampleCount": len(train_set),
        "validationSampleCount": len(validation_set),
        "lossWeights": config.get("lossWeights", {}),
        "structureCheckpoint": str(structure_checkpoint.resolve()),
    }
    (output_dir / "training-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary


def evaluate(model, structure_model, loader, device, torch, use_amp: bool, config: dict[str, object]) -> float:
    model.eval()
    total = 0.0
    with torch.inference_mode():
        for batch in loader:
            condition = batch["condition"].to(device, non_blocking=True)
            target = batch["target"].to(device, non_blocking=True)
            base_rgb, _ = structure_model(condition)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                prediction = model(condition, base_rgb)
                loss, _ = build_image_loss(prediction, target, torch, config, condition)
            total += float(loss.cpu())
    return total / len(loader)


def append_json(path: Path, value: dict[str, object]) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + "\n")
