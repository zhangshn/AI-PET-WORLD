"""CPU-only experimental scope and optimizer boundary regression."""
import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from painter_learning_capacity_experiment import (
    CHECKPOINT_SCHEMA, ExperimentDataset, SCHEMA, selected_rows, validate_experiment_checkpoint, verify_controller_process, exact_inference_runtime,
    POLICY, FOLLOWUP_POLICY, BUDGET_POLICY, preserve_training_random_state, timestep_coverage, validate_followup_policy, validate_budget_policy,
)
from ai_painter.complete_world.split_training import TrainSplitBoundary, state_hash


class ExperimentScopeTests(unittest.TestCase):
    def setUp(self):
        self.rows = [{"sampleId": "a", "split": "train"}, {"sampleId": "b", "split": "train"}]
        self.package = {"schemaVersion": SCHEMA, "resolution": [256, 192], "experimentIdentity": "experiment-test",
                        "selectedRows": self.rows, "inputIdentity": {}}

    def test_selected_train_order(self):
        self.assertEqual([r["sampleId"] for r in selected_rows({"samples": self.rows}, ["b", "a"])], ["b", "a"])

    def test_exact_inference_runtime_restores_flags_after_failure(self):
        import torch
        before = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled(),
                  torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic)
        with self.assertRaisesRegex(RuntimeError, "fixture"):
            with exact_inference_runtime(torch):
                self.assertTrue(torch.are_deterministic_algorithms_enabled())
                self.assertFalse(torch.is_deterministic_algorithms_warn_only_enabled())
                self.assertFalse(torch.backends.cudnn.benchmark)
                self.assertTrue(torch.backends.cudnn.deterministic)
                raise RuntimeError("fixture")
        after = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled(),
                 torch.backends.cudnn.benchmark, torch.backends.cudnn.deterministic)
        self.assertEqual(before, after)

    def test_exact_controller_or_venv_redirector_only(self):
        lease = {"experimentIdentity": "experiment-test", "workerParentPid": 100, "workerLauncherPid": 101, "registryRevision": 8}
        registry = {"runId": "experiment-test", "activeExecution": {"processId": 100}, "registryRevision": 8}
        for pid in (100, 101):
            verify_controller_process(lease, registry, pid)
        with self.assertRaises(ValueError):
            verify_controller_process(lease, registry, 102)

    def test_stale_controller_registry_rejected(self):
        lease = {"experimentIdentity": "experiment-test", "workerParentPid": 100, "workerLauncherPid": 101, "registryRevision": 8}
        for registry in ({"runId": "other", "activeExecution": {"processId": 100}, "registryRevision": 8},
                         {"runId": "experiment-test", "activeExecution": {"processId": 100}, "registryRevision": 9}):
            with self.assertRaises(ValueError):
                verify_controller_process(lease, registry, 101)

    def test_holdouts_rejected(self):
        for split in ("validation", "challenge", "regression"):
            rows = copy.deepcopy(self.rows)
            rows[0]["split"] = split
            with self.subTest(split=split), self.assertRaisesRegex(ValueError, "non-train"):
                selected_rows({"samples": rows}, ["a", "b"])

    def test_missing_duplicate_and_oversized_rejected(self):
        for ids in (["a", "a"], ["a", "missing"], ["a", "b", "c"]):
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                selected_rows({"samples": self.rows}, ids)

    def test_dataset_distinct_identity_and_copy(self):
        dataset = ExperimentDataset(Path.cwd(), self.package)
        self.assertEqual(dataset.manifest["datasetReleaseIdentity"], "experiment-test")
        self.rows[0]["split"] = "validation"
        self.assertEqual(dataset.rows[0]["split"], "train")

    def test_wrong_resolution_rejected(self):
        self.package["resolution"] = [512, 384]
        with self.assertRaisesRegex(ValueError, "resolution"):
            ExperimentDataset(Path.cwd(), self.package)

    def checkpoint(self):
        return {"schemaVersion": CHECKPOINT_SCHEMA, "experimentIdentity": "experiment-test",
                "selectedSampleIds": ["a", "b"], "checkpointPromotable": False, "formalInferenceEligible": False}

    def test_experimental_checkpoint_accepted(self):
        validate_experiment_checkpoint(self.checkpoint(), self.package)

    def test_checkpoint_promotion_and_cross_identity_rejected(self):
        for key, value in (("checkpointPromotable", True), ("formalInferenceEligible", True),
                           ("experimentIdentity", "other"), ("schemaVersion", "formal-checkpoint"),
                           ("selectedSampleIds", ["a", "challenge"])):
            checkpoint = self.checkpoint()
            checkpoint[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_experiment_checkpoint(checkpoint, self.package)

    def test_real_optimizer_requires_bound_train_batch(self):
        import torch
        dataset = ExperimentDataset(Path.cwd(), self.package)
        model = torch.nn.Linear(1, 1)
        optimizer = torch.optim.SGD(model.parameters(), lr=0.1)
        class Loader:
            def __init__(self, item):
                self.dataset = dataset
                self.item = item
            def __len__(self):
                return 1
            def __iter__(self):
                yield self.item
        item = {"sampleId": ["a"], "split": ["train"], "datasetReleaseIdentity": ["experiment-test"]}
        before = state_hash(model.state_dict())
        with TrainSplitBoundary(model, optimizer, dataset) as boundary:
            with self.assertRaises(ValueError):
                optimizer.step()
            for _ in boundary.wrap_loader(Loader(item)):
                optimizer.zero_grad()
                model(torch.ones(1, 1)).sum().backward()
                optimizer.step()
                with self.assertRaises(ValueError):
                    optimizer.step()
            self.assertEqual(boundary.evidence()["optimizerSteps"], 1)
            for field, value in (("split", ["validation"]), ("sampleId", ["unknown"]), ("datasetReleaseIdentity", ["other"])):
                changed = {**item, field: value}
                with self.assertRaises(ValueError):
                    list(boundary.wrap_loader(Loader(changed)))
            with boundary.evaluation():
                self.assertFalse(torch.is_grad_enabled())
        self.assertNotEqual(before, state_hash(model.state_dict()))


class FollowupDiagnosticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)
        cls.root = Path(__file__).resolve().parents[3]
        cls.parent = json.loads((cls.root / POLICY).read_text(encoding="utf-8"))
        cls.policy = json.loads((cls.root / FOLLOWUP_POLICY).read_text(encoding="utf-8"))

    def test_followup_preserves_parent_boundaries(self):
        validate_followup_policy(self.policy, self.parent)
        for key in ("resolution", "sampleIds", "resources", "qualification", "foundationContract"):
            changed = copy.deepcopy(self.policy)
            changed[key] = None
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "frozen boundary"):
                validate_followup_policy(changed, self.parent)

    def test_budget_followup_changes_only_agreed_training_limit(self):
        policy = json.loads((self.root / BUDGET_POLICY).read_text(encoding="utf-8"))
        validate_budget_policy(policy, self.policy)
        self.assertEqual(policy["training"]["epochs"] * 2, 6000)
        self.assertEqual(policy["resources"]["maxWallSeconds"], 1800)
        for key in ("resources", "qualification", "sampleIds", "modelArchitectureChangesAllowed", "lossChangesAllowed"):
            changed = copy.deepcopy(policy)
            changed[key] = None
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "frozen boundary"):
                validate_budget_policy(changed, self.policy)

    def test_budget_followup_rejects_extra_steps_replay_and_observation_selection(self):
        policy = json.loads((self.root / BUDGET_POLICY).read_text(encoding="utf-8"))
        for key, value in (("epochs", 3001), ("observationSteps", [600, 6000]), ("replayAllowed", True),
                           ("checkpointRule", "best_visual"), ("timestepCoverageStride", 997)):
            changed = copy.deepcopy(policy)
            changed["training"][key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "budget changed"):
                validate_budget_policy(changed, self.policy)

    def test_budget_observations_and_no_replay_are_exact(self):
        for key, value in (("epochs", 301), ("observationSteps", [60, 600]), ("replayAllowed", True),
                           ("timestepCoverageStride", 997), ("preserveTrainingRandomStateDuringObservation", False)):
            changed = copy.deepcopy(self.policy)
            changed["training"][key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "budget changed"):
                validate_followup_policy(changed, self.parent)

    def config(self, stride):
        return {"diffusionSteps": 1000, "training": {"seed": 20260908,
                "timestepSampling": "deterministic_full_schedule_cover_v2", "timestepCoverageStride": stride}}

    def test_old_short_run_misses_low_and_middle_time_bands(self):
        coverage = timestep_coverage(self.config(997))
        self.assertEqual([r["minimum"] for r in coverage], [734, 731])
        self.assertTrue(all(row["decileCounts"][:7] == [0] * 7 for row in coverage))

    def test_new_short_run_covers_all_ten_bands_for_both_samples(self):
        coverage = timestep_coverage(self.config(137))
        self.assertTrue(all(sum(row["decileCounts"]) == 30 and min(row["decileCounts"]) >= 2 for row in coverage))

    def test_full_timestep_cycle_and_invalid_stride(self):
        from train_ai_assisted_conditional_denoiser import training_timesteps
        times = [int(training_timesteps(self.config(137), epoch, batch, 2, 1, 1000, "cpu").item())
                 for epoch in range(500) for batch in range(2)]
        self.assertEqual(sorted(times), list(range(1000)))
        with self.assertRaisesRegex(ValueError, "coprime"):
            training_timesteps(self.config(100), 0, 0, 2, 1, 1000, "cpu")

    def test_latent_normalization_round_trip(self):
        import torch
        from train_ai_assisted_conditional_denoiser import normalize_latent, denormalize_latent
        latent = torch.linspace(-3, 3, 96).reshape(2, 3, 4, 4)
        normalization = {"mean": torch.tensor([0.3, -0.8, 1.2]).reshape(1, 3, 1, 1),
                         "standardDeviation": torch.tensor([0.2, 1.8, 0.7]).reshape(1, 3, 1, 1)}
        torch.testing.assert_close(denormalize_latent(normalize_latent(latent, normalization), normalization), latent)

    def test_velocity_target_recovery_and_sampler_equations(self):
        import torch
        from ai_painter.complete_world.diffusion import add_noise, velocity_target, recover_from_velocity, deterministic_velocity_step, inference_timesteps
        from train_ai_assisted_conditional_denoiser import build_diffusion_schedule
        alpha = build_diffusion_schedule(self.config(137), "cpu")["alphasCumulative"]
        clean = torch.linspace(-1, 1, 48).reshape(1, 3, 4, 4)
        noise = torch.linspace(0.8, -0.5, 48).reshape(1, 3, 4, 4)
        for t in (0, 100, 500, 999):
            time = torch.tensor([t])
            noisy = add_noise(clean, noise, time, alpha)
            velocity = velocity_target(clean, noise, time, alpha)
            recovered, recovered_noise = recover_from_velocity(noisy, velocity, t, alpha)
            torch.testing.assert_close(recovered, clean)
            torch.testing.assert_close(recovered_noise, noise)
            previous = t - 1
            expected = add_noise(clean, noise, torch.tensor([previous]), alpha) if previous >= 0 else clean
            torch.testing.assert_close(deterministic_velocity_step(noisy, velocity, t, previous, alpha), expected)
        grid = inference_timesteps(1000, 50, "cpu")
        self.assertEqual((len(grid), int(grid[0]), int(grid[-1])), (50, 999, 0))
        self.assertTrue(bool((grid[:-1] > grid[1:]).all()))

    def test_observation_restores_random_state_even_after_failure(self):
        import random
        import numpy as np
        import torch
        random.seed(7)
        np.random.seed(7)
        torch.manual_seed(7)
        expected = (random.random(), np.random.rand(), torch.rand(4))
        random.seed(7)
        np.random.seed(7)
        torch.manual_seed(7)
        with self.assertRaisesRegex(RuntimeError, "fixture"):
            with preserve_training_random_state():
                random.random()
                np.random.rand(12)
                torch.randn(17)
                list(torch.utils.data.DataLoader(torch.arange(4), batch_size=1))
                raise RuntimeError("fixture")
        self.assertEqual(random.random(), expected[0])
        self.assertEqual(np.random.rand(), expected[1])
        self.assertTrue(torch.equal(torch.rand(4), expected[2]))
        self.assertFalse(torch.cuda.is_initialized())

    def test_observations_leave_identical_subsequent_training(self):
        import torch
        def run(observe):
            torch.manual_seed(99)
            model = torch.nn.Linear(3, 1)
            optimizer = torch.optim.AdamW(model.parameters(), lr=0.01)
            for step in range(6):
                optimizer.zero_grad()
                model(torch.randn(2, 3)).square().mean().backward()
                optimizer.step()
                if observe and step in (1, 3):
                    with preserve_training_random_state(), torch.no_grad():
                        model(torch.randn(3, 3))
                        list(torch.utils.data.DataLoader(torch.arange(3)))
            return state_hash({"model": model.state_dict(), "optimizer": optimizer.state_dict()})
        self.assertEqual(run(False), run(True))

    def test_image_metrics_measure_error_not_image_sharpness_alone(self):
        import torch
        from diagnose_learning_capacity_noise import image_metrics
        target = torch.zeros(1, 3, 6, 6)
        identical = image_metrics(torch, target, target)
        self.assertEqual(identical["rgbMae"], 0)
        self.assertEqual(identical["laplacianMae"], 0)
        altered = target.clone()
        altered[:, :, 2, 2] = 1
        errors = image_metrics(torch, altered, target)
        self.assertGreater(errors["rgbMae"], 0)
        self.assertGreater(errors["laplacianMae"], 0)
        with self.assertRaisesRegex(ValueError, "shape mismatch"):
            image_metrics(torch, altered[:, :, :3], target)
        altered[:, :, 2, 2] = float("nan")
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            image_metrics(torch, altered, target)


if __name__ == "__main__":
    unittest.main()
