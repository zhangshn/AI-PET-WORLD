import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, realpathSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { readLatestAiConsoleTrainingTelemetry, recordAiConsoleTrainingTelemetry } from
  "../../src/server/ai-console-observability/training-telemetry-store.ts"
import {
  activeTrainingTelemetryReporterIdentity,
  authorizeActiveTrainingTelemetry,
  buildBoundTrainingTelemetryInput,
  normalizeActiveTrainingProgress,
} from "../lib/ai-painter-active-training-telemetry-v1.mjs"

const RUN = "mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898"
const PACKAGE = "mvp-v18-dry-package-6061ccf56942a9bfaec776761e5ec30f6bf52629c"
const PID = 12345
const verified = () => ({ ok: true, registry: {
  executionState: "executing", lifecycleStage: "dry_single_world_256x192",
  runId: RUN, packageId: PACKAGE,
  activeExecution: { executionState: "executing", runId: RUN,
    packageId: PACKAGE, processId: PID,
    processStartIdentity: `${PID}:2026-09-27T00:00:00.000Z` },
} })
const event = () => ({ epoch: 3, batchIndex: 12,
  batchCount: 48, optimizationStep: 108, loss: 0.91, learningRate: 0.0001,
  throughputSamplesPerSecond: 2.5, estimatedCompletionAtUtc: null,
  checkpointIdentity: null })

test("supervisor event carries progress but cannot supply Run or process identity", () => {
  const progress = normalizeActiveTrainingProgress(event())
  assert.deepEqual(progress, event())
  for (const change of [
    x => { x.runId = RUN }, x => { x.processId = PID },
    x => { x.loss = Number.NaN }, x => { x.loss = -1 },
    x => { x.optimizationStep = 2.5 }, x => { x.epoch = -1 },
    x => { x.batchIndex = 49 }, x => { x.trainingStage = "stage0" },
    x => { x.estimatedCompletionAtUtc = "yesterday" },
  ]) {
    const candidate = event(); change(candidate)
    assert.throws(() => normalizeActiveTrainingProgress(candidate))
  }
})

test("only verified current active Run and exact supervisor PID are admitted", () => {
  const context = { runId: RUN, packageId: PACKAGE, processId: PID }
  const active = authorizeActiveTrainingTelemetry(verified(), context)
  assert.equal(active.runId, RUN)
  for (const change of [
    x => { x.ok = false; x.errorCode = "registry_hash_mismatch" },
    x => { x.registry.activeExecution = null },
    x => { x.registry.executionState = "completed" },
    x => { x.registry.runId = "different" },
    x => { x.registry.activeExecution.packageId = "different" },
    x => { x.registry.lifecycleStage = "../stage0" },
    x => { x.registry.activeExecution.processId = PID + 1 },
    x => { x.registry.activeExecution.processStartIdentity = `${PID + 1}:different` },
  ]) {
    const candidate = verified(); change(candidate)
    assert.throws(() => authorizeActiveTrainingTelemetry(candidate, context))
  }
})

test("writer input derives exact Run and process-bound execution identity", () => {
  const active = authorizeActiveTrainingTelemetry(verified(),
    { runId: RUN, packageId: PACKAGE, processId: PID })
  const input = buildBoundTrainingTelemetryInput(active,
    normalizeActiveTrainingProgress(event()), PID, "2026-09-27T00:00:01.000Z",
    "dry_single_world_256x192")
  assert.equal(input.runId, RUN)
  assert.equal(input.processId, PID)
  assert.match(input.executionId, /^[a-f0-9]{64}$/u)
  assert.equal(input.reporterIdentity, activeTrainingTelemetryReporterIdentity)
  assert.equal(input.optimizationStep, 108)
  assert.equal(input.trainingStage, "dry_single_world_256x192")
  assert.equal(input.loss, 0.91)
  const changed = buildBoundTrainingTelemetryInput({ ...active,
    processStartIdentity: `${PID}:2026-09-27T00:01:01.000Z` },
  normalizeActiveTrainingProgress(event()), PID, "2026-09-27T00:00:01.000Z",
  "dry_single_world_256x192")
  assert.notEqual(changed.executionId, input.executionId)
})

test("existing internal writer stores the exact hyphenated Run in an isolated CPU store", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "ai-painter-telemetry-test-"))
  t.after(() => {
    assert.equal(path.dirname(realpathSync(directory)), realpathSync(tmpdir()))
    rmSync(directory, { recursive: true, force: false })
  })
  const storePath = path.join(directory, "training-telemetry-v1.sqlite")
  const active = authorizeActiveTrainingTelemetry(verified(),
    { runId: RUN, packageId: PACKAGE, processId: PID })
  const input = buildBoundTrainingTelemetryInput(active,
    normalizeActiveTrainingProgress(event()), PID, new Date().toISOString(),
    "dry_single_world_256x192")
  const written = recordAiConsoleTrainingTelemetry(input, { storePath })
  const read = readLatestAiConsoleTrainingTelemetry({ storePath })
  assert.equal(read.status, "connected", read.reasonCode)
  assert.equal(read.latest?.recordSha256, written.recordSha256)
  assert.equal(read.latest?.runId, RUN)
  assert.equal(read.latest?.optimizationStep, 108)
})
