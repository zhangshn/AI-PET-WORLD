"""CPU controls for complete-endpoint, fixed-seed sampling comparisons."""
from copy import deepcopy
import inspect
import io
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import compare_decoder_adapted_sampling as diagnosis


class SamplingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)

    def tensors(self):
        import torch
        return torch, torch.zeros(1, 23, 192, 256), (1-torch.linspace(.0001, .02, 1000)).cumprod(0)

    def rows(self):
        return [{"sampleId": sample, "split": "train", "seed": seed, "steps": steps,
            "targetUsedForInitialization": False, "baselinePixelsAndMeasurementsExact": steps == 50,
            "measurements": {"final": dict.fromkeys(diagnosis.METRICS, {50: 2., 25: 1., 10: 3.}[steps])},
            "probes": [{"timestep": t, "generatedCleanLatentMse": 1., "finalRgb": {"rgbMae": 1., "laplacianMae": 1.}}
                       for t in diagnosis.trajectory.SNAPSHOTS] if steps == 50 else []}
            for i, sample in enumerate(diagnosis.source.previous.SAMPLES)
            for seed in diagnosis.SETTINGS["seedsBySample"][i] for steps in diagnosis.STEPS]

    def test_scope_and_no_target_in_sampling_signature(self):
        self.assertEqual(list(inspect.signature(diagnosis.rollout).parameters),
                         ["torch", "predict", "conditions", "alpha", "seed", "steps", "check"])
        self.assertEqual(diagnosis.STEPS, (50, 25, 10))
        for key in ("optimizerUpdatesAllowed", "checkpointSelectionAllowed", "formalQualificationAllowed", "targetUsedForInitialization"):
            self.assertIs(diagnosis.SETTINGS[key], False)
        self.assertEqual(diagnosis.SETTINGS["automaticRetries"], 0)
        self.assertEqual(diagnosis.SETTINGS["resolution"], [256, 192])

    def test_all_grids_reach_clean_endpoint_and_share_exact_noise(self):
        torch, conditions, alpha = self.tensors()
        first = None
        for steps in diagnosis.STEPS:
            calls = []
            noise, final, probes, grid = diagnosis.rollout(torch, lambda x,t,c: x*.25, conditions, alpha, 17, steps, lambda: calls.append(1))
            self.assertEqual(len(grid), steps)
            self.assertEqual(len(calls), steps)
            self.assertEqual(grid[0][0], 999)
            self.assertEqual(grid[-1], (0, -1))
            self.assertTrue(all(a > b for a,b in grid))
            self.assertTrue(torch.isfinite(final).all())
            if first is None:
                first = noise
            self.assertTrue(torch.equal(first, noise))
            self.assertEqual(tuple(probes), diagnosis.trajectory.SNAPSHOTS if steps == 50 else ())
        self.assertFalse(torch.cuda.is_initialized())

    def test_fifty_is_exactly_existing_sampler(self):
        torch, conditions, alpha = self.tensors()
        predict = lambda x,t,c: x*.25
        old = diagnosis.source.comparison.paired.pure_noise_rollout(torch, predict, (1,12,48,64), conditions, alpha, 17, lambda: None)
        actual = diagnosis.rollout(torch, predict, conditions, alpha, 17, 50, lambda: None)
        self.assertTrue(torch.equal(old[0], actual[0]))
        self.assertTrue(torch.equal(old[1], actual[1]))
        self.assertEqual(old[2], actual[3])
        self.assertTrue(torch.equal(actual[1], actual[2][0]))

    def test_analytic_velocity_algebra_on_every_grid(self):
        torch, conditions, alpha = self.tensors()
        clean = torch.randn((1,12,48,64), generator=torch.Generator().manual_seed(21))
        for steps in diagnosis.STEPS:
            noise, _, _, grid = diagnosis.rollout(torch, lambda x,t,c: x*0, conditions, alpha, 17, steps, lambda: None)
            errors = diagnosis.trajectory.oracle_error(torch, clean, noise, alpha, grid)
            self.assertTrue(all(v <= 5e-6 for v in errors.values()))

    def test_undeclared_or_noninteger_steps_rejected(self):
        torch, conditions, alpha = self.tensors()
        for steps in (1, 20, 100, 25., True):
            with self.assertRaisesRegex(ValueError, "undeclared"):
                diagnosis.rollout(torch, lambda x,t,c: x, conditions, alpha, 17, steps, lambda: None)

    def test_nonfinite_conditions_or_schedule_rejected(self):
        torch, conditions, alpha = self.tensors()
        for c, a in ((conditions+float("nan"), alpha), (conditions, alpha*float("nan")), (conditions, alpha*0)):
            with self.assertRaises(ValueError):
                diagnosis.rollout(torch, lambda x,t,c: x, c, a, 17, 25, lambda: None)

    def test_nonfinite_prediction_rejected_on_all_grids(self):
        torch, conditions, alpha = self.tensors()
        for steps in diagnosis.STEPS:
            with self.assertRaisesRegex(ValueError, "nonfinite"):
                diagnosis.rollout(torch, lambda x,t,c: x*float("nan"), conditions, alpha, 17, steps, lambda: None)

    def test_bad_prediction_shape_rejected(self):
        torch, conditions, alpha = self.tensors()
        with self.assertRaisesRegex(ValueError, "shape/device"):
            diagnosis.rollout(torch, lambda x,t,c: x[:, :1], conditions, alpha, 17, 25, lambda: None)

    def test_resource_check_stops_before_model_forward(self):
        torch, conditions, alpha = self.tensors()
        calls = []
        def check():
            raise ValueError("budget exhausted")
        for steps in diagnosis.STEPS:
            with self.assertRaisesRegex(ValueError, "budget exhausted"):
                diagnosis.rollout(torch, lambda x,t,c: calls.append(1), conditions, alpha, 17, steps, check)
        self.assertEqual(calls, [])

    def test_summary_retains_improvements_and_regressions_without_selection(self):
        rows = self.rows()
        summary = diagnosis.summarize(rows)
        self.assertEqual(summary["comparedWith50Steps"]["25"]["rgbMae"]["improvedCount"], 6)
        self.assertEqual(summary["comparedWith50Steps"]["10"]["rgbMae"]["worseCount"], 6)
        self.assertEqual(len(summary["fixed50StepLateChanges"]), 6)
        for key in ("checkpointSelected", "samplerSelected", "rootCauseProven", "formalVisualQualification"):
            self.assertIs(summary[key], False)

    def test_incomplete_or_reordered_matrix_rejected(self):
        rows = self.rows()
        for bad in (rows[:-1], rows[::-1], rows+[rows[0]]):
            with self.assertRaisesRegex(ValueError, "matrix"):
                diagnosis.summarize(bad)

    def test_holdout_or_target_initialization_rejected(self):
        for key, value in (("split", "challenge"), ("targetUsedForInitialization", True)):
            rows = self.rows()
            rows[0][key] = value
            with self.assertRaisesRegex(ValueError, "use changed"):
                diagnosis.summarize(rows)

    def test_missing_replay_or_probe_rejected(self):
        rows = self.rows()
        rows[0]["baselinePixelsAndMeasurementsExact"] = False
        with self.assertRaisesRegex(ValueError, "replay"):
            diagnosis.summarize(rows)
        rows = self.rows()
        rows[0]["probes"].pop()
        with self.assertRaisesRegex(ValueError, "probe"):
            diagnosis.summarize(rows)

    def test_nonfinite_negative_and_boolean_metrics_rejected(self):
        for value in (float("nan"), float("inf"), -1., True):
            for index in (0, 1, 2):
                rows = self.rows()
                rows[index]["measurements"]["final"]["rgbMae"] = value
                with self.assertRaisesRegex(ValueError, "invalid metric"):
                    diagnosis.summarize(rows)

    def test_png_replay_uses_existing_truncation_not_rounding(self):
        import numpy as np
        from PIL import Image
        torch, _, _ = self.tensors()
        rgb = torch.full((1,3,192,256), 127.9/255)
        out = io.BytesIO()
        Image.fromarray(np.full((192,256,3), 127, dtype=np.uint8)).save(out, format="PNG")
        with patch.object(diagnosis, "read_bound", return_value=out.getvalue()):
            diagnosis.png_matches(ROOT, {}, rgb)
            with self.assertRaisesRegex(ValueError, "pixels"):
                diagnosis.png_matches(ROOT, {}, rgb+.01)

    def test_registry_prepares_once_and_retries_only_same_finalization(self):
        with patch.object(diagnosis.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout='{"ok":true}', stderr='')) as run:
            diagnosis.registry(ROOT, "begin", "example")
        bridge = run.call_args.args[0][3]
        self.assertIn("cpu_decoder_adapted_sampling_comparison", bridge)
        self.assertEqual(bridge.count("await prepareCurrentExecutionRegistryAdvance("), 1)
        self.assertIn("transactionId:prepared.transactionId", bridge)
        self.assertNotIn("await advanceCurrentExecutionRegistry(", bridge)
        self.assertIn("expectedPreviousRegistryRevision", bridge)


if __name__ == "__main__":
    unittest.main()
