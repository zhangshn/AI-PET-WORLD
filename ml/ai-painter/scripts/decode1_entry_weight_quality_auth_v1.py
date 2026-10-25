# OSS-BIND-01-PY: independent support-structure execution identity.
"""Own 1.72 authentication; the 1.69 CPU template grants no execution admission."""
from dataclasses import dataclass
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import time
import weakref

# Neutral binding/JSON helpers only. Historical process/admission functions are unused.
from ecology_regime_execution_auth import exact_binding, decode, same_json
from ai_painter.complete_world.object_support_structure_failure_capture_v1 import RuntimeMap, require, MAX_CAPTURE, _file_identity


def _process_identity_api():
    require(os.name == "nt", "Windows process identity required")
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    signatures = {
        "OpenProcess": (wintypes.HANDLE, (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)),
        "GetProcessId": (wintypes.DWORD, (wintypes.HANDLE,)),
        "GetProcessTimes": (wintypes.BOOL, (wintypes.HANDLE, *(ctypes.POINTER(wintypes.FILETIME),) * 4)),
        "WaitForSingleObject": (wintypes.DWORD, (wintypes.HANDLE, wintypes.DWORD)),
        "CloseHandle": (wintypes.BOOL, (wintypes.HANDLE,)),
    }
    for name, (result, arguments) in signatures.items():
        function = getattr(kernel, name)
        function.restype, function.argtypes = result, arguments
    return kernel, ctypes, wintypes


def _process_creation_text(ticks):
    """CIM UTC microsecond precision, formatted as DateTime.ToString('o')."""
    require(type(ticks) is int and 0 <= ticks <= 0xffffffffffffffff, "invalid process FILETIME")
    try:
        created = datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=ticks // 10)
    except OverflowError as error:
        raise ValueError("process FILETIME outside canonical datetime range") from error
    return (f"{created.year:04d}-{created.month:02d}-{created.day:02d}T"
            f"{created.hour:02d}:{created.minute:02d}:{created.second:02d}.{created.microsecond:06d}0Z")


def process_identity(pid):
    """Fresh live-handle identity each call; no PID-only/cache/CIM fallback."""
    require(type(pid) is int and 0 < pid <= 0xffffffff, "invalid supervisor DWORD PID")
    kernel, ctypes, wintypes = _process_identity_api()
    # PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, non-inheritable.
    handle = kernel.OpenProcess(0x00101000, False, pid)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    require(handle not in (-1, ctypes.c_void_p(-1).value), "invalid process handle")
    primary = None
    try:
        def live():
            state = kernel.WaitForSingleObject(handle, 0)
            if state == 0xffffffff:
                raise ctypes.WinError(ctypes.get_last_error())
            require(state == 0x102, "process not live or invalid wait state")
        live()
        actual_pid = kernel.GetProcessId(handle)
        if not actual_pid:
            raise ctypes.WinError(ctypes.get_last_error())
        require(actual_pid == pid, "process handle PID differs")
        created, exited, system, user = (wintypes.FILETIME() for _ in range(4))
        if not kernel.GetProcessTimes(handle, ctypes.byref(created), ctypes.byref(exited),
                                      ctypes.byref(system), ctypes.byref(user)):
            raise ctypes.WinError(ctypes.get_last_error())
        text = _process_creation_text((int(created.dwHighDateTime) << 32) | int(created.dwLowDateTime))
        live()
        return str(pid) + ":" + text
    except BaseException as error:
        primary = error
        raise
    finally:
        try:
            if not kernel.CloseHandle(handle):
                raise ctypes.WinError(ctypes.get_last_error())
        except BaseException as closing:
            if primary is None:
                raise
            try:
                primary.process_identity_close_error = {"type": type(closing).__name__, "message": str(closing)[:512],
                                                       "winerror": getattr(closing, "winerror", None)}
            except BaseException:
                pass  # Preserve the first failure while remaining failed closed.


from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as checkpoint
CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_v1"
PROFILE = "bounded_decode1_entry_weight_quality24_v1"
PLAN_SCHEMA = "object-support-structure-quality-plan-v1"
ROOT_PREFIX = ".runtime/ai-painter/decode1-entry-weight-quality-executions/"
RUN_PREFIX = "decode1-entry-quality-v1-"
PACKAGE_PREFIX = "decode1-entry-quality-v1-package-"
SELF = "ml/ai-painter/scripts/decode1_entry_weight_quality_auth_v1.py"
SPECIFICATION = checkpoint.SPECIFICATION
CANDIDATE = {"path": "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json",
    "sha256": "ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"}
# New model metadata is recomputed by this program and materialized per Run.
# No old static model reference or old component receipt grants this identity.
MODEL_REFERENCE = None
FROZEN_PLAN = {"path": ".runtime/ai-painter/ecology-regime-managed-executions/ecology-managed-t73-20261009075755-execution/ecology-plan.json",
    "sha256": "03d5ec1e68701d03f5a9973c793731d1e3811226ed294e151e5a80bf225ca030"}
ORIGINAL_MANIFEST = {"path": ".runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1/ns003-original-package.json",
    "sha256": "0551d463b50041b3ca269d1edd927b0e7e2fb9af7f3c3388997eb8eefd0a1cb1"}
ORIGINAL_NATIVE_TESTS = {"path": ".runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1/ns003-original-native-tests.mjs",
    "sha256": "f5c0a559f5cd1fa915dc0ec4c456bbf58c8edd298596e1a5bd5e6cdf9f93b73b"}
ORIGINAL_REGISTRY = {"path": ".runtime/ai-painter/controller-parallel-20261011/controller-27-next-20261013/interrupted-training-20261013/inputs/original-registry.mjs",
    "sha256": "159d8d7b4e0d425271b0181aba4732e6b2c20efc4211e69583701e124adf488d"}
MANIFEST_ALIAS = "control:ai-painter-object-support-structure-quality"
MANIFEST_COMMAND = "node scripts/run-ai-painter-object-support-structure-quality-v1.mjs"
LOCAL_DEPLOYMENT_DEPENDENCY_ROLES = {
    "localOperatorDeploymentManifest": "node_modules/@next/env/package.json",
    "localOperatorDeploymentLoader": "node_modules/@next/env/dist/index.js"}
REGISTRY = ".runtime/ai-painter/current-execution-registry/current.json"
PHASES = {"preflight", "execute", "validate", "review", "adjudicate", "finalize"}
SOURCE_JSON_MAX = 8 * 1024**2
CONTROL_JSON_MAX = 2 * 1024**2
PROGRAM_MAX = 1024**2
CANONICAL_REGION_PROGRAM = "scripts/lib/real-earth-region-governance.mjs"
MODEL_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1"
EXECUTION_POLICY_PATH = checkpoint.POLICY["path"]
EXECUTION_POLICY = checkpoint.POLICY
ROLES = {
    "adapter": "scripts/run-ai-painter-object-support-structure-quality-v1.mjs",
    "packageChain": "scripts/lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs",
    "frozenProjectManifest": ".runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1/ns003-original-package.json",
    "currentLegacyNativeTests": "scripts/tests/ai-painter-ecology-owned-native.test.mjs",
    "currentExecutionRegistry": "src/server/ai-painter-current-execution-registry.mjs",
    "worker": "ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_quality_worker_v1.py",
    "gpuQualifier": "ml/ai-painter/scripts/qualify_stage4_decode1_entry_weight_quality_gpu_v1.py",
    "executionAuth": "ml/ai-painter/scripts/decode1_entry_weight_quality_auth_v1.py",
    "registration": "scripts/lib/ai-painter-decode1-entry-weight-quality-registration-v1.mjs",
    "nativeRunner": "scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs",
    "nativeOwnerBuilder": "scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs",
    "nativeOwnerSource": "scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs",
    "nativeStreamTests": "scripts/tests/ai-painter-owned-worker-stream-v2.test.mjs",
    "cpuHarness": "ml/ai-painter/tests/test_decode1_entry_weight_quality_adapters_cpu_v1.py",
    "entryTests": "scripts/tests/ai-painter-decode1-entry-weight-quality-entry.test.mjs",
    "capture": "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py",
    "captureTests": "ml/ai-painter/tests/test_ecology_regime_gradient_failure_capture_cpu.py",
    "loop": "ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_lifecycle_v1.py",
    "loopTests": "ml/ai-painter/tests/test_decode1_entry_weight_quality_adapters_cpu_v1.py",
    "trainingProfile": "ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py",
    "managedCheckpoint": "ml/ai-painter/src/ai_painter/complete_world/decode1_entry_weight_quality_checkpoint_v1.py",
    "ranking": "ml/ai-painter/scripts/ecology_quality_ranking_v1.py",
    "checkpointTests": "ml/ai-painter/tests/test_decode1_entry_weight_quality_adapters_cpu_v1.py",
    "decode1Model": "ml/ai-painter/src/ai_painter/complete_world/object_ecology_terrain_detail_weight_precision_v1.py",
    "decode1Operator": "ml/ai-painter/src/ai_painter/complete_world/decode1_weight_reduction_precision_v1.py",
    "decode1Bridge": "ml/ai-painter/src/ai_painter/complete_world/object_ecology_terrain_detail_weight_priority_update_v1.py",
    "decode1CoreTests": "ml/ai-painter/tests/test_ecology_terrain_detail_precision_cpu.py",
    "reviewWorker": "ml/ai-painter/scripts/decode1_entry_weight_quality_review_v1.py",
    "reviewDriver": "scripts/run-ai-painter-object-support-structure-quality-review-v1.mjs",
    "reviewRecovery": "scripts/lib/ai-painter-ecology-terrain-detail-review-recovery-v1.mjs",
    "reviewTests": "ml/ai-painter/tests/test_decode1_entry_weight_quality_adapters_cpu_v1.py",
    "diagnosticLoop": "ml/ai-painter/scripts/painter_stage4_ecology_regime_failure_capture.py",
    "diagnosticLoopTests": "ml/ai-painter/tests/test_ecology_regime_failure_capture_cpu.py",
    "localControl": "scripts/run-ai-painter-local-control-v1.mjs",
    "localPrepareEntry": "scripts/run-ai-painter-local-control-v2.mjs",
    "localPrepare": "scripts/lib/ai-painter-local-prepare-v1.mjs",
    "stopNativeControl": "scripts/lib/ai-painter-owned-stop-native-control-v1.mjs",
    "stopRequest": "scripts/lib/ai-painter-owned-stop-request-v1.mjs",
    "stopExecutionBridge": "scripts/lib/ai-painter-owned-stop-execution-bridge-v1.mjs",
    "stopHandoff": "scripts/lib/ai-painter-owned-stop-handoff-v1.mjs",
    "operatorSession": "src/server/ai-console-control/operator-session.ts",
    "backgroundLauncher": "scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs",
    "storageMapping": "scripts/lib/ai-pet-world-storage.mjs",
    "exactlyOnceSpawn": "scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs",
    "executionPolicy": EXECUTION_POLICY_PATH,
    "terrainDetailOperator": "ml/ai-painter/src/ai_painter/complete_world/terrain_detail_weight_reduction_precision_v1.py",
    "parentDecode1Model": "ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_weight_precision_v1.py",
    "parentDecode1Bridge": "ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_weight_priority_update_v1.py",
    "packageTests": "scripts/tests/ai-painter-object-support-structure-quality-package.test.mjs",
    "supportLoss": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_support_structure_candidate_cpu_v1.py",
    "supportDeviceLoss": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_support_structure_device_v1.py",
    "supportCpuBridge": "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_priority_update_cpu_v1.py",
    "supportDeviceBridge": "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_priority_update_device_v1.py",
    "supportCpuProfile": "ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_cpu_v1.py",
    "supportLossPolicy": "data/ai-painter/system-governance/ai-painter-object-support-structure-cpu-policy-v1.json",
    "supportGradientPolicy": "data/ai-painter/system-governance/ai-painter-object-support-structure-integration-cpu-policy-v1.json",
    "supportLifecyclePolicy": "data/ai-painter/system-governance/ai-painter-object-support-structure-lifecycle-integration-policy-v1.json",
    "supportLossTests": "ml/ai-painter/tests/test_native_rgb_object_support_structure_candidate_cpu_v1.py",
    "supportCpuBridgeTests": "ml/ai-painter/tests/test_object_support_structure_integration_cpu_v1.py",
    "supportDeviceTests": "ml/ai-painter/tests/test_object_support_structure_device_integration_cpu_v1.py",
    "legacyConfigurationSpecification": "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.69-792bf647.txt",
    "sharedQualityChain": "scripts/lib/ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs",
    "sharedQualityNative": "scripts/lib/ai-painter-ecology-terrain-detail-quality-owned-native-v1.mjs",
    "sharedQualityRegistration": "scripts/lib/ai-painter-ecology-terrain-detail-quality-registration-v1.mjs",
    "sharedQualityReviewDriver": "scripts/run-ai-painter-ecology-terrain-detail-quality-review-v1.mjs",
    "sharedQualityLifecycle": "ml/ai-painter/scripts/painter_stage4_ecology_terrain_detail_weight_quality_lifecycle_v1.py",
    "sharedQualityProfile": "ml/ai-painter/scripts/painter_stage4_ecology_terrain_detail_weight_training_profile_v1.py",
    "sharedQualityCheckpoint": "ml/ai-painter/src/ai_painter/complete_world/ecology_terrain_detail_weight_checkpoint_v1.py",
    "sharedQualityCapture": "ml/ai-painter/src/ai_painter/complete_world/ecology_regime_gradient_failure_capture.py",
    "sharedQualityAuth": "ml/ai-painter/scripts/ecology_terrain_detail_weight_quality_auth_v1.py",
    "sharedQualityCpuHarness": "ml/ai-painter/tests/test_ecology_terrain_detail_weight_quality_execution_cpu.py",
    "sharedQualityEntryTests": "scripts/tests/ai-painter-ecology-terrain-detail-quality-entry.test.mjs"
}
CPU_SPECIFICATION_BASELINE = {"path": "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.69-792bf647.txt", "sha256": "792bf647336eb59a3cdbe6b4efbe3e630724e810ba0afa125fb4d7cc350c2e19"}


PROGRESS_PUBLICATION_POLICY = checkpoint.PROGRESS_PUBLICATION_POLICY
PROGRESS_PUBLICATION_PATH = "ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v1.py"
PROGRESS_PUBLICATION = {"componentPolicy": PROGRESS_PUBLICATION_POLICY,
    "componentPath": PROGRESS_PUBLICATION_PATH, "freshnessSeconds": 120,
    "maximumPendingFiles": 1, "originalDeadlineRequired": True}
# Bind only the actual execution roles; history remains immutable policy evidence.
ROLES = {key: ROLES[key] for key in ("adapter", "packageChain", "currentExecutionRegistry", "worker", "gpuQualifier", "executionAuth", "registration", "nativeRunner", "nativeOwnerBuilder", "nativeOwnerSource", "cpuHarness", "entryTests", "loop", "trainingProfile", "managedCheckpoint", "ranking", "reviewWorker", "reviewDriver", "capture")}
ROLES.update(executionPolicy=EXECUTION_POLICY_PATH, progressPublication=PROGRESS_PUBLICATION_PATH)
ROLES.update(nativeOwnerBuilder="scripts/lib/ai-painter-decode1-entry-completion-native-owner-v1.mjs",
    nativeOwnerSource="scripts/windows/ai-painter-owned-worker-owner-stream-completion-v1.cs")
ROLES.update(adapter="scripts/run-ai-painter-decode1-entry-weight-quality-v1.mjs",
    entryTests="scripts/tests/ai-painter-decode1-entry-weight-quality-integration.test.mjs",
    reviewDriver="scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs",
    previewComponent="ml/ai-painter/src/ai_painter/complete_world/training_preview_observer_v2.py",
    previewStorage="ml/ai-painter/src/ai_painter/complete_world/training_preview_storage_v2.py",
    previewTests="ml/ai-painter/tests/test_training_preview_observer_cpu_v2.py",
    previewStorageTests="ml/ai-painter/tests/test_training_preview_storage_cpu_v2.py")

@dataclass(frozen=True)
class ExecutionRoute:
    capability: str
    model_capability: str
    profile: str
    root_prefix: str
    specification: dict
    execution_policy: dict

def execution_route(capability_version=CAPABILITY):
    values=checkpoint.execution_values(capability_version)
    return ExecutionRoute(capability_version, checkpoint.model_capability(capability_version),
        values.get("profile") or ("completion_decode1_entry_weight_quality24_same_call_v1" if values.get("same_call_capture") else "completion_decode1_entry_weight_quality24_v2" if values.get("qualification_completion") else "completion_decode1_entry_weight_quality24_v1" if values["completion"] else PROFILE),
        values["root_prefix"],values["specification"],values["policy"])

def program_file_limit(capability_version=CAPABILITY):
    execution_route(capability_version)
    return 256

def validate_program_count(programs, capability_version=CAPABILITY):
    require(type(programs) is dict and 1 <= len(programs) <= program_file_limit(capability_version),
        "decode1 entry actual source count exceeds256")

def checkpoint_components(capability_version=CAPABILITY):
    execution_route(capability_version)
    return checkpoint

def profile_components(capability_version=CAPABILITY):
    execution_route(capability_version)
    import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
    require(profile.CAPABILITY == CAPABILITY and profile.MODEL_CAPABILITY == MODEL_CAPABILITY,
        "exact new training profile/model required")
    return profile


def model_arguments(capability_version=CAPABILITY):
    model = execution_route(capability_version).model_capability
    return {} if model == MODEL_CAPABILITY else {"model_capability": model}

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


def _heartbeat_content(raw, scope, expected, *, independent=False):
    value = decode(raw)
    require(type(value) is dict and value.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1" and
        value.get("runId") == scope["runId"] and value.get("packageId") == scope["packageId"] and
        value.get("capabilityVersion") == execution_route(scope.get("capabilityVersion",CAPABILITY)).capability and value.get("executionState") == ("reviewing" if independent else "executing") and
        type(value.get("ttlSeconds")) is int and value["ttlSeconds"] == 120 and
        type(value.get("processId")) is int and value["processId"] > 0 and
        type(value.get("processStartIdentity")) is str and value["processStartIdentity"], "heartbeat control identity differs")
    if expected is not None:
        require(all(value.get(k) == v for k, v in expected.items()), "heartbeat live identity differs")
    stamp = datetime.fromisoformat(value["heartbeatAtUtc"].replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - stamp).total_seconds()
    require(stamp.tzinfo is not None and ((0 <= age <= 5) if independent else (-300 <= age < 120)),
        "heartbeat stale/future")


def _snapshot_heartbeat(reader, logical, scope, expected=None, *, review_history=None):
    root = execution_route(scope.get("capabilityVersion",CAPABILITY)).root_prefix + scope["runId"]
    independent = review_history is not None
    if independent:
        require(review_history is reader._review_history and review_history in _VERIFIED_REVIEW_HISTORIES
            and independent_plan_path(review_history.plan_path), "verified independent heartbeat context required")
        output = review_history.plan_path.removesuffix("/plan.json")
        own_path = _INDEPENDENT_CASE + "/control-heartbeat/" + output.rsplit("/review-",1)[1] + "/heartbeat.json"
        require(logical == own_path and scope["outputRoot"] == output and expected is not None,
            "independent heartbeat path/context differs")
    require(independent or logical == root + "/heartbeat.json" or
        (logical == root + "/qualification-heartbeat.json" and getattr(reader, "_heartbeat_expected_path", None) == logical),
        "exact own phase heartbeat required")
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
                _heartbeat_content(raw, scope, expected, independent=independent)
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
                try:
                    record = json.dumps(evidence, ensure_ascii=True, separators=(",", ":")) + "\n"
                    if len(record.encode("utf8")) < 16384:
                        _heartbeat_log(record)
                except BaseException:
                    pass  # Failure logging is best-effort; preserve the original exception.
                raise
            _heartbeat_pause(min(.010, max(0, .100 - elapsed)))


_REVIEW_CASE=".runtime/ai-painter/controller-repair-reviews/training-review-data-identity-20261022"
_SUCCESSOR_CASE=".runtime/ai-painter/controller-repair-reviews/training-review-transport-successor-002-20261022"
_INDEPENDENT_CASE=".runtime/ai-painter/controller-repair-reviews/independent-review-adoption-004-20261022"
_REVIEW_RUN="d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8"
_REVIEW_CAPABILITY="stage4_mvp256_dry_decode1_registered_source_v1"
_REVIEW_NORMALS=(
    ("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
     "385d9a2a788ca016545ea2b620c45a4ff05c28cd1dfb48bba5378395b9f7e8c3",
     "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.108-385d9a2a.txt",
     "89a0d3f9f1a67390eeb5c71ac85491a2ad5ce4974803f87c7466c1319f00c167"),
    ("docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
     "48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909",
     "data/ai-painter/system-governance/document-baselines/review-storage-1.25-48d9b177.txt",
     "4b4e4d083024e9944474dc3df3db97ae782910064661cd74fb8cdca94ddbe6e5"),
    ("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
     "6232b96b13ab590a44c3d0ae582fa1e3fbb34eb7d5806fefed4d5143bb547d87",
     "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.109-6232b96b.txt",
     "89a0d3f9f1a67390eeb5c71ac85491a2ad5ce4974803f87c7466c1319f00c167"),
    ("docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
     "6b244778888fd4619f511091b598698b8d2c44d772d6a6b642b3af09a69b1549",
     "data/ai-painter/system-governance/document-baselines/review-storage-1.26-6b244778.txt",
     "4b4e4d083024e9944474dc3df3db97ae782910064661cd74fb8cdca94ddbe6e5"),
    ("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
     "c360fdc0499c2b986ab506c98408cd3ab4ca7bffdc7725bac07d9fdb03f3a3fd",
     "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.110-c360fdc0.txt",
     "89a0d3f9f1a67390eeb5c71ac85491a2ad5ce4974803f87c7466c1319f00c167"),
    ("docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
     "6a1068fbbe16f3683b7a16c2e3e8fd8d4888817e9e88307104b6338ee51096e5",
     "data/ai-painter/system-governance/document-baselines/review-storage-1.27-6a1068fb.txt",
     "4b4e4d083024e9944474dc3df3db97ae782910064661cd74fb8cdca94ddbe6e5"))

def independent_plan_path(logical):
    return type(logical) is str and re.fullmatch(re.escape(_INDEPENDENT_CASE)+r"/review-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/plan\.json",logical) is not None


def successor_plan_path(logical):
    return re.fullmatch(re.escape(_SUCCESSOR_CASE)+r"/review-v2-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/plan\.json",logical) is not None


def successor_budget(reader,prior):
    """Exact prior execution records, not a caller's new allowance."""
    def bound(path,digest):return read_json(reader,{"path":path,"sha256":digest})
    command=bound(_REVIEW_CASE+"/single-recovery-command-result.json","25fa14f37328863bfd254952cf3f31a5e0211a9b7adaa2a024517066f54b7996")
    close=_SUCCESSOR_CASE+"/old-prelaunch-closeout"
    accounting=bound(close+"/execution-accounting.json","f12d2d9e93702b6e0e10791a84deb6373bd77d4449ccf3dd8a1cf75298b67865")
    proof=bound(close+"/proof.json","efbe59fa579ed25535fa0f70a3a87c05b40b17517391fae7da1a0032b1191aef")
    terminal=bound(close+"/failure-terminal.json","407ce5d97d3bde26c9e74a3cb106182ff935b1129ea14bd73c9537e23bc0aadd")
    writer=bound(close+"/writer.stdout.json","7cf3b8f62d9e356e523e7a83152831ba988ff0b3de15c94810328a7be2ffb7c2")
    previous=bound(_REVIEW_CASE+"/recovery-v1/plan.json","d29f3b6d0227957897e32490cb4246d3812037516ce1ecb6eb09006485bbfca1")
    consumed=bound(_REVIEW_CASE+"/recovery-v1/consumed.json","cf59a858a9f4fa90a0eff22a3db69ed5708fb0dd1c3c40d3507347a956edd0d9")
    require(command["exitCode"]==13 and accounting["exitCode"]==0 and writer["current"]["ok"] is True
        and writer["current"]["registry"]["registryRevision"]==502
        and writer["current"]["registry"]["activeExecution"] is None
        and terminal["executionState"]=="failed_closed" and terminal["nativeCleanupCertified"] is False
        and terminal["nativeReceipt"] is None and proof["sourcePlan"]==consumed["plan"],"verified original prelaunch failure closeout required")
    latest=writer["current"]["registry"]["latestTrainingTerminal"]
    require({k:latest[k] for k in ("path","sha256")}==previous["sourceWorkerTerminal"],"old closeout changed training terminal")
    require(accounting["priorRecoveryDebitMs"]==math.ceil(command["elapsedSeconds"]*1000)
        and accounting["wallDebitMs"]==math.ceil(accounting["elapsedMonotonicMsObserved"]),"prior execution debit differs")
    wall=prior["elapsedMs"]+accounting["priorRecoveryDebitMs"]+accounting["wallDebitMs"]
    streams=sum(prior["streamBytes"].values())+command["stdoutBytes"]+command["stderrBytes"]+accounting["stdoutBytes"]+accounting["stderrBytes"]
    require(type(wall) is int and 0<wall<120000 and type(streams) is int and 0<=streams<8388608,"cumulative prior budget exhausted")
    roots=prior["outputAccountingRoots"]+[_REVIEW_CASE+"/recovery-v1",close,_SUCCESSOR_CASE+"/prior-command-capture",_SUCCESSOR_CASE+"/admission"]
    return {"timeoutMs":120000-wall,"priorWallMs":wall,"priorStreamBytes":streams,"outputBytes":16777216-streams,"roots":roots}


INDEPENDENT_POLICY={"path":".runtime/ai-painter/controller-repair-reviews/review-budget-proposal-003-20261022/controller-budget-plan-v1.json","sha256":"4e169d35a56a7315d8c3af7ebd1ceb63b6a513ec86c52a7057754cb5566a4bab"}
PRIOR_ACCOUNTING={"path":_SUCCESSOR_CASE+"/real-terminal-accounting-v1.json","sha256":"8ae668c5b1a487a909dd99e0d81a3017457a22e1d29c383c55812ca27c77e34b"}
INDEPENDENT_LIMITS={"maxWallMs":300000,"terminalReserveMs":15000,"maxOutputBytes":16777216,"cpuThreads":2,"modelForwardCalls":16,"optimizerSteps":0,"automaticRetries":0,"heartbeatTtlSeconds":120,"heartbeatMaximumIntervalMs":5000}
CONTROL_RESERVE_BYTES=3*1024**2


def independent_budget(reader):
    """Recompute consumed calls and actual retained evidence; no new allowance."""
    import sqlite3
    import base64
    def bound(b):return read_json(reader,{"path":b["path"],"sha256":b["sha256"]})
    def packed(v):return json.dumps(v,ensure_ascii=False,separators=(",",":"),allow_nan=False).encode()
    a=bound(PRIOR_ACCOUNTING)
    old=bound({"path":_REVIEW_CASE+"/recovery-v1/plan.json","sha256":"d29f3b6d0227957897e32490cb4246d3812037516ce1ecb6eb09006485bbfca1"})
    prior=bound(old["priorReviewReceipt"]);legacy=successor_budget(reader,prior)
    command=bound(a["command"]);last=bound(a["liveNativeReceipt"])
    close=bound({"path":_SUCCESSOR_CASE+"/old-prelaunch-closeout/execution-accounting.json","sha256":"f12d2d9e93702b6e0e10791a84deb6373bd77d4449ccf3dd8a1cf75298b67865"})
    require(last["cleanupConfirmed"] is True and last["ownerClosed"] is True
        and last["proof"]["activeProcessesAfterCleanup"]==0,"prior live cleanup not proven")
    wall=[prior["elapsedMs"],close["priorRecoveryDebitMs"],close["wallDebitMs"],math.ceil(command["launcherObservedElapsedSeconds"]*1000)]
    require(all(type(n) is int and n>=0 for n in wall) and sum(wall)==119634
        and sum(wall[:3])==legacy["priorWallMs"],"actual cumulative wall debit differs")
    def ordinary(path,directory=False):
        info=path.lstat()
        require((stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode))
            and not stat.S_ISLNK(info.st_mode) and not getattr(info,"st_file_attributes",0)&0x400,
            "prior accounting evidence not ordinary")
        return info
    def files(logical):
        folder=reader.path(logical);ordinary(folder,True);result=set()
        for path in folder.iterdir():
            child=logical+"/"+path.name
            if stat.S_ISDIR(path.lstat().st_mode):result.update(files(child))
            else:ordinary(path);result.add(child)
        return result
    disk=0;all_files=[]
    for group in a["phaseOutputRoots"]:
        expected={b["path"] for b in group["files"]}
        require(len(expected)==len(group["files"]) and files(group["path"])==expected,"prior accounting file set changed")
        all_files.extend(group["files"])
    all_files.extend(a["externalCommandEvidence"]+a["registrationFiles"])
    for b in all_files:
        raw=reader.read({"path":b["path"],"sha256":b["sha256"]})
        require(len(raw)==b["bytes"],"prior evidence byte count differs");disk+=len(raw)
    db_path=reader.path(".runtime/ai-painter/current-execution-registry/registry.sqlite");ordinary(db_path)
    database=sqlite3.connect(db_path.as_uri()+"?mode=ro",uri=True)
    try:
        database.row_factory=sqlite3.Row
        rows=[dict(v) for v in database.execute("SELECT * FROM registry_revisions WHERE registry_revision BETWEEN 500 AND 504 ORDER BY registry_revision")]
        tx=[dict(database.execute("SELECT * FROM registry_transactions WHERE transaction_id=?",(v["transaction_id"],)).fetchone()) for v in rows]
    finally:database.close()
    require(rows==a["sqliteRevisionRows"] and tx==a["sqliteTransactionRows"],"prior logical SQLite records differ")
    logical_rows=sum(len(packed(v)) for v in rows+tx)
    require(logical_rows==a["output"]["registrationLogicalSqlRowsBytes"],"prior logical SQLite byte count differs")
    event_path=reader.path(".runtime/ai-painter/current-execution-registry/events.jsonl");info=ordinary(event_path)
    require(info.st_size<=8*1024**2,"event evidence byte ceiling")
    with event_path.open("rb") as f:events=f.read(8*1024**2+1)
    require(len(events)<=8*1024**2,"event evidence grew beyond ceiling")
    selected=[line for line in events.splitlines(keepends=True) if line.strip() and json.loads(line).get("registryRevision") in range(500,505)]
    require(len(selected)==5,"prior event count differs")
    for line in selected:
        e=json.loads(line);row=next(v for v in rows if v["registry_revision"]==e["registryRevision"])
        require(e["transactionId"]==row["transaction_id"] and e["currentSha256"]==row["current_sha256"],"prior event/SQLite identity differs")
    event_bytes=sum(map(len,selected));require(event_bytes==a["output"]["registrationEventLineBytes"],"prior event byte count differs")
    retired=0
    for receipt in (prior,last):
        proof=json.loads(base64.b64decode(receipt["proof"]["bindingBase64"],validate=True));raw=packed(proof["guard"])
        require(hashlib.sha256(raw).hexdigest()==proof["guardSha256"],"prior released guard bytes differ");retired+=len(raw)
    streams=legacy["priorStreamBytes"]+sum(last["streamBytes"].values())+command["stdoutBytes"]+command["stderrBytes"]
    total=disk+logical_rows+event_bytes+retired+streams
    require(total==a["output"]["conservativeKnownBytes"] and total>=556372
        and total+CONTROL_RESERVE_BYTES<16777216 and 0<=streams<8388608-65536,"actual cumulative output debit differs")
    policy=bound(INDEPENDENT_POLICY)
    require(policy["wallBudget"]["newCumulativeCeilingMs"]==300000
        and policy["wallBudget"]["priorActualConservativeMs"]==sum(wall)
        and policy["wallBudget"]["selectedCleanupAndOuterTerminalReserveMs"]==15000,"independent policy differs")
    return {"timeoutMs":300000-sum(wall),"priorWallMs":sum(wall),"terminalReserveMs":15000,
        "priorByteDebit":total,"priorStreamBytes":streams,"outputBytes":16777216-total-CONTROL_RESERVE_BYTES,
        "controlReserveBytes":CONTROL_RESERVE_BYTES,"roots":[_INDEPENDENT_CASE+"/admission"]}


@dataclass(frozen=True)
class _ReviewHistory:
    root: str
    plan_path: str
    aliases: tuple
    original_auth: tuple
    actual_auth: tuple


_VERIFIED_REVIEW_HISTORIES=weakref.WeakSet()
_VERIFIED_FIT_HISTORIES=weakref.WeakSet()


def _review_alias_shape(plan,original,preservation):
    require(plan.get("schema")=="completed-training-independent-review-v1"
        and plan.get("runId")==original.get("runId")==_REVIEW_RUN
        and plan.get("capabilityVersion")==original.get("capabilityVersion")==_REVIEW_CAPABILITY,
        "exact recovery Run/context required")
    programs=plan["programBindings"]
    require(set(programs)==set(original["programBindings"]),"recovery source closure roles differ")
    mutable={"reviewWorker","reviewDriver","nativeRunner","executionAuth"}
    for role,b in programs.items():
        old=original["programBindings"][role]
        require(exact_binding(b)["path"]==old["path"] and (role in mutable or b==old),"recovery protected source differs: "+role)
    require(preservation["sourcePlan"]==plan["sourceTrainingPlan"]
        and preservation["sourcePackage"]==plan["sourceExecutionPackage"]
        and len(preservation["entries"])==len(programs),"historical closure preservation differs")
    aliases=[];seen=set()
    for row in preservation["entries"]:
        role=row["role"]
        require(role in programs and role not in seen,"historical role duplicated/extra")
        seen.add(role);old=original["programBindings"][role]
        require(row["originalPath"]==old["path"] and row["sha256"]==old["sha256"]
            and row["snapshotPath"]==_REVIEW_CASE+"/source-baselines/"+old["sha256"]+".txt","historical source mapping differs")
        if role in mutable:aliases.append((old["path"],old["sha256"],row["snapshotPath"]))
    for logical,digest,snapshot,_current in _REVIEW_NORMALS:aliases.append((logical,digest,snapshot))
    return tuple(aliases)


def verified_review_history(root,plan_binding):
    """Only this case's bound old sources/norms, never a caller supplied resolver."""
    exact_binding(plan_binding)
    cpu_path=_REVIEW_CASE+"/cpu-history-context-"+plan_binding["sha256"]+".json"
    require(independent_plan_path(plan_binding["path"]) or plan_binding["path"]==cpu_path,
        "unregistered recovery context path")
    live=Reader(root)
    plan=read_json(live,plan_binding)
    if plan_binding["path"]==cpu_path:
        require(plan.get("purpose")=="cpu_metadata_history_verification","CPU history context cannot execute a review")
    require(plan["sourceExecutionPackage"]["sha256"]=="835e0bb18a2fb7f5614b1bf7b494acd8149842475584b313f0be24ff0f9ae27a"
        and plan["sourceTrainingPlan"]["sha256"]=="fc2a9d8d4d1b9cdb280be9e8d2ad5459f3a0f24e0543e5ef030bc64741bfa641",
        "original package/plan identity differs")
    package=read_json(live,plan["sourceExecutionPackage"])
    require(plan["sourceTrainingPlan"] in package["inputEvidence"],"historical plan outside package")
    original=read_json(live,plan["sourceTrainingPlan"])
    require(plan["sourcePreservation"]["path"]==_REVIEW_CASE+"/all-original-source-preservation.json","preservation path differs")
    preservation=read_json(live,plan["sourcePreservation"])
    aliases=_review_alias_shape(plan,original,preservation)
    for logical,digest,snapshot in aliases:live.read({"path":snapshot,"sha256":digest})
    for logical,_digest,_snapshot,current in _REVIEW_NORMALS:live.read({"path":logical,"sha256":current})
    for b in plan["programBindings"].values():live.read(b)
    actual=plan["programBindings"]["executionAuth"]
    require(actual["path"]=="ml/ai-painter/scripts/decode1_entry_weight_quality_auth_v1.py"
        and hashlib.sha256(Path(__file__).read_bytes()).hexdigest()==actual["sha256"],"actual recovery auth source differs")
    live.unchanged()
    history=_ReviewHistory(str(Path(root).absolute()),plan_binding["path"],aliases,
        tuple(original["programBindings"]["executionAuth"].items()),tuple(actual.items()))
    _VERIFIED_REVIEW_HISTORIES.add(history)
    return history


class Reader:
    def __init__(self, root, *, review_history=None, fit_history=None):
        self.root = Path(root).absolute()
        require(review_history is None or type(review_history) is _ReviewHistory
            and review_history in _VERIFIED_REVIEW_HISTORIES
            and review_history.root==str(self.root),"verified same-root recovery history required")
        self._review_history=review_history
        require(review_history is None or fit_history is None, "distinct history contexts cannot mix")
        self._fit_history = None
        if fit_history is not None:
            require(fit_history in _VERIFIED_FIT_HISTORIES
                and fit_history.root == str(self.root), "verified same-root FIT006 history required")
            self._fit_history = fit_history
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
        effective=binding
        history = self._review_history or self._fit_history
        if history is not None:
            match=next((row for row in history.aliases if row[:2]==(binding["path"],binding["sha256"])),None)
            if match is not None:effective={"path":match[2],"sha256":match[1]}
        path = self.path(effective["path"])
        before = path.lstat()
        require(stat.S_ISREG(before.st_mode) and 0 <= before.st_size <= maximum, "binding absent/oversized")
        # The policy ceiling remains above. The original reader still verifies
        # roots, handles, byte SHA and file identity; only its allocation shrinks.
        raw = self.mapping.binding(effective, maximum=before.st_size)
        after = self.path(effective["path"]).lstat()
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
                (logical == execution_route(self._source_snapshot_scope.get("capabilityVersion",CAPABILITY)).root_prefix + self._source_snapshot_scope["runId"] + "/heartbeat.json" or
                 (logical == execution_route(self._source_snapshot_scope.get("capabilityVersion",CAPABILITY)).root_prefix + self._source_snapshot_scope["runId"] + "/qualification-heartbeat.json"
                  and getattr(self, "_heartbeat_expected_path", None) == logical))),
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

    def _verified_canonical_region(self, record, region, module_binding, expected):
        return _verified_canonical_region(self, record, region, module_binding, expected)


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
    # Data-only closure. Return authentic raw code, never JSON decode it.
    return raw, dict(binding)


def runtime_identity(root):
    from ai_painter.complete_world.object_support_structure_failure_capture_v1 import _plain, _file_identity
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


CANONICAL_VERIFICATION = {
    "schemaVersion":"canonical-region-verification-v1",
    "activation":"authenticated_live_v3_reader_run_package_only",
    "cacheScope":"reader_process_run_package", "maximumCacheEntries":64, "maximumCacheBytes":65536,
    "cacheSuccessfulDigestsOnly":True, "revalidateSourceBytesEveryCall":True,
    "canonicalProgram":{"path":CANONICAL_REGION_PROGRAM,"sha256":"c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1"},
    "nodeIdentity":"verified_runtimeIdentity_node", "subprocessTimeoutSeconds":10,
    "observationFile":"canonical-initialization-observation.json", "maximumObservationBytes":32768,
    "terminalReserveBytes":65536}
CANONICAL_VERIFICATION_V4 = {**deepcopy(CANONICAL_VERIFICATION), "activation":"authenticated_live_v4_reader_run_package_only"}
CANONICAL_VERIFICATION_V5 = {**deepcopy(CANONICAL_VERIFICATION), "activation":"authenticated_live_v5_reader_run_package_only"}
CANONICAL_VERIFICATION_V6 = {**deepcopy(CANONICAL_VERIFICATION), "activation":"authenticated_live_v6_reader_run_package_only"}
CANONICAL_CAPABILITIES = (checkpoint.TRAINING_CAPTURE_V3_CAPABILITY, checkpoint.TRAINING_CAPTURE_V4_CAPABILITY, checkpoint.TRAINING_CAPTURE_V5_CAPABILITY, checkpoint.TRAINING_CAPTURE_V6_CAPABILITY)

def canonical_verification_identity(capability):
    identities = {checkpoint.TRAINING_CAPTURE_V3_CAPABILITY:CANONICAL_VERIFICATION,
        checkpoint.TRAINING_CAPTURE_V4_CAPABILITY:CANONICAL_VERIFICATION_V4,
        checkpoint.TRAINING_CAPTURE_V5_CAPABILITY:CANONICAL_VERIFICATION_V5,
        checkpoint.TRAINING_CAPTURE_V6_CAPABILITY:CANONICAL_VERIFICATION_V6}
    require(capability in identities, "unknown canonical verification identity")
    return identities[capability]

_CANONICAL_STATES = weakref.WeakKeyDictionary()
_CANONICAL_ACTIVATION_PROOF = object()
_CANONICAL_RECORD_KEYS = ("conditionPack","taskPackage","regionSourcePackage","seasonSnapshot","regionalProfile","sourceRegistry")


def _canonical_scope(reader, plan, package_binding):
    contract = canonical_verification_identity(plan["capabilityVersion"])
    expected = {"runId":plan["runId"],"packageId":plan["packageId"],"dataClosure":exact_binding(plan["dataClosure"]),
        "capabilityVersion":plan["capabilityVersion"]}
    require(type(reader) is Reader and plan["capabilityVersion"] in CANONICAL_CAPABILITIES
        and same_json(reader._source_snapshot_scope, expected), "canonical cache requires verified same Run source scope")
    program = exact_binding(plan["programBindings"].get("canonicalRegionProgram"))
    require(same_json(program,contract["canonicalProgram"]), "current canonical program identity differs")
    return {"protocol":contract["schemaVersion"],"root":str(reader.root),**expected,
        "executionPackage":exact_binding(package_binding),"canonicalProgram":program,"node":deepcopy(plan["runtimeIdentity"]["node"])}


def _canonical_node_stamp(expected, *, rehash=False):
    from ai_painter.complete_world.object_support_structure_failure_capture_v1 import _plain
    require(type(expected) is dict and set(expected)=={"absolutePath","sha256"}, "bound Node identity required")
    target=Path(expected["absolutePath"])
    require(target.is_absolute() and shutil.which("node") is not None
        and Path(shutil.which("node")).absolute()==target, "Node executable resolution changed")
    _plain(target);before=target.stat()
    require(target.resolve(strict=True)==target, "Node executable redirect")
    if rehash:
        hasher=hashlib.sha256()
        with target.open("rb") as stream:
            handle=os.fstat(stream.fileno())
            require(_file_identity(handle,include_ctime=False)==_file_identity(before,include_ctime=False), "Node handle identity differs")
            for chunk in iter(lambda:stream.read(1048576),b""):hasher.update(chunk)
            require(_file_identity(os.fstat(stream.fileno()))==_file_identity(handle), "Node changed while hashing")
        require(hasher.hexdigest()==expected["sha256"], "actual Node bytes differ")
    _plain(target);require(_file_identity(target.stat())==_file_identity(before), "Node identity changed")
    return _file_identity(before)


def _arm_canonical_cache(context, *, proof=None):
    # Called only at the successful end of live authentication, never by a public flag.
    require(proof is _CANONICAL_ACTIVATION_PROOF, "canonical activation requires completed live authentication")
    if context.plan["capabilityVersion"] not in CANONICAL_CAPABILITIES:return
    reader=context.reader;scope=_canonical_scope(reader,context.plan,context.package_binding)
    policy=read_json(reader,context.plan["executionPolicy"])
    require(same_json(policy.get("canonicalVerification"),canonical_verification_identity(context.plan["capabilityVersion"])), "canonical verification policy differs")
    _raw,program=reader.snapshot(CANONICAL_REGION_PROGRAM)
    require(same_json(program,scope["canonicalProgram"]), "current and frozen canonical program differ")
    stamp=_canonical_node_stamp(scope["node"],rehash=True)
    state=_CANONICAL_STATES.get(reader)
    if state is None:
        state={"scope":deepcopy(scope),"plan":context.plan,"packageBinding":deepcopy(context.package_binding),
            "nodeStamp":stamp,"entries":{},"bytes":0,"calls":0,"hits":0,"misses":0,"nodeCalls":0,
            "failures":0,"elapsedSeconds":0.0,"nodeElapsedSeconds":0.0,"firstError":None,"lastOperation":None,
            "activationAtUtc":datetime.now(timezone.utc).isoformat(),"active":False}
        _CANONICAL_STATES[reader]=state
    require(same_json(state["scope"],scope) and state["nodeStamp"]==stamp, "canonical cache scope/runtime changed")
    state["active"]=True


def _canonical_error(error):
    text=str(error).encode("utf-8")[:2048].decode("utf-8",errors="ignore")
    return {"type":type(error).__name__,"message":text,"messageSha256":hashlib.sha256(str(error).encode("utf-8")).hexdigest()}


def _verified_canonical_region(reader, record, region, module_binding, expected):
    state=_CANONICAL_STATES.get(reader) if type(reader) is Reader else None
    if state is None:return None  # All legacy and unauthenticated readers keep the original algorithm.
    require(state["active"], "canonical cache live authentication incomplete")
    started=time.monotonic();state["calls"]+=1
    operation={"ordinal":state["calls"],"sampleId":None,"recordBindings":{},"status":"started",
        "cacheHit":False,"nodeStarted":False,"nodeElapsedSeconds":None,
        "nodeStartupSeconds":None,"nodeInputSeconds":None,"nodeImportSeconds":None,"nodeHashSeconds":None,"nodeExitSeconds":None}
    primary=None
    try:
        scope=_canonical_scope(reader,state["plan"],state["packageBinding"])
        require(same_json(scope,state["scope"]), "canonical scope mutated")
        require(_canonical_node_stamp(scope["node"])==state["nodeStamp"], "Node identity changed since live authentication")
        operation["recordBindings"]={key:exact_binding({name:record[key][name] for name in ("path","sha256")})
            for key in _CANONICAL_RECORD_KEYS}
        require(all(same_json(reader._source_snapshot_bindings.get(item["path"]),item)
            for item in operation["recordBindings"].values()),"canonical record outside verified data closure")
        # The original six JSON reads have already run. Independently bind the actual
        # region bytes used by the cached computation; supplied objects cannot seed it.
        region_binding=operation["recordBindings"]["regionSourcePackage"]
        raw=reader.read(region_binding,SOURCE_JSON_MAX)
        require(same_json(decode_source_json(raw),region), "canonical region object differs from actual bytes")
        program_raw,actual_program=reader.snapshot(CANONICAL_REGION_PROGRAM)
        require(same_json(actual_program,module_binding) and same_json(actual_program,scope["canonicalProgram"])
            and hashlib.sha256(program_raw).hexdigest()==actual_program["sha256"], "canonical program changed before lookup")
        key_material=json.dumps({"scope":scope,"region":region_binding,"actualRegionSha256":hashlib.sha256(raw).hexdigest(),
            "expected":expected},ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False)
        # Only the cache lookup key is compacted; region canonical verification
        # still executes the original bound JS function on every miss.
        key=hashlib.sha256(key_material.encode("utf-8")).hexdigest()
        cached=state["entries"].get(key)
        if cached is not None:
            require(cached==expected,"cached canonical digest differs")
            operation["cacheHit"]=True;state["hits"]+=1
            operation["status"]="verified_cached_digest"
            return cached
        state["misses"]+=1
        require(_canonical_node_stamp(scope["node"],rehash=True)==state["nodeStamp"], "Node changed before invocation")
        from ai_painter.complete_world.object_appearance_regime_input_cpu import _canonical_node
        node_started=time.monotonic();operation["nodeStarted"]=True;state["nodeCalls"]+=1
        node_error=None
        try:
            result=_canonical_node(region,reader.root,CANONICAL_REGION_PROGRAM,executable=scope["node"]["absolutePath"])
        except BaseException as error:
            node_error=error
            raise
        finally:
            elapsed=time.monotonic()-node_started
            if math.isfinite(elapsed) and elapsed>=0:
                operation["nodeElapsedSeconds"]=elapsed;state["nodeElapsedSeconds"]+=elapsed
            elif node_error is None:raise ValueError("canonical Node monotonic clock regressed")
        require(result.stdout==expected,"region recomputed canonical identity differs")
        require(_canonical_node_stamp(scope["node"])==state["nodeStamp"], "Node changed during invocation")
        after_raw,after_binding=reader.snapshot(CANONICAL_REGION_PROGRAM)
        require(same_json(after_binding,actual_program) and after_raw==program_raw,"canonical program changed during invocation")
        require(reader.read(region_binding,SOURCE_JSON_MAX)==raw,"canonical region changed during invocation")
        size=len(key.encode("utf-8"))+len(result.stdout.encode("utf-8"))
        if size<=CANONICAL_VERIFICATION["maximumCacheBytes"]:
            while state["entries"] and (len(state["entries"])>=CANONICAL_VERIFICATION["maximumCacheEntries"]
                    or state["bytes"]+size>CANONICAL_VERIFICATION["maximumCacheBytes"]):
                old=next(iter(state["entries"]));value=state["entries"].pop(old)
                state["bytes"]-=len(old.encode("utf-8"))+len(value.encode("utf-8"))
            state["entries"][key]=result.stdout;state["bytes"]+=size
        operation["status"]="verified_new_digest"
        return result.stdout
    except BaseException as error:
        primary=error;state["failures"]+=1;operation["status"]="failed_closed"
        operation["error"]=_canonical_error(error)
        if state["firstError"] is None:state["firstError"]=deepcopy(operation)
        raise
    finally:
        elapsed=time.monotonic()-started
        if math.isfinite(elapsed) and elapsed>=0:
            operation["elapsedSeconds"]=elapsed;state["elapsedSeconds"]+=elapsed
            state["lastOperation"]=operation
        elif primary is None:
            raise ValueError("canonical observation monotonic clock regressed")


def canonical_observation(context):
    if context.plan["capabilityVersion"] not in CANONICAL_CAPABILITIES:return None
    require(type(context) is Context and type(context.reader) is Reader,"canonical observation requires exact Context/Reader")
    state=_CANONICAL_STATES.get(context.reader)
    require(state is not None and same_json(state["scope"],_canonical_scope(context.reader,context.plan,context.package_binding)),
        "canonical observation has no authenticated scope")
    return {"schemaVersion":"canonical-region-observation-v1","scope":deepcopy(state["scope"]),
        "activationAtUtc":state["activationAtUtc"],"active":state["active"],
        "counters":{key:state[key] for key in ("calls","hits","misses","nodeCalls","failures")},
        "elapsedSeconds":state["elapsedSeconds"],"nodeElapsedSeconds":state["nodeElapsedSeconds"],
        "cacheEntries":len(state["entries"]),"cacheBytes":state["bytes"],"cacheByteScope":"utf8_keys_plus_digest_values_not_process_rss",
        "firstError":deepcopy(state["firstError"]),"lastOperation":deepcopy(state["lastOperation"]),
        "operationElapsedScope":"after_original_six_json_reads_including_cache_verification_and_node_when_missed",
        "nodeSubphaseTiming":"unobserved_null_no_cross_process_clock_inference"}


def configuration(reader, *, capability_version=CAPABILITY):
    return derive_configuration(reader,capability_version=capability_version)


def candidate_binding(capability_version=CAPABILITY):
    return checkpoint.source_assets(capability_version)


def training_diagnostic(reader, capability_version=CAPABILITY):
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
    candidate = read_json(reader, candidate_binding(capability_version))
    receipt = candidate["frozenBindings"].get("sourceStandardReaderReceipt")
    if receipt is not None:
        proof = read_json(reader, exact_binding(receipt))
        require(proof.get("datasetManifest") == candidate["frozenBindings"]["datasetManifest"]
            and proof.get("trainingDiagnostic") == candidate["frozenBindings"]["trainingDiagnostic"], "source reader receipt differs")
    return exact_binding(candidate["frozenBindings"].get("trainingDiagnostic", DIAGNOSTIC))



QUALIFICATION_CAPTURE_SOURCES = (
    "ml/ai-painter/scripts/qualification_parameter0_capture_v1.py",
    "ml/ai-painter/scripts/qualification_gradient_gate_authentication_cpu_v1.py",
    "ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_observation_v1.py",
    "ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_reference_v1.py",
)
TRAINING_CAPTURE_SOURCES = (
    "ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_capture_v1.py",
    "ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_storage_v1.py",
    "ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_bridge_v1.py",
    "ml/ai-painter/scripts/painter_stage4_decode2_rgb_output_training_same_call_profile_v1.py",
)
QUALIFICATION_CAPTURE_CORE = {'schemaVersion': 'qualification-parameter0-sequence-capture-v1', 'capabilityVersion': 'stage4_mvp256_dry_decode2_rgb_output_qualification_capture_v1', 'phase': 'qualification', 'sampleId': 'ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2', 'sampleOrdinal': 17, 'split': 'train', 'target': {'index': 0, 'name': 'core.core.terrain.base_stem.layers.0.weight', 'shape': [48, 31, 3, 3], 'spatial': [192, 256]}, 'sequenceSamples': 48, 'sameGeneratorAndDiscriminatorInstances': True, 'originalOrderAndSeedKept': True, 'originalGateAndToleranceKept': True, 'originalFailureFirst': True, 'additionalForwardCalls': 0, 'additionalAutogradCalls': 0, 'additionalOptimizerUpdates': 0, 'maximumCaptureAndWorkspaceBytes': 67108864, 'maximumAggregateSidecarBytes': 2097152, 'terminalReserveBytes': 65536, 'rawTargetGradientSets': 5, 'finiteReferenceCoordinates': 1, 'nonfiniteSumReferenceCalls': 0, 'otherSampleCaptureAllowed': False, 'qualificationGranted': False, 'activation': 'authenticated_new_package_only', 'failureAction': 'preserve_primary_and_close_no_retry', 'completeSequenceAction': 'original_same_package_training_only_after_all48_and_state_checks'}


def verify_qualification_capture_policy(reader, policy):
    if policy.get("candidate") != checkpoint.QUALIFICATION_CAPTURE_CAPABILITY:
        require("qualificationFailureCapture" not in policy, "legacy capture activation refused")
        return None
    contract = policy.get("qualificationFailureCapture")
    require(type(contract) is dict and set(contract) == set(QUALIFICATION_CAPTURE_CORE) | {"componentSources", "cpuEvidence"}
            and same_json({key:contract[key] for key in QUALIFICATION_CAPTURE_CORE}, QUALIFICATION_CAPTURE_CORE),
            "exact qualification capture contract required")
    sources = contract["componentSources"]
    require(type(sources) is list and len(sources) == len(QUALIFICATION_CAPTURE_SOURCES), "capture source closure required")
    for logical, source in zip(QUALIFICATION_CAPTURE_SOURCES, sources):
        bound = exact_binding(source)
        require(bound["path"] == logical, "capture source role changed")
        reader.read(bound, PROGRAM_MAX)
    evidence = read_json(reader, exact_binding(contract["cpuEvidence"]))
    require(evidence.get("status") == "cpu_component_passed_not_admitted"
        and evidence.get("taskId") == "QUALIFICATION-SEQUENCE-CAPTURE-019-CPU"
        and evidence.get("qualificationGranted") is False
        and same_json(evidence.get("sourceBindings"), sources), "capture CPU evidence/source identity differs")
    tests = evidence.get("tests", {})
    require(tests.get("passed") is True and type(tests.get("testsRun")) is int and tests["testsRun"] > 0
        and tests.get("cudaInitialized") is False
        and all(type(tests.get(key)) is int and tests[key] == 0
                for key in ("modelCalls", "autogradCalls", "optimizerUpdates")), "capture synthetic CPU evidence incomplete")
    return contract


TRAINING_CAPTURE_CORE = json.loads("{\"schemaVersion\":\"parameter0-training-same-call-capture-v1\",\"capabilityVersion\":\"stage4_mvp256_dry_decode2_rgb_output_training_capture_v1\",\"phase\":\"training\",\"activation\":\"authenticated_new_package_exact_g_call_only\",\"sampleId\":\"ai-cold-start-v7-v7-capacity-slot-154-tropical-forest-glade-v2\",\"split\":\"train\",\"epoch\":1,\"zeroBasedEpochPosition\":14,\"trainIndex\":8,\"optimizerSteps\":{\"generator\":14,\"discriminator\":15},\"maximumObservedGCalls\":1,\"target\":{\"index\":0,\"name\":\"core.core.terrain.base_stem.layers.0.weight\",\"shape\":[48,31,3,3],\"spatial\":[192,256],\"coordinate\":[1,13,0,0],\"inputChannel\":13,\"outputChannel\":1,\"operator\":\"torch.nn.Conv2d\",\"stride\":[1,1],\"padding\":[1,1],\"dilation\":[1,1],\"groups\":1,\"paddingMode\":\"zeros\"},\"gradientLabels\":[\"actualTotal\",\"structuredObjective\",\"wholeFrameFidelity\",\"objectCoreRgb\",\"objectSupportStructure\"],\"sameGeneratorAndDiscriminatorInstances\":true,\"originalGateAndToleranceKept\":true,\"originalFailureFirst\":true,\"rawTargetGradientSets\":5,\"weightWitness\":true,\"additionalForwardCalls\":0,\"additionalAutogradCalls\":0,\"additionalOptimizerUpdates\":0,\"localReferenceCalls\":0,\"maximumCaptureAndWorkspaceBytes\":67108864,\"maximumAggregateSidecarBytes\":2097152,\"terminalReserveBytes\":65536,\"aggregateIncludesStagingAndManifests\":true,\"originalFailureMaximumBytes\":67108864,\"executionMaximumBytes\":134217728,\"nonTargetSampleCaptureAllowed\":false,\"otherParameterFailureDoesNotCreatePacket\":true,\"fixedCoordinateNotViolatingAction\":\"retain_authenticated_target0_fixed_projection_mark_not_violating_no_reference\",\"nonfiniteAction\":\"preserve_original_failure_and_classify_capture_availability_no_reference\",\"successAction\":\"release_all_hooks_and_graph_references_before_original_generator_commit\",\"failureAction\":\"preserve_primary_and_close_no_retry\",\"qualificationGranted\":false}")


TRAINING_CAPTURE_V2_CORE = {**TRAINING_CAPTURE_CORE, "capabilityVersion": checkpoint.TRAINING_CAPTURE_V2_CAPABILITY}
TRAINING_CAPTURE_V3_CORE = {**TRAINING_CAPTURE_CORE, "capabilityVersion": checkpoint.TRAINING_CAPTURE_V3_CAPABILITY}
TRAINING_CAPTURE_V4_CORE = {**TRAINING_CAPTURE_CORE, "capabilityVersion": checkpoint.TRAINING_CAPTURE_V4_CAPABILITY}

TRAINING_CAPTURE_V5_CORE = {**TRAINING_CAPTURE_CORE, "capabilityVersion": checkpoint.TRAINING_CAPTURE_V5_CAPABILITY}

TRAINING_CAPTURE_V6_CORE = json.loads("{\"schemaVersion\":\"parameter0-training-call-coverage-v1\",\"capabilityVersion\":\"stage4_mvp256_dry_decode2_rgb_output_training_capture_v6\",\"phase\":\"training\",\"activation\":\"authenticated_new_package_sequential_g_calls_only\",\"split\":\"train\",\"maximumObservedGCalls\":1152,\"target\":{\"index\":0,\"name\":\"core.core.terrain.base_stem.layers.0.weight\",\"shape\":[48,31,3,3],\"spatial\":[192,256],\"coordinate\":[1,13,0,0],\"inputChannel\":13,\"outputChannel\":1,\"operator\":\"torch.nn.Conv2d\",\"stride\":[1,1],\"padding\":[1,1],\"dilation\":[1,1],\"groups\":1,\"paddingMode\":\"zeros\"},\"gradientLabels\":[\"actualTotal\",\"structuredObjective\",\"wholeFrameFidelity\",\"objectCoreRgb\",\"objectSupportStructure\"],\"sameGeneratorAndDiscriminatorInstances\":true,\"originalGateAndToleranceKept\":true,\"originalFailureFirst\":true,\"rawTargetGradientSets\":5,\"weightWitness\":true,\"additionalForwardCalls\":0,\"additionalAutogradCalls\":0,\"additionalOptimizerUpdates\":0,\"localReferenceCalls\":0,\"maximumCaptureAndWorkspaceBytes\":67108864,\"maximumAggregateSidecarBytes\":2097152,\"terminalReserveBytes\":65536,\"aggregateIncludesStagingAndManifests\":true,\"originalFailureMaximumBytes\":67108864,\"executionMaximumBytes\":134217728,\"nonTargetSampleCaptureAllowed\":true,\"otherParameterFailureDoesNotCreatePacket\":true,\"fixedCoordinateNotViolatingAction\":\"retain_authenticated_target0_fixed_projection_mark_not_violating_no_reference\",\"nonfiniteAction\":\"preserve_original_failure_and_classify_capture_availability_no_reference\",\"successAction\":\"release_all_hooks_graph_references_and_current_copies_before_original_generator_commit\",\"failureAction\":\"preserve_primary_and_close_coverage_instance_no_retry\",\"qualificationGranted\":false,\"sampleScope\":\"all48_bound_train_samples_in_original_epoch_schedule\",\"epochCount\":24,\"firstGeneratorCount\":0,\"lastGeneratorCount\":1151,\"maximumLiveObservationContexts\":1,\"sequenceRule\":\"pre_D_G_equals_D_equals_observed_calls_then_pre_G_D_equals_G_plus_one\",\"previousSuccessReleasedBeforeNextD\":true,\"concurrentPairAllowed\":false,\"successfulTensorHistoryRetained\":false,\"storageIdentityRule\":\"recompute_epoch_position_train_index_from_seed_and_actual_G_D_counts\"}")

def training_capture_identity(capability):
    identities = {
        checkpoint.TRAINING_CAPTURE_CAPABILITY: (TRAINING_CAPTURE_CORE, ".runtime/ai-painter/controller-repair-reviews/parameter0-training-same-call-023-20261024/cpu-component-acceptance.json", "TRAINING-SAME-CALL-CAPTURE-023-CPU"),
        checkpoint.TRAINING_CAPTURE_V2_CAPABILITY: (TRAINING_CAPTURE_V2_CORE, ".runtime/ai-painter/controller-repair-reviews/registry-publication-repair-024-20261024/cpu-component-acceptance.json", "TRAINING-SAME-CALL-CAPTURE-024-CPU"),
        checkpoint.TRAINING_CAPTURE_V3_CAPABILITY: (TRAINING_CAPTURE_V3_CORE, ".runtime/ai-painter/controller-repair-reviews/canonical-initialization-repair-025-20261024/cpu-component-acceptance.json", "TRAINING-SAME-CALL-CAPTURE-025-CPU"),
        checkpoint.TRAINING_CAPTURE_V4_CAPABILITY: (TRAINING_CAPTURE_V4_CORE, ".runtime/ai-painter/controller-repair-reviews/canonical-fixture-isolation-repair-026-20261024/cpu-component-acceptance.json", "TRAINING-SAME-CALL-CAPTURE-026-CPU"),
        checkpoint.TRAINING_CAPTURE_V5_CAPABILITY: (TRAINING_CAPTURE_V5_CORE, ".runtime/ai-painter/controller-repair-reviews/backend-observation-compatibility-repair-027-20261024/cpu-component-acceptance.json", "TRAINING-SAME-CALL-CAPTURE-027-CPU"),
        checkpoint.TRAINING_CAPTURE_V6_CAPABILITY: (TRAINING_CAPTURE_V6_CORE, ".runtime/ai-painter/controller-repair-reviews/failure-call-adoption-031-20261025/cpu-component-acceptance.json", "TRAINING-SAME-CALL-CAPTURE-031-CPU")}
    require(capability in identities, "unknown training capture identity")
    return identities[capability]


def verify_training_capture_policy(reader, policy):
    if policy.get("candidate") not in checkpoint.TRAINING_CAPTURE_CAPABILITIES:
        require("trainingFailureCapture" not in policy, "legacy training capture activation refused")
        return None
    require("sameCallCapture" not in policy and "qualificationFailureCapture" not in policy,
        "training capture cannot activate historical observers")
    expected_core, evidence_path, evidence_task = training_capture_identity(policy.get("candidate"))
    contract = policy.get("trainingFailureCapture")
    require(type(contract) is dict and set(contract) == set(expected_core) | {"componentSources", "cpuEvidence"}
        and same_json({key:contract[key] for key in expected_core}, expected_core),
        "exact training capture contract required")
    sources = contract["componentSources"]
    require(type(sources) is list and len(sources) == len(TRAINING_CAPTURE_SOURCES), "training capture source closure required")
    for logical, source in zip(TRAINING_CAPTURE_SOURCES, sources):
        bound = exact_binding(source)
        require(bound["path"] == logical, "training capture source role changed")
        reader.read(bound, PROGRAM_MAX)
    evidence_binding = exact_binding(contract["cpuEvidence"])
    require(evidence_binding["path"] == evidence_path,
        "current training component evidence path required")
    evidence = read_json(reader, evidence_binding)
    require(evidence.get("status") == "cpu_component_passed_not_admitted"
        and evidence.get("taskId") == evidence_task
        and evidence.get("qualificationGranted") is False
        and same_json(evidence.get("sourceBindings"), sources), "training capture CPU evidence/source identity differs")
    tests = evidence.get("tests", {})
    require(tests.get("passed") is True and type(tests.get("testsRun")) is int and tests["testsRun"] > 0
        and tests.get("cudaInitialized") is False
        and all(type(tests.get(key)) is int and tests[key] == 0
            for key in ("realModelCalls", "realAutogradCalls", "realOptimizerUpdates"))
        and type(tests.get("syntheticOperations")) is str and 0 < len(tests["syntheticOperations"]) <= 4096,
        "training synthetic CPU evidence incomplete")
    return contract


def authority_inputs(policy):
    values=checkpoint.execution_values(policy.get("candidate",CAPABILITY))
    required = [values["specification"], values["policy"], candidate_binding(policy.get("candidate",CAPABILITY)), checkpoint.INTEGRATION,
        checkpoint.LOSS, checkpoint.GRADIENT, checkpoint.JOINT_LEARNING_RULE,
        values["progress_policy"], policy["priorProgressPublicationCpuEvidence"] if values["completion"] else policy["progressPublicationCpuEvidence"],
        policy["previousExecutionPolicy"], policy["modelBoundary"]["jointCpuRule"]]
    required.extend(policy["modelBoundary"]["frozenCpuSources"])
    for key in ("priorCpuEvidence", "jointRuleCpuEvidence"):
        required.extend(policy[key][name] for name in ("acceptance", "terminal", "policy", "originalNormativeBytes"))
    required.append(policy["priorCpuEvidence"]["request"])
    for key in ("policy", "normativeBytes"):
        required.append(policy["qualificationOnlyPredecessor"][key])
    required.append(policy["resourceFailureRecord"]["componentEvidence"])
    if policy.get("candidate") in (checkpoint.DECODE2_SUPPORT_WEIGHT1_CAPABILITY, checkpoint.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY, checkpoint.QUALIFICATION_CAPTURE_CAPABILITY, *checkpoint.TRAINING_CAPTURE_CAPABILITIES):
        required.append(policy["numericRepairCpuEvidence"])
    if policy.get("candidate") == checkpoint.QUALIFICATION_CAPTURE_CAPABILITY:
        required.extend(policy["qualificationFailureCapture"]["componentSources"])
        required.append(policy["qualificationFailureCapture"]["cpuEvidence"])
    if policy.get("candidate") in checkpoint.TRAINING_CAPTURE_CAPABILITIES:
        required.extend(policy["trainingFailureCapture"]["componentSources"])
        required.append(policy["trainingFailureCapture"]["cpuEvidence"])
    return [{key: row[key] for key in ("path", "sha256")} for row in required]

def derive_configuration(reader, *, capability_version=CAPABILITY):
    route=execution_route(capability_version)
    values=checkpoint.execution_values(capability_version)
    formal = reader.read(route.specification)
    require(hashlib.sha256(formal).hexdigest() == route.specification["sha256"]
        and (values["policy_value"]["formalSpecification"]["version"].encode() if values.get("interface_contract") else b"AI-PAINTER-SPEC-1.105" if values.get("same_call_capture") else b"AI-PAINTER-SPEC-1.99" if values.get("qualification_completion") else b"AI-PAINTER-SPEC-1.98" if values["completion"] else b"AI-PAINTER-SPEC-1.96") in formal, "current decode1 entry specification differs")
    policy = read_json(reader, route.execution_policy)
    path = reader.path(values["preview_path"])
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_size <= 65536, "preview v6 size/type")
    raw = path.read_bytes()
    preview = {"path": values["preview_path"], "sha256": hashlib.sha256(raw).hexdigest()}
    require(_file_identity(path.lstat()) == _file_identity(before) and reader.read(preview,65536) == raw
        and decode(raw).get("schemaVersion") == (values.get("preview_schema") or ("ai-painter-training-preview-observation-policy-v9" if values.get("same_call_capture") else "ai-painter-training-preview-observation-policy-v8" if values.get("qualification_completion") else "ai-painter-training-preview-observation-policy-v7" if values["completion"] else "ai-painter-training-preview-observation-policy-v6")),
        "preview v6 registration changed")
    preview_policy = decode(raw)
    scope = preview_policy.get("scope", {})
    require(scope.get("capabilityVersion") == route.capability and scope.get("modelCapabilityVersion") == route.model_capability
        and scope.get("outputRootPrefix") == route.root_prefix, "preview route candidate scope differs")
    for key, role in (("component", "previewComponent"), ("storage", "previewStorage"),
            ("tests", "previewTests"), ("storageTests", "previewStorageTests")):
        source = exact_binding(preview_policy.get("programBindings", {}).get(key))
        require(source["path"] == ROLES[role] and source["sha256"] != "0" * 64,
            "preview v6 actual source registration required: " + key)
        reader.read(source, PROGRAM_MAX)
    result = checkpoint.expected_configuration(preview,capability_version)
    validate_execution_policy(policy, result)
    verify_qualification_capture_policy(reader, policy)
    verify_training_capture_policy(reader, policy)
    verify_progress_publication_policy(reader, policy)
    for binding in authority_inputs(policy):
        reader.read(binding)
    accepted = read_json(reader, policy["priorCpuEvidence"]["acceptance"])
    terminal = read_json(reader, {key: policy["priorCpuEvidence"]["terminal"][key] for key in ("path", "sha256")})
    require(accepted.get("status") == "cpu_candidate_verified_inactive_scope_closed"
        and accepted.get("candidate") == MODEL_CAPABILITY
        and terminal.get("status") == "cpu_candidate_verified_inactive",
        "accepted target48 CPU evidence differs")
    if route.capability in (checkpoint.DECODE2_SUPPORT_WEIGHT1_CAPABILITY, checkpoint.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY, checkpoint.QUALIFICATION_CAPTURE_CAPABILITY, *checkpoint.TRAINING_CAPTURE_CAPABILITIES):
        rgb_output = route.capability in (checkpoint.RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY, checkpoint.QUALIFICATION_CAPTURE_CAPABILITY, *checkpoint.TRAINING_CAPTURE_CAPABILITIES)
        numeric = read_json(reader, policy["numericRepairCpuEvidence"])
        require(numeric.get("schemaVersion") == ("parameter90-numeric-repair-component-cpu-v1" if rgb_output else "parameter40-numeric-repair-component-cpu-v1")
            and numeric.get("status") == "component_passed_not_admitted" and numeric.get("exitCode") == 0
            and numeric.get("modelCapability") == route.model_capability
            and (type(numeric.get("summary", {}).get("testsRun")) is int and numeric["summary"]["testsRun"] > 0 if rgb_output
                 else numeric.get("summary", {}).get("testsRun") == 18)
            and numeric["summary"].get("passed") is True and numeric["summary"].get("cudaInitialized") is False
            and numeric["summary"].get("optimizerConstruction") == numeric["summary"].get("optimizerUpdates") == 0,
            "candidate own numeric CPU component evidence required")
        for source in numeric["programBindings"]:
            reader.read(exact_binding(source), PROGRAM_MAX)
    joint = read_json(reader, policy["jointRuleCpuEvidence"]["acceptance"])
    require(joint.get("status") == "cpu_affinity_startup_repair_closed_real_cpu_verified_inactive"
        and joint.get("realExecution",{}).get("status") == "real_cpu_verified_inactive",
        "frozen joint arithmetic CPU evidence differs")
    reader.unchanged()
    return result

def _verified_progress_json(reader, binding):
    raw = reader.read(exact_binding(binding), CONTROL_JSON_MAX)
    require(hashlib.sha256(raw).hexdigest() == binding["sha256"], "progress publication SHA differs")
    value = decode(raw)
    require(type(value) is dict, "progress publication JSON object required")
    return value


def verify_progress_publication_policy(reader, policy):
    values=checkpoint.execution_values(policy.get("candidate",CAPABILITY))
    if values["completion"]:
        bound=values["progress_policy"]
        component=_verified_progress_json(reader,bound)
        expected={"componentPolicy":bound,"componentPath":"ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py",
            "freshnessSeconds":120,"maximumPendingFiles":1,"originalDeadlineRequired":False,
            "trainingDeadlineMode":"explicit_null_only_for_authenticated_completion_training","operationMaximumSeconds":.25,"finiteLegacyDeadlineUnchanged":True,
            "operationMaximumScope":"Existing atomic replacement, not the whole publish including output accounting/identity/fsync"}
        require(same_json(policy.get("progressPublication"),expected),"exact completion publication contract required")
        require(component.get("schemaVersion")==("ai-painter-registered-progress-publication-policy-v1" if values.get("interface_contract") else "ai-painter-progress-publication-cpu-policy-v4" if values.get("same_call_capture") else "ai-painter-progress-publication-cpu-policy-v3" if values.get("qualification_completion") else "ai-painter-progress-publication-cpu-policy-v2")
            and component.get("status")=="registered_inactive_cpu_candidate"
            and component.get("implementation",{}).get("component")==expected["componentPath"],"registered completion publication policy differs")
        source={"path":expected["componentPath"],"sha256":hashlib.sha256(reader.path(expected["componentPath"]).read_bytes()).hexdigest()}
        reader.read(source,PROGRAM_MAX)
        # This is source registration, never inherited component qualification.
        # Own CPU tests and exact per-Run program bindings must verify adoption.
        _verified_progress_json(reader,policy["priorProgressPublicationCpuEvidence"])
        return source
    require(same_json(policy.get("progressPublication"), PROGRESS_PUBLICATION),
        "registered progress publication contract differs")
    component = _verified_progress_json(reader, PROGRESS_PUBLICATION_POLICY)
    require(component.get("schemaVersion") == "ai-painter-progress-publication-cpu-policy-v1"
        and component.get("status") == "registered_inactive_cpu_candidate"
        and component.get("candidateId") == "bounded_progress_publication_cpu_v1"
        and component.get("implementation", {}).get("component") == PROGRESS_PUBLICATION_PATH,
        "registered progress component policy status/path differs")
    evidence = _verified_progress_json(reader, policy["progressPublicationCpuEvidence"])
    require(evidence.get("schemaVersion") == "ai-painter-bounded-progress-publication-cpu-acceptance-v1"
        and evidence.get("status") == "cpu_component_scope_closed_not_production_adopted"
        and evidence.get("implementation", {}).get("policy") == PROGRESS_PUBLICATION_POLICY,
        "accepted progress component CPU evidence required")
    source = exact_binding(evidence["implementation"]["component"])
    require(source["path"] == PROGRESS_PUBLICATION_PATH, "accepted progress component path differs")
    raw = reader.read(source, PROGRAM_MAX)
    require(hashlib.sha256(raw).hexdigest() == source["sha256"], "accepted progress component bytes differ")
    return source


def verify_progress_publication(reader, plan):
    """Actual v3 policy, CPU evidence and source bytes establish adoption scope."""
    route=execution_route(plan.get("capabilityVersion"));values=checkpoint.execution_values(route.capability)
    if values.get("interface_contract"):
        require(same_json(plan.get("interfacePolicy"),values["policy"])
            and same_json(plan.get("entrypointSnapshot"),values["entrypoint_snapshot"]), "frozen interface registration differs")
    require(same_json(plan.get("executionPolicy"), route.execution_policy)
        and same_json(plan.get("configuration", {}).get("progressPublicationPolicy"), values["progress_policy"]),
        "exact joint v3 progress publication bindings required")
    policy = _verified_progress_json(reader, route.execution_policy)
    checkpoint_components(route.capability).validate_execution_policy(policy, plan["configuration"])
    source = verify_progress_publication_policy(reader, policy)
    require(same_json(plan.get("programBindings", {}).get("progressPublication"), source),
        "actual progress component program role differs")
    return source


def progress_publication_arguments(reader, plan):
    """Authenticate before selecting the pure publisher's protocol mechanics."""
    source = verify_progress_publication(reader, plan)
    values = checkpoint.execution_values(plan["capabilityVersion"])
    if values.get("interface_contract"):
        policy = _verified_progress_json(reader, values["progress_policy"])
        require(policy.get("publication",{}).get("publicationProtocol") == "authenticated_completion_publication_v1"
            and "completionCapability" not in policy.get("publication",{}), "registered publication protocol required")
        return source, {"publication_protocol":"authenticated_completion_publication_v1"}
    return source, ({"completion_capability":plan["capabilityVersion"]} if values["completion"] else {})


def verify_programs(reader,programs,*,capability_version=CAPABILITY):
    require(reader._fit_history is None, "FIT006 history cannot authenticate an execution")
    validate_program_count(programs, capability_version)
    # Keep shared engine roles, omit only historical-only role requirements.
    required=required_program_roles(capability_version)
    require(set(required)<=set(programs),"final RGB required source role omitted")
    total,seen=0,{}
    for role,b in programs.items():
        require(type(role) is str and re.fullmatch(r"[A-Za-z0-9._-]{1,80}",role)
            and role not in ("__proto__","constructor","prototype"),"unsafe source role")
        b=exact_binding(b)
        require(b["path"] not in seen,"one exact current binding per path required")
        value=reader.read(b,PROGRAM_MAX);total+=len(value)
        require(total<=16*1024**2,"actual source closure byte ceiling")
        seen[b["path"]]=b["sha256"]
    for role,logical in required.items():
        require(programs[role]["path"]==logical,"final RGB source role retargeted: "+role)
    require(programs["executionPolicy"]==execution_route(capability_version).execution_policy,"new execution policy binding differs")
    history=reader._review_history
    actual=programs["executionAuth"]
    if history is not None:
        require(independent_plan_path(history.plan_path)
            and programs["executionAuth"]==dict(history.original_auth),"historical authentication outside recovery execution")
        actual=dict(history.actual_auth)
        Reader(reader.root).read(actual)
    require(hashlib.sha256(Path(__file__).read_bytes()).hexdigest()==actual["sha256"],"actual loaded auth source differs")
    return seen



def required_program_roles(capability_version=CAPABILITY):
    values=checkpoint.execution_values(capability_version)
    roles={**ROLES, **LOCAL_DEPLOYMENT_DEPENDENCY_ROLES}
    if values["completion"]:
        roles.update(executionPolicy=values["policy"]["path"],
            progressPublication="ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py",
            nativeOwnerBuilder="scripts/lib/ai-painter-decode1-entry-completion-native-owner-v1.mjs",
            nativeOwnerSource="scripts/windows/ai-painter-owned-worker-owner-stream-completion-v1.cs")
    if values.get("same_call_capture") and capability_version not in (checkpoint.QUALIFICATION_CAPTURE_CAPABILITY, *checkpoint.TRAINING_CAPTURE_CAPABILITIES):
        roles.update(sameCallCapture="ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_capture_v1.py",
            sameCallStorage="ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_storage_v1.py",
            sameCallBridge="ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_bridge_v1.py",
            sameCallProfile="ml/ai-painter/scripts/painter_stage4_decode1_entry_same_call_training_profile_v1.py")
    if capability_version == checkpoint.QUALIFICATION_CAPTURE_CAPABILITY:
        roles.update(zip(("qualificationCapture", "qualificationGateAuth", "qualificationObserver", "qualificationReference"),
                         QUALIFICATION_CAPTURE_SOURCES))
    if capability_version in checkpoint.TRAINING_CAPTURE_CAPABILITIES:
        roles.update(zip(("sameCallCapture", "sameCallStorage", "sameCallBridge", "sameCallProfile"),
                         TRAINING_CAPTURE_SOURCES))
    if capability_version in CANONICAL_CAPABILITIES:
        roles["canonicalRegionProgram"] = CANONICAL_REGION_PROGRAM
    return roles

def validate_execution_policy(policy, configuration):
    result = checkpoint.validate_execution_policy(policy, configuration)
    if policy.get("candidate") in CANONICAL_CAPABILITIES:
        require(same_json(policy.get("canonicalVerification"), canonical_verification_identity(policy["candidate"])), "canonical verification policy differs")
    else:
        require("canonicalVerification" not in policy, "legacy canonical verification activation refused")
    return result

def derive_model_metadata(reader, dataset_binding, *, capability_version=CAPABILITY):
    route=execution_route(capability_version)
    profile=profile_components(route.capability)
    _,_,_,ARCHITECTURE,NUMERIC_RULE=checkpoint.components(route.capability)
    manifest = read_json(reader, dataset_binding)
    model, critic = profile.fresh_networks(manifest["identityPayload"]["channelOrder"], **model_arguments(route.capability))
    graph = [{"name": name, "shape": list(value.shape), "elements": value.numel(), "dtype": str(value.dtype)}
             for name, value in model.named_parameters()]
    require(len(graph) == 108 and sum(row["elements"] for row in graph) == 2242687, "new actual108 graph differs")
    require(graph[60] == {"name": "core.core.terrain.full_resolution_detail.layers.3.weight",
        "shape": [48, 48, 3, 3], "elements": 20736, "dtype": "torch.float32"}, "actual target60 graph differs")
    require(graph[48] == {"name": "core.core.terrain.decode_1.layers.0.weight", "shape": [48,144,3,3],
        "elements": 62208, "dtype": "torch.float32"}, "actual target48 graph differs")
    require(graph[88] == {"name":"core.core.final_rgb_decoder.base.layers.2.weight","shape":[48,48,3,3],"elements":20736,"dtype":"torch.float32"}, "actual target88 graph differs")
    require(model.capability_version == route.model_capability, "recomputed numeric model identity differs")
    return {"capabilityVersion": route.capability, "modelCapabilityVersion": route.model_capability,
        "architecture": ARCHITECTURE, "numericRule": NUMERIC_RULE, "graph": graph,
        "initialState": {"generator": profile.inherited.core.cpu.state_hash(model), "discriminator": profile.inherited.core.cpu.state_hash(critic)}}


def verify_model(reader, plan, *, recompute=True):
    model = read_json(reader, plan["modelBinding"])
    require(plan["modelBinding"]["path"] == plan["outputRoot"] + "/model-identity.json", "cross Run new model metadata")
    # A caller's recompute=False is not evidence; actual fresh identity is always checked.
    require(same_json(model, derive_model_metadata(reader, plan["datasetManifest"],capability_version=plan.get("capabilityVersion",CAPABILITY))), "actual new fresh model/initial states differ")
    return model


class _ClosureMetadataReader(Reader):
    """Only fixed task-bound metadata while recomputing the actual closure."""
    def __init__(self, root, diagnostic_binding, *, review_history=None, fit_history=None):
        super().__init__(root,review_history=review_history,fit_history=fit_history)
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


def derive_data_closure(root, capability_version=CAPABILITY, *, review_history=None, fit_history=None):
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC, CONDITION
    import painter_stage4_decode1_entry_weight_training_profile_v1 as profile
    require(review_history is None or capability_version==_REVIEW_CAPABILITY,"historical closure outside source-correction route")
    require(fit_history is None or capability_version==_REVIEW_CAPABILITY,"FIT006 closure outside source-correction route")
    selector = Reader(root,review_history=review_history,fit_history=fit_history)
    diagnostic_binding = training_diagnostic(selector, capability_version)
    reader = _ClosureMetadataReader(root, diagnostic_binding,review_history=review_history,fit_history=fit_history)
    for logical, digest in selector.observed.items():
        reader.read({"path": logical, "sha256": digest})
    if diagnostic_binding != DIAGNOSTIC:
        reproduce_diagnostic(reader, diagnostic_binding)
    metadata = profile.prepare_metadata(reader, diagnostic_binding, CONDITION, collect_train_assets=True)
    # Bind only the eight original validation fact manifests. These are source
    # metadata, not target RGB; snapshot permission still comes from recomputing
    # and verifying the complete immutable closure in verify_data_closure.
    visual_paths = set()
    for ordinal, sid in enumerate(metadata["splitSampleIds"]["validation"]):
        identity = metadata["records"][("validation", ordinal)]["identity"]
        binding = exact_binding(identity["visualFactManifestFile"])
        pack = reader.json(identity["conditionPack"])
        task = reader.json(identity["taskPackage"])
        require(identity["split"] == "validation" and identity["sampleId"] == sid and
                binding["path"] not in visual_paths and
                binding["path"] == pack["sourceBindings"]["visualFactManifestPath"] ==
                task["sourceBindings"]["visualFactManifestPath"], "validation visual source differs")
        visual = decode_source_json(reader.read(binding, SOURCE_JSON_MAX))
        require(visual["worldId"] == identity["worldId"] == pack["worldId"] == task["worldId"] and
                visual["tick"] == identity["tick"] == pack["tick"] == task["tick"] and
                visual["manifestId"] == pack["visualFactManifestId"] and
                visual["manifestSha256"] == identity["visualFactManifestContentSha256"] ==
                pack["visualFactManifestSha256"] == task["sourceBindings"]["visualFactManifestSha256"],
                "validation visual identity differs")
        visual_paths.add(binding["path"])
    require(len(visual_paths) == 8, "fixed validation visual count differs")
    reader.unchanged()
    return {"schema": "object-support-structure-quality-data-closure-v1",
        "splitSampleIds": metadata["splitSampleIds"], "metadataCounts": metadata["metadataCounts"],
        "validationRgbRead": False, "challengeContentRead": False, "regressionContentRead": False,
        "bindings": [{"path": p, "sha256": sha} for p, sha in sorted(reader.observed.items())]}


def verify_data_closure(reader, plan, *, recompute=True):
    route=execution_route(plan.get("capabilityVersion",CAPABILITY))
    require(plan.get("outputRoot") == route.root_prefix + plan["runId"] and
            plan["dataClosure"]["path"] == plan["outputRoot"] + "/data-closure.json", "cross Run data closure path")
    scope = {"runId": plan["runId"], "packageId": plan["packageId"], "dataClosure": exact_binding(plan["dataClosure"])}
    scope["capabilityVersion"]=route.capability
    if type(reader) is Reader and reader._source_snapshot_scope is not None:
        require(same_json(reader._source_snapshot_scope, scope), "cross Run source snapshot scope")
    closure = read_json(reader, plan["dataClosure"])
    require(closure.get("schema") == "object-support-structure-quality-data-closure-v1" and
            same_json(closure.get("metadataCounts"), {"train": 48, "validation": 8}) and
            all(closure.get(k) is False for k in ("validationRgbRead", "challengeContentRead", "regressionContentRead")), "data closure policy differs")
    bindings = closure.get("bindings")
    require(type(bindings) is list and 1 <= len(bindings) <= 8192 and len({b["path"] for b in bindings}) == len(bindings), "data closure members differ")
    if recompute:
        require(same_json(closure, derive_data_closure(reader.root, route.capability,review_history=reader._review_history,
            fit_history=reader._fit_history)), "actual source/data closure differs")
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
    route=execution_route(plan.get("capabilityVersion"))
    require(plan.get("schema") == PLAN_SCHEMA and plan.get("executionProfile") == route.profile and
            plan.get("executionMode") == "bounded-quality-training" and plan.get("capabilityVersion") == route.capability,
            "own diagnostic plan required; old plan forbidden")
    for key in ("runId", "packageId"):
        require(type(plan.get(key)) is str and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", plan[key]), "Run/package ID invalid")
    values=checkpoint.execution_values(route.capability)
    if values.get("interface_contract"):
        require(same_json(plan.get("interfacePolicy"),values["policy"])
            and same_json(plan.get("entrypointSnapshot"),values["entrypoint_snapshot"]), "frozen interface registration differs")
    require(plan["runId"].startswith(values["run_prefix"]) and plan["packageId"].startswith(values["package_prefix"]),
        "new decode1 entry Run/package prefixes required")
    require(plan["runId"] != plan["packageId"] and plan.get("outputRoot") == route.root_prefix + plan["runId"] and
            plan.get("historicalCheckpointMayInitialize") is False and plan.get("trainingRestartAllowed") is False and
            "resourcePolicy" not in plan and "effectiveExecutionCeiling" not in plan and
            "resourceSuccessor" not in plan, "diagnostic identity/retry/resource differs")
    require(same_json(plan.get("configuration"), configuration(reader,capability_version=route.capability)) and
            same_json(plan.get("formalSpecification"), route.specification) and same_json(plan.get("sourceCandidate"), candidate_binding(route.capability)), "own configuration differs")
    require(plan.get("executionPolicy")==route.execution_policy and
            plan.get("trainingPreviewPolicy")==plan["configuration"].get("trainingPreviewPolicy"),
            "new plan/config execution and preview policy bindings differ")
    candidate = read_json(reader, candidate_binding(route.capability))
    for split, count in (("train", 48), ("validation", 8)):
        key = split + "Split"
        require(same_json(plan.get(key), candidate["frozenBindings"][key]), "original split binding differs")
        ids = read_json(reader, plan[key])["sampleIds"]
        require(type(ids) is list and len(ids) == len(set(ids)) == count, "original split count/order differs")
    require(same_json(plan.get("datasetManifest"), candidate["frozenBindings"]["datasetManifest"]), "original64 data binding differs")
    manifest = read_json(reader, plan["datasetManifest"])
    require(len(manifest["identityPayload"]["channelOrder"]) == 23, "23 original spatial channels required")
    verify_programs(reader, plan["programBindings"],capability_version=route.capability)
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
    require(reader._fit_history is None, "FIT006 history cannot load an execution package")
    require(reader._review_history is None or independent_plan_path(reader._review_history.plan_path),
        "CPU metadata history cannot authenticate an execution package")
    package = read_json(reader, binding)
    route=execution_route(package.get("capabilityVersion"))
    require(package.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1" and
            package.get("capabilityVersion") == route.capability and package.get("ownerAuthorizationRequired") is False and
            package.get("ownerInStateMachine") is False and type(package.get("maxInfrastructureRecoveryAttempts")) is int and
            package["maxInfrastructureRecoveryAttempts"] == 0, "own standard diagnostic package required")
    route=execution_route(package.get("capabilityVersion"))
    inputs = package.get("inputEvidence")
    require(type(inputs) is list and 1 <= len(inputs) <= 512 and len({b["path"] for b in inputs}) == len(inputs), "package input closure differs")
    plans = [b for b in inputs if b["path"].endswith("/quality-plan.json")]
    require(len(plans) == 1, "one own diagnostic plan required")
    plan = validate_plan(reader, read_json(reader, plans[0]), recompute_model=recompute_model)
    require(binding["path"] == ".runtime/ai-painter/autonomous-closed-loop-packages/" + plan["packageId"] + "/package.json" and
            package.get("packageIdentity") == plan["packageId"] and package.get("outputRoot") == plan["outputRoot"] and
            plans[0]["path"] == plan["outputRoot"] + "/quality-plan.json", "cross Run/package prohibited")
    codec=checkpoint_components(route.capability)
    policy = read_json(reader, route.execution_policy)
    required = authority_inputs(policy) + [plan["configuration"]["trainingPreviewPolicy"],
        plan["modelBinding"], plan["datasetManifest"], plan["trainSplit"], plan["validationSplit"],
        plan["finalCpuAcceptance"], plan["dataClosure"]]
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


def verify_live_context(context, *, expected_phase="training"):
    reader, plan = context.reader, context.plan
    retained=_CANONICAL_STATES.get(reader) if type(reader) is Reader else None
    if retained is not None:retained["active"]=False
    other = load_execution_package(reader, context.package_binding, recompute_model=False)
    require(same_json(other.plan, plan) and same_json(other.package, context.package), "live package/context changed")
    raw, registry_binding = reader.snapshot(REGISTRY)
    registry = decode(raw)
    active = registry.get("activeExecution")
    require(type(registry.get("registryRevision")) is int and registry["registryRevision"] > 0 and type(active) is dict and
            registry.get("executionState") == active.get("executionState") == "executing" and
            same_json(active.get("programLineage"), plan["programBindings"]), "live active source identity differs")
    identity = {"capabilityVersion": execution_route(plan["capabilityVersion"]).capability, "runId": plan["runId"], "packageId": plan["packageId"]}
    require(all(registry.get(k) == active.get(k) == v for k, v in identity.items()), "cross active execution")
    pid, creation = active.get("processId"), active.get("processStartIdentity")
    require(type(pid) is int and pid > 0 and type(creation) is str and creation and process_identity(pid) == creation, "supervisor PID creation differs")
    identity.update(processId=pid, processStartIdentity=creation)
    lock = read_json(reader, active["lock"])
    lock_path = active["lock"]["path"]
    require(lock_path in (plan["outputRoot"] + "/execution-lock.json", plan["outputRoot"] + "/qualification-lock.json"), "exact own phase lock required")
    phase = "qualification" if lock_path.endswith("/qualification-lock.json") else "training"
    require(expected_phase is None or phase == expected_phase, "wrong execution phase for action")
    heartbeat_path = plan["outputRoot"] + ("/qualification-heartbeat.json" if phase == "qualification" else "/heartbeat.json")
    require(
            lock.get("schemaVersion") == "ai-painter-current-active-execution-lock-v1" and
            all(lock.get(k) == v for k, v in identity.items()), "same Run immutable lock differs")
    require(same_json(active.get("heartbeat"), {"path": heartbeat_path, "ttlSeconds": 120}), "heartbeat phase path/TTL differs")
    reader._heartbeat_expected_identity = dict(identity)
    reader._heartbeat_expected_path = heartbeat_path
    try:
        heartbeat_raw, _ = reader.snapshot(active["heartbeat"]["path"])
    finally:
        reader._heartbeat_expected_identity = None
        reader._heartbeat_expected_path = None
    heartbeat = decode(heartbeat_raw)
    require(heartbeat.get("schemaVersion") == "ai-painter-current-active-execution-heartbeat-v1" and
            heartbeat.get("executionState") == "executing" and heartbeat.get("ttlSeconds") == 120 and
            all(heartbeat.get(k) == v for k, v in identity.items()), "live heartbeat identity differs")
    stamp = datetime.fromisoformat(heartbeat["heartbeatAtUtc"].replace("Z", "+00:00"))
    require(stamp.tzinfo is not None and -300 <= (datetime.now(timezone.utc) - stamp).total_seconds() < 120,
            "live heartbeat stale/future")
    require(reader.mapping.binding(registry_binding) == raw and process_identity(pid) == creation, "registry/process changed")
    _arm_canonical_cache(context,proof=_CANONICAL_ACTIVATION_PROOF)
    return {"status": "live_identity_authenticated_not_qualified", "executionPhase": phase, **identity}


CORRECTED_SOURCE_SCHEMA = "corrected-training-source-diagnostic-v1"
CORRECTED_SOURCE_COUNTS = {"train": 48, "validation": 8, "challenge": 4, "regression": 4}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_published_source_input(reader, binding, dataset_binding):
    """Read one publication-time document as history, never as current policy.

    The dataset and historical document are exact immutable identities. All
    executable verifier sources and every other input retain the normal reader.
    The frozen path is recorded in the new data closure rather than substituting
    old document bytes for the current policy at its live logical path.
    """
    dataset = {"path": "data/world-samples/ai-assisted-cold-start-dataset-packages/"
        "stage4-src64-4c32aee371b5fcaaa36b316199c7e7560892af7c0a5b908cfd6a6d44b4f0e6f7/manifest.json",
        "sha256": "499daf40061da91ce1e367ee5c4e3493491b5e5c1701806d8c4246502e73cd23"}
    original = {"path": "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
        "sha256": "48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909"}
    identity = ({key: binding.get(key) for key in ("path", "sha256")}
                if type(binding) is dict else None)
    if (dataset_binding == dataset and identity == original
            and reader._review_history is None and reader._fit_history is None):
        return reader.read({"path": "data/ai-painter/system-governance/document-baselines/"
            "review-storage-1.25-48d9b177.txt", "sha256": original["sha256"]})
    return reader.read(binding)


def build_diagnostic(reader, parent_binding, dataset_binding, acceptance_binding):
    parent = reader.json(parent_binding)
    manifest = reader.json(dataset_binding)
    require(manifest.get("schemaVersion") == "ai-painter-stage4-source-correction-release-v1"
        and manifest.get("sampleCount") == 64 and manifest.get("splitCounts") == CORRECTED_SOURCE_COUNTS,
        "corrected source release required")
    payload = manifest["identityPayload"]
    require(manifest["packageId"] == manifest["datasetReleaseIdentity"] == "stage4-src64-" + digest(canonical(payload)),
        "corrected release identity differs")
    acceptance = reader.json(acceptance_binding)
    require(acceptance.get("publishedManifest") == dataset_binding
        and acceptance.get("sourceReview") == payload["sourceReview"], "actual publication receipt differs")
    for binding in payload["verifierPrograms"]:
        reader.read(binding)
    for binding in payload["verification"]["inputBindings"]:
        read_published_source_input(reader, binding, dataset_binding)
    artifacts = {"source-index.json": manifest["sourceIndex"], **{
        f"splits/{split}.json": binding for split, binding in manifest["splits"].items()}}
    for name, binding in artifacts.items():
        require(binding["sha256"] == payload["artifactHashes"][name], "corrected artifact identity differs")
        reader.read(binding)
    previous_manifest = reader.json(payload["parentDatasetRelease"])
    require(parent["datasetManifest"] == payload["parentDatasetRelease"], "diagnostic parent dataset differs")
    old = reader.json(previous_manifest["sourceIndex"])["samples"]
    rows = reader.json(manifest["sourceIndex"])["samples"]
    changed = [(a, b) for a, b in zip(old, rows) if a != b]
    require(len(old) == len(rows) == 64 and len(changed) == 1, "exactly one train source correction required")
    original, replacement = changed[0]
    require(original["split"] == replacement["split"] == "train"
        and replacement["parentSampleId"] == original["sampleId"]
        and replacement["sourceRecord"] == payload["verification"]["replacementRecord"], "correction provenance differs")
    expected = {**deepcopy(original), "sampleId": replacement["sampleId"], "image": replacement["image"],
        "sourceRecord": replacement["sourceRecord"], "sourceCorrection": replacement["sourceCorrection"],
        "parentSampleId": original["sampleId"], "parentContributionForLineageOnly": original["contribution"],
        "useQualification": "retained_mvp_source_components_verified", "sourceReview": payload["sourceReview"]}
    for key in ("contribution", "sourceSampleIndex", "sourceContributionIndex"):
        expected.pop(key, None)
    require(replacement == expected, "correction changed condition, facts or an unrelated field")
    record = reader.json(replacement["sourceRecord"])
    review = reader.json(payload["sourceReview"])
    require(record["recordId"] == replacement["sampleId"] == review["recordId"]
        and record["originalImage"]["sha256"] == replacement["image"]["sha256"] == review["inputImageSha256"]
        and review["status"] == "review_passed", "new image/review binding differs")
    memberships = {}
    for split, count in CORRECTED_SOURCE_COUNTS.items():
        before = reader.json(previous_manifest["splits"][split])["sampleIds"]
        after = reader.json(manifest["splits"][split])["sampleIds"]
        expected_ids = [replacement["sampleId"] if sid == original["sampleId"] else sid for sid in before]
        require(after == expected_ids and len(after) == len(set(after)) == count, "split order or usage changed")
        memberships[split] = after
    require(manifest["identityPayload"]["channelOrder"] == previous_manifest["identityPayload"]["channelOrder"]
        and manifest["identityPayload"]["continuousChannelIds"] == previous_manifest["identityPayload"]["continuousChannelIds"],
        "condition sampling contract changed")
    diagnostic_rows = deepcopy(parent["rows"])
    targets = [row for row in diagnostic_rows if row["sampleId"] == original["sampleId"]]
    require(len(targets) == 1 and targets[0]["split"] == "train", "original train diagnostic missing")
    target = targets[0]
    require(target["identity"]["image"] == original["image"]
        and target["identity"]["conditionPack"] == replacement["conditionPack"], "original diagnostic geometry differs")
    target["sampleId"] = target["identity"]["sampleId"] = replacement["sampleId"]
    target["identity"]["image"] = deepcopy(replacement["image"])
    return {"schemaVersion": CORRECTED_SOURCE_SCHEMA, "purpose": "immutable_training_source_metadata_not_diagnostic_results",
        "derivation": {"parentDiagnostic": parent_binding, "datasetManifest": dataset_binding,
            "publicationAcceptance": acceptance_binding}, "datasetManifest": dataset_binding,
        "trainSplit": manifest["splits"]["train"], "validationSplit": manifest["splits"]["validation"],
        "rows": diagnostic_rows, "inputBindings": deepcopy(parent["inputBindings"]),
        "executionAuthorityGranted": False}


def reproduce_diagnostic(reader, binding):
    diagnostic = reader.json(binding)
    require(diagnostic.get("schemaVersion") == CORRECTED_SOURCE_SCHEMA, "corrected training diagnostic schema differs")
    d = diagnostic["derivation"]
    expected = build_diagnostic(reader, d["parentDiagnostic"], d["datasetManifest"], d["publicationAcceptance"])
    require(diagnostic == expected, "corrected training diagnostic does not reproduce")
    return diagnostic


def select_rows(reader, plan, condition_binding):
    manifest = reader.json(plan["datasetManifest"])
    require(manifest.get("schemaVersion") == "ai-painter-stage4-source-correction-release-v1"
        and manifest["sampleCount"] == 64 and manifest["splitCounts"] == CORRECTED_SOURCE_COUNTS, "corrected dataset metadata differs")
    contract = reader.json(condition_binding)["tensorContract"]
    order, continuous = contract["channelOrder"], contract["typePartitions"]["continuous"]
    require(manifest["identityPayload"]["channelOrder"] == order
        and manifest["identityPayload"]["continuousChannelIds"] == continuous, "corrected dataset channels differ")
    source = reader.json(manifest["sourceIndex"])["samples"]
    by_id = {row["sampleId"]: row for row in source}
    require(len(source) == len(by_id) == 64, "corrected dataset sample capacity differs")
    seen = set()
    for split, count in CORRECTED_SOURCE_COUNTS.items():
        ids = reader.json(manifest["splits"][split])["sampleIds"]
        require(len(ids) == len(set(ids)) == count and not seen.intersection(ids)
            and all(by_id[sid]["split"] == split for sid in ids), "corrected split partition differs")
        seen.update(ids)
        if split in ("train", "validation"):
            require(plan[split + "Split"] == manifest["splits"][split], "plan/manifest split differs")
    return manifest, order, continuous


def load_corrected_sample(reader, row, order, continuous, identity, cpu):
    import numpy as np
    from PIL import Image
    import torch
    from ai_painter.complete_world.native_rgb_structured_object_cpu_v17 import validate_bound_object_views
    require(row["split"] == identity["split"] == "train" and row["sampleId"] == identity["sampleId"]
        and row["image"] == identity["image"] and row["conditionPack"] == identity["conditionPack"]
        and "contribution" not in row, "corrected source identity differs")
    record = reader.json(row["sourceRecord"])
    intake = reader.json(record["sourceCorrection"]["intakeEvidence"])
    review = reader.json(row["sourceReview"])
    require(record["recordId"] == row["sampleId"] == review["recordId"]
        and record["sourceCorrection"]["parentSampleId"] == row["parentSampleId"]
        and intake["image"]["sha256"] == record["originalImage"]["sha256"] == row["image"]["sha256"] == review["inputImageSha256"]
        and row["image"]["path"] == record["relativeDirectory"] + "/" + record["originalImage"]["path"]
        and review["status"] == "review_passed", "corrected RGB/source review differs")
    pack = reader.json(row["conditionPack"])
    cpu.validate_pack(row, pack, order)
    task_binding = identity["taskPackage"]
    task_bytes = reader.read(task_binding)
    task = json.loads(task_bytes)
    cpu.verify_js_content_hash(task_bytes, "taskSha256", pack["taskSha256"])
    require(task_binding["path"] == pack["sourceBindings"]["taskPackagePath"]
        and task["taskId"] == pack["taskId"] and task["worldId"] == pack["worldId"] == identity["worldId"]
        and task["tick"] == pack["tick"] == identity["tick"], "corrected task/fact identity differs")
    facts_binding = {"path": task["sourceBindings"]["naturalizedWorldFactsPath"],
        "sha256": task["sourceBindings"]["naturalizedWorldFactsSha256"]}
    facts = reader.json(facts_binding)
    require(facts_binding["sha256"] == identity["factHash"] and facts["v7SlotBinding"]["slotId"] == row["capacitySlotId"],
        "corrected world facts differ")
    visual = reader.read(identity["visualFactManifestFile"])
    cpu.verify_js_content_hash(visual, "manifestSha256", identity["visualFactManifestContentSha256"])
    table = pack["objectInstanceTable"]
    require(len(table) == len(task["spatialLayers"]["objectFootprints"])
        and digest(canonical(table)) == identity["objectTableSha256"], "corrected object table differs")
    for ordinal, (item, original) in enumerate(zip(table, task["spatialLayers"]["objectFootprints"]), 1):
        require(item["value"] == ordinal and all(item[key] == original[key] for key in
            ("objectId", "kind", "footprint", "blocksMovement")), "corrected object facts differ")

    def pixels(binding, mode, resampling):
        with Image.open(io.BytesIO(reader.read(binding))) as image:
            require(image.format == "PNG" and image.mode == mode and image.size == (1024, 768), "corrected PNG mode/size differs")
            return np.asarray(image.resize((256, 192), resample=resampling), dtype=np.uint8).copy()
    image = pixels(row["image"], "RGB", Image.Resampling.LANCZOS)
    channels = [pixels(channel, "L", Image.Resampling.BILINEAR if channel["id"] in continuous else Image.Resampling.NEAREST)
        for channel in pack["channels"]]
    sample = {"sampleId": row["sampleId"], "split": "train", "objectInstanceTable": deepcopy(table),
        "image": torch.from_numpy(image).permute(2, 0, 1).float().div(255),
        "conditions": torch.stack([torch.from_numpy(value).float().div(255) for value in channels])}
    validate_bound_object_views(sample["conditions"], table, order)
    return sample, deepcopy(identity)

