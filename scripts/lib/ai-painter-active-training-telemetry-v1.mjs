// Training-supervisor adapter for future runs. It never discovers a run from
// directories and never supplies telemetry from the console query service.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import path from "node:path"

import { readCurrentExecutionRegistry } from
  "../../src/server/ai-painter-current-execution-registry.mjs"
import {
  aiConsoleTrainingTelemetryLogicalPath,
  recordAiConsoleTrainingTelemetry,
} from "../../src/server/ai-console-observability/training-telemetry-store.ts"

export const activeTrainingTelemetryReporterIdentity =
  "ai_painter_active_training_supervisor_v1"

const safeIdentity = value => typeof value === "string"
  && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,191}$/u.test(value)
const finiteOrNull = (value, name) => {
  assert.ok(value === null || (typeof value === "number"
    && Number.isFinite(value) && value >= 0), `training_telemetry_${name}_invalid`)
  return value
}
const integer = (value, name) => {
  assert.ok(Number.isSafeInteger(value) && value >= 0,
    `training_telemetry_${name}_invalid`)
  return value
}

export function normalizeActiveTrainingProgress(progress) {
  assert.ok(progress && Object.getPrototypeOf(progress) === Object.prototype,
    "training_telemetry_progress_invalid")
  const allowed = new Set(["epoch", "batchIndex", "batchCount",
    "optimizationStep", "loss", "learningRate", "throughputSamplesPerSecond",
    "estimatedCompletionAtUtc", "checkpointIdentity"])
  assert.ok(Object.keys(progress).every(key => allowed.has(key)),
    "training_telemetry_untrusted_identity_or_field")
  const epoch = integer(progress.epoch, "epoch")
  const optimizationStep = integer(progress.optimizationStep, "optimization_step")
  const batchIndex = progress.batchIndex ?? null
  const batchCount = progress.batchCount ?? null
  if (batchIndex !== null) integer(batchIndex, "batch_index")
  if (batchCount !== null) integer(batchCount, "batch_count")
  assert.ok(batchIndex === null || batchCount === null || batchIndex <= batchCount,
    "training_telemetry_batch_relation_invalid")
  const estimatedCompletionAtUtc = progress.estimatedCompletionAtUtc ?? null
  assert.ok(estimatedCompletionAtUtc === null ||
    (typeof estimatedCompletionAtUtc === "string"
      && estimatedCompletionAtUtc.endsWith("Z")
      && Number.isFinite(Date.parse(estimatedCompletionAtUtc))),
  "training_telemetry_eta_invalid")
  const checkpointIdentity = progress.checkpointIdentity ?? null
  assert.ok(checkpointIdentity === null || safeIdentity(checkpointIdentity),
    "training_telemetry_checkpoint_identity_invalid")
  return {
    epoch, batchIndex, batchCount, optimizationStep,
    loss: finiteOrNull(progress.loss ?? null, "loss"),
    learningRate: finiteOrNull(progress.learningRate ?? null, "learning_rate"),
    throughputSamplesPerSecond: finiteOrNull(
      progress.throughputSamplesPerSecond ?? null, "throughput"),
    estimatedCompletionAtUtc, checkpointIdentity,
  }
}

export function authorizeActiveTrainingTelemetry(registryResult, identity) {
  assert.equal(registryResult?.ok, true,
    registryResult?.errorCode ?? "training_telemetry_registry_unverified")
  const registry = registryResult.registry
  const active = registry?.activeExecution
  assert.ok(active && registry.executionState === "executing"
    && active.executionState === "executing",
  "training_telemetry_no_active_execution")
  assert.ok(registry.runId === identity.runId && active.runId === identity.runId
    && registry.packageId === identity.packageId
    && active.packageId === identity.packageId,
  "training_telemetry_run_or_package_mismatch")
  assert.ok(safeIdentity(registry.lifecycleStage),
    "training_telemetry_registered_stage_invalid")
  // readCurrentExecutionRegistry verifies the bound lock, live heartbeat,
  // program lineage and OS process start identity before returning ok=true.
  assert.ok(active.processId === identity.processId
    && typeof active.processStartIdentity === "string"
    && active.processStartIdentity.startsWith(`${identity.processId}:`),
  "training_telemetry_not_active_supervisor_process")
  return active
}

export function buildBoundTrainingTelemetryInput(active, progress, processId,
  heartbeatAtUtc, registeredStage) {
  assert.ok(safeIdentity(registeredStage), "training_telemetry_registered_stage_invalid")
  const executionId = createHash("sha256")
    .update(`${active.packageId}\u0000${active.processStartIdentity}`).digest("hex")
  return {
    runId: active.runId, executionId, processId,
    trainingStage: registeredStage,
    ...progress, heartbeatAtUtc,
    reporterIdentity: activeTrainingTelemetryReporterIdentity,
  }
}

export function createActiveTrainingTelemetryReporter({
  projectRoot = process.cwd(), runId, packageId,
}) {
  assert.ok(safeIdentity(runId) && safeIdentity(packageId),
    "training_telemetry_expected_identity_invalid")
  const root = realpathSync(projectRoot)
  const storePath = path.join(root, ...aiConsoleTrainingTelemetryLogicalPath.split("/"))
  let last = null
  return async function reportActiveTrainingProgress(progress) {
    const next = normalizeActiveTrainingProgress(progress)
    assert.ok(last === null || (next.epoch >= last.epoch
      && next.optimizationStep >= last.optimizationStep),
    "training_telemetry_progress_regressed")
    const verified = await readCurrentExecutionRegistry(root)
    const active = authorizeActiveTrainingTelemetry(verified,
      { runId, packageId, processId: process.pid })
    const input = buildBoundTrainingTelemetryInput(active, next, process.pid,
      new Date().toISOString(), verified.registry.lifecycleStage)
    const record = recordAiConsoleTrainingTelemetry(input, { storePath })
    last = { epoch: next.epoch, optimizationStep: next.optimizationStep }
    return { sampleId: record.sampleId, sampleSequence: record.sampleSequence,
      runId: record.runId, processId: record.processId }
  }
}
