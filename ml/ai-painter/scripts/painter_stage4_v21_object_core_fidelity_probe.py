"""Object-core objective profile of the existing single bounded executor.

Historical workers remain byte-for-byte unchanged. Process-local adapters are
restored on exit; there is no additional supervisor or resume mechanism.
"""
from contextlib import ExitStack, contextmanager
from copy import deepcopy
import json
import math
import sys
from unittest.mock import patch

import painter_stage4_v21_whole_frame_fidelity_probe as fidelity
from ai_painter.complete_world.native_rgb_object_core_fidelity_candidate_cpu import (
    CANDIDATE_ID, OBJECT_CORE_RGB_WEIGHT, train_object_core_fidelity_candidate_objective,
)

core = fidelity.core
WORKER = "ml/ai-painter/scripts/painter_stage4_v21_object_core_fidelity_probe.py"
TESTS = "ml/ai-painter/tests/test_stage4_v21_object_core_fidelity_probe.py"
CONTROLLER_TESTS = "scripts/tests/test-ai-painter-object-core-fidelity-controller.mjs"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v21-object-core-fidelity-policy-v1.json"
POLICY_SCHEMA = "stage4-mvp-v21-object-core-fidelity-policy-v1"
EXPERIMENT_TYPE = "object_core_fidelity_train_only"
SCOPE = "object_core_fidelity_train_only_no_generalization_claim"
OBJECTIVE = "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_core_fidelity_candidate_cpu.py"
OBJECTIVE_TEST = "ml/ai-painter/tests/test_native_rgb_object_core_fidelity_candidate_cpu.py"
CPU_EVIDENCE = ".runtime/ai-painter/stage4-mvp-v21-object-core-fidelity-cpu-prototype/report.json"
HEARTBEAT_PUBLICATION_RULE = deepcopy(fidelity.HEARTBEAT_PUBLICATION_RULE)
NEW_TERMS = ("wholeFrameFidelityUnchangedTotal", "objectCoreRgbMae", "objectCoreRgbWeighted",
             "objectCoreApplicableRoleCount", "total")


def objective_plan():
    return {"candidateId": CANDIDATE_ID, "program": core.bind(OBJECTIVE),
        "tests": core.bind(OBJECTIVE_TEST), "cpuEvidence": core.bind(CPU_EVIDENCE),
        "inheritedObjectivePlan": fidelity.objective_plan(),
        "formula": "unchanged_whole_frame_fidelity_total_plus_equal_nonempty_role_core_rgb_l1",
        "coreRgbWeight": OBJECT_CORE_RGB_WEIGHT,
        "roles": list(core.fit.ROLES), "maskDilation": False,
        "coefficientSelection": "fixed_one_no_search", "targetSplit": "train",
        "existingTermsPreserved": True, "qualificationGranted": False,
        "historicalComparisonPurpose": "changed_loss_comparison_not_numerical_reproduction"}


def collect_inputs(registry=None):
    context = fidelity.base_collect(registry)
    reader = context["reader"]
    plan = objective_plan()
    evidence = reader.json(plan["cpuEvidence"])
    core.require(evidence.get("status") == "cpu_candidate_controls_passed_not_execution_qualified"
        and evidence.get("candidateId") == CANDIDATE_ID
        and evidence.get("programBindings") == [plan["program"], plan["tests"]]
        and evidence.get("tests", {}).get("newCpu", {}).get("exitCode") == 0,
        "object-core CPU evidence/program binding differs")
    for binding in (plan["program"], plan["tests"], plan["inheritedObjectivePlan"]["program"],
                    plan["inheritedObjectivePlan"]["tests"], plan["inheritedObjectivePlan"]["cpuEvidence"]):
        reader.read(binding)
    reader.json(evidence["sourceReview"])
    context["inputs"]["objectivePlan"] = plan
    context["inputs"]["heartbeatPublicationRule"] = deepcopy(HEARTBEAT_PUBLICATION_RULE)
    context["inputs"]["researchBaselineReview"] = evidence["sourceReview"]
    context["inputs"]["inputReceipts"] = [{"path": path, "sha256": digest}
        for path, digest in sorted(reader.observed.items())]
    reader.unchanged()
    return context


def validate_policy(policy, inputs):
    fidelity.base_validate_policy(policy, inputs)
    core.require(inputs.get("objectivePlan") == objective_plan(), "object-core frozen objective differs")
    core.require(json.dumps(inputs.get("heartbeatPublicationRule"), sort_keys=True)
        == json.dumps(HEARTBEAT_PUBLICATION_RULE, sort_keys=True), "object-core heartbeat publication differs")


def package_from_inputs(inputs, policy_binding, manifest):
    package = fidelity.base_package(inputs, policy_binding, manifest)
    identity = package["experimentIdentity"].replace("v21-full-train-exposure-", "v21-object-core-fidelity-", 1)
    package.update(experimentIdentity=identity, outputRoot=core.OUTPUT_PARENT + "/" + identity)
    package["config"]["objectivePlan"] = inputs["objectivePlan"]
    return package


def observation_evidence(*args):
    return {**fidelity.base_observation_evidence(*args), "objectivePlan": objective_plan(),
        "heartbeatPublicationRule": deepcopy(HEARTBEAT_PUBLICATION_RULE),
        "historicalComparisonPurpose": "changed_loss_comparison_not_numerical_reproduction"}


def validate_result_contract(result, package):
    core.require(result.get("objectivePlan") == package["inputs"].get("objectivePlan") == objective_plan(),
                 "object-core result objective identity differs")
    core.require(json.dumps(result.get("heartbeatPublicationRule"), sort_keys=True)
        == json.dumps(package["inputs"].get("heartbeatPublicationRule"), sort_keys=True)
        == json.dumps(HEARTBEAT_PUBLICATION_RULE, sort_keys=True), "object-core result heartbeat differs")
    fidelity.base_validate_result(result, package)


def _execute_with_core_objective(function, *args, **kwargs):
    recorded = []

    def objective(*objective_args):
        total, parts = train_object_core_fidelity_candidate_objective(*objective_args)
        values = {key: float(parts[key].detach().float().cpu()) for key in NEW_TERMS}
        core.require(all(math.isfinite(value) for value in values.values())
            and 1 <= values["objectCoreApplicableRoleCount"] <= 4
            and values["objectCoreApplicableRoleCount"].is_integer()
            and 0 <= values["objectCoreRgbMae"] <= 1
            and values["objectCoreRgbWeighted"] == values["objectCoreRgbMae"]
            and math.isclose(values["total"], values["wholeFrameFidelityUnchangedTotal"]
                             + values["objectCoreRgbWeighted"], rel_tol=1e-5, abs_tol=1e-6),
            "object-core execution terms invalid")
        recorded.append(values)
        return total, parts

    with patch.object(fidelity, "train_whole_frame_fidelity_candidate_objective", objective), \
         patch.object(fidelity, "CANDIDATE_ID", CANDIDATE_ID):
        result = function(*args, **kwargs)
    core.require(len(recorded) == 1, "object-core objective must execute exactly once per pair/probe")
    return result, recorded[0]


def perform_pair(*args, **kwargs):
    result, terms = _execute_with_core_objective(fidelity.perform_pair, *args, **kwargs)
    return {**result, **terms}


def zero_update_probe(*args, **kwargs):
    result, terms = _execute_with_core_objective(fidelity.zero_update_probe, *args, **kwargs)
    result["objectiveTerms"].update(terms)
    core.require(result["objectiveId"] == CANDIDATE_ID, "object-core GPU objective identity differs")
    return result


def freeze_policy():
    context = collect_inputs()
    policy = {"schemaVersion": POLICY_SCHEMA, "status": "active_single_bounded_train_only_exposure_experiment",
              "scope": SCOPE, "inputs": context["inputs"], "maxAttempts": 1, "automaticRetries": 0}
    validate_policy(policy, context["inputs"])
    target = core.cpu.project_file(core.ROOT, POLICY_PATH)
    if target.exists():
        core.require(json.loads(target.read_bytes()) == policy, "object-core policy already differs")
    else:
        core.v21.write_exclusive(target, policy)
    return core.bind(POLICY_PATH)


@contextmanager
def successor_profile():
    qualification = deepcopy(core.QUALIFICATION)
    qualification["scope"] = SCOPE
    paths = sorted(set(core.IMPLEMENTATION_PATHS + [WORKER, TESTS, OBJECTIVE, OBJECTIVE_TEST,
        fidelity.WORKER, fidelity.OBJECTIVE, fidelity.OBJECTIVE_TEST,
        CONTROLLER_TESTS, "scripts/tests/test-ai-painter-experiment-heartbeat.mjs",
        "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"]))
    changes = {"WORKER": WORKER, "TESTS": TESTS, "POLICY_PATH": POLICY_PATH,
        "POLICY_SCHEMA": POLICY_SCHEMA, "EXPERIMENT_TYPE": EXPERIMENT_TYPE, "SCOPE": SCOPE,
        "QUALIFICATION": qualification, "IMPLEMENTATION_PATHS": paths,
        "collect_inputs": collect_inputs, "validate_policy": validate_policy,
        "package_from_inputs": package_from_inputs, "observation_evidence": observation_evidence,
        "validate_result_contract": validate_result_contract,
        "perform_pair": perform_pair, "zero_update_probe": zero_update_probe}
    with ExitStack() as stack:
        for name, value in changes.items():
            stack.enter_context(patch.object(core, name, value))
        yield core


if __name__ == "__main__":
    with successor_profile():
        if sys.argv[1:] == ["freeze-policy"]:
            print(json.dumps(freeze_policy()))
        else:
            core.main()
