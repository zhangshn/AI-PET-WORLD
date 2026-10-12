"""Own 1.53 diagnostic authentication; legacy admission is never called."""
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import time

# Neutral binding/JSON/process helpers only. Its 1.52 admission functions are unused.
from ecology_regime_execution_auth import exact_binding, decode, same_json, process_identity
from ai_painter.complete_world.ecology_regime_gradient_failure_capture import RuntimeMap, require, MAX_CAPTURE, _file_identity

CAPABILITY = "stage4_mvp256_dry_factorized_ecology_v1"
PROFILE = "factorized_ecology_failure_capture_execution_v1"
PLAN_SCHEMA = "ecology-regime-failure-capture-plan-v1"
ROOT_PREFIX = ".runtime/ai-painter/ecology-regime-failure-capture-executions/"
SELF = "ml/ai-painter/scripts/ecology_regime_failure_capture_auth.py"
SPECIFICATION = {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    "sha256": "ba3e8cf1b4bff0e260f3db11511e959ac64f5c89360dde564211e69755680734"}
CANDIDATE = {"path": "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json",
    "sha256": "ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"}
MODEL_REFERENCE = {"path": ".runtime/ai-painter/ecology-execution-auth-t-q4-71/cpu/model-identity.json",
    "sha256": "61a05d8d487fad5b96ec5df285ca6eeede772edb41649535f02adba41c827469"}
FROZEN_PLAN = {"path": ".runtime/ai-painter/ecology-regime-managed-executions/ecology-managed-t73-20261009075755-execution/ecology-plan.json",
    "sha256": "03d5ec1e68701d03f5a9973c793731d1e3811226ed294e151e5a80bf225ca030"}
REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
PHASES = {"preflight", "execute", "validate", "review", "adjudicate", "finalize"}
SOURCE_JSON_MAX = 8 * 1024**2
CONTROL_JSON_MAX = 2 * 1024**2
PROGRAM_MAX = 1024**2
CANONICAL_REGION_PROGRAM = "scripts/lib/real-earth-region-governance.mjs"
ROLES = {"executionAuth": SELF,
    "worker": "ml/ai-painter/scripts/painter_stage4_ecology_regime_failure_capture_execution_worker.py",
    "gpuQualifier": "ml/ai-painter/scripts/qualify_stage4_ecology_regime_failure_capture_gpu.py",
    "adapter": "scripts/run-ai-painter-ecology-regime-failure-capture.mjs",
    "packageChain": "scripts/lib/ai-painter-ecology-failure-capture-package-chain-v1.mjs",
    "registration": "scripts/lib/ai-painter-ecology-failure-capture-execution-registration-v1.mjs",
    "nativeRunner": "scripts/lib/ai-painter-ecology-failure-capture-owned-native-v1.mjs",
    "cpuHarness": "ml/ai-painter/tests/test_ecology_regime_failure_capture_execution_cpu.py",
    "entryTests": "scripts/tests/ai-painter-ecology-failure-capture-entry.test.mjs",
    "capture": "ml/ai-painter/src/ai_painter/complete_world/ecology_regime_gradient_failure_capture.py",
    "captureTests": "ml/ai-painter/tests/test_ecology_regime_gradient_failure_capture_cpu.py",
    "loop": "ml/ai-painter/scripts/painter_stage4_ecology_regime_failure_capture.py",
    "loopTests": "ml/ai-painter/tests/test_ecology_regime_failure_capture_cpu.py",
    "trainingProfile": "ml/ai-painter/scripts/painter_stage4_ecology_regime_training_profile.py"}


def decode_source_json(raw):
    """Strict bounded decoder for existing immutable data, never control records."""
    require(type(raw) is bytes and len(raw) <= SOURCE_JSON_MAX, "bounded source JSON bytes required")

    def pairs(rows):
        result = {}
        for key, value in rows:
            require(key not in result, "duplicate source JSON field")
            result[key] = value
        return result

    def finite_float(text):
        value = float(text)
        require(math.isfinite(value), "nonfinite source JSON number")
        return value

    return json.loads(raw, object_pairs_hook=pairs, parse_float=finite_float,
        parse_constant=lambda value: require(False, "nonfinite source JSON value: " + value))


_heartbeat_clock = time.monotonic
_heartbeat_pause = time.sleep


def _heartbeat_digest(raw):
    return hashlib.sha256(raw).hexdigest()


def _heartbeat_log(raw):
    sys.stderr.write("\n" + raw)
    sys.stderr.flush()


def _open_heartbeat_handle(path):
    """One read-only, non-reparse data handle; ownership transfers only once."""
    require(os.name == "nt", "Windows heartbeat handle required")
    import ctypes
    from ctypes import wintypes
    import msvcrt
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    class FileInformation(ctypes.Structure):
        _fields_ = [("attributes", wintypes.DWORD), ("creation", wintypes.FILETIME),
            ("access", wintypes.FILETIME), ("write", wintypes.FILETIME),
            ("volume", wintypes.DWORD), ("sizeHigh", wintypes.DWORD), ("sizeLow", wintypes.DWORD),
            ("links", wintypes.DWORD), ("indexHigh", wintypes.DWORD), ("indexLow", wintypes.DWORD)]
    kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p,
        wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    kernel.CreateFileW.restype = wintypes.HANDLE
    kernel.GetFileInformationByHandle.argtypes = [wintypes.HANDLE, ctypes.POINTER(FileInformation)]
    kernel.GetFileInformationByHandle.restype = wintypes.BOOL
    kernel.GetFileType.argtypes = [wintypes.HANDLE]
    kernel.GetFileType.restype = wintypes.DWORD
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    handle = kernel.CreateFileW(str(path), 0x80000000, 7, None, 3, 0x00200000, None)
    if handle == ctypes.c_void_p(-1).value:
        error = ctypes.WinError(ctypes.get_last_error())
        error.heartbeat_operation = "open"
        raise error
    owned, fd = True, None
    try:
        info = FileInformation()
        if not kernel.GetFileInformationByHandle(handle, ctypes.byref(info)):
            error = ctypes.WinError(ctypes.get_last_error())
            error.heartbeat_operation = "handle_metadata"
            raise error
        require(kernel.GetFileType(handle) == 1 and not info.attributes & (0x400 | 0x10),
            "heartbeat handle must be ordinary non-reparse file")
        require(((info.sizeHigh << 32) | info.sizeLow) <= CONTROL_JSON_MAX, "heartbeat handle byte ceiling")
        fd = msvcrt.open_osfhandle(handle, os.O_RDONLY | os.O_BINARY)
        owned = False
        stream = os.fdopen(fd, "rb")
        fd = None
        return stream
    finally:
        if owned:
            kernel.CloseHandle(handle)
        elif fd is not None:
            os.close(fd)


class _HeartbeatReplacement(ValueError):
    pass


def _heartbeat_plain_file(info):
    require(stat.S_ISREG(info.st_mode) and not getattr(info, "st_file_attributes", 0) & 0x400 and
        info.st_dev > 0 and info.st_ino > 0 and 0 <= info.st_size <= CONTROL_JSON_MAX,
        "heartbeat ordinary file/identity/byte ceiling")


def _heartbeat_parents(reader, path):
    reader.mapping.check()
    result = []
    current = path.parent
    while True:
        info = current.lstat()
        require(stat.S_ISDIR(info.st_mode) and not getattr(info, "st_file_attributes", 0) & 0x400,
            "heartbeat parent must be ordinary")
        result.append((current, info.st_dev, info.st_ino))
        if current == reader.mapping.physical_runtime:
            break
        require(current.is_relative_to(reader.mapping.physical_runtime), "heartbeat parent outside formal runtime")
        current = current.parent
    return tuple(result)


def _heartbeat_check_parents(reader, parents):
    reader.mapping.check()
    for path, dev, ino in parents:
        info = path.lstat()
        require(stat.S_ISDIR(info.st_mode) and not getattr(info, "st_file_attributes", 0) & 0x400 and
            (info.st_dev, info.st_ino) == (dev, ino), "heartbeat parent identity changed")


def _heartbeat_content(raw, scope, expected):
    value = decode(raw)
    require(type(value) is dict and value.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1" and
        value.get("runId") == scope["runId"] and value.get("packageId") == scope["packageId"] and
        value.get("capabilityVersion") == CAPABILITY and value.get("executionState") == "executing" and
        type(value.get("ttlSeconds")) is int and value["ttlSeconds"] == 120 and
        type(value.get("processId")) is int and value["processId"] > 0 and
        type(value.get("processStartIdentity")) is str and value["processStartIdentity"], "heartbeat control identity differs")
    if expected is not None:
        require(all(value.get(k) == v for k, v in expected.items()), "heartbeat live identity differs")
    stamp = datetime.fromisoformat(value["heartbeatAtUtc"].replace("Z", "+00:00"))
    require(stamp.tzinfo is not None and -300 <= (datetime.now(timezone.utc) - stamp).total_seconds() < 120,
        "heartbeat stale/future")


def _snapshot_heartbeat(reader, logical, scope, expected=None):
    require(logical == ROOT_PREFIX + scope["runId"] + "/heartbeat.json", "exact own heartbeat required")
    started = _heartbeat_clock()
    reasons, parents, operation, path = [], None, "path_before", None
    for attempt in range(1, 4):
        try:
            require(_heartbeat_clock() - started < .100, "heartbeat observation window exhausted")
            operation = "path_before"
            path = reader.path(logical)
            if parents is None:
                parents = _heartbeat_parents(reader, path)
            _heartbeat_check_parents(reader, parents)
            before = path.lstat()
            _heartbeat_plain_file(before)
            operation = "open"
            with _open_heartbeat_handle(path) as stream:
                operation = "handle_before"
                handle_before = os.fstat(stream.fileno())
                _heartbeat_plain_file(handle_before)
                if (before.st_dev, before.st_ino) != (handle_before.st_dev, handle_before.st_ino):
                    _heartbeat_check_parents(reader, parents)
                    current = reader.path(logical).lstat()
                    _heartbeat_plain_file(current)
                    require((current.st_dev, current.st_ino) == (handle_before.st_dev, handle_before.st_ino),
                        "heartbeat open version unproven")
                    raise _HeartbeatReplacement("ordinary heartbeat replaced before open")
                require(_file_identity(before, include_ctime=False) == _file_identity(handle_before, include_ctime=False),
                    "heartbeat in-place change before read")
                operation = "read"
                raw = stream.read(handle_before.st_size + 1)
                operation = "handle_after"
                handle_after = os.fstat(stream.fileno())
                _heartbeat_plain_file(handle_after)
                require(len(raw) == handle_before.st_size and _file_identity(handle_after) == _file_identity(handle_before),
                    "heartbeat in-place change/truncated/growing")
                operation = "content"
                _heartbeat_content(raw, scope, expected)
            operation = "path_after"
            _heartbeat_check_parents(reader, parents)
            current = reader.path(logical).lstat()
            _heartbeat_plain_file(current)
            if (current.st_dev, current.st_ino) != (handle_before.st_dev, handle_before.st_ino):
                raise _HeartbeatReplacement("ordinary heartbeat replaced after read")
            require(_file_identity(current, include_ctime=False) == _file_identity(handle_after, include_ctime=False),
                "heartbeat in-place change after read")
            operation = "hash"
            binding = {"path": logical, "sha256": _heartbeat_digest(raw)}
            require(_heartbeat_clock() - started < .100, "heartbeat observation window exhausted")
            if reasons:
                operation = "observation_log"
                observation = {"schema": "ecology-heartbeat-read-observation-v1", "status": "consistent_read_observed",
                    "logicalPath": logical[:4096], "physicalPath": str(path)[:4096], "attempts": attempt,
                    "elapsedMilliseconds": max(0, (_heartbeat_clock() - started) * 1000),
                    "operation": operation, "errno": None, "winerror": None,
                    "reasons": [*reasons, {"attempt": attempt, "operation": "consistent_read", "reason": "consistent_read",
                        "errno": None, "winerror": None}]}
                record = json.dumps(observation, ensure_ascii=True, separators=(",", ":")) + "\n"
                require(len(record.encode("utf8")) < 16384, "heartbeat observation log byte ceiling")
                require(_heartbeat_clock() - started < .100, "heartbeat observation window exhausted")
                _heartbeat_log(record)
                require(_heartbeat_clock() - started < .100, "heartbeat observation window exhausted")
            return raw, binding
        except BaseException as error:
            reason = "ordinary_path_replacement" if isinstance(error, _HeartbeatReplacement) else "native_sharing" if (
                operation == "open" and getattr(error, "heartbeat_operation", "open") == "open" and
                isinstance(error, OSError) and getattr(error, "winerror", None) in (32, 33)) else "failure"
            reasons.append({"attempt": attempt, "operation": getattr(error, "heartbeat_operation", operation), "reason": reason,
                "errno": getattr(error, "errno", None), "winerror": getattr(error, "winerror", None)})
            elapsed = _heartbeat_clock() - started
            if reason == "failure" or attempt == 3 or elapsed >= .100:
                evidence = {"schema": "ecology-heartbeat-read-error-v1", "logicalPath": logical[:4096],
                    "physicalPath": str(path)[:4096] if path is not None else None, "attempts": attempt,
                    "elapsedMilliseconds": max(0, elapsed * 1000), "operation": getattr(error, "heartbeat_operation", operation),
                    "reasons": reasons}
                try:
                    error.heartbeat_read = evidence
                except BaseException:
                    pass  # Evidence attachment never replaces the primary failure.
                raise
            _heartbeat_pause(min(.010, max(0, .100 - elapsed)))


class Reader:
    def __init__(self, root):
        self.root = Path(root).absolute()
        self.mapping = RuntimeMap.current(self.root)
        self.observed = {}
        self._source_snapshot_scope = None
        self._source_snapshot_bindings = {}

    def path(self, logical):
        return self.mapping.path(logical)

    def read(self, binding, maximum=MAX_CAPTURE):
        # Original condition channels carry metadata beside their immutable binding.
        require(type(binding) is dict and {"path", "sha256"} <= set(binding), "bound data carrier required")
        binding = exact_binding({k: binding[k] for k in ("path", "sha256")})
        if binding["path"].endswith(".json"):
            maximum = min(maximum, SOURCE_JSON_MAX)
        path = self.path(binding["path"])
        before = path.lstat()
        require(stat.S_ISREG(before.st_mode) and 0 <= before.st_size <= maximum, "binding absent/oversized")
        # The policy ceiling remains above. The original reader still verifies
        # roots, handles, byte SHA and file identity; only its allocation shrinks.
        raw = self.mapping.binding(binding, maximum=before.st_size)
        after = self.path(binding["path"]).lstat()
        require(_file_identity(after) == _file_identity(before) and after.st_mode == before.st_mode,
                "file changed across bounded read")
        require(binding["path"] not in self.observed or self.observed[binding["path"]] == binding["sha256"], "observed source changed")
        self.observed[binding["path"]] = binding["sha256"]
        return raw

    def json(self, binding):
        # Numerical profiles call this for existing source data. Own control
        # records must use read_json, retaining the independent 2MiB ceiling.
        return decode_source_json(self.read(binding, SOURCE_JSON_MAX))

    def snapshot(self, logical):
        if logical == CANONICAL_REGION_PROGRAM:
            return _snapshot_canonical_program(self.root, logical)
        source = self._source_snapshot_bindings.get(logical)
        if source is not None:
            # This index is installed only after actual data-closure recomputation
            # and binding verification. Neither observed reads nor suffixes grant it.
            self.read(self._source_snapshot_scope["dataClosure"], CONTROL_JSON_MAX)
            raw = self.read(source, SOURCE_JSON_MAX)
            decode_source_json(raw)
            return raw, dict(source)
        path = self.path(logical)
        require(logical == REGISTRY or (self._source_snapshot_scope is not None and
                logical == ROOT_PREFIX + self._source_snapshot_scope["runId"] + "/heartbeat.json"),
                "snapshot outside verified source/known control")
        if logical != REGISTRY:
            return _snapshot_heartbeat(self, logical, self._source_snapshot_scope,
                getattr(self, "_heartbeat_expected_identity", None))
        before = path.lstat()
        require(stat.S_ISREG(before.st_mode) and 0 <= before.st_size <= CONTROL_JSON_MAX, "mutable JSON byte ceiling")
        with path.open("rb") as stream:
            raw = stream.read(before.st_size + 1)
        require(len(raw) <= before.st_size, "mutable JSON grew")
        binding = {"path": logical, "sha256": hashlib.sha256(raw).hexdigest()}
        verified = self.mapping.binding(binding, maximum=before.st_size)
        after = self.path(logical).lstat()
        require(_file_identity(after) == _file_identity(before) and after.st_mode == before.st_mode,
                "mutable file changed across bounded snapshot")
        return verified, binding

    def unchanged(self):
        for logical, sha in tuple(self.observed.items()):
            self.read({"path": logical, "sha256": sha})


def read_json(reader, binding):
    value = decode(reader.read(exact_binding(binding), CONTROL_JSON_MAX))
    require(type(value) is dict, "bound JSON object required")
    return value


def _snapshot_canonical_program(root, logical):
    """The one actual canonical provenance call, bound by frozen program role."""
    require(logical == CANONICAL_REGION_PROGRAM, "unrecognized program snapshot")
    program_reader = Reader(root)
    frozen = read_json(program_reader, FROZEN_PLAN)
    matches = [exact_binding(b) for b in frozen["programBindings"].values() if b["path"] == logical]
    require(len(matches) == 1, "unique frozen canonical program binding required")
    binding = matches[0]
    raw = program_reader.read(binding, PROGRAM_MAX)
    program_reader.unchanged()
    # Program observations stay in the program reader, preserving the existing
    # 1427 data-only closure. Return authentic raw code, never JSON decode it.
    return raw, dict(binding)


def runtime_identity(root):
    from ai_painter.complete_world.ecology_regime_gradient_failure_capture import _plain, _file_identity
    result = {}
    for role, filename in (("python", str(Path(root) / "ml/ai-painter/.venv/Scripts/python.exe")), ("node", shutil.which("node"))):
        require(filename is not None, "existing runtime executable absent")
        original = Path(filename).absolute()
        _plain(original)  # Reject redirects before resolve can hide them.
        before = original.stat()
        target = original.resolve(strict=True)
        _plain(target)
        require(_file_identity(target.stat()) == _file_identity(before), "canonical runtime file identity differs")
        hasher = hashlib.sha256()
        with target.open("rb") as stream:
            handle_before = os.fstat(stream.fileno())
            require(_file_identity(handle_before, include_ctime=False) == _file_identity(before, include_ctime=False),
                    "runtime handle identity differs")
            for chunk in iter(lambda: stream.read(1048576), b""):
                hasher.update(chunk)
            require(_file_identity(os.fstat(stream.fileno())) == _file_identity(handle_before), "runtime handle changed during hash")
        _plain(original)
        _plain(target)
        require(_file_identity(target.stat()) == _file_identity(before) and
                _file_identity(original.stat()) == _file_identity(before), "runtime executable changed during hash")
        result[role] = {"absolutePath": str(target), "sha256": hasher.hexdigest()}
    return result


def configuration(reader):
    candidate = read_json(reader, CANDIDATE)
    raw = reader.read(SPECIFICATION)
    require(b"AI-PAINTER-SPEC-1.56" in raw and b"9.6.39" in raw and b"9.6.39.2" in raw, "own diagnostic formal bytes required")
    # Original numerical/data values are retained; diagnostic scope is explicit.
    ceiling = {**candidate["executionCeiling"], "epochs": 13,
               "generatorOptimizerSteps": 600, "discriminatorOptimizerSteps": 600}
    require(ceiling["maxWallSeconds"] == 2700 and ceiling["cpuThreads"] == 2 and
            ceiling["automaticRetries"] == 0 and ceiling["trainingAttempts"] == 1, "diagnostic baseline resource differs")
    return {"schema": "ecology-regime-failure-capture-configuration-v1", "capabilityVersion": CAPABILITY,
        "sourceCandidate": CANDIDATE, "formalSpecification": SPECIFICATION, "executionCeiling": ceiling,
        "dataUse": {"train": 48, "validation": 8, "challenge": 4, "regression": 4,
                    "weightUpdatesFrom": ["train"], "validationMetadataOnly": True,
                    "challengeAndRegressionContentRead": False, "sourceImageOrSplitMutation": False},
        "scope": {"resolution": [256, 192], "purpose": "gradient_failure_diagnostic_only"},
        "seed": 20260929, "gpuAdmissionSeconds": 600, "checkpointSelection": {"eligibleEpochs": [], "executed": False},
        "captureMiB": 64, "captureMetadataReserveBytes": 1048576, "terminalReserveBytes": 65536,
        "freshInitializationOnly": True, "historicalCheckpointMayInitialize": False, "automaticResumeAllowed": False,
        "optimizer": {"kind": "AdamW", "learningRate": .0001, "betas": [.9, .999], "epsilon": 1e-8,
                      "weightDecay": .01, "foreach": False, "fused": False}}


def verify_programs(reader, programs):
    require(type(programs) is dict and 1 <= len(programs) <= 256 and set(ROLES) <= set(programs), "full own source roles required")
    frozen = read_json(reader, FROZEN_PLAN)["programBindings"]
    require(len(frozen) == 179, "original179 source closure differs")
    for role, binding in frozen.items():
        require(same_json(programs.get("frozen-" + role), binding), "old source role omitted/retargeted: " + role)
    total, seen = 0, {}
    for role, binding in programs.items():
        require(type(role) is str and re.fullmatch(r"[A-Za-z0-9._-]{1,80}", role) and
                role not in ("__proto__", "prototype", "constructor"), "source role invalid")
        raw = reader.read(exact_binding(binding), 1048576)
        require(binding["path"] not in seen or seen[binding["path"]] == binding["sha256"], "source alias conflict")
        if binding["path"] not in seen:
            total += len(raw)
        seen[binding["path"]] = binding["sha256"]
        require(total <= 16 * 1024**2, "unique source byte ceiling")
    for role, logical in ROLES.items():
        require(programs[role]["path"] == logical, "own source path differs: " + role)
    require(programs["capture"]["sha256"] == "0786d2f24f074fac7f9583abf377b7ee7213778c020340d1963bab0703cd4aba" and
            programs["captureTests"]["sha256"] == "5ea7d83261e1b6ce2675df8edce4cb6ec5e5e299f51f0e97f16db020bc388bbc", "frozen codec changed")
    require(hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == programs["executionAuth"]["sha256"], "loaded own auth differs")
    return seen


def derive_model_metadata(reader, dataset_binding):
    from ecology_regime_execution_auth import derive_model_metadata as neutral_model_factory
    return neutral_model_factory(reader, dataset_binding)


def verify_model(reader, plan, *, recompute=True):
    model = read_json(reader, plan["modelBinding"])
    require(same_json(model, read_json(reader, MODEL_REFERENCE)), "frozen full108 initial model metadata differs")
    if recompute:
        require(same_json(model, derive_model_metadata(reader, plan["datasetManifest"])), "actual fresh model/initial states differ")
    return model


class _ClosureMetadataReader(Reader):
    """Only fixed task-bound metadata while recomputing the actual closure."""
    def __init__(self, root, diagnostic_binding):
        super().__init__(root)
        diagnostic = self.json(diagnostic_binding)
        input_bindings = {b["path"]: exact_binding(b) for b in diagnostic["inputBindings"]}
        self._metadata_bindings = {}
        for row in diagnostic["rows"]:
            if row["split"] not in ("train", "validation"):
                continue
            source = self.json(row["identity"]["taskPackage"])["sourceBindings"]
            for key in ("realEarthRegionSourcePackage", "seasonSnapshot", "regionalProfile"):
                logical = source[key + "Path"]
                binding = (input_bindings[logical] if key == "realEarthRegionSourcePackage" else
                           exact_binding({"path": logical, "sha256": source[key + "Sha256"]}))
                require(logical not in self._metadata_bindings or
                        same_json(self._metadata_bindings[logical], binding), "metadata source alias conflict")
                self._metadata_bindings[logical] = binding

    def snapshot(self, logical):
        if logical == CANONICAL_REGION_PROGRAM:
            return _snapshot_canonical_program(self.root, logical)
        require(logical in self._metadata_bindings, "unbound closure metadata snapshot")
        binding = self._metadata_bindings[logical]
        raw = self.read(binding, CONTROL_JSON_MAX)  # Existing small metadata ceiling, no promotion.
        decode_source_json(raw)
        return raw, dict(binding)


def derive_data_closure(root):
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC, CONDITION
    import painter_stage4_ecology_regime_training_profile as profile
    reader = _ClosureMetadataReader(root, DIAGNOSTIC)
    metadata = profile.prepare_metadata(reader, DIAGNOSTIC, CONDITION, collect_train_assets=True)
    reader.unchanged()
    return {"schema": "ecology-regime-failure-capture-data-closure-v1",
        "splitSampleIds": metadata["splitSampleIds"], "metadataCounts": metadata["metadataCounts"],
        "validationRgbRead": False, "challengeContentRead": False, "regressionContentRead": False,
        "bindings": [{"path": p, "sha256": sha} for p, sha in sorted(reader.observed.items())]}


def verify_data_closure(reader, plan, *, recompute=True):
    require(plan.get("outputRoot") == ROOT_PREFIX + plan["runId"] and
            plan["dataClosure"]["path"] == plan["outputRoot"] + "/data-closure.json", "cross Run data closure path")
    scope = {"runId": plan["runId"], "packageId": plan["packageId"], "dataClosure": exact_binding(plan["dataClosure"])}
    if type(reader) is Reader and reader._source_snapshot_scope is not None:
        require(same_json(reader._source_snapshot_scope, scope), "cross Run source snapshot scope")
    closure = read_json(reader, plan["dataClosure"])
    require(closure.get("schema") == "ecology-regime-failure-capture-data-closure-v1" and
            same_json(closure.get("metadataCounts"), {"train": 48, "validation": 8}) and
            all(closure.get(k) is False for k in ("validationRgbRead", "challengeContentRead", "regressionContentRead")), "data closure policy differs")
    bindings = closure.get("bindings")
    require(type(bindings) is list and 1 <= len(bindings) <= 8192 and len({b["path"] for b in bindings}) == len(bindings), "data closure members differ")
    if recompute:
        require(same_json(closure, derive_data_closure(reader.root)), "actual source/data closure differs")
    for b in bindings:
        reader.read(b)
    for split in ("train", "validation"):
        require(closure["splitSampleIds"][split] == read_json(reader, plan[split + "Split"])["sampleIds"], "data split/order differs")
    if type(reader) is Reader and recompute:
        reader.read(scope["dataClosure"], CONTROL_JSON_MAX)
        reader._source_snapshot_scope = scope
        reader._source_snapshot_bindings = {b["path"]: exact_binding(b) for b in bindings}
    return closure


def validate_plan(reader, plan, *, recompute_model=True):
    require(plan.get("schema") == PLAN_SCHEMA and plan.get("executionProfile") == PROFILE and
            plan.get("executionMode") == "bounded-failure-capture" and plan.get("capabilityVersion") == CAPABILITY,
            "own diagnostic plan required; old plan forbidden")
    for key in ("runId", "packageId"):
        require(type(plan.get(key)) is str and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", plan[key]), "Run/package ID invalid")
    require(plan["runId"] != plan["packageId"] and plan.get("outputRoot") == ROOT_PREFIX + plan["runId"] and
            plan.get("historicalCheckpointMayInitialize") is False and plan.get("trainingRestartAllowed") is False and
            "resourcePolicy" not in plan and "effectiveExecutionCeiling" not in plan, "diagnostic identity/retry/resource differs")
    require(same_json(plan.get("configuration"), configuration(reader)) and
            same_json(plan.get("formalSpecification"), SPECIFICATION) and same_json(plan.get("sourceCandidate"), CANDIDATE), "own configuration differs")
    candidate = read_json(reader, CANDIDATE)
    for split, count in (("train", 48), ("validation", 8)):
        key = split + "Split"
        require(same_json(plan.get(key), candidate["frozenBindings"][key]), "original split binding differs")
        ids = read_json(reader, plan[key])["sampleIds"]
        require(type(ids) is list and len(ids) == len(set(ids)) == count, "original split count/order differs")
    require(same_json(plan.get("datasetManifest"), candidate["frozenBindings"]["datasetManifest"]), "original64 data binding differs")
    manifest = read_json(reader, plan["datasetManifest"])
    require(len(manifest["identityPayload"]["channelOrder"]) == 23, "23 original spatial channels required")
    verify_programs(reader, plan["programBindings"])
    verify_model(reader, plan, recompute=recompute_model)
    verify_data_closure(reader, plan, recompute=recompute_model)
    require(same_json(plan.get("runtimeIdentity"), runtime_identity(reader.root)), "actual Python/Node runtime identity differs")
    exact_binding(plan["finalCpuAcceptance"])
    require(plan["finalCpuAcceptance"]["path"] == plan["outputRoot"] + "/cpu-acceptance.json" and
            plan["modelBinding"]["path"] == plan["outputRoot"] + "/model-identity.json" and
            plan["dataClosure"]["path"] == plan["outputRoot"] + "/data-closure.json", "own CPU/model/data paths differ")
    return plan


@dataclass(frozen=True)
class Context:
    reader: object
    package_binding: dict
    package: dict
    plan: dict


def load_execution_package(reader, binding, *, recompute_model=True):
    package = read_json(reader, binding)
    require(package.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1" and
            package.get("capabilityVersion") == CAPABILITY and package.get("ownerAuthorizationRequired") is False and
            package.get("ownerInStateMachine") is False and type(package.get("maxInfrastructureRecoveryAttempts")) is int and
            package["maxInfrastructureRecoveryAttempts"] == 0, "own standard diagnostic package required")
    inputs = package.get("inputEvidence")
    require(type(inputs) is list and 1 <= len(inputs) <= 512 and len({b["path"] for b in inputs}) == len(inputs), "package input closure differs")
    plans = [b for b in inputs if b["path"].endswith("/failure-capture-plan.json")]
    require(len(plans) == 1, "one own diagnostic plan required")
    plan = validate_plan(reader, read_json(reader, plans[0]), recompute_model=recompute_model)
    require(binding["path"] == ".runtime/ai-painter/autonomous-closed-loop-packages/" + plan["packageId"] + "/package.json" and
            package.get("packageIdentity") == plan["packageId"] and package.get("outputRoot") == plan["outputRoot"] and
            plans[0]["path"] == plan["outputRoot"] + "/failure-capture-plan.json", "cross Run/package prohibited")
    required = [SPECIFICATION, CANDIDATE, FROZEN_PLAN, MODEL_REFERENCE, plan["modelBinding"],
                plan["datasetManifest"], plan["trainSplit"], plan["validationSplit"], plan["finalCpuAcceptance"], plan["dataClosure"]]
    require(all(any(same_json(b, item) for b in inputs) for item in required), "required authority/CPU/model/data input omitted")
    require(same_json(package.get("programLineage"), {k: v["sha256"] for k, v in plan["programBindings"].items()}), "package source roles differ")
    phases = package.get("phaseAdapters")
    require(type(phases) is dict and set(phases) == PHASES, "six existing phases required")
    for phase, adapter in phases.items():
        require(same_json(adapter, {"kind": "project_module_export", "path": ROLES["adapter"],
                "sha256": plan["programBindings"]["adapter"]["sha256"], "exportName": phase}), "phase source differs")
    for item in inputs:
        reader.read(item)
    reader.unchanged()
    return Context(reader, dict(binding), package, plan)


def verify_live_context(context):
    reader, plan = context.reader, context.plan
    other = load_execution_package(reader, context.package_binding, recompute_model=False)
    require(same_json(other.plan, plan) and same_json(other.package, context.package), "live package/context changed")
    raw, registry_binding = reader.snapshot(REGISTRY)
    registry = decode(raw)
    active = registry.get("activeExecution")
    require(type(registry.get("registryRevision")) is int and registry["registryRevision"] > 0 and type(active) is dict and
            registry.get("executionState") == active.get("executionState") == "executing" and
            same_json(active.get("programLineage"), plan["programBindings"]), "live active source identity differs")
    identity = {"capabilityVersion": CAPABILITY, "runId": plan["runId"], "packageId": plan["packageId"]}
    require(all(registry.get(k) == active.get(k) == v for k, v in identity.items()), "cross active execution")
    pid, creation = active.get("processId"), active.get("processStartIdentity")
    require(type(pid) is int and pid > 0 and type(creation) is str and creation and process_identity(pid) == creation, "supervisor PID creation differs")
    identity.update(processId=pid, processStartIdentity=creation)
    lock = read_json(reader, active["lock"])
    require(active["lock"]["path"] == plan["outputRoot"] + "/execution-lock.json" and
            lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1" and
            all(lock.get(k) == v for k, v in identity.items()), "same Run immutable lock differs")
    require(same_json(active.get("heartbeat"), {"path": plan["outputRoot"] + "/heartbeat.json", "ttlSeconds": 120}), "heartbeat path/TTL differs")
    reader._heartbeat_expected_identity = dict(identity)
    try:
        heartbeat_raw, _ = reader.snapshot(active["heartbeat"]["path"])
    finally:
        reader._heartbeat_expected_identity = None
    heartbeat = decode(heartbeat_raw)
    require(heartbeat.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1" and
            heartbeat.get("executionState") == "executing" and heartbeat.get("ttlSeconds") == 120 and
            all(heartbeat.get(k) == v for k, v in identity.items()), "live heartbeat identity differs")
    stamp = datetime.fromisoformat(heartbeat["heartbeatAtUtc"].replace("Z", "+00:00"))
    require(stamp.tzinfo is not None and -300 <= (datetime.now(timezone.utc) - stamp).total_seconds() < 120,
            "live heartbeat stale/future")
    require(reader.mapping.binding(registry_binding) == raw and process_identity(pid) == creation, "registry/process changed")
    return {"status": "live_identity_authenticated_not_qualified", **identity}
