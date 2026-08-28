from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time

import torch


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
SRC = ROOT / "ml" / "ai-painter" / "src"
sys.path.insert(0, str(SRC))
sys.path.insert(0, str(SCRIPT_DIR))

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
from ai_painter_route_counterfactual_compositor_contract import (
    COUNTERFACTUAL_DERIVED_CHANNELS,
    validate_route_counterfactual_compositor_cpu_inactive_config,
)
import train_ai_assisted_conditional_denoiser as trainer


CAPABILITY = "stage4-native-route-counterfactual-compositor-change-candidate-v1"
TASK = "run_route_counterfactual_compositor_readonly_gpu_qualification"
ARCHITECTURE = "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1"
SEED = 20263722
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
DERIVED_CHANNELS = tuple(COUNTERFACTUAL_DERIVED_CHANNELS)
RESPONSIBILITY_IDENTITIES = (
    "terrain_path_ground",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
EXPECTED_PARAMETER_TENSORS = 50
EXPECTED_PARAMETER_COUNT = 4_610_572


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def resolve(value: Path) -> Path:
    if value.is_absolute() or ".." in value.parts:
        raise ValueError("project_relative_path_required")
    root = ROOT.resolve()
    logical = (ROOT / value).absolute()
    if logical != root and root not in logical.parents:
        raise ValueError("project_path_escape")
    resolved = logical.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved != root and root not in resolved.parents and not (
        resolved == runtime or runtime in resolved.parents
    ):
        raise ValueError("unregistered_external_path")
    return resolved


def project_path(value: Path):
    resolved = value.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT.resolve()).as_posix()


def sha256_file(value: Path):
    return hashlib.sha256(value.read_bytes()).hexdigest()


def binding(value: Path):
    return {"path": project_path(value), "sha256": sha256_file(value)}


def tensor_sha256(value):
    tensor = value.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(tensor.dtype).encode("ascii"))
    digest.update(str(tuple(tensor.shape)).encode("ascii"))
    digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def state_sha256(module):
    digest = hashlib.sha256()
    for name, value in sorted(module.state_dict().items()):
        digest.update(name.encode("utf-8"))
        digest.update(tensor_sha256(value).encode("ascii"))
    return digest.hexdigest()


def write_atomic(value: Path, payload):
    value.parent.mkdir(parents=True, exist_ok=True)
    temporary = value.with_name(f".{value.name}.{os.getpid()}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, value)


def write_exclusive(value: Path, payload):
    value.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(value, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try:
        os.write(
            descriptor,
            (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
        )
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def validate_ticket(ticket, ticket_path, consumption, output):
    if ticket.get("schemaVersion") != "ai-painter-local-internal-readonly-gpu-ticket-v1":
        raise ValueError("ticket_schema_invalid")
    if ticket.get("status") != "issued_not_consumed" or ticket.get("authority") != "local_ai_pet_world_program":
        raise ValueError("ticket_state_or_authority_invalid")
    if ticket.get("capabilityVersion") != CAPABILITY or ticket.get("taskId") != TASK:
        raise ValueError("ticket_task_identity_invalid")
    if ticket_path.parent != consumption.parent or output.parent != ticket_path.parent:
        raise ValueError("ticket_namespace_mismatch")
    permissions = ticket.get("permissions", {})
    if permissions.get("projectAutoencoderCheckpointRead") is not True:
        raise ValueError("autoencoder_read_permission_missing")
    for key in (
        "denoiserCheckpointRead",
        "optimizerCreation",
        "backwardExecution",
        "weightMutation",
        "checkpointWrite",
        "smoke",
        "training",
    ):
        if permissions.get(key) is not False:
            raise ValueError(f"forbidden_permission_present:{key}")
    expected_identity = {
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "sampleId": SAMPLE_ID,
        "split": "validation",
        "conditionChannels": 23,
        "latentChannels": 12,
        "counterfactualDerivedChannels": list(DERIVED_CHANNELS),
        "sharedParameterCopies": 1,
        "additionalTrainableParameterCount": 0,
    }
    if ticket.get("executionIdentity") != expected_identity:
        raise ValueError("ticket_execution_identity_invalid")
    for name, item in ticket.get("bindings", {}).items():
        file = resolve(Path(item.get("path", "")))
        if not file.is_file() or sha256_file(file) != item.get("sha256"):
            raise ValueError(f"ticket_binding_invalid:{name}")
    source_index = resolve(Path(ticket["bindings"]["sourceIndex"]["path"]))
    if sha256_file(source_index) != SOURCE_INDEX_SHA256:
        raise ValueError("source_index_identity_changed")


def preflight(ticket, ticket_path, consumption, output):
    validate_ticket(ticket, ticket_path, consumption, output)
    if consumption.exists() or output.exists():
        raise ValueError("ticket_or_output_already_consumed")
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable")
    free_gpu, total_gpu = torch.cuda.mem_get_info(0)
    free_disk = shutil.disk_usage(ticket_path.parent).free
    if free_gpu < 4 * 1024**3:
        raise ValueError("available_gpu_memory_below_formal_floor")
    if free_disk < 2 * 1024**3:
        raise ValueError("disk_budget_insufficient")
    return {
        "schemaVersion": "stage4-route-counterfactual-compositor-readonly-gpu-preflight-v1",
        "status": "passed_not_consumed",
        "cudaDevice": torch.cuda.get_device_name(0),
        "freeGpuMemoryBytes": int(free_gpu),
        "totalGpuMemoryBytes": int(total_gpu),
        "freeDiskBytes": int(free_disk),
        "recordedAtUtc": utc_now(),
    }


def finite_nonzero(value):
    return value is not None and bool(torch.isfinite(value).all()) and bool(torch.any(value != 0))


def finite_zero(value):
    return value is not None and bool(torch.isfinite(value).all()) and int(torch.count_nonzero(value).detach().cpu()) == 0


def load_sample(config):
    selection = trainer.conditional_dataset_selection_contract(config)
    if selection != "registered_v7_capacity_contribution_v1":
        raise ValueError("formal_dataset_selection_contract_invalid")
    datasets = {
        split: AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            split,
            list(config["conditionChannelOrder"]),
            (256, 192),
            selection_contract=selection,
        )
        for split in ("train", "validation", "challenge", "regression")
    }
    counts = {key: len(value) for key, value in datasets.items()}
    if counts != {"train": 48, "validation": 8, "challenge": 4, "regression": 4}:
        raise ValueError("formal_dataset_split_identity_invalid")
    rows = [row["sampleId"] for row in datasets["validation"].rows]
    if rows.count(SAMPLE_ID) != 1:
        raise ValueError("fixed_validation_sample_identity_invalid")
    return datasets["validation"][rows.index(SAMPLE_ID)], counts


def require_counterfactual_derivation(conditions, evidence, channel_order):
    no_route = evidence.get("noRouteConditions")
    if not torch.is_tensor(no_route) or no_route.shape != conditions.shape:
        raise ValueError("no_route_condition_tensor_invalid")
    indices = {name: channel_order.index(name) for name in DERIVED_CHANNELS}
    expected = conditions.detach().clone()
    expected[:, indices["terrain_grass"]] = torch.maximum(
        conditions[:, indices["terrain_grass"]],
        conditions[:, indices["terrain_path_ground"]],
    )
    expected[:, indices["terrain_path_ground"]] = 0
    expected[:, indices["signed_distance_path"]] = 1.0 / 255.0
    if not torch.equal(no_route, expected):
        raise ValueError("counterfactual_three_channel_derivation_changed")
    unchanged = [
        index for index, name in enumerate(channel_order) if name not in DERIVED_CHANNELS
    ]
    if len(unchanged) != 20 or not torch.equal(no_route[:, unchanged], conditions[:, unchanged]):
        raise ValueError("counterfactual_unchanged_twenty_channels_changed")
    return {
        "derivedChannels": list(DERIVED_CHANNELS),
        "unchangedChannelCount": len(unchanged),
        "terrainGrassDerivation": "elementwise_max_original_grass_original_path",
        "terrainPathGroundUniqueValue": float(no_route[:, indices["terrain_path_ground"]].unique().item()),
        "signedDistancePathUniqueValue": float(no_route[:, indices["signed_distance_path"]].unique().item()),
        "originalConditionsSha256": tensor_sha256(conditions),
        "noRouteConditionsSha256": tensor_sha256(no_route),
        "unchangedTwentyChannelsByteIdentical": True,
    }


def run_gpu(ticket, ticket_path, consumption, output):
    started = time.perf_counter()
    output.mkdir(parents=False, exist_ok=False)
    config = json.loads(
        resolve(Path(ticket["bindings"]["inactiveConfig"]["path"])).read_text(encoding="utf-8")
    )
    validate_route_counterfactual_compositor_cpu_inactive_config(config)
    if config.get("denoiserArchitecture") != ARCHITECTURE:
        raise ValueError("architecture_identity_invalid")
    sample, split_counts = load_sample(config)
    torch.cuda.init()
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    device = torch.device("cuda:0")
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    model = build_complete_world_system(config)
    checkpoint_path = resolve(Path(ticket["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    if sha256_file(checkpoint_path) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_identity_changed")
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    model.to(device).eval()
    denoiser_before = state_sha256(model.denoiser)
    autoencoder_before = state_sha256(model.autoencoder)
    image = sample["image"].unsqueeze(0).to(device)
    conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
    with torch.no_grad():
        target_latent = model.autoencoder.encode(image)
    final_latent, evidence = model.denoiser(
        conditions,
        return_route_counterfactual_evidence=True,
    )
    required = {
        "fullRouteLatent",
        "noRouteLatent",
        "routeMask",
        "noRouteConditions",
        "sharedParameterCopies",
    }
    if not isinstance(evidence, dict) or not required.issubset(evidence):
        raise ValueError("counterfactual_evidence_fields_missing")
    full_route = evidence["fullRouteLatent"]
    no_route = evidence["noRouteLatent"]
    route_mask = evidence["routeMask"]
    no_route_conditions = evidence["noRouteConditions"]
    if evidence["sharedParameterCopies"] != 1:
        raise ValueError("shared_parameter_copy_identity_invalid")
    for name, value, shape in (
        ("fullRouteLatent", full_route, [1, 12, 48, 64]),
        ("noRouteLatent", no_route, [1, 12, 48, 64]),
        ("finalLatent", final_latent, [1, 12, 48, 64]),
        ("routeMask", route_mask, [1, 1, 48, 64]),
    ):
        if not torch.is_tensor(value) or list(value.shape) != shape or not bool(torch.isfinite(value).all()):
            raise ValueError(f"{name}_identity_invalid")
    channel_order = list(config["conditionChannelOrder"])
    derivation = require_counterfactual_derivation(conditions, evidence, channel_order)
    path_index = channel_order.index("terrain_path_ground")
    expected_mask = model.prepare_typed_conditions(
        conditions,
        final_latent.shape[-2:],
    )[:, path_index:path_index + 1].detach()
    if not torch.equal(route_mask, expected_mask) or route_mask.requires_grad:
        raise ValueError("authoritative_detached_route_mask_identity_invalid")
    inside = (route_mask != 0).expand_as(final_latent)
    outside = ~inside
    if int(torch.count_nonzero(inside).detach().cpu()) == 0 or int(torch.count_nonzero(outside).detach().cpu()) == 0:
        raise ValueError("route_mask_inside_or_outside_support_missing")
    expected_final = no_route + route_mask * (full_route - no_route)
    if not torch.equal(final_latent, expected_final):
        raise ValueError("formal_counterfactual_merge_formula_changed")
    inside_absolute_difference = (final_latent[inside] - full_route[inside]).abs()
    inside_scale = max(
        1.0,
        float(final_latent[inside].detach().abs().max().cpu()),
        float(full_route[inside].detach().abs().max().cpu()),
    )
    inside_derived_tolerance = (
        float(torch.finfo(final_latent.dtype).eps) * inside_scale * 3
    )
    if float(inside_absolute_difference.detach().max().cpu()) > inside_derived_tolerance:
        raise ValueError("final_latent_inside_route_not_numerically_owned_by_full_route")
    if not torch.equal(final_latent[outside], no_route[outside]):
        raise ValueError("final_latent_outside_route_not_owned_by_no_route")
    full_outside_gradient = torch.autograd.grad(
        (final_latent * outside.to(final_latent.dtype)).sum(),
        full_route,
        retain_graph=True,
        allow_unused=True,
    )[0]
    no_route_inside_gradient = torch.autograd.grad(
        (final_latent * inside.to(final_latent.dtype)).sum(),
        no_route,
        retain_graph=True,
        allow_unused=True,
    )[0]
    full_inside_gradient = torch.autograd.grad(
        (final_latent * inside.to(final_latent.dtype)).sum(),
        full_route,
        retain_graph=True,
        allow_unused=True,
    )[0]
    no_route_outside_gradient = torch.autograd.grad(
        (final_latent * outside.to(final_latent.dtype)).sum(),
        no_route,
        retain_graph=True,
        allow_unused=True,
    )[0]
    if not finite_zero(full_outside_gradient) or not finite_zero(no_route_inside_gradient):
        raise ValueError("counterfactual_gradient_ownership_isolation_failed")
    if not finite_nonzero(full_inside_gradient) or not finite_nonzero(no_route_outside_gradient):
        raise ValueError("counterfactual_gradient_owned_support_missing")
    decoded = model.decode_clean_latent(final_latent)
    if list(decoded.shape) != [1, 3, 192, 256] or not bool(torch.isfinite(decoded).all()):
        raise ValueError("decoded_rgb_identity_invalid")
    named_parameters = tuple(model.denoiser.named_parameters())
    parameter_count = sum(parameter.numel() for _name, parameter in named_parameters)
    if len(named_parameters) != EXPECTED_PARAMETER_TENSORS or parameter_count != EXPECTED_PARAMETER_COUNT:
        raise ValueError("zero_additional_parameter_identity_invalid")
    weights = config["training"]["denoiserLossWeights"]
    clean_loss = (final_latent - target_latent).abs().mean()
    rgb_loss = (decoded - image).abs().mean()
    objective = float(weights["cleanLatent"]) * clean_loss + float(weights["decodedRgb"]) * rgb_loss
    gradients = torch.autograd.grad(
        objective,
        (conditions, no_route_conditions, *(parameter for _name, parameter in named_parameters)),
        allow_unused=True,
    )
    if any(not finite_nonzero(value) for value in gradients):
        raise ValueError("formal_input_or_parameter_gradient_invalid")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("parameter_grad_field_populated")
    torch.cuda.synchronize(0)
    telemetry = {
        "deviceName": torch.cuda.get_device_name(0),
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        "durationSeconds": round(time.perf_counter() - started, 3),
    }
    gradient_evidence = {
        "conditionGradientFiniteNonzero": True,
        "conditionGradientNorm": float(gradients[0].detach().norm().cpu()),
        "noRouteConditionGradientFiniteNonzero": True,
        "noRouteConditionGradientNorm": float(gradients[1].detach().norm().cpu()),
        "allFormalParameterGradientsFiniteNonzero": True,
        "formalParameterTensorCount": len(named_parameters),
        "formalParameterCount": parameter_count,
        "additionalTrainableParameterCount": 0,
        "sharedParameterCopies": 1,
        "fullRouteGradientOutsideMaskStrictZero": True,
        "noRouteGradientInsideMaskStrictZero": True,
        "fullRouteGradientInsideMaskFiniteNonzero": True,
        "noRouteGradientOutsideMaskFiniteNonzero": True,
        "cleanLatentLoss": float(clean_loss.detach().cpu()),
        "decodedRgbLoss": float(rgb_loss.detach().cpu()),
        "qualificationObjective": float(objective.detach().cpu()),
    }
    ownership = {
        "routeMaskNonzeroCount": int(torch.count_nonzero(route_mask).detach().cpu()),
        "routeMaskZeroCount": int(route_mask.numel() - torch.count_nonzero(route_mask).detach().cpu()),
        "formalMergeFormulaByteIdentical": True,
        "insideFinalNumericallyEqualsFullRoute": True,
        "insideFullRouteMaximumAbsoluteDifference": float(
            inside_absolute_difference.detach().max().cpu()
        ),
        "insideFullRouteDerivedTolerance": inside_derived_tolerance,
        "insideFullRouteToleranceDerivation": "torch_finfo_dtype_eps_times_three_merge_operations_times_value_scale",
        "outsideFinalExactlyEqualsNoRoute": True,
        "routeMaskDetached": True,
        "routeMaskSha256": tensor_sha256(route_mask),
        "fullRouteLatentSha256": tensor_sha256(full_route),
        "noRouteLatentSha256": tensor_sha256(no_route),
        "finalLatentSha256": tensor_sha256(final_latent),
    }
    model.to("cpu")
    denoiser_after = state_sha256(model.denoiser)
    autoencoder_after = state_sha256(model.autoencoder)
    if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
        raise ValueError("model_state_changed")
    states = {
        "denoiserBefore": denoiser_before,
        "denoiserAfter": denoiser_after,
        "denoiserUnchanged": True,
        "autoencoderBefore": autoencoder_before,
        "autoencoderAfter": autoencoder_after,
        "autoencoderUnchanged": True,
    }
    write_atomic(output / "counterfactual-derivation-evidence.json", derivation)
    write_atomic(output / "latent-ownership-evidence.json", ownership)
    write_atomic(output / "gradient-evidence.json", gradient_evidence)
    write_atomic(output / "model-state-hashes.json", states)
    write_atomic(output / "cuda-telemetry.json", {"status": "completed", **telemetry})
    report = {
        "schemaVersion": "stage4-route-counterfactual-compositor-readonly-gpu-report-v1",
        "status": "route_counterfactual_compositor_readonly_gpu_qualification_succeeded",
        "capabilityVersion": CAPABILITY,
        "architecture": ARCHITECTURE,
        "sampleIdentity": {"sampleId": SAMPLE_ID, "split": "validation"},
        "splitCounts": split_counts,
        "seed": SEED,
        "inputShape": [1, 23, 192, 256],
        "latentShape": [1, 12, 48, 64],
        "decodedRgbShape": [1, 3, 192, 256],
        "counterfactualDerivation": derivation,
        "latentOwnership": ownership,
        "gradientEvidence": gradient_evidence,
        "stateHashes": states,
        "cuda": telemetry,
        "safety": {
            "denoiserCheckpointRead": False,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "weightModified": False,
            "checkpointWritten": False,
            "smokeStarted": False,
            "trainingStarted": False,
        },
        "ticket": binding(ticket_path),
        "consumption": binding(consumption),
        "recordedAtUtc": utc_now(),
    }
    write_atomic(output / "gpu-report.json", report)
    terminal = {
        "schemaVersion": "stage4-route-counterfactual-compositor-readonly-gpu-terminal-v1",
        "executionState": "completed",
        "status": report["status"],
        "gpuReport": binding(output / "gpu-report.json"),
        "counterfactualDerivationEvidence": binding(output / "counterfactual-derivation-evidence.json"),
        "latentOwnershipEvidence": binding(output / "latent-ownership-evidence.json"),
        "gradientEvidence": binding(output / "gradient-evidence.json"),
        "modelStateHashes": binding(output / "model-state-hashes.json"),
        "cudaTelemetry": binding(output / "cuda-telemetry.json"),
        "ownerAuthorizationRequired": False,
        "recordedAtUtc": utc_now(),
    }
    write_atomic(output / "phase-terminal.json", terminal)
    return terminal


def main():
    parser = ArgumentParser()
    parser.add_argument("--ticket", type=Path, required=True)
    parser.add_argument("--ticket-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    ticket_path = resolve(args.ticket)
    consumption = resolve(args.consumption)
    output = resolve(args.output_dir)
    if sha256_file(ticket_path) != args.ticket_sha256:
        raise ValueError("ticket_sha256_mismatch")
    ticket = json.loads(ticket_path.read_text(encoding="utf-8"))
    result = preflight(ticket, ticket_path, consumption, output)
    if args.preflight_only:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    write_exclusive(
        consumption,
        {
            "schemaVersion": "ai-painter-local-internal-readonly-gpu-ticket-consumption-v1",
            "status": "atomically_consumed",
            "ticket": binding(ticket_path),
            "capabilityVersion": CAPABILITY,
            "taskId": TASK,
            "oneTimeConsumption": True,
            "consumedAtUtc": utc_now(),
        },
    )
    terminal = run_gpu(ticket, ticket_path, consumption, output)
    print(
        json.dumps(
            {
                "status": terminal["status"],
                "terminal": binding(output / "phase-terminal.json"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
