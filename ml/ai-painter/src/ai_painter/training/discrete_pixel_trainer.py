from __future__ import annotations

from contextlib import nullcontext
import json
from pathlib import Path
import time

from .checkpoint import save_checkpoint
from .discrete_pixel_dataset import DiscretePixelDataset
from .discrete_pixel_model import build_discrete_pixel_unet
from .torch_runtime import require_torch


def train_discrete_pixel_model(config: dict[str, object], *, dataset_root: Path, output_dir: Path) -> dict[str, object]:
    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_set = DiscretePixelDataset(dataset_root, "train")
    validation_set = DiscretePixelDataset(dataset_root, "validation")
    batch_size = int(config.get("batchSize", 4))
    train_loader = torch.utils.data.DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=device.type == "cuda")
    validation_loader = torch.utils.data.DataLoader(validation_set, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=device.type == "cuda")
    model = build_discrete_pixel_unet(config).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=float(config.get("learningRate", 0.0003)), weight_decay=float(config.get("weightDecay", 0.0001)))
    use_amp = bool(config.get("mixedPrecision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    epochs = int(config.get("maxEpochs", 100))
    output_dir.mkdir(parents=True, exist_ok=True)
    best_loss = float("inf")
    best_accuracy = 0.0
    step = 0
    started = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        total_correct = 0
        total_pixels = 0
        for batch in train_loader:
            condition = batch["condition"].to(device)
            target = batch["target"].to(device)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                logits = model(condition)
                loss = torch.nn.functional.cross_entropy(logits, target)
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            total_loss += float(loss.detach().cpu())
            total_correct += int((logits.argmax(dim=1) == target).sum().detach().cpu())
            total_pixels += target.numel()
            step += 1

        validation_loss, validation_accuracy = evaluate(model, validation_loader, device, torch, use_amp)
        record = {
            "epoch": epoch,
            "step": step,
            "trainLoss": total_loss / len(train_loader),
            "trainPixelAccuracy": total_correct / max(1, total_pixels),
            "validationLoss": validation_loss,
            "validationPixelAccuracy": validation_accuracy,
            "seconds": round(time.time() - started, 2),
            "device": str(device),
        }
        append_json(output_dir / "training-log.jsonl", record)
        save_checkpoint(output_dir / "latest.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=validation_loss, config=config)
        if validation_loss < best_loss:
            best_loss = validation_loss
            best_accuracy = validation_accuracy
            save_checkpoint(output_dir / "best.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=validation_loss, config=config)

    summary = {
        "status": "completed",
        "epochs": epochs,
        "steps": step,
        "bestValidationLoss": best_loss,
        "bestValidationPixelAccuracy": best_accuracy,
        "paletteSize": len(train_set.palette),
        "device": str(device),
        "trainSampleCount": len(train_set),
        "validationSampleCount": len(validation_set),
    }
    (output_dir / "training-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def evaluate(model, loader, device, torch, use_amp):
    model.eval()
    total_loss = 0.0
    total_correct = 0
    total_pixels = 0
    with torch.inference_mode():
        for batch in loader:
            condition = batch["condition"].to(device)
            target = batch["target"].to(device)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                logits = model(condition)
                loss = torch.nn.functional.cross_entropy(logits, target)
            total_loss += float(loss.detach().cpu())
            total_correct += int((logits.argmax(dim=1) == target).sum().detach().cpu())
            total_pixels += target.numel()
    return total_loss / len(loader), total_correct / max(1, total_pixels)


def append_json(path: Path, value: dict[str, object]) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value) + "\n")
