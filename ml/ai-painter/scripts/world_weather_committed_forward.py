"""A single Sakaerat forecast from the committed-input reader. The caller owns the Store."""
import ctypes
from ctypes import wintypes
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import threading

ROOT = Path(__file__).resolve().parents[3]
QUALIFICATION = "ai-painter/controller-repair-reviews/world-first-evolution-executor-180-20261103/qualification/run"
BUDGET_PATH = "data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json"
BUDGET_SHA = "e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a"
LEGACY_LOADER_SHA = "dfb61b303c6efc25fc1528d6e8d239c8a9fcad5960d5bf953c53a235438c518a"


def checked(path, expected, size):
    if not path.is_file() or path.stat().st_size > size:
        raise ValueError("invalid forecast artifact")
    with path.open("rb") as handle:
        data = handle.read(size + 1)
    if len(data) > size or hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("forecast byte binding differs")
    return data


def ensure_owned():
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.IsProcessInJob.argtypes = [wintypes.HANDLE, wintypes.HANDLE, ctypes.POINTER(wintypes.BOOL)]
    result = wintypes.BOOL()
    if not kernel.IsProcessInJob(kernel.GetCurrentProcess(), None, ctypes.byref(result)) or not result.value:
        raise ValueError("managed Windows Job required")


def forecast(data, limits, cfg, load_program):
    sys.path.insert(0, str(ROOT / "ml/ai-painter/.venv/Lib/site-packages"))
    fit = load_program("committed_weather_model", ROOT / "ml/ai-painter/scripts/world_environment_humidity.py", cfg["fitProgramSha256"])
    torch = fit.pilot.configure_torch()
    checkpoint = cfg["checkpoint"]
    if data["modelSha256"] != checkpoint["sha256"]:
        raise ValueError("wrong local model")
    weights = checked(ROOT / checkpoint["path"], checkpoint["sha256"], 4 * 1024**2)
    restored = torch.load(io.BytesIO(weights), map_location="cpu", weights_only=True)
    if restored["trainingDatasetSha256"] != checkpoint["trainingDatasetSha256"]:
        raise ValueError("wrong model dataset")
    history = torch.tensor([data["history"]], dtype=torch.float64, device="cpu")
    if tuple(history.shape) != (1, 7, 4) or not torch.isfinite(history).all().item():
        raise ValueError("invalid committed history")
    with torch.inference_mode():
        values = fit.predict(restored["model"], history)[0].tolist()
    if torch.cuda.is_initialized() or torch.get_num_threads() != limits["cpuThreadsMaximum"]:
        raise ValueError("weather CPU execution violated")
    return values


def main():
    if len(sys.argv) != 3 or sys.argv[1] != "qualification" or len(sys.argv[2]) != 64:
        raise ValueError("fixed qualification route only until production capability is released")
    ensure_owned()
    base = (ROOT / ".runtime").resolve(strict=True)
    folder = base / QUALIFICATION
    if folder.resolve(strict=True) != folder:
        raise ValueError("invalid weather run directory")
    sha = sys.argv[2]
    raw = checked(folder / "input.json", sha, 65536)
    data = json.loads(raw)
    cfg = json.loads(checked(ROOT / BUDGET_PATH, BUDGET_SHA, 65536))
    limits = cfg["resources"]
    if (data["schemaVersion"] != "world-weather-committed-model-input-v1"
            or data["scope"] != "qualification" or data["identity"] != cfg["identity"]
            or [data["before"][k] for k in ("tick", "stateVersion", "eventCursor")] != [0, 1, 1]
            or data["sourceBudgetSha256"] != BUDGET_SHA or data["interval"] != cfg["firstInterval"]):
        raise ValueError("weather precondition mismatch")
    # The Store is checked by the fixed Node reader before and after the native-owned subprocess.
    # Retaining this claim also prevents running the model twice for a reserved candidate.
    with (folder / "forward-claim.json").open("x", encoding="utf-8") as handle:
        json.dump({"pid": os.getpid(), "inputSha256": sha}, handle)
    legacy_path = ROOT / "ml/ai-painter/scripts/world_weather_postcommit_worker.py"
    source = checked(legacy_path, LEGACY_LOADER_SHA, 32768)
    spec = importlib.util.spec_from_file_location("weather_prior_verified_loader", legacy_path)
    prior = importlib.util.module_from_spec(spec)
    exec(compile(source, str(legacy_path), "exec"), prior.__dict__)
    limiter = prior.load_program("weather_original_job", ROOT / cfg["worker"]["path"], cfg["worker"]["sha256"])
    observe = limiter.constrain_process(limits)
    observe()
    stopped = threading.Event()
    def pulse():
        while not stopped.is_set():
            tmp = folder / "heartbeat.tmp"
            tmp.write_text(str(os.getpid()), encoding="ascii")
            os.replace(tmp, folder / "heartbeat")
            stopped.wait(limits["heartbeatSeconds"])
    thread = threading.Thread(target=pulse, daemon=True)
    thread.start()
    try:
        values = forecast(data, limits, cfg, prior.load_program)
        print(json.dumps({"pid": os.getpid(), "inputSha256": sha, "checkpointSha256": cfg["checkpoint"]["sha256"],
                          "modelForwards": 1, "trainingUpdates": 0, "values": values, "job": observe()}, allow_nan=False))
    finally:
        stopped.set()
        thread.join(2)


if __name__ == "__main__":
    main()
