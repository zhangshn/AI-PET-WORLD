"""Synthetic orchestration/metadata only; no project images or real factories."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import torch
sys.path.insert(0, str(Path(__file__).absolute().parents[3] / "ml/ai-painter/scripts"))
import diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu as runner

def prepare(_reader):
    return {"trainOrdinal": 2, "season": "dry_season", "order": ["synthetic"],
        "sourceIdentity": {"sampleId": "synthetic2", "ordinal": 0, "split": "train"}}

def loader(_reader, plan, ordinal, season):
    if (ordinal, season) != (2, "dry_season"): raise AssertionError("wrong sample")
    return {"split": "train", "sampleId": plan["sourceIdentity"]["sampleId"],
        "image": torch.zeros(3, 2, 2), "conditions": torch.zeros(23, 2, 2), "objectInstanceTable": []}, \
        runner.parent.encode_season(season), {"synthetic": True}

def model_factory(**_kwargs): return torch.nn.Linear(1, 1)
def critic_factory(): return torch.nn.Linear(1, 1)

def graph(model):
    parameters = tuple(model.parameters())
    return parameters, {}, 0, {"synthetic": True, "tensors": len(parameters),
        "parameters": [{"name": name, "shape": list(value.shape)} for name, value in model.named_parameters()]}

def full_counts(counters, budget):
    for key, maximum in runner.EXPECTED_COUNTS.items():
        for _ in range(maximum): budget(); counters[key] += 1

def success(_model, _critic, _sample, _code, counters, budget, *, failure_evidence):
    full_counts(counters, budget)
    return {"synthetic": True, "noRealMathRun": True}

def rejected(model, _critic, _sample, _code, counters, budget, *, failure_evidence):
    full_counts(counters, budget)
    parameters, _, _, measured = graph(model)
    actual = tuple(torch.ones_like(p) for p in parameters)
    gradients = [actual, tuple(None for p in parameters), tuple(None for p in parameters), tuple(None for p in parameters)]
    original = ValueError("actual total gradient identity differs at parameter 0")
    runner.parent.record_gradient_failure(failure_evidence, measured, parameters, gradients, original)
    raise original

def execute(output, **changes):
    options = {"output": output, "synthetic": True, "prepare": prepare, "loader": loader,
        "model_factory": model_factory, "critic_factory": critic_factory, "graph_function": graph,
        "probe_function": rejected}
    options.update(changes)
    return runner.execute(**options)

def metadata_fixture():
    identity = {"sampleId": "s2", "split": "train", "ordinal": 0,
        "conditionPack": {"path": "pack", "sha256": "a"*64}, "taskPackage": {"path": "task", "sha256": "b"*64}}
    record = {"trainOrdinal": 2, "sampleIdEvidenceOnly": "s2", "appearanceValues": {"season": "dry_season"},
        "conditionPack": identity["conditionPack"], "taskPackage": identity["taskPackage"]}
    order = ["c"+str(i) for i in range(23)]
    values = {runner.DIAGNOSTIC["path"]: {"datasetManifest": {"path": "dataset"}, "trainSplit": {"path": "split"},
        "rows": [{"split": "train", "ordinal": 2, "sampleId": "s2", "identity": identity},
            {"split": "validation", "ordinal": 2, "holdoutMetricMustNotBeUsed": "ignored"}]},
        runner.PROPOSAL["path"]: {"records": [record]}, "dataset": {"identityPayload": {"channelOrder": order, "continuousChannelIds": ["c22"]}},
        "split": {"split": "train", "sampleIds": ["s"+str(i) for i in range(48)]},
        runner.CONDITION["path"]: {"tensorContract": {"channelOrder": order, "typePartitions": {"continuous": ["c22"]}}}}
    class Reader:
        def json(self, binding): return deepcopy(values[binding["path"]])
    return Reader(), values

class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.threads = torch.get_num_threads(); torch.set_num_threads(2)
        self.rng = torch.random.get_rng_state().clone()
        self.flags = (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled())
    def tearDown(self):
        torch.random.set_rng_state(self.rng); torch.set_num_threads(self.threads)
        torch.use_deterministic_algorithms(self.flags[0], warn_only=self.flags[1])

    def test_capture_rejection_keeps_error_graph_counters_and_once_only(self):
        rng = torch.random.get_rng_state().clone()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); execute(root)
            payload = (root/"report.json").read_bytes(); report = json.loads(payload)
            self.assertEqual(report["status"], "capture_completed_original_check_rejected")
            self.assertEqual(report["originalError"]["message"], "actual total gradient identity differs at parameter 0")
            self.assertEqual(report["failedGate"], "original_v24_actual_total_gradient_identity")
            self.assertEqual(report["callCounts"], runner.EXPECTED_COUNTS)
            self.assertEqual(report["trainOrdinal"], 2); self.assertEqual(report["sourceIdentity"]["ordinal"], 0)
            self.assertEqual(report["initialState"], report["finalState"])
            self.assertFalse(report["boundary"]["qualified"]); self.assertTrue(report["boundary"]["synthetic"])
            self.assertFalse((root/"failure.json").exists())
            with self.assertRaisesRegex(ValueError, "already consumed"): execute(root)
            self.assertEqual((root/"report.json").read_bytes(), payload)
        self.assertTrue(torch.equal(rng, torch.random.get_rng_state())); self.assertFalse(torch.cuda.is_initialized())

    def test_passing_original_gate_never_becomes_qualification(self):
        with tempfile.TemporaryDirectory() as directory:
            execute(Path(directory), probe_function=success)
            report = json.loads((Path(directory)/"report.json").read_text())
            self.assertEqual(report["status"], "capture_completed_original_check_passed_not_qualified")
            self.assertIsNone(report["originalError"]); self.assertFalse(report["boundary"]["qualified"])

    def test_partial_failure_retains_exact_calls_and_root_error(self):
        def partial(_m, _c, _s, _code, counters, budget, **_kwargs):
            counters["generatorForwardsAttempted"] += 1; counters["generatorForwardsCompleted"] += 1
            counters["generatorGradCallsAttempted"] += 1
            raise RuntimeError("synthetic partial gradient failure")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(RuntimeError, "partial gradient failure"): execute(root, probe_function=partial)
            failure = json.loads((root/"failure.json").read_text())
            self.assertEqual(failure["error"], "synthetic partial gradient failure")
            self.assertEqual(failure["originalError"]["message"], failure["error"])
            self.assertEqual(failure["callCounts"]["generatorGradCallsAttempted"], 1)
            self.assertEqual(failure["callCounts"]["generatorGradCallsCompleted"], 0)
            self.assertFalse((root/"report.json").exists())
            with self.assertRaises(ValueError): execute(root)

    def test_capture_metadata_incomplete_stays_failed(self):
        def fail(_m, _c, _s, _code, counters, budget, **_kwargs):
            full_counts(counters, budget)
            raise ValueError("actual total gradient identity differs at parameter 0")
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "lacks complete numeric"): execute(Path(directory), probe_function=fail)
            failure = json.loads((Path(directory)/"failure.json").read_text())
            self.assertEqual(failure["status"], "capture_failed_closed")
            self.assertEqual(failure["originalError"]["message"], "actual total gradient identity differs at parameter 0")

    def test_source_model_rng_backend_mutation_rejected_and_restored(self):
        def mutated_model(model, *args, **kwargs):
            result = success(model, *args, **kwargs)
            with torch.no_grad(): next(model.parameters()).add_(1)
            return result
        def mutated_source(model, critic, sample, *args, **kwargs):
            result = success(model, critic, sample, *args, **kwargs); sample["conditions"].add_(1); return result
        def mutated_rng(*args, **kwargs):
            result = success(*args, **kwargs); torch.rand(1); return result
        def mutated_backend(*args, **kwargs):
            result = success(*args, **kwargs)
            torch.use_deterministic_algorithms(not self.flags[0], warn_only=False); return result
        for operation, pattern in ((mutated_model, "state changed"), (mutated_source, "RNG/source"),
                (mutated_rng, "RNG/source"), (mutated_backend, "backend state")):
            before = torch.random.get_rng_state().clone()
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(ValueError, pattern): execute(Path(directory), probe_function=operation)
                self.assertTrue((Path(directory)/"failure.json").exists())
            self.assertTrue(torch.equal(before, torch.random.get_rng_state()))
            self.assertEqual(self.flags, (torch.are_deterministic_algorithms_enabled(), torch.is_deterministic_algorithms_warn_only_enabled()))

    def test_wrong_plan_loaded_split_season_or_identity_rejected(self):
        def wrong_plan(reader): return {**prepare(reader), "trainOrdinal": 3}
        def wrong_split(*args):
            sample, code, identity = loader(*args); sample["split"] = "validation"; return sample, code, identity
        def wrong_season(*args):
            sample, code, identity = loader(*args); return sample, runner.parent.encode_season("wet_season"), identity
        def wrong_id(*args):
            sample, code, identity = loader(*args); sample["sampleId"] = "different"; return sample, code, identity
        for overrides in ({"prepare": wrong_plan}, {"loader": wrong_split}, {"loader": wrong_season}, {"loader": wrong_id}):
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(ValueError): execute(Path(directory), **overrides)
                failure = json.loads((Path(directory)/"failure.json").read_text())
                self.assertEqual(failure["callCounts"], runner.parent.COUNTS)

    def test_time_call_and_combined_output_limits(self):
        calls = []
        def clock(): calls.append(1); return (len(calls)-1)*121
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "120s budget"): execute(Path(directory), clock=clock)
            self.assertEqual(json.loads((Path(directory)/"failure.json").read_text())["callCounts"], runner.parent.COUNTS)
        counters = runner.LimitedCounters()
        counters["generatorForwardsAttempted"] += 1
        with self.assertRaisesRegex(ValueError, "call limit"): counters["generatorForwardsAttempted"] += 1
        self.assertEqual(counters["generatorForwardsAttempted"], 1); self.assertEqual(len(counters.blocked), 1)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root/"budget.bin").write_bytes(b"x"*runner.LIMITS["combinedOutputBytes"])
            with self.assertRaisesRegex(ValueError, "output limit"): runner.write_exclusive(root, "report.json", {"large": True})
            self.assertFalse((root/"report.json").exists())

    def test_guards_block_updates_cuda_checkpoints_png_and_external_writes(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with runner.guards(root):
                for operation in (lambda: torch.cuda._lazy_init(), lambda: torch.save({}, root/"checkpoint.pt"),
                        lambda: torch.load(root/"checkpoint.pt"), lambda: torch.optim.Adam([torch.nn.Parameter(torch.zeros(1))]),
                        lambda: torch.ones(1, requires_grad=True).backward(), lambda: Image.new("RGB", (1,1)).save(root/"image.png")):
                    with self.assertRaises(AssertionError): operation()
                for path in (root/"blocked.PNG", root.parent/"external.json"):
                    with self.assertRaises(ValueError): path.open("w")

class MetadataClosureTests(unittest.TestCase):
    def test_exact_train_membership_and_source_identity_ordinal_kept(self):
        reader, values = metadata_fixture(); plan = runner.prepare_metadata(reader)
        self.assertEqual(plan["trainOrdinal"], 2); self.assertEqual(plan["sourceIdentity"]["ordinal"], 0)
        values[runner.DIAGNOSTIC["path"]]["rows"][1]["holdoutMetricMustNotBeUsed"] = -999
        self.assertEqual(plan, runner.prepare_metadata(reader))
        for change in ("membership", "season", "pack", "channels"):
            reader, values = metadata_fixture()
            if change == "membership": values["split"]["sampleIds"][2] = "wrong"
            elif change == "season": values[runner.PROPOSAL["path"]]["records"][0]["appearanceValues"]["season"] = "wet_season"
            elif change == "pack": values[runner.PROPOSAL["path"]]["records"][0]["conditionPack"] = {"path": "wrong", "sha256": "a"*64}
            else: values["dataset"]["identityPayload"]["channelOrder"] = ["wrong"]
            with self.assertRaises(ValueError): runner.prepare_metadata(reader)

    def test_own_source_and_new_import_are_in_closed_source_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for path in [*runner.parent.FILES, runner.PROGRAM, runner.TEST, "ml/ai-painter/scripts/extra_dependency.py"]:
                target = root/path; target.parent.mkdir(parents=True, exist_ok=True); target.write_text("", encoding="utf-8")
            (root/runner.PROGRAM).write_text("import extra_dependency\n", encoding="utf-8")
            reader = runner.parent.Reader(root); closure = runner.source_closure(reader)
            self.assertIn(runner.PROGRAM, closure); self.assertIn(runner.TEST, closure)
            self.assertIn("ml/ai-painter/scripts/extra_dependency.py", closure)
            bindings = [{"path": p, "sha256": s} for p, s in reader.observed.items() if p != runner.PROGRAM]
            with self.assertRaisesRegex(ValueError, "unbound snapshot/source"):
                runner.source_closure(runner.FrozenReader(bindings, root))

    def test_frozen_source_bytes_cannot_change_and_duplicate_bindings_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root/"source.py").write_bytes(b"before")
            binding = {"path": "source.py", "sha256": hashlib.sha256(b"before").hexdigest()}
            reader = runner.FrozenReader([binding], root); reader.snapshot("source.py")
            (root/"source.py").write_bytes(b"after")
            with self.assertRaisesRegex(ValueError, "SHA differs"): reader.unchanged()
            with self.assertRaisesRegex(ValueError, "duplicate frozen"): runner.FrozenReader([binding, binding], root)

    def test_real_override_and_old_claim_namespace_rejected_without_consuming(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "real capture callbacks/output overrides"):
                runner.execute(output=Path(directory), prepare=prepare)
            self.assertFalse((Path(directory)/"claim.json").exists())
        with self.assertRaisesRegex(ValueError, "synthetic callbacks/output"):
            execute(runner.ROOT/runner.OUTPUT)

if __name__ == "__main__": unittest.main()
