from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path

from ai_painter_stage_mode_registry import (
    CONTROLLED_STRUCTURE_BASELINE_STAGE4_INACTIVE_STATUS,
    CONTROLLED_STRUCTURE_CAPACITY_STAGE4_INACTIVE_STATUS,
    CONTROLLED_STRUCTURE_FUSION_STAGE4_INACTIVE_STATUS,
    FORMAL_MODE_REGISTRY,
)


ARCHITECTURE = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONTRACT_ID = "stage4_controlled_structure_three_arm_cpu_inactive_support_v1"
BASELINE_ARM = "baseline_current_formal_structure"
FUSION_ARM = "condition_fusion_only_final_direct_residual_23_64_12"
CAPACITY_ARM = "capacity_only_base_width_64_to_existing_level1_128"
ARM_SPECS = {
    BASELINE_ARM: {
        "authorizationStatus": CONTROLLED_STRUCTURE_BASELINE_STAGE4_INACTIVE_STATUS,
        "denoiserBaseChannels": 64,
        "fileName": "baseline-current-formal-structure.inactive-config.json",
    },
    FUSION_ARM: {
        "authorizationStatus": CONTROLLED_STRUCTURE_FUSION_STAGE4_INACTIVE_STATUS,
        "denoiserBaseChannels": 64,
        "fileName": "condition-fusion-only-final-direct-residual-23-64-12.inactive-config.json",
    },
    CAPACITY_ARM: {
        "authorizationStatus": CONTROLLED_STRUCTURE_CAPACITY_STAGE4_INACTIVE_STATUS,
        "denoiserBaseChannels": 128,
        "fileName": "capacity-only-base-width-64-to-existing-level1-128.inactive-config.json",
    },
}
GATE_FIELDS = (
    "configurationActiveNow",
    "checkpointReadNow",
    "optimizerCreationNow",
    "backwardExecutionNow",
    "modelParameterUpdateNow",
    "gpuUseNow",
    "trainingNow",
    "smokeNow",
    "stage4FullTrainingNow",
    "stage1Now",
    "stage2Now",
    "formalInferenceNow",
    "checkpointPromotionNow",
    "runtimeFrameNow",
    "worldEntryNow",
)
SOURCE_CONTRACT_SHA256 = "70fdfdf5f117b8d3d73af8a2b239fe647077d364da940b1c2fc31147497843dc"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_registered_runtime_path(value: Path) -> tuple[Path, str]:
    """Validate the project-logical path before resolving the registered runtime mapping."""
    if value.is_absolute():
        raise ValueError("absolute_path_input_rejected")
    if ".." in value.parts:
        raise ValueError("parent_traversal_rejected")
    logical_root = Path(os.path.abspath(PROJECT_ROOT))
    logical_runtime = Path(os.path.abspath(PROJECT_ROOT / ".runtime"))
    logical_target = Path(os.path.abspath(PROJECT_ROOT / value))
    try:
        logical_relative = logical_target.relative_to(logical_runtime)
    except ValueError as error:
        raise ValueError("logical_path_must_be_inside_project_runtime") from error
    if logical_root not in logical_target.parents:
        raise ValueError("logical_project_boundary_rejected")
    physical_runtime = logical_runtime.resolve()
    physical_target = logical_target.resolve()
    try:
        physical_target.relative_to(physical_runtime)
    except ValueError as error:
        raise ValueError("unregistered_runtime_physical_path_rejected") from error
    return physical_target, (Path(".runtime") / logical_relative).as_posix()


def logical_registered_runtime_path(physical_path: Path) -> str:
    physical_runtime = (PROJECT_ROOT / ".runtime").resolve()
    try:
        relative = physical_path.resolve().relative_to(physical_runtime)
    except ValueError as error:
        raise ValueError("physical_path_not_in_registered_runtime") from error
    return (Path(".runtime") / relative).as_posix()


def _deactivate_nested_contracts(value) -> None:
    if isinstance(value, dict):
        gate = value.get("activationGate")
        if isinstance(gate, dict):
            value["activationGate"] = {name: False for name in gate}
            if isinstance(value.get("status"), str):
                value["status"] = "cpu_support_verified_inactive"
        for nested in value.values():
            _deactivate_nested_contracts(nested)
    elif isinstance(value, list):
        for nested in value:
            _deactivate_nested_contracts(nested)


def _cpu_only_owner_authorization() -> dict[str, object]:
    return {
        "status": "not_authorized_cpu_support_only",
        "checkpointReadAuthorized": False,
        "optimizerCreationAuthorized": False,
        "backwardExecutionAuthorized": False,
        "modelParameterUpdateAuthorized": False,
        "gpuAuthorized": False,
        "smokeAuthorized": False,
        "stage4FullTrainingAuthorized": False,
        "stage1Authorized": False,
        "stage2Authorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }


def build_inactive_config(source: dict, arm: str, source_contract_path: str) -> dict:
    if arm not in ARM_SPECS:
        raise ValueError("unknown_controlled_structure_arm")
    spec = ARM_SPECS[arm]
    config = deepcopy(source)
    if config.get("denoiserArchitecture") != ARCHITECTURE:
        raise ValueError("source_architecture_mismatch")
    if int(config.get("conditionChannels", -1)) != 23 or int(config.get("latentChannels", -1)) != 12:
        raise ValueError("source_channel_contract_mismatch")
    config["status"] = "stage4_controlled_structure_arm_cpu_supported_inactive"
    config["stage4ControlledStructureArm"] = arm
    config["denoiserBaseChannels"] = spec["denoiserBaseChannels"]
    training = config.setdefault("training", {})
    _deactivate_nested_contracts(training)
    training["trainingAuthorizationStatus"] = spec["authorizationStatus"]
    training["ownerTrainingAuthorization"] = _cpu_only_owner_authorization()
    training["stage4ControlledStructureThreeArm"] = {
        "contractId": CONTRACT_ID,
        "status": "cpu_support_verified_inactive",
        "armId": arm,
        "sourceThreeArmContract": {
            "path": source_contract_path,
            "sha256": SOURCE_CONTRACT_SHA256,
        },
        "architecture": ARCHITECTURE,
        "conditionChannels": 23,
        "latentChannels": 12,
        "denoiserBaseChannels": spec["denoiserBaseChannels"],
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    return config


def validate_inactive_config(config: dict, arm: str, source: dict, source_contract_path: str) -> None:
    expected = build_inactive_config(source, arm, source_contract_path)
    if config != expected:
        raise ValueError("inactive_config_not_exactly_derived")
    spec = ARM_SPECS[arm]
    mode = FORMAL_MODE_REGISTRY.resolve(spec["authorizationStatus"], ARCHITECTURE)
    if mode.execution_kind != "cpu_inactive" or mode.active_execution:
        raise ValueError("mode_registry_inactive_contract_mismatch")
    contract = config["training"]["stage4ControlledStructureThreeArm"]
    if tuple(contract["activationGate"].keys()) != GATE_FIELDS:
        raise ValueError("activation_gate_field_set_mismatch")
    if any(value is not False for value in contract["activationGate"].values()):
        raise ValueError("activation_gate_not_closed")
    owner = config["training"]["ownerTrainingAuthorization"]
    if owner != _cpu_only_owner_authorization():
        raise ValueError("owner_training_authorization_not_cpu_only")


def compile_three_arm_configs(source_input: Path, source_contract_input: Path, output_input: Path) -> dict[str, Path]:
    source_path, _ = resolve_registered_runtime_path(source_input)
    source_contract_path, source_contract_logical = resolve_registered_runtime_path(source_contract_input)
    output_dir, _ = resolve_registered_runtime_path(output_input)
    if sha256_file(source_contract_path) != SOURCE_CONTRACT_SHA256:
        raise ValueError("source_three_arm_contract_sha256_mismatch")
    if output_dir.exists():
        raise ValueError("output_directory_already_exists")
    source = read_json(source_path)
    output_dir.mkdir(parents=True, exist_ok=False)
    results = {}
    for arm, spec in ARM_SPECS.items():
        config = build_inactive_config(source, arm, source_contract_logical)
        validate_inactive_config(config, arm, source, source_contract_logical)
        target = output_dir / spec["fileName"]
        write_json(target, config)
        results[arm] = target
    return results


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--source-three-arm-contract", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    results = compile_three_arm_configs(
        args.source_config,
        args.source_three_arm_contract,
        args.output_dir,
    )
    print(json.dumps({
        "status": "stage4_controlled_structure_three_arm_inactive_configs_compiled",
        "configs": {
            arm: {"path": logical_registered_runtime_path(path), "sha256": sha256_file(path)}
            for arm, path in results.items()
        },
        "checkpointRead": False,
        "gpuStarted": False,
        "optimizerCreated": False,
        "backwardExecuted": False,
        "trainingStarted": False,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
