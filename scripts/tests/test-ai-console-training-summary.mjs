import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { trainingTime } from './helpers/training-time-cpu.mjs'
import { createHash } from 'node:crypto'

const source = readFileSync(new URL('../../src/app/ai-console/ai-console-training-summary-model.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const model = {}
new Function('require', 'exports', compiled)(name => { assert.equal(name, './ai-console-training-time'); return trainingTime }, model)
const now = Date.now(), time = new Date(now).toISOString()
function fixture() {
  return {
    current: { connection: 'ready', errorCode: null, snapshot: {
      ok: true, dataStatus: 'connected', integrityStatus: 'verified', observedAtUtc: time,
      currentProjectTask: { runId: 'active', taskKind: 'bounded_train_only_learning_capacity_experiment' },
      activeExecution: { runId: 'active', processId: 123, processStartIdentity: 'start-123', executionState: 'executing' },
      latestTrainingTerminal: { runId: 'previous', status: 'experiment_failed_closed' },
      trainingPresentation: { availability: 'available', runId: 'active', targetEpochs: 60, targetOptimizerSteps: 3000,
        resolution: { width: 320, height: 192 }, completedEpochs: 999, actualOptimizerSteps: { generator: 9999, critic: 9998 }, packagePath: 'bound.json', packageSha256: 'a'.repeat(64) },
    } },
    live: { connection: 'connected', snapshot: { ok: true, sampleCompletedAtUtc: time, trainingTelemetry: { status: 'connected', latest: {
      runId: 'active', processId: 123, epoch: 4, optimizationStep: 101, loss: 0.25, reportedAtUtc: time, heartbeatAtUtc: time, estimatedCompletionAtUtc: null,
    } } } },
  }
}
function map(f) { return model.mapTrainingSummary(f.current, f.live, now) }
function boundFixture() {
  const f = fixture()
  f.current.snapshot.trainingPresentation.targetDiscriminatorOptimizerSteps = 2999
  f.current.snapshot.trainingPresentation.currentMetrics = {
    availability: 'available', reasonCode: null, runId: 'active', processId: 123, processStartIdentity: 'start-123',
    phase: 'executing', epoch: 5, optimizationStep: 240, discriminatorOptimizerSteps: 239,
    loss: null, learningRate: null, batchIndex: null, batchCount: null, throughputSamplesPerSecond: null,
    estimatedCompletionAtUtc: null, checkpointIdentity: null, reportedAtUtc: time, heartbeatAtUtc: time,
    sourcePath: '.runtime/ai-painter/bound-run/progress.json', sourceSha256: 'b'.repeat(64),
    progressTtlSeconds: 120, sourceIdentity: 'current_registry_bound_progress_v1',
  }
  return f
}

// Private API-shaped fixtures: no production Run, filesystem or admission work.
const stageRoot = '.runtime/ai-painter/private-stage-fixture/active'
function stageFixture() {
  const f = boundFixture()
  Object.assign(f.current.snapshot.currentProjectTask, {
    executionState: 'executing', activity: 'diagnostic_gpu_qualification_pending', terminalStatus: 'qualification_pending',
    capabilityVersion: 'private-capability', packageId: 'private-package',
    terminalPath: `${stageRoot}/dispatched.json`, terminalSha256: 'c'.repeat(64),
  })
  Object.assign(f.current.snapshot.activeExecution, {
    capabilityVersion: 'private-capability', packageId: 'private-package',
    lock: { path: `${stageRoot}/execution-lock.json` }, heartbeat: { path: `${stageRoot}/heartbeat.json` },
  })
  return f
}
function unavailableProgress(f, reason) {
  const m = f.current.snapshot.trainingPresentation.currentMetrics
  for (const key of Object.keys(m)) if (!['availability', 'reasonCode', 'runId', 'sourceIdentity', 'progressTtlSeconds'].includes(key)) m[key] = null
  Object.assign(m, { availability: 'unavailable', reasonCode: reason })
}
function admissionFixture() {
  const f = stageFixture()
  unavailableProgress(f, `ENOENT: no such file or directory, realpath 'F:\\private-project\\${stageRoot.replaceAll('/', '\\')}\\progress.json'`)
  return f
}
test('exact pending admission without progress is non-training; raw ENOENT stays folded', () => {
  for (const activity of ['diagnostic_gpu_qualification_pending', 'gpu_qualification_pending']) {
    const f = admissionFixture(); f.current.snapshot.currentProjectTask.activity = activity
    const s = map(f), html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: s }))
    assert.equal(s.status, 'GPU准入检查阶段（尚未进入训练）'); assert.equal(s.training, false)
    assert.equal(s.tone, 'neutral'); assert.equal(s.epoch, null); assert.equal(s.optimizerStep, null); assert.equal(s.eta, null)
    assert.match(s.reason, /不据此认定准入通过或训练开始/); assert.doesNotMatch(s.reason, /ENOENT|F:|1\/48|48\/48/)
    assert.ok(html.indexOf('ENOENT') > html.indexOf('<details>')); assert.match(html, /diagnostic_gpu_qualification_pending|gpu_qualification_pending/)
    assert.doesNotMatch(html.split('<details>')[0], /ENOENT|private-project|正在训练|已通过/)
  }
})
test('same mapper switches preparation, admission, training, validation, review, finalization, terminal and idle', () => {
  const f = stageFixture(), task = f.current.snapshot.currentProjectTask, active = f.current.snapshot.activeExecution
  task.executionState = active.executionState = 'preflight'
  unavailableProgress(f, 'training_progress_active_phase_not_training')
  let s = map(f); assert.match(s.status, /准备／CPU检查/); assert.equal(s.tone, 'neutral'); assert.equal(s.training, false)
  Object.assign(f, admissionFixture()); s = map(f); assert.match(s.status, /^GPU准入/)
  Object.assign(f, stageFixture()); s = map(f); assert.equal(s.training, true); assert.equal(s.optimizerStep, 240)
  // The real producer retains pending activity throughout training: it is not a stage override.
  for (const [phase, status] of [['validating', '验证中'], ['completed', '训练已完成'], ['failed_closed', '训练已失败关闭']]) {
    f.current.snapshot.trainingPresentation.currentMetrics.phase = phase
    s = map(f); assert.ok(s.status.includes(status)); assert.equal(s.training, false); assert.equal(s.epoch, null)
    assert.equal(s.lastKnownGeneratorSteps, 240); assert.doesNotMatch(s.status, /GPU准入/)
  }
  f.current.snapshot.trainingPresentation.currentMetrics.phase = 'completed'
  for (const [phase, status] of [['reviewing', '审核中'], ['adjudicating', '裁决中'], ['finalizing', '收尾中']]) {
    f.current.snapshot.currentProjectTask.executionState = f.current.snapshot.activeExecution.executionState = phase
    s = map(f); assert.ok(s.status.includes(status)); assert.equal(s.training, false)
  }
  f.current.snapshot.activeExecution = null
  for (const phase of ['completed', 'failed_closed']) {
    f.current.snapshot.currentProjectTask.executionState = phase
    s = map(f); assert.match(s.status, /当前无活动执行/); assert.match(s.status, phase === 'completed' ? /执行已完成/ : /执行已失败关闭/)
    assert.equal(s.training, false); assert.equal(s.latestRunId, 'previous')
    assert.equal(s.tone, phase === 'failed_closed' ? 'warning' : 'neutral')
  }
  f.current.snapshot.currentProjectTask = null
  assert.equal(map(f).status, '当前无活动执行')
})
for (const [label, modify] of [
  ['unknown activity', f => { f.current.snapshot.currentProjectTask.activity = 'future_gpu_qualification_pending' }],
  ['non-pending receipt', f => { f.current.snapshot.currentProjectTask.terminalStatus = 'training_pending' }],
  ['wrong task Run', f => { f.current.snapshot.currentProjectTask.runId = 'other' }],
  ['wrong bound Run', f => { f.current.snapshot.trainingPresentation.currentMetrics.runId = 'other' }],
  ['wrong presentation Run', f => { f.current.snapshot.trainingPresentation.runId = 'other' }],
  ['wrong package', f => { f.current.snapshot.currentProjectTask.packageId = 'other' }],
  ['wrong capability', f => { f.current.snapshot.activeExecution.capabilityVersion = 'other' }],
  ['wrong PID in unavailable evidence', f => { f.current.snapshot.trainingPresentation.currentMetrics.processId = 456 }],
  ['wrong birth in unavailable evidence', f => { f.current.snapshot.trainingPresentation.currentMetrics.processStartIdentity = 'reused' }],
  ['missing active birth', f => { delete f.current.snapshot.activeExecution.processStartIdentity }],
  ['missing active PID', f => { delete f.current.snapshot.activeExecution.processId }],
  ['wrong state', f => { f.current.snapshot.currentProjectTask.executionState = 'validating' }],
  ['fake receipt SHA', f => { f.current.snapshot.currentProjectTask.terminalSha256 = 'fake' }],
  ['fake package SHA', f => { f.current.snapshot.trainingPresentation.packageSha256 = 'fake' }],
  ['conflicting source SHA', f => { f.current.snapshot.trainingPresentation.currentMetrics.sourceSha256 = 'a'.repeat(64) }],
  ['conflicting count', f => { f.current.snapshot.trainingPresentation.currentMetrics.epoch = 1 }],
  ['package conflict', f => { f.current.snapshot.trainingPresentation.reasonCode = 'training_observation_plan_conflict' }],
  ['package unavailable', f => { f.current.snapshot.trainingPresentation.availability = 'unavailable' }],
  ['global error', f => { f.current.errorCode = 'registry_sha_conflict' }],
  ['stale registry', f => { f.current.snapshot.observedAtUtc = new Date(now - 10001).toISOString() }],
  ['future registry', f => { f.current.snapshot.observedAtUtc = new Date(now + 1).toISOString() }],
  ['disconnected', f => { f.current.connection = 'failed' }],
  ['unverified', f => { f.current.snapshot.integrityStatus = 'unavailable' }],
  ['conflicting registry', f => { f.current.snapshot.dataStatus = 'unknown_or_stale' }],
  ['missing lock', f => { delete f.current.snapshot.activeExecution.lock }],
  ['cross Run heartbeat', f => { f.current.snapshot.activeExecution.heartbeat.path = '.runtime/ai-painter/other/heartbeat.json' }],
  ['unexpected ENOENT', f => { f.current.snapshot.trainingPresentation.currentMetrics.reasonCode = `ENOENT: no such file or directory, realpath 'F:/project/${stageRoot}/heartbeat.json'` }],
  ['cross Run ENOENT', f => { f.current.snapshot.trainingPresentation.currentMetrics.reasonCode = "ENOENT: no such file or directory, realpath 'F:/project/.runtime/ai-painter/other/progress.json'" }],
  ['path traversal', f => { f.current.snapshot.trainingPresentation.currentMetrics.reasonCode = `ENOENT: no such file or directory, realpath 'F:/other/../project/${stageRoot}/progress.json'` }],
  ['bare ENOENT', f => { f.current.snapshot.trainingPresentation.currentMetrics.reasonCode = 'ENOENT' }],
  ['permission error', f => { f.current.snapshot.trainingPresentation.currentMetrics.reasonCode = `EACCES: permission denied, realpath 'F:/project/${stageRoot}/progress.json'` }],
  ['identity error', f => { f.current.snapshot.trainingPresentation.currentMetrics.reasonCode = 'training_progress_lock_process_conflict' }],
  ['SHA conflict', f => { f.current.snapshot.trainingPresentation.currentMetrics.reasonCode = 'history_sha_mismatch' }],
]) test(`pending admission never hides ${label}`, () => {
  const f = admissionFixture(); modify(f); const s = map(f)
  assert.equal(s.training, false); assert.equal(s.tone, 'warning'); assert.doesNotMatch(s.status, /^GPU准入/)
  assert.equal(s.epoch, null); assert.equal(s.lastKnownGeneratorSteps, null); assert.ok(s.metricReasonCode)
  assert.doesNotMatch(s.reason, /F:|private-project|realpath|permission denied/)
})
test('pending never masks invalid or stale reported training metrics', () => {
  for (const modify of [m => { m.processId = 456 }, m => { m.processStartIdentity = 'reused' },
    m => { m.sourceSha256 = 'fake' }, m => { m.reportedAtUtc = new Date(now - 120001).toISOString() },
    m => { m.heartbeatAtUtc = new Date(now + 1).toISOString() }, m => { m.epoch = 9999 }]) {
    const f = stageFixture(); modify(f.current.snapshot.trainingPresentation.currentMetrics)
    const s = map(f); assert.equal(s.training, false); assert.equal(s.tone, 'warning'); assert.doesNotMatch(s.status, /GPU准入|正在训练/)
  }
  for (const modify of [f => { f.current.snapshot.trainingPresentation.packageSha256 = 'fake' },
    f => { f.current.snapshot.currentProjectTask.packageId = 'wrong' },
    f => { f.current.snapshot.currentProjectTask.capabilityVersion = 'wrong' }]) {
    const f = stageFixture(); modify(f)
    const s = map(f); assert.equal(s.training, false); assert.equal(s.tone, 'warning'); assert.doesNotMatch(s.status, /GPU准入|正在训练/)
  }
})
test('non-training registered stages do not hide arbitrary progress conflicts', () => {
  for (const phase of ['preflight', 'validating', 'reviewing', 'adjudicating', 'finalizing', 'completed', 'failed_closed']) {
    const f = stageFixture(); f.current.snapshot.currentProjectTask.executionState = f.current.snapshot.activeExecution.executionState = phase
    unavailableProgress(f, 'training_progress_heartbeat_process_conflict')
    const s = map(f); assert.equal(s.tone, 'warning'); assert.match(s.status, /待核验/); assert.match(s.reason, /conflict/)
  }
})
test('only exact lifecycle codes map, including legacy prototype names', () => {
  for (const phase of ['future_cpu_check', 'constructor', 'toString', '__proto__']) {
    const f = fixture(); f.current.snapshot.activeExecution.executionState = phase
    const s = map(f); assert.equal(typeof s.status, 'string'); assert.equal(s.training, false); assert.equal(s.tone, 'warning')
    assert.doesNotMatch(s.status, /准备|GPU准入|验证中|审核中|正在训练/)
  }
})
test('AP-03 and summary share admission, pending-to-training and error mapping without API changes', async () => {
  const projectionSource = readFileSync(new URL('../../src/server/ai-console/training-observability-projection.ts', import.meta.url), 'utf8')
  const contractSource = readFileSync(new URL('../../src/server/ai-console/projection-contract.ts', import.meta.url), 'utf8')
  const compile = (value, dependencies = {}) => {
    const code = ts.transpileModule(value, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const exports = {}
    new Function('require', 'exports', code)(id => { assert.ok(Object.hasOwn(dependencies, id), id); return dependencies[id] }, exports)
    return exports
  }
  for (const f of [admissionFixture(), stageFixture()]) {
    const dependencies = {
      '../ai-console-observability/local-observability': { sampleAiConsoleLiveObservability: async () => ({
        ...f.live.snapshot, resources: {}, trainingProcesses: { records: [], status: 'connected' },
      }) },
      './projection-contract': compile(contractSource),
      './ai-painter-current-execution-projection': { readAiPainterCurrentExecutionSnapshot: async () => ({ ...f.current.snapshot, evidenceReferences: [] }) },
      '../../app/ai-console/ai-console-training-summary-model': { mapTrainingSummary: (current, live) => model.mapTrainingSummary(current, live, now) },
    }
    const api = compile(projectionSource, dependencies)
    for (const phase of [null, 'validating', 'completed', 'failed_closed']) {
      if (phase) f.current.snapshot.trainingPresentation.currentMetrics.phase = phase
      const expected = map(f), actual = (await api.queryAiConsoleTrainingObservabilityProjection()).records[0]
      assert.equal(actual.trainingStatus, expected.status); assert.equal(actual.training, expected.training)
      assert.equal(actual.metricsReasonCode, expected.metricReasonCode); assert.equal(actual.optimizationStep, expected.optimizerStep)
    }
  }
})
test('bound progress replaces matching SQLite values, explicitly missing Loss stays null', () => {
  const f = boundFixture(), s = map(f)
  assert.equal(s.training, true); assert.equal(s.epoch, 5); assert.equal(s.optimizerStep, 240)
  assert.equal(s.discriminatorOptimizerSteps, 239); assert.equal(s.loss, null); assert.equal(s.eta, null)
  assert.equal(s.metricSource, 'current_registry_bound_progress_v1'); assert.equal(s.metricSourceSha256, 'b'.repeat(64))
  assert.equal(s.targetEpochs, 60); assert.equal(s.targetOptimizerSteps, 3000)
})
test('bound progress remains fresh between epochs independently of live resource/SQLite availability', () => {
  for (const age of [15001, 35000, 119999, 120000]) {
    const f = boundFixture(); f.live.connection = 'failed'; f.live.snapshot = null
    f.current.snapshot.trainingPresentation.currentMetrics.reportedAtUtc = new Date(now - age).toISOString()
    const s = map(f)
    assert.equal(s.training, true); assert.equal(s.epoch, 5); assert.equal(s.lastMetricAt, new Date(now - age).toISOString())
  }
})
for (const [label, modify] of [
  ['unavailable extension', m => { m.availability = 'unavailable'; m.reasonCode = 'backend_progress_conflict' }],
  ['wrong Run', m => { m.runId = 'historical' }],
  ['wrong PID', m => { m.processId = 456 }],
  ['wrong process start', m => { m.processStartIdentity = 'reused-pid' }],
  ['missing process start', m => { m.processStartIdentity = null }],
  ['future progress', m => { m.reportedAtUtc = new Date(now + 1).toISOString() }],
  ['stale progress', m => { m.reportedAtUtc = new Date(now - 120001).toISOString() }],
  ['invalid progress timestamp', m => { m.reportedAtUtc = 'invalid' }],
  ['future heartbeat', m => { m.heartbeatAtUtc = new Date(now + 1).toISOString() }],
  ['stale heartbeat', m => { m.heartbeatAtUtc = new Date(now - 15001).toISOString() }],
  ['missing heartbeat', m => { m.heartbeatAtUtc = null }],
  ['unknown phase', m => { m.phase = 'future_schema_phase' }],
  ['null phase', m => { m.phase = null }],
  ['unsafe epoch', m => { m.epoch = Number.MAX_SAFE_INTEGER + 1 }],
  ['fractional G', m => { m.optimizationStep = 1.5 }],
  ['negative D', m => { m.discriminatorOptimizerSteps = -1 }],
  ['epoch exceeds frozen target', m => { m.epoch = 61 }],
  ['G exceeds frozen target', m => { m.optimizationStep = 3001 }],
  ['D exceeds its separate frozen target', m => { m.discriminatorOptimizerSteps = 3000 }],
  ['batch overflow', m => { m.batchIndex = 4; m.batchCount = 3 }],
  ['infinite Loss', m => { m.loss = Infinity }],
  ['negative throughput', m => { m.throughputSamplesPerSecond = -1 }],
  ['invalid ETA', m => { m.estimatedCompletionAtUtc = 'invalid' }],
  ['wrong source', m => { m.sourceIdentity = 'historical_progress' }],
  ['wrong TTL', m => { m.progressTtlSeconds = 121 }],
  ['missing source path', m => { m.sourcePath = null }],
  ['invalid SHA', m => { m.sourceSha256 = 'bad' }],
]) test(`bound ${label} rejects metrics and never borrows healthy legacy telemetry`, () => {
  const f = boundFixture(); modify(f.current.snapshot.trainingPresentation.currentMetrics)
  const s = map(f)
  assert.equal(s.training, false); assert.equal(s.epoch, null); assert.equal(s.optimizerStep, null)
  assert.equal(s.discriminatorOptimizerSteps, null); assert.equal(s.loss, null); assert.equal(s.lastMetricAt, null)
  assert.equal(s.lastKnownGeneratorSteps, null); assert.equal(s.metricSource, null); assert.ok(s.metricReasonCode)
  assert.match(s.reason, /绑定进度不可用/)
  if (label === 'unavailable extension') assert.equal(s.errorCode, 'backend_progress_conflict')
})
for (const [label, modify] of [
  ['null extension', f => { f.current.snapshot.trainingPresentation.currentMetrics = null }],
  ['unavailable package with extension', f => { f.current.snapshot.trainingPresentation.availability = 'unavailable' }],
  ['wrong presentation Run', f => { f.current.snapshot.trainingPresentation.runId = 'previous' }],
  ['wrong current task Run', f => { f.current.snapshot.currentProjectTask.runId = 'previous' }],
  ['missing registered process start', f => { delete f.current.snapshot.activeExecution.processStartIdentity }],
  ['no active execution', f => { f.current.snapshot.activeExecution = null }],
  ['readonly task', f => { f.current.snapshot.currentProjectTask.taskKind = 'readonly_gpu_diagnostic' }],
  ['unknown registered phase', f => { f.current.snapshot.activeExecution.executionState = 'future_phase' }],
  ['stale registry', f => { f.current.snapshot.observedAtUtc = new Date(now - 10001).toISOString() }],
  ['future registry', f => { f.current.snapshot.observedAtUtc = new Date(now + 1).toISOString() }],
  ['failed current read', f => { f.current.connection = 'failed' }],
]) test(`bound ${label} cannot represent training`, () => {
  const f = boundFixture(); modify(f); const s = map(f)
  assert.equal(s.training, false); assert.equal(s.epoch, null); assert.equal(s.optimizerStep, null)
  assert.equal(s.lastKnownGeneratorSteps, null)
})
test('validating, completed and failed progress retain separate last-known counters without active training', () => {
  for (const phase of ['validating', 'completed', 'failed_closed']) {
    const f = boundFixture(); f.current.snapshot.trainingPresentation.currentMetrics.phase = phase
    const s = map(f)
    assert.equal(s.training, false); assert.equal(s.epoch, null); assert.equal(s.optimizerStep, null); assert.equal(s.loss, null)
    assert.equal(s.lastKnownEpoch, 5); assert.equal(s.lastKnownGeneratorSteps, 240); assert.equal(s.lastKnownCriticSteps, 239)
    assert.equal(s.lastKnownMetricAt, time); assert.match(s.status, /非训练/); assert.doesNotMatch(s.status, /正在训练/)
  }
})
test('registered validation/review takes precedence over an executing progress snapshot', () => {
  for (const phase of ['validating', 'reviewing', 'adjudicating', 'finalizing']) {
    const f = boundFixture(); f.current.snapshot.activeExecution.executionState = phase
    const s = map(f)
    assert.equal(s.training, false); assert.equal(s.lastKnownGeneratorSteps, 240); assert.match(s.status, /非训练/)
  }
})
test('historical selection cannot influence identity, current metrics or plan bounds', () => {
  const f = boundFixture(), expected = map(f)
  f.current.snapshot.selectedHistoricalRun = { runId: 'previous', epoch: 99999, optimizationStep: 88888 }
  assert.deepEqual(map(f), expected)
})
test('bound zero counters and reported optional measurements retain actual values', () => {
  const f = boundFixture(); Object.assign(f.current.snapshot.trainingPresentation.currentMetrics, {
    epoch: 0, optimizationStep: 0, discriminatorOptimizerSteps: 0, batchIndex: 0, batchCount: 48,
    loss: 0, learningRate: 0.0002, throughputSamplesPerSecond: 1.5,
    estimatedCompletionAtUtc: new Date(now + 35000).toISOString(), checkpointIdentity: 'checkpoint-sha',
  })
  const s = map(f)
  assert.equal(s.training, true); assert.equal(s.epoch, 0); assert.equal(s.optimizerStep, 0)
  assert.equal(s.discriminatorOptimizerSteps, 0); assert.equal(s.loss, 0); assert.equal(s.batchIndex, 0)
  assert.equal(s.learningRate, 0.0002); assert.equal(s.throughputSamplesPerSecond, 1.5)
  assert.equal(s.checkpointIdentity, 'checkpoint-sha'); assert.equal(s.eta, new Date(now + 35000).toISOString())
})
test('D never borrows the G budget when its frozen target is absent', () => {
  const f = boundFixture(); delete f.current.snapshot.trainingPresentation.targetDiscriminatorOptimizerSteps
  const s = map(f)
  assert.equal(s.training, true); assert.equal(s.discriminatorOptimizerSteps, 239)
  assert.equal(s.targetDiscriminatorOptimizerSteps, null); assert.equal(s.targetOptimizerSteps, 3000)
})
test('matched verified active Run/PID uses live counts, immutable package only supplies bounds', () => {
  const s = map(fixture())
  assert.equal(s.training, true); assert.equal(s.epoch, 4); assert.equal(s.optimizerStep, 101)
  assert.equal(s.targetEpochs, 60); assert.equal(s.targetOptimizerSteps, 3000); assert.equal(s.resolution, '320 × 192')
  assert.equal(s.terminalGeneratorSteps, null); assert.equal(s.eta, null); assert.equal(s.lastMetricAt, time)
  assert.equal(s.latestRunId, 'previous'); assert.match(s.latestStatus, /失败/)
})
for (const [label, change] of [
  ['wrong Run', f => { f.live.snapshot.trainingTelemetry.latest.runId = 'wrong' }],
  ['wrong PID', f => { f.live.snapshot.trainingTelemetry.latest.processId = 456 }],
  ['missing active PID', f => { delete f.current.snapshot.activeExecution.processId }],
  ['invalid active PID', f => { f.current.snapshot.activeExecution.processId = 0 }],
  ['unverified registry', f => { f.current.snapshot.integrityStatus = 'unavailable' }],
  ['registry unknown', f => { f.current.snapshot.dataStatus = 'unknown_or_stale' }],
  ['stale registry', f => { f.current.snapshot.observedAtUtc = new Date(now - 10001).toISOString() }],
  ['stale live snapshot', f => { f.live.snapshot.sampleCompletedAtUtc = new Date(now - 10001).toISOString() }],
  ['stale heartbeat', f => { f.live.snapshot.trainingTelemetry.latest.heartbeatAtUtc = new Date(now - 15001).toISOString() }],
  ['future heartbeat', f => { f.live.snapshot.trainingTelemetry.latest.heartbeatAtUtc = new Date(now + 1000).toISOString() }],
  ['future report', f => { f.live.snapshot.trainingTelemetry.latest.reportedAtUtc = new Date(now + 1).toISOString() }],
  ['stale report', f => { f.live.snapshot.trainingTelemetry.latest.reportedAtUtc = new Date(now - 15001).toISOString() }],
  ['unsafe legacy epoch', f => { f.live.snapshot.trainingTelemetry.latest.epoch = Number.MAX_SAFE_INTEGER + 1 }],
  ['stale telemetry status', f => { f.live.snapshot.trainingTelemetry.status = 'unknown_or_stale' }],
  ['fetch failed with retained live', f => { f.live.connection = 'failed' }],
  ['fetch failed with retained registry', f => { f.current.connection = 'failed' }],
  ['readonly diagnostic even with matching telemetry', f => { f.current.snapshot.currentProjectTask.taskKind = 'readonly_train_fit_diagnostic' }],
  ['validation is not training', f => { f.current.snapshot.activeExecution.executionState = 'validating' }],
]) test(label + ' never presents current training metrics', () => {
  const f = fixture(); change(f); const s = map(f)
  assert.equal(s.training, false); assert.equal(s.epoch, null); assert.equal(s.optimizerStep, null); assert.equal(s.loss, null); assert.equal(s.lastMetricAt, null); assert.notEqual(s.tone, 'active')
})
test('idle cannot borrow terminal or stale telemetry as active numbers; terminal actual G/D are separate', () => {
  const f = fixture(); f.current.snapshot.activeExecution = null
  f.current.snapshot.trainingPresentation.runId = 'previous'
  const s = map(f)
  assert.equal(s.training, false); assert.equal(s.epoch, null); assert.match(s.status, /无活动/)
  assert.equal(s.terminalEpochs, 999); assert.equal(s.terminalGeneratorSteps, 9999); assert.equal(s.terminalCriticSteps, 9998)
})
test('optional presentation absent or wrong Run remains safely unknown', () => {
  for (const modify of [f => { delete f.current.snapshot.trainingPresentation }, f => { f.current.snapshot.trainingPresentation.runId = 'wrong' }, f => { f.current.snapshot.trainingPresentation.availability = 'unavailable' }]) {
    const f = fixture(); modify(f); const s = map(f)
    assert.equal(s.training, true); assert.equal(s.targetEpochs, null); assert.equal(s.targetOptimizerSteps, null); assert.match(s.resolution, /未知/)
  }
})
test('unavailable bound package reason is visible without inventing plan fields', () => {
  const f = fixture(); f.current.snapshot.trainingPresentation.availability = 'unavailable'
  f.current.snapshot.trainingPresentation.reasonCode = 'training_package_boundary_violation'
  const s = map(f); assert.equal(s.targetEpochs, null); assert.match(s.resolution, /未知/)
  assert.equal(s.errorCode, 'training_package_boundary_violation')
})
test('empty initial snapshots do not fabricate task or progress', () => {
  const s = model.mapTrainingSummary({ connection: 'connecting', snapshot: null, errorCode: null }, { connection: 'connecting', snapshot: null }, now)
  assert.equal(s.training, false); assert.equal(s.activeRunId, null); assert.equal(s.epoch, null)
})
test('default clock without explicit now accepts actual fresh timestamps', () => {
  const f = fixture(), actualTime = new Date().toISOString()
  f.current.snapshot.observedAtUtc = actualTime
  f.live.snapshot.sampleCompletedAtUtc = actualTime
  f.live.snapshot.trainingTelemetry.latest.reportedAtUtc = actualTime
  f.live.snapshot.trainingTelemetry.latest.heartbeatAtUtc = actualTime
  const summary = model.mapTrainingSummary(f.current, f.live)
  assert.equal(summary.registryFresh, true); assert.equal(summary.training, true); assert.equal(summary.epoch, 4)
})
const viewSource = readFileSync(new URL('../../src/app/ai-console/ai-console-training-summary.tsx', import.meta.url), 'utf8')
const viewFragment = `const formatTrainingTime = require('./ai-console-training-time').formatTrainingTime; const styles = {}; const Link = ({prefetch, ...props}) => require('react').createElement('a', props);\n${viewSource.slice(viewSource.indexOf('function beijingTime'), viewSource.indexOf('export function AiConsoleTrainingSummary'))}`
const viewCompiled = ts.transpileModule(viewFragment, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const view = {}; const nativeRequire = createRequire(import.meta.url)
new Function('require', 'exports', viewCompiled)(name => name === './ai-console-training-time' ? trainingTime : nativeRequire(name), view)
test('summary is renderable, identities folded, ETA unknown, no invented image or qualification', () => {
  const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(fixture()) }))
  assert.match(html, /4 \/ 60/); assert.match(html, /101 \/ 3000/); assert.match(html, /320 × 192/)
  assert.match(html, /技术身份、SHA、PID 与 Loss/); assert.match(html, /未知／未上报/); assert.match(html, /不是 Stage4 晋级/)
  assert.match(html, /href="\/ai-console\/training\/runs"/); assert.doesNotMatch(html, /<img/)
})
test('failed retained registry renders non-green stale state and hides active metrics', () => {
  const f = fixture(); f.current.connection = 'failed'; f.current.errorCode = 'timeout'
  const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(f) }))
  assert.match(html, /断线或过期/); assert.match(html, /data-tone="warning"/); assert.doesNotMatch(html, /101 \/ 3000/)
})
test('bound HTML shows actual G and D distinctly without fabricating Loss, ETA or live previews', () => {
  const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(boundFixture()) }))
  assert.match(html, /5 \/ 60/); assert.match(html, /240 \/ 3000/)
  assert.match(html, /真实优化步 D／上限<\/dt><dd>239 \/ 2999/); assert.match(html, /当前匹配 Loss<\/dt><dd>未上报／未核验/)
  assert.match(html, /预计完成时间<\/dt><dd>未知／未上报/)
  assert.match(html, /current_registry_bound_progress_v1/); assert.doesNotMatch(html, /0\.25|<img/)
  assert.match(html, /href="\/ai-console\/training\/runs"/)
})
test('validation HTML separates last-known counters and never says training is still running', () => {
  const f = boundFixture(); f.current.snapshot.trainingPresentation.currentMetrics.phase = 'validating'
  const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(f) }))
  assert.match(html, /验证中（非训练）/); assert.match(html, /最后核验的训练计数（非当前训练）/)
  assert.match(html, /G：240 \/ D：239/); assert.doesNotMatch(html, /正在训练|240 \/ 3000|data-tone="active"/)
})
test('backend rejection reason is rendered with no legacy values', () => {
  const f = boundFixture(); Object.assign(f.current.snapshot.trainingPresentation.currentMetrics, { availability: 'unavailable', reasonCode: 'progress_sha_conflict' })
  const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(f) }))
  assert.match(html, /progress_sha_conflict/); assert.match(html, /data-tone="warning"/)
  assert.doesNotMatch(html, /101 \/ 3000|240 \/ 3000|0\.25|正在训练/)
})

function failedTerminalFixture() {
  const f = boundFixture()
  f.current.snapshot.activeExecution = null
  f.current.snapshot.latestTrainingTerminal = { runId: 'active', status: 'failed_closed' }
  Object.assign(f.current.snapshot.trainingPresentation, {
    completedEpochs: null, actualOptimizerSteps: null, errorCode: null,
    currentMetrics: { availability: 'unavailable', reasonCode: 'active_execution_not_registered' },
  })
  return f
}
test('failed terminal renders no activity and recent failure together without inventing counts or outputs', () => {
  const s = map(failedTerminalFixture())
  const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: s }))
  assert.equal(s.training, false); assert.equal(s.terminalGeneratorSteps, null); assert.equal(s.terminalCriticSteps, null)
  assert.match(html, /当前无活动执行/)
  assert.match(html, /最近训练失败或受阻（不是正在运行）/)
  assert.match(html, /失败原因：未记录或无法核验/)
  assert.match(html, /失败 Run：<code>active<\/code>/)
  assert.match(html, /最近失败 Run 的图像生成状态未记录或无法核验/)
  assert.doesNotMatch(html, /role="status">正在训练|G：0|D：0|已生成|：未生成/)
})
test('terminal error comes only from the same verified Run and is safe text rather than a React object', () => {
  for (const [error, expected] of [['VALIDATION_BINDING_FAILED', 'VALIDATION_BINDING_FAILED'],
    [{ message: 'do not render object' }, '未记录或无法核验'],
    ['password=secret\n/path', '错误详情见已绑定终态证据']]) {
    const f = failedTerminalFixture(); f.current.snapshot.trainingPresentation.errorCode = error
    const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(f) }))
    assert.ok(html.includes(expected)); assert.doesNotMatch(html, /password=|secret|do not render object|\[object Object\]/)
  }
  const f = failedTerminalFixture(); f.current.snapshot.trainingPresentation.runId = 'other'
  f.current.snapshot.trainingPresentation.errorCode = 'OTHER_RUN_FAILURE'
  assert.equal(map(f).terminalErrorCode, null)
  const legacy = failedTerminalFixture(); delete legacy.current.snapshot.trainingPresentation.currentMetrics
  legacy.current.snapshot.trainingPresentation.errorCode = { message: 'invalid React child' }
  let html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(legacy) }))
  assert.doesNotMatch(html, /invalid React child|\[object Object\]/)
  legacy.current.errorCode = 'password=secret\n/path'
  html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(legacy) }))
  assert.doesNotMatch(html, /password=|secret|\/path/)
})
test('previous failure remains explicitly historical during a different active Run', () => {
  const f = boundFixture(); f.current.snapshot.trainingPresentation.errorCode = 'CURRENT_RUN_ONLY'
  const s = map(f), html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: s }))
  assert.equal(s.training, true); assert.equal(s.latestRunId, 'previous'); assert.equal(s.terminalErrorCode, null)
  assert.match(html, /正在训练（身份与进度已匹配）/)
  assert.match(html, /最近训练失败或受阻（不是正在运行）/)
  assert.doesNotMatch(html, /失败原因：CURRENT_RUN_ONLY/)
})
test('failed current read or missing latest terminal cannot assert recent failure', () => {
  const f = failedTerminalFixture(); f.current.connection = 'failed'
  let html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(f) }))
  assert.match(html, /断线或过期/); assert.doesNotMatch(html, /最近训练失败或受阻|失败原因：/)
  f.current.connection = 'ready'; f.current.snapshot.latestTrainingTerminal = null
  html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: map(f) }))
  assert.match(html, /尚无最近训练终态/); assert.doesNotMatch(html, /失败原因：/)
  f.current.snapshot.latestTrainingTerminal = { runId: null, status: 'failed_closed' }
  assert.equal(map(f).latestFailed, false)
})

function pollingHarness() {
  const code = ts.transpileModule(readFileSync(new URL('../../src/app/ai-console/ai-console-current-execution-store.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const timeouts = new Map(), intervals = new Map(), requests = [], subscribers = [], api = {}
  let sequence = 0, getter
  const fakeReact = { useSyncExternalStore(subscribe, getState) { getter = getState; subscribers.push(subscribe(() => {})); return getState() } }
  const fakeFetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url, options, resolve, reject })
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  })
  new Function('require', 'exports', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', code)(
    name => { assert.equal(name, 'react'); return fakeReact }, api, fakeFetch,
    (callback, ms) => { const id = ++sequence; timeouts.set(id, { callback, ms }); return id }, id => timeouts.delete(id),
    (callback, ms) => { const id = ++sequence; intervals.set(id, { callback, ms }); return id }, id => intervals.delete(id),
  )
  return { api, timeouts, intervals, requests, subscribers, state: () => getter() }
}
function currentResponse() {
  return { ...fixture().current.snapshot, schemaVersion: 'ai_console_ai_painter_current_execution_projection_v1', sourceIdentity: 'ai-painter-current-execution', sourcePath: '.runtime/ai-painter/current-execution-registry/current.json', reasonCode: null }
}
test('multiple summary subscribers share one current request and one 1000ms timer', async () => {
  const h = pollingHarness(); h.api.useAiConsoleCurrentExecution(); h.api.useAiConsoleCurrentExecution()
  assert.equal(h.requests.length, 1); assert.equal(h.intervals.size, 1); assert.equal([...h.intervals.values()][0].ms, 1000)
  const pending = h.api.refreshCurrentExecution(); assert.equal(h.requests.length, 1)
  assert.equal([...h.timeouts.values()][0].ms, 8000)
  h.requests[0].resolve({ ok: true, json: async () => currentResponse() }); await pending
  assert.equal(h.state().connection, 'ready'); assert.equal(h.timeouts.size, 0)
  h.subscribers[0](); assert.equal(h.intervals.size, 1); h.subscribers[1](); assert.equal(h.intervals.size, 0)
})
test('timeout retains last snapshot as failed, frees inflight and next fetch recovers', async () => {
  const h = pollingHarness(); h.api.useAiConsoleCurrentExecution()
  const first = h.api.refreshCurrentExecution(); h.requests[0].resolve({ ok: true, json: async () => currentResponse() }); await first
  const snapshot = h.state().snapshot, pending = h.api.refreshCurrentExecution()
  const timeout = [...h.timeouts.values()][0]; timeout.callback(); await pending
  assert.equal(h.state().connection, 'failed'); assert.equal(h.state().snapshot, snapshot); assert.match(h.state().errorCode, /timeout/)
  const retry = h.api.refreshCurrentExecution(); assert.equal(h.requests.length, 3)
  h.requests[2].resolve({ ok: true, json: async () => currentResponse() }); await retry
  assert.equal(h.state().connection, 'ready'); h.subscribers[0]()
})
test('last subscriber departure aborts request; HTTP error never marks retained data ready', async () => {
  const h = pollingHarness(); h.api.useAiConsoleCurrentExecution(); const pending = h.api.refreshCurrentExecution()
  h.requests[0].resolve({ ok: false, json: async () => currentResponse() }); await pending
  assert.equal(h.state().connection, 'failed')
  const next = h.api.refreshCurrentExecution(); h.subscribers[0]()
  assert.equal(h.requests[1].options.signal.aborted, true); await next; assert.equal(h.intervals.size, 0)
})

const workerClock = { availability: 'available', reasonCode: null,
  sourcePath: '.runtime/ai-painter/private-time/worker-execution-timing.json', sourceSha256: 'b'.repeat(64),
  scope: trainingTime.WORKER_TIMING_SCOPE, startedAtUtc: '2026-10-19T13:14:37.756250+00:00',
  endedAtUtc: '2026-10-19T16:22:37.142644+00:00', elapsedSeconds: 11279.391,
  status: 'completed', stopReason: null }
test('active and recent summary clocks never borrow each other or historical selected Run data', () => {
  const f = boundFixture(); f.current.snapshot.trainingPresentation.workerExecutionTiming = workerClock
  f.current.snapshot.selectedHistoricalRun = { runId: 'other', workerExecutionTiming: { ...workerClock, elapsedSeconds: 999 } }
  let s = map(f)
  assert.equal(s.activeTiming.available, true); assert.equal(s.latestTiming.available, false)
  assert.match(s.activeTiming.elapsed, /11279.391秒/)
  f.current.snapshot.activeExecution = null
  f.current.snapshot.latestTrainingTerminal = { runId: 'active', status: 'training_completed_review_pending' }
  f.current.snapshot.currentProjectTask.executionState = 'failed_closed'
  s = map(f)
  assert.equal(s.training, false); assert.equal(s.activeTiming.available, false); assert.equal(s.latestTiming.available, true)
  const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: s }))
  assert.match(html, /当前无活动执行/)
  assert.match(html, /worker开始时间/); assert.match(html, /2026-10-19 21:14:37.756/)
  assert.match(html, /2026-10-20 00:22:37.142/); assert.match(html, /3小时7分59.391秒（11279.391秒）/)
  assert.match(html, /不是纯GPU训练耗时/); assert.doesNotMatch(html, /999\.000秒/)
})
test('stale, disconnected, unavailable and mismatched current parents do not authenticate worker clock', () => {
  for (const mutate of [f => { f.current.connection = 'failed' },
    f => { f.current.snapshot.observedAtUtc = new Date(now - 11000).toISOString() },
    f => { f.current.snapshot.trainingPresentation.runId = 'wrong' },
    f => { f.current.snapshot.trainingPresentation.availability = 'unavailable' }]) {
    const f = boundFixture(); f.current.snapshot.trainingPresentation.workerExecutionTiming = workerClock; mutate(f)
    const s = map(f)
    assert.equal(s.activeTiming.available, false); assert.equal(s.latestTiming.available, false)
    const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: s }))
    assert.doesNotMatch(html, /11279.391秒|2026-10-19 21:14:37/)
  }
})
test('started worker clock in summary never invents current elapsed or an end from telemetry', () => {
  const f = boundFixture()
  f.current.snapshot.trainingPresentation.workerExecutionTiming = { ...workerClock, status: 'started', endedAtUtc: null, elapsedSeconds: null }
  const s = map(f), html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary: s }))
  assert.equal(s.training, true); assert.match(html, /最终耗时未知（仅有开始记录）/)
  assert.doesNotMatch(html, /0\.000秒|worker结束时间<\/dt><dd>2026/)
})
test('real current GET clock matches immutable file bytes and renders on the recent execution summary', {
  skip: !process.env.AI_CONSOLE_TIME_HTTP_TEST_ORIGIN,
}, async t => {
  const origin = new URL(process.env.AI_CONSOLE_TIME_HTTP_TEST_ORIGIN)
  assert.equal(origin.hostname, '127.0.0.1'); assert.equal(origin.protocol, 'http:')
  const response = await fetch(new URL('/api/ai-console/observability/current-execution', origin), { signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/)
  const snapshot = await response.json(), clock = snapshot.trainingPresentation.workerExecutionTiming
  assert.equal(snapshot.ok, true); assert.equal(snapshot.activeExecution, null); assert.equal(clock.availability, 'available')
  assert.equal(snapshot.trainingPresentation.runId, snapshot.latestTrainingTerminal.runId)
  assert.match(clock.sourcePath, /^\.runtime\/ai-painter\/[a-zA-Z0-9/_.-]+$/u)
  assert.ok(!clock.sourcePath.split('/').includes('..'))
  const bytes = readFileSync(new URL(`../../${clock.sourcePath}`, import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), clock.sourceSha256)
  const original = JSON.parse(bytes)
  for (const key of ['scope', 'startedAtUtc', 'endedAtUtc', 'elapsedSeconds', 'status', 'stopReason']) assert.deepEqual(clock[key], original[key])
  const summary = model.mapTrainingSummary({ connection: 'ready', errorCode: null, snapshot }, { connection: 'failed', snapshot: null }, Date.now())
  assert.equal(summary.training, false); assert.equal(summary.latestTiming.available, true)
  const html = renderToStaticMarkup(React.createElement(view.TrainingSummaryView, { summary }))
  assert.ok(html.includes(summary.latestTiming.startedAt)); assert.ok(html.includes(summary.latestTiming.endedAt)); assert.ok(html.includes(summary.latestTiming.elapsed))
  t.diagnostic(JSON.stringify({ runId: snapshot.latestTrainingTerminal.runId, httpStatus: response.status, clock,
    renderedElapsed: summary.latestTiming.elapsed, acceptance: 'real_http_file_sha_and_component_ssr_not_browser_or_production_chain_acceptance' }))
})
