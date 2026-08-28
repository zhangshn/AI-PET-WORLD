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


ARCHITECTURE = (
    "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1"
)
IDENTITIES = (
    "terrain_path_ground",
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


def select_first_nonempty_train_sample_per_responsibility(
    train_dataset: AiAssistedConditionalDenoiserDataset,
    condition_channel_order: list[str],
) -> dict[str, tuple[dict, int]]:
    selected: dict[str, tuple[dict, int]] = {}
    indexes = {
        identity: condition_channel_order.index(identity) for identity in IDENTITIES
    }
    for dataset_index in range(len(train_dataset)):
        sample = train_dataset[dataset_index]
        for identity in IDENTITIES:
            if identity in selected:
                continue
            support = int(
                torch.count_nonzero(sample["conditions"][indexes[identity]]).item()
            )
            if support > 0:
                selected[identity] = (sample, support)
        if len(selected) == len(IDENTITIES):
            break
    missing = [identity for identity in IDENTITIES if identity not in selected]
    if missing:
        raise ValueError(
            "formal train split has no non-empty responsibility mask for: "
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
        raise ValueError("readonly GPU architecture identity mismatch")
    if tuple(config.get("postDecodeResponsibilityIdentityOrder", ())) != IDENTITIES:
        raise ValueError("readonly GPU responsibility identity mismatch")

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
    selected = select_first_nonempty_train_sample_per_responsibility(
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
    checkpoint = torch.load(
        args.autoencoder_checkpoint,
        map_location="cpu",
        weights_only=False,
    )
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
    with torch.no_grad():
        latent_shape = model.autoencoder.encode(
            validation_sample["image"].unsqueeze(0).to(device)
        ).shape
        generator = torch.Generator(device=device).manual_seed(SEED)
        rollout_latent = torch.randn(latent_shape, device=device, generator=generator)
        for step_index, timestep in enumerate(steps):
            timestep_value = int(timestep.item())
            previous = (
                int(steps[step_index + 1].item())
                if step_index + 1 < len(steps)
                else -1
            )
            timestep_batch = torch.full(
                (1,), timestep_value, device=device, dtype=torch.long
            )
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
        final_rgb, final_evidence = (
            model.decode_stage4_post_decode_full_condition_responsibility_rgb(
                rollout_latent,
                validation_conditions,
                return_evidence=True,
            )
        )
    if tuple(final_rgb.shape) != (1, 3, 192, 256):
        raise ValueError("50-step final RGB shape mismatch")

    heads = model.denoiser.stage4_post_decode_full_condition_responsibility_heads
    branch_results = []
    for responsibility_offset, identity in enumerate(IDENTITIES):
        train_sample, mask_support = selected[identity]
        train_image = train_sample["image"].unsqueeze(0).to(device)
        train_conditions = (
            train_sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
        )
        with torch.no_grad():
            clean_latent = model.autoencoder.encode(train_image)
        timestep = torch.tensor([500], dtype=torch.long, device=device)
        generator = torch.Generator(device=device).manual_seed(
            SEED + responsibility_offset
        )
        noisy_latent = torch.randn(
            clean_latent.shape,
            device=device,
            generator=generator,
        )
        velocity = model.predict_velocity(noisy_latent, timestep, train_conditions)
        alpha = alpha_bars[timestep].view(1, 1, 1, 1)
        predicted_clean = (
            alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * velocity
        )
        _, evidence = (
            model.decode_stage4_post_decode_full_condition_responsibility_rgb(
                predicted_clean.detach(),
                train_conditions,
                return_evidence=True,
            )
        )
        identity_index = IDENTITIES.index(identity)
        mask = evidence["responsibilityMasks"][identity_index]
        contribution = evidence["authoritativelyGatedResponsibilityRgb"][
            identity_index
        ]
        own_parameters = tuple(heads[identity].parameters())
        own_gradients = torch.autograd.grad(
            contribution.sum(),
            own_parameters,
            retain_graph=True,
            allow_unused=False,
        )
        other_parameters = tuple(
            parameter
            for other_identity in IDENTITIES
            if other_identity != identity
            for parameter in heads[other_identity].parameters()
        )
        other_gradients = torch.autograd.grad(
            contribution.sum(),
            other_parameters,
            retain_graph=True,
            allow_unused=True,
        )
        condition_gradient = torch.autograd.grad(
            contribution.sum(),
            train_conditions,
            retain_graph=False,
            allow_unused=False,
        )[0]
        channel_support = condition_gradient.abs().flatten(2).amax(dim=2)
        result = {
            "responsibilityIdentity": identity,
            "selectedTrainSampleId": train_sample["sampleId"],
            "selectionRule": "first_nonempty_per_responsibility_by_formal_source_index",
            "authoritativeMaskNonzeroCount": mask_support,
            "parameterGradientFiniteNonzero": finite_nonzero(own_gradients),
            "all23ConditionGradientsFiniteNonzero": (
                bool(torch.isfinite(condition_gradient).all())
                and bool((channel_support > 0).all())
            ),
            "crossResponsibilityParameterGradientsStrictlyZero": all(
                value is None or bool(value.abs().max() == 0)
                for value in other_gradients
            ),
            "outsideMaskContributionStrictlyZero": bool(
                (contribution * (1.0 - mask)).abs().max() == 0
            ),
            "branchInputChannels": evidence["branchInputChannels"],
        }
        required = (
            "parameterGradientFiniteNonzero",
            "all23ConditionGradientsFiniteNonzero",
            "crossResponsibilityParameterGradientsStrictlyZero",
            "outsideMaskContributionStrictlyZero",
        )
        if not all(result[key] is True for key in required):
            raise ValueError(
                f"responsibility qualification failed: {identity}: "
                + json.dumps(result, ensure_ascii=False, sort_keys=True)
            )
        if result["branchInputChannels"] != 26:
            raise ValueError(f"responsibility input identity changed: {identity}")
        branch_results.append(result)
        del velocity, predicted_clean, evidence, contribution, condition_gradient

    probe_sample = selected["terrain_path_ground"][0]
    probe_image = probe_sample["image"].unsqueeze(0).to(device)
    probe_conditions = probe_sample["conditions"].unsqueeze(0).to(device)
    with torch.no_grad():
        probe_clean = model.autoencoder.encode(probe_image)
    probe_timestep = torch.tensor([500], dtype=torch.long, device=device)
    probe_generator = torch.Generator(device=device).manual_seed(SEED)
    probe_noisy = torch.randn(
        probe_clean.shape,
        device=device,
        generator=probe_generator,
    )
    probe_velocity = model.predict_velocity(
        probe_noisy,
        probe_timestep,
        probe_conditions,
    )
    probe_alpha = alpha_bars[probe_timestep].view(1, 1, 1, 1)
    probe_predicted_clean = (
        probe_alpha.sqrt() * probe_noisy
        - (1.0 - probe_alpha).sqrt() * probe_velocity
    )
    probe_rgb = model.decode_stage4_post_decode_full_condition_responsibility_rgb(
        probe_predicted_clean,
        probe_conditions,
    )
    visible_loss = torch.nn.functional.l1_loss(probe_rgb, probe_image)
    denoiser_gradients = torch.autograd.grad(
        visible_loss,
        tuple(
            parameter
            for parameter in model.denoiser.parameters()
            if parameter.requires_grad
        ),
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
        "schemaVersion":
            "stage4-post-decode-full-condition-responsibility-readonly-gpu-report-v1",
        "status": "passed",
        "architectureId": ARCHITECTURE,
        "seed": SEED,
        "resolution": {"width": 256, "height": 192},
        "rolloutSteps": ROLLOUT_STEPS,
        "topology": "west",
        "trainSampleSelectionRule":
            "first_nonempty_per_responsibility_by_formal_source_index",
        "trainSampleIdsByResponsibility": {
            item["responsibilityIdentity"]: item["selectedTrainSampleId"]
            for item in branch_results
        },
        "validationSampleId": validation_sample["sampleId"],
        "finalRgbShape": list(final_rgb.shape),
        "responsibilityIdentityOrder": list(
            final_evidence["responsibilityIdentityOrder"]
        ),
        "sourceConditionChannels": list(final_evidence["sourceConditionChannels"]),
        "branchResults": branch_results,
        "finalVisibleRgbDenoiserGradientFiniteNonzero": True,
        "modelStateSha256Before": model_before,
        "modelStateSha256After": model_after,
        "autoencoderStateSha256Before": autoencoder_before,
        "autoencoderStateSha256After": autoencoder_after,
        "modelStateUnchanged": True,
        "autoencoderStateUnchanged": True,
        "cuda": {
            "deviceName": torch.cuda.get_device_name(0),
            "deviceCapability": list(torch.cuda.get_device_capability(0)),
            "torchVersion": torch.__version__,
            "cudaRuntimeVersion": torch.version.cuda,
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated()),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved()),
        },
        "optimizerCreated": False,
        "backwardExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
