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
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world import build_complete_world_system
from ai_painter.complete_world.dataset import AiAssistedConditionalDenoiserDataset
import train_ai_assisted_conditional_denoiser as trainer


SEED = 20263722
IMAGE_SIZE = (256, 192)
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
FUSION_ARM = "condition_fusion_only_final_direct_residual_23_64_12"
CAPACITY_ARM = "capacity_only_base_width_64_to_existing_level1_128"
BASELINE_ARM = "baseline_current_formal_structure"
ALLOWED_ARMS = (FUSION_ARM, CAPACITY_ARM)
AUTOENCODER_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
DATASET_PATH = Path(
    "data/world-samples/ai-assisted-cold-start-dataset-packages/"
    "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
)
FUSION_KEYS = {
    "denoiser.final_condition_residual.0.weight": [64, 23, 3, 3],
    "denoiser.final_condition_residual.0.bias": [64],
    "denoiser.final_condition_residual.2.weight": [12, 64, 3, 3],
    "denoiser.final_condition_residual.2.bias": [12],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


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


def binding(path: Path) -> dict:
    return {"path": project_path(path), "sha256": sha256_file(path)}


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


def validate_authorization(value: dict, authorization_path: Path, consumption: Path, output: Path) -> str:
    if value.get("schemaVersion") != "owner-authorized-stage4-controlled-structure-arm-readonly-gpu-qualification-v1":
        raise ValueError("authorization_schema_invalid")
    if value.get("status") != "resolved_owner_authorized_not_consumed":
        raise ValueError("authorization_status_invalid")
    if value.get("requestId") != value.get("commandRef"):
        raise ValueError("authorization_command_identity_invalid")
    if value.get("scope") != "one_readonly_gpu_stage4_controlled_structure_arm_qualification":
        raise ValueError("authorization_scope_invalid")
    if value.get("oneTimeConsumption") is not True or value.get("gpuAuthorized") is not True:
        raise ValueError("one_time_gpu_authority_missing")
    if value.get("checkpointWeightsReadAuthorized") is not True:
        raise ValueError("autoencoder_read_authority_missing")
    for name in ("denoiserCheckpointReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "trainingAuthorized", "checkpointWriteAuthorized"):
        if value.get(name) is not False:
            raise ValueError(f"forbidden_authority_present:{name}")
    task = value.get("taskIdentity", {})
    arm = task.get("arm")
    if arm not in ALLOWED_ARMS:
        raise ValueError("controlled_structure_arm_invalid")
    if task.get("seed") != SEED or task.get("imageSize") != {"width": 256, "height": 192}:
        raise ValueError("fixed_execution_identity_invalid")
    if task.get("topology") != "west" or task.get("conditionChannelCount") != 23 or task.get("latentChannelCount") != 12:
        raise ValueError("model_contract_identity_invalid")
    bindings = value.get("bindings", {})
    if bindings.get("projectAutoencoderCheckpoint", {}).get("sha256") != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_binding_invalid")
    if bindings.get("sourceIndex", {}).get("sha256") != SOURCE_INDEX_SHA256:
        raise ValueError("source_index_binding_invalid")
    config = bindings.get("armConfig", {})
    if config.get("sha256") != task.get("armConfigSha256"):
        raise ValueError("arm_config_binding_invalid")
    if resolve(Path(value["execution"]["consumptionPath"])) != consumption:
        raise ValueError("consumption_path_identity_invalid")
    if resolve(Path(value["execution"]["outputDirectory"])) != output:
        raise ValueError("output_path_identity_invalid")
    if authorization_path.parent != consumption.parent:
        raise ValueError("authorization_consumption_parent_mismatch")
    return arm


def preflight(value: dict, output: Path) -> dict:
    if not torch.cuda.is_available():
        raise ValueError("cuda_unavailable")
    bindings = value["bindings"]
    for name in ("armConfig", "baselineConfig", "cpuTerminal", "cpuReport", "modelStructureSupportContract", "parameterStructureDifferenceReport", "ownerActionRequest", "modelFactory", "modeRegistry", "sourceIndex"):
        path = resolve(Path(bindings[name]["path"]))
        if not path.is_file() or sha256_file(path) != bindings[name]["sha256"]:
            raise ValueError(f"bound_evidence_invalid:{name}")
    checkpoint = resolve(Path(bindings["projectAutoencoderCheckpoint"]["path"]))
    if not checkpoint.is_file():
        raise ValueError("autoencoder_checkpoint_missing")
    if output.exists():
        raise ValueError("output_directory_already_exists")
    probe = output.parent
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    free = shutil.disk_usage(probe).free
    if free < 2 * 1024**3:
        raise ValueError("disk_budget_insufficient")
    return {
        "schemaVersion": "stage4-controlled-structure-arm-gpu-preflight-v1",
        "status": "passed_gpu_not_started_not_consumed_checkpoint_not_read",
        "arm": value["taskIdentity"]["arm"],
        "python": sys.executable,
        "torchVersion": torch.__version__,
        "cudaDevice": torch.cuda.get_device_name(0),
        "freeDiskBytes": free,
        "checkpointContentRead": False,
        "outputDirectoryAbsent": True,
        "recordedAtUtc": utc_now(),
    }


def consume(value: dict, authorization_path: Path, consumption: Path) -> None:
    consumption.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "schemaVersion": "stage4-controlled-structure-arm-readonly-gpu-consumption-v1",
        "status": "readonly_gpu_authorization_atomically_consumed",
        "requestId": value["requestId"],
        "commandRef": value["commandRef"],
        "scope": value["scope"],
        "arm": value["taskIdentity"]["arm"],
        "authorization": binding(authorization_path),
        "oneTimeConsumption": True,
        "consumedAtUtc": utc_now(),
    }
    descriptor = os.open(consumption, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try:
        os.write(descriptor, (json.dumps(record, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def state_shapes(module: torch.nn.Module) -> dict[str, list[int]]:
    return {name: list(value.shape) for name, value in module.state_dict().items()}


def finite_nonzero(value: torch.Tensor | None) -> bool:
    return value is not None and bool(torch.isfinite(value).all()) and bool(value.detach().abs().sum() > 0)


def load_sample(config: dict):
    selection = trainer.conditional_dataset_selection_contract(config)
    dataset = AiAssistedConditionalDenoiserDataset(
        DATASET_PATH, "validation", list(config["conditionChannelOrder"]), IMAGE_SIZE,
        selection_contract=selection,
    )
    rows = [row["sampleId"] for row in dataset.rows]
    if SAMPLE_ID not in rows or len(dataset) != 8:
        raise ValueError("fixed_validation_sample_identity_invalid")
    return dataset[rows.index(SAMPLE_ID)]


def common_state_identity(baseline: torch.nn.Module, arm_model: torch.nn.Module, arm: str) -> dict:
    baseline_state = baseline.state_dict()
    arm_state = arm_model.state_dict()
    new_keys = sorted(set(arm_state) - set(baseline_state))
    missing_keys = sorted(set(baseline_state) - set(arm_state))
    common_equal = all(
        baseline_state[name].shape == arm_state[name].shape
        and torch.equal(baseline_state[name], arm_state[name])
        for name in set(baseline_state) & set(arm_state)
    )
    if arm == FUSION_ARM:
        if set(new_keys) != set(FUSION_KEYS) or missing_keys or not common_equal:
            raise ValueError("fusion_existing_parameter_identity_changed")
        for name, shape in FUSION_KEYS.items():
            if list(arm_state[name].shape) != shape:
                raise ValueError("fusion_parameter_shape_invalid")
    else:
        if new_keys or missing_keys:
            raise ValueError("capacity_module_name_set_changed")
    return {"newKeys": new_keys, "missingKeys": missing_keys, "commonTensorBytesEqual": common_equal}


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
    arm = value["taskIdentity"]["arm"]
    config = read_json(resolve(Path(value["bindings"]["armConfig"]["path"])))
    baseline_config = read_json(resolve(Path(value["bindings"]["baselineConfig"]["path"])))
    if config.get("stage4ControlledStructureArm") != arm or baseline_config.get("stage4ControlledStructureArm") != BASELINE_ARM:
        raise ValueError("controlled_structure_config_identity_invalid")
    sample = load_sample(config)
    image = sample["image"].unsqueeze(0)
    conditions_cpu = sample["conditions"].unsqueeze(0)
    if conditions_cpu.shape[1] != 23:
        raise ValueError("condition_channel_count_changed")

    torch.manual_seed(SEED)
    baseline = build_complete_world_system(baseline_config)
    baseline_shapes = state_shapes(baseline)
    baseline_parameter_names = list(dict(baseline.named_parameters()))
    torch.manual_seed(SEED)
    model = build_complete_world_system(config)
    structure_identity = common_state_identity(baseline, model, arm)
    arm_shapes = state_shapes(model)
    arm_parameter_names = list(dict(model.named_parameters()))
    if arm == FUSION_ARM:
        added_count = sum(model.state_dict()[name].numel() for name in FUSION_KEYS)
        if added_count != 20236 or model.denoiser.final_condition_residual is None:
            raise ValueError("fusion_exact_parameter_contract_invalid")
    else:
        if config.get("denoiserBaseChannels") != 128:
            raise ValueError("capacity_base_width_invalid")
        if baseline_parameter_names != arm_parameter_names:
            raise ValueError("capacity_parameter_name_identity_changed")
        if arm_shapes["denoiser.time_embedding.1.weight"] != [512, 128]:
            raise ValueError("capacity_time_embedding_derivation_invalid")
        if getattr(model.denoiser, "final_condition_residual", None) is not None:
            raise ValueError("capacity_contains_fusion_axis")

    checkpoint_path = resolve(Path(value["bindings"]["projectAutoencoderCheckpoint"]["path"]))
    if sha256_file(checkpoint_path) != AUTOENCODER_SHA256:
        raise ValueError("autoencoder_checkpoint_sha256_mismatch_after_consumption")
    checkpoint = trainer.load_autoencoder_checkpoint(checkpoint_path, config)
    model.autoencoder.load_state_dict(checkpoint["autoencoderState"], strict=True)
    model.autoencoder.requires_grad_(False)
    model.autoencoder.eval()
    denoiser_before = state_sha256(model.denoiser)
    autoencoder_before = state_sha256(model.autoencoder)

    baseline.denoiser.to(device).eval()
    model.to(device).eval()
    image = image.to(device)
    conditions = conditions_cpu.to(device).requires_grad_(True)
    with torch.no_grad():
        latent = model.autoencoder.encode(image)
    generator = torch.Generator(device=device).manual_seed(SEED)
    noisy = torch.randn(latent.shape, generator=generator, device=device, dtype=latent.dtype)
    timestep = torch.tensor([999], device=device, dtype=torch.long)
    with torch.no_grad():
        baseline_velocity = baseline.predict_velocity(noisy, timestep, conditions.detach())
    velocity = model.predict_velocity(noisy, timestep, conditions)
    if list(velocity.shape) != [1, 12, 48, 64]:
        raise ValueError("final_velocity_shape_invalid")
    decoded = model.autoencoder.decode(velocity)
    scalar = decoded.square().mean()

    if arm == FUSION_ARM:
        branch_parameters = tuple(model.denoiser.final_condition_residual.parameters())
        gradients = torch.autograd.grad(scalar, (conditions, *branch_parameters), retain_graph=True, allow_unused=False)
        typed = model.prepare_typed_conditions(conditions, velocity.shape[-2:])
        branch_value = model.denoiser.final_condition_residual(typed)
        residual_once = torch.allclose(velocity, baseline_velocity + branch_value, atol=0.0, rtol=0.0)
        if not bool(residual_once) or not finite_nonzero(gradients[0]) or not all(finite_nonzero(item) for item in gradients[1:]):
            raise ValueError("fusion_condition_or_branch_gradient_qualification_failed")
        gradient_evidence = {
            "conditionGradientFiniteNonZero": finite_nonzero(gradients[0]),
            "conditionGradientNorm": float(gradients[0].detach().norm().cpu()),
            "branchParameterGradients": [
                {"parameter": name, "finiteNonZero": finite_nonzero(gradient), "norm": float(gradient.detach().norm().cpu())}
                for name, gradient in zip(FUSION_KEYS, gradients[1:])
            ],
            "finalResidualAppliedExactlyOnce": bool(residual_once),
            "addedParameterCount": 20236,
        }
    else:
        probes = (model.denoiser.condition_stem[0].weight, model.denoiser.output[2].weight)
        gradients = torch.autograd.grad(scalar, (conditions, *probes), allow_unused=False)
        if not all(finite_nonzero(item) for item in gradients):
            raise ValueError("capacity_condition_to_output_gradient_qualification_failed")
        gradient_evidence = {
            "conditionGradientFiniteNonZero": finite_nonzero(gradients[0]),
            "conditionGradientNorm": float(gradients[0].detach().norm().cpu()),
            "conditionStemGradientFiniteNonZero": finite_nonzero(gradients[1]),
            "finalOutputGradientFiniteNonZero": finite_nonzero(gradients[2]),
            "baseWidth": 128,
            "derivedWidths": [128, 256, 512],
            "timeEmbeddingChannels": 512,
            "conditionFusionAxisUnchanged": True,
        }
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("parameter_grad_fields_populated")

    torch.cuda.synchronize(0)
    cuda = {
        "deviceName": torch.cuda.get_device_name(0),
        "peakAllocatedBytes": int(torch.cuda.max_memory_allocated(0)),
        "peakReservedBytes": int(torch.cuda.max_memory_reserved(0)),
    }
    del decoded, scalar, velocity, baseline_velocity, noisy, conditions, image
    model.to("cpu")
    baseline.denoiser.to("cpu")
    denoiser_after = state_sha256(model.denoiser)
    autoencoder_after = state_sha256(model.autoencoder)
    state_hashes = {
        "denoiserBefore": denoiser_before,
        "denoiserAfter": denoiser_after,
        "denoiserUnchanged": denoiser_before == denoiser_after,
        "autoencoderBefore": autoencoder_before,
        "autoencoderAfter": autoencoder_after,
        "autoencoderUnchanged": autoencoder_before == autoencoder_after,
    }
    if not state_hashes["denoiserUnchanged"] or not state_hashes["autoencoderUnchanged"]:
        raise ValueError("model_state_changed_during_readonly_gpu_qualification")
    report = {
        "schemaVersion": "stage4-controlled-structure-arm-readonly-gpu-report-v1",
        "status": "controlled_structure_arm_readonly_gpu_qualification_succeeded",
        "arm": arm,
        "sampleIdentity": {"sampleId": SAMPLE_ID, "split": "validation"},
        "seed": SEED,
        "imageSize": {"width": 256, "height": 192},
        "topology": "west",
        "conditionChannelCount": 23,
        "latentChannelCount": 12,
        "parameterStructureIdentity": structure_identity,
        "baselineParameterCount": sum(parameter.numel() for parameter in baseline.denoiser.parameters()),
        "armParameterCount": sum(parameter.numel() for parameter in model.denoiser.parameters()),
        "gradientEvidence": gradient_evidence,
        "stateHashes": state_hashes,
        "safety": {
            "optimizerCreated": False,
            "backwardExecuted": False,
            "modelWeightsModified": False,
            "checkpointWritten": False,
            "trainingStarted": False,
            "denoiserCheckpointRead": False,
        },
        "authorization": binding(authorization_path),
        "consumption": binding(consumption),
        "cuda": cuda,
        "durationSeconds": round(time.perf_counter() - started, 3),
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "condition-gradient-evidence.json", gradient_evidence)
    write_json_atomic(output / "parameter-structure-identity.json", {
        "arm": arm, "baselineShapes": baseline_shapes, "armShapes": arm_shapes,
        "identity": structure_identity,
    })
    write_json_atomic(output / "model-state-hashes.json", state_hashes)
    write_json_atomic(output / "cuda-telemetry.json", {"status": "completed", **cuda, "durationSeconds": report["durationSeconds"]})
    write_json_atomic(output / "gpu-report.json", report)
    terminal = {
        "schemaVersion": "stage4-controlled-structure-arm-readonly-gpu-terminal-v1",
        "status": "controlled_structure_arm_readonly_gpu_qualification_succeeded",
        "arm": arm,
        "gpuReport": binding(output / "gpu-report.json"),
        "cudaTelemetry": binding(output / "cuda-telemetry.json"),
        "conditionGradientEvidence": binding(output / "condition-gradient-evidence.json"),
        "parameterStructureIdentity": binding(output / "parameter-structure-identity.json"),
        "modelStateHashes": binding(output / "model-state-hashes.json"),
        "recordedAtUtc": utc_now(),
    }
    write_json_atomic(output / "phase-terminal.json", terminal)
    print(json.dumps({"status": terminal["status"], "arm": arm, "terminal": binding(output / "phase-terminal.json")}, ensure_ascii=False, indent=2), flush=True)
    return 0


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
    if sha256_file(authorization_path) != args.authorization_sha256:
        raise ValueError("authorization_sha256_mismatch")
    value = read_json(authorization_path)
    validate_authorization(value, authorization_path, consumption, output)
    if args.preflight_only:
        print(json.dumps(preflight(value, output), ensure_ascii=False, indent=2))
        return 0
    preflight(value, output)
    consume(value, authorization_path, consumption)
    return run_gpu(value, authorization_path, consumption, output)


if __name__ == "__main__":
    raise SystemExit(main())
