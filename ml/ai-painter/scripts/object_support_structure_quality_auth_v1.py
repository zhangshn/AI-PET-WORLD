# OSS-BIND-01-PY: independent support-structure execution identity.
"""Own 1.72 authentication; the 1.69 CPU template grants no execution admission."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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

CAPABILITY = "stage4_mvp256_dry_object_support_structure_quality24_v1"
PROFILE = "bounded_object_support_structure_quality24_v1"
PLAN_SCHEMA = "object-support-structure-quality-plan-v1"
ROOT_PREFIX = ".runtime/ai-painter/object-support-structure-quality-executions/"
SELF = "ml/ai-painter/scripts/object_support_structure_quality_auth_v1.py"
SPECIFICATION = {"path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    "sha256": "376b11585cf32ebe6a7d940908231e285e001ff9f36f1f2c12eb08eaea498856"}
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
MODEL_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1"
EXECUTION_POLICY_PATH = "data/ai-painter/system-governance/ai-painter-object-support-structure-quality-execution-policy-v3.json"
EXECUTION_POLICY = {"path": EXECUTION_POLICY_PATH,
    "sha256": "e393944b3e1fd6b344bd7f7511c4f72f51d69e2562c0a60969cd8a51e185039a"}
PREVIOUS_EXECUTION_POLICY = {"path": "data/ai-painter/system-governance/ai-painter-object-support-structure-quality-execution-policy-v2.json",
    "sha256": "37c3789d3a9d1f7b459734e4a90ff4b808acd223955f384b5ff66b8846c5cbcd"}
ROLES = {
    "adapter": "scripts/run-ai-painter-object-support-structure-quality-v1.mjs",
    "packageChain": "scripts/lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs",
    "frozenProjectManifest": ".runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1/ns003-original-package.json",
    "currentLegacyNativeTests": "scripts/tests/ai-painter-ecology-owned-native.test.mjs",
    "currentExecutionRegistry": "src/server/ai-painter-current-execution-registry.mjs",
    "worker": "ml/ai-painter/scripts/painter_stage4_object_support_structure_quality_worker_v1.py",
    "gpuQualifier": "ml/ai-painter/scripts/qualify_stage4_object_support_structure_quality_gpu_v1.py",
    "executionAuth": "ml/ai-painter/scripts/object_support_structure_quality_auth_v1.py",
    "registration": "scripts/lib/ai-painter-object-support-structure-quality-registration-v1.mjs",
    "nativeRunner": "scripts/lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs",
    "nativeOwnerBuilder": "scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs",
    "nativeOwnerSource": "scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs",
    "nativeStreamTests": "scripts/tests/ai-painter-owned-worker-stream-v2.test.mjs",
    "cpuHarness": "ml/ai-painter/tests/test_object_support_structure_execution_cpu_v1.py",
    "entryTests": "scripts/tests/ai-painter-object-support-structure-quality-entry.test.mjs",
    "capture": "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py",
    "captureTests": "ml/ai-painter/tests/test_ecology_regime_gradient_failure_capture_cpu.py",
    "loop": "ml/ai-painter/scripts/painter_stage4_object_support_structure_lifecycle_v1.py",
    "loopTests": "ml/ai-painter/tests/test_object_support_structure_lifecycle_cpu_v1.py",
    "trainingProfile": "ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_v1.py",
    "managedCheckpoint": "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_checkpoint_v1.py",
    "ranking": "ml/ai-painter/scripts/ecology_quality_ranking_v1.py",
    "checkpointTests": "ml/ai-painter/tests/test_object_support_structure_lifecycle_cpu_v1.py",
    "decode1Model": "ml/ai-painter/src/ai_painter/complete_world/object_ecology_terrain_detail_weight_precision_v1.py",
    "decode1Operator": "ml/ai-painter/src/ai_painter/complete_world/decode1_weight_reduction_precision_v1.py",
    "decode1Bridge": "ml/ai-painter/src/ai_painter/complete_world/object_ecology_terrain_detail_weight_priority_update_v1.py",
    "decode1CoreTests": "ml/ai-painter/tests/test_ecology_terrain_detail_precision_cpu.py",
    "reviewWorker": "ml/ai-painter/scripts/review_stage4_object_support_structure_quality_cpu_v1.py",
    "reviewDriver": "scripts/run-ai-painter-object-support-structure-quality-review-v1.mjs",
    "reviewRecovery": "scripts/lib/ai-painter-ecology-terrain-detail-review-recovery-v1.mjs",
    "reviewTests": "ml/ai-painter/tests/test_object_support_structure_execution_cpu_v1.py",
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

FINAL_RGB_CAPABILITY = "stage4_mvp256_dry_final_rgb_base_weight_quality24_v1"
FINAL_RGB_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-quality-execution-policy-v3.json",
    "sha256":"5479dde98dd24882309986051c86fdfba024a2b3756082a79c9c9734ad3e2de1"}
FINAL_RGB_SPECIFICATION = {"path":SPECIFICATION["path"],"sha256":"318e7078b24f56734af92ba6636d63ec89ef27174866cc72ac2f4e934505b30e"}
FINAL_RGB_ROLES = {
    "finalRgbModel":"ml/ai-painter/src/ai_painter/complete_world/object_ecology_final_rgb_base_weight_precision_v1.py",
    "finalRgbOperator":"ml/ai-painter/src/ai_painter/complete_world/final_rgb_base_weight_reduction_precision_v1.py",
    "finalRgbCpuBridge":"ml/ai-painter/src/ai_painter/complete_world/object_support_final_rgb_weight_priority_update_v1.py",
    "finalRgbDeviceBridge":"ml/ai-painter/src/ai_painter/complete_world/object_support_final_rgb_weight_priority_update_device_v1.py",
    "finalRgbTrainingProfile":"ml/ai-painter/scripts/painter_stage4_final_rgb_base_weight_training_profile_v1.py",
    "finalRgbCheckpoint":"ml/ai-painter/src/ai_painter/complete_world/final_rgb_base_weight_quality_checkpoint_v1.py",
    "finalRgbTests":"ml/ai-painter/tests/test_final_rgb_base_weight_quality_adapters_cpu_v1.py"}
JOINT_CAPABILITY = "stage4_mvp256_dry_joint_object_priority_quality24_v1"
JOINT_POLICY = {"path":"data/ai-painter/system-governance/ai-painter-joint-object-priority-quality-execution-policy-v3.json",
    "sha256":"45fb11fe41c23fdd2d47e08c8dfcd184d288d8e967c72426aa1848a987f4751a"}
JOINT_SPECIFICATION = {"path":SPECIFICATION["path"],"sha256":"db7c2a7e530d40d0e3364aadeb8dffc9f9ff97952358b36ce3aec24b0bc71b7a"}
PROGRESS_PUBLICATION_POLICY = {
    "path":"data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v1.json",
    "sha256":"594e72f0f3faa0d4eb8380e64143e197bf31d6eb6567578ba5f2e762c431c1bc"}
PROGRESS_PUBLICATION_PATH = "ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v1.py"
PROGRESS_PUBLICATION = {"componentPolicy": PROGRESS_PUBLICATION_POLICY,
    "componentPath": PROGRESS_PUBLICATION_PATH, "freshnessSeconds": 120,
    "maximumPendingFiles": 1, "originalDeadlineRequired": True}
JOINT_ROLES = {
    "jointCpuBridge":"ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_cpu_v1.py",
    "jointDeviceBridge":"ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_device_v1.py",
    "jointTrainingProfile":"ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_v1.py",
    "jointCheckpoint":"ml/ai-painter/src/ai_painter/complete_world/joint_object_priority_quality_checkpoint_v1.py",
    "jointTests":"ml/ai-painter/tests/test_joint_object_priority_quality_adapters_cpu_v1.py",
    "progressPublication": PROGRESS_PUBLICATION_PATH}


@dataclass(frozen=True)
class ExecutionRoute:
    capability: str
    model_capability: str
    profile: str
    root_prefix: str
    specification: dict
    execution_policy: dict


def execution_route(capability_version=CAPABILITY):
    require(type(capability_version) is str and capability_version in (CAPABILITY,FINAL_RGB_CAPABILITY,JOINT_CAPABILITY),
        "only registered support execution routes allowed")
    if capability_version == CAPABILITY:
        return ExecutionRoute(CAPABILITY,MODEL_CAPABILITY,PROFILE,ROOT_PREFIX,dict(SPECIFICATION),dict(EXECUTION_POLICY))
    if capability_version == JOINT_CAPABILITY:
        return ExecutionRoute(JOINT_CAPABILITY,"stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1",
            "bounded_joint_object_priority_quality24_v1",".runtime/ai-painter/joint-object-priority-quality-executions/",
            dict(JOINT_SPECIFICATION),dict(JOINT_POLICY))
    return ExecutionRoute(FINAL_RGB_CAPABILITY,"stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1",
        "bounded_final_rgb_base_weight_quality24_v1",".runtime/ai-painter/final-rgb-base-weight-quality-executions/",
        dict(FINAL_RGB_SPECIFICATION),dict(FINAL_RGB_POLICY))


def program_file_limit(capability_version=CAPABILITY):
    return 260 if execution_route(capability_version).capability == JOINT_CAPABILITY else 256


def validate_program_count(programs, capability_version=CAPABILITY):
    require(type(programs) is dict and 1 <= len(programs) <= program_file_limit(capability_version),
        "bounded actual execution source count exceeded")


def checkpoint_components(capability_version=CAPABILITY):
    route=execution_route(capability_version)
    if route.capability == JOINT_CAPABILITY:
        from ai_painter.complete_world import joint_object_priority_quality_checkpoint_v1 as codec
    elif route.capability == FINAL_RGB_CAPABILITY:
        from ai_painter.complete_world import final_rgb_base_weight_quality_checkpoint_v1 as codec
    else:
        from ai_painter.complete_world import object_support_structure_checkpoint_v1 as codec
    return codec


def profile_components(capability_version=CAPABILITY):
    route=execution_route(capability_version)
    if route.capability == JOINT_CAPABILITY:
        import painter_stage4_joint_object_priority_training_profile_v1 as profile
    elif route.capability == FINAL_RGB_CAPABILITY:
        import painter_stage4_final_rgb_base_weight_training_profile_v1 as profile
    else:
        import painter_stage4_object_support_structure_training_profile_v1 as profile
    require(profile.CAPABILITY == route.capability and profile.MODEL_CAPABILITY == route.model_capability,
        "registered runtime profile identity differs")
    return profile


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
        value.get("capabilityVersion") == execution_route(scope.get("capabilityVersion",CAPABILITY)).capability and value.get("executionState") == "executing" and
        type(value.get("ttlSeconds")) is int and value["ttlSeconds"] == 120 and
        type(value.get("processId")) is int and value["processId"] > 0 and
        type(value.get("processStartIdentity")) is str and value["processStartIdentity"], "heartbeat control identity differs")
    if expected is not None:
        require(all(value.get(k) == v for k, v in expected.items()), "heartbeat live identity differs")
    stamp = datetime.fromisoformat(value["heartbeatAtUtc"].replace("Z", "+00:00"))
    require(stamp.tzinfo is not None and -300 <= (datetime.now(timezone.utc) - stamp).total_seconds() < 120,
        "heartbeat stale/future")


def _snapshot_heartbeat(reader, logical, scope, expected=None):
    root = execution_route(scope.get("capabilityVersion",CAPABILITY)).root_prefix + scope["runId"]
    require(logical == root + "/heartbeat.json" or
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


def configuration(reader, *, capability_version=CAPABILITY):
    return derive_configuration(reader,capability_version=capability_version)


def _derive_final_rgb_configuration(reader):
    codec=checkpoint_components(FINAL_RGB_CAPABILITY)
    formal=reader.read(FINAL_RGB_SPECIFICATION)
    require(hashlib.sha256(formal).hexdigest()==FINAL_RGB_SPECIFICATION["sha256"]
        and b"AI-PAINTER-SPEC-1.79" in formal,"current final RGB specification differs")
    raw=reader.read(FINAL_RGB_POLICY)
    require(hashlib.sha256(raw).hexdigest()==FINAL_RGB_POLICY["sha256"],"final RGB execution policy bytes differ")
    policy=decode(raw)
    history=policy["supersededExecutionRevision"]
    for b in ({"path":history["path"],"sha256":history["sha256"]},history["formalSpecificationSnapshot"]):
        require(hashlib.sha256(reader.read(b)).hexdigest()==b["sha256"],"superseded execution bytes differ")
    # The preview source hash intentionally belongs to the actual plan/config,
    # not the execution-policy hash cycle. Only this registered path is minted.
    path=reader.path(codec.PREVIEW_PATH)
    before=path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_size<=65536,"preview v3 registration size/type")
    preview_raw=path.read_bytes()
    preview={"path":codec.PREVIEW_PATH,"sha256":hashlib.sha256(preview_raw).hexdigest()}
    require(_file_identity(path.lstat())==_file_identity(before) and reader.read(preview,65536)==preview_raw,
        "preview registration changed")
    require(decode(preview_raw).get("schemaVersion")=="ai-painter-training-preview-observation-policy-v3","registered preview v3 schema")
    result=codec.expected_configuration(preview)
    codec.validate_execution_policy(policy,result)
    for b in (*policy["modelBoundary"]["frozenCpuSources"],codec.INTEGRATION,codec.LOSS,codec.GRADIENT,CANDIDATE):
        require(hashlib.sha256(reader.read(b)).hexdigest()==b["sha256"],"frozen algorithm/assets bytes differ")
    evidence=policy["priorCpuEvidence"]
    for key in ("acceptance","terminal","policy","originalNormativeBytes"):
        b=exact_binding(evidence[key]);require(hashlib.sha256(reader.read(b)).hexdigest()==b["sha256"],"prior CPU bytes differ")
    acceptance=read_json(reader,evidence["acceptance"])
    terminal=read_json(reader,evidence["terminal"])
    require(acceptance.get("status")=="actual_cpu_candidate_verified_inactive" and acceptance.get("nativeCleanupVerified") is True
        and acceptance.get("guardReleaseVerified") is True and acceptance.get("terminal")=={**evidence["terminal"],"bytes":len(reader.read(evidence["terminal"]))}
        and terminal.get("status")=="cpu_candidate_verified_inactive","actual frozen CPU support evidence differs")
    reader.unchanged()
    return result


def _derive_joint_configuration(reader):
    codec = checkpoint_components(JOINT_CAPABILITY)
    formal = reader.read(JOINT_SPECIFICATION)
    require(hashlib.sha256(formal).hexdigest() == JOINT_SPECIFICATION["sha256"]
        and b"AI-PAINTER-SPEC-1.86" in formal, "current joint specification differs")
    policy = read_json(reader, JOINT_POLICY)
    path = reader.path(codec.PREVIEW_PATH)
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_size <= 65536, "preview v5 registration size/type")
    raw = path.read_bytes()
    preview = {"path": codec.PREVIEW_PATH, "sha256": hashlib.sha256(raw).hexdigest()}
    require(_file_identity(path.lstat()) == _file_identity(before) and reader.read(preview, 65536) == raw
        and decode(raw).get("schemaVersion") == "ai-painter-training-preview-observation-policy-v5",
        "preview v5 registration differs")
    result = codec.expected_configuration(preview)
    codec.validate_execution_policy(policy, result)
    verify_progress_publication_policy(reader, policy)
    for bound in (*policy["modelBoundary"]["frozenCpuSources"], policy["modelBoundary"]["jointCpuRule"],
            codec.INTEGRATION, codec.LOSS, codec.GRADIENT, codec.JOINT_LEARNING_RULE, CANDIDATE,
            policy["previousExecutionPolicy"]):
        reader.read(bound)
    evidence = policy["priorCpuEvidence"]
    for key in ("acceptance", "terminal", "policy", "originalNormativeBytes"):
        reader.read(exact_binding(evidence[key]))
    acceptance, terminal = read_json(reader, evidence["acceptance"]), read_json(reader, evidence["terminal"])
    observed = acceptance.get("realExecution", {})
    require(acceptance.get("status") == "cpu_affinity_startup_repair_closed_real_cpu_verified_inactive"
        and observed.get("status") == "real_cpu_verified_inactive" and observed.get("executionState") == "completed"
        and observed.get("rngUnchanged") is True and observed.get("componentResultRevalidated") is True
        and all(observed.get("cleanup", {}).get(key) is True for key in ("emptyJob", "cleanupConfirmed", "guardReleaseConfirmed"))
        and observed.get("actualCalls", {}).get("generatorForwards") == 1
        and observed.get("actualCalls", {}).get("autogradCalls") == 5
        and terminal.get("status") == "real_cpu_verified_inactive", "accepted joint CPU support evidence differs")
    reader.unchanged()
    return result


def _verified_progress_json(reader, binding):
    raw = reader.read(exact_binding(binding), CONTROL_JSON_MAX)
    require(hashlib.sha256(raw).hexdigest() == binding["sha256"], "progress publication SHA differs")
    value = decode(raw)
    require(type(value) is dict, "progress publication JSON object required")
    return value


def verify_progress_publication_policy(reader, policy):
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
    require(plan.get("capabilityVersion") == JOINT_CAPABILITY
        and same_json(plan.get("executionPolicy"), JOINT_POLICY)
        and same_json(plan.get("configuration", {}).get("progressPublicationPolicy"), PROGRESS_PUBLICATION_POLICY),
        "exact joint v3 progress publication bindings required")
    policy = _verified_progress_json(reader, JOINT_POLICY)
    checkpoint_components(JOINT_CAPABILITY).validate_execution_policy(policy, plan["configuration"])
    source = verify_progress_publication_policy(reader, policy)
    require(same_json(plan.get("programBindings", {}).get("progressPublication"), source),
        "actual progress component program role differs")
    return source


def _verify_final_rgb_programs(reader,programs,capability_version=FINAL_RGB_CAPABILITY):
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
    require(hashlib.sha256(Path(__file__).read_bytes()).hexdigest()==programs["executionAuth"]["sha256"],"actual loaded auth source differs")
    return seen


def required_program_roles(capability_version=CAPABILITY):
    route=execution_route(capability_version)
    if route.capability == CAPABILITY:
        return {**ROLES,**LOCAL_DEPLOYMENT_DEPENDENCY_ROLES}
    keys=("adapter","packageChain","currentExecutionRegistry","worker","gpuQualifier","executionAuth","registration",
        "nativeRunner","nativeOwnerBuilder","nativeOwnerSource","cpuHarness","entryTests","loop","trainingProfile",
        "managedCheckpoint","ranking","reviewWorker","reviewDriver","capture")
    if route.capability == JOINT_CAPABILITY:
        return {**{k:ROLES[k] for k in keys}, **JOINT_ROLES, **LOCAL_DEPLOYMENT_DEPENDENCY_ROLES,
            "finalRgbModel":FINAL_RGB_ROLES["finalRgbModel"], "finalRgbOperator":FINAL_RGB_ROLES["finalRgbOperator"],
            "executionPolicy":JOINT_POLICY["path"]}
    return {**{k:ROLES[k] for k in keys},**FINAL_RGB_ROLES,**LOCAL_DEPLOYMENT_DEPENDENCY_ROLES,
        "executionPolicy":FINAL_RGB_POLICY["path"]}


def validate_execution_policy(policy, configuration):
    """Current execution contract is separate from the immutable CPU config."""
    if configuration.get("capabilityVersion") in (FINAL_RGB_CAPABILITY,JOINT_CAPABILITY):
        return checkpoint_components(configuration["capabilityVersion"]).validate_execution_policy(policy,configuration)
    from ai_painter.complete_world import object_support_structure_checkpoint_v1 as codec
    codec.validate_configuration(configuration)
    expected_policy = json.loads(r'''{"schemaVersion":"ai-painter-object-support-structure-quality-execution-policy-v3","status":"registered_bounded_candidate_route_not_qualified","formalSpecification":{"path":"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md","version":"AI-PAINTER-SPEC-1.72","sha256":"376b11585cf32ebe6a7d940908231e285e001ff9f36f1f2c12eb08eaea498856"},"candidate":"stage4_mvp256_dry_object_support_structure_quality24_v1","modelCapability":"stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1","executionProfile":"bounded_object_support_structure_quality24_v1","entrypointPath":"scripts/run-ai-painter-object-support-structure-quality-v1.mjs","outputRoot":".runtime/ai-painter/object-support-structure-quality-executions","sourceCandidate":{"path":"data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json","sha256":"ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566"},"priorCpuEvidence":{"acceptance":{"path":".runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/object-support-integration-cpu-acceptance-v1.json","sha256":"45e7d7014f158030b52b1da8620ed87d222c9cf8551e2f97cbc4aab6d8176229"},"integrationAcceptance":{"path":".runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/object-support-device-lifecycle-acceptance-v1.json","sha256":"9d693f0700ba9d2f445b01ea362894f030f2314852c039df9b80878a7d787ec4"},"normativeVersion":"AI-PAINTER-SPEC-1.69","originalNormativeBytes":{"path":"data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.69-792bf647.txt","sha256":"792bf647336eb59a3cdbe6b4efbe3e630724e810ba0afa125fb4d7cc350c2e19"},"oldAttemptReplayAllowed":false,"grantsGpuOrTrainingQualification":false},"modelBoundary":{"parameterCount":108,"parameterElements":2242687,"changedTargetIndex":60,"changedTargetName":"core.core.terrain.full_resolution_detail.layers.3.weight","targetShape":[48,48,3,3],"parentTarget52Kept":true,"nativeForwardAndInputBiasGradientsKept":true,"otherLayersMayChange":false,"initializationSeed":20260929,"freshInitializationOnly":true,"historicalCheckpointMayInitialize":false,"failedStateMayInitialize":false,"modelArchitectureChanged":false,"numericOperatorsChanged":false},"scope":{"resolution":[256,192],"worldCount":1,"waterFactPresent":false,"buildingsRequired":false,"artificialRoadNetworkRequired":false,"personalityRequired":false,"formalStage4Qualification":false,"runtimePublication":false},"dataUse":{"train":48,"validation":8,"challenge":4,"regression":4,"weightUpdatesFrom":["train"],"checkpointSelectionFrom":["validation"],"challengeAndRegressionContentRead":false,"sourceImageOrSplitMutation":false},"executionCeiling":{"epochs":24,"generatorOptimizerSteps":1152,"discriminatorOptimizerSteps":1152,"maxWallSeconds":8400,"cpuThreads":2,"trainingAttempts":1,"automaticRetries":0,"maxGpuMemoryFraction":0.7,"maximumTemperatureC":85,"minimumFreeVramMiB":2048,"minimumFreeDiskMiB":2048,"maxOutputMiB":128},"phaseResources":{"cpuPreparationSeconds":240,"gpuAdmissionSeconds":600,"reviewSeconds":120,"maxStreamBytes":8388608,"cpuOutputBytes":8388608,"qualificationAndReviewOutputBytes":16777216,"captureMiB":64,"captureMetadataReserveBytes":1048576,"terminalReserveBytes":65536,"programFileCountMaximum":256,"programFileBytesMaximum":1048576,"totalProgramBytesMaximum":16777216},"gpuAdmission":{"sampleSplit":"train","sampleCount":48,"optimizerConstruction":0,"optimizerUpdates":0,"samePackageRequired":true,"stateBytesMustRemainUnchanged":true,"originalGradientGateKept":true,"oldCandidateQualificationReusable":false,"generatorForwardsPerSample":1,"generatorAutogradPerSample":5,"discriminatorAutogradPerSample":1,"totalGeneratorAutograd":240,"totalDiscriminatorAutograd":48},"optimizer":{"name":"AdamW","generatorLearningRate":0.0001,"discriminatorLearningRate":0.0001,"weightDecay":0.01,"betas":[0.9,0.999],"eps":1e-8},"checkpointSelection":{"eligibleEpochs":[24],"strictNewCandidateReloadRequired":true,"automaticResumeAllowed":false,"observationOnlyEpochs":[12]},"stopRules":["CPU behavior and native cleanup must pass for the actual execution-source closure before package admission.","GPU admission and training each consume their own same-package phase once; no automatic retry or restart.","Only the already verified support-structure term and its five-gradient bridge change the learning objective. Keep every inherited Loss, core-priority rule, model, data, thresholds, optimizer, resource ceiling and world scope unchanged.","Never initialize from failed state or inherit another candidate's GPU qualification.","Preserve the first failure, captured evidence, and real managed Job cleanup receipts.","Use the existing background, registry, SQLite, shared resource guard and observation contracts only.","Training completion, visual review and capability release remain separate decisions.","The 1.69 snapshot is an immutable CPU configuration baseline, never current execution admission; verify current 1.72 and this own policy separately.","External task scope is recorded separately from this lifecycle contract and cannot grant technical qualification or redefine local standing autonomy. The registered qualify-only mode must stop before training.","CPU preparation may only decode the fixed eight validation rows for loader regression. Train, challenge and regression image content remains unread; no model forward, autograd, optimizer or GPU operation."],"qualification":{"gpuQualified":false,"trainingQualified":false,"visualQualified":false,"stage4Qualified":false,"capabilityReleased":false,"runtimeFrameAllowed":false},"sourceAssetsUse":"data_review_and_base_schedule_only_not_execution_qualification","lossDefinition":{"path":"data/ai-painter/system-governance/ai-painter-object-support-structure-cpu-policy-v1.json","sha256":"f5842c5005a60a2c51dd84f9baca1d4ecc751a5fed09e8647f7d96acd4efaefe"},"gradientDefinition":{"path":"data/ai-painter/system-governance/ai-painter-object-support-structure-integration-cpu-policy-v1.json","sha256":"2aa89a112ebc125e9b4bfdea8f7adade22f1d57afb094d1d4b4f1cff36293d82"},"integrationPolicy":{"path":"data/ai-painter/system-governance/ai-painter-object-support-structure-lifecycle-integration-policy-v1.json","sha256":"7782b99aa6f04c56a14a2f35694c4e67c99911835bc62e1096f25ac3424d17d3"},"checkpointIdentity":{"schema":"object-support-structure-quality-checkpoint-v1","configurationSchema":"object-support-structure-quality-configuration-v1","implementation":"ml/ai-painter/src/ai_painter/complete_world/object_support_structure_checkpoint_v1.py","historicalMetadataRenamingAllowed":false},"failureCapture":{"gradientLabels":["actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb","objectSupportStructure"],"maxEpoch":24,"maxGeneratorOptimizerSteps":1152,"maxDiscriminatorOptimizerSteps":1152,"maxCaptureBytes":67108864,"retainPrimaryError":true},"previousExecutionPolicy":{"path":"data/ai-painter/system-governance/ai-painter-object-support-structure-quality-execution-policy-v2.json","sha256":"37c3789d3a9d1f7b459734e4a90ff4b808acd223955f384b5ff66b8846c5cbcd"},"lifecycleBoundary":{"managedCpuPreparation":true,"samePackageGpuAdmission":true,"boundedTrainingAfterSamePackageGpuAdmission":true,"productionRegistryWrite":true,"oldEvidenceMutation":false,"qualificationOnlyStopsBeforeTraining":true,"cpuPreparationValidationLoaderReadOnly":{"split":"validation","exactSampleCount":8,"originalRgbAndConditionsOnly":true,"trainImageRead":false,"challengeImageRead":false,"regressionImageRead":false,"sourceMutation":false,"autograd":false,"checkpointSelection":false}}}''')
    require(same_json(policy, expected_policy), "exact pinned current policy fields/values differ")
    require(type(policy) is dict and policy.get("schemaVersion") == "ai-painter-object-support-structure-quality-execution-policy-v3"
        and policy.get("status") == "registered_bounded_candidate_route_not_qualified", "own current execution policy required")
    expected = {"formalSpecification": {**SPECIFICATION, "version": "AI-PAINTER-SPEC-1.72"},
        "candidate": CAPABILITY, "modelCapability": MODEL_CAPABILITY, "executionProfile": PROFILE,
        "entrypointPath": ROLES["adapter"], "outputRoot": ROOT_PREFIX.rstrip("/"),
        "dataUse": configuration["dataUse"], "executionCeiling": configuration["executionCeiling"],
        "optimizer": configuration["optimizer"]}
    for key, value in expected.items():
        require(same_json(policy.get(key), value), "policy/configuration differs: " + key)
    phases = policy.get("phaseResources")
    require(type(phases) is dict and all(phases.get(k) == v for k, v in {
        "cpuPreparationSeconds": 240, "gpuAdmissionSeconds": 600, "reviewSeconds": 120,
        "maxStreamBytes": 8388608, "cpuOutputBytes": 8388608, "captureMiB": 64,
        "programFileCountMaximum": 256, "programFileBytesMaximum": 1048576,
        "totalProgramBytesMaximum": 16777216}.items()), "fixed phase resources differ")
    gate = policy.get("gpuAdmission")
    require(type(gate) is dict and all(gate.get(k) == v for k, v in {"sampleSplit": "train", "sampleCount": 48,
        "optimizerConstruction": 0, "optimizerUpdates": 0, "samePackageRequired": True,
        "stateBytesMustRemainUnchanged": True, "oldCandidateQualificationReusable": False}.items()), "own zero-update admission differs")
    require(same_json(policy.get("checkpointSelection"), {"eligibleEpochs": [24], "observationOnlyEpochs": [12],
        "strictNewCandidateReloadRequired": True, "automaticResumeAllowed": False}), "fixed checkpoint selection differs")
    require(type(policy.get("qualification")) is dict and policy["qualification"]
        and all(value is False for value in policy["qualification"].values()), "policy cannot self-grant qualification")
    return policy


def derive_configuration(reader, *, capability_version=CAPABILITY):
    route=execution_route(capability_version)
    if route.capability == JOINT_CAPABILITY:
        return _derive_joint_configuration(reader)
    if route.capability == FINAL_RGB_CAPABILITY:
        return _derive_final_rgb_configuration(reader)
    from ai_painter.complete_world import object_support_structure_checkpoint_v1 as codec
    # Missing controller-frozen hashes are intentionally invalid bindings.
    exact_binding(SPECIFICATION); exact_binding(EXECUTION_POLICY)
    formal = reader.read(SPECIFICATION)
    require(hashlib.sha256(formal).hexdigest() == SPECIFICATION["sha256"]
        and all(value in formal for value in (b"AI-PAINTER-SPEC-1.72", b"17.1",
            b"ai-painter-object-support-structure-quality-execution-policy-v3.json")), "current SPEC1.72 bytes/route differ")
    raw = reader.read(EXECUTION_POLICY)
    require(hashlib.sha256(raw).hexdigest() == EXECUTION_POLICY["sha256"], "current execution policy SHA differs")
    require(hashlib.sha256(reader.read(PREVIOUS_EXECUTION_POLICY)).hexdigest() == PREVIOUS_EXECUTION_POLICY["sha256"],
        "historical execution policy bytes differ")
    # The frozen codec is a pure config source, never an old admission reader.
    baseline = reader.read(CPU_SPECIFICATION_BASELINE)
    require(hashlib.sha256(baseline).hexdigest() == CPU_SPECIFICATION_BASELINE["sha256"]
        and b"AI-PAINTER-SPEC-1.69" in baseline, "explicit CPU baseline bytes differ")
    result = codec.expected_configuration()
    require(result["formalSpecification"]["sha256"] == CPU_SPECIFICATION_BASELINE["sha256"], "CPU template identity differs")
    for binding in (codec.POLICY, codec.LOSS, codec.GRADIENT, CANDIDATE):
        payload = reader.read(binding)
        require(hashlib.sha256(payload).hexdigest() == binding["sha256"], "bound CPU definition/assets bytes differ")
    historical = decode(raw)["priorCpuEvidence"]
    for key in ("acceptance", "integrationAcceptance"):
        payload = reader.read(exact_binding(historical[key]))
        require(hashlib.sha256(payload).hexdigest() == historical[key]["sha256"], "historical CPU evidence bytes differ")
    validate_execution_policy(decode(raw), result)
    reader.unchanged()
    return result


def _manifest_semantic_transition(original_raw, current_raw):
    original, current = decode(original_raw), decode(current_raw)
    require(type(original) is dict and type(current) is dict and type(original.get("scripts")) is dict
        and type(current.get("scripts")) is dict, "exact manifest/scripts objects required")
    additions = {
        "control:ai-painter-ecology-decode1-quality": "node scripts/run-ai-painter-ecology-decode1-quality-v1.mjs",
        "control:ai-painter-ecology-terrain-detail-quality": "node scripts/run-ai-painter-ecology-terrain-detail-quality-v1.mjs",
        MANIFEST_ALIAS: MANIFEST_COMMAND}
    require(all(key not in original["scripts"] and current["scripts"].get(key) == value for key, value in additions.items()),
        "only three exact route aliases may be added")
    reduced = {**current, "scripts": {key: value for key, value in current["scripts"].items() if key not in additions}}
    require(same_json(reduced, original), "manifest differs beyond three exact alias additions")


def historical_source_binding(role, binding):
    if role != "source-19":
        return historical_native_test_binding(role, binding)
    require(same_json(binding, {"path": "src/server/ai-painter-current-execution-registry.mjs", "sha256": ORIGINAL_REGISTRY["sha256"]}),
            "exact historical registry source required")
    return ORIGINAL_REGISTRY


def historical_native_test_binding(role, binding):
    if role not in ("source-151", "nativeTests"):
        return binding
    require(same_json(binding, {"path": "scripts/tests/ai-painter-ecology-owned-native.test.mjs", "sha256": ORIGINAL_NATIVE_TESTS["sha256"]}),
            "exact historical native test role required")
    return ORIGINAL_NATIVE_TESTS


def verify_native_test_rename(original, current):
    baseline = original.decode("utf-8").replace("\r\n", "\n")
    updated = current.decode("utf-8").replace("\r\n", "\n")
    require(len(re.findall(r"\bmodule\b", baseline)) == 4, "exact four legacy test identifiers required")
    require(updated == re.sub(r"\bmodule\b", "nativeModule", baseline), "native test change beyond identifier rename")


def verify_programs(reader, programs, *, capability_version=CAPABILITY):
    if execution_route(capability_version).capability in (FINAL_RGB_CAPABILITY,JOINT_CAPABILITY):
        return _verify_final_rgb_programs(reader,programs,capability_version)
    require(type(programs) is dict and 1 <= len(programs) <= 256 and
        set(ROLES) | set(LOCAL_DEPLOYMENT_DEPENDENCY_ROLES) <= set(programs), "full own source roles required")
    frozen = read_json(reader, FROZEN_PLAN)["programBindings"]
    require(len(frozen) == 179, "original179 source closure differs")
    for role, binding in frozen.items():
        if role == "source-137":
            require(same_json(binding, {"path": "package.json", "sha256": ORIGINAL_MANIFEST["sha256"]}),
                    "original source137 manifest identity differs")
            current = exact_binding(programs.get("frozen-" + role))
            require(current["path"] == "package.json", "source137 path cannot change")
            _manifest_semantic_transition(reader.read(ORIGINAL_MANIFEST, PROGRAM_MAX), reader.read(current, PROGRAM_MAX))
        else:
            require(same_json(programs.get("frozen-" + role), historical_source_binding(role, binding)),
                    "old source role omitted/retargeted: " + role)
    verify_native_test_rename(reader.read(ORIGINAL_NATIVE_TESTS, PROGRAM_MAX),
                             reader.read(exact_binding(programs.get("currentLegacyNativeTests")), PROGRAM_MAX))
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
    require(same_json(programs["executionPolicy"], EXECUTION_POLICY), "current policy binding differs")
    for role, logical in LOCAL_DEPLOYMENT_DEPENDENCY_ROLES.items():
        require(programs[role]["path"] == logical, "deployment source path differs: " + role)
    require(hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == programs["executionAuth"]["sha256"], "loaded own auth differs")
    return seen


def derive_model_metadata(reader, dataset_binding, *, capability_version=CAPABILITY):
    route=execution_route(capability_version)
    profile=profile_components(route.capability)
    _,_,_,ARCHITECTURE,NUMERIC_RULE=checkpoint_components(route.capability).components() if route.capability in (FINAL_RGB_CAPABILITY,JOINT_CAPABILITY) else checkpoint_components().parent.components()
    manifest = read_json(reader, dataset_binding)
    model, critic = profile.fresh_networks(manifest["identityPayload"]["channelOrder"])
    graph = [{"name": name, "shape": list(value.shape), "elements": value.numel(), "dtype": str(value.dtype)}
             for name, value in model.named_parameters()]
    require(len(graph) == 108 and sum(row["elements"] for row in graph) == 2242687, "new actual108 graph differs")
    require(graph[60] == {"name": "core.core.terrain.full_resolution_detail.layers.3.weight",
        "shape": [48, 48, 3, 3], "elements": 20736, "dtype": "torch.float32"}, "actual target60 graph differs")
    if route.capability in (FINAL_RGB_CAPABILITY,JOINT_CAPABILITY):
        require(graph[88] == {"name":"core.core.final_rgb_decoder.base.layers.2.weight","shape":[48,48,3,3],"elements":20736,"dtype":"torch.float32"}, "actual target88 graph differs")
    return {"capabilityVersion": route.capability, "modelCapabilityVersion": profile.MODEL_CAPABILITY,
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
    import painter_stage4_object_support_structure_training_profile_v1 as profile
    reader = _ClosureMetadataReader(root, DIAGNOSTIC)
    metadata = profile.prepare_metadata(reader, DIAGNOSTIC, CONDITION, collect_train_assets=True)
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
    if route.capability in (FINAL_RGB_CAPABILITY,JOINT_CAPABILITY):
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
    route=execution_route(plan.get("capabilityVersion"))
    require(plan.get("schema") == PLAN_SCHEMA and plan.get("executionProfile") == route.profile and
            plan.get("executionMode") == "bounded-quality-training" and plan.get("capabilityVersion") == route.capability,
            "own diagnostic plan required; old plan forbidden")
    for key in ("runId", "packageId"):
        require(type(plan.get(key)) is str and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", plan[key]), "Run/package ID invalid")
    require(plan["runId"] != plan["packageId"] and plan.get("outputRoot") == route.root_prefix + plan["runId"] and
            plan.get("historicalCheckpointMayInitialize") is False and plan.get("trainingRestartAllowed") is False and
            "resourcePolicy" not in plan and "effectiveExecutionCeiling" not in plan and
            "resourceSuccessor" not in plan, "diagnostic identity/retry/resource differs")
    require(same_json(plan.get("configuration"), configuration(reader,capability_version=route.capability)) and
            same_json(plan.get("formalSpecification"), route.specification) and same_json(plan.get("sourceCandidate"), CANDIDATE), "own configuration differs")
    if route.capability in (FINAL_RGB_CAPABILITY,JOINT_CAPABILITY):
        require(plan.get("executionPolicy")==route.execution_policy and
            plan.get("trainingPreviewPolicy")==plan["configuration"].get("trainingPreviewPolicy"),
            "new plan/config execution and preview policy bindings differ")
    candidate = read_json(reader, CANDIDATE)
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
    package = read_json(reader, binding)
    require(package.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1" and
            package.get("capabilityVersion") in (CAPABILITY,FINAL_RGB_CAPABILITY,JOINT_CAPABILITY) and package.get("ownerAuthorizationRequired") is False and
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
    required = [SPECIFICATION, EXECUTION_POLICY, CPU_SPECIFICATION_BASELINE, codec.POLICY, codec.LOSS, codec.GRADIENT,
                CANDIDATE, FROZEN_PLAN, plan["modelBinding"],
                plan["datasetManifest"], plan["trainSplit"], plan["validationSplit"], plan["finalCpuAcceptance"], plan["dataClosure"]]
    if route.capability == JOINT_CAPABILITY:
        current_policy=read_json(reader,route.execution_policy)
        required=[route.specification,route.execution_policy,CANDIDATE,codec.INTEGRATION,codec.LOSS,codec.GRADIENT,
            codec.JOINT_LEARNING_RULE,plan["configuration"]["trainingPreviewPolicy"],plan["modelBinding"],
            plan["datasetManifest"],plan["trainSplit"],plan["validationSplit"],plan["finalCpuAcceptance"],plan["dataClosure"],
            current_policy["previousExecutionPolicy"],current_policy["modelBoundary"]["jointCpuRule"]]
        required.extend(current_policy["modelBoundary"]["frozenCpuSources"])
        required.extend(current_policy["priorCpuEvidence"][key] for key in ("acceptance","terminal","policy","originalNormativeBytes"))
        required.extend((PROGRESS_PUBLICATION_POLICY, current_policy["progressPublicationCpuEvidence"]))
    elif route.capability == FINAL_RGB_CAPABILITY:
        current_policy=read_json(reader,route.execution_policy)
        required=[route.specification,route.execution_policy,CANDIDATE,codec.INTEGRATION,codec.LOSS,codec.GRADIENT,
            plan["configuration"]["trainingPreviewPolicy"],plan["modelBinding"],plan["datasetManifest"],plan["trainSplit"],
            plan["validationSplit"],plan["finalCpuAcceptance"],plan["dataClosure"]]
        required.extend(current_policy["modelBoundary"]["frozenCpuSources"])
        required.extend(current_policy["priorCpuEvidence"][key] for key in ("acceptance","terminal","policy","originalNormativeBytes"))
        history=current_policy["supersededExecutionRevision"]
        required.extend(({"path":history["path"],"sha256":history["sha256"]},history["formalSpecificationSnapshot"]))
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
    return {"status": "live_identity_authenticated_not_qualified", "executionPhase": phase, **identity}
