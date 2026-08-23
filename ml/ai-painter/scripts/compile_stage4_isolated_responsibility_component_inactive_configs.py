from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path

from ai_painter_stage_mode_registry import (
    FORMAL_MODE_REGISTRY,
    STAGE4_GLOBAL_VISUAL_NATIVE_DECODE_COMPONENT_INACTIVE_STATUS,
    STAGE4_PER_CLASS_OBJECT_SEMANTIC_COMPONENT_INACTIVE_STATUS,
    STAGE4_TERRAIN_ROUTE_HYDROLOGY_COMPONENT_INACTIVE_STATUS,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]
ARCHITECTURE = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
CONTRACT_ID = "stage4_three_responsibility_isolated_trainable_components_cpu_inactive_support_v1"
SOURCE_FAMILY_CONTRACT_SHA256 = "1fa3392cc0dc39ad628ea3d50391b25858b089d0e63a55c9dbb931587a7fdc5b"
SOURCE_PARAMETER_AUDIT_SHA256 = "94402b91eaff7d9b1815213735a28f14895549abb0a0e6d503fa6d534174e5bc"
SOURCE_EVIDENCE_ISOLATION_SHA256 = "ad61cdadcf44f46d3964f4ec9384d31d742bf6c51d68c97e67847f94d35e9db9"
ROLE_ORDER = (
    "terrain_route_hydrology_spatial_realization",
    "per_class_object_semantic_realization",
    "global_visual_harmonization_and_native_complete_rgb_decode",
)
OBJECT_MASK_ORDER = (
    "object_footprints",
    "object_tree",
    "object_rock",
    "object_vegetation",
)
RESOLUTION_STAGES = (
    {"id": "stage0", "width": 256, "height": 192, "latentWidth": 64, "latentHeight": 48},
    {"id": "stage1", "width": 512, "height": 384, "latentWidth": 128, "latentHeight": 96},
    {"id": "stage2", "width": 1024, "height": 768, "latentWidth": 256, "latentHeight": 192},
)
GATE_FIELDS = (
    "configurationActiveNow",
    "checkpointReadNow",
    "optimizerCreationNow",
    "backwardExecutionNow",
    "modelParameterUpdateNow",
    "gpuUseNow",
    "smokeNow",
    "trainingNow",
    "stage0Now",
    "stage1Now",
    "stage2Now",
    "formalInferenceNow",
    "checkpointPromotionNow",
    "runtimeFrameNow",
    "worldEntryNow",
)
COMPONENT_SPECS = {
    ROLE_ORDER[0]: {
        "authorizationStatus": STAGE4_TERRAIN_ROUTE_HYDROLOGY_COMPONENT_INACTIVE_STATUS,
        "predecessorRoleId": "authoritative_world_structure_binding",
        "inputArtifact": "immutable_full_frame_structure_identity",
        "outputArtifact": "full_frame_spatial_realization_identity",
        "responsibilities": ("terrain", "route", "hydrology"),
        "permittedExistingLossIdentities": ("existing_terrain_route_hydrology_spatial_losses_only",),
        "fileName": "terrain-route-hydrology-spatial-realization.inactive-config.json",
    },
    ROLE_ORDER[1]: {
        "authorizationStatus": STAGE4_PER_CLASS_OBJECT_SEMANTIC_COMPONENT_INACTIVE_STATUS,
        "predecessorRoleId": ROLE_ORDER[0],
        "inputArtifact": "full_frame_spatial_realization_identity",
        "outputArtifact": "full_frame_object_semantic_realization_identity",
        "responsibilities": OBJECT_MASK_ORDER,
        "permittedExistingLossIdentities": ("existing_per_class_object_semantic_and_reference_losses_only",),
        "fileName": "per-class-object-semantic-realization.inactive-config.json",
    },
    ROLE_ORDER[2]: {
        "authorizationStatus": STAGE4_GLOBAL_VISUAL_NATIVE_DECODE_COMPONENT_INACTIVE_STATUS,
        "predecessorRoleId": ROLE_ORDER[1],
        "inputArtifact": "full_frame_object_semantic_realization_identity",
        "outputArtifact": "native_complete_map_latent_and_rgb_identity",
        "responsibilities": ("global_visual_harmonization", "native_complete_rgb_decode"),
        "permittedExistingLossIdentities": ("existing_global_rgb_rollout_and_visual_harmonization_losses_only",),
        "fileName": "global-visual-harmonization-native-complete-rgb-decode.inactive-config.json",
    },
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_registered_runtime_path(value: Path) -> tuple[Path, str]:
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
        "stage0Authorized": False,
        "stage1Authorized": False,
        "stage2Authorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
    }


def build_inactive_config(
    source: dict,
    role: str,
    family_contract_path: str,
    parameter_audit_path: str,
    evidence_isolation_path: str,
) -> dict:
    if role not in COMPONENT_SPECS:
        raise ValueError("unknown_stage4_responsibility_component_role")
    if source.get("denoiserArchitecture") != ARCHITECTURE:
        raise ValueError("source_architecture_mismatch")
    if int(source.get("conditionChannels", -1)) != 23 or int(source.get("latentChannels", -1)) != 12:
        raise ValueError("source_channel_contract_mismatch")
    if int(source.get("latentDownsampleFactor", -1)) != 4:
        raise ValueError("source_autoencoder_factor_mismatch")
    spec = COMPONENT_SPECS[role]
    config = deepcopy(source)
    config.pop("stage4ControlledStructureArm", None)
    config["status"] = "cpu_supported_inactive"
    config["stage4ResponsibilityComponentRole"] = role
    config["denoiserBaseChannels"] = 64
    training = config.setdefault("training", {})
    training.pop("stage4ControlledStructureThreeArm", None)
    _deactivate_nested_contracts(training)
    training["trainingAuthorizationStatus"] = spec["authorizationStatus"]
    training["ownerTrainingAuthorization"] = _cpu_only_owner_authorization()
    training["stage4IsolatedResponsibilityComponent"] = {
        "contractId": CONTRACT_ID,
        "status": "cpu_supported_inactive",
        "roleId": role,
        "roleIndex": ROLE_ORDER.index(role),
        "roleOrder": list(ROLE_ORDER),
        "sourceBindings": {
            "componentFamilyContract": {"path": family_contract_path, "sha256": SOURCE_FAMILY_CONTRACT_SHA256},
            "parameterSourceAudit": {"path": parameter_audit_path, "sha256": SOURCE_PARAMETER_AUDIT_SHA256},
            "evidenceIsolationContract": {"path": evidence_isolation_path, "sha256": SOURCE_EVIDENCE_ISOLATION_SHA256},
        },
        "authorityBinding": {
            "roleId": "authoritative_world_structure_binding",
            "trainable": False,
            "worldFactsRemainAuthoritative": True,
            "visualFactManifestRemainAuthoritative": True,
            "conditionPackageRemainAuthoritative": True,
        },
        "parameterNamespace": f"stage4_responsibility_components.{role}",
        "parameterNamespaceIsolated": True,
        "sharedTrainableParametersAllowed": False,
        "predecessorRoleId": spec["predecessorRoleId"],
        "inputArtifact": spec["inputArtifact"],
        "outputArtifact": spec["outputArtifact"],
        "samePackageImmediatePredecessorOnly": True,
        "crossRunEvidenceAllowed": False,
        "responsibilities": list(spec["responsibilities"]),
        "approvedObjectMaskOrder": list(OBJECT_MASK_ORDER),
        "approvedObjectMasksModificationAllowed": False,
        "parameterTopology": {
            "conditionChannels": 23,
            "latentChannels": 12,
            "autoencoderDownsampleFactor": 4,
            "baseWidth": 64,
            "widthHierarchy": [64, 128, 256],
            "timeEmbeddingChannels": 256,
            "resolutionStages": [dict(value) for value in RESOLUTION_STAGES],
        },
        "lossBoundary": {
            "permittedExistingLossIdentities": list(spec["permittedExistingLossIdentities"]),
            "newLossAllowed": False,
            "lossWeightChangeAllowed": False,
        },
        "checkpointIdentity": {"independent": True, "historicalCheckpointAllowed": False},
        "outputIdentity": {"independent": True, "sha256Required": True},
        "phaseTerminalIdentity": {"independent": True, "successRequired": True},
        "finalOutputBoundary": {
            "appliesToThisRole": role == ROLE_ORDER[2],
            "stage2OnlyFormalCandidate": True,
            "width": 1024,
            "height": 768,
            "channels": 3,
            "nativeCompleteFrame": True,
            "tileAllowed": False,
            "patchAllowed": False,
            "spriteAllowed": False,
            "localAssemblyAllowed": False,
            "lowResolutionUpscaleAllowed": False,
            "ruleProgramRenderingAllowed": False,
        },
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    return config


def validate_inactive_config(
    config: dict,
    role: str,
    source: dict,
    family_contract_path: str,
    parameter_audit_path: str,
    evidence_isolation_path: str,
) -> None:
    expected = build_inactive_config(
        source,
        role,
        family_contract_path,
        parameter_audit_path,
        evidence_isolation_path,
    )
    if config != expected:
        raise ValueError("inactive_component_config_not_exactly_derived")
    spec = COMPONENT_SPECS[role]
    mode = FORMAL_MODE_REGISTRY.resolve(spec["authorizationStatus"], ARCHITECTURE)
    if mode.execution_kind != "cpu_inactive" or mode.active_execution:
        raise ValueError("mode_registry_inactive_contract_mismatch")
    contract = config["training"]["stage4IsolatedResponsibilityComponent"]
    if tuple(contract["roleOrder"]) != ROLE_ORDER:
        raise ValueError("component_role_order_mismatch")
    if tuple(contract["activationGate"].keys()) != GATE_FIELDS:
        raise ValueError("activation_gate_field_set_mismatch")
    if any(value is not False for value in contract["activationGate"].values()):
        raise ValueError("activation_gate_not_closed")
    if config["training"]["ownerTrainingAuthorization"] != _cpu_only_owner_authorization():
        raise ValueError("owner_training_authorization_not_cpu_only")


def compile_inactive_configs(
    source_input: Path,
    family_contract_input: Path,
    parameter_audit_input: Path,
    evidence_isolation_input: Path,
    output_input: Path,
) -> dict[str, Path]:
    source_path, _ = resolve_registered_runtime_path(source_input)
    family_path, family_logical = resolve_registered_runtime_path(family_contract_input)
    parameter_path, parameter_logical = resolve_registered_runtime_path(parameter_audit_input)
    isolation_path, isolation_logical = resolve_registered_runtime_path(evidence_isolation_input)
    output_dir, _ = resolve_registered_runtime_path(output_input)
    for target, expected, label in (
        (family_path, SOURCE_FAMILY_CONTRACT_SHA256, "component_family_contract"),
        (parameter_path, SOURCE_PARAMETER_AUDIT_SHA256, "parameter_source_audit"),
        (isolation_path, SOURCE_EVIDENCE_ISOLATION_SHA256, "evidence_isolation_contract"),
    ):
        if sha256_file(target) != expected:
            raise ValueError(f"{label}_sha256_mismatch")
    if output_dir.exists():
        raise ValueError("output_directory_already_exists")
    source = read_json(source_path)
    output_dir.mkdir(parents=True, exist_ok=False)
    results = {}
    for role, spec in COMPONENT_SPECS.items():
        config = build_inactive_config(
            source,
            role,
            family_logical,
            parameter_logical,
            isolation_logical,
        )
        validate_inactive_config(
            config,
            role,
            source,
            family_logical,
            parameter_logical,
            isolation_logical,
        )
        target = output_dir / spec["fileName"]
        write_json(target, config)
        results[role] = target
    return results


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--source-family-contract", type=Path, required=True)
    parser.add_argument("--source-parameter-audit", type=Path, required=True)
    parser.add_argument("--source-evidence-isolation", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    results = compile_inactive_configs(
        args.source_config,
        args.source_family_contract,
        args.source_parameter_audit,
        args.source_evidence_isolation,
        args.output_dir,
    )
    print(json.dumps({
        "status": "stage4_isolated_responsibility_component_inactive_configs_compiled",
        "configs": {
            role: {"path": logical_registered_runtime_path(path), "sha256": sha256_file(path)}
            for role, path in results.items()
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
