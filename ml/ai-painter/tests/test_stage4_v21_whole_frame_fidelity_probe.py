"""CPU execution integration and preserved limits for the isolated successor."""
from contextlib import nullcontext
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v21_whole_frame_fidelity_probe as successor
import test_stage4_v21_full_train_exposure_probe as legacy
import test_native_rgb_whole_frame_fidelity_candidate_cpu as objective_tests


class FidelityObjectiveTests(objective_tests.WholeFrameFidelityCandidateCpuTests):
    """Run all thirteen objective counterexamples with entrypoint integration."""


class FidelityExecutionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.profile = successor.successor_profile()
        cls.core = cls.profile.__enter__()
        try:
            with patch.object(torch, "load", side_effect=AssertionError("preflight checkpoint read")), \
                 patch.object(cls.core.cpu, "load_sample", side_effect=AssertionError("preflight pixel decode")), \
                 patch.object(torch.cuda, "is_available", side_effect=AssertionError("preflight CUDA")):
                cls.context = cls.core.collect_inputs()
        except BaseException:
            cls.profile.__exit__(*sys.exc_info())
            raise

    @classmethod
    def tearDownClass(cls):
        cls.profile.__exit__(None, None, None)

    policy = legacy.ExposureTests.policy
    synthetic_records = legacy.ExposureTests.synthetic_records
    fixture_bytes = legacy.ExposureTests.fixture_bytes
    windows_error = staticmethod(legacy.ExposureTests.windows_error)

    def completed_fixture(self):
        result, package, payloads = legacy.ExposureTests.completed_fixture(self)
        result["objectivePlan"] = successor.objective_plan()
        result["heartbeatPublicationRule"] = deepcopy(successor.HEARTBEAT_PUBLICATION_RULE)
        return result, package, payloads

    test_exact_dataset_current_train_and_all48_gpu_cases = legacy.ExposureTests.test_exact_dataset_current_train_and_all48_gpu_cases
    test_no_nontrain_assets_or_split_files_read = legacy.ExposureTests.test_no_nontrain_assets_or_split_files_read
    test_all_epochs_visit_each_train_once_with_original_shuffle = legacy.ExposureTests.test_all_epochs_visit_each_train_once_with_original_shuffle
    test_real_fresh_model_and_critic_match_acceptance_without_checkpoint = legacy.ExposureTests.test_real_fresh_model_and_critic_match_acceptance_without_checkpoint
    test_observation_restores_rng_exact_mixed_modes_and_gradients = legacy.ExposureTests.test_observation_restores_rng_exact_mixed_modes_and_gradients
    test_exposure_ledger_not_replaceable_by_total_count = legacy.ExposureTests.test_exposure_ledger_not_replaceable_by_total_count
    test_progress_starts_on_actual_update_negative_loss_is_null = legacy.ExposureTests.test_progress_starts_on_actual_update_negative_loss_is_null
    test_final_cpu_reload_weights_only_no_fallback_and_identity = legacy.ExposureTests.test_final_cpu_reload_weights_only_no_fallback_and_identity
    test_flat_observation_image_completion_contract_rejects_counterfeits = legacy.ExposureTests.test_flat_observation_image_completion_contract_rejects_counterfeits
    test_outside_tolerance_is_valid_false_and_can_complete_research = legacy.ExposureTests.test_outside_tolerance_is_valid_false_and_can_complete_research
    test_missing_truthy_or_fabricated_diagnostic_cannot_complete = legacy.ExposureTests.test_missing_truthy_or_fabricated_diagnostic_cannot_complete
    test_progress_other_errors_and_non_windows_fail_immediately = legacy.ExposureTests.test_progress_other_errors_and_non_windows_fail_immediately

    def test_profile_restores_original_module_without_file_changes(self):
        original = successor.base_collect
        self.assertIs(self.core.collect_inputs, successor.collect_inputs)
        with successor.successor_profile():
            self.assertIs(self.core.collect_inputs, successor.collect_inputs)
        self.assertIs(self.core.collect_inputs, successor.collect_inputs)
        self.assertIsNot(original, self.core.collect_inputs)
        self.assertEqual(self.core.bind("ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py")["sha256"],
                         "2ccbcdb66708977414e264b2aba92d0e2bcf373965650a15aeb56c5078b04124")

    def test_isolated_identity_same_stable_envelope_and_limits(self):
        package = self.core.package_from_inputs(self.context["inputs"],
            {"path": successor.POLICY_PATH, "sha256": "a" * 64}, self.context["manifest"])
        self.assertTrue(package["experimentIdentity"].startswith("v21-whole-frame-fidelity-"))
        self.assertEqual(package["experimentType"], successor.EXPERIMENT_TYPE)
        self.assertEqual(package["schemaVersion"], "ai-painter-learning-capacity-experiment-package-v1")
        self.assertEqual(package["config"]["objectivePlan"], successor.objective_plan())
        self.assertEqual(package["resources"]["maxWallSeconds"], 1800)
        self.assertEqual(package["resources"]["maxGpuMemoryFraction"], .7)
        self.assertEqual(package["training"]["epochs"], 48)
        self.assertIsNone(package["foundation"])
        self.assertFalse(package["qualification"]["checkpointPromotable"])

    def test_frozen_loss_weights_policy_and_training_limits_reject_tampering(self):
        policy = self.policy()
        self.core.validate_policy(policy, self.context["inputs"])
        for field, value in (("rgbWeight", .5), ("edgeWeight", 0), ("targetSplit", "validation"),
                             ("existingTermsPreserved", False)):
            bad = deepcopy(policy); bad["inputs"]["objectivePlan"][field] = value
            with self.assertRaisesRegex(ValueError, "frozen objective"):
                self.core.validate_policy(bad, bad["inputs"])
        for key, value in (("maxAttempts", 2), ("automaticRetries", 1), ("status", "draft")):
            bad = deepcopy(policy); bad[key] = value
            with self.assertRaises(ValueError):
                self.core.validate_policy(bad, self.context["inputs"])
        bad = deepcopy(policy); bad["inputs"]["resources"]["maxWallSeconds"] = 1801
        with self.assertRaises(ValueError):
            self.core.validate_policy(bad, bad["inputs"])
        with self.assertRaises(ValueError):
            self.core.prepare("data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v3.json")

    def test_current_objective_zero_update_gate_preserves_state_rng_and_critic(self):
        model, critic = self.core.fresh_networks(self.context["order"], self.context["acceptance"])
        sample, _ = self.core.cpu.load_sample(self.context["reader"], self.context["rows"][0],
                                              self.context["order"], self.context["continuous"])
        before = [self.core.cpu.state_hash(x) for x in (model, critic)]
        rng = torch.get_rng_state().clone()
        facts = self.core.gpu.gradient_facts
        with patch.object(torch, "autocast", side_effect=lambda *a, **kw: nullcontext()), \
             patch.object(self.core.gpu, "gradient_facts", side_effect=lambda network, device: facts(network, "cpu")), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("CPU gate queried CUDA")):
            result = self.core.zero_update_probe(model, critic, sample, self.context["order"], lambda: None,
                lambda kind, bound: model(bound["conditions"][None], bound["objectInstanceTable"]))
        self.assertTrue(result["passed"])
        self.assertEqual(result["objectiveId"], successor.CANDIDATE_ID)
        self.assertGreater(result["objectiveTerms"]["wholeFrameFidelity"], 0)
        self.assertEqual(before, [self.core.cpu.state_hash(x) for x in (model, critic)])
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertTrue(all(p.grad is None and p.requires_grad for x in (model, critic) for p in x.parameters()))

    def test_successor_policy_preserves_failed_predecessor_and_requires_new_gpu_gate(self):
        self.assertTrue(successor.POLICY_PATH.endswith("policy-v2.json"))
        recovery = self.context["inputs"]["infrastructureRecovery"]
        self.assertEqual(recovery["predecessorFailure"], successor.PREDECESSOR_FAILURE)
        self.assertEqual(recovery["repairEvidence"], successor.REPAIR_EVIDENCE)
        self.assertFalse(recovery["oldRunResumed"])
        self.assertFalse(recovery["historicalCheckpointLoaded"])
        self.assertTrue(recovery["newGpuQualificationRequired"])
        with self.assertRaisesRegex(ValueError, "wrong exposure policy"):
            self.core.prepare(successor.POLICY_PATH.replace("v2.json", "v1.json"))

    def test_heartbeat_rule_cannot_extend_wait_or_enable_training_retries(self):
        policy = self.policy()
        for key, value in (("maxReplaceAttempts", 22), ("maxWaitMilliseconds", 2001),
                           ("sameStagedBytesOnly", 1), ("automaticTrainingRetries", 1)):
            bad = deepcopy(policy); bad["inputs"]["heartbeatPublicationRule"][key] = value
            with self.assertRaisesRegex(ValueError, "heartbeat publication"):
                self.core.validate_policy(bad, bad["inputs"])

    def test_one_real_cpu_pair_records_all_terms_and_only_actual_steps(self):
        model, critic = self.core.fresh_networks(self.context["order"], self.context["acceptance"])
        sample, _ = self.core.cpu.load_sample(self.context["reader"], self.context["rows"][0],
                                              self.context["order"], self.context["continuous"])
        g_opt = torch.optim.AdamW(model.parameters(), lr=.0001, **{
            "betas": tuple(self.core.v21.OPTIMIZER_PLAN["betas"]), "eps": self.core.v21.OPTIMIZER_PLAN["eps"],
            "weight_decay": self.core.v21.OPTIMIZER_PLAN["weightDecay"], "foreach": False, "fused": False})
        d_opt = torch.optim.AdamW(critic.parameters(), lr=.0001)
        counts = {"generator": 0, "discriminator": 0}
        ledger = {"sampleId": sample["sampleId"], **counts}
        states = [self.core.cpu.state_hash(x) for x in (model, critic)]
        result = self.core.perform_pair(model, critic, sample, self.context["order"], g_opt, d_opt,
            counts, ledger, lambda: None, lambda kind, bound: model(bound["conditions"][None], bound["objectInstanceTable"]))
        self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        self.assertEqual([ledger[key] for key in counts], [1, 1])
        self.assertAlmostEqual(result["generatorLoss"], result["v21UnchangedTotal"] + result["wholeFrameFidelity"], places=5)
        self.assertTrue(all(before != self.core.cpu.state_hash(x) for before, x in zip(states, (model, critic))))
        self.assertTrue(all(p.grad is None for p in critic.parameters()))

    def test_result_missing_or_changed_objective_rejected(self):
        result, package, payloads = self.completed_fixture()
        with self.fixture_bytes(payloads):
            self.core.validate_result_contract(result, package)
        for altered in ({}, {**result["objectivePlan"], "rgbWeight": 2}):
            with self.assertRaisesRegex(ValueError, "objective identity"):
                self.core.validate_result_contract({**result, "objectivePlan": altered}, package)

    def test_freeze_only_writes_one_exact_immutable_policy(self):
        target = unittest.mock.Mock()
        target.exists.return_value = False
        with patch.object(successor, "collect_inputs", return_value=self.context), \
             patch.object(self.core.cpu, "project_file", return_value=target), \
             patch.object(self.core.v21, "write_exclusive") as writer, \
             patch.object(self.core, "bind", return_value={"path": successor.POLICY_PATH, "sha256": "a" * 64}):
            with patch.object(successor, "objective_plan", return_value=self.context["inputs"]["objectivePlan"]):
                successor.freeze_policy()
            self.assertEqual(writer.call_count, 1)
            self.assertEqual(writer.call_args.args[1], self.policy())
            target.exists.return_value = True
            target.read_bytes.return_value = b'{"scope":"foreign"}'
            with patch.object(successor, "objective_plan", return_value=self.context["inputs"]["objectivePlan"]), \
                 self.assertRaisesRegex(ValueError, "policy already differs"):
                successor.freeze_policy()
            self.assertEqual(writer.call_count, 1)


if __name__ == "__main__":
    unittest.main()
