from __future__ import annotations

from contextlib import nullcontext
import json
from pathlib import Path
import time

from .checkpoint import save_checkpoint
from .local_patch_dataset import LocalPatchDataset
from .losses import build_image_loss
from .model import build_tiny_unet
from .torch_runtime import require_torch


def train_local_patch(config: dict[str, object], *, dataset_root: Path, output_dir: Path) -> dict[str, object]:
    torch = require_torch()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_set = LocalPatchDataset(dataset_root, "train", config)
    validation_set = LocalPatchDataset(dataset_root, "validation", config)
    batch_size = int(config.get("batchSize", 4))
    train_loader = torch.utils.data.DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=device.type == "cuda")
    validation_loader = torch.utils.data.DataLoader(validation_set, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=device.type == "cuda")
    model = build_tiny_unet(config).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=float(config.get("learningRate", 0.0002)))
    use_amp = bool(config.get("mixedPrecision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    epochs = int(config.get("maxEpochs", 140))
    output_dir.mkdir(parents=True, exist_ok=True)
    best_loss = float("inf")
    step = 0
    started = time.time()
    for epoch in range(1, epochs + 1):
        model.train()
        total = 0.0
        for batch in train_loader:
            condition, target = batch["condition"].to(device), batch["target"].to(device)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                prediction = model(condition)
                loss, _ = build_image_loss(prediction, target, torch, config, condition)
            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward(); scaler.step(optimizer); scaler.update()
            total += float(loss.detach().cpu()); step += 1
        validation_loss = evaluate(model, validation_loader, device, torch, use_amp, config)
        record = {"epoch": epoch, "step": step, "trainLoss": total / len(train_loader), "validationLoss": validation_loss, "seconds": round(time.time() - started, 2), "device": str(device)}
        append_json(output_dir / "training-log.jsonl", record)
        save_checkpoint(output_dir / "latest.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=validation_loss, config=config)
        if validation_loss < best_loss:
            best_loss = validation_loss
            save_checkpoint(output_dir / "best.pt", model=model, optimizer=optimizer, epoch=epoch, step=step, loss=validation_loss, config=config)
    summary = {"status": "completed", "epochs": epochs, "steps": step, "bestValidationLoss": best_loss, "device": str(device), "trainSampleCount": len(train_set), "validationSampleCount": len(validation_set)}
    (output_dir / "training-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def evaluate(model, loader, device, torch, use_amp, config):
    model.eval(); total = 0.0
    with torch.inference_mode():
        for batch in loader:
            condition, target = batch["condition"].to(device), batch["target"].to(device)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                loss, _ = build_image_loss(model(condition), target, torch, config, condition)
            total += float(loss.cpu())
    return total / len(loader)


def append_json(path: Path, value) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value) + "\n")
