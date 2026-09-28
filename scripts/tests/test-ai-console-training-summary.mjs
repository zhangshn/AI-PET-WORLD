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
const now = Date.parse('2026-09-28T10:30:00Z'), time = new Date(now).toISOString()
function fixture() {
  return {
    current: { connection: 'ready', errorCode: null, snapshot: {
      ok: true, dataStatus: 'connected', integrityStatus: 'verified', observedAtUtc: time,
      currentProjectTask: { runId: 'active', taskKind: 'bounded_train_only_learning_capacity_experiment' },
      activeExecution: { runId: 'active', processId: 123, executionState: 'executing' },
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
const viewFragment = `const styles = {}; const Link = props => require('react').createElement('a', props);\n${viewSource.slice(viewSource.indexOf('function beijingTime'), viewSource.indexOf('export function AiConsoleTrainingSummary'))}`
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
