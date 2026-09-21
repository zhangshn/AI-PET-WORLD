"""CPU-only regression tests for fixed trajectory probes and algebra controls."""
from copy import deepcopy
import inspect
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import diagnose_learning_capacity_trajectory as diagnosis


class TrajectoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)

    def tensors(self):
        import torch
        from train_ai_assisted_conditional_denoiser import inference_timesteps
        from diagnose_learning_capacity_timesteps import rollout_grid
        alpha = (1 - torch.linspace(.0001, .02, 1000)).cumprod(0)
        return torch, torch.zeros(1, 23, 192, 256), alpha, rollout_grid(torch, inference_timesteps(1000, 50, "cpu"))

    def test_probe_positions_are_the_predeclared_actual_grid(self):
        torch, conditions, alpha, grid = self.tensors()
        self.assertEqual(tuple(grid[i][0] for i in (0, 12, 25, 37, 49)), diagnosis.SNAPSHOTS)
        self.assertEqual(grid[-1], (0, -1))
        self.assertFalse(torch.cuda.is_initialized())

    def test_no_target_or_model_selection_input_to_capture(self):
        self.assertEqual(list(inspect.signature(diagnosis.capture_rollout).parameters),
                         ["torch", "predict", "conditions", "alpha", "seed", "check"])
        self.assertFalse(diagnosis.SETTINGS["optimizerUpdatesAllowed"])
        self.assertFalse(diagnosis.SETTINGS["checkpointSelectionAllowed"])
        self.assertFalse(diagnosis.SETTINGS["formalQualificationAllowed"])

    def test_instrumentation_is_exactly_the_unmodified_sampler(self):
        torch, conditions, alpha, grid = self.tensors()
        predictor = lambda x, t, c: x * .25
        checks = []
        original = diagnosis.source.paired.pure_noise_rollout(torch, predictor, (1, 12, 48, 64), conditions, alpha, 17, lambda: None)
        result = diagnosis.capture_rollout(torch, predictor, conditions, alpha, 17, lambda: checks.append(1))
        self.assertTrue(torch.equal(result[0], original[0]))
        self.assertTrue(torch.equal(result[1], original[1]))
        self.assertEqual(result[3], original[2])
        self.assertEqual(tuple(result[2]), diagnosis.SNAPSHOTS)
        self.assertEqual(len(checks), 50)
        self.assertTrue(torch.equal(result[1], result[2][0]))

    def test_missing_snapshot_is_rejected(self):
        torch, conditions, alpha, grid = self.tensors()
        with patch.object(diagnosis, "SNAPSHOTS", (999, 777, 0)):
            with self.assertRaisesRegex(ValueError, "incomplete"):
                diagnosis.capture_rollout(torch, lambda x, t, c: x * 0, conditions, alpha, 17, lambda: None)

    def test_nonfinite_prediction_fails_closed(self):
        torch, conditions, alpha, grid = self.tensors()
        with self.assertRaisesRegex(ValueError, "nonfinite"):
            diagnosis.capture_rollout(torch, lambda x, t, c: x * float("nan"), conditions, alpha, 17, lambda: None)

    def test_resource_check_interrupts_without_retry(self):
        torch, conditions, alpha, grid = self.tensors()
        calls = []
        def check():
            calls.append(1)
            raise RuntimeError("budget exhausted")
        with self.assertRaisesRegex(RuntimeError, "budget exhausted"):
            diagnosis.capture_rollout(torch, lambda x, t, c: x, conditions, alpha, 17, check)
        self.assertEqual(len(calls), 1)

    def test_analytic_velocity_recovers_clean_noise_and_every_step(self):
        torch, conditions, alpha, grid = self.tensors()
        generator = torch.Generator().manual_seed(91)
        clean = torch.randn((1, 12, 48, 64), generator=generator)
        noise = torch.randn(clean.shape, generator=generator)
        measured = diagnosis.oracle_error(torch, clean, noise, alpha, grid)
        self.assertTrue(all(value <= 5e-6 for value in measured.values()))

    def test_corrupted_sampler_algebra_is_detected(self):
        torch, conditions, alpha, grid = self.tensors()
        import train_ai_assisted_conditional_denoiser as trainer
        original = trainer.deterministic_velocity_step
        with patch.object(trainer, "deterministic_velocity_step", lambda *args: original(*args) + .01):
            with self.assertRaisesRegex(ValueError, "algebra"):
                diagnosis.oracle_error(torch, torch.ones(1, 12, 48, 64), torch.zeros(1, 12, 48, 64), alpha, grid)

    def fixture(self):
        rows = []
        for i, sample in enumerate(diagnosis.source.adapter.SAMPLES):
            for j, seed in enumerate(diagnosis.SETTINGS["seedsBySample"][i]):
                values = [1., 1., 1., 1., (2., 1., .5)[j]]
                probes = [{"timestep": t, "generatedCleanLatentMse": value,
                           "baseRgb": {"rgbMae": value}, "finalRgb": {"rgbMae": value, "laplacianMae": value}}
                          for t, value in zip(diagnosis.SNAPSHOTS, values)]
                rows.append({"sampleId": sample, "seed": seed, "probes": probes})
        return rows

    def test_summary_retains_improvement_ties_and_regressions(self):
        summary = diagnosis.summarize(self.fixture())
        self.assertEqual(summary["lateLatentErrorIncreaseCount"], 2)
        self.assertEqual(summary["lateFinalLaplacianErrorIncreaseCount"], 2)
        self.assertEqual([r["cleanLatentMseChange"] for r in summary["fixedIntervalChanges"]], [1., 0., -.5] * 2)
        self.assertFalse(summary["rootCauseProven"])
        self.assertFalse(summary["checkpointSelected"])

    def test_missing_reordered_or_duplicate_seed_is_rejected(self):
        rows = self.fixture()
        for invalid in (rows[:-1], list(reversed(rows)), rows + [rows[0]]):
            with self.assertRaises(ValueError):
                diagnosis.summarize(invalid)

    def test_missing_or_reordered_probe_is_rejected(self):
        for transform in (lambda rows: rows[:-1], lambda rows: list(reversed(rows))):
            rows = deepcopy(self.fixture())
            rows[0]["probes"] = transform(rows[0]["probes"])
            with self.assertRaises(ValueError):
                diagnosis.summarize(rows)

    def test_real_materialization_reverifies_source_without_creating_run(self):
        plan = diagnosis.materialize(ROOT)
        output = ROOT / diagnosis.source.paired.ROOT / plan["comparisonIdentity"]
        before = sorted(p.name for p in output.iterdir()) if output.exists() else None
        self.assertEqual(plan, diagnosis.materialize(ROOT))
        self.assertEqual(before, sorted(p.name for p in output.iterdir()) if output.exists() else None)
        self.assertGreater(len(plan["inputReceipts"]), 143)
        self.assertEqual(plan["settings"]["snapshotTimesteps"], list(diagnosis.SNAPSHOTS))


if __name__ == "__main__":
    unittest.main()
