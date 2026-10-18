"""Current-route CPU protocol regression; no real sample/model execution or admission."""
import argparse
import ast
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
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).absolute().parents[3]
sys.dont_write_bytecode = True
os.environ["CUDA_VISIBLE_DEVICES"] = ""
for part in ("ml/ai-painter/scripts", "ml/ai-painter/src", "ml/ai-painter/tests"):
    sys.path.insert(0, str(ROOT / part))
import torch
import object_support_structure_quality_auth_v1 as auth
import painter_stage4_object_support_structure_quality_worker_v1 as worker
import painter_stage4_object_support_structure_training_profile_v1 as profile
import qualify_stage4_object_support_structure_quality_gpu_v1 as qualifier
from ai_painter.complete_world import object_support_structure_checkpoint_v1 as checkpoint
from ai_painter.complete_world import object_ecology_terrain_detail_weight_precision_v1 as model_type
from ai_painter.complete_world import object_support_structure_failure_capture_v1 as capture


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


def _request_route(request):
    capability=request.get("configuration",{}).get("capabilityVersion",request.get("capabilityVersion",auth.CAPABILITY))
    route=auth.execution_route(capability)
    auth.require(request.get("capabilityVersion",route.capability)==route.capability,"CPU route identity conflict")
    return route


def _request_plan(request, **bindings):
    route=_request_route(request)
    return {**request, **bindings, "capabilityVersion":route.capability,
        "outputRoot":route.root_prefix + request["runId"]}


def _owned_prefix_ok(owned):
    return type(owned) is str and any(owned.startswith(auth.execution_route(cap).root_prefix)
        for cap in (auth.CAPABILITY,auth.FINAL_RGB_CAPABILITY,auth.JOINT_CAPABILITY))


def _fixture_dual_identity(reader, base, path, expected=None):
    """Verify both complete identities from the same actual, scoped Windows object."""
    owned = os.environ.get("TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT")
    auth.require(owned is not None, "current owned CPU identity required")
    auth.require(_owned_prefix_ok(owned) and owned.endswith("/cpu-entry") and
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
    auth.require(_owned_prefix_ok(owned) and owned.endswith("/cpu-entry") and
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
    auth.require(request.get("schema") == "object-support-structure-quality-cpu-request-v1" and
        request.get("outputRoot") == owned and declaration.get("runId") == request.get("runId") and
        declaration.get("packageId") == request.get("packageId"), "current owned request identity differs")
    auth.require(request.get("formalSpecification") == _request_route(request).specification and
        declaration.get("programBindings") == request.get("programBindings"), "current CPU observation source declaration differs")
    auth.verify_programs(reader, request["programBindings"],capability_version=_request_route(request).capability)
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


class PlainLexicalCacheCpuTests(unittest.TestCase):
    """Lexical reuse never caches a filesystem observation or an admission."""
    fixture_root = None

    @classmethod
    def setUpClass(cls):
        import tempfile
        cls.fixture_root = Path(tempfile.mkdtemp(prefix="ai-painter-file-cost-06-"))
        cls.project = cls.fixture_root / "project"
        cls.data = cls.fixture_root / "data"
        cls.project.mkdir()
        (cls.data / "hot/runtime").mkdir(parents=True)

    def setUp(self):
        capture._plain_ancestors.cache_clear()
        self.addCleanup(capture._plain_ancestors.cache_clear)

    @staticmethod
    def old_plain(path):
        for item in (path, *path.parents):
            try:
                info = item.lstat()
            except FileNotFoundError:
                continue
            capture.require(not auth.stat.S_ISLNK(info.st_mode) and
                not (getattr(info, "st_file_attributes", 0) & 0x400), "physical path redirection")

    def trace(self, path, operation, *, fail_at=None, error=None, mode=None, attributes=0):
        calls = []
        def observe(item):
            calls.append(str(item))
            if fail_at is not None and str(item) == str(fail_at):
                if error is not None:
                    raise error
                return SimpleNamespace(st_mode=mode, st_file_attributes=attributes)
            return SimpleNamespace(st_mode=auth.stat.S_IFDIR, st_file_attributes=0)
        caught = None
        with patch.object(Path, "lstat", new=observe):
            try:
                operation(path)
            except BaseException as exception:
                caught = exception
        return calls, caught

    def test_cold_hot_and_evicted_order_match_original(self):
        path = self.project / "nested/leaf"
        expected = self.trace(path, self.old_plain)
        self.assertEqual(self.trace(path, capture._plain), expected)
        self.assertEqual(self.trace(path, capture._plain), expected)
        self.assertEqual(capture._plain_ancestors.cache_info().hits, 1)
        for number in range(2049):
            other = self.project / str(number)
            self.assertEqual(self.trace(other, capture._plain), self.trace(other, self.old_plain))
        self.assertEqual(capture._plain_ancestors.cache_info().currsize, 2048)
        self.assertEqual(self.trace(path, capture._plain), expected)

    def test_exact_case_spelling_uses_distinct_keys(self):
        for name in ("MixedCase/Leaf", "mixedcase/leaf"):
            path = self.project / name
            self.assertEqual(self.trace(path, capture._plain), self.trace(path, self.old_plain))
        self.assertEqual(capture._plain_ancestors.cache_info().misses, 2)
        self.assertEqual(capture._plain_ancestors.cache_info().hits, 0)

    def test_builtin_leaf_is_the_actual_call_object(self):
        first, second = Path(str(self.project)), Path(str(self.project))
        self.assertIsNot(first, second)
        captured = []
        def observe(item):
            captured.append(item)
            return SimpleNamespace(st_mode=auth.stat.S_IFDIR, st_file_attributes=0)
        with patch.object(Path, "lstat", new=observe):
            capture._plain(first)
            start = len(captured)
            capture._plain(second)
        self.assertIs(captured[0], first)
        self.assertIs(captured[start], second)

    def test_nonstandard_path_preserves_fresh_parents_fallback(self):
        parents_calls = []
        class Variant(type(Path())):
            @property
            def parents(self):
                parents_calls.append(str(self))
                return super().parents
        path = Variant(str(self.project / "leaf"))
        self.trace(path, capture._plain)
        self.trace(path, capture._plain)
        self.assertEqual(parents_calls, [str(path)] * 2)
        self.assertEqual(capture._plain_ancestors.cache_info().currsize, 0)

    def test_cached_leaf_and_ancestor_redirects_are_still_rejected(self):
        path = self.project / "nested/leaf"
        self.assertIsNone(self.trace(path, capture._plain)[1])
        for target in (path, path.parent):
            for mode, attributes in ((auth.stat.S_IFLNK, 0), (auth.stat.S_IFDIR, 0x400)):
                with self.subTest(target=str(target), mode=mode, attributes=attributes):
                    kwargs = dict(fail_at=target, mode=mode, attributes=attributes)
                    old_calls, old_error = self.trace(path, self.old_plain, **kwargs)
                    new_calls, new_error = self.trace(path, capture._plain, **kwargs)
                    self.assertEqual(new_calls, old_calls)
                    self.assertEqual(type(new_error), type(old_error))
                    self.assertEqual(str(new_error), str(old_error))

    def test_missing_is_not_cached_and_other_errors_keep_original_identity(self):
        path = self.project / "missing/leaf"
        missing = FileNotFoundError(2, "explicit synthetic missing")
        self.assertIsNone(self.trace(path, capture._plain, fail_at=path, error=missing)[1])
        for error in (PermissionError(13, "explicit synthetic denied"),
                      OSError(5, "explicit synthetic IO"), NotADirectoryError(20, "explicit synthetic parent")):
            for target in (path, path.parent):
                with self.subTest(error=type(error).__name__, target=str(target)):
                    old_calls, _ = self.trace(path, self.old_plain, fail_at=target, error=error)
                    new_calls, new_error = self.trace(path, capture._plain, fail_at=target, error=error)
                    self.assertEqual(new_calls, old_calls)
                    self.assertIs(new_error, error)

    def test_lexical_windows_and_posix_ancestor_sequences_do_not_resolve(self):
        from pathlib import PurePosixPath, PureWindowsPath
        cases = ((PurePosixPath, ("/", "//host/root/leaf", "../a/../leaf", "relative/leaf")),
                 (PureWindowsPath, ("C:/", "C:relative/leaf", "../a/../leaf",
                                    "//server/share/a/leaf", "//?/C:/a/leaf")))
        with patch.object(Path, "resolve", side_effect=AssertionError("no lexical resolution")):
            for kind, spellings in cases:
                for spelling in spellings:
                    path = kind(spelling)
                    self.assertEqual(capture._plain_ancestors(kind, str(path)), tuple(path.parents))

    def test_relative_paths_follow_current_cwd_after_cache_hit(self):
        first, second = self.fixture_root / "cwd-first", self.fixture_root / "cwd-second"
        for root in (first, second):
            (root / "nested").mkdir(parents=True)
            (root / "nested/leaf").write_bytes(b"plain")
        previous = Path.cwd()
        relative = Path("nested/leaf")
        observed = []
        original = Path.lstat
        def observe(path):
            observed.append((str(path), Path.cwd(), original(path).st_ino))
            return original(path)
        try:
            with patch.object(Path, "lstat", new=observe):
                os.chdir(first); capture._plain(relative)
                os.chdir(second); capture._plain(relative)
        finally:
            os.chdir(previous)
        leaves = [row for row in observed if row[0] == str(relative)]
        self.assertEqual([row[1] for row in leaves], [first, second])
        self.assertNotEqual(leaves[0][2], leaves[1][2])
        self.assertGreater(capture._plain_ancestors.cache_info().hits, 0)

    def test_real_reader_keeps_same_size_digest_and_observed_binding_checks(self):
        path = self.project / "same-size.bin"
        path.write_bytes(b"old!")
        bound = {"path": path.name, "sha256": capture.digest(b"old!")}
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.data)}):
            reader = auth.Reader(self.project)
            self.assertEqual(reader.read(bound), b"old!")
            path.write_bytes(b"new!")
            with self.assertRaisesRegex(ValueError, "binding SHA differs"):
                reader.read(bound)
            with self.assertRaisesRegex(ValueError, "observed source changed"):
                reader.read({"path": path.name, "sha256": capture.digest(b"new!")})

    def test_real_mapping_change_and_file_replacement_are_not_hidden(self):
        path = self.project / "replace.bin"
        path.write_bytes(b"same")
        bound = {"path": path.name, "sha256": capture.digest(b"same")}
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.data)}):
            reader = auth.Reader(self.project)
            self.assertEqual(reader.read(bound), b"same")
            with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.fixture_root / "other")}):
                with self.assertRaisesRegex(ValueError, "storage configuration changed"):
                    reader.read(bound)
            original = capture.RuntimeMap.binding
            replacement = self.project / "replacement.bin"
            replacement.write_bytes(b"same")
            def replace(mapping, binding, *, maximum=capture.MAX_JSON):
                replacement.replace(path)
                return original(mapping, binding, maximum=maximum)
            with patch.object(capture.RuntimeMap, "binding", new=replace), \
                    self.assertRaisesRegex(ValueError, "file changed across bounded read"):
                reader.read(bound)

    def test_full_reader_positive_lstat_trace_matches_original(self):
        path = self.project / "trace.bin"
        path.write_bytes(b"bounded fresh bytes")
        bound = {"path": path.name, "sha256": capture.digest(path.read_bytes())}
        original = Path.lstat
        traces = []
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.data)}):
            for operation in (self.old_plain, capture._plain):
                reader = auth.Reader(self.project)
                calls = []
                def observe(item):
                    calls.append(str(item))
                    return original(item)
                with patch.object(capture, "_plain", new=operation), patch.object(Path, "lstat", new=observe):
                    self.assertEqual(reader.read(bound), b"bounded fresh bytes")
                    reader.unchanged()
                traces.append(calls)
        self.assertEqual(traces[0], traces[1])


class ProcessIdentityCpuTests(unittest.TestCase):
    """Local API failures are mocked; explicit self/owned-child comparisons are real."""
    real_comparisons = []

    def setUp(self):
        self.scope=ExitStack();self.addCleanup(self.scope.close)
        for owner,name in ((torch.nn.Module,"__init__"),(torch.nn.Module,"_call_impl"),
                (torch.autograd,"grad"),(torch.autograd,"backward"),(torch.optim.Optimizer,"__init__"),
                (torch.cuda,"_lazy_init")):
            self.scope.enter_context(patch.object(owner,name,side_effect=AssertionError("process tests prohibit model/numerical operations")))

    class Kernel:
        def __init__(self,pid=123,ticks=116444736000000019,waits=(),open_error=0,id_error=0,times_error=0,close_error=0):
            self.pid,self.ticks=pid,ticks;self.waits=list(waits);self.calls=[]
            self.open_error,self.id_error,self.times_error,self.close_error=open_error,id_error,times_error,close_error
        def OpenProcess(self,access,inherit,pid):
            self.calls.append(("open",access,inherit,pid));ctypes.set_last_error(self.open_error)
            return None if self.open_error else 321
        def WaitForSingleObject(self,handle,milliseconds):
            self.calls.append(("wait",handle,milliseconds));ctypes.set_last_error(6)
            return self.waits.pop(0) if self.waits else 0x102
        def GetProcessId(self,handle):
            self.calls.append(("pid",handle));ctypes.set_last_error(self.id_error)
            return 0 if self.id_error else self.pid
        def GetProcessTimes(self,handle,created,*remaining):
            self.calls.append(("times",handle));ctypes.set_last_error(self.times_error)
            created._obj.dwLowDateTime=self.ticks & 0xffffffff
            created._obj.dwHighDateTime=self.ticks >> 32
            return not self.times_error
        def CloseHandle(self,handle):
            self.calls.append(("close",handle));ctypes.set_last_error(self.close_error)
            return not self.close_error
        def GetExitCodeProcess(self,*args):raise AssertionError("259 is not a liveness test")

    def api(self,kernel):
        return patch.object(auth,"_process_identity_api",return_value=(kernel,ctypes,wintypes))

    def test_invalid_and_truncated_pids_are_rejected_before_api(self):
        class PidSubclass(int):pass
        with patch.object(auth,"_process_identity_api",side_effect=AssertionError("no API for invalid PID")):
            for value in (None,False,True,0,-1,1.,"1",2**32,2**80,PidSubclass(1)):
                with self.subTest(pid=repr(value)),self.assertRaisesRegex(ValueError,"DWORD PID"):auth.process_identity(value)

    def test_success_uses_minimal_access_two_live_checks_and_closes_once(self):
        kernel=self.Kernel()
        with self.api(kernel):self.assertEqual(auth.process_identity(123),"123:1970-01-01T00:00:00.0000010Z")
        self.assertEqual(kernel.calls,[("open",0x101000,False,123),("wait",321,0),("pid",321),
            ("times",321),("wait",321,0),("close",321)])

    def test_maximum_dword_pid_is_not_truncated(self):
        kernel=self.Kernel(pid=0xffffffff)
        with self.api(kernel):self.assertTrue(auth.process_identity(0xffffffff).startswith("4294967295:"))
        self.assertEqual(kernel.calls[0][-1],0xffffffff)

    def test_not_found_and_access_denied_are_closed_without_fallback(self):
        for code in (5,87):
            kernel=self.Kernel(open_error=code)
            with self.api(kernel),self.assertRaises(OSError) as caught:auth.process_identity(123)
            self.assertEqual(caught.exception.winerror,code)
            self.assertEqual([row[0] for row in kernel.calls],["open"])

    def test_signaled_process_before_or_after_query_is_rejected_including259_exit(self):
        for waits in ((0,), (0x102,0), (0x80,)):
            kernel=self.Kernel(waits=waits)
            with self.api(kernel),self.assertRaisesRegex(ValueError,"not live"):auth.process_identity(123)
            self.assertEqual(kernel.calls[-1],("close",321))
        # GetExitCodeProcess is deliberately absent from the production API table.
        self.assertNotIn("GetExitCodeProcess",inspect.getsource(auth._process_identity_api))

    def test_wait_id_and_times_api_failures_all_close_handle(self):
        for kernel in (self.Kernel(waits=(0xffffffff,)),self.Kernel(waits=(0x102,0xffffffff)),
                self.Kernel(id_error=6),self.Kernel(times_error=87)):
            with self.api(kernel),self.assertRaises(OSError):auth.process_identity(123)
            self.assertEqual(kernel.calls[-1],("close",321))

    def test_handle_pid_mismatch_and_bad_time_are_rejected_and_closed(self):
        for kernel in (self.Kernel(pid=124),self.Kernel(ticks=0xffffffffffffffff)):
            with self.api(kernel),self.assertRaises(ValueError):auth.process_identity(123)
            self.assertEqual(kernel.calls[-1],("close",321))

    def test_close_failure_denies_success_and_preserves_existing_primary(self):
        with self.api(self.Kernel(close_error=6)),self.assertRaises(OSError) as caught:auth.process_identity(123)
        self.assertEqual(caught.exception.winerror,6)
        with self.api(self.Kernel(times_error=87,close_error=6)),self.assertRaises(OSError) as caught:auth.process_identity(123)
        self.assertEqual(caught.exception.winerror,87)
        self.assertEqual(caught.exception.process_identity_close_error["winerror"],6)
        kernel=self.Kernel(pid=124)
        with self.api(kernel),patch.object(kernel,"CloseHandle",side_effect=OSError("close raised")),self.assertRaises(ValueError) as caught:
            auth.process_identity(123)
        self.assertEqual(caught.exception.process_identity_close_error["message"],"close raised")

    def test_no_identity_cache_between_calls_or_pid_reuse(self):
        kernel=self.Kernel()
        with self.api(kernel):
            first=auth.process_identity(123);kernel.ticks+=10;second=auth.process_identity(123)
        self.assertNotEqual(first,second)
        self.assertEqual(sum(row[0]=="open" for row in kernel.calls),2)
        self.assertEqual(sum(row[0]=="close" for row in kernel.calls),2)

    def test_filetime_integer_microsecond_and_datetime_boundaries(self):
        for ticks,text in ((0,"1601-01-01T00:00:00.0000000Z"),(9,"1601-01-01T00:00:00.0000000Z"),
                (10,"1601-01-01T00:00:00.0000010Z"),(116444736000000000,"1970-01-01T00:00:00.0000000Z"),
                (116444736001234569,"1970-01-01T00:00:00.1234560Z")):
            self.assertEqual(auth._process_creation_text(ticks),text)
        epoch=auth.datetime(1601,1,1,tzinfo=auth.timezone.utc)
        limit=auth.datetime.max.replace(tzinfo=auth.timezone.utc)-epoch
        maximum=((limit.days*86400+limit.seconds)*1000000+limit.microseconds)*10+9
        self.assertEqual(auth._process_creation_text(maximum),"9999-12-31T23:59:59.9999990Z")
        for ticks in (-1,True,False,1.,"1",2**64,maximum+1,0xffffffffffffffff):
            with self.subTest(ticks=repr(ticks)),self.assertRaises(ValueError):auth._process_creation_text(ticks)

    def test_platform_or_api_unavailable_has_no_fallback(self):
        with patch.object(auth.os,"name","posix"),self.assertRaisesRegex(ValueError,"Windows"):auth.process_identity(123)
        with patch.object(ctypes,"WinDLL",side_effect=OSError("API unavailable")),self.assertRaises(OSError):auth.process_identity(123)

    def test_missing_export_or_invalid_handle_cannot_fallback_or_close_pseudo_handle(self):
        with patch.object(ctypes,"WinDLL",return_value=SimpleNamespace()),self.assertRaises(AttributeError):auth.process_identity(123)
        for handle in (-1,ctypes.c_void_p(-1).value):
            kernel=self.Kernel()
            with self.api(kernel),patch.object(kernel,"OpenProcess",return_value=handle),self.assertRaisesRegex(ValueError,"invalid process handle"):
                auth.process_identity(123)
            self.assertEqual(kernel.calls,[])

    def test_raised_api_exception_still_closes_handle(self):
        kernel=self.Kernel();primary=OSError("wait raised")
        with self.api(kernel),patch.object(kernel,"WaitForSingleObject",side_effect=primary),self.assertRaises(OSError) as caught:
            auth.process_identity(123)
        self.assertIs(caught.exception,primary);self.assertEqual(kernel.calls[-1],("close",321))

    def test_live_context_keeps_two_endpoint_checks_for_both_routes(self):
        for capability in (auth.CAPABILITY,auth.FINAL_RGB_CAPABILITY):
            route=auth.execution_route(capability);root=route.root_prefix+"synthetic-process-run"
            identity={"capabilityVersion":capability,"runId":"synthetic-process-run","packageId":"synthetic-process-package",
                "processId":123,"processStartIdentity":"123:1970-01-01T00:00:00.0000010Z"}
            lock_binding={"path":root+"/qualification-lock.json","sha256":"a"*64}
            active={**identity,"executionState":"executing","programLineage":{},"lock":lock_binding,
                "heartbeat":{"path":root+"/qualification-heartbeat.json","ttlSeconds":120}}
            registry={"registryRevision":1,"activeExecution":active,"executionState":"executing",**identity}
            raw=json.dumps(registry).encode();registry_binding={"path":auth.REGISTRY,"sha256":hashlib.sha256(raw).hexdigest()}
            heartbeat=json.dumps({**identity,"schemaVersion":"ai-painter-current-active-execution-heartbeat-v1",
                "executionState":"executing","ttlSeconds":120,"heartbeatAtUtc":auth.datetime.now(auth.timezone.utc).isoformat()}).encode()
            reader=SimpleNamespace(mapping=SimpleNamespace(binding=lambda binding:raw),
                snapshot=lambda path:(raw,registry_binding) if path==auth.REGISTRY else (heartbeat,{}))
            plan={"outputRoot":root,"programBindings":{},**{k:identity[k] for k in ("capabilityVersion","runId","packageId")}}
            context=auth.Context(reader,{"path":"synthetic-package","sha256":"b"*64},{},plan)
            lock={**identity,"schemaVersion":"ai-painter-current-active-execution-lock-v1"}
            with patch.object(auth,"load_execution_package",return_value=context) as load,patch.object(auth,"read_json",return_value=lock), \
                    patch.object(auth,"process_identity",side_effect=[identity["processStartIdentity"]]*2) as query:
                auth.verify_live_context(context,expected_phase="qualification")
                self.assertEqual(query.call_args_list,[unittest.mock.call(123),unittest.mock.call(123)])
                self.assertEqual(load.call_args.kwargs,{"recompute_model":False})
            with patch.object(auth,"load_execution_package",return_value=context),patch.object(auth,"read_json",return_value=lock), \
                    patch.object(auth,"process_identity",side_effect=[identity["processStartIdentity"],"123:changed"]) as query:
                with self.assertRaisesRegex(ValueError,"registry/process changed"):auth.verify_live_context(context,expected_phase="qualification")
                self.assertEqual(query.call_count,2)

    def original_cim(self,pid):
        source=(ROOT/"ml/ai-painter/scripts/train_stage4_mvp_structured_object_v18_dry_stage0.py").read_text(encoding="utf-8-sig")
        node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=="process_identity")
        namespace={"require":auth.require,"subprocess":subprocess}
        exec(compile(ast.Module(body=[node],type_ignores=[]),"<unchanged-original-cim-process-identity>","exec"),namespace)
        return namespace["process_identity"](pid)

    def compare_real(self,pid,kind):
        began=time.perf_counter_ns();actual=auth.process_identity(pid);middle=time.perf_counter_ns()
        original=self.original_cim(pid);ended=time.perf_counter_ns()
        self.assertEqual(actual,original)
        self.real_comparisons.append({"kind":kind,"pid":pid,"win32":actual,"originalCim":original,
            "exactMatch":True,"win32ElapsedNanoseconds":middle-began,"cimIncludingSourceExtractionElapsedNanoseconds":ended-middle})
        return actual

    def test_real_self_pid_exactly_matches_original_cim_twice(self):
        self.compare_real(os.getpid(),"self-1");self.compare_real(os.getpid(),"self-2")

    def test_real_owned_child_exact_match_and_exit259_is_not_alive(self):
        import psutil
        with subprocess.Popen([sys.executable,"-I","-B","-c","import sys;sys.stdin.buffer.read(1);sys.exit(259)"],
                stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,
                creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0)) as child:
            try:
                psutil.Process(child.pid).cpu_affinity(psutil.Process().cpu_affinity()[:2])
                self.compare_real(child.pid,"owned-child")
            finally:
                child.stdin.close()
                child.wait(timeout=10)
            self.assertEqual(child.returncode,259)
            with self.assertRaises((ValueError,OSError)):auth.process_identity(child.pid)


class CpuRequestRouteTests(unittest.TestCase):
    """Synthetic request/plan behavior only; never enter a real CPU request."""
    def setUp(self):
        self.scope=ExitStack();self.addCleanup(self.scope.close)
        for owner,name in ((torch.nn.Module,"_call_impl"),(torch.autograd,"grad"),(torch.autograd,"backward"),
                (torch.optim.Optimizer,"__init__"),(torch.cuda,"_lazy_init"),(torch,"load")):
            self.scope.enter_context(patch.object(owner,name,side_effect=AssertionError("request route test prohibited execution")))

    def request(self,capability):
        route=auth.execution_route(capability)
        return {"configuration":{"capabilityVersion":capability},"runId":"synthetic-route-run",
            "packageId":"synthetic-route-package","outputRoot":route.root_prefix+"synthetic-route-run/cpu-entry"}

    def test_new_request_without_top_capability_builds_new_plan(self):
        request=self.request(auth.FINAL_RGB_CAPABILITY);before=copy.deepcopy(request)
        plan=_request_plan(request,modelBinding={"path":"synthetic-model.json","sha256":"a"*64})
        self.assertEqual(plan["capabilityVersion"],auth.FINAL_RGB_CAPABILITY)
        self.assertEqual(plan["outputRoot"],auth.execution_route(auth.FINAL_RGB_CAPABILITY).root_prefix+request["runId"])
        self.assertEqual(request,before)

    def test_old_request_without_top_capability_keeps_old_plan(self):
        request=self.request(auth.CAPABILITY)
        self.assertEqual(_request_plan(request)["capabilityVersion"],auth.CAPABILITY)
        self.assertEqual(_request_plan(request)["outputRoot"],auth.ROOT_PREFIX+request["runId"])
        legacy={key:value for key,value in request.items() if key!="configuration"}
        self.assertEqual(_request_plan(legacy)["capabilityVersion"],auth.CAPABILITY)

    def test_conflicting_request_identities_rejected_before_source_read_or_loader(self):
        for configured,top in ((auth.CAPABILITY,auth.FINAL_RGB_CAPABILITY),(auth.FINAL_RGB_CAPABILITY,auth.CAPABILITY)):
            request=self.request(configured);request["capabilityVersion"]=top
            with self.assertRaisesRegex(ValueError,"CPU route identity conflict"):_request_plan(request)
            with patch.object(auth,"read_json",side_effect=AssertionError("conflict cannot read sources")), \
                    patch.object(worker,"load_samples",side_effect=AssertionError("conflict cannot load images")):
                with self.assertRaisesRegex(ValueError,"CPU route identity conflict"):
                    validation_loader_regression(None,request,None,None)

    def test_new_and_old_loader_plans_pass_actual_closure_path_check_without_image_reads(self):
        class VerifiedBeforeImages(Exception):pass
        original_read,original_verify=auth.read_json,auth.verify_data_closure
        for capability in (auth.FINAL_RGB_CAPABILITY,auth.CAPABILITY):
            request=self.request(capability);route=auth.execution_route(capability);stored={};reads=[]
            def put(path,value):
                raw=json.dumps(value,sort_keys=True).encode();binding={"path":path,"sha256":hashlib.sha256(raw).hexdigest()}
                stored[path]=raw;return binding
            ids={split:[split+str(i) for i in range(n)] for split,n in (("train",48),("validation",8))}
            splits={split:put("data/synthetic-route/"+split+".json",{"sampleIds":values}) for split,values in ids.items()}
            member=put("data/synthetic-route/metadata.json",{"synthetic":True})
            closure={"schema":"object-support-structure-quality-data-closure-v1","metadataCounts":{"train":48,"validation":8},
                "validationRgbRead":False,"challengeContentRead":False,"regressionContentRead":False,
                "bindings":[member],"splitSampleIds":ids}
            bound=put(route.root_prefix+request["runId"]+"/data-closure.json",closure)
            candidate={"frozenBindings":{"trainSplit":splits["train"],"validationSplit":splits["validation"]}}
            class Reader:
                def read(self,binding,maximum=0):
                    reads.append(binding["path"]);raw=stored[binding["path"]]
                    if hashlib.sha256(raw).hexdigest()!=binding["sha256"]:raise AssertionError("synthetic binding SHA differs")
                    return raw
            def checked(reader,plan):
                self.assertEqual(plan["capabilityVersion"],capability)
                self.assertEqual(original_verify(reader,plan,recompute=False),closure)
                raise VerifiedBeforeImages()
            def read_json(reader,binding):return candidate if binding==auth.CANDIDATE else original_read(reader,binding)
            with patch.object(auth,"read_json",side_effect=read_json),patch.object(auth,"verify_data_closure",side_effect=checked), \
                    patch.object(worker,"load_samples",side_effect=AssertionError("image loader prohibited")):
                with self.assertRaises(VerifiedBeforeImages):validation_loader_regression(Reader(),request,bound,closure)
            self.assertEqual(set(reads),{bound["path"],member["path"],*(b["path"] for b in splits.values())})


class JointCaptureSourceLimitCpuTests(unittest.TestCase):
    """Only byte-bound synthetic control metadata; no model/tensor archive."""
    def fixture(self, count=260, capability=auth.JOINT_CAPABILITY):
        codec = auth.checkpoint_components(auth.JOINT_CAPABILITY)
        blobs, reads = {}, []
        def put(path, value):
            raw = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True).encode()
            blobs[path] = raw
            return {"path": path, "sha256": hashlib.sha256(raw).hexdigest()}
        policy_raw = (ROOT / codec.POLICY["path"]).read_bytes()
        self.assertEqual(put(codec.POLICY["path"], policy_raw), codec.POLICY)
        programs = {"source" + str(i): put("synthetic/source" + str(i) + ".py", b"# synthetic source\n") for i in range(count)}
        model = put("synthetic/model.json", {"graph": []})
        output_root = auth.execution_route(auth.JOINT_CAPABILITY).root_prefix + "synthetic-capture-count"
        plan = {"capabilityVersion": capability, "runId": "synthetic-capture-count", "outputRoot": output_root,
            "modelBinding": model, "programBindings": programs, "executionPolicy": dict(codec.POLICY),
            "configuration": codec.expected_configuration({"path": codec.PREVIEW_PATH, "sha256": "a" * 64})}
        plan_binding = put(output_root + "/quality-plan.json", plan)
        actual = {"schemaVersion": "ai-painter-autonomous-closed-loop-package-v1", "capabilityVersion": capability,
            "outputRoot": output_root, "inputEvidence": [dict(codec.POLICY), plan_binding],
            "programLineage": {role: b["sha256"] for role, b in programs.items()}}
        actual_binding = put("synthetic/execution-package.json", actual)
        context = {"runId": plan["runId"], "modelBinding": model, "programBindings": programs, "executionPackage": actual_binding,
            "sampleId": "synthetic-train", "split": "train", "sampleBindings": {
                "source": put("synthetic/source.json", {}), "condition": put("synthetic/condition.json", {})},
            "optimizerSteps": {"generator": 0, "discriminator": 0},
            "failurePosition": {"epoch": 1, "zeroBasedEpochPosition": 0, "trainIndex": 0, "sampleId": "synthetic-train"}}
        ticket = {"schema": "object-support-structure-failure-capture-execution-v1", "runId": plan["runId"],
            "outputRoot": output_root, "modelBinding": model, "programBindings": programs, "executionPackage": actual_binding}
        ticket_binding = put("synthetic/capture-execution.json", ticket)
        def read(bound, maximum=capture.MAX_JSON):
            reads.append(bound["path"])
            raw = blobs[bound["path"]]
            self.assertLessEqual(len(raw), maximum)
            self.assertEqual(hashlib.sha256(raw).hexdigest(), bound["sha256"])
            return raw
        mapping = SimpleNamespace(binding=read)
        return mapping, ticket_binding, context, output_root + "/gradient-failure", reads, blobs, actual, put

    def test_joint_capture_260_requires_bound_real_v2_and_preserves_source_checks(self):
        mapping, ticket, context, output, reads, blobs, actual, put = self.fixture()
        package, graph = capture._bound_context(mapping, ticket, context, output)
        self.assertEqual(graph, [])
        self.assertEqual(len(package["programBindings"]), 260)
        self.assertTrue(all(item["path"] in reads for item in context["programBindings"].values()))
        self.assertIn(auth.JOINT_POLICY["path"], reads)

    def test_joint_capture_261_and_old_candidate_257_fail_closed(self):
        for count, capability in ((261, auth.JOINT_CAPABILITY), (257, auth.FINAL_RGB_CAPABILITY), (257, auth.CAPABILITY)):
            with self.subTest(count=count, capability=capability):
                mapping, ticket, context, output, *_ = self.fixture(count, capability)
                with self.assertRaises(ValueError):
                    capture._bound_context(mapping, ticket, context, output)

    def test_capture_260_cannot_omit_trusted_v2_or_retarget_actual_plan(self):
        mapping, ticket, context, output, reads, blobs, actual, put = self.fixture()
        actual["inputEvidence"] = [item for item in actual["inputEvidence"] if item != auth.JOINT_POLICY]
        replacement = put(context["executionPackage"]["path"], actual)
        context["executionPackage"] = replacement
        ticket_value = json.loads(blobs[ticket["path"]])
        ticket_value["executionPackage"] = replacement
        ticket = put(ticket["path"], ticket_value)
        with self.assertRaisesRegex(ValueError, "policy v2 omitted"):
            capture._bound_context(mapping, ticket, context, output)


class ExecutionProtocolCpuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)

    def setUp(self):
        self.scope = ExitStack(); self.addCleanup(self.scope.close)
        for owner, name in ((torch.nn.Module, "_call_impl"), (torch.autograd, "grad"), (torch.autograd, "backward"),
                (torch.optim.Optimizer, "__init__"), (torch.cuda, "_lazy_init"), (torch, "load")):
            self.scope.enter_context(patch.object(owner, name, side_effect=AssertionError("synthetic protocol boundary")))
        self.configuration = checkpoint.expected_configuration()
        self.policy = json.loads((ROOT / auth.EXECUTION_POLICY_PATH).read_text(encoding="utf-8"))

    def test_execution_identity(self):
        self.assertEqual(auth.CAPABILITY, checkpoint.CAPABILITY)
        self.assertEqual(auth.PROFILE, "bounded_object_support_structure_quality24_v1")
        self.assertEqual(auth.PLAN_SCHEMA, "object-support-structure-quality-plan-v1")

    def test_cpu_model_identity_is_not_execution_capability(self):
        self.assertEqual(auth.MODEL_CAPABILITY, "stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1")
        self.assertNotEqual(auth.MODEL_CAPABILITY, auth.CAPABILITY)

    def test_fresh_model_metadata_uses_the_actual_new_profile_interface(self):
        # Model construction/state hashing only: setup forbids forward, autograd,
        # checkpoint loading, optimizer construction and CUDA initialization.
        self.assertFalse(hasattr(profile, "core"))
        reader = auth.Reader(ROOT)
        source = auth.read_json(reader, auth.CANDIDATE)
        result = auth.derive_model_metadata(reader, source["frozenBindings"]["datasetManifest"])
        self.assertEqual(result["capabilityVersion"], auth.CAPABILITY)
        self.assertEqual(result["modelCapabilityVersion"], auth.MODEL_CAPABILITY)
        self.assertEqual(len(result["graph"]), 108)
        self.assertEqual(sum(row["elements"] for row in result["graph"]), 2242687)
        self.assertEqual(set(result["initialState"]), {"generator", "discriminator"})
        for value in result["initialState"].values():
            self.assertRegex(value, r"^[a-f0-9]{64}$")
        self.assertFalse(any(logical.lower().endswith((".png", ".pt")) for logical in reader.observed))
        self.assertFalse(torch.cuda.is_initialized())
        reader.unchanged()

    def test_current_formal_hash_and_version(self):
        raw = (ROOT / auth.FINAL_RGB_SPECIFICATION["path"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), auth.FINAL_RGB_SPECIFICATION["sha256"])
        self.assertIn(b"AI-PAINTER-SPEC-1.79", raw)

    def test_current_policy_exact_bytes_and_semantics(self):
        self.assertEqual(auth.ROLES["executionPolicy"], auth.EXECUTION_POLICY_PATH)
        self.assertEqual(auth.ROLES["executionPolicy"], auth.EXECUTION_POLICY["path"])
        raw = (ROOT / auth.EXECUTION_POLICY["path"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), auth.EXECUTION_POLICY["sha256"])
        self.assertIs(auth.validate_execution_policy(self.policy, self.configuration), self.policy)

    def test_frozen_configuration_stays_169_and_new_cap(self):
        self.assertEqual(self.configuration["formalSpecification"]["sha256"], auth.CPU_SPECIFICATION_BASELINE["sha256"])
        self.assertNotEqual(self.configuration["formalSpecification"], auth.SPECIFICATION)
        self.assertEqual(self.configuration["capabilityVersion"], auth.CAPABILITY)

    def test_cpu_baseline_snapshot_explicit(self):
        raw = (ROOT / auth.CPU_SPECIFICATION_BASELINE["path"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), auth.CPU_SPECIFICATION_BASELINE["sha256"])
        self.assertIn(b"AI-PAINTER-SPEC-1.69", raw)

    def test_no_old_codec_admission_reader(self):
        source = inspect.getsource(auth.derive_configuration)
        self.assertNotIn("codec.derive_configuration", source)
        self.assertIn("codec.expected_configuration()", source)
        self.assertIn("reader.read(CPU_SPECIFICATION_BASELINE)", source)

    def test_policy_wrong_four_gradient_gate_rejected(self):
        value = copy.deepcopy(self.policy); value["gpuAdmission"]["totalGeneratorAutograd"] = 192
        with self.assertRaises(ValueError): auth.validate_execution_policy(value, self.configuration)

    def test_policy_resource_override_rejected(self):
        for key, value in (("maxWallSeconds", 8401), ("epochs", 25), ("generatorOptimizerSteps", 1153)):
            bad = copy.deepcopy(self.policy); bad["executionCeiling"][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): auth.validate_execution_policy(bad, self.configuration)

    def test_policy_extra_field_and_old_binding_rejected(self):
        bad = copy.deepcopy(self.policy); bad["resourceSuccessor"] = {}
        with self.assertRaises(ValueError): auth.validate_execution_policy(bad, self.configuration)
        bad = copy.deepcopy(self.policy); bad["formalSpecification"]["version"] = "AI-PAINTER-SPEC-1.69"
        with self.assertRaises(ValueError): auth.validate_execution_policy(bad, self.configuration)

    def test_policy_separates_lifecycle_from_external_task_scope(self):
        self.assertTrue(all(value is False for value in self.policy["qualification"].values()))
        self.assertNotIn("currentExternalWorkBoundary", self.policy)
        for key in ("samePackageGpuAdmission", "boundedTrainingAfterSamePackageGpuAdmission",
                    "productionRegistryWrite", "qualificationOnlyStopsBeforeTraining"):
            self.assertIs(self.policy["lifecycleBoundary"][key], True)
        self.assertEqual(self.policy["lifecycleBoundary"]["cpuPreparationValidationLoaderReadOnly"], {
            "split": "validation", "exactSampleCount": 8, "originalRgbAndConditionsOnly": True,
            "trainImageRead": False, "challengeImageRead": False, "regressionImageRead": False,
            "sourceMutation": False, "autograd": False, "checkpointSelection": False})

    def test_counter_48_times_five_g_one_d(self):
        calls = qualifier.Calls()
        for _ in range(48):
            calls.begin()
            for key, count in (("forward", 1), ("generator", 5), ("discriminator", 1)):
                for i in range(count): calls.event("attempt", key, None); calls.event("complete", key, None)
        self.assertEqual(calls.counts, {k+s: v for k,v in (("forward",48),("generator",240),("discriminator",48)) for s in ("Attempted","Completed")})

    def test_counter_sixth_g_rejected(self):
        calls = qualifier.Calls(); calls.begin()
        for _ in range(5): calls.event("attempt", "generator", None); calls.event("complete", "generator", None)
        with self.assertRaises(ValueError): calls.event("attempt", "generator", None)

    def test_counter_complete_without_attempt_rejected(self):
        calls = qualifier.Calls(); calls.begin()
        with self.assertRaises(ValueError): calls.event("complete", "generator", None)

    def test_native_cpu_schemas(self):
        self.assertEqual(worker.CPU_SCHEMA, "object-support-structure-quality-entry-cpu-report-v1")
        self.assertIn("object-support-structure-quality-final-cpu-acceptance-v1", inspect.getsource(worker.verify_final_cpu))
        self.assertIn("/cpu-entry/cpu-report.json", inspect.getsource(worker.verify_final_cpu))

    def test_gpu_gate_counts_and_completed_forward_abi(self):
        source = inspect.getsource(worker.verify_gpu_gate)
        self.assertIn('("generator", 240)', source)
        self.assertIn('"generatorAutograd": 5', source)
        self.assertIn('"generatorForwardCompleted": 1', source)

    def test_capture_five_labels(self):
        self.assertEqual(capture.LABELS, ("actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb","objectSupportStructure"))
        self.assertIn('"object_support_gradient_evidence"', inspect.getsource(capture.collect_snapshot))
        self.assertNotIn('"ecology_regime_gradient_evidence"', inspect.getsource(capture.collect_snapshot))

    def test_capture_24_1152_bounds(self):
        source = inspect.getsource(capture._bound_context)
        self.assertIn("0 <= v <= 1152", source); self.assertIn('position["epoch"] <= 24', source)
        self.assertNotIn("<= 600", source); self.assertNotIn("<= 13", source)

    def test_capture_no_budget_expansion(self):
        self.assertEqual(capture.MAX_CAPTURE, 64*1024**2); self.assertEqual(capture.MAX_EXECUTION, 128*1024**2)
        self.assertEqual(capture.METADATA_RESERVE, 1024**2)

    def test_capture_archive_all_five_sets_in_memory(self):
        # Synthetic parameter carrier, not a renderer or real checkpoint.
        model = torch.nn.Module()
        for i in range(108):
            model.register_parameter("p"+str(i), torch.nn.Parameter(torch.zeros(2242580 if i == 0 else 1)))
        critic = torch.nn.Linear(1, 1)
        named = tuple(model.named_parameters())
        graph = [{"name": name, "shape": list(value.shape), "dtype": str(value.dtype), "elements": value.numel()}
            for name, value in named]
        rows = [tuple([None]*107 + [torch.tensor([i+.25])]) for i in range(5)]
        error = RuntimeError("synthetic five-group snapshot")
        error.object_support_gradient_evidence = {"parameterNames": [name for name, _ in named],
            "componentsInOrder": list(capture.LABELS), "gradientSetsAvailable": 5, "rawGradients": rows}
        context = {key: {} for key in ("failurePosition", "optimizerSteps", "sampleBindings", "programBindings", "modelBinding")}
        payload, manifest = capture.collect_snapshot(error, model=model, critic=critic, graph=graph, context=context)
        capture.validate_manifest(manifest)
        self.assertEqual([value["label"] for value in manifest["gradients"]], list(capture.LABELS))
        self.assertEqual([len(value["parameters"]) for value in manifest["gradients"]], [108]*5)
        for i, label in enumerate(capture.LABELS):
            self.assertTrue(torch.equal(payload["gradient."+label+".107"], rows[i][107]))
        raw = capture.archive_bytes(payload)
        self.assertTrue(type(raw) is bytes and 0 < len(raw) < capture.MAX_CAPTURE)
        self.assertTrue(all(p.grad is None for p in model.parameters()))

    def test_terminal_reads_new_capture_receipt_and_keeps_first_error(self):
        error = RuntimeError("first")
        receipt = {"status":"capture_incomplete","missing":["synthetic"],"primaryError":capture.primary_error(error)}
        error.object_support_failure_capture_receipt = receipt
        error.actual_optimizer_counts = {"generator": 601, "discriminator": 602}
        plan = {"capabilityVersion":auth.CAPABILITY,"runId":"support-synthetic-run","packageId":"support-synthetic-package","finalCpuAcceptance":{"path":"x","sha256":"1"*64}}
        result = worker.terminal(error, None, {"path":"pkg","sha256":"2"*64}, plan, {"path":"gate","sha256":"3"*64})
        self.assertIs(result["captureReceipt"], receipt)
        self.assertEqual(result["optimizerSteps"], error.actual_optimizer_counts)
        self.assertEqual(result["originalError"]["message"], "first")

    def test_pair_commit_failure_keeps_observed_five_groups_not_prior_pair(self):
        from ai_painter.complete_world import object_support_structure_priority_update_device_v1 as bridge
        model = torch.nn.Linear(1, 1)
        raw = [tuple(torch.tensor([i+.25]) for _ in model.parameters()) for i in range(5)]
        primary = RuntimeError("synthetic post-commit failure")
        def pair():
            observer = bridge._OBSERVER.get()
            for label, values in zip(capture.LABELS, raw): observer("complete", label, values)
            raise primary
        with self.assertRaises(RuntimeError) as raised: worker.observed_pair(pair, model)
        self.assertIs(raised.exception, primary)
        evidence = primary.object_support_gradient_evidence
        self.assertEqual(evidence["gradientSetsAvailable"], 5)
        self.assertTrue(all(a is b for a, b in zip(evidence["rawGradients"], raw)))
        next_error = RuntimeError("next pair failed before gradients")
        def early(): raise next_error
        with self.assertRaises(RuntimeError): worker.observed_pair(early, model)
        self.assertEqual(next_error.object_support_gradient_evidence["gradientSetsAvailable"], 0)

    def test_review_strict_new_identity_and_codec(self):
        import review_stage4_object_support_structure_quality_cpu_v1 as review
        self.assertEqual(review.CAPABILITY, auth.CAPABILITY)
        self.assertEqual(review.TERMINAL_SCHEMA, worker.TERMINAL_SCHEMA)
        self.assertIs(review.checkpoint, checkpoint); self.assertIs(review.own_worker(), worker)

    def test_three_exact_manifest_aliases_only(self):
        baseline = {"scripts":{"test":"unchanged"},"private":True}
        scripts = {**baseline["scripts"],
            "control:ai-painter-ecology-decode1-quality":"node scripts/run-ai-painter-ecology-decode1-quality-v1.mjs",
            "control:ai-painter-ecology-terrain-detail-quality":"node scripts/run-ai-painter-ecology-terrain-detail-quality-v1.mjs",
            auth.MANIFEST_ALIAS:auth.MANIFEST_COMMAND}
        current = {**baseline,"scripts":scripts}
        auth._manifest_semantic_transition(json.dumps(baseline).encode(), json.dumps(current).encode())
        current["scripts"]["unrelated"]="forbidden"
        with self.assertRaises(ValueError): auth._manifest_semantic_transition(json.dumps(baseline).encode(), json.dumps(current).encode())

    def test_six_phase_source_and_old_plan_fail_closed(self):
        self.assertEqual(auth.PHASES, {"preflight","execute","validate","review","adjudicate","finalize"})
        with self.assertRaises(ValueError): auth.validate_plan(None, {"schema":"ecology-terrain-detail-weight-quality-plan-v1"})

    def test_bounded_source_roles_preserve_old_paths(self):
        self.assertLessEqual(179 + 2 + len(auth.ROLES), 256)
        self.assertEqual(auth.ROLES["trainingProfile"], "ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_v1.py")
        self.assertIn("sharedQualityProfile", auth.ROLES)
        self.assertEqual(auth.ROLES["nativeOwnerSource"], "scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs")

    def test_cpu_request_retains_real_negative_and_node_protocol(self):
        source = inspect.getsource(cpu_request)
        for name in ("run_owned_negative_inputs", "run_node_entry_regression", "validation_loader_regression"):
            self.assertIn(name, source)
        self.assertIn('"/cpu-report.json"', source)
        self.assertIn('"dataClosure": closure_binding', source)
        self.assertFalse(torch.cuda.is_initialized())


def run_owned_negative_inputs(reader, request, request_binding):
    """Only this new call's three declared private junctions; never old arenas."""
    auth.require(os.name == "nt" and request["outputRoot"] == _request_route(request).root_prefix + request["runId"] + "/cpu-entry",
        "current Windows CPU fixture scope required")
    base = _request_route(request).root_prefix + request["runId"] + "/cpu-negative-inputs"
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


class ProgressEntryCpuTests(unittest.TestCase):
    """Real v3 authentication, callback and private native IO; no model execution."""
    serial = 0
    native_observations = []
    branch_observations = []

    def setUp(self):
        self.scope = ExitStack(); self.addCleanup(self.scope.close)
        import builtins
        legacy_name = "painter_stage4_detail_weight_capture_execution_worker"
        self.assertNotIn(legacy_name, sys.modules)
        legacy_code, calls, attempts = worker._legacy_progress_publisher.__code__, [], []
        previous_profile = sys.getprofile()
        def observe(frame, event, arg):
            if event == "call" and frame.f_code is legacy_code: calls.append(1)
        sys.setprofile(observe)
        self.addCleanup(sys.setprofile, previous_profile)
        original_import = builtins.__import__
        def guarded_import(name, *args, **kwargs):
            if name == legacy_name:
                attempts.append(name)
                raise AssertionError("joint CPU suite cannot import historical detail worker")
            return original_import(name, *args, **kwargs)
        self.scope.enter_context(patch.object(builtins, "__import__", side_effect=guarded_import))
        def branch_proof():
            self.assertEqual(calls, []); self.assertEqual(attempts, [])
            self.assertNotIn(legacy_name, sys.modules)
            self.branch_observations.append({"test": self._testMethodName,
                "legacyFunctionActualCalls": len(calls), "historicalWorkerImportAttempts": len(attempts),
                "historicalWorkerPresent": legacy_name in sys.modules})
        self.addCleanup(branch_proof)
        for owner, name in ((torch.nn.Module, "_call_impl"), (torch.autograd, "grad"),
                (torch.autograd, "backward"), (torch.optim.Optimizer, "__init__"),
                (torch.cuda, "_lazy_init"), (torch, "load"), (worker, "runtime_for_plan")):
            self.scope.enter_context(patch.object(owner, name, side_effect=AssertionError("progress CPU boundary")))
        self.reader = auth.Reader(ROOT)
        base = Path(os.environ["AI_PAINTER_PROGRESS_TEST_ROOT"]).resolve()
        self.assertTrue(base.is_dir())
        relative = base.relative_to(self.reader.mapping.physical_runtime)
        owned = os.environ.get("TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT")
        review_private = relative.as_posix().startswith(
            "ai-painter/controller-repair-reviews/fix-a69-20261014/progress-entry-integration-20261018/")
        package_private = (owned is not None and _owned_prefix_ok(owned) and owned.endswith("/cpu-entry")
            and base == self.reader.path(owned + "/progress-entry-fixtures"))
        self.assertTrue(review_private or package_private, "exact private CPU evidence root required")
        ProgressEntryCpuTests.serial += 1
        self.output = ".runtime/" + relative.as_posix() + "/entry-case-" + str(self.serial)
        self.directory = self.reader.path(self.output)
        self.directory.mkdir()
        self.target = self.directory / "progress.json"
        self.origin, self.offset = _CPU_OBSERVATION_CLOCK(), 0
        self.scope.enter_context(patch.object(worker.time, "monotonic", side_effect=self.now))
        self.scope.enter_context(patch.dict(os.environ, {"DETAIL_WEIGHT_OUTPUT_ROOTS": "[]",
            "DETAIL_WEIGHT_OUTPUT_MAX": str(capture.MAX_EXECUTION)}))
        codec = auth.checkpoint_components(auth.JOINT_CAPABILITY)
        preview_raw = (ROOT / codec.PREVIEW_PATH).read_bytes()
        self.plan = {"capabilityVersion": auth.JOINT_CAPABILITY, "runId": "synthetic-progress-run",
            "packageId": "synthetic-progress-package", "outputRoot": self.output,
            "executionPolicy": dict(auth.JOINT_POLICY),
            "configuration": codec.expected_configuration({"path": codec.PREVIEW_PATH,
                "sha256": hashlib.sha256(preview_raw).hexdigest()}),
            "programBindings": {"progressPublication": {"path": auth.PROGRESS_PUBLICATION_PATH,
                "sha256": hashlib.sha256((ROOT / auth.PROGRESS_PUBLICATION_PATH).read_bytes()).hexdigest()}}}
        self.guard = SimpleNamespace(started=self.origin, seconds=8400)
        self.publish = worker.progress_publisher(self.reader, self.plan, self.guard)

    def now(self):
        return self.origin + self.offset

    def value(self, count=1):
        return {"epoch": 1, "completedEpochs": 0,
            "optimizerSteps": {"generator": count, "discriminator": count}, "selectedCheckpoint": None}

    def seed(self):
        self.assertEqual(self.publish(self.value()), "published")
        return self.target.read_bytes()

    def read(self):
        return json.loads(self.target.read_bytes())

    def staged(self):
        return list(self.directory.glob("progress.json.staged-*"))

    def native_reader(self, *, share_delete=False):
        self.assertEqual(os.name, "nt", "native Windows fixture required")
        api = ctypes.WinDLL("kernel32", use_last_error=True)
        api.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
            wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        api.CreateFileW.restype = wintypes.HANDLE
        api.CloseHandle.argtypes = [wintypes.HANDLE]; api.CloseHandle.restype = wintypes.BOOL
        handle = api.CreateFileW(str(self.target), 0x80000000, 3 | (4 if share_delete else 0), None, 3, 0x80, None)
        self.assertNotEqual(handle, ctypes.c_void_p(-1).value)
        closed = [False]
        def close():
            if not closed[0]:
                self.assertTrue(api.CloseHandle(handle)); closed[0] = True
        self.addCleanup(close)
        return close

    def defer(self, count=2):
        self.offset = 5
        self.assertEqual(self.publish(self.value(count)), "deferred_confirmed_sharing")
        self.assertEqual(len(self.staged()), 1)
        return self.staged()[0]

    def test_exact_protocol_five_second_cadence_and_optional_preview(self):
        self.seed()
        first = self.read()
        self.assertEqual(set(first), {"schemaVersion", "status", "capabilityVersion", "runId", "packageId",
            "actualEpoch", "completedEpochs", "executionState", "optimizerStepsGenerator",
            "optimizerStepsDiscriminator", "selectedCheckpoint", "updatedAtUtc"})
        self.offset = 4.99
        self.assertIsNone(self.publish(self.value(2)))
        self.assertEqual(self.read(), first)
        self.offset = 5
        value = self.value(3); value["latestTrainingPreview"] = {"path": "synthetic-preview", "sha256": "a" * 64}
        self.assertEqual(self.publish(value), "published")
        self.assertEqual(self.read()["latestTrainingPreview"], value["latestTrainingPreview"])
        self.assertEqual(self.read()["optimizerStepsGenerator"], 3)
        self.assertLessEqual(self.target.stat().st_size, 65536)

    def test_native_non_delete_reader_retains_one_pending_then_releases(self):
        original = self.seed(); close = self.native_reader()
        pending = self.defer(); retained = pending.read_bytes()
        self.offset = 10
        self.assertEqual(self.publish(self.value(3)), "deferred_confirmed_sharing")
        self.assertEqual(self.staged(), [pending]); self.assertEqual(pending.read_bytes(), retained)
        self.assertEqual(self.target.read_bytes(), original)
        close(); self.offset = 15
        self.assertEqual(self.publish(self.value(4)), "published_retained_snapshot")
        self.assertEqual(self.read()["optimizerStepsGenerator"], 2)
        self.offset = 20
        self.assertEqual(self.publish(self.value(5)), "published")
        self.assertEqual(self.read()["optimizerStepsGenerator"], 5)
        self.assertEqual(self.staged(), [])
        self.native_observations.append({"readerSharesDelete": False, "retainedOnePending": True,
            "originalBytesAndTimestampRetained": True, "releasedThenCurrentPublished": True})

    def test_native_delete_sharing_reader_handles_actual_machine_result(self):
        original = self.seed(); close = self.native_reader(share_delete=True)
        self.offset = 5
        status = self.publish(self.value(2))
        self.assertIn(status, ("published", "deferred_confirmed_sharing"))
        if status == "deferred_confirmed_sharing":
            self.assertEqual(self.target.read_bytes(), original)
            self.assertEqual(len(self.staged()), 1)
        close(); self.offset = 10
        final = self.value(4)
        self.assertEqual(self.publish(final, state="completed", force=True), "published")
        self.assertEqual(self.read()["optimizerStepsGenerator"], 4)
        self.assertEqual(self.read()["executionState"], "completed")
        self.native_observations.append({"readerSharesDelete": True, "actualInitialStatus": status,
            "releasedThenCurrentFinalPublished": True})

    def test_force_releases_pending_and_publishes_current_final_in_same_callback(self):
        self.seed(); close = self.native_reader(); self.defer(); close()
        self.offset = 6
        value = self.value(1152); value.update(epoch=24, completedEpochs=24,
            selectedCheckpoint={"path": "synthetic-final.pt", "sha256": "b" * 64})
        self.assertEqual(self.publish(value, state="completed", force=True), "published")
        record = self.read()
        self.assertEqual((record["actualEpoch"], record["completedEpochs"], record["optimizerStepsGenerator"],
            record["optimizerStepsDiscriminator"], record["executionState"]), (24, 24, 1152, 1152, "completed"))
        self.assertEqual(record["selectedCheckpoint"], value["selectedCheckpoint"])
        self.assertFalse(self.staged())

    def test_force_still_blocked_fails_and_real_terminal_reserve_is_writable(self):
        original = self.seed(); self.native_reader(); pending = self.defer()
        self.offset = 6
        with self.assertRaises(PermissionError) as raised:
            self.publish(self.value(1152), state="completed", force=True)
        self.assertIsInstance(raised.exception.__cause__, ValueError)
        self.assertIn("current final", str(raised.exception.__cause__))
        self.assertEqual(self.target.read_bytes(), original); self.assertTrue(pending.exists())
        error = raised.exception
        error.actual_optimizer_counts = {"generator": 1152, "discriminator": 1152}
        error.completed_epochs = 24
        plan = {**self.plan, "finalCpuAcceptance": {"path": "synthetic-cpu", "sha256": "a" * 64}}
        body = worker.terminal(error, None, {"path": "synthetic-package", "sha256": "b" * 64}, plan, {})
        bound = worker.write(ROOT, self.output + "/worker-terminal.json", body, terminal=True)
        actual = auth.read_json(self.reader, bound)
        self.assertEqual(actual["executionState"], "failed_closed")
        self.assertEqual(actual["optimizerStepsGenerator"], 1152)
        self.assertEqual(actual["completedEpochs"], 24)

    def test_freshness_at_120_seconds_preserves_first_failure_and_pending(self):
        original = self.seed(); self.native_reader(); pending = self.defer()
        self.offset = 120
        with self.assertRaises(PermissionError) as raised:
            self.publish(self.value(3))
        self.assertIsInstance(raised.exception.__cause__, TimeoutError)
        self.assertEqual(self.target.read_bytes(), original); self.assertTrue(pending.exists())

    def test_retained_publication_never_resets_original_capture_time(self):
        self.seed(); close = self.native_reader(); self.defer(); close(); self.offset = 119
        self.assertEqual(self.publish(self.value(3)), "published_retained_snapshot")
        close = self.native_reader(); self.offset = 124
        self.assertEqual(self.publish(self.value(4)), "deferred_confirmed_sharing")
        self.offset = 125
        with self.assertRaises(PermissionError) as raised:
            self.publish(self.value(5))
        self.assertIsInstance(raised.exception.__cause__, TimeoutError)

    def test_original_deadline_expires_before_freshness_and_cannot_be_extended(self):
        self.guard.seconds = 10
        publish = worker.progress_publisher(self.reader, self.plan, self.guard)
        publish(self.value()); close = self.native_reader(); self.offset = 5
        self.assertEqual(publish(self.value(2)), "deferred_confirmed_sharing")
        self.offset = 10
        with self.assertRaises(PermissionError) as raised:
            publish(self.value(3))
        self.assertIsInstance(raised.exception.__cause__, TimeoutError)
        close()
        self.guard.seconds = 11
        with self.assertRaises(PermissionError) as raised:
            publish(self.value(4))
        self.assertIsInstance(raised.exception.__cause__, ValueError)
        self.assertIn("deadline changed", str(raised.exception.__cause__))

    def test_first_publication_and_unconfirmed_access_failure_are_fatal(self):
        error = PermissionError("private denied"); error.winerror = 5
        with patch.object(worker.os, "replace", side_effect=error):
            with self.assertRaises(PermissionError): self.publish(self.value())
        self.assertFalse(self.target.exists()); self.assertEqual(len(self.staged()), 1)

    def test_generic_winerror5_without_real_occupancy_is_fatal(self):
        self.seed(); self.offset = 5
        error = PermissionError("private denied"); error.winerror = 5
        with patch.object(worker.os, "replace", side_effect=error):
            with self.assertRaises(PermissionError): self.publish(self.value(2))
        self.assertEqual(self.read()["optimizerStepsGenerator"], 1)

    def test_other_io_errors_are_never_deferred(self):
        self.seed(); self.offset = 5
        with patch.object(worker.os, "replace", side_effect=OSError("private disk failure")):
            with self.assertRaisesRegex(OSError, "disk failure"): self.publish(self.value(2))
        self.assertEqual(len(self.staged()), 1)

    def test_pending_retry_rechecks_all_owned_roots_and_terminal_reserve(self):
        self.seed(); self.native_reader(); pending = self.defer()
        other = self.output + "/other-evidence"
        self.reader.path(other).mkdir()
        self.reader.path(other + "/fixture.bin").write_bytes(b"other")
        used = capture.directory_bytes(self.directory) + capture.directory_bytes(self.reader.path(other))
        with patch.dict(os.environ, {"DETAIL_WEIGHT_OUTPUT_ROOTS": json.dumps([self.output, other]),
                "DETAIL_WEIGHT_OUTPUT_MAX": str(used + 65535)}):
            self.offset = 10
            with self.assertRaises(PermissionError) as raised: self.publish(self.value(3))
        self.assertIsInstance(raised.exception.__cause__, ValueError)
        self.assertIn("reserve", str(raised.exception.__cause__))
        self.assertTrue(pending.exists()); self.assertEqual(len(self.staged()), 1)

    def test_initial_budget_failure_does_not_create_pending(self):
        with patch.dict(os.environ, {"DETAIL_WEIGHT_OUTPUT_MAX": "65536"}):
            with self.assertRaisesRegex(ValueError, "reserve"): self.publish(self.value())
        self.assertEqual(self.staged(), [])

    def test_snapshot_limit_keeps_original_protocol_64kib_reader_boundary(self):
        value = self.value(); value["latestTrainingPreview"] = {"oversizedFixture": "x" * 65536}
        with self.assertRaisesRegex(ValueError, "snapshot bytes"): self.publish(value)
        self.assertFalse(self.target.exists()); self.assertEqual(self.staged(), [])

    def test_pending_identity_change_fails_and_preserves_primary(self):
        self.seed(); self.native_reader(); pending = self.defer()
        pending.write_bytes(b"changed fixture")
        self.offset = 10
        with self.assertRaises(PermissionError) as raised: self.publish(self.value(3))
        self.assertIsInstance(raised.exception.__cause__, ValueError)

    def test_mapping_configuration_change_fails_before_publication(self):
        self.seed(); self.offset = 5
        with patch.dict(os.environ, {"AI_PET_WORLD_DATA_ROOT": str(self.directory)}):
            with self.assertRaisesRegex(ValueError, "storage configuration changed"): self.publish(self.value(2))
        self.assertEqual(self.read()["optimizerStepsGenerator"], 1)

    def test_exact_policy_configuration_and_source_role_bindings_reject_forgery(self):
        changes = (lambda p: p.update(executionPolicy={"path": auth.JOINT_POLICY["path"], "sha256": "a" * 64}),
            lambda p: p["configuration"].pop("progressPublicationPolicy"),
            lambda p: p["configuration"].update(progressPublicationPolicy=True),
            lambda p: p["programBindings"].pop("progressPublication"),
            lambda p: p["programBindings"]["progressPublication"].update(sha256="b" * 64))
        for change in changes:
            plan = copy.deepcopy(self.plan); change(plan)
            with self.assertRaises(ValueError): worker.progress_publisher(self.reader, plan, self.guard)

    def test_component_policy_status_cannot_be_forged_through_reader(self):
        original = self.reader.read
        def forged(binding, *args):
            raw = original(binding, *args)
            if binding == auth.PROGRESS_PUBLICATION_POLICY:
                value = json.loads(raw); value["status"] = "qualified"
                return json.dumps(value).encode()
            return raw
        with patch.object(self.reader, "read", side_effect=forged):
            with self.assertRaisesRegex(ValueError, "SHA differs"):
                worker.progress_publisher(self.reader, self.plan, self.guard)

    def test_joint_callback_does_not_import_historical_worker(self):
        import builtins
        original = builtins.__import__
        def checked(name, *args, **kwargs):
            self.assertNotEqual(name, "painter_stage4_detail_weight_capture_execution_worker")
            return original(name, *args, **kwargs)
        with patch.object(builtins, "__import__", side_effect=checked):
            publish = worker.progress_publisher(self.reader, self.plan, self.guard)
            self.assertEqual(publish(self.value()), "published")

    def test_nonjoint_routes_dispatch_mocked_legacy_factory_without_import(self):
        for capability in (auth.CAPABILITY, auth.FINAL_RGB_CAPABILITY):
            plan = {**self.plan, "capabilityVersion": capability}
            with patch.object(worker, "_legacy_progress_publisher", return_value="legacy") as legacy, \
                    patch.object(auth, "verify_progress_publication", side_effect=AssertionError("nonjoint unchanged")):
                self.assertEqual(worker.progress_publisher(self.reader, plan, self.guard), "legacy")
                legacy.assert_called_once_with(self.reader, plan, self.guard)
        # Protocol parity is checked against the unchanged legacy record expression,
        # without executing the excluded factory or importing its historical worker.
        self.seed(); joint = self.read()
        tree = ast.parse(inspect.getsource(worker._legacy_progress_publisher))
        record = next(n.value for n in ast.walk(tree) if isinstance(n, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == "record" for t in n.targets))
        self.assertEqual(set(joint), {key.value for key in record.keys})

    def test_joint_short_replace_matches_frozen_function_ast_and_attempt_limit(self):
        path = ROOT / "ml/ai-painter/scripts/painter_stage4_detail_weight_capture_execution_worker.py"
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),
            "2880bbf9f78efe8273134b89ceb5f95027e846f2aa177e5ae4c59bcdf0eade79")
        old = next(n for n in ast.parse(path.read_text(encoding="utf-8")).body
            if isinstance(n, ast.FunctionDef) and n.name == "replace_progress_file")
        new = ast.parse(inspect.getsource(worker._replace_joint_progress_file)).body[0]
        self.assertEqual(ast.dump(ast.Module(body=old.body[1:], type_ignores=[])),
            ast.dump(ast.Module(body=new.body[1:], type_ignores=[])))
        self.seed(); self.offset = 5
        error = PermissionError("private denied"); error.winerror = 5
        with patch.object(worker.os, "replace", side_effect=error) as replacement:
            with self.assertRaises(PermissionError): self.publish(self.value(2))
        self.assertEqual(replacement.call_count, 5)


def joint_admission_suite():
    """The same suite used by authenticated joint cpu_request and private CPU QA."""
    from test_joint_object_priority_quality_adapters_cpu_v1 import admission_suite
    suite = admission_suite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(ProgressEntryCpuTests))
    return suite


class LegacyProgressEntryCompatibilityCpuTests(unittest.TestCase):
    """Separate process only: intentionally executes both original legacy routes."""
    observations = []

    def test_nonjoint_routes_dispatch_original_publisher_and_record_fields(self):
        scope = ExitStack(); self.addCleanup(scope.close)
        for owner, name in ((torch.nn.Module, "_call_impl"), (torch.autograd, "grad"),
                (torch.optim.Optimizer, "__init__"), (torch.cuda, "_lazy_init"), (torch, "load")):
            scope.enter_context(patch.object(owner, name, side_effect=AssertionError("legacy compatibility CPU boundary")))
        reader = auth.Reader(ROOT)
        base = Path(os.environ["AI_PAINTER_PROGRESS_TEST_ROOT"]).resolve()
        relative = base.relative_to(reader.mapping.physical_runtime).as_posix()
        self.assertTrue(relative.startswith("ai-painter/controller-repair-reviews/fix-a69-20261014/progress-entry-integration-20261018/"))
        output = ".runtime/" + relative + "/legacy-entry-compatibility"
        reader.path(output).mkdir()
        scope.enter_context(patch.dict(os.environ, {"DETAIL_WEIGHT_OUTPUT_ROOTS": "[]"}))
        guard = SimpleNamespace(started=_CPU_OBSERVATION_CLOCK(), seconds=8400)
        codec = auth.checkpoint_components(auth.JOINT_CAPABILITY)
        preview = {"path": codec.PREVIEW_PATH,
            "sha256": hashlib.sha256((ROOT / codec.PREVIEW_PATH).read_bytes()).hexdigest()}
        plan = {"capabilityVersion": auth.JOINT_CAPABILITY, "outputRoot": output,
            "executionPolicy": auth.JOINT_POLICY, "configuration": codec.expected_configuration(preview),
            "runId": "synthetic-progress-run", "packageId": "synthetic-progress-package",
            "programBindings": {"progressPublication": {"path": auth.PROGRESS_PUBLICATION_PATH,
                "sha256": hashlib.sha256((ROOT / auth.PROGRESS_PUBLICATION_PATH).read_bytes()).hexdigest()}}}
        value = {"epoch": 1, "completedEpochs": 0, "optimizerSteps": {"generator": 1, "discriminator": 1}}
        worker.progress_publisher(reader, plan, guard)(value)
        target = reader.path(output + "/progress.json")
        joint = json.loads(target.read_bytes())
        legacy_code, calls = worker._legacy_progress_publisher.__code__, []
        previous_profile = sys.getprofile()
        def observe(frame, event, arg):
            if event == "call" and frame.f_code is legacy_code: calls.append(1)
        sys.setprofile(observe); self.addCleanup(sys.setprofile, previous_profile)
        for capability in (auth.CAPABILITY, auth.FINAL_RGB_CAPABILITY):
            publish = worker.progress_publisher(reader, {**plan, "capabilityVersion": capability}, guard)
            publish(value, force=True)
            legacy = json.loads(target.read_bytes())
            self.assertEqual(set(joint), set(legacy))
            for key in set(joint) - {"capabilityVersion", "updatedAtUtc"}:
                self.assertEqual(joint[key], legacy[key])
        self.assertEqual(len(calls), 2)
        self.assertIn("painter_stage4_detail_weight_capture_execution_worker", sys.modules)
        self.observations.append({"legacyFactoryActualCalls": len(calls),
            "historicalDetailWorkerImported": True, "ownedJointSuite": False})


def progress_entry_cpu(*, joint=False, legacy=False):
    started = _CPU_OBSERVATION_CLOCK()
    torch.set_num_threads(2)
    if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
    import psutil
    process = psutil.Process(); process.cpu_affinity(process.cpu_affinity()[:2])
    output = io.StringIO()
    suite = (joint_admission_suite() if joint else unittest.defaultTestLoader.loadTestsFromTestCase(
        LegacyProgressEntryCompatibilityCpuTests if legacy else ProgressEntryCpuTests))
    result = unittest.TextTestRunner(stream=output, verbosity=2).run(suite)
    elapsed = _CPU_OBSERVATION_CLOCK() - started
    record = {"schemaVersion": "progress-entry-integration-cpu-tests-v1",
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
        "testsRun": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
        "skipped": len(result.skipped), "elapsedSeconds": elapsed,
        "nativeObservations": ProgressEntryCpuTests.native_observations,
        "branchObservations": ProgressEntryCpuTests.branch_observations,
        "legacyCompatibilityObservations": LegacyProgressEntryCompatibilityCpuTests.observations,
        "usesSameSuiteAsJointCpuRequest": joint,
        "realDatasetReads": 0, "modelForwardCalls": 0, "autogradCalls": 0,
        "optimizerConstruction": 0, "gpuCalls": 0, "productionRegistryWrites": 0,
        "productionStart": False, "gpuOrTrainingQualification": False,
        "output": output.getvalue()}
    path = Path(os.environ["AI_PAINTER_PROGRESS_TEST_ROOT"]) / (
        "legacy-entry-test-result.json" if legacy else "joint-admission-test-result.json" if joint else "entry-test-result.json")
    with path.open("xb") as stream:
        stream.write(capture.json_bytes(record)); stream.flush(); os.fsync(stream.fileno())
    print(output.getvalue())
    raise SystemExit(0 if result.wasSuccessful() and not result.skipped and elapsed < 120 else 1)


class PreviewWorkerCpuTests(unittest.TestCase):
    """Synthetic transport and orchestration, never real GPU/admission/schedule proof."""
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)

    def setUp(self):
        from test_training_preview_storage_cpu_v1 import StorageCpuTests
        self.fixture = StorageCpuTests("test_normal_record_progress_entry_and_once_terminal_manifest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.capability,self.fixture.model_capability=auth.CAPABILITY,auth.MODEL_CAPABILITY
        self.fixture.model=self.fixture.put(self.fixture.run+"/model-identity.json",dict(
            capabilityVersion=auth.CAPABILITY,modelCapabilityVersion=auth.MODEL_CAPABILITY))
        self.fixture.plan.update(capabilityVersion=auth.CAPABILITY,modelBinding=self.fixture.model)
        self.fixture.plan["configuration"]["modelCapabilityVersion"]=auth.MODEL_CAPABILITY
        self.fixture.rebind()
        self.scope = ExitStack(); self.addCleanup(self.scope.close)
        for owner, name in ((torch.nn.Module, "_call_impl"), (torch.autograd, "grad"), (torch.autograd, "backward"),
                (torch.optim.Optimizer, "__init__"), (torch.cuda, "_lazy_init"), (torch, "load")):
            self.scope.enter_context(patch.object(owner, name, side_effect=AssertionError("synthetic preview boundary")))
        self.reader = SimpleNamespace(root=self.fixture.root, mapping=self.fixture.mapping,
            json=self.fixture.read, read=self.fixture.mapping.binding, path=self.fixture.mapping.path, unchanged=lambda: None)
        self.refresh()

    def refresh(self):
        self.context = SimpleNamespace(reader=self.reader, plan=self.fixture.plan,
            package_binding=self.fixture.package_binding, package=self.fixture.package)
        self.train = []
        for sample_id in self.fixture.ids:
            identity = dict(sampleId=sample_id, split="train", worldId="synthetic-world", tick=7,
                image=self.fixture.rgb, conditionPack=self.fixture.condition, taskPackage=self.fixture.task,
                factHash=self.fixture.facts["sha256"])
            self.train.append(dict(sampleId=sample_id, split="train", _ecology_regime_binding=
                SimpleNamespace(reader=self.reader, identity_json=json.dumps(identity))))

    def bridge(self):
        return worker.training_preview_bridge(self.context, self.train, self.fixture.plan_binding)

    def test_bridge_observes_detached_copy_without_rng_tensor_or_autograd_change(self):
        bridge = self.bridge()
        prediction = self.fixture.frame.clone().requires_grad_()
        before, version, rng = prediction.detach().clone(), prediction._version, torch.get_rng_state().clone()
        with patch.object(bridge.storage, "capture", wraps=bridge.storage.capture) as saved:
            bridge.observe(prediction, self.train[0], {"generator": 0, "discriminator": 1})
        copied = saved.call_args.args[0]
        self.assertFalse(copied.requires_grad)
        self.assertIsNone(copied.grad_fn)
        self.assertNotEqual(copied.data_ptr(), prediction.data_ptr())
        self.assertEqual((copied.device.type, copied.dtype), ("cpu", torch.float32))
        self.assertTrue(torch.equal(prediction.detach(), before))
        self.assertEqual(prediction._version, version)
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        record = self.fixture.read(bridge.latest["record"])
        self.assertEqual(record["optimizerSteps"], {"generator": 0, "discriminator": 1})
        self.assertEqual(record["forwardSequence"], 1)

    def test_nonzero_ordinal_never_touches_prediction_or_source(self):
        bridge = self.bridge()
        bridge.observe(object(), object(), {"generator": 1, "discriminator": 2})
        self.assertIsNone(bridge.latest)
        self.assertIsNone(bridge.secondary_error)

    def test_legacy_plan_installs_no_bridge_and_pair_runner_keeps_original_arguments(self):
        plan = {**self.context.plan, "configuration": dict(self.context.plan["configuration"])}
        plan.pop("trainingPreviewPolicy"); plan["configuration"].pop("trainingPreviewPolicy")
        with patch.object(worker, "TrainingPreviewBridge", side_effect=AssertionError("must not construct")):
            self.assertIsNone(worker.training_preview_bridge(SimpleNamespace(plan=plan), [], {}))
        fake_profile = SimpleNamespace(perform_pair=object())
        model, marker = object(), object()
        with patch.object(worker, "observed_pair", return_value=marker) as pair:
            self.assertIs(worker.training_pair_runner(fake_profile, model, None)("args", update_limit=1152), marker)
        self.assertEqual(pair.call_args.args, (fake_profile.perform_pair, model, "args"))
        self.assertEqual(pair.call_args.kwargs, {"update_limit": 1152})

    def test_bridge_identity_or_copy_failure_is_optional_secondary_and_disables(self):
        bridge = self.bridge()
        sample = {**self.train[0], "_ecology_regime_binding": SimpleNamespace(reader=object(), identity_json="{}")}
        bridge.observe(self.fixture.frame, sample, {"generator": 0, "discriminator": 1})
        self.assertEqual(bridge.secondary_error["availabilityCode"], "binding_mismatch")
        bridge.observe(object(), object(), {})
        self.assertIsNone(bridge.latest)
        manifest = self.fixture.read(bridge.finish())
        self.assertEqual(manifest["secondaryError"]["availabilityCode"], "binding_mismatch")

    def test_bridge_copy_error_never_replaces_training_first_error(self):
        bridge = self.bridge()
        bridge.observe(object(), self.train[0], {"generator": 0, "discriminator": 1})
        error = RuntimeError("original training first error")
        bridge.finish(error)
        self.assertEqual(str(error), "original training first error")
        self.assertEqual(error.training_preview_secondary_error["availabilityCode"], "capture_failed")

    def test_progress_serializes_only_a_committed_pair_through_existing_writer(self):
        bridge = self.bridge()
        value = {"epoch": 1, "completedEpochs": 0, "optimizerSteps": {"generator": 0, "discriminator": 0}}
        self.assertIs(bridge.progress(value), value)
        bridge.observe(self.fixture.frame, self.train[0], {"generator": 0, "discriminator": 1})
        publish = worker.progress_publisher(self.reader, self.fixture.plan,
            SimpleNamespace(started=time.monotonic(), seconds=120))
        publish(bridge.progress(value), force=True)
        raw = self.fixture.mapping.path(self.fixture.run + "/progress.json").read_bytes()
        self.assertEqual(json.loads(raw)["latestTrainingPreview"], bridge.latest)
        self.fixture.read(bridge.latest["record"])
        self.fixture.mapping.binding(bridge.latest["image"])

    def synthetic_run(self, *, fail=False):
        """Only control-flow completion is stubbed; no claim of1152 actual updates."""
        self.fixture.plan["finalCpuAcceptance"] = self.fixture.put("data/synthetic/cpu.json", {"synthetic": True})
        self.fixture.rebind(); self.refresh()
        events, written = [], {}
        primary = RuntimeError("original synthetic training failure")
        gate = dict(deviceIdentity={"ordinal": 0, "uuid": "synthetic"}, initialCpuState={"generator": "state", "discriminator": "state"})
        class Network:
            def to(self, device): return self
            def named_parameters(self, **kwargs): return ()
        def perform_pair(model, critic, sample, order, go, do, counts, ledger, resource, forward, *,
                         update_limit, prediction_observer=None):
            counts["discriminator"] += 1
            if prediction_observer is not None:
                prediction_observer(self.fixture.frame, sample, dict(counts))
            if fail: raise primary
            counts["generator"] += 1
            return {}
        fake_profile = SimpleNamespace(fresh_networks=lambda _: (Network(), Network()), perform_pair=perform_pair)
        fake_torch = SimpleNamespace(set_num_threads=torch.set_num_threads, cuda=SimpleNamespace(
            is_available=lambda: True, is_bf16_supported=lambda: True, set_per_process_memory_fraction=lambda _: None,
            init=lambda: None, set_device=lambda _: None))
        shared = SimpleNamespace(v24=SimpleNamespace(core=SimpleNamespace(cpu=SimpleNamespace(state_hash=lambda _: "state"))))
        class Guard:
            def __init__(self, *args, **kwargs):
                self.started, self.seconds, self.device_identity = time.monotonic(), 8400, gate["deviceIdentity"]
            def __call__(self): pass
        def training_loop(**kwargs):
            counts = {"generator": 0, "discriminator": 0}
            try:
                kwargs["pair_runner"](kwargs["model"], kwargs["critic"], self.train[0], [], None, None,
                    counts, {}, kwargs["resource"], None, update_limit=1152)
            except RuntimeError as error:
                error.actual_optimizer_counts = counts
                error.failure_position = dict(epoch=1, zeroBasedEpochPosition=0, trainIndex=0, sampleId=self.fixture.ids[0])
                error.completed_epochs, error.partial_checkpoint_records = 0, []
                error.object_support_failure_capture_receipt = kwargs["capture_sink"](error, model=kwargs["model"],
                    critic=kwargs["critic"], context=kwargs["context_for_sample"](self.train[0], error.failure_position))
                raise
            kwargs["progress_sink"](1, counts, None, completed_epochs=0)
            return dict(optimizerSteps={"generator": 1152, "discriminator": 1152}, completedEpochs=24,
                selectedCheckpointRecord={"checkpoint": {"path": "synthetic-checkpoint", "sha256": "0" * 64}},
                checkpoints=[], epochObservations=[])
        def failure_capture(error, **kwargs):
            events.append("original-failure-capture")
            path = self.fixture.mapping.path(self.fixture.run + "/gradient-failure/synthetic-saved-evidence.bin")
            path.parent.mkdir()
            with path.open("xb") as stream: stream.truncate(64 * 1024 * 1024)
            return dict(status="capture_incomplete", primaryError=capture.primary_error(error), missing=["synthetic archive"])
        real_write, real_finish = worker.write, worker.TrainingPreviewBridge.finish
        def write(root, logical, value, **kwargs):
            written[logical] = value
            return real_write(root, logical, value, **kwargs)
        def finish(bridge, error=None):
            events.append("preview-finish")
            return real_finish(bridge, error)
        import painter_stage4_object_support_structure_lifecycle_v1 as loop
        with ExitStack() as scope:
            replacements = [(worker, "runtime", lambda: (fake_torch, fake_profile, shared)),
                (worker, "authenticate_live", lambda *a, **k: self.context), (worker, "verify_owned_gpu", lambda *a: gate),
                (worker, "load_samples", lambda *a, **k: ({"train": self.train, "validation": []}, [])),
                (worker, "verify_loaded_sources", lambda *a: None), (worker, "ResourceGuard", Guard),
                (worker.auth, "read_json", lambda *a: {"graph": []}), (capture, "validate_graph", lambda *a: None),
                (capture, "capture_failure", failure_capture), (worker, "write", write),
                (worker.TrainingPreviewBridge, "finish", finish), (loop, "training_loop", training_loop)]
            for owner, name, replacement in replacements: scope.enter_context(patch.object(owner, name, replacement))
            if fail:
                with self.assertRaises(RuntimeError) as raised:
                    worker.run(self.fixture.package_binding, {"path": "synthetic-gate", "sha256": "0" * 64}, root=self.fixture.root)
                self.assertIs(raised.exception, primary)
            else:
                worker.run(self.fixture.package_binding, {"path": "synthetic-gate", "sha256": "0" * 64}, root=self.fixture.root)
        return written[self.fixture.run + "/worker-terminal.json"], events, primary

    def test_success_worker_binds_manifest_and_keeps_old_qualification_flags(self):
        body, _, _ = self.synthetic_run()
        manifest = self.fixture.read(body["trainingPreviewManifest"])
        self.assertEqual(len(manifest["entries"]), 1)
        self.assertEqual(body["status"], "training_completed_review_pending")
        self.assertIs(body["formalStage4QualificationAllowed"], False)
        self.assertIs(body["runtimePublicationAllowed"], False)
        self.assertFalse(torch.cuda.is_initialized())

    def test_failed_worker_commits_manifest_after_64mib_original_capture_and_keeps_first_error(self):
        body, events, primary = self.synthetic_run(fail=True)
        self.assertLess(events.index("original-failure-capture"), events.index("preview-finish"))
        self.assertEqual(body["originalError"]["message"], str(primary))
        self.assertEqual(body["optimizerSteps"], {"generator": 0, "discriminator": 1})
        manifest = self.fixture.read(body["trainingPreviewManifest"])
        self.assertEqual(len(manifest["entries"]), 1)
        self.assertIn("failureReference", manifest)
        self.assertEqual(len(list(self.fixture.mapping.path(self.fixture.run + "/training-previews").glob("*.png"))), 1)
        self.assertFalse(torch.cuda.is_initialized())


class _CpuResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.passed_items = []

    def addSuccess(self, test):
        super().addSuccess(test)
        self.passed_items.append({"status": "passed", "testId": test.id()})


def validation_loader_regression(reader, request, closure_binding, closure):
    """Real eight original validation loads; no forward/grad/optimizer or selection."""
    _request_route(request)
    from diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu import DIAGNOSTIC
    candidate = auth.read_json(reader, auth.CANDIDATE)
    plan = _request_plan(request, dataClosure=closure_binding,
        trainSplit=candidate["frozenBindings"]["trainSplit"], validationSplit=candidate["frozenBindings"]["validationSplit"])
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
    route=_request_route(request)
    auth.require(request.get("capabilityVersion",route.capability)==route.capability,"CPU route identity conflict")
    auth.require(request.get("schema") == "object-support-structure-quality-cpu-request-v1"
        and request.get("modelCapabilityVersion") == route.model_capability
        and request.get("outputRoot") == route.root_prefix + request["runId"] + "/cpu-entry", "own new CPU request required")
    for key in ("runId", "packageId"):
        auth.require(type(request.get(key)) is str and auth.re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", request[key]), "CPU Run/package ID invalid")
    auth.require(request["runId"] != request["packageId"] and binding["path"] == route.root_prefix + request["runId"] + "/cpu-request.json",
        "same Run CPU request required")
    auth.verify_programs(reader, request["programBindings"],capability_version=route.capability)
    auth.require(auth.same_json(request["configuration"], auth.configuration(reader,capability_version=route.capability))
        and auth.same_json(request["runtimeIdentity"], auth.runtime_identity(ROOT)), "current CPU inputs/runtime differ")
    worker.write(ROOT, request["outputRoot"] + "/consumed.json", {"request": binding, "attempt": 1, "retries": 0})
    candidate = auth.read_json(reader, auth.CANDIDATE)
    auth.require("modelBinding" not in request and request.get("formalSpecification") == route.specification
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
        actual = auth.derive_model_metadata(reader, candidate["frozenBindings"]["datasetManifest"],capability_version=route.capability)
        auth.require(request["modelIdentityOutput"] == route.root_prefix + request["runId"] + "/model-identity.json", "same Run model output required")
        model_binding = worker.write(ROOT, request["modelIdentityOutput"], actual)
        closure = auth.derive_data_closure(ROOT)
        closure_binding = worker.write(ROOT, route.root_prefix + request["runId"] + "/data-closure.json", closure)
        negative_inputs = run_owned_negative_inputs(reader, request, binding)
        validation_binding = validation_loader_regression(reader, request, closure_binding, closure)
        if route.capability == auth.JOINT_CAPABILITY:
            progress_root = reader.path(request["outputRoot"] + "/progress-entry-fixtures")
            progress_root.mkdir()
            scope.enter_context(patch.dict(os.environ, {"AI_PAINTER_PROGRESS_TEST_ROOT": str(progress_root)}))
            suite = joint_admission_suite()
        elif route.capability == auth.FINAL_RGB_CAPABILITY:
            from test_final_rgb_base_weight_quality_adapters_cpu_v1 import AdmissionTests, QualificationTimingTests
            suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromTestCase(test)
                for test in (AdmissionTests,QualificationTimingTests))
        else:
            suite = unittest.defaultTestLoader.loadTestsFromTestCase(ExecutionProtocolCpuTests)
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
    if route.capability == auth.JOINT_CAPABILITY:
        report["progressEntryRegression"] = {"tests": len(ProgressEntryCpuTests.branch_observations),
            "branchObservations": ProgressEntryCpuTests.branch_observations,
            "nativeObservations": ProgressEntryCpuTests.native_observations,
            "nonjointFactoryMocked": True, "historicalWorkerImported": False}
    worker.verify_cpu_report(report, request, _request_plan(request, modelBinding=model_binding))
    return worker.write(ROOT, request["outputRoot"] + "/cpu-report.json", report)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cpu-request"); parser.add_argument("--sha256")
    parser.add_argument("--progress-entry-cpu", action="store_true")
    parser.add_argument("--joint-progress-admission-cpu", action="store_true")
    parser.add_argument("--progress-legacy-compat-cpu", action="store_true")
    args = parser.parse_args()
    if args.progress_entry_cpu:
        progress_entry_cpu()
    elif args.joint_progress_admission_cpu:
        progress_entry_cpu(joint=True)
    elif args.progress_legacy_compat_cpu:
        progress_entry_cpu(legacy=True)
    elif args.cpu_request:
        print(json.dumps(cpu_request({"path": args.cpu_request, "sha256": args.sha256})))
    else:
        torch.set_num_threads(2)
        if torch.get_num_interop_threads() != 2: torch.set_num_interop_threads(2)
        import psutil
        process = psutil.Process(); process.cpu_affinity(process.cpu_affinity()[:2])
        unittest.main(argv=[sys.argv[0]])
