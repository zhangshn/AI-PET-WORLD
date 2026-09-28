"""Bound, read-only CPU acceptance probe for the V13 object-renderer candidate.

This verifies source lineage, train-only objective, fresh weights, and gradients.
It cannot authorize GPU, training, formal review, checkpoint promotion, or Stage4.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time

import torch


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "ml/ai-painter/src"
if str(SOURCE) not in sys.path:
    sys.path.insert(0, str(SOURCE))

from ai_painter.complete_world.native_rgb_instance_object_prototype import (  # noqa: E402
    build_native_rgb_instance_object_prototype,
    train_original_instance_objective,
    validation_instance_object_score,
)
from ai_painter.complete_world.object_instance_supervision_cpu import (  # noqa: E402
    load_bound_object_sample,
)
from ai_painter.complete_world.split_release import (  # noqa: E402
    SplitReleaseDataset, bound_json, project_file, read_bound,
)
from ai_painter.complete_world.split_training import state_hash  # noqa: E402


CONTRACT_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-native-rgb-instance-object-v13-contract.json"
)
PROGRAM_PATH = "ml/ai-painter/scripts/check_stage4_mvp_instance_object_v13_cpu.py"
OUTPUT_ROOT = ".runtime/ai-painter/stage4-mvp-instance-object-v13-cpu-checks"
CAPABILITY = "stage4_mvp_native_rgb_instance_object_renderer_v13"
ARCHITECTURE = "stage4_native_rgb_instance_object_cpu_prototype_v3"
SEED = 20260926
MAX_WALL_SECONDS = 120
EXPECTED_PROGRAMS = {
    "renderer": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_instance_object_prototype.py",
    "objectViewAndBoundLoader": "ml/ai-painter/src/ai_painter/complete_world/object_instance_supervision_cpu.py",
    "freshCore": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
    "rendererAndLossTests": "ml/ai-painter/tests/test_native_rgb_instance_object_prototype.py",
    "objectViewTests": "ml/ai-painter/tests/test_object_instance_supervision_cpu.py",
    "cpuChecker": PROGRAM_PATH,
    "trainingWorker": "ml/ai-painter/scripts/train_stage4_mvp_instance_object_v13_stage0.py",
    "reviewCandidateMaterializer": "ml/ai-painter/scripts/materialize_stage4_mvp_instance_object_v13_review_candidates.py",
}
FROZEN_DIAGNOSTIC_THRESHOLD = {
    "path": "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
    "sha256": "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def binding(logical: str) -> dict:
    return {"path": logical, "sha256": hashlib.sha256(
        project_file(ROOT, logical).read_bytes()).hexdigest()}


def verify_contract() -> tuple[dict, dict]:
    contract = bound_json(ROOT, binding(CONTRACT_PATH))
    require(contract.get("schemaVersion") == "stage4-mvp-native-rgb-instance-object-v13-contract-v1"
            and contract.get("status") == "cpu_candidate_not_execution_qualified"
            and contract.get("capabilityVersion") == CAPABILITY
            and contract.get("architectureId") == ARCHITECTURE,
            "V13 candidate contract identity changed")
    require(contract.get("activationGates") == {
        "cpuReadOnlyNow": True, "formalReviewNow": False,
        "gpuNow": False, "optimizerNow": False, "trainingNow": False,
        "checkpointPromotionNow": False,
    }, "V13 inactive execution gate changed")
    programs = contract.get("programBindings", {})
    require(set(programs) == set(EXPECTED_PROGRAMS)
            and all(programs[role].get("path") == path
                    for role, path in EXPECTED_PROGRAMS.items())
            and programs["cpuChecker"] == binding(PROGRAM_PATH),
            "V13 complete program set or CPU checker binding changed")
    for role, bound in programs.items():
        read_bound(ROOT, bound)
    require(contract.get("parentFailedCandidate", {}).get("sha256"),
            "V13 parent failure binding absent")
    parent = bound_json(ROOT, contract["parentFailedCandidate"])
    require(parent.get("executionState") == "failed_closed"
            and parent.get("capabilityVersion")
            == "stage4_mvp_native_complete_rgb_local_texture_renderer_v12"
            and parent.get("stagePassed") is False
            and parent.get("formalQualificationGranted") is False
            and parent.get("candidateFailCount") == 8,
            "V13 parent V12 failure terminal changed")
    condition = bound_json(ROOT, contract["conditionContract"])
    order = condition["tensorContract"]["channelOrder"]
    require(len(order) == 23 and len(set(order)) == 23
            and "object_instance" in order, "V13 condition contract invalid")
    dataset = bound_json(ROOT, contract["datasetBinding"]["manifest"])
    require(dataset.get("sampleCount") == 64
            and dataset.get("splitCounts") == {"train": 48, "validation": 8,
                                                "challenge": 4, "regression": 4}
            and dataset.get("qualification", {}).get("dataQualifiedForTraining") is True
            and dataset.get("qualification", {}).get("executionQualified") is False
            and dataset.get("qualification", {}).get("gpuQualified") is False,
            "V13 dataset release identity or permission changed")
    require(contract["datasetBinding"]["sourceIndex"] == dataset["sourceIndex"]
            and contract["datasetBinding"]["splits"] == dataset["splits"],
            "V13 four-way split bindings differ from release")
    read_bound(ROOT, dataset["sourceIndex"])
    for split in ("train", "validation", "challenge", "regression"):
        read_bound(ROOT, dataset["splits"][split])
    foundation = contract["foundationAssetBinding"]
    require(foundation.get("qualifiedFoundationRecordedByDataset")
            == dataset.get("foundationCheckpoint")
            and foundation.get("autoencoderLoadedByThisRenderer") is False
            and foundation.get("failedDenoiserOrRendererCheckpointLoaded") is False
            and foundation.get("initializationSeed") == SEED,
            "V13 fresh initialization or foundation role changed")
    read_bound(ROOT, foundation["qualifiedFoundationRecordedByDataset"])
    renderer = contract["renderer"]
    require(renderer.get("conditionChannels") == 23
            and renderer.get("resolution") == [256, 192]
            and renderer.get("freshCoreBaseChannels") == 48
            and renderer.get("objectPatchChannels") == 32
            and renderer.get("objectViewSize") == [32, 32]
            and renderer.get("objectKinds") == ["tree", "rock", "shrub", "grass_detail"]
            and renderer.get("objectInstanceLabelUsedAsAppearanceFeature") is False
            and renderer.get("staticTileOrSpriteAssemblyAllowed") is False
            and renderer.get("originalRgbOrFailedCheckpointAtInferenceAllowed") is False,
            "V13 renderer implementation parameters changed")
    objective = contract["lossContract"]
    require(objective.get("identity")
            == "stage4-mvp-v13-train-original-instance-object-objective-v1"
            and objective.get("implementation") == "programBindings.renderer"
            and objective.get("validationRgbAsOptimizerTarget") is False
            and objective.get("reviewScoresOrFailedPreviewsAsLoss") is False,
            "V13 train-only loss contract changed")
    review = contract["reviewBinding"]
    require(review.get("currentDiagnosticThresholds") == FROZEN_DIAGNOSTIC_THRESHOLD
            and review.get("thresholdLoweringAllowed") is False
            and review.get("reviewAlignmentAndNewFormalRunnerRequiredBeforeGpu") is True,
            "V13 reviewer binding or frozen thresholds changed")
    existing = bound_json(ROOT, review["currentDiagnosticThresholds"])
    detail = bound_json(ROOT, review["minimumDetailGate"])
    require(existing.get("activation", {}).get("formalReviewExecutionAllowed") is False
            and existing.get("formalReviewBoundary", {}).get("dispatchable") is False
            and review.get("formalReviewDispatchable") is False
            and detail.get("boundary", {}).get("mayGrantFormalStage4Qualification") is False,
            "V13 cannot inherit or assert formal review authority")
    require(contract.get("proposedTrainingBoundNotActivated") == {
        "resolution": [256, 192], "trainSamples": 48,
        "validationSamplesForCheckpointSelectionOnly": 8,
        "maxEpochs": 24, "maxOptimizerSteps": 1152,
        "maxGpuMemoryFraction": 0.7, "automaticRetries": 0,
    }, "V13 proposed resource ceiling changed")
    return contract, condition


def run() -> dict:
    started = time.monotonic()
    torch.set_num_threads(4)
    contract, condition = verify_contract()
    manifest = contract["datasetBinding"]["manifest"]
    order = condition["tensorContract"]["channelOrder"]
    train = SplitReleaseDataset(ROOT, manifest, "train", (256, 192))
    validation = SplitReleaseDataset(ROOT, manifest, "validation", (256, 192))
    require(len(train) == 48 and len(validation) == 8
            and train.selection_sha256 == contract["datasetBinding"]["trainSelectionSha256"]
            and validation.selection_sha256 == contract["datasetBinding"]["validationSelectionSha256"],
            "V13 Python Dataset selection differs from frozen 48/8")
    split_object_coverage = {}
    for split_name, dataset in (("train", train), ("validation", validation)):
        counts = [len(load_bound_object_sample(dataset, index)["objectInstanceTable"])
                  for index in range(len(dataset))]
        require(all(count > 0 for count in counts),
                f"V13 {split_name} contains an object-empty sample")
        split_object_coverage[split_name] = {
            "sampleCount": len(counts), "objectCount": sum(counts),
            "minimumObjectsPerSample": min(counts),
            "maximumObjectsPerSample": max(counts),
        }
    sample = load_bound_object_sample(train, 0)
    require(sample["split"] == "train" and len(sample["objectInstanceTable"]) > 0,
            "V13 first train sample has no bound objects")
    torch.manual_seed(SEED)
    model = build_native_rgb_instance_object_prototype(
        condition_channel_order=order, base_channels=48, patch_channels=32)
    require(model.architecture_id == ARCHITECTURE
            and model.execution_qualified is False,
            "V13 renderer claims wrong architecture or execution qualification")
    initial = state_hash(model.state_dict())
    predicted = model(sample["conditions"][None], sample["objectInstanceTable"])
    loss, parts = train_original_instance_objective(
        predicted, sample, sample["objectInstanceTable"], order)
    require(tuple(predicted.shape) == (1, 3, 192, 256)
            and bool(torch.isfinite(loss))
            and parts["instanceCount"] == len(sample["objectInstanceTable"]),
            "V13 real train target or object objective invalid")
    object_parameter = next(model.object_head.parameters())
    shared_parameter = next(parameter for parameter in model.core.parameters()
                            if parameter.requires_grad)
    gradients = torch.autograd.grad(loss, (object_parameter, shared_parameter),
                                    allow_unused=False)
    gradient_sums = [float(gradient.detach().abs().sum()) for gradient in gradients]
    require(all(bool(torch.isfinite(value).all()) for value in gradients)
            and all(value > 0 for value in gradient_sums),
            "V13 object or shared core did not receive finite gradient")
    final = state_hash(model.state_dict())
    require(initial == final
            and all(parameter.grad is None for parameter in model.parameters()),
            "V13 read-only CPU probe modified model weights or retained gradients")
    validation_sample = load_bound_object_sample(validation, 0)
    model.eval()
    with torch.no_grad():
        validation_prediction = model(validation_sample["conditions"][None],
                                      validation_sample["objectInstanceTable"])
        validation_score, validation_parts = validation_instance_object_score(
            validation_prediction, validation_sample,
            validation_sample["objectInstanceTable"], order)
    require(bool(torch.isfinite(validation_score))
            and validation_parts["instanceCount"]
            == len(validation_sample["objectInstanceTable"])
            and state_hash(model.state_dict()) == initial
            and all(parameter.grad is None for parameter in model.parameters()),
            "V13 validation score is not a read-only finite selection metric")
    exact, _ = train_original_instance_objective(
        sample["image"][None], sample, sample["objectInstanceTable"], order)
    require(float(exact) == 0.0, "V13 exact original RGB is not an objective zero")
    require(time.monotonic() - started <= MAX_WALL_SECONDS,
            "V13 CPU wall-time cap exceeded")
    report = {
        "schemaVersion": "stage4-mvp-instance-object-v13-cpu-check-v1",
        "status": "cpu_readonly_passed_formal_review_and_training_still_disabled",
        "capabilityVersion": CAPABILITY,
        "architectureId": ARCHITECTURE,
        "candidateContract": binding(CONTRACT_PATH),
        "program": binding(PROGRAM_PATH),
        "datasetManifest": manifest,
        "trainSelectionSha256": train.selection_sha256,
        "validationSelectionSha256": validation.selection_sha256,
        "sampleId": sample["sampleId"],
        "boundObjectCount": len(sample["objectInstanceTable"]),
        "splitObjectCoverage": split_object_coverage,
        "initialModelStateSha256": initial,
        "finalModelStateSha256": final,
        "objectiveTotal": float(loss.detach()),
        "objectSupportRgbMae": float(parts["instanceSupportRgbMae"].detach()),
        "validationSampleId": validation_sample["sampleId"],
        "validationSelectionScore": float(validation_score.detach()),
        "validationOnlyForward": True,
        "gradientAbsoluteSums": gradient_sums,
        "optimizerCreated": False,
        "optimizerSteps": 0,
        "gpuStarted": False,
        "trainingStarted": False,
        "checkpointWritten": False,
        "validationUsedForWeights": False,
        "challengeSplitMetadataVerified": True,
        "regressionSplitMetadataVerified": True,
        "challengeRgbRead": False,
        "regressionRgbRead": False,
        "formalQualificationGranted": False,
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    identity = hashlib.sha256((report["candidateContract"]["sha256"]
                               + initial).encode()).hexdigest()[:48]
    output = project_file(ROOT, f"{OUTPUT_ROOT}/cpu-v13-{identity}/report.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    return {"status": report["status"],
            "report": binding(output.relative_to(ROOT).as_posix()),
            "objectCount": report["boundObjectCount"]}


if __name__ == "__main__":
    try:
        print(json.dumps(run(), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
