import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const source = readFileSync(new URL('../../src/app/ai-console/ai-console-training-summary-model.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const model = {}
new Function('exports', compiled)(model)
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
const viewFragment = `const styles = {}; const Link = ({prefetch, ...props}) => require('react').createElement('a', props);\n${viewSource.slice(viewSource.indexOf('function beijingTime'), viewSource.indexOf('export function AiConsoleTrainingSummary'))}`
const viewCompiled = ts.transpileModule(viewFragment, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const view = {}; new Function('require', 'exports', viewCompiled)(createRequire(import.meta.url), view)
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
