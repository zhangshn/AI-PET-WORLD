"""Artificial complete-math four-case evidence and isolated checker negatives."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import torch
from copy import deepcopy
sys.path.insert(0, str(Path(__file__).absolute().parents[3] / "ml/ai-painter/scripts"))
import check_stage4_appearance_regime_execution_cpu as checker
from test_painter_stage4_appearance_regime_probe import bound_fixture
from test_object_appearance_regime_conditioned_cpu import ORDER
from test_compare_stage4_mvp256_dry_rgb_bias_precision_cpu import model_factory as tiny_model, critic_factory as tiny_critic, graph as tiny_graph


def prepare_full(_reader):
    return {"order": ORDER, "selected": {str(i): {"identity": {"sampleId": "synthetic-" + str(i)}} for i, _ in checker.SELECTED}}


def load_full(_reader, plan, ordinal, season):
    sample = bound_fixture(season, plan["selected"][str(ordinal)]["identity"]["sampleId"])
    return sample, sample["appearance_regime"], {"synthetic": True}


def prepare_small(_reader):
    return {"order": ["synthetic"], "selected": {str(i): {"identity": {"sampleId": "synthetic-" + str(i)}} for i, _ in checker.SELECTED}}


def load_small(_reader, plan, ordinal, season):
    return {"split": "train", "sampleId": plan["selected"][str(ordinal)]["identity"]["sampleId"],
        "conditions": torch.zeros(48, 2, 2), "image": torch.zeros(3, 2, 2), "objectInstanceTable": []}, checker.parent.encode_season(season), {"synthetic": True}


def fixture_probe(_model, _critic, _sample, _code, counters, budget, **_kwargs):
    for key in checker.EXPECTED:
        for _ in range(4 if key.startswith("generator") else 1): budget(); counters[key] += 1
    return {"counterFixtureOnly": True, "realMathRun": False}


def execute_small(output, **changes):
    options = {"output": output, "synthetic": True, "prepare": prepare_small, "loader": load_small,
        "model_factory": tiny_model, "baseline_factory": tiny_model, "critic_factory": tiny_critic,
        "graph_function": tiny_graph, "probe_function": fixture_probe}
    options.update(changes); return checker.execute(**options)


class ExecutionCheckerTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone(); self.flags = checker.comparison.backend_state()
    def tearDown(self):
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state())); self.assertEqual(self.flags, checker.comparison.backend_state())
        torch.set_num_threads(self.threads); self.assertFalse(torch.cuda.is_initialized())

    def test_complete_artificial_four_original_losses_full107_heads_seasonal_slices(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            checker.execute(output=output, synthetic=True, prepare=prepare_full, loader=load_full,
                model_factory=checker.build, baseline_factory=checker.predecessor.build,
                critic_factory=checker.parent.build_conditional_texture_discriminator, graph_function=checker.graph, probe_function=checker.probe)
            data = (output / "report.json").read_bytes(); report = json.loads(data)
            self.assertEqual(report["status"], "synthetic_cpu_bridge_checked_not_qualified")
            self.assertEqual(report["callCounts"], checker.EXPECTED); self.assertEqual(report["optimizerSteps"], 0)
            self.assertFalse(report["gpuInitialized"]); self.assertTrue(report["terminalAssertionsCompleted"])
            self.assertEqual(report["initialState"], report["finalState"])
            self.assertEqual(report["actualGraph"]["tensors"], 107); self.assertEqual(report["actualGraph"]["elements"], 2240671)
            self.assertEqual(report["parameterInitialization"]["originalParameterDigest"], report["parameterInitialization"]["successorParameterDigest"])
            for (_, season), case in zip(checker.SELECTED, report["sampleResults"]):
                self.assertTrue(case["allParameterIdentity"]["passedAllOriginalToleranceMasks"])
                self.assertEqual(len(case["allParameterIdentity"]["parameters"]), 107)
                self.assertEqual(case["fourHeadUpdate"]["independentFullParameterGradientTensorCounts"], [107] * 4)
                active = checker.parent.SEASONS.index(season)
                self.assertGreater(case["seasonalSliceL2"][active], 0)
                self.assertTrue(all(v == 0 for i, v in enumerate(case["seasonalSliceL2"]) if i != active))
                self.assertTrue(all(v > 0 for v in case["fourHeadUpdate"]["generatorGradientFacts"]["headCandidateL2"].values()))
            with self.assertRaisesRegex(ValueError, "already consumed"): execute_small(output)
            self.assertEqual((output / "report.json").read_bytes(), data)

    def test_last_nonfinite_preserves_four_sets_primary_and_terminal_counts(self):
        model, critic = checker.profile.fresh_networks(ORDER); critic.eval().requires_grad_(False)
        sample, code, _ = load_full(None, prepare_full(None), 2, "dry_season")
        original = torch.autograd.grad; calls = []
        def wrong(*args, **kwargs):
            values = list(original(*args, **kwargs)); calls.append(1)
            if len(calls) == 5: values[0] = torch.full_like(values[0], float("nan"))
            return tuple(values)
        counters = checker.Counters(); evidence = {}
        with patch.object(torch.autograd, "grad", wrong):
            with self.assertRaisesRegex(ValueError, "nonfinite") as context:
                checker.probe(model, critic, sample, code, counters, lambda: None, failure_evidence=evidence)
        self.assertEqual(evidence["gradientSetsAvailable"], 4)
        self.assertEqual(counters["generatorGradCallsCompleted"], 4)
        self.assertEqual(evidence["originalError"], str(context.exception))
        self.assertTrue(evidence["allParameterIdentity"]["allFailureIndices"]); json.dumps(evidence, allow_nan=False)

    def test_hostile_diagnostic_and_rng_backend_mutation_preserve_first_error_and_restore(self):
        model, critic = checker.profile.fresh_networks(ORDER); critic.eval().requires_grad_(False)
        sample = bound_fixture(); counters = checker.Counters()
        class Hostile(dict):
            def update(self, *_args, **_kwargs): raise RuntimeError("secondary diagnostic update")
            def setdefault(self, *_args, **_kwargs): raise RuntimeError("secondary diagnostic append")
        def fail(*_args, **_kwargs):
            torch.rand(1); torch.backends.mkldnn.enabled = not self.flags["mkldnnEnabled"]
            raise ValueError("first gradient root")
        with patch.object(checker.profile, "_generator_candidate", fail):
            with self.assertRaisesRegex(ValueError, "first gradient root"):
                checker.probe(model, critic, sample, sample["appearance_regime"], counters, lambda: None, failure_evidence=Hostile())
        self.assertTrue(torch.equal(self.rng, torch.random.get_rng_state())); self.assertEqual(self.flags, checker.comparison.backend_state())
        self.assertEqual(counters["modelForwardsCompleted"], 1)

    def test_once_counter_fixture_partial_failure_and_no_real_success_schema(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory); execute_small(output)
            report = json.loads((output / "report.json").read_text())
            self.assertEqual(report["callCounts"], checker.EXPECTED)
            self.assertNotEqual(report["status"], "cpu_execution_bridge_checked_not_gpu_qualified")
            with self.assertRaises(ValueError): execute_small(output)
        def fail(_m, _c, _s, _code, counters, _budget, **_kwargs):
            counters["modelForwardsAttempted"] += 1; raise RuntimeError("partial root")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with self.assertRaisesRegex(RuntimeError, "partial root"): execute_small(output, probe_function=fail)
            report = json.loads((output / "failure.json").read_text())
            self.assertEqual(report["callCounts"]["modelForwardsAttempted"], 1)
            self.assertEqual(report["callCounts"]["modelForwardsCompleted"], 0)
            self.assertFalse(report["terminalAssertionsCompleted"]); self.assertFalse((output / "report.json").exists())

    def test_timeout_caps_quota_overrides_source_manifest_reader(self):
        ticks = iter((0., 181., 182.))
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "180-second"): execute_small(Path(directory), clock=lambda: next(ticks))
            failure = json.loads((Path(directory) / "failure.json").read_text()); self.assertEqual(failure["callCounts"], {k: 0 for k in checker.EXPECTED})
        counters = checker.Counters(); counters.begin_case(); counters["modelForwardsAttempted"] += 1
        with self.assertRaisesRegex(ValueError, "call limit"): counters["modelForwardsAttempted"] += 1
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory); (output / "quota.bin").write_bytes(b"x" * checker.BUDGET["outputBytes"])
            with self.assertRaisesRegex(ValueError, "reserve"): execute_small(output)
            self.assertFalse((output / "claim.json").exists())
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "overrides"): checker.execute(output=directory)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / "data.txt").write_text("immutable")
            binding = {"path": "data.txt", "sha256": checker.hashlib.sha256(b"immutable").hexdigest()}
            reader = checker.FrozenReader([binding], root=root); self.assertEqual(reader.read(binding), b"immutable")
            with self.assertRaises(ValueError): reader.snapshot("unbound.txt")
            (root / "data.txt").write_text("changed")
            with self.assertRaises(ValueError): reader.read(binding)

    def test_authentication_manifest_self_binding_no_cycle_and_missing_source_fails(self):
        source = {"path": "synthetic/source.py", "sha256": "a" * 64}
        self_index = {"path": checker.OUTPUT + "/frozen-bindings.json", "sha256": "b" * 64}
        manifest = {"schemaVersion": "t-q4-36-n-frozen-bindings-v1", "task": "T-Q4-36-N",
            "capabilityVersion": checker.CAPABILITY, "architecture": checker.ARCHITECTURE, "budget": checker.BUDGET,
            "selection": [{"trainOrdinal": o, "season": s} for o, s in checker.SELECTED],
            "metadataCounts": {"train": 48, "validation": 8}, "validationRgbRead": False,
            "executionAuthorityGranted": False, "sourceClosure": [source["path"]], "bindings": [source]}
        class Reader:
            def read(self, _binding): return b"synthetic"
            def json(self, binding):
                if binding == checker.comparison.capture.REGISTRY:
                    return {"registryRevision": 371, "activeExecution": None, "nextMachineAction": None}
                if binding == checker.PREDECESSOR: return {"status": "fixed_four_cpu_checked_not_execution_qualified"}
                raise AssertionError("unexpected synthetic identity")
        actual = {**manifest, "bindings": [source, self_index]}
        with patch.object(checker, "binding_template", return_value=actual), patch.object(checker.parent, "verify_loaded_sources"):
            checker.authenticate(Reader(), manifest)
            invalid = deepcopy(manifest); invalid["bindings"] = []
            with self.assertRaisesRegex(ValueError, "missing"): checker.authenticate(Reader(), invalid)
            invalid = deepcopy(manifest); invalid["capabilityVersion"] = "old"
            with self.assertRaisesRegex(ValueError, "contract"): checker.authenticate(Reader(), invalid)


if __name__ == "__main__": unittest.main()
