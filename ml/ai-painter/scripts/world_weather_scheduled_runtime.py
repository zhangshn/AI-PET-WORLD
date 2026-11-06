"""One charged CPU-only forecast. The server owns the stable SQLite lifetime and Store commits."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import re
import sqlite3
import struct
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[3]
V5 = "sakaerat-weather-153-scheduled-v5"
QUAL = "ai-painter/controller-repair-reviews/world-service-scheduled-runtime-210-20261103/qualification"
WORLD = "mvp-natural-world-001"
ORIGINAL_LOADER = "d15d8b8ce234758f03e5f84e295b9c41c58b7c4954580875895bd0398065b130"
QUALIFIED_FORECAST = "01f6c20ae2b4911c4d1f976e9bb1fd4fe19d863f68fbd9a4eda4567935d8ef98"


def require(value, why):
    if not value:
        raise ValueError("scheduled_weather_" + why)


def main():
    require(len(sys.argv) == 5, "fixed_arguments")
    mode, tick_text, reservation_sha, input_sha = sys.argv[1:]
    require(mode in ("production", "qualification") and re.fullmatch(r"[1-9][0-9]?", tick_text), "mode_tick")
    tick = int(tick_text)
    require(4 <= tick <= 30, "forecast_horizon")
    ns = (ROOT / ".runtime").resolve(strict=True)
    root = ns / (("ai-painter/world-weather-service/" + WORLD) if mode == "production" else QUAL)
    step = root / "steps" / tick_text
    require(step.resolve(strict=True) == step, "redirected_step")
    helper = ROOT / "ml/ai-painter/scripts/world_first_weather_runtime.py"
    raw = helper.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == ORIGINAL_LOADER, "original_cpu_helper")
    spec = importlib.util.spec_from_file_location("verified_weather_loader", helper)
    lib = importlib.util.module_from_spec(spec)
    exec(compile(raw, str(helper), "exec"), lib.__dict__)
    req = json.loads(lib.checked(step / "reservation.json", reservation_sha))
    data = json.loads(lib.checked(step / "input.json", input_sha))
    require(req["scope"] == mode and req["tick"] == tick and req["inputSha256"] == input_sha and req["worldId"] == WORLD, "reservation_scope")
    require(data["schemaVersion"] == "sakaerat-scheduled-weather-history-v1" and data["scope"] == mode and data["before"]["tick"] + 1 == tick, "input_identity")
    require(data["originalCutoffUtc"] == "2020-01-08T00:00:00.000Z" and data["maximumValidatedForecastDays"] == 30, "origin")
    budget = (ROOT / "data/ai-painter/system-governance/sakaerat-scheduled-weather-runtime-v5.json" if mode == "production" else root / "budget.json")
    cfg = json.loads(lib.checked(budget, req["budget"]["sha256"]))
    require(cfg["version"] == V5 and cfg["identity"] == data["identity"] and cfg["maximumConcurrentWorkers"] == 1 and cfg["automaticModelRetries"] == 0, "contract")
    require(cfg["formalWritesMaximum"] == (cfg["maximumNewSteps"] if mode == "production" else 0), "writes")
    dbpath = root / "accounting/accounting.sqlite"
    require(dbpath.resolve(strict=True) == dbpath, "redirected_accounting")
    conn = sqlite3.connect(dbpath.as_uri() + "?mode=ro", uri=True, timeout=2)
    try:
        token = conn.execute("SELECT batch_id,token,before_file,before_event,input_sha,history_sha,status FROM slots WHERE target_tick=?", (tick,)).fetchone()
        require(token == (req["batchId"], req["slotToken"], data["before"]["fileSha256"], data["head"]["eventSha256"], input_sha, data["historyValueSha256"], "reserved"),
                "original_paid_slot")
        mark = conn.execute("SELECT scope,tick,event_sha FROM service WHERE id=1").fetchone()
        require(mark == (req["lifetime"], tick - 1, data["head"]["eventSha256"]), "lifetime_cursor")
    finally:
        conn.close()
    shared = lib.load(ROOT / "ml/ai-painter/scripts/world_weather_committed_forward.py", QUALIFIED_FORECAST, "verified_153_cpu_forecast")
    shared.ensure_owned()
    active = json.loads(lib.bounded(ns / "ai-painter/owned-worker-guards/active.json"))
    evidence = ns / "ai-painter/owned-worker-guards" / (active["identity"] + "-started.json")
    require(Path(active["startedEvidence"]).resolve() == evidence.resolve(), "native_owner_evidence")
    until = time.monotonic() + 2
    while not evidence.exists() and time.monotonic() < until:
        time.sleep(.02)
    owner = json.loads(lib.bounded(evidence))
    require(owner["identity"] == active["identity"] and owner["ownerIdentity"]["pid"] == os.getppid()
            and owner["runnerPid"] == req["serverPid"], "wrong_native_owner")
    old = json.loads(lib.checked(ROOT / lib.PRIOR, lib.PRIOR_SHA))
    require(cfg["workerLimits"] == old["resources"] and data["modelSha256"] == old["checkpoint"]["sha256"], "model_limits")
    require(cfg["worker"]["path"] == "ml/ai-painter/scripts/world_weather_scheduled_runtime.py", "worker_path")
    lib.checked(Path(__file__), cfg["worker"]["sha256"])
    legacy = lib.load(ROOT / "ml/ai-painter/scripts/world_weather_postcommit_worker.py", shared.LEGACY_LOADER_SHA, "verified_legacy_limits_loader")
    limiter = legacy.load_program("weather_job_limiter", ROOT / old["worker"]["path"], old["worker"]["sha256"])
    observe = limiter.constrain_process(old["resources"])
    observe()
    history = data["history"]
    require(len(history) == 7 and all(len(r) == 4 for r in history) and history == [r["values"] for r in data["rows"]], "seven_real_rows")
    h = hashlib.sha256(b"".join(struct.pack("<d", n) for r in history for n in r)).hexdigest()
    require(h == data["historyValueSha256"] == req["historyValueSha256"], "window_digest")
    with (step / "worker-claim.json").open("x", encoding="utf-8") as f:
        json.dump({"pid": os.getpid(), "reservationSha256": reservation_sha, "inputSha256": input_sha, "historyValueSha256": h, "batchId": req["batchId"]}, f)
    stop = threading.Event()
    def pulse():
        while not stop.is_set():
            p = step / "heartbeat.tmp"
            p.write_text(str(os.getpid()), encoding="ascii")
            os.replace(p, step / "heartbeat")
            stop.wait(old["resources"]["heartbeatSeconds"])
    thread = threading.Thread(target=pulse, daemon=True)
    thread.start()
    try:
        values = shared.forecast(data, old["resources"], old, legacy.load_program)
        print(json.dumps({"pid": os.getpid(), "inputSha256": input_sha, "historyValueSha256": h,
                          "checkpointSha256": old["checkpoint"]["sha256"], "modelForwards": 1, "trainingUpdates": 0,
                          "job": observe(), "values": values}, allow_nan=False))
    finally:
        stop.set()
        thread.join(2)


if __name__ == "__main__":
    main()
