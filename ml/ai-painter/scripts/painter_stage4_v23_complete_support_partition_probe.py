"""V23 complete-support partition profile for the bounded train-only executor.

This adapter replaces only the fresh renderer factory and records ownership
facts from the two real zero-update forwards.  It does not create a second
executor, change the inherited objective, or grant qualification.
"""
from contextlib import ExitStack, contextmanager
from copy import deepcopy
import io
import json
import sys
from unittest.mock import patch

import painter_stage4_v21_object_core_fidelity_probe as object_core
from ai_painter.complete_world.native_rgb_complete_support_partition_v23_cpu import (
    ARCHITECTURE, CAPABILITY, OWNERSHIP_RULE, SEED, TYPED_ROLES,
    build_fresh_native_rgb_complete_support_partition_v23_cpu,
)

core = object_core.core
WORKER = "ml/ai-painter/scripts/painter_stage4_v23_complete_support_partition_probe.py"
TESTS = "ml/ai-painter/tests/test_stage4_v23_complete_support_partition_probe.py"
CONTROLLER_TESTS = "scripts/tests/test-ai-painter-v23-support-partition-controller.mjs"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v23-complete-support-partition-policy-v1.json"
POLICY_SCHEMA = "stage4-mvp-v23-complete-support-partition-policy-v1"
EXPERIMENT_TYPE = "complete_support_partition_train_only"
SCOPE = "complete_support_partition_train_only_no_generalization_claim"
RENDERER = "ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py"
RENDERER_TEST = "ml/ai-painter/tests/test_native_rgb_complete_support_partition_v23_cpu.py"
CPU_EVIDENCE = ".runtime/ai-painter/stage4-mvp-v23-complete-support-partition-cpu/report.json"
CONTROLLER_ACCEPTANCE = ".runtime/ai-painter/stage4-mvp-v23-complete-support-partition-cpu/controller-acceptance.json"
FORMAL_SPEC = "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"


def model_plan():
    return {"baseChannels": 48, "patchChannels": 32, "seed": SEED,
        "capabilityVersion": CAPABILITY, "architectureId": ARCHITECTURE,
        "freshInitializationOnly": True, "historicalCheckpointLoaded": False}


def representation_plan():
    return {"capabilityVersion": CAPABILITY, "architectureId": ARCHITECTURE,
        "ownershipRule": OWNERSHIP_RULE,
        "program": core.bind(RENDERER), "tests": core.bind(RENDERER_TEST),
        "cpuEvidence": core.bind(CPU_EVIDENCE),
        "controllerAcceptance": core.bind(CONTROLLER_ACCEPTANCE),
        "formalSpecification": {**core.bind(FORMAL_SPEC), "version": "AI-PAINTER-SPEC-1.24", "section": "9.6.8"},
        "typedRoles": list(TYPED_ROLES), "tieOrder": list(TYPED_ROLES),
        "supportRadiusPixels": {"object_tree": 8, "object_rock": 4, "object_vegetation": 6},
        "distance": "exact_integer_chebyshev_distance_to_nearest_same_role_authoritative_core",
        "comparison": "integer_cross_multiplication_strict_less_than",
        "coreNeverYields": True, "ownedUnionEqualsExistingTypedCoverageUnion": True,
        "ownersPairwiseDisjoint": True, "ownerSubsetOfOwnExistingCoverage": True,
        "supportExpanded": False, "freshInitializationSeed": SEED,
        "historicalCheckpointLoaded": False,
        "inheritedComponents": {
            "terrainPath": "unchanged_fresh_v21", "critic": "unchanged_fresh_v21",
            "objective": "unchanged_object_core_fidelity_v1", "conditionChannels": "unchanged_23",
            "instanceFeatureAssembly": "unchanged_v21", "rgbHeads": "unchanged_v21",
            "footprintResidual": "unchanged_v21", "pointwiseComposition": "unchanged_v21"},
        "qualificationGranted": False}


def source_plan(inputs):
    return {"datasetManifest": inputs["datasetManifest"], "sourceIndex": inputs["sourceIndex"],
        "trainSplit": inputs["trainSplit"], "conditionContract": inputs["conditionContract"],
        "sourceRgbUse": "original_train_rgb_targets_only", "conditionUse": "original_bound_23_channels",
        "externalRgbRead": False, "worldFactsChanged": False, "sourceBytesMutable": False,
        "validationContentRead": False, "challengeContentRead": False, "regressionContentRead": False}


def data_plan(inputs):
    return {"split": "train", "selectedRowCount": 48,
        "trainSelectionSha256": inputs["trainSelectionSha256"],
        "orderedRows": [{"sampleId": row["sampleId"], "split": row["split"],
                         "trainOrdinal": row["trainOrdinal"]} for row in inputs["selectedRows"]],
        "epochs": 48, "visitsPerRow": 48, "generatorOptimizerSteps": 2304,
        "discriminatorOptimizerSteps": 2304, "holdoutUsed": False,
        "historicalWeightsUsed": False, "automaticRetries": 0}


def validate_cpu_acceptance(evidence, acceptance, plan):
    core.require(evidence.get("status") == "cpu_candidate_controls_passed_not_execution_qualified"
        and evidence.get("candidateId") == CAPABILITY and evidence.get("architectureId") == ARCHITECTURE
        and evidence.get("ownershipRule") == OWNERSHIP_RULE
        and evidence.get("programBindings") == [plan["program"], plan["tests"]]
        and evidence.get("parameterIdentity", {}).get("historicalCheckpointLoaded") is False
        and evidence.get("ruleImplementation", {}).get("coreNeverYields") is True
        and evidence.get("ruleImplementation", {}).get("ownedUnionEqualsExistingTypedCoverageUnion") is True
        and evidence.get("ruleImplementation", {}).get("ownersPairwiseDisjoint") is True
        and evidence.get("ruleImplementation", {}).get("ownerSubsetOfOwnExistingCoverage") is True
        and not any(evidence.get("qualification", {}).get(key) is True for key in
                    ("gpuQualified", "trainingAllowed", "stage4Advanced", "runtimeAllowed", "publicationAllowed")),
        "V23 CPU evidence differs")
    core.require(acceptance.get("status") == "cpu_candidate_independently_verified_not_execution_qualified"
        and acceptance.get("candidateId") == CAPABILITY and acceptance.get("architectureId") == ARCHITECTURE
        and acceptance.get("ownershipRule") == OWNERSHIP_RULE
        and acceptance.get("programBindings") == [plan["program"], plan["tests"]]
        and acceptance.get("sourceCpuEvidence") == plan["cpuEvidence"]
        and acceptance.get("formalSpecification") == plan["formalSpecification"]
        and acceptance.get("sourceBindingsVerified") is True
        and acceptance.get("structuralCodeReviewed") is True
        and acceptance.get("independentTests", {}).get("passed") == 12
        and acceptance.get("independentTests", {}).get("failures") == 0
        and acceptance.get("independentTests", {}).get("errors") == 0
        and acceptance.get("independentTests", {}).get("exitCode") == 0
        and acceptance.get("qualification") == {"gpu": False, "training": False,
            "visual": False, "stage4Advanced": False}, "V23 controller CPU acceptance differs")


def collect_inputs(registry=None):
    context = object_core.collect_inputs(registry)
    reader, inputs = context["reader"], context["inputs"]
    representation = representation_plan()
    evidence, acceptance = reader.json(representation["cpuEvidence"]), reader.json(representation["controllerAcceptance"])
    validate_cpu_acceptance(evidence, acceptance, representation)
    for binding in (representation["program"], representation["tests"], representation["formalSpecification"]):
        reader.read(binding)
    inputs["modelPlan"] = model_plan()
    inputs["representationPlan"] = representation
    inputs["sourcePlan"] = source_plan(inputs)
    inputs["dataPlan"] = data_plan(inputs)
    inputs["inputReceipts"] = [{"path": path, "sha256": digest}
        for path, digest in sorted(reader.observed.items())]
    reader.unchanged()
    return context


def validate_policy(policy, inputs):
    object_core.validate_policy(policy, inputs)
    core.require(inputs.get("modelPlan") == model_plan(), "V23 frozen model plan differs")
    core.require(inputs.get("representationPlan") == representation_plan(), "V23 frozen representation plan differs")
    core.require(inputs.get("sourcePlan") == source_plan(inputs), "V23 frozen source plan differs")
    core.require(inputs.get("dataPlan") == data_plan(inputs), "V23 frozen data plan differs")


def package_from_inputs(inputs, policy_binding, manifest):
    package = object_core.package_from_inputs(inputs, policy_binding, manifest)
    identity = package["experimentIdentity"].replace("v21-object-core-fidelity-", "v23-complete-support-partition-", 1)
    package.update(experimentIdentity=identity, outputRoot=core.OUTPUT_PARENT + "/" + identity)
    package["config"]["modelPlan"] = inputs["modelPlan"]
    package["config"]["representationPlan"] = inputs["representationPlan"]
    package["config"]["sourcePlan"] = inputs["sourcePlan"]
    package["config"]["dataPlan"] = inputs["dataPlan"]
    return package


def observation_evidence(*args):
    return {**object_core.observation_evidence(*args), "modelPlan": model_plan(),
        "representationPlan": representation_plan()}


def validate_result_contract(result, package):
    for key, expected in (("modelPlan", model_plan()), ("representationPlan", representation_plan())):
        core.require(result.get(key) == package["inputs"].get(key) == package["config"].get(key) == expected,
                     "V23 result " + key + " identity differs")
    for key, function in (("sourcePlan", source_plan), ("dataPlan", data_plan)):
        expected = function(package["inputs"])
        core.require(package["inputs"].get(key) == package["config"].get(key) == expected,
                     "V23 result " + key + " identity differs")
    object_core.validate_result_contract(result, package)


def fresh_networks(order, acceptance=None):
    import torch
    from ai_painter.complete_world.native_rgb_conditional_texture_cpu import build_conditional_texture_discriminator
    torch.manual_seed(core.TRAINING["initializationSeed"])
    model = build_fresh_native_rgb_complete_support_partition_v23_cpu(condition_channel_order=order)
    critic = build_conditional_texture_discriminator()
    core.require(model.capability_version == CAPABILITY and model.architecture_id == ARCHITECTURE
        and model.support_ownership_rule == OWNERSHIP_RULE and model.parent_checkpoint_loaded is False,
        "fresh V23 identity differs")
    if acceptance is not None:
        core.require(all(core.cpu.state_hash(network) == acceptance["initial" + name + "StateSha256"]
            for name, network in (("Model", model), ("Critic", critic))), "fresh V23 state differs")
    return model, critic


def _ownership_facts(evidence):
    import torch
    cores = {role: evidence["responsibilityConditions"][role] > .5 for role in TYPED_ROLES}
    coverage = {role: evidence["roleCoverage"][role] > 0 for role in TYPED_ROLES}
    owned = {role: evidence["typedSupportOwnerMasks"][role].bool() for role in TYPED_ROLES}
    support_union = torch.zeros_like(next(iter(owned.values())))
    owned_union = torch.zeros_like(support_union)
    owned_count = torch.zeros_like(support_union, dtype=torch.int8)
    roles = {}
    for role in TYPED_ROLES:
        support_union |= coverage[role]; owned_union |= owned[role]; owned_count += owned[role].to(torch.int8)
        roles[role] = {"corePixels": int(cores[role].sum()), "coveragePixels": int(coverage[role].sum()),
            "ownedPixels": int(owned[role].sum()),
            "coreOwnershipMissingPixels": int((cores[role] & ~owned[role]).sum()),
            "ownerOutsideCoveragePixels": int((owned[role] & ~coverage[role]).sum()),
            "ownerMaskSha256": core.cpu.tensor_hash(owned[role].detach().cpu())}
    return {"roles": roles, "typedSupportUnionPixels": int(support_union.sum()),
        "ownedUnionPixels": int(owned_union.sum()),
        "supportUnionMismatchPixels": int((support_union ^ owned_union).sum()),
        "ownerOverlapPixels": int((owned_count > 1).sum()),
        "ownershipRule": evidence["supportOwnershipRule"]}


def zero_update_probe(model, critic, sample, order, resource, forward):
    captured = []
    original = model.forward

    def instrumented(conditions, instance_table, *args, **kwargs):
        core.require(not args and not kwargs, "V23 probe forward contract differs")
        rgb, evidence = original(conditions, instance_table, return_evidence=True)
        captured.append(_ownership_facts(evidence))
        return rgb

    with patch.object(model, "forward", instrumented):
        result = object_core.zero_update_probe(model, critic, sample, order, resource, forward)
    core.require(len(captured) == 2 and captured[0] == captured[1], "V23 probe ownership evidence differs across real forwards")
    facts = captured[0]
    core.require(facts["supportUnionMismatchPixels"] == 0 and facts["ownerOverlapPixels"] == 0
        and all(row["coreOwnershipMissingPixels"] == row["ownerOutsideCoveragePixels"] == 0
                for row in facts["roles"].values()), "V23 probe ownership invariants failed")
    return {**result, "capabilityVersion": CAPABILITY, "architectureId": ARCHITECTURE,
        "representationId": OWNERSHIP_RULE, "ownershipFacts": facts,
        "conditionTensorSha256": core.cpu.tensor_hash(sample["conditions"].detach().cpu())}


def reload_final_cpu(payload_bytes, expected, order, package_binding, identity):
    import torch
    saved = torch.load(io.BytesIO(payload_bytes), map_location="cpu", weights_only=True)
    core.require(saved.get("schemaVersion") == "ai-painter-learning-capacity-experiment-checkpoint-v1"
        and saved.get("experimentType") == EXPERIMENT_TYPE and saved.get("experimentIdentity") == identity
        and saved.get("executionPackage") == package_binding and saved.get("epoch") == 48
        and saved.get("optimizerSteps") == {"generator": 2304, "discriminator": 2304}
        and saved.get("finalStateSha256") == expected and saved.get("checkpointPromotable") is False
        and saved.get("automaticResumeAllowed") is False, "V23 final checkpoint metadata differs")
    with core.preserve_rng_and_modes():
        model, critic = fresh_networks(order)
        model.load_state_dict(saved["modelState"], strict=True)
        critic.load_state_dict(saved["criticState"], strict=True)
    core.require(model.capability_version == CAPABILITY and model.architecture_id == ARCHITECTURE
        and {"Model": core.cpu.state_hash(model), "Critic": core.cpu.state_hash(critic)} == expected,
        "V23 final checkpoint CPU reload state differs")
    return True


def freeze_policy():
    context = collect_inputs()
    policy = {"schemaVersion": POLICY_SCHEMA, "status": "active_single_bounded_train_only_exposure_experiment",
        "scope": SCOPE, "inputs": context["inputs"], "maxAttempts": 1, "automaticRetries": 0}
    validate_policy(policy, context["inputs"])
    target = core.cpu.project_file(core.ROOT, POLICY_PATH)
    if target.exists():
        core.require(json.loads(target.read_bytes()) == policy, "V23 policy already differs")
    else:
        core.v21.write_exclusive(target, policy)
    return core.bind(POLICY_PATH)


@contextmanager
def successor_profile():
    qualification = deepcopy(core.QUALIFICATION); qualification["scope"] = SCOPE
    paths = sorted(set(core.IMPLEMENTATION_PATHS + [WORKER, TESTS, CONTROLLER_TESTS, RENDERER,
        RENDERER_TEST, CPU_EVIDENCE, CONTROLLER_ACCEPTANCE, FORMAL_SPEC]))
    changes = {"WORKER": WORKER, "TESTS": TESTS, "POLICY_PATH": POLICY_PATH,
        "POLICY_SCHEMA": POLICY_SCHEMA, "EXPERIMENT_TYPE": EXPERIMENT_TYPE, "SCOPE": SCOPE,
        "QUALIFICATION": qualification, "IMPLEMENTATION_PATHS": paths,
        "collect_inputs": collect_inputs, "validate_policy": validate_policy,
        "package_from_inputs": package_from_inputs, "observation_evidence": observation_evidence,
        "validate_result_contract": validate_result_contract, "fresh_networks": fresh_networks,
        "reload_final_cpu": reload_final_cpu, "zero_update_probe": zero_update_probe}
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
