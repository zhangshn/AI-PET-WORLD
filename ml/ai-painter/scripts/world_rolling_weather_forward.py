"""One real CPU model call for one reserved rolling-history qualification tick."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import re
import struct
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[3]
BASE = "ai-painter/controller-repair-reviews/world-server-rolling-schedule-190-20261103"
V185 = "d15d8b8ce234758f03e5f84e295b9c41c58b7c4954580875895bd0398065b130"
V180 = "01f6c20ae2b4911c4d1f976e9bb1fd4fe19d863f68fbd9a4eda4567935d8ef98"


def main():
    if len(sys.argv) != 5 or sys.argv[1] != "qualification" or not re.fullmatch(r"step-[23]-[a-f0-9]{64}", sys.argv[2]):
        raise ValueError("fixed two-step qualification namespace required")
    ns = (ROOT / ".runtime").resolve(strict=True)
    step = ns / BASE / "qualification/steps" / sys.argv[2]
    if step.resolve(strict=True) != step:
        raise ValueError("weather step redirected")
    prev = ROOT / "ml/ai-painter/scripts/world_first_weather_runtime.py"
    raw = prev.read_bytes()
    if hashlib.sha256(raw).hexdigest() != V185:
        raise ValueError("original CPU constraints changed")
    spec = importlib.util.spec_from_file_location("weather_runtime185_helpers", prev)
    lib = importlib.util.module_from_spec(spec)
    exec(compile(raw, str(prev), "exec"), lib.__dict__)
    shared = lib.load(ROOT / "ml/ai-painter/scripts/world_weather_committed_forward.py", V180, "weather180_forecast")
    shared.ensure_owned()
    reservation_sha, input_sha = sys.argv[3:]
    launch = json.loads(lib.checked(step / "reservation.json", reservation_sha))
    data = json.loads(lib.checked(step / "input.json", input_sha))
    cfg = json.loads(lib.checked(ns / BASE / "qualification-budget.json", launch["budgetSha256"]))
    if launch["inputSha256"] != input_sha or data["schemaVersion"] != "sakaerat-rolling-weather-model-input-v1" or data["scope"] != "qualification":
        raise ValueError("unbound rolling weather input")
    before = data["before"]
    if (sys.argv[2] != f"step-{before['tick'] + 1}-{before['fileSha256']}"
            or [before["stateVersion"], before["eventCursor"]] != [before["tick"] + 1] * 2
            or data["identity"] != cfg["identity"] or cfg["maximumNewSteps"] != 2):
        raise ValueError("unrecognized committed pre-state")
    current = json.loads(lib.bounded(ns / "ai-painter/owned-worker-guards/active.json"))
    guard_path = ns / "ai-painter/owned-worker-guards" / (current["identity"] + "-started.json")
    if Path(current["startedEvidence"]).resolve() != guard_path.resolve():
        raise ValueError("wrong guard")
    deadline = time.monotonic() + 2
    while not guard_path.exists() and time.monotonic() < deadline:
        time.sleep(.02)
    owner = json.loads(lib.bounded(guard_path))
    if owner["ownerIdentity"]["pid"] != os.getppid() or owner["runnerPid"] != launch["serverPid"]:
        raise ValueError("foreign weather owner")
    original = json.loads(lib.checked(ROOT / lib.PRIOR, lib.PRIOR_SHA))
    if cfg["workerLimits"] != original["resources"] or launch["budgetSha256"] == lib.PRIOR_SHA:
        raise ValueError("unrecognized rolling weather budget")
    # The v1 policy is used strictly for the original machine/CPU constraints.
    if cfg["formalWrites"] != 0:
        raise ValueError("qualification cannot write a formal world")
    limits = original["resources"]
    legacy = lib.load(ROOT / "ml/ai-painter/scripts/world_weather_postcommit_worker.py", shared.LEGACY_LOADER_SHA, "weather_original_loader")
    limiter = legacy.load_program("weather_bounded_job", ROOT / original["worker"]["path"], original["worker"]["sha256"])
    observe = limiter.constrain_process(limits)
    observe()
    values = data["history"]
    if len(values) != 7 or any(len(row) != 4 for row in values) or values != [row["values"] for row in data["rows"]]:
        raise ValueError("wrong model window")
    history_sha = hashlib.sha256(b"".join(struct.pack("<d", v) for row in values for v in row)).hexdigest()
    if data["historyValueSha256"] != history_sha:
        raise ValueError("wrong history digest")
    with (step / "claim.json").open("x", encoding="utf-8") as handle:
        json.dump({"pid": os.getpid(), "inputSha256": input_sha, "historyValueSha256": history_sha}, handle)
    stop = threading.Event()
    def heartbeat():
        while not stop.is_set():
            tmp = step / "heartbeat.tmp"
            tmp.write_text(str(os.getpid()), encoding="ascii")
            os.replace(tmp, step / "heartbeat")
            stop.wait(limits["heartbeatSeconds"])
    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        result = shared.forecast(data, limits, original, legacy.load_program)
        print(json.dumps({"pid": os.getpid(), "inputSha256": input_sha, "historyValueSha256": history_sha,
                          "checkpointSha256": original["checkpoint"]["sha256"], "modelForwards": 1, "trainingUpdates": 0,
                          "job": observe(), "values": result}, allow_nan=False))
    finally:
        stop.set()
        thread.join(2)


if __name__ == "__main__":
    main()
