import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const trainerPath = path.join(
  root,
  "ml",
  "ai-painter",
  "scripts",
  "train_ai_assisted_conditional_denoiser.py",
);
const modulePath = path.join(
  root,
  "ml",
  "ai-painter",
  "src",
  "ai_painter",
  "complete_world",
  "live_progress.py",
);
const serverPath = path.join(root, "src", "server", "ai-painter-current-training.ts");
const typesPath = path.join(
  root,
  "src",
  "app",
  "ai-painter-progress",
  "_lib",
  "current-training-dashboard-types.ts",
);
const pagePath = path.join(
  root,
  "src",
  "app",
  "ai-painter-progress",
  "current-training",
  "current-training-dashboard.tsx",
);
const dictionaryPath = path.join(
  root,
  "data",
  "ai-painter",
  "system-governance",
  "local-ai-model-data-dictionary-v1.json",
);
const pythonPath = path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe");

const trainer = fs.readFileSync(trainerPath, "utf8");
const liveModule = fs.readFileSync(modulePath, "utf8");
const server = fs.readFileSync(serverPath, "utf8");
const types = fs.readFileSync(typesPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, "utf8"));

assert.ok(fs.existsSync(pythonPath), "project Python runtime is missing");
assert.ok(
  trainer.indexOf("optimizer.step()") < trainer.indexOf("on_batch_progress({"),
  "Batch progress must be recorded only after the optimizer step succeeds",
);
assert.ok(
  trainer.includes("now_monotonic - last_progress_write_monotonic < 0.5") &&
    trainer.includes('force=batch_progress["batch"] == batch_target'),
  "Batch progress throttling or forced epoch-tail persistence is missing",
);
assert.ok(
  trainer.includes('"localTrainingTokenCount"') ||
    trainer.includes("local_training_token_count="),
  "exact local model compute accounting is missing from live progress",
);
assert.ok(
  liveModule.includes("replace_atomic_with_bounded_windows_retry(temporary, target)") &&
    liveModule.includes("os.replace(source, target)") &&
    liveModule.includes("os.fsync(handle.fileno())"),
  "progress.json must use durable atomic replacement",
);
assert.ok(
  liveModule.includes("WINDOWS_ATOMIC_REPLACE_RETRY_ATTEMPTS = 8") &&
    liveModule.includes("WINDOWS_ATOMIC_REPLACE_RETRY_BASE_SECONDS = 0.05") &&
    liveModule.includes("frozenset({5, 32, 33})"),
  "Windows atomic replacement must use the fixed bounded retry contract",
);
assert.ok(
  !liveModule.includes("target.unlink()") &&
    !liveModule.includes('target.open("w"'),
  "progress.json must not be deleted or overwritten in place before replacement",
);

for (const field of [
  "batchTarget",
  "optimizerStepTarget",
  "optimizerStepsPerSecond",
  "rollingEpochLoss",
  "etaSeconds",
  "localTrainingTokenCount",
]) {
  assert.ok(types.includes(field), `typed live progress field is missing: ${field}`);
  assert.ok(server.includes(field), `server live progress projection is missing: ${field}`);
}
assert.ok(
  page.includes("实时Batch") &&
    page.includes("优化步") &&
    page.includes("实时速度") &&
    page.includes("本地计算Token"),
  "dashboard does not expose the Batch-level live fields",
);
for (const code of [
  "liveProgress.phase",
  "liveProgress.epoch",
  "liveProgress.batch",
  "liveProgress.optimizerStep",
  "liveProgress.optimizerStepsPerSecond",
  "liveProgress.etaSeconds",
  "liveProgress.batchLoss",
  "liveProgress.rollingEpochLoss",
  "liveProgress.localTrainingTokenCount",
  "liveProgress.recordedAtUtc",
  "liveProgress.recordedAtAsiaShanghai",
]) {
  assert.ok(
    dictionary.entries.some((entry) => entry.code === code),
    `model data dictionary is missing live progress field: ${code}`,
  );
}

const pythonCheck = String.raw`
import json
from pathlib import Path
import tempfile
import time
from ai_painter.complete_world.live_progress import build_live_progress, write_json_atomic

progress = build_live_progress(
    phase="training_batch",
    epoch=2,
    epoch_target=4,
    batch=5,
    batch_target=10,
    optimizer_step=15,
    optimizer_step_target=40,
    started_monotonic=time.perf_counter() - 10.0,
    batch_loss=1.25,
    rolling_epoch_loss=1.5,
    last_batch_duration_seconds=0.25,
    samples_in_batch=1,
    local_denoiser_sample_forward_passes=45,
    local_training_token_count=17280,
)
assert progress["phase"] == "training_batch"
assert progress["percentage"] == 37.5
assert progress["optimizerStepsPerSecond"] > 0
assert progress["etaSeconds"] > 0
assert progress["localTrainingTokenCount"] == 17280
assert progress["recordedAtUtc"].endswith("Z")
assert progress["recordedAtAsiaShanghai"].endswith("+08:00")

with tempfile.TemporaryDirectory(prefix="ai-painter-live-progress-check-") as directory:
    target = Path(directory) / "progress.json"
    write_json_atomic(target, {"version": 1})
    write_json_atomic(target, {"version": 2, "progress": progress})
    stored = json.loads(target.read_text(encoding="utf-8"))
    assert stored["version"] == 2
    assert stored["progress"]["batch"] == 5
    assert not list(target.parent.glob(".progress.json.*.tmp"))

print(json.dumps({"status": "batch_live_progress_non_training_simulation_passed", "trainingStarted": False}))
`;

const result = spawnSync(pythonPath, ["-B", "-c", pythonCheck], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    PYTHONPATH: path.join(root, "ml", "ai-painter", "src"),
    PYTHONDONTWRITEBYTECODE: "1",
  },
  windowsHide: true,
});
assert.equal(result.status, 0, result.stderr || result.stdout);
const simulation = JSON.parse(result.stdout.trim());
assert.equal(simulation.trainingStarted, false);

const retryCheck = String.raw`
import json
from pathlib import Path
import tempfile
import threading
import time
from unittest.mock import patch
from ai_painter.complete_world import live_progress

def windows_permission_error(code):
    error = PermissionError(13, "simulated Windows atomic replace contention")
    error.winerror = code
    return error

with tempfile.TemporaryDirectory(prefix="ai-painter-live-progress-retry-") as directory:
    target = Path(directory) / "progress.json"
    original_replace = live_progress.os.replace
    transient_calls = 0

    def transient_replace(source, destination):
        global transient_calls
        transient_calls += 1
        if transient_calls <= 3:
            raise windows_permission_error(5)
        return original_replace(source, destination)

    with patch.object(live_progress.os, "replace", transient_replace), patch.object(live_progress.time, "sleep", lambda _: None):
        live_progress.write_json_atomic(target, {"sequence": 1, "kind": "transient_recovery"})
    assert transient_calls == 4
    assert json.loads(target.read_text(encoding="utf-8"))["sequence"] == 1
    assert not list(target.parent.glob(".progress.json.*.tmp"))

    persistent_calls = 0
    def persistent_replace(source, destination):
        global persistent_calls
        persistent_calls += 1
        raise windows_permission_error(32)

    try:
        with patch.object(live_progress.os, "replace", persistent_replace), patch.object(live_progress.time, "sleep", lambda _: None):
            live_progress.write_json_atomic(target, {"sequence": 2})
    except PermissionError as error:
        assert error.winerror == 32
    else:
        raise AssertionError("persistent Windows contention did not fail closed")
    assert persistent_calls == live_progress.WINDOWS_ATOMIC_REPLACE_RETRY_ATTEMPTS
    assert json.loads(target.read_text(encoding="utf-8"))["sequence"] == 1
    assert not list(target.parent.glob(".progress.json.*.tmp"))

    non_transient_calls = 0
    def non_transient_replace(source, destination):
        global non_transient_calls
        non_transient_calls += 1
        raise windows_permission_error(87)

    try:
        with patch.object(live_progress.os, "replace", non_transient_replace), patch.object(live_progress.time, "sleep", lambda _: None):
            live_progress.write_json_atomic(target, {"sequence": 3})
    except PermissionError as error:
        assert error.winerror == 87
    else:
        raise AssertionError("non-transient Windows error was incorrectly retried")
    assert non_transient_calls == 1
    assert json.loads(target.read_text(encoding="utf-8"))["sequence"] == 1
    assert not list(target.parent.glob(".progress.json.*.tmp"))

    non_windows_calls = 0
    def non_windows_replace(source, destination):
        global non_windows_calls
        non_windows_calls += 1
        raise windows_permission_error(5)

    try:
        with patch.object(live_progress.os, "name", "posix"), patch.object(live_progress.os, "replace", non_windows_replace), patch.object(live_progress.time, "sleep", lambda _: None):
            live_progress.replace_atomic_with_bounded_windows_retry(target, target)
    except PermissionError as error:
        assert error.winerror == 5
    else:
        raise AssertionError("non-Windows replacement behavior was unexpectedly retried")
    assert non_windows_calls == 1
    assert json.loads(target.read_text(encoding="utf-8"))["sequence"] == 1
    assert not list(target.parent.glob(".progress.json.*.tmp"))

    native_transient_calls = None
    native_persistent_calls = None
    if live_progress.os.name == "nt":
        import ctypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateFileW.argtypes = [
            ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32,
            ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p,
        ]
        kernel32.CreateFileW.restype = ctypes.c_void_p
        kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel32.CloseHandle.restype = ctypes.c_int
        invalid_handle = ctypes.c_void_p(-1).value

        def hold_without_delete_share(seconds, ready):
            handle = kernel32.CreateFileW(
                str(target), 0x80000000, 0x00000001 | 0x00000002,
                None, 3, 0x00000080, None,
            )
            if handle == invalid_handle:
                raise OSError(ctypes.get_last_error(), "CreateFileW failed")
            ready.set()
            try:
                time.sleep(seconds)
            finally:
                kernel32.CloseHandle(handle)

        original_replace = live_progress.os.replace
        native_transient_calls = 0
        def counted_native_transient_replace(source, destination):
            global native_transient_calls
            native_transient_calls += 1
            return original_replace(source, destination)

        transient_ready = threading.Event()
        transient_holder = threading.Thread(
            target=hold_without_delete_share, args=(0.16, transient_ready), daemon=True
        )
        transient_holder.start()
        assert transient_ready.wait(2.0)
        with patch.object(live_progress.os, "replace", counted_native_transient_replace):
            live_progress.write_json_atomic(target, {"sequence": 5, "kind": "native_transient_recovery"})
        transient_holder.join(2.0)
        assert not transient_holder.is_alive()
        assert native_transient_calls > 1
        assert json.loads(target.read_text(encoding="utf-8"))["sequence"] == 5
        assert not list(target.parent.glob(".progress.json.*.tmp"))

        native_persistent_calls = 0
        def counted_native_persistent_replace(source, destination):
            global native_persistent_calls
            native_persistent_calls += 1
            return original_replace(source, destination)

        persistent_ready = threading.Event()
        persistent_holder = threading.Thread(
            target=hold_without_delete_share, args=(2.0, persistent_ready), daemon=True
        )
        persistent_holder.start()
        assert persistent_ready.wait(2.0)
        try:
            with patch.object(live_progress.os, "replace", counted_native_persistent_replace):
                live_progress.write_json_atomic(target, {"sequence": 6})
        except PermissionError as error:
            assert error.winerror in live_progress.WINDOWS_TRANSIENT_ATOMIC_REPLACE_ERROR_CODES
        else:
            raise AssertionError("persistent native Windows file lock did not fail closed")
        persistent_holder.join(3.0)
        assert not persistent_holder.is_alive()
        assert native_persistent_calls == live_progress.WINDOWS_ATOMIC_REPLACE_RETRY_ATTEMPTS
        assert json.loads(target.read_text(encoding="utf-8"))["sequence"] == 5
        assert not list(target.parent.glob(".progress.json.*.tmp"))

print(json.dumps({
    "status": "windows_atomic_replace_bounded_retry_regression_passed",
    "transientCalls": transient_calls,
    "persistentCalls": persistent_calls,
    "nonTransientCalls": non_transient_calls,
    "nonWindowsCalls": non_windows_calls,
    "nativeWindowsTransientCalls": native_transient_calls,
    "nativeWindowsPersistentCalls": native_persistent_calls,
    "trainingStarted": False,
}))
`;

const retryResult = spawnSync(pythonPath, ["-B", "-c", retryCheck], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    PYTHONPATH: path.join(root, "ml", "ai-painter", "src"),
    PYTHONDONTWRITEBYTECODE: "1",
  },
  windowsHide: true,
});
assert.equal(retryResult.status, 0, retryResult.stderr || retryResult.stdout);
const retryRegression = JSON.parse(retryResult.stdout.trim());
assert.equal(retryRegression.trainingStarted, false);

const stressDirectory = fs.mkdtempSync(path.join(process.env.TEMP, "ai-painter-progress-node-reader-"));
const stressTarget = path.join(stressDirectory, "progress.json");
const stressWriter = String.raw`
import json
from pathlib import Path
import sys
import time
from ai_painter.complete_world.live_progress import write_json_atomic

target = Path(sys.argv[1])
for sequence in range(1, 301):
    write_json_atomic(target, {
        "schemaVersion": "ai-painter-live-progress-concurrency-stress-v1",
        "sequence": sequence,
        "payload": "x" * 4096,
    })
    if sequence % 10 == 0:
        time.sleep(0.001)
print(json.dumps({"status": "python_atomic_writer_completed", "finalSequence": 300}))
`;

const stressChild = spawn(pythonPath, ["-B", "-c", stressWriter, stressTarget], {
  cwd: root,
  env: {
    ...process.env,
    PYTHONPATH: path.join(root, "ml", "ai-painter", "src"),
    PYTHONDONTWRITEBYTECODE: "1",
  },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let stressStdout = "";
let stressStderr = "";
let readAttempts = 0;
let validReads = 0;
let invalidReads = 0;
stressChild.stdout.on("data", (chunk) => { stressStdout += chunk.toString("utf8"); });
stressChild.stderr.on("data", (chunk) => { stressStderr += chunk.toString("utf8"); });
const reader = setInterval(() => {
  if (!fs.existsSync(stressTarget)) return;
  readAttempts += 1;
  try {
    const value = JSON.parse(fs.readFileSync(stressTarget, "utf8"));
    assert.equal(value.schemaVersion, "ai-painter-live-progress-concurrency-stress-v1");
    assert.ok(Number.isInteger(value.sequence) && value.sequence >= 1 && value.sequence <= 300);
    assert.equal(value.payload.length, 4096);
    validReads += 1;
  } catch {
    invalidReads += 1;
  }
}, 0);
const stressExit = await new Promise((resolveExit) => {
  stressChild.on("error", (error) => resolveExit({ code: null, error }));
  stressChild.on("close", (code, signal) => resolveExit({ code, signal }));
});
clearInterval(reader);
assert.equal(stressExit.code, 0, stressStderr || stressExit.error?.stack || stressStdout);
const writerReport = JSON.parse(stressStdout.trim());
assert.equal(writerReport.finalSequence, 300);
assert.ok(readAttempts > 0, "Node reader did not overlap the Python writer");
assert.ok(validReads > 0, "Node reader did not observe a complete progress record");
assert.equal(invalidReads, 0, "Node reader observed partial or invalid JSON");
const finalStressRecord = JSON.parse(fs.readFileSync(stressTarget, "utf8"));
assert.equal(finalStressRecord.sequence, 300);
assert.deepEqual(
  fs.readdirSync(stressDirectory).filter((name) => /^\.progress\.json\..+\.tmp$/.test(name)),
  [],
  "temporary progress evidence remained after the stress check",
);
fs.rmSync(stressDirectory, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      status: "ai_painter_v7_batch_live_progress_check_passed",
      nonTrainingSimulation: simulation,
      boundedRetryRegression: retryRegression,
      pythonWriterNodeReaderStress: {
        writerReport,
        readAttempts,
        validReads,
        invalidReads,
        finalSequence: finalStressRecord.sequence,
        temporaryFilesRemaining: 0,
      },
      atomicProgressWrite: true,
      dashboardProjection: true,
    },
    null,
    2,
  ),
);
