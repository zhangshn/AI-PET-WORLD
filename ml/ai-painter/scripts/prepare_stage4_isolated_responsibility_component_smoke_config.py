from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import json
import os
from pathlib import Path

from ai_painter.complete_world.live_progress import write_json_atomic
from ai_painter_stage_mode_registry import (
    STAGE4_GLOBAL_VISUAL_NATIVE_DECODE_COMPONENT_SMOKE_STATUS,
    STAGE4_PER_CLASS_OBJECT_SEMANTIC_COMPONENT_SMOKE_STATUS,
    STAGE4_TERRAIN_ROUTE_HYDROLOGY_COMPONENT_SMOKE_STATUS,
)


ROLES = (
    "terrain_route_hydrology_spatial_realization",
    "per_class_object_semantic_realization",
    "global_visual_harmonization_and_native_complete_rgb_decode",
)
STATUS = dict(zip(ROLES, (
    STAGE4_TERRAIN_ROUTE_HYDROLOGY_COMPONENT_SMOKE_STATUS,
    STAGE4_PER_CLASS_OBJECT_SEMANTIC_COMPONENT_SMOKE_STATUS,
    STAGE4_GLOBAL_VISUAL_NATIVE_DECODE_COMPONENT_SMOKE_STATUS,
)))
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"


def project_runtime_relative(value: Path) -> str:
    """Validate the logical project path before Windows junction resolution."""
    project_root = Path(os.path.abspath(Path.cwd()))
    logical_absolute = Path(os.path.abspath(value if value.is_absolute() else project_root / value))
    try:
        relative = logical_absolute.relative_to(project_root)
    except ValueError as error:
        raise ValueError("component_smoke_evidence_path_outside_project") from error
    if not relative.parts or relative.parts[0].lower() != ".runtime" or ".." in relative.parts:
        raise ValueError("component_smoke_evidence_path_not_registered_runtime")
    return relative.as_posix()


def compile_active(source: dict, authorization: dict, consumption: dict | None, execution_state: str) -> dict:
    role = source.get("stage4ResponsibilityComponentRole")
    if role not in ROLES:
        raise ValueError("component_smoke_source_role_invalid")
    config = deepcopy(source)
    training = config["training"]
    component = training["stage4IsolatedResponsibilityComponent"]
    if component.get("roleId") != role or component.get("status") != "cpu_supported_inactive":
        raise ValueError("component_smoke_source_contract_invalid")
    if any(component.get("activationGate", {}).values()):
        raise ValueError("component_smoke_source_gate_not_closed")
    training["trainingAuthorizationStatus"] = STATUS[role]
    training["authorizedOverfitSampleId"] = SAMPLE_ID
    training["authorizedInitialization"] = "same_fixed_random_initialization_per_component"
    component["status"] = "smoke_active_owner_authorized"
    readonly_qualification = execution_state == "readonly_qualification_consumed"
    for key in component["activationGate"]:
        component["activationGate"][key] = key in (
            {"configurationActiveNow", "checkpointReadNow", "gpuUseNow"}
            if readonly_qualification
            else {
                "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
                "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
                "smokeNow", "trainingNow", "stage0Now",
            }
        )
    training["stage4ControlledThreeComponentStage0SmokeExecution"] = {
        "packageId": authorization["packageId"],
        "roleId": role,
        "roleIndex": ROLES.index(role),
        "roleOrder": list(ROLES),
        "sampleId": SAMPLE_ID,
        "sampleSplit": "validation",
        "seed": 20263722,
        "topology": "west",
        "resolution": {"width": 256, "height": 192},
        "epochCount": 30,
        "previewEpochs": [1, 5, 10, 20, 30],
        "predecessor": authorization["predecessor"],
        "sourceInactiveConfig": authorization["bindings"]["sourceConfig"],
        "sourceSmokeContract": authorization["bindings"]["compiledSmokeContract"],
    }
    training["ownerTrainingAuthorization"] = {
        "authorizationId": authorization["requestId"],
        "requestId": authorization["requestId"],
        "commandRef": authorization["commandRef"],
        "scope": authorization["scope"],
        "authorizationPath": authorization["authorizationPath"],
        "authorizationSha256": authorization["authorizationSha256"],
        "executionState": execution_state,
        "executionConsumptionPath": None if consumption is None else consumption["path"],
        "executionConsumptionSha256": None if consumption is None else consumption["sha256"],
        "status": STATUS[role],
        "checkpointLoadingAuthorized": True,
        "optimizerCreationAuthorized": not readonly_qualification,
        "backwardExecutionAuthorized": not readonly_qualification,
        "modelWeightMutationAuthorized": not readonly_qualification,
        "gpuTrainingAuthorizedNow": True,
        "singleSampleGpuOverfitSmokeAuthorized": not readonly_qualification,
        "fullTrainingAuthorized": False,
        "stage1Authorized": False,
        "stage2Authorized": False,
        "strictRevalidationAuthorized": False,
        "validationAuthorized": False,
        "formalInferenceAuthorized": False,
        "checkpointPromotionAuthorized": False,
        "runtimeFrameAuthorized": False,
        "worldEntryAuthorized": False,
        "automaticRetryAuthorized": False,
    }
    diagnostics = training.get("stage4FailureDiagnostics")
    if isinstance(diagnostics, dict):
        diagnostic_active = role == ROLES[2] and not readonly_qualification
        diagnostics["status"] = (
            "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_active_smoke"
            if diagnostic_active
            else "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
        )
        for key in (
            "trainingConfigApplied", "checkpointFileReadAuthorized",
            "gpuUseAuthorized", "trainingAuthorized",
        ):
            diagnostics[key] = diagnostic_active
    return config


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--source-config", type=Path, required=True)
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--consumption", type=Path)
    parser.add_argument("--execution-state", choices=("preflight_unconsumed", "readonly_qualification_consumed", "consumed"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.source_config.read_text(encoding="utf-8"))
    authorization = json.loads(args.authorization.read_text(encoding="utf-8"))
    authorization["authorizationPath"] = project_runtime_relative(args.authorization)
    import hashlib
    authorization["authorizationSha256"] = hashlib.sha256(args.authorization.read_bytes()).hexdigest()
    consumption = None
    if args.consumption:
        value = json.loads(args.consumption.read_text(encoding="utf-8"))
        consumption = {
            "path": project_runtime_relative(args.consumption),
            "sha256": hashlib.sha256(args.consumption.read_bytes()).hexdigest(),
            **value,
        }
    write_json_atomic(args.output, compile_active(source, authorization, consumption, args.execution_state))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
