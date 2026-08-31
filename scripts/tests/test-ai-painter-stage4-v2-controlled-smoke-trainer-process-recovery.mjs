import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  monitorExistingTrainerProcess,
  observeTrainerProcess,
  prepareTrainerProcessIntent,
  recoverCompletedSmokeTrainingExecution,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs";
import { bindAbsolute } from "../lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-trainer-process-"));
const packageRoot = path.join(root, "package");
fs.mkdirSync(packageRoot, { recursive: true });
const command = path.join(root, "python.exe");
const config = path.join(packageRoot, "active-config.json");
fs.writeFileSync(command, "fixture");
fs.writeFileSync(config, "{}\n");
const payload = {
  packageId: "stage4-v2-smoke-package-process-fixture",
  runId: "stage4-v2-smoke-run-process-fixture",
  outputDirectory: ".runtime/output/process-fixture",
};
const trainerProcess = prepareTrainerProcessIntent({
  projectRoot: root, payload, packageRoot, command,
  args: ["--expected-config-sha256", bindAbsolute(root, config).sha256],
  activeConfigBinding: bindAbsolute(root, config),
});
const active = {
  status: "active", processId: 4242,
  processStartIdentity: "4242:2026-09-01T00:00:00.000Z",
};
const record = {
  schemaVersion: "ai-painter-stage4-v2-controlled-smoke-trainer-process-v1",
  state: "running", packageId: payload.packageId, runId: payload.runId,
  processId: active.processId, processStartIdentity: active.processStartIdentity,
  processDiscoveryMarker: trainerProcess.intent.processDiscoveryMarker,
  outputDirectory: payload.outputDirectory,
  startedAtUtc: "2026-09-01T00:00:00.000Z",
  heartbeatAtUtc: "2026-09-01T00:00:00.000Z",
  exitCode: null, completedAtUtc: null,
};

try {
  assert.equal(observeTrainerProcess({
    trainerProcess, projectRoot: root,
    processProbe: () => ({ status: "dead" }),
    processDiscovery: () => ({ status: "ok", rows: [] }),
  }).status, "absent");
  assert.equal(observeTrainerProcess({
    trainerProcess, projectRoot: root,
    processProbe: () => active,
    processDiscovery: () => ({ status: "ok", rows: [active, {
      ...active, processId: 4343,
      processStartIdentity: "4343:2026-09-01T00:00:00.000Z",
    }] }),
  }).status, "indeterminate", "multiple matching Trainers were accepted");
  assert.equal(observeTrainerProcess({
    trainerProcess, projectRoot: root,
    processProbe: () => active,
    processDiscovery: () => ({
      status: "indeterminate", reason: "WMI_unavailable", rows: [],
    }),
  }).status, "indeterminate", "indeterminate discovery was accepted");

  const discovered = observeTrainerProcess({
    trainerProcess, projectRoot: root,
    processProbe: () => active,
    processDiscovery: () => ({ status: "ok", rows: [active] }),
  });
  assert.equal(discovered.status, "active");
  assert.equal(fs.existsSync(trainerProcess.processRecordPath), true,
    "marker discovery did not persist the exact Trainer identity");

  assert.equal(observeTrainerProcess({
    trainerProcess, projectRoot: root,
    processProbe: () => active,
    processDiscovery: () => { throw new Error("discovery must not run"); },
  }).status, "active");

  assert.equal(observeTrainerProcess({
    trainerProcess, projectRoot: root,
    processProbe: () => ({
      ...active, processStartIdentity: "4242:2026-09-01T01:00:00.000Z",
    }),
    processDiscovery: () => { throw new Error("discovery must not run"); },
  }).status, "indeterminate", "PID reuse was accepted");

  let probeCount = 0;
  const context = {
    heartbeatCount: 0,
    heartbeat() { this.heartbeatCount += 1; },
    reportProgress() { this.heartbeatCount += 1; },
  };
  assert.equal((await monitorExistingTrainerProcess({
    trainerProcess, observation: discovered,
    progressPath: path.join(root, "missing-progress.json"), context,
    processProbe: () => (++probeCount === 1 ? active : { status: "dead" }),
    wait: async () => {}, timeoutMs: 1000,
  })).status, "dead");
  assert.ok(context.heartbeatCount >= 1,
    "attached Trainer monitoring did not refresh execution activity");
  assert.equal(JSON.parse(fs.readFileSync(
    trainerProcess.processRecordPath, "utf8",
  )).state, "exited_observed_by_recovery");

  fs.rmSync(trainerProcess.processRecordPath);
  fs.writeFileSync(trainerProcess.spawnInvocationPath, `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-trainer-spawn-invocation-v1",
    status: "spawn_invoked_no_retry", packageId: payload.packageId,
    runId: payload.runId,
    processDiscoveryMarker: trainerProcess.intent.processDiscoveryMarker,
    outputDirectory: payload.outputDirectory,
    invokedAtUtc: "2026-09-01T00:00:00.000Z",
  }, null, 2)}\n`);
  assert.equal(observeTrainerProcess({
    trainerProcess, projectRoot: root,
    processProbe: () => ({ status: "dead" }),
    processDiscovery: () => ({ status: "ok", rows: [] }),
  }).status, "dead", "a dead invoked Trainer was treated as restartable");

  fs.writeFileSync(trainerProcess.processRecordPath,
    `${JSON.stringify({ ...record, state: "exited", exitCode: 0 }, null, 2)}\n`);
  assert.equal(observeTrainerProcess({
    trainerProcess, projectRoot: root,
    processProbe: () => { throw new Error("terminal process must not be probed"); },
    processDiscovery: () => { throw new Error("terminal process must not be discovered"); },
  }).status, "dead");

  const completedOutput = path.join(root, "completed-output");
  fs.mkdirSync(completedOutput);
  fs.writeFileSync(path.join(completedOutput, "manifest.json"), "{}\n");
  fs.writeFileSync(path.join(completedOutput, "progress.json"), `${JSON.stringify({
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-progress-v1",
    status: "completed", phase: "training_completed",
    packageId: payload.packageId, runId: payload.runId,
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation", epoch: 30, epochTarget: 30,
    optimizerStep: 30, optimizerStepTarget: 30, percent: 100,
  }, null, 2)}\n`);
  const parentEvidence = path.join(root, "parent-evidence.json");
  const activeConfig = path.join(root, "active-config-evidence.json");
  fs.writeFileSync(parentEvidence, "{}\n");
  fs.writeFileSync(activeConfig, "{}\n");
  const consumptionBinding = bindAbsolute(root, parentEvidence);
  const activeConfigBinding = bindAbsolute(root, activeConfig);
  const materialization = {
    status: "committed",
    parentAtomicConsumption: {
      path: consumptionBinding.path, sha256: consumptionBinding.sha256,
    },
    activeConfig: {
      path: activeConfigBinding.path, sha256: activeConfigBinding.sha256,
    },
  };
  assert.equal(recoverCompletedSmokeTrainingExecution({
    projectRoot: root, payload, outputRoot: completedOutput,
    consumptionBinding, activeConfigBinding, materialization,
    manifestValidator: () => ({
      checkpoint: { path: "checkpoint.pt", sha256: "a".repeat(64) },
      previews: [{}, {}, {}, {}, {}],
    }),
  }).status, "passed", "dead Trainer complete output was not recovered read-only");
  const partialOutput = path.join(root, "partial-output");
  fs.mkdirSync(partialOutput);
  assert.throws(() => recoverCompletedSmokeTrainingExecution({
    projectRoot: root, payload, outputRoot: partialOutput,
    consumptionBinding, activeConfigBinding, materialization,
    manifestValidator: () => { throw new Error("must not run"); },
  }), /partial Smoke output/u, "dead Trainer partial output was accepted");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

process.stdout.write("Stage4 V2 Smoke Trainer process recovery: marker/exact-active/PID-reuse/multiple/indeterminate/dead-complete/dead-partial cases passed.\n");
