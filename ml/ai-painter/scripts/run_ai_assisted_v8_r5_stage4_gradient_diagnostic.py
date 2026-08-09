from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import time
import traceback

import torch
import torch.nn.functional as functional

from ai_painter.complete_world import add_noise, build_complete_world_system, velocity_target
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
RUNNER_PATH = Path("ml/ai-painter/scripts/run_ai_assisted_v8_r5_stage4_gradient_diagnostic.py")
MODEL_PATH = Path("ml/ai-painter/src/ai_painter/complete_world/model.py")
TRAINER_PATH = Path("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
AUTOENCODER_PATH = Path(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/"
    "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/"
    "complete-world-ai-assisted-autoencoder.pt"
)
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
SEED = 20263722
TIMESTEP = 999
IMAGE_SIZE = (256, 192)
READOUT_CHANNELS = (
    "terrain_path_ground",
    "route_required_boundary",
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    authorization = validate_authorization(args.authorization)
    preflight = build_preflight(authorization)
    if args.preflight_only:
        if args.output_dir is not None:
            raise ValueError("preflight_must_not_receive_output_directory")
        print(json.dumps(preflight, ensure_ascii=False, indent=2))
        return 0
    if args.output_dir is None:
        raise ValueError("gpu_diagnostic_requires_output_directory")
    return consume_and_run(args.authorization, authorization, args.output_dir, preflight)


def validate_authorization(path: Path) -> dict:
    resolved = resolve(path)
    if not resolved.is_file():
        raise ValueError("owner_authorization_missing")
    authorization = read_json(resolved)
    if authorization.get("schemaVersion") == "ai-painter-r5-stage4-v8-gradient-diagnostic-retry-authorization-v1":
        return validate_retry_authorization(authorization)
    if authorization.get("schemaVersion") != "ai-painter-r5-stage4-v8-four-gate-owner-authorization-v1":
        raise ValueError("owner_authorization_schema_invalid")
    if authorization.get("status") != "owner_authorized_four_gates_not_consumed":
        raise ValueError("owner_authorization_status_invalid")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != "owner-authorized-ai-painter-r5-stage4-v8-four-gate-completion-20260808":
        raise ValueError("owner_authorization_command_ref_invalid")
    gates = authorization.get("executionGates", [])
    if [gate.get("id") for gate in gates] != [
        "v8_gradient_diagnostic",
        "v8_30_epoch_single_sample_smoke",
        "v8_stage0_stage1_stage2_full_training",
        "r5_stage5_strict_revalidation",
    ]:
        raise ValueError("owner_authorization_gate_order_invalid")
    if any(gate.get("automaticRetryAuthorized") is not False for gate in gates):
        raise ValueError("owner_authorization_retry_boundary_open")
    diagnostic = gates[0]
    expected_actions = {
        "gpuUseAuthorized": True,
        "autoencoderCheckpointReadAuthorized": True,
        "oldDenoiserCheckpointReadAuthorized": False,
        "optimizerCreationAuthorized": False,
        "backwardExecutionAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "checkpointWriteAuthorized": False,
        "trainingAuthorized": False,
    }
    if diagnostic.get("authorizedActions") != expected_actions:
        raise ValueError("diagnostic_action_boundary_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "sampleId": SAMPLE_ID,
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "architectureId": "multiscale_condition_unet_v8_stage4_decoded_alignment",
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"diagnostic_task_identity_{key}_invalid")
    bindings = authorization.get("bindings", {})
    for key, expected_path in (
        ("runner", RUNNER_PATH),
        ("model", MODEL_PATH),
        ("trainer", TRAINER_PATH),
        ("inactiveConfig", Path(".runtime/ai-painter/v8-r5-stage4-decoded-domain-alignment-cpu-support/20260808-211500000/inactive-config.json")),
        ("cpuSupportTerminal", Path(".runtime/ai-painter/v8-r5-stage4-decoded-domain-alignment-cpu-support/20260808-211500000/phase-terminal.json")),
        ("datasetManifest", DATASET_PATH),
        ("autoencoderCheckpoint", AUTOENCODER_PATH),
    ):
        binding = bindings.get(key, {})
        if binding.get("path") != project_path(expected_path):
            raise ValueError(f"diagnostic_binding_{key}_path_invalid")
        actual = sha256_file(resolve(expected_path))
        if binding.get("sha256") != actual:
            raise ValueError(f"diagnostic_binding_{key}_sha256_invalid")
    config = read_json(resolve(Path(bindings["inactiveConfig"]["path"])))
    if config.get("denoiserArchitecture") != expected_identity["architectureId"]:
        raise ValueError("diagnostic_v8_architecture_binding_invalid")
    trainer.validate_v8_stage4_decoded_domain_alignment_cpu_support_contract(config, ROOT)
    return authorization


def validate_retry_authorization(authorization: dict) -> dict:
    if authorization.get("status") != "owner_authorized_independent_diagnostic_not_consumed":
        raise ValueError("retry_authorization_status_invalid")
    decision = authorization.get("ownerDecision", {})
    if decision.get("commandRef") != "owner-authorized-v8-stage4-gradient-diagnostic-retry-execution-20260808":
        raise ValueError("retry_authorization_command_ref_invalid")
    if decision.get("scope") != "one_v8_sample194_gradient_diagnostic_after_dataset_selection_cpu_pass_only":
        raise ValueError("retry_authorization_scope_invalid")
    expected_actions = {
        "gpuUseAuthorized": True,
        "autoencoderCheckpointReadAuthorized": True,
        "oldDenoiserCheckpointReadAuthorized": False,
        "optimizerCreationAuthorized": False,
        "backwardExecutionAuthorized": False,
        "modelWeightMutationAuthorized": False,
        "checkpointWriteAuthorized": False,
        "trainingAuthorized": False,
        "thirtyEpochSmokeAuthorized": False,
        "fullTrainingAuthorized": False,
        "strictRevalidationAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    if authorization.get("authorizedActions") != expected_actions:
        raise ValueError("retry_diagnostic_action_boundary_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "architectureId": "multiscale_condition_unet_v8_stage4_decoded_alignment",
        "datasetSelectionContract": "registered_v7_capacity_contribution_v1",
        "requiredSplitCounts": {"train": 48, "validation": 8, "challenge": 4, "regression": 4},
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"retry_diagnostic_task_identity_{key}_invalid")
    bindings = authorization.get("bindings", {})
    required_paths = {
        "runner": RUNNER_PATH,
        "model": MODEL_PATH,
        "trainer": TRAINER_PATH,
        "datasetImplementation": Path("ml/ai-painter/src/ai_painter/complete_world/dataset.py"),
        "cpuChecker": Path("ml/ai-painter/scripts/check_ai_assisted_v8_stage4_dataset_selection_cpu.py"),
        "inactiveConfig": Path(".runtime/ai-painter/v8-r5-stage4-decoded-domain-alignment-cpu-support/20260808-211500000/inactive-config.json"),
        "previousFailureTerminal": Path(".runtime/ai-painter/v8-r5-stage4-gradient-diagnostic/20260808-220000000/phase-terminal.json"),
        "datasetManifest": DATASET_PATH,
        "autoencoderCheckpoint": AUTOENCODER_PATH,
    }
    for key, expected_path in required_paths.items():
        binding = bindings.get(key, {})
        if binding.get("path") != project_path(expected_path):
            raise ValueError(f"retry_diagnostic_binding_{key}_path_invalid")
        if binding.get("sha256") != sha256_file(resolve(expected_path)):
            raise ValueError(f"retry_diagnostic_binding_{key}_sha256_invalid")
    for key in ("datasetCpuReport", "datasetCpuTerminal"):
        binding = bindings.get(key, {})
        if not isinstance(binding.get("path"), str) or binding.get("sha256") != sha256_file(resolve(Path(binding["path"]))):
            raise ValueError(f"retry_diagnostic_binding_{key}_invalid")
    cpu_report = read_json(resolve(Path(bindings["datasetCpuReport"]["path"])))
    cpu_terminal = read_json(resolve(Path(bindings["datasetCpuTerminal"]["path"])))
    if (
        cpu_report.get("status") != "passed_cpu_only_gpu_not_started"
        or cpu_report.get("evidence", {}).get("actualSplitCounts")
        != {"train": 48, "validation": 8, "challenge": 4, "regression": 4}
        or cpu_report.get("evidence", {}).get("sample194Occurrences") != ["validation"]
        or cpu_terminal.get("status") != "v8_dataset_selection_cpu_contract_passed_closed"
        or cpu_terminal.get("reportSha256") != bindings["datasetCpuReport"]["sha256"]
    ):
        raise ValueError("retry_diagnostic_cpu_evidence_invalid")
    if sha256_file(resolve(Path(bindings["previousFailureTerminal"]["path"]))) != "89121b65a8fa991569b8122c884d087f6b866294ff9a24f9739f939059cd0974":
        raise ValueError("retry_diagnostic_previous_failure_identity_invalid")
    config = read_json(resolve(Path(bindings["inactiveConfig"]["path"])))
    trainer.validate_v8_stage4_decoded_domain_alignment_cpu_support_contract(config, ROOT)
    if trainer.conditional_dataset_selection_contract(config) != identity["datasetSelectionContract"]:
        raise ValueError("retry_diagnostic_dataset_selection_contract_not_integrated")
    if set(authorization.get("outputRoots", {})) != {"diagnostic"} or set(authorization.get("consumptionPaths", {})) != {"diagnostic"}:
        raise ValueError("retry_diagnostic_output_or_consumption_identity_invalid")
    return authorization


def build_preflight(authorization: dict) -> dict:
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable")
    if torch.cuda.device_count() < 1:
        raise ValueError("cuda_device_zero_unavailable")
    output_root = resolve(Path(authorization["outputRoots"]["diagnostic"])).parent
    free_bytes = disk_free_bytes(output_root)
    if free_bytes < 2 * 1024**3:
        raise ValueError("diagnostic_disk_budget_insufficient")
    return {
        "schemaVersion": "ai-painter-r5-stage4-v8-gradient-diagnostic-preflight-v1",
        "status": "passed_gpu_not_started_authorization_not_consumed",
        "python": {"executable": str(Path(torch.__file__).resolve()), "torchVersion": torch.__version__},
        "cuda": {
            "available": True,
            "deviceCount": torch.cuda.device_count(),
            "device0Name": torch.cuda.get_device_name(0),
            "device0TotalMemoryBytes": torch.cuda.get_device_properties(0).total_memory,
        },
        "diskFreeBytes": free_bytes,
        "sampleId": SAMPLE_ID,
        "seed": SEED,
        "timestep": TIMESTEP,
        "oldDenoiserCheckpointRead": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "gpuStarted": False,
    }


def consume_and_run(authorization_path: Path, authorization: dict, output_dir: Path, preflight: dict) -> int:
    output = resolve(output_dir)
    expected = resolve(Path(authorization["outputRoots"]["diagnostic"]))
    if output != expected or output.exists():
        raise ValueError("diagnostic_output_identity_invalid_or_already_exists")
    consumption_path = resolve(Path(authorization["consumptionPaths"]["diagnostic"]))
    if consumption_path.exists():
        raise ValueError("diagnostic_authorization_already_consumed")
    consumption_path.parent.mkdir(parents=True, exist_ok=True)
    consumption = {
        "schemaVersion": "ai-painter-r5-stage4-v8-gate-consumption-v1",
        "status": "diagnostic_authorization_atomically_consumed",
        "gateId": "v8_gradient_diagnostic",
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": sha256_file(resolve(authorization_path)),
        **timestamps("consumedAt"),
    }
    write_json_exclusive(consumption_path, consumption)
    return run_gpu(authorization, output, consumption_path, preflight)


def run_gpu(authorization: dict, output: Path, consumption_path: Path, preflight: dict) -> int:
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    completed = []
    state = {"checkpointRead": False, "gpuUsed": False, "forwardCompleted": False, "autogradCompleted": False}
    try:
        def step(code: str, details=None):
            completed.append({"index": len(completed) + 1, "code": code, "details": details or {}, **timestamps("completedAt")})
            write_json_atomic(output / "step-telemetry.json", {"completedSteps": completed})

        torch.cuda.init()
        torch.cuda.set_device(0)
        if torch.cuda.current_device() != 0:
            raise ValueError("cuda_device_zero_not_active")
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        step("cuda_device_zero_initialized")

        config = read_json(resolve(Path(authorization["bindings"]["inactiveConfig"]["path"])))
        config = diagnostic_config(config)
        dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH,
            "validation",
            list(config["conditionChannelOrder"]),
            IMAGE_SIZE,
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("diagnostic_sample_not_unique_in_validation_split")
        sample = dataset[matches[0]]
        step("fixed_sample194_loaded")

        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        device = torch.device("cuda:0")
        model = build_complete_world_system(config)
        initial_denoiser_hash = state_dict_sha256(model.denoiser.state_dict())
        checkpoint = trainer.load_autoencoder_checkpoint(AUTOENCODER_PATH, config)
        state["checkpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        model.to(device)
        model.eval()
        for parameter in model.autoencoder.parameters():
            parameter.requires_grad_(False)
        initial_autoencoder_hash = state_dict_sha256(model.autoencoder.state_dict())
        step("project_autoencoder_loaded_and_frozen")

        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device)
        with torch.no_grad():
            raw_latent = model.autoencoder.encode(image)
            mean = raw_latent.mean(dim=(0, 2, 3), keepdim=True)
            std = raw_latent.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6)
            clean_latent = (raw_latent - mean) / std
        diffusion = trainer.build_diffusion_schedule(config, device)
        timestep = torch.tensor([TIMESTEP], dtype=torch.long, device=device)
        noise = torch.randn_like(clean_latent)
        noisy_latent = add_noise(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        predicted_velocity, readout = model.predict_velocity_with_stage4_alignment(noisy_latent, timestep, conditions)
        alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
        predicted_rgb = model.autoencoder.decode(predicted_clean * std + mean)
        readout_target = build_readout_target(conditions, config, readout.shape[-2:])
        readout_loss = functional.binary_cross_entropy(readout, readout_target)
        decoded_loss = functional.l1_loss(predicted_rgb, image)
        velocity_loss = functional.mse_loss(predicted_velocity, target_velocity)
        state["forwardCompleted"] = True
        step("single_v8_forward_completed")

        named_parameters = [(name, parameter) for name, parameter in model.denoiser.named_parameters() if parameter.requires_grad]
        parameters = [parameter for _, parameter in named_parameters]
        readout_grads = torch.autograd.grad(readout_loss, parameters, retain_graph=True, allow_unused=True)
        decoded_grads = torch.autograd.grad(decoded_loss, parameters, retain_graph=False, allow_unused=True)
        readout_norms = gradient_group_norms(named_parameters, readout_grads)
        decoded_norms = gradient_group_norms(named_parameters, decoded_grads)
        if readout_norms["sharedReadout"] <= 0 or readout_norms["typedAdapters"] <= 0:
            raise ValueError("alignment_readout_gradient_route_missing")
        if decoded_norms["typedAdapters"] <= 0 or decoded_norms["baseDenoiser"] <= 0:
            raise ValueError("decoded_rgb_gradient_route_missing")
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("diagnostic_populated_parameter_grad_fields")
        state["autogradCompleted"] = True
        step("autograd_gradient_routes_verified")

        torch.cuda.synchronize(0)
        peak = torch.cuda.max_memory_allocated(0)
        model.to("cpu")
        final_denoiser_hash = state_dict_sha256(model.denoiser.state_dict())
        final_autoencoder_hash = state_dict_sha256(model.autoencoder.state_dict())
        if initial_denoiser_hash != final_denoiser_hash or initial_autoencoder_hash != final_autoencoder_hash:
            raise ValueError("diagnostic_model_state_changed")
        step("model_state_hashes_verified_unchanged")

        report = {
            "schemaVersion": "ai-painter-r5-stage4-v8-gradient-diagnostic-report-v1",
            "status": "passed_readonly_gpu_forward_and_gradient_routing_weights_unchanged",
            **timestamps("recordedAt"),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "identity": {"sampleId": SAMPLE_ID, "seed": SEED, "timestep": TIMESTEP, "requiredBoundarySides": ["west"]},
            "losses": {"velocityMse": float(velocity_loss.detach()), "decodedRgbMae": float(decoded_loss.detach()), "sharedReadoutBce": float(readout_loss.detach())},
            "gradientRoutes": {"sharedReadoutLoss": readout_norms, "decodedRgbLoss": decoded_norms},
            "readout": {"channels": list(READOUT_CHANNELS), "shape": list(readout.shape), "targetShape": list(readout_target.shape)},
            "cuda": {"device": torch.cuda.get_device_name(0), "peakMemoryAllocatedBytes": int(peak)},
            "integrity": {
                "denoiserStateSha256Before": initial_denoiser_hash,
                "denoiserStateSha256After": final_denoiser_hash,
                "autoencoderStateSha256Before": initial_autoencoder_hash,
                "autoencoderStateSha256After": final_autoencoder_hash,
                "parameterGradFieldsAbsent": True,
            },
            "preflight": preflight,
            "authorizationConsumption": {"path": project_path(consumption_path), "sha256": sha256_file(consumption_path)},
            "completedSteps": completed,
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsModified": False,
            "checkpointWritten": False,
            "trainingStarted": False,
        }
        report_path = output / "diagnostic-report.json"
        write_json_exclusive(report_path, report)
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v8-gradient-diagnostic-terminal-v1",
            "status": "v8_gradient_diagnostic_passed_closed",
            **timestamps("recordedAt"),
            "reportPath": project_path(report_path),
            "reportSha256": sha256_file(report_path),
            "nextGate": "v8_30_epoch_single_sample_smoke",
            "blockers": [],
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(output / "phase-terminal.json"), "terminalSha256": sha256_file(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v8-gradient-diagnostic-terminal-v1",
            "status": "v8_gradient_diagnostic_failed_closed",
            **timestamps("recordedAt"),
            "failureType": type(error).__name__,
            "failureMessage": str(error),
            "traceback": traceback.format_exc(),
            "completedSteps": completed,
            **state,
            "automaticRetryStarted": False,
            "laterGatesStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({**terminal, "terminalPath": project_path(output / "phase-terminal.json"), "terminalSha256": sha256_file(output / "phase-terminal.json")}, ensure_ascii=False, indent=2))
        return 1


def diagnostic_config(source: dict) -> dict:
    value = json.loads(json.dumps(source))
    value["training"]["seed"] = SEED
    value["training"]["authorizedOverfitSampleId"] = SAMPLE_ID
    value["training"]["authorizedBoundaryTopology"]["requiredBoundarySides"] = ["west"]
    return value


def build_readout_target(conditions: torch.Tensor, config: dict, size) -> torch.Tensor:
    order = list(config["conditionChannelOrder"])
    resized = model_resize_typed_conditions(conditions, config, size)
    path = resized[:, order.index("terrain_path_ground") : order.index("terrain_path_ground") + 1]
    boundary = torch.zeros_like(path)
    band = max(1, round(path.shape[-1] * 0.04))
    boundary[..., :band] = path[..., :band]
    channels = [path, boundary]
    for name in ("object_footprints", "object_tree", "object_rock", "object_vegetation"):
        index = order.index(name)
        channels.append(resized[:, index : index + 1])
    return torch.cat(channels, dim=1).clamp(0, 1)


def model_resize_typed_conditions(conditions: torch.Tensor, config: dict, size) -> torch.Tensor:
    order = list(config["conditionChannelOrder"])
    discrete = [order.index(name) for name in config["conditionChannelTypes"]["discrete"]]
    continuous = [order.index(name) for name in config["conditionChannelTypes"]["continuous"]]
    result = torch.empty((conditions.shape[0], conditions.shape[1], *size), device=conditions.device, dtype=conditions.dtype)
    result[:, discrete] = functional.interpolate(conditions[:, discrete], size=size, mode="nearest")
    result[:, continuous] = functional.interpolate(conditions[:, continuous], size=size, mode="bilinear", align_corners=False)
    return result


def gradient_group_norms(named_parameters, gradients) -> dict:
    totals = {"typedAdapters": 0.0, "sharedReadout": 0.0, "baseDenoiser": 0.0}
    for (name, _), gradient in zip(named_parameters, gradients):
        if gradient is None:
            continue
        value = float(gradient.detach().float().pow(2).sum().sqrt().cpu())
        if "typed_condition_adapter" in name:
            totals["typedAdapters"] += value
        elif "shared_semantic_topology_readout" in name:
            totals["sharedReadout"] += value
        else:
            totals["baseDenoiser"] += value
    return totals


def state_dict_sha256(state_dict) -> str:
    digest = hashlib.sha256()
    for name in sorted(state_dict):
        tensor = state_dict[name].detach().cpu().contiguous()
        digest.update(name.encode("utf-8"))
        digest.update(str(tensor.dtype).encode("ascii"))
        digest.update(json.dumps(list(tensor.shape), separators=(",", ":")).encode("ascii"))
        digest.update(tensor.numpy().tobytes(order="C"))
    return digest.hexdigest()


def disk_free_bytes(path: Path) -> int:
    import shutil
    probe = path.resolve()
    while not probe.exists() and probe.parent != probe:
        probe = probe.parent
    return int(shutil.disk_usage(probe).free)


def resolve(path: Path) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value.resolve()
    candidate = (ROOT / value).resolve()
    if candidate.exists() or not str(value).replace("\\", "/").startswith(".runtime/"):
        return candidate
    return (Path("D:/AI-PET-WORLD-DATA/hot/runtime") / Path(*value.parts[1:])).resolve()


def project_path(path: Path) -> str:
    resolved = resolve(path)
    try:
        return str(resolved.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        runtime = Path("D:/AI-PET-WORLD-DATA/hot/runtime").resolve()
        return str(Path(".runtime") / resolved.relative_to(runtime)).replace("\\", "/")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(resolve(path).read_bytes()).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(resolve(path).read_text(encoding="utf-8"))


def write_json_exclusive(path: Path, value: dict) -> None:
    resolved = resolve(path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    with resolved.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def write_json_atomic(path: Path, value: dict) -> None:
    resolved = resolve(path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    temporary = resolved.with_suffix(resolved.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(resolved)


def timestamps(prefix: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(),
    }


if __name__ == "__main__":
    raise SystemExit(main())
