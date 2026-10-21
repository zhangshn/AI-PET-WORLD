"""Pure metadata/aggregation tests; no model, forwards, autograd or CUDA."""
import importlib.util
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest

SOURCE = Path(__file__).absolute().parents[1] / "scripts/check_current_checkpoint_train_fit_cpu_v1.py"
spec = importlib.util.spec_from_file_location("fit_diagnostic_test_module", SOURCE)
fit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fit)


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


if __name__ == "__main__":
    unittest.main()
