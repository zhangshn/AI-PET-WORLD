"""Independent, read-only V17 CPU acceptance for a zero-update GPU probe.

This is not a training, visual, Stage0, Stage4 or publication qualification.
It binds the frozen implementation and executes fresh CPU numerical controls.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import check_stage4_mvp_structured_object_v17_cpu_acceptance as cpu
import run_stage4_mvp_structured_object_v17_readonly_gpu_qualification as gpu

PROGRAM_PATH = "ml/ai-painter/scripts/accept_stage4_mvp_structured_object_v17_cpu.py"
OUTPUT_ROOT = ".runtime/ai-painter/stage4-mvp-structured-object-v17-formal-cpu-acceptances"
REPORT_SCHEMA = "stage4-mvp-structured-object-v17-formal-cpu-acceptance-v1"
PROBE_SCHEMA = "stage4-mvp-structured-object-v17-cpu-numerical-probe-v1"
ROLES = gpu.ROLES
REVIEW_PROGRAM = {
    "path": "scripts/lib/ai-painter-stage4-mvp-v13-review-lineage.mjs",
    "sha256": "b30b3c8224e86cb04451f16e7b149c51860c9e0a56c25e0242c99e6c160b48e0",
}
SCOPE_REVIEW_PROGRAM = gpu.SCOPE_VERIFIER
MODEL_TEST = "ml/ai-painter/tests/test_native_rgb_structured_object_cpu_v17.py"
OBJECTIVE_TEST = "ml/ai-painter/tests/test_native_rgb_structured_object_objective_cpu_v17.py"
PROBE_TEST = cpu.TEST_PATH
GPU_GATE_TEST = gpu.TEST_PATH
NODE_SCOPE_TEST = "scripts/tests/test-ai-painter-stage4-mvp-v17-dry-scope.mjs"
NODE_CANDIDATE_TEST = "scripts/tests/test-ai-painter-stage4-mvp-v17-candidate-manifest.mjs"
EXPECTED_REVIEW_METRICS = {
    "terrain_path_ground": "terrain_path_ground_spatial_distribution",
    "terrain_water": "terrain_water_spatial_distribution",
    "terrain_shoreline": "shoreline_masked_rgb_mae_1024_nearest_v1",
    "object_footprints": "object_footprints_reference_semantics",
    "object_tree": "object_tree_reference_semantics",
    "object_rock": "object_rock_reference_semantics",
    "object_vegetation": "object_vegetation_reference_semantics",
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def same(left, right):
    return cpu.canonical_bytes(left) == cpu.canonical_bytes(right)


def check_candidate(reader, candidate):
    require(candidate.get("schemaVersion") == gpu.CANDIDATE_SCHEMA
            and candidate.get("capabilityVersion") == gpu.CAPABILITY
            and candidate.get("status") == "cpu_candidate_not_execution_qualified",
            "candidate identity differs")
    require("cpuAcceptance" in candidate and candidate["cpuAcceptance"] is None,
            "CPU evidence must be late-bound after independent acceptance")
    require(same(candidate.get("modelPlan"), gpu.MODEL_PLAN)
            and same(candidate.get("precisionExecutionPlan"), gpu.PRECISION_PLAN),
            "model or BF16 plan differs")
    require(same(candidate.get("dryScope"), gpu.SCOPE)
            and same(candidate.get("conditionContract"), cpu.CONDITION_CONTRACT),
            "scope or condition contract differs")
    gates = candidate.get("activationGates", {})
    require(gates.get("readonlyGpuQualificationAllowed") is True
            and gates.get("trainingAllowed") is False
            and gates.get("formalStage0QualificationAllowed") is False
            and gates.get("runtimePublicationAllowed") is False,
            "CPU acceptance cannot activate training, Stage0 or publication")
    reader.read(gpu.SCOPE)
    scope = gpu.verify_dry_scope(reader)
    require(scope.get("status") == gpu.SCOPE_STATUS, "dry scope did not pass")
    dataset = candidate.get("datasetBinding", {})
    require(same(dataset.get("manifest"), cpu.MANIFEST), "dataset manifest differs")
    manifest, _, _, _, memberships = cpu.select_rows(reader)
    require(dataset.get("datasetReleaseIdentity") == manifest["datasetReleaseIdentity"],
            "dataset release differs")
    require(same(dataset.get("sourceIndex"), manifest["sourceIndex"])
            and same(dataset.get("splits"), manifest["splits"]),
            "source index or four split bindings differ")
    for split in ("train", "validation", "challenge", "regression"):
        require(dataset.get(split + "SelectionSha256") == memberships[split]["selectionSha256"],
                "selected row identity differs: " + split)
    programs = candidate.get("programBindings", {})
    require(isinstance(programs, dict), "program bindings absent")
    for role, path in gpu.PROGRAM_PATHS.items():
        bound = gpu.binding(programs.get(role))
        require(bound["path"] == path, "program role path differs: " + role)
    require(same(programs.get("scopeVerifier"), gpu.SCOPE_VERIFIER), "scope verifier differs")
    require(same(programs.get("formalCpuAcceptance"),
                 {"path": PROGRAM_PATH, "sha256": cpu.sha(cpu.project_file(ROOT, PROGRAM_PATH).read_bytes())}),
            "formal CPU acceptance program differs")
    for value in programs.values():
        reader.read(gpu.binding(value))
    review = candidate.get("reviewThresholdContract", {})
    require(same(review.get("numericThresholds"),
                 {"path": "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
                  "sha256": "ed76d3d5798b3dd6a8da0a1072e83b7376cd33e2dfd3314db51921f7ce9903df"}),
            "frozen numeric thresholds differ")
    require(same(review.get("minimumDetail"),
                 {"path": "data/ai-painter/system-governance/stage4-mvp-256-detail-sufficiency-review-v1-contract.json",
                  "sha256": "3fc675218fbd290454fce4f178bdd9a0253754e96d407ec19cba993af044c3ee"})
            and same(review.get("auditProgram"), REVIEW_PROGRAM)
            and same(review.get("dryDecisionProgram"), SCOPE_REVIEW_PROGRAM)
            and review.get("formalStage0ActivationInherited") is False,
            "review program, detail or activation differs")
    for key in ("numericThresholds", "minimumDetail", "auditProgram", "dryDecisionProgram"):
        reader.read(gpu.binding(review[key]))
    foundation = candidate.get("foundationAssetBinding", {})
    require(foundation.get("role") == "fresh_native_rgb_no_autoencoder_loaded"
            and foundation.get("autoencoderLoadedByThisRenderer") is False
            and foundation.get("failedCheckpointLoaded") is False
            and foundation.get("initializationSeed") == cpu.SEED,
            "fresh foundation boundary differs")
    loss = candidate.get("lossContract", {})
    require(loss.get("identity") == "v17_train_original_rgb_structured_object_v1"
            and loss.get("baseObjectiveIdentity") ==
            "stage4-mvp-v15-train-original-conditional-texture-objective-v1"
            and loss.get("spatialWeight") == 0.1
            and loss.get("trainOnly") is True
            and loss.get("reviewScoresAsTargets") is False
            and loss.get("objectClassSpatialFormula") ==
            "mean_over_nonconstant_object_classes(1-centered_luma_correlation(predicted_rgb,train_original_rgb,condition_mask))"
            and loss.get("inputShapes") == {"conditions": [23, 192, 256],
                                             "originalRgb": [3, 192, 256],
                                             "predictedRgb": [1, 3, 192, 256]},
            "loss formula or tensor contract differs")
    require(same(loss.get("implementation"), programs.get("objective"))
            and same(loss.get("positiveNegativeTests"),
                     {"path": OBJECTIVE_TEST, "sha256": cpu.sha(cpu.project_file(ROOT, OBJECTIVE_TEST).read_bytes())}),
            "loss implementation or formula test differs")
    require(isinstance(loss.get("formulaSha256"), str)
            and re.fullmatch(r"[0-9a-f]{64}", loss["formulaSha256"]),
            "loss formula hash absent")
    require(loss["formulaSha256"] == cpu.sha(cpu.canonical_bytes({
        "baseObjectiveIdentity": loss.get("baseObjectiveIdentity"),
        "objectClassSpatialFormula": loss["objectClassSpatialFormula"],
        "spatialWeight": loss["spatialWeight"],
    })), "loss formula content hash differs")
    alignments = candidate.get("trainingReviewAlignment", [])
    require(isinstance(alignments, list) and len(alignments) == 7,
            "seven responsibility alignments absent")
    for row, role in zip(alignments, ROLES):
        require(row.get("responsibilityId") == role
                and row.get("conditionChannelIds") == [role]
                and row.get("formulaSha256") == loss["formulaSha256"]
                and row.get("responsibilityOutputIdentity") == role + "_learned_feature_8x192x256"
                and row.get("reviewMetricIds") == [EXPECTED_REVIEW_METRICS[role]]
                and row.get("reviewApplicability") == (
                    "unverified_no_positive_water_or_shoreline_in_dry_subject"
                    if role in ("terrain_water", "terrain_shoreline") else "applicable_in_dry_subject")
                and isinstance(row.get("failureCodes"), list) and row["failureCodes"]
                and row.get("formalReviewContractIdentity") == "v17_dry_single_world_numeric_review_inactive_formal_stage0"
                and same(row.get("formalReviewContract"), review["numericThresholds"])
                and isinstance(row.get("objectiveTermIds"), list) and row["objectiveTermIds"]
                and same(row.get("positiveAlignmentTests"), [programs["modelTests"], programs["objectiveTests"]])
                and same(row.get("negativeAlignmentTests"), [programs["modelTests"], programs["objectiveTests"]]),
                "responsibility/review alignment differs: " + role)
    require(same(candidate.get("readonlyGpuQualification"),
                 {"attemptId": candidate["readonlyGpuQualification"]["attemptId"],
                  "trainSampleId": gpu.TRAIN_ID, "trainOrdinal": gpu.TRAIN_ORDINAL,
                  "outputRoot": gpu.OUTPUT_ROOT}), "GPU probe subject differs")
    return scope, memberships


def run_tests():
    env = {**os.environ, "CUDA_VISIBLE_DEVICES": "", "PYTHONDONTWRITEBYTECODE": "1",
           "PYTHONIOENCODING": "utf-8", "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2"}
    python_files = (MODEL_TEST, OBJECTIVE_TEST, PROBE_TEST, GPU_GATE_TEST)
    # The repository's test directory is not a Python package; use discovery per file.
    results = []
    for filename in python_files:
        result = subprocess.run([sys.executable, "-B", "-m", "unittest", "discover",
                                 "-s", "ml/ai-painter/tests", "-p", Path(filename).name, "-q"],
                                cwd=ROOT, env=env, capture_output=True, text=True,
                                encoding="utf-8", errors="replace", timeout=90)
        require(result.returncode == 0, "CPU control tests failed: " + filename + "\n" + (result.stderr or "")[-2000:])
        results.append({"path": filename, "exitCode": result.returncode,
                        "outputTail": (result.stderr or "")[-500:]})
    for filename in (NODE_SCOPE_TEST, NODE_CANDIDATE_TEST):
        result = subprocess.run(["node", "--test", filename], cwd=ROOT, env=env,
                                capture_output=True, text=True, encoding="utf-8",
                                errors="replace", timeout=60)
        require(result.returncode == 0, "Node control tests failed: " + filename + "\n" + (result.stderr or "")[-2000:])
        results.append({"path": filename, "exitCode": result.returncode,
                        "outputTail": (result.stdout or "")[-500:]})
    return results


def run(candidate_binding, previous_probe_binding):
    started = time.monotonic()
    reader = cpu.BoundReader()
    candidate = reader.json(gpu.binding(candidate_binding))
    scope, memberships = check_candidate(reader, candidate)
    old_probe = reader.json(gpu.binding(previous_probe_binding))
    require(old_probe.get("schemaVersion") == PROBE_SCHEMA
            and old_probe.get("status") == "cpu_numerical_probe_passed_not_qualification"
            and old_probe.get("formalCpuAcceptanceGranted") is False
            and old_probe.get("gpuInitialized") is False
            and old_probe.get("optimizerCreated") is False
            and old_probe.get("optimizerSteps") == 0
            and old_probe.get("initialModelStateSha256") == old_probe.get("finalModelStateSha256")
            and old_probe.get("initialCriticStateSha256") == old_probe.get("finalCriticStateSha256")
            and len(old_probe.get("negativeControls", [])) >= 6,
            "old numerical probe is invalid or falsely qualified")
    test_results = run_tests()
    live_probe = cpu.run_probe()
    require(live_probe.get("status") == "cpu_numerical_probe_passed_not_qualification"
            and live_probe.get("initialModelStateSha256") == live_probe.get("finalModelStateSha256")
            and live_probe.get("initialCriticStateSha256") == live_probe.get("finalCriticStateSha256")
            and live_probe.get("gpuInitialized") is False
            and live_probe.get("optimizerCreated") is False
            and live_probe.get("optimizerSteps") == 0
            and live_probe.get("challengeContentRead") is False
            and live_probe.get("regressionContentRead") is False,
            "fresh CPU numerical implementation failed")
    require(live_probe["initialModelStateSha256"] == old_probe["initialModelStateSha256"]
            and live_probe["initialCriticStateSha256"] == old_probe["initialCriticStateSha256"],
            "fresh seeded model differs from previous CPU probe")
    reader.unchanged()
    return {
        "schemaVersion": REPORT_SCHEMA,
        "status": "cpu_readonly_accepted_execution_disabled",
        "capabilityVersion": gpu.CAPABILITY,
        "implementationIdentitySha256": gpu.implementation_identity(candidate),
        "acceptanceProgram": candidate["programBindings"]["formalCpuAcceptance"],
        "candidateContractAtAcceptance": candidate_binding,
        "previousNumericalProbe": previous_probe_binding,
        "dryScope": gpu.SCOPE,
        "dryScopeStatus": scope["status"],
        "datasetSelectionSha256": {key: value["selectionSha256"] for key, value in memberships.items()},
        "cpuTestsPassed": True,
        "cpuTestResults": test_results,
        "negativeControlsPassed": len(live_probe["negativeControls"]),
        "initialModelStateSha256": live_probe["initialModelStateSha256"],
        "finalModelStateSha256": live_probe["finalModelStateSha256"],
        "initialCriticStateSha256": live_probe["initialCriticStateSha256"],
        "finalCriticStateSha256": live_probe["finalCriticStateSha256"],
        "optimizerCreated": False,
        "optimizerSteps": 0,
        "weightsModified": False,
        "gpuInitialized": False,
        "trainingAllowed": False,
        "stage4QualificationGranted": False,
        "elapsedSeconds": time.monotonic() - started,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--candidate-sha256", required=True)
    parser.add_argument("--probe", required=True)
    parser.add_argument("--probe-sha256", required=True)
    args = parser.parse_args()
    candidate_binding = {"path": args.candidate, "sha256": args.candidate_sha256}
    probe_binding = {"path": args.probe, "sha256": args.probe_sha256}
    try:
        report = run(candidate_binding, probe_binding)
        exit_code = 0
    except Exception as error:
        report = {
            "schemaVersion": REPORT_SCHEMA,
            "status": "failed_closed",
            "capabilityVersion": gpu.CAPABILITY,
            "candidateContractAtAcceptance": candidate_binding,
            "previousNumericalProbe": probe_binding,
            "errorType": type(error).__name__,
            "error": str(error),
            "cpuTestsPassed": False,
            "optimizerCreated": False,
            "optimizerSteps": 0,
            "gpuInitialized": False,
            "trainingAllowed": False,
            "stage4QualificationGranted": False,
            "recordedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        exit_code = 1
    logical = OUTPUT_ROOT + "/acceptance-" + uuid.uuid4().hex + "/report.json"
    target = cpu.project_file(ROOT, logical)
    target.parent.mkdir(parents=True, exist_ok=False)
    with target.open("x", encoding="utf8") as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({"status": report["status"],
                      "report": {"path": logical, "sha256": cpu.sha(target.read_bytes())}}))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
