from __future__ import annotations

from argparse import ArgumentParser
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import torch

from ai_painter.complete_world import build_complete_world_system, velocity_target
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter_preview_reproduction import state_dict_sha256
from train_stage4_isolated_responsibility_component_smoke import ROLES, SAMPLE_ID, SEED, _component_loss
import train_ai_assisted_conditional_denoiser as formal


def write_report(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dataset-package", type=Path, required=True)
    parser.add_argument("--autoencoder-checkpoint", type=Path, required=True)
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        config = formal.read_json(args.config)
        package = formal.read_json(args.dataset_package)
        authorization = formal.read_json(args.authorization)
        consumption = formal.read_json(args.consumption)
        role = config.get("stage4ResponsibilityComponentRole")
        component = config.get("training", {}).get("stage4IsolatedResponsibilityComponent", {})
        owner = config.get("training", {}).get("ownerTrainingAuthorization", {})
        active = {key for key, enabled in component.get("activationGate", {}).items() if enabled is True}
        if (
            role != ROLES[0]
            or active != {"configurationActiveNow", "checkpointReadNow", "gpuUseNow"}
            or owner.get("executionState") != "readonly_qualification_consumed"
            or owner.get("optimizerCreationAuthorized") is not False
            or owner.get("backwardExecutionAuthorized") is not False
            or owner.get("modelWeightMutationAuthorized") is not False
            or authorization.get("roleId") != role
            or authorization.get("readonlyGpuQualificationAuthorized") is not True
            or consumption.get("status") != "component_backward_readonly_gpu_authorization_consumed"
            or package.get("v7CapacityContributionCount") != 64
        ):
            raise ValueError("component_backward_qualification_contract_invalid")
        formal.set_seed(SEED)
        if not torch.cuda.is_available():
            raise ValueError("component_backward_qualification_cuda_unavailable")
        device = torch.device("cuda:0")
        model = build_complete_world_system(config).to(device)
        checkpoint = formal.load_autoencoder_checkpoint(args.autoencoder_checkpoint, config)
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
        model.autoencoder.requires_grad_(False)
        model.autoencoder.eval()
        model.denoiser.eval()
        model_before = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_before = state_dict_sha256(model.autoencoder.state_dict())
        train_dataset = AiAssistedConditionalDenoiserDataset(
            args.dataset_package, "train", list(config["conditionChannelOrder"]), (256, 192),
            selection_contract=formal.conditional_dataset_selection_contract(config),
        )
        validation = AiAssistedConditionalDenoiserDataset(
            args.dataset_package, "validation", list(config["conditionChannelOrder"]), (256, 192),
            selection_contract=formal.conditional_dataset_selection_contract(config),
        )
        matches = [index for index, row in enumerate(validation.rows) if row["sampleId"] == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("component_backward_qualification_sample_invalid")
        normalization = formal.compute_latent_normalization(model, train_dataset, device)
        sample = validation[matches[0]]
        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device)
        with torch.no_grad():
            clean = formal.normalize_latent(model.autoencoder.encode(image), normalization)
        generator = torch.Generator(device="cuda")
        generator.manual_seed(SEED)
        source = torch.randn(clean.shape, generator=generator, device=device, dtype=clean.dtype)
        diffusion = formal.build_diffusion_schedule(config, device)
        timestep = formal.training_timesteps(config, 0, 0, 1, 1, int(config["diffusionSteps"]), device)
        target_velocity = velocity_target(clean, source, timestep, diffusion["alphasCumulative"])
        metrics = _component_loss(
            model, role, source, clean, target_velocity, timestep, diffusion,
            conditions, image, normalization, config,
        )
        loss = metrics["compositeLossTensor"]
        named_parameters = [(name, parameter) for name, parameter in model.denoiser.named_parameters() if parameter.requires_grad]
        gradients = torch.autograd.grad(loss, [parameter for _, parameter in named_parameters], allow_unused=True)
        evidence = []
        for (name, _), gradient in zip(named_parameters, gradients):
            evidence.append({
                "name": name,
                "reachable": gradient is not None,
                "finite": gradient is not None and bool(torch.isfinite(gradient).all()),
                "nonzeroCount": 0 if gradient is None else int(torch.count_nonzero(gradient)),
            })
        if not bool(torch.isfinite(loss)) or any(not row["reachable"] or not row["finite"] or row["nonzeroCount"] <= 0 for row in evidence):
            raise ValueError("component_backward_qualification_gradient_invalid")
        model_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_after = state_dict_sha256(model.autoencoder.state_dict())
        if model_before != model_after or autoencoder_before != autoencoder_after:
            raise ValueError("component_backward_qualification_state_changed")
        report = {
            "schemaVersion": "stage4-isolated-responsibility-component-backward-gpu-qualification-v1",
            "status": "stage4_terrain_component_readonly_gpu_backward_qualification_passed",
            "roleId": role,
            "sampleId": SAMPLE_ID,
            "seed": SEED,
            "lossFinite": True,
            "lossValue": float(loss.detach()),
            "parameterGradientEvidence": evidence,
            "modelStateBeforeSha256": model_before,
            "modelStateAfterSha256": model_after,
            "autoencoderStateBeforeSha256": autoencoder_before,
            "autoencoderStateAfterSha256": autoencoder_after,
            "modelStateUnchanged": True,
            "autoencoderStateUnchanged": True,
            "deterministicAlgorithmsEnabled": torch.are_deterministic_algorithms_enabled(),
            "optimizerCreated": False,
            "backwardExecuted": False,
            "weightModified": False,
            "checkpointWritten": False,
            "authorizationSha256": sha256(args.authorization),
            "consumptionSha256": sha256(args.consumption),
        }
        write_report(args.output, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        report = {
            "schemaVersion": "stage4-isolated-responsibility-component-backward-gpu-qualification-v1",
            "status": "stage4_terrain_component_readonly_gpu_backward_qualification_failed_closed",
            "error": str(error),
            "optimizerCreated": False,
            "backwardExecuted": False,
            "weightModified": False,
            "checkpointWritten": False,
        }
        write_report(args.output, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
