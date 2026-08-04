import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  beginLocalTaskRun,
  LocalTaskRunStoreError,
  simulateLocalTaskLifecycle,
} from "../src/server/ai-painter-local-task-run-store.mjs";

const root = process.cwd();
const read = (value) => fs.readFileSync(path.join(root, value), "utf8");
const catalog = JSON.parse(read("data/ai-painter/system-governance/local-ai-task-catalog-v1.json"));
const storeSource = read("src/server/ai-painter-local-task-run-store.mjs");
const serverSource = read("src/server/ai-painter-local-task-console.ts");
const apiSource = read("src/app/api/ai-painter/task-console/route.ts");
const pageSource = read("src/app/ai-painter-progress/task-console/task-console.tsx");
const navigationSource = read("src/app/ai-painter-progress/progress-client.tsx");

assert.equal(catalog.schemaVersion, "local-ai-task-catalog-v1");
assert.ok([
  "phase1_preview_only",
  "phase2_failure_learning_contract_preview",
  "phase2_r3_candidate_cpu_verified_training_not_authorized",
].includes(catalog.status));
assert.equal(catalog.executionPolicy.allowArbitraryCommands, false);
assert.equal(catalog.executionPolicy.phase1RealLaunchEnabled, false);
assert.ok(catalog.tasks.length >= 4);
assert.ok(catalog.tasks.every((task) => task.executionCommand === null));
assert.ok(catalog.tasks.some((task) => task.recommendedNow));
assert.ok(catalog.tasks.every((task) => task.inputs.length && task.plannedSteps.length && task.excludedPermissions.length));

assert.ok(apiSource.includes("export async function GET"));
assert.ok(!apiSource.includes("export async function POST"));
assert.ok(serverSource.includes("launchEnabled: false"));
assert.ok(serverSource.includes("owner_key_provisioning_required"));
assert.ok(serverSource.includes("AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256"));
assert.ok(serverSource.includes("local-ai-failure-learning-r3-candidates/latest.json"));
assert.ok(pageSource.includes('data-testid="local-task-selector"'));
assert.ok(pageSource.includes('data-testid="local-task-contract-preview"'));
assert.ok(pageSource.includes('data-testid="local-task-launch-button"'));
assert.ok(pageSource.includes("disabled={!snapshot.launchEnabled}"));
assert.ok(pageSource.includes("本按钮不会发出POST请求"));
assert.ok(pageSource.includes('data-testid="local-ai-r3-candidate-terminal"'));
assert.ok(navigationSource.includes('href: "/ai-painter-progress/task-console"'));

assert.ok(!storeSource.includes("child_process"));
assert.ok(!storeSource.includes("spawn("));
assert.ok(!storeSource.includes("exec("));
assert.ok(storeSource.includes('fs.openSync(lockPath, "wx")'));
assert.ok(storeSource.includes("fs.fsyncSync(handle)"));
assert.ok(storeSource.includes("fs.renameSync(temporary, target)"));
assert.ok(storeSource.includes("writeImmutableJsonAtomic(startPath"));
assert.ok(storeSource.includes("writeImmutableJsonAtomic(terminalPath"));

const simulationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-task-console-phase1-"));
try {
  const taskContract = catalog.tasks.find((task) => task.recommendedNow);
  const successRoot = path.join(simulationRoot, "success");
  const success = simulateLocalTaskLifecycle({ storeRoot: successRoot, taskContract });
  const successStart = JSON.parse(fs.readFileSync(success.run.startPath, "utf8"));
  const successTerminal = JSON.parse(fs.readFileSync(success.run.terminalPath, "utf8"));
  assert.equal(successStart.status, "simulation_started");
  assert.equal(successStart.noTrainingStarted, true);
  assert.equal(successTerminal.status, "completed");
  assert.equal(successTerminal.noTrainingStarted, true);
  assert.ok(fs.existsSync(path.join(successRoot, "latest.json")));
  assert.equal(fs.existsSync(path.join(successRoot, "active-task.lock")), false);

  const failureRoot = path.join(simulationRoot, "failure");
  const failure = simulateLocalTaskLifecycle({ storeRoot: failureRoot, taskContract, fail: true });
  const failureTerminal = JSON.parse(fs.readFileSync(failure.run.terminalPath, "utf8"));
  assert.equal(failureTerminal.status, "failed");
  assert.equal(failureTerminal.errorCode, "simulated_failure");
  assert.equal(failureTerminal.noTrainingStarted, true);

  const mutexRoot = path.join(simulationRoot, "mutex");
  const held = beginLocalTaskRun({ storeRoot: mutexRoot, taskContract, simulation: true });
  assert.throws(
    () => beginLocalTaskRun({ storeRoot: mutexRoot, taskContract, simulation: true }),
    (error) => error instanceof LocalTaskRunStoreError && error.code === "task_mutex_locked",
  );
  held.fail(new LocalTaskRunStoreError("互斥锁模拟结束。", "mutex_simulation_complete"));

  assert.throws(
    () => beginLocalTaskRun({ storeRoot: path.join(simulationRoot, "real-launch"), taskContract, simulation: false }),
    (error) => error instanceof LocalTaskRunStoreError && error.code === "trusted_owner_authorization_required",
  );

  const temporaryFiles = walk(simulationRoot).filter((value) => value.endsWith(".tmp"));
  assert.deepEqual(temporaryFiles, []);

  console.log(JSON.stringify({
    ok: true,
    status: "ai_painter_local_task_console_phase1_check_passed",
    taskCatalogCount: catalog.tasks.length,
    successfulLifecycleSimulation: true,
    failedLifecycleSimulation: true,
    mutexSimulation: true,
    realLaunchBlockedWithoutTrustedOwnerAuthorization: true,
    trainingStarted: false,
  }, null, 2));
} finally {
  fs.rmSync(simulationRoot, { recursive: true, force: true });
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}
