"""Own diagnostic protocol tests and final-source CPU harness; no numerics."""
import argparse
import copy
import ctypes
from ctypes import wintypes
from contextlib import contextmanager, nullcontext
from datetime import datetime, timezone
import hashlib
import importlib.util
import io
import json
import os
import shutil
from pathlib import Path
import subprocess
import sys
import threading
import time
import traceback
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
for p in (ROOT / "ml/ai-painter/src", ROOT / "ml/ai-painter/scripts", ROOT / "ml/ai-painter/tests"):
    sys.path.insert(0, str(p))
import ecology_decode1_weight_quality_auth_v1 as auth
import painter_stage4_ecology_decode1_weight_quality_worker_v1 as worker
from ai_painter.complete_world import ecology_regime_gradient_failure_capture as capture


def _expected_current_source_counts(reader):
    frozen = auth.read_json(reader, auth.FROZEN_PLAN)["programBindings"]
    auth.require(len(frozen) == 179, "original179 source closure differs")
    neutral = ("scripts/lib/ai-pet-world-storage.mjs",
        "scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs",
        "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
        "src/server/ai-painter-current-execution-registry.mjs")
    deployment = auth.LOCAL_DEPLOYMENT_DEPENDENCY_ROLES
    paths = {auth.historical_source_binding(role, binding)["path"] for role, binding in frozen.items()} | set(auth.ROLES.values()) | set(neutral) | set(deployment.values())
    return 179 + len(auth.ROLES) + len(neutral) + len(deployment), len(paths)


class _NegativeSizeStatProxy:
    """Negative fixture only: delegate actual stat attributes; override size."""
    __slots__ = ("_actual", "st_size")

    def __init__(self, actual, size):
        self._actual, self.st_size = actual, size

    def __getattr__(self, name):
        return getattr(self._actual, name)


def _cpu_phase(phase, started, **details):
    """Small flushed diagnostics survive a managed worker deadline."""
    sys.stderr.write("\n" + json.dumps({"schema": "cpu-test-phase-v1", "phase": phase,
        "elapsedSeconds": time.monotonic() - started, "pid": os.getpid(), **details}) + "\n")
    sys.stderr.flush()


class _LiveCpuOutput(io.StringIO):
    def __init__(self):
        super().__init__()
        self._bytes = 0

    def write(self, text):
        self._bytes += len(text.encode("utf8"))
        auth.require(self._bytes <= 1024**2, "CPU test transcript byte ceiling")
        count = super().write(text)
        sys.stderr.write(text)
        sys.stderr.flush()
        return count


class _TimedCpuResult(unittest.TextTestResult):
    def startTestRun(self):
        super().startTestRun()
        _component_preparation_begin(self)

    def stopTestRun(self):
        try:
            _component_preparation_end(self)
        finally:
            super().stopTestRun()

    def _first_exception(self, test, err):
        if getattr(self, "_first_exception_recorded", False):
            return
        self._first_exception_recorded = True
        # Emit the actual exception now; unittest's deferred report may never run.
        text = "".join(traceback.format_exception(*err))
        prefix = "\ncpu-first-exception-v1 " + test.id() + " " + err[0].__name__ + "\n"
        budget = 4096 - len(prefix.encode("utf8"))
        raw = text.encode("utf8")
        if len(raw) > budget:
            marker = b"\n[traceback truncated to 4096-byte diagnostic]\n"
            raw = raw[:512] + marker + raw[-max(0, budget - 512 - len(marker)):]
        diagnostic = prefix + raw.decode("utf8", errors="ignore")
        sys.stderr.write(diagnostic)
        sys.stderr.flush()

    def startTest(self, test):
        _component_preparation_enter(self, test)
        self._test_started = time.monotonic()
        self._test_status = "running"
        _cpu_phase("test.start", self._test_started, testId=test.id())
        super().startTest(test)

    def addSuccess(self, test):
        self._test_status = "passed"
        super().addSuccess(test)

    def addError(self, test, err):
        self._test_status = "error"
        self._first_exception(test, err)
        super().addError(test, err)

    def addFailure(self, test, err):
        self._test_status = "failed"
        self._first_exception(test, err)
        super().addFailure(test, err)

    def addSkip(self, test, reason):
        self._test_status = "skipped"
        super().addSkip(test, reason)

    def addSubTest(self, test, subtest, err):
        if err is not None:
            self._test_status = "failed"
            self._first_exception(test, err)
        super().addSubTest(test, subtest, err)

    def stopTest(self, test):
        super().stopTest(test)
        _cpu_phase("test.result", self._test_started, testId=test.id(), status=self._test_status)


def _live_closure_slot():
    # A lexical, per-module slot: no environment/JSON deserialization path.
    records = {}

    def install(test, provider):
        frame = sys._getframe(1)
        harness = frame.f_globals.get("cpu_harness")
        auth.require(callable(harness) and frame.f_code is harness.__code__ and
            frame.f_code.co_name == "cpu_harness" and
            Path(frame.f_code.co_filename).resolve() == Path(__file__).resolve(), "live cpu_harness caller required")
        auth.require(type(test) is ExecutionProtocolCpuTests and
            test._testMethodName == "test_actual_readonly_train_asset_and_validation_metadata_closure" and
            provider is frame.f_locals.get("use_derived_closure") and id(test) not in records,
            "exact current closure consumer/provider required")
        request, reader = frame.f_locals["request"], frame.f_locals["reader"]
        auth.require(type(reader) is auth.Reader, "actual current harness Reader required")
        binding = request["programBindings"]["cpuHarness"]
        auth.require(binding["path"] == auth.ROLES["cpuHarness"] and
            hashlib.sha256(reader.read(binding, 1024**2)).hexdigest() == binding["sha256"], "bound live harness source required")
        record = {"frame": frame, "provider": provider, "consumer": test,
            "pid": os.getpid(), "thread": threading.get_ident(), "used": False}
        records[id(test)] = record

        def release():
            if records.get(id(test)) is record:
                del records[id(test)]
        return release

    def consume(test):
        record = records.get(id(test))
        if record is None:
            return None
        frame = sys._getframe(1)
        while frame is not None and frame is not record["frame"]:
            frame = frame.f_back
        auth.require(record["consumer"] is test and frame is record["frame"] and record["pid"] == os.getpid() and
            record["thread"] == threading.get_ident() and not record["used"], "cross invocation closure handoff refused")
        record["used"] = True
        return record["provider"]()

    return install, consume


_install_live_closure, _consume_live_closure = _live_closure_slot()


def _component_preparation_slot():
    """Same live component suite's actual recomputation; no native authority."""
    state = {}

    def result_caller(result, method):
        frame = sys._getframe(2)
        auth.require(type(result) is _TimedCpuResult and frame.f_locals.get("self") is result and
            frame.f_code is getattr(_TimedCpuResult, method).__code__, "exact live CPU result caller required")

    def begin(result):
        result_caller(result, "startTestRun")
        auth.require(not state, "overlapping component preparation refused")
        frame = sys._getframe(1)
        wanted = (ROOT / _COMPONENT_PRIVATE_ROOT / "cpu_batch.py").absolute()
        while frame is not None and Path(frame.f_code.co_filename).absolute() != wanted:
            frame = frame.f_back
        # A native harness uses its existing, separate private handoff.
        if frame is not None and not os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT"):
            state.update(result=result, frame=frame, pid=os.getpid(), thread=threading.get_ident(), current=None, record=None)

    def enter(result, test):
        result_caller(result, "startTest")
        if state:
            auth.require(state["result"] is result, "cross suite component preparation refused")
            state["current"] = test

    def end(result):
        result_caller(result, "stopTestRun")
        if state:
            auth.require(state["result"] is result, "cross suite preparation release refused")
            state.clear()

    def live():
        frame = sys._getframe(1)
        while frame is not None and frame is not state.get("frame"):
            frame = frame.f_back
        auth.require(state and frame is state["frame"] and state["pid"] == os.getpid() and
            state["thread"] == threading.get_ident(), "expired/cross invocation component preparation")

    def publish(reader, plan, closure):
        frame = sys._getframe(1)
        auth.require(frame.f_code is BoundSourceSnapshotCpuTests.setUpClass.__func__.__code__ and
            frame.f_locals.get("cls") is BoundSourceSnapshotCpuTests and reader is BoundSourceSnapshotCpuTests.reader and
            plan is BoundSourceSnapshotCpuTests.plan and closure is BoundSourceSnapshotCpuTests.closure and
            type(reader) is auth.Reader, "exact actual production preparation provider required")
        if not state:
            return False
        live()
        auth.require(state["record"] is None, "duplicate component preparation provider")
        auth.require(len(closure["bindings"]) == 1435 and reader._source_snapshot_scope ==
            {"runId": plan["runId"], "packageId": plan["packageId"], "dataClosure": auth.exact_binding(plan["dataClosure"])} and
            reader._source_snapshot_bindings == {b["path"]: b for b in closure["bindings"]} and
            all(reader.observed.get(b["path"]) == b["sha256"] for b in closure["bindings"]),
            "actual recomputed full source closure required")
        proof_reader = auth.Reader(ROOT)
        base = _COMPONENT_PRIVATE_ROOT + "/cpu-negative-inputs"
        declaration, declaration_binding = _read_negative_observation_json(proof_reader, base + "/input-declaration.json")
        request_binding = auth.exact_binding(json.loads(os.environ["T_Q4_112_COMPONENT_REQUEST"]))
        request = auth.read_json(proof_reader, request_binding)
        auth.require(request_binding["path"] == _COMPONENT_PRIVATE_ROOT + "/component-request.json" and
            os.environ.get("T_Q4_90_PRIVATE_ROOT") == _COMPONENT_PRIVATE_ROOT and
            request.get("schema") == "cpu-negative-input-component-request-v1" and request.get("taskId") == "T-QV12-01" and
            request.get("outputRoot") == _COMPONENT_PRIVATE_ROOT and request.get("nativeOwnerAllowed") is False and
            request.get("formalSpecification") == auth.SPECIFICATION and
            type(request.get("callIdentity")) is str and bool(request["callIdentity"]) and
            declaration.get("schema") == "cpu-negative-input-component-declaration-v1" and
            declaration.get("request") == request_binding and declaration.get("layout") == _negative_observation_layout(base) and
            declaration.get("callIdentity") == request.get("callIdentity") == os.environ.get("T_Q4_112_COMPONENT_CALL") and
            declaration.get("programBindings") == request.get("programBindings") and
            declaration.get("linkMetadataReserveBytes") == 49152 and declaration.get("reserveIsMeasurement") is False and
            declaration.get("formalMapping") == _negative_formal_mapping(proof_reader, base), "exact current component preparation origin")
        seen = auth.verify_programs(proof_reader, request["programBindings"])
        auth.require((len(request["programBindings"]), len(seen)) == _expected_current_source_counts(proof_reader),
                     "full current quality source closure required")
        paths = {b["path"]: reader.path(b["path"]) for b in closure["bindings"]}
        identities = {logical: capture._file_identity(path.lstat()) for logical, path in paths.items()}
        state["record"] = {"reader": reader, "closure": copy.deepcopy(closure), "plan": copy.deepcopy(plan),
            "paths": paths, "identities": identities, "proofReader": proof_reader, "request": copy.deepcopy(request),
            "requestBinding": request_binding, "declarationBinding": declaration_binding, "used": False}
        return True

    def consume(test):
        if not state or state["current"] is not test or type(test) is not ExecutionProtocolCpuTests or \
            test._testMethodName != "test_actual_readonly_train_asset_and_validation_metadata_closure":
            return None
        live()
        frame = sys._getframe(1)
        auth.require(frame.f_locals.get("self") is test and frame.f_code is
            ExecutionProtocolCpuTests.test_actual_readonly_train_asset_and_validation_metadata_closure.__code__,
            "exact component preparation consumer required")
        record = state["record"]
        auth.require(record is not None and not record["used"], "missing/reused component preparation")
        record["used"] = True

        def recheck():
            live()
            reader = record["reader"]
            auth.require(reader is BoundSourceSnapshotCpuTests.reader and reader.root == ROOT and
                reader._source_snapshot_scope == {"runId": record["plan"]["runId"],
                    "packageId": record["plan"]["packageId"], "dataClosure": auth.exact_binding(record["plan"]["dataClosure"])} and
                reader._source_snapshot_bindings == {b["path"]: b for b in record["closure"]["bindings"]},
                "component preparation reader/source scope changed")
            reader.mapping.check()
            for binding in record["closure"]["bindings"]:
                path = record["paths"][binding["path"]]
                expected = record["identities"][binding["path"]]
                auth.require(capture._file_identity(path.lstat()) == expected, "prepared source identity changed before read")
                reader.read(binding)  # Original complete path/handle/SHA verifier, every time.
                auth.require(capture._file_identity(path.lstat()) == expected, "prepared source identity changed after read")
            auth.require(auth.same_json(auth.read_json(reader, record["plan"]["dataClosure"]), record["closure"]),
                "actual prepared closure bytes changed")
            proof = record["proofReader"]
            proof.read(record["requestBinding"], auth.CONTROL_JSON_MAX)
            proof.read(record["declarationBinding"], auth.CONTROL_JSON_MAX)
            auth.verify_programs(proof, record["request"]["programBindings"])
            reader.mapping.check()

        @contextmanager
        def use():
            recheck()
            _cpu_phase("component.preparation.before_verified", time.monotonic(), bindings=1435, nativeAuthorityClaimed=False)
            try:
                yield copy.deepcopy(record["closure"])
            finally:
                recheck()
                _cpu_phase("component.preparation.after_verified", time.monotonic(), bindings=1435, nativeAuthorityClaimed=False)
        return use()

    return begin, enter, end, publish, consume


(_component_preparation_begin, _component_preparation_enter, _component_preparation_end,
 _publish_component_preparation, _consume_component_preparation) = _component_preparation_slot()


class MemoryReader:
    """Explicit synthetic protocol store. Never a production reader or Job."""
    def __init__(self, values=None):
        self.values, self.root = {} if values is None else dict(values), ROOT
        self.observed = {}
        self.mapping = self

    def put(self, logical, value):
        raw = value if type(value) is bytes else capture.json_bytes(value)
        self.values[logical] = raw
        return {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}

    def read(self, binding, maximum=capture.MAX_CAPTURE):
        auth.exact_binding(binding)
        raw = self.values[binding["path"]]
        auth.require(len(raw) <= maximum and hashlib.sha256(raw).hexdigest() == binding["sha256"], "synthetic immutable bytes differ")
        self.observed[binding["path"]] = binding["sha256"]
        return raw

    binding = read

    def json(self, binding):
        return auth.decode(self.read(binding))

    def snapshot(self, logical):
        raw = self.values[logical]
        return raw, {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}

    def unchanged(self):
        for p, sha in tuple(self.observed.items()):
            self.read({"path": p, "sha256": sha})


class ExecutionProtocolCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reader = MemoryReader()
        frozen = json.loads((ROOT / auth.FROZEN_PLAN["path"]).read_bytes())
        cls.programs = {"frozen-" + role: auth.historical_source_binding(role, b) for role, b in frozen["programBindings"].items()}
        # Only source137 is the verified new manifest, never old SHA/current bytes.
        cls.programs["frozen-source-137"] = cls.reader.put("package.json", (ROOT / "package.json").read_bytes())
        for role, p in auth.ROLES.items():
            cls.programs[role] = cls.reader.put(p, (ROOT / p).read_bytes())
        for role, p in auth.LOCAL_DEPLOYMENT_DEPENDENCY_ROLES.items():
            cls.programs[role] = cls.reader.put(p, (ROOT / p).read_bytes())
        for b in cls.programs.values():
            cls.reader.values[b["path"]] = (ROOT / b["path"]).read_bytes()
        for b in (auth.FROZEN_PLAN, auth.CANDIDATE, auth.SPECIFICATION):
            cls.reader.values[b["path"]] = (ROOT / b["path"]).read_bytes()
        candidate = cls.reader.json(auth.CANDIDATE)
        for key in ("datasetManifest", "trainSplit", "validationSplit"):
            b = candidate["frozenBindings"][key]
            cls.reader.values[b["path"]] = (ROOT / b["path"]).read_bytes()
        cls.output = auth.ROOT_PREFIX + "synthetic-diagnostic-76"
        cls.model_binding = cls.reader.put(cls.output + "/model-identity.json", json.dumps(auth.derive_model_metadata(cls.reader,
            candidate["frozenBindings"]["datasetManifest"])).encode())
        cls.configuration = auth.configuration(cls.reader)
        cls.ids = cls.reader.json(candidate["frozenBindings"]["trainSplit"])["sampleIds"]
        cls.data_closure = {"schema": "ecology-decode1-weight-quality-data-closure-v1", "metadataCounts": {"train": 48, "validation": 8},
            "splitSampleIds": {split: cls.reader.json(candidate["frozenBindings"][split + "Split"])["sampleIds"] for split in ("train", "validation")},
            "validationRgbRead": False, "challengeContentRead": False, "regressionContentRead": False,
            "bindings": [candidate["frozenBindings"]["trainSplit"], candidate["frozenBindings"]["validationSplit"]]}
        cls.plan = {"schema": auth.PLAN_SCHEMA, "executionProfile": auth.PROFILE, "executionMode": "bounded-quality-training",
            "capabilityVersion": auth.CAPABILITY, "runId": "synthetic-diagnostic-76", "packageId": "synthetic-package-76", "outputRoot": cls.output,
            "configuration": cls.configuration, "modelBinding": cls.model_binding, "programBindings": cls.programs,
            "sourceCandidate": auth.CANDIDATE, "formalSpecification": auth.SPECIFICATION,
            "historicalCheckpointMayInitialize": False, "trainingRestartAllowed": False,
            "runtimeIdentity": auth.runtime_identity(ROOT),
            "dataClosure": cls.reader.put(cls.output + "/data-closure.json", cls.data_closure),
            "finalCpuAcceptance": cls.reader.put(cls.output + "/cpu-acceptance.json", {"fixtureKind": "unqualified-memory-only"}),
            **{k: candidate["frozenBindings"][k] for k in ("datasetManifest", "trainSplit", "validationSplit")}}
        cls.plan_binding = cls.reader.put(cls.output + "/quality-plan.json", cls.plan)
        inputs = [cls.plan_binding, auth.CANDIDATE, auth.SPECIFICATION, auth.FROZEN_PLAN,
                  cls.model_binding, cls.plan["dataClosure"], cls.plan["finalCpuAcceptance"],
                  *[cls.plan[k] for k in ("datasetManifest", "trainSplit", "validationSplit")]]
        cls.package = {"schemaVersion": "ai-painter-autonomous-closed-loop-package-v1", "capabilityVersion": auth.CAPABILITY,
            "packageIdentity": cls.plan["packageId"], "outputRoot": cls.output, "ownerAuthorizationRequired": False, "ownerInStateMachine": False,
            "maxInfrastructureRecoveryAttempts": 0, "inputEvidence": inputs,
            "programLineage": {role: b["sha256"] for role, b in cls.programs.items()},
            "phaseAdapters": {phase: {"kind": "project_module_export", "path": auth.ROLES["adapter"],
                "sha256": cls.programs["adapter"]["sha256"], "exportName": phase} for phase in auth.PHASES}}
        cls.package_binding = cls.reader.put(".runtime/ai-painter/autonomous-closed-loop-packages/" + cls.plan["packageId"] + "/package.json", cls.package)

    def setUp(self):
        self.store = MemoryReader(self.reader.values)

    def test_own_full_source_package_positive_and_actual_fresh_model(self):
        context = auth.load_execution_package(self.store, self.package_binding, recompute_model=False)
        self.assertEqual(context.plan, self.plan)
        actual = auth.derive_model_metadata(self.store, self.plan["datasetManifest"])
        self.assertEqual(actual, self.store.json(self.model_binding))
        self.assertEqual(len(actual["graph"]), 108)
        self.assertEqual(sum(r["elements"] for r in actual["graph"]), 2242687)
        self.assertEqual(sum(r.startswith("frozen-") for r in self.programs), 179)

    def test_old_spec_plan_cross_package_and_missing_input_rejected(self):
        for mutate in (lambda p: p.update(schema="ecology-regime-managed-plan-v1"),
                       lambda p: p.update(executionProfile="factorized_ecology_execution_v1"),
                       lambda p: p.update(formalSpecification={**auth.SPECIFICATION, "sha256": "0" * 64}),
                       lambda p: p.update(outputRoot=self.output + "-other"),
                       lambda p: p.update(trainingRestartAllowed=True)):
            plan = copy.deepcopy(self.plan)
            mutate(plan)
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                auth.validate_plan(self.store, plan, recompute_model=False)
        for mutate in (lambda p: p.update(packageIdentity="cross-package-76"),
                       lambda p: p.update(inputEvidence=p["inputEvidence"][:-1]),
                       lambda p: p["programLineage"].pop("worker"),
                       lambda p: p["phaseAdapters"]["execute"].update(sha256="0" * 64)):
            package = copy.deepcopy(self.package)
            mutate(package)
            b = self.store.put(self.package_binding["path"], package)
            with self.subTest(package=package["packageIdentity"]), self.assertRaises(ValueError):
                auth.load_execution_package(self.store, b, recompute_model=False)

    def test_roles_257_tamper_omission_and_wrong_initial_state_rejected(self):
        for change in ("omit", "tamper", "count"):
            programs = copy.deepcopy(self.programs)
            if change == "omit":
                programs.pop("frozen-source-0")
            elif change == "tamper":
                programs["worker"]["sha256"] = "0" * 64
            else:
                for i in range(257 - len(programs)):
                    programs["extra-" + str(i)] = programs["worker"]
            with self.subTest(change=change), self.assertRaises(ValueError):
                auth.verify_programs(self.store, programs)
        model = self.store.json(self.model_binding)
        model["initialState"]["generator"] = "0" * 64
        plan = {**self.plan, "modelBinding": self.store.put(self.model_binding["path"], model)}
        with self.assertRaises(ValueError):
            auth.verify_model(self.store, plan)

    def gpu(self):
        return {"schema": worker.GPU_SCHEMA, "status": "passed", "capabilityVersion": auth.CAPABILITY,
            "executionProfile": auth.PROFILE, "runId": self.plan["runId"], "packageId": self.plan["packageId"],
            "executionPackage": self.package_binding, "programBindings": self.programs,
            "actualCounts": {k + s: n for k, n in (("forward", 48), ("generator", 192), ("discriminator", 48)) for s in ("Attempted", "Completed")},
            "cases": [{"sampleId": sid, "passed": True, "proof": {"callCounts": {"generatorForwards": 1, "generatorAutograd": 4, "discriminatorAutograd": 1},
                "optimizerCreated": False, "optimizerUpdates": 0}} for sid in self.ids],
            "deviceIdentity": {"ordinal": 0, "uuid": "GPU-00000000-0000-0000-0000-000000000076"}, "optimizerSteps": 0,
            "checkpointLoaded": False, "checkpointWritten": False, "initialState": {"fixture": "a"}, "finalState": {"fixture": "a"},
            "initialCpuState": self.store.json(self.model_binding)["initialState"]}

    def test_own_gpu_full48_positive_and_missing_wrong_source_counts_updates(self):
        gpu = self.gpu()
        b = self.store.put(self.output + "/gpu-gate.json", gpu)
        self.assertEqual(worker.verify_gpu_gate(self.store, self.plan, self.package_binding, b), gpu)
        for mutate in (lambda g: g.update(schema="ecology-regime-all-train-gpu-gate-v1"),
                       lambda g: g.update(optimizerSteps=1), lambda g: g.update(cases=g["cases"][:-1]),
                       lambda g: g["actualCounts"].update(generatorCompleted=191),
                       lambda g: g.update(executionPackage={**self.package_binding, "sha256": "0" * 64}),
                       lambda g: g["programBindings"].pop("worker"),
                       lambda g: g["deviceIdentity"].update(ordinal=1),
                       lambda g: g["cases"][0]["proof"].update(optimizerUpdates=1)):
            gate = copy.deepcopy(gpu)
            mutate(gate)
            b = self.store.put(self.output + "/gpu-gate.json", gate)
            with self.subTest(gate=gate["schema"]), self.assertRaises(ValueError):
                worker.verify_gpu_gate(self.store, self.plan, self.package_binding, b)
        with self.assertRaises(ValueError):
            worker.verify_gpu_gate(self.store, self.plan, self.package_binding, {"path": self.output + "/missing-gpu.json", "sha256": "0" * 64})

    def test_partial_d_primary_error_and_complete576_terminal(self):
        error = RuntimeError("synthetic original G failure")
        error.actual_optimizer_counts = {"generator": 575, "discriminator": 576}
        error.completed_epochs = 12
        error.failure_position = {"epoch": 13, "zeroBasedEpochPosition": 23, "trainIndex": 0, "sampleId": self.ids[0]}
        error.ecology_failure_capture_receipt = {"status": "capture_incomplete", "primaryError": capture.primary_error(error),
            "secondaryCaptureFailure": {"type": "OSError", "message": "synthetic disk error"}}
        body = worker.terminal(error, None, self.package_binding, self.plan, None)
        self.assertEqual(body["optimizerSteps"], {"generator": 575, "discriminator": 576})
        self.assertEqual(body["originalError"], capture.primary_error(error))
        self.assertEqual(body["executionState"], "failed_closed")
        self.assertEqual(body["captureStatus"], "capture_incomplete")
        self.assertEqual(body["checkpoints"], [])
        body = worker.terminal(None, {"optimizerSteps": {"generator": 576, "discriminator": 576}, "completedEpochs": 12, "checkpoints": []}, self.package_binding, self.plan, None)
        self.assertEqual(body["captureStatus"], "capture_not_triggered")
        self.assertFalse(body["formalStage4QualificationAllowed"])
        error.actual_optimizer_counts["generator"] = 577
        with self.assertRaises(ValueError):
            worker.terminal(error, None, self.package_binding, self.plan, None)

    def test_captured_summary_or_conflicting_metadata_cannot_certify_scene(self):
        error = RuntimeError("synthetic primary")
        error.actual_optimizer_counts = {"generator": 1, "discriminator": 2}
        error.failure_position = {"epoch": 1}
        error.ecology_failure_capture_receipt = {"status": "captured", "primaryError": capture.primary_error(error), "artifacts": {}}
        body = worker.terminal(error, None, self.package_binding, self.plan, None)
        with self.assertRaises(ValueError):
            worker.verify_capture_terminal(self.store, body, self.plan)
        fake = {"context": {"optimizerSteps": {"generator": 2, "discriminator": 2}, "failurePosition": error.failure_position,
            "programBindings": self.programs, "modelBinding": self.model_binding}}
        with patch.object(capture, "verify_capture", return_value=(fake, {})), self.assertRaises(ValueError):
            worker.verify_capture_terminal(self.store, body, self.plan)

    def test_cpu_report_source_config_and_raw_calls_conflicts_rejected(self):
        request = {"schema": "ecology-decode1-weight-quality-cpu-request-v1", "runId": self.plan["runId"],
            "packageId": self.plan["packageId"], "outputRoot": self.output + "/cpu-entry",
            "modelIdentityOutput": self.model_binding["path"],
            "modelCapabilityVersion": "stage4_mvp256_dry_factorized_ecology_decode1_weight_precision_v1",
            **{key: self.plan[key] for key in ("programBindings", "configuration", "runtimeIdentity")}}
        raw = {"schema": worker.CPU_SCHEMA, "status": "passed", "passed": 20, "failed": 0, "errors": 0, "skipped": 0,
            "synthetic": True, "gpuInitialized": False,
            "actualCalls": {k: 0 for k in ("moduleForwardCalls", "autogradCalls", "optimizerConstructionAttempts", "optimizerUpdates", "cudaInitializationAttempts")},
            "items": [{"status": "passed"} for _ in range(20)],
            "initialModel": self.store.json(self.model_binding),
            **{key: self.plan[key] for key in ("programBindings", "configuration", "modelBinding", "runtimeIdentity")}}
        worker.verify_cpu_report(raw, request, self.plan)
        for mutate in (lambda r: r.update(passed=0), lambda r: r.update(gpuInitialized=True),
                       lambda r: r["actualCalls"].update(optimizerUpdates=1),
                       lambda r: r["programBindings"].pop("worker"),
                       lambda r: r["configuration"]["executionCeiling"].update(maxWallSeconds=4200)):
            changed = copy.deepcopy(raw)
            mutate(changed)
            with self.assertRaises(ValueError):
                worker.verify_cpu_report(changed, request, self.plan)

    def test_live_pid_creation_lock_heartbeat_and_registry_identity(self):
        context = auth.load_execution_package(self.store, self.package_binding, recompute_model=False)
        identity = {"capabilityVersion": auth.CAPABILITY, "runId": self.plan["runId"], "packageId": self.plan["packageId"],
            "processId": 12345, "processStartIdentity": "synthetic-current-creation"}
        lock = self.store.put(self.output + "/execution-lock.json", {"schemaVersion": "ai-painter-current-active-execution-lock-v1", **identity})
        heartbeat = {"schemaVersion": "ai-painter-current-active-execution-heartbeat-v1", **identity,
            "executionState": "executing", "ttlSeconds": 120, "heartbeatAtUtc": datetime.now(timezone.utc).isoformat()}
        self.store.put(self.output + "/heartbeat.json", heartbeat)
        registry = {"registryRevision": 1, "executionState": "executing", **{k: identity[k] for k in ("capabilityVersion", "runId", "packageId")},
            "activeExecution": {**identity, "executionState": "executing", "programLineage": self.programs, "lock": lock,
                "heartbeat": {"path": self.output + "/heartbeat.json", "ttlSeconds": 120}}}
        self.store.put(auth.REGISTRY, registry)
        with patch.object(auth, "process_identity", return_value=identity["processStartIdentity"]):
            self.assertEqual(auth.verify_live_context(context)["status"], "live_identity_authenticated_not_qualified")
        with patch.object(auth, "process_identity", return_value="reused-PID"), self.assertRaises(ValueError):
            auth.verify_live_context(context)
        bad = copy.deepcopy(registry)
        bad["activeExecution"]["runId"] = "cross-run-76"
        self.store.put(auth.REGISTRY, bad)
        with self.assertRaises(ValueError):
            auth.verify_live_context(context)

    def test_data_closure_drift_or_validation_pixels_claim_rejected(self):
        for mutate in (lambda v: v.update(validationRgbRead=True),
                       lambda v: v["bindings"][0].update(sha256="0" * 64),
                       lambda v: v["splitSampleIds"]["train"].reverse()):
            closure = copy.deepcopy(self.data_closure)
            mutate(closure)
            plan = {**self.plan, "dataClosure": self.store.put(self.output + "/data-closure.json", closure)}
            with self.assertRaises(ValueError):
                auth.verify_data_closure(self.store, plan, recompute=False)

    def test_actual_readonly_train_asset_and_validation_metadata_closure(self):
        started = time.monotonic()
        with self.assertRaisesRegex(ValueError, "live cpu_harness"):
            _install_live_closure(self, lambda: {"callerBoolean": True})
        self.assertIsNone(_consume_live_closure(copy.copy(self)))
        handoff = _consume_live_closure(self)
        mode = "same_live_harness_actual_closure" if handoff is not None else "independent_actual_derive"
        self.assertIsNone(_consume_component_preparation(copy.copy(self)))
        if handoff is None:
            handoff = _consume_component_preparation(self)
            if handoff is not None:
                mode = "same_component_actual_production_recompute"
        _cpu_phase("closure.test.start", started, mode=mode)
        with handoff if handoff is not None else nullcontext(auth.derive_data_closure(ROOT)) as closure:
            self.assertEqual(closure["metadataCounts"], {"train": 48, "validation": 8})
            self.assertEqual(closure["splitSampleIds"]["train"], self.ids)
            self.assertGreater(len(closure["bindings"]), 48 * 23)
            self.assertFalse(closure["validationRgbRead"])
            self.assertFalse(closure["challengeContentRead"])
            self.assertFalse(closure["regressionContentRead"])
        elapsed = time.monotonic() - started
        _cpu_phase("closure.test.done", started, mode=mode, bindings=len(closure["bindings"]))
        measurement_output = os.environ.get("T_Q4_80_CLOSURE_REPORT")
        if measurement_output:
            # This opt-in evidence goes only to the current private CPU batch.
            with Path(measurement_output).open("x", encoding="utf8") as stream:
                json.dump({"taskId": os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_TASK_ID", "component-cpu"), "status": "complete_readonly_closure_not_admission",
                    "wallSeconds": elapsed, "bindingCount": len(closure["bindings"]), "derivationMode": mode,
                    "metadataCounts": closure["metadataCounts"], "splitSampleCounts": {k: len(v) for k, v in closure["splitSampleIds"].items()},
                    "policy": {k: closure[k] for k in ("validationRgbRead", "challengeContentRead", "regressionContentRead")},
                    "qualified": False}, stream)

    def test_existing_large_source_json_keeps_sha_and_control_ceiling(self):
        from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
        reader = auth.Reader(ROOT)
        rows = reader.json(DIAGNOSTIC)["rows"]
        sources = [r["identity"]["taskPackage"] for r in rows if r["split"] in ("train", "validation")]
        large = [b for b in sources if reader.path(b["path"]).stat().st_size > auth.CONTROL_JSON_MAX]
        self.assertEqual(len(sources), 56)
        self.assertEqual(len(large), 2)
        for binding in large:
            self.assertLessEqual(reader.path(binding["path"]).stat().st_size, auth.SOURCE_JSON_MAX)
            self.assertIn("sourceBindings", reader.json(binding))
            self.assertEqual(reader.observed[binding["path"]], binding["sha256"])
            with self.assertRaises(ValueError):
                auth.read_json(reader, binding)
            with self.assertRaises(ValueError):
                reader.json({**binding, "sha256": "0" * 64})
        reader.unchanged()

    def test_source_json_eight_mib_boundary_and_strict_decoder(self):
        # In-memory bytes only: no large fixture consumes the shared disk budget.
        raw = b"{}" + b" " * (auth.SOURCE_JSON_MAX - 2)
        self.assertEqual(auth.decode_source_json(raw), {})
        with self.assertRaises(ValueError):
            auth.decode(raw)
        with self.assertRaises(ValueError):
            auth.decode_source_json(raw + b" ")
        for raw in (b'{"nested":{"key":1,"key":2}}', b'{"n":NaN}', b'{"n":Infinity}',
                    b'{"n":-Infinity}', b'{"n":1e400}'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                auth.decode_source_json(raw)
        self.assertEqual(auth.decode_source_json(b'{"n":1.25,"a":[true,null]}'), {"n": 1.25, "a": [True, None]})
        with self.assertRaises(ValueError):
            auth.decode(b"{}" + b" " * (auth.CONTROL_JSON_MAX - 1))
        self.assertEqual(capture.MAX_CAPTURE, 64 * 1024**2)


_COMPONENT_PRIVATE_ROOT = ".runtime/ai-painter/controller-parallel-20261011/training-cpu-negative-inputs/quality-v1-t-qv12-01"
_TEST_JUNCTION_REMOVE = os.rmdir
_TEST_JUNCTION_READLINK = os.readlink
_CPU_OBSERVATION_CLOCK = time.monotonic
_CPU_OBSERVATION_PAUSE = time.sleep


class _FixtureWindowsMetadata:
    """Read-only identity queries on one no-follow metadata handle, fixtures only."""
    class FullIdentity(ctypes.Structure):
        _fields_ = [("volume", ctypes.c_uint64), ("file", ctypes.c_ubyte * 16)]

    class LegacyIdentity(ctypes.Structure):
        _fields_ = [("attributes", wintypes.DWORD), ("creation", wintypes.FILETIME),
            ("access", wintypes.FILETIME), ("write", wintypes.FILETIME), ("volume", wintypes.DWORD),
            ("sizeHigh", wintypes.DWORD), ("sizeLow", wintypes.DWORD), ("links", wintypes.DWORD),
            ("indexHigh", wintypes.DWORD), ("indexLow", wintypes.DWORD)]

    class AttributeTag(ctypes.Structure):
        _fields_ = [("attributes", wintypes.DWORD), ("tag", wintypes.DWORD)]

    def __init__(self):
        self.kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        self.kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
            ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        self.kernel.CreateFileW.restype = wintypes.HANDLE
        self.kernel.GetFileInformationByHandle.argtypes = [wintypes.HANDLE, ctypes.POINTER(self.LegacyIdentity)]
        self.kernel.GetFileInformationByHandle.restype = wintypes.BOOL
        self.kernel.GetFileInformationByHandleEx.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        self.kernel.GetFileInformationByHandleEx.restype = wintypes.BOOL
        self.kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        self.kernel.CloseHandle.restype = wintypes.BOOL

    def open(self, path):
        # FILE_READ_ATTRIBUTES, SHARE_READ|WRITE|DELETE, OPEN_EXISTING;
        # BACKUP_SEMANTICS|OPEN_REPARSE_POINT inspects a junction itself.
        handle = self.kernel.CreateFileW(str(path), 0x80, 7, None, 3, 0x02200000, None)
        if handle == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        return handle

    def read(self, handle):
        full, legacy, tag = self.FullIdentity(), self.LegacyIdentity(), self.AttributeTag()
        for kind, value in ((18, full), (9, tag)):
            if not self.kernel.GetFileInformationByHandleEx(handle, kind, ctypes.byref(value), ctypes.sizeof(value)):
                raise ctypes.WinError(ctypes.get_last_error())
        if not self.kernel.GetFileInformationByHandle(handle, ctypes.byref(legacy)):
            raise ctypes.WinError(ctypes.get_last_error())
        auth.require(legacy.attributes == tag.attributes, "fixture handle attributes differ")
        return {"python": (int(full.volume), int.from_bytes(bytes(full.file), "little")),
            "node": (int(legacy.volume), (int(legacy.indexHigh) << 32) | int(legacy.indexLow)),
            "attributes": int(tag.attributes), "tag": int(tag.tag)}

    def close(self, handle):
        if not self.kernel.CloseHandle(handle):
            raise ctypes.WinError(ctypes.get_last_error())


_FIXTURE_WINDOWS_API = _FixtureWindowsMetadata() if os.name == "nt" else None


def _fixture_dual_identity(reader, base, path, expected=None):
    """Verify both complete identities from the same actual, scoped Windows object."""
    owned = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
    if owned:
        auth.require(owned.startswith(auth.ROOT_PREFIX) and owned.endswith("/cpu-entry") and
            base == owned.rsplit("/", 1)[0] + "/cpu-negative-inputs", "exact owned identity scope required")
    else:
        auth.require(os.environ.get("T_Q4_90_PRIVATE_ROOT") == _COMPONENT_PRIVATE_ROOT and
            base == _COMPONENT_PRIVATE_ROOT + "/cpu-negative-inputs", "exact component identity scope required")
    reader.mapping.check()
    runtime = reader.root / ".runtime"
    allowed = {reader.root, runtime, reader.mapping.physical_runtime, reader.path(base)}
    junctions = {runtime}
    for slot in _negative_observation_layout(base)["links"]:
        parent = reader.path(slot["path"].rsplit("/", 1)[0])
        link = parent / slot["path"].rsplit("/", 1)[1]
        allowed.update((parent, link, reader.path(slot["target"])))
        junctions.add(link)
    auth.require(type(path) is type(reader.root) and path.is_absolute() and path in allowed and
        _FIXTURE_WINDOWS_API is not None, "unsupported or out-of-scope fixture identity")
    before = path.lstat()
    identity = capture._file_identity(before)
    auth.require(expected is None or identity == expected, "fixture full Python capture differs")
    reparse = path in junctions
    auth.require(bool(getattr(before, "st_file_attributes", 0) & 0x400) == reparse and
        (getattr(before, "st_reparse_tag", 0) == 0xA0000003 if reparse else auth.stat.S_ISDIR(before.st_mode)),
        "fixture actual path kind differs")
    handle = _FIXTURE_WINDOWS_API.open(path)
    try:
        actual = _FIXTURE_WINDOWS_API.read(handle)
        auth.require(actual["python"] == (before.st_dev, before.st_ino) and
            actual["python"][0] > 0 and actual["python"][1] > 0 and actual["node"][0] > 0 and
            actual["node"][1] == actual["python"][1], "fixture full handle/path identity differs or unsupported")
        auth.require(bool(actual["attributes"] & 0x10) and bool(actual["attributes"] & 0x400) == reparse and
            actual["tag"] == (0xA0000003 if reparse else 0), "fixture handle reparse kind differs")
        auth.require(capture._file_identity(path.lstat()) == identity and
            _FIXTURE_WINDOWS_API.read(handle) == actual, "fixture path/handle changed during identity query")
        return {"pythonIdentity": str(actual["python"][0]) + ":" + str(actual["python"][1]),
            "nodeIdentity": str(actual["node"][0]) + ":" + str(actual["node"][1])}
    finally:
        _FIXTURE_WINDOWS_API.close(handle)


def _ordinary_test_directory_identity(path):
    info = path.lstat()
    auth.require(path.is_absolute() and auth.stat.S_ISDIR(info.st_mode) and
        not getattr(info, "st_file_attributes", 0) & 0x400, "fixture ordinary directory required")
    return info.st_dev, info.st_ino


def _test_junction_target_matches(link, target):
    actual = _TEST_JUNCTION_READLINK(link)
    if actual.startswith("\\\\?\\"):
        actual = actual[4:]
    return actual == str(target)  # Exact declared path, without following the link.


def _record_created_test_junction(link, target, private_root, result):
    """Capture only the successful creation's validated current file identity."""
    auth.require(result.returncode == 0, "fixture junction creation failed; unknown link retained")
    auth.require(link.is_absolute() and target.is_absolute() and link.parent.is_relative_to(private_root) and
        target.is_relative_to(private_root), "fixture junction outside private root")
    directories = {}
    for child in (link.parent, target):
        current = child
        while True:
            directories[current] = _ordinary_test_directory_identity(current)
            if current == private_root:
                break
            auth.require(current.is_relative_to(private_root), "fixture directory outside private root")
            current = current.parent
    info = link.lstat()
    auth.require(getattr(info, "st_file_attributes", 0) & 0x400 and
        getattr(info, "st_reparse_tag", 0) == 0xA0000003, "actual directory junction required")
    auth.require(_test_junction_target_matches(link, target), "fixture junction target differs")
    identity = capture._file_identity(info)
    auth.require(capture._file_identity(link.lstat()) == identity, "fixture junction changed during capture")
    return {"linkIdentity": identity, "directories": tuple(directories.items())}


def _remove_created_test_junction(link, target, private_root, record):
    if record is None:
        return False  # No successful validated creation: do not inspect or remove it.
    auth.require(link.is_absolute() and target.is_absolute() and link.parent.is_relative_to(private_root) and
        target.is_relative_to(private_root), "fixture cleanup outside private root")
    for directory, identity in record["directories"]:
        auth.require(_ordinary_test_directory_identity(directory) == identity, "fixture directory identity changed; retained")
    info = link.lstat()
    auth.require(capture._file_identity(info) == record["linkIdentity"], "fixture link identity changed; unknown link retained")
    auth.require(getattr(info, "st_file_attributes", 0) & 0x400 and
        getattr(info, "st_reparse_tag", 0) == 0xA0000003 and _test_junction_target_matches(link, target), "fixture cleanup redirect differs; retained")
    auth.require(capture._file_identity(link.lstat()) == record["linkIdentity"], "fixture link changed before cleanup; retained")
    _TEST_JUNCTION_REMOVE(link)  # Nonrecursive removal of this same validated link only.
    return True


def _negative_input_fixture(name):
    """Fixed input paths only; this function grants no parent meter permission."""
    owned = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
    if owned:
        auth.require(owned.startswith(auth.ROOT_PREFIX) and owned.endswith("/cpu-entry"), "exact current CPU output")
        run_root = owned.rsplit("/", 1)[0]
    else:
        run_root = os.environ.get("T_Q4_90_PRIVATE_ROOT")
        auth.require(run_root == _COMPONENT_PRIVATE_ROOT, "exact T110 component input root")
    base = run_root + "/cpu-negative-inputs"
    layouts = {"reader": ("reader-link", "reader-target"), "snapshot": ("snapshot-link", "snapshot-target"),
        "program": ("program-project/scripts/lib", "program-target")}
    reader = auth.Reader(ROOT)
    for logical in (base, *(base + "/" + value[1] for value in layouts.values()),
                    base + "/program-project/scripts", base + "/program-data/hot/runtime"):
        reader.path(logical).mkdir(parents=True, exist_ok=True)
    link, target = layouts[name]
    return base, reader.path(base + "/" + link), reader.path(base + "/" + target)


def _negative_observation_layout(base):
    return {"root": base, "links": [
        {"name": "reader", "path": base + "/reader-link", "target": base + "/reader-target"},
        {"name": "snapshot", "path": base + "/snapshot-link", "target": base + "/snapshot-target"},
        {"name": "program", "path": base + "/program-project/scripts/lib", "target": base + "/program-target"}]}


def _read_negative_observation_json(reader, logical):
    path = reader.path(logical)
    before = path.lstat()
    auth.require(auth.stat.S_ISREG(before.st_mode) and not getattr(before, "st_file_attributes", 0) & 0x400 and
        0 <= before.st_size <= auth.CONTROL_JSON_MAX, "ordinary bounded CPU observation JSON required")
    with path.open("rb") as stream:
        raw = stream.read(before.st_size + 1)
    auth.require(len(raw) == before.st_size, "CPU observation bytes changed")
    binding = {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}
    auth.require(reader.mapping.binding(binding, maximum=before.st_size) == raw and
        capture._file_identity(reader.path(logical).lstat()) == capture._file_identity(before), "CPU observation file changed")
    value = auth.decode(raw)
    auth.require(type(value) is dict, "CPU observation object required")
    return value, binding


def _wait_negative_observation(reader, logical, deadline):
    while True:
        auth.require(_CPU_OBSERVATION_CLOCK() < deadline, "current parent CPU link observation deadline")
        try:
            reader.path(logical).lstat()  # Do not follow a receipt redirect to test existence.
        except FileNotFoundError:
            _CPU_OBSERVATION_PAUSE(.025)
            continue
        return _read_negative_observation_json(reader, logical)


def _validate_negative_observation(value, declaration, name, base, identity, created_seconds):
    """A synchronization record only; neither schema can mint native authority."""
    schemas = {"cpu-negative-input-declaration-v1": "cpu-negative-input-live-observation-v1",
        "cpu-negative-input-component-declaration-v1": "cpu-negative-input-component-live-observation-v1"}
    auth.require(declaration.get("schema") in schemas and declaration.get("layout") == _negative_observation_layout(base),
        "current CPU observation declaration/layout differs")
    slots = [slot for slot in declaration["layout"]["links"] if slot["name"] == name]
    auth.require(len(slots) == 1 and type(value) is dict and set(value) ==
        {"schema", "callIdentity", "request", "link", "observedAtUtc"}, "exact CPU observation fields required")
    auth.require(value["schema"] == schemas[declaration["schema"]] and
        type(declaration.get("callIdentity")) is str and bool(declaration["callIdentity"]) and
        value["callIdentity"] == declaration["callIdentity"] and
        auth.exact_binding(value["request"]) == auth.exact_binding(declaration["request"]),
        "current retained parent call/request differs")
    link = value["link"]
    auth.require(type(link) is dict and set(link) == {"name", "path", "target", "observedIdentity", "present"} and
        all(link.get(k) == v for k, v in slots[0].items()) and link["present"] is True and
        link["observedIdentity"] == identity, "current retained parent link identity/path/target differs")
    stamp = datetime.fromisoformat(value["observedAtUtc"].replace("Z", "+00:00"))
    auth.require(stamp.tzinfo is not None and -5 <= (datetime.now(timezone.utc) - stamp).total_seconds() <= 10 and
        stamp.timestamp() >= created_seconds - .002, "current parent CPU observation stale/future")


def _current_negative_link(reader, name, base, record):
    auth.require(type(record) is dict and set(record) == {"linkIdentity", "directories"}, "successful current junction capture required")
    slot = next((v for v in _negative_observation_layout(base)["links"] if v["name"] == name), None)
    auth.require(slot is not None, "exact CPU observation slot required")
    private_root = reader.path(base).resolve()
    # Reader.path intentionally rejects the negative link; locate it from its ordinary parent.
    link = reader.path(slot["path"].rsplit("/", 1)[0]) / slot["path"].rsplit("/", 1)[1]
    target = reader.path(slot["target"])
    auth.require(link.is_absolute() and target.is_absolute() and link.parent.is_relative_to(private_root) and
        target.is_relative_to(private_root), "CPU observation outside private root")
    auth.require(type(record["linkIdentity"]) is tuple and len(record["linkIdentity"]) == 5 and
        type(record["directories"]) is tuple and {private_root, link.parent, target} <=
        {directory for directory, identity in record["directories"]}, "CPU observation captured directory identities required")
    for directory, expected in record["directories"]:
        auth.require(_ordinary_test_directory_identity(directory) == expected, "CPU observation directory identity changed")
    info = link.lstat()
    auth.require(capture._file_identity(info) == record["linkIdentity"] and
        getattr(info, "st_file_attributes", 0) & 0x400 and getattr(info, "st_reparse_tag", 0) == 0xA0000003 and
        _test_junction_target_matches(link, target), "CPU observation actual link identity/target changed")
    auth.require(capture._file_identity(link.lstat()) == record["linkIdentity"], "CPU observation link changed during validation")
    return info


def _negative_formal_mapping(reader, base):
    reader.mapping.check()
    def identity(path):
        return _fixture_dual_identity(reader, base, path)["nodeIdentity"]
    runtime = reader.root / ".runtime"
    return {"projectPhysical": str(reader.root.resolve()), "projectIdentity": identity(reader.root),
        "runtimeIdentity": identity(runtime), "physicalRuntime": str(reader.mapping.physical_runtime),
        "physicalRuntimeIdentity": identity(reader.mapping.physical_runtime), "physicalInputRoot": str(reader.path(base))}


def _observe_negative_link(name, base, creation_record):
    reader = auth.Reader(ROOT)
    deadline = _CPU_OBSERVATION_CLOCK() + 10
    owned = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
    declaration, declaration_binding = _read_negative_observation_json(reader, base + "/input-declaration.json")
    if owned:
        auth.require(owned.startswith(auth.ROOT_PREFIX) and owned.endswith("/cpu-entry") and
            base == owned.rsplit("/", 1)[0] + "/cpu-negative-inputs" and
            declaration.get("schema") == "cpu-negative-input-declaration-v1", "exact owned CPU observation declaration")
        expected_request = auth.exact_binding({"path": sys.argv[sys.argv.index("--cpu-request") + 1],
            "sha256": sys.argv[sys.argv.index("--sha256") + 1]})
        auth.require(expected_request["path"] == owned.rsplit("/", 1)[0] + "/cpu-request.json", "exact owned request path")
        receipt_root = owned
    else:
        auth.require(os.environ.get("T_Q4_90_PRIVATE_ROOT") == _COMPONENT_PRIVATE_ROOT and
            base == _COMPONENT_PRIVATE_ROOT + "/cpu-negative-inputs" and
            declaration.get("schema") == "cpu-negative-input-component-declaration-v1" and
            declaration.get("callIdentity") == os.environ.get("T_Q4_112_COMPONENT_CALL") and
            bool(declaration.get("callIdentity")), "exact current component observation declaration")
        expected_request = auth.exact_binding(json.loads(os.environ["T_Q4_112_COMPONENT_REQUEST"]))
        auth.require(expected_request["path"] == _COMPONENT_PRIVATE_ROOT + "/component-request.json", "exact component request path")
        receipt_root = _COMPONENT_PRIVATE_ROOT
    auth.require(declaration.get("request") == expected_request and declaration.get("layout") == _negative_observation_layout(base) and
        declaration.get("formalMapping") == _negative_formal_mapping(reader, base) and
        declaration.get("linkMetadataReserveBytes") == 49152 and declaration.get("reserveIsMeasurement") is False,
        "current CPU declaration request/mapping/reserve differs")
    request = auth.read_json(reader, expected_request)
    if owned:
        auth.require(request.get("schema") == "ecology-decode1-weight-quality-cpu-request-v1" and
            request.get("outputRoot") == owned and declaration.get("runId") == request.get("runId") and
            declaration.get("packageId") == request.get("packageId"), "current owned request identity differs")
    else:
        auth.require(request.get("schema") == "cpu-negative-input-component-request-v1" and request.get("taskId") == "T-QV12-01" and
            request.get("outputRoot") == _COMPONENT_PRIVATE_ROOT and request.get("nativeOwnerAllowed") is False and
            request.get("callIdentity") == declaration["callIdentity"],
            "component record cannot be native request")
    auth.require(request.get("formalSpecification") == auth.SPECIFICATION and
        declaration.get("programBindings") == request.get("programBindings"), "current CPU observation source declaration differs")
    auth.verify_programs(reader, request["programBindings"])
    info = _current_negative_link(reader, name, base, creation_record)
    slot = next(v for v in _negative_observation_layout(base)["links"] if v["name"] == name)
    link = reader.path(slot["path"].rsplit("/", 1)[0]) / slot["path"].rsplit("/", 1)[1]
    dual = _fixture_dual_identity(reader, base, link, creation_record["linkIdentity"])
    value, receipt_binding = _wait_negative_observation(reader, receipt_root + "/negative-observation-" + name + ".json", deadline)
    _validate_negative_observation(value, declaration, name, base, dual["nodeIdentity"], info.st_ctime_ns / 1e9)
    _current_negative_link(reader, name, base, creation_record)
    auth.require(_fixture_dual_identity(reader, base, link, creation_record["linkIdentity"]) == dual,
        "fixture dual identity changed after parent acknowledgement")
    reader.read(declaration_binding, auth.CONTROL_JSON_MAX)
    auth.require(_CPU_OBSERVATION_CLOCK() < deadline, "current parent CPU link observation deadline")
    if not owned:
        with reader.path(_COMPONENT_PRIVATE_ROOT + "/negative-measure-" + name + ".json").open("xb") as stream:
            stream.write(capture.json_bytes({"schema": "component-child-observation-consumed-v1", "declaration": declaration_binding,
                "receipt": receipt_binding, "actualLinkIdentity": str(info.st_dev) + ":" + str(info.st_ino),
                "sameHandleIdentities": dual,
                "nativeAuthorityClaimed": False}))


class WindowsFixtureIdentityCpuTests(unittest.TestCase):
    def setUp(self):
        self.reader = auth.Reader(ROOT)
        self.base, _, self.target = _negative_input_fixture("reader")

    def test_actual_formal_mapping_matches_current_node_and_preserves_full_python_identity(self):
        declaration, _ = _read_negative_observation_json(self.reader, self.base + "/input-declaration.json")
        self.assertEqual(_negative_formal_mapping(self.reader, self.base), declaration["formalMapping"])
        for path in (self.reader.root, self.reader.root / ".runtime", self.reader.mapping.physical_runtime, self.target):
            before = capture._file_identity(path.lstat())
            dual = _fixture_dual_identity(self.reader, self.base, path, before)
            self.assertEqual(dual["pythonIdentity"], str(before[0]) + ":" + str(before[1]))
            self.assertEqual(capture._file_identity(path.lstat()), before)
            self.assertNotEqual(dual["pythonIdentity"], dual["nodeIdentity"])

    def test_full_volume_mismatch_fails_even_with_same_legacy_node_identity(self):
        original = _FIXTURE_WINDOWS_API.read
        def changed(handle):
            actual = original(handle)
            return {**actual, "python": (actual["python"][0] + 2**32, actual["python"][1])}
        with patch.object(_FIXTURE_WINDOWS_API, "read", side_effect=changed), \
            patch.object(_FIXTURE_WINDOWS_API, "close", wraps=_FIXTURE_WINDOWS_API.close) as close:
            with self.assertRaisesRegex(ValueError, "full handle/path"):
                _fixture_dual_identity(self.reader, self.base, self.target)
            close.assert_called_once()

    def test_full_128bit_file_mismatch_fails_even_with_same_legacy_file_index(self):
        original = _FIXTURE_WINDOWS_API.read
        def changed(handle):
            actual = original(handle)
            return {**actual, "python": (actual["python"][0], actual["python"][1] + 2**64)}
        with patch.object(_FIXTURE_WINDOWS_API, "read", side_effect=changed), \
            patch.object(_FIXTURE_WINDOWS_API, "close", wraps=_FIXTURE_WINDOWS_API.close) as close:
            with self.assertRaisesRegex(ValueError, "full handle/path"):
                _fixture_dual_identity(self.reader, self.base, self.target)
            close.assert_called_once()

    def test_unsupported_query_preserves_actual_error_and_closes_single_handle(self):
        error = OSError(50, "synthetic unsupported FileIdInfo")
        with patch.object(_FIXTURE_WINDOWS_API, "open", wraps=_FIXTURE_WINDOWS_API.open) as opened, \
            patch.object(_FIXTURE_WINDOWS_API, "read", side_effect=error), \
            patch.object(_FIXTURE_WINDOWS_API, "close", wraps=_FIXTURE_WINDOWS_API.close) as close:
            with self.assertRaises(OSError) as caught:
                _fixture_dual_identity(self.reader, self.base, self.target)
            self.assertIs(caught.exception, error)
            opened.assert_called_once_with(self.target)
            close.assert_called_once()

    def test_actual_path_after_query_change_fails_and_closes_handle(self):
        original_read, original_lstat = _FIXTURE_WINDOWS_API.read, type(self.target).lstat
        after_query = False
        def read(handle):
            nonlocal after_query
            result = original_read(handle)
            after_query = True
            return result
        def lstat(path, *args, **kwargs):
            result = original_lstat(path, *args, **kwargs)
            return _NegativeSizeStatProxy(result, result.st_size + 1) if after_query and path == self.target else result
        with patch.object(_FIXTURE_WINDOWS_API, "read", side_effect=read), \
            patch.object(type(self.target), "lstat", new=lstat), \
            patch.object(_FIXTURE_WINDOWS_API, "close", wraps=_FIXTURE_WINDOWS_API.close) as close:
            with self.assertRaisesRegex(ValueError, "path/handle changed"):
                _fixture_dual_identity(self.reader, self.base, self.target)
            close.assert_called_once()

    def test_unknown_path_or_platform_never_opens_a_handle(self):
        with patch.object(_FIXTURE_WINDOWS_API, "open", wraps=_FIXTURE_WINDOWS_API.open) as opened:
            with self.assertRaisesRegex(ValueError, "out-of-scope"):
                _fixture_dual_identity(self.reader, self.base, self.reader.root / "docs")
            opened.assert_not_called()
        with patch(__name__ + "._FIXTURE_WINDOWS_API", None), self.assertRaisesRegex(ValueError, "unsupported"):
            _fixture_dual_identity(self.reader, self.base, self.target)

    def test_first_actual_exception_is_immediate_bounded_and_original_error_retained(self):
        result = unittest.TextTestRunner(stream=io.StringIO(), verbosity=2, resultclass=_TimedCpuResult)._makeResult()
        try:
            raise ValueError("synthetic diagnostic " + "界" * 5000)
        except ValueError:
            actual = sys.exc_info()
        with patch("sys.stderr", new_callable=io.StringIO) as output:
            result.addError(self, actual)
            first = output.getvalue()
            self.assertLessEqual(len(first.encode("utf8")), 4096)
            self.assertIn("cpu-first-exception-v1", first)
            self.assertIn("Traceback", first)
            self.assertIn("truncated", first)
            result.addError(self, actual)
            self.assertEqual(output.getvalue(), first)
        self.assertEqual(len(result.errors), 2)
        self.assertIn("界" * 5000, result.errors[0][1])


class ComponentPreparationBoundaryCpuTests(unittest.TestCase):
    def test_arbitrary_provider_and_result_caller_cannot_install_preparation(self):
        with self.assertRaisesRegex(ValueError, "exact actual production preparation provider"):
            _publish_component_preparation(auth.Reader(ROOT), {"prepared": True}, {"bindings": []})
        result = unittest.TextTestRunner(stream=io.StringIO(), resultclass=_TimedCpuResult)._makeResult()
        for function, args in ((_component_preparation_begin, (result,)),
            (_component_preparation_enter, (result, self)), (_component_preparation_end, (result,))):
            with self.subTest(function=function.__name__), self.assertRaisesRegex(ValueError, "exact live CPU result caller"):
                function(*args)

    def test_unregistered_consumer_and_exact_looking_marker_cannot_consume(self):
        self.assertIsNone(_consume_component_preparation(self))
        self.assertIsNone(_consume_component_preparation(copy.copy(self)))
        marker = types.SimpleNamespace(prepared=True, root=_COMPONENT_PRIVATE_ROOT, pid=os.getpid(),
            thread=threading.get_ident(), nativeAuthorityClaimed=False)
        self.assertIsNone(_consume_component_preparation(marker))


class CpuObservationSynchronizationCpuTests(unittest.TestCase):
    """Synthetic fault records and link metadata; real junction positives remain in the original three tests."""
    def setUp(self):
        self.base = "synthetic-current-observation-base"
        self.identity = "123:456"
        self.created = datetime.now(timezone.utc).timestamp() - .1
        self.declaration = {"schema": "cpu-negative-input-component-declaration-v1", "callIdentity": "synthetic-current-call-106",
            "request": {"path": "synthetic-current-request.json", "sha256": "a" * 64},
            "layout": _negative_observation_layout(self.base)}
        self.value = {"schema": "cpu-negative-input-component-live-observation-v1", "callIdentity": self.declaration["callIdentity"],
            "request": dict(self.declaration["request"]), "link": {**self.declaration["layout"]["links"][0],
                "present": True, "observedIdentity": self.identity}, "observedAtUtc": datetime.now(timezone.utc).isoformat()}

    def validate(self, value=None, declaration=None):
        _validate_negative_observation(self.value if value is None else value, self.declaration if declaration is None else declaration,
            "reader", self.base, self.identity, self.created)

    def test_exact_component_and_native_records_validate_as_observations_only(self):
        self.validate()
        declaration = {**self.declaration, "schema": "cpu-negative-input-declaration-v1"}
        value = {**self.value, "schema": "cpu-negative-input-live-observation-v1"}
        self.validate(value, declaration)
        self.assertEqual(set(value), {"schema", "callIdentity", "request", "link", "observedAtUtc"})
        self.assertNotIn("cleanupConfirmed", value)

    def test_wrong_call_request_schema_and_layout_fail(self):
        mutations = [lambda v: v.update(callIdentity="synthetic-old-call"),
            lambda v: v["request"].update(sha256="b" * 64), lambda v: v["request"].update(path="other-request.json"),
            lambda v: v.update(schema="cpu-negative-input-live-observation-v1")]
        for mutate in mutations:
            value = copy.deepcopy(self.value)
            mutate(value)
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.validate(value)
        declaration = copy.deepcopy(self.declaration)
        declaration["layout"]["links"][0]["target"] = "other-target"
        with self.assertRaisesRegex(ValueError, "layout"):
            self.validate(declaration=declaration)

    def test_wrong_name_path_target_presence_and_actual_identity_fail(self):
        for key, value in (("name", "snapshot"), ("path", "other-link"), ("target", "external-target"),
            ("present", False), ("present", 1), ("observedIdentity", "123:457"), ("observedIdentity", None)):
            wrong = copy.deepcopy(self.value)
            wrong["link"][key] = value
            with self.subTest(key=key, value=value), self.assertRaisesRegex(ValueError, "identity/path/target"):
                self.validate(wrong)

    def test_old_future_timezone_free_and_precreation_observations_fail(self):
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        for stamp in ((now - timedelta(seconds=11)).isoformat(), (now + timedelta(seconds=6)).isoformat(),
            now.replace(tzinfo=None).isoformat(), (now - timedelta(seconds=1)).isoformat()):
            with self.subTest(stamp=stamp), self.assertRaisesRegex(ValueError, "stale/future"):
                self.validate({**self.value, "observedAtUtc": stamp})

    def test_missing_observation_times_out_at_original_deadline_without_real_delay(self):
        missing = types.SimpleNamespace(lstat=unittest.mock.Mock(side_effect=FileNotFoundError(2, "synthetic missing ack")))
        reader = types.SimpleNamespace(path=lambda logical: missing)
        with patch.object(sys.modules[__name__], "_CPU_OBSERVATION_CLOCK", side_effect=[0, 10]), patch.object(sys.modules[__name__], "_CPU_OBSERVATION_PAUSE") as pause, self.assertRaisesRegex(ValueError, "deadline"):
            _wait_negative_observation(reader, "synthetic-current-ack.json", 10)
        self.assertEqual(missing.lstat.call_count, 1)
        pause.assert_called_once_with(.025)

    def test_current_link_replacement_target_and_directory_changes_refuse(self):
        root = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT") or os.environ.get("T_Q4_90_PRIVATE_ROOT")
        self.assertTrue(root == _COMPONENT_PRIVATE_ROOT or (root.startswith(auth.ROOT_PREFIX) and root.endswith("/cpu-entry")))
        private = auth.Reader(ROOT).path(root + "/observation-fixtures/current-identity")
        target = private / "reader-target"
        target.mkdir(parents=True)
        preserved = target / "preserved.bin"
        preserved.write_bytes(b"actual ordinary target")
        link = private / "reader-link"
        actual = target.lstat()
        info = types.SimpleNamespace(st_dev=actual.st_dev, st_ino=actual.st_ino + 9000000,
            st_size=0, st_mtime_ns=1, st_ctime_ns=1, st_file_attributes=0x400, st_reparse_tag=0xA0000003)
        record = {"linkIdentity": capture._file_identity(info), "directories": tuple((p, _ordinary_test_directory_identity(p)) for p in (private, target))}
        reader = types.SimpleNamespace(path=lambda logical: target if logical.endswith("/reader-target") else private)
        original_lstat = Path.lstat
        def synthetic_lstat(path, *args, **kwargs):
            return info if path == link else original_lstat(path, *args, **kwargs)
        with patch.object(Path, "lstat", synthetic_lstat), patch.object(sys.modules[__name__], "_TEST_JUNCTION_READLINK", return_value=str(target)):
            self.assertIs(_current_negative_link(reader, "reader", self.base, record), info)
            info.st_ino += 1
            with self.assertRaisesRegex(ValueError, "actual link"):
                _current_negative_link(reader, "reader", self.base, record)
            info.st_ino -= 1
            changed = {**record, "directories": ((private, (actual.st_dev, private.lstat().st_ino + 1)),)}
            with self.assertRaisesRegex(ValueError, "directory identit"):
                _current_negative_link(reader, "reader", self.base, changed)
        with patch.object(Path, "lstat", synthetic_lstat), patch.object(sys.modules[__name__], "_TEST_JUNCTION_READLINK", return_value=str(private)), self.assertRaisesRegex(ValueError, "actual link"):
            _current_negative_link(reader, "reader", self.base, record)
        self.assertEqual(preserved.read_bytes(), b"actual ordinary target")
        self.assertFalse(link.exists())


class JunctionCleanupIdentityCpuTests(unittest.TestCase):
    """Real ordinary target bytes; explicitly synthetic link identity negatives."""
    def setUp(self):
        owned = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
        if owned:
            auth.require(owned.startswith(auth.ROOT_PREFIX) and owned.endswith("/cpu-entry"), "current cleanup CPU fixture")
            logical = owned + "/cleanup-fixtures/" + self._testMethodName
        else:
            auth.require(os.environ.get("T_Q4_90_PRIVATE_ROOT") == _COMPONENT_PRIVATE_ROOT, "current component cleanup fixture")
            logical = _COMPONENT_PRIVATE_ROOT + "/cleanup-fixtures/" + self._testMethodName
        self.private_root = auth.Reader(ROOT).path(logical)
        self.private_root.mkdir(parents=True)
        self.target = self.private_root / "target"
        self.target.mkdir()
        self.target_file = self.target / "preserved.bin"
        self.target_file.write_bytes(b"actual-target-bytes")
        info = self.target.lstat()
        self.link_stat = types.SimpleNamespace(st_dev=info.st_dev, st_ino=info.st_ino + 9000000,
            st_size=0, st_mtime_ns=1, st_ctime_ns=1, st_file_attributes=0x400, st_reparse_tag=0xA0000003)
        self.link = types.SimpleNamespace(is_absolute=lambda: True, parent=self.private_root,
            lstat=lambda: self.link_stat, resolve=lambda: self.target.resolve())
        self.link_target = self.target
        self.removed = []
        item = patch.object(sys.modules[__name__], "_TEST_JUNCTION_REMOVE", self.removed.append)
        item.start()
        self.addCleanup(item.stop)
        readlink = patch.object(sys.modules[__name__], "_TEST_JUNCTION_READLINK", lambda link: str(self.link_target))
        readlink.start()
        self.addCleanup(readlink.stop)
        self.addCleanup(lambda: self.assertEqual(self.target_file.read_bytes(), b"actual-target-bytes"))

    def record(self):
        return _record_created_test_junction(self.link, self.target, self.private_root, types.SimpleNamespace(returncode=0))

    def test_creation_failure_and_missing_capture_never_inspect_or_delete_unknown_link(self):
        self.link.lstat = unittest.mock.Mock(side_effect=AssertionError("unknown link must not be inspected"))
        with self.assertRaisesRegex(ValueError, "creation failed"):
            _record_created_test_junction(self.link, self.target, self.private_root, types.SimpleNamespace(returncode=1))
        self.assertFalse(_remove_created_test_junction(self.link, self.target, self.private_root, None))
        self.link.lstat.assert_not_called()
        self.assertEqual(self.removed, [])

    def test_replaced_link_identity_is_retained_even_with_same_target(self):
        record = self.record()
        self.link_stat.st_ino += 1
        with self.assertRaisesRegex(ValueError, "link identity changed"):
            _remove_created_test_junction(self.link, self.target, self.private_root, record)
        self.assertEqual(self.removed, [])

    def test_parent_or_target_identity_mismatch_never_removes_link(self):
        record = self.record()
        for selected in (self.private_root, self.target):
            with self.subTest(directory=str(selected)):
                altered = {**record, "directories": tuple((directory, (identity[0], identity[1] + 1) if directory == selected else identity)
                    for directory, identity in record["directories"])}
                with self.assertRaisesRegex(ValueError, "directory identity changed"):
                    _remove_created_test_junction(self.link, self.target, self.private_root, altered)
        self.assertEqual(self.removed, [])

    def test_failed_target_or_reparse_validation_cannot_capture_cleanup_identity(self):
        for mutation in ("target", "reparse"):
            self.link_target = self.target
            self.link_stat.st_reparse_tag = 0xA0000003
            if mutation == "target":
                self.link_target = self.private_root
            else:
                self.link_stat.st_reparse_tag = 0xA000000C  # Explicit symbolic-link metadata, not our junction.
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                self.record()
            self.assertFalse(_remove_created_test_junction(self.link, self.target, self.private_root, None))
        self.assertEqual(self.removed, [])

    def test_same_validated_identity_only_reaches_nonrecursive_remove(self):
        record = self.record()
        self.assertTrue(_remove_created_test_junction(self.link, self.target, self.private_root, record))
        self.assertEqual(self.removed, [self.link])


class FrozenProgramIdentityCpuTests(unittest.TestCase):
    def programs(self):
        reader = auth.Reader(ROOT)
        owned = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
        if owned:
            binding = {"path": sys.argv[sys.argv.index("--cpu-request") + 1],
                "sha256": sys.argv[sys.argv.index("--sha256") + 1]}
        else:
            binding = auth.exact_binding(json.loads(os.environ["T_Q4_112_COMPONENT_REQUEST"]))
            self.assertEqual(binding["path"], _COMPONENT_PRIVATE_ROOT + "/component-request.json")
        return auth.read_json(reader, binding)["programBindings"]

    def test_actual_current_capture_and_all_programs_match_exact_pinned_identity(self):
        programs = self.programs()
        seen = auth.verify_programs(auth.Reader(ROOT), programs)
        self.assertEqual(programs["capture"]["sha256"], "0786d2f24f074fac7f9583abf377b7ee7213778c020340d1963bab0703cd4aba")
        self.assertEqual(programs["captureTests"]["sha256"], "5ea7d83261e1b6ce2675df8edce4cb6ec5e5e299f51f0e97f16db020bc388bbc")
        self.assertEqual((len(programs), len(seen)), _expected_current_source_counts(auth.Reader(ROOT)))

    def test_old_tampered_capture_and_tampered_codec_tests_reject_actual_source_reads(self):
        current = self.programs()
        original = auth.RuntimeMap.binding
        for role, wrong_sha in (("capture", "155c646ce5d8b60f729e3663748ce59616d0d549489e583b9472ceb32709b6f4"),
                                ("capture", "0" * 64), ("captureTests", "0" * 64)):
            binding = {**current[role], "sha256": wrong_sha}
            programs = {role: binding, **{k: v for k, v in current.items() if k != role}}
            reads = []
            def observe(mapping, candidate, *, maximum=capture.MAX_JSON):
                reads.append(candidate["path"])
                return original(mapping, candidate, maximum=maximum)
            with self.subTest(role=role, sha=wrong_sha), patch.object(auth.RuntimeMap, "binding", new=observe), \
                self.assertRaisesRegex(ValueError, "binding SHA differs"):
                auth.verify_programs(auth.Reader(ROOT), programs)
            self.assertEqual(reads[-1], current[role]["path"])


class FreshPlainPathCpuTests(unittest.TestCase):
    """Real ordinary observations; reparse and IO faults are labelled synthetic."""
    def setUp(self):
        _, _, self.target = _negative_input_fixture("reader")

    def test_actual_each_ancestor_is_observed_once_and_every_call_is_fresh(self):
        original = Path.lstat
        calls = []
        def observe(path, *args, **kwargs):
            calls.append(path)
            return original(path, *args, **kwargs)
        with patch.object(Path, "lstat", new=observe), \
            patch.object(Path, "exists", side_effect=AssertionError("must not follow target")), \
            patch.object(Path, "is_symlink", side_effect=AssertionError("no duplicate stat")):
            capture._plain(self.target)
            capture._plain(self.target)
        self.assertEqual(calls, [self.target, *self.target.parents] * 2)

    def test_explicit_missing_leaf_still_refuses_redirected_ancestor(self):
        leaf = self.target / "synthetic-missing-plain-leaf"
        original = Path.lstat
        calls = []
        def negative(path, *args, **kwargs):
            calls.append(path)
            if path == leaf:
                raise FileNotFoundError(2, "synthetic missing leaf", str(path))
            if path == self.target:
                actual = original(path, *args, **kwargs)
                return types.SimpleNamespace(st_mode=actual.st_mode, st_file_attributes=0x400)
            return original(path, *args, **kwargs)
        with patch.object(Path, "lstat", new=negative), self.assertRaisesRegex(ValueError, "physical path redirection"):
            capture._plain(leaf)
        self.assertEqual(calls, [leaf, self.target])

    def test_dangling_symlink_and_non_symlink_reparse_are_refused_without_following(self):
        for mode, attributes in ((auth.stat.S_IFLNK, 0), (auth.stat.S_IFDIR, 0x400)):
            # Explicit synthetic metadata, never a positive filesystem identity.
            info = types.SimpleNamespace(st_mode=mode, st_file_attributes=attributes)
            with self.subTest(mode=mode, attributes=attributes), \
                patch.object(Path, "lstat", return_value=info) as observed, \
                patch.object(Path, "exists", side_effect=AssertionError("must not follow dangling object")), \
                patch.object(Path, "is_symlink", side_effect=AssertionError("no duplicate stat")), \
                self.assertRaisesRegex(ValueError, "physical path redirection"):
                capture._plain(self.target)
            observed.assert_called_once()

    def test_permission_unknown_and_not_directory_errors_propagate_after_missing_leaf(self):
        leaf = self.target / "synthetic-missing-error-leaf"
        original = Path.lstat
        for error in (PermissionError(13, "synthetic permission error"), OSError(1234, "synthetic unknown IO"),
                      NotADirectoryError(20, "synthetic non-directory ancestor")):
            calls = []
            def negative(path, *args, **kwargs):
                calls.append(path)
                if path == leaf:
                    raise FileNotFoundError(2, "synthetic missing leaf", str(path))
                if path == self.target:
                    raise error
                return original(path, *args, **kwargs)
            with self.subTest(error=type(error).__name__), patch.object(Path, "lstat", new=negative):
                with self.assertRaises(type(error)) as caught:
                    capture._plain(leaf)
                self.assertIs(caught.exception, error)
            self.assertEqual(calls, [leaf, self.target])


class ReaderReadSizeCpuTests(unittest.TestCase):
    """Real files in the formal Runtime mapping, never a MemoryReader seam."""
    @classmethod
    def setUpClass(cls):
        cls.reader = auth.Reader(ROOT)
        base = os.environ.get("T_Q4_80_READER_FIXTURE_ROOT")
        if base is None:
            request = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
            auth.require(request is not None, "owned CPU fixture root required")
            base = request + "/reader-fixtures"
        auth.require(base.startswith(auth.ROOT_PREFIX) or base.startswith(".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t80/") or
            base in (".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t81/reader-fixtures",
                     ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t83/reader-fixtures",
                     ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t84/reader-fixtures",
                     ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t86/reader-fixtures",
                     ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t90/reader-fixtures",
                     ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t92/reader-fixtures",
                     ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t94/reader-fixtures",
                     ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t96/reader-fixtures",
                     ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t98/reader-fixtures",
                     _COMPONENT_PRIVATE_ROOT + "/reader-fixtures"), "private fixture root required")
        cls.logical_root = base
        cls.physical_root = cls.reader.path(base)
        cls.physical_root.mkdir()

    def fixture(self, name, raw, *, expected=None):
        logical = self.logical_root + "/" + self._testMethodName + "-" + name
        physical = self.reader.path(logical)
        with physical.open("xb") as stream:
            stream.write(raw)
        return physical, {"path": logical, "sha256": hashlib.sha256(raw if expected is None else expected).hexdigest()}

    def original_binding(self, action=None):
        original = auth.RuntimeMap.binding
        calls = []
        def intercept(mapping, binding, *, maximum=capture.MAX_JSON):
            calls.append(maximum)
            if action is not None:
                action(mapping.path(binding["path"]))
            return original(mapping, binding, maximum=maximum)
        return calls, patch.object(auth.RuntimeMap, "binding", intercept)

    def test_actual_size_passes_to_original_binding_and_each_read_rehashes(self):
        physical, binding = self.fixture("small.bin", b"actual-read" * 100)
        calls, seam = self.original_binding()
        with seam:
            self.assertEqual(self.reader.read(binding), physical.read_bytes())
            self.assertEqual(self.reader.read(binding), physical.read_bytes())
        self.assertEqual(calls, [physical.stat().st_size] * 2)
        physical, empty = self.fixture("empty.bin", b"")
        calls, seam = self.original_binding()
        with seam:
            self.assertEqual(self.reader.read(empty), b"")
        self.assertEqual(calls, [0])

    def test_original_call_ceiling_and_real_sha_still_refuse(self):
        physical, binding = self.fixture("limited.bin", b"0123456789")
        calls, seam = self.original_binding()
        with seam, self.assertRaisesRegex(ValueError, "oversized"):
            self.reader.read(binding, maximum=9)
        self.assertEqual(calls, [])
        with self.assertRaisesRegex(ValueError, "SHA differs"):
            self.reader.read({**binding, "sha256": "0" * 64})

    def test_growth_between_size_and_original_read_refuses(self):
        physical, binding = self.fixture("growth.bin", b"abc", expected=b"abcd")
        calls, seam = self.original_binding(lambda p: p.write_bytes(b"abcd"))
        with seam, self.assertRaisesRegex(ValueError, "oversized"):
            self.reader.read(binding)
        self.assertEqual(calls, [3])

    def test_shrink_between_size_and_original_read_refuses(self):
        physical, binding = self.fixture("shrink.bin", b"abcd", expected=b"abc")
        calls, seam = self.original_binding(lambda p: p.write_bytes(b"abc"))
        with seam, self.assertRaisesRegex(ValueError, "file changed across bounded read"):
            self.reader.read(binding)
        self.assertEqual(calls, [4])

    def test_replacement_with_same_bytes_refuses(self):
        physical, binding = self.fixture("replace.bin", b"same")
        replacement, _ = self.fixture("replacement.bin", b"same")
        def replace(p):
            # Both resolved absolute targets are confined to this private root.
            for target in (p, replacement):
                self.assertTrue(target.resolve().is_relative_to(self.physical_root.resolve()))
            replacement.replace(p)
        calls, seam = self.original_binding(replace)
        with seam, self.assertRaisesRegex(ValueError, "file changed across bounded read"):
            self.reader.read(binding)
        self.assertEqual(calls, [4])

    def test_same_size_sha_change_refuses(self):
        physical, binding = self.fixture("changed.bin", b"old!")
        calls, seam = self.original_binding(lambda p: p.write_bytes(b"new!"))
        with seam, self.assertRaisesRegex(ValueError, "SHA differs"):
            self.reader.read(binding)
        self.assertEqual(calls, [4])

    def test_real_descendant_directory_junction_refuses(self):
        negative_root, link, target = _negative_input_fixture("reader")
        private_root = auth.Reader(ROOT).path(negative_root).resolve()
        for candidate in (link, target):
            self.assertTrue(candidate.is_absolute() and candidate.resolve().is_relative_to(private_root))
        self.assertFalse(link.exists())
        self.assertTrue(target.is_dir())
        physical = target / "guard.bin"
        with physical.open("xb") as stream:
            stream.write(b"linked")
        quote = lambda text: "'" + str(text).replace("'", "''") + "'"
        command = ("[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\n"
            "New-Item -ItemType Junction -Path " + quote(link) + " -Target " + quote(target) + " -ErrorAction Stop | Out-Null")
        evidence = {"coveredRedirectKind": "windows_directory_junction", "symlinkValidated": False,
            "status": "environment_blocked", "linkAbsolutePath": str(link), "targetAbsolutePath": str(target),
            "readerRejected": False, "junctionRemoved": False, "targetBytesPreserved": False}
        link_identity = None
        creation_record = None
        try:
            result = subprocess.run(["C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
                "-NoProfile", "-NonInteractive", "-Command", command], capture_output=True, encoding="utf8",
                timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            evidence.update(creationExitCode=result.returncode, creationStdout=result.stdout[:2048], creationStderr=result.stderr[:2048])
            self.assertEqual(result.returncode, 0, "environment_blocked: directory junction creation failed")
            creation_record = _record_created_test_junction(link, target, private_root, result)
            if link.exists():
                info = link.lstat()
                self.assertTrue(getattr(info, "st_file_attributes", 0) & 0x400)
                self.assertEqual(link.resolve(), target.resolve())
                link_identity = capture._file_identity(info)
                evidence.update(reparseAttributes=info.st_file_attributes, linkIdentity=list(link_identity))
            self.assertIsNotNone(link_identity, "environment_blocked: junction absent")
            _observe_negative_link("reader", negative_root, creation_record)
            with self.assertRaisesRegex(ValueError, "redirection"):
                self.reader.read({"path": negative_root + "/reader-link/guard.bin",
                    "sha256": hashlib.sha256(b"linked").hexdigest()})
            with patch.object(auth.shutil, "which", return_value=str(link / "guard.bin")), self.assertRaisesRegex(ValueError, "redirection"):
                auth.runtime_identity(ROOT)
            evidence["runtimeOriginalAliasRedirectRejected"] = True
            program = ("import {pathToFileURL} from 'node:url';"
                "const {runtimeIdentity}=await import(pathToFileURL(process.argv[1]).href);"
                "process.execPath=process.argv[3];"
                "try{runtimeIdentity(process.argv[2]);process.exitCode=1;}"
                "catch(error){if(!/redirection/.test(error.message))throw error;process.stdout.write('redirect_refused');}")
            producer = subprocess.run([shutil.which("node"), "--input-type=module", "-e", program,
                str(ROOT / auth.ROLES["packageChain"]), str(ROOT), str(link / "guard.bin")], capture_output=True,
                encoding="utf8", timeout=5, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            self.assertEqual(producer.returncode, 0, producer.stderr)
            self.assertEqual(producer.stdout, "redirect_refused")
            evidence["producerRuntimeOriginalRedirectRejected"] = True
            evidence.update(status="component_redirect_refused_not_admission", readerRejected=True)
        except BaseException as error:
            evidence["error"] = {"type": type(error).__name__, "message": str(error)[:2048]}
            raise
        finally:
            if link_identity is not None:
                self.assertTrue(link.is_absolute() and link.parent.resolve().is_relative_to(private_root))
                info = link.lstat()
                self.assertEqual(capture._file_identity(info), link_identity)
                self.assertTrue(getattr(info, "st_file_attributes", 0) & 0x400)
                self.assertEqual(link.resolve(), target.resolve())
                evidence["junctionRemoved"] = _remove_created_test_junction(link, target, private_root, creation_record)
            self.assertEqual(physical.read_bytes(), b"linked")
            evidence["targetBytesPreserved"] = True
            raw = capture.json_bytes(evidence)
            self.assertLess(len(raw), 65536)
            with (self.physical_root / "junction-test-receipt.json").open("xb") as stream:
                stream.write(raw)


class LoadedSourceIdentityCpuTests(unittest.TestCase):
    """Real sys.modules and provider bytes; synthetic impostors only as negatives."""
    def setUp(self):
        self.reader = auth.Reader(ROOT)
        self.programs = copy.deepcopy(ExecutionProtocolCpuTests.programs)
        main_source = Path(sys.modules["__main__"].__file__).absolute()
        if main_source.is_relative_to(ROOT):
            logical = main_source.relative_to(ROOT).as_posix()
            if logical not in {b["path"] for b in self.programs.values()}:
                auth.require(logical in (".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t86/cpu_batch.py",
                    ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t90/cpu_batch.py",
                    ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t92/cpu_batch.py",
                    ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t94/cpu_batch.py",
                    ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t96/cpu_batch.py",
                    ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t98/cpu_batch.py",
                    _COMPONENT_PRIVATE_ROOT + "/cpu_batch.py"),
                    "unbound private CPU driver")
                self.programs["privateCpuDriver"] = {"path": logical, "sha256": hashlib.sha256(main_source.read_bytes()).hexdigest()}

    def test_actual_torch_dynamic_objects_and_real_loaded_closure(self):
        import torch
        dynamic = [worker.verify_torch_dynamic_namespace(self.reader, obj) for obj in
            (torch.ops, torch.classes, torch.ops.higher_order)]
        self.assertEqual([r["class"] for r in dynamic], ["_Ops", "_Classes", "_HigherOrderNamespace"])
        plan = {"programBindings": self.programs}
        summary = worker.verify_loaded_sources(self.reader, plan)
        self.assertIn("ml/ai-painter/scripts/painter_stage4_ecology_decode1_weight_quality_worker_v1.py", summary["projectSources"])
        self.assertIn("torch.ops", [r["module"] for r in summary["dynamicNamespaces"]])
        self.assertIn("torch.classes", [r["module"] for r in summary["dynamicNamespaces"]])
        self.reader.unchanged()
        output = os.environ.get("T_Q4_LOADED_SOURCE_REPORT")
        if output:
            with Path(output).open("xb") as stream:
                stream.write(capture.json_bytes({"status": "actual_loaded_source_verified_not_admission",
                    "dynamicObjects": dynamic, "actualSysModulesSummary": summary,
                    "providerSourceBindings": worker._TORCH_SOURCE_BINDINGS, "qualified": False}))

    def test_forged_namespace_names_placeholders_and_copied_type_refuse(self):
        import torch
        for name, filename in (("torch.ops", "_ops.py"), ("torch.classes", "_classes.py"),
                               ("torch.ops.higher_order", "torch.ops"), ("fake.unknown", "_ops.py")):
            fake = types.ModuleType(name)
            fake.__file__ = filename
            with patch.dict(sys.modules, {"t86.synthetic_forgery": fake}), self.assertRaises(ValueError):
                worker.verify_loaded_sources(self.reader, {"programBindings": self.programs})
        copied = type(torch.ops)()
        with self.assertRaises(ValueError):
            worker.verify_torch_dynamic_namespace(self.reader, copied)

    def test_actual_dynamic_carrier_or_provider_mutation_refuse(self):
        import torch
        for obj in (torch.ops, torch.classes, torch.ops.higher_order):
            with patch.object(obj, "__file__", str(ROOT / auth.ROLES["worker"])), self.assertRaisesRegex(ValueError, "carrier changed"):
                worker.verify_torch_dynamic_namespace(self.reader, obj)
        with patch.object(worker._torch_ops_provider, "__file__", str(ROOT / auth.ROLES["worker"])), self.assertRaisesRegex(ValueError, "source/loader changed"):
            worker.verify_torch_dynamic_namespace(self.reader, torch.ops)

    def test_unbound_real_project_source_and_relative_unknown_refuse(self):
        plan = {"programBindings": copy.deepcopy(self.programs)}
        plan["programBindings"].pop("worker")
        with self.assertRaisesRegex(ValueError, "outside closure"):
            worker.verify_loaded_sources(self.reader, plan)
        fake = types.ModuleType("unrelated_unknown")
        fake.__file__ = "relative_missing.py"
        with patch.dict(sys.modules, {"t86.relative_unknown": fake}), self.assertRaisesRegex(ValueError, "relative loaded-source"):
            worker.verify_loaded_sources(self.reader, {"programBindings": self.programs})

    def test_bound_real_project_sha_tamper_refuse(self):
        plan = {"programBindings": copy.deepcopy(self.programs)}
        plan["programBindings"]["worker"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "SHA differs"):
            worker.verify_loaded_sources(self.reader, plan)

    def test_bound_private_project_actual_bytes_change_refuse(self):
        logical = os.environ.get("T_Q4_PRIVATE_SOURCE_FIXTURE")
        if logical is None:
            output = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
            auth.require(output is not None, "owned private source fixture root required")
            logical = output + "/loaded-project-source-fixture.py"
        auth.require(logical.startswith(auth.ROOT_PREFIX) or
            logical in (".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t86/loaded-project-source-fixture.py",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t90/loaded-project-source-fixture.py",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t92/loaded-project-source-fixture.py",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t94/loaded-project-source-fixture.py",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t96/loaded-project-source-fixture.py",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t98/loaded-project-source-fixture.py",
                _COMPONENT_PRIVATE_ROOT + "/loaded-project-source-fixture.py"),
            "private source fixture required")
        physical = self.reader.path(logical)
        with physical.open("xb") as stream:
            stream.write(b"FLAG = 1\n")
        binding = {"path": logical, "sha256": hashlib.sha256(b"FLAG = 1\n").hexdigest()}
        spec = importlib.util.spec_from_file_location("t86.real_private_source", ROOT / logical)
        actual_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(actual_module)
        plan = {"programBindings": {**self.programs, "privateTestSource": binding}}
        with patch.dict(sys.modules, {"t86.real_private_source": actual_module}):
            self.assertIn(logical, worker.verify_loaded_sources(self.reader, plan)["projectSources"])
            physical.write_bytes(b"FLAG = 2\n")
            with self.assertRaisesRegex(ValueError, "SHA differs"):
                worker.verify_loaded_sources(self.reader, plan)


class _LoaderObservationReader:
    """Fresh real observations; source snapshots keep their actual origin Reader."""
    def __init__(self, test, source, observe):
        auth.require(type(test) is BoundSourceSnapshotCpuTests and source is BoundSourceSnapshotCpuTests.reader and
            type(source) is auth.Reader and source.root == ROOT, "exact recomputed loader source Reader required")
        scope = {"runId": test.plan["runId"], "packageId": test.plan["packageId"],
                 "dataClosure": auth.exact_binding(test.plan["dataClosure"])}
        auth.require(source._source_snapshot_scope == scope and len(test.closure["bindings"]) == 1435 and
            source._source_snapshot_bindings == {b["path"]: b for b in test.closure["bindings"]} and
            all(source.observed.get(b["path"]) == b["sha256"] for b in test.closure["bindings"]),
            "actual full recomputation/source scope required for loader")
        self._source = source
        self._test = test
        self._observe = observe
        self.reader = auth.Reader(ROOT)
        self.root = self.reader.root

    def read(self, binding, maximum=auth.SOURCE_JSON_MAX):
        return self.reader.read(binding, maximum)

    def json(self, binding):
        return self.reader.json(binding)

    def unchanged(self):
        self.reader.unchanged()

    def snapshot(self, logical):
        auth.require(self._source is BoundSourceSnapshotCpuTests.reader, "loader source Reader replaced")
        # No source index is installed on the fresh reader. Only the original
        # actually recomputed Reader can authorize this unbound-path operation.
        raw, actual = self._source.snapshot(logical)
        maximum = auth.PROGRAM_MAX if logical == auth.CANONICAL_REGION_PROGRAM else auth.SOURCE_JSON_MAX
        verified = self.reader.read(actual, maximum)
        auth.require(verified == raw, "loader snapshot/bound bytes changed")
        self._observe(logical, raw, actual)
        return raw, actual


class BoundSourceSnapshotCpuTests(unittest.TestCase):
    """Actual closure/source/CPU pixels; no numerical or production admission."""
    @classmethod
    def setUpClass(cls):
        cls.reader = auth.Reader(ROOT)
        private = os.environ.get("T_Q4_90_PRIVATE_ROOT")
        repair_component = os.environ.get("T_QV12_R1_COMPONENT_ROOT")
        if repair_component:
            auth.require(repair_component == ".runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1" and
                         not private and not os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT"),
                         "isolated unqualified repair component required")
            plan_path = auth.ROOT_PREFIX + "ecology-quality-tqv12-r1-unqualified-fixture/quality-plan.json"
            cls.plan = auth.read_json(cls.reader, {"path": plan_path,
                "sha256": hashlib.sha256(cls.reader.path(plan_path).read_bytes()).hexdigest()})
            cls.fixture_logical = repair_component + "/source-snapshot-fixtures"
        elif private:
            auth.require(private in (".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t90",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t92",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t94",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t96",
                ".runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t98", _COMPONENT_PRIVATE_ROOT), "exact private CPU fixture root")
            # Read-only T89 data lineage, never its package execution/admission.
            plan_path = auth.ROOT_PREFIX + "ecology-quality-unqualified-fixture/quality-plan.json"
            cls.plan = auth.read_json(cls.reader, {"path": plan_path,
                "sha256": hashlib.sha256(cls.reader.path(plan_path).read_bytes()).hexdigest()})
            cls.fixture_logical = private + "/source-snapshot-fixtures"
        else:
            output = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
            auth.require(output is not None and output.startswith(auth.ROOT_PREFIX) and output.endswith("/cpu-entry"), "owned CPU fixture root")
            request_path = sys.argv[sys.argv.index("--cpu-request") + 1]
            request_sha = sys.argv[sys.argv.index("--sha256") + 1]
            request = auth.read_json(cls.reader, {"path": request_path, "sha256": request_sha})
            run_root = output.rsplit("/", 1)[0]
            closure_path = run_root + "/data-closure.json"
            cls.plan = {**request, "outputRoot": run_root, "dataClosure": {"path": closure_path,
                "sha256": hashlib.sha256(cls.reader.path(closure_path).read_bytes()).hexdigest()}}
            cls.fixture_logical = output + "/source-snapshot-fixtures"
        cls.fixture_physical = cls.reader.path(cls.fixture_logical)
        cls.fixture_physical.mkdir()
        started = time.perf_counter()
        _cpu_phase("closure.production_recompute.start", time.monotonic())
        cls.closure = auth.verify_data_closure(cls.reader, cls.plan)
        cls.recompute_seconds = time.perf_counter() - started
        _cpu_phase("closure.production_recompute.done", time.monotonic() - cls.recompute_seconds,
            bindings=len(cls.closure["bindings"]), independentProductionAuth=True)
        _publish_component_preparation(cls.reader, cls.plan, cls.closure)
        from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
        cls.train_rows = [row for row in cls.reader.json(DIAGNOSTIC)["rows"] if row["split"] == "train"]
        cls.visual_bindings = [row["identity"]["visualFactManifestFile"] for row in cls.train_rows]
        cls.large = sorted((b for b in cls.visual_bindings if cls.reader.path(b["path"]).stat().st_size > auth.CONTROL_JSON_MAX),
            key=lambda b: cls.reader.path(b["path"]).stat().st_size)
        auth.require(len(cls.train_rows) == 48 and cls.large, "actual48 train and large visual source required")

    def fixture(self, name, raw):
        logical = self.fixture_logical + "/" + name
        physical = self.reader.path(logical)
        with physical.open("xb") as stream:
            stream.write(raw)
        return physical, {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}

    def test_actual48_train_load_and_large_visual_source_snapshot(self):
        started = time.perf_counter()
        _cpu_phase("train48.load.start", time.monotonic())
        expected = {b["path"]: b for b in self.closure["bindings"]}
        for binding in self.visual_bindings:
            self.assertEqual(binding, expected[binding["path"]])
        large_proofs = []
        large_expected = {b["path"]: b for b in self.large}
        large_seen = set()

        def observe_pixel_snapshot(logical, raw, actual):
            if logical not in large_expected:
                return
            binding = large_expected[logical]
            self.assertEqual(actual, binding)
            self.assertEqual(hashlib.sha256(raw).hexdigest(), binding["sha256"])
            self.assertGreater(len(raw), auth.CONTROL_JSON_MAX)
            self.assertLessEqual(len(raw), auth.SOURCE_JSON_MAX)
            self.assertIn("manifestId", auth.decode_source_json(raw))
            if logical not in large_seen:
                large_seen.add(logical)
                large_proofs.append({**binding, "bytes": len(raw)})

        loader_reader = _LoaderObservationReader(self, self.reader, observe_pixel_snapshot)
        preparation_observed = len(loader_reader.reader.observed)
        samples, order = worker.load_samples(loader_reader, self.plan)
        self.assertEqual(large_seen, set(large_expected))
        self.assertEqual(len(samples), 48)
        self.assertEqual([s["sampleId"] for s in samples], self.closure["splitSampleIds"]["train"])
        self.assertEqual(len(order), 23)
        import torch
        for sample in samples:
            self.assertEqual(sample["split"], "train")
            self.assertEqual(list(sample["conditions"].shape), [23, 192, 256])
            self.assertEqual(list(sample["image"].shape), [3, 192, 256])
            self.assertEqual(sample["conditions"].device.type, "cpu")
            self.assertFalse(sample["conditions"].requires_grad or sample["image"].requires_grad)
            self.assertEqual(sample["conditions"].dtype, torch.float32)
            self.assertEqual(list(sample["appearance_regime"].shape), [4])
            self.assertEqual(list(sample["ecology_regime"].shape), [7])
        self.reader.unchanged()
        _cpu_phase("train48.load.done", time.monotonic() - (time.perf_counter() - started), samples=len(samples))
        output = os.environ.get("T_Q4_90_SOURCE_SNAPSHOT_REPORT")
        if output:
            with Path(output).open("x", encoding="utf8") as stream:
                json.dump({"taskId": os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_TASK_ID", "component-cpu"), "status": "actual48_train_loaded_cpu_not_gpu_qualified",
                    "closureBindings": len(self.closure["bindings"]), "recomputeSeconds": self.recompute_seconds,
                    "loadAndSourceSnapshotSeconds": time.perf_counter() - started, "samples": len(samples), "channelCount": len(order),
                    "sampleIds": [s["sampleId"] for s in samples], "largeVisualSources": large_proofs,
                    "loaderReaderType": type(loader_reader).__name__, "loaderPreparationObserved": preparation_observed,
                    "loaderFinalObserved": len(loader_reader.reader.observed), "separateRealReaderNoCache": True,
                    "sourceSnapshotOrigin": "original_actual_recomputed_full_Reader", "allLargeVisualsConsumed": True,
                    "validationRgbRead": False, "challengeContentRead": False, "regressionContentRead": False,
                    "modelForward": 0, "autograd": 0, "optimizer": 0, "cuda": False, "qualified": False}, stream)

    def test_loader_composition_refuses_unverified_and_copied_source_readers(self):
        for source in (auth.Reader(ROOT), copy.copy(self.reader)):
            with self.assertRaisesRegex(ValueError, "exact recomputed loader source Reader"):
                _LoaderObservationReader(self, source, lambda *args: None)

    def test_actual8_validation_loader_consumes_exact_recomputed_visual_manifests(self):
        from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
        rows = sorted((row for row in self.reader.json(DIAGNOSTIC)["rows"] if row["split"] == "validation"),
                      key=lambda row: row["ordinal"])
        expected = {row["identity"]["visualFactManifestFile"]["path"]:
                    row["identity"]["visualFactManifestFile"] for row in rows}
        self.assertEqual(len(expected), 8)
        self.assertEqual([row["sampleId"] for row in rows], self.closure["splitSampleIds"]["validation"])
        closure_index = {binding["path"]: binding for binding in self.closure["bindings"]}
        seen = {}

        def observe(logical, raw, actual):
            if logical in expected:
                self.assertEqual(actual, expected[logical])
                self.assertEqual(actual, closure_index[logical])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), actual["sha256"])
                seen[logical] = {**actual, "bytes": len(raw)}

        loader = _LoaderObservationReader(self, self.reader, observe)
        loaded, order = worker.load_samples(loader, self.plan, splits=("validation",))
        self.assertEqual(set(loaded), {"validation"})
        samples = loaded["validation"]
        self.assertEqual([sample["sampleId"] for sample in samples], self.closure["splitSampleIds"]["validation"])
        self.assertEqual(set(seen), set(expected))
        self.assertEqual(len(order), 23)
        for sample, row in zip(samples, rows):
            self.assertEqual(sample["split"], "validation")
            for key, shape in (("conditions", [23, 192, 256]), ("image", [3, 192, 256]),
                               ("appearance_regime", [4]), ("ecology_regime", [7])):
                self.assertEqual(list(sample[key].shape), shape)
                self.assertEqual(sample[key].device.type, "cpu")
                self.assertFalse(sample[key].requires_grad)
            image = row["identity"]["image"]
            self.assertEqual(loader.reader.observed[image["path"]], image["sha256"])
            self.assertNotIn(image["path"], closure_index)
        self.assertTrue(all(row["identity"]["image"]["path"] not in loader.reader.observed for row in self.train_rows))
        loader.unchanged()
        output = os.environ.get("T_QV12_VALIDATION_LOADER_REPORT")
        if output:
            with Path(output).open("x", encoding="utf8") as stream:
                json.dump({"schema": "quality-validation-loader-regression-v1", "status": "actual8_validation_loaded_cpu",
                    "sampleIds": [sample["sampleId"] for sample in samples],
                    "visualManifests": [seen[row["identity"]["visualFactManifestFile"]["path"]] for row in rows],
                    "originalRgb": [row["identity"]["image"] for row in rows],
                    "closureBindings": len(self.closure["bindings"]), "validationRgbReadByLoaderTest": True,
                    "validationRgbReadByClosure": self.closure["validationRgbRead"],
                    "validationRgbInSnapshotClosure": False, "trainRgbReadByLoaderTest": False,
                    "challengeContentRead": False, "regressionContentRead": False,
                    "weightOptimization": False, "checkpointSelection": False, "gpuQualification": False,
                    "sourceReader": "actual_recomputed_Reader", "qualified": False}, stream)

    def test_actual_validation_loader_refuses_missing_manifest_before_rgb(self):
        from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
        rows = sorted((row for row in self.reader.json(DIAGNOSTIC)["rows"] if row["split"] == "validation"),
                      key=lambda row: row["ordinal"])
        first = rows[0]["identity"]["visualFactManifestFile"]
        loader = _LoaderObservationReader(self, self.reader, lambda *args: None)
        incomplete = dict(self.reader._source_snapshot_bindings)
        del incomplete[first["path"]]
        with patch.object(self.reader, "_source_snapshot_bindings", incomplete), \
                self.assertRaisesRegex(ValueError, "snapshot outside verified source/known control"):
            worker.load_samples(loader, self.plan, splits=("validation",))
        self.assertTrue(all(row["identity"]["image"]["path"] not in loader.reader.observed for row in rows))
        self.assertNotIn(first["path"], loader.reader.observed)

    def test_loader_composition_keeps_metadata_and_unverified_visual_snapshot_refusals(self):
        from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
        metadata = auth._ClosureMetadataReader(ROOT, DIAGNOSTIC)
        with self.assertRaisesRegex(ValueError, "unbound closure metadata snapshot"):
            metadata.snapshot(self.large[0]["path"])
        physical, binding = self.fixture("unverified-loader-visual.json", b'{"manifestId":"not-authorized"}')
        seen = []
        loader = _LoaderObservationReader(self, self.reader, lambda *args: seen.append(args))
        with self.assertRaisesRegex(ValueError, "snapshot outside verified source/known control"):
            loader.snapshot(binding["path"])
        self.assertEqual(seen, [])
        self.assertEqual(loader.reader.observed, {})
        self.assertTrue(physical.is_file())

    def test_bound_governance_program_returns_raw_bytes_from_both_readers(self):
        from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
        module = auth.CANONICAL_REGION_PROGRAM
        original = (ROOT / module).read_bytes()
        frozen = auth.read_json(auth.Reader(ROOT), auth.FROZEN_PLAN)
        matches = [b for b in frozen["programBindings"].values() if b["path"] == module]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["sha256"], "c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1")
        self.assertEqual(hashlib.sha256(original).hexdigest(), matches[0]["sha256"])
        self.assertLessEqual(len(original), auth.PROGRAM_MAX)
        metadata = auth._ClosureMetadataReader(ROOT, DIAGNOSTIC)
        proofs = []
        with patch.object(auth, "decode_source_json", side_effect=AssertionError("program must not be JSON decoded")):
            for reader in (self.reader, metadata):
                raw, binding = reader.snapshot(module)
                self.assertEqual(raw, original)
                self.assertEqual(binding, matches[0])
                proofs.append({"readerType": type(reader).__name__, "binding": binding, "bytes": len(raw), "rawSha256": hashlib.sha256(raw).hexdigest()})
        self.assertEqual(len(self.closure["bindings"]), 1435)
        fake, fake_binding = self.fixture("copied-governance.mjs", original)
        self.assertEqual(hashlib.sha256(fake.read_bytes()).hexdigest(), matches[0]["sha256"])
        with self.assertRaisesRegex(ValueError, "outside verified source/known control"):
            self.reader.snapshot(fake_binding["path"])
        with self.assertRaisesRegex(ValueError, "unrecognized program snapshot"):
            auth._snapshot_canonical_program(ROOT, fake_binding["path"])
        output = os.environ.get("T_Q4_PROGRAM_SNAPSHOT_REPORT")
        if output:
            with Path(output).open("x", encoding="utf8") as stream:
                json.dump({"status": "actual_bound_program_raw_bytes_not_qualification", "readers": proofs,
                    "copiedSameShaWrongPathRejected": True, "jsonDecoderInvokedForProgram": False, "qualified": False}, stream)

    def test_governance_wrong_descriptor_duplicate_and_oversize_refuse(self):
        frozen = auth.read_json(auth.Reader(ROOT), auth.FROZEN_PLAN)
        module = auth.CANONICAL_REGION_PROGRAM
        role = next(r for r, b in frozen["programBindings"].items() if b["path"] == module)
        original_json = auth.read_json
        for mutate, message in ((lambda value: value["programBindings"][role].update(sha256="0" * 64), "SHA differs"),
                                (lambda value: value["programBindings"].update(duplicate=value["programBindings"][role]), "unique frozen")):
            forged = copy.deepcopy(frozen)
            mutate(forged)
            def negative_descriptor(reader, binding):
                return forged if binding == auth.FROZEN_PLAN else original_json(reader, binding)
            with patch.object(auth, "read_json", negative_descriptor), self.assertRaisesRegex(ValueError, message):
                self.reader.snapshot(module)
        actual = self.reader.path(module)
        original_stat = Path.lstat
        def oversized(path, *args, **kwargs):
            info = original_stat(path, *args, **kwargs)
            if path == actual:
                proxy = _NegativeSizeStatProxy(info, auth.PROGRAM_MAX + 1)
                for name in ("st_file_attributes", "st_reparse_tag", "st_mtime_ns", "st_ctime_ns", "st_atime_ns", "st_mode", "st_dev", "st_ino"):
                    self.assertEqual(getattr(proxy, name), getattr(info, name))
                return proxy
            return info
        with patch.object(Path, "lstat", oversized), self.assertRaisesRegex(ValueError, "oversized"):
            self.reader.snapshot(module)
        self.assertEqual(auth.PROGRAM_MAX, 1048576)

    def test_governance_actual_redirect_refuses_in_isolated_mapping(self):
        original_plan = auth.Reader(ROOT).read(auth.FROZEN_PLAN, auth.CONTROL_JSON_MAX)
        original_code = (ROOT / auth.CANONICAL_REGION_PROGRAM).read_bytes()
        negative_root, link, target = _negative_input_fixture("program")
        project = auth.Reader(ROOT).path(negative_root + "/program-project")
        data = auth.Reader(ROOT).path(negative_root + "/program-data")
        (target / "real-earth-region-governance.mjs").write_bytes(original_code)
        quote = lambda value: "'" + str(value).replace("'", "''") + "'"
        command = "New-Item -ItemType Junction -Path " + quote(link) + " -Target " + quote(target) + " -ErrorAction Stop | Out-Null"
        result = subprocess.run(["C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        creation_record = None
        private_root = auth.Reader(ROOT).path(negative_root).resolve()
        try:
            self.assertEqual(result.returncode, 0, result.stderr)
            creation_record = _record_created_test_junction(link, target, private_root, result)
            self.assertTrue(link.lstat().st_file_attributes & 0x400)
            self.assertEqual(link.resolve(), target.resolve())
            _observe_negative_link("program", negative_root, creation_record)
            with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
                reader = auth.Reader(project)
                plan_file = reader.path(auth.FROZEN_PLAN["path"])
                plan_file.parent.mkdir(parents=True)
                plan_file.write_bytes(original_plan)
                with self.assertRaisesRegex(ValueError, "redirection"):
                    reader.snapshot(auth.CANONICAL_REGION_PROGRAM)
        finally:
            _remove_created_test_junction(link, target, private_root, creation_record)
            self.assertEqual((target / "real-earth-region-governance.mjs").read_bytes(), original_code)

    def test_unverified_or_missing_membership_and_wrong_source_sha_refuse(self):
        binding = self.large[0]
        fresh = auth.Reader(ROOT)
        with self.assertRaisesRegex(ValueError, "outside verified source/known control"):
            fresh.snapshot(binding["path"])
        auth.verify_data_closure(fresh, self.plan, recompute=False)
        self.assertEqual(fresh._source_snapshot_bindings, {})
        with self.assertRaisesRegex(ValueError, "outside verified source/known control"):
            fresh.snapshot(binding["path"])
        without = dict(self.reader._source_snapshot_bindings)
        del without[binding["path"]]
        with patch.object(self.reader, "_source_snapshot_bindings", without), self.assertRaisesRegex(ValueError, "outside verified source/known control"):
            self.reader.snapshot(binding["path"])
        with patch.dict(self.reader._source_snapshot_bindings, {binding["path"]: {**binding, "sha256": "0" * 64}}), self.assertRaisesRegex(ValueError, "SHA differs"):
            self.reader.snapshot(binding["path"])
        _physical, small = self.fixture("unbound-small-source.json", b'{"small":true}')
        self.assertEqual(self.reader.json(small), {"small": True})
        with self.assertRaisesRegex(ValueError, "outside verified source/known control"):
            self.reader.snapshot(small["path"])

    def test_large_unknown_control_stays_two_mib_even_if_previously_observed(self):
        raw = b"{}" + b" " * (auth.CONTROL_JSON_MAX - 1)
        # Real isolated RuntimeMap, real IO, known registry logical identity.
        project = self.fixture_physical / "control-project"
        data = self.fixture_physical / "control-data"
        project.mkdir()
        (data / "hot/runtime").mkdir(parents=True)
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
            reader = auth.Reader(project)
            physical = reader.path(auth.REGISTRY)
            physical.parent.mkdir(parents=True)
            physical.write_bytes(raw)
            binding = {"path": auth.REGISTRY, "sha256": hashlib.sha256(raw).hexdigest()}
            self.assertEqual(physical.stat().st_size, auth.CONTROL_JSON_MAX + 1)
            self.assertEqual(reader.json(binding), {})
            self.assertIn(binding["path"], reader.observed)
            self.assertNotIn(binding["path"], reader._source_snapshot_bindings)
            with self.assertRaisesRegex(ValueError, "mutable JSON byte ceiling"):
                reader.snapshot(binding["path"])
            with self.assertRaises(ValueError):
                auth.read_json(reader, binding)
            physical.write_bytes(b'{"registryRevision":1}')
            actual, returned = reader.snapshot(auth.REGISTRY)
            self.assertEqual(actual, b'{"registryRevision":1}')
            self.assertEqual(returned["sha256"], hashlib.sha256(actual).hexdigest())
            # Retain the oversized bytes and negative evidence, no production IO.
            physical.write_bytes(raw)

    def test_source_above_eight_mib_still_refuses_before_read_and_strict_decode(self):
        binding = self.large[0]
        original_stat = Path.lstat
        actual_path = self.reader.path(binding["path"])
        def oversized(path, *args, **kwargs):
            info = original_stat(path, *args, **kwargs)
            if path == actual_path:
                proxy = _NegativeSizeStatProxy(info, auth.SOURCE_JSON_MAX + 1)
                for name in ("st_file_attributes", "st_reparse_tag", "st_mtime_ns", "st_ctime_ns", "st_atime_ns", "st_mode", "st_dev", "st_ino"):
                    self.assertEqual(getattr(proxy, name), getattr(info, name))
                return proxy
            return info
        # Explicit negative oversized metadata; no >8MiB file is written into
        # the evidence budget, and no mocked positive read is accepted.
        with patch.object(Path, "lstat", oversized), self.assertRaisesRegex(ValueError, "oversized"):
            self.reader.snapshot(binding["path"])
        with self.assertRaisesRegex(ValueError, "bounded source JSON"):
            auth.decode_source_json(b"{}" + b" " * (auth.SOURCE_JSON_MAX - 1))
        self.assertEqual(auth.SOURCE_JSON_MAX, 8 * 1024**2)
        self.assertEqual(auth.CONTROL_JSON_MAX, 2 * 1024**2)

    def test_same_path_actual_bytes_change_and_cross_run_scope_refuse(self):
        physical, binding = self.fixture("immutable-source.json", b'{"x":1}')
        reader = auth.Reader(ROOT)
        self.assertEqual(reader.json(binding), {"x": 1})
        physical.write_bytes(b'{"x":2}')
        with self.assertRaisesRegex(ValueError, "SHA differs"):
            reader.json(binding)
        with self.assertRaisesRegex(ValueError, "SHA differs"):
            reader.unchanged()
        cross = copy.deepcopy(self.plan)
        cross["runId"] = "cross-run-source-90"
        cross["outputRoot"] = auth.ROOT_PREFIX + cross["runId"]
        with self.assertRaisesRegex(ValueError, "cross Run data closure path"):
            auth.verify_data_closure(self.reader, cross)
        cross["dataClosure"]["path"] = cross["outputRoot"] + "/data-closure.json"
        with self.assertRaisesRegex(ValueError, "cross Run source snapshot scope"):
            auth.verify_data_closure(self.reader, cross)

    def test_actual_junction_snapshot_and_binding_refuse(self):
        negative_root, link, target = _negative_input_fixture("snapshot")
        (target / "source.json").write_bytes(b"{}")
        quote = lambda value: "'" + str(value).replace("'", "''") + "'"
        command = "New-Item -ItemType Junction -Path " + quote(link) + " -Target " + quote(target) + " -ErrorAction Stop | Out-Null"
        result = subprocess.run(["C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        creation_record = None
        private_root = auth.Reader(ROOT).path(negative_root).resolve()
        try:
            self.assertEqual(result.returncode, 0, result.stderr)
            creation_record = _record_created_test_junction(link, target, private_root, result)
            self.assertTrue(link.lstat().st_file_attributes & 0x400)
            self.assertEqual(link.resolve(), target.resolve())
            _observe_negative_link("snapshot", negative_root, creation_record)
            logical = negative_root + "/snapshot-link/source.json"
            with self.assertRaisesRegex(ValueError, "redirection"):
                self.reader.snapshot(logical)
            with self.assertRaisesRegex(ValueError, "redirection"):
                self.reader.json({"path": logical, "sha256": hashlib.sha256(b"{}").hexdigest()})
        finally:
            _remove_created_test_junction(link, target, private_root, creation_record)
            self.assertEqual((target / "source.json").read_bytes(), b"{}")


class HeartbeatHandleCpuTests(unittest.TestCase):
    """Private Windows IO fixtures; explicit helper scope grants no Reader authority."""
    observations = []

    def setUp(self):
        reader = auth.Reader(ROOT)
        output = os.environ.get("T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT")
        private = os.environ.get("T_Q4_90_PRIVATE_ROOT")
        if output:
            auth.require(output.startswith(auth.ROOT_PREFIX) and output.endswith("/cpu-entry"), "owned heartbeat fixture root")
            base = output
        else:
            auth.require(private == _COMPONENT_PRIVATE_ROOT, "exact heartbeat component fixture root")
            base = private
        type(self).observation_output = reader.path(base + "/heartbeat-observations.json")
        self.base = reader.path(base + "/heartbeat-fixtures/" + self._testMethodName)
        self.base.mkdir(parents=True)

    @classmethod
    def tearDownClass(cls):
        with cls.observation_output.open("xb") as stream:
            stream.write(capture.json_bytes({"scope": "private CPU IO observations, not live admission",
                "historicalT103NativeWinerrorProven": False, "observations": cls.observations}))

    @contextmanager
    def fixture(self, label="one", changes=None, raw=None):
        base = self.base / label
        project, data = base / "project", base / "data"
        project.mkdir(parents=True)
        (data / "hot/runtime").mkdir(parents=True)
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
            reader = auth.Reader(project)
            scope = {"runId": "private-heartbeat-t104", "packageId": "private-package-t104"}
            logical = auth.ROOT_PREFIX + scope["runId"] + "/heartbeat.json"
            physical = reader.path(logical)
            physical.parent.mkdir(parents=True)
            expected = {**scope, "capabilityVersion": auth.CAPABILITY,
                "processId": os.getpid(), "processStartIdentity": "synthetic-IO-only-not-live-admission"}
            value = {"schemaVersion": "ai-painter-current-active-execution-heartbeat-v1", **expected,
                "executionState": "executing", "ttlSeconds": 120,
                "heartbeatAtUtc": datetime.now(timezone.utc).isoformat(), **(changes or {})}
            physical.write_bytes(capture.json_bytes(value) if raw is None else raw)
            yield reader, logical, physical, scope, expected

    def snapshot(self, f):
        reader, logical, _, scope, expected = f
        return auth._snapshot_heartbeat(reader, logical, scope, expected)

    def test_real_windows_one_handle_same_bytes_sha_and_closed(self):
        with self.fixture() as f:
            actual, opened = auth._open_heartbeat_handle, []
            def open_one(path):
                stream = actual(path)
                opened.append(stream)
                return stream
            with patch.object(auth, "_open_heartbeat_handle", open_one), patch.object(auth.RuntimeMap, "binding", side_effect=AssertionError("second path open")):
                raw, binding = self.snapshot(f)
            self.assertEqual(len(opened), 1)
            self.assertTrue(opened[0].closed)
            self.assertEqual(raw, f[2].read_bytes())
            self.assertEqual(binding, {"path": f[1], "sha256": hashlib.sha256(raw).hexdigest()})
            self.observations.append({"case": self._testMethodName, "actualWindowsHandle": True, "opens": 1, "closed": True})

    def test_real_windows_shared_read_write_and_exclusive_conflict(self):
        import ctypes
        from ctypes import wintypes
        with self.fixture() as f:
            kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
            kernel.CreateFileW.restype = wintypes.HANDLE
            kernel.CloseHandle.argtypes = [wintypes.HANDLE]
            with auth._open_heartbeat_handle(f[2]) as stream:
                shared = kernel.CreateFileW(str(f[2]), 0x40000000, 7, None, 3, 0x00200000, None)
                self.assertNotEqual(shared, ctypes.c_void_p(-1).value, "actual shared write open")
                kernel.CloseHandle(shared)
                self.assertFalse(stream.closed)
            exclusive = kernel.CreateFileW(str(f[2]), 0x80000000, 0, None, 3, 0x00200000, None)
            self.assertNotEqual(exclusive, ctypes.c_void_p(-1).value)
            try:
                with self.assertRaises(OSError) as caught:
                    self.snapshot(f)
                self.assertEqual(caught.exception.winerror, 32)
                self.assertEqual(caught.exception.heartbeat_read["attempts"], 3)
                self.assertTrue(all(row["reason"] == "native_sharing" for row in caught.exception.heartbeat_read["reasons"]))
                self.observations.append({"case": self._testMethodName, "actualWindowsHandle": True,
                    "originalWinerror": 32, "error": caught.exception.heartbeat_read,
                    "replaceWhileHeldClaimed": False})
            finally:
                kernel.CloseHandle(exclusive)
            self.snapshot(f)

    def test_real_ordinary_replacement_after_close_reselects_new_bytes(self):
        with self.fixture() as f:
            actual, streams = auth._open_heartbeat_handle, []
            value = json.loads(f[2].read_bytes())
            value["fixtureVersion"] = 2
            new = capture.json_bytes(value)
            staged = f[2].with_name("heartbeat.json.staged-00000000-0000-4000-8000-000000000104")
            staged.write_bytes(new)
            old_id = capture._file_identity(f[2].lstat())
            @contextmanager
            def replace_after_close(path):
                stream = actual(path)
                streams.append(stream)
                try:
                    yield stream
                finally:
                    stream.close()
                    if len(streams) == 1:
                        self.assertTrue(stream.closed)
                        os.replace(staged, path)
            waits = []
            with patch.object(auth, "_open_heartbeat_handle", replace_after_close), patch.object(auth, "_heartbeat_pause", waits.append):
                raw, binding = self.snapshot(f)
            self.assertNotEqual(capture._file_identity(f[2].lstat())[:2], old_id[:2])
            self.assertEqual(raw, new)
            self.assertEqual(binding["sha256"], hashlib.sha256(new).hexdigest())
            self.assertEqual(len(streams), 2)
            self.assertTrue(all(stream.closed for stream in streams))
            self.assertEqual(waits, [.010])
            self.observations.append({"case": self._testMethodName, "actualOrdinaryReplacement": True,
                "oldBytesReturned": False, "opens": 2, "replacementAfterOwnHandleClosed": True})

    def test_real_replacement_before_open_reselects_proven_version(self):
        with self.fixture() as f:
            actual, streams = auth._open_heartbeat_handle, []
            staged = f[2].with_name("heartbeat.json.staged-00000000-0000-4000-8000-000000000104")
            new = f[2].read_bytes() + b" "
            staged.write_bytes(new)
            def replacement(path):
                if not streams:
                    os.replace(staged, path)
                stream = actual(path)
                streams.append(stream)
                return stream
            with patch.object(auth, "_open_heartbeat_handle", replacement), patch.object(auth, "_heartbeat_pause", lambda value: None):
                raw, _ = self.snapshot(f)
            self.assertEqual(raw, new)
            self.assertEqual(len(streams), 2)
            self.assertTrue(all(stream.closed for stream in streams))

    def test_synthetic_native32_and33_bounded_reselect_then_success(self):
        for native in (32, 33):
            with self.subTest(winerror=native), self.fixture(str(native)) as f:
                actual, streams, waits, attempts = auth._open_heartbeat_handle, [], [], []
                error = OSError(13, "synthetic sharing classification only")
                error.winerror = native
                def opened(path):
                    attempts.append(True)
                    if len(attempts) < 3:
                        raise error
                    stream = actual(path)
                    streams.append(stream)
                    return stream
                with patch.object(auth, "_open_heartbeat_handle", opened) as opener, patch.object(auth, "_heartbeat_pause", waits.append):
                    self.snapshot(f)
                self.assertEqual(len(attempts), 3)
                self.assertEqual(waits, [.010, .010])
                self.assertTrue(streams[0].closed)

    def test_synthetic_native32_and33_exhaust_three_no_fourth(self):
        for native in (32, 33):
            with self.subTest(winerror=native), self.fixture(str(native)) as f:
                error = OSError(13, "synthetic exhausted sharing")
                error.winerror = native
                waits = []
                with patch.object(auth, "_open_heartbeat_handle", side_effect=error) as opener, patch.object(auth, "_heartbeat_pause", waits.append), self.assertRaises(OSError) as caught:
                    self.snapshot(f)
                self.assertIs(caught.exception, error)
                self.assertEqual(opener.call_count, 3)
                self.assertEqual(error.heartbeat_read["attempts"], 3)
                self.assertEqual(waits, [.010, .010])

    def test_synthetic_winerror5_plain13_missing_unknown_fail_once(self):
        errors = [OSError(13, "synthetic denied"), OSError(13, "synthetic plain errno13"),
            FileNotFoundError(2, "synthetic missing"), OSError(22, "synthetic unknown")]
        errors[0].winerror = 5
        for index, error in enumerate(errors):
            with self.subTest(error=index), self.fixture(str(index)) as f:
                with patch.object(auth, "_open_heartbeat_handle", side_effect=error) as opener, patch.object(auth, "_heartbeat_pause") as pause, self.assertRaises(OSError) as caught:
                    self.snapshot(f)
                self.assertIs(caught.exception, error)
                self.assertEqual(opener.call_count, 1)
                pause.assert_not_called()
                self.assertEqual(error.heartbeat_read["attempts"], 1)
                self.assertEqual(error.heartbeat_read["reasons"][0]["errno"], error.errno)
                self.assertEqual(error.heartbeat_read["reasons"][0]["winerror"], getattr(error, "winerror", None))

    def test_synthetic_metadata_or_read_sharing_is_not_open_retry(self):
        with self.fixture() as f:
            error = OSError(13, "synthetic handle metadata sharing")
            error.winerror, error.heartbeat_operation = 32, "handle_metadata"
            with patch.object(auth, "_open_heartbeat_handle", side_effect=error) as opener, self.assertRaises(OSError):
                self.snapshot(f)
            self.assertEqual(opener.call_count, 1)
            actual = auth._open_heartbeat_handle
            stream = actual(f[2])
            error = OSError(13, "synthetic read sharing")
            error.winerror = 33
            with patch.object(auth, "_open_heartbeat_handle", return_value=stream), patch.object(stream, "read", side_effect=error), self.assertRaises(OSError):
                self.snapshot(f)
            self.assertTrue(stream.closed)
            self.assertEqual(error.heartbeat_read["operation"], "read")
            self.assertEqual(error.heartbeat_read["attempts"], 1)

    def test_real_inplace_growth_truncation_and_same_size_mutation_refuse(self):
        for mutation in ("growth", "truncate", "same-size"):
            with self.subTest(mutation=mutation), self.fixture(mutation) as f:
                actual = auth._open_heartbeat_handle
                stream = actual(f[2])
                read = stream.read
                def mutate(size):
                    raw = read(size)
                    changed = raw + b" " if mutation == "growth" else raw[:-1] if mutation == "truncate" else raw.replace(b"executing", b"finished!")
                    f[2].write_bytes(changed)
                    os.utime(f[2], ns=(f[2].stat().st_atime_ns, f[2].stat().st_mtime_ns + 10000000))
                    return raw
                with patch.object(auth, "_open_heartbeat_handle", return_value=stream) as opener, patch.object(stream, "read", mutate), patch.object(auth, "_heartbeat_pause") as pause, self.assertRaises(ValueError):
                    self.snapshot(f)
                self.assertTrue(stream.closed)
                self.assertEqual(opener.call_count, 1)
                pause.assert_not_called()

    def test_wrong_schema_run_package_capability_pid_state_ttl_and_creation_refuse(self):
        fields = {"schemaVersion": "wrong", "runId": "other", "packageId": "other", "capabilityVersion": "other",
            "processId": os.getpid() + 1, "processStartIdentity": "other", "executionState": "finished", "ttlSeconds": 121}
        for key, value in fields.items():
            with self.subTest(field=key), self.fixture(key, {key: value}) as f:
                actual = auth._open_heartbeat_handle
                stream = actual(f[2])
                with patch.object(auth, "_open_heartbeat_handle", return_value=stream) as opener, patch.object(auth, "_heartbeat_pause") as pause, self.assertRaises(ValueError):
                    self.snapshot(f)
                self.assertTrue(stream.closed)
                self.assertEqual(opener.call_count, 1)
                pause.assert_not_called()

    def test_stale_future_malformed_duplicate_and_nonfinite_fail_once(self):
        from datetime import timedelta
        rows = [("stale", {"heartbeatAtUtc": (datetime.now(timezone.utc) - timedelta(seconds=121)).isoformat()}, None),
            ("future", {"heartbeatAtUtc": (datetime.now(timezone.utc) + timedelta(seconds=301)).isoformat()}, None),
            ("malformed", None, b"{"), ("duplicate", None, b'{"schemaVersion":1,"schemaVersion":2}'),
            ("nonfinite", None, b'{"number":NaN}')]
        for label, changes, raw in rows:
            with self.subTest(case=label), self.fixture(label, changes, raw) as f:
                actual = auth._open_heartbeat_handle
                stream = actual(f[2])
                with patch.object(auth, "_open_heartbeat_handle", return_value=stream) as opener, patch.object(auth, "_heartbeat_pause") as pause, self.assertRaises(ValueError):
                    self.snapshot(f)
                self.assertTrue(stream.closed)
                self.assertEqual(opener.call_count, 1)
                pause.assert_not_called()

    def test_malformed_old_version_does_not_gain_replacement_retry(self):
        with self.fixture(raw=b"{") as f:
            actual = auth._open_heartbeat_handle
            staged = f[2].with_name("heartbeat.json.staged-00000000-0000-4000-8000-000000000104")
            staged.write_bytes(capture.json_bytes({"schemaVersion": "ai-painter-current-active-execution-heartbeat-v1", **f[4],
                "executionState": "executing", "ttlSeconds": 120, "heartbeatAtUtc": datetime.now(timezone.utc).isoformat()}))
            streams = []
            @contextmanager
            def replaced_on_close(path):
                stream = actual(path)
                streams.append(stream)
                try:
                    yield stream
                finally:
                    stream.close()
                    os.replace(staged, path)
            with patch.object(auth, "_open_heartbeat_handle", replaced_on_close), patch.object(auth, "_heartbeat_pause") as pause, self.assertRaises(ValueError) as caught:
                self.snapshot(f)
            self.assertEqual(caught.exception.heartbeat_read["operation"], "content")
            self.assertEqual(len(streams), 1)
            self.assertTrue(streams[0].closed)
            self.assertIsInstance(json.loads(f[2].read_bytes()), dict)
            pause.assert_not_called()

    def test_100ms_total_window_refuses_result_and_closes_handle(self):
        with self.fixture() as f:
            stream = auth._open_heartbeat_handle(f[2])
            with patch.object(auth, "_open_heartbeat_handle", return_value=stream), patch.object(auth, "_heartbeat_clock", side_effect=[0, 0, .101, .101]), patch.object(auth, "_heartbeat_pause") as pause, self.assertRaisesRegex(ValueError, "window exhausted") as caught:
                self.snapshot(f)
            self.assertTrue(stream.closed)
            self.assertEqual(caught.exception.heartbeat_read["attempts"], 1)
            self.assertGreaterEqual(caught.exception.heartbeat_read["elapsedMilliseconds"], 100)
            pause.assert_not_called()

    def test_synthetic_parent_identity_root_and_reparse_fail_without_retry(self):
        with self.fixture() as f:
            actual, streams = auth._open_heartbeat_handle, []
            original_check = auth._heartbeat_check_parents
            checks = []
            def changed_parent(reader, parents):
                checks.append(True)
                if len(checks) > 1:
                    parents = ((parents[0][0], parents[0][1], parents[0][2] + 1), *parents[1:])
                original_check(reader, parents)
            def opened(path):
                stream = actual(path)
                streams.append(stream)
                return stream
            with patch.object(auth, "_open_heartbeat_handle", opened), patch.object(auth, "_heartbeat_check_parents", changed_parent), patch.object(auth, "_heartbeat_pause") as pause, self.assertRaisesRegex(ValueError, "parent identity"):
                self.snapshot(f)
            self.assertEqual(len(streams), 1)
            self.assertTrue(streams[0].closed)
            pause.assert_not_called()
            for negative in ("root", "reparse"):
                with self.subTest(case=negative), patch.object(auth, "_open_heartbeat_handle") as opener:
                    if negative == "root":
                        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.base)}), self.assertRaisesRegex(ValueError, "configuration changed"):
                            self.snapshot(f)
                    else:
                        info = f[2].lstat()
                        original_lstat = Path.lstat
                        proxy = types.SimpleNamespace(**{name: getattr(info, name) for name in ("st_mode", "st_size", "st_dev", "st_ino")}, st_file_attributes=0x400)
                        def redirected(path, *args, **kwargs):
                            return proxy if path == f[2] else original_lstat(path, *args, **kwargs)
                        with patch.object(Path, "lstat", redirected), self.assertRaisesRegex(ValueError, "redirection"):
                            self.snapshot(f)
                    opener.assert_not_called()

    def test_synthetic_oversize_metadata_and_real_missing_fail_before_open(self):
        with self.fixture() as f:
            original = Path.lstat
            def oversized(path, *args, **kwargs):
                info = original(path, *args, **kwargs)
                return _NegativeSizeStatProxy(info, auth.CONTROL_JSON_MAX + 1) if path == f[2] else info
            with patch.object(Path, "lstat", oversized), patch.object(auth, "_open_heartbeat_handle") as opener, self.assertRaisesRegex(ValueError, "byte ceiling"):
                self.snapshot(f)
            opener.assert_not_called()
            missing_scope = {**f[3], "runId": "missing-heartbeat-t104"}
            missing_logical = auth.ROOT_PREFIX + missing_scope["runId"] + "/heartbeat.json"
            missing_path = f[0].path(missing_logical)
            missing_path.parent.mkdir(parents=True)
            missing = (f[0], missing_logical, missing_path, missing_scope, f[4])
            with patch.object(auth, "_open_heartbeat_handle") as opener, self.assertRaises(FileNotFoundError):
                self.snapshot(missing)
            opener.assert_not_called()

    def test_observed_environment_and_other_paths_grant_no_reader_scope(self):
        with self.fixture() as f:
            reader, logical, physical, scope, _ = f
            reader.observed[logical] = hashlib.sha256(physical.read_bytes()).hexdigest()
            with patch.dict(os.environ, {"T_Q4_HEARTBEAT_ALLOW": "1"}), patch.object(auth, "_open_heartbeat_handle") as opener:
                with self.assertRaisesRegex(ValueError, "outside verified"):
                    reader.snapshot(logical)
                with self.assertRaisesRegex(ValueError, "exact own phase heartbeat"):
                    auth._snapshot_heartbeat(reader, auth.REGISTRY, scope)
                with self.assertRaisesRegex(ValueError, "exact own phase heartbeat"):
                    auth._snapshot_heartbeat(reader, logical.replace(scope["runId"], "other-run"), scope)
                opener.assert_not_called()
            registry = reader.path(auth.REGISTRY)
            registry.parent.mkdir(parents=True)
            registry.write_bytes(b'{"registryRevision":1}')
            original = auth.RuntimeMap.binding
            with patch.object(auth.RuntimeMap, "binding", autospec=True, side_effect=original) as binder, patch.object(auth, "_open_heartbeat_handle", side_effect=AssertionError("registry must keep original path")):
                raw, binding = reader.snapshot(auth.REGISTRY)
            self.assertEqual(raw, registry.read_bytes())
            self.assertEqual(binding["sha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(binder.call_count, 1)

    def test_error_metadata_is_bounded_and_keeps_native_code_without_gpu(self):
        import qualify_stage4_ecology_decode1_weight_quality_gpu_v1 as qualifier
        error = OSError(13, "synthetic original failure")
        error.winerror = 5
        original_error = (error.errno, error.winerror, str(error))
        error.heartbeat_read = {"schema": "ecology-heartbeat-read-error-v1", "logicalPath": "x" * 5000,
            "physicalPath": "y" * 5000, "attempts": 3, "elapsedMilliseconds": 23.0, "operation": "open",
            "reasons": [{"attempt": i, "operation": "open", "reason": "failure", "errno": 13, "winerror": 5} for i in range(100)]}
        result = qualifier._heartbeat_error_metadata(error)
        self.assertEqual(len(result["logicalPath"]), 4096)
        self.assertEqual(len(result["physicalPath"]), 4096)
        self.assertEqual(len(result["reasons"]), 3)
        self.assertEqual(result["reasons"][0]["winerror"], 5)
        self.assertLess(len(capture.json_bytes(result)), 16384)
        self.assertEqual((error.errno, error.winerror, str(error)), original_error)
        self.assertIsNone(qualifier._heartbeat_error_metadata(ValueError("unrelated")))
        self.assertEqual(error.heartbeat_read["logicalPath"], "x" * 5000)

    def test_real_replacement_exhaustion_closes_all_three_handles(self):
        with self.fixture() as f:
            actual, streams = auth._open_heartbeat_handle, []
            @contextmanager
            def replaced(path):
                stream = actual(path)
                streams.append(stream)
                try:
                    yield stream
                finally:
                    stream.close()
                    staged = path.with_name("heartbeat.json.staged-00000000-0000-4000-8000-000000000104")
                    staged.write_bytes(path.read_bytes() + b" ")
                    os.replace(staged, path)
            with patch.object(auth, "_open_heartbeat_handle", replaced), patch.object(auth, "_heartbeat_pause", lambda delay: None), self.assertRaises(auth._HeartbeatReplacement) as caught:
                self.snapshot(f)
            self.assertEqual(len(streams), 3)
            self.assertTrue(all(stream.closed for stream in streams))
            self.assertEqual(caught.exception.heartbeat_read["attempts"], 3)
            self.assertTrue(all(row["reason"] == "ordinary_path_replacement" for row in caught.exception.heartbeat_read["reasons"]))

    def test_real_directory_control_refuses_before_open(self):
        with self.fixture() as f:
            scope = {**f[3], "runId": "directory-heartbeat-t104"}
            logical = auth.ROOT_PREFIX + scope["runId"] + "/heartbeat.json"
            physical = f[0].path(logical)
            physical.mkdir(parents=True)
            with patch.object(auth, "_open_heartbeat_handle") as opener, self.assertRaisesRegex(ValueError, "ordinary file"):
                auth._snapshot_heartbeat(f[0], logical, scope, f[4])
            opener.assert_not_called()

    def test_hash_and_success_log_costs_count_in_same_100ms_window(self):
        with self.fixture("hash") as f:
            current = [0.0]
            original_digest = auth._heartbeat_digest
            streams = []
            actual = auth._open_heartbeat_handle
            def opened(path):
                stream = actual(path)
                streams.append(stream)
                return stream
            def slow_hash(raw):
                result = original_digest(raw)
                current[0] = .101
                return result
            with patch.object(auth, "_heartbeat_clock", lambda: current[0]), patch.object(auth, "_heartbeat_digest", slow_hash), patch.object(auth, "_open_heartbeat_handle", opened), patch.object(auth, "_heartbeat_log") as log, self.assertRaisesRegex(ValueError, "window exhausted") as caught:
                self.snapshot(f)
            log.assert_not_called()
            self.assertEqual(caught.exception.heartbeat_read["operation"], "hash")
            self.assertTrue(streams[0].closed)
        for slow in (False, True):
            with self.subTest(logOverruns=slow), self.fixture("log-" + str(slow)) as f:
                current, attempts, records = [0.0], [], []
                error = OSError(13, "synthetic sharing for success observation")
                error.winerror = 32
                actual = auth._open_heartbeat_handle
                def sharing_then_open(path):
                    attempts.append(True)
                    if len(attempts) == 1:
                        raise error
                    return actual(path)
                def log(record):
                    records.append(record)
                    if slow:
                        current[0] = .101
                with patch.object(auth, "_heartbeat_clock", lambda: current[0]), patch.object(auth, "_heartbeat_pause", lambda seconds: None), patch.object(auth, "_open_heartbeat_handle", sharing_then_open), patch.object(auth, "_heartbeat_log", log):
                    if slow:
                        with self.assertRaisesRegex(ValueError, "window exhausted") as caught:
                            self.snapshot(f)
                        self.assertEqual(caught.exception.heartbeat_read["operation"], "observation_log")
                    else:
                        self.snapshot(f)
                self.assertEqual(len(records), 1)
                self.assertLessEqual(len(records[0].encode()), 16384)
                observation = json.loads(records[0])
                self.assertEqual(observation["schema"], "ecology-heartbeat-read-observation-v1")
                self.assertEqual(observation["attempts"], 2)
                self.assertEqual(len(observation["reasons"]), 2)
                self.assertEqual(observation["reasons"][0]["winerror"], 32)
                self.assertIsNone(observation["reasons"][1]["winerror"])
                self.assertEqual(observation["logicalPath"], f[1])


class QualityArtifactWriteCpuTests(unittest.TestCase):
    """Real isolated RuntimeMap IO; fixture results never authenticate a Run."""
    @contextmanager
    def fixture(self):
        import uuid
        base = Path(os.environ.get("T_Q4_75_TEST_ROOT", str(ROOT / ".runtime/ai-painter/ecology-quality-v1-development/t-qv12-01"))).resolve(strict=True)
        target = base / ("artifact-component-" + uuid.uuid4().hex)
        project, data = target / "project", target / "data"
        project.mkdir(parents=True)
        (data / "hot/runtime").mkdir(parents=True)
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(data)}):
            yield project, auth.Reader(project)

    def test_checkpoint_binary_above_json_limit_is_written_once_and_json_is_rejected(self):
        raw = b"q" * (capture.MAX_JSON + 1)
        with self.fixture() as (target, reader), patch.dict(os.environ, {"DETAIL_WEIGHT_OUTPUT_ROOTS": "[]"}):
            result = worker.write(target, "checkpoint.pt", raw)
            self.assertEqual(result["sha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual((target / "checkpoint.pt").read_bytes(), raw)
            self.assertEqual(reader.read(result, worker.checkpoint.MAX_BYTES), raw)
            with self.assertRaisesRegex(ValueError, "binding absent/oversized"):
                reader.mapping.binding(result)
            with self.assertRaises(FileExistsError):
                worker.write(target, "checkpoint.pt", raw)
            for name in ("oversize.json", "json-disguised-as-checkpoint.pt"):
                with self.assertRaisesRegex(ValueError, "metadata JSON ceiling exceeded"):
                    worker.write(target, name, {"value": "q" * capture.MAX_JSON})
                self.assertFalse((target / name).exists())

    def test_checkpoint_write_preserves_terminal_reserve_before_file_creation(self):
        raw = b"q" * 128
        with self.fixture() as (target, reader), patch.dict(os.environ, {
                "DETAIL_WEIGHT_OUTPUT_ROOTS": '["owned"]', "DETAIL_WEIGHT_OUTPUT_MAX": str(len(raw) + 65535)}):
            (target / "owned").mkdir()
            with self.assertRaisesRegex(ValueError, "terminal reserve"):
                worker.write(target, "owned/checkpoint.pt", raw)
            self.assertFalse((target / "owned/checkpoint.pt").exists())

    def test_binary_above_checkpoint_ceiling_refuses_before_creation(self):
        with self.fixture() as (target, reader), patch.dict(os.environ, {"DETAIL_WEIGHT_OUTPUT_ROOTS": "[]"}):
            with self.assertRaisesRegex(ValueError, "artifact byte ceiling"):
                worker.write(target, "oversize.pt", b"q" * (worker.checkpoint.MAX_BYTES + 1))
            self.assertFalse((target / "oversize.pt").exists())
            self.assertEqual(worker.checkpoint.MAX_BYTES, 64 * 1024**2)
            self.assertEqual(capture.MAX_JSON, 2 * 1024**2)
            self.assertEqual(capture.MAX_EXECUTION, 128 * 1024**2)

    def test_post_write_verification_still_rehashes_actual_file(self):
        original = auth.RuntimeMap.binding
        calls = []
        def tamper(mapping, binding, *, maximum=capture.MAX_JSON):
            calls.append(maximum)
            mapping.path(binding["path"]).write_bytes(b"tampered")
            return original(mapping, binding, maximum=maximum)
        with self.fixture() as (target, reader), patch.dict(os.environ, {"DETAIL_WEIGHT_OUTPUT_ROOTS": "[]"}), \
                patch.object(auth.RuntimeMap, "binding", tamper):
            with self.assertRaisesRegex(ValueError, "binding SHA differs"):
                worker.write(target, "tampered.pt", b"original")
            self.assertEqual((target / "tampered.pt").read_bytes(), b"tampered")
        self.assertEqual(calls, [worker.checkpoint.MAX_BYTES])

    def test_full_graph_checkpoint_cannot_borrow_training_budget_in_cpu_batch(self):
        _, _, raw, _ = _fresh_quality_checkpoint_io_fixture()
        self.assertGreater(len(raw), 8 * 1024**2)
        with self.fixture() as (target, reader), patch.dict(os.environ, {
                "DETAIL_WEIGHT_OUTPUT_ROOTS": '["owned"]', "DETAIL_WEIGHT_OUTPUT_MAX": str(8 * 1024**2)}):
            (target / "owned").mkdir()
            with self.assertRaisesRegex(ValueError, "terminal reserve"):
                worker.write(target, "owned/checkpoint.pt", raw)
            self.assertFalse((target / "owned/checkpoint.pt").exists())


def _fresh_quality_checkpoint_io_fixture():
    """Fresh full graph with synthetic Run/counts; zero numerical operations."""
    import test_ecology_decode1_weight_checkpoint_cpu as fixture
    torch = fixture.torch
    threads = torch.get_num_threads()
    torch.set_num_threads(2)
    try:
        with torch.random.fork_rng(devices=[]), torch.device("cpu"):
            configuration = fixture.configuration()
            torch.manual_seed(configuration["seed"])
            model = fixture.training.build_fresh_object_ecology_decode1_weight_precision(condition_channel_order=fixture.ORDER)
            critic = fixture.build_conditional_texture_discriminator()
            reader = auth.Reader(ROOT)
            programs = {"frozen-" + role: auth.historical_source_binding(role, binding) for role, binding in auth.read_json(reader, auth.FROZEN_PLAN)["programBindings"].items()}
            paths = {**auth.ROLES, "storageAdapter": "scripts/lib/ai-pet-world-storage.mjs",
                "materializer": "scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs",
                "autonomousLoop": "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
                "currentRegistry": "src/server/ai-painter-current-execution-registry.mjs"}
            for role, logical in paths.items():
                programs[role] = {"path": logical, "sha256": hashlib.sha256(reader.path(logical).read_bytes()).hexdigest()}
            kwargs = dict(configuration=configuration, run_id="synthetic-quality-binary-io",
                package_binding={"path": ".runtime/synthetic-quality-io/package.json", "sha256": "a" * 64},
                dataset_binding={"path": "data/synthetic-quality-io/manifest.json", "sha256": "b" * 64},
                epoch=12, selection=fixture.selection(), counts={"generator": 576, "discriminator": 576},
                program_bindings=programs,
                plan_binding={"path": ".runtime/synthetic-quality-io/quality-plan.json", "sha256": "d" * 64})
            raw = worker.checkpoint.encode(model, critic, **kwargs)
            return model, critic, raw, kwargs
    finally:
        torch.set_num_threads(threads)


def run_quality_checkpoint_io_regression():
    """Standalone real-size IO regression, never owned CPU/GPU acceptance.

    A full graph is larger than the 8 MiB managed CPU output allowance. This
    separately invoked component writes under an explicit 128 MiB private
    fixture ceiling. Managed CPU tests above retain their original allowance
    and verify that this artifact is refused there before file creation.
    """
    import test_ecology_decode1_weight_checkpoint_cpu as fixture
    model, critic, raw, kwargs = _fresh_quality_checkpoint_io_fixture()
    auth.require(len(raw) > 8 * 1024**2 and abs(len(raw) - 10076677) < 65536, "full graph regression size differs")
    case = QualityArtifactWriteCpuTests()
    threads = fixture.torch.get_num_threads()
    fixture.torch.set_num_threads(2)
    try:
        with case.fixture() as (target, reader), patch.dict(os.environ, {
                "DETAIL_WEIGHT_OUTPUT_ROOTS": '["owned"]', "DETAIL_WEIGHT_OUTPUT_MAX": str(capture.MAX_EXECUTION)}):
            (target / "owned").mkdir()
            binding = worker.write(target, "owned/checkpoint.pt", raw)
            readback = reader.read(binding, worker.checkpoint.MAX_BYTES)
            auth.require(readback == raw, "checkpoint IO bytes differ")
            # The shared default remains the JSON ceiling, even for a .pt path.
            with case.assertRaisesRegex(ValueError, "binding absent/oversized"):
                reader.mapping.binding(binding)
            with case.assertRaises(FileExistsError):
                worker.write(target, binding["path"], raw)
            with case.assertRaisesRegex(ValueError, "binding SHA differs"):
                reader.read({**binding, "sha256": "0" * 64}, worker.checkpoint.MAX_BYTES)
            before = [{name: value.detach().clone() for name, value in network.state_dict().items()}
                for network in (model, critic)]
            with case.assertRaises(ValueError):
                worker.checkpoint.reload(readback, model=model, critic=critic,
                    **{**kwargs, "counts": {"generator": 575, "discriminator": 576}})
            for network, saved in zip((model, critic), before):
                for name, value in network.state_dict().items():
                    auth.require(fixture.torch.equal(value.reshape(-1).view(fixture.torch.uint8),
                        saved[name].reshape(-1).view(fixture.torch.uint8)), "negative reload mutated state")
            with fixture.torch.no_grad():
                next(model.parameters()).add_(.5)
                next(critic.parameters()).add_(.5)
            reloaded = worker.checkpoint.reload(readback, model=model, critic=critic, **kwargs)
            auth.require(reloaded == {"modelStateLoaded": True, "automaticResumeAllowed": False,
                "checkpointQualified": False}, "component reload claimed qualification")
            for network, saved in zip((model, critic), before):
                for name, value in network.state_dict().items():
                    auth.require(fixture.torch.equal(value.reshape(-1).view(fixture.torch.uint8),
                        saved[name].reshape(-1).view(fixture.torch.uint8)), "strict reload byte mismatch")
            reader.unchanged()
            return {"schema": "quality-real-size-checkpoint-io-regression-v1", "status": "passed_component_only",
                "fixtureProject": str(target), "checkpointPhysicalPath": str(reader.path(binding["path"])),
                "checkpoint": binding, "actualBytes": len(raw), "observedProductionBytes": 10076677,
                "binaryWriteLimitBytes": worker.checkpoint.MAX_BYTES, "jsonLimitBytes": capture.MAX_JSON,
                "fixtureOutputLimitBytes": capture.MAX_EXECUTION, "programRoles": len(kwargs["program_bindings"]),
                "strictReload": reloaded, "negativeCasesPassed": ["default_json_ceiling", "exclusive_no_overwrite",
                    "wrong_file_sha", "wrong_counts_before_install"], "oldCheckpointRead": False,
                "actualOptimization": False, "productionQualified": False}
    finally:
        fixture.torch.set_num_threads(threads)


class ResourceGuardSyntheticCpuTests(unittest.TestCase):
    """Explicit fake GPU/query observations; never physical CUDA qualification."""
    UUID = "abcde098-1234-5678-9abc-000000000098"
    OTHER = "abcde098-1234-5678-9abc-000000000099"
    MIB = 1024**2

    def setUp(self):
        from run_stage4_mvp_structured_object_v18_readonly_gpu_qualification import check_memory
        self.clock = [10.0]
        self.initialized, self.ordinal, self.threads = True, 0, 2
        self.free, self.total = 6144 * self.MIB, 8192 * self.MIB
        self.reserved, self.allocated = 512 * self.MIB, 256 * self.MIB
        self.disk_free, self.output_bytes = 2048 * self.MIB, 0
        self.cuda_value = self.UUID
        self.memory_calls, self.synchronizations = [], []

        def memory(**values):
            self.memory_calls.append(values)
            return check_memory(**values)  # Actual original CPU safety calculation.

        fake_cuda = types.SimpleNamespace(is_initialized=lambda: self.initialized,
            current_device=lambda: self.ordinal, synchronize=lambda: self.synchronizations.append(True),
            mem_get_info=lambda: (self.free, self.total), max_memory_reserved=lambda: self.reserved,
            max_memory_allocated=lambda: self.allocated,
            get_device_properties=lambda ordinal: types.SimpleNamespace(uuid=self.cuda_value, name="synthetic-only"))
        fake_torch = types.SimpleNamespace(cuda=fake_cuda, get_num_threads=lambda: self.threads)
        fake_shared = types.SimpleNamespace(v24=types.SimpleNamespace(core=types.SimpleNamespace(
            gpu=types.SimpleNamespace(check_memory=memory))))
        self.query = unittest.mock.Mock(return_value=types.SimpleNamespace(returncode=0,
            stdout="0, GPU-" + self.UUID + ", 41\n", stderr=""))
        self.binding = {"path": "synthetic-only/package.json", "sha256": "0" * 64}
        self.plan = {"outputRoot": "synthetic-only"}
        self.context_reader = types.SimpleNamespace(root=ROOT.absolute(), observed={"synthetic-source": "unchanged"})
        self.context = auth.Context(self.context_reader, copy.deepcopy(self.binding),
            {"synthetic": True}, copy.deepcopy(self.plan))
        self.live_auth = unittest.mock.Mock(return_value=self.context)
        self.live_verify = unittest.mock.Mock(return_value={"status": "live_identity_authenticated_not_qualified"})
        self.loaded_verify = unittest.mock.Mock(return_value={"qualified": False})
        def local_proxy(module, **overrides):
            return types.SimpleNamespace(**{**vars(module), **overrides})
        self.original_shared = (auth.Reader, time.monotonic, subprocess.run, capture.directory_bytes)
        patches = [patch.object(worker, "runtime", return_value=(fake_torch, None, fake_shared)),
            patch.object(worker, "auth", local_proxy(auth, Reader=lambda root: types.SimpleNamespace(path=lambda logical: ROOT),
                verify_live_context=self.live_verify)),
            patch.object(worker, "verify_loaded_sources", self.loaded_verify),
            patch.object(worker, "shutil", local_proxy(shutil, disk_usage=lambda path: types.SimpleNamespace(free=self.disk_free))),
            patch.object(worker, "capture", local_proxy(capture, directory_bytes=lambda path: self.output_bytes)),
            patch.object(worker, "subprocess", local_proxy(subprocess, run=self.query)), patch.object(worker, "authenticate_live", self.live_auth),
            patch.object(worker, "time", local_proxy(time, monotonic=lambda: self.clock[0])),
            patch.object(worker, "os", local_proxy(os, environ={**os.environ, "DETAIL_WEIGHT_OUTPUT_ROOTS": "[]", "DETAIL_WEIGHT_OUTPUT_MAX": str(capture.MAX_EXECUTION)}))]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        self.binding = {"path": "synthetic-only/package.json", "sha256": "0" * 64}
        self.plan = {"outputRoot": "synthetic-only"}

    def guard(self):
        return worker.ResourceGuard(self.binding, self.plan, root=ROOT, started=self.clock[0], gpu_gate=True)

    def test_worker_proxies_leave_shared_reader_clock_process_and_meter_unchanged(self):
        self.assertEqual((auth.Reader, time.monotonic, subprocess.run, capture.directory_bytes), self.original_shared)
        self.assertIsNot(worker.auth, auth)
        self.assertIsNot(worker.time, time)
        self.assertIsNot(worker.subprocess, subprocess)
        self.assertIsNot(worker.capture, capture)

    def test_uuid_standard_forms_compare_exact_128_bits(self):
        expected = bytes.fromhex(self.UUID.replace("-", ""))
        for text in (self.UUID, self.UUID.upper(), "GPU-" + self.UUID, "GPU-" + self.UUID.upper()):
            with self.subTest(text=text):
                bits, canonical = worker._gpu_uuid(text)
                self.assertEqual(bits, expected)
                self.assertEqual(len(bits), 16)
                self.assertEqual(canonical, "GPU-" + self.UUID)
        self.assertNotEqual(worker._gpu_uuid(self.OTHER)[0], expected)
        self.assertIs(worker._CUDA_UUID_TYPE, vars(worker._torch_provider._C).get("_CUuuid"))

    def test_uuid_invalid_objects_and_text_refuse_without_stringifying(self):
        called = []
        class Impostor:
            def __str__(instance):
                called.append(True)
                return self.UUID
        class StringSubclass(str):
            pass
        invalid = (None, True, 123, self.UUID.encode(), Impostor(), StringSubclass(self.UUID),
            "", self.UUID.replace("-", ""), " " + self.UUID, self.UUID + " ", self.UUID + "\n",
            "GPU-GPU-" + self.UUID, "MIG-" + self.UUID, "gpu-" + self.UUID,
            "UUID-" + self.UUID, self.UUID[:-1], self.UUID[:-1] + "Z")
        for value in invalid:
            with self.subTest(valueType=type(value).__name__), self.assertRaises(ValueError):
                worker._gpu_uuid(value)
        for value in (None, Impostor(), StringSubclass(self.UUID)):
            with self.assertRaisesRegex(ValueError, "provider type"):
                worker._cuda_uuid_text(value)
        self.assertEqual(called, [])

    def test_driver_rows_unique_strict_and_thermal_ceiling(self):
        row = "0, GPU-" + self.UUID + ", 85"
        actual = worker._driver_device_zero(row + "\n1,GPU-" + self.OTHER + ",99\n")
        self.assertEqual(actual, (*worker._gpu_uuid(self.UUID), 85))
        invalid = ("", row + "\n" + row, row + "\n1,GPU-" + self.UUID + ",41",
            "bad", row + "\nbad", "1,GPU-" + self.OTHER + ",41", row + "\n\n",
            "00,GPU-" + self.UUID + ",41", "0,  GPU-" + self.UUID + ",41",
            "0,GPU-" + self.UUID + " ,41", "0,GPU-" + self.UUID + ",N/A",
            "0,GPU-" + self.UUID + ",-1", "0,GPU-" + self.UUID + ",41.0",
            "0,MIG-" + self.UUID + ",41", "0,GPU-" + self.UUID + ",86")
        for text in invalid:
            with self.subTest(text=text), self.assertRaises(ValueError):
                worker._driver_device_zero(text)

    def test_resource_guard_same_uuid_format_and_repeated_live_check(self):
        guard = self.guard()
        guard()
        self.assertEqual(guard.device_identity, {"ordinal": 0, "uuid": "GPU-" + self.UUID})
        self.assertEqual(self.memory_calls[-1]["fraction"], .7)
        self.live_auth.assert_called_once_with(self.binding, root=ROOT, phase=None)
        self.cuda_value = "GPU-" + self.UUID.upper()
        self.query.return_value.stdout = "0, GPU-" + self.UUID.upper() + ", 85\n"
        self.clock[0] += 10
        guard()
        self.assertEqual(self.live_auth.call_count, 1)
        self.live_verify.assert_called_once_with(self.context, expected_phase=None)
        self.loaded_verify.assert_called_once_with(self.context_reader, self.context.plan)
        self.assertEqual(self.query.call_count, 2)
        self.assertEqual(guard.device_identity["uuid"], "GPU-" + self.UUID)
        self.assertEqual(self.synchronizations, [True, True])

    def test_resource_guard_query_and_identity_failures(self):
        for response, error in ((types.SimpleNamespace(returncode=9, stdout="", stderr="synthetic"), "query exit"),
            (types.SimpleNamespace(returncode=0, stdout="0,GPU-" + self.OTHER + ",41", stderr=""), "UUID mismatch"),
            (types.SimpleNamespace(returncode=0, stdout="0,GPU-" + self.UUID + ",86", stderr=""), "temperature"),
            (types.SimpleNamespace(returncode=0, stdout="0,GPU-" + self.UUID + ",41\n0,GPU-" + self.UUID + ",41", stderr=""), "duplicate")):
            self.query.return_value = response
            with self.subTest(error=error), self.assertRaisesRegex(ValueError, error):
                self.guard()()
        for exception in (OSError("synthetic only"), subprocess.TimeoutExpired("synthetic only", 10)):
            self.query.side_effect = exception
            with self.assertRaisesRegex(ValueError, "query failed"):
                self.guard()()
        self.assertEqual(self.live_auth.call_count, 0)

    def test_resource_guard_identity_drift_refuses(self):
        guard = self.guard()
        guard()
        self.cuda_value = self.OTHER
        self.query.return_value.stdout = "0,GPU-" + self.OTHER + ",41"
        self.clock[0] += 10
        with self.assertRaisesRegex(ValueError, "identity changed"):
            guard()
        self.assertEqual(guard.device_identity["uuid"], "GPU-" + self.UUID)
        self.assertEqual(self.live_auth.call_count, 1)

    def test_resource_guard_original_resource_floors_and_memory_fraction(self):
        for field, value, error in (("disk_free", 2048 * self.MIB - 1, "disk safety"),
            ("free", 2048 * self.MIB - 1, "VRAM safety"),
            ("output_bytes", capture.MAX_EXECUTION - 65535, "terminal reserve"),
            ("reserved", 6144 * self.MIB, "VRAM exceeds"),
            ("allocated", self.reserved + 1, "VRAM exceeds"),
            ("initialized", False, "cannot initialize"), ("ordinal", 1, "ordinal"),
            ("threads", 3, "CPU deadline")):
            original = getattr(self, field)
            setattr(self, field, value)
            try:
                with self.subTest(field=field), self.assertRaisesRegex(ValueError, error):
                    self.guard()()
            finally:
                setattr(self, field, original)
        self.total, self.free = 16384 * self.MIB, 4096 * self.MIB
        with self.assertRaisesRegex(ValueError, "VRAM exceeds"):
            self.guard()()
        self.total, self.free = 4096 * self.MIB, 2048 * self.MIB
        guard = self.guard()
        guard()  # Exact original disk/VRAM floor and <=.7 safety calculation.
        self.clock[0] += 600
        with self.assertRaisesRegex(ValueError, "wall/CPU deadline"):
            guard()

    def test_resource_guard_live_auth_refusal_and_gate_canonical_binding(self):
        self.live_auth.side_effect = ValueError("synthetic live context refused")
        guard = self.guard()
        with self.assertRaisesRegex(ValueError, "live context refused"):
            guard()
        self.assertIsNone(guard.last)
        self.live_auth.assert_called_once_with(self.binding, root=ROOT, phase=None)
        # The original57 include actual live-context validation negatives.
        fixture = ExecutionProtocolCpuTests("test_own_gpu_full48_positive_and_missing_wrong_source_counts_updates")
        fixture.setUp()
        gate = fixture.gpu()
        # All gate/store reads here are explicitly synthetic, no CUDA calls.
        binding = fixture.store.put(fixture.output + "/gpu-gate.json", gate)
        self.assertEqual(worker.verify_gpu_gate(fixture.store, fixture.plan, fixture.package_binding, binding), gate)
        for value in (self.UUID, "GPU-" + self.UUID.upper(), "GPU-synthetic-fixture", "GPU-GPU-" + self.UUID):
            changed = copy.deepcopy(gate)
            changed["deviceIdentity"]["uuid"] = value
            binding = fixture.store.put(fixture.output + "/gpu-gate.json", changed)
            with self.assertRaises(ValueError):
                worker.verify_gpu_gate(fixture.store, fixture.plan, fixture.package_binding, binding)


    def test_context_retained_with_same_reader_observations_each_period(self):
        guard = self.guard()
        observations = self.context_reader.observed
        for index in range(4):
            guard()
            self.clock[0] += 10
            self.assertIs(self.context_reader.observed, observations)
            self.assertEqual(observations, {"synthetic-source": "unchanged"})
        self.live_auth.assert_called_once_with(self.binding, root=ROOT, phase=None)
        self.assertEqual(self.live_verify.call_args_list, [unittest.mock.call(self.context, expected_phase=None)] * 3)
        self.assertEqual(self.loaded_verify.call_args_list,
            [unittest.mock.call(self.context_reader, self.context.plan)] * 3)

    def test_follow_live_refusal_never_rebuilds_or_advances_period(self):
        guard = self.guard()
        guard()
        previous = guard.last
        self.clock[0] += 10
        self.live_verify.side_effect = ValueError("synthetic live identity drift")
        for _ in range(2):
            with self.assertRaisesRegex(ValueError, "live identity drift"):
                guard()
            self.assertEqual(guard.last, previous)
        self.assertEqual(self.live_auth.call_count, 1)
        self.assertEqual(self.live_verify.call_args_list, [unittest.mock.call(self.context, expected_phase=None)] * 2)
        self.loaded_verify.assert_not_called()
        self.assertEqual(self.context_reader.observed, {"synthetic-source": "unchanged"})

    def test_follow_loaded_source_refusal_never_rebuilds_or_clears_reader(self):
        guard = self.guard()
        guard()
        previous = guard.last
        self.clock[0] += 10
        self.loaded_verify.side_effect = ValueError("synthetic newly loaded source refused")
        for _ in range(2):
            with self.assertRaisesRegex(ValueError, "newly loaded source refused"):
                guard()
            self.assertEqual(guard.last, previous)
        self.assertEqual(self.live_auth.call_count, 1)
        self.assertEqual(self.live_verify.call_args_list, [unittest.mock.call(self.context, expected_phase=None)] * 2)
        self.assertEqual(self.loaded_verify.call_args_list,
            [unittest.mock.call(self.context_reader, self.context.plan)] * 2)
        self.assertEqual(self.context_reader.observed, {"synthetic-source": "unchanged"})

    def test_first_context_type_binding_root_and_plan_must_match(self):
        candidates = [(None, "type"), (types.SimpleNamespace(), "type"),
            (auth.Context(self.context_reader, {**self.binding, "sha256": "1" * 64}, {}, self.context.plan), "package binding"),
            (auth.Context(types.SimpleNamespace(root=ROOT / "foreign"), self.binding, {}, self.context.plan), "root"),
            (auth.Context(self.context_reader, self.binding, {}, {"outputRoot": "foreign"}), "plan")]
        for candidate, message in candidates:
            self.live_auth.return_value = candidate
            guard = self.guard()
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, "resource Context " + message):
                guard()
            self.assertIsNone(guard.last)
            self.assertIsNone(guard._ResourceGuard__live_context)
        self.live_verify.assert_not_called()
        self.loaded_verify.assert_not_called()
        for keyword in ("context", "live_context"):
            with self.assertRaises(TypeError):
                worker.ResourceGuard(self.binding, self.plan, **{keyword: self.context})

    def test_retained_context_scope_changes_refuse_without_fallback(self):
        guard = self.guard()
        guard()
        self.clock[0] += 10
        for attribute, replacement, message in (("binding", {**self.binding, "sha256": "1" * 64}, "package binding"),
            ("plan", {"outputRoot": "foreign"}, "plan"), ("root", ROOT / "foreign", "root")):
            original = getattr(guard, attribute)
            setattr(guard, attribute, replacement)
            try:
                with self.subTest(attribute=attribute), self.assertRaisesRegex(ValueError, "resource Context " + message):
                    guard()
            finally:
                setattr(guard, attribute, original)
        self.assertEqual(self.live_auth.call_count, 1)
        self.live_verify.assert_not_called()
        self.loaded_verify.assert_not_called()

    def test_resources_still_checked_between_live_periods(self):
        guard = self.guard()
        guard()
        self.clock[0] += 1
        for field, value, error in (("disk_free", 2048 * self.MIB - 1, "disk safety"),
            ("free", 2048 * self.MIB - 1, "VRAM safety"),
            ("output_bytes", capture.MAX_EXECUTION - 65535, "terminal reserve"),
            ("threads", 3, "CPU deadline")):
            original = getattr(self, field)
            setattr(self, field, value)
            try:
                with self.subTest(field=field), self.assertRaisesRegex(ValueError, error):
                    guard()
            finally:
                setattr(self, field, original)
        guard()
        self.assertEqual(self.live_auth.call_count, 1)
        self.assertEqual(self.query.call_count, 1)
        self.live_verify.assert_not_called()
        self.loaded_verify.assert_not_called()
        self.assertEqual(self.memory_calls[-1]["fraction"], .7)


class RuntimeIdentityCpuTests(unittest.TestCase):
    """Actual executables and OS canonical paths; no lowercase-string admission."""
    @classmethod
    def setUpClass(cls):
        cls.identity = auth.runtime_identity(ROOT)
        cls.alias = Path(shutil.which("node")).absolute()
        cls.canonical = cls.alias.resolve(strict=True)
        program = ("import {pathToFileURL} from 'node:url';import {lstatSync,realpathSync} from 'node:fs';"
            "const {runtimeIdentity}=await import(pathToFileURL(process.argv[1]).href);"
            "const identity=runtimeIdentity(process.argv[2]);"
            "const stamp=p=>{const s=lstatSync(p,{bigint:true});return [s.dev,s.ino,s.size,s.mtimeNs].map(String)};"
            "process.stdout.write(JSON.stringify({execPath:process.execPath,identity,"
            "nodeOriginalFileIdentity:stamp(process.execPath),nodeCanonicalFileIdentity:stamp(identity.node.absolutePath),"
            "pythonOriginalFileIdentity:stamp(process.argv[2]+'/ml/ai-painter/.venv/Scripts/python.exe'),"
            "pythonCanonicalFileIdentity:stamp(identity.python.absolutePath)}));")
        cls.node = subprocess.run([str(cls.alias), "--input-type=module", "-e",
            program, str(ROOT / auth.ROLES["packageChain"]), str(ROOT)], capture_output=True,
            encoding="utf8", timeout=5, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        cls.evidence = {"coveredRuntimeKind": "actual_os_canonical_executable_identity", "nodeAlias": str(cls.alias),
            "nodeCanonical": str(cls.canonical), "nodeProcessExitCode": cls.node.returncode,
            "authRuntimeIdentity": cls.identity, "nodePathPassed": False, "pythonPathPassed": False}

    def test_real_node_alias_producer_and_auth_canonical_identity_match(self):
        self.assertEqual(self.node.returncode, 0, self.node.stderr)
        actual = json.loads(self.node.stdout)
        self.assertEqual(actual["identity"], self.identity)
        self.assertEqual(str(self.canonical), actual["identity"]["node"]["absolutePath"])
        self.assertEqual(actual["nodeOriginalFileIdentity"], actual["nodeCanonicalFileIdentity"])
        self.assertEqual(capture._file_identity(self.alias.stat()), capture._file_identity(self.canonical.stat()))
        self.assertEqual(hashlib.sha256(self.alias.read_bytes()).hexdigest(), self.identity["node"]["sha256"])
        self.evidence.update(nodeProcessExecPath=actual["execPath"], producerRuntimeIdentity=actual["identity"],
            producerFileIdentities={k: v for k, v in actual.items() if k.endswith("FileIdentity")}, nodePathPassed=True,
            nodeAliasFileIdentity=[str(v) for v in capture._file_identity(self.alias.stat())],
            nodeCanonicalFileIdentity=[str(v) for v in capture._file_identity(self.canonical.stat())])

    def test_real_python_project_and_running_executable_identity_match(self):
        self.assertEqual(self.node.returncode, 0, self.node.stderr)
        actual = json.loads(self.node.stdout)
        self.assertEqual(actual["identity"]["python"], self.identity["python"])
        self.assertEqual(actual["pythonOriginalFileIdentity"], actual["pythonCanonicalFileIdentity"])
        project_python = (ROOT / "ml/ai-painter/.venv/Scripts/python.exe").absolute()
        canonical = project_python.resolve(strict=True)
        self.assertEqual(str(canonical), self.identity["python"]["absolutePath"])
        self.assertEqual(Path(sys.executable).resolve(strict=True), canonical)
        self.assertEqual(capture._file_identity(project_python.stat()), capture._file_identity(canonical.stat()))
        self.assertEqual(hashlib.sha256(project_python.read_bytes()).hexdigest(), self.identity["python"]["sha256"])
        self.evidence.update(pythonPathPassed=True, pythonOriginal=str(project_python), pythonCanonical=str(canonical),
            pythonOriginalFileIdentity=[str(v) for v in capture._file_identity(project_python.stat())],
            pythonCanonicalFileIdentity=[str(v) for v in capture._file_identity(canonical.stat())])

    @classmethod
    def tearDownClass(cls):
        output = os.environ.get("T_Q4_RUNTIME_IDENTITY_REPORT")
        if output:
            cls.evidence["status"] = "component_runtime_path_passed_not_admission" if cls.evidence["nodePathPassed"] and cls.evidence["pythonPathPassed"] else "runtime_path_test_failed"
            raw = capture.json_bytes(cls.evidence)
            with Path(output).open("xb") as stream:
                stream.write(raw)


def legacy_capture_fixture_binding(reader, actual_model):
    """Historical shape-only tests do not adopt the current model identity."""
    binding = auth.exact_binding(auth.read_json(reader, auth.FROZEN_PLAN)["modelBinding"])
    auth.require(binding == {"path": ".runtime/ai-painter/ecology-execution-auth-t-q4-71/cpu/model-identity.json",
        "sha256": "61a05d8d487fad5b96ec5df285ca6eeede772edb41649535f02adba41c827469"},
        "exact legacy capture fixture identity required")
    legacy = auth.read_json(reader, binding)
    auth.require(auth.same_json(legacy["graph"], actual_model["graph"]),
        "legacy capture fixture parameter graph differs")
    return binding


def cpu_harness(request_binding, *, root=ROOT):
    """Same command is later retained by the real native owner; no fake cleanup."""
    started = time.monotonic()
    _cpu_phase("harness.start", started)
    import torch
    _cpu_phase("harness.torch_loaded", started)
    reader = auth.Reader(root)
    request = auth.read_json(reader, request_binding)
    original_request = copy.deepcopy(request)
    auth.require(request.get("schema") == "ecology-decode1-weight-quality-cpu-request-v1" and
        request.get("configuration") == auth.configuration(reader), "own bound CPU request required")
    _cpu_phase("harness.programs.start", started)
    auth.verify_programs(reader, request["programBindings"])
    _cpu_phase("harness.programs.done", started)
    auth.require(auth.same_json(request.get("runtimeIdentity"), auth.runtime_identity(root)), "actual runtime executable differs")
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    import psutil
    cpu_process = psutil.Process()
    cpu_process.cpu_affinity(cpu_process.cpu_affinity()[:2])
    worker.write(root, request["outputRoot"] + "/consumed.json", {"request": request_binding, "attempt": 1, "retries": 0})
    _cpu_phase("harness.model_metadata.start", started)
    actual = auth.derive_model_metadata(reader, request["datasetManifest"])
    run_root = request["outputRoot"].rsplit("/", 1)[0]
    auth.require("modelBinding" not in original_request and request.get("modelIdentityOutput") == run_root + "/model-identity.json"
        and request.get("modelCapabilityVersion") == actual["modelCapabilityVersion"], "new CPU actual metadata output required")
    request["modelBinding"] = worker.write(root, request["modelIdentityOutput"], actual)
    _cpu_phase("harness.model_metadata.done", started)
    _cpu_phase("harness.closure_derive.start", started)
    closure = auth.derive_data_closure(root)
    _cpu_phase("harness.closure_derive.done", started, bindings=len(closure["bindings"]))
    run_root = request["outputRoot"].rsplit("/", 1)[0]
    closure_binding = worker.write(root, run_root + "/data-closure.json", closure)
    auth.require(request["outputRoot"] == auth.ROOT_PREFIX + request["runId"] + "/cpu-entry" and
        closure_binding["path"] == auth.ROOT_PREFIX + request["runId"] + "/data-closure.json", "same Run harness closure required")
    # Only this just-derived live result, never a previously stored JSON receipt.
    closure_value, request_value = copy.deepcopy(closure), copy.deepcopy(original_request)
    proof_reader = auth.Reader(root)
    proof_bindings = [auth.exact_binding(request_binding), auth.exact_binding(closure_binding), *closure_value["bindings"]]
    auth.require(len(closure_value["bindings"]) == 1435 and
        len({b["path"] for b in proof_bindings}) == len(proof_bindings), "exact live closure bindings required")
    live = True

    def recheck_live_bindings(expected=None):
        auth.require(live and proof_reader.root == reader.root, "expired/cross invocation closure proof")
        stamps = {}
        for binding in proof_bindings:
            before = capture._file_identity(proof_reader.path(binding["path"]).lstat())
            if expected is not None:
                auth.require(before == expected[binding["path"]], "live closure file identity changed")
            proof_reader.read(binding)
            after = capture._file_identity(proof_reader.path(binding["path"]).lstat())
            auth.require(after == before, "live closure file changed during verification")
            stamps[binding["path"]] = after
        auth.require(auth.same_json(auth.read_json(proof_reader, request_binding), request_value) and
            auth.same_json(auth.read_json(proof_reader, closure_binding), closure_value), "same Run/request closure bytes changed")
        return stamps

    _cpu_phase("harness.handoff_bindings.start", started)
    identities = recheck_live_bindings()
    _cpu_phase("harness.handoff_bindings.done", started, bindings=len(closure_value["bindings"]))

    @contextmanager
    def use_derived_closure():
        recheck_live_bindings(identities)
        _cpu_phase("harness.handoff.before_verified", started, bindings=1435)
        try:
            yield copy.deepcopy(closure_value)
        finally:
            recheck_live_bindings(identities)
            _cpu_phase("harness.handoff.after_verified", started, bindings=1435)

    os.environ["T_Q4_75_TEST_ROOT"] = str(reader.path(request["outputRoot"] + "/tensor-fixtures"))
    reader.path(request["outputRoot"] + "/tensor-fixtures").mkdir()
    # The unchanged capture tests pin the historical shape-only metadata SHA.
    # The new model's own binding remains in request/initialModel and is never
    # replaced by this fixture, nor are historical weights loaded.
    capture_fixture_binding = legacy_capture_fixture_binding(reader, actual)
    os.environ["T_Q4_75_MODEL_IDENTITY"] = str(reader.path(capture_fixture_binding["path"]))
    os.environ["T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT"] = request["outputRoot"]
    validation_regression_path = request["outputRoot"] + "/validation-loader-regression.json"
    os.environ["T_QV12_VALIDATION_LOADER_REPORT"] = str(reader.path(validation_regression_path))
    calls = {k: 0 for k in ("moduleForwardCalls", "autogradCalls", "optimizerConstructionAttempts", "optimizerUpdates", "cudaInitializationAttempts")}
    def reject(name):
        def forbidden(*args, **kwargs):
            calls[name] += 1
            raise AssertionError("CPU protocol forbidden operation " + name)
        return forbidden
    patches = [patch.object(torch.nn.Module, "_call_impl", reject("moduleForwardCalls")),
        patch.object(torch.autograd, "grad", reject("autogradCalls")), patch.object(torch.autograd, "backward", reject("autogradCalls")),
        patch.object(torch.optim.Optimizer, "__init__", reject("optimizerConstructionAttempts")),
        patch.object(torch.optim.Optimizer, "step", reject("optimizerUpdates")),
        patch.object(torch.cuda, "_lazy_init", reject("cudaInitializationAttempts")), patch.object(torch.cuda, "init", reject("cudaInitializationAttempts"))]
    for item in patches:
        item.start()
    output = _LiveCpuOutput()
    release_handoff = None
    try:
        suite = unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(name) for name in
            ("test_ecology_regime_gradient_failure_capture_cpu", "test_ecology_regime_failure_capture_cpu", "test_ecology_decode1_weight_quality_lifecycle_cpu", "test_ecology_decode1_weight_checkpoint_cpu", "test_ecology_decode1_weight_quality_review_cpu", "test_ecology_decode1_weight_quality_execution_cpu"))

        def test_instances(items):
            for item in items:
                if isinstance(item, unittest.TestSuite):
                    yield from test_instances(item)
                else:
                    yield item

        consumers = [test for test in test_instances(suite) if test.id() ==
            "test_ecology_decode1_weight_quality_execution_cpu.ExecutionProtocolCpuTests.test_actual_readonly_train_asset_and_validation_metadata_closure"]
        auth.require(len(consumers) == 1, "unique live closure test consumer required")
        module = sys.modules[type(consumers[0]).__module__]
        auth.require(module.ROOT.absolute() == reader.root, "cross project closure handoff refused")
        release_handoff = module._install_live_closure(consumers[0], use_derived_closure)
        _cpu_phase("harness.python_tests.start", started)
        result = unittest.TextTestRunner(verbosity=2, stream=output, resultclass=_TimedCpuResult).run(suite)
        _cpu_phase("harness.python_tests.done", started, testsRun=result.testsRun,
            failures=len(result.failures), errors=len(result.errors), skipped=len(result.skipped))
    finally:
        live = False
        if release_handoff is not None:
            release_handoff()
        for item in reversed(patches):
            item.stop()
    remaining = 240 - (time.monotonic() - started)
    auth.require(remaining > 0, "CPU node tests have no remaining deadline")
    _cpu_phase("harness.node_tests.start", started, remainingSeconds=remaining)
    node = subprocess.run([request["runtimeIdentity"]["node"]["absolutePath"], "--test", "--test-reporter=tap", str(Path(root) / auth.ROLES["entryTests"])], cwd=root,
        capture_output=True, text=True, timeout=remaining, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    _cpu_phase("harness.node_tests.done", started, exitCode=node.returncode)
    worker.write(root, request["outputRoot"] + "/python-output.txt", output.getvalue().encode())
    worker.write(root, request["outputRoot"] + "/node-stdout.txt", node.stdout.encode())
    worker.write(root, request["outputRoot"] + "/node-stderr.txt", node.stderr.encode())
    reader.unchanged()
    _cpu_phase("harness.final_bindings_verified", started)
    auth.require(result.wasSuccessful() and node.returncode == 0 and not any(calls.values()) and not torch.cuda.is_initialized(), "own CPU batch failed")
    validation_regression_binding = {"path": validation_regression_path,
        "sha256": hashlib.sha256(reader.path(validation_regression_path).read_bytes()).hexdigest()}
    validation_regression = auth.read_json(reader, validation_regression_binding)
    auth.require(validation_regression["status"] == "actual8_validation_loaded_cpu" and
        validation_regression["sampleIds"] == closure["splitSampleIds"]["validation"] and
        len(validation_regression["visualManifests"]) == 8 and
        validation_regression["validationRgbReadByClosure"] is False and
        all(validation_regression[key] is False for key in ("weightOptimization", "checkpointSelection", "gpuQualification", "qualified")),
        "actual fixed validation loader regression required")
    elapsed = time.monotonic() - started
    auth.require(elapsed < 240, "CPU finalization deadline")
    report = {"schema": worker.CPU_SCHEMA, "status": "passed", "request": request_binding,
        "programBindings": request["programBindings"], "configuration": request["configuration"], "modelBinding": request["modelBinding"],
        "initialModel": actual, "dataClosure": closure_binding, "validationLoaderRegression": validation_regression_binding,
        "legacyCaptureFixture": {"modelBinding": capture_fixture_binding, "purpose": "synthetic_parameter_shapes_only",
            "currentModelQualificationInherited": False, "historicalWeightsLoaded": False},
        "passed": result.testsRun,
        "runtimeIdentity": request["runtimeIdentity"],
        "failed": len(result.failures), "errors": len(result.errors), "skipped": len(result.skipped),
        "items": [{"status": "passed", "index": i} for i in range(result.testsRun)], "synthetic": True,
        "gpuInitialized": False, "actualCalls": calls, "nodeExitCode": node.returncode, "elapsedSeconds": elapsed,
        "nativeCleanupClaimed": False, "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False}
    return worker.write(root, request["outputRoot"] + "/cpu-report.json", report)


import inspect
import ast
from ai_painter.complete_world import ecology_decode1_weight_checkpoint_v1 as checkpoint
import qualify_stage4_ecology_decode1_weight_quality_gpu_v1 as qualifier
from test_ecology_decode1_weight_checkpoint_cpu import ORDER

class Decode1MemoryReader:
    def __init__(self):
        self.files = {}
        self.reads = []
    def put(self, path, value):
        raw = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
        self.files[path] = raw
        return {"path": path, "sha256": hashlib.sha256(raw).hexdigest()}
    def read(self, binding, maximum=2097152):
        raw = self.files[binding["path"]]
        auth.require(len(raw) <= maximum and hashlib.sha256(raw).hexdigest() == binding["sha256"], "synthetic immutable binding mismatch")
        self.reads.append(binding["path"])
        return raw


class NativeTestSourceTransitionCpuTests(unittest.TestCase):
    def test_registry_snapshot_keeps_original_bytes_and_live_source_has_own_role(self):
        reader = auth.Reader(ROOT)
        original = reader.read(auth.ORIGINAL_REGISTRY, auth.PROGRAM_MAX)
        current = reader.path(auth.ROLES["currentExecutionRegistry"]).read_bytes()
        self.assertEqual(hashlib.sha256(original).hexdigest(), auth.ORIGINAL_REGISTRY["sha256"])
        self.assertNotEqual(hashlib.sha256(current).hexdigest(), auth.ORIGINAL_REGISTRY["sha256"])
        self.assertEqual(auth.ROLES["currentExecutionRegistry"], "src/server/ai-painter-current-execution-registry.mjs")
        old = {"path": auth.ROLES["currentExecutionRegistry"], "sha256": auth.ORIGINAL_REGISTRY["sha256"]}
        self.assertEqual(auth.historical_source_binding("source-19", old), auth.ORIGINAL_REGISTRY)
        self.assertIs(auth.historical_source_binding("source-18", old), old)
        reader.unchanged()

    def test_registry_snapshot_refuses_retargeting_and_wrong_historical_digest(self):
        old = {"path": auth.ROLES["currentExecutionRegistry"], "sha256": auth.ORIGINAL_REGISTRY["sha256"]}
        for changed in ({**old, "sha256": "0" * 64}, {**old, "path": "scripts/foreign.mjs"}):
            with self.assertRaisesRegex(ValueError, "exact historical registry source"):
                auth.historical_source_binding("source-19", changed)

    def test_current_registry_role_cannot_be_omitted_from_new_program(self):
        programs = {role: {"path": logical, "sha256": "0" * 64}
            for role, logical in {**auth.ROLES, **auth.LOCAL_DEPLOYMENT_DEPENDENCY_ROLES}.items()
            if role != "currentExecutionRegistry"}
        with self.assertRaisesRegex(ValueError, "full own source roles"):
            auth.verify_programs(auth.Reader(ROOT), programs)

    def test_preserved_actual_snapshot_and_identifier_only_current_source(self):
        reader = auth.Reader(ROOT)
        original = reader.read(auth.ORIGINAL_NATIVE_TESTS, auth.PROGRAM_MAX)
        current = reader.path(auth.ROLES["currentLegacyNativeTests"]).read_bytes()
        auth.verify_native_test_rename(original, current)

    def test_unchanged_or_unrelated_current_source_refused(self):
        reader = auth.Reader(ROOT)
        original = reader.read(auth.ORIGINAL_NATIVE_TESTS, auth.PROGRAM_MAX)
        current = reader.path(auth.ROLES["currentLegacyNativeTests"]).read_bytes()
        for raw in (original, current + b"\n// unrelated change"):
            with self.assertRaisesRegex(ValueError, "change beyond identifier rename"):
                auth.verify_native_test_rename(original, raw)

    def test_only_two_exact_historical_roles_redirect_to_original_snapshot(self):
        old = {"path": auth.ROLES["currentLegacyNativeTests"], "sha256": auth.ORIGINAL_NATIVE_TESTS["sha256"]}
        for role in ("source-151", "nativeTests"):
            self.assertEqual(auth.historical_native_test_binding(role, old), auth.ORIGINAL_NATIVE_TESTS)
            with self.assertRaisesRegex(ValueError, "exact historical native test role"):
                auth.historical_native_test_binding(role, {**old, "sha256": "0" * 64})
        self.assertIs(auth.historical_native_test_binding("source-150", old), old)


class Decode1ExecutionCpuTests(unittest.TestCase):
    def test_capture_fixture_is_pinned_separately_from_new_model_identity(self):
        reader = auth.Reader(ROOT)
        original = auth.read_json(reader, auth.FROZEN_PLAN)["modelBinding"]
        legacy = auth.read_json(reader, original)
        model_capability = "stage4_mvp256_dry_factorized_ecology_decode1_weight_precision_v1"
        actual = {"graph": copy.deepcopy(legacy["graph"]), "modelCapabilityVersion": model_capability}
        self.assertEqual(legacy_capture_fixture_binding(reader, actual), original)
        self.assertEqual(actual["modelCapabilityVersion"], model_capability)
        reader.unchanged()

    def test_capture_fixture_rejects_new_identity_or_changed_historical_bytes(self):
        expected = {"path": ".runtime/ai-painter/ecology-execution-auth-t-q4-71/cpu/model-identity.json",
            "sha256": "61a05d8d487fad5b96ec5df285ca6eeede772edb41649535f02adba41c827469"}
        for replacement in ({**expected, "path": "synthetic/new-model.json"}, {**expected, "sha256": "0" * 64}):
            reader = Decode1MemoryReader()
            reader.files[auth.FROZEN_PLAN["path"]] = b"unused"
            with patch.object(auth, "read_json", return_value={"modelBinding": replacement}), \
                self.assertRaisesRegex(ValueError, "exact legacy capture fixture identity"):
                legacy_capture_fixture_binding(reader, {"graph": []})

    def test_capture_fixture_rejects_parameter_graph_drift(self):
        reader = auth.Reader(ROOT)
        with self.assertRaisesRegex(ValueError, "parameter graph differs"):
            legacy_capture_fixture_binding(reader, {"graph": []})

    def fixture(self):
        reader = Decode1MemoryReader()
        dataset = reader.put("synthetic/dataset.json", {"identityPayload": {"channelOrder": list(ORDER)}})
        metadata = auth.derive_model_metadata(reader, dataset)
        output = auth.ROOT_PREFIX + "synthetic-decode1-run"
        model = reader.put(output + "/model-identity.json", metadata)
        return reader, {"outputRoot": output, "modelBinding": model, "datasetManifest": dataset}, metadata

    def test_identity_schema_configuration_and_root_are_new(self):
        self.assertEqual(auth.PLAN_SCHEMA, "ecology-decode1-weight-quality-plan-v1")
        self.assertEqual(auth.PROFILE, "bounded_ecology_decode1_weight_quality_v1")
        self.assertEqual(auth.ROOT_PREFIX, ".runtime/ai-painter/ecology-decode1-weight-quality-executions/")
        self.assertEqual(checkpoint.SCHEMA, "ecology-decode1-weight-quality-checkpoint-v1")
        self.assertEqual(checkpoint.CONFIGURATION_SCHEMA, "ecology-decode1-weight-quality-configuration-v1")
        self.assertIsNone(auth.MODEL_REFERENCE)

    def test_current_formal_bytes_are_exact160(self):
        raw = (ROOT / auth.SPECIFICATION["path"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), auth.SPECIFICATION["sha256"])
        self.assertIn(b"AI-PAINTER-SPEC-1.60", raw)
        self.assertIn(b"9.6.42", raw)
        self.assertEqual(checkpoint.SPEC_SHA, auth.SPECIFICATION["sha256"])

    def test_roles_exist_and_point_to_exact_python_files(self):
        for key in ("decode1Operator", "decode1Model", "decode1Bridge", "executionAuth", "worker", "gpuQualifier", "loop", "trainingProfile", "managedCheckpoint", "reviewWorker"):
            self.assertTrue((ROOT / auth.ROLES[key]).is_file(), key)
        self.assertEqual(auth.ROLES["trainingProfile"], "ml/ai-painter/scripts/painter_stage4_ecology_decode1_weight_training_profile_v1.py")

    def test_metadata_recomputes_real_new_factory108(self):
        reader, plan, value = self.fixture()
        self.assertEqual(value["capabilityVersion"], auth.CAPABILITY)
        self.assertEqual(value["modelCapabilityVersion"], "stage4_mvp256_dry_factorized_ecology_decode1_weight_precision_v1")
        self.assertEqual(len(value["graph"]), 108)
        self.assertEqual(sum(row["elements"] for row in value["graph"]), 2242687)
        self.assertEqual(auth.verify_model(reader, plan), value)

    def test_recompute_false_does_not_trust_caller_hashes(self):
        reader, plan, value = self.fixture()
        value["initialState"]["generator"] = "0" * 64
        plan["modelBinding"] = reader.put(plan["modelBinding"]["path"], value)
        with self.assertRaisesRegex(ValueError, "actual new fresh"):
            auth.verify_model(reader, plan, recompute=False)

    def test_cross_run_model_metadata_rejected(self):
        reader, plan, value = self.fixture()
        plan["modelBinding"] = reader.put("synthetic/other/model.json", value)
        with self.assertRaisesRegex(ValueError, "cross Run"):
            auth.verify_model(reader, plan)

    def test_old_capability_metadata_refused(self):
        reader, plan, value = self.fixture()
        value["modelCapabilityVersion"] = "stage4_mvp256_dry_factorized_ecology_v1"
        plan["modelBinding"] = reader.put(plan["modelBinding"]["path"], value)
        with self.assertRaises(ValueError):
            auth.verify_model(reader, plan)

    def test_worker_runtime_routes_new_profile_and_checkpoint(self):
        _, profile, _ = worker.runtime()
        self.assertEqual(profile.__name__, "painter_stage4_ecology_decode1_weight_training_profile_v1")
        self.assertIs(worker.checkpoint, checkpoint)
        self.assertIs(worker.auth, auth)

    def test_loader_refuses_challenge_before_reading(self):
        with self.assertRaisesRegex(ValueError, "explicit train/validation"):
            worker.load_samples(Decode1MemoryReader(), {}, splits=("challenge",))

    def test_loader_refuses_duplicate_split(self):
        with self.assertRaises(ValueError):
            worker.load_samples(Decode1MemoryReader(), {}, splits=("train", "train"))

    def test_loader_uses_new_profile_binding_not_old_loader(self):
        source = inspect.getsource(worker.load_samples)
        self.assertIn("profile.bind_sample_ecology", source)
        self.assertNotIn("painter_stage4_ecology_regime_execution_worker", source)

    def test_qualifier_loads_default_train_and_has_no_optimizer(self):
        tree = ast.parse(inspect.getsource(qualifier))
        loads = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "load_samples"]
        self.assertEqual(len(loads), 1)
        self.assertEqual(loads[0].keywords, [])
        source = inspect.getsource(qualifier)
        self.assertNotIn("perform_pair", source)
        self.assertNotIn("optim.Adam", source)
        self.assertNotIn(".step(", source)
        self.assertIn('"optimizerSteps": 0', source)

    def test_old_package_identity_refused_before_model_or_assets(self):
        reader = Decode1MemoryReader()
        binding = reader.put("synthetic/old/package.json", {"schemaVersion": "ai-painter-autonomous-closed-loop-package-v1",
            "capabilityVersion": "stage4_mvp256_dry_factorized_ecology_quality_v1"})
        with self.assertRaises(ValueError):
            auth.load_execution_package(reader, binding)
        self.assertEqual(reader.reads, [binding["path"]])

    def test_bound_path_parent_traversal_rejected(self):
        with self.assertRaises(ValueError):
            auth.exact_binding({"path": "../escape.json", "sha256": "a" * 64})

    def test_bad_sha_binding_rejected(self):
        with self.assertRaises(ValueError):
            auth.exact_binding({"path": "synthetic/file.json", "sha256": "caller-says-good"})

    def test_cpu_only_metadata_cli_is_distinct_from_package_execution(self):
        source = (ROOT / auth.ROLES["worker"]).read_text(encoding="utf-8")
        self.assertIn('parser.add_argument("--model-metadata", action="store_true")', source)
        self.assertIn('not args.package and not args.gpu', source)
        self.assertIn('"metadata must not initialize CUDA"', source)

    def test_new_configuration_keeps_original_limits_and_selection(self):
        configuration = checkpoint.expected_configuration(auth.CANDIDATE)
        self.assertEqual(configuration["executionCeiling"]["epochs"], 12)
        self.assertEqual(configuration["executionCeiling"]["generatorOptimizerSteps"], 576)
        self.assertEqual(configuration["executionCeiling"]["maxWallSeconds"], 2700)
        self.assertEqual(configuration["gpuAdmissionSeconds"], 600)
        self.assertEqual(configuration["checkpointSelection"]["eligibleEpochs"], [12])
        self.assertFalse(configuration["historicalCheckpointMayInitialize"])

    def test_only_manifest_single_alias_semantic_transition(self):
        original = {"name": "synthetic-only", "scripts": {"old": "unchanged"}, "dependencies": {"x": "1"}}
        current = copy.deepcopy(original)
        current["scripts"][auth.MANIFEST_ALIAS] = auth.MANIFEST_COMMAND
        encode = lambda value: json.dumps(value).encode()
        auth._manifest_semantic_transition(encode(original), encode(current))
        for change in (lambda value: value["scripts"].update(other="extra"),
                       lambda value: value["dependencies"].update(x="2"),
                       lambda value: value["scripts"].update({auth.MANIFEST_ALIAS: "wrong command"})):
            bad = copy.deepcopy(current)
            change(bad)
            with self.assertRaises(ValueError):
                auth._manifest_semantic_transition(encode(original), encode(bad))
        with self.assertRaises(ValueError):
            auth._manifest_semantic_transition(encode(current), encode(current))

    def test_actual_bound_original_and_current_manifest_transition(self):
        reader = auth.Reader(ROOT)
        original_raw = reader.read(auth.ORIGINAL_MANIFEST, auth.PROGRAM_MAX)
        current_raw = (ROOT / "package.json").read_bytes()
        current_binding = {"path": "package.json", "sha256": hashlib.sha256(current_raw).hexdigest()}
        verified_current = reader.read(current_binding, auth.PROGRAM_MAX)
        self.assertEqual(verified_current, current_raw)
        frozen = auth.read_json(reader, auth.FROZEN_PLAN)["programBindings"]["source-137"]
        self.assertEqual(frozen, {"path": "package.json", "sha256": auth.ORIGINAL_MANIFEST["sha256"]})
        self.assertEqual(auth.ROLES["frozenProjectManifest"], auth.ORIGINAL_MANIFEST["path"])
        auth._manifest_semantic_transition(original_raw, verified_current)
        reader.unchanged()

    def test_current_fixture_programs_and_deployment_paths_are_exact(self):
        fixture = ExecutionProtocolCpuTests
        fixture.setUpClass()
        self.assertEqual(fixture.programs["frozen-source-137"]["sha256"], hashlib.sha256((ROOT / "package.json").read_bytes()).hexdigest())
        self.assertEqual(fixture.programs["frozenProjectManifest"], auth.ORIGINAL_MANIFEST)
        for role, path in auth.LOCAL_DEPLOYMENT_DEPENDENCY_ROLES.items():
            self.assertEqual(fixture.programs[role]["path"], path)
            self.assertEqual(fixture.reader.read(fixture.programs[role]), (ROOT / path).read_bytes())
        auth.verify_programs(fixture.reader, fixture.programs)
        for role in auth.LOCAL_DEPLOYMENT_DEPENDENCY_ROLES:
            missing = dict(fixture.programs)
            del missing[role]
            with self.assertRaisesRegex(ValueError, "full own source roles"):
                auth.verify_programs(fixture.reader, missing)
        altered = copy.deepcopy(fixture.programs)
        altered["localOperatorDeploymentLoader"] = fixture.programs["localOperatorDeploymentManifest"]
        with self.assertRaisesRegex(ValueError, "deployment source path"):
            auth.verify_programs(fixture.reader, altered)

    def test_source_count_includes_exact_two_deployment_dependencies(self):
        reader = auth.Reader(ROOT)
        roles, unique = _expected_current_source_counts(reader)
        self.assertEqual(roles, 179 + len(auth.ROLES) + 4 + 2)
        frozen = auth.read_json(reader, auth.FROZEN_PLAN)["programBindings"]
        neutral = {"scripts/lib/ai-pet-world-storage.mjs", "scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs",
            "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs", "src/server/ai-painter-current-execution-registry.mjs"}
        expected = {auth.historical_source_binding(role, binding)["path"] for role, binding in frozen.items()} | set(auth.ROLES.values()) | neutral | set(auth.LOCAL_DEPLOYMENT_DEPENDENCY_ROLES.values())
        self.assertEqual(unique, len(expected))

    def test_qualification_lock_pairs_exact_heartbeat_and_cannot_start_training(self):
        reader = Decode1MemoryReader()
        root = auth.ROOT_PREFIX + "synthetic-phase-run"
        identity = {"capabilityVersion": auth.CAPABILITY, "runId": "synthetic-phase-run",
            "packageId": "synthetic-phase-package", "processId": 77, "processStartIdentity": "synthetic-start"}
        plan = {**identity, "outputRoot": root, "programBindings": {}}
        package = reader.put("synthetic/package.json", {})
        lock = reader.put(root + "/qualification-lock.json", {"schemaVersion": "ai-painter-current-active-execution-lock-v1", **identity})
        heartbeat_path = root + "/qualification-heartbeat.json"
        reader.put(heartbeat_path, {"schemaVersion": "ai-painter-current-active-execution-heartbeat-v1", **identity,
            "executionState": "executing", "ttlSeconds": 120, "heartbeatAtUtc": datetime.now(timezone.utc).isoformat()})
        active = {**identity, "executionState": "executing", "programLineage": {}, "lock": lock,
            "heartbeat": {"path": heartbeat_path, "ttlSeconds": 120}}
        reader.put(auth.REGISTRY, {**identity, "registryRevision": 409, "executionState": "executing", "activeExecution": active})
        reader.snapshot = lambda path: (reader.files[path], {"path": path, "sha256": hashlib.sha256(reader.files[path]).hexdigest()})
        reader.mapping = types.SimpleNamespace(binding=reader.read)
        context = auth.Context(reader, package, {}, plan)
        with patch.object(auth, "load_execution_package", return_value=context), patch.object(auth, "process_identity", return_value="synthetic-start"):
            self.assertEqual(auth.verify_live_context(context, expected_phase=None)["executionPhase"], "qualification")
            with self.assertRaisesRegex(ValueError, "wrong execution phase"):
                auth.verify_live_context(context)
            active["heartbeat"]["path"] = root + "/heartbeat.json"
            reader.put(auth.REGISTRY, {**identity, "registryRevision": 409, "executionState": "executing", "activeExecution": active})
            with self.assertRaisesRegex(ValueError, "heartbeat phase"):
                auth.verify_live_context(context, expected_phase=None)

    def test_phase_snapshot_does_not_accept_arbitrary_json(self):
        reader = types.SimpleNamespace(_heartbeat_expected_path=None)
        with self.assertRaisesRegex(ValueError, "exact own phase"):
            auth._snapshot_heartbeat(reader, auth.ROOT_PREFIX + "synthetic-phase-run/qualification-heartbeat.json", {"runId": "synthetic-phase-run"})
        with self.assertRaisesRegex(ValueError, "exact own phase"):
            auth._snapshot_heartbeat(reader, auth.ROOT_PREFIX + "synthetic-phase-run/other.json", {"runId": "synthetic-phase-run"})


class StreamProofRepairCpuTests(unittest.TestCase):
    """Actual source bytes with synthetic receipt/artifacts; no native execution."""
    def fixture(self):
        reader = Decode1MemoryReader()
        reader.root = ROOT
        reader.path = lambda logical: ROOT / logical
        reader.mapping = types.SimpleNamespace(physical_runtime=(ROOT / ".runtime").absolute())
        programs = {}
        for role in ("nativeOwnerBuilder", "nativeOwnerSource", "nativeRunner"):
            path = auth.ROLES[role]
            raw = (ROOT / path).read_bytes()
            reader.files[path] = raw
            programs[role] = {"path": path, "sha256": hashlib.sha256(raw).hexdigest()}
        args = ["-B", "synthetic-only.py"]
        output = auth.ROOT_PREFIX + "synthetic-stream-proof"
        identity = "synthetic-stream-v2"
        namespace = ".runtime/ai-painter/owned-worker-guards/" + identity + "-native"
        source = {"path": str((ROOT / programs["nativeOwnerSource"]["path"]).absolute()), "sha256": programs["nativeOwnerSource"]["sha256"]}
        executable = ROOT / "ml/ai-painter/.venv/Scripts/python.exe"
        guard = {"identity": identity, "commandSha256": hashlib.sha256(json.dumps(args, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(),
            "executable": str(executable), "executableSha256": hashlib.sha256(executable.read_bytes()).hexdigest(),
            "nativeOwnerSource": source.copy(), "helperSha256": programs["nativeRunner"]["sha256"]}
        reader.files[namespace + "/owner.cs"] = reader.files[programs["nativeOwnerSource"]["path"]]
        binary = b"synthetic nonexecutable artifact; no compiler or Job"
        reader.files[namespace + "/owner.exe"] = binary
        payload = {"guard": guard, "nativeBuild": {"source": source.copy(),
            "snapshot": str(ROOT / namespace / "owner.cs"), "binary": str(ROOT / namespace / "owner.exe"),
            "binarySha256": hashlib.sha256(binary).hexdigest()}}
        proof = {"assignedBeforeResume": True, "killOnJobClose": True, "exitCode": 0,
            "activeProcessesAfterCleanup": 0, "stopReason": None, "cleanupError": None, "observationError": None,
            "streamClosureVersion": "bounded-stream-capture-v2", "stdoutClosed": True, "stderrClosed": True,
            "transportCompleted": True, "streamCaptureError": None, "streamTransportError": None}
        owned = {"schema": "detail-weight-live-native-owner-receipt-v1", "phase": "cpu", "ownerClosed": True,
            "cleanupConfirmed": True, "proof": proof, "protocolError": None, "stopReason": None,
            "guard": {"identity": identity, "state": "released_after_live_empty_job", "nativeEvidenceRoot": namespace}}
        logical = output + "/owned-cpu-" + identity + "/release-receipt.json"
        def verify():
            proof["bindingBase64"] = worker.base64.b64encode(json.dumps(payload).encode()).decode()
            binding = reader.put(logical, owned)
            return worker.verify_owned_release(reader, binding, phase="cpu", output_root=output, args=args, programs=programs)
        return reader, programs, payload, proof, owned, verify

    def test_new_stream_proof_and_actual_sources_pass_as_fixture_only(self):
        reader, programs, payload, proof, owned, verify = self.fixture()
        self.assertEqual(verify(), owned)
        for role in programs:
            self.assertIn(programs[role]["path"], reader.reads)

    def test_missing_old_forged_open_or_error_stream_fields_refused(self):
        fields = ("streamClosureVersion", "stdoutClosed", "stderrClosed", "transportCompleted", "streamCaptureError", "streamTransportError")
        for key in fields:
            reader, programs, payload, proof, owned, verify = self.fixture()
            del proof[key]
            with self.subTest(missing=key), self.assertRaisesRegex(ValueError, "bounded streams"):
                verify()
        for key, value in (("streamClosureVersion", "legacy"), ("stdoutClosed", False), ("stderrClosed", 1),
            ("transportCompleted", False), ("streamCaptureError", "error"), ("streamTransportError", "timeout")):
            reader, programs, payload, proof, owned, verify = self.fixture()
            proof[key] = value
            with self.subTest(key=key, value=value), self.assertRaisesRegex(ValueError, "bounded streams"):
                verify()

    def test_exact_new_role_paths_real_sha_and_runner_hash_required(self):
        for mutation in ("old_source", "relative_source", "guard_path", "runner_membership", "builder_sha", "source_sha", "runner_sha", "builder_path"):
            reader, programs, payload, proof, owned, verify = self.fixture()
            if mutation == "old_source":
                payload["nativeBuild"]["source"]["path"] = str(ROOT / "scripts/windows/ai-painter-owned-worker-owner.cs")
            elif mutation == "relative_source":
                payload["nativeBuild"]["source"]["path"] = auth.ROLES["nativeOwnerSource"]
            elif mutation == "guard_path":
                payload["guard"]["nativeOwnerSource"]["path"] = str(ROOT / "wrong.cs")
            elif mutation == "runner_membership":
                payload["guard"]["helperSha256"] = programs["nativeOwnerBuilder"]["sha256"]
            elif mutation == "builder_path":
                programs["nativeOwnerBuilder"] = programs["nativeRunner"]
            else:
                role = {"builder_sha": "nativeOwnerBuilder", "source_sha": "nativeOwnerSource", "runner_sha": "nativeRunner"}[mutation]
                programs[role]["sha256"] = "0" * 64
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                verify()


if __name__ == "__main__":
    if "--cpu-request" in sys.argv:
        parser = argparse.ArgumentParser()
        parser.add_argument("--cpu-request", required=True)
        parser.add_argument("--sha256", required=True)
        args = parser.parse_args()
        print(json.dumps(cpu_harness({"path": args.cpu_request, "sha256": args.sha256})))
    else:
        unittest.main()
