"""CPU gate tests for the V24 managed-entry profile."""
from __future__ import annotations

from contextlib import contextmanager
from copy import deepcopy
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import torch


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v24_object_head_core_priority_probe as successor


V23_ROOT = (ROOT / ".runtime/ai-painter/learning-capacity-experiments/"
    "v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6")


class FakeReader:
    def __init__(self, values): self.values = values
    def json(self, binding): return deepcopy(self.values[binding["path"]])


class V24ManagedEntryProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.v23_package = json.loads((V23_ROOT / "package.json").read_text(encoding="utf8"))
        contract = json.loads((ROOT / cls.v23_package["inputs"]["conditionContract"]["path"])
                              .read_text(encoding="utf8"))
        cls.order = contract["tensorContract"]["channelOrder"]

    @contextmanager
    def placeholder_integration_bindings(self):
        original = successor.core.bind
        def binding(path):
            if path in (successor.RESOURCE_CHECKER_RESULT,
                        successor.RESOURCE_CHECKER_ACCEPTANCE):
                return {"path": path, "sha256": ("a" if path.endswith("result.json") else "b") * 64}
            return original(path)
        with patch.object(successor.core, "bind", side_effect=binding):
            yield

    def complete_inputs(self):
        inputs = deepcopy(self.v23_package["inputs"])
        inputs["modelPlan"] = successor.v23.model_plan()
        inputs["representationPlan"] = successor.historical_v23_representation_plan()
        inputs["sourcePlan"] = successor.v23.source_plan(inputs)
        inputs["dataPlan"] = successor.v23.data_plan(inputs)
        inputs["precisionExecutionPlan"] = successor.precision_plan()
        inputs["updatePlan"] = successor.update_plan()
        inputs["criticStatePlan"] = successor.critic_state_plan()
        inputs["integrationPlan"] = successor.integration_plan()
        inputs["qualityComparisonPlan"] = successor.quality_comparison_plan(inputs)
        inputs["qualification"] = {**successor.core.QUALIFICATION, "scope": successor.SCOPE}
        inputs["resources"] = deepcopy(successor.V5_RESOURCES)
        return inputs

    def test_new_identity_plans_and_package_are_separate_from_renderer(self):
        with self.placeholder_integration_bindings(), successor.successor_profile():
            inputs = self.complete_inputs()
            manifest = json.loads((ROOT / inputs["datasetManifest"]["path"])
                                  .read_text(encoding="utf8"))
            package = successor.package_from_inputs(inputs,
                {"path": successor.POLICY_PATH, "sha256": "c" * 64},
                manifest)
        self.assertEqual(package["experimentType"], successor.EXPERIMENT_TYPE)
        self.assertTrue(package["experimentIdentity"].startswith("v24-resource-bound-core-priority-"))
        self.assertEqual(inputs["updatePlan"]["candidateId"], successor.CANDIDATE_ID)
        self.assertEqual(inputs["modelPlan"]["capabilityVersion"], successor.v23.CAPABILITY)
        self.assertNotEqual(inputs["updatePlan"]["candidateId"],
                            inputs["modelPlan"]["capabilityVersion"])
        self.assertEqual(package["training"]["epochs"], 48)
        self.assertEqual(package["resources"]["maxWallSeconds"], 2700)
        self.assertEqual(successor.core.RESOURCES["maxWallSeconds"], 1800)
        changed = {key for key in successor.V5_RESOURCES
                   if successor.V5_RESOURCES[key] != successor.core.RESOURCES[key]}
        self.assertEqual(changed, {"maxWallSeconds"})
        self.assertEqual(package["config"]["precisionExecutionPlan"], successor.precision_plan())
        self.assertFalse(package["qualification"]["checkpointPromotable"])

    def test_precision_update_and_quality_plans_are_exact_and_no_old_qualification(self):
        with self.placeholder_integration_bindings():
            inputs = self.complete_inputs()
        precision = inputs["precisionExecutionPlan"]
        self.assertEqual(precision["generatorForward"],
                         "explicit_ieee_fp32_matmul_and_convolution_no_autocast")
        self.assertEqual(precision["generatorPrecisionContext"],
                         "current_fp32_precision_api_scoped_and_restored_on_success_or_failure")
        self.assertEqual(precision["discriminatorUpdate"],
                         "inherited_cuda_bfloat16_autocast_original_objective_and_order")
        self.assertTrue(inputs["updatePlan"]["actualTotalIndependentFullModelGradient"])
        self.assertEqual(inputs["updatePlan"]["objectHeadParameterTensorCount"], 16)
        self.assertEqual(inputs["updatePlan"]["nonHeadParameterTensorCount"], 90)
        self.assertFalse(inputs["integrationPlan"]["gpuQualified"])
        self.assertFalse(inputs["integrationPlan"]["trainingAllowed"])
        self.assertEqual(inputs["criticStatePlan"]["discriminatorPhase"]["mode"],
                         "critic_train_all_submodules")
        self.assertEqual(inputs["criticStatePlan"]["generatorPhase"]["mode"],
                         "critic_eval_all_submodules")
        self.assertTrue(inputs["criticStatePlan"]["restoration"]["generatorCommitFailure"])
        self.assertEqual(len(inputs["qualityComparisonPlan"]["requiredStrictMeanDecreases"]), 5)
        self.assertFalse(inputs["qualityComparisonPlan"]["improvementOffsetAllowed"])

    def test_reference_and_integration_evidence_fail_closed(self):
        with self.placeholder_integration_bindings():
            update = successor.update_plan()
            plan = successor.integration_plan()
        reader = successor.core.cpu.BoundReader()
        successor.validate_reference_evidence(reader, update)
        original = json.loads((ROOT / successor.INTEGRATION_EVIDENCE).read_text(encoding="utf8"))
        original_acceptance = json.loads(
            (ROOT / successor.INTEGRATION_ACCEPTANCE).read_text(encoding="utf8"))
        predecessor = json.loads(
            (ROOT / successor.CHECKER_RESULT).read_text(encoding="utf8"))
        predecessor_acceptance = json.loads(
            (ROOT / successor.CHECKER_ACCEPTANCE).read_text(encoding="utf8"))
        current_bindings = [successor.core.bind(path) for path in
            (successor.CONTROLLER, successor.WORKER, successor.TESTS,
             successor.CONTROLLER_TESTS, successor.EXPOSURE_WORKER,
             successor.RESOURCE_CHECKER_PROGRAM, successor.RESOURCE_CHECKER_TESTS,
             successor.CURRENT_SPEC)]
        checker_result = {
            "schemaVersion": "ai-painter-v24-resource-binding-result-v1",
            "status": "v24_resource_binding_recomputed_no_model_execution",
            "candidateId": successor.CANDIDATE_ID,
            "currentProgramBindings": current_bindings,
            "historicalSnapshots": plan["frozenSourceSnapshots"],
            "predecessorCheckerResult": plan["predecessorCheckerResult"],
            "predecessorCheckerAcceptance":
                plan["predecessorCheckerControllerAcceptance"],
            "resourceRevisionPlan": plan["resourceRevisionPlan"],
            "protectedFacts": {
                "trainingAlgorithmAstIdentical": True,
                "updateSourceSha256":
                    "b8c0e84732d4911a667c41c27bf927b65bff4ae1a78f7a5644e599c193dacab0",
                "changedExposureWorkerChecks": 3},
            "actualExecutionCounts": {"modelForwards": 0, "autogradGradCalls": 0,
                "backwardCalls": 0, "optimizerSteps": 0, "decodes": 0,
                "gpuQueries": 0, "checkpointReads": 0, "checkpointWrites": 0,
                "pngWrites": 0, "trainingRuns": 0},
            "boundary": {"modelImported": False, "modelExecuted": False,
                "gpuQueried": False, "trainingStarted": False,
                "registryWritten": False, "policyWritten": False,
                "packagePrepared": False}}
        checker_acceptance = {
            "schemaVersion":
                "ai-painter-v24-resource-binding-controller-acceptance-v1",
            "status":
                "v24_resource_binding_independently_verified_not_gpu_or_training_qualified",
            "candidateId": successor.CANDIDATE_ID,
            "sourceResult": plan["checkerResult"],
            "verifiedCurrentProgramBindings": current_bindings,
            "verifiedHistoricalSnapshots": plan["frozenSourceSnapshots"],
            "verifiedResourceRevisionPlan": plan["resourceRevisionPlan"],
            "qualification": {"gpu": False, "training": False,
                "visual": False, "stage4Advanced": False}}
        values = {successor.INTEGRATION_EVIDENCE: original,
            successor.INTEGRATION_ACCEPTANCE: original_acceptance,
            successor.CHECKER_RESULT: predecessor,
            successor.CHECKER_ACCEPTANCE: predecessor_acceptance,
            successor.RESOURCE_CHECKER_RESULT: checker_result,
            successor.RESOURCE_CHECKER_ACCEPTANCE: checker_acceptance}
        fake = FakeReader(values)
        successor.validate_integration_evidence(fake, plan, self.v23_package["inputs"])
        bad = deepcopy(checker_result)
        bad["actualExecutionCounts"]["modelForwards"] = 1
        with self.assertRaisesRegex(ValueError, "resource binding evidence"):
            successor.validate_integration_evidence(FakeReader({**values,
                successor.RESOURCE_CHECKER_RESULT: bad}), plan,
                self.v23_package["inputs"])
        bad_acceptance = deepcopy(checker_acceptance)
        bad_acceptance["qualification"]["gpu"] = True
        with self.assertRaisesRegex(ValueError, "resource binding controller acceptance"):
            successor.validate_integration_evidence(FakeReader({**values,
                successor.RESOURCE_CHECKER_ACCEPTANCE: bad_acceptance}), plan,
                self.v23_package["inputs"])

    def test_old_cpu_integration_binding_is_not_current_after_128_route(self):
        plan = {"originalEvidence": successor.core.bind(successor.OLD_INTEGRATION_EVIDENCE),
                "originalControllerAcceptance": successor.core.bind(successor.OLD_INTEGRATION_ACCEPTANCE)}
        reader = successor.core.cpu.BoundReader()
        with self.assertRaisesRegex(ValueError, "V24 integration CPU evidence differs"):
            successor.validate_integration_evidence(reader, plan)

    def test_profile_uses_v23_fresh_factory_and_restores_after_failure(self):
        model, critic = successor.fresh_networks(self.order)
        self.assertEqual(model.capability_version, successor.v23.CAPABILITY)
        self.assertEqual(model.architecture_id, successor.v23.ARCHITECTURE)
        self.assertFalse(model.parent_checkpoint_loaded)
        before = {name: getattr(successor.core, name) for name in
                  ("fresh_networks", "perform_pair", "zero_update_probe", "run")}
        with successor.successor_profile():
            self.assertIs(successor.core.perform_pair, successor.perform_pair)
            self.assertIs(successor.core.zero_update_probe, successor.zero_update_probe)
            self.assertIs(successor.core.run, successor.run)
        self.assertEqual(before, {name: getattr(successor.core, name) for name in before})
        with self.assertRaisesRegex(RuntimeError, "deliberate"):
            with successor.successor_profile():
                raise RuntimeError("deliberate")
        self.assertEqual(before, {name: getattr(successor.core, name) for name in before})
        del model, critic

    def test_generator_forward_objective_and_four_grads_share_fp32_context(self):
        active = []
        @contextmanager
        def precision_context():
            active.append(True)
            try:
                yield
            finally:
                active.pop()

        sentinel_prediction = object()
        parts = {"v21UnchangedTotal": torch.tensor(1.),
                 "wholeFrameFidelity": torch.tensor(2.),
                 "objectCoreRgbWeighted": torch.tensor(3.)}
        total = torch.tensor(6.)
        def forward(kind, sample):
            self.assertTrue(active); self.assertEqual(kind, "probe")
            return sentinel_prediction
        def objective(critic, prediction, sample, table, order):
            self.assertTrue(active); self.assertIs(prediction, sentinel_prediction)
            return total, parts
        def compute(**kwargs):
            self.assertTrue(active); self.assertIs(kwargs["actual_total"], total)
            return (torch.tensor(1.),), {"ok": True}
        sample = {"objectInstanceTable": object()}
        with patch.object(successor, "generator_full_fp32_backend", precision_context), \
             patch.object(successor, "train_object_core_fidelity_candidate_objective",
                          side_effect=objective), \
             patch.object(successor, "compute_v24_generator_candidate_gradients",
                          side_effect=compute):
            values = successor.generator_candidate_for_sample(
                object(), object(), sample, self.order, forward, "probe")
        self.assertFalse(active)
        self.assertIs(values[0], sentinel_prediction)
        self.assertIs(values[1], total)
        self.assertEqual(values[4], {"ok": True})

    def _pair_fixture(self):
        model = torch.nn.Sequential(torch.nn.Linear(2, 2), torch.nn.Tanh())
        critic = torch.nn.Sequential(torch.nn.Linear(2, 2),
                                     torch.nn.Sequential(torch.nn.Linear(2, 1)))
        critic.eval()
        critic[1].train()
        parameters = tuple(critic.parameters())
        parameters[0].requires_grad_(False)
        parameters[-1].requires_grad_(False)
        entry_modes = tuple(module.training for module in critic.modules())
        entry_trainable = tuple(value.requires_grad for value in parameters)
        sample = {"sampleId": "train-30", "split": "train", "trainOrdinal": 30,
                  "image": torch.zeros(2), "conditions": torch.zeros(2),
                  "objectInstanceTable": {}}
        counts = {"generator": 0, "discriminator": 0}
        ledger = {"sampleId": sample["sampleId"], "generator": 0, "discriminator": 0}
        g_optimizer = torch.optim.AdamW(model.parameters(), lr=.0001, foreach=False, fused=False)
        d_optimizer = torch.optim.AdamW(critic.parameters(), lr=.0001, foreach=False, fused=False)
        return model, critic, sample, counts, ledger, g_optimizer, d_optimizer, entry_modes, entry_trainable

    def test_actual_perform_pair_control_path_is_d_train_g_eval_and_restores_across_next_d(self):
        values = self._pair_fixture()
        model, critic, sample, counts, ledger, g_optimizer, d_optimizer = values[:7]
        entry_modes, entry_trainable = values[7:]
        events = []
        def forward(kind, bound):
            self.assertEqual(kind, "training")
            self.assertTrue(all(module.training for module in critic.modules()))
            self.assertTrue(all(value.requires_grad for value in critic.parameters()))
            events.append("D")
            return model(bound["conditions"])
        def discriminator_update(optimizer, loss, network, bound, name, current, limit, resource):
            self.assertTrue(all(module.training for module in critic.modules()))
            self.assertTrue(all(value.requires_grad for value in critic.parameters()))
            with torch.no_grad(): next(network.parameters()).add_(.001)
            current[name] += 1
        def generator_candidate(*args):
            self.assertTrue(all(not module.training for module in critic.modules()))
            self.assertTrue(all(not value.requires_grad for value in critic.parameters()))
            events.append("G")
            parts = {"v21UnchangedTotal": torch.tensor(0.),
                     "wholeFrameFidelity": torch.tensor(0.),
                     "objectCoreRgbWeighted": torch.tensor(0.)}
            facts = {"headDiagnostics": {key: {"branch": "non_conflict_preserve_actual_total"}
                     for key in ("object_footprints", "object_tree", "object_rock", "object_vegetation")}}
            return torch.zeros(2), torch.tensor(0.), parts, tuple(
                torch.zeros_like(value) for value in model.parameters()), facts
        def generator_commit(**kwargs):
            self.assertTrue(all(not module.training for module in critic.modules()))
            self.assertTrue(all(not value.requires_grad for value in critic.parameters()))
            kwargs["counts"]["generator"] += 1
        with patch.object(successor.core.gpu, "detached_discriminator_objective",
                          return_value=(torch.tensor(0.), {})), \
             patch.object(successor.core.v21, "update_network", side_effect=discriminator_update), \
             patch.object(successor, "generator_candidate_for_sample", side_effect=generator_candidate), \
             patch.object(successor, "commit_generator_step", side_effect=generator_commit):
            for _ in range(2):
                result = successor.perform_pair(model, critic, sample, self.order,
                    g_optimizer, d_optimizer, counts, ledger, lambda: None, forward)
                self.assertTrue(result["criticGeneratorPhaseUnchanged"])
                self.assertEqual(tuple(module.training for module in critic.modules()), entry_modes)
                self.assertEqual(tuple(value.requires_grad for value in critic.parameters()),
                                 entry_trainable)
        self.assertEqual(events[:3], ["D", "G", "D"])
        self.assertEqual(counts, {"generator": 2, "discriminator": 2})
        self.assertEqual({key: ledger[key] for key in counts}, counts)

    def test_actual_perform_pair_restores_exact_flags_and_preserves_real_steps_on_all_failures(self):
        scenarios = {
            "d_objective": (0, 0), "d_resource": (0, 0), "d_commit": (0, 1),
            "g_objective": (0, 1), "g_gradient": (0, 1), "g_resource": (0, 1),
            "g_commit": (1, 1)}
        for scenario, (expected_g, expected_d) in scenarios.items():
            with self.subTest(scenario=scenario):
                values = self._pair_fixture()
                model, critic, sample, counts, ledger, g_optimizer, d_optimizer = values[:7]
                entry_modes, entry_trainable = values[7:]
                def forward(kind, bound):
                    self.assertTrue(all(module.training for module in critic.modules()))
                    self.assertTrue(all(value.requires_grad for value in critic.parameters()))
                    return model(bound["conditions"])
                def d_objective(*args):
                    if scenario == "d_objective": raise RuntimeError(scenario)
                    return torch.tensor(0.), {}
                def d_update(optimizer, loss, network, bound, name, current, limit, resource):
                    self.assertTrue(all(module.training for module in critic.modules()))
                    self.assertTrue(all(value.requires_grad for value in critic.parameters()))
                    if scenario == "d_resource": raise RuntimeError(scenario)
                    with torch.no_grad(): next(network.parameters()).add_(.001)
                    current[name] += 1
                    if scenario == "d_commit": raise RuntimeError(scenario)
                def g_candidate(*args):
                    self.assertTrue(all(not module.training for module in critic.modules()))
                    self.assertTrue(all(not value.requires_grad for value in critic.parameters()))
                    if scenario in ("g_objective", "g_gradient"): raise RuntimeError(scenario)
                    facts = {"headDiagnostics": {key: {"branch": "non_conflict_preserve_actual_total"}
                             for key in ("object_footprints", "object_tree", "object_rock", "object_vegetation")}}
                    return torch.zeros(2), torch.tensor(0.), {}, tuple(
                        torch.zeros_like(value) for value in model.parameters()), facts
                def g_commit(**kwargs):
                    self.assertTrue(all(not module.training for module in critic.modules()))
                    self.assertTrue(all(not value.requires_grad for value in critic.parameters()))
                    if scenario == "g_resource": raise RuntimeError(scenario)
                    kwargs["counts"]["generator"] += 1
                    if scenario == "g_commit": raise RuntimeError(scenario)
                with patch.object(successor.core.gpu, "detached_discriminator_objective",
                                  side_effect=d_objective), \
                     patch.object(successor.core.v21, "update_network", side_effect=d_update), \
                     patch.object(successor, "generator_candidate_for_sample", side_effect=g_candidate), \
                     patch.object(successor, "commit_generator_step", side_effect=g_commit):
                    with self.assertRaisesRegex(RuntimeError, scenario):
                        successor.perform_pair(model, critic, sample, self.order,
                            g_optimizer, d_optimizer, counts, ledger, lambda: None, forward)
                self.assertEqual(counts, {"generator": expected_g, "discriminator": expected_d})
                self.assertEqual({key: ledger[key] for key in counts}, counts)
                self.assertEqual(tuple(module.training for module in critic.modules()), entry_modes)
                self.assertEqual(tuple(value.requires_grad for value in critic.parameters()),
                                 entry_trainable)

    def test_generator_phase_detects_critic_parameter_buffer_or_gradient_mutation(self):
        for mutation in ("parameter", "buffer", "gradient"):
            with self.subTest(mutation=mutation):
                values = self._pair_fixture()
                model, critic, sample, counts, ledger, g_optimizer, d_optimizer = values[:7]
                critic.register_buffer("test_buffer", torch.zeros(1))
                def forward(kind, bound): return model(bound["conditions"])
                def d_update(optimizer, loss, network, bound, name, current, limit, resource):
                    current[name] += 1
                def g_candidate(*args):
                    parameter = next(critic.parameters())
                    if mutation == "parameter":
                        with torch.no_grad(): parameter.add_(1)
                    elif mutation == "buffer": critic.test_buffer.add_(1)
                    else: parameter.grad = torch.ones_like(parameter)
                    raise RuntimeError("generator failure")
                with patch.object(successor.core.gpu, "detached_discriminator_objective",
                                  return_value=(torch.tensor(0.), {})), \
                     patch.object(successor.core.v21, "update_network", side_effect=d_update), \
                     patch.object(successor, "generator_candidate_for_sample", side_effect=g_candidate):
                    with self.assertRaisesRegex(ValueError,
                            "generator phase changed critic parameters, buffers, or gradients"):
                        successor.perform_pair(model, critic, sample, self.order,
                            g_optimizer, d_optimizer, counts, ledger, lambda: None, forward)

    def test_policy_and_checkpoint_reject_old_identity(self):
        with self.placeholder_integration_bindings(), successor.successor_profile():
            inputs = self.complete_inputs()
            policy = {"schemaVersion": successor.POLICY_SCHEMA,
                "status": "active_single_bounded_train_only_exposure_experiment",
                "scope": successor.SCOPE, "inputs": inputs, "maxAttempts": 1,
                "automaticRetries": 0}
            successor.core.validate_policy(policy, inputs)
            bad = deepcopy(policy); bad["inputs"]["integrationPlan"]["trainingAllowed"] = True
            with self.assertRaises(ValueError): successor.core.validate_policy(bad, bad["inputs"])
            for old in (successor.HISTORICAL_POLICY_PATH, successor.HISTORICAL_IEEE_POLICY_PATH,
                        successor.HISTORICAL_CRITIC_MODE_POLICY_PATH,
                        successor.HISTORICAL_CHECKER_BOUND_POLICY_PATH,
                        successor.v23.POLICY_PATH,
                        successor.object_core.POLICY_PATH):
                with self.assertRaisesRegex(ValueError, "wrong exposure policy"):
                    successor.core.prepare(old)

        model, critic = successor.fresh_networks(self.order)
        expected = {"Model": successor.core.cpu.state_hash(model),
                    "Critic": successor.core.cpu.state_hash(critic)}
        package = {"path": ".runtime/example/package.json", "sha256": "1" * 64}
        identity = "v24-core-priority-test"
        payload = {"schemaVersion": "ai-painter-learning-capacity-experiment-checkpoint-v1",
            "experimentType": successor.EXPERIMENT_TYPE, "experimentIdentity": identity,
            "executionPackage": package, "epoch": 48,
            "optimizerSteps": {"generator": 2304, "discriminator": 2304},
            "finalStateSha256": expected, "checkpointPromotable": False,
            "automaticResumeAllowed": False, "modelState": model.state_dict(),
            "criticState": critic.state_dict()}
        stream = io.BytesIO(); torch.save(payload, stream)
        self.assertTrue(successor.reload_final_cpu(stream.getvalue(), expected, self.order,
                                                   package, identity))
        payload["experimentType"] = successor.v23.EXPERIMENT_TYPE
        stream = io.BytesIO(); torch.save(payload, stream)
        with self.assertRaisesRegex(ValueError, "metadata"):
            successor.reload_final_cpu(stream.getvalue(), expected, self.order, package, identity)


if __name__ == "__main__":
    unittest.main()
