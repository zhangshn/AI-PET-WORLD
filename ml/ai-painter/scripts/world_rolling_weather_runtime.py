"""Single reserved v4 rolling forecast. Scheduling, release and persistence belong to the server."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[3]
TRUSTED_LIMIT_LOADER = "d15d8b8ce234758f03e5f84e295b9c41c58b7c4954580875895bd0398065b130"
SHARED = "01f6c20ae2b4911c4d1f976e9bb1fd4fe19d863f68fbd9a4eda4567935d8ef98"
QUAL = "ai-painter/controller-repair-reviews/world-rolling-runtime-193-20261103/qualification"
VERSION = "sakaerat-weather-153-rolling-v4"


def main():
    if len(sys.argv) != 5:
        raise ValueError("weather worker needs fixed mode, tick, reservation and input")
    mode, day, claim_sha, input_sha = sys.argv[1:]
    if mode not in ("production", "qualification") or day not in ("2", "3"):
        raise ValueError("unregistered weather scope or tick")
    ns = (ROOT / ".runtime").resolve(strict=True)
    server = ns / ("ai-painter/world-rolling-weather-runtime/v4" if mode == "production" else QUAL)
    step = server / "steps" / day
    if step.resolve(strict=True) != step:
        raise ValueError("weather run redirected")
    loader = ROOT / "ml/ai-painter/scripts/world_first_weather_runtime.py"
    raw = loader.read_bytes()
    if hashlib.sha256(raw).hexdigest() != TRUSTED_LIMIT_LOADER:
        raise ValueError("qualified helper bytes changed")
    spec = importlib.util.spec_from_file_location("weather_v3_limits", loader)
    lib = importlib.util.module_from_spec(spec)
    exec(compile(raw, str(loader), "exec"), lib.__dict__)
    req = json.loads(lib.checked(step / "reservation.json", claim_sha))
    value = json.loads(lib.checked(step / "input.json", input_sha))
    budget_path = ROOT / "data/ai-painter/system-governance/sakaerat-rolling-weather-runtime-v4.json" if mode == "production" else ns / QUAL / "budget.json"
    cfg = json.loads(lib.checked(budget_path, req["budget"]["sha256"]))
    if (req["mode"] != mode or req["inputSha256"] != input_sha or int(day) != value["before"]["tick"] + 1
            or value["scope"] != mode or value["schemaVersion"] != "sakaerat-rolling-weather-model-input-v1"
            or cfg["version"] != VERSION or value["identity"] != cfg["identity"] or req["worldId"] != value["identity"]["worldId"]
            or req["before"] != value["before"] or req["workerStartMaximum"] != 1
            or cfg["maximumModelForwards"] != 2 or cfg["maximumNewSteps"] != 2
            or cfg["automaticModelRetries"] != 0 or cfg["formalWritesMaximum"] != (2 if mode == "production" else 0)):
        raise ValueError("wrong weather scope, budget, input or cursor")
    if cfg["worker"]["path"] != "ml/ai-painter/scripts/world_rolling_weather_runtime.py":
        raise ValueError("weather worker path")
    lib.checked(Path(__file__), cfg["worker"]["sha256"])
    if cfg["sharedForecast"]["path"] != "ml/ai-painter/scripts/world_weather_committed_forward.py" or cfg["sharedForecast"]["sha256"] != SHARED:
        raise ValueError("shared weather model replaced")
    shared = lib.load(ROOT / cfg["sharedForecast"]["path"], SHARED, "weather_qualified_forecast")
    shared.ensure_owned()
    active = json.loads(lib.bounded(ns / "ai-painter/owned-worker-guards/active.json"))
    started = ns / "ai-painter/owned-worker-guards" / (active["identity"] + "-started.json")
    if started.resolve() != Path(active["startedEvidence"]).resolve():
        raise ValueError("unexpected native owner evidence")
    deadline = time.monotonic() + 2
    while not started.exists() and time.monotonic() < deadline:
        time.sleep(.02)
    owner = json.loads(lib.bounded(started))
    if owner["runnerPid"] != req["serverPid"] or owner["ownerIdentity"]["pid"] != os.getppid() or owner["identity"] != active["identity"]:
        raise ValueError("model is not inside its designated native owner")
    original = json.loads(lib.checked(ROOT / lib.PRIOR, lib.PRIOR_SHA))
    if cfg["workerLimits"] != original["resources"] or value["modelSha256"] != original["checkpoint"]["sha256"]:
        raise ValueError("original local model or per-worker budget changed")
    legacy = lib.load(ROOT / "ml/ai-painter/scripts/world_weather_postcommit_worker.py", shared.LEGACY_LOADER_SHA, "frozen_weather_model_loader")
    wrapper = legacy.load_program("weather_job_limiter", ROOT / original["worker"]["path"], original["worker"]["sha256"])
    observe = wrapper.constrain_process(original["resources"])
    observe()
    history = value["history"]
    if len(history) != 7 or any(len(row) != 4 for row in history) or history != [row["values"] for row in value["rows"]]:
        raise ValueError("rolling history rows differ")
    history_sha = hashlib.sha256(b"".join(struct.pack("<d", x) for row in history for x in row)).hexdigest()
    if history_sha != value["historyValueSha256"] or history_sha != req["historyValueSha256"]:
        raise ValueError("unbound history")
    with (step / "worker-claim.json").open("x", encoding="utf-8") as f:
        json.dump({"pid": os.getpid(), "reservationSha256": claim_sha, "inputSha256": input_sha, "historyValueSha256": history_sha}, f)
    stop = threading.Event()
    def heartbeat():
        while not stop.is_set():
            temp = step / "heartbeat.tmp"
            temp.write_text(str(os.getpid()), encoding="ascii")
            os.replace(temp, step / "heartbeat")
            stop.wait(original["resources"]["heartbeatSeconds"])
    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        vals = shared.forecast(value, original["resources"], original, legacy.load_program)
        print(json.dumps({"pid": os.getpid(), "inputSha256": input_sha, "historyValueSha256": history_sha,
                          "checkpointSha256": original["checkpoint"]["sha256"], "modelForwards": 1, "trainingUpdates": 0,
                          "job": observe(), "values": vals}, allow_nan=False))
    finally:
        stop.set()
        thread.join(2)


if __name__ == "__main__":
    main()
