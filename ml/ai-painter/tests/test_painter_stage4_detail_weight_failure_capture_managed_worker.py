"""One owned CPU acceptance batch; constructed tensors, zero real updates.

Run this file with --evidence-root <new directory under the T-Q4-49 training
root>. The parent persists its own cleanup receipt before optional audits.
Every fixture stays in that evidence root, including failed/partial files.
"""
from __future__ import annotations
import argparse
from contextlib import ExitStack
import hashlib
import io
import json
import os
from pathlib import Path
import random
import sys
import time
import unittest
from unittest.mock import patch

ROOT = Path(os.path.abspath(__file__)).parents[3]
ENTRY = "ml/ai-painter/scripts/painter_stage4_detail_weight_failure_capture_managed_worker.py"
TEST = "ml/ai-painter/tests/test_painter_stage4_detail_weight_failure_capture_managed_worker.py"
OWNED = "ml/ai-painter/scripts/analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py"
WORKORDER = ".runtime/ai-painter/detail-weight-failure-capture-connection-t-q4-49/controller/workorder.json"
PARENT = ".runtime/ai-painter/detail-weight-failure-capture-connection-t-q4-49/training"
REPAIR = ".runtime/ai-painter/detail-weight-failure-capture-connection-t-q4-49/controller/bounded-platform-repair.json"
TASK_ROOT = ROOT / PARENT
MAX_BYTES, RESERVE = 8 * 1024**2, 65536
torch = worker = np = None
EVIDENCE = None
TEST_NAMES = None
EVENTS = {"generatorForwardAttempted": 0, "generatorForwards": 0,
          "generatorGradientAttempted": 0, "generatorGradientCompleted": 0,
          "discriminatorGradientAttempted": 0, "discriminatorGradientCompleted": 0,
          "generatorStepAttempted": 0, "generatorSteps": 0,
          "discriminatorStepAttempted": 0, "discriminatorSteps": 0,
          "cudaAttempted": 0, "realDatasetReads": 0,
          "pairDispatchAttempted": 0, "pairDispatchCompleted": 0,
          "simulatedGenerator": 0, "simulatedDiscriminator": 0}


def initialize():
    global torch, worker, np
    if torch is None:
        for directory in (ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/src"):
            sys.path.insert(0, str(directory))
        import torch as actual_torch
        import numpy as actual_numpy
        import painter_stage4_detail_weight_failure_capture_managed_worker as actual_worker
        torch, np, worker = actual_torch, actual_numpy, actual_worker
        torch.set_num_threads(2)
        torch.set_num_interop_threads(2)


def bind(path):
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def used(root):
    return sum(path.stat().st_size for path in root.rglob("*") if path.is_file())


def save(path, value, *, failure=False):
    data = value if isinstance(value, bytes) else (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    if len(data) > 2097152 or used(TASK_ROOT) + len(data) > MAX_BYTES - (0 if failure else RESERVE):
        raise ValueError("acceptance output/JSON reserve ceiling")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        if stream.write(data) != len(data):
            raise OSError("short acceptance write")
        stream.flush()
        os.fsync(stream.fileno())
    return bind(path)


def forbidden(key):
    def call(*_args, **_kwargs):
        EVENTS[key] += 1
        raise AssertionError("forbidden real computation: " + key)
    return call


def networks():
    class Synthetic(torch.nn.Module):
        def __init__(self, count):
            super().__init__()
            self.values = torch.nn.ParameterList([torch.nn.Parameter(torch.tensor([i * .001, -.125, -0.])) for i in range(count)])
            self.register_buffer("identity", torch.tensor([1, 2, 3], dtype=torch.uint8))
            self.register_buffer("scalar", torch.tensor(-0.))
            self.values[4].grad = torch.tensor([.5, -.5, -0.])
            self.values[3].requires_grad_(False)
        def forward(self, *_args, **_kwargs):
            return forbidden("generatorForwardAttempted")()
    model, critic = Synthetic(107), Synthetic(14)
    model.train(False)
    critic.train(True)
    critic.values.train(False)
    return model, critic


def error_attachment(model, kind="full", *, unused=False):
    error = RuntimeError("synthetic identity failure at parameter 60")
    if kind == "missing":
        return error
    raw = [[torch.full_like(parameter, .125) for parameter in model.parameters()] for _ in range(3)]
    raw.append([a + b + c for a, b, c in zip(*raw)])
    raw[3][60] = raw[3][60] + .01
    if unused:
        for sequence in raw:
            sequence[0] = None
    if kind == "partial":
        raw = raw[:2]
    error.appearance_regime_gradient_evidence = {"rawGradients": raw,
        "parameterNames": [name for name, _ in model.named_parameters()],
        "parameterTensorCount": 107, "gradientSetsAvailable": len(raw)}
    return error


def sample(index=0, split="train"):
    # These objects must never be inspected or serialized by capture.
    class Unreadable:
        def __reduce__(self):
            raise AssertionError("original sample content copied")
        def __getattr__(self, _name):
            EVENTS["realDatasetReads"] += 1
            raise AssertionError("original sample content read")
    return {"sampleId": split + "-" + str(index), "split": split,
            "image": Unreadable(), "conditions": Unreadable(), "objectInstanceTable": Unreadable(),
            "appearance_regime": torch.tensor([1., 0., 0., 0.])}


def snapshot(model, critic):
    def network(value):
        return {"modes": {name: module.training for name, module in value.named_modules()},
                "tensors": [(name, id(tensor), tensor._version, tensor.requires_grad,
                             tensor.detach().clone(), None if tensor.grad is None else tensor.grad.detach().clone())
                            for name, tensor in list(value.named_parameters()) + list(value.named_buffers())]}
    return {"networks": [network(model), network(critic)], "torch": torch.get_rng_state().clone(),
            "python": random.getstate(), "numpy": np.random.get_state(),
            "grad": torch.is_grad_enabled(), "autocast": torch.is_autocast_enabled("cpu")}


def simulated_pair(error=None, fail_at=None):
    counter = [0]
    def pair(_model, _critic, _sample, _order, _go, _do, counts, ledger, _resource, _forward):
        counter[0] += 1
        EVENTS["pairDispatchAttempted"] += 1
        counts["discriminator"] += 1
        ledger["discriminator"] += 1
        EVENTS["simulatedDiscriminator"] += 1
        if error is not None and (fail_at is None or counter[0] == fail_at):
            raise error
        counts["generator"] += 1
        ledger["generator"] += 1
        EVENTS["simulatedGenerator"] += 1
        EVENTS["pairDispatchCompleted"] += 1
    return pair


class CaptureTests(unittest.TestCase):
    serial = 0

    @classmethod
    def setUpClass(cls):
        initialize()
        if EVIDENCE is None:
            raise RuntimeError("acceptance requires the owned CLI and fresh evidence root")

    def fixture(self, *, package_changes=None, output_limit=MAX_BYTES, capture_limit=64 * 1024**2):
        CaptureTests.serial += 1
        root = EVIDENCE / "runs" / f"case-{CaptureTests.serial:02d}"
        root.mkdir(parents=True)
        sources = [bind(ROOT / path) for path in (*worker.FROZEN, ENTRY, TEST)]
        package = {"schema": worker.SCHEMA, "mode": "synthetic-cpu-only", "productionAdopted": False,
                   "runId": root.name, "outputRoot": root.relative_to(ROOT).as_posix(),
                   "sourceBindings": sources, "outputLimitBytes": output_limit, "captureLimitBytes": capture_limit}
        package.update(package_changes or {})
        binding = save(root / "component-execution.json", package)
        return root, package, binding

    def context(self, **kwargs):
        root, package, binding = self.fixture(**kwargs)
        return worker.ComponentContext(binding, run_id=package["runId"], deadline=time.monotonic() + 90)

    def invariant(self, before, model, critic):
        after = snapshot(model, critic)
        self.assertEqual(before["python"], after["python"])
        self.assertTrue(torch.equal(before["torch"], after["torch"]))
        self.assertEqual(before["numpy"][0], after["numpy"][0])
        self.assertTrue(np.array_equal(before["numpy"][1], after["numpy"][1]))
        self.assertEqual(before["numpy"][2:], after["numpy"][2:])
        self.assertEqual((before["grad"], before["autocast"]), (after["grad"], after["autocast"]))
        for a, b in zip(before["networks"], after["networks"]):
            self.assertEqual(a["modes"], b["modes"])
            for x, y in zip(a["tensors"], b["tensors"]):
                self.assertEqual(x[:4], y[:4])
                self.assertTrue(torch.equal(x[4], y[4]))
                self.assertEqual(x[5] is None, y[5] is None)
                if x[5] is not None:
                    self.assertTrue(torch.equal(x[5], y[5]))

    def direct_failure(self, kind="full", *, unused=False, context=None, capture_runner=None, progress=None):
        context = context or self.context()
        model, critic = networks()
        error = error_attachment(model, kind, unused=unused)
        before = snapshot(model, critic)
        kwargs = {} if capture_runner is None else {"capture_runner": capture_runner}
        runner = worker.FailureCapturePair(context, pair_runner=simulated_pair(error),
            progress_sink=progress or (lambda *_a, **_k: None), **kwargs)
        counts = {"generator": 475, "discriminator": 475}
        row = sample(149)
        arguments = dict(epoch=10, train_position=44, model=model, critic=critic, sample=row, order=[],
            go=None, do=None, counts=counts, ledger={"sampleId": row["sampleId"], "generator": 0, "discriminator": 0},
            resource=lambda: None, selected=None, completed_epochs=9)
        with self.assertRaises(RuntimeError) as caught:
            runner(**arguments)
        self.assertIs(caught.exception, error)
        self.assertEqual(counts, {"generator": 475, "discriminator": 476})
        self.assertEqual(error.actual_optimizer_counts, counts)
        self.invariant(before, model, critic)
        return context, error, runner, arguments

    def test_full_capture_safe_reload_explicit_location_state_and_tamper_guard(self):
        context, error, _runner, _args = self.direct_failure()
        receipt = error.gradient_failure_capture
        self.assertEqual(receipt["status"], "failure_evidence_captured")
        manifest, tensors = worker.capture.verify_gradient_failure_capture(receipt)
        self.assertTrue(manifest["gradientEvidenceComplete"])
        self.assertEqual(manifest["location"], {"epoch": 10, "trainPosition": 44, "sampleId": "train-149",
            "split": "train", "origin": "explicit_capture_call", "inferredSample": False})
        self.assertEqual(manifest["counts"], {"generator": 475, "discriminator": 476})
        self.assertFalse(manifest["sourcePixelsCopied"])
        self.assertFalse(manifest["executionQualified"])
        self.assertTrue(all(type(value) is torch.Tensor and value.device.type == "cpu"
                            and not value.requires_grad for value in tensors.values()))
        self.assertFalse(any("image" in key or "conditions" in key for key in tensors))
        self.assertEqual(manifest["executionBinding"], context.execution_binding)
        bad = json.loads(json.dumps(receipt))
        bad["artifacts"]["manifest"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "SHA"):
            worker.capture.verify_gradient_failure_capture(bad)

    def test_partial_gradient_sets_saved_and_explicitly_incomplete(self):
        _context, error, _runner, _args = self.direct_failure("partial")
        manifest, _tensors = worker.capture.verify_gradient_failure_capture(error.gradient_failure_capture)
        self.assertEqual(error.gradient_failure_capture["status"], "partial_failure_evidence_captured")
        self.assertFalse(manifest["gradientEvidenceComplete"])
        self.assertEqual(len(manifest["gradientSets"]), 2)

    def test_missing_attachment_saved_and_explicitly_incomplete(self):
        _context, error, _runner, _args = self.direct_failure("missing")
        manifest, tensors = worker.capture.verify_gradient_failure_capture(error.gradient_failure_capture)
        self.assertFalse(manifest["gradientEvidenceComplete"])
        self.assertEqual(manifest["gradientSets"], [])
        self.assertTrue(any(key.startswith("model.parameter") for key in tensors))

    def test_unused_none_gradients_preserved_without_extra_autograd(self):
        _context, error, _runner, _args = self.direct_failure(unused=True)
        manifest, _tensors = worker.capture.verify_gradient_failure_capture(error.gradient_failure_capture)
        self.assertTrue(manifest["gradientEvidenceComplete"])
        self.assertTrue(all(sequence[0]["unused"] for sequence in manifest["gradientSets"]))

    def test_pair_failure_is_not_retried(self):
        context, error, runner, arguments = self.direct_failure(capture_runner=lambda **_k: (_ for _ in ()).throw(OSError("synthetic capture IO")))
        prior = used(context.root)
        with self.assertRaisesRegex(ValueError, "no retry"):
            runner(**arguments)
        self.assertEqual(prior, used(context.root))
        self.assertEqual(error.gradient_failure_capture["status"], "capture_failed")

    def test_success_pair_never_calls_capture(self):
        context = self.context()
        model, critic = networks()
        before = snapshot(model, critic)
        runner = worker.FailureCapturePair(context, pair_runner=simulated_pair(), progress_sink=lambda *_a, **_k: None,
            capture_runner=lambda **_k: self.fail("success capture called"))
        row = sample()
        counts = {"generator": 0, "discriminator": 0}
        runner(epoch=1, train_position=1, model=model, critic=critic, sample=row, order=[], go=None, do=None,
            counts=counts, ledger={"sampleId": row["sampleId"], "generator": 0, "discriminator": 0},
            resource=lambda: None, selected=None, completed_epochs=0)
        self.assertEqual(counts, {"generator": 1, "discriminator": 1})
        self.assertFalse((context.root / "failure-capture").exists())
        self.invariant(before, model, critic)

    def loop_args(self, context, *, pair_runner, capture_runner=None, resource=None, progress=None):
        model, critic = networks()
        train = [sample(i) for i in range(48)]
        validation = [sample(i, "validation") for i in range(8)]
        observations = []
        optimizer_args = []
        def optimizer(parameters, **kwargs):
            optimizer_args.append(kwargs)
            list(parameters)
            return object()  # no optimizer exists; simulated counters only
        def validation_runner(_model, rows, _order, *, epoch):
            observations.append(epoch)
            _torch, _profile, shared, _source = worker.frozen.runtime()
            values = [{"sampleId": row["sampleId"], "split": "validation", "epoch": epoch,
                       "fullRgbMae": .2, "objectCorrelations": {role: .1 for role in shared.OBJECT_CHANNELS}} for row in rows]
            return shared.rank_validation_epoch(values, [row["sampleId"] for row in rows], epoch=epoch), values
        def sink(epoch, value):
            if epoch is None:
                return (ROOT / value["path"]).read_bytes()
            return save(context.root / f"checkpoint-{epoch:02d}.pt", value)
        args = dict(model=model, critic=critic, train=train, validation=validation, order=[], configuration={},
            package_binding=context.execution_binding, plan={"runId": context.run_id, "packageId": "synthetic-package",
                "outputRoot": context.package["outputRoot"], "datasetManifest": {"synthetic": True}},
            resource=resource or (lambda: None), checkpoint_sink=sink, progress_sink=progress or (lambda *_a, **_k: None),
            pair_runner=pair_runner, optimizer_factory=optimizer, validation_runner=validation_runner,
            checkpoint_encoder=lambda *_a, **kw: worker.capture._json({"syntheticCheckpoint": True, "epoch": kw["epoch"]}),
            checkpoint_reloader=lambda raw, **kw: self.assertEqual(json.loads(raw)["epoch"], kw["epoch"]),
            fresh_networks=lambda _order: networks())
        if capture_runner is not None:
            args["capture_runner"] = capture_runner
        return args, observations, optimizer_args

    def test_real_loop_dispatch_not_inferred_from_counters_and_persisted_terminal(self):
        context = self.context()
        error = RuntimeError("synthetic second dispatch after D")
        args, _observations, _opts = self.loop_args(context, pair_runner=simulated_pair(error, 2))
        before = snapshot(args["model"], args["critic"])
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(context=context, **args)
        self.assertIs(caught.exception, error)
        indices = list(range(48))
        random.Random(20260930).shuffle(indices)
        self.assertEqual(error.failure_capture_dispatch["sampleId"], "train-" + str(indices[1]))
        self.assertEqual((error.failure_capture_dispatch["epoch"], error.failure_capture_dispatch["trainPosition"]), (1, 2))
        self.assertEqual(error.actual_optimizer_counts, {"generator": 1, "discriminator": 2})
        terminal = json.loads((context.root / "component-terminal.json").read_bytes())
        self.assertEqual(terminal["dispatch"], error.failure_capture_dispatch)
        self.assertEqual(terminal["optimizerSteps"], error.actual_optimizer_counts)
        self.assertEqual(terminal["completedEpochs"], 0)
        self.invariant(before, args["model"], args["critic"])

    def test_capture_progress_and_late_terminal_errors_never_replace_primary(self):
        context = self.context()
        primary = RuntimeError("original synthetic failure")
        def interrupt(**_kwargs):
            raise KeyboardInterrupt("capture interrupted")
        def progress(*_args, **_kwargs):
            raise OSError("progress IO failed")
        args, _observations, _opts = self.loop_args(context, pair_runner=simulated_pair(primary),
                                                  capture_runner=interrupt, progress=progress)
        def terminal(_value):
            raise SystemExit("terminal interrupted")
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(context=context, terminal_sink=terminal, **args)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 1})
        self.assertEqual([item["stage"] for item in primary.failure_capture_secondary_errors],
                         ["failure_progress", "failure_capture", "failure_terminal"])

    def test_real_capture_directory_io_failure_is_secondary(self):
        context = self.context()
        save(context.root / "failure-capture", b"intentional blocking file")
        _context, error, _runner, _args = self.direct_failure(context=context)
        self.assertEqual(error.gradient_failure_capture["status"], "capture_failed")
        self.assertIn("captureError", error.gradient_failure_capture)

    def test_existing_checkpoint_bytes_reduce_capture_budget_and_leave_terminal_reserve(self):
        context = self.context(output_limit=81920)
        save(context.root / "already-saved-checkpoint.pt", b"X" * 8192)
        existing = worker.capture._owned_bytes(context.root)
        self.assertEqual(existing["checkpointBytes"], 8192)
        self.assertEqual(context.remaining(), 81920 - existing["totalBytes"] - RESERVE)
        primary = RuntimeError("budget-bound original failure")
        args, _observations, _opts = self.loop_args(context, pair_runner=simulated_pair(primary))
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(context=context, **args)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.gradient_failure_capture["status"], "capture_failed")
        self.assertTrue((context.root / "component-terminal.json").is_file())
        self.assertLessEqual(used(context.root), 81920)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 1})

    def test_timeout_stays_secondary_and_primary_counts_survive(self):
        context = self.context()
        primary = RuntimeError("pair failure at deadline")
        base = simulated_pair(primary)
        def pair(*args):
            context.deadline = time.monotonic() - 1
            base(*args)
        arguments, _observations, _opts = self.loop_args(context, pair_runner=pair)
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(context=context, **arguments)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 1})
        self.assertEqual([item["stage"] for item in primary.failure_capture_secondary_errors], ["failure_capture"])
        terminal = json.loads((context.root / "component-terminal.json").read_bytes())
        self.assertEqual(terminal["optimizerSteps"], {"generator": 0, "discriminator": 1})
        self.assertEqual(terminal["capture"]["status"], "capture_failed")

    def test_oversized_execution_input_rejected_before_any_read(self):
        root = EVIDENCE / "runs" / "oversized-input"
        root.mkdir(parents=True)
        path = root / "component-execution.json"
        # Retain this deliberate negative fixture; no sparse file exceeds the
        # batch output ceiling and no original evidence is modified.
        with path.open("xb") as stream:
            self.assertLessEqual(used(TASK_ROOT) + worker.MAX_INPUT_BYTES + 1, MAX_BYTES - RESERVE)
            stream.truncate(worker.MAX_INPUT_BYTES + 1)
        binding = {"path": path.relative_to(ROOT).as_posix(), "sha256": "a" * 64}
        with patch.object(Path, "open", side_effect=AssertionError("oversized input opened")):
            with self.assertRaisesRegex(ValueError, "before read"):
                worker.read_bound(binding, execution=True)

    def test_arbitrary_data_source_rejected_before_any_read(self):
        context = self.context()
        for path in (context.package["outputRoot"] + "/source-rgb.bin",
                     context.package["outputRoot"] + "/prior-tensors.pt",
                     "docs/BUSINESS_SPEC.md"):
            with patch.object(Path, "open", side_effect=AssertionError("unapproved source opened")):
                with self.assertRaisesRegex(ValueError, "approved"):
                    worker.rehash({"path": path, "sha256": "a" * 64})

    def test_binding_identity_change_during_read_rejected(self):
        binding = bind(ROOT / ENTRY)
        actual_stat = os.fstat
        calls = [0]
        def changing(handle):
            value = actual_stat(handle)
            calls[0] += 1
            if calls[0] == 2:
                from types import SimpleNamespace
                return SimpleNamespace(st_dev=value.st_dev, st_ino=value.st_ino,
                    st_size=value.st_size + 1, st_mtime_ns=value.st_mtime_ns, st_ctime_ns=value.st_ctime_ns)
            return value
        with patch.object(os, "fstat", side_effect=changing):
            with self.assertRaisesRegex(ValueError, "during read"):
                worker.rehash(binding)

    def test_stable_provider_specific_ctime_difference_is_readable(self):
        binding = bind(ROOT / ENTRY)
        actual_stat = os.fstat
        def provider(handle):
            value = actual_stat(handle)
            from types import SimpleNamespace
            return SimpleNamespace(st_dev=value.st_dev, st_ino=value.st_ino, st_size=value.st_size,
                st_mtime_ns=value.st_mtime_ns, st_ctime_ns=123456789)
        with patch.object(os, "fstat", side_effect=provider):
            path, data = worker.read_bound(binding)
        self.assertEqual(path, ROOT / ENTRY)
        self.assertEqual(hashlib.sha256(data).hexdigest(), binding["sha256"])

    def test_path_provider_ctime_change_is_rejected(self):
        binding = bind(ROOT / ENTRY)
        actual_stat, actual_open = Path.stat, Path.open
        opened = [False]
        def opening(path, *args, **kwargs):
            value = actual_open(path, *args, **kwargs)
            if path == ROOT / ENTRY:
                opened[0] = True
            return value
        def provider(path, *args, **kwargs):
            value = actual_stat(path, *args, **kwargs)
            if path == ROOT / ENTRY and opened[0]:
                from types import SimpleNamespace
                return SimpleNamespace(st_dev=value.st_dev, st_ino=value.st_ino, st_size=value.st_size,
                    st_mtime_ns=value.st_mtime_ns, st_ctime_ns=value.st_ctime_ns + 1, st_mode=value.st_mode)
            return value
        with patch.object(Path, "open", new=opening), patch.object(Path, "stat", new=provider):
            with self.assertRaisesRegex(ValueError, "after read"):
                worker.rehash(binding)

    def test_handle_provider_ctime_change_is_rejected(self):
        binding = bind(ROOT / ENTRY)
        actual_stat = os.fstat
        calls = [0]
        def provider(handle):
            value = actual_stat(handle)
            calls[0] += 1
            from types import SimpleNamespace
            return SimpleNamespace(st_dev=value.st_dev, st_ino=value.st_ino, st_size=value.st_size,
                st_mtime_ns=value.st_mtime_ns, st_ctime_ns=value.st_ctime_ns + (1 if calls[0] == 2 else 0))
        with patch.object(os, "fstat", side_effect=provider):
            with self.assertRaisesRegex(ValueError, "during read"):
                worker.rehash(binding)

    def test_cross_provider_file_id_size_mtime_changes_are_rejected(self):
        binding = bind(ROOT / ENTRY)
        actual_stat = os.fstat
        for field in ("st_dev", "st_ino", "st_size", "st_mtime_ns"):
            def provider(handle):
                value = actual_stat(handle)
                from types import SimpleNamespace
                fields = {key: getattr(value, key) for key in ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")}
                fields[field] += 1
                return SimpleNamespace(**fields)
            with patch.object(os, "fstat", side_effect=provider):
                with self.assertRaisesRegex(ValueError, "before open"):
                    worker.rehash(binding)

    def test_private_selection_rejects_unknown_and_duplicate_names(self):
        known = unittest.defaultTestLoader.getTestCaseNames(CaptureTests)
        self.assertEqual(selected_test_names(None), known)
        self.assertEqual(selected_test_names([known[0]]), [known[0]])
        for names in ([known[0], known[0]], ["unknown_test"], []):
            with self.assertRaises(ValueError):
                selected_test_names(names)

    def test_expired_finalization_io_failure_reports_incomplete_without_covering_primary(self):
        context = self.context()
        primary = RuntimeError("original at deadline with terminal IO")
        base = simulated_pair(primary)
        def pair(*args):
            context.deadline = time.monotonic() - 1
            base(*args)
        args, _observations, _opts = self.loop_args(context, pair_runner=pair)
        def terminal(_value):
            raise OSError("terminal storage unavailable")
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(context=context, terminal_sink=terminal, **args)
        self.assertIs(caught.exception, primary)
        self.assertFalse((context.root / "component-terminal.json").exists())
        self.assertFalse(primary.failure_capture_terminal_publication["complete"])
        self.assertEqual([item["stage"] for item in primary.failure_capture_secondary_errors], ["failure_capture", "failure_terminal"])

    def test_persisted_claim_prevents_a_new_context_from_retrying(self):
        context = self.context()
        context.claim()
        replacement = worker.ComponentContext(context.execution_binding, run_id=context.run_id, deadline=time.monotonic() + 90)
        with self.assertRaises(FileExistsError):
            replacement.claim()

    def test_path_sha_same_run_and_legacy_identity_guards(self):
        context = self.context()
        with self.assertRaisesRegex(ValueError, "same-Run"):
            worker.ComponentContext(context.execution_binding, run_id="other-run", deadline=time.monotonic() + 90)
        bad = dict(context.execution_binding, sha256="0" * 64)
        with self.assertRaisesRegex(ValueError, "SHA"):
            worker.ComponentContext(bad, run_id=context.run_id, deadline=time.monotonic() + 90)
        with self.assertRaises(ValueError):
            worker.rehash({"path": "../outside", "sha256": "0" * 64})
        for changes in ({"schema": "ai-painter-autonomous-closed-loop-package-v1"},
                        {"mode": "gpu-training"}, {"productionAdopted": True},
                        {"outputRoot": ".runtime/ai-painter/other-run"}):
            root, package, binding = self.fixture(package_changes=changes)
            with self.assertRaises(ValueError):
                worker.ComponentContext(binding, run_id=package["runId"], deadline=time.monotonic() + 90)
        with self.assertRaisesRegex(ValueError, "production adoption"):
            worker.run(context.execution_binding)

    def test_actual_source_sha_rehashed_and_not_caller_flag(self):
        sources = [bind(ROOT / path) for path in (*worker.FROZEN, ENTRY, TEST)]
        sources[0]["sha256"] = "a" * 64
        root, package, binding = self.fixture(package_changes={"sourceBindings": sources, "passed": True})
        with self.assertRaisesRegex(ValueError, "actual source SHA"):
            worker.ComponentContext(binding, run_id=package["runId"], deadline=time.monotonic() + 90)

    def test_forged_full_capture_boolean_cannot_claim_complete(self):
        _context, primary, _runner, _args = self.direct_failure(capture_runner=lambda **_kw:
            {"status": "failure_evidence_captured", "gradientEvidenceComplete": True, "artifacts": {}})
        self.assertEqual(primary.gradient_failure_capture["status"], "capture_failed")
        self.assertEqual(primary.failure_capture_secondary_errors[0]["stage"], "failure_capture")

    def test_resource_failure_has_zero_simulated_updates_and_no_capture(self):
        context = self.context()
        primary = RuntimeError("resource guard failed")
        def resource():
            raise primary
        args, _observations, _opts = self.loop_args(context, pair_runner=lambda *_a: self.fail("pair dispatched"), resource=resource)
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(context=context, **args)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 0})
        self.assertFalse((context.root / "failure-capture").exists())

    def test_partial_checkpoint_is_preserved_after_later_pair_failure(self):
        context = self.context()
        primary = RuntimeError("synthetic epoch25 D success")
        args, observations, _opts = self.loop_args(context, pair_runner=simulated_pair(primary, 1153),
            capture_runner=lambda **_kw: (_ for _ in ()).throw(OSError("synthetic unavailable capture")))
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(context=context, **args)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.completed_epochs, 24)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 1152, "discriminator": 1153})
        self.assertEqual(observations, [24])
        self.assertEqual([row["epoch"] for row in primary.partial_checkpoint_records], [24])
        self.assertEqual(bind(context.root / "checkpoint-24.pt"), primary.partial_checkpoint_records[0]["checkpoint"])
        self.assertEqual(primary.failure_capture_dispatch["epoch"], 25)
        self.assertEqual(primary.failure_capture_dispatch["trainPosition"], 1)

    def test_frozen_schedule_optimizer_settings_checkpoint_tie_and_no_success_capture(self):
        context = self.context()
        args, observations, opts = self.loop_args(context, pair_runner=simulated_pair(),
                                                 capture_runner=lambda **_kw: self.fail("success capture"))
        before = snapshot(args["model"], args["critic"])
        terminal = worker.run_captured_boundary(context=context, **args)
        self.assertEqual(terminal["optimizerSteps"], {"generator": 2304, "discriminator": 2304})
        self.assertEqual(observations, [24, 36, 48])
        self.assertEqual(terminal["selectedCheckpointRecord"]["epoch"], 24)
        self.assertEqual(opts, [dict(lr=.0001, betas=(.9, .999), eps=1e-8, weight_decay=.01, foreach=False, fused=False)] * 2)
        self.assertFalse(terminal["productionAdopted"])
        self.assertFalse((context.root / "failure-capture").exists())
        self.invariant(before, args["model"], args["critic"])


def selected_test_names(requested):
    known = unittest.defaultTestLoader.getTestCaseNames(CaptureTests)
    if requested is None:
        return known
    if not requested or len(set(requested)) != len(requested) or any(name not in known for name in requested):
        raise ValueError("private test selection has unknown, duplicate or empty names")
    return list(requested)


class RawResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.items = []
        self.start_events = {}
    def startTest(self, test):
        super().startTest(test)
        self.start_events[test.id()] = dict(EVENTS)
    def record(self, test, status, error=None):
        item = {"test": test.id(), "status": status,
                "events": {key: value - self.start_events.get(test.id(), {}).get(key, 0) for key, value in EVENTS.items()}}
        if error is not None:
            item["error"] = self._exc_info_to_string(error, test)[-12000:]
        self.items.append(item)
    def addSuccess(self, test):
        super().addSuccess(test)
        self.record(test, "passed")
    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.record(test, "failed", err)
    def addError(self, test, err):
        super().addError(test, err)
        self.record(test, "error", err)
    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.record(test, "skipped")


def child():
    initialize()
    import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as owned
    owned.verify_owned_worker()
    invocation = json.loads((EVIDENCE / "invocation.json").read_bytes())
    selected = selected_test_names(TEST_NAMES)
    all_names = selected_test_names(None)
    if selected != invocation["selectedTestNames"]:
        raise ValueError("owned exact test selection differs from invocation")
    for binding in invocation["programBindings"]:
        if bind(ROOT / binding["path"]) != binding:
            raise ValueError("owned invocation final source changed")
    started = time.monotonic()
    with ExitStack() as stack:
        for owner, name, key in ((torch.autograd, "grad", "generatorGradientAttempted"),
                                 (torch.autograd, "backward", "generatorGradientAttempted"),
                                 (torch.Tensor, "backward", "generatorGradientAttempted"),
                                 (torch.optim.AdamW, "step", "generatorStepAttempted"),
                                 (torch.cuda, "_lazy_init", "cudaAttempted"),
                                 (torch.cuda, "init", "cudaAttempted"),
                                 (torch.cuda, "synchronize", "cudaAttempted"),
                                 (torch.cuda, "get_rng_state", "cudaAttempted")):
            stack.enter_context(patch.object(owner, name, side_effect=forbidden(key)))
        result = unittest.TextTestRunner(stream=io.StringIO(), verbosity=2, resultclass=RawResult).run(
            unittest.TestSuite(CaptureTests(name) for name in selected))
    unchanged = all(bind(ROOT / binding["path"]) == binding for binding in invocation["programBindings"])
    manifest_paths = sorted(EVIDENCE.rglob("gradient-failure-manifest.json"))
    actual = {"schema": "detail-weight-failure-capture-cpu-raw-v1", "synthetic": True,
        "productionAdopted": False, "gpuInitialized": torch.cuda.is_initialized(), "cpuThreads": torch.get_num_threads(),
        "actualOptimizerSteps": {"generator": EVENTS["generatorSteps"], "discriminator": EVENTS["discriminatorSteps"]},
        "actualCalls": {key: EVENTS[key] for key in ("generatorForwardAttempted", "generatorForwards", "generatorGradientAttempted",
            "generatorGradientCompleted", "discriminatorGradientAttempted", "discriminatorGradientCompleted")},
        "events": EVENTS, "testsAttempted": result.testsRun, "testsCompleted": len(result.items),
        "selectedTestNames": selected, "availableTestNames": all_names,
        "selectionMode": "default_full_suite" if TEST_NAMES is None else "explicit_selection",
        "fullSuiteExecuted": set(selected) == set(all_names) and len(selected) == len(all_names),
        "passed": sum(item["status"] == "passed" for item in result.items),
        "failed": len(result.failures), "errors": len(result.errors), "skipped": len(result.skipped),
        "items": result.items, "sourceBindings": invocation["programBindings"], "sourceBytesUnchanged": unchanged,
        "captureArtifacts": [bind(path) for path in manifest_paths],
        "captureManifestsCommitted": len(manifest_paths), "elapsedSeconds": time.monotonic() - started,
        "configuration": {"epochs": 48, "trainRows": 48, "validationRows": 8, "seedBase": 20260929,
            "eligibleEpochs": [24, 36, 48], "ranking": "worstCorrelation_then_negativeMAE_then_earliestEpoch",
            "numericalProfileChanged": False}, "evidenceBytesBeforeResult": used(EVIDENCE),
        "aggregateTaskBytesBeforeResult": used(TASK_ROOT)}
    save(EVIDENCE / "raw-tests.json", actual, failure=True)
    return 0 if result.wasSuccessful() and unchanged and not actual["gpuInitialized"] and not any(
        EVENTS[key] for key in ("generatorForwardAttempted", "generatorGradientAttempted", "generatorStepAttempted", "cudaAttempted", "realDatasetReads")) else 1


def parent():
    sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
    import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as owned
    workorder = json.loads((ROOT / WORKORDER).read_bytes())
    repair = json.loads((ROOT / REPAIR).read_bytes())
    if repair.get("taskId") != "T-Q4-49-R1" or repair.get("verificationBoundary", {}).get("workerCorrectedCpuBatchLimit") != 1:
        raise ValueError("bounded corrected-source workorder differs")
    selected = selected_test_names(TEST_NAMES)
    for binding in workorder["baseline"]["frozenBindings"]:
        if bind(ROOT / binding["path"]) != binding:
            raise ValueError("workorder frozen source differs")
    programs = workorder["baseline"]["frozenBindings"] + [bind(ROOT / path) for path in (ENTRY, TEST, OWNED)]
    EVIDENCE.mkdir(parents=True, exist_ok=False)
    argv = [sys.executable, str(ROOT / TEST), "--owned-child", "--evidence-root", str(EVIDENCE)]
    if TEST_NAMES is not None:
        argv += ["--test-names", *TEST_NAMES]
    already_saved = used(TASK_ROOT)
    save(EVIDENCE / "invocation.json", {"schema": "detail-weight-failure-capture-cpu-invocation-v1", "argv": argv,
        "workorder": bind(ROOT / WORKORDER), "repairWorkorder": bind(ROOT / REPAIR),
        "programBindings": programs, "automaticRetries": 0, "selectedTestNames": selected,
        "availableTestNames": selected_test_names(None), "selectionMode": "default_full_suite" if TEST_NAMES is None else "explicit_selection",
        "aggregateTaskRoot": TASK_ROOT.relative_to(ROOT).as_posix(), "alreadySavedTaskBytes": already_saved,
        "cpuThreads": 2, "wallSeconds": 120, "outputBytes": MAX_BYTES, "failureReserveBytes": RESERVE})
    try:
        receipt = owned.run_owned_process(argv, cwd=ROOT, deadline=time.monotonic() + 120, evidence_root=TASK_ROOT)
    except BaseException as error:
        receipt = getattr(error, "owned_process_receipt", {"cleanupConfirmed": False})
        save(EVIDENCE / "owned-receipt.json", receipt, failure=True)
        raise
    # Persist the live returned receipt immediately, without reconstructing it.
    receipt_binding = save(EVIDENCE / "owned-receipt.json", receipt, failure=True)
    raw_path = EVIDENCE / "raw-tests.json"
    raw = json.loads(raw_path.read_bytes()) if raw_path.is_file() else None
    unchanged = all(bind(ROOT / binding["path"]) == binding for binding in programs)
    passed = (receipt.get("cleanupConfirmed") is True and receipt.get("assignedBeforeResume") is True
              and receipt.get("killOnJobClose") is True and receipt.get("activeProcessesAfterCleanup") == 0
              and receipt.get("exitCode") == 0 and not receipt.get("timedOut") and unchanged
              and raw is not None and raw["failed"] == raw["errors"] == raw["skipped"] == 0
              and raw["selectedTestNames"] == selected
              and raw["testsAttempted"] == raw["testsCompleted"] == raw["passed"] == len(selected) > 0)
    report = {"schema": "detail-weight-failure-capture-cpu-acceptance-v1", "status": "passed" if passed else "failed_closed",
              "ownedReceipt": receipt_binding, "testResult": bind(raw_path) if raw_path.is_file() else None,
              "programBindings": programs, "sourceBytesUnchanged": unchanged,
              "selectedTestNames": selected, "fullSuiteExecuted": False if raw is None else raw["fullSuiteExecuted"],
              "selectionMode": "default_full_suite" if TEST_NAMES is None else "explicit_selection",
              "productionAdopted": False, "gpuInitialized": False if raw is None else raw["gpuInitialized"],
              "realTrainingExecuted": False, "automaticRetries": 0, "outputBytesBeforeReport": used(EVIDENCE),
              "aggregateTaskBytesBeforeReport": used(TASK_ROOT),
              "remainingGap": "Independent production final-source lifecycle/package admission; no live routing installed."}
    save(EVIDENCE / "acceptance.json", report, failure=True)
    print(json.dumps(report, ensure_ascii=False))
    return 0 if passed else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-root", type=Path, required=True)
    parser.add_argument("--owned-child", action="store_true")
    parser.add_argument("--test-names", nargs="+")
    args = parser.parse_args()
    EVIDENCE = Path(os.path.abspath(args.evidence_root))
    TEST_NAMES = args.test_names
    expected = ROOT / PARENT
    if EVIDENCE == expected or not EVIDENCE.is_relative_to(expected) or not EVIDENCE.resolve().is_relative_to(expected.resolve()):
        raise ValueError("acceptance evidence outside scoped task root")
    if args.owned_child:
        # Enforce ownership before importing torch or the capture adapter.
        sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
        import analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu as owned
        owned.verify_owned_worker()
    raise SystemExit(child() if args.owned_child else parent())
