import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function compile(relative, dependencies = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require', 'exports', code)(id => {
    assert.ok(Object.hasOwn(dependencies, id), `unexpected runtime dependency: ${id}`)
    return dependencies[id]
  }, exports)
  return exports
}
// The shared mapper has no runtime imports, including no React or server probes.
const model = compile('../../src/app/ai-console/ai-console-training-summary-model.ts')
const contract = compile('../../src/server/ai-console/projection-contract.ts')
function fixture(bound = true) {
  const now = Date.now(), time = new Date(now).toISOString()
  const current = {
    ok: true, dataStatus: 'connected', integrityStatus: 'verified', reasonCode: null,
    observedAtUtc: time, registryRevision: 42, writerIdentity: 'local_registry_writer', evidenceReferences: ['registry-evidence'],
    recordedAtAsiaShanghai: '2026-10-03 15:00:00 +08:00',
    currentProjectTask: { taskId: 'task-a', runId: 'run-a', taskKind: 'bounded_train', lifecycleStage: 'stage0', executionState: 'executing' },
    activeExecution: { runId: 'run-a', processId: 123, processStartIdentity: 'start-123', executionState: 'executing' },
    latestTrainingTerminal: { runId: 'old-run', status: 'experiment_failed_closed' }, selectedHistoricalRun: null,
    trainingPresentation: { availability: 'available', reasonCode: null, runId: 'run-a', targetEpochs: 48, targetOptimizerSteps: 2304,
      targetDiscriminatorOptimizerSteps: 2303,
      resolution: { width: 256, height: 192 }, completedEpochs: null, actualOptimizerSteps: null },
  }
  if (bound) current.trainingPresentation.currentMetrics = {
    availability: 'available', reasonCode: null, runId: 'run-a', processId: 123, processStartIdentity: 'start-123', phase: 'executing',
    epoch: 7, optimizationStep: 336, discriminatorOptimizerSteps: 335, loss: null, learningRate: null,
    batchIndex: null, batchCount: null, throughputSamplesPerSecond: null, estimatedCompletionAtUtc: null, checkpointIdentity: null,
    reportedAtUtc: new Date(now - 35000).toISOString(), heartbeatAtUtc: time,
    sourceIdentity: 'current_registry_bound_progress_v1', sourcePath: '.runtime/ai-painter/bound-run/progress.json',
    sourceSha256: 'a'.repeat(64), progressTtlSeconds: 120,
  }
  const snapshot = {
    observedAtUtc: time, sampleCompletedAtUtc: time,
    trainingTelemetry: { status: 'connected', reporterIdentity: 'legacy_reporter', evidenceReferences: ['legacy-telemetry-evidence'], latest: {
      runId: 'run-a', processId: 123, executionId: 'legacy-execution-a', trainingStage: 'stage0',
      epoch: 3, optimizationStep: 144, loss: 0.25, learningRate: 0.001, batchIndex: 2, batchCount: 48, throughputSamplesPerSecond: 4,
      estimatedCompletionAtUtc: new Date(now + 60000).toISOString(), checkpointIdentity: 'legacy-checkpoint', heartbeatAtUtc: time, reportedAtUtc: time,
    } },
    resources: { cpuUtilization: 31, memoryUtilization: 42, gpuUtilization: 99, vramUtilization: 65, gpuTemperatureCelsius: 67, gpuPowerDrawWatts: 123 },
    trainingProcesses: { records: [{ processId: 123 }], status: 'connected' },
  }
  const { queryAiConsoleTrainingObservabilityProjection: query } = compile('../../src/server/ai-console/training-observability-projection.ts', {
    '../ai-console-observability/local-observability': { sampleAiConsoleLiveObservability: async () => snapshot },
    './projection-contract': contract,
    './ai-painter-current-execution-projection': { readAiPainterCurrentExecutionSnapshot: async () => current },
    '../../app/ai-console/ai-console-training-summary-model': model,
  })
  return { now, time, current, snapshot, query }
}
test('AP-03 bound progress matches summary, preserves resource observations and marks absent fields unavailable', async () => {
  const f = fixture(), result = await f.query(), r = result.records[0]
  const summary = model.mapTrainingSummary({ connection: 'ready', snapshot: f.current, errorCode: null }, { connection: 'connected', snapshot: { ...f.snapshot, ok: true } })
  assert.equal(result.dataStatus, 'connected'); assert.equal(result.reasonCode, null)
  assert.equal(r.epoch, summary.epoch); assert.equal(r.optimizationStep, summary.optimizerStep); assert.equal(r.discriminatorOptimizerSteps, 335)
  assert.equal(r.loss, null); assert.equal(r.learningRate, null); assert.equal(r.estimatedCompletionAtUtc, null)
  assert.ok(result.unavailableFields.includes('loss')); assert.ok(result.unavailableFields.includes('executionId'))
  assert.equal(r.reportedAtUtc, f.current.trainingPresentation.currentMetrics.reportedAtUtc)
  assert.equal(r.training, true); assert.equal(r.targetEpochs, 48); assert.equal(r.targetOptimizerSteps, 2304)
  assert.equal(r.targetDiscriminatorOptimizerSteps, 2303)
  assert.equal(r.gpuUtilization, 99); assert.equal(r.cpuUtilization, 31); assert.equal(r.detectedTrainingProcessCount, 1)
  assert.equal(result.provenance.sourceRevision, 42); assert.equal(result.provenance.trustStatus, 'verified_registry')
  assert.ok(result.provenance.evidenceReferences.includes(r.metricsSourcePath))
  assert.ok(!result.provenance.evidenceReferences.includes('legacy-telemetry-evidence'))
})
test('AP-03 legacy package retains fresh Run/PID-matched telemetry and provenance', async () => {
  const f = fixture(false), result = await f.query(), r = result.records[0]
  assert.equal(r.training, true); assert.equal(r.epoch, 3); assert.equal(r.optimizationStep, 144); assert.equal(r.loss, 0.25)
  assert.equal(r.discriminatorOptimizerSteps, null); assert.equal(r.executionId, 'legacy-execution-a')
  assert.equal(r.metricsSourceIdentity, 'matched_training_telemetry_v1')
  assert.ok(result.provenance.evidenceReferences.includes('legacy-telemetry-evidence'))
})

test('AP-03 failure-capture updates are training, independent of legacy telemetry and qualification labels', async () => {
  const f = fixture(); f.current.currentProjectTask.taskKind = 'ecology_gradient_failure_diagnostic'
  Object.assign(f.current.trainingPresentation, { targetEpochs: 13, targetOptimizerSteps: 600, targetDiscriminatorOptimizerSteps: 600 })
  f.snapshot.trainingTelemetry.status = 'unknown_or_stale'; f.snapshot.trainingTelemetry.latest.runId = 'old-run'
  Object.assign(f.current.trainingPresentation.currentMetrics, { epoch: 3, optimizationStep: 107, discriminatorOptimizerSteps: 108 })
  const first = await f.query(); assert.equal(first.records[0].training, true)
  assert.equal(first.records[0].targetEpochs, 13); assert.equal(first.records[0].targetOptimizerSteps, 600)
  Object.assign(f.current.trainingPresentation.currentMetrics, { optimizationStep: 110, discriminatorOptimizerSteps: 111 })
  const next = await f.query(), summary = model.mapTrainingSummary({ connection: 'ready', snapshot: f.current, errorCode: null },
    { connection: 'connected', snapshot: { ...f.snapshot, ok: true } })
  assert.equal(next.records[0].optimizationStep, 110); assert.equal(next.records[0].discriminatorOptimizerSteps, 111)
  assert.equal(next.records[0].trainingStatus, summary.status); assert.equal(next.records[0].optimizationStep, summary.optimizerStep)
  assert.equal(next.records[0].loss, null); assert.equal(next.records[0].checkpointIdentity, null)
})
for (const [label, change] of [
  ['backend unavailable', f => Object.assign(f.current.trainingPresentation.currentMetrics, { availability: 'unavailable', reasonCode: 'bound_progress_conflict' })],
  ['wrong Run', f => { f.current.trainingPresentation.currentMetrics.runId = 'old-run' }],
  ['wrong PID', f => { f.current.trainingPresentation.currentMetrics.processId = 999 }],
  ['wrong start identity', f => { f.current.trainingPresentation.currentMetrics.processStartIdentity = 'old-start' }],
  ['stale progress', f => { f.current.trainingPresentation.currentMetrics.reportedAtUtc = new Date(f.now - 120001).toISOString() }],
  ['future progress', f => { f.current.trainingPresentation.currentMetrics.reportedAtUtc = new Date(f.now + 60000).toISOString() }],
  ['stale heartbeat', f => { f.current.trainingPresentation.currentMetrics.heartbeatAtUtc = new Date(f.now - 15001).toISOString() }],
  ['future heartbeat', f => { f.current.trainingPresentation.currentMetrics.heartbeatAtUtc = new Date(f.now + 60000).toISOString() }],
  ['overflow', f => { f.current.trainingPresentation.currentMetrics.optimizationStep = 2305 }],
  ['unknown phase', f => { f.current.trainingPresentation.currentMetrics.phase = 'unknown' }],
  ['readonly', f => { f.current.currentProjectTask.taskKind = 'readonly_training_diagnostic' }],
  ['no active execution', f => { f.current.activeExecution = null }],
  ['stale registry', f => { f.current.observedAtUtc = new Date(f.now - 10001).toISOString() }],
  ['unverified registry', f => { f.current.integrityStatus = 'unavailable' }],
]) test(`AP-03 ${label} cannot be replaced by healthy SQLite or GPU use`, async () => {
  const f = fixture(); change(f); const result = await f.query(), r = result.records[0]
  assert.equal(result.dataStatus, 'partial'); assert.ok(result.reasonCode)
  assert.equal(r.training, false); assert.equal(r.epoch, null); assert.equal(r.optimizationStep, null); assert.equal(r.loss, null)
  assert.equal(r.lastKnownGeneratorSteps, null); assert.equal(r.gpuUtilization, 99)
  assert.ok(!result.provenance.evidenceReferences.includes('legacy-telemetry-evidence'))
  if (label === 'backend unavailable') assert.equal(result.reasonCode, 'bound_progress_conflict')
})
for (const phase of ['validating', 'completed', 'failed_closed']) test(`AP-03 ${phase} keeps counters separate from current training`, async () => {
  const f = fixture(); f.current.trainingPresentation.currentMetrics.phase = phase
  const result = await f.query(), r = result.records[0]
  assert.equal(r.training, false); assert.equal(r.epoch, null); assert.equal(r.optimizationStep, null); assert.equal(r.loss, null)
  assert.equal(r.lastKnownEpoch, 7); assert.equal(r.lastKnownGeneratorSteps, 336); assert.equal(r.lastKnownCriticSteps, 335)
  assert.match(r.trainingStatus, /非训练/); assert.equal(r.phase, phase)
})
test('AP-03 registered review suppresses still-executing snapshot and historical selection has no influence', async () => {
  const f = fixture(); f.current.activeExecution.executionState = 'reviewing'
  const before = await f.query()
  f.current.selectedHistoricalRun = { runId: 'old-run', epoch: 999 }
  assert.deepEqual(await f.query(), before)
  assert.equal(before.records[0].training, false); assert.equal(before.records[0].lastKnownGeneratorSteps, 336)
  assert.match(before.records[0].trainingStatus, /审核中/)
})
test('AP-03 no active execution exposes only bound terminal counters, never historical telemetry', async () => {
  const f = fixture(false); f.current.activeExecution = null
  f.current.trainingPresentation.runId = 'old-run'
  Object.assign(f.current.trainingPresentation, { completedEpochs: 48, actualOptimizerSteps: { generator: 2304, critic: 2303 } })
  const result = await f.query(), r = result.records[0]
  assert.equal(r.training, false); assert.equal(r.epoch, null); assert.equal(r.optimizationStep, null)
  assert.equal(r.terminalEpochs, 48); assert.equal(r.terminalGeneratorSteps, 2304); assert.equal(r.terminalCriticSteps, 2303)
})
for (const [label, change] of [
  ['wrong Run', f => { f.snapshot.trainingTelemetry.latest.runId = 'old-run' }],
  ['wrong PID', f => { f.snapshot.trainingTelemetry.latest.processId = 999 }],
  ['stale report', f => { f.snapshot.trainingTelemetry.latest.reportedAtUtc = new Date(f.now - 15001).toISOString() }],
  ['future report', f => { f.snapshot.trainingTelemetry.latest.reportedAtUtc = new Date(f.now + 60000).toISOString() }],
  ['stale heartbeat', f => { f.snapshot.trainingTelemetry.latest.heartbeatAtUtc = new Date(f.now - 15001).toISOString() }],
  ['stale resource snapshot', f => { f.snapshot.sampleCompletedAtUtc = new Date(f.now - 10001).toISOString() }],
]) test(`AP-03 legacy ${label} hides current metrics`, async () => {
  const f = fixture(false); change(f); const result = await f.query(), r = result.records[0]
  assert.equal(result.dataStatus, 'partial'); assert.equal(r.training, false); assert.equal(r.epoch, null); assert.equal(r.loss, null)
})
