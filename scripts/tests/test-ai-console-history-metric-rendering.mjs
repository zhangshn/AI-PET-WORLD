import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'

// Compile the actual pure component, without importing polling or CSS into Node.
const source = readFileSync(new URL('../../src/app/ai-console/ai-console-training-history.tsx', import.meta.url), 'utf8')
const start = source.indexOf('function readableJson('), end = source.indexOf('function EvidenceImage(')
assert.ok(start >= 0 && end > start)
const fragment = source.slice(start, end) + '\nexport { MetricSummary, readableJson };'
const compiled = ts.transpileModule(fragment, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
new Function('require', 'exports', compiled)(createRequire(import.meta.url), exports)
const imageStart = source.indexOf('function EvidenceImage('), imageEnd = source.indexOf('export function AiConsoleTrainingHistory(')
assert.ok(imageStart >= 0 && imageEnd > imageStart)
const imageFragment = `const useState = require('react').useState; const styles = {};\n${source.slice(imageStart, imageEnd)}\nexport { EvidenceImage };`
const imageCompiled = ts.transpileModule(imageFragment, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
const imageExports = {}
new Function('require', 'exports', imageCompiled)(createRequire(import.meta.url), imageExports)
const statusStart = source.indexOf('function statusLabel('), statusEnd = source.indexOf('function reasonLabel(', statusStart)
assert.ok(statusStart >= 0 && statusEnd > statusStart)
const statusCompiled = ts.transpileModule(`${source.slice(statusStart, statusEnd)}\nexport { runStatusLabel }`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const statusExports = {}
new Function('exports', statusCompiled)(statusExports)

// Render the whole existing page through React's server renderer. Seed real
// useState hooks with an already-loaded detail/page; effects perform no reads.
function renderHistorySteps(detailSteps, checkpointSteps, runFields = {}) {
  const run = { runId: 'history-gd-run', runKind: 'dry_single_world_bounded_training', terminalStatus: 'failed_closed', sourceRevision: 1, finishedAtUtc: null, optimizerSteps: detailSteps, ...runFields }
  const checkpoint = { artifactId: 'cp-gd', role: 'checkpoint', url: '/bound-checkpoint', logicalPath: 'run/checkpoint.pt', sha256: 'a'.repeat(64), byteLength: 100, optimizerSteps: checkpointSteps, verificationStatus: 'binding_verified_bytes_not_read' }
  const listing = { sourceRevision: 1, records: [run], nextCursor: null, total: 1, coverage: {} }
  const detail = { dataStatus: 'connected', reasonCode: null, record: run }
  const page = { dataStatus: 'connected', reasonCode: null, section: 'artifacts', items: [checkpoint], nextCursor: null, knownItemCount: 1, total: 1, coverage: {} }
  const seeded = [listing, detail, run.runId, null, null, null, null, 'artifacts', null, page, null, '']
  let stateIndex = 0
  const pageExports = {}, nativeRequire = createRequire(import.meta.url)
  const pageCompiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'exports', pageCompiled)(name => {
    if (name === 'react') return { ...React, useState: () => React.useState(seeded[stateIndex++]) }
    if (name.includes('history-poll')) return { startHistoryPolling() { throw new Error('SSR must not start polling') } }
    if (name.includes('training-summary')) return { AiConsoleTrainingSummary: () => null }
    if (name.endsWith('.css')) return { default: {} }
    return nativeRequire(name)
  }, pageExports)
  const html = renderToStaticMarkup(React.createElement(pageExports.AiConsoleTrainingHistory))
  const detailText = html.match(/真实优化步：([^<]+) · 分辨率：/u)?.[1]
  const checkpointText = html.match(/100字节 · ([^<]+)优化步<\/a>/u)?.[1]
  assert.ok(detailText !== undefined, 'actual Run detail must render')
  assert.ok(checkpointText !== undefined, 'actual paged Checkpoint must render')
  assert.doesNotMatch(html, /\[object Object\]/u)
  return { html, detailText, checkpointText }
}

test('raw G/D objects reproduce the reported React child error', () => {
  assert.throws(() => renderToStaticMarkup(React.createElement('p', null, { generator: 475, discriminator: 476 })), /Objects are not valid as a React child/u)
})

test('actual Run and Checkpoint renders preserve legacy scalar integers and zero', () => {
  const result = renderHistorySteps(475, 0)
  assert.equal(result.detailText, '475')
  assert.equal(result.checkpointText, '0')
})

test('actual Run and Checkpoint renders preserve distinct G/D counts and paired zero', () => {
  const result = renderHistorySteps({ generator: 475, discriminator: 476 }, { generator: 0, discriminator: 0 })
  assert.equal(result.detailText, 'G（生成器）：475 · D（判别器）：476')
  assert.equal(result.checkpointText, 'G（生成器）：0 · D（判别器）：0')
})

test('actual Run and Checkpoint renders preserve partial G/D without inventing missing zero', () => {
  for (const [value, expected] of [
    [{ generator: 0 }, 'G（生成器）：0 · D（判别器）：未记录'],
    [{ discriminator: 476 }, 'G（生成器）：未记录 · D（判别器）：476'],
    [{ generator: null, discriminator: 2 }, 'G（生成器）：未记录 · D（判别器）：2'],
    [{ generator: 3, discriminator: undefined }, 'G（生成器）：3 · D（判别器）：未记录'],
    [{ generator: '475', discriminator: 476 }, 'G（生成器）：数据格式异常 · D（判别器）：476'],
    [{ generator: 475, discriminator: {} }, 'G（生成器）：475 · D（判别器）：数据格式异常'],
  ]) {
    const result = renderHistorySteps(value, value)
    assert.equal(result.detailText, expected)
    assert.equal(result.checkpointText, expected)
  }
})

test('actual Run and Checkpoint renders show missing and empty counts explicitly', () => {
  for (const value of [undefined, null, {}, { generator: null, discriminator: null }]) {
    const expected = value && ('generator' in value) ? 'G（生成器）：未记录 · D（判别器）：未记录' : '未记录'
    const result = renderHistorySteps(value, value)
    assert.equal(result.detailText, expected)
    assert.equal(result.checkpointText, expected)
  }
})

test('actual Run and Checkpoint renders reject malformed counts and unknown types safely', () => {
  for (const value of ['475', '', true, false, [], [1, 2], { unrelated: 475 }, new Date(0), new Map(), new Set(), Object.create({ generator: 475 }), -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1n, Symbol('steps'), () => 475]) {
    const result = renderHistorySteps(value, value)
    assert.equal(result.detailText, '数据格式异常')
    assert.equal(result.checkpointText, '数据格式异常')
  }
})

test('all 30 epochs have individual details beyond the aggregate preview limit', () => {
  const metrics = Array.from({ length: 30 }, (_, i) => ({ sourceField: 'epoch_metrics', epoch: i + 1, measurements: { diagnostic: 'x'.repeat(4000), tail: `epoch_tail_${i + 1}` } }))
  assert.ok(JSON.stringify(metrics).length > 64000)
  const html = renderToStaticMarkup(React.createElement(exports.MetricSummary, { metrics }))
  assert.equal((html.match(/查看本项实际度量/g) ?? []).length, 30)
  assert.ok(html.includes('第 1 轮：查看本项实际度量'))
  assert.ok(html.includes('第 30 轮：查看本项实际度量'))
  assert.ok(html.includes('epoch_tail_30'))
})
test('sample metrics and primitive records remain visible without invented identities', () => {
  const html = renderToStaticMarkup(React.createElement(exports.MetricSummary, { metrics: [{ sampleId: 'known-sample', seed: 7, measurements: { loss: 0.2 } }, 42] }))
  assert.ok(html.includes('known-sample'))
  assert.ok(html.includes('指标项 2'))
  assert.ok(html.includes('42'))
})
test('individual oversized Unicode fields have an explicit byte-bounded preview', () => {
  const text = exports.readableJson({ value: '世'.repeat(40000) })
  assert.ok(text.includes('本项显示已截断'))
  assert.ok(Buffer.byteLength(text) < 65536)
})
test('verified comparison image renders a clickable artifact and does not claim visual pass', () => {
  const item = { artifactId: 'image-1', role: 'image', sourceLabel: 'comparison.png', sampleId: 'sample-1', logicalPath: '.runtime/ai-painter/run/comparison.png', sha256: 'a'.repeat(64), url: '/api/ai-console/training/history/run-1/artifacts/image-1', verificationStatus: 'binding_verified_bytes_not_read' }
  const html = renderToStaticMarkup(React.createElement(imageExports.EvidenceImage, { item }))
  assert.ok(html.includes('href="/api/ai-console/training/history/run-1/artifacts/image-1"'))
  assert.ok(html.includes('src="/api/ai-console/training/history/run-1/artifacts/image-1"'))
  assert.ok(html.includes('comparison.png'))
  assert.ok(!html.includes('机器审核通过'))
})
test('independent review failure outranks training-completed card label without erasing terminal', () => {
  const run = { terminalStatus: 'training_completed_review_pending', independentReviewStatus: 'dry_single_world_visual_slice_failed_closed' }
  assert.match(statusExports.runStatusLabel(run), /独立审核未通过/)
  assert.equal(run.terminalStatus, 'training_completed_review_pending')
  assert.doesNotMatch(statusExports.runStatusLabel({ terminalStatus: run.terminalStatus }), /独立审核未通过/)
})

test('actual history page exposes the bound ValueError without pretending a failed Run is current', () => {
  const { html } = renderHistorySteps(null, null, { failureSummary: {
    type: 'ValueError', message: 'snapshot outside verified source/known control',
  }, checkpoints: [], artifacts: [] })
  assert.match(html, /已登记失败信息（不是当前执行）/)
  assert.match(html, /ValueError: snapshot outside verified source\/known control/)
  assert.match(html, /Checkpoint：未记录或无法核验/)
  assert.match(html, /验证／输出图：未记录或无法核验/)
  assert.doesNotMatch(html, /缺8项|G（生成器）：0|D（判别器）：0|：未生成|\[object Object\]/)
})
test('missing or malformed failure fields remain unknown and never become raw React children', () => {
  for (const failureSummary of [undefined, null, 17, ['secret'], { type: { invalid: true }, message: { secret: true } }]) {
    const { html } = renderHistorySteps(null, null, { failureSummary })
    assert.match(html, /错误信息未记录或无法核验/)
    assert.doesNotMatch(html, /\[object Object\]|secret|invalid/)
  }
})
test('unknown error text does not expose credentials, paths or unsafe markup', () => {
  const { html } = renderHistorySteps(null, null, { failureSummary: {
    type: 'ValueError', message: '<script>password=secret</script> C:/private',
  } })
  assert.match(html, /ValueError: 错误详情见已绑定终态证据/)
  assert.doesNotMatch(html, /password=|secret|C:\/private|<script>/)
})
test('empty artifact arrays and rejected qualification do not prove outputs were never generated', () => {
  const { html } = renderHistorySteps(null, null, { artifacts: [], checkpoints: [], qualification: {
    checkpointSelected: false, checkpointPromotionEligible: false, checkpointReloadVerified: false,
  } })
  assert.match(html, /未记录或无法核验/)
  assert.doesNotMatch(html, /Checkpoint：未生成|验证／输出图：未生成/)
})
test('existing bound outputs and checkpoints remain visible without asserting qualification', () => {
  const { html } = renderHistorySteps(475, 0, { artifacts: [
    { role: 'output' }, { role: 'checkpoint' },
  ] })
  assert.match(html, /Checkpoint：已登记，内容与资格以核验证据为准/)
  assert.match(html, /验证／输出图：已登记，图片按需核验读取/)
  assert.match(html, /真实优化步：475/)
  assert.match(html, /100字节 · 0优化步/)
})
test('completed history without failure evidence does not acquire a failure notice', () => {
  const { html } = renderHistorySteps(475, 0, { terminalStatus: 'training_completed_review_pending' })
  assert.doesNotMatch(html, /已登记失败信息（不是当前执行）/)
})
