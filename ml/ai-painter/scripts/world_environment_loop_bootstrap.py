"""Run fixed158 worker in the directly spawned interpreter, preserving its PID."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import runpy
import stat
import sys

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ".runtime/ai-painter/controller-repair-reviews/world-evolution-loop-158-20261030"
CONTRACT_SHA256 = "316902480cc389b8d73df48fab6a314d5d1233d177f89937111d047c45f8a4d8"
DIRECT_INTERPRETER = "D:/DevCaches/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
SITE_PACKAGES = "ml/ai-painter/.venv/Lib/site-packages"
WORKER = "ml/ai-painter/scripts/world_environment_loop_forward.py"
VENV_CONFIG = "ml/ai-painter/.venv/pyvenv.cfg"
TASK_ID = "WORLD-EVOLUTION-LOOP-158"


def require(ok, reason):
    if not ok:
        raise ValueError("loop_bootstrap_" + reason)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def safe_absolute(path):
    path = Path(path)
    require(path.is_absolute(), "absolute_path")
    current = Path(path.anchor)
    for part in path.parts[1:]:
        require(part not in (".", ".."), "path_segment")
        current /= part
        info = current.lstat()
        require(not current.is_symlink() and not (getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT), "linked_path")
    return current


def project_path(logical):
    require(type(logical) is str and not any(c in logical for c in "\\:\x00")
            and all(part and part not in (".", "..") for part in logical.split("/")), "logical_path")
    if logical.startswith(".runtime/"):
        # Preserve the one established runtime-root junction; no descendant links.
        return safe_absolute((ROOT / ".runtime").resolve(strict=True) / logical[len(".runtime/"):])
    return safe_absolute(ROOT / logical)


def read_verified(path, expected_sha, expected_bytes=None, maximum=1024*1024):
    path = safe_absolute(path)
    with path.open("rb") as handle:
        before = os.fstat(handle.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and 0 < before.st_size <= maximum, "file_shape")
        raw = handle.read(maximum+1)
        after = os.fstat(handle.fileno())
    require(before.st_size == after.st_size == len(raw) and before.st_mtime_ns == after.st_mtime_ns
            and before.st_ino == after.st_ino, "file_changed")
    require(expected_bytes is None or len(raw) == expected_bytes, "file_bytes")
    require(digest(raw) == expected_sha, "file_sha")
    return raw


def read_contract():
    raw = read_verified(project_path(EVIDENCE + "/interpreter-contract-v2.json"), CONTRACT_SHA256, maximum=65536)
    c = json.loads(raw.decode("utf-8"))
    require(c["schemaVersion"] == "world-environment-loop-interpreter-v1" and c["taskId"] == TASK_ID, "contract_schema")
    require(c["directInterpreter"]["path"] == DIRECT_INTERPRETER and c["sitePackages"] == SITE_PACKAGES
            and c["worker"]["path"] == WORKER and c["venvConfig"]["path"] == VENV_CONFIG
            and c["args"] == ["-I", "-X", "utf8", "-B"], "contract_paths")
    return c


def check_interpreter(c):
    require(sys.flags.isolated == 1 and sys.flags.utf8_mode == 1 and sys.dont_write_bytecode, "isolated_flags")
    expected = safe_absolute(c["directInterpreter"]["path"])
    actual = safe_absolute(sys.executable)
    require(os.path.normcase(str(actual.resolve(strict=True))) == os.path.normcase(str(expected.resolve(strict=True))), "interpreter_path")
    read_verified(actual, c["directInterpreter"]["sha256"], c["directInterpreter"]["bytes"])
    read_verified(project_path(c["venvConfig"]["path"]), c["venvConfig"]["sha256"], c["venvConfig"]["bytes"])
    read_verified(project_path(c["worker"]["path"]), c["worker"]["sha256"], c["worker"]["bytes"])
    return actual


def prepare_imports(c):
    site = project_path(c["sitePackages"])
    require(site.is_dir() and "torch" not in sys.modules, "imports_already_loaded")
    # Direct insertion intentionally does not execute .pth files or activate venv.
    sys.path.insert(0, str(site))
    spec = importlib.util.find_spec("torch")
    expected = safe_absolute(site / "torch" / "__init__.py")
    require(spec is not None and spec.origin is not None, "torch_missing")
    actual = safe_absolute(spec.origin)
    require(actual.resolve(strict=True) == expected.resolve(strict=True), "torch_origin")
    require(spec.submodule_search_locations is not None and
            [Path(p).resolve(strict=True) for p in spec.submodule_search_locations] == [expected.parent.resolve(strict=True)], "torch_search_path")
    return site, actual


def main():
    worker_started = False
    try:
        require(sys.argv[1:] in ([], ["--identity-check"]), "arguments")
        identity_only = sys.argv[1:] == ["--identity-check"]
        c = read_contract()
        executable = check_interpreter(c)
        site, origin = prepare_imports(c)
        if identity_only:
            print(json.dumps({"schemaVersion": "world-environment-loop-interpreter-identity-v1", "taskId": TASK_ID,
                              "pid": os.getpid(), "executable": str(executable), "interpreterSha256": c["directInterpreter"]["sha256"],
                              "venvConfigSha256": c["venvConfig"]["sha256"], "workerSha256": c["worker"]["sha256"],
                              "sitePackages": str(site), "torchOrigin": str(origin), "modelForwardRuns": 0,
                              "trainingUpdates": 0, "worldWrites": 0, "productionReady": False}, ensure_ascii=False))
            return 0
        worker = project_path(WORKER)
        # Same OS process; no launcher or nested Python process is involved.
        sys.argv = [str(worker)]
        worker_started = True
        runpy.run_path(str(worker), run_name="__main__")
        return 0
    except Exception as error:
        print(json.dumps({"schemaVersion": "world-environment-loop-bootstrap-failure-v1", "taskId": TASK_ID,
                          "pid": os.getpid(), "status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000],
                          "modelForwardRuns": None if worker_started else 0,
                          "trainingUpdates": 0, "worldWrites": 0, "productionReady": False}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
