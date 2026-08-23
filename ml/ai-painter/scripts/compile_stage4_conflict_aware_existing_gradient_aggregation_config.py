from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path

import train_ai_assisted_conditional_denoiser as trainer


ROOT = Path(__file__).resolve().parents[3]
SOURCE_CONFIG = Path(".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/inactive-config.json")
SOURCE_CONFIG_SHA256 = "323a3a14bf0269bda101b8e7719fc9bc5d68ebde9e5b2dd7977f3789f2942976"
GATE_FIELDS = (
    "configurationActiveNow", "checkpointReadNow", "optimizerCreationNow",
    "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow",
    "trainingNow", "smokeNow", "stage4FullTrainingNow", "stage5Now",
    "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow",
)


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--authorization", type=Path, required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--consumption", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    authorization_path = project_file(args.authorization); consumption_path = project_file(args.consumption); output = project_file(args.output_dir)
    if sha256_file(authorization_path) != args.authorization_sha256: raise ValueError("authorization_sha256_mismatch")
    authorization = read_json(authorization_path)
    validate_authorization(authorization, authorization_path, consumption_path, output)
    consume(authorization, authorization_path, consumption_path)
    if output.exists(): raise ValueError("output_already_exists")
    output.mkdir(parents=True)
    source_path = project_file(SOURCE_CONFIG)
    if sha256_file(source_path) != SOURCE_CONFIG_SHA256: raise ValueError("source_inactive_config_sha256_mismatch")
    config = deepcopy(read_json(source_path))
    source_contract = config["training"]["stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay"]
    class_order = ["footprints", "tree", "rock", "vegetation"]
    contract = {
        "enabled": True,
        "status": "cpu_support_verified_inactive",
        "contractId": trainer.STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_ID,
        "classOrder": class_order,
        "gradientBoundary": {"parameterGroup": "current_denoiser_shared_final_output_path", "scope": "shared_parameters_only", "nonSharedParametersUseExistingGradient": True},
        "sourceLossContract": {"contractId": trainer.STAGE4_EPOCH_COMPLETE_PER_CLASS_WORST_REFERENCE_FEATURE_SHARED_REPLAY_ID, "lossValuesChanged": False, "lossWeightsChanged": False},
        "derivedClassWeights": dict(source_contract["sourceContracts"]["derivedClassWeights"]),
        "projection": {"condition": "strict_dot_product_less_than_zero", "operation": "remove_current_gradient_component_along_conflicting_original_weighted_gradient", "referenceGradient": "original_existing_weighted_gradient_in_formal_class_order", "numericTolerance": None, "nonNegativeDotProductBehavior": "bitwise_unchanged", "finiteNonZeroGradientsRequired": True},
        "optimizerBudget": {"existingOptimizerStepsPreserved": True, "additionalOptimizerSteps": 0, "additionalReplayPasses": 0},
        "nonSharedParameters": "retain_existing_formal_weighted_gradient_sum_unchanged",
        "checkpointQualification": {"lossValuesChanged": False, "validationMetricsChanged": False, "selectionContractChanged": False},
        "compatibility": {"modelStructureChanged": False, "datasetOrSplitChanged": False, "conditionChannelOrderChanged": False, "checkpointFormatChanged": False, "reviewThresholdsChanged": False, "oldModesWithoutContractPreserved": True},
        "legalTargets": {"failedPreviewPixelsUsedAsTargets": False, "machineReviewThresholdsUsedAsTargets": False, "machineReviewResultsUsedAsTargets": False},
        "evidenceBindings": deepcopy(trainer.STAGE4_CONFLICT_AWARE_EXISTING_GRADIENT_AGGREGATION_EVIDENCE_BINDINGS),
        "activationGate": {name: False for name in GATE_FIELDS},
    }
    config["training"]["stage4ConflictAwareExistingGradientAggregation"] = contract
    trainer.validate_stage4_conflict_aware_existing_gradient_aggregation(config)
    config_path = output / "inactive-config.json"; support_path = output / "training-paradigm-support-contract.json"
    write_json(config_path, config)
    write_json(support_path, {"schemaVersion": "stage4-conflict-aware-existing-gradient-aggregation-support-contract-v1", "status": "cpu_support_verified_inactive", "contractId": contract["contractId"], "sourceInactiveConfig": {"path": SOURCE_CONFIG.as_posix(), "sha256": SOURCE_CONFIG_SHA256}, "implementationAuthorization": binding(authorization_path), "implementationConsumption": binding(consumption_path), "contract": contract, "checkpointRead": False, "gpuStarted": False, "optimizerCreated": False, "backwardExecuted": False, "trainingStarted": False, "recordedAtUtc": utc_now()})
    print(json.dumps({"status": "stage4_conflict_aware_existing_gradient_aggregation_inactive_config_compiled", "inactiveConfig": binding(config_path), "supportContract": binding(support_path)}, ensure_ascii=False, indent=2))
    return 0


def validate_authorization(value, authorization_path, consumption_path, output):
    if value.get("schemaVersion") != "owner-authorized-stage4-conflict-aware-existing-gradient-aggregation-cpu-v1" or value.get("status") != "resolved_owner_authorized_not_consumed" or value.get("requestId") != value.get("commandRef") or value.get("scope") != "one_cpu_inactive_stage4_conflict_aware_existing_gradient_aggregation_implementation": raise ValueError("authorization_invalid")
    if value.get("oneTimeConsumption") is not True or any(value.get(name) is not False for name in ("checkpointWeightsReadAuthorized", "gpuAuthorized", "optimizerAuthorized", "backwardAuthorized", "trainingAuthorized")): raise ValueError("authorization_boundary_invalid")
    if project_file(value["execution"]["outputDirectory"]) != output or project_file(value["execution"]["consumptionPath"]) != consumption_path or authorization_path.parent != consumption_path.parent: raise ValueError("execution_identity_invalid")


def consume(value, authorization_path, consumption_path):
    consumption_path.parent.mkdir(parents=True, exist_ok=True)
    record = {"schemaVersion": "stage4-conflict-aware-existing-gradient-aggregation-cpu-consumption-v1", "status": "cpu_implementation_authorization_atomically_consumed", "requestId": value["requestId"], "commandRef": value["commandRef"], "scope": value["scope"], "authorization": binding(authorization_path), "oneTimeConsumption": True, "consumedAtUtc": utc_now()}
    descriptor = os.open(consumption_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
    try: os.write(descriptor, (json.dumps(record, indent=2) + "\n").encode()); os.fsync(descriptor)
    finally: os.close(descriptor)


def project_file(value):
    if value is None or Path(value).is_absolute(): raise ValueError("project_relative_path_required")
    result = Path(os.path.abspath(ROOT / Path(value))); root = Path(os.path.abspath(ROOT))
    if result != root and root not in result.parents: raise ValueError("project_path_escape")
    return result.resolve()
def project_path(value):
    resolved = Path(value).resolve(); runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents: return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()
def sha256_file(value): return hashlib.sha256(Path(value).read_bytes()).hexdigest()
def binding(value): return {"path": project_path(value), "sha256": sha256_file(value)}
def read_json(value): return json.loads(Path(value).read_text(encoding="utf-8"))
def write_json(value, body): value.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
def utc_now(): return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
if __name__ == "__main__": raise SystemExit(main())
