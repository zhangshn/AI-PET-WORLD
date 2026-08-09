from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import time
import traceback

import torch

from ai_painter.complete_world import add_noise, build_complete_world_system, velocity_target
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
AUTHORIZATION_PATH = Path(
    "data/ai-painter/system-governance/"
    "owner-authorized-v9-stage4-readonly-gpu-gradient-diagnostic-20260809.json"
)
IMPLEMENTATION_CONSUMPTION_PATH = Path(
    ".runtime/ai-painter/owner-action-requests/"
    "owner-authorized-v9-stage4-readonly-gpu-gradient-diagnostic-20260809/"
    "implementation-consumption.json"
)
RUNNER_PATH = Path("ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py")
CPU_CHECKER_PATH = Path("ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py")
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
SAMPLE_SPLIT = "validation"
SEED = 20263722
TIMESTEP = 999
IMAGE_SIZE = (256, 192)
OBJECT_CHANNELS = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
REQUEST_ID = "owner-authorized-v9-stage4-readonly-gpu-gradient-diagnostic-20260809"
SCOPE = "one_v9_sample194_readonly_gpu_forward_autograd_gradient_routing_diagnostic_only"
AUTHORIZATION_SHA256 = "95d8dc1ef85d9af42618c43d74e7661d62e58acbca0365c02f4f789c2a07aee2"


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--implementation-attestation", type=Path)
    parser.add_argument("--cpu-contract-only", action="store_true")
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--python-report", type=Path)
    parser.add_argument("--resource-report", type=Path)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    authorization = validate_authorization(args.authorization)
    if args.cpu_contract_only:
        if any((args.implementation_attestation, args.python_report, args.resource_report, args.output_dir)):
            raise ValueError("cpu_contract_check_must_not_receive_execution_paths")
        print(json.dumps({
            "status": "v9_gpu_diagnostic_authorization_contract_valid_cpu_only",
            "requestId": REQUEST_ID,
            "sampleId": SAMPLE_ID,
            "gpuUsed": False,
        }, ensure_ascii=False, indent=2))
        return 0
    attestation = validate_implementation_attestation(args.implementation_attestation, authorization)
    if args.preflight_only:
        if args.output_dir is not None or args.python_report is None or args.resource_report is None:
            raise ValueError("preflight_paths_invalid")
        return write_preflight_reports(authorization, attestation, args.python_report, args.resource_report)
    if args.output_dir is None or args.python_report is not None or args.resource_report is not None:
        raise ValueError("gpu_execution_arguments_invalid")
    return consume_and_run(args.authorization, authorization, attestation, args.output_dir)


def validate_authorization(path: Path) -> dict:
    resolved = resolve(path)
    if resolved != resolve(AUTHORIZATION_PATH) or sha256_file(resolved) != AUTHORIZATION_SHA256:
        raise ValueError("v9_diagnostic_owner_authorization_identity_invalid")
    authorization = read_json(resolved)
    validate_authorization_document(authorization, verify_bindings=True)
    consumption = read_json(resolve(IMPLEMENTATION_CONSUMPTION_PATH))
    if (
        consumption.get("status") != "v9_readonly_gpu_diagnostic_implementation_authorization_atomically_consumed"
        or consumption.get("requestId") != REQUEST_ID
        or consumption.get("commandRef") != REQUEST_ID
        or consumption.get("scope") != SCOPE
        or consumption.get("authorizationSha256") != AUTHORIZATION_SHA256
        or consumption.get("oneTimeConsumption") is not True
    ):
        raise ValueError("v9_diagnostic_implementation_consumption_invalid")
    return authorization


def validate_authorization_document(authorization: dict, verify_bindings: bool) -> None:
    if (
        authorization.get("schemaVersion") != "ai-painter-owner-action-request-v1"
        or authorization.get("requestId") != REQUEST_ID
        or authorization.get("status") != "resolved_owner_authorized"
        or authorization.get("ownerDecision", {}).get("commandRef") != REQUEST_ID
        or authorization.get("ownerDecision", {}).get("scope") != SCOPE
    ):
        raise ValueError("v9_diagnostic_owner_command_contract_invalid")
    identity = authorization.get("taskIdentity", {})
    expected_identity = {
        "architectureId": "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment",
        "sampleId": SAMPLE_ID,
        "sampleSplit": SAMPLE_SPLIT,
        "seed": SEED,
        "timestep": TIMESTEP,
        "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "requiredBoundarySides": ["west"],
        "objectSemanticChannels": list(OBJECT_CHANNELS),
        "diagnosticManifestMetricCount": 17,
        "denoiserInitialization": "fixed_random_v9_seed_20263722",
        "autoencoderState": "bound_project_checkpoint_loaded_and_frozen",
    }
    for key, expected in expected_identity.items():
        if identity.get(key) != expected:
            raise ValueError(f"v9_diagnostic_task_identity_invalid:{key}")
    expected_actions = {
        "v9DiagnosticRunnerImplementation": True,
        "v9DiagnosticCpuCheckerImplementation": True,
        "cpuPositiveNegativeAuthorizationRegression": True,
        "pythonPreflight": True,
        "cudaResourcePreflight": True,
        "diskBudgetPreflight": True,
        "projectAutoencoderCheckpointReadAndLoad": True,
        "v9FixedRandomInitialization": True,
        "singleSampleValidationRead": True,
        "singleGpuForward": True,
        "torchAutogradGradInspection": True,
        "cudaTelemetryWrite": True,
        "diagnosticReportWrite": True,
        "terminalEvidenceWrite": True,
        "uniquePlanUpdate": True,
        "oldV7OrV8DenoiserCheckpointReadOrLoad": False,
        "optimizerCreation": False,
        "backwardMethodExecution": False,
        "modelWeightModification": False,
        "checkpointWrite": False,
        "smoke": False,
        "stage4FullTraining": False,
        "stage1OrStage2": False,
        "strictRevalidation": False,
        "formalInference": False,
        "checkpointPromotion": False,
        "runtimeFrame": False,
        "worldEntry": False,
        "automaticRetry": False,
    }
    if authorization.get("authorizedActions") != expected_actions:
        raise ValueError("v9_diagnostic_action_boundary_invalid")
    if authorization.get("failurePolicy") != {
        "stopImmediately": True, "automaticRetry": False, "preserveEvidence": True,
    }:
        raise ValueError("v9_diagnostic_failure_policy_invalid")
    if not verify_bindings:
        return
    for key in (
        "v9CpuTerminal", "v9InactiveConfig", "v9CpuReport", "v9SupportContract",
        "model", "trainer", "datasetImplementation", "datasetManifest",
        "datasetSourceIndex", "projectAutoencoderCheckpoint",
    ):
        binding_value = authorization.get("bindings", {}).get(key, {})
        if binding_value.get("sha256") != sha256_file(resolve(Path(binding_value.get("path", "missing")))):
            raise ValueError(f"v9_diagnostic_binding_changed:{key}")
    terminal = read_json(resolve(Path(authorization["bindings"]["v9CpuTerminal"]["path"])))
    report = read_json(resolve(Path(authorization["bindings"]["v9CpuReport"]["path"])))
    support = read_json(resolve(Path(authorization["bindings"]["v9SupportContract"]["path"])))
    config = read_json(resolve(Path(authorization["bindings"]["v9InactiveConfig"]["path"])))
    if (
        terminal.get("status") != "v9_stage4_cpu_support_and_manifest_registry_completed_closed"
        or report.get("status") != "passed_cpu_only_v9_object_semantic_alignment_not_active"
        or support.get("status") != "v9_cpu_support_verified_inactive_gpu_not_started"
        or config.get("denoiserArchitecture") != expected_identity["architectureId"]
    ):
        raise ValueError("v9_diagnostic_cpu_prerequisite_not_successful")
    trainer.validate_training_inputs(config, read_json(resolve(DATASET_PATH)))


def validate_implementation_attestation(path: Path | None, authorization: dict) -> dict:
    expected = resolve(Path(authorization["implementation"]["implementationAttestationPath"]))
    if path is None or resolve(path) != expected or not expected.is_file():
        raise ValueError("v9_diagnostic_implementation_attestation_missing")
    attestation = read_json(expected)
    cpu_report_path = resolve(Path(authorization["implementation"]["cpuReportPath"]))
    expected_values = {
        "status": "v9_gpu_diagnostic_implementation_cpu_verified",
        "requestId": REQUEST_ID,
        "authorizationSha256": AUTHORIZATION_SHA256,
        "runnerSha256": sha256_file(resolve(RUNNER_PATH)),
        "cpuCheckerSha256": sha256_file(resolve(CPU_CHECKER_PATH)),
        "cpuReportSha256": sha256_file(cpu_report_path),
    }
    for key, expected_value in expected_values.items():
        if attestation.get(key) != expected_value:
            raise ValueError(f"v9_diagnostic_implementation_attestation_invalid:{key}")
    cpu_report = read_json(cpu_report_path)
    if (
        cpu_report.get("status") != "passed_v9_readonly_gpu_diagnostic_cpu_authorization_regression"
        or cpu_report.get("failedPositiveKeys") != []
        or cpu_report.get("failedNegativeKeys") != []
    ):
        raise ValueError("v9_diagnostic_cpu_regression_not_successful")
    return attestation


def write_preflight_reports(authorization: dict, attestation: dict, python_path: Path, resource_path: Path) -> int:
    if resolve(python_path) != resolve(Path(authorization["implementation"]["pythonPreflightPath"])):
        raise ValueError("v9_diagnostic_python_preflight_output_invalid")
    if resolve(resource_path) != resolve(Path(authorization["implementation"]["resourcePreflightPath"])):
        raise ValueError("v9_diagnostic_resource_preflight_output_invalid")
    if resolve(python_path).exists() or resolve(resource_path).exists():
        raise FileExistsError("v9_diagnostic_preflight_output_already_exists")
    config = read_json(resolve(Path(authorization["bindings"]["v9InactiveConfig"]["path"])))
    package = read_json(resolve(DATASET_PATH))
    trainer.validate_training_inputs(config, package)
    python_report = {
        "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-python-preflight-v1",
        "status": "passed_python_preflight_gpu_not_consumed",
        **timestamps("recordedAt"),
        "pythonExecutable": str(Path(sys.executable).resolve()),
        "pythonVersion": sys.version,
        "torchVersion": torch.__version__,
        "configSha256": authorization["bindings"]["v9InactiveConfig"]["sha256"],
        "implementationAttestationSha256": sha256_file(resolve(Path(authorization["implementation"]["implementationAttestationPath"]))),
        "checkpointRead": False,
        "gpuExecutionConsumed": False,
    }
    write_json_exclusive(python_path, python_report)
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("v9_diagnostic_cuda_device_zero_unavailable")
    free_bytes = disk_free_bytes(resolve(Path(authorization["execution"]["outputDirectory"])).parent)
    required_disk_bytes = 2 * 1024**3
    if free_bytes < required_disk_bytes:
        raise ValueError("v9_diagnostic_disk_budget_insufficient")
    resource_report = {
        "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-resource-preflight-v1",
        "status": "passed_cuda_resource_and_disk_preflight_gpu_not_consumed",
        **timestamps("recordedAt"),
        "cuda": {
            "available": True,
            "deviceCount": torch.cuda.device_count(),
            "device0Name": torch.cuda.get_device_name(0),
            "device0TotalMemoryBytes": int(torch.cuda.get_device_properties(0).total_memory),
        },
        "diskFreeBytes": free_bytes,
        "requiredDiskBytes": required_disk_bytes,
        "checkpointRead": False,
        "gpuExecutionConsumed": False,
    }
    write_json_exclusive(resource_path, resource_report)
    print(json.dumps({
        "status": "v9_gradient_diagnostic_all_preflights_passed_gpu_not_consumed",
        "pythonReport": binding(python_path),
        "resourceReport": binding(resource_path),
    }, ensure_ascii=False, indent=2))
    return 0


def consume_and_run(authorization_path: Path, authorization: dict, attestation: dict, output_dir: Path) -> int:
    output = resolve(output_dir)
    if output != resolve(Path(authorization["execution"]["outputDirectory"])) or output.exists():
        raise ValueError("v9_diagnostic_output_identity_invalid_or_exists")
    python_path = resolve(Path(authorization["implementation"]["pythonPreflightPath"]))
    resource_path = resolve(Path(authorization["implementation"]["resourcePreflightPath"]))
    python_report = read_json(python_path)
    resource_report = read_json(resource_path)
    if (
        python_report.get("status") != "passed_python_preflight_gpu_not_consumed"
        or resource_report.get("status") != "passed_cuda_resource_and_disk_preflight_gpu_not_consumed"
    ):
        raise ValueError("v9_diagnostic_saved_preflight_not_successful")
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("v9_diagnostic_cuda_changed_after_preflight")
    consumption_path = resolve(Path(authorization["execution"]["gpuConsumptionPath"]))
    if consumption_path.exists():
        raise FileExistsError("v9_diagnostic_gpu_authorization_already_consumed")
    consumption = {
        "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-gpu-consumption-v1",
        "status": "v9_readonly_gpu_diagnostic_authorization_atomically_consumed",
        "requestId": REQUEST_ID,
        "commandRef": REQUEST_ID,
        "scope": SCOPE,
        "authorizationPath": project_path(authorization_path),
        "authorizationSha256": AUTHORIZATION_SHA256,
        "implementationAttestationPath": project_path(Path(authorization["implementation"]["implementationAttestationPath"])),
        "implementationAttestationSha256": sha256_file(resolve(Path(authorization["implementation"]["implementationAttestationPath"]))),
        "pythonPreflightSha256": sha256_file(python_path),
        "resourcePreflightSha256": sha256_file(resource_path),
        **timestamps("consumedAt"),
        "oneTimeConsumption": True,
        "optimizerAuthorized": False,
        "backwardMethodAuthorized": False,
        "modelWeightModificationAuthorized": False,
        "checkpointWriteAuthorized": False,
        "trainingAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    write_json_exclusive(consumption_path, consumption)
    return run_gpu(authorization, output, consumption_path, python_report, resource_report)


def run_gpu(authorization: dict, output: Path, consumption_path: Path, python_report: dict, resource_report: dict) -> int:
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    steps = []
    state = {
        "autoencoderCheckpointRead": False,
        "oldDenoiserCheckpointRead": False,
        "gpuUsed": False,
        "forwardCompleted": False,
        "autogradGradCompleted": False,
        "optimizerCreated": False,
        "backwardMethodExecuted": False,
        "modelWeightsModified": False,
        "checkpointWritten": False,
        "trainingStarted": False,
    }
    try:
        def step(code: str, details=None):
            steps.append({"index": len(steps) + 1, "code": code, "details": details or {}, **timestamps("completedAt")})
            write_json_atomic(output / "step-telemetry.json", {"completedSteps": steps, **state})

        step("gpu_authorization_consumption_validated", {"sha256": sha256_file(consumption_path)})
        torch.cuda.init()
        torch.cuda.set_device(0)
        if torch.cuda.current_device() != 0:
            raise ValueError("v9_diagnostic_cuda_device_zero_not_active")
        torch.cuda.reset_peak_memory_stats(0)
        state["gpuUsed"] = True
        step("cuda_context_initialized_device_zero_confirmed")

        config = read_json(resolve(Path(authorization["bindings"]["v9InactiveConfig"]["path"])))
        package = read_json(resolve(DATASET_PATH))
        trainer.validate_training_inputs(config, package)
        dataset = AiAssistedConditionalDenoiserDataset(
            DATASET_PATH, SAMPLE_SPLIT, list(config["conditionChannelOrder"]), IMAGE_SIZE,
            selection_contract=trainer.conditional_dataset_selection_contract(config),
        )
        matches = [index for index, row in enumerate(dataset.rows) if row.get("sampleId") == SAMPLE_ID]
        if len(matches) != 1:
            raise ValueError("v9_diagnostic_sample194_not_unique_validation")
        sample = dataset[matches[0]]
        step("fixed_validation_sample194_loaded", {"sampleId": sample["sampleId"]})

        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        model = build_complete_world_system(config)
        denoiser_hash_before = state_dict_sha256(model.denoiser.state_dict())
        if sha256_file(resolve(AUTOENCODER_PATH)) != authorization["bindings"]["projectAutoencoderCheckpoint"]["sha256"]:
            raise ValueError("v9_diagnostic_autoencoder_checkpoint_hash_changed_before_read")
        checkpoint = trainer.load_autoencoder_checkpoint(AUTOENCODER_PATH, config)
        state["autoencoderCheckpointRead"] = True
        model.autoencoder.load_state_dict(checkpoint["autoencoderState"])
        for parameter in model.autoencoder.parameters():
            parameter.requires_grad_(False)
        autoencoder_hash_before = state_dict_sha256(model.autoencoder.state_dict())
        device = torch.device("cuda:0")
        model.to(device).eval()
        step("project_autoencoder_loaded_frozen_v9_random_initialized")

        image = sample["image"].unsqueeze(0).to(device)
        conditions = sample["conditions"].unsqueeze(0).to(device)
        with torch.no_grad():
            raw_latent = model.autoencoder.encode(image)
            mean = raw_latent.mean(dim=(0, 2, 3), keepdim=True)
            std = raw_latent.std(dim=(0, 2, 3), keepdim=True).clamp_min(1e-6)
            clean_latent = (raw_latent - mean) / std
        diffusion = trainer.build_diffusion_schedule(config, device)
        timestep = torch.tensor([TIMESTEP], dtype=torch.long, device=device)
        noise = torch.randn(clean_latent.shape, device=device, dtype=clean_latent.dtype)
        noisy_latent = add_noise(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        target_velocity = velocity_target(clean_latent, noise, timestep, diffusion["alphasCumulative"])
        predicted_velocity, alignment = model.predict_velocity_with_stage4_object_alignment(
            noisy_latent, timestep, conditions,
        )
        alpha = diffusion["alphasCumulative"][timestep].view(-1, 1, 1, 1)
        predicted_clean = alpha.sqrt() * noisy_latent - (1.0 - alpha).sqrt() * predicted_velocity
        predicted_conditions = model.reconstruct_conditions_from_clean_latent(predicted_clean)
        target_conditions = model.prepare_typed_conditions(conditions, predicted_clean.shape[-2:])
        predicted_rgb = model.autoencoder.decode(predicted_clean * std + mean)
        losses = trainer.composite_denoiser_losses_v9_stage4(
            predicted_velocity, target_velocity, predicted_clean, clean_latent,
            predicted_conditions, target_conditions, predicted_rgb, image, conditions,
            alignment, config,
        )
        state["forwardCompleted"] = True
        step("single_v9_denoiser_forward_and_17_diagnostics_completed")

        named = [(name, parameter) for name, parameter in model.denoiser.named_parameters() if parameter.requires_grad]
        parameters = [parameter for _, parameter in named]
        gradient_routes = {}
        prefix = {
            "object_footprints": "ObjectFootprints",
            "object_tree": "ObjectTree",
            "object_rock": "ObjectRock",
            "object_vegetation": "ObjectVegetation",
        }
        for object_name in OBJECT_CHANNELS:
            object_loss = (
                losses[f"stage4V9{prefix[object_name]}Up1ReadoutBce"]
                + losses[f"stage4V9{prefix[object_name]}Up0ReadoutBce"]
            ) * 0.5
            gradients = torch.autograd.grad(object_loss, parameters, retain_graph=True, allow_unused=True)
            norms = gradient_group_norms(named, gradients)
            if norms[object_name] <= 0.0 or any(
                norms[other] > 0.0 for other in OBJECT_CHANNELS if other != object_name
            ):
                raise ValueError(f"v9_diagnostic_object_gradient_isolation_failed:{object_name}")
            gradient_routes[object_name] = norms
        route_gradients = torch.autograd.grad(
            losses["stage4V9PreservedRouteTopologyReadoutBce"], parameters,
            retain_graph=True, allow_unused=True,
        )
        route_norms = gradient_group_norms(named, route_gradients)
        if route_norms["routeTopology"] <= 0.0 or route_norms["baseDenoiser"] <= 0.0:
            raise ValueError("v9_diagnostic_route_gradient_path_missing")
        decoded_gradients = torch.autograd.grad(
            losses["decodedRgbMae"], parameters, retain_graph=False, allow_unused=True,
        )
        decoded_norms = gradient_group_norms(named, decoded_gradients)
        if decoded_norms["typedAdapters"] <= 0.0 or decoded_norms["baseDenoiser"] <= 0.0:
            raise ValueError("v9_diagnostic_decoded_rgb_base_gradient_path_missing")
        if any(parameter.grad is not None for parameter in model.parameters()):
            raise ValueError("v9_diagnostic_parameter_grad_fields_populated")
        state["autogradGradCompleted"] = True
        step("torch_autograd_grad_object_route_and_base_routes_verified")

        diagnostic_metrics = {
            key: float(losses[key].detach().cpu())
            for key in trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS
        }
        if (
            set(diagnostic_metrics) != set(trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS)
            or any(not math.isfinite(value) or value < 0.0 for value in diagnostic_metrics.values())
            or diagnostic_metrics["stage4DiagnosticObjectGradientAvailable"] != 1.0
        ):
            raise ValueError("v9_diagnostic_exact_17_metric_values_invalid")
        manifest_row = trainer.register_v9_stage4_diagnostic_manifest_fields(
            {"epoch": 1}, diagnostic_metrics, 1, config,
        )
        step("exact_17_diagnostic_manifest_fields_registered")

        torch.cuda.synchronize(0)
        cuda_telemetry = {
            "deviceIndex": 0,
            "deviceName": torch.cuda.get_device_name(0),
            "memoryAllocatedBytes": int(torch.cuda.memory_allocated(0)),
            "memoryReservedBytes": int(torch.cuda.memory_reserved(0)),
            "peakMemoryAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
            "peakMemoryReservedBytes": int(torch.cuda.max_memory_reserved(0)),
        }
        write_json_exclusive(output / "cuda-telemetry.json", {
            "schemaVersion": "ai-painter-r5-stage4-v9-cuda-telemetry-v1",
            "status": "collected_after_readonly_forward_and_autograd_grad",
            **timestamps("recordedAt"),
            **cuda_telemetry,
        })
        step("cuda_telemetry_saved")

        model.to("cpu")
        denoiser_hash_after = state_dict_sha256(model.denoiser.state_dict())
        autoencoder_hash_after = state_dict_sha256(model.autoencoder.state_dict())
        if denoiser_hash_before != denoiser_hash_after or autoencoder_hash_before != autoencoder_hash_after:
            raise ValueError("v9_diagnostic_model_state_changed")
        step("denoiser_and_autoencoder_state_hashes_unchanged")

        report = {
            "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-report-v1",
            "status": "passed_readonly_v9_gpu_forward_and_gradient_routing_weights_unchanged",
            **timestamps("recordedAt"),
            "durationSeconds": round(time.perf_counter() - started, 3),
            "identity": {
                "sampleId": SAMPLE_ID,
                "sampleSplit": SAMPLE_SPLIT,
                "seed": SEED,
                "timestep": TIMESTEP,
                "resolution": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
                "requiredBoundarySides": ["west"],
            },
            "tensorShapes": {
                "image": list(image.shape),
                "conditions": list(conditions.shape),
                "latent": list(clean_latent.shape),
                "predictedVelocity": list(predicted_velocity.shape),
                "objectReadoutUp1": list(alignment["objectReadoutUp1"].shape),
                "objectReadoutUp0": list(alignment["objectReadoutUp0"].shape),
                "routeReadout": list(alignment["routeReadout"].shape),
            },
            "losses": {
                "composite": float(losses["compositeLossTensor"].detach().cpu()),
                "decodedRgbMae": float(losses["decodedRgbMae"].detach().cpu()),
                "routeTopologyBce": float(losses["stage4V9PreservedRouteTopologyReadoutBce"].detach().cpu()),
            },
            "gradientRoutes": {
                "independentObjects": gradient_routes,
                "routeTopology": route_norms,
                "decodedRgbBase": decoded_norms,
            },
            "diagnosticManifest": {
                "fieldCount": 17,
                "fields": list(trainer.V9_STAGE4_DIAGNOSTIC_MANIFEST_FIELDS),
                "epoch1Row": manifest_row,
            },
            "cuda": cuda_telemetry,
            "integrity": {
                "denoiserStateSha256Before": denoiser_hash_before,
                "denoiserStateSha256After": denoiser_hash_after,
                "autoencoderStateSha256Before": autoencoder_hash_before,
                "autoencoderStateSha256After": autoencoder_hash_after,
                "parameterGradFieldsAbsent": True,
            },
            "pythonPreflight": python_report,
            "resourcePreflight": resource_report,
            "authorizationConsumption": binding(consumption_path),
            "completedSteps": steps,
            **state,
        }
        report_path = output / "diagnostic-report.json"
        write_json_exclusive(report_path, report)
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-terminal-v1",
            "status": "v9_gradient_diagnostic_passed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "reportPath": project_path(report_path),
            "reportSha256": sha256_file(report_path),
            "cudaTelemetryPath": project_path(output / "cuda-telemetry.json"),
            "cudaTelemetrySha256": sha256_file(output / "cuda-telemetry.json"),
            "nextAction": "separately_authorized_v9_fixed_sample194_30_epoch_gpu_smoke",
            "blockers": [],
            **state,
            "automaticRetryStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(output / "phase-terminal.json"),
            "terminalSha256": sha256_file(output / "phase-terminal.json"),
        }, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        terminal = {
            "schemaVersion": "ai-painter-r5-stage4-v9-gradient-diagnostic-terminal-v1",
            "status": "v9_gradient_diagnostic_failed_closed",
            **timestamps("recordedAt"),
            "fixedTotalProgress": {"completedStages": 3, "totalStages": 5, "percent": 60},
            "failureType": type(error).__name__,
            "failureMessage": str(error),
            "traceback": traceback.format_exc(),
            "completedSteps": steps,
            **state,
            "automaticRetryStarted": False,
            "laterExecutionStarted": False,
        }
        write_json_exclusive(output / "phase-terminal.json", terminal)
        print(json.dumps({
            **terminal,
            "terminalPath": project_path(output / "phase-terminal.json"),
            "terminalSha256": sha256_file(output / "phase-terminal.json"),
        }, ensure_ascii=False, indent=2))
        return 1


def gradient_group_norms(named_parameters, gradients) -> dict:
    totals = {
        **{name: 0.0 for name in OBJECT_CHANNELS},
        "typedAdapters": 0.0,
        "routeTopology": 0.0,
        "baseDenoiser": 0.0,
    }
    for (parameter_name, _), gradient in zip(named_parameters, gradients):
        if gradient is None:
            continue
        value = float(gradient.detach().float().pow(2).sum().sqrt().cpu())
        matched = next((name for name in OBJECT_CHANNELS if name in parameter_name and (
            "v9_object_projection" in parameter_name or "v9_object_readout" in parameter_name
        )), None)
        if matched is not None:
            totals[matched] += value
        elif "typed_condition_adapter" in parameter_name:
            totals["typedAdapters"] += value
        elif "v9_route_topology_readout" in parameter_name:
            totals["routeTopology"] += value
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
    probe = path.resolve()
    while not probe.exists() and probe.parent != probe:
        probe = probe.parent
    return int(shutil.disk_usage(probe).free)


def resolve(path: Path) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value.resolve()
    local = (ROOT / value).resolve()
    if local.exists() or not str(value).replace("\\", "/").startswith(".runtime/"):
        return local
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


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(resolve(path))}


def write_json_exclusive(path: Path, value: dict) -> None:
    target = resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def write_json_atomic(path: Path, value: dict) -> None:
    target = resolve(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)


def timestamps(prefix: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        f"{prefix}Utc": now.isoformat().replace("+00:00", "Z"),
        f"{prefix}AsiaShanghai": now.astimezone(timezone(timedelta(hours=8))).isoformat(),
    }


if __name__ == "__main__":
    raise SystemExit(main())
