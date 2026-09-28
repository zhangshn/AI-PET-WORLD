"""Explicit process-local successor profile for the existing bounded worker.

Reuse resource, authentication, observation, checkpoint and failure handling;
never rewrite the completed exposure worker or patch its imported Loss module.
The adapter is restored on exit and is not a second supervisor or background.
"""
from contextlib import ExitStack, contextmanager, nullcontext
from copy import deepcopy
from unittest.mock import patch
import json
import sys

import painter_stage4_v21_full_train_exposure_probe as core
from ai_painter.complete_world.native_rgb_whole_frame_fidelity_candidate_cpu import (
    CANDIDATE_ID, FULL_RGB_WEIGHT, FULL_EDGE_WEIGHT,
    train_whole_frame_fidelity_candidate_objective,
)

WORKER = "ml/ai-painter/scripts/painter_stage4_v21_whole_frame_fidelity_probe.py"
TESTS = "ml/ai-painter/tests/test_stage4_v21_whole_frame_fidelity_probe.py"
POLICY_PATH = "data/ai-painter/system-governance/stage4-mvp-v21-whole-frame-fidelity-policy-v2.json"
POLICY_SCHEMA = "stage4-mvp-v21-whole-frame-fidelity-policy-v2"
EXPERIMENT_TYPE = "whole_frame_fidelity_train_only"
SCOPE = "whole_frame_fidelity_train_only_no_generalization_claim"
OBJECTIVE = "ml/ai-painter/src/ai_painter/complete_world/native_rgb_whole_frame_fidelity_candidate_cpu.py"
OBJECTIVE_TEST = "ml/ai-painter/tests/test_native_rgb_whole_frame_fidelity_candidate_cpu.py"
CPU_EVIDENCE = (".runtime/ai-painter/learning-capacity-experiments/"
    "v21-full-train-exposure-5464211239b5f3b53e0a2675c9fe5f7e208c21ab7bbb6ed6/"
    "controller-whole-frame-fidelity-cpu-candidate.json")
HEARTBEAT_PUBLICATION_RULE = {"maxReplaceAttempts": 21, "retryDelayMilliseconds": 100,
    "maxWaitMilliseconds": 2000, "sameStagedBytesOnly": True,
    "preservePreviousHeartbeat": True, "automaticTrainingRetries": 0}
PREDECESSOR_ROOT = (".runtime/ai-painter/learning-capacity-experiments/"
    "v21-whole-frame-fidelity-fbc31699f385c55860942bdd78d6c5c47c2debf61ee5e680/")
PREDECESSOR_FAILURE = {"path": PREDECESSOR_ROOT + "controller-failure.json",
    "sha256": "04ee2b5c26c96f15356ff5b574c4830ab093e573a7ee76f4851f8cd271676a4e"}
REPAIR_EVIDENCE = {"path": PREDECESSOR_ROOT + "controller-heartbeat-publication-repair.json",
    "sha256": "1a306782f7d28ca9f5b74c512d96494a989fa67e2407a25c14e4fd07ba88cfa1"}

base_collect = core.collect_inputs
base_package = core.package_from_inputs
base_validate_policy = core.validate_policy
base_validate_result = core.validate_result_contract
base_observation_evidence = core.observation_evidence


def objective_plan():
    return {"candidateId": CANDIDATE_ID, "program": core.bind(OBJECTIVE),
        "tests": core.bind(OBJECTIVE_TEST), "cpuEvidence": core.bind(CPU_EVIDENCE),
        "formula": "unchanged_v21_total_plus_full_rgb_l1_plus_signed_adjacent_edge_l1",
        "rgbWeight": FULL_RGB_WEIGHT, "edgeWeight": FULL_EDGE_WEIGHT,
        "coefficientSelection": "fixed_inherited_v13_coefficients_no_search",
        "targetSplit": "train", "existingTermsPreserved": True,
        "historicalComparisonPurpose": "changed_loss_comparison_not_numerical_reproduction",
        "qualificationGranted": False}


def collect_inputs(registry=None):
    context = base_collect(registry)
    plan = objective_plan()
    reader = context["reader"]
    evidence = reader.json(plan["cpuEvidence"])
    core.require(evidence.get("status") == "cpu_candidate_verified_inactive_no_gpu"
        and evidence.get("candidateId") == CANDIDATE_ID
        and evidence.get("executionQualified") is False
        and evidence.get("tests", {}).get("exitCode") == 0
        and evidence["gradientDiagnostic"]["programBindings"] == [plan["program"], plan["tests"]],
        "whole-frame CPU evidence/program binding differs")
    for key in ("program", "tests"):
        reader.read(plan[key])
    context["inputs"]["objectivePlan"] = plan
    failure, repair = reader.json(PREDECESSOR_FAILURE), reader.json(REPAIR_EVIDENCE)
    core.require(failure.get("status") == "experiment_controller_failed_closed"
        and "EPERM" in failure.get("error", "") and "heartbeat.json" in failure.get("error", "")
        and repair.get("status") == "cpu_repair_verified_not_production_training_qualified"
        and repair.get("verification", {}).get("node", {}).get("exitCode") == 0
        and repair.get("verification", {}).get("cpu", {}).get("exitCode") == 0,
        "heartbeat infrastructure predecessor/repair evidence differs")
    context["inputs"]["heartbeatPublicationRule"] = deepcopy(HEARTBEAT_PUBLICATION_RULE)
    context["inputs"]["infrastructureRecovery"] = {"predecessorFailure": PREDECESSOR_FAILURE,
        "repairEvidence": REPAIR_EVIDENCE, "oldRunResumed": False,
        "historicalCheckpointLoaded": False, "newGpuQualificationRequired": True}
    context["inputs"]["inputReceipts"] = [{"path": path, "sha256": digest}
        for path, digest in sorted(reader.observed.items())]
    reader.unchanged()
    return context


def validate_policy(policy, inputs):
    base_validate_policy(policy, inputs)
    core.require(inputs.get("objectivePlan") == objective_plan(),
                 "whole-frame frozen objective differs")
    core.require(json.dumps(inputs.get("heartbeatPublicationRule"), sort_keys=True)
        == json.dumps(HEARTBEAT_PUBLICATION_RULE, sort_keys=True),
        "whole-frame frozen heartbeat publication differs")


def package_from_inputs(inputs, policy_binding, manifest):
    package = base_package(inputs, policy_binding, manifest)
    identity = package["experimentIdentity"].replace("v21-full-train-exposure-", "v21-whole-frame-fidelity-", 1)
    package.update(experimentIdentity=identity, outputRoot=core.OUTPUT_PARENT + "/" + identity)
    package["config"]["objectivePlan"] = inputs["objectivePlan"]
    return package


def observation_evidence(*args):
    return {**base_observation_evidence(*args), "objectivePlan": objective_plan(),
            "heartbeatPublicationRule": deepcopy(HEARTBEAT_PUBLICATION_RULE),
            "historicalComparisonPurpose": "changed_loss_comparison_not_numerical_reproduction"}


def validate_result_contract(result, package):
    core.require(result.get("objectivePlan") == package["inputs"].get("objectivePlan") == objective_plan(),
                 "whole-frame result objective identity differs")
    core.require(json.dumps(result.get("heartbeatPublicationRule"), sort_keys=True)
        == json.dumps(package["inputs"].get("heartbeatPublicationRule"), sort_keys=True)
        == json.dumps(HEARTBEAT_PUBLICATION_RULE, sort_keys=True),
        "whole-frame result heartbeat identity differs")
    base_validate_result(result, package)


def freeze_policy():
    """Generate one immutable machine policy from recomputed, bounded inputs."""
    context = collect_inputs()
    policy = {"schemaVersion": POLICY_SCHEMA,
        "status": "active_single_bounded_train_only_exposure_experiment", "scope": SCOPE,
        "inputs": context["inputs"], "maxAttempts": 1, "automaticRetries": 0}
    validate_policy(policy, context["inputs"])
    target = core.cpu.project_file(core.ROOT, POLICY_PATH)
    if target.exists():
        core.require(json.loads(target.read_bytes()) == policy, "frozen successor policy already differs")
    else:
        core.v21.write_exclusive(target, policy)
    return core.bind(POLICY_PATH)


def perform_pair(model, critic, sample, order, generator_optimizer, critic_optimizer,
                 counts, ledger_row, resource, forward, after_update=lambda name, loss: None):
    import torch
    core.require(sample["split"] == "train" and sample["sampleId"] == ledger_row["sampleId"], "update source differs")
    device = next(model.parameters()).device
    bound = {**sample, "conditions": sample["conditions"].to(device), "image": sample["image"].to(device)}
    autocast = lambda: torch.autocast("cuda", dtype=torch.bfloat16) if device.type == "cuda" else nullcontext()

    def update(optimizer, loss, network, name):
        before = counts[name]
        try:
            core.v21.update_network(optimizer, loss, network, bound, name, counts, 2304, resource)
        finally:
            ledger_row[name] += counts[name] - before
            after_update(name, float(loss.detach()))

    generator_optimizer.zero_grad(set_to_none=True)
    critic.requires_grad_(True)
    core.capacity.require_critic_mode(critic, trainable=True)
    with torch.no_grad(), autocast():
        detached = forward("training", bound)
    with autocast():
        d_loss, _ = core.gpu.detached_discriminator_objective(critic, detached, bound)
    update(critic_optimizer, d_loss, critic, "discriminator")
    core.require(all(p.grad is None for p in model.parameters()), "discriminator leaked generator gradient")
    critic_optimizer.zero_grad(set_to_none=True)
    critic.requires_grad_(False)
    core.capacity.require_critic_mode(critic, trainable=False)
    with autocast():
        prediction = forward("training", bound)
        g_loss, parts = train_whole_frame_fidelity_candidate_objective(
            critic, prediction, bound, sample["objectInstanceTable"], order)
    update(generator_optimizer, g_loss, model, "generator")
    core.require(all(p.grad is None for p in critic.parameters()), "generator leaked frozen critic gradient")
    return {"generatorLoss": float(g_loss.detach()), "discriminatorLoss": float(d_loss.detach()),
        **{key: float(parts[key].detach()) for key in
           ("v21UnchangedTotal", "wholeFrameRgbMae", "wholeFrameSignedEdgeMae", "wholeFrameFidelity")}}


def zero_update_probe(model, critic, sample, order, resource, forward):
    import torch
    before = {name: core.cpu.state_hash(network) for name, network in (("Model", model), ("Critic", critic))}
    enabled = [(p, p.requires_grad) for network in (model, critic) for p in network.parameters()]
    core.require(all(p.grad is None for p, _ in enabled), "probe requires clean initial gradients")
    with core.preserve_rng_and_modes(model, critic), \
         patch.object(torch.optim.Optimizer, "__init__", side_effect=RuntimeError("probe optimizer prohibited")), \
         patch.object(torch, "load", side_effect=RuntimeError("probe checkpoint load prohibited")), \
         patch.object(torch, "save", side_effect=RuntimeError("probe checkpoint write prohibited")):
        try:
            model.eval(); critic.eval()
            critic.requires_grad_(False)
            core.capacity.require_critic_mode(critic, trainable=False)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                predicted = forward("probe", sample)
                loss, parts = train_whole_frame_fidelity_candidate_objective(
                    critic, predicted, sample, sample["objectInstanceTable"], order)
            core.require(bool(torch.isfinite(loss)), "nonfinite generator probe")
            terms = {key: float(parts[key].detach()) for key in
                ("v21UnchangedTotal", "wholeFrameRgbMae", "wholeFrameSignedEdgeMae", "wholeFrameFidelity")}
            loss.backward()
            generator_facts = core.gpu.gradient_facts(model, "cuda")
            head_facts = core.v21.v21gpu._head_gradients(model)
            core.require(all(p.grad is None for p in critic.parameters()), "probe generator leaked critic gradient")
            resource()
            model.zero_grad(set_to_none=True); critic.zero_grad(set_to_none=True)
            critic.requires_grad_(True)
            core.capacity.require_critic_mode(critic, trainable=True)
            with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
                detached = forward("probe", sample)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                d_loss, _ = core.gpu.detached_discriminator_objective(critic, detached, sample)
            core.require(bool(torch.isfinite(d_loss)), "nonfinite discriminator probe")
            d_loss.backward()
            discriminator_facts = core.gpu.gradient_facts(critic, "cuda")
            core.require(all(p.grad is None for p in model.parameters()), "probe discriminator leaked generator gradient")
            resource()
        finally:
            model.zero_grad(set_to_none=True); critic.zero_grad(set_to_none=True)
            for p, flag in enabled:
                p.requires_grad_(flag)
            core.require(before == {name: core.cpu.state_hash(network) for name, network in (("Model", model), ("Critic", critic))},
                         "zero-update probe mutated state")
    return {"passed": True, "optimizerCreated": False, "optimizerSteps": {"generator": 0, "discriminator": 0},
        "initialStateSha256": before, "finalStateSha256": before, "generatorGradients": generator_facts,
        "discriminatorGradients": discriminator_facts, "objectHeadGradientAbsoluteSums": head_facts,
        "objectiveId": CANDIDATE_ID, "objectiveTerms": terms}


@contextmanager
def successor_profile():
    qualification = {**core.QUALIFICATION, "scope": SCOPE}
    paths = sorted(set(core.IMPLEMENTATION_PATHS + [WORKER, TESTS, OBJECTIVE, OBJECTIVE_TEST,
        "scripts/tests/test-ai-painter-experiment-heartbeat.mjs",
        "scripts/tests/test-ai-painter-whole-frame-fidelity-controller.mjs",
        "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"]))
    overrides = {"WORKER": WORKER, "TESTS": TESTS, "POLICY_PATH": POLICY_PATH,
        "POLICY_SCHEMA": POLICY_SCHEMA, "EXPERIMENT_TYPE": EXPERIMENT_TYPE,
        "SCOPE": SCOPE, "QUALIFICATION": qualification, "IMPLEMENTATION_PATHS": paths,
        "collect_inputs": collect_inputs, "validate_policy": validate_policy,
        "package_from_inputs": package_from_inputs, "observation_evidence": observation_evidence,
        "validate_result_contract": validate_result_contract, "perform_pair": perform_pair,
        "zero_update_probe": zero_update_probe}
    with ExitStack() as stack:
        for name, value in overrides.items():
            stack.enter_context(patch.object(core, name, value))
        yield core


if __name__ == "__main__":
    with successor_profile():
        if sys.argv[1:] == ["freeze"]:
            print(json.dumps(freeze_policy()))
        else:
            core.main()
