"""Full synthetic success/failure; never consume the project real claim."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import torch
sys.path.insert(0, str(Path(__file__).absolute().parents[3] / "ml/ai-painter/scripts"))
import check_stage4_mvp256_dry_appearance_regime_cpu as checker
from test_object_appearance_regime_conditioned_cpu import ORDER, scene
from ai_painter.complete_world.object_appearance_regime_input_cpu import bound_regime, encode_season, SEASONS

def prepare(_reader): return {"order": ORDER}

def load(_reader, _plan, ordinal, season):
    c, table = scene()
    image = torch.linspace(0, 1, 256)[None, None, :].expand(3, 192, 256).contiguous()
    return {"split": "train", "sampleId": "synthetic-" + str(ordinal), "conditions": c[0],
        "image": image, "objectInstanceTable": table}, encode_season(season), {"synthetic": True, "ordinal": ordinal}

def metadata_fixture():
    keys = ("conditionPack", "taskPackage", "regionSourcePackage", "seasonSnapshot", "regionalProfile", "sourceRegistry")
    bindings = {key: {"path": key + ".json", "sha256": "a"*64} for key in keys}
    bindings["regionSourcePackage"]["taskBoundCanonicalPackageSha256"] = "b"*64
    ecology = {"season": SEASONS[0], "snapshotId": "audit-only"}
    material = {"season": SEASONS[0], "weather": "dry", "lighting": "warm", "groundMoisture": "dry"}
    source = {"seasonSnapshotPath": "seasonSnapshot.json", "seasonSnapshotSha256": "a"*64,
        "realEarthRegionSourcePackagePath": "regionSourcePackage.json", "realEarthRegionSourcePackageSha256": "b"*64,
        "regionalProfilePath": "regionalProfile.json", "regionalProfileSha256": "a"*64}
    climate = {"sourceId": "climate", "role": "regional_climate_and_monsoon_context", "license": "licensed-metadata",
        "attribution": "provider", "acquisitionStatus": "acquired_and_hashed", "visualTrainingTargetEligible": False}
    values = {"conditionPack.json": {"sourceBindings": {"taskPackagePath": "taskPackage.json"},
        "categoricalConditions": {"ecologyPlan": ecology, "materialPlan": material}},
        "taskPackage.json": {"sourceBindings": source, "directorPlan": {"singleMapEcologyPlan": ecology, "singleMapMaterialPlan": material}},
        "regionSourcePackage.json": {"packageSha256": "b"*64, "sourceProvenance": {"seasonSnapshotPath": "seasonSnapshot.json",
            "seasonSnapshotSha256": "a"*64, "worldProfilePath": "regionalProfile.json", "worldProfileSha256": "a"*64,
            "sourceRegistryPath": "sourceRegistry.json", "sourceRegistrySha256": "a"*64, "sources": [climate]}},
        "seasonSnapshot.json": {"schemaVersion": "natural-home-visual-snapshot-v1", "status": "provisional_owner_approved_profile_baseline",
            "isFinal": False, "usage": {"originalImageCoverageBaseline": True}, "snapshotId": ecology["snapshotId"], "environment": material},
        "regionalProfile.json": {}, "sourceRegistry.json": {"sources": [climate]}}
    class FakeReader:
        root = checker.ROOT
        def json(self, binding): return deepcopy(values[binding["path"]])
        def snapshot(self, path): return b"", {"path": path, "sha256": "c"*64}
    return FakeReader(), bindings, values

class CheckerTests(unittest.TestCase):
    def test_full_synthetic_success_original_loss_4_16_4_and_repeat(self):
        rng, threads = torch.random.get_rng_state().clone(), torch.get_num_threads()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            checker.execute(output, prepare, load, synthetic=True)
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["callCounts"], {"generatorForwardsAttempted": 4, "generatorForwardsCompleted": 4,
                "generatorGradCallsAttempted": 16, "generatorGradCallsCompleted": 16,
                "discriminatorGradCallsAttempted": 4, "discriminatorGradCallsCompleted": 4})
            self.assertEqual(report["actualGraph"]["seasonalElements"], 1152)
            self.assertEqual(report["initialState"], report["finalState"])
            self.assertEqual(len(report["sampleResults"]), 4)
            for i, row in enumerate(report["sampleResults"]): self.assertGreater(row["seasonalSliceL2"][i], 0)
            before = (output / "report.json").read_bytes()
            with self.assertRaises(ValueError): checker.execute(output, prepare, load, synthetic=True)
            self.assertEqual(before, (output / "report.json").read_bytes()); self.assertFalse((output / "failure.json").exists())
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state())); self.assertEqual(threads, torch.get_num_threads())
        self.assertFalse(torch.cuda.is_initialized())

    def test_partial_grad_failure_retains_actual_counts_and_closes(self):
        original, calls = torch.autograd.grad, []
        def fault(*args, **kwargs):
            calls.append(1)
            if len(calls) == 2: raise RuntimeError("injected first generator gradient failure")
            return original(*args, **kwargs)
        with tempfile.TemporaryDirectory() as directory, patch.object(torch.autograd, "grad", side_effect=fault):
            output = Path(directory)
            with self.assertRaises(RuntimeError): checker.execute(output, prepare, load, synthetic=True)
            failure = json.loads((output / "failure.json").read_text(encoding="utf-8"))
            self.assertEqual(failure["callCounts"]["discriminatorGradCallsCompleted"], 1)
            self.assertEqual(failure["callCounts"]["generatorGradCallsAttempted"], 1)
            self.assertEqual(failure["callCounts"]["generatorGradCallsCompleted"], 0)
            self.assertIsNotNone(failure["actualGraph"])
            self.assertEqual(failure["gradientFailureEvidence"]["gradientSetsAvailable"], 0)
            self.assertEqual(failure["gradientFailureEvidence"]["maxAbsoluteError"]["value"], None)
            self.assertFalse((output / "report.json").exists())
            with self.assertRaises(ValueError): checker.execute(output, prepare, load, synthetic=True)

    def test_state_mutation_rejected(self):
        original = checker.probe
        def fault(model, *args, **kwargs):
            result = original(model, *args, **kwargs)
            with torch.no_grad(): next(model.parameters()).add_(1)
            return result
        with tempfile.TemporaryDirectory() as directory, patch.object(checker, "probe", side_effect=fault):
            output = Path(directory)
            with self.assertRaisesRegex(ValueError, "per-sample state changed"): checker.execute(output, prepare, load, synthetic=True)
            self.assertTrue((output / "failure.json").exists())

    def test_sha_and_path_mutation_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / "input.json").write_text("{}", encoding="utf-8")
            reader = checker.Reader(root)
            with self.assertRaisesRegex(ValueError, "SHA differs"): reader.read({"path": "input.json", "sha256": "0"*64})
            for path in ("../input.json", "/input.json", "C:/input.json"):
                with self.assertRaises(ValueError): reader.path(path)

    def test_metadata_success_forbidden_fields_canonical_and_season_rejections(self):
        reader, bindings, values = metadata_fixture()
        with patch("ai_painter.complete_world.object_appearance_regime_input_cpu.subprocess.run") as run:
            run.return_value.stdout = "b"*64
            expected, _ = bound_regime(reader, bindings)
            values["conditionPack.json"].update({"sampleId": "different", "worldId": "different", "coordinate": 999,
                "hash": "forbidden", "freeText": "different", "landscapeType": "different"})
            actual, _ = bound_regime(reader, bindings); self.assertTrue(torch.equal(expected, actual))
            run.return_value.stdout = "d"*64
            with self.assertRaisesRegex(ValueError, "recomputed canonical"): bound_regime(reader, bindings)
            run.return_value.stdout = "b"*64
            values["seasonSnapshot.json"]["environment"] = {**values["seasonSnapshot.json"]["environment"], "season": SEASONS[1]}
            with self.assertRaisesRegex(ValueError, "season binding differs"): bound_regime(reader, bindings)

    def test_source_not_prepared_preserves_error_and_missing_graph(self):
        def fail(_reader): raise RuntimeError("synthetic source preparation failed")
        with tempfile.TemporaryDirectory() as directory, patch.object(checker, "build", side_effect=AssertionError("model must not be built")):
            with self.assertRaisesRegex(RuntimeError, "source preparation failed"):
                checker.execute(Path(directory), fail, load, synthetic=True)
            failure = json.loads((Path(directory) / "failure.json").read_text(encoding="utf-8"))
            self.assertIsNone(failure["actualGraph"]); self.assertIsNone(failure["plan"])
            self.assertEqual(failure["gradientFailureEvidence"]["status"], "not_started")
            self.assertEqual(failure["callCounts"], checker.COUNTS)

    def test_loader_failure_has_measured_graph_but_no_gradient_measurements(self):
        def fail(*_args): raise RuntimeError("synthetic loader failed")
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "loader failed"):
                checker.execute(Path(directory), prepare, fail, synthetic=True)
            failure = json.loads((Path(directory) / "failure.json").read_text(encoding="utf-8"))
            self.assertIsNotNone(failure["actualGraph"])
            self.assertEqual(failure["gradientFailureEvidence"]["status"], "not_computed")
            self.assertEqual(failure["callCounts"], checker.COUNTS)

    def test_original_adapter_rejection_persists_exact_boundary_and_counters(self):
        original = checker.autograd
        captured = []
        before = []
        def inject(loss, parameters, counters, kind, budget, retain=False):
            result = original(loss, parameters, counters, kind, budget, retain)
            if kind == "generator":
                before.append([None if v is None else v.detach().view(torch.uint8).clone() for v in result])
                captured.append(result)
                if len(captured) == 1:
                    replacement = list(result)
                    replacement[-1] = result[-1].detach().clone()
                    replacement[-1].reshape(-1)[:2].add_(0.25)
                    return tuple(replacement)
            return result
        with tempfile.TemporaryDirectory() as directory, patch.object(checker, "autograd", side_effect=inject):
            output = Path(directory)
            with self.assertRaisesRegex(ValueError, "actual total gradient identity differs at parameter"):
                checker.execute(output, prepare, load, synthetic=True)
            failure = json.loads((output / "failure.json").read_text(encoding="utf-8"))
            evidence = failure["gradientFailureEvidence"]; index = failure["actualGraph"]["tensors"] - 1
            self.assertEqual(evidence["failingParameter"]["index"], index)
            self.assertEqual(evidence["failingParameter"]["name"], failure["actualGraph"]["parameters"][index]["name"])
            self.assertEqual(evidence["failingParameter"]["shape"], [3])
            self.assertEqual(evidence["failingParameter"]["dtype"], "torch.float32")
            self.assertEqual(evidence["status"], "captured_finite")
            self.assertEqual(evidence["outsideToleranceElements"], 2)
            self.assertAlmostEqual(evidence["maxAbsoluteError"]["value"], 0.25, places=5)
            self.assertEqual(len(evidence["examples"]), 2)
            self.assertEqual(failure["callCounts"]["generatorGradCallsCompleted"], 4)
            self.assertEqual(failure["callCounts"]["generatorForwardsCompleted"], 1)
            self.assertEqual(failure["callCounts"]["discriminatorGradCallsCompleted"], 1)
            self.assertEqual(failure["error"], evidence["originalError"])
            self.assertFalse((output / "report.json").exists())
            with self.assertRaises(ValueError): checker.execute(output, prepare, load, synthetic=True)
        for values, saved in zip(captured, before):
            self.assertTrue(all(v is None if s is None else torch.equal(v.detach().view(torch.uint8), s) for v, s in zip(values, saved)))

    def test_diagnostic_exception_cannot_replace_original_adapter_error(self):
        original = checker.apply_object_head_core_priority_update_v24_cpu
        def reject(**kwargs):
            original(**kwargs)
            raise ValueError("actual total gradient identity differs at parameter 0")
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(checker, "apply_object_head_core_priority_update_v24_cpu", side_effect=reject), \
             patch.object(checker, "summarize_gradient_failure", side_effect=RuntimeError("synthetic diagnostic failed")):
            with self.assertRaisesRegex(ValueError, "identity differs at parameter 0"):
                checker.execute(Path(directory), prepare, load, synthetic=True)
            failure = json.loads((Path(directory) / "failure.json").read_text(encoding="utf-8"))
            self.assertEqual(failure["error"], "actual total gradient identity differs at parameter 0")
            self.assertEqual(failure["gradientFailureEvidence"]["status"], "diagnostic_failed")
            self.assertEqual(failure["gradientFailureEvidence"]["diagnosticError"], "synthetic diagnostic failed")

class GradientSummaryTests(unittest.TestCase):
    def test_exact_statistics_none_semantics_boundary_indices_and_no_mutation(self):
        parameters = (torch.nn.Parameter(torch.zeros(2, 3)), torch.nn.Parameter(torch.zeros(2, 3)))
        graph = {"parameters": [{"name": "first", "shape": [2, 3]}, {"name": "last", "shape": [2, 3]}]}
        expected = torch.tensor([[1., 2., 0.], [3., 5., 0.]])
        actual = torch.tensor([[1., 2., 0.], [4., 5., 6.]])
        gradients = [(actual.clone(), actual.clone()), (None, None), (None, None), (expected.clone(), expected.clone())]
        saved = [[None if v is None else v.detach().view(torch.uint8).clone() for v in sequence] for sequence in gradients]
        for index in (0, 1):
            evidence = checker.summarize_gradient_failure(graph, parameters, gradients,
                ValueError("actual total gradient identity differs at parameter " + str(index)))
            self.assertEqual(evidence["failingParameter"]["name"], ("first", "last")[index])
            self.assertEqual(evidence["outsideToleranceElements"], 2)
            self.assertEqual(evidence["maxAbsoluteError"], {"status": "finite", "value": 6.0})
            self.assertEqual(evidence["maxRelativeError"], {"status": "positive_infinity", "value": None})
            self.assertEqual([v["flatIndex"] for v in evidence["examples"]], [3, 5])
            self.assertAlmostEqual(evidence["examples"][0]["toleranceAtElement"]["value"], 1e-6+1e-5*3)
            self.assertEqual(evidence["comparison"]["atol"], 1e-6); self.assertEqual(evidence["comparison"]["rtol"], 1e-5)
            self.assertTrue(evidence["noneGradientsNormalizedToZero"]["structured"])
        for sequence, snapshot in zip(gradients, saved):
            self.assertTrue(all(v is None if s is None else torch.equal(v.detach().view(torch.uint8), s) for v, s in zip(sequence, snapshot)))

    def test_missing_sequences_are_unavailable_and_examples_bounded(self):
        parameter = torch.nn.Parameter(torch.zeros(20)); graph = {"parameters": [{"name": "bounded", "shape": [20]}]}
        error = ValueError("actual total gradient identity differs at parameter 0")
        missing = checker.summarize_gradient_failure(graph, (parameter,), [], error)
        self.assertEqual(missing["status"], "not_available")
        self.assertIsNone(missing["outsideToleranceElements"]); self.assertIsNone(missing["maxAbsoluteError"]["value"])
        evidence = checker.summarize_gradient_failure(graph, (parameter,), [(torch.ones(20),), (None,), (None,), (None,)], error)
        self.assertEqual(evidence["outsideToleranceElements"], 20); self.assertEqual(len(evidence["examples"]), 8)

    def test_nonfinite_payload_is_standard_json_and_preserves_original_failure(self):
        parameter = torch.nn.Parameter(torch.zeros(4)); graph = {"parameters": [{"name": "nonfinite", "shape": [4]}]}
        actual = torch.tensor([float("nan"), float("inf"), -float("inf"), 1.])
        saved = actual.view(torch.uint8).clone(); destination = {}
        error = ValueError("actualTotal[0] must be finite")
        checker.record_gradient_failure(destination, graph, (parameter,), [(actual,), (None,), (None,), (None,)], error)
        encoded = json.dumps(destination, allow_nan=False)
        decoded = json.loads(encoded, parse_constant=lambda value: self.fail("nonstandard JSON: " + value))
        self.assertEqual(decoded["status"], "captured_nonfinite")
        self.assertEqual(decoded["nonfiniteActualElements"], 3)
        self.assertEqual(decoded["originalError"], str(error))
        self.assertEqual(decoded["maxAbsoluteError"], {"status": "undefined_nonfinite_inputs", "value": None})
        self.assertEqual([v["actualTotal"]["status"] for v in decoded["examples"][:3]], ["nan", "positive_infinity", "negative_infinity"])
        self.assertTrue(torch.equal(actual.view(torch.uint8), saved))

    def test_expected_overflow_or_diagnostic_error_never_hides_original(self):
        parameter = torch.nn.Parameter(torch.zeros(1)); graph = {"parameters": [{"name": "overflow", "shape": [1]}]}
        gradients = [(torch.zeros(1),), *( (torch.full((1,), 2e38),) for _ in range(3))]
        original = ValueError("actual total gradient identity differs at parameter 0")
        destination = {}; checker.record_gradient_failure(destination, graph, (parameter,), gradients, original)
        self.assertEqual(destination["status"], "captured_nonfinite")
        self.assertEqual(destination["nonfiniteExpectedElements"], 1)
        json.dumps(destination, allow_nan=False)
        with patch.object(checker, "summarize_gradient_failure", side_effect=RuntimeError("capture error")):
            checker.record_gradient_failure(destination, graph, (parameter,), gradients, original)
        self.assertEqual(destination["originalError"], str(original))
        self.assertEqual(destination["status"], "diagnostic_failed")

if __name__ == "__main__": unittest.main()
