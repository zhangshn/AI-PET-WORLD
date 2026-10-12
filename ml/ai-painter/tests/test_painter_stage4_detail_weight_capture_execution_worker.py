"""Owned isolated successor CPU fixtures; zero real numerical execution.

The JS acceptance child supplies an actual materialized bootstrap package and
registry round-trip. A bootstrap never qualifies a production GPU invocation.
"""
from contextlib import ExitStack
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import random
import re
import stat
import sys
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src"), str(ROOT / "ml/ai-painter/tests")]
import torch
import painter_stage4_detail_weight_capture_execution_worker as worker
import qualify_stage4_detail_weight_capture_execution_gpu as qualifier
import review_stage4_detail_weight_capture_execution_cpu as review
import test_painter_stage4_detail_weight_failure_capture_managed_worker as fixtures

INPUT = None
EVENTS = {"generatorForwardAttempted": 0, "generatorForwards": 0, "generatorGradientAttempted": 0,
          "generatorGradientCompleted": 0, "discriminatorGradientAttempted": 0, "discriminatorGradientCompleted": 0,
          "generatorStepAttempted": 0, "generatorSteps": 0, "discriminatorStepAttempted": 0,
          "discriminatorSteps": 0, "cudaAttempted": 0, "realDatasetReads": 0,
          "simulatedPairsAttempted": 0, "simulatedPairsCompleted": 0}


def blocked(key):
    def call(*_args, **_kwargs):
        EVENTS[key] += 1
        raise AssertionError("forbidden real CPU/GPU/data call: " + key)
    return call


def bind(path):
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def require_publication_binding(program_bindings):
    item = program_bindings.get("progressPublicationTests")
    worker.require(type(item) is dict
        and item.get("path") == "ml/ai-painter/tests/test_detail_weight_progress_atomic_publication.py",
        "full CPU batch requires exact progress-publication test binding")
    return worker.binding(item)


class SuccessorTests(unittest.TestCase):
    serial = 0
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        fixtures.initialize()
        if INPUT is None:
            raise RuntimeError("private owned isolated bootstrap input required")
        cls.reader, cls.spec, cls.plan, cls.configuration = worker.load_package(INPUT["executionPackage"], root=ROOT, require_lifecycle=False)

    def context(self):
        SuccessorTests.serial += 1
        plan = json.loads(json.dumps(self.plan))
        plan["runId"] = "capture-t51-synthetic-case-" + str(SuccessorTests.serial)
        plan["packageId"] = plan["runId"] + "-package"
        plan["outputRoot"] = self.plan["outputRoot"] + "/" + INPUT.get("caseNamespace", "worker") + "-case-" + str(SuccessorTests.serial)
        plan_binding = worker.write(ROOT, plan["outputRoot"] + "/detail-weight-capture-plan.json", plan)
        spec = json.loads(json.dumps(self.spec))
        spec.update(packageIdentity=plan["packageId"], outputRoot=plan["outputRoot"])
        spec["inputEvidence"] = [plan_binding if b["path"].endswith("/detail-weight-capture-plan.json") else b for b in spec["inputEvidence"]]
        pb = worker.write(ROOT, plan["outputRoot"] + "/execution-package.json", spec)
        reader, spec, plan, config = worker.load_package(pb, root=ROOT, require_lifecycle=False)
        return worker.FailureContext(reader, spec, plan, pb, deadline=time.monotonic() + 90), config

    def test_full_batch_requires_exact_publication_binding(self):
        actual = INPUT["programBindings"]
        self.assertEqual(require_publication_binding(actual), actual["progressPublicationTests"])
        missing = {k: v for k, v in actual.items() if k != "progressPublicationTests"}
        with self.assertRaisesRegex(ValueError, "requires exact"):
            require_publication_binding(missing)
        for malformed in ({"path": "ml/ai-painter/tests/unbound.py", "sha256": "a"*64},
                          {"path": "ml/ai-painter/tests/test_detail_weight_progress_atomic_publication.py", "sha256": "bad"}):
            with self.assertRaises(ValueError):
                require_publication_binding({"progressPublicationTests": malformed})

    def test_resource_successor_preserves_numerical_configuration_and_rejects_mixing(self):
        baseline = self.configuration["executionCeiling"]
        self.assertEqual(baseline["maxWallSeconds"], 2700)
        reader = worker.runtime()[3].Reader(ROOT)
        expected = {**baseline, "maxWallSeconds": 4200} if "resourcePolicy" in self.plan else baseline
        self.assertEqual(worker.effective_execution_ceiling(reader, self.plan, self.configuration), expected)
        legacy = {key: value for key, value in self.plan.items() if key != "resourcePolicy"}
        self.assertEqual(worker.effective_execution_ceiling(reader, legacy, self.configuration), baseline)
        for item in (None, {**worker.RESOURCE_POLICY, "sha256": "0" * 64},
                     {**worker.RESOURCE_POLICY, "path": "data/unknown.json"}):
            with self.assertRaisesRegex(ValueError, "resource version"):
                worker.effective_execution_ceiling(reader, {**self.plan, "resourcePolicy": item}, self.configuration)
        if "resourcePolicy" in self.plan:
            changed = json.loads(json.dumps(self.configuration))
            changed["executionCeiling"]["epochs"] = 49
            with self.assertRaisesRegex(ValueError, "baseline"):
                worker.effective_execution_ceiling(reader, self.plan, changed)
            guard = worker.ResourceGuard(INPUT["executionPackage"], self.plan, self.configuration, root=ROOT)
            self.assertEqual(guard.ceiling, expected)

    def arguments(self, context, config, *, primary=None, failure_at=1, capture_runner=None, networks=None):
        model, critic = networks or fixtures.networks()
        calls = [0]
        def pair(_model, _critic, _sample, _order, _go, _do, counts, ledger, _resource, _forward):
            EVENTS["simulatedPairsAttempted"] += 1
            calls[0] += 1
            counts["discriminator"] += 1; ledger["discriminator"] += 1
            if primary is not None and calls[0] == failure_at:
                raise primary
            counts["generator"] += 1; ledger["generator"] += 1
            EVENTS["simulatedPairsCompleted"] += 1
        checkpoints = {}
        def sink(epoch, raw):
            if epoch is None:
                return checkpoints[raw["path"]]
            logical = context.plan["outputRoot"] + f"/checkpoint-{epoch}.fixture.json"
            checkpoints[logical] = raw
            return worker.write(ROOT, logical, raw)
        def validate(_model, rows, _order, *, epoch):
            shared = worker.runtime()[2]
            values = [{"sampleId": row["sampleId"], "split": "validation", "epoch": epoch,
                "fullRgbMae": .2, "objectCorrelations": {role: .1 for role in shared.OBJECT_CHANNELS}} for row in rows]
            return shared.rank_validation_epoch(values, [row["sampleId"] for row in rows], epoch=epoch), values
        args = dict(context=context, model=model, critic=critic, train=[fixtures.sample(i) for i in range(48)],
            validation=[fixtures.sample(i, "validation") for i in range(8)], order=[], configuration=config,
            package_binding=context.execution_binding, plan=context.plan, resource=lambda: None,
            checkpoint_sink=sink, progress_sink=lambda *_a, **_k: None, pair_runner=pair,
            optimizer_factory=lambda parameters, **_kwargs: object(), validation_runner=validate,
            checkpoint_encoder=lambda *_a, **kw: worker.capture._json({"synthetic": True, "epoch": kw["epoch"]}),
            checkpoint_reloader=lambda raw, **kw: self.assertEqual(json.loads(raw)["epoch"], kw["epoch"]),
            fresh_networks=lambda _order: fixtures.networks())
        if capture_runner is not None:
            args["capture_runner"] = capture_runner
        return args

    def capture_case(self, kind):
        context, config = self.context()
        model, critic = fixtures.networks()
        primary = fixtures.error_attachment(model, kind, unused=kind == "full")
        args = self.arguments(context, config, primary=primary, networks=(model, critic))
        before = fixtures.snapshot(args["model"], args["critic"])
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(**args)
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 1})
        self.assertEqual(primary.completed_epochs, 0)
        manifest, tensors = worker.capture.verify_gradient_failure_capture(primary.gradient_failure_capture)
        self.assertEqual(manifest["gradientEvidenceComplete"], kind == "full")
        self.assertEqual(manifest["location"]["epoch"], 1)
        self.assertEqual(manifest["location"]["trainPosition"], 1)
        order = list(range(48)); random.Random(20260930).shuffle(order)
        self.assertEqual(manifest["location"]["sampleId"], "train-" + str(order[0]))
        self.assertFalse(manifest["location"]["inferredSample"])
        self.assertTrue(all(type(t) is torch.Tensor and t.device.type == "cpu" and not t.requires_grad for t in tensors.values()))
        after = fixtures.snapshot(args["model"], args["critic"])
        self.assertTrue(torch.equal(before["torch"], after["torch"]))
        self.assertEqual(before["python"], after["python"])
        for a, b in zip(before["networks"], after["networks"]):
            self.assertEqual(a["modes"], b["modes"])
            for x, y in zip(a["tensors"], b["tensors"]):
                self.assertEqual(x[:4], y[:4]); self.assertTrue(torch.equal(x[4], y[4]))
                if x[5] is not None: self.assertTrue(torch.equal(x[5], y[5]))
        terminal = json.loads((context.root / "worker-terminal.json").read_bytes())
        self.assertEqual(terminal["schema"], "detail-weight-managed-worker-terminal-v1")
        self.assertEqual(terminal["capture"], primary.gradient_failure_capture)
        self.assertEqual(terminal["optimizerStepsDiscriminator"], 1)
        self.assertEqual(terminal["executionProfile"], worker.EXECUTION_PROFILE)

    def test_01_full_actual_boundary_capture_and_safe_reload(self): self.capture_case("full")
    def test_02_partial_actual_boundary_capture_and_safe_reload(self): self.capture_case("partial")
    def test_03_missing_actual_boundary_capture_and_safe_reload(self): self.capture_case("missing")

    def test_bootstrap_is_actual_preflight_but_not_production_admission(self):
        self.assertEqual(self.plan["executionProfile"], worker.EXECUTION_PROFILE)
        self.assertEqual(self.spec["programLineage"]["worker"], self.plan["programBindings"]["worker"]["sha256"])
        with self.assertRaisesRegex(ValueError, "bootstrap"):
            worker.load_package(INPUT["executionPackage"], root=ROOT)
        with self.assertRaises(ValueError):
            worker.load_package(dict(INPUT["executionPackage"], sha256="0" * 64), root=ROOT, require_lifecycle=False)

    def test_original_context_exact_snapshot_required_and_legacy_lineage_rejected(self):
        cpu = self.reader.json(self.plan["modelCpuReport"])
        changed = {**self.plan, "modelContextSnapshots": []}
        with self.assertRaises(Exception): worker.verify_model_reuse(self.reader, changed, cpu)
        changed = {**self.plan, "numericalSourceBindings": self.plan["numericalSourceBindings"][:-1]}
        with self.assertRaisesRegex(ValueError, "closure"): worker.verify_model_reuse(self.reader, changed, cpu)

    def test_live_registry_lock_pid_and_heartbeat_guards_are_actual(self):
        worker.verify_live_context(self.reader, self.spec, self.plan, self.configuration)
        current_path = self.reader.path(".runtime/ai-painter/current-execution-registry/current.json")
        original = current_path.read_bytes(); current = json.loads(original)
        for key, value in (("processStartIdentity", "reused:pid"), ("programLineage", {})):
            changed = json.loads(original); changed["activeExecution"][key] = value
            current_path.write_bytes(worker.capture._json(changed))
            try:
                with self.assertRaises(ValueError): worker.verify_live_context(self.reader, self.spec, self.plan, self.configuration)
            finally: current_path.write_bytes(original)
        heartbeat = self.reader.path(current["activeExecution"]["heartbeat"]["path"])
        original = heartbeat.read_bytes(); changed = json.loads(original)
        changed["heartbeatAtUtc"] = "2000-01-01T00:00:00Z"; heartbeat.write_bytes(worker.capture._json(changed))
        try:
            with self.assertRaisesRegex(ValueError, "heartbeat"): worker.verify_live_context(self.reader, self.spec, self.plan, self.configuration)
        finally: heartbeat.write_bytes(original)

    def test_capture_progress_and_terminal_errors_preserve_exact_primary(self):
        context, config = self.context(); primary = RuntimeError("synthetic after D")
        args = self.arguments(context, config, primary=primary,
            capture_runner=lambda **_kw: (_ for _ in ()).throw(OSError("capture IO")))
        args["progress_sink"] = lambda *_a, **_k: (_ for _ in ()).throw(KeyboardInterrupt("progress interrupted"))
        with self.assertRaises(RuntimeError) as caught:
            worker.run_captured_boundary(**args, terminal_sink=lambda _v: (_ for _ in ()).throw(SystemExit("terminal IO")))
        self.assertIs(caught.exception, primary)
        self.assertEqual(primary.actual_optimizer_counts, {"generator": 0, "discriminator": 1})
        self.assertFalse(primary.failure_capture_terminal_publication["complete"])
        self.assertEqual([e["stage"] for e in primary.failure_capture_secondary_errors], ["failure_progress", "failure_capture", "failure_terminal"])

    def test_expired_failure_still_finalizes_without_retry(self):
        context, config = self.context(); primary = RuntimeError("expired after D")
        args = self.arguments(context, config, primary=primary)
        pair = args["pair_runner"]
        def expire(*a): context.deadline = time.monotonic() - 1; pair(*a)
        args["pair_runner"] = expire
        with self.assertRaises(RuntimeError) as caught: worker.run_captured_boundary(**args)
        self.assertIs(caught.exception, primary)
        self.assertTrue((context.root / "worker-terminal.json").is_file())
        with self.assertRaises(ValueError): context.claim()

    def test_saved_checkpoint_bytes_count_and_capture_budget_rejects(self):
        context, config = self.context(); worker.write(ROOT, context.plan["outputRoot"] + "/saved.pt", b"x" * 8192)
        before = context.remaining()
        self.assertEqual(worker.capture._owned_bytes(context.root)["checkpointBytes"], 8192)
        worker.write(ROOT, context.plan["outputRoot"] + "/more.pt", b"x" * 4096)
        self.assertEqual(context.remaining(), before - 4096)
        model, critic = fixtures.networks(); primary = fixtures.error_attachment(model)
        receipt = worker.capture.capture_gradient_failure(error=primary, model=model, critic=critic,
            sample=fixtures.sample(), counts={"generator": 0, "discriminator": 1}, epoch=1, train_position=1,
            output_root=context.root / "bounded-failure", execution_binding=context.execution_binding,
            source_bindings=context.package["sourceBindings"], remaining_output_bytes=1024)
        self.assertEqual(receipt["status"], "capture_failed")

    def test_success_schedule_ranking_review_and_zero_capture(self):
        context, config = self.context(); args = self.arguments(context, config,
            capture_runner=lambda **_kw: self.fail("capture on success"))
        terminal = worker.run_captured_boundary(**args)
        selected = review.selected_record(terminal)
        self.assertEqual(selected["epoch"], 24)
        self.assertEqual(terminal["optimizerSteps"], {"generator": 2304, "discriminator": 2304})
        self.assertEqual([r["epoch"] for r in terminal["checkpoints"]], [24, 36, 48])
        self.assertFalse((context.root / "failure-capture").exists())
        changed = {**terminal, "optimizerSteps": {"generator": 0, "discriminator": 1}}
        with self.assertRaises(ValueError): review.selected_record(changed)

    def test_frozen_checkpoint_state_and_configuration_guards_on_synthetic_tensors(self):
        # Exercise the unchanged strict helpers without building a real model
        # or claiming a complete production checkpoint encode/reload.
        strict = worker.checkpoint.components()[1]
        reference = {"weight": torch.tensor([.125, -.25])}
        state = strict._state(reference, reference, "synthetic")
        self.assertTrue(torch.equal(state["weight"], reference["weight"]))
        self.assertNotEqual(state["weight"].data_ptr(), reference["weight"].data_ptr())
        for changed in ({}, {"weight": torch.tensor([float("nan"), 0.])},
                        {"weight": torch.tensor([1.])}, {"weight": reference["weight"].double()}):
            with self.assertRaises(ValueError): strict._state(changed, reference, "synthetic")
        worker.checkpoint.validate_configuration(self.configuration)
        with self.assertRaises(ValueError):
            worker.checkpoint.validate_configuration({**self.configuration, "seed": 1})
        with self.assertRaises(ValueError): strict._counts({"generator": 2, "discriminator": 1})

    def test_atomic_output_replacement_recounts_progress_and_heartbeat(self):
        context, _config = self.context()
        original = Path.lstat
        for name, suffix in (("progress.json", "0123456789abcdef"),
                             ("heartbeat.json", "01234567-89ab-cdef-0123-456789abcdef")):
            directory = ROOT / context.plan["outputRoot"] / name[:-5]
            directory.mkdir()
            final, staged = directory / name, directory / (name + ".staged-" + suffix)
            final.write_bytes(b"x" * 5); staged.write_bytes(b"x" * 37)
            (directory / "sentinel.json").write_bytes(b"x" * 11)
            renamed = []
            def racing(target, *args, **kwargs):
                if target == staged and not renamed:
                    os.replace(staged, final); renamed.append(True)
                return original(target, *args, **kwargs)
            with patch.object(Path, "lstat", new=racing):
                self.assertEqual(worker.directory_bytes(directory), 48)
            self.assertEqual(len(renamed), 1)

    def test_output_accounting_unknown_missing_permission_and_churn_fail_closed(self):
        context, _config = self.context()
        directory = ROOT / context.plan["outputRoot"] / "accounting-rejections"
        directory.mkdir()
        file = directory / "immutable.json"; file.write_bytes(b"immutable")
        original = Path.lstat
        for error in (FileNotFoundError("missing output root"), PermissionError("denied output root")):
            def reject_root(target, *args, **kwargs):
                if target == directory:
                    raise error
                return original(target, *args, **kwargs)
            with patch.object(Path, "lstat", new=reject_root), self.assertRaises(type(error)):
                worker.directory_bytes(directory)
        def root_link(target, *args, **kwargs):
            if target == directory:
                return os.stat_result((stat.S_IFLNK | 0o777,) + (0,) * 9)
            return original(target, *args, **kwargs)
        with patch.object(Path, "lstat", new=root_link), self.assertRaisesRegex(ValueError, "regular directory"):
            worker.directory_bytes(directory)
        for error in (FileNotFoundError("missing immutable"), PermissionError("denied")):
            def reject(target, *args, **kwargs):
                if target == file:
                    raise error
                return original(target, *args, **kwargs)
            with patch.object(Path, "lstat", new=reject), self.assertRaises(type(error)):
                worker.directory_bytes(directory)
        staged = directory / "progress.json.staged-0123456789abcdef"
        final = directory / "progress.json"; final.write_bytes(b"current")
        iterator = Path.iterdir; scans = []
        def entries(target):
            if target == directory:
                scans.append(True); return iter((staged,))
            return iterator(target)
        def missing(target, *args, **kwargs):
            if target == staged:
                raise FileNotFoundError("renamed staged")
            return original(target, *args, **kwargs)
        with patch.object(Path, "iterdir", new=entries), patch.object(Path, "lstat", new=missing), self.assertRaisesRegex(ValueError, "three scans"):
            worker.directory_bytes(directory)
        self.assertEqual(len(scans), 3)
        directory2 = directory / "missing-final"; directory2.mkdir()
        staged2 = directory2 / staged.name; staged2.write_bytes(b"pending")
        def missing2(target, *args, **kwargs):
            if target == staged2:
                raise FileNotFoundError("renamed staged")
            return original(target, *args, **kwargs)
        with patch.object(Path, "lstat", new=missing2), self.assertRaises(FileNotFoundError):
            worker.directory_bytes(directory2)

    def test_recounted_output_bytes_still_enforce_failure_reserve(self):
        context, _config = self.context()
        logical = context.plan["outputRoot"] + "/accounting-budget"
        directory = ROOT / logical; directory.mkdir()
        final = directory / "progress.json"; staged = directory / "progress.json.staged-0123456789abcdef"
        final.write_bytes(b"x" * 5); staged.write_bytes(b"x" * 50)
        (directory / "sentinel.json").write_bytes(b"x" * 5)
        original = Path.lstat; renamed = []
        def racing(target, *args, **kwargs):
            if target == staged and not renamed:
                os.replace(staged, final); renamed.append(True)
            return original(target, *args, **kwargs)
        env = {"DETAIL_WEIGHT_OUTPUT_ROOTS": json.dumps([logical]), "DETAIL_WEIGHT_OUTPUT_MAX": str(65536 + 64),
               "DETAIL_WEIGHT_BUDGET_PROJECT_ROOT": str(ROOT)}
        with patch.dict(os.environ, env), patch.object(Path, "lstat", new=racing), self.assertRaisesRegex(ValueError, "reserve ceiling"):
            worker.write(ROOT, logical + "/blocked.json", b"x" * 10)
        self.assertEqual(worker.directory_bytes(directory), 55)
        self.assertFalse((directory / "blocked.json").exists())

    def test_qualifier_counts_old_gpu_proof_and_no_extra_dispatch(self):
        calls = qualifier.Calls(); calls.begin()
        with self.assertRaises(ValueError): calls.event("complete", "forward", None)
        calls = qualifier.Calls(); calls.begin(); calls.event("attempt", "forward", None); calls.event("complete", "forward", None)
        with self.assertRaises(ValueError): calls.event("attempt", "forward", None)
        ids = self.reader.json(self.plan["trainSplit"])["sampleIds"]
        # Negative metadata fixture: all other checked identities/counts agree;
        # only the legacy profile differs. It grants no GPU qualification.
        gate = dict(schema=worker.GPU_SCHEMA, executionProfile="legacy", synthetic=True,
            executionPackage=INPUT["executionPackage"], programBindings=self.plan["programBindings"], status="passed",
            actualCounts={"forwardAttempted": 48, "forwardCompleted": 48, "generatorAttempted": 192,
                "generatorCompleted": 192, "discriminatorAttempted": 48, "discriminatorCompleted": 48},
            cases=[{"sampleId": sample_id, "passed": True} for sample_id in ids], optimizerSteps=0,
            initialState={"synthetic": True}, finalState={"synthetic": True})
        b = worker.write(ROOT, self.plan["outputRoot"] + "/gpu-gate.json", gate)
        with self.assertRaisesRegex(ValueError, "GPU gate"):
            worker.verify_gpu_gate(self.reader, {**self.plan, "gpuGateSha256": b["sha256"]}, INPUT["executionPackage"])


class RawResult(unittest.TextTestResult):
    def __init__(self, *a, **kw): super().__init__(*a, **kw); self.items = []
    def addSuccess(self, test): super().addSuccess(test); self.items.append({"name": test.id(), "status": "passed", "executionKind": "synthetic_cpu"})
    def addFailure(self, test, error): super().addFailure(test, error); self.items.append({"name": test.id(), "status": "failed", "error": self._exc_info_to_string(error, test)[-12000:]})
    def addError(self, test, error): super().addError(test, error); self.items.append({"name": test.id(), "status": "error", "error": self._exc_info_to_string(error, test)[-12000:]})


def owned_batch(input_binding, test_names=None):
    global INPUT
    worker.require(any(prefix in ROOT.as_posix() for prefix in (
                       "/detail-weight-capture-bounded-repair-t-q4-51/training/",
                       "/native-startup-recovery-t-q4-55/cpu/training/",
                       "/post-reboot-current-source-t-q4-58/cpu/training/",
                       "/corrected-source-verification-t-q4-59/cpu/training/",
                       "/output-accounting-race-repair-t-q4-60/cpu/training/",
                       "/progress-publication-current-source-t-q4-61/cpu/training/",
                       "/progress-publication-binding-guard-t-q4-62/cpu/training/",
                       "/seventy-minute-resource-successor-t-q4-64/cpu/training/",
                       "/seventy-minute-config-binding-repair-t-q4-65/cpu/training/"))
                   and ROOT != Path("F:/ai-pet-world"), "tests require copied source under actual isolated project")
    INPUT = worker.runtime()[3].Reader(ROOT).json(input_binding)
    worker.require(re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", INPUT.get("caseNamespace", "worker")) is not None,
                   "private fixture namespace invalid")
    available = unittest.defaultTestLoader.getTestCaseNames(SuccessorTests)
    if test_names is not None:
        worker.require(type(test_names) is list and bool(test_names) and len(test_names) == len(set(test_names))
                       and all(name in available for name in test_names)
                       and INPUT.get("testNames") == test_names, "immutable exact test selection differs")
    else:
        worker.require(INPUT.get("testNames") is None, "immutable input requested a different test subset")
        worker.runtime()[3].Reader(ROOT).read(require_publication_binding(INPUT["programBindings"]))
    worker.require(type(INPUT.get("isolatedProjectRoot")) is str
                   and Path(INPUT["isolatedProjectRoot"]).absolute() == ROOT
                   and Path(INPUT["isolatedProjectRoot"]).resolve() == ROOT.resolve()
                   and worker.ROOT.resolve() == ROOT.resolve(), "immutable input isolation/source root differs")
    # The frozen native owner uses an unnamed retained Job. Only the parent
    # can confirm exact ownership/cleanup; child membership is observational.
    import ctypes
    from ctypes import wintypes
    require_owned = ctypes.WinDLL("kernel32", use_last_error=True)
    require_owned.GetCurrentProcess.restype = wintypes.HANDLE
    require_owned.IsProcessInJob.argtypes = [wintypes.HANDLE, wintypes.HANDLE, ctypes.POINTER(wintypes.BOOL)]
    belongs = wintypes.BOOL()
    worker.require(require_owned.IsProcessInJob(require_owned.GetCurrentProcess(), None, ctypes.byref(belongs)) and belongs.value,
                   "CPU fixture outside owned process boundary")
    parent_identity = worker.runtime()[2].managed_worker.process_identity(INPUT["supervisorPid"])
    worker.require(parent_identity == INPUT["supervisorStartIdentity"], "CPU fixture supervisor exited/reused")
    started = time.monotonic()
    with ExitStack() as stack:
        reader_type = worker.runtime()[3].Reader
        actual_read = reader_type.read
        def guarded_read(reader, binding):
            if Path(binding["path"]).suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
                return blocked("realDatasetReads")()
            return actual_read(reader, binding)
        stack.enter_context(patch.object(reader_type, "read", new=guarded_read))
        for owner, name, key in ((torch.nn.Module, "_call_impl", "generatorForwardAttempted"),
            (torch.autograd, "grad", "generatorGradientAttempted"), (torch.autograd, "backward", "generatorGradientAttempted"),
            (torch.Tensor, "backward", "generatorGradientAttempted"), (torch.optim.AdamW, "step", "generatorStepAttempted"),
            (torch.cuda, "_lazy_init", "cudaAttempted"), (torch.cuda, "init", "cudaAttempted"), (torch.cuda, "get_rng_state", "cudaAttempted")):
            stack.enter_context(patch.object(owner, name, side_effect=blocked(key)))
        suite = unittest.TestSuite(SuccessorTests(name) for name in test_names) if test_names is not None \
            else unittest.defaultTestLoader.loadTestsFromTestCase(SuccessorTests)
        publication_cases = []
        if test_names is None:
            import test_detail_weight_progress_atomic_publication as publication
            private_root = ROOT / ".runtime/progress-publication-cases"
            private_root.mkdir(parents=True, exist_ok=False)
            stack.enter_context(patch.dict(os.environ, {"AI_PAINTER_PROGRESS_TEST_ROOT": str(private_root)}))
            publication_cases = unittest.defaultTestLoader.getTestCaseNames(publication.PublicationTests)
            suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(publication.PublicationTests))
        result = unittest.TextTestRunner(stream=io.StringIO(), verbosity=2, resultclass=RawResult).run(suite)
    raw = {"schema": "detail-weight-capture-cpu-raw-v1", "synthetic": True, "gpuInitialized": torch.cuda.is_initialized(),
        "productionAdopted": False, "items": result.items, "testsAttempted": result.testsRun, "testsCompleted": len(result.items),
        "passed": sum(x["status"] == "passed" for x in result.items), "failed": len(result.failures), "errors": len(result.errors),
        "skipped": len(result.skipped), "actualCalls": {k:EVENTS[k] for k in ("generatorForwardAttempted", "generatorForwards", "generatorGradientAttempted", "generatorGradientCompleted", "discriminatorGradientAttempted", "discriminatorGradientCompleted")},
        "actualOptimizerSteps": {"generator": EVENTS["generatorSteps"], "discriminator": EVENTS["discriminatorSteps"]},
        "events": EVENTS, "configuration": SuccessorTests.configuration if hasattr(SuccessorTests, "configuration") else None,
        "resourcePolicy": SuccessorTests.plan.get("resourcePolicy") if hasattr(SuccessorTests, "plan") else None,
        "effectiveExecutionCeiling": worker.effective_execution_ceiling(worker.runtime()[3].Reader(ROOT), SuccessorTests.plan, SuccessorTests.configuration) if hasattr(SuccessorTests, "plan") else None,
        "programBindings": INPUT["programBindings"], "elapsedSeconds": time.monotonic() - started,
        "bootstrapLifecyclePendingUntilCurrentOwnedReceipt": True,
        "jobMembershipObservationOnly": True, "exactJobCleanupAuthority": "retained_native_parent_receipt"}
    raw["testNames"] = test_names or available + publication_cases
    raw["caseNamespace"] = INPUT.get("caseNamespace", "worker")
    worker.write(ROOT, INPUT["rawOutput"], raw)
    return 0 if result.wasSuccessful() and not raw["gpuInitialized"] and all(EVENTS[k] == 0 for k in EVENTS if not k.startswith("simulated")) else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--input", required=True); parser.add_argument("--sha256", required=True)
    parser.add_argument("--test-names", help="JSON exact private subset, also bound by immutable input")
    a = parser.parse_args(); raise SystemExit(owned_batch({"path": a.input, "sha256": a.sha256},
        json.loads(a.test_names) if a.test_names is not None else None))
