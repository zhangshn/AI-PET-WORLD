"""166 fixed direct-interpreter launcher; run the new worker in this OS PID."""
import hashlib
import json
import os
from pathlib import Path
import runpy
import stat
import sys
import types

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ".runtime/ai-painter/controller-repair-reviews/world-environment-background-166-20261031"
CONTRACT_SHA256 = "303f5dc4a945c20c9d71c7b1cf605ab910dca3f788104541942763fcf8b5625d"
TASK_ID = "WORLD-ENVIRONMENT-BACKGROUND-166"
WORKER = "ml/ai-painter/scripts/world_environment_scheduled_forward.py"
LEGACY_PATH = "ml/ai-painter/scripts/world_environment_loop_bootstrap.py"
LEGACY_SHA = "48ca6102803e5325db7b7b7ec3e908c96491d2c22f64fca53dfb0871bf8a6c3e"


def helpers():
    current = ROOT
    for part in LEGACY_PATH.split("/"):
        current /= part
        info = current.lstat()
        if current.is_symlink() or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise ValueError("scheduled_bootstrap_legacy_link")
    raw = current.read_bytes()
    if hashlib.sha256(raw).hexdigest() != LEGACY_SHA:
        raise ValueError("scheduled_bootstrap_legacy_sha")
    module = types.ModuleType("scheduled166_bootstrap_helpers")
    module.__file__ = str(current)
    exec(compile(raw, str(current), "exec"), module.__dict__)
    return module


def main():
    worker_started = False
    try:
        legacy = helpers()
        legacy.require(sys.argv[1:] in ([], ["--identity-check"], ["--check-input"]), "166_arguments")
        identity_only = sys.argv[1:] == ["--identity-check"]
        raw = legacy.read_verified(legacy.project_path(EVIDENCE + "/model/interpreter-contract.json"), CONTRACT_SHA256, maximum=65536)
        c = json.loads(raw)
        legacy.require(c["schemaVersion"] == "world-environment-scheduled-interpreter-v1" and c["taskId"] == TASK_ID
                       and c["directInterpreter"]["path"] == legacy.DIRECT_INTERPRETER
                       and c["sitePackages"] == legacy.SITE_PACKAGES and c["venvConfig"]["path"] == legacy.VENV_CONFIG
                       and c["worker"]["path"] == WORKER and c["args"] == ["-I", "-X", "utf8", "-B"], "166_contract")
        executable = legacy.check_interpreter(c)
        site, origin = legacy.prepare_imports(c)
        if identity_only:
            print(json.dumps({"schemaVersion": "world-environment-scheduled-interpreter-identity-v1", "taskId": TASK_ID,
                              "pid": os.getpid(), "executable": str(executable), "interpreterSha256": c["directInterpreter"]["sha256"],
                              "venvConfigSha256": c["venvConfig"]["sha256"], "workerSha256": c["worker"]["sha256"],
                              "sitePackages": str(site), "torchOrigin": str(origin), "modelForwardRuns": 0,
                              "trainingUpdates": 0, "worldWrites": 0, "productionReady": False}, ensure_ascii=False))
            return 0
        worker = legacy.project_path(WORKER)
        if sys.argv[1:] == ["--check-input"]:
            module = runpy.run_path(str(worker))
            contract = module["read_contract"]()
            data = module["validate_input"](sys.stdin.buffer.read(65537), contract)
            module["validate_sources"](data, contract)
            print(json.dumps({"pid": os.getpid(), "step": data["step"], "modelForwardRuns": 0}))
            return 0
        sys.argv = [str(worker)]
        worker_started = True
        runpy.run_path(str(worker), run_name="__main__")
        return 0
    except Exception as error:
        print(json.dumps({"schemaVersion": "world-environment-scheduled-bootstrap-failure-v1", "taskId": TASK_ID,
                          "pid": os.getpid(), "status": "failed", "errorType": type(error).__name__, "error": str(error)[:2000],
                          "modelForwardRuns": None if worker_started else 0,
                          "trainingUpdates": 0, "worldWrites": 0, "productionReady": False}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
