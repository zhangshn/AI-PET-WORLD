"""T-Q4-72 isolation: no real RGB, model forward, GPU or registry mutation.

Pipeline calls/48-epoch checkpoint counts are explicitly simulated. Only the
memory-only own-factory checkpoint encode/reload tests use actual model states;
they run no forward/autograd/optimizer. Fixtures remain in the task evidence root.
"""
from contextlib import ExitStack, nullcontext
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).absolute().parents[3]
for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
    sys.path.insert(0, str(directory))
import torch
import review_stage4_ecology_regime_execution_cpu as review
import painter_stage4_v24_dry_single_world_checkpoint_worker as shared
import painter_stage4_ecology_regime_training_profile as profile
from ai_painter.complete_world import ecology_regime_managed_checkpoint as codec

EVIDENCE_ROOT = ROOT / ".runtime/ai-painter/ecology-entry-adapters-t-q4-72/review"
ORDER = tuple("terrain_grass terrain_water terrain_path_ground terrain_shoreline terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground signed_distance_boundary moisture_proximity".split())
IDS = [review.SUBJECT_ID] + ["synthetic-validation-" + str(i) for i in range(1, 8)]


def configuration():
    """Synthetic binding plus actual frozen values; no dataset/document read."""
    return {"schema": codec.CONFIGURATION_SCHEMA, "capabilityVersion": review.CAPABILITY,
        "sourceCandidate": {"path": codec.CANDIDATE_PATH, "sha256": "a" * 64},
        "formalSpecification": {"path": codec.SPEC_PATH, "sha256": codec.SPEC_SHA},
        "executionCeiling": deepcopy(shared.RESOURCE_CEILING),
        "checkpointSelection": deepcopy(shared.SELECTION_CONTRACT),
        "scope": {"resolution": [256, 192], "worldCount": 1, "subjectSampleId": review.SUBJECT_ID,
            "subjectSplit": "validation", "waterFactPresent": False, "buildingsRequired": False,
            "artificialRoadNetworkRequired": False, "personalityRequired": False,
            "formalStage4Qualification": False, "runtimePublication": False},
        "dataUse": {"train": 48, "validation": 8, "challenge": 4, "regression": 4,
            "weightUpdatesFrom": ["train"], "checkpointSelectionFrom": ["validation"],
            "challengeAndRegressionContentRead": False, "sourceImageOrSplitMutation": False},
        "seed": 20260929, "gpuAdmissionSeconds": 600, "freshInitializationOnly": True,
        "historicalCheckpointMayInitialize": False, "automaticResumeAllowed": False,
        "optimizer": deepcopy(shared.v24.core.TRAINING["optimizer"])}


def observations(epoch, *, correlation=.1, mae=.125):
    return [{"sampleId": sid, "split": "validation", "epoch": epoch, "fullRgbMae": mae,
             "objectCorrelations": {role: correlation for role in shared.OBJECT_CHANNELS}} for sid in IDS]


def selection(epoch=24, *, correlation=.1, mae=.125):
    return shared.rank_validation_epoch(observations(epoch, correlation=correlation, mae=mae), IDS, epoch=epoch)


def binding(path, raw=b"synthetic"):
    return {"path": path, "sha256": hashlib.sha256(raw).hexdigest()}


def terminal():
    records = [{"epoch": epoch, "counts": {"generator": epoch * 48, "discriminator": epoch * 48},
        "selection": selection(epoch), "validation": observations(epoch),
        "checkpoint": binding("synthetic/checkpoint-" + str(epoch) + ".pt")} for epoch in (24, 36, 48)]
    return {"schema": review.TERMINAL_SCHEMA, "status": "training_completed_review_pending",
        "executionState": "completed", "capabilityVersion": review.CAPABILITY,
        "executionProfile": review.EXECUTION_PROFILE, "executionPackage": binding("synthetic/package.json"),
        "runId": "synthetic-review-run", "packageId": "synthetic-review-package", "completedEpochs": 48,
        "optimizerSteps": {"generator": 2304, "discriminator": 2304},
        "optimizerStepsGenerator": 2304, "optimizerStepsDiscriminator": 2304,
        "checkpointReloadVerified": True, "checkpointPromotable": False,
        "challengeContentRead": False, "regressionContentRead": False,
        "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
        "checkpoints": records, "selectedCheckpointRecord": deepcopy(records[0])}


def fake_worker(runtime):
    return types.SimpleNamespace(CAPABILITY=review.CAPABILITY, EXECUTION_PROFILE=review.EXECUTION_PROFILE,
        TERMINAL_SCHEMA=review.TERMINAL_SCHEMA, checkpoint=codec, runtime=Mock(return_value=runtime))


class CpuIsolationTests(unittest.TestCase):
    def setUp(self):
        guards = ExitStack()
        self.addCleanup(guards.close)
        for owner, name in ((torch.nn.Module, "__call__"), (torch.autograd, "grad"),
                (torch.Tensor, "backward"), (torch.cuda, "init"), (torch.cuda, "_lazy_init"),
                (torch.cuda, "get_rng_state"), (torch.cuda, "get_rng_state_all"),
                (torch.Tensor, "cuda"), (torch.nn.Module, "cuda"),
                (shared.v24.core.cpu, "load_sample"), (profile, "sample_forward")):
            guards.enter_context(patch.object(owner, name, side_effect=AssertionError("real CPU test forbidden call: " + name)))
        for name in ("Adam", "AdamW", "SGD"):
            guards.enter_context(patch.object(torch.optim, name, side_effect=AssertionError("real optimizer forbidden")))


class SelectionTests(CpuIsolationTests):
    def setUp(self):
        super().setUp()
        self.worker_patch = patch.object(review, "worker", fake_worker((None, None, shared, None)))
        self.worker_patch.start()
        self.addCleanup(self.worker_patch.stop)

    def select(self, value):
        return review.selected_record(value, configuration=configuration())

    def test_own_codec_validates_every_epoch_and_earliest_tie_wins(self):
        with patch.object(codec, "validate_selection", wraps=codec.validate_selection) as validate:
            self.assertEqual(self.select(terminal())["epoch"], 24)
        self.assertEqual([call.args[2] for call in validate.call_args_list], [24, 36, 48])

    def test_better_later_rank_wins_and_claimed_wrong_winner_fails(self):
        value = terminal()
        value["checkpoints"][1]["selection"] = selection(36, correlation=.2)
        value["selectedCheckpointRecord"] = deepcopy(value["checkpoints"][1])
        self.assertEqual(self.select(value)["epoch"], 36)
        value["selectedCheckpointRecord"] = value["checkpoints"][2]
        with self.assertRaisesRegex(ValueError, "machine selected"):
            self.select(value)

    def test_missing_complete_terminal_fields_are_rejected(self):
        for key in terminal():
            value = terminal()
            del value[key]
            with self.subTest(key=key), self.assertRaises((ValueError, KeyError)):
                self.select(value)

    def test_wrong_cap_profile_schema_status_and_flags_are_rejected(self):
        for key, bad in (("capabilityVersion", "old"), ("executionProfile", "old"),
                ("schema", "detail-weight-managed-worker-terminal-v1"), ("status", "failed_closed"),
                ("executionState", "executing"), ("runId", " "), ("packageId", ""),
                ("checkpointReloadVerified", 1), ("checkpointPromotable", 0),
                ("challengeContentRead", True), ("regressionContentRead", True),
                ("runtimePublicationAllowed", True), ("formalStage4QualificationAllowed", True)):
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.select({**terminal(), key: bad})

    def test_float_bool_partial_extra_and_missing_counts_are_rejected(self):
        for key in ("completedEpochs", "optimizerStepsGenerator", "optimizerStepsDiscriminator"):
            for bad in (True, float(terminal()[key]), terminal()[key] - 1):
                with self.subTest(key=key, bad=bad), self.assertRaises(ValueError):
                    self.select({**terminal(), key: bad})
        for target in ("terminal", 0, 1, 2):
            for bad in (True, 2304.0 if target == "terminal" else (24, 36, 48)[target] * 48.0, 0):
                value = terminal()
                counts = value["optimizerSteps"] if target == "terminal" else value["checkpoints"][target]["counts"]
                counts["generator"] = bad
                with self.subTest(target=target, bad=bad), self.assertRaises(ValueError):
                    self.select(value)
        for bad in ({"generator": 2304}, {"generator": 2304, "discriminator": 2304, "verified": True}):
            with self.assertRaises(ValueError):
                self.select({**terminal(), "optimizerSteps": bad})

    def test_incomplete_epochs_rank_and_sha_sources_are_rejected(self):
        for change in ("missing", "reordered", "epoch-float", "counts-missing", "rank", "rank-float", "sha", "source", "alias"):
            value = terminal()
            row = value["checkpoints"][1]
            if change == "missing": value["checkpoints"].pop()
            elif change == "reordered": value["checkpoints"].reverse()
            elif change == "epoch-float": row["epoch"] = 36.0
            elif change == "counts-missing": del row["counts"]
            elif change == "rank": row["selection"]["rank"][0] += .1
            elif change == "rank-float": row["selection"]["rank"][2] = -36.0
            elif change == "sha": row["checkpoint"]["sha256"] = "wrong"
            elif change == "source": row["checkpoint"]["path"] = "../old.pt"
            else: row["checkpoint"] = value["checkpoints"][0]["checkpoint"]
            with self.subTest(change=change), self.assertRaises((ValueError, KeyError)):
                self.select(value)


class Reader:
    def __init__(self, root):
        self.root = root
        self.files = {}
        self.reads = []
        self.unchanged = Mock()

    def put(self, path, value):
        raw = value if type(value) is bytes else json.dumps(value, allow_nan=False).encode()
        self.files[path] = raw
        return binding(path, raw)

    def path(self, logical):
        path = self.root / logical
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def read(self, item):
        self.reads.append(item["path"])
        # Deliberately returns bytes without SHA checking: the adapter must check.
        return self.files[item["path"]]


class SyntheticModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.weight = torch.nn.Parameter(torch.zeros(1))
        self.object_rgb_heads = {role: torch.nn.ParameterList([
            torch.nn.Parameter(torch.zeros(1)) for _ in range(4)]) for role in shared.OBJECT_CHANNELS}


class PipelineTests(CpuIsolationTests):
    def setUp(self):
        super().setUp()
        EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(prefix="synthetic-", dir=EVIDENCE_ROOT))
        self.reader = Reader(self.root)
        self.config = configuration()
        self.package = self.reader.put("synthetic/package.json", {"synthetic": True})
        self.value = terminal()
        self.value["executionPackage"] = self.package
        for record in self.value["checkpoints"]:
            record["checkpoint"] = self.reader.put(record["checkpoint"]["path"], b"synthetic")
        self.value["selectedCheckpointRecord"] = deepcopy(self.value["checkpoints"][0])
        self.bound_terminal = self.reader.put("synthetic/worker-terminal.json", self.value)
        self.plan = {"runId": self.value["runId"], "packageId": self.value["packageId"],
            "outputRoot": "synthetic/output", "configuration": self.config,
            "datasetManifest": self.reader.put("synthetic/manifest.json", {"synthetic": True}),
            "sourceCandidate": self.config["sourceCandidate"],
            "validationSplit": self.reader.put("synthetic/validation.json", {"sampleIds": IDS}),
            "programBindings": {"cpuReview": self.reader.put(review.SELF, Path(review.__file__).read_bytes())}}
        self.current = {"schemaVersion": "ai-painter-current-execution-registry-v1", "registryRevision": 1,
            "latestTrainingTerminal": {"runId": self.plan["runId"], **self.bound_terminal}, "activeExecution": None}
        self.save_current()
        self.model, self.critic = SyntheticModel(), SyntheticModel()
        self.events, self.writes = [], {}
        def fresh(order):
            self.assertEqual(tuple(order), ORDER)
            self.events.append("own-factory")
            return self.model, self.critic
        def forward(model, sample, return_evidence):
            self.assertIs(model, self.model)
            self.assertTrue(return_evidence)
            self.events.append("simulated-ecology-forward")
            return torch.full((1, 3, 192, 256), .125), {"synthetic": True}
        self.profile = types.SimpleNamespace(CAPABILITY=review.CAPABILITY,
            fresh_networks=Mock(side_effect=fresh), sample_forward=Mock(side_effect=forward))
        core = types.SimpleNamespace(cpu=types.SimpleNamespace(state_hash=lambda model: "synthetic-state"),
                                   png_bytes=lambda image: b"synthetic-not-a-real-png")
        self.shared = types.SimpleNamespace(OBJECT_CHANNELS=shared.OBJECT_CHANNELS,
            _validated_rank=shared._validated_rank, rank_validation_epoch=shared.rank_validation_epoch,
            _preserve_rng_and_mode=lambda model: nullcontext(), v24=types.SimpleNamespace(core=core),
            original_object_class_spatial_loss=Mock(return_value=(None, {role: .1 for role in shared.OBJECT_CHANNELS})))
        self.worker = fake_worker((torch, self.profile, self.shared, None))
        self.worker.load_package = Mock(return_value=(self.reader, {}, self.plan, self.config))
        self.samples = [{"sampleId": sid, "split": "validation", "image": torch.zeros(3, 192, 256),
                         "conditions": torch.zeros(23, 192, 256), "objectInstanceTable": {}} for sid in IDS]
        def samples(reader, plan, splits):
            self.assertEqual(splits, ("validation",))
            self.events.append("validation-only-load")
            return {"validation": self.samples}, ORDER
        self.worker.load_samples = Mock(side_effect=samples)
        def write(root, logical, value, *, terminal=False):
            self.assertEqual(Path(root), self.root)
            self.writes[logical] = deepcopy(value)
            raw = value if type(value) is bytes else json.dumps(value, allow_nan=False).encode()
            with self.reader.path(logical).open("xb") as stream:
                stream.write(raw)
            return binding(logical, raw)
        self.worker.write = Mock(side_effect=write)
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(review, "worker", self.worker))
        self.stack.enter_context(patch.object(torch.cuda, "is_initialized", return_value=False))
        self.stack.enter_context(patch.object(torch.cuda, "init", side_effect=AssertionError("GPU forbidden")))
        self.stack.enter_context(patch.object(torch.nn.Module, "__call__", side_effect=AssertionError("real forward forbidden")))
        self.stack.enter_context(patch.object(torch.autograd, "grad", side_effect=AssertionError("autograd forbidden")))
        self.stack.enter_context(patch.object(torch.Tensor, "backward", side_effect=AssertionError("backward forbidden")))
        for name in ("Adam", "AdamW", "SGD"):
            self.stack.enter_context(patch.object(torch.optim, name, side_effect=AssertionError("optimizer forbidden")))
        def baseline(*args, **kwargs):
            self.assertIs(kwargs["runtime"][1], self.profile)
            self.events.append("simulated-v24-baseline")
            return {"synthetic": True, "modelForwardCalls": 8}
        self.baseline = self.stack.enter_context(patch.object(review, "baseline_review", side_effect=baseline))
        def reload(raw, **kwargs):
            self.assertIs(kwargs["model"], self.model)
            self.assertIs(kwargs["critic"], self.critic)
            self.assertEqual(kwargs["package_binding"], self.package)
            self.assertEqual(kwargs["run_id"], self.plan["runId"])
            self.assertEqual(kwargs["dataset_binding"], self.plan["datasetManifest"])
            self.events.append("simulated-own-codec-reload")
        self.reload = self.stack.enter_context(patch.object(codec, "reload", side_effect=reload))
        def subject(*args, **kwargs):
            self.events.append("simulated-slot189-artifacts")
            return {"sampleId": review.SUBJECT_ID, "synthetic": True}, binding("synthetic/original.png"), {"synthetic": True}
        self.subject = self.stack.enter_context(patch.object(review, "subject_artifacts", side_effect=subject))

    def save_current(self):
        self.reader.path(review.REGISTRY).write_bytes(json.dumps(self.current).encode())

    def update_terminal(self):
        self.bound_terminal = self.reader.put("synthetic/worker-terminal.json", self.value)
        self.current["latestTrainingTerminal"] = {"runId": self.plan["runId"], **self.bound_terminal}
        self.save_current()

    def run_review(self):
        return review.run(self.package, self.bound_terminal, root=self.root)

    def test_explicit_own_factory_codec_profile_and_pipeline_order(self):
        before = self.reader.files["synthetic/worker-terminal.json"]
        registry = self.reader.path(review.REGISTRY).read_bytes()
        result = self.run_review()
        report = self.writes[result["path"]]
        self.assertEqual(self.events[:4], ["validation-only-load", "simulated-v24-baseline", "own-factory", "simulated-own-codec-reload"])
        self.assertEqual(self.events.count("simulated-ecology-forward"), 8)
        self.assertEqual(self.events.count("simulated-slot189-artifacts"), 1)
        self.reload.assert_called_once()
        self.assertEqual(report["capabilityVersion"], review.CAPABILITY)
        self.assertEqual(report["optimizerSteps"], 0)
        self.assertEqual(report["modelForwardCalls"], 16)  # Fixture field; not actual inference.
        self.assertFalse(report["formalStage4QualificationAllowed"])
        self.assertFalse(report["runtimePublicationAllowed"])
        self.assertEqual(self.reader.files["synthetic/worker-terminal.json"], before)
        self.assertEqual(self.reader.path(review.REGISTRY).read_bytes(), registry)
        self.reader.unchanged.assert_called_once()
        self.assertFalse(any("train" in path for path in self.reader.reads))

    def test_registry_latest_identity_sha_or_active_training_fails_before_rgb(self):
        cases = [lambda c: c["latestTrainingTerminal"].update(runId="other"),
            lambda c: c["latestTrainingTerminal"].update(sha256="a" * 64),
            lambda c: c.update(activeExecution={"executionState": "executing"}),
            lambda c: c.pop("activeExecution"), lambda c: c.update(registryRevision=True),
            lambda c: c.pop("latestTrainingTerminal")]
        for mutate in cases:
            # Unique output for each simulated consumed review.
            self.plan["outputRoot"] += "-case"
            self.current = {"schemaVersion": "ai-painter-current-execution-registry-v1", "registryRevision": 1,
                "latestTrainingTerminal": {"runId": self.plan["runId"], **self.bound_terminal}, "activeExecution": None}
            mutate(self.current)
            self.save_current()
            with self.assertRaises(ValueError): self.run_review()
        self.worker.load_samples.assert_not_called()
        self.reload.assert_not_called()

    def test_wrong_run_package_and_terminal_source_sha_fail_closed(self):
        for key, bad in (("runId", "other"), ("packageId", "other"),
                         ("executionPackage", binding("synthetic/other-package.json"))):
            self.value = terminal()
            self.value["executionPackage"] = self.package
            self.value[key] = bad
            self.plan["outputRoot"] += "-case"
            self.update_terminal()
            with self.assertRaisesRegex(ValueError, "same-package"): self.run_review()
        self.plan["outputRoot"] += "-sha"
        self.reader.files[self.bound_terminal["path"]] += b" "
        with self.assertRaisesRegex(ValueError, "source SHA"): self.run_review()
        self.worker.load_samples.assert_not_called()

    def test_unselected_checkpoint_sha_is_checked_before_rgb(self):
        self.reader.files[self.value["checkpoints"][2]["checkpoint"]["path"]] = b"tampered"
        with self.assertRaisesRegex(ValueError, "source SHA"): self.run_review()
        self.worker.load_samples.assert_not_called()

    def test_fixed8_order_split_and_slot189_fail_before_baseline(self):
        for kind in ("missing", "duplicate", "order", "train", "subject"):
            saved = list(self.samples)
            if kind == "missing": self.samples = self.samples[:-1]
            elif kind == "duplicate": self.samples = [self.samples[0]] * 8
            elif kind == "order": self.samples = list(reversed(self.samples))
            elif kind == "train": self.samples = [{**sample, "split": "train"} for sample in self.samples]
            else: self.samples = [{**sample, "sampleId": "other"} if i == 0 else sample for i, sample in enumerate(self.samples)]
            self.plan["outputRoot"] += "-case"
            with self.assertRaisesRegex(ValueError, "fixed8"): self.run_review()
            self.samples = saved
        self.baseline.assert_not_called()

    def test_primary_failure_survives_failure_publication_error_no_retry(self):
        primary = RuntimeError("own checkpoint primary")
        self.reload.side_effect = primary
        self.worker.write.side_effect = OSError("failure publication secondary")
        before = self.reader.files["synthetic/worker-terminal.json"]
        with self.assertRaises(RuntimeError) as caught:
            self.run_review()
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.secondary_review_failure_error, "failure publication secondary")
        self.reload.assert_called_once()
        self.worker.write.assert_called_once()
        self.assertEqual(self.reader.files["synthetic/worker-terminal.json"], before)
        self.assertTrue((self.root / self.plan["outputRoot"] / "dry-review/review-consumed.json").is_file())

    def test_failure_evidence_retained_and_completed_training_unchanged(self):
        primary = KeyboardInterrupt("simulated interruption")
        self.profile.sample_forward.side_effect = primary
        with self.assertRaises(KeyboardInterrupt) as caught: self.run_review()
        self.assertIs(caught.exception, primary)
        report = self.writes[self.plan["outputRoot"] + "/dry-review/cpu-review-failure.json"]
        self.assertFalse(report["trainingTerminalMutationAllowed"])
        self.assertEqual(report["automaticRetries"], 0)
        self.assertEqual(json.loads(self.reader.files["synthetic/worker-terminal.json"])["status"], "training_completed_review_pending")

    def test_claim_once_preserves_all_existing_evidence(self):
        self.run_review()
        output = self.root / self.plan["outputRoot"] / "dry-review"
        before = {p.name: p.read_bytes() for p in output.iterdir()}
        with self.assertRaisesRegex(ValueError, "no replay"): self.run_review()
        self.assertEqual({p.name: p.read_bytes() for p in output.iterdir()}, before)
        self.reload.assert_called_once()

    def test_empty_accounting_directory_can_be_claimed_once(self):
        path = self.reader.path(self.plan["outputRoot"] + "/dry-review")
        path.mkdir()
        review.claim_output(path, {"synthetic": True})
        with self.assertRaisesRegex(ValueError, "no replay"):
            review.claim_output(path, {"synthetic": True})

    def test_cpu_deadline_includes_preflight_and_keeps_failure_evidence(self):
        with patch.object(review.time, "monotonic", side_effect=[0, 121]):
            with self.assertRaisesRegex(ValueError, "CPU120s"): self.run_review()
        self.worker.load_samples.assert_not_called()
        self.assertIn(self.plan["outputRoot"] + "/dry-review/cpu-review-failure.json", self.writes)

    def test_output_budget_fails_and_failure_reserve_remains(self):
        with patch.object(review, "directory_bytes", return_value=review.MAX_OUTPUT - review.FAILURE_RESERVE):
            with self.assertRaisesRegex(ValueError, "reserve ceiling"): self.run_review()
        self.assertIn(self.plan["outputRoot"] + "/dry-review/cpu-review-failure.json", self.writes)

    def test_wrong_native_rgb_shape_and_object_heads_fail(self):
        self.profile.sample_forward.return_value = (torch.zeros(1, 3, 96, 128), {})
        self.profile.sample_forward.side_effect = None
        with self.assertRaisesRegex(ValueError, "native CPU RGB"): self.run_review()
        self.plan["outputRoot"] += "-heads"
        self.model.object_rgb_heads[shared.OBJECT_CHANNELS[0]] = torch.nn.ParameterList([
            torch.nn.Parameter(torch.zeros(1)) for _ in range(3)])
        with self.assertRaisesRegex(ValueError, "sixteen"): self.run_review()

    def test_source_change_and_preinitialized_cuda_do_not_claim(self):
        self.plan["programBindings"]["cpuReview"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "loaded review source"): self.run_review()
        self.worker.load_samples.assert_not_called()
        self.worker.write.assert_not_called()
        self.plan["programBindings"]["cpuReview"] = binding(review.SELF, Path(review.__file__).read_bytes())
        with patch.object(torch.cuda, "is_initialized", return_value=True):
            with self.assertRaisesRegex(ValueError, "CUDA"): self.run_review()

    def test_late_registry_change_blocks_success_report(self):
        original = review.verify_current
        count = [0]
        def verify(*args):
            count[0] += 1
            if count[0] == 2:
                self.current["activeExecution"] = {"executionState": "executing"}
                self.save_current()
            return original(*args)
        with patch.object(review, "verify_current", side_effect=verify):
            with self.assertRaisesRegex(ValueError, "active training"): self.run_review()
        self.assertNotIn(self.plan["outputRoot"] + "/dry-review/cpu-review.json", self.writes)


class OwnCheckpointTests(CpuIsolationTests):
    def setUp(self):
        super().setUp()
        self.threads = torch.get_num_threads()
        torch.set_num_threads(2)
        self.addCleanup(torch.set_num_threads, self.threads)
        self.kw = {"configuration": configuration(), "run_id": "synthetic-memory-codec",
            "package_binding": binding("synthetic/package.json"), "dataset_binding": binding("synthetic/manifest.json"),
            "epoch": 24, "selection": selection(), "counts": {"generator": 1152, "discriminator": 1152}}

    def test_actual_own_factory_codec_roundtrip_without_forward_or_optimizer(self):
        with patch.object(torch.nn.Module, "__call__", side_effect=AssertionError("forward forbidden")), \
                patch.object(torch.autograd, "grad", side_effect=AssertionError("autograd forbidden")), \
                patch.object(torch.optim, "AdamW", side_effect=AssertionError("optimizer forbidden")):
            model, critic = profile.fresh_networks(ORDER)
            raw = codec.encode(model, critic, **self.kw)
            target, target_critic = profile.fresh_networks(ORDER)
            result = codec.reload(raw, model=target, critic=target_critic, **self.kw)
        self.assertEqual(len(tuple(model.parameters())), 108)
        self.assertEqual(sum(p.numel() for p in model.parameters()), 2242687)
        self.assertEqual(sum(len(tuple(head.parameters())) for head in model.object_rgb_heads.values()), 16)
        self.assertEqual(shared.v24.core.cpu.state_hash(model), shared.v24.core.cpu.state_hash(target))
        self.assertFalse(result["checkpointQualified"])
        self.assertFalse(torch.cuda.is_initialized())

    def test_old_checkpoint_identity_and_late_hook_primary_preserved(self):
        model, critic = profile.fresh_networks(ORDER)
        raw = codec.encode(model, critic, **self.kw)
        before = shared.v24.core.cpu.state_hash(model)
        payload = torch.load(io.BytesIO(raw), map_location="cpu", weights_only=True)
        payload["capabilityVersion"] = "stage4_mvp256_dry_appearance_regime_v1"
        stream = io.BytesIO()
        torch.save(payload, stream)
        with self.assertRaisesRegex(ValueError, "source/Run"):
            codec.reload(stream.getvalue(), model=model, critic=critic, **self.kw)
        self.assertEqual(shared.v24.core.cpu.state_hash(model), before)
        primary = RuntimeError("late own codec hook")
        hook = Mock(side_effect=primary)
        handle = model.register_load_state_dict_post_hook(hook)
        try:
            with self.assertRaises(RuntimeError) as caught:
                codec.reload(raw, model=model, critic=critic, **self.kw)
            self.assertIs(caught.exception, primary)
            hook.assert_called_once()
            self.assertEqual(shared.v24.core.cpu.state_hash(model), before)
        finally:
            handle.remove()

    def test_actual_codec_rejects_cross_run_pkg_dataset_and_float_bool_counts(self):
        model, critic = profile.fresh_networks(ORDER)
        raw = codec.encode(model, critic, **self.kw)
        before = (shared.v24.core.cpu.state_hash(model), shared.v24.core.cpu.state_hash(critic))
        changes = ({"run_id": "different-run"},
            {"package_binding": binding("synthetic/other-package.json")},
            {"dataset_binding": binding("synthetic/other-manifest.json")},
            {"counts": {"generator": 1152.0, "discriminator": 1152}},
            {"counts": {"generator": True, "discriminator": 1152}})
        with patch.object(model, "load_state_dict", wraps=model.load_state_dict) as load:
            for change in changes:
                with self.subTest(change=change), self.assertRaises(ValueError):
                    codec.reload(raw, model=model, critic=critic, **{**self.kw, **change})
                self.assertEqual((shared.v24.core.cpu.state_hash(model), shared.v24.core.cpu.state_hash(critic)), before)
            load.assert_not_called()


if __name__ == "__main__":
    torch.set_num_threads(2)
    unittest.main(verbosity=2)
