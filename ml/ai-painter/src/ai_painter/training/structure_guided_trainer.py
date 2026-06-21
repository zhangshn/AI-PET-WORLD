from __future__ import annotations

from contextlib import nullcontext
import json
from pathlib import Path
import random
import time

from .checkpoint import save_checkpoint
from .dataset import WorldSceneDataset
from .losses import build_image_loss
from .structure_guided_model import build_structure_guided_unet
from .torch_runtime import require_torch


def train_structure_guided(config: dict[str, object], *, dataset_root: Path, output_dir: Path, max_epochs: int | None = None) -> dict[str, object]:
    torch = require_torch()
    seed = int(config.get("seed", 20260615))
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
    model = build_structure_guided_unet(config).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=float(config.get("learningRate", 0.0002)))
    use_amp = bool(config.get("mixedPrecision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    epochs = max_epochs or int(config.get("maxEpochs", 120))
    structure_weight = float(config.get("structureLossWeight", 3.0))
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = output_dir / "training-log.jsonl"
    best_loss = float("inf")
    best_iou = 0.0
    step = 0
    started = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        total = 0.0
        optimizer.zero_grad(set_to_none=True)
        for batch in train_loader:
            condition = batch["condition"].to(device, non_blocking=True)
            target = batch["target"].to(device, non_blocking=True)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                rgb, structure_logits = model(condition)
                image_loss, _ = build_image_loss(rgb, target, torch, config, condition)
                mask_loss = structure_loss(structure_logits, condition, torch)
                loss = image_loss + mask_loss * structure_weight
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
            total += float(loss.detach().cpu())
            step += 1
        validation = evaluate(model, validation_loader, device, torch, use_amp, config, structure_weight)
        selection_loss = validation["loss"]
        record = {"epoch": epoch, "step": step, "trainLoss": total / len(train_loader), "validationLoss": selection_loss, "structureIoU": validation["structureIoU"], "seconds": round(time.time() - started, 2), "device": str(device)}
        append_json(log_path, record)
        save_checkpoint(output_dir / "latest.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=selection_loss, config=config)
        if selection_loss < best_loss:
            best_loss = selection_loss
            best_iou = validation["structureIoU"]
            save_checkpoint(output_dir / "best.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=selection_loss, config=config)

    summary = {"status": "completed", "epochs": epochs, "steps": step, "bestSelectionLoss": best_loss, "bestStructureIoU": best_iou, "device": str(device), "trainSampleCount": len(train_set), "validationSampleCount": len(validation_set)}
    (output_dir / "training-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary


def structure_loss(logits, target, torch):
    prediction = torch.sigmoid(logits.float())
    bce = torch.nn.functional.binary_cross_entropy_with_logits(logits.float(), target.float())
    axes = (0, 2, 3)
    intersection = (prediction * target).sum(dim=axes)
    denominator = prediction.sum(dim=axes) + target.sum(dim=axes)
    dice = 1.0 - ((2.0 * intersection + 1.0) / (denominator + 1.0)).mean()
    return bce + dice


def structure_iou(logits, target, torch) -> float:
    prediction = torch.sigmoid(logits.float())
    predicted = prediction >= 0.5
    expected = target >= 0.5
    intersection = (predicted & expected).sum(dim=(0, 2, 3)).float()
    union = (predicted | expected).sum(dim=(0, 2, 3)).float()
    present = union > 0
    if not bool(present.any()):
        return 1.0
    return float((intersection[present] / union[present].clamp_min(1)).mean().cpu())


def evaluate(model, loader, device, torch, use_amp: bool, config: dict[str, object], structure_weight: float):
    model.eval()
    total_loss = 0.0
    total_iou = 0.0
    with torch.inference_mode():
        for batch in loader:
            condition = batch["condition"].to(device, non_blocking=True)
            target = batch["target"].to(device, non_blocking=True)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                rgb, structure_logits = model(condition)
                image_loss, _ = build_image_loss(rgb, target, torch, config, condition)
                loss = image_loss + structure_loss(structure_logits, condition, torch) * structure_weight
            total_loss += float(loss.cpu())
            total_iou += structure_iou(structure_logits, condition, torch)
    return {"loss": total_loss / len(loader), "structureIoU": total_iou / len(loader)}


def append_json(path: Path, value: dict[str, object]) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + "\n")
