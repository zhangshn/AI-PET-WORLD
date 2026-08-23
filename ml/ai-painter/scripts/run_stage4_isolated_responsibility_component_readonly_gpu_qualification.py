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

import numpy as np
import torch

from ai_painter.complete_world import build_complete_world_system
import train_ai_assisted_conditional_denoiser as trainer
import run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification as dataset_runner


ROOT = Path(__file__).resolve().parents[3]
SEED = 20263722
IMAGE_SIZE = {"width": 256, "height": 192}
LATENT_SIZE = {"width": 64, "height": 48}
NATIVE_SIZE = {"width": 1024, "height": 768}
TRAIN_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
VALIDATION_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
ROLE_ORDER = (
    "terrain_route_hydrology_spatial_realization",
    "per_class_object_semantic_realization",
    "global_visual_harmonization_and_native_complete_rgb_decode",
)
EXPECTED_EXPERTS = {
    ROLE_ORDER[0]: ("route",),
    ROLE_ORDER[1]: ("footprints", "tree", "rock", "vegetation"),
    ROLE_ORDER[2]: (),
}
OBJECT_CHANNELS = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def write_json_exclusive(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try:
        os.write(descriptor, (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tensor_sha256(value: torch.Tensor) -> str:
    tensor = value.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(tensor.dtype).encode())
    digest.update(json.dumps(list(tensor.shape)).encode())
    digest.update(tensor.numpy().tobytes())
    return digest.hexdigest()


def state_sha256(module: torch.nn.Module) -> str:
    digest = hashlib.sha256()
    for name, value in module.state_dict().items():
        digest.update(name.encode())
        digest.update(tensor_sha256(value).encode())
    return digest.hexdigest()


def resolve(value: Path) -> Path:
    if value.is_absolute():
        raise ValueError("project_relative_path_required")
    root = Path(os.path.abspath(ROOT))
    logical = Path(os.path.abspath(ROOT / value))
    if logical != root and root not in logical.parents:
        raise ValueError("project_path_escape")
    resolved = logical.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved != root and root not in resolved.parents and not (
        resolved == runtime or runtime in resolved.parents
    ):
        raise ValueError("unregistered_external_path")
    return resolved


def project_path(value: Path) -> str:
    resolved = value.resolve()
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT.resolve()).as_posix()


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(path)}


def validate_authorization(value: dict, authorization_path: Path, consumption: Path, output: Path) -> str:
    if value.get("schemaVersion") != "owner-authorized-stage4-isolated-responsibility-component-readonly-gpu-qualification-v1":
        raise ValueError("authorization_schema_invalid")
    if value.get("status") != "resolved_owner_authorized_not_consumed":
        raise ValueError("authorization_status_invalid")
    if value.get("requestId") != value.get("commandRef"):
        raise ValueError("authorization_command_identity_invalid")
    if value.get("scope") != "one_readonly_gpu_stage4_isolated_responsibility_component_qualification":
        raise ValueError("authorization_scope_invalid")
    if value.get("oneTimeConsumption") is not True or value.get("gpuAuthorized") is not True:
        raise ValueError("one_time_gpu_authority_missing")
    if value.get("checkpointWeightsReadAuthorized") is not True:
        raise ValueError("project_autoencoder_read_authority_missing")
    for name in (
        "denoiserCheckpointReadAuthorized", "optimizerAuthorized", "backwardAuthorized",
        "modelWeightModificationAuthorized", "checkpointWriteAuthorized", "smokeAuthorized",
        "trainingAuthorized", "stage0Authorized", "stage1Authorized", "stage2Authorized",
    ):
        if value.get(name) is not False:
            raise ValueError(f"forbidden_authority_present:{name}")
    task = value.get("taskIdentity", {})
    role = task.get("roleId")
    if role not in ROLE_ORDER or task.get("roleIndex") != ROLE_ORDER.index(role):
        raise ValueError("component_role_identity_invalid")
    if task.get("roleOrder") != list(ROLE_ORDER):
        raise ValueError("component_role_order_invalid")
    if task.get("seed") != SEED or task.get("imageSize") != IMAGE_SIZE:
        raise ValueError("fixed_execution_identity_invalid")
    if task.get("conditionChannelCount") != 23 or task.get("latentChannelCount") != 12:
        raise ValueError("channel_identity_invalid")
    if task.get("trainSampleId") != TRAIN_SAMPLE_ID or task.get("validationSampleId") != VALIDATION_SAMPLE_ID:
        raise ValueError("sample_identity_invalid")
    bindings = value.get("bindings", {})
    if bindings.get("sourceIndex", {}).get("sha256") != SOURCE_INDEX_SHA256:
        raise ValueError("source_index_binding_invalid")
    if bindings.get("projectAutoencoderCheckpoint", {}).get("sha256") != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_binding_invalid")
    if bindings.get("componentConfig", {}).get("sha256") != task.get("componentConfigSha256"):
        raise ValueError("component_config_binding_invalid")
    if resolve(Path(value["execution"]["consumptionPath"])) != consumption:
        raise ValueError("consumption_path_identity_invalid")
    if resolve(Path(value["execution"]["outputDirectory"])) != output:
        raise ValueError("output_path_identity_invalid")
    if authorization_path.parent != consumption.parent:
        raise ValueError("authorization_consumption_parent_mismatch")
    return role


def validate_bound_sources(value: dict) -> None:
    bindings = value["bindings"]
    names = (
        "cpuTerminal", "cpuReport", "componentSupportContract", "parameterStructureReport",
        "evidenceIsolationReport", "ownerActionRequest", "componentConfig", "modelFactory",
        "modeRegistry", "sourceIndex", "gpuEntryCpuReport",
    )
    for name in names:
        path = resolve(Path(bindings[name]["path"]))
        if not path.is_file() or sha256_file(path) != bindings[name]["sha256"]:
            raise ValueError(f"bound_evidence_invalid:{name}")
    checkpoint = resolve(Path(bindings["projectAutoencoderCheckpoint"]["path"]))
    if not checkpoint.is_file() or sha256_file(checkpoint) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_checkpoint_identity_invalid")


def validate_predecessor(value: dict) -> dict | None:
    role = value["taskIdentity"]["roleId"]
    index = ROLE_ORDER.index(role)
    predecessor = value.get("predecessor")
    if index == 0:
        if predecessor != {"kind": "authoritative_world_structure_binding", "sameQualificationPackageRequired": True}:
            raise ValueError("authoritative_predecessor_identity_invalid")
        return None
    expected_role = ROLE_ORDER[index - 1]
    if predecessor.get("roleId") != expected_role or predecessor.get("sameQualificationPackageRequired") is not True:
        raise ValueError("predecessor_role_identity_invalid")
    terminal_path = resolve(Path(predecessor["terminalPath"]))
    output_evidence_path = resolve(Path(predecessor["outputEvidencePath"]))
    if not terminal_path.is_file() or not output_evidence_path.is_file():
        raise ValueError("predecessor_evidence_missing")
    terminal = read_json(terminal_path)
    evidence = read_json(output_evidence_path)
    if terminal.get("status") != "isolated_responsibility_component_readonly_gpu_qualification_succeeded":
        raise ValueError("predecessor_terminal_status_invalid")
    if terminal.get("roleId") != expected_role or terminal.get("qualificationPackageId") != value.get("qualificationPackageId"):
        raise ValueError("predecessor_terminal_identity_invalid")
    if terminal.get("outputIdentity", {}).get("sha256") != sha256_file(output_evidence_path):
        raise ValueError("predecessor_output_binding_invalid")
    if evidence.get("roleId") != expected_role or evidence.get("qualificationPackageId") != value.get("qualificationPackageId"):
        raise ValueError("predecessor_output_identity_invalid")
    return evidence


def preflight(value: dict, output: Path) -> dict:
    validate_bound_sources(value)
    validate_predecessor(value)
    if not torch.cuda.is_available() or torch.cuda.device_count() < 1:
        raise ValueError("cuda_unavailable")
    if output.exists():
        raise ValueError("output_directory_already_exists")
    probe = output.parent
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    free = shutil.disk_usage(probe).free
    if free < 2 * 1024**3:
        raise ValueError("disk_budget_insufficient")
    device = torch.cuda.get_device_properties(0)
    return {
        "schemaVersion": "stage4-isolated-responsibility-component-gpu-preflight-v1",
        "status": "passed_gpu_not_started_not_consumed_checkpoint_not_read",
        "roleId": value["taskIdentity"]["roleId"],
        "python": sys.executable,
        "torchVersion": torch.__version__,
        "cudaDevice": device.name,
        "cudaTotalMemoryBytes": int(device.total_memory),
        "freeDiskBytes": free,
        "checkpointContentRead": False,
        "outputDirectoryAbsent": True,
        "recordedAtUtc": utc_now(),
    }


def consume(value: dict, authorization_path: Path, consumption: Path) -> None:
    if consumption.exists():
        raise ValueError("authorization_already_consumed")
    write_json_exclusive(consumption, {
        "schemaVersion": "stage4-isolated-responsibility-component-readonly-gpu-consumption-v1",
        "status": "readonly_gpu_authorization_atomically_consumed",
        "requestId": value["requestId"],
        "commandRef": value["commandRef"],
        "scope": value["scope"],
        "qualificationPackageId": value["qualificationPackageId"],
        "roleId": value["taskIdentity"]["roleId"],
        "authorization": binding(authorization_path),
        "oneTimeConsumption": True,
        "consumedAtUtc": utc_now(),
    })


def load_fixed_samples(config: dict) -> list[dict]:
    datasets = dataset_runner.load_datasets(config)
    train_ids = [row["sampleId"] for row in datasets["train"].rows]
    validation_ids = [row["sampleId"] for row in datasets["validation"].rows]
    if train_ids[0] != TRAIN_SAMPLE_ID:
        raise ValueError("first_formal_train_sample_identity_changed")
    if VALIDATION_SAMPLE_ID not in validation_ids:
        raise ValueError("fixed_validation_sample_identity_changed")
    return [datasets["train"][0], datasets["validation"][validation_ids.index(VALIDATION_SAMPLE_ID)]]


def parameter_namespace_identity(model: torch.nn.Module, role: str) -> dict:
    prefix = f"stage4_responsibility_components.{role}."
    trainable = [(name, parameter) for name, parameter in model.named_parameters() if parameter.requires_grad]
    if not trainable or not all(name.startswith(prefix) for name, _ in trainable):
        raise ValueError("trainable_parameter_namespace_not_isolated")
    expert_names = sorted({
        name.split("semantic_mixture_experts.", 1)[1].split(".", 1)[0]
        for name, _ in trainable if "semantic_mixture_experts." in name
    })
    if tuple(expert_names) != tuple(sorted(EXPECTED_EXPERTS[role])):
        raise ValueError("responsibility_expert_set_invalid")
    return {
        "roleId": role,
        "namespace": prefix[:-1],
        "allTrainableParametersRolePrefixed": True,
        "trainableParameterNames": [name for name, _ in trainable],
        "trainableTensorCount": len(trainable),
        "trainableParameterCount": sum(parameter.numel() for _, parameter in trainable),
        "expertIdentityOrder": list(EXPECTED_EXPERTS[role]),
        "processId": os.getpid(),
    }


def save_latent(path: Path, value: torch.Tensor) -> dict:
    array = value.detach().cpu().contiguous().numpy()
    with path.open("xb") as handle:
        np.save(handle, array, allow_pickle=False)
        handle.flush()
        os.fsync(handle.fileno())
    return {"path": project_path(path), "sha256": sha256_file(path), "shape": list(array.shape), "dtype": str(array.dtype)}


def load_predecessor_latent(evidence: dict, split: str) -> torch.Tensor:
    item = next((row for row in evidence["outputs"] if row["split"] == split), None)
    if item is None:
        raise ValueError("predecessor_split_output_missing")
    path = resolve(Path(item["artifact"]["path"]))
    if sha256_file(path) != item["artifact"]["sha256"]:
        raise ValueError("predecessor_tensor_sha256_mismatch")
    array = np.load(path, allow_pickle=False)
    if list(array.shape) != [1, 12, LATENT_SIZE["height"], LATENT_SIZE["width"]]:
        raise ValueError("predecessor_tensor_shape_invalid")
    return torch.from_numpy(array.copy())


def finite_nonzero(value: torch.Tensor | None) -> bool:
    return value is not None and bool(torch.isfinite(value).all()) and bool(value.detach().abs().sum() > 0)


def responsibility_gradient_partition(named_parameters, gradients, role: str) -> dict:
    if len(named_parameters) != len(gradients):
        raise ValueError("parameter_gradient_cardinality_mismatch")
    active = []
    inactive_auxiliary = []
    for (name, parameter), gradient in zip(named_parameters, gradients):
        row = {
            "parameterName": name,
            "shape": list(parameter.shape),
            "graphReachable": gradient is not None,
            "finite": None if gradient is None else bool(torch.isfinite(gradient).all()),
            "nonZero": None if gradient is None else bool(gradient.detach().abs().sum() > 0),
        }
        if name.startswith("output_bound_condition_probe."):
            if gradient is not None:
                raise ValueError("inactive_condition_probe_unexpectedly_reachable")
            inactive_auxiliary.append(row)
        else:
            if not finite_nonzero(gradient):
                raise ValueError(f"formal_responsibility_parameter_gradient_invalid:{name}")
            active.append(row)
    if not active or not inactive_auxiliary:
        raise ValueError("formal_parameter_subset_partition_incomplete")
    route_prefixes = ("semantic_mixture_experts.route.", "semantic_mixture_participation.route.")
    if role == ROLE_ORDER[0] and not all(
        any(row["parameterName"].startswith(prefix) for row in active)
        for prefix in route_prefixes
    ):
        raise ValueError("terrain_route_formal_parameter_path_missing")
    return {
        "formalResponsibilityActiveParameters": active,
        "inactiveAuxiliaryParameters": inactive_auxiliary,
        "formalActiveParameterCount": len(active),
        "inactiveAuxiliaryParameterCount": len(inactive_auxiliary),
        "inactiveAuxiliaryModuleIdentity": "output_bound_condition_probe",
    }


def run_gpu(value: dict, authorization_path: Path, consumption: Path, output: Path) -> int:
    started = time.perf_counter()
    output.mkdir(parents=True, exist_ok=False)
    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
    torch.use_deterministic_algorithms(True)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    torch.cuda.init()
    torch.cuda.set_device(0)
    torch.cuda.reset_peak_memory_stats(0)
    device = torch.device("cuda:0")
    role = value["taskIdentity"]["roleId"]
    predecessor_evidence = validate_predecessor(value)
    config = read_json(resolve(Path(value["bindings"]["componentConfig"]["path"])))
    if config.get("stage4ResponsibilityComponentRole") != role:
        raise ValueError("component_config_role_invalid")
    samples = load_fixed_samples(config)
    if [sample["sampleId"] for sample in samples] != [TRAIN_SAMPLE_ID, VALIDATION_SAMPLE_ID]:
        raise ValueError("fixed_sample_order_invalid")

    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    model = build_complete_world_system(config)
    namespace = parameter_namespace_identity(model, role)
    checkpoint_path = resolve(Path(value["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    if sha256_file(checkpoint_path) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_checkpoint_sha256_mismatch_after_consumption")
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    model.to(device).eval()
    denoiser_before = state_sha256(model.denoiser)
    autoencoder_before = state_sha256(model.autoencoder)
    named_trainable_parameters = tuple(
        (name, parameter) for name, parameter in model.denoiser.named_parameters()
        if parameter.requires_grad
    )
    trainable_parameters = tuple(parameter for _, parameter in named_trainable_parameters)
    if not named_trainable_parameters:
        raise ValueError("component_trainable_parameter_group_missing")

    rows = []
    output_rows = []
    condition_order = list(config["conditionChannelOrder"])
    object_indices = [condition_order.index(name) for name in OBJECT_CHANNELS]
    for index, sample in enumerate(samples):
        split = "train" if index == 0 else "validation"
        conditions = sample["conditions"].unsqueeze(0).to(device).requires_grad_(True)
        object_masks_before = tensor_sha256(conditions[:, object_indices])
        if predecessor_evidence is None:
            generator = torch.Generator(device="cuda")
            generator.manual_seed(SEED + index)
            component_input = torch.randn(
                1, 12, LATENT_SIZE["height"], LATENT_SIZE["width"],
                generator=generator, device=device,
            )
        else:
            component_input = load_predecessor_latent(predecessor_evidence, split).to(device)
        component_input.requires_grad_(True)
        timestep = torch.tensor([999.0], device=device)
        output_latent = model.predict_velocity(component_input, timestep, conditions)
        if list(output_latent.shape) != [1, 12, LATENT_SIZE["height"], LATENT_SIZE["width"]]:
            raise ValueError("component_output_shape_invalid")
        scalar = output_latent.square().mean()
        gradients = torch.autograd.grad(
            scalar, (component_input, conditions, *trainable_parameters),
            allow_unused=True,
        )
        input_gradient, condition_gradient = gradients[:2]
        parameter_gradients = gradients[2:]
        if not finite_nonzero(input_gradient) or not finite_nonzero(condition_gradient):
            raise ValueError("component_input_or_condition_gradient_invalid")
        gradient_partition = responsibility_gradient_partition(
            named_trainable_parameters, parameter_gradients, role,
        )
        object_masks_after = tensor_sha256(conditions[:, object_indices])
        if object_masks_before != object_masks_after:
            raise ValueError("approved_object_mask_modified")
        artifact = save_latent(output / f"{split}-output-latent.npy", output_latent)
        output_rows.append({
            "split": split,
            "sampleId": sample["sampleId"],
            "artifact": artifact,
            "tensorSha256": tensor_sha256(output_latent),
        })
        rows.append({
            "split": split,
            "sampleId": sample["sampleId"],
            "conditionTensorSha256": tensor_sha256(conditions),
            "inputTensorSha256": tensor_sha256(component_input),
            "outputTensorSha256": tensor_sha256(output_latent),
            "inputGradientFiniteNonZero": finite_nonzero(input_gradient),
            "conditionGradientFiniteNonZero": finite_nonzero(condition_gradient),
            "parameterGradientsFinite": all(
                row["finite"] is True
                for row in gradient_partition["formalResponsibilityActiveParameters"]
            ),
            "parameterGradientNonZeroTensorCount": sum(
                row["nonZero"] is True
                for row in gradient_partition["formalResponsibilityActiveParameters"]
            ),
            "formalParameterSubset": gradient_partition,
            "approvedObjectMaskOrder": list(OBJECT_CHANNELS),
            "approvedObjectMasksBeforeSha256": object_masks_before,
            "approvedObjectMasksAfterSha256": object_masks_after,
            "approvedObjectMasksUnchanged": object_masks_before == object_masks_after,
        })
        del conditions, component_input, output_latent, scalar, gradients
        torch.cuda.empty_cache()

    native_boundary = {
        "autoencoderDownsampleFactor": 4,
        "stage0LatentSize": LATENT_SIZE,
        "stage0DecodedRgbSize": IMAGE_SIZE,
        "formalNativeLatentSize": {"width": 256, "height": 192},
        "formalNativeDecodedRgbSize": NATIVE_SIZE,
        "nativeCompleteFrame": True,
        "tileUsed": False,
        "patchUsed": False,
        "lowResolutionUpscaleUsed": False,
        "executedAtNativeResolution": role == ROLE_ORDER[2],
    }
    if role == ROLE_ORDER[2]:
        final_stage0_latent = torch.from_numpy(np.load(output / "validation-output-latent.npy", allow_pickle=False)).to(device)
        with torch.no_grad():
            decoded_stage0 = model.decode_stage4_native_complete_rgb(final_stage0_latent)
            native_probe = torch.zeros(1, 12, 192, 256, device=device)
            decoded_native = model.decode_stage4_native_complete_rgb(native_probe)
        if list(decoded_stage0.shape) != [1, 3, 192, 256] or list(decoded_native.shape) != [1, 3, 768, 1024]:
            raise ValueError("final_native_rgb_decode_boundary_invalid")
        native_boundary["stage0DecodedTensorShape"] = list(decoded_stage0.shape)
        native_boundary["formalNativeDecodedTensorShape"] = list(decoded_native.shape)
    else:
        rejected = False
        try:
            model.decode_stage4_native_complete_rgb(torch.zeros(1, 12, 48, 64, device=device))
        except ValueError:
            rejected = True
        if not rejected:
            raise ValueError("non_final_component_rgb_decode_not_rejected")

    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("parameter_grad_fields_populated")
    torch.cuda.synchronize(0)
    cuda = {
        "deviceName": torch.cuda.get_device_name(0),
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
    }
    model.to("cpu")
    denoiser_after = state_sha256(model.denoiser)
    autoencoder_after = state_sha256(model.autoencoder)
    if denoiser_before != denoiser_after or autoencoder_before != autoencoder_after:
        raise ValueError("model_state_changed")
    output_evidence = {
        "schemaVersion": "stage4-isolated-responsibility-component-output-identity-v1",
        "status": "output_identity_completed",
        "qualificationPackageId": value["qualificationPackageId"],
        "roleId": role,
        "roleIndex": ROLE_ORDER.index(role),
        "outputs": output_rows,
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "output-identity.json", output_evidence)
    state_hashes = {
        "denoiserBefore": denoiser_before,
        "denoiserAfter": denoiser_after,
        "denoiserUnchanged": True,
        "autoencoderBefore": autoencoder_before,
        "autoencoderAfter": autoencoder_after,
        "autoencoderUnchanged": True,
    }
    gradient_evidence = {
        "schemaVersion": "stage4-isolated-responsibility-component-gradient-evidence-v1",
        "status": "passed",
        "roleId": role,
        "samples": rows,
        "recordedAtUtc": utc_now(),
    }
    report = {
        "schemaVersion": "stage4-isolated-responsibility-component-readonly-gpu-report-v1",
        "status": "isolated_responsibility_component_readonly_gpu_qualification_succeeded",
        "qualificationPackageId": value["qualificationPackageId"],
        "roleId": role,
        "roleIndex": ROLE_ORDER.index(role),
        "roleOrder": list(ROLE_ORDER),
        "fixedIdentity": {
            "seed": SEED,
            "imageSize": IMAGE_SIZE,
            "conditionChannelCount": 23,
            "latentChannelCount": 12,
            "trainSampleId": TRAIN_SAMPLE_ID,
            "validationSampleId": VALIDATION_SAMPLE_ID,
        },
        "parameterNamespaceIdentity": namespace,
        "expertIdentityOrder": list(EXPECTED_EXPERTS[role]),
        "sampleEvidence": rows,
        "predecessor": value["predecessor"],
        "outputIdentity": binding(output / "output-identity.json"),
        "nativeCompleteRgbResourceBoundary": native_boundary,
        "stateHashes": state_hashes,
        "authorization": binding(authorization_path),
        "consumption": binding(consumption),
        "cuda": cuda,
        "safety": {
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsModified": False,
            "checkpointWritten": False,
            "denoiserCheckpointRead": False,
            "failedCheckpointRead": False,
            "smokeStarted": False,
            "trainingStarted": False,
        },
        "durationSeconds": round(time.perf_counter() - started, 3),
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "parameter-namespace-identity.json", namespace)
    write_json_atomic(output / "condition-and-gradient-evidence.json", gradient_evidence)
    write_json_atomic(output / "model-state-hashes.json", state_hashes)
    write_json_atomic(output / "native-rgb-resource-boundary.json", native_boundary)
    write_json_atomic(output / "cuda-telemetry.json", {"status": "completed", **cuda, "durationSeconds": report["durationSeconds"], "recordedAtUtc": report["recordedAtUtc"]})
    write_json_atomic(output / "gpu-report.json", report)
    terminal = {
        "schemaVersion": "stage4-isolated-responsibility-component-readonly-gpu-terminal-v1",
        "status": "isolated_responsibility_component_readonly_gpu_qualification_succeeded",
        "qualificationPackageId": value["qualificationPackageId"],
        "roleId": role,
        "gpuReport": binding(output / "gpu-report.json"),
        "cudaTelemetry": binding(output / "cuda-telemetry.json"),
        "conditionAndGradientEvidence": binding(output / "condition-and-gradient-evidence.json"),
        "parameterNamespaceIdentity": binding(output / "parameter-namespace-identity.json"),
        "modelStateHashes": binding(output / "model-state-hashes.json"),
        "nativeRgbResourceBoundary": binding(output / "native-rgb-resource-boundary.json"),
        "outputIdentity": binding(output / "output-identity.json"),
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "phase-terminal.json", terminal)
    print(json.dumps({"status": terminal["status"], "roleId": role, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2), flush=True)
    return 0


def write_failure(output: Path, role: str | None, error: Exception) -> None:
    if not output.exists():
        output.mkdir(parents=True, exist_ok=False)
    failure = {
        "schemaVersion": "stage4-isolated-responsibility-component-readonly-gpu-failure-v1",
        "status": "isolated_responsibility_component_readonly_gpu_qualification_failed_closed",
        "roleId": role,
        "errorType": type(error).__name__,
        "error": str(error),
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "failure-report.json", failure)
    write_json_atomic(output / "phase-terminal.json", {
        **failure,
        "failureReport": binding(output / "failure-report.json"),
    })


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    authorization_path = resolve(args.authorization)
    consumption = resolve(args.consumption)
    output = resolve(args.output_dir)
    role = None
    try:
        if sha256_file(authorization_path) != args.authorization_sha256:
            raise ValueError("authorization_sha256_mismatch")
        authorization = read_json(authorization_path)
        role = validate_authorization(authorization, authorization_path, consumption, output)
        if args.preflight_only:
            print(json.dumps(preflight(authorization, output), ensure_ascii=False, indent=2))
            return 0
        preflight(authorization, output)
        consume(authorization, authorization_path, consumption)
        return run_gpu(authorization, authorization_path, consumption, output)
    except Exception as error:
        if not args.preflight_only and consumption.exists():
            write_failure(output, role, error)
        raise


if __name__ == "__main__":
    raise SystemExit(main())
