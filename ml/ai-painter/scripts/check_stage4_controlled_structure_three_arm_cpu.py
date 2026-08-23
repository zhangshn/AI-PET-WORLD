from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import gc
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

from ai_painter.complete_world.model import build_complete_world_system
from compile_stage4_controlled_structure_three_arm_inactive_configs import (
    ARM_SPECS,
    BASELINE_ARM,
    CAPACITY_ARM,
    FUSION_ARM,
    build_inactive_config,
    read_json,
    resolve_registered_runtime_path,
    validate_inactive_config,
)


FUSION_KEYS = {
    "denoiser.final_condition_residual.0.weight": [64, 23, 3, 3],
    "denoiser.final_condition_residual.0.bias": [64],
    "denoiser.final_condition_residual.2.weight": [12, 64, 3, 3],
    "denoiser.final_condition_residual.2.bias": [12],
}


def tensor_sha256(tensor: torch.Tensor) -> str:
    value = tensor.detach().cpu().contiguous()
    digest = hashlib.sha256()
    digest.update(str(value.dtype).encode())
    digest.update(json.dumps(list(value.shape)).encode())
    digest.update(value.numpy().tobytes())
    return digest.hexdigest()


def state_audit(model) -> dict:
    state = model.state_dict()
    per_tensor = {
        name: {"shape": list(value.shape), "sha256": tensor_sha256(value)}
        for name, value in state.items()
    }
    digest = hashlib.sha256()
    for name, entry in per_tensor.items():
        digest.update(name.encode())
        digest.update(json.dumps(entry, sort_keys=True).encode())
    return {
        "keys": list(state.keys()),
        "perTensor": per_tensor,
        "stateSha256": digest.hexdigest(),
        "parameterCount": sum(parameter.numel() for parameter in model.parameters()),
        "denoiserParameterCount": sum(parameter.numel() for parameter in model.denoiser.parameters()),
    }


def forward_sha256(model) -> tuple[list[int], str]:
    noisy = torch.linspace(-1.0, 1.0, steps=12 * 8 * 8, dtype=torch.float32).reshape(1, 12, 8, 8)
    conditions = torch.linspace(0.0, 1.0, steps=23 * 32 * 32, dtype=torch.float32).reshape(1, 23, 32, 32)
    timestep = torch.tensor([999.0], dtype=torch.float32)
    model.eval()
    with torch.no_grad():
        output = model.predict_velocity(noisy, timestep, conditions)
    return list(output.shape), tensor_sha256(output)


def build_audit(config: dict) -> tuple[dict, list[int], str]:
    torch.manual_seed(20263722)
    model = build_complete_world_system(config)
    audit = state_audit(model)
    shape, output_hash = forward_sha256(model)
    del model
    gc.collect()
    return audit, shape, output_hash


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--source-three-arm-contract", type=Path, required=True)
    args = parser.parse_args()
    source_path, _ = resolve_registered_runtime_path(args.source_config)
    contract_path, contract_logical = resolve_registered_runtime_path(args.source_three_arm_contract)
    source = read_json(source_path)
    def path_rejected(value: Path) -> bool:
        try:
            resolve_registered_runtime_path(value)
        except ValueError:
            return True
        return False
    path_contract = {
        "logicalRuntime": ".runtime",
        "resolvedPhysicalRuntime": str((PROJECT_ROOT / ".runtime").resolve()),
        "logicalInputValidatedBeforeResolve": True,
        "registeredPhysicalMappingAccepted": contract_path.is_file(),
        "absoluteInputRejected": path_rejected(PROJECT_ROOT / ".runtime" / "forbidden.json"),
        "parentTraversalRejected": path_rejected(Path(".runtime") / ".." / "outside.json"),
        "unregisteredExternalPathRejected": path_rejected(Path("data") / "outside.json"),
    }
    if not all(value is True for key, value in path_contract.items() if key not in {"logicalRuntime", "resolvedPhysicalRuntime"}):
        raise ValueError("registered_runtime_path_contract_regression")
    positive: list[dict] = []
    negative: list[dict] = []

    def pos(name: str, condition: bool) -> None:
        positive.append({"name": name, "passed": bool(condition)})

    def reject(name: str, callback) -> None:
        passed = False
        try:
            callback()
        except (ValueError, KeyError, TypeError):
            passed = True
        negative.append({"name": name, "passed": passed})

    configs = {
        arm: build_inactive_config(source, arm, contract_logical)
        for arm in ARM_SPECS
    }
    if True:
        for arm, config in configs.items():
            validate_inactive_config(config, arm, source, contract_logical)
            pos(f"{arm}_inactive_gate_closed", not any(
                config["training"]["stage4ControlledStructureThreeArm"]["activationGate"].values()
            ))

        legacy = deepcopy(source)
        legacy.pop("stage4ControlledStructureArm", None)
        legacy["denoiserBaseChannels"] = 64
        legacy_audit, legacy_shape, legacy_output = build_audit(legacy)
        baseline_audit, baseline_shape, baseline_output = build_audit(configs[BASELINE_ARM])
        pos("baseline_state_dict_names_unchanged", legacy_audit["keys"] == baseline_audit["keys"])
        pos("baseline_state_dict_shapes_and_bytes_unchanged", legacy_audit["perTensor"] == baseline_audit["perTensor"])
        pos("baseline_parameter_count_unchanged", legacy_audit["parameterCount"] == baseline_audit["parameterCount"])
        pos("baseline_fixed_seed_initialization_hash_unchanged", legacy_audit["stateSha256"] == baseline_audit["stateSha256"])
        pos("baseline_cpu_output_bytes_unchanged", legacy_shape == baseline_shape == [1, 12, 8, 8] and legacy_output == baseline_output)

        fusion_audit, fusion_shape, _ = build_audit(configs[FUSION_ARM])
        fusion_new_keys = set(fusion_audit["keys"]) - set(baseline_audit["keys"])
        fusion_existing = {name: fusion_audit["perTensor"][name] for name in baseline_audit["keys"]}
        pos("fusion_only_four_new_parameter_tensors", fusion_new_keys == set(FUSION_KEYS))
        pos("fusion_new_tensor_shapes_exact", all(
            fusion_audit["perTensor"][name]["shape"] == shape for name, shape in FUSION_KEYS.items()
        ))
        pos("fusion_existing_parameter_identity_unchanged", fusion_existing == baseline_audit["perTensor"])
        pos("fusion_exact_added_parameter_count_20236", fusion_audit["denoiserParameterCount"] - baseline_audit["denoiserParameterCount"] == 20236)
        pos("fusion_output_contract_12_channels", fusion_shape == [1, 12, 8, 8])

        capacity_audit, capacity_shape, _ = build_audit(configs[CAPACITY_ARM])
        capacity_changed_shapes = {
            name: {"before": baseline_audit["perTensor"][name]["shape"], "after": capacity_audit["perTensor"][name]["shape"]}
            for name in baseline_audit["keys"]
            if baseline_audit["perTensor"][name]["shape"] != capacity_audit["perTensor"][name]["shape"]
        }
        pos("capacity_module_and_parameter_names_unchanged", capacity_audit["keys"] == baseline_audit["keys"])
        pos("capacity_existing_shapes_only", bool(capacity_changed_shapes) and not (set(capacity_audit["keys"]) ^ set(baseline_audit["keys"])))
        pos("capacity_base_width_exact_128", configs[CAPACITY_ARM]["denoiserBaseChannels"] == 128)
        pos("capacity_time_embedding_exact_512", capacity_audit["perTensor"]["denoiser.time_embedding.1.weight"]["shape"] == [512, 128])
        pos("capacity_output_contract_12_channels", capacity_shape == [1, 12, 8, 8])

        unknown = deepcopy(configs[BASELINE_ARM]); unknown["stage4ControlledStructureArm"] = "unknown"
        reject("unknown_arm_rejected", lambda: build_complete_world_system(unknown))
        both = deepcopy(configs[FUSION_ARM]); both["denoiserBaseChannels"] = 128
        reject("simultaneous_two_axis_change_rejected", lambda: build_complete_world_system(both))
        free_channel = deepcopy(configs[CAPACITY_ARM]); free_channel["denoiserBaseChannels"] = 96
        reject("free_channel_rejected", lambda: build_complete_world_system(free_channel))
        wrong_architecture = deepcopy(configs[BASELINE_ARM]); wrong_architecture["denoiserArchitecture"] = "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment"
        reject("historical_architecture_arm_injection_rejected", lambda: build_complete_world_system(wrong_architecture))
        active_gate = deepcopy(configs[BASELINE_ARM]); active_gate["training"]["stage4ControlledStructureThreeArm"]["activationGate"]["gpuUseNow"] = True
        reject("active_gate_rejected", lambda: validate_inactive_config(active_gate, BASELINE_ARM, source, contract_logical))
        missing_arm = deepcopy(configs[BASELINE_ARM]); missing_arm.pop("stage4ControlledStructureArm")
        reject("missing_arm_rejected", lambda: validate_inactive_config(missing_arm, BASELINE_ARM, source, contract_logical))
        extra_layer = deepcopy(configs[FUSION_ARM]); extra_layer["training"]["stage4ControlledStructureThreeArm"]["extraLayer"] = True
        reject("extra_layer_contract_rejected", lambda: validate_inactive_config(extra_layer, FUSION_ARM, source, contract_logical))
        loss_change = deepcopy(configs[BASELINE_ARM]); loss_change["training"]["denoiserLossWeights"]["noise"] = 999
        reject("loss_change_rejected", lambda: validate_inactive_config(loss_change, BASELINE_ARM, source, contract_logical))
        data_change = deepcopy(configs[BASELINE_ARM]); data_change["datasetPackageModelId"] = "changed"
        reject("data_change_rejected", lambda: validate_inactive_config(data_change, BASELINE_ARM, source, contract_logical))
        checkpoint = deepcopy(configs[BASELINE_ARM]); checkpoint["training"]["stage4ControlledStructureThreeArm"]["historicalCheckpoint"] = "old.pt"
        reject("historical_checkpoint_injection_rejected", lambda: validate_inactive_config(checkpoint, BASELINE_ARM, source, contract_logical))
        optimizer = deepcopy(configs[BASELINE_ARM]); optimizer["training"]["stage4ControlledStructureThreeArm"]["activationGate"]["optimizerCreationNow"] = True
        reject("optimizer_action_rejected", lambda: validate_inactive_config(optimizer, BASELINE_ARM, source, contract_logical))
        backward = deepcopy(configs[BASELINE_ARM]); backward["training"]["stage4ControlledStructureThreeArm"]["activationGate"]["backwardExecutionNow"] = True
        reject("backward_action_rejected", lambda: validate_inactive_config(backward, BASELINE_ARM, source, contract_logical))
        training = deepcopy(configs[BASELINE_ARM]); training["training"]["stage4ControlledStructureThreeArm"]["activationGate"]["trainingNow"] = True
        reject("training_action_rejected", lambda: validate_inactive_config(training, BASELINE_ARM, source, contract_logical))

    status = "passed" if all(item["passed"] for item in positive + negative) else "failed"
    report = {
        "schemaVersion": "stage4-controlled-structure-three-arm-cpu-report-v1",
        "status": status,
        "positive": {"passed": sum(item["passed"] for item in positive), "total": len(positive), "cases": positive},
        "negative": {"passed": sum(item["passed"] for item in negative), "total": len(negative), "cases": negative},
        "baseline": {"stateSha256": baseline_audit["stateSha256"], "parameterCount": baseline_audit["parameterCount"], "denoiserParameterCount": baseline_audit["denoiserParameterCount"], "outputSha256": baseline_output},
        "conditionFusionOnly": {"stateSha256": fusion_audit["stateSha256"], "parameterCount": fusion_audit["parameterCount"], "denoiserParameterCount": fusion_audit["denoiserParameterCount"], "addedParameterCount": fusion_audit["denoiserParameterCount"] - baseline_audit["denoiserParameterCount"], "newTensorShapes": FUSION_KEYS},
        "capacityOnly": {"stateSha256": capacity_audit["stateSha256"], "parameterCount": capacity_audit["parameterCount"], "denoiserParameterCount": capacity_audit["denoiserParameterCount"], "changedTensorShapes": capacity_changed_shapes},
        "checkpointRead": False,
        "gpuStarted": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "trainingStarted": False,
        "registeredRuntimePathContract": path_contract,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if status == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
