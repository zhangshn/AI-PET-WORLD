"""One CPU forecast under the weather budget. Store commits belong to the parent."""
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
import time

ROOT = Path(__file__).resolve().parents[3]
JOB_MEMORY = 0x200
ACTIVE_PROCESS = 0x8
AFFINITY = 0x10


def require(value, message):
    if not value:
        raise ValueError(message)


def constrain_process(limits):
    # A nested Job adds limits to the original supervisor's kill-on-close Job.
    class Basic(ctypes.Structure):
        _fields_ = [("user", ctypes.c_int64), ("job", ctypes.c_int64), ("flags", wintypes.DWORD),
                    ("working_min", ctypes.c_size_t), ("working_max", ctypes.c_size_t),
                    ("active", wintypes.DWORD), ("affinity", ctypes.c_size_t),
                    ("priority", wintypes.DWORD), ("scheduling", wintypes.DWORD)]

    class Extended(ctypes.Structure):
        _fields_ = [("basic", Basic), ("io", ctypes.c_uint64 * 6),
                    ("process_memory", ctypes.c_size_t), ("job_memory", ctypes.c_size_t),
                    ("peak_process", ctypes.c_size_t), ("peak_job", ctypes.c_size_t)]

    dll = ctypes.WinDLL("kernel32", use_last_error=True)
    handle, pointer, size = wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD
    signatures = [
        ("GetCurrentProcess", [], handle), ("CreateJobObjectW", [pointer, wintypes.LPCWSTR], handle),
        ("GetProcessAffinityMask", [handle, pointer, pointer], wintypes.BOOL),
        ("AssignProcessToJobObject", [handle, handle], wintypes.BOOL),
        ("SetInformationJobObject", [handle, ctypes.c_int, pointer, size], wintypes.BOOL),
        ("QueryInformationJobObject", [handle, ctypes.c_int, pointer, size, pointer], wintypes.BOOL),
    ]
    for name, args, result in signatures:
        method = getattr(dll, name)
        method.argtypes, method.restype = args, result

    def check(result):
        if not result:
            raise ctypes.WinError(ctypes.get_last_error())
        return result

    process = dll.GetCurrentProcess()
    permitted, system = ctypes.c_size_t(), ctypes.c_size_t()
    check(dll.GetProcessAffinityMask(process, ctypes.byref(permitted), ctypes.byref(system)))
    cores = [1 << n for n in range(permitted.value.bit_length()) if permitted.value & (1 << n)]
    require(len(cores) >= limits["cpuThreadsMaximum"], "insufficient_cpu_affinity")
    job = check(dll.CreateJobObjectW(None, None))
    config = Extended()
    config.basic.flags = JOB_MEMORY | ACTIVE_PROCESS | AFFINITY
    config.basic.active = 1
    config.basic.affinity = sum(cores[:limits["cpuThreadsMaximum"]])
    config.job_memory = limits["maxCommittedMemoryMiB"] * 1024**2
    check(dll.SetInformationJobObject(job, 9, ctypes.byref(config), ctypes.sizeof(config)))
    check(dll.AssignProcessToJobObject(job, process))

    def observe():
        current = Extended()
        check(dll.QueryInformationJobObject(job, 9, ctypes.byref(current), ctypes.sizeof(current), None))
        require(current.basic.flags & config.basic.flags == config.basic.flags and
                current.job_memory == config.job_memory and current.basic.affinity == config.basic.affinity
                and current.basic.active == 1, "job_limits_changed")
        return {"maxCommittedBytes": current.job_memory, "peakCommittedBytes": current.peak_job,
                "cpuAffinityCount": current.basic.affinity.bit_count(), "maxProcesses": current.basic.active}
    return observe


def main():
    require(len(sys.argv) == 4 and sys.argv[1] in ("forecast", "timeout-probe"), "invalid_arguments")
    mode, input_path, input_sha = sys.argv[1:]
    path = Path(input_path)
    namespace = (ROOT / ".runtime/ai-painter/world-weather-first-step").resolve(strict=True)
    require(path.resolve(strict=True) == namespace / mode / "input.json", "input_namespace")
    raw = path.read_bytes()
    require(len(raw) <= 65536 and hashlib.sha256(raw).hexdigest() == input_sha, "input_binding")
    data = json.loads(raw)
    config_raw = (ROOT / "data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json").read_bytes()
    require(hashlib.sha256(config_raw).hexdigest() == data["budgetSha256"], "budget_binding")
    cfg = json.loads(config_raw)
    limits = cfg["resources"]
    observe = constrain_process(limits)
    observe()
    finished = threading.Event()
    def heartbeat():
        # Same small file is replaced on each pulse. It is liveness only.
        temp = path.with_name("heartbeat.tmp")
        while not finished.is_set():
            temp.write_text(str(os.getpid()), encoding="ascii")
            os.replace(temp, path.with_name("heartbeat"))
            finished.wait(limits["heartbeatSeconds"])
    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        if mode == "timeout-probe":
            time.sleep(limits["workerSecondsMaximum"] + 10)
            raise RuntimeError("timeout_probe_was_not_stopped")
        sys.path.insert(0, str(ROOT / "ml/ai-painter/.venv/Lib/site-packages"))
        model_path = ROOT / "ml/ai-painter/scripts/world_environment_humidity.py"
        require(hashlib.sha256(model_path.read_bytes()).hexdigest() == cfg["fitProgramSha256"], "fit_program")
        spec = importlib.util.spec_from_file_location("weather153_budget", model_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        torch = module.pilot.configure_torch()
        checkpoint = cfg["checkpoint"]
        weights = (ROOT / checkpoint["path"]).read_bytes()
        require(hashlib.sha256(weights).hexdigest() == checkpoint["sha256"], "checkpoint")
        restored = torch.load(io.BytesIO(weights), map_location="cpu", weights_only=True)
        require(restored["trainingDatasetSha256"] == checkpoint["trainingDatasetSha256"], "dataset")
        history = torch.tensor([data["history"]], dtype=torch.float64, device="cpu")
        require(tuple(history.shape) == (1, 7, 4) and torch.isfinite(history).all().item(), "history")
        with torch.inference_mode():
            values = module.predict(restored["model"], history)[0].tolist()
        require(not torch.cuda.is_initialized() and torch.get_num_threads() == limits["cpuThreadsMaximum"], "cpu_only")
        print(json.dumps({"pid": os.getpid(), "inputSha256": input_sha, "checkpointSha256": checkpoint["sha256"],
                          "modelForwards": 1, "trainingUpdates": 0, "values": values, "job": observe()}, allow_nan=False))
    finally:
        finished.set()
        thread.join(2)


if __name__ == "__main__":
    main()
