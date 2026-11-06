"""One CPU-only integration forecast for the committed first-world seed."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import threading

ROOT = Path(__file__).resolve().parents[3]
TX = ROOT / ".runtime/ai-painter/controller-repair-reviews/natural-world-mainline-172-20261102/transaction"
INPUT_SHA = "27566d83a776798d6775d6dc02d733f7a064e96b43324a6b90c8fe81a39d5e5d"
BUDGET_SHA = "e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a"


def read_checked(path, expected):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("weather_postcommit_hash:" + str(path))
    return data


def load_program(name, path, expected):
    # Compile the authenticated bytes rather than reopening the file for import.
    source = read_checked(path, expected)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    exec(compile(source, str(path), "exec"), module.__dict__)
    return module


def main():
    if len(sys.argv) != 1:
        raise ValueError("fixed isolated input only")
    data = json.loads(read_checked(TX / "qualification/postcommit-input.json", INPUT_SHA))
    if data["budgetSha256"] != BUDGET_SHA or data["before"]["eventCursor"] != 1:
        raise ValueError("weather_postcommit_precondition")
    config = json.loads(read_checked(ROOT / "data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json", BUDGET_SHA))
    limits = config["resources"]
    legacy = load_program("frozen_weather_limits", ROOT / config["worker"]["path"], config["worker"]["sha256"])
    observe = legacy.constrain_process(limits)
    observe()
    stopped = threading.Event()
    pulse = TX / "postcommit-run/heartbeat"

    def heartbeat():
        temp = pulse.with_suffix(".tmp")
        while not stopped.is_set():
            temp.write_text(str(os.getpid()), encoding="ascii")
            os.replace(temp, pulse)
            stopped.wait(limits["heartbeatSeconds"])

    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        sys.path.insert(0, str(ROOT / "ml/ai-painter/.venv/Lib/site-packages"))
        fit = load_program("postcommit_model153", ROOT / "ml/ai-painter/scripts/world_environment_humidity.py", config["fitProgramSha256"])
        torch = fit.pilot.configure_torch()
        checkpoint = config["checkpoint"]
        if data["modelSha256"] != checkpoint["sha256"]:
            raise ValueError("weather_postcommit_model")
        model = torch.load(io.BytesIO(read_checked(ROOT / checkpoint["path"], checkpoint["sha256"])), map_location="cpu", weights_only=True)
        if model["trainingDatasetSha256"] != checkpoint["trainingDatasetSha256"]:
            raise ValueError("weather_postcommit_dataset")
        history = torch.tensor([data["history"]], dtype=torch.float64, device="cpu")
        if tuple(history.shape) != (1, 7, 4) or not torch.isfinite(history).all().item():
            raise ValueError("weather_postcommit_history")
        with torch.inference_mode():
            values = fit.predict(model["model"], history)[0].tolist()
        if torch.cuda.is_initialized() or torch.get_num_threads() != limits["cpuThreadsMaximum"]:
            raise ValueError("weather_postcommit_cpu")
        print(json.dumps({"pid": os.getpid(), "inputSha256": INPUT_SHA, "checkpointSha256": checkpoint["sha256"],
                          "modelForwards": 1, "trainingUpdates": 0, "values": values, "job": observe()}, allow_nan=False))
    finally:
        stopped.set()
        thread.join(2)


if __name__ == "__main__":
    main()
