from __future__ import annotations

from contextlib import nullcontext
import json
from pathlib import Path
import random
import time

from .checkpoint import load_checkpoint, save_checkpoint
from .dataset import WorldSceneDataset
from .losses import build_image_loss
from .model import build_tiny_unet
from .torch_runtime import require_torch


def train(
    config: dict[str, object],
    *,
    dataset_root: Path,
    output_dir: Path,
    max_epochs: int | None = None,
    initial_checkpoint: Path | None = None,
) -> dict[str, object]:
    torch = require_torch()
    seed = int(config.get("seed", 20260612))
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    blueprint_version = str(config.get("blueprintVersion", "v0"))
    allow_experimental_data = bool(config.get("allowExperimentalStructuralData", False))
    dataset = WorldSceneDataset(
        dataset_root, "train", blueprint_version=blueprint_version,
        allow_manual_review=allow_experimental_data,
        augment=bool(config.get("horizontalFlipAugmentation", False)),
    )
    loader = torch.utils.data.DataLoader(
        dataset, batch_size=int(config.get("batchSize", 1)), shuffle=True,
        num_workers=0, pin_memory=device.type == "cuda",
    )
    model_config = load_json(Path(str(config["modelConfig"])))
    model = build_tiny_unet(model_config).to(device)
    initialized_from = None
    if initial_checkpoint is not None:
        load_checkpoint(initial_checkpoint, model=model, device=device)
        initialized_from = str(initial_checkpoint.resolve())
    validation_ids = load_json(dataset_root / "indexes" / "validation.json").get("sampleIds", [])
    validation_loader = None
    if validation_ids:
        validation_dataset = WorldSceneDataset(dataset_root, "validation", blueprint_version=blueprint_version, allow_manual_review=allow_experimental_data)
        validation_loader = torch.utils.data.DataLoader(
            validation_dataset, batch_size=int(config.get("batchSize", 1)), shuffle=False,
            num_workers=0, pin_memory=device.type == "cuda",
        )
    optimizer = torch.optim.AdamW(model.parameters(), lr=float(config.get("learningRate", 0.0002)))
    use_amp = bool(config.get("mixedPrecision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    accumulation = int(config.get("gradientAccumulationSteps", 1))
    epochs = max_epochs or int(config.get("maxEpochs", 100))
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = output_dir / "training-log.jsonl"
    step = 0
    best_loss = float("inf")
    started = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        epoch_loss = 0.0
        epoch_parts: dict[str, float] = {}
        optimizer.zero_grad(set_to_none=True)
        for batch_index, batch in enumerate(loader, start=1):
            condition = batch["condition"].to(device, non_blocking=True)
            target = batch["target"].to(device, non_blocking=True)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                prediction = model(condition)
                raw_loss, parts = build_image_loss(prediction, target, torch, config, condition)
                loss = raw_loss / accumulation
            scaler.scale(loss).backward()
            if batch_index % accumulation == 0 or batch_index == len(loader):
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad(set_to_none=True)
                step += 1
            epoch_loss += float(loss.detach().cpu()) * accumulation
            for name, value in parts.items():
                epoch_parts[name] = epoch_parts.get(name, 0.0) + float(value.detach().cpu())

        average_loss = epoch_loss / len(loader)
        average_parts = {name: value / len(loader) for name, value in epoch_parts.items()}
        validation_loss = evaluate_loss(model, validation_loader, device, torch, use_amp, config)
        selection_loss = validation_loss if validation_loss is not None else average_loss
        record = {
            "epoch": epoch, "step": step, "trainLoss": average_loss,
            "trainParts": average_parts,
            "validationLoss": validation_loss, "selectionLoss": selection_loss,
            "device": str(device), "seconds": round(time.time() - started, 2),
        }
        append_json(log_path, record)
        save_checkpoint(output_dir / "latest.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=selection_loss, config=config)
        if selection_loss < best_loss:
            best_loss = selection_loss
            save_checkpoint(output_dir / "best.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=selection_loss, config=config)

    summary = {
        "status": "completed", "epochs": epochs, "steps": step,
        "bestSelectionLoss": best_loss, "device": str(device),
        "trainSampleCount": len(dataset), "validationSampleCount": len(validation_ids),
        "initializedFrom": initialized_from,
    }
    (output_dir / "training-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def load_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def append_json(path: Path, value: dict[str, object]) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + "\n")


def evaluate_loss(model, loader, device, torch, use_amp: bool, config: dict[str, object]) -> float | None:
    if loader is None:
        return None
    model.eval()
    total = 0.0
    with torch.inference_mode():
        for batch in loader:
            condition = batch["condition"].to(device, non_blocking=True)
            target = batch["target"].to(device, non_blocking=True)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                loss, _ = build_image_loss(model(condition), target, torch, config, condition)
                total += float(loss.cpu())
    return total / len(loader)
