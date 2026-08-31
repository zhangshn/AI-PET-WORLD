import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { bindAbsolute } from "../lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs";
import {
  readPassedPhaseResult,
  validateResourceTelemetryEvidence,
  validateTrainingTokenAccounting,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-adapters-v1.mjs";
import { validateOuterFinalizationChain } from "../run-ai-painter-stage4-v2-controlled-smoke.mjs";


function write(root, relative, value) {
  const target = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return bindAbsolute(root, target);
}

function phaseFixture(phase) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-phase-chain-"));
  const executionRoot = path.join(root, "closed");
  const relative = `phase-evidence/${phase}-attempt-1.json`;
  const binding = write(root, `closed/${relative}`, {
    phase, attempt: 1, result: { status: "passed", output: `${phase}-output` },
  });
  fs.writeFileSync(path.join(executionRoot, "execution-state.json"), `${JSON.stringify({
    latestEvidence: { phase, attempt: 1, path: relative, sha256: binding.sha256 },
  }, null, 2)}\n`);
  const database = new DatabaseSync(path.join(executionRoot, "execution.sqlite"));
  database.exec("CREATE TABLE artifacts(package_identity TEXT,phase TEXT,attempt INTEGER,logical_path TEXT,sha256 TEXT)");
  database.prepare("INSERT INTO artifacts VALUES(?,?,?,?,?)").run(
    "stage4-v2-smoke-package-fixture", phase, 1, relative, binding.sha256,
  );
  database.close();
  return {
    root, executionRoot, relative, binding,
    context: { executionRoot, packageIdentity: "stage4-v2-smoke-package-fixture", projectRoot: root },
  };
}

{
  const value = phaseFixture("review");
  const statePath = path.join(value.executionRoot, "execution-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.latestEvidence.sha256 = "0".repeat(64);
  fs.writeFileSync(statePath, `${JSON.stringify(state)}\n`);
  assert.throws(() => readPassedPhaseResult(value.context, "review"),
    /state\/SQLite SHA-256 differs/u);
}

{
  const value = phaseFixture("review");
  const database = new DatabaseSync(path.join(value.executionRoot, "execution.sqlite"));
  database.prepare("INSERT INTO artifacts VALUES(?,?,?,?,?)").run(
    value.context.packageIdentity, "review", 2,
    value.relative, value.binding.sha256,
  );
  database.close();
  assert.throws(() => readPassedPhaseResult(value.context, "review"),
    /exactly one SQLite-bound passed artifact/u);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-smoke-chain-"));
  const packageId = "stage4-v2-smoke-package-fixture";
  const runId = "stage4-v2-smoke-run-fixture";
  const trainingManifest = write(root, "output/manifest.json", { status: "training_completed" });
  const resourceTelemetry = write(root, "output/resource.json", { status: "completed" });
  const reviewBinding = write(root, "output/review-binding.json", { status: "active_readonly_machine_review" });
  const machineReview = write(root, "output/machine-review.json", { status: "completed", previewPassCount: 5 });
  const reviewPhaseEvidence = write(root, "closed/phase-evidence/review-attempt-1.json", {
    phase: "review", attempt: 1,
    result: { status: "passed", machineReview, reviewExecutionBinding: reviewBinding },
  });
  const causal = write(root, "output/causal.json", {
    decision: "controlled_smoke_qualified",
    sourceMachineReview: machineReview,
    sourceReviewExecutionBinding: reviewBinding,
    sourceReviewPhaseEvidence: reviewPhaseEvidence,
  });
  const adjudicationPhaseEvidence = write(root,
    "closed/phase-evidence/adjudicate-attempt-1.json", {
      phase: "adjudicate", attempt: 1,
      result: { status: "passed", adjudication: causal },
    });
  const finalization = write(root, "output/finalization.json", {
    schemaVersion: "ai-painter-stage4-v2-controlled-smoke-finalization-v1",
    status: "stage4_v2_controlled_smoke_passed",
    packageId, runId,
    trainingManifest, machineReview, reviewExecutionBinding: reviewBinding,
    reviewPhaseEvidence, causalAdjudication: causal,
    adjudicationPhaseEvidence, resourceTelemetry,
  });
  return {
    root, payload: { packageId, runId }, finalization,
    genericTerminal: { finalResult: { finalization } },
    machineReview, causal,
  };
}

{
  const value = fixture();
  assert.equal(validateOuterFinalizationChain({
    root: value.root, payload: value.payload,
    genericTerminal: value.genericTerminal,
    smokeFinalizationBinding: value.finalization,
  }).status, "stage4_v2_controlled_smoke_passed");
  fs.writeFileSync(path.join(value.root, value.machineReview.path), '{"tampered":true}\n');
  assert.throws(() => validateOuterFinalizationChain({
    root: value.root, payload: value.payload,
    genericTerminal: value.genericTerminal,
    smokeFinalizationBinding: value.finalization,
  }), /machineReview changed/u);
}

{
  const value = fixture();
  fs.writeFileSync(path.join(value.root, value.causal.path), '{"tampered":true}\n');
  assert.throws(() => validateOuterFinalizationChain({
    root: value.root, payload: value.payload,
    genericTerminal: value.genericTerminal,
    smokeFinalizationBinding: value.finalization,
  }), /causalAdjudication changed/u);
}

for (const phase of ["review", "adjudicate"]) {
  const value = phaseFixture(phase);
  assert.equal(readPassedPhaseResult(value.context, phase).result.status, "passed");
  fs.writeFileSync(path.join(value.executionRoot, value.relative), `${JSON.stringify({
    phase, attempt: 1, result: { status: "passed", output: "substituted" },
  })}\n`);
  assert.throws(() => readPassedPhaseResult(value.context, phase),
    /phase evidence bytes changed/u);
}

{
  const epoch = {
    latentSpatialTokens: 1, latentChannelValues: 12, conditionScalars: 23,
    rgbPredictionPixels: 49_152, samplePresentations: 1, optimizerSteps: 1,
    modelForwardPasses: 1, validationTrajectories: 1,
    calculationVersion: "stage4_v2_controlled_smoke_exact_loop_v1",
  };
  const accounting = {
    schemaVersion: "ai-assisted-local-training-token-accounting-v1",
    isNlpToken: false,
    perEpoch: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [
      String(index + 1), { ...epoch },
    ])),
    runTotals: Object.fromEntries(Object.entries(epoch).map(([key, value]) => [
      key, typeof value === "number" ? value * 30 : value,
    ])),
  };
  assert.equal(validateTrainingTokenAccounting(accounting, "fixture"), true);
  const changed = structuredClone(accounting);
  delete changed.perEpoch["10"].conditionScalars;
  assert.throws(() => validateTrainingTokenAccounting(changed, "fixture"),
    /conditionScalars/u);
}

function telemetryFixture() {
  const packageId = "stage4-v2-smoke-package-fixture";
  const runId = "stage4-v2-smoke-run-fixture";
  const row = (recordedAtUtc, phase, epoch, optimizerStep, peak) => ({
    recordedAtUtc, phase, epoch, optimizerStep,
    gpuUtilizationPercent: phase === "initializing" ? 0 : 91,
    deviceMemoryUsedMiB: phase === "initializing" ? 512 : 4096,
    deviceMemoryUsedBytes: (phase === "initializing" ? 512 : 4096) * 1024 * 1024,
    processMemoryAllocatedBytes: phase === "initializing" ? 64 : peak - 32,
    processMemoryReservedBytes: phase === "initializing" ? 128 : peak + 64,
    processPeakGpuMemoryBytes: peak,
  });
  return {
    payload: { packageId, runId },
    telemetry: {
      schemaVersion: "ai-painter-stage4-v2-controlled-smoke-resource-telemetry-v1",
      status: "completed", packageId, runId,
      samplingIntervalSeconds: 10,
      peakGpuMemoryBytes: 8192,
      programPeakGpuMemoryBytes: 8192,
      preflightMemoryClaimedAsTrainingPeak: false,
      records: [
        row("2026-09-01T00:00:00.000Z", "initializing", 0, 0, 128),
        row("2026-09-01T00:00:10.000Z", "training", 1, 0, 4096),
        row("2026-09-01T00:00:20.000Z", "epoch_completed", 1, 1, 6144),
        row("2026-09-01T00:05:00.000Z", "training_completed", 30, 30, 8192),
      ],
    },
  };
}

{
  const value = telemetryFixture();
  assert.equal(validateResourceTelemetryEvidence(value), true);
}

{
  const value = telemetryFixture();
  value.telemetry.runId = "stage4-v2-smoke-cross-run";
  assert.throws(() => validateResourceTelemetryEvidence(value),
    /crosses the immutable Smoke run boundary/u);
}

{
  const value = telemetryFixture();
  value.telemetry.peakGpuMemoryBytes += 1;
  assert.throws(() => validateResourceTelemetryEvidence(value),
    /peakGpuMemoryBytes is forged or stale/u);
}

{
  const value = telemetryFixture();
  value.telemetry.records = value.telemetry.records.slice(0, 1);
  value.telemetry.records.push({
    recordedAtUtc: "2026-09-01T00:00:10.000Z", phase: "preflight",
    epoch: 0, optimizerStep: 0, gpuUtilizationPercent: 0,
    deviceMemoryUsedMiB: 512, deviceMemoryUsedBytes: 512 * 1024 * 1024,
    processMemoryAllocatedBytes: 64, processMemoryReservedBytes: 128,
    processPeakGpuMemoryBytes: 128,
  });
  assert.throws(() => validateResourceTelemetryEvidence(value),
    /phase is invalid/u);
}

{
  const value = telemetryFixture();
  value.telemetry.records[1] = {
    recordedAtUtc: "2026-09-01T00:00:10.000Z", phase: "training",
    epoch: 1, optimizerStep: 0, telemetryError: "nvidia-smi unavailable",
  };
  assert.throws(() => validateResourceTelemetryEvidence(value),
    /error sample/u);
}

process.stdout.write("Stage4 V2 Smoke evidence/telemetry: 6 positive + 11 negative cases passed\n");
