from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
import sys

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parents[2]
SRC = PROJECT_ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world import (
    build_complete_world_system,
    deterministic_velocity_step,
    inference_timesteps,
)
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset


ARCHITECTURE = "stage4_post_decode_authoritative_object_rgb_compositor_v1"
IDENTITIES = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
SAMPLE_194 = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
SEED = 20263722
DIFFUSION_STEPS = 1000
ROLLOUT_STEPS = 50


def state_hash(module: torch.nn.Module) -> str:
    digest = hashlib.sha256()
    for name, value in module.state_dict().items():
        digest.update(name.encode())
        digest.update(value.detach().cpu().contiguous().numpy().tobytes())
    return digest.hexdigest()


def finite_nonzero(values) -> bool:
    present = tuple(value for value in values if value is not None)
    return (
        bool(present)
        and all(bool(torch.isfinite(value).all()) for value in present)
        and sum(float(value.detach().abs().sum().cpu()) for value in present) > 0.0
    )


def select_first_nonempty_train_sample_per_class(
    train_dataset: AiAssistedConditionalDenoiserDataset,
    condition_channel_order: list[str],
) -> dict[str, tuple[dict, int]]:
    """Select deterministic class fixtures from the formal source-index order.

    A class gradient qualification is meaningful only when its authoritative mask
    has support.  The dataset already preserves the formal source-index order, so
    the first non-empty mask is unique and does not introduce sample choice.
    """
    selected: dict[str, tuple[dict, int]] = {}
    source_indexes = {
        identity: condition_channel_order.index(identity) for identity in IDENTITIES
    }
    for dataset_index in range(len(train_dataset)):
        sample = train_dataset[dataset_index]
        for identity in IDENTITIES:
            if identity in selected:
                continue
            support = int(
                torch.count_nonzero(
                    sample["conditions"][source_indexes[identity]]
                ).item()
            )
            if support > 0:
                selected[identity] = (sample, support)
        if len(selected) == len(IDENTITIES):
            break
    missing = [identity for identity in IDENTITIES if identity not in selected]
    if missing:
        raise ValueError(
            "formal train split has no non-empty authoritative mask for: "
            + ", ".join(missing)
        )
    return selected


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--autoencoder-checkpoint", type=Path, required=True)
    args = parser.parse_args()

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable")
    device = torch.device("cuda")
    config = json.loads(args.config.read_text(encoding="utf-8"))
    if config.get("denoiserArchitecture") != ARCHITECTURE:
        raise ValueError("GPU qualification architecture identity mismatch")

    train_dataset = AiAssistedConditionalDenoiserDataset(
        args.dataset,
        "train",
        list(config["conditionChannelOrder"]),
        (256, 192),
        selection_contract="registered_v7_capacity_contribution_v1",
    )
    validation_dataset = AiAssistedConditionalDenoiserDataset(
        args.dataset,
        "validation",
        list(config["conditionChannelOrder"]),
        (256, 192),
        selection_contract="registered_v7_capacity_contribution_v1",
    )
    selected_train_samples = select_first_nonempty_train_sample_per_class(
        train_dataset,
        list(config["conditionChannelOrder"]),
    )
    validation_matches = [
        validation_dataset[index]
        for index in range(len(validation_dataset))
        if validation_dataset.rows[index]["sampleId"] == SAMPLE_194
    ]
    if len(validation_matches) != 1:
        raise ValueError("fixed validation sample 194 identity is not unique")
    validation_sample = validation_matches[0]

    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    model = build_complete_world_system(config).to(device)
    checkpoint = torch.load(args.autoencoder_checkpoint, map_location="cpu", weights_only=False)
    autoencoder_state = checkpoint.get("autoencoderState")
    if not isinstance(autoencoder_state, dict):
        raise ValueError("project Autoencoder checkpoint state is missing")
    model.autoencoder.load_state_dict(autoencoder_state)
    model.autoencoder.eval()
    for parameter in model.autoencoder.parameters():
        parameter.requires_grad_(False)
    model.eval()
    model_before = state_hash(model.denoiser)
    autoencoder_before = state_hash(model.autoencoder)

    betas = torch.linspace(0.0001, 0.02, DIFFUSION_STEPS, device=device)
    alpha_bars = torch.cumprod(1.0 - betas, dim=0)
    steps = inference_timesteps(DIFFUSION_STEPS, ROLLOUT_STEPS, device)
    validation_conditions = validation_sample["conditions"].unsqueeze(0).to(device)
    latent_shape = model.autoencoder.encode(
        validation_sample["image"].unsqueeze(0).to(device)
    ).shape
    generator = torch.Generator(device=device).manual_seed(SEED)
    rollout_latent = torch.randn(latent_shape, device=device, generator=generator)
    with torch.no_grad():
        for step_index, timestep in enumerate(steps):
            timestep_value = int(timestep.item())
            previous = int(steps[step_index + 1].item()) if step_index + 1 < len(steps) else -1
            timestep_batch = torch.full((1,), timestep_value, device=device, dtype=torch.long)
            velocity = model.predict_velocity(
                rollout_latent,
                timestep_batch,
                validation_conditions,
            )
            rollout_latent = deterministic_velocity_step(
                rollout_latent,
                velocity,
                timestep_value,
                previous,
                alpha_bars,
            )
        final_rgb, final_evidence = model.decode_stage4_post_decode_object_rgb(
            rollout_latent,
            validation_conditions,
            return_evidence=True,
        )
    if tuple(final_rgb.shape) != (1, 3, 192, 256):
        raise ValueError("50-step final RGB shape mismatch")

    head_results = []
    all_heads = model.denoiser.stage4_post_decode_object_rgb_heads
    final_visible_probe = None
    for class_offset, identity in enumerate(IDENTITIES):
        train_sample, authoritative_mask_support = selected_train_samples[identity]
        train_image = train_sample["image"].unsqueeze(0).to(device)
        train_conditions = (
            train_sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
        )
        with torch.no_grad():
            clean_latent = model.autoencoder.encode(train_image)
        timestep = torch.tensor([500], dtype=torch.long, device=device)
        generator = torch.Generator(device=device).manual_seed(SEED + class_offset)
        noisy_latent = torch.randn(clean_latent.shape, device=device, generator=generator)
        velocity = model.predict_velocity(noisy_latent, timestep, train_conditions)
        alpha = alpha_bars[timestep].view(1, 1, 1, 1)
        predicted_clean = (
            alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * velocity
        )
        predicted_rgb, evidence = model.decode_stage4_post_decode_object_rgb(
            predicted_clean.detach(),
            train_conditions,
            return_evidence=True,
        )
        identity_index = IDENTITIES.index(identity)
        mask = evidence["objectMasks"][identity_index]
        contribution = evidence["authoritativelyGatedObjectRgb"][identity_index]
        own_parameters = tuple(all_heads[identity].parameters())
        gradients = torch.autograd.grad(
            contribution.sum(),
            own_parameters,
            retain_graph=True,
            allow_unused=False,
        )
        condition_gradient = torch.autograd.grad(
            contribution.sum(),
            train_conditions,
            retain_graph=True,
            allow_unused=False,
        )[0]
        source_index = config["conditionChannelOrder"].index(identity)
        own_source = condition_gradient[:, source_index:source_index + 1]
        other_sources = torch.cat(
            (condition_gradient[:, :source_index], condition_gradient[:, source_index + 1:]),
            dim=1,
        )
        outside_zero = bool((contribution * (1.0 - mask)).abs().max() == 0)
        result = {
            "classIdentity": identity,
            "selectedTrainSampleId": train_sample["sampleId"],
            "selectionRule": "first_nonempty_per_class_by_formal_source_index",
            "authoritativeMaskNonzeroCount": authoritative_mask_support,
            "parameterGradientFiniteNonzero": finite_nonzero(gradients),
            "sameClassConditionGradientFiniteNonzero": finite_nonzero((own_source,)),
            "otherConditionChannelGradientStrictlyZero": bool(other_sources.abs().max() == 0),
            "outsideMaskContributionStrictlyZero": outside_zero,
        }
        qualification_flags = (
            "parameterGradientFiniteNonzero",
            "sameClassConditionGradientFiniteNonzero",
            "otherConditionChannelGradientStrictlyZero",
            "outsideMaskContributionStrictlyZero",
        )
        if not all(result[key] is True for key in qualification_flags):
            raise ValueError(
                f"object RGB head qualification failed: {identity}: "
                + json.dumps(result, ensure_ascii=False, sort_keys=True)
            )
        head_results.append(result)
        if final_visible_probe is None:
            final_visible_rgb = model.decode_stage4_post_decode_object_rgb(
                predicted_clean,
                train_conditions,
            )
            final_visible_probe = (final_visible_rgb, train_image)

    if final_visible_probe is None:
        raise ValueError("no final visible RGB gradient probe was formed")
    visible_loss = torch.nn.functional.l1_loss(*final_visible_probe)
    denoiser_gradients = torch.autograd.grad(
        visible_loss,
        tuple(parameter for parameter in model.denoiser.parameters() if parameter.requires_grad),
        retain_graph=False,
        allow_unused=True,
    )
    if not finite_nonzero(denoiser_gradients):
        raise ValueError("final visible RGB does not reach Denoiser parameters")

    torch.cuda.synchronize()
    model_after = state_hash(model.denoiser)
    autoencoder_after = state_hash(model.autoencoder)
    if model_before != model_after or autoencoder_before != autoencoder_after:
        raise ValueError("readonly GPU qualification changed model state")

    report = {
        "schemaVersion": "stage4-post-decode-object-rgb-readonly-gpu-report-v1",
        "status": "passed",
        "architectureId": ARCHITECTURE,
        "seed": SEED,
        "resolution": {"width": 256, "height": 192},
        "rolloutSteps": ROLLOUT_STEPS,
        "trainSampleSelectionRule": "first_nonempty_per_class_by_formal_source_index",
        "trainSampleIdsByClass": {
            item["classIdentity"]: item["selectedTrainSampleId"] for item in head_results
        },
        "validationSampleId": validation_sample["sampleId"],
        "finalRgbShape": list(final_rgb.shape),
        "objectIdentityOrder": list(final_evidence["objectIdentityOrder"]),
        "headResults": head_results,
        "finalVisibleRgbDenoiserGradientFiniteNonzero": True,
        "modelStateSha256Before": model_before,
        "modelStateSha256After": model_after,
        "autoencoderStateSha256Before": autoencoder_before,
        "autoencoderStateSha256After": autoencoder_after,
        "modelStateUnchanged": True,
        "autoencoderStateUnchanged": True,
        "cuda": {
            "deviceName": torch.cuda.get_device_name(0),
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated()),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved()),
        },
        "optimizerCreated": False,
        "backwardExecuted": False,
        "checkpointWritten": False,
        "trainingStarted": False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
