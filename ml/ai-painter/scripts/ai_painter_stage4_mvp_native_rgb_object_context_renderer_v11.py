"""V11 CPU-only candidate binding; no execution or training entrypoint."""

from pathlib import Path

from ai_painter.complete_world.native_rgb_object_context_renderer import (
    OBJECT_SUPPORT_RADII_256,
    build_native_rgb_object_context_renderer,
    full_frame_object_context_objective,
)
from ai_painter_stage4_mvp_native_rgb_renderer_v6 import (
    digest, project_file, read_json, validate_binding,
)


CAPABILITY_VERSION = "stage4_mvp_native_complete_rgb_object_context_renderer_v11"
ARCHITECTURE_ID = "stage4_native_rgb_object_context_cpu_prototype_v1"
CONTRACT_ID = "stage4-mvp-native-complete-rgb-object-context-renderer-v11-contract-v1"
CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-complete-rgb-object-context-renderer-v11-contract.json"
)


def load_contract(root: Path):
    raw = project_file(root, CONTRACT_PATH).read_bytes()
    contract = read_json(project_file(root, CONTRACT_PATH), "V11 contract")
    expected = {
        "schemaVersion": CONTRACT_ID,
        "contractId": CONTRACT_ID,
        "status": "cpu_candidate_not_execution_qualified",
        "capabilityVersion": CAPABILITY_VERSION,
        "architectureId": ARCHITECTURE_ID,
    }
    if any(contract.get(key) != value for key, value in expected.items()):
        raise ValueError("V11 candidate identity changed")
    for key in ("parentFailureEvidence", "datasetBinding", "conditionContract"):
        validate_binding(root, contract[key], key)
    parent = read_json(
        project_file(root, contract["parentFailureEvidence"]["path"]), "V10 failure terminal",
    )
    if (parent.get("executionState") != "failed_closed"
            or parent.get("capabilityVersion")
            != "stage4_mvp_native_complete_rgb_aperiodic_detail_renderer_v10"
            or parent.get("candidatePassCount") != 0
            or parent.get("candidateFailCount") != 8
            or parent.get("formalQualificationGranted") is not False):
        raise ValueError("V11 parent is not the expected failed V10 candidate")
    for key in ("semanticAndUpperAesthetic", "minimumDetail"):
        validate_binding(root, contract["reviewBindings"][key], key)
    if (contract["reviewBindings"].get("currentAuthority")
            != "diagnostic_only_formal_review_dispatch_not_qualified"
            or contract.get("formalStage4QualificationGranted") is not False):
        raise ValueError("V11 diagnostic review cannot grant formal qualification")
    if contract["datasetBinding"].get("splitCounts") != {
        "train": 48, "validation": 8, "challenge": 4, "regression": 4,
    }:
        raise ValueError("V11 dataset capacity changed")
    renderer = contract["renderer"]
    if (renderer.get("inputConditionChannels") != 23
            or renderer.get("outputChannels") != 3
            or renderer.get("baseChannels") != 48
            or renderer.get("typedObjectSupportRadii256") != OBJECT_SUPPORT_RADII_256
            or renderer.get("overlapCombination") != "mean_context_logits_over_active_supports"
            or renderer.get("supportDistanceEncoding") != "iterated_chebyshev_dilation_proximity"
            or renderer.get("replacedV10TypedHeadsFrozen") is not True
            or renderer.get("referenceRgbAtInferenceAllowed") is not False
            or renderer.get("staticMapOrTileCompositionAllowed") is not False):
        raise ValueError("V11 renderer contract changed")
    objective = contract["trainingObjective"]
    if (objective.get("fullRgbMaeWeight") != 1.0
            or objective.get("fullRgbGradientMaeWeight") != 0.25
            or objective.get("typedObjectSupportRgbMaeWeightEach") != 1.0
            or objective.get("unlocalizedDetailEnergyTermsAllowed") is not False
            or objective.get("validationPixelsUsedByOptimizer") is not False
            or objective.get("machineReviewScoresAsLossAllowed") is not False):
        raise ValueError("V11 objective contract changed")
    curriculum = contract["trainingCurriculum"]
    expected_curriculum = {
        "resolution": [256, 192], "fullFrameOnly": True,
        "objectCropUpdatesAllowed": False, "epochCount": 24,
        "fullFrameUpdatesPerSamplePerEpoch": 1, "exactOptimizerSteps": 1152,
        "freshInitializationRequired": True,
        "v10CheckpointReuseAllowed": False,
        "persistentDerivedTrainingImagesAllowed": False,
        "maxGpuMemoryFraction": 0.7, "automaticRetry": False,
    }
    if curriculum != expected_curriculum:
        raise ValueError("V11 bounded curriculum changed")
    if contract.get("activationGates") != {
        "cpuContractNow": True, "gpuQualificationNow": False,
        "optimizerNow": False, "trainingNow": False,
        "checkpointPromotionNow": False,
    }:
        raise ValueError("V11 CPU-only activation boundary changed")
    return contract, digest(raw)


def build_renderer(root: Path):
    contract, _ = load_contract(root)
    condition = read_json(
        project_file(root, contract["conditionContract"]["path"]), "condition contract",
    )
    order = condition["tensorContract"]["channelOrder"]
    if len(order) != 23 or len(set(order)) != 23:
        raise ValueError("V11 condition channel order invalid")
    return build_native_rgb_object_context_renderer(
        condition_channel_order=order,
        support_radii=contract["renderer"]["typedObjectSupportRadii256"],
        base_channels=contract["renderer"]["baseChannels"],
    )


__all__ = (
    "CAPABILITY_VERSION", "ARCHITECTURE_ID", "CONTRACT_PATH", "load_contract",
    "build_renderer", "full_frame_object_context_objective",
)
