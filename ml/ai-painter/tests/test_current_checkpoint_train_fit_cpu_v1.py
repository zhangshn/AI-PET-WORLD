"""Pure metadata/aggregation tests; no model, forwards, autograd or CUDA."""
import importlib.util
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
import sys

SOURCE = Path(__file__).absolute().parents[1] / "scripts/check_current_checkpoint_train_fit_cpu_v1.py"
spec = importlib.util.spec_from_file_location("fit_diagnostic_test_module", SOURCE)
fit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fit)
sys.path.insert(0, str(SOURCE.parent))


class MetadataTests(unittest.TestCase):
    def test_actual_loader_requires_recomputed_source_closure_first(self):
        reader = SimpleNamespace(verified=False)
        plan = {"identity": "fixed-plan"}
        calls = []
        def verify(actual_reader, actual_plan, *, recompute):
            self.assertIs(actual_reader, reader)
            self.assertIs(actual_plan, plan)
            self.assertIs(recompute, True)
            reader.verified = True
            calls.append("verify")
        def load(actual_reader, actual_plan, *, splits):
            self.assertTrue(reader.verified)
            self.assertEqual(splits, ("train",))
            calls.append("load")
            return "samples", "order"
        self.assertEqual(fit.load_verified_train_sources(SimpleNamespace(verify_data_closure=verify),
            SimpleNamespace(load_samples=load), reader, plan), ("samples", "order"))
        self.assertEqual(calls, ["verify", "load"])

    def test_source_verification_failure_never_loads_samples(self):
        calls = []
        def reject(*args, **kwargs):
            raise ValueError("source closure differs")
        def load(*args, **kwargs):
            calls.append("unexpected_load")
        with self.assertRaisesRegex(ValueError, "source closure differs"):
            fit.load_verified_train_sources(SimpleNamespace(verify_data_closure=reject),
                SimpleNamespace(load_samples=load), object(), {})
        self.assertEqual(calls, [])

    def test_production_run_uses_verified_loader(self):
        tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
        run = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "run")
        verified_calls = [n for n in ast.walk(run) if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Name) and n.func.id == "load_verified_train_sources"]
        unchecked_calls = [n for n in ast.walk(run) if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute) and n.func.attr == "load_samples"]
        self.assertEqual(len(verified_calls), 1)
        self.assertEqual(unchecked_calls, [])

    def test_exact_disjoint_batches(self):
        ids = [str(i) for i in range(48)]
        self.assertEqual(sum([fit.batch_ids(ids, i) for i in range(3)], []), ids)

    def test_wrong_sample_count(self):
        with self.assertRaises(ValueError):
            fit.batch_ids(["a"], 0)

    def test_out_of_range_batch(self):
        with self.assertRaises(ValueError):
            fit.batch_ids([str(i) for i in range(48)], 3)

    def test_duplicate_identity(self):
        with self.assertRaises(ValueError):
            fit.batch_ids(["a"] * 48, 0)

    def test_summary_keeps_negative_values(self):
        rows = [{"sampleId": "a", "fullRgbMae": .2, "objectCorrelations": dict.fromkeys(fit.ROLES, -.3)},
                {"sampleId": "b", "fullRgbMae": .1, "objectCorrelations": dict.fromkeys(fit.ROLES, .5)}]
        value = fit.summarize(rows)
        self.assertAlmostEqual(value["meanRgbMae"], .15)
        self.assertEqual(value["perRole"]["object_rock"]["worst"], ("a", -.3))

    def test_no_applicable_observation_is_not_success(self):
        rows = [{"sampleId": "a", "fullRgbMae": .1, "objectCorrelations": dict.fromkeys(fit.ROLES, None)}]
        self.assertIsNone(fit.summarize(rows)["perRole"]["object_tree"]["mean"])


class ComparisonTests(unittest.TestCase):
    def test_exact_four_batches_and_disjoint_validation(self):
        from current_checkpoint_fit_comparison_cpu_v1 import batch_members
        train, validation = [str(i) for i in range(48)], ["v" + str(i) for i in range(8)]
        pairs = [batch_members(train, validation, i) for i in range(4)]
        self.assertEqual(sum([ids for _, ids in pairs], []), train + validation)
        self.assertEqual([split for split, _ in pairs], ["train"] * 3 + ["validation"])
        with self.assertRaises(ValueError):
            batch_members(train, train[:8], 3)
        with self.assertRaises(ValueError):
            batch_members(train, validation, 4)

    def test_history_cannot_be_caller_forged_or_cross_root(self):
        from decode1_entry_weight_fit_history_v1 import FitHistory, validated_history
        history = FitHistory(str(SOURCE.parents[3]), (), ())
        with self.assertRaises(ValueError):
            validated_history(history, SOURCE.parents[3])
        with self.assertRaises(ValueError):
            validated_history(object(), SOURCE.parents[3])

    def test_ast_equivalence_rejects_changed_forward(self):
        from decode1_entry_weight_fit_history_v1 import function_ast
        self.assertEqual(function_ast("def f(x): return x + 1", "f"), function_ast("def f(x):\n return x+1", "f"))
        self.assertNotEqual(function_ast("def f(x): return x + 1", "f"), function_ast("def f(x): return x + 2", "f"))

    def test_region_metrics_known_identity_and_na(self):
        import torch
        from current_checkpoint_fit_metrics_v1 import region_metrics
        torch.set_num_threads(2)
        rgb = torch.tensor([[[0., .5, 1.]]] * 3)
        value = region_metrics(rgb, rgb, torch.ones((1, 3), dtype=torch.bool))
        self.assertEqual(value["rgbMae"], 0.)
        self.assertAlmostEqual(value["correlation"], 1., places=6)
        value = region_metrics(rgb, torch.zeros_like(rgb), torch.ones((1, 3), dtype=torch.bool))
        self.assertIsNone(value["correlation"])
        self.assertEqual(value["naReason"], "constant_reference_region")
        self.assertEqual(region_metrics(rgb, rgb, torch.zeros((1, 3), dtype=torch.bool))["naReason"], "empty_region")


if __name__ == "__main__":
    unittest.main()
