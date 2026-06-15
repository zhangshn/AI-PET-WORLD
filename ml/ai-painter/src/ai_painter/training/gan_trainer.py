from __future__ import annotations

from contextlib import nullcontext
import json
from pathlib import Path
import random

from .checkpoint import load_checkpoint, save_checkpoint
from .dataset import WorldSceneDataset
from .discriminator import build_patch_discriminator
from .losses import build_image_loss
from .model import build_tiny_unet
from .torch_runtime import require_torch


def train_gan(config: dict[str, object], *, dataset_root: Path, output_dir: Path, epochs: int, initial_checkpoint: Path | None = None) -> dict[str, object]:
    torch = require_torch()
    seed = int(config.get("seed", 20260612))
    random.seed(seed); torch.manual_seed(seed); torch.cuda.manual_seed_all(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    blueprint_version = str(config.get("blueprintVersion", "v0"))
    dataset = WorldSceneDataset(
        dataset_root, "train", blueprint_version=blueprint_version,
        allow_manual_review=bool(config.get("allowExperimentalStructuralData", False)),
        augment=bool(config.get("horizontalFlipAugmentation", False)),
    )
    loader = torch.utils.data.DataLoader(dataset, batch_size=1, shuffle=True, num_workers=0)
    model_config = json.loads(Path(str(config["modelConfig"])).read_text(encoding="utf-8"))
    generator = build_tiny_unet(model_config).to(device)
    if initial_checkpoint is not None:
        load_checkpoint(initial_checkpoint, model=generator, device=device)
    condition_channels = int(model_config.get("inputChannels", 8))
    discriminator = build_patch_discriminator(condition_channels=condition_channels, base=16).to(device)
    generator_optimizer = torch.optim.Adam(generator.parameters(), lr=0.0002, betas=(0.5, 0.999), foreach=False)
    discriminator_optimizer = torch.optim.Adam(discriminator.parameters(), lr=0.0001, betas=(0.5, 0.999), foreach=False)
    adversarial = torch.nn.BCEWithLogitsLoss()
    use_amp = bool(config.get("mixedPrecision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    output_dir.mkdir(parents=True, exist_ok=True)
    if device.type == "cuda":
        torch.cuda.empty_cache()
    log_path = output_dir / "training-log.jsonl"
    best_generator_loss = float("inf")
    step = 0

    for epoch in range(1, epochs + 1):
        generator.train(); discriminator.train()
        generator_total = 0.0; discriminator_total = 0.0
        for batch in loader:
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
            scaler.scale(discriminator_loss).backward(); scaler.step(discriminator_optimizer)

            generator_optimizer.zero_grad(set_to_none=True)
            with context:
                fake = generator(condition)
                fake_score = discriminator(torch.cat((condition, fake), dim=1))
                reconstruction, _ = build_image_loss(fake, target, torch, config, condition)
                generator_loss = reconstruction + adversarial(fake_score, torch.ones_like(fake_score)) * 0.05
            scaler.scale(generator_loss).backward(); scaler.step(generator_optimizer); scaler.update()
            generator_total += float(generator_loss.detach().cpu())
            discriminator_total += float(discriminator_loss.detach().cpu())
            step += 1

        average_generator = generator_total / len(loader)
        record = {"epoch": epoch, "step": step, "generatorLoss": average_generator, "discriminatorLoss": discriminator_total / len(loader)}
        with log_path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record) + "\n")
        save_checkpoint(output_dir / "latest.pt", model=generator, optimizer=generator_optimizer, epoch=epoch, step=step, loss=average_generator, config=config)
        if average_generator < best_generator_loss:
            best_generator_loss = average_generator
            save_checkpoint(output_dir / "best.pt", model=generator, optimizer=generator_optimizer, epoch=epoch, step=step, loss=average_generator, config=config)

    summary = {"status":"completed","epochs":epochs,"steps":step,"bestGeneratorLoss":best_generator_loss,"device":str(device),"sampleCount":len(dataset),"initializedFrom":str(initial_checkpoint.resolve()) if initial_checkpoint else None}
    (output_dir / "training-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary
