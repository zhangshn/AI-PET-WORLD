import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  liveModule.includes("os.replace(temporary, target)") &&
    liveModule.includes("os.fsync(handle.fileno())"),
  "progress.json must use durable atomic replacement",
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

console.log(
  JSON.stringify(
    {
      ok: true,
      status: "ai_painter_v7_batch_live_progress_check_passed",
      nonTrainingSimulation: simulation,
      atomicProgressWrite: true,
      dashboardProjection: true,
    },
    null,
    2,
  ),
);
