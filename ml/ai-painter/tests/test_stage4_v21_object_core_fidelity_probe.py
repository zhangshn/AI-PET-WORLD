"""CPU integration of the exact object-core objective and existing lifecycle."""
from contextlib import nullcontext
from copy import deepcopy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_v21_object_core_fidelity_probe as successor
import test_stage4_v21_full_train_exposure_probe as legacy
import test_native_rgb_object_core_fidelity_candidate_cpu as objective_tests


class ObjectiveTests(objective_tests.ObjectCoreFidelityCpuTests):
    pass


class CoreExecutionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.profile = successor.successor_profile()
        cls.core = cls.profile.__enter__()
        try:
            with patch.object(torch, "load", side_effect=AssertionError("preflight checkpoint read")), \
                 patch.object(cls.core.cpu, "load_sample", side_effect=AssertionError("preflight image decode")), \
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

    def test_identity_and_frozen_limits(self):
        package = self.core.package_from_inputs(self.context["inputs"],
            {"path": successor.POLICY_PATH, "sha256": "a" * 64}, self.context["manifest"])
        self.assertTrue(package["experimentIdentity"].startswith("v21-object-core-fidelity-"))
        self.assertEqual(package["experimentType"], successor.EXPERIMENT_TYPE)
        self.assertEqual(package["schemaVersion"], "ai-painter-learning-capacity-experiment-package-v1")
        self.assertEqual(package["config"]["objectivePlan"], successor.objective_plan())
        self.assertEqual(package["training"]["epochs"], 48)
        self.assertEqual(package["resources"]["maxWallSeconds"], 1800)
        self.assertEqual(package["training"]["zeroUpdateGpuProbeMaxWallSeconds"], 120)
        self.assertIsNone(package["foundation"])
        self.assertFalse(package["qualification"]["checkpointPromotable"])

    def test_plan_and_boundary_tampering_rejected(self):
        policy = self.policy()
        self.core.validate_policy(policy, self.context["inputs"])
        for field, value in (("coreRgbWeight", .5), ("maskDilation", True),
                             ("targetSplit", "validation"), ("roles", []), ("existingTermsPreserved", False)):
            bad = deepcopy(policy); bad["inputs"]["objectivePlan"][field] = value
            with self.assertRaisesRegex(ValueError, "frozen objective"):
                self.core.validate_policy(bad, bad["inputs"])
        for field, value in (("maxAttempts", 2), ("automaticRetries", 1), ("scope", "foreign")):
            bad = deepcopy(policy); bad[field] = value
            with self.assertRaises(ValueError):
                self.core.validate_policy(bad, self.context["inputs"])
        for old in (successor.fidelity.POLICY_PATH, "data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v3.json"):
            with self.assertRaisesRegex(ValueError, "wrong exposure policy"):
                self.core.prepare(old)

    def test_nested_profile_restores_old_worker_and_objective(self):
        before = self.core.collect_inputs
        objective = successor.fidelity.train_whole_frame_fidelity_candidate_objective
        with successor.successor_profile():
            self.assertIs(self.core.collect_inputs, successor.collect_inputs)
        self.assertIs(self.core.collect_inputs, before)
        self.assertIs(successor.fidelity.train_whole_frame_fidelity_candidate_objective, objective)
        self.assertEqual(self.core.bind(successor.fidelity.WORKER)["sha256"],
                         "dee53c718b15cd5fbd14a5bfc2cb5b82a9378436b09118d695f80c281ec7cdc3")
        self.assertEqual(self.core.bind("ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py")["sha256"],
                         "2ccbcdb66708977414e264b2aba92d0e2bcf373965650a15aeb56c5078b04124")

    def test_cpu_probe_uses_new_objective_preserves_state_rng(self):
        model, critic = self.core.fresh_networks(self.context["order"], self.context["acceptance"])
        sample, _ = self.core.cpu.load_sample(self.context["reader"], self.context["rows"][0],
                                             self.context["order"], self.context["continuous"])
        before = [self.core.cpu.state_hash(x) for x in (model, critic)]
        rng = torch.get_rng_state().clone()
        facts = self.core.gpu.gradient_facts
        with patch.object(torch, "autocast", side_effect=lambda *a, **kw: nullcontext()), \
             patch.object(self.core.gpu, "gradient_facts", side_effect=lambda network, device: facts(network, "cpu")), \
             patch.object(torch.cuda, "is_available", side_effect=AssertionError("CPU queried CUDA")):
            result = self.core.zero_update_probe(model, critic, sample, self.context["order"], lambda: None,
                lambda kind, bound: model(bound["conditions"][None], bound["objectInstanceTable"]))
        self.assertEqual(result["objectiveId"], successor.CANDIDATE_ID)
        terms = result["objectiveTerms"]
        self.assertGreater(terms["objectCoreRgbMae"], 0)
        self.assertEqual(terms["objectCoreApplicableRoleCount"], 4)
        self.assertAlmostEqual(terms["total"], terms["wholeFrameFidelityUnchangedTotal"] + terms["objectCoreRgbWeighted"], places=5)
        self.assertEqual(before, [self.core.cpu.state_hash(x) for x in (model, critic)])
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertTrue(all(p.grad is None and p.requires_grad for x in (model, critic) for p in x.parameters()))

    def test_real_cpu_pair_updates_once_with_new_core_term(self):
        model, critic = self.core.fresh_networks(self.context["order"], self.context["acceptance"])
        sample, _ = self.core.cpu.load_sample(self.context["reader"], self.context["rows"][0],
                                             self.context["order"], self.context["continuous"])
        options = self.core.v21.OPTIMIZER_PLAN
        kwargs = {"lr": .0001, "betas": tuple(options["betas"]), "eps": options["eps"],
                  "weight_decay": options["weightDecay"], "foreach": False, "fused": False}
        g_opt, d_opt = (torch.optim.AdamW(x.parameters(), **kwargs) for x in (model, critic))
        counts = {"generator": 0, "discriminator": 0}
        ledger = {"sampleId": sample["sampleId"], **counts}
        result = self.core.perform_pair(model, critic, sample, self.context["order"], g_opt, d_opt,
            counts, ledger, lambda: None, lambda kind, bound: model(bound["conditions"][None], bound["objectInstanceTable"]))
        self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        self.assertEqual([ledger[key] for key in counts], [1, 1])
        self.assertGreater(result["objectCoreRgbWeighted"], 0)
        self.assertAlmostEqual(result["generatorLoss"], result["total"], places=5)
        self.assertAlmostEqual(result["total"], result["v21UnchangedTotal"] + result["wholeFrameFidelity"]
                               + result["objectCoreRgbWeighted"], places=5)
        self.assertTrue(all(p.grad is None for p in critic.parameters()))

    def test_adapter_restores_on_failure_and_cannot_skip_term(self):
        original = successor.fidelity.train_whole_frame_fidelity_candidate_objective
        for function in (lambda: {}, lambda: (_ for _ in ()).throw(ValueError("deliberate"))):
            with self.assertRaises(ValueError):
                successor._execute_with_core_objective(function)
            self.assertIs(successor.fidelity.train_whole_frame_fidelity_candidate_objective, original)

    def test_result_foreign_objective_rejected(self):
        result, package, payloads = self.completed_fixture()
        with self.fixture_bytes(payloads):
            self.core.validate_result_contract(result, package)
        for value in ({}, successor.fidelity.objective_plan()):
            with self.assertRaisesRegex(ValueError, "result objective identity"):
                self.core.validate_result_contract({**result, "objectivePlan": value}, package)

    def test_heartbeat_budget_and_no_retry_frozen(self):
        for key, value in (("maxWaitMilliseconds", 2001), ("automaticTrainingRetries", 1), ("sameStagedBytesOnly", 1)):
            policy = self.policy(); policy["inputs"]["heartbeatPublicationRule"][key] = value
            with self.assertRaisesRegex(ValueError, "heartbeat publication"):
                self.core.validate_policy(policy, policy["inputs"])


if __name__ == "__main__":
    unittest.main()
