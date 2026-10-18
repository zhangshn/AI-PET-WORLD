"""Current-route CPU protocol regression; no real sample/model execution or admission."""
import argparse
from contextlib import ExitStack
import copy
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import hashlib
import inspect
import io
import json
import os
from pathlib import Path
import sys
import subprocess
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
for part in ("ml/ai-painter/scripts", "ml/ai-painter/src", "ml/ai-painter/tests"):
    sys.path.insert(0, str(ROOT / part))
import torch
import ecology_terrain_detail_weight_quality_auth_v1 as auth
import painter_stage4_ecology_terrain_detail_weight_quality_worker_v1 as worker
import painter_stage4_ecology_terrain_detail_weight_training_profile_v1 as profile
import qualify_stage4_ecology_terrain_detail_weight_quality_gpu_v1 as qualifier
from ai_painter.complete_world import ecology_terrain_detail_weight_checkpoint_v1 as checkpoint
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as model_type
from ai_painter.complete_world import ecology_regime_gradient_failure_capture as capture


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
    owned = os.environ.get("TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT")
    auth.require(owned is not None, "current owned CPU identity required")
    auth.require(owned.startswith(auth.ROOT_PREFIX) and owned.endswith("/cpu-entry") and
        base == owned.rsplit("/", 1)[0] + "/cpu-negative-inputs", "exact owned identity scope required")
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
    schemas = {"cpu-negative-input-declaration-v1": "cpu-negative-input-live-observation-v1"}
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
    owned = os.environ.get("TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT")
    declaration, declaration_binding = _read_negative_observation_json(reader, base + "/input-declaration.json")
    auth.require(owned is not None, "current owned CPU observation required")
    auth.require(owned.startswith(auth.ROOT_PREFIX) and owned.endswith("/cpu-entry") and
        base == owned.rsplit("/", 1)[0] + "/cpu-negative-inputs" and
        declaration.get("schema") == "cpu-negative-input-declaration-v1", "exact owned CPU observation declaration")
    expected_request = auth.exact_binding({"path": sys.argv[sys.argv.index("--cpu-request") + 1],
        "sha256": sys.argv[sys.argv.index("--sha256") + 1]})
    auth.require(expected_request["path"] == owned.rsplit("/", 1)[0] + "/cpu-request.json", "exact owned request path")
    receipt_root = owned
    auth.require(declaration.get("request") == expected_request and declaration.get("layout") == _negative_observation_layout(base) and
        declaration.get("formalMapping") == _negative_formal_mapping(reader, base) and
        declaration.get("linkMetadataReserveBytes") == 49152 and declaration.get("reserveIsMeasurement") is False,
        "current CPU declaration request/mapping/reserve differs")
    request = auth.read_json(reader, expected_request)
    auth.require(request.get("schema") == "ecology-terrain-detail-weight-quality-cpu-request-v1" and
        request.get("outputRoot") == owned and declaration.get("runId") == request.get("runId") and
        declaration.get("packageId") == request.get("packageId"), "current owned request identity differs")
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
    return receipt_binding


class ExecutionProtocolCpuTests(unittest.TestCase):
    def test_current_cap_model_profile_and_namespace_are_unique(self):
        expected = "stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1"
        self.assertEqual({auth.MODEL_CAPABILITY, worker.MODEL_CAPABILITY, profile.MODEL_CAPABILITY,
            checkpoint.MODEL_CAPABILITY, model_type.CAPABILITY}, {expected})
        self.assertEqual({auth.CAPABILITY, worker.CAPABILITY, profile.CAPABILITY, checkpoint.CAPABILITY},
            {"stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_quality24_v1"})
        self.assertEqual(auth.PROFILE, "bounded_ecology_terrain_detail_weight_quality24_v1")
        self.assertEqual(auth.ROOT_PREFIX, ".runtime/ai-painter/ecology-terrain-detail-weight-quality-executions/")
        for schema in (auth.PLAN_SCHEMA, worker.CPU_SCHEMA, worker.GPU_SCHEMA, worker.TERMINAL_SCHEMA, checkpoint.SCHEMA):
            self.assertTrue(schema.startswith("ecology-terrain-detail-weight-quality-"))

    def test_only_current_spec_and_no_old_clause_requirement(self):
        self.assertEqual(auth.SPECIFICATION, {"path": checkpoint.SPEC_PATH, "sha256": checkpoint.SPEC_SHA})
        self.assertEqual(hashlib.sha256((ROOT / checkpoint.SPEC_PATH).read_bytes()).hexdigest(), checkpoint.SPEC_SHA)
        source = inspect.getsource(checkpoint.derive_configuration)
        self.assertIn("AI-PAINTER-SPEC-1.69", source); self.assertIn('b"17.1"', source)
        self.assertNotIn("9.6.42", source)

    def test_old_plan_and_resource_override_refused_before_reader_use(self):
        plan = {"schema": auth.PLAN_SCHEMA, "executionProfile": auth.PROFILE,
            "executionMode": "bounded-quality-training", "capabilityVersion": auth.CAPABILITY,
            "runId": "synthetic-current-run", "packageId": "synthetic-current-package",
            "outputRoot": auth.ROOT_PREFIX + "synthetic-current-run",
            "historicalCheckpointMayInitialize": False, "trainingRestartAllowed": False}
        for edit in ({"schema": "ecology-decode1-weight-quality-plan-v1"}, {"capabilityVersion": "old"},
            {"resourcePolicy": {}}, {"effectiveExecutionCeiling": {}}, {"resourceSuccessor": {}},
            {"trainingRestartAllowed": True}, {"historicalCheckpointMayInitialize": True}):
            with self.subTest(edit=edit), self.assertRaises(ValueError): auth.validate_plan(None, {**plan, **edit})

    def test_gpu_gate_rejects_old_identity_and_zero_update_disagreement(self):
        plan = {"outputRoot": auth.ROOT_PREFIX + "synthetic-current-run", "runId": "synthetic-current-run",
            "packageId": "synthetic-current-package", "programBindings": {},
            "trainSplit": {"path": "synthetic/train.json", "sha256": "a" * 64},
            "modelBinding": {"path": "synthetic/model.json", "sha256": "b" * 64}}
        package = {"path": "synthetic/package.json", "sha256": "c" * 64}
        ids = ["train-" + str(i) for i in range(48)]
        initial = {"generator": "g", "discriminator": "d"}
        gate = {"schema": worker.GPU_SCHEMA, "status": "passed", "capabilityVersion": auth.CAPABILITY,
            "executionProfile": auth.PROFILE, "runId": plan["runId"], "packageId": plan["packageId"],
            "executionPackage": package, "programBindings": {}, "actualCounts": {k + suffix: n
                for k, n in (("forward", 48), ("generator", 192), ("discriminator", 48)) for suffix in ("Attempted", "Completed")},
            "deviceIdentity": {"ordinal": 0, "uuid": "GPU-00000000-0000-0000-0000-000000000001"},
            "cases": [{"sampleId": sid, "passed": True, "proof": {"callCounts": {"generatorForwards": 1,
                "generatorAutograd": 4, "discriminatorAutograd": 1}, "optimizerCreated": False, "optimizerUpdates": 0}} for sid in ids],
            "optimizerSteps": 0, "checkpointLoaded": False, "checkpointWritten": False,
            "initialState": initial, "finalState": initial, "initialCpuState": initial}
        binding = {"path": plan["outputRoot"] + "/gpu-gate.json", "sha256": "d" * 64}
        def read(reader, value):
            if value == plan["trainSplit"]: return {"sampleIds": ids}
            if value == plan["modelBinding"]: return {"initialState": initial}
            return gate
        with patch.object(auth, "read_json", side_effect=read):
            self.assertIs(worker.verify_gpu_gate(None, plan, package, binding), gate)
            for key, value in (("optimizerSteps", 1), ("capabilityVersion", "old"), ("capabilityVersion", auth.MODEL_CAPABILITY), ("schema", "old"),
                ("finalState", {"generator": "changed"}), ("checkpointLoaded", True), ("checkpointWritten", True)):
                old = gate[key]; gate[key] = value
                try:
                    with self.assertRaises(ValueError): worker.verify_gpu_gate(None, plan, package, binding)
                finally: gate[key] = old

    def test_resource_and_gpu_qualifier_keep_parent_limits_and_freshness(self):
        self.assertEqual(worker.ResourceGuard({}, {}, gpu_gate=False).seconds, 8400)
        self.assertEqual(worker.ResourceGuard({}, {}, gpu_gate=True).seconds, 600)
        source = inspect.getsource(qualifier.run)
        self.assertIn("profile.fresh_networks(order)", source)
        self.assertEqual(qualifier.Calls.LIMITS, {"forward": 48, "generator": 192, "discriminator": 48})
        calls = qualifier.Calls()
        for _ in range(48):
            calls.begin()
            for kind, limit in (("forward", 1), ("generator", 4), ("discriminator", 1)):
                for _ in range(limit):
                    calls.event("attempt", kind, None); calls.event("complete", kind, None)
        self.assertEqual(calls.counts, {key + suffix: count for key, count in qualifier.Calls.LIMITS.items()
            for suffix in ("Attempted", "Completed")})
        calls.begin()
        with self.assertRaises(ValueError): calls.event("attempt", "forward", None)
        self.assertIn("profile.zero_update_probe", source); self.assertIn('"optimizerSteps": 0', source)
        self.assertIn("set_per_process_memory_fraction(.7)", source)
        self.assertNotIn("resourceSuccessor", source)

    def test_new_manifest_alias_preserves_prior_registered_alias(self):
        original = {"scripts": {"existing": "node unchanged.mjs"}, "name": "synthetic"}
        current = copy.deepcopy(original)
        current["scripts"].update({auth.MANIFEST_ALIAS: auth.MANIFEST_COMMAND,
            "control:ai-painter-ecology-decode1-quality": "node scripts/run-ai-painter-ecology-decode1-quality-v1.mjs"})
        auth._manifest_semantic_transition(json.dumps(original).encode(), json.dumps(current).encode())
        for edit in (lambda value: value["scripts"].update(existing="wrong"),
            lambda value: value["scripts"].update(arbitrary="extra"),
            lambda value: value.update(dependencies={"arbitrary": "extra"}),
            lambda value: value["scripts"].pop(auth.MANIFEST_ALIAS),
            lambda value: value["scripts"].pop("control:ai-painter-ecology-decode1-quality"),
            lambda value: value["scripts"].update({auth.MANIFEST_ALIAS: "wrong"}),
            lambda value: value["scripts"].update({"control:ai-painter-ecology-decode1-quality": "wrong"})):
            bad = copy.deepcopy(current); edit(bad)
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                auth._manifest_semantic_transition(json.dumps(original).encode(), json.dumps(bad).encode())

    def test_current_policy_real_bytes_and_every_config_section(self):
        self.assertEqual(auth.EXECUTION_POLICY, checkpoint.EXECUTION_POLICY)
        raw = (ROOT / auth.EXECUTION_POLICY_PATH).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), auth.EXECUTION_POLICY["sha256"])
        policy = json.loads(raw); configuration = checkpoint.expected_configuration(auth.CANDIDATE)
        self.assertEqual(checkpoint.validate_execution_policy(policy, configuration), policy)
        self.assertEqual(configuration["executionCeiling"]["maxWallSeconds"], 8400)
        self.assertEqual(auth.ROLES["executionPolicy"], auth.EXECUTION_POLICY_PATH)
        old_raw = (ROOT / "data/ai-painter/system-governance/ai-painter-terrain-detail-weight-quality-execution-policy-v1.json").read_bytes()
        self.assertEqual(hashlib.sha256(old_raw).hexdigest(), "0695a6f736236a278b82cb561dbcb1adf3e0830cda989867fbaeb4039dff7e29")
        old = json.loads(old_raw)
        with self.assertRaises(ValueError): checkpoint.validate_execution_policy(old, configuration)
        revised = copy.deepcopy(old)
        revised["schemaVersion"] = "ai-painter-terrain-detail-weight-quality-execution-policy-v3"
        revised["formalSpecification"] = {**auth.SPECIFICATION, "version": "AI-PAINTER-SPEC-1.69"}
        revised["candidate"], revised["executionProfile"] = auth.CAPABILITY, auth.PROFILE
        revised["executionCeiling"].update(epochs=24, generatorOptimizerSteps=1152, discriminatorOptimizerSteps=1152, maxWallSeconds=8400)
        revised["checkpointSelection"].update(eligibleEpochs=[24], observationOnlyEpochs=[12])
        revised["stopRules"][2] = policy["stopRules"][2]
        self.assertTrue(auth.same_json(policy, revised), "policy changed beyond frozen 24-epoch exposure/identity")
        for edit in (lambda value: value["executionCeiling"].update(maxWallSeconds=8401),
            lambda value: value["executionCeiling"].update(maxWallSeconds=2700),
            lambda value: value["executionCeiling"].update(maxWallSeconds=4200.0),
            lambda value: value.update(schemaVersion="ai-painter-terrain-detail-weight-quality-execution-policy-v1"),
            lambda value: value["phaseResources"].update(cpuPreparationSeconds=241),
            lambda value: value["dataUse"].update(train=49),
            lambda value: value["optimizer"].update(eps=1e-7),
            lambda value: value["checkpointSelection"].update(eligibleEpochs=[1, 12]),
            lambda value: value["checkpointSelection"].update(observationOnlyEpochs=[]),
            lambda value: value["executionCeiling"].update(epochs=12, generatorOptimizerSteps=576, discriminatorOptimizerSteps=576),
            lambda value: value.update(candidate=auth.MODEL_CAPABILITY),
            lambda value: value["gpuAdmission"].update(optimizerUpdates=1),
            lambda value: value["modelBoundary"].update(changedTargetIndex=52),
            lambda value: value["qualification"].update(gpuQualified=True),
            lambda value: value["formalSpecification"].update(version="AI-PAINTER-SPEC-1.66"),
            lambda value: value["priorCpuEvidence"].update(oldAttemptReplayAllowed=True),
            lambda value: value.update(resourceSuccessor={})):
            bad = copy.deepcopy(policy); edit(bad)
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                checkpoint.validate_execution_policy(bad, configuration)

    def test_metadata_is_actual_current_factory_target60_not_historical_graph(self):
        from test_ecology_terrain_detail_weight_checkpoint_cpu import ORDER
        rng = torch.get_rng_state().clone()
        with patch.object(auth, "read_json", return_value={"identityPayload": {"channelOrder": ORDER}}), \
            patch.object(torch.nn.Module, "_call_impl", side_effect=AssertionError("no model forward")), \
            patch.object(torch.autograd, "grad", side_effect=AssertionError("no autograd")), \
            patch.object(torch.optim.Optimizer, "__init__", side_effect=AssertionError("no optimizer")):
            actual = auth.derive_model_metadata(None, {"path": "synthetic/manifest.json", "sha256": "a" * 64})
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertEqual(len(actual["graph"]), 108)
        self.assertEqual(sum(row["elements"] for row in actual["graph"]), 2242687)
        self.assertEqual(actual["graph"][60], {"name": model_type.TARGET + ".weight",
            "shape": [48, 48, 3, 3], "elements": 20736, "dtype": "torch.float32"})
        self.assertEqual(actual["modelCapabilityVersion"], auth.MODEL_CAPABILITY)
        self.assertEqual(actual["numericRule"], model_type.NUMERIC_RULE)

    def test_observation_exact_current_call_and_no_cleanup_authority(self):
        base = "synthetic/current/cpu-negative-inputs"
        declaration = {"schema": "cpu-negative-input-declaration-v1", "callIdentity": "synthetic-current-call",
            "request": {"path": "synthetic/current/cpu-request.json", "sha256": "a" * 64},
            "layout": _negative_observation_layout(base)}
        created = datetime.now(timezone.utc).timestamp() - .1
        observation = {"schema": "cpu-negative-input-live-observation-v1", "callIdentity": declaration["callIdentity"],
            "request": declaration["request"], "link": {**declaration["layout"]["links"][0], "present": True,
                "observedIdentity": "123:456"}, "observedAtUtc": datetime.now(timezone.utc).isoformat()}
        _validate_negative_observation(observation, declaration, "reader", base, "123:456", created)
        for edit in (lambda value: value.update(callIdentity="old"),
            lambda value: value["request"].update(sha256="b" * 64),
            lambda value: value["link"].update(observedIdentity="123:457"),
            lambda value: value["link"].update(present=1),
            lambda value: value.update(cleanupConfirmed=True),
            lambda value: value.update(observedAtUtc="2020-01-01T00:00:00+00:00")):
            bad = copy.deepcopy(observation); edit(bad)
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                _validate_negative_observation(bad, declaration, "reader", base, "123:456", created)

    def test_unknown_fixture_creation_is_never_removed(self):
        with patch.object(sys.modules[__name__], "_TEST_JUNCTION_REMOVE") as remove:
            self.assertFalse(_remove_created_test_junction(None, None, None, None))
            remove.assert_not_called()

    def test_missing_observation_deadline_is_bounded_without_real_wait(self):
        from types import SimpleNamespace
        missing = SimpleNamespace(lstat=lambda: (_ for _ in ()).throw(FileNotFoundError()))
        reader = SimpleNamespace(path=lambda path: missing)
        with patch.object(sys.modules[__name__], "_CPU_OBSERVATION_CLOCK", side_effect=[0, 10]), \
            patch.object(sys.modules[__name__], "_CPU_OBSERVATION_PAUSE") as pause:
            with self.assertRaises(ValueError): _wait_negative_observation(reader, "synthetic/ack.json", 10)
        pause.assert_called_once_with(.025)

    def test_cpu_harness_keeps_node_entry_abi_without_reinitializing_threads(self):
        source = inspect.getsource(cpu_request)
        self.assertIn('torch.get_num_interop_threads() != 2', source)
        self.assertIn('"/cpu-report.json"', source)
        self.assertIn('"dataClosure": closure_binding', source)
        self.assertIn('run_node_entry_regression(reader, request, started)', source)
        node_source = inspect.getsource(run_node_entry_regression)
        self.assertIn('"T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT": request["outputRoot"]', node_source)
        self.assertIn('request["programBindings"]["entryTests"]', node_source)
        self.assertIn('"--test", "--test-reporter=tap"', node_source)
        self.assertIn('"/stream-failure-fixtures"', node_source)
        self.assertNotIn('node-stream-fixtures', node_source)
        self.assertNotIn('stream_root.mkdir()', node_source)

    def test_passed_items_are_recorded_by_actual_unittest_success_events(self):
        class ActualFixture(unittest.TestCase):
            def runTest(self): self.assertEqual(2 + 3, 5)
        result = unittest.TextTestRunner(stream=io.StringIO(), resultclass=_CpuResult).run(unittest.TestSuite([ActualFixture()]))
        self.assertEqual(result.testsRun, 1)
        self.assertEqual(result.passed_items, [{"status": "passed", "testId": ActualFixture().id()}])

    def test_validation_loader_receipt_rejects_missing_forged_or_old_fields(self):
        from types import SimpleNamespace
        root = auth.ROOT_PREFIX + "synthetic-validation-run"
        bindings = [{"path": "synthetic/visual-" + str(i) + ".json", "sha256": hashlib.sha256(b"{}").hexdigest()} for i in range(8)]
        rows = [{"split": "validation", "ordinal": i, "sampleId": "v" + str(i), "identity": {
            "visualFactManifestFile": binding, "image": {"path": "synthetic/image-" + str(i) + ".png", "sha256": "a" * 64}}}
            for i, binding in enumerate(bindings)]
        closure = {"bindings": bindings, "splitSampleIds": {"validation": [row["sampleId"] for row in rows]}}
        plan = {"outputRoot": root, "dataClosure": {"path": root + "/data-closure.json", "sha256": "b" * 64}}
        binding = {"path": root + "/cpu-entry/validation-loader-regression.json", "sha256": "c" * 64}
        proof = {"schema": "quality-validation-loader-regression-v1", "status": "actual8_validation_loaded_cpu",
            "sampleIds": closure["splitSampleIds"]["validation"], "originalRgb": [row["identity"]["image"] for row in rows],
            "closureBindings": 8, "sourceReader": "actual_recomputed_Reader", "validationRgbReadByLoaderTest": True,
            "visualManifests": [{**value, "bytes": 2} for value in bindings],
            **{key: False for key in ("validationRgbReadByClosure", "validationRgbInSnapshotClosure", "trainRgbReadByLoaderTest",
                "challengeContentRead", "regressionContentRead", "weightOptimization", "checkpointSelection", "gpuQualification", "qualified")}}
        reader = SimpleNamespace(read=lambda value, maximum: b"{}")
        def read_json(_, value):
            if value == binding: return proof
            if value == plan["dataClosure"]: return closure
            return {"rows": rows}
        with patch.object(auth, "read_json", side_effect=read_json):
            self.assertIs(worker.verify_validation_loader_regression(reader, binding, plan), proof)
            for key, value in (("qualified", True), ("visualManifests", []), ("sampleIds", list(reversed(proof["sampleIds"]))),
                ("originalRgb", []), ("validationRgbReadByLoaderTest", False)):
                original = proof[key]; proof[key] = value
                try:
                    with self.assertRaises(ValueError): worker.verify_validation_loader_regression(reader, binding, plan)
                finally: proof[key] = original
            with self.assertRaises(ValueError): worker.verify_validation_loader_regression(reader, None, plan)


def run_owned_negative_inputs(reader, request, request_binding):
    """Only this new call's three declared private junctions; never old arenas."""
    auth.require(os.name == "nt" and request["outputRoot"] == auth.ROOT_PREFIX + request["runId"] + "/cpu-entry",
        "current Windows CPU fixture scope required")
    base = auth.ROOT_PREFIX + request["runId"] + "/cpu-negative-inputs"
    declaration, _ = _read_negative_observation_json(reader, base + "/input-declaration.json")
    auth.require(declaration.get("schema") == "cpu-negative-input-declaration-v1"
        and declaration.get("request") == request_binding and declaration.get("layout") == _negative_observation_layout(base)
        and declaration.get("programBindings") == request["programBindings"], "current parent fixture declaration required")
    private_root = reader.path(base).resolve(strict=True)
    observations = []
    for slot in declaration["layout"]["links"]:
        name = slot["name"]
        link, target = reader.path(slot["path"]), reader.path(slot["target"])
        auth.require(not link.exists() and not link.is_symlink() and target.is_dir()
            and link.parent.is_relative_to(private_root) and target.is_relative_to(private_root), "fresh private fixture paths required")
        raw = b"{}"
        if name == "program":
            raw, _ = reader.snapshot(auth.CANONICAL_REGION_PROGRAM)
        filename = "real-earth-region-governance.mjs" if name == "program" else "source.json"
        worker.write(ROOT, slot["target"] + "/" + filename, raw)
        if name == "program":
            # Map this private fixture project to this call's private data only.
            original_plan = reader.read(auth.FROZEN_PLAN, auth.CONTROL_JSON_MAX)
            worker.write(ROOT, base + "/program-data/hot/runtime/" + auth.FROZEN_PLAN["path"].removeprefix(".runtime/"), original_plan)
        quote = lambda value: "'" + str(value).replace("'", "''") + "'"
        command = "New-Item -ItemType Junction -Path " + quote(link) + " -Target " + quote(target) + " -ErrorAction Stop | Out-Null"
        record, primary = None, None
        try:
            result = subprocess.run(["C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe", "-NoProfile",
                "-NonInteractive", "-Command", command], capture_output=True, text=True, timeout=10,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            record = _record_created_test_junction(link, target, private_root, result)
            observed = _observe_negative_link(name, base, record)
            if name == "program":
                private_data, private_project = reader.path(base + "/program-data"), reader.path(base + "/program-project")
                with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(private_data)}):
                    isolated = auth.Reader(private_project)
                    try: isolated.snapshot(auth.CANONICAL_REGION_PROGRAM)
                    except ValueError as error: auth.require("redirection" in str(error), "wrong program rejection")
                    else: raise AssertionError("program junction was accepted")
            else:
                logical = slot["path"] + "/" + filename
                actions = [lambda: reader.read({"path": logical, "sha256": hashlib.sha256(raw).hexdigest()})]
                if name == "snapshot": actions.append(lambda: reader.snapshot(logical))
                for action in actions:
                    try: action()
                    except ValueError as error: auth.require("redirection" in str(error), "wrong reader/snapshot rejection")
                    else: raise AssertionError("descendant junction was accepted")
            observations.append({"name": name, "observation": observed, "redirectRejected": True})
        except BaseException as error:
            primary = error
            raise
        finally:
            try:
                _remove_created_test_junction(link, target, private_root, record)
                auth.require((target / filename).read_bytes() == raw, "fixture target bytes changed")
            except BaseException as cleanup_error:
                if primary is None: raise
                primary.secondary_fixture_cleanup_error = str(cleanup_error)[:2048]
    return observations


def run_node_entry_regression(reader, request, started):
    """Same owned CPU namespace enables the retained three real SQLite cases."""
    stream_root = reader.path(request["outputRoot"] + "/stream-failure-fixtures")
    auth.require(os.environ.get("AI_PAINTER_STREAM_REPAIR_COMPONENT_ROOT") == str(stream_root)
        and stream_root.is_dir() and not stream_root.is_symlink(), "retained native stream fixture root required")
    entry = request["programBindings"]["entryTests"]
    auth.require(entry["path"] == auth.ROLES["entryTests"], "exact current Node entry test required")
    reader.read(entry, auth.PROGRAM_MAX)
    remaining = 240 - (time.monotonic() - started)
    auth.require(remaining > 0, "CPU Node regression has no remaining deadline")
    environment = {**os.environ, "CUDA_VISIBLE_DEVICES": "",
        "T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT": request["outputRoot"]}
    node = subprocess.run([request["runtimeIdentity"]["node"]["absolutePath"], "--test", "--test-reporter=tap",
        str(ROOT / entry["path"])], cwd=ROOT, env=environment, capture_output=True, text=True, timeout=remaining,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    worker.write(ROOT, request["outputRoot"] + "/node-stdout.txt", node.stdout.encode())
    worker.write(ROOT, request["outputRoot"] + "/node-stderr.txt", node.stderr.encode())
    auth.require(node.returncode == 0, "actual current Node entry regression failed")
    for name in ("dispatch", "finalization", "failure"):
        logical = request["outputRoot"] + "/r/" + name + "/fixture-proof.json"
        value, binding = _read_negative_observation_json(reader, logical)
        auth.require(value.get("fixtureKind") == "actual-isolated-registry-IO-and-SHA-not-production"
            and value.get("publicRegistryCodeMocked") is False and value.get("readerMocked") is False
            and value.get("nativeCalls") == 0 and value.get("gpuCalls") == 0
            and value.get("productionRegistryWrites") == 0, "actual private registry regression missing")
        reader.read(binding, auth.CONTROL_JSON_MAX)
    return node.returncode


class _CpuResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.passed_items = []

    def addSuccess(self, test):
        super().addSuccess(test)
        self.passed_items.append({"status": "passed", "testId": test.id()})


def validation_loader_regression(reader, request, closure_binding, closure):
    """Real eight original validation loads; no forward/grad/optimizer or selection."""
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
    candidate = auth.read_json(reader, auth.CANDIDATE)
    plan = {**request, "outputRoot": auth.ROOT_PREFIX + request["runId"], "dataClosure": closure_binding,
        "trainSplit": candidate["frozenBindings"]["trainSplit"], "validationSplit": candidate["frozenBindings"]["validationSplit"]}
    auth.require(auth.same_json(auth.verify_data_closure(reader, plan), closure), "actual current closure differs")
    rows = sorted((row for row in auth.read_json(reader, DIAGNOSTIC)["rows"] if row["split"] == "validation"),
        key=lambda row: row["ordinal"])
    expected = {row["identity"]["visualFactManifestFile"]["path"]: row["identity"]["visualFactManifestFile"] for row in rows}
    auth.require(len(rows) == len(expected) == 8 and [row["sampleId"] for row in rows] == closure["splitSampleIds"]["validation"],
        "original validation loader order differs")
    seen = {}
    actual_reader = auth.Reader(ROOT)

    class LoaderReader:
        def __init__(self): self.root = actual_reader.root
        def read(self, binding, maximum=auth.SOURCE_JSON_MAX): return actual_reader.read(binding, maximum)
        def json(self, binding): return actual_reader.json(binding)
        def unchanged(self): actual_reader.unchanged()
        def snapshot(self, logical):
            raw, binding = reader.snapshot(logical)
            auth.require(actual_reader.read(binding, auth.PROGRAM_MAX if logical == auth.CANONICAL_REGION_PROGRAM
                else auth.SOURCE_JSON_MAX) == raw, "actual loader snapshot bytes changed")
            if logical in expected:
                auth.require(auth.same_json(binding, expected[logical]), "actual validation visual binding differs")
                seen[logical] = {**binding, "bytes": len(raw)}
            return raw, binding

    loaded, order = worker.load_samples(LoaderReader(), plan, splits=("validation",))
    samples = loaded["validation"]
    auth.require(set(loaded) == {"validation"} and len(order) == 23 and set(seen) == set(expected)
        and [sample["sampleId"] for sample in samples] == closure["splitSampleIds"]["validation"], "actual eight validation loads required")
    for sample, row in zip(samples, rows):
        auth.require(sample["split"] == "validation", "actual validation sample split differs")
        for key, shape in (("conditions", [23, 192, 256]), ("image", [3, 192, 256]), ("appearance_regime", [4]), ("ecology_regime", [7])):
            value = sample[key]
            auth.require(list(value.shape) == shape and value.device.type == "cpu" and not value.requires_grad,
                "actual validation tensor shape/device differs")
        image = row["identity"]["image"]
        auth.require(actual_reader.observed.get(image["path"]) == image["sha256"]
            and image["path"] not in reader._source_snapshot_bindings, "actual validation RGB read/closure differs")
    train_rows = (row for row in auth.read_json(reader, DIAGNOSTIC)["rows"] if row["split"] == "train")
    auth.require(all(row["identity"]["image"]["path"] not in actual_reader.observed for row in train_rows),
        "validation loader must not read train RGB")
    actual_reader.unchanged()
    proof = {"schema": "quality-validation-loader-regression-v1", "status": "actual8_validation_loaded_cpu",
        "sampleIds": [sample["sampleId"] for sample in samples],
        "visualManifests": [seen[row["identity"]["visualFactManifestFile"]["path"]] for row in rows],
        "originalRgb": [row["identity"]["image"] for row in rows], "closureBindings": len(closure["bindings"]),
        "validationRgbReadByLoaderTest": True, "validationRgbReadByClosure": closure["validationRgbRead"],
        "validationRgbInSnapshotClosure": False, "trainRgbReadByLoaderTest": False,
        "challengeContentRead": False, "regressionContentRead": False, "weightOptimization": False,
        "checkpointSelection": False, "gpuQualification": False, "sourceReader": "actual_recomputed_Reader", "qualified": False}
    return worker.write(ROOT, request["outputRoot"] + "/validation-loader-regression.json", proof)


def cpu_request(binding):
    """Fresh current-package metadata plus bounded regression, never old CPU replay."""
    started = time.monotonic()
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2:
        torch.set_num_interop_threads(2)
    import psutil
    process = psutil.Process(); process.cpu_affinity(process.cpu_affinity()[:2])
    reader = auth.Reader(ROOT)
    request = auth.read_json(reader, binding)
    auth.require(request.get("schema") == "ecology-terrain-detail-weight-quality-cpu-request-v1"
        and request.get("modelCapabilityVersion") == auth.MODEL_CAPABILITY
        and request.get("outputRoot") == auth.ROOT_PREFIX + request["runId"] + "/cpu-entry", "own new CPU request required")
    for key in ("runId", "packageId"):
        auth.require(type(request.get(key)) is str and auth.re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", request[key]), "CPU Run/package ID invalid")
    auth.require(request["runId"] != request["packageId"] and binding["path"] == auth.ROOT_PREFIX + request["runId"] + "/cpu-request.json",
        "same Run CPU request required")
    auth.verify_programs(reader, request["programBindings"])
    auth.require(auth.same_json(request["configuration"], auth.configuration(reader))
        and auth.same_json(request["runtimeIdentity"], auth.runtime_identity(ROOT)), "current CPU inputs/runtime differ")
    worker.write(ROOT, request["outputRoot"] + "/consumed.json", {"request": binding, "attempt": 1, "retries": 0})
    candidate = auth.read_json(reader, auth.CANDIDATE)
    auth.require("modelBinding" not in request and request.get("formalSpecification") == auth.SPECIFICATION
        and request.get("datasetManifest") == candidate["frozenBindings"]["datasetManifest"], "current model bootstrap/dataset required")
    calls = {key: 0 for key in ("moduleForwardCalls", "autogradCalls", "optimizerConstructionAttempts", "optimizerUpdates", "cudaInitializationAttempts")}
    def forbidden(key):
        def fail(*args, **kwargs):
            calls[key] += 1
            raise AssertionError("CPU protocol prohibited " + key)
        return fail
    output = io.StringIO()
    with ExitStack() as scope:
        for obj, name, key in ((torch.nn.Module, "_call_impl", "moduleForwardCalls"), (torch.autograd, "grad", "autogradCalls"),
            (torch.autograd, "backward", "autogradCalls"), (torch.optim.Optimizer, "__init__", "optimizerConstructionAttempts"),
            (torch.optim.Optimizer, "step", "optimizerUpdates"), (torch.cuda, "_lazy_init", "cudaInitializationAttempts"),
            (torch.cuda, "init", "cudaInitializationAttempts")):
            scope.enter_context(patch.object(obj, name, forbidden(key)))
        scope.enter_context(patch.dict(os.environ, {"TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT": request["outputRoot"]}))
        actual = auth.derive_model_metadata(reader, candidate["frozenBindings"]["datasetManifest"])
        auth.require(request["modelIdentityOutput"] == auth.ROOT_PREFIX + request["runId"] + "/model-identity.json", "same Run model output required")
        model_binding = worker.write(ROOT, request["modelIdentityOutput"], actual)
        closure = auth.derive_data_closure(ROOT)
        closure_binding = worker.write(ROOT, auth.ROOT_PREFIX + request["runId"] + "/data-closure.json", closure)
        negative_inputs = run_owned_negative_inputs(reader, request, binding)
        validation_binding = validation_loader_regression(reader, request, closure_binding, closure)
        suite = unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(name) for name in (
            "test_ecology_terrain_detail_weight_checkpoint_cpu", "test_ecology_terrain_detail_weight_quality_lifecycle_cpu",
            "test_ecology_terrain_detail_weight_quality_review_cpu", "test_ecology_terrain_detail_weight_quality_execution_cpu"))
        result = unittest.TextTestRunner(stream=output, verbosity=2, resultclass=_CpuResult).run(suite)
        node_exit_code = run_node_entry_regression(reader, request, started)
    worker.write(ROOT, request["outputRoot"] + "/python-output.txt", output.getvalue().encode())
    auth.require(time.monotonic() - started < 240 and result.wasSuccessful() and not result.skipped
        and not any(calls.values()) and not torch.cuda.is_initialized(), "current CPU regression failed")
    reader.unchanged()
    report = {"schema": worker.CPU_SCHEMA, "status": "passed", "passed": result.testsRun, "failed": 0,
        "errors": 0, "skipped": 0, "synthetic": True, "gpuInitialized": False, "actualCalls": calls,
        "request": binding, "programBindings": request["programBindings"], "configuration": request["configuration"],
        "runtimeIdentity": request["runtimeIdentity"], "modelBinding": model_binding, "initialModel": actual,
        "dataClosure": closure_binding, "negativeInputs": negative_inputs, "validationLoaderRegression": validation_binding,
        "items": result.passed_items,
        "nativeCleanupClaimed": False, "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False,
        "nodeExitCode": node_exit_code, "newGpuOrTrainingExecuted": False, "elapsedSeconds": time.monotonic() - started}
    worker.verify_cpu_report(report, request, {**request, "outputRoot": auth.ROOT_PREFIX + request["runId"], "modelBinding": model_binding})
    return worker.write(ROOT, request["outputRoot"] + "/cpu-report.json", report)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cpu-request"); parser.add_argument("--sha256")
    args = parser.parse_args()
    if args.cpu_request:
        print(json.dumps(cpu_request({"path": args.cpu_request, "sha256": args.sha256})))
    else:
        torch.set_num_threads(2); torch.set_num_interop_threads(2)
        import psutil
        process = psutil.Process(); process.cpu_affinity(process.cpu_affinity()[:2])
        unittest.main(argv=[sys.argv[0]])
