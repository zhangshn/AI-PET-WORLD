from __future__ import annotations

from argparse import ArgumentParser
from contextlib import nullcontext
import json
from pathlib import Path
import random
import time

from ai_painter.runtime_retention import preserve_runtime_dir_before_clear
from ai_painter.training.checkpoint import load_checkpoint, save_checkpoint
from ai_painter.training.dataset import WorldSceneDataset, image_tensor
from ai_painter.training.discriminator import build_patch_discriminator
from ai_painter.training.losses import build_image_loss
from ai_painter.training.rgb_refiner_model import build_rgb_refiner
from ai_painter.training.structure_guided_model import build_structure_guided_unet
from ai_painter.training.torch_runtime import require_torch


def main() -> int:
    parser = ArgumentParser(description="Train a full-scene RGB refiner with a local PatchGAN discriminator.")
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--structure-checkpoint", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--initial-refiner-checkpoint", type=Path)
    parser.add_argument("--max-epochs", type=int)
    args = parser.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    result = train_patchgan_refiner(
        config,
        dataset_root=args.dataset_root,
        structure_checkpoint=args.structure_checkpoint,
        output_dir=args.output_dir,
        initial_refiner_checkpoint=args.initial_refiner_checkpoint,
        max_epochs=args.max_epochs,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def train_patchgan_refiner(
    config: dict[str, object],
    *,
    dataset_root: Path,
    structure_checkpoint: Path,
    output_dir: Path,
    initial_refiner_checkpoint: Path | None,
    max_epochs: int | None,
) -> dict[str, object]:
    torch = require_torch()
    seed = int(config.get("seed", 20260621))
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    base_rgb_manifest = load_base_rgb_manifest(config)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_augment = bool(config.get("augmentTrain", True))
    condition_extra_channels = read_condition_extra_channels(config)
    train_set = WorldSceneDataset(
        dataset_root,
        "train",
        blueprint_version="v1",
        allow_manual_review=True,
        augment=train_augment,
        condition_extra_channels=condition_extra_channels,
    )
    validation_set = WorldSceneDataset(
        dataset_root,
        "validation",
        blueprint_version="v1",
        allow_manual_review=True,
        condition_extra_channels=condition_extra_channels,
    )
    batch_size = int(config.get("batchSize", 2))
    train_loader = torch.utils.data.DataLoader(
        train_set,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=device.type == "cuda",
    )
    validation_loader = torch.utils.data.DataLoader(
        validation_set,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=device.type == "cuda",
    )

    structure_state = torch.load(structure_checkpoint, map_location=device, weights_only=False)
    structure_model = build_structure_guided_unet(structure_state["config"]).to(device)
    structure_model.load_state_dict(structure_state["model"])
    structure_model.eval()
    for parameter in structure_model.parameters():
        parameter.requires_grad_(False)

    generator = build_rgb_refiner(config).to(device)
    initialized_from = None
    if initial_refiner_checkpoint and initial_refiner_checkpoint.exists():
        load_checkpoint(initial_refiner_checkpoint, model=generator, device=device)
        initialized_from = str(initial_refiner_checkpoint.resolve())

    condition_channels = int(train_set[0]["condition"].shape[0])
    discriminator = build_patch_discriminator(
        condition_channels=condition_channels,
        base=int(config.get("discriminatorBase", 32)),
    ).to(device)

    generator_optimizer = torch.optim.AdamW(
        generator.parameters(),
        lr=float(config.get("learningRate", 0.00006)),
        betas=(0.5, 0.999),
        weight_decay=0.00005,
    )
    discriminator_optimizer = torch.optim.AdamW(
        discriminator.parameters(),
        lr=float(config.get("discriminatorLearningRate", 0.00004)),
        betas=(0.5, 0.999),
        weight_decay=0.00005,
    )
    adversarial = torch.nn.BCEWithLogitsLoss()
    adversarial_weight = float(config.get("adversarialWeight", 0.035))
    use_amp = bool(config.get("mixedPrecision", True)) and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    epochs = max_epochs or int(config.get("maxEpochs", 80))

    if output_dir.exists():
        preserve_runtime_dir_before_clear(output_dir, "train-rgb-refiner-patchgan")
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = output_dir / "training-log.jsonl"
    best_generator_loss = float("inf")
    best_validation_loss = float("inf")
    best_adversarial_loss = float("inf")
    step = 0
    started = time.time()
    parameter_count = sum(parameter.numel() for parameter in generator.parameters() if parameter.requires_grad)
    discriminator_parameter_count = sum(parameter.numel() for parameter in discriminator.parameters() if parameter.requires_grad)

    for epoch in range(1, epochs + 1):
        generator.train()
        discriminator.train()
        generator_total = 0.0
        discriminator_total = 0.0
        reconstruction_total = 0.0
        adversarial_total = 0.0
        last_loss_parts: dict[str, object] = {}

        for batch in train_loader:
            condition = batch["condition"].to(device, non_blocking=True)
            target = batch["target"].to(device, non_blocking=True)
            with torch.inference_mode():
                if base_rgb_manifest:
                    base_rgb = load_base_rgb_batch(base_rgb_manifest, batch["sampleId"], torch, device)
                else:
                    base_rgb, _ = structure_model(condition[:, :14])
                if bool(config.get("zeroBaseRgb", False)) and not base_rgb_manifest:
                    base_rgb = torch.zeros_like(base_rgb)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()

            if adversarial_weight > 0.0:
                discriminator_optimizer.zero_grad(set_to_none=True)
                with context:
                    fake = generator(condition, base_rgb)
                    real_score = discriminator(torch.cat((condition, target), dim=1))
                    fake_score = discriminator(torch.cat((condition, fake.detach()), dim=1))
                    discriminator_loss = (
                        adversarial(real_score, torch.ones_like(real_score) * 0.9)
                        + adversarial(fake_score, torch.zeros_like(fake_score))
                    ) * 0.5
                scaler.scale(discriminator_loss).backward()
                scaler.step(discriminator_optimizer)
            else:
                discriminator_loss = target.new_tensor(0.0)

            generator_optimizer.zero_grad(set_to_none=True)
            with context:
                fake = generator(condition, base_rgb)
                reconstruction_loss, loss_parts = build_image_loss(fake, target, torch, config, condition)
                if adversarial_weight > 0.0:
                    fake_score = discriminator(torch.cat((condition, fake), dim=1))
                    adversarial_loss = adversarial(fake_score, torch.ones_like(fake_score))
                else:
                    adversarial_loss = target.new_tensor(0.0)
                generator_loss = reconstruction_loss + adversarial_loss * adversarial_weight
            scaler.scale(generator_loss).backward()
            scaler.step(generator_optimizer)
            scaler.update()

            generator_total += float(generator_loss.detach().cpu())
            discriminator_total += float(discriminator_loss.detach().cpu())
            reconstruction_total += float(reconstruction_loss.detach().cpu())
            adversarial_total += float(adversarial_loss.detach().cpu())
            last_loss_parts = loss_parts
            step += 1

        validation_loss = evaluate(generator, structure_model, validation_loader, device, torch, use_amp, config)
        generator_average = generator_total / len(train_loader)
        discriminator_average = discriminator_total / len(train_loader)
        reconstruction_average = reconstruction_total / len(train_loader)
        adversarial_average = adversarial_total / len(train_loader)
        record = {
            "epoch": epoch,
            "step": step,
            "generatorLoss": generator_average,
            "discriminatorLoss": discriminator_average,
            "reconstructionLoss": reconstruction_average,
            "adversarialLoss": adversarial_average,
            "validationLoss": validation_loss,
            "seconds": round(time.time() - started, 2),
            "device": str(device),
            "lastLossParts": {
                name: float(value.detach().cpu())
                for name, value in last_loss_parts.items()
            },
        }
        append_json(log_path, record)
        save_checkpoint(output_dir / "latest.pt", model=generator, optimizer=generator_optimizer, epoch=epoch, step=step, loss=generator_average, config=config)
        if generator_average < best_generator_loss:
            best_generator_loss = generator_average
            best_adversarial_loss = adversarial_average
            save_checkpoint(output_dir / "best.pt", model=generator, optimizer=generator_optimizer, epoch=epoch, step=step, loss=generator_average, config=config)
        if validation_loss < best_validation_loss:
            best_validation_loss = validation_loss
            save_checkpoint(
                output_dir / "best-validation.pt",
                model=generator,
                optimizer=generator_optimizer,
                epoch=epoch,
                step=step,
                loss=validation_loss,
                config=config,
            )

    summary = {
        "status": "completed",
        "trainingVersion": config.get("trainingVersion"),
        "modelVersion": config.get("modelVersion"),
        "epochs": epochs,
        "steps": step,
        "bestGeneratorLoss": best_generator_loss,
        "bestValidationLoss": best_validation_loss,
        "bestAdversarialLoss": best_adversarial_loss,
        "device": str(device),
        "parameterCount": parameter_count,
        "discriminatorParameterCount": discriminator_parameter_count,
        "trainSampleCount": len(train_set),
        "validationSampleCount": len(validation_set),
        "lossWeights": config.get("lossWeights", {}),
        "adversarialWeight": adversarial_weight,
        "augmentTrain": train_augment,
        "conditionExtraChannels": condition_extra_channels,
        "zeroBaseRgb": bool(config.get("zeroBaseRgb", False)),
        "baseRgbManifest": config.get("baseRgbManifest"),
        "structureCheckpoint": str(structure_checkpoint.resolve()),
        "initializedFrom": initialized_from,
        "displayAllowed": False,
        "canPromoteToWorld": False,
        "note": "Local full-scene PatchGAN refiner training only. It is not an ApprovedFrame.",
    }
    (output_dir / "training-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary


def evaluate(model, structure_model, loader, device, torch, use_amp: bool, config: dict[str, object]) -> float:
    model.eval()
    total = 0.0
    base_rgb_manifest = load_base_rgb_manifest(config)
    with torch.inference_mode():
        for batch in loader:
            condition = batch["condition"].to(device, non_blocking=True)
            target = batch["target"].to(device, non_blocking=True)
            if base_rgb_manifest:
                base_rgb = load_base_rgb_batch(base_rgb_manifest, batch["sampleId"], torch, device)
            else:
                base_rgb, _ = structure_model(condition[:, :14])
            if bool(config.get("zeroBaseRgb", False)) and not base_rgb_manifest:
                base_rgb = torch.zeros_like(base_rgb)
            context = torch.autocast(device_type="cuda", dtype=torch.float16) if use_amp else nullcontext()
            with context:
                prediction = model(condition, base_rgb)
                loss, _ = build_image_loss(prediction, target, torch, config, condition)
            total += float(loss.cpu())
    return total / len(loader)


def append_json(path: Path, value: dict[str, object]) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + "\n")


def read_condition_extra_channels(config: dict[str, object]) -> list[str]:
    values = config.get("conditionExtraChannels", [])
    if not isinstance(values, list):
        raise ValueError("conditionExtraChannels must be a list")
    return [str(value) for value in values]


def load_base_rgb_manifest(config: dict[str, object]) -> dict[str, Path]:
    raw_path = config.get("baseRgbManifest")
    if not raw_path:
        return {}
    manifest_path = Path(str(raw_path))
    if not manifest_path.is_absolute():
        manifest_path = Path.cwd() / manifest_path
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = manifest.get("rows", [])
    if not isinstance(rows, list):
        raise ValueError(f"invalid baseRgbManifest rows: {manifest_path}")
    mapping: dict[str, Path] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        sample_id = row.get("sampleId")
        generated = row.get("generated")
        if isinstance(sample_id, str) and isinstance(generated, str):
            mapping[sample_id] = Path(generated)
    if not mapping:
        raise ValueError(f"empty baseRgbManifest: {manifest_path}")
    return mapping


def load_base_rgb_batch(base_rgb_manifest: dict[str, Path], sample_ids, torch, device):
    images = []
    for sample_id in sample_ids:
        path = base_rgb_manifest.get(str(sample_id))
        if path is None:
            raise ValueError(f"base RGB not found for sampleId: {sample_id}")
        images.append(image_tensor(path, "RGB", torch, expected_channels=3))
    return torch.stack(images, dim=0).to(device, non_blocking=True)


if __name__ == "__main__":
    raise SystemExit(main())
