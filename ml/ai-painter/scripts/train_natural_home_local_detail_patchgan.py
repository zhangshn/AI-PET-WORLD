from __future__ import annotations

from argparse import ArgumentParser
from contextlib import nullcontext
import json
from pathlib import Path
import random
import time

from ai_painter.training.checkpoint import load_checkpoint, save_checkpoint
from ai_painter.training.discriminator import build_patch_discriminator
from ai_painter.training.local_patch_dataset import LocalPatchDataset
from ai_painter.training.losses import build_image_loss
from ai_painter.training.model import build_tiny_unet
from ai_painter.training.torch_runtime import require_torch


NATURAL_CATEGORIES = ("grass", "water", "shoreline", "road", "tree", "rock")


def main() -> int:
    parser = ArgumentParser(description="Train pure natural-home local detail PatchGAN models.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--initial-root", type=Path)
    args = parser.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    results: dict[str, object] = {}
    for category in NATURAL_CATEGORIES:
        print(f"TRAINING_NATURAL_HOME_LOCAL_DETAIL_PATCHGAN={category}", flush=True)
        initial = args.initial_root / category / "best.pt" if args.initial_root else None
        results[category] = train_category(
            config,
            dataset_root=args.dataset_root / category,
            output_dir=args.output_root / category,
            initial_checkpoint=initial if initial and initial.exists() else None,
        )

    completed = [value for value in results.values() if isinstance(value, dict) and value.get("status") == "completed"]
    summary = {
        "schemaVersion": "natural-home-local-detail-patchgan-summary-v1",
        "status": "completed",
        "stageId": "natural-home-v1-no-building-local-details",
        "trainingVersion": config.get("trainingVersion"),
        "modelVersion": config.get("modelVersion"),
        "epochs": config.get("maxEpochs"),
        "categoryCount": len(NATURAL_CATEGORIES),
        "trainSampleCount": sum(int(value.get("trainSampleCount", 0)) for value in completed),
        "validationSampleCount": sum(int(value.get("validationSampleCount", 0)) for value in completed),
        "bestGeneratorLoss": min((float(value.get("bestGeneratorLoss", 999.0)) for value in completed), default=None),
        "categories": results,
    }
    args.output_root.mkdir(parents=True, exist_ok=True)
    (args.output_root / "training-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def train_category(config: dict[str, object], *, dataset_root: Path, output_dir: Path, initial_checkpoint: Path | None) -> dict[str, object]:
    torch = require_torch()
    seed = int(config.get("seed", 20260618))
    random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_set = LocalPatchDataset(dataset_root, "train", config)
    validation_set = LocalPatchDataset(dataset_root, "validation", config)
    batch_size = int(config.get("batchSize", 8))
    train_loader = torch.utils.data.DataLoader(train_set, batch_size=batch_size, shuffle=True, num_workers=0, pin_memory=device.type == "cuda")
    validation_loader = torch.utils.data.DataLoader(validation_set, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=device.type == "cuda")

    generator = build_tiny_unet(config).to(device)
    if initial_checkpoint is not None:
        load_checkpoint(initial_checkpoint, model=generator, device=device)
    discriminator = build_patch_discriminator(condition_channels=int(config.get("inputChannels", 17)), base=24).to(device)
    generator_optimizer = torch.optim.AdamW(generator.parameters(), lr=float(config.get("learningRate", 0.00012)), betas=(0.5, 0.999))
    discriminator_optimizer = torch.optim.AdamW(discriminator.parameters(), lr=float(config.get("discriminatorLearningRate", 0.00008)), betas=(0.5, 0.999))
    adversarial = torch.nn.BCEWithLogitsLoss()
    use_amp = bool(config.get("mixedPrecision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    adversarial_weight = float(config.get("adversarialWeight", 0.08))
    epochs = int(config.get("maxEpochs", 24))
    output_dir.mkdir(parents=True, exist_ok=True)

    best_generator_loss = float("inf")
    step = 0
    started = time.time()
    for epoch in range(1, epochs + 1):
        generator.train()
        discriminator.train()
        generator_total = 0.0
        discriminator_total = 0.0
        for batch in train_loader:
            condition = batch["condition"].to(device)
            target = batch["target"].to(device)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()

            discriminator_optimizer.zero_grad(set_to_none=True)
            with context:
                fake = generator(condition)
                real_score = discriminator(torch.cat((condition, target), dim=1))
                fake_score = discriminator(torch.cat((condition, fake.detach()), dim=1))
                discriminator_loss = (
                    adversarial(real_score, torch.ones_like(real_score) * 0.9)
                    + adversarial(fake_score, torch.zeros_like(fake_score))
                ) * 0.5
            scaler.scale(discriminator_loss).backward()
            scaler.step(discriminator_optimizer)

            generator_optimizer.zero_grad(set_to_none=True)
            with context:
                fake = generator(condition)
                fake_score = discriminator(torch.cat((condition, fake), dim=1))
                reconstruction, _ = build_image_loss(fake, target, torch, config, condition)
                generator_loss = reconstruction + adversarial(fake_score, torch.ones_like(fake_score)) * adversarial_weight
            scaler.scale(generator_loss).backward()
            scaler.step(generator_optimizer)
            scaler.update()
            generator_total += float(generator_loss.detach().cpu())
            discriminator_total += float(discriminator_loss.detach().cpu())
            step += 1

        validation_loss = evaluate(generator, validation_loader, device, torch, use_amp, config)
        generator_average = generator_total / len(train_loader)
        record = {
            "epoch": epoch,
            "step": step,
            "generatorLoss": generator_average,
            "discriminatorLoss": discriminator_total / len(train_loader),
            "validationLoss": validation_loss,
            "seconds": round(time.time() - started, 2),
            "device": str(device),
        }
        append_json(output_dir / "training-log.jsonl", record)
        save_checkpoint(output_dir / "latest.pt", model=generator, optimizer=generator_optimizer, epoch=epoch, step=step, loss=validation_loss, config=config)
        if generator_average < best_generator_loss:
            best_generator_loss = generator_average
            save_checkpoint(output_dir / "best.pt", model=generator, optimizer=generator_optimizer, epoch=epoch, step=step, loss=validation_loss, config=config)

    summary = {
        "status": "completed",
        "epochs": epochs,
        "steps": step,
        "bestGeneratorLoss": best_generator_loss,
        "device": str(device),
        "trainSampleCount": len(train_set),
        "validationSampleCount": len(validation_set),
        "initializedFrom": str(initial_checkpoint.resolve()) if initial_checkpoint else None,
    }
    (output_dir / "training-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary


def evaluate(model, loader, device, torch, use_amp, config):
    model.eval()
    total = 0.0
    with torch.inference_mode():
        for batch in loader:
            condition = batch["condition"].to(device)
            target = batch["target"].to(device)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                loss, _ = build_image_loss(model(condition), target, torch, config, condition)
            total += float(loss.cpu())
    return total / len(loader)


def append_json(path: Path, value: object) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
