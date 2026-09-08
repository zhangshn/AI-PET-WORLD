// One bounded experiment controller using the existing current-registry writer.
// No capability publication, formal-stage advancement, restart or shutdown API.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readCurrentExecutionRegistry, advanceCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";

const root = process.cwd();
const python = path.join(root, "ml/ai-painter/.venv/Scripts/python.exe");
const worker = "ml/ai-painter/scripts/painter_learning_capacity_experiment.py";
const env = { ...process.env, PYTHONPATH: [path.join(root, "ml/ai-painter/src"), path.join(root, "ml/ai-painter/scripts")].join(path.delimiter), PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1", CUBLAS_WORKSPACE_CONFIG: ":4096:8" };
const sha = data => createHash("sha256").update(data).digest("hex");
const bind = logical => ({ path: logical, sha256: sha(fs.readFileSync(path.join(root, logical))) });
const read = logical => JSON.parse(fs.readFileSync(path.join(root, logical), "utf8"));
function write(logical, value, mutable = false) {
  const target = path.join(root, logical);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = mutable ? target + ".tmp" : target;
  const fd = fs.openSync(temporary, mutable ? "w" : "wx");
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  if (mutable) fs.renameSync(temporary, target);
}
function runCpu(args, timeout = 120000) {
  const result = spawnSync(python, args, { cwd: root, env, encoding: "utf8", windowsHide: true, timeout, maxBuffer: 2 ** 22 });
  if (result.error || result.status !== 0) throw new Error(`CPU operation failed: ${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`);
  return result;
}
function processIdentity() {
  const script = `$p=Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${process.pid}'; [pscustomobject]@{ processId=[int]$p.ProcessId; creationDate=$p.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  assert.equal(result.status, 0, "controller process identity unavailable");
  const value = JSON.parse(result.stdout.replace(/^\uFEFF/u, ""));
  return `${process.pid}:${value.creationDate}`;
}
function stopOwnedWorker(child) {
  if (!child || child.exitCode !== null || !Number.isInteger(child.pid)) return;
  if (process.platform === "win32") {
    // The venv redirector owns the real interpreter. Stop only this spawned tree.
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 10000, encoding: "utf8" });
  } else child.kill("SIGTERM");
}

async function main() {
  const mode = process.argv[2];
  assert(["prepare", "run"].includes(mode) && process.argv.length === 3, "usage: node scripts/run-ai-painter-learning-capacity-experiment.mjs prepare|run");
  const entry = read("data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json");
  assert(entry.currentEntrypoints.some(e => e.entryFile === "scripts/run-ai-painter-learning-capacity-experiment.mjs"), "experiment controller is not registered");
  const previous = await readCurrentExecutionRegistry(root);
  assert(previous.ok && previous.registry.activeExecution === null, "current registry is invalid or an execution is active");
  const cpu = runCpu(["-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", "test_learning_capacity_experiment.py", "-v"]);
  const packageBinding = JSON.parse(runCpu([worker, "prepare"]).stdout.trim());
  const pkg = read(packageBinding.path);
  assert.equal(bind(packageBinding.path).sha256, packageBinding.sha256);
  const directory = path.posix.dirname(packageBinding.path);
  const cpuPath = `${directory}/cpu-tests.json`;
  if (!fs.existsSync(path.join(root, cpuPath))) write(cpuPath, { status: "experiment_cpu_behavior_tests_passed", executionState: "completed", recordedAtUtc: new Date().toISOString(), stdout: cpu.stdout, stderr: cpu.stderr, package: packageBinding });
  console.log(JSON.stringify({ status: "experiment_prepared_not_gpu_started", package: packageBinding, cpu: bind(cpuPath) }));
  if (mode === "prepare") return;
  assert(!fs.existsSync(path.join(root, directory, "controller-started.json")), "experiment already consumed; no automatic restart");
  write(`${directory}/controller-started.json`, { recordedAtUtc: new Date().toISOString(), previousRegistry: { revision: previous.registry.registryRevision, sha256: previous.registrySha256 }, package: packageBinding });
  const runId = pkg.experimentIdentity;
  const identity = { capabilityVersion: runId, packageId: runId, runId, processId: process.pid, processStartIdentity: processIdentity() };
  const lockPath = `${directory}/execution-lock.json`;
  const heartbeatPath = `${directory}/heartbeat.json`;
  write(lockPath, { schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity });
  const heartbeat = () => write(heartbeatPath, { schemaVersion: "ai-painter-current-active-execution-heartbeat-v1", ...identity, executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120 }, true);
  heartbeat();
  const timer = setInterval(heartbeat, 10000);
  const active = { schemaVersion: "ai-painter-current-active-execution-v1", ...identity, executionState: "executing", programLineage: { controller: bind("scripts/run-ai-painter-learning-capacity-experiment.mjs"), worker: bind(worker) }, lock: bind(lockPath), heartbeat: { path: heartbeatPath, ttlSeconds: 120 } };
  const capsule = (logical, evidence) => write(logical, { schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId, integrity: { status: "verified" }, evidence: evidence.map((b, i) => ({ ...b, kind: `experiment_${i}`, sha256Verified: true })) });
  const cpuCapsule = `${directory}/cpu-capsule.json`;
  capsule(cpuCapsule, [packageBinding, bind(cpuPath)]);
  let registered = false;
  let child = null;
  try {
    const activeResult = await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId, taskId: runId,
      taskKind: "bounded_train_only_learning_capacity_experiment", taskGoal: "256x192 real training and checkpoint reload experiment; no formal qualification or publication", queueStatus: "running", nextMachineAction: null,
      runId, lifecycleStage: "isolated_implementation", executionState: "executing", activity: "experiment_running_not_formal_stage4", taskCapsulePath: cpuCapsule, terminalEvidencePath: cpuPath,
      activeExecution: active, expectedPreviousRegistryRevision: previous.registry.registryRevision, expectedPreviousRegistrySha256: previous.registrySha256 });
    assert(activeResult.ok, "experiment active registry commit failed");
    registered = true;
    let timedOut = false;
    const code = await new Promise((resolve, reject) => {
      child = spawn(python, [worker, "run", "--package", packageBinding.path, "--sha256", packageBinding.sha256], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      write(`${directory}/controller-lease.json`, { experimentIdentity: runId, workerParentPid: process.pid, workerLauncherPid: child.pid,
        registryRevision: activeResult.registry.registryRevision, registrySha256: activeResult.registrySha256 });
      const log = fs.createWriteStream(path.join(root, directory, "worker.log"), { flags: "wx" });
      child.stdout.on("data", data => { log.write(data); process.stdout.write(data); });
      child.stderr.on("data", data => { log.write(data); process.stderr.write(data); });
      const timeout = setTimeout(() => { timedOut = true; stopOwnedWorker(child); }, (pkg.resources.maxWallSeconds + 30) * 1000);
      child.once("error", error => { clearTimeout(timeout); log.end(); reject(error); });
      child.once("close", exitCode => { clearTimeout(timeout); log.end(); resolve(exitCode); });
    });
    const resultPath = `${directory}/result.json`;
    const result = fs.existsSync(path.join(root, resultPath)) ? read(resultPath) : null;
    const success = code === 0 && result?.status === "experiment_executed_not_visual_qualified" && result?.checkpointReloadExact === true;
    if (success) for (const artifact of result.artifacts) assert.equal(bind(artifact.path).sha256, artifact.sha256, "experiment output hash changed");
    const terminalPath = `${directory}/terminal.json`;
    write(terminalPath, { schemaVersion: "ai-painter-learning-capacity-experiment-terminal-v1", status: success ? "experiment_completed_not_formal_qualified" : "experiment_failed_closed",
      executionState: success ? "completed" : "failed_closed", experimentIdentity: runId, runId, recordedAtUtc: new Date().toISOString(), exitCode: code, timedOut,
      result: result ? bind(resultPath) : null, gpuStarted: result?.gpuStarted ?? null, trainingStarted: result?.trainingStarted ?? null,
      formalTrainingQualified: false, formalStageAdvanced: false, checkpointPromotable: false, worldEntryAllowed: false });
    const terminalCapsule = `${directory}/terminal-capsule.json`;
    capsule(terminalCapsule, [packageBinding, bind(cpuPath), bind(terminalPath), ...(result ? [bind(resultPath)] : [])]);
    const current = await readCurrentExecutionRegistry(root);
    assert(current.ok && current.registry.runId === runId, "current execution changed during experiment");
    const done = await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId, taskId: runId,
      taskKind: "bounded_train_only_learning_capacity_experiment", taskGoal: "Inspect the saved 256x192 experimental evidence; no formal release", queueStatus: success ? "completed" : "failed_closed", nextMachineAction: null,
      runId, lifecycleStage: "isolated_implementation", executionState: success ? "completed" : "failed_closed", activity: success ? "experiment_completed" : "experiment_failed_closed",
      taskCapsulePath: terminalCapsule, terminalEvidencePath: terminalPath, activeExecution: null,
      latestTrainingTerminal: result?.trainingStarted ? { runId, ...bind(terminalPath), status: read(terminalPath).status, evidence: { manifest: bind(resultPath) } } : null,
      expectedPreviousRegistryRevision: current.registry.registryRevision, expectedPreviousRegistrySha256: current.registrySha256 });
    assert(done.ok, `experiment terminal registry commit failed: ${done.errorCode ?? "unknown"}`);
    console.log(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), registryRevision: done.registry.registryRevision }));
    if (!success) process.exitCode = 1;
  } catch (error) {
    if (child && child.exitCode === null) {
      await new Promise(resolve => { child.once("close", resolve); stopOwnedWorker(child); setTimeout(resolve, 10000); });
    }
    const errorPath = `${directory}/controller-failure.json`;
    if (!fs.existsSync(path.join(root, errorPath))) write(errorPath, { status: "experiment_controller_failed_closed", executionState: "failed_closed", registered, error: error.stack, recordedAtUtc: new Date().toISOString() });
    if (registered) {
      const current = await readCurrentExecutionRegistry(root);
      if (current.ok && current.registry.runId === runId && current.registry.activeExecution !== null) {
        const failureCapsule = `${directory}/controller-failure-capsule.json`;
        capsule(failureCapsule, [packageBinding, bind(errorPath)]);
        await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId,
          taskId: runId, taskKind: "bounded_train_only_learning_capacity_experiment", queueStatus: "failed_closed", nextMachineAction: null,
          runId, lifecycleStage: "isolated_implementation", executionState: "failed_closed", activity: "experiment_controller_failed_closed",
          taskCapsulePath: failureCapsule, terminalEvidencePath: errorPath, activeExecution: null,
          expectedPreviousRegistryRevision: current.registry.registryRevision, expectedPreviousRegistrySha256: current.registrySha256 });
      }
    }
    throw error;
  } finally { clearInterval(timer); }
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
