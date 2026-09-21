"""CPU boundaries and behavior checks for a fixed six-seed comparison."""
from copy import deepcopy
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
sys.path.insert(0, str(ROOT / "ml/ai-painter/src"))
import compare_rgb_head_multiseed as comparison

SOURCE = {"path": ".runtime/ai-painter/learning-capacity-experiments/painter-rgb-head-adaptation-4008a695d9a4f4376d50c8fb95df2e599ae65d6add93412b409e7349c131e56e/result.json",
          "sha256": "c89da80b16c4ef09550ff354cf2999ff1beb964e6092cc2a69a5735b9b647d58"}


class MultiseedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import torch
        torch.set_num_threads(4)

    def test_exact_scope_settings_cannot_expand(self):
        comparison.validate_settings(comparison.SETTINGS)
        for key in comparison.SETTINGS:
            invalid = deepcopy(comparison.SETTINGS)
            invalid[key] = None
            with self.subTest(key=key), self.assertRaises(ValueError):
                comparison.validate_settings(invalid)

    def test_cpu_test_evidence_has_required_registry_terminal_fields(self):
        for code in (0, 1):
            value = comparison.cpu_test_record(code, {"path": "test.py", "sha256": "a" * 64}, "", "")
            comparison.validate_terminal(value)
            self.assertEqual(value["executionState"], "completed" if code == 0 else "failed_closed")
            for invalid in ({k: v for k, v in value.items() if k != "status"}, dict(value, status=""),
                            dict(value, status=False), dict(value, executionState="executing")):
                with self.assertRaises(ValueError):
                    comparison.validate_terminal(invalid)

    def test_materialize_is_repeatable_and_does_not_run(self):
        a = comparison.materialize(ROOT, SOURCE)
        output = ROOT / comparison.paired.ROOT / a["comparisonIdentity"]
        before = sorted(p.name for p in output.iterdir()) if output.exists() else None
        self.assertEqual(a, comparison.materialize(ROOT, SOURCE))
        self.assertEqual(a["sampleIds"], comparison.adapter.SAMPLES)
        self.assertEqual(before, sorted(p.name for p in output.iterdir()) if output.exists() else None)
        self.assertFalse(a["settings"]["formalQualificationAllowed"])

    def test_tampered_parent_result_is_rejected(self):
        with self.assertRaises(ValueError):
            comparison.materialize(ROOT, dict(SOURCE, sha256="0" * 64))

    def test_new_seeds_are_fixed_unique_and_deterministic(self):
        import torch
        seeds = [s for row in comparison.SETTINGS["seedsBySample"] for s in row]
        self.assertEqual(len(seeds), len(set(seeds)))
        self.assertFalse({20263908, 20263909}.intersection(seeds))
        values = [torch.randn((1, 12, 48, 64), generator=torch.Generator().manual_seed(s)) for s in seeds]
        for seed, value in zip(seeds, values):
            self.assertTrue(torch.equal(value, torch.randn(value.shape, generator=torch.Generator().manual_seed(seed))))
        self.assertTrue(all(not torch.equal(values[a], values[b]) for a in range(6) for b in range(a+1, 6)))
        self.assertFalse(torch.cuda.is_initialized())

    def fixture(self):
        import torch
        original, replacement = object(), object()
        model = SimpleNamespace(denoiser=SimpleNamespace(rgb_responsibility_heads=original))
        latent, conditions = torch.zeros(1, 12, 48, 64), torch.zeros(1, 23, 192, 256)
        def decode(m, x, c, config, **kwargs):
            base = torch.zeros(1, 3, 192, 256)
            return base + (0.1 if m.denoiser.rgb_responsibility_heads is original else 0.2), {
                "baseDecodedRgb": base, "responsibilityMasks": (c[:, :1],)}
        return torch, model, original, replacement, latent, conditions, decode

    def test_pair_uses_identical_tensors_and_restores_heads(self):
        torch, model, original, replacement, latent, conditions, decode = self.fixture()
        calls = []
        def traced(m, x, c, cfg, **kwargs):
            calls.append((m.denoiser.rgb_responsibility_heads, id(x), id(c)))
            return decode(m, x, c, cfg, **kwargs)
        result = comparison.decode_head_pair(torch, model, replacement, latent, conditions, {}, traced)
        self.assertEqual(calls, [(original, id(latent), id(conditions)), (replacement, id(latent), id(conditions))])
        self.assertIs(model.denoiser.rgb_responsibility_heads, original)
        self.assertFalse(torch.equal(result["baseline"][0], result["adapted"][0]))

    def test_exception_always_restores_heads(self):
        torch, model, original, replacement, latent, conditions, decode = self.fixture()
        def broken(m, x, c, cfg, **kwargs):
            if m.denoiser.rgb_responsibility_heads is replacement:
                raise RuntimeError("decode failure")
            return decode(m, x, c, cfg, **kwargs)
        with self.assertRaisesRegex(RuntimeError, "decode failure"):
            comparison.decode_head_pair(torch, model, replacement, latent, conditions, {}, broken)
        self.assertIs(model.denoiser.rgb_responsibility_heads, original)

    def test_input_mutation_is_rejected(self):
        for which in ("latent", "conditions"):
            torch, model, original, replacement, latent, conditions, decode = self.fixture()
            def mutated(m, x, c, cfg, **kwargs):
                (x if which == "latent" else c).add_(1)
                return decode(m, x, c, cfg, **kwargs)
            with self.subTest(which=which), self.assertRaisesRegex(ValueError, "mutated"):
                comparison.decode_head_pair(torch, model, replacement, latent, conditions, {}, mutated)
            self.assertIs(model.denoiser.rgb_responsibility_heads, original)

    def test_base_or_mask_change_is_rejected(self):
        for key in ("baseDecodedRgb", "responsibilityMasks"):
            torch, model, original, replacement, latent, conditions, decode = self.fixture()
            def changed(m, x, c, cfg, **kwargs):
                final, evidence = decode(m, x, c, cfg, **kwargs)
                if m.denoiser.rgb_responsibility_heads is replacement:
                    evidence[key] = evidence[key] + 1 if key == "baseDecodedRgb" else (c[:, :1] + 1,)
                return final, evidence
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "changed"):
                comparison.decode_head_pair(torch, model, replacement, latent, conditions, {}, changed)

    def test_wrong_shape_and_nonfinite_are_rejected(self):
        torch, model, original, replacement, latent, conditions, decode = self.fixture()
        for x, c in ((latent[:, :11], conditions), (latent, conditions[:, :22]),
                     (latent + float("nan"), conditions), (latent, conditions + float("inf"))):
            with self.assertRaises(ValueError):
                comparison.decode_head_pair(torch, model, replacement, x, c, {}, decode)

    def test_summary_retains_regressions_and_requires_all_six(self):
        rows = []
        for i, sample in enumerate(comparison.adapter.SAMPLES):
            for j, seed in enumerate(comparison.SETTINGS["seedsBySample"][i]):
                arms = {}
                for arm, value in (("baseline", 2.), ("adapted", (1., 2., 3.)[j])):
                    arms[arm] = {"final": dict.fromkeys(("rgbMae", "laplacianMae", "edgeMae", "phase4ResidualRmsAfterGlobalBiasRemoval"), value),
                        "semanticRegions": {key: {"rgbMae": value} for key in comparison.adapter.HEADS}}
                rows.append({"sampleId": sample, "seed": seed, "measurements": arms})
        result = comparison.summarize(rows)
        for sample in result:
            for value in sample["metrics"].values():
                self.assertEqual((value["improvedCount"], value["equalCount"], value["worseCount"]), (1, 1, 1))
                self.assertEqual(value["relativeReductionPercentRange"], [-50., 50.])
        for invalid in (rows[:-1], list(reversed(rows)), rows + [rows[0]]):
            with self.assertRaises(ValueError):
                comparison.summarize(invalid)

    def test_real_pair_preserves_velocity_base_masks_and_weights(self):
        import torch
        from ai_painter.complete_world.split_training import state_hash
        from train_ai_assisted_conditional_denoiser import decode_final_visible_rgb
        plan = comparison.materialize(ROOT, SOURCE)
        model, replacement, normalization, package = comparison.load_frozen_pair(ROOT, plan)
        before = state_hash((model.state_dict(), replacement.state_dict()))
        original = model.denoiser.rgb_responsibility_heads
        item = comparison.adapter.HeadDataset(ROOT, package)[0]
        conditions = item["conditions"][None]
        latent = torch.randn((1, 12, 48, 64), generator=torch.Generator().manual_seed(17))
        with torch.inference_mode(), comparison.exact_inference_runtime(torch):
            velocity = model.predict_velocity(latent, torch.tensor([500]), conditions)
            try:
                model.denoiser.rgb_responsibility_heads = replacement
                self.assertTrue(torch.equal(velocity, model.predict_velocity(latent, torch.tensor([500]), conditions)))
            finally:
                model.denoiser.rgb_responsibility_heads = original
            values = comparison.decode_head_pair(torch, model, replacement, latent, conditions, package["config"], decode_final_visible_rgb)
            for final, evidence in values.values():
                metrics = comparison.measure(torch, final, evidence, item["image"][None], conditions, package["config"])
                self.assertEqual(metrics["outsideCoverageMaxAbsoluteChange"], 0)
        self.assertEqual(state_hash((model.state_dict(), replacement.state_dict())), before)
        self.assertTrue(all(not p.requires_grad and p.grad is None for p in list(model.parameters()) + list(replacement.parameters())))
        self.assertFalse(torch.cuda.is_initialized())


if __name__ == "__main__":
    unittest.main()
