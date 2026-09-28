"""Independent, no-optimizer V15 CPU acceptance; never a GPU/training ticket.

Accepts only a fully bound local capability and a separate V15 formal reviewer.
The report is evidence for the later read-only GPU qualification, not authority.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
for directory in (ROOT / "ml/ai-painter/src", SCRIPT_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from ai_painter.complete_world.split_release import (  # noqa: E402
    canonical_bytes, bound_json, project_file, read_bound,
)
from check_stage4_mvp_conditional_texture_cpu import (  # noqa: E402
    CAPABILITY, CONTRACT_PATH, MANIFEST, SEED, binding, run as run_probe,
    verify_contract,
)


REVIEW_PATH = (
    "data/ai-painter/system-governance/"
    "stage4-mvp-v15-stage0-review-contract-v1.json"
)
PROGRAM_PATH = "ml/ai-painter/scripts/check_stage4_mvp_conditional_texture_v15_cpu_acceptance.py"
OUTPUT_ROOT = ".runtime/ai-painter/stage4-mvp-conditional-texture-v15-cpu-acceptances"
EXPECTED_PROGRAMS = {
    "cpuAcceptance": PROGRAM_PATH,
    "trainingWorker": "ml/ai-painter/scripts/train_stage4_mvp_conditional_texture_v15_stage0.py",
    "reviewCandidateMaterializer": "ml/ai-painter/scripts/materialize_stage4_mvp_conditional_texture_v15_review_candidates.py",
    "readonlyGpuQualification": "ml/ai-painter/scripts/run_stage4_mvp_conditional_texture_v15_readonly_gpu_qualification.py",
    "formalReviewRunner": "scripts/run-ai-painter-stage4-mvp-v15-stage0-machine-review.mjs",
    "formalReviewLineage": "scripts/lib/ai-painter-stage4-mvp-v15-review-lineage.mjs",
    "frozenGenericAudit": "scripts/lib/ai-painter-stage4-mvp-v13-review-lineage.mjs",
    "closedLoopController": "scripts/run-ai-painter-stage4-mvp-v15-stage0-closed-loop.mjs",
    "workerGateTests": "ml/ai-painter/tests/test_stage4_mvp_conditional_texture_v15_worker_gate.py",
    "gpuGateTests": "ml/ai-painter/tests/test_stage4_mvp_conditional_texture_v15_gpu_gate.py",
    "formalReviewTests": "scripts/tests/test-ai-painter-stage4-mvp-v15-review-lineage.mjs",
}
FACT_ROLES = {
    "road": "terrain_path_ground", "hydrology": "terrain_water",
    "shoreline": "terrain_shoreline", "footprints": "object_footprints",
    "tree": "object_tree", "rock": "object_rock",
    "vegetation": "object_vegetation",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def verify_formal_boundaries() -> tuple[dict, dict]:
    contract = verify_contract()
    require(contract["datasetBinding"]["manifest"] == MANIFEST,
            "V15 acceptance dataset changed")
    programs = contract["programBindings"]
    for role, path in EXPECTED_PROGRAMS.items():
        require(programs.get(role) == binding(path),
                f"V15 acceptance program missing or changed: {role}")
    loss = contract["lossContract"]
    require(loss.get("identity") ==
            "stage4-mvp-v15-train-original-conditional-texture-objective-v1"
            and loss.get("formulaSha256") == hashlib.sha256(
                canonical_bytes(loss.get("formula"))).hexdigest()
            and set(loss.get("formula", {})) == {"generator", "critic", "validation"}
            and loss.get("inputShapes") == {
                "conditions": [23, 192, 256], "trainOriginalRgb": [3, 192, 256],
                "prediction": [1, 3, 192, 256], "criticInput": [1, 26, 192, 256],
            } and loss.get("objectSupportRadius256") == {
                "object_tree": 8, "object_rock": 4, "object_vegetation": 6,
            }, "V15 complete loss identity or formula invalid")
    review_binding = contract["reviewBinding"].get("formalContract")
    require(review_binding == binding(REVIEW_PATH)
            and contract["reviewBinding"]["alignmentQualified"] is True,
            "V15 separate formal review is unavailable")
    reviewer = bound_json(ROOT, review_binding)
    require(reviewer.get("capabilityVersion") == CAPABILITY
            and reviewer.get("status") == "active_for_v15_stage0_machine_review"
            and reviewer.get("activation", {}).get("formalReviewExecutionAllowed") is True
            and reviewer.get("activation", {}).get("trainingAllowed") is False,
            "V15 formal reviewer status invalid")
    require(reviewer.get("numericThresholdAdoption", {}).get("binding") ==
            contract["reviewBinding"]["thresholds"]
            and reviewer.get("minimumDetailGate") ==
            contract["reviewBinding"]["minimumDetail"],
            "V15 reviewer does not use frozen numeric/detail gates")
    for role, key in (("formalReviewRunner", "runner"),
                      ("formalReviewLineage", "lineageAndAuditors"),
                      ("frozenGenericAudit", "frozenGenericAudit")):
        require(reviewer.get("programs", {}).get(key) == programs[role],
                f"V15 formal reviewer program changed: {role}")
    threshold = bound_json(ROOT, contract["reviewBinding"]["thresholds"])
    require(threshold.get("reviewTrainingSeparation", {}).get("thresholdLoweringAllowed")
            is False, "V15 cannot lower inherited numeric thresholds")
    allowed_failure_codes = set().union(*(
        set(value) for value in threshold.get("failureCodes", {}).values()
        if isinstance(value, list)
    ))
    shoreline_failure = reviewer.get("shorelineReview", {}).get("failureCode")
    if isinstance(shoreline_failure, str):
        allowed_failure_codes.add(shoreline_failure)
    alignment = contract.get("trainingReviewAlignment")
    require(isinstance(alignment, list) and len(alignment) == 7,
            "V15 seven-role training/review alignment missing")
    order = bound_json(ROOT, contract["conditionContract"])["tensorContract"]["channelOrder"]
    seen = set()
    for row in alignment:
        identity = row.get("responsibilityId")
        require(identity in FACT_ROLES and identity not in seen
                and row.get("conditionChannelIds") == [FACT_ROLES[identity]]
                and FACT_ROLES[identity] in order
                and row.get("formulaSha256") == loss["formulaSha256"]
                and row.get("formalReviewContractIdentity") ==
                reviewer["contractId"]
                and row.get("formalReviewContractSha256") == review_binding["sha256"]
                and isinstance(row.get("objectiveTermIds"), list)
                and row["objectiveTermIds"]
                and set(row["objectiveTermIds"]).issubset(loss["generatorTerms"])
                and isinstance(row.get("responsibilityOutputIdentity"), str)
                and row["responsibilityOutputIdentity"]
                and isinstance(row.get("reviewMetricIds"), list)
                and row["reviewMetricIds"]
                and isinstance(row.get("failureCodes"), list)
                and row["failureCodes"]
                and set(row["failureCodes"]).issubset(allowed_failure_codes)
                and row.get("positiveAlignmentTests") == [programs["objectiveTests"]]
                and row.get("negativeAlignmentTests") == [programs["objectiveTests"]],
                f"V15 incomplete role alignment: {identity}")
        seen.add(identity)
    require(seen == set(FACT_ROLES), "V15 role alignment identities incomplete")
    require(reviewer.get("shorelineReview", {}).get("channelId") == "terrain_shoreline"
            and reviewer["shorelineReview"].get("independentGate") is True
            and reviewer["shorelineReview"].get("positiveNegativeTests") ==
            programs["formalReviewTests"],
            "V15 shoreline formal review is not independently bound")
    return contract, reviewer


def run() -> dict:
    started = time.monotonic()
    contract, reviewer = verify_formal_boundaries()
    result = subprocess.run(
        [sys.executable, "-B", "-m", "unittest", "discover", "-s",
         str(ROOT / "ml/ai-painter/tests"), "-p",
         "test_native_rgb_conditional_texture_cpu.py"],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
        env={**os.environ, "PYTHONPATH": str(ROOT / "ml/ai-painter/src"),
             "PYTHONDONTWRITEBYTECODE": "1"}, check=False,
    )
    require(result.returncode == 0 and "OK" in result.stderr,
            "V15 bound CPU alignment tests failed: " + result.stderr[-1200:])
    probe = run_probe()
    require(probe["optimizerSteps"] == 0 and probe["gpuUsed"] is False
            and probe["trainingStarted"] is False
            and probe["validationContentRead"] is False
            and probe["generatorStateUnchanged"] is True
            and probe["discriminatorStateUnchanged"] is True,
            "V15 CPU state or split boundary failed")
    require(time.monotonic() - started <= 180,
            "V15 independent CPU acceptance exceeded wall bound")
    require(binding(CONTRACT_PATH) == probe["candidateContract"]
            and binding(REVIEW_PATH) == contract["reviewBinding"]["formalContract"]
            and binding(PROGRAM_PATH) == contract["programBindings"]["cpuAcceptance"],
            "V15 contract/program changed during CPU acceptance")
    return {
        "schemaVersion": "stage4-mvp-conditional-texture-v15-formal-cpu-acceptance-v1",
        "status": "cpu_readonly_accepted_execution_disabled",
        "capabilityVersion": CAPABILITY,
        "candidateContract": binding(CONTRACT_PATH),
        "formalReviewContract": binding(REVIEW_PATH),
        "datasetManifest": MANIFEST,
        "initialModelStateSha256": probe["initialGeneratorStateSha256"],
        "initialDiscriminatorStateSha256": probe["initialDiscriminatorStateSha256"],
        "trainSelectionSha256": probe["trainSelectionSha256"],
        "validationSelectionSha256": probe["validationSelectionSha256"],
        "alignmentRoles": list(FACT_ROLES),
        "formulaSha256": contract["lossContract"]["formulaSha256"],
        "reviewStatus": reviewer["status"],
        "acceptanceProgram": binding(PROGRAM_PATH),
        "acceptanceTests": contract["programBindings"]["objectiveTests"],
        "formalReviewAlignmentPassed": True,
        "independentAcceptance": True,
        "cpuTestsPassed": True,
        "validationContentRead": False,
        "optimizerSteps": 0, "gpuStarted": False, "gpuUsed": False,
        "trainingStarted": False, "weightsModified": False,
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    report = run()
    identity = hashlib.sha256(canonical_bytes({
        "candidateContract": report["candidateContract"],
        "formalReviewContract": report["formalReviewContract"],
        "cpuAcceptanceProgram": binding(PROGRAM_PATH),
    })).hexdigest()[:48]
    output = project_file(ROOT, f"{OUTPUT_ROOT}/cpu-v15-{identity}/report.json")
    output.parent.mkdir(parents=True, exist_ok=False)
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({"status": report["status"], "report": binding(
        output.relative_to(ROOT).as_posix())}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
