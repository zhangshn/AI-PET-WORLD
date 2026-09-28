"""V21-only, CPU-side immutable contract and evidence gate.

The V18 files are frozen reference inputs. This module performs no training,
CUDA initialization, source image decoding, registry write, or publication.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import check_stage4_mvp_structured_object_v18_cpu_acceptance as data
import run_stage4_mvp_structured_object_v18_readonly_gpu_qualification as v18

from ai_painter.complete_world.native_rgb_object_residual_v21_cpu import CAPABILITY, SEED

SCHEMA = "stage4-mvp-native-rgb-object-residual-v21-contract-v1"
CPU_SCHEMA = "stage4-mvp-object-residual-v21-formal-cpu-acceptance-v1"
GPU_ROOT = ".runtime/ai-painter/stage4-mvp-object-residual-v21-readonly-gpu-qualifications"
BASELINE = {"path": "data/ai-painter/system-governance/stage4-mvp-native-rgb-structured-object-v18-contract-v1.json",
            "sha256": "ef18e3b3ab6e5b3b92671c805e90519cded12831cb50b3094c2a49d35a734b4a"}
ARCHITECTURE_EVIDENCE = {
    "path": ".runtime/ai-painter/stage4-mvp-v21-object-residual-cpu-prototype/support-revision-v2-report.json",
    "sha256": "113e42b3c59db67af66a61b6435f829b8f09a6cdceac61fd14aafef412c9016c"}
PRE_REVIEW_REJECTION = {
    "path": ".runtime/ai-painter/stage4-mvp-v21-object-residual-cpu-prototype/pre-review-v1-rejection.json",
    "sha256": "1a79183f938b3901b7d35536c4e5d7e98e66e3dbe1e377db48d2344b1b2c4924"}
OBJECT_RESIDUAL_SCOPE = {
    "object_footprints": {"source": "authoritative_condition_mask", "radius": 0},
    "object_tree": {"source": "bound_instance_role_coverage", "radius": 8},
    "object_rock": {"source": "bound_instance_role_coverage", "radius": 4},
    "object_vegetation": {"source": "bound_instance_role_coverage", "radius": 6},
    "typedCoreOverride": True,
    "crossClassRingOverlap": "excluded",
    "outsideBoundObjectCoverage": "zero_residual",
}
PROGRAM_PATHS = {
    "admission": "ml/ai-painter/scripts/v21_object_residual_admission.py",
    "formalCpuAcceptance": "ml/ai-painter/scripts/accept_stage4_mvp_object_residual_v21_cpu.py",
    "readonlyGpuQualification": "ml/ai-painter/scripts/run_stage4_mvp_object_residual_v21_readonly_gpu_qualification.py",
    "admissionTests": "ml/ai-painter/tests/test_v21_object_residual_admission.py",
    "model": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_residual_v21_cpu.py",
    "modelTests": "ml/ai-painter/tests/test_native_rgb_object_residual_v21_cpu.py",
}
FROZEN_PROGRAMS = {key: value for key, value in v18.PROGRAM_PATHS.items()
                   if key not in PROGRAM_PATHS and key != "gpuGateTests"}
require = data.require
exact = v18.exact
binding = v18.binding


def implementation_identity(candidate):
    """Only the late CPU report is omitted to avoid a hash cycle."""
    return v18.implementation_identity(candidate)


def _baseline(reader):
    return reader.json(BASELINE)


def validate_candidate(candidate, baseline, *, attempt_id, output_root):
    """Pure JSON checks; authenticate recomputes every referenced file SHA."""
    require(candidate.get("schemaVersion") == SCHEMA
            and candidate.get("capabilityVersion") == CAPABILITY
            and candidate.get("status") == "cpu_candidate_not_execution_qualified", "wrong V21 candidate")
    require(candidate.get("cpuAcceptance") is None, "candidate must be immutable before CPU evidence")
    require(exact(candidate.get("modelPlan"), {"baseChannels": 48, "patchChannels": 32, "seed": SEED}),
            "V21 model width or fresh seed differs")
    for key in ("datasetBinding", "dryScope", "conditionContract", "lossContract",
                "reviewThresholdContract", "precisionExecutionPlan", "businessScope",
                "authorityBoundary", "positionRegularization"):
        require(exact(candidate.get(key), baseline.get(key)), "V18 frozen contract differs: " + key)
    require(exact(candidate.get("priorCandidate"), BASELINE),
            "V21 prior candidate is not the frozen V18 contract")
    alignments = candidate.get("trainingReviewAlignment")
    old_alignments = baseline["trainingReviewAlignment"]
    require(isinstance(alignments, list) and len(alignments) == len(old_alignments),
            "V21 seven-role alignment differs")
    for index, (actual, old) in enumerate(zip(alignments, old_alignments)):
        if index < 3:
            require(exact(actual, old), "V21 terrain alignment differs")
        else:
            expected = {**old,
                        "responsibilityOutputIdentity":
                            old["responsibilityId"] + "_masked_learned_rgb_residual_3x192x256",
                        "upstreamResponsibilityOutputIdentity": old["responsibilityOutputIdentity"],
                        "positiveAlignmentTests": [candidate.get("programBindings", {}).get("modelTests"),
                                                   baseline["programBindings"]["objectiveTests"]],
                        "negativeAlignmentTests": [candidate.get("programBindings", {}).get("modelTests"),
                                                   baseline["programBindings"]["objectiveTests"]]}
            require(exact(actual, expected),
                    "V21 masked RGB residual alignment differs: " + old["responsibilityId"])
    old_plan = baseline["boundedTrainingPlan"]
    plan = candidate.get("boundedTrainingPlan", {})
    for key in ("sourceSplitCounts", "stage", "optimizer", "resourceBound", "checkpointSelection"):
        require(exact(plan.get(key), old_plan[key]), "V18 bounded training policy differs: " + key)
    require(plan.get("capabilityVersion") == CAPABILITY
            and exact(plan.get("model"), {**old_plan["model"], "freshInitializationSeed": SEED}),
            "V21 bounded model plan differs")
    foundation = candidate.get("foundationAssetBinding", {})
    require(exact(foundation, {**baseline["foundationAssetBinding"],
                               "initializationSeed": SEED,
                               "parentCheckpointLoaded": False}),
            "V21 fresh model or failed checkpoint boundary differs")
    require(exact(candidate.get("activationGates"), baseline["activationGates"]),
            "activation gate differs")
    budget = candidate.get("resourceBudget", {})
    fraction = budget.get("maxGpuMemoryFraction")
    require(type(fraction) in (int, float) and math.isfinite(fraction) and 0 < fraction <= .7,
            "VRAM limit differs")
    require(type(budget.get("maxWallSeconds")) is int and 1 <= budget["maxWallSeconds"] <= 120
            and type(budget.get("cpuThreads")) is int and 1 <= budget["cpuThreads"] <= 2,
            "wall or CPU thread limit differs")
    require(exact({key: budget.get(key) for key in
                   ("sampleCount", "optimizerSteps", "automaticRetries", "checkpointWrites")},
                  {"sampleCount": 1, "optimizerSteps": 0, "automaticRetries": 0,
                   "checkpointWrites": 0}), "zero-update budget differs")
    require(isinstance(attempt_id, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{7,95}", attempt_id)
            and output_root == GPU_ROOT
            and exact(candidate.get("readonlyGpuQualification"),
                      {"attemptId": attempt_id, "trainSampleId": v18.TRAIN_ID,
                       "trainOrdinal": v18.TRAIN_ORDINAL, "outputRoot": GPU_ROOT}),
            "fixed train subject or output namespace differs")
    programs = candidate.get("programBindings", {})
    for key, path in PROGRAM_PATHS.items():
        require(binding(programs.get(key))["path"] == path, "V21 program path differs: " + key)
    for key, path in FROZEN_PROGRAMS.items():
        require(exact(programs.get(key), baseline["programBindings"].get(key))
                and binding(programs[key])["path"] == path,
                "frozen V18 dependency differs: " + key)
    require(exact(programs.get("v18ModelCore"), baseline["programBindings"]["model"]),
            "frozen V18 model core differs")
    require(exact(candidate.get("v18FrozenReference"), BASELINE), "V18 reference binding differs")
    require(exact(candidate.get("architectureEvidence"), ARCHITECTURE_EVIDENCE)
            and exact(candidate.get("preReviewRejected"), PRE_REVIEW_REJECTION)
            and exact(candidate.get("objectResidualScope"), OBJECT_RESIDUAL_SCOPE),
            "V21 architecture lineage or residual scope differs")


def validate_acceptance(candidate, acceptance, *, candidate_binding):
    require(acceptance.get("schemaVersion") == CPU_SCHEMA
            and acceptance.get("status") == "cpu_readonly_accepted_execution_disabled"
            and acceptance.get("capabilityVersion") == CAPABILITY
            and exact(acceptance.get("candidateContractAtAcceptance"), candidate_binding)
            and acceptance.get("implementationIdentitySha256") == implementation_identity(candidate)
            and exact(acceptance.get("acceptanceProgram"),
                      candidate["programBindings"]["formalCpuAcceptance"]),
            "V21 CPU acceptance identity differs")
    for key, expected in {"cpuTestsPassed": True, "optimizerCreated": False,
                          "optimizerSteps": 0, "weightsModified": False,
                          "gpuInitialized": False, "trainingAllowed": False,
                          "checkpointLoaded": False, "checkpointWritten": False,
                          "challengeContentRead": False, "regressionContentRead": False}.items():
        require(exact(acceptance.get(key), expected), "CPU acceptance boundary differs: " + key)
    for prefix in ("Model", "Critic"):
        initial, final = (acceptance.get("initial" + prefix + "StateSha256"),
                          acceptance.get("final" + prefix + "StateSha256"))
        require(isinstance(initial, str) and re.fullmatch(r"[0-9a-f]{64}", initial)
                and final == initial, "CPU network state differs: " + prefix)
    gradients = acceptance.get("objectHeadGradientAbsoluteSums", {})
    require(set(gradients) == {"object_footprints", "object_tree", "object_rock", "object_vegetation"}
            and all(type(value) in (float, int) and math.isfinite(value) and value > 0
                    for value in gradients.values()), "four object head gradients absent")
    require(acceptance.get("supportPositiveControlsPassed") is True
            and acceptance.get("supportNegativeControlsPassed") is True,
            "V21 support controls absent")
    require(set(acceptance.get("responsibilityGradients", {})) == set(v18.ROLES),
            "seven train responsibility gradients absent")
    require(all(type(row.get("maskedGradientAbsoluteSum")) in (int, float)
                and math.isfinite(row["maskedGradientAbsoluteSum"])
                and row["maskedGradientAbsoluteSum"] > 0
                for row in acceptance["responsibilityGradients"].values()),
            "seven train responsibility gradients are not positive")
    require(exact(acceptance.get("reviewApplicability"),
                  {row["responsibilityId"]: row["reviewApplicability"]
                   for row in candidate["trainingReviewAlignment"]}),
            "CPU report overstates dry review applicability")
    support = acceptance.get("objectSupport", {})
    require(set(support) == {"object_footprints", "object_tree", "object_rock", "object_vegetation"},
            "four object support measurements absent")
    for role, counts in support.items():
        visible, core = counts.get("visiblePixels"), counts.get("corePixels")
        require(type(visible) is int and type(core) is int and core > 0
                and (visible == core if role == "object_footprints" else visible > core),
                "CPU object support ring invalid: " + role)


def validate_object_support(evidence):
    """Independently reconstruct V21 masks from bound V18 instance views."""
    import torch
    roles = ("object_footprints", "object_tree", "object_rock", "object_vegetation")
    typed = roles[1:]
    require(set(evidence["visibleObjectSupportMasks"]) == set(roles)
            and set(evidence["maskedObjectRgbResiduals"]) == set(roles),
            "V21 support role set differs")
    object_coverage = evidence["objectCoverage"] > 0
    result = {}
    for role in roles:
        core = evidence["responsibilityConditions"][role] > .5
        if role == "object_footprints":
            expected = core
        else:
            coverage = evidence["roleCoverage"][role] > 0
            other_coverage = torch.zeros_like(coverage)
            for other in typed:
                if other != role:
                    other_coverage |= evidence["roleCoverage"][other] > 0
            expected = core | (coverage & ~other_coverage)
            require(bool((~core | coverage).all()) and bool((~coverage | object_coverage).all()),
                    "V21 typed support escaped bound coverage: " + role)
            require(bool((expected & ~core).any()), "V21 typed legal support ring absent: " + role)
        actual = evidence["visibleObjectSupportMasks"][role]
        residual = evidence["maskedObjectRgbResiduals"][role]
        require(torch.equal(actual, expected) and bool(actual.any())
                and bool((~actual | object_coverage).all())
                and residual.shape == (1, 3, 192, 256)
                and bool(torch.isfinite(residual).all())
                and bool((residual[~actual.expand_as(residual)] == 0).all()),
                "V21 residual support differs: " + role)
        result[role] = {"visiblePixels": int(actual.sum()), "corePixels": int(core.sum())}
    return result


def authenticate(candidate_binding, cpu_binding=None, *, attempt_id, output_root):
    reader = data.BoundReader()
    candidate = reader.json(binding(candidate_binding))
    baseline = _baseline(reader)
    validate_candidate(candidate, baseline, attempt_id=attempt_id, output_root=output_root)
    evidence = reader.json(ARCHITECTURE_EVIDENCE)
    rejection = reader.json(PRE_REVIEW_REJECTION)
    require(evidence.get("status") == "cpu_architecture_supported_no_execution_qualification"
            and rejection.get("status") == "pre_review_rejected"
            and exact(evidence.get("preReviewRejected"), PRE_REVIEW_REJECTION),
            "V21 CPU architecture lineage is invalid")
    for bound in evidence["programBindings"]:
        reader.read(binding(bound))
    require(exact(evidence["programBindings"][0], candidate["programBindings"]["model"])
            and exact(evidence["programBindings"][1], candidate["programBindings"]["modelTests"]),
            "V21 architecture implementation differs from CPU evidence")
    for bound in candidate["programBindings"].values():
        reader.read(binding(bound))
    for key in ("lossContract", "reviewThresholdContract", "foundationAssetBinding"):
        for bound in v18.declared_bindings(candidate[key]):
            reader.read(bound)
    scope = v18.verify_dry_scope(reader)
    manifest, order, continuous, _, memberships = data.select_rows(reader)
    for split in ("train", "validation"):
        require(memberships[split]["selectionSha256"] ==
                candidate["datasetBinding"][split + "SelectionSha256"],
                "frozen selection differs: " + split)
    source = reader.json(manifest["sourceIndex"])
    ids = reader.json(manifest["splits"]["train"])["sampleIds"]
    require(ids[v18.TRAIN_ORDINAL] == v18.TRAIN_ID, "fixed train subject differs")
    row = next(item for item in source["samples"] if item["sampleId"] == v18.TRAIN_ID)
    require(row["split"] == "train", "GPU subject is not train")
    acceptance = None
    if cpu_binding is not None:
        acceptance = reader.json(binding(cpu_binding))
        validate_acceptance(candidate, acceptance, candidate_binding=candidate_binding)
    reader.unchanged()
    return reader, candidate, acceptance, scope, order, continuous, row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--candidate-sha256", required=True)
    parser.add_argument("--cpu-evidence")
    parser.add_argument("--cpu-evidence-sha256")
    parser.add_argument("--attempt-id", required=True)
    parser.add_argument("--output-root", required=True)
    args = parser.parse_args()
    require((args.cpu_evidence is None) == (args.cpu_evidence_sha256 is None),
            "CPU evidence path/SHA pair required")
    cpu_bound = ({"path": args.cpu_evidence, "sha256": args.cpu_evidence_sha256}
                 if args.cpu_evidence else None)
    _, candidate, acceptance, _, _, _, _ = authenticate(
        {"path": args.candidate, "sha256": args.candidate_sha256}, cpu_bound,
        attempt_id=args.attempt_id, output_root=args.output_root)
    print(json.dumps({"status": "v21_cpu_preflight_passed_gpu_not_started",
                      "implementationIdentitySha256": implementation_identity(candidate),
                      "formalCpuAcceptancePresent": acceptance is not None,
                      "attemptConsumed": False, "trainingAllowed": False}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"status": "failed_closed", "errorType": type(error).__name__,
                          "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
