"""One CPU forecast for the first committed weather step under the authenticated native owner."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[3]
V3 = "sakaerat-weather-153-runtime-v3"
BASE = "ai-painter/controller-repair-reviews/world-first-evolution-runtime-185-20261103/qualification/run"
FORMAL = "ai-painter/world-first-weather-runtime/v3"
PRIOR = "data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json"
PRIOR_SHA = "e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a"


def bounded(path, limit=65536):
    with path.open("rb") as handle:
        raw = handle.read(limit + 1)
    if not raw or len(raw) > limit:
        raise ValueError("invalid bounded forecast file")
    return raw


def checked(path, expected, limit=65536):
    raw = bounded(path, limit)
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("weather runtime binding mismatch: " + path.name)
    return raw


def load(path, sha, name):
    raw = checked(path, sha)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    exec(compile(raw, str(path), "exec"), module.__dict__)
    return module


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ("production", "qualification"):
        raise ValueError("fixed mode, reservation and input binding required")
    mode, reservation_sha, input_sha = sys.argv[1:]
    namespace = (ROOT / ".runtime").resolve(strict=True)
    folder = namespace / (FORMAL if mode == "production" else BASE)
    if folder.resolve(strict=True) != folder:
        raise ValueError("weather run namespace changed")
    reservation = json.loads(checked(folder / "reservation.json", reservation_sha))
    if reservation["mode"] != mode or reservation["inputSha256"] != input_sha:
        raise ValueError("weather reservation identity")
    data = json.loads(checked(folder / "input.json", input_sha))
    if data["scope"] != mode or data["schemaVersion"] != "world-weather-committed-model-input-v1":
        raise ValueError("wrong model input scope")
    budget_ref = reservation["budget"]
    budget_path = ("data/ai-painter/system-governance/sakaerat-first-committed-weather-runtime-v3.json" if mode == "production"
                   else ".runtime/ai-painter/controller-repair-reviews/world-first-evolution-runtime-185-20261103/qualification-budget.json")
    if budget_ref["path"] != budget_path:
        raise ValueError("unrecognized weather budget")
    cfg = json.loads(checked(ROOT / budget_path, budget_ref["sha256"]))
    original = json.loads(checked(ROOT / PRIOR, PRIOR_SHA))
    if cfg["version"] != V3 or cfg["identity"] != data["identity"] or cfg["firstInterval"] != data["interval"]:
        raise ValueError("weather runtime boundaries")
    if any(cfg["resources"][key] != original["resources"][key] for key in original["resources"] if key != "formalWorldWrites"):
        raise ValueError("weather resource drift")
    if cfg["resources"]["formalWorldWrites"] != (1 if mode == "production" else 0):
        raise ValueError("weather world write scope")
    if cfg["worker"]["path"] != "ml/ai-painter/scripts/world_first_weather_runtime.py":
        raise ValueError("weather worker source path")
    checked(Path(__file__), cfg["worker"]["sha256"])
    if cfg["sharedForecast"]["path"] != "ml/ai-painter/scripts/world_weather_committed_forward.py":
        raise ValueError("weather model producer path")
    shared = load(ROOT / cfg["sharedForecast"]["path"], cfg["sharedForecast"]["sha256"], "weather_qualified_producer")
    shared.ensure_owned()
    # The parent already verified the trusted release. Authorize this subprocess only inside
    # the matching native owner's running Job and verify the actual owner/command before Torch.
    guard_root = namespace / "ai-painter/owned-worker-guards"
    active = json.loads(bounded(guard_root / "active.json"))
    expected_started = guard_root / (active["identity"] + "-started.json")
    if expected_started.resolve() != Path(active["startedEvidence"]).resolve():
        raise ValueError("unexpected owner start file")
    deadline = time.monotonic() + 2
    while not expected_started.exists() and time.monotonic() < deadline:
        time.sleep(.02)
    started = json.loads(bounded(expected_started))
    if started["identity"] != active["identity"] or started["ownerIdentity"]["pid"] != os.getppid():
        raise ValueError("weather job is not owned by the current supervisor")
    if started["runnerPid"] != reservation["runnerPid"] or started["executableSha256"] != reservation["interpreterSha256"]:
        raise ValueError("weather execution owner differs")
    if data["sourceBudgetSha256"] != PRIOR_SHA or data["before"]["tick"] != 0 or data["before"]["stateVersion"] != 1 or data["before"]["eventCursor"] != 1:
        raise ValueError("weather execution before-state")
    # The original verified producer loads the same model and applies its original predict().
    legacy = load(ROOT / "ml/ai-painter/scripts/world_weather_postcommit_worker.py", shared.LEGACY_LOADER_SHA, "weather_bound_loader")
    limiter = legacy.load_program("weather_owned_limits", ROOT / original["worker"]["path"], original["worker"]["sha256"])
    observe = limiter.constrain_process(original["resources"])
    observe()
    with (folder / "worker-claim.json").open("x", encoding="utf-8") as handle:
        json.dump({"pid": os.getpid(), "reservationSha256": reservation_sha, "inputSha256": input_sha}, handle)
    stopped = threading.Event()
    def heartbeat():
        while not stopped.is_set():
            tmp = folder / "heartbeat.tmp"
            tmp.write_text(str(os.getpid()), encoding="ascii")
            os.replace(tmp, folder / "heartbeat")
            stopped.wait(original["resources"]["heartbeatSeconds"])
    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        values = shared.forecast(data, original["resources"], original, legacy.load_program)
        print(json.dumps({"pid": os.getpid(), "inputSha256": input_sha, "checkpointSha256": original["checkpoint"]["sha256"],
                          "modelForwards": 1, "trainingUpdates": 0, "values": values, "job": observe()}, allow_nan=False))
    finally:
        stopped.set()
        thread.join(2)


if __name__ == "__main__":
    main()
