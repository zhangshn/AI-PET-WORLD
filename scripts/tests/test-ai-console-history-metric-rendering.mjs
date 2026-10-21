import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
import { trainingTime } from './helpers/training-time-cpu.mjs'

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
const imageFragment = `const useState = require('react').useState; const styles = {};\n${source.slice(source.indexOf('function formatOptimizerSteps('), start)}\n${source.slice(imageStart, imageEnd)}\nexport { EvidenceImage };`
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
function renderHistorySteps(detailSteps, checkpointSteps, runFields = {}, artifactItems, pageFields = {}, detailFailure = null) {
  const run = { runId: 'history-gd-run', runKind: 'dry_single_world_bounded_training', terminalStatus: 'failed_closed', sourceRevision: 1, finishedAtUtc: null, optimizerSteps: detailSteps, ...runFields }
  const checkpoint = { artifactId: 'cp-gd', role: 'checkpoint', url: '/bound-checkpoint', logicalPath: 'run/checkpoint.pt', sha256: 'a'.repeat(64), byteLength: 100, optimizerSteps: checkpointSteps, verificationStatus: 'binding_verified_bytes_not_read' }
  const listing = { sourceRevision: 1, records: [run], nextCursor: null, total: 1, coverage: {} }
  const detail = { dataStatus: 'connected', reasonCode: null, record: run }
  const items = artifactItems ?? [checkpoint]
  // SectionPage carries its own exact record identity; it is now readable even
  // when the independent detail query fails. Match the actual API contract.
  const page = { dataStatus: 'connected', reasonCode: null, record: run, section: 'artifacts', items, nextCursor: null, knownItemCount: items.length, total: items.length, coverage: {}, ...pageFields }
  const seeded = [listing, detail, run.runId, null, null, null, detailFailure, 'artifacts', null, page, null, '']
  let stateIndex = 0
  const pageExports = {}, nativeRequire = createRequire(import.meta.url)
  const pageCompiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'exports', pageCompiled)(name => {
    if (name === 'react') return { ...React, useState: () => React.useState(seeded[stateIndex++]) }
    if (name === './ai-console-training-time') return trainingTime
    if (name.includes('history-poll')) return { startHistoryPolling() { throw new Error('SSR must not start polling') } }
    if (name.includes('training-summary')) return { AiConsoleTrainingSummary: () => null }
    if (name.endsWith('.css')) return { default: {} }
    return nativeRequire(name)
  }, pageExports)
  const html = renderToStaticMarkup(React.createElement(pageExports.AiConsoleTrainingHistory))
  const detailText = html.match(/真实优化步：([^<]+) · 分辨率：/u)?.[1]
  const checkpointText = html.match(/100字节 · ([^<]+)优化步<\/a>/u)?.[1]
  assert.ok(detailText !== undefined, 'actual Run detail must render')
  if (artifactItems === undefined) assert.ok(checkpointText !== undefined, 'actual paged Checkpoint must render')
  assert.doesNotMatch(html, /\[object Object\]/u)
  return { html, detailText, checkpointText }
}

test('raw G/D objects reproduce the reported React child error', () => {
  assert.throws(() => renderToStaticMarkup(React.createElement('p', null, { generator: 475, discriminator: 476 })), /Objects are not valid as a React child/u)
})

const workerTiming = { availability: 'available', reasonCode: null,
  sourcePath: '.runtime/ai-painter/private-time/worker-execution-timing.json', sourceSha256: 'b'.repeat(64),
  scope: trainingTime.WORKER_TIMING_SCOPE, startedAtUtc: '2026-10-19T13:14:37.756250+00:00',
  endedAtUtc: '2026-10-19T16:22:37.142644+00:00', elapsedSeconds: 11279.391,
  status: 'completed', stopReason: null }
test('list with available worker timing immediately shows its own start, end, elapsed and scope without another request', () => {
  const { html } = renderHistorySteps(0, 0, { workerExecutionTiming: workerTiming })
  const card = html.split('<article')[0]
  assert.match(card, /worker开始时间：2026-10-19 21:14:37.756/)
  assert.match(card, /worker结束时间：2026-10-20 00:22:37.142/)
  assert.match(card, /3小时7分59.391秒（11279.391秒）/)
  assert.match(card, /含认证、数据与模型加载、训练、Checkpoint、验证及最终进度/)
  assert.doesNotMatch(card, /列表未提供可用worker计时/)
  assert.equal((source.match(/await fetch\(/gu) ?? []).length, 3, 'existing list, selected detail and selected section only')
})
test('historical raw start and finish remain visible but registration and UTC difference never create elapsed time', () => {
  const { html } = renderHistorySteps(0, 0, { startedAtUtc: workerTiming.startedAtUtc,
    finishedAtUtc: workerTiming.endedAtUtc, registeredAtUtc: '2026-10-20T08:00:00Z' })
  assert.match(html, /运行记录开始时间/); assert.match(html, /2026-10-19 21:14:37.756/)
  assert.match(html, /运行记录结束时间/); assert.match(html, /2026-10-20 00:22:37.142/)
  assert.match(html, /无单调计时证据/); assert.match(html, /列表未提供可用worker计时，请到详情查看/)
  assert.doesNotMatch(html, /11279.391秒|3小时7分/)
})
test('worker timing stays separate from lifecycle times, stale detail, registration and image generation time', () => {
  const { html } = renderHistorySteps(0, 0, { workerExecutionTiming: workerTiming,
    startedAtUtc: '2026-10-19T00:00:00Z', finishedAtUtc: '2026-10-20T00:00:00Z' }, [
    { artifactId: 'png-time', role: 'output', url: '/private.png', logicalPath: 'private.png', sha256: 'a'.repeat(64), verificationStatus: 'verified' },
  ], {}, '断线测试')
  assert.match(html, /原始运行记录（与worker范围分开）/)
  assert.match(html, /计时为上次成功详情快照，已过期/)
  const image = html.match(/<figure>.*?<\/figure>/u)?.[0]
  assert.ok(image); assert.match(image, /无自身区间，不采用任务耗时/)
  assert.doesNotMatch(image, /11279.391|21:14:37/)
})
test('missing and unavailable list timing display unknown with detail entry while preserving original known times', () => {
  for (const workerExecutionTiming of [undefined, { ...workerTiming, availability: 'unavailable', reasonCode: 'worker_timing_missing' }]) {
    const { html } = renderHistorySteps(0, 0, { workerExecutionTiming, startedAtUtc: workerTiming.startedAtUtc })
    const card = html.split('<article')[0]
    assert.match(card, /开始时间：2026-10-19 21:14:37.756/)
    assert.match(card, /结束时间：未记录／未知/)
    assert.match(card, /列表未提供可用worker计时，请到详情查看/)
    assert.doesNotMatch(card, /11279.391|worker结束时间：2026/)
  }
})
test('started-only history timing retains final nulls even if terminal status has closed after interruption', () => {
  const { html } = renderHistorySteps(0, 0, { terminalStatus: 'interrupted', workerExecutionTiming: {
    ...workerTiming, status: 'started', endedAtUtc: null, elapsedSeconds: null } })
  assert.match(html, /最终耗时未知（仅有开始记录）/)
  assert.match(html, /仅记录开始，不代表当前仍在运行/)
  assert.doesNotMatch(html, /worker已结束|0\.000秒/)
})

test('live selected-run timing matches real HTTP and renders through the actual history component', {
  skip: !process.env.AI_CONSOLE_TIME_HTTP_TEST_ORIGIN,
}, async t => {
  const origin = new URL(process.env.AI_CONSOLE_TIME_HTTP_TEST_ORIGIN)
  assert.equal(origin.hostname, '127.0.0.1'); assert.equal(origin.protocol, 'http:')
  const currentResponse = await fetch(new URL('/api/ai-console/observability/current-execution', origin), { signal: AbortSignal.timeout(20000) })
  assert.equal(currentResponse.status, 200)
  const current = await currentResponse.json(), runId = current.latestTrainingTerminal.runId
  const response = await fetch(new URL(`/api/ai-console/training/history/${encodeURIComponent(runId)}`, origin), { signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/)
  const { record } = await response.json()
  assert.equal(record.runId, runId)
  assert.deepEqual(record.workerExecutionTiming, current.trainingPresentation.workerExecutionTiming)
  assert.equal(record.workerExecutionTiming.availability, 'available')
  const listResponse = await fetch(new URL('/api/ai-console/training/history?limit=50', origin), { signal: AbortSignal.timeout(20000) })
  assert.equal(listResponse.status, 200); assert.match(listResponse.headers.get('cache-control'), /no-store/)
  const listing = await listResponse.json(), listed = listing.records.find(row => row.runId === runId)
  assert.ok(listed, 'the selected latest terminal must be on the verified first page')
  assert.deepEqual(listed.workerExecutionTiming, record.workerExecutionTiming, 'list and detail must consume the same authenticated Worker timing')
  const { html } = renderHistorySteps(record.optimizerSteps, null, { ...record, workerExecutionTiming: listed.workerExecutionTiming }, [])
  const card = html.split('<article')[0]
  const view = trainingTime.mapWorkerTiming(record.workerExecutionTiming)
  assert.ok(html.includes(view.startedAt)); assert.ok(html.includes(view.endedAt)); assert.ok(html.includes(view.elapsed))
  assert.ok(card.includes(view.startedAt)); assert.ok(card.includes(view.endedAt)); assert.ok(card.includes(view.elapsed))
  assert.doesNotMatch(card, /列表未提供可用worker计时/)
  t.diagnostic(JSON.stringify({ runId, httpStatus: response.status, timing: record.workerExecutionTiming,
    renderedElapsed: view.elapsed, acceptance: 'real_http_and_component_ssr_not_browser_or_production_chain_acceptance' }))
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

test('exact wall_timeout displays the training stop reason and only the selected frozen plan limit', () => {
  for (const maxWallSeconds of [1, 321, 9017]) {
    const { html } = renderHistorySteps(null, null, { failureSummary: { type: 'Error', message: 'wall_timeout' },
      detailCoverage: { phase: 'training' }, trainingPlan: { maxWallSeconds }, targetEpochs: 24 }, [])
    assert.match(html, /达到本轮训练时间上限，已停止/u)
    assert.ok(html.includes(`本轮冻结训练时限：${maxWallSeconds}秒`))
    assert.match(html, /不代表实际运行耗时/u)
    assert.doesNotMatch(html, /8400|已完成轮数：0/u)
  }
})

test('training timeout without a valid same-Run plan limit never invents a duration', () => {
  for (const maxWallSeconds of [undefined, null, '321', 0, -1, 0.5, NaN, Infinity, {}, true, Number.MAX_SAFE_INTEGER + 1]) {
    const { html } = renderHistorySteps(null, null, { failureSummary: { type: 'Error', message: 'wall_timeout' },
      detailCoverage: { phase: 'training' }, trainingPlan: { maxWallSeconds } }, [])
    assert.match(html, /达到本轮训练时间上限，已停止/u)
    assert.doesNotMatch(html, /本轮冻结训练时限|8400|\[object Object\]/u)
  }
  for (const trainingPlan of [undefined, null, [], 'secret-plan', 17]) {
    const { html } = renderHistorySteps(null, null, { failureSummary: { type: 'Error', message: 'wall_timeout' },
      detailCoverage: { phase: 'training' }, trainingPlan }, [])
    assert.match(html, /达到本轮训练时间上限，已停止/u)
    assert.doesNotMatch(html, /本轮冻结训练时限|secret-plan/u)
  }
})

test('qualification timeout and an unknown phase are not mislabeled as training or assigned its time budget', () => {
  for (const phase of ['qualification', 'gpu_qualification', undefined, null, 'review', { toString: 'secret-phase' }]) {
    const { html } = renderHistorySteps(null, null, { failureSummary: { type: 'Error', message: 'wall_timeout' },
      detailCoverage: { phase }, trainingPlan: { maxWallSeconds: 321 } }, [])
    assert.match(html, /达到本轮(?:资格检查|执行)时间上限，已停止/u)
    assert.doesNotMatch(html, /达到本轮训练时间上限|本轮冻结训练时限/u)
    // The existing collapsed technical coverage intentionally retains escaped
    // source metadata. Only the user-facing failure notice uses the allowlist.
    const notice = html.match(/<section aria-label="所选Run失败信息">[\s\S]*?<\/section>/u)?.[0]
    assert.ok(notice)
    assert.doesNotMatch(notice, /secret-phase|\[object Object\]/u)
  }
})

test('unknown, malicious and decorated timeout messages remain hidden by the exact code allowlist', () => {
  for (const message of ['wall_timeout\n', 'wall_timeout\r\n', 'wall_timeout suffix', 'prefix wall_timeout', ' wall_timeout',
    'wall_timeout password=secret', 'wall_timeout C:/private', '<script>secret</script>', 'WALL_TIMEOUT', { secret: true }]) {
    const { html } = renderHistorySteps(null, null, { failureSummary: { type: 'Error', message },
      detailCoverage: { phase: 'training' }, trainingPlan: { maxWallSeconds: 321 } }, [])
    assert.doesNotMatch(html, /达到本轮.*时间上限|本轮冻结训练时限|password=|secret|C:\/private|<script>|\[object Object\]/u)
    assert.match(html, /错误详情见已绑定终态证据|错误信息未记录或无法核验/u)
  }
})

const artifactSourceGap = '缺少受信终态清单，当前接口未接入；不能据此判定未训练、未生成或未保存。'
test('the exact terminal-manifest gap is explicit outside collapsed technical fields', () => {
  const { html } = renderHistorySteps(null, null, { detailCoverage: { artifactSourceGap }, artifacts: [] }, [])
  const message = html.match(/<p[^>]+aria-label="产物来源缺口"[^>]*>(.*?)<\/p>/u)?.[1]
  assert.equal(message, artifactSourceGap)
  assert.ok(html.indexOf('aria-label="产物来源缺口"') < html.indexOf('<summary>内容覆盖与缺失项'))
  assert.doesNotMatch(message, /没有保存|未曾训练|未生成任何/u)
})

test('unknown or decorated backend gap text is not promoted to a user-facing notice', () => {
  for (const value of ['secret=do-not-render', artifactSourceGap + '\n', artifactSourceGap + 'secret', {}, null]) {
    const { html } = renderHistorySteps(null, null, { detailCoverage: { artifactSourceGap: value } }, [])
    assert.doesNotMatch(html, /aria-label="产物来源缺口"/u)
    const paragraphs = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gu)?.join('') ?? ''
    assert.doesNotMatch(paragraphs, /do-not-render|secret|\[object Object\]/u)
  }
})

test('empty-image copy follows actual nextCursor and diagnostic entries, not an assumed other page', () => {
  const preview = { artifactId: 'diagnostic', role: 'image', evidenceKind: 'training_diagnostic_preview',
    logicalPath: 'run/preview.png', sha256: 'd'.repeat(64), url: '/existing-preview' }
  for (const hasPreview of [false, true]) for (const nextCursor of [null, 'opaque-next-page']) {
    const { html } = renderHistorySteps(null, null, { detailCoverage: { artifactSourceGap } }, hasPreview ? [preview] : [], { nextCursor })
    assert.match(html, /本页没有原图／结果图/u)
    if (hasPreview) {
      assert.match(html, /本页训练诊断预览已单独列示/u)
      assert.match(html, /aria-label="未审核训练预览"/u)
    } else {
      assert.match(html, /本页没有可查看的训练诊断预览条目/u)
      assert.doesNotMatch(html, /预览另列|预览已单独列示|aria-label="未审核训练预览"/u)
    }
    if (nextCursor) assert.match(html, /其他内容可继续分页查看/u)
    else {
      assert.match(html, /本节没有下一页/u)
      assert.doesNotMatch(html, /继续分页|其他页与实际缺口/u)
    }
  }
})

function faultArtifact(kind, overrides = {}) {
  return { artifactId: kind, role: 'evidence', evidenceKind: kind,
    url: `/api/ai-console/training/history/history-gd-run/artifacts/${kind}`,
    logicalPath: `run/${kind}.json`, sha256: 'b'.repeat(64), verificationStatus: 'binding_verified_bytes_not_read', ...overrides }
}

test('parameter-88 failure shows exact recorded 11/24 epochs and distinct 539/540 updates, not a guessed module', () => {
  const artifacts = [faultArtifact('gradientFailureManifest'), faultArtifact('gradientFailurePrimary')]
  const { html } = renderHistorySteps({ generator: 539, discriminator: 540 }, null, {
    completedEpochs: 11, targetEpochs: 24, artifacts, checkpoints: [],
    failureSummary: { type: 'ValueError', message: 'actual four-term total gradient identity differs at parameter 88' },
  }, artifacts)
  assert.match(html, /ValueError: 四项总梯度一致性检查未通过（参数索引 88）/u)
  assert.match(html, /已完成轮数：11 \/ 计划轮数：24/u)
  assert.match(html, /G（生成器）：539 · D（判别器）：540/u)
  assert.match(html, /本轮无已登记结果图/u)
  assert.match(html, /未记录或无法核验不等于文件不存在/u)
  assert.match(html, /故障证据（非图片）/u)
  for (const [kind, label] of [['gradientFailureManifest', '故障清单'], ['gradientFailurePrimary', '首错记录']]) {
    assert.match(html, new RegExp(`href="/api/ai-console/training/history/history-gd-run/artifacts/${kind}"[^>]*>${label}`))
  }
  assert.equal((html.match(/SHA：b{64}/g) ?? []).length, 2)
  assert.doesNotMatch(html, /<img|terrain\.decode|layers\.3|全部训练完成|参数88已修复/u)
})

test('gradient failure allowlist accepts only a complete bounded canonical parameter index', () => {
  for (const index of ['0', '52', '88', '107']) {
    const { html } = renderHistorySteps(0, 0, { failureSummary: { message: `actual four-term total gradient identity differs at parameter ${index}` } })
    assert.ok(html.includes(`四项总梯度一致性检查未通过（参数索引 ${index}）`))
  }
  for (const message of [
    'actual four-term total gradient identity differs at parameter 88\n',
    'actual four-term total gradient identity differs at parameter 88 secret=credential',
    'prefix actual four-term total gradient identity differs at parameter 88',
    ...['-1', '1.5', '1e2', '088', '８８', '123456789', '88 C:/private'].map(index => `actual four-term total gradient identity differs at parameter ${index}`),
    'secret='.repeat(20000),
  ]) {
    const { html } = renderHistorySteps(null, null, { failureSummary: { type: 'passwordSecret', message } })
    assert.match(html, /错误详情见已绑定终态证据/u)
    assert.doesNotMatch(html, /检查未通过（参数索引|passwordSecret|secret=|credential|C:\/private/u)
  }
})

test('failure counts use only recorded fields and safely distinguish missing, zero and malformed epochs', () => {
  for (const value of [null, undefined, 0, 11, -1, 0.5, '11', { secret: 'do-not-display' }, [], NaN, Infinity]) {
    const { html } = renderHistorySteps({ generator: 0 }, null, {
      completedEpochs: value, targetEpochs: value,
      failureSummary: { type: { secret: 'do-not-display' }, message: { secret: 'do-not-display' }, completedEpochs: 999 },
    })
    const label = value == null ? '未记录' : Number.isSafeInteger(value) && value >= 0 ? String(value) : '数据格式异常'
    assert.ok(html.includes(`已完成轮数：${label} / 计划轮数：${label}`))
    assert.match(html, /G（生成器）：0 · D（判别器）：未记录/u)
    assert.doesNotMatch(html, /do-not-display|999|\[object Object\]/u)
  }
})

test('only explicit evidence roles/kinds receive fault labels; unknown kinds stay generic and unavailable links stay non-clickable', () => {
  const artifacts = [faultArtifact('gradientFailureManifest', { url: null }), faultArtifact('secret-kind'),
    faultArtifact('gradientFailurePrimary', { role: 'request' })]
  const { html } = renderHistorySteps(null, null, { artifacts }, artifacts)
  assert.match(html, /故障清单 · 证据原文不可预览/u)
  assert.match(html, />已绑定证据 /u)
  assert.match(html, />实验请求与样本 /u)
  assert.doesNotMatch(html, /href="undefined"|>首错记录|>secret-kind/u)
})

test('legacy failure history with a real registered image keeps its original image link and verdict', () => {
  const image = { artifactId: 'failed-preview', role: 'output', sampleId: 'sample-a', epoch: 12, passed: false,
    issueCodes: ['visual_review_failed'], url: '/api/ai-console/training/history/history-gd-run/artifacts/failed-preview',
    logicalPath: 'run/preview.png', sha256: 'c'.repeat(64), verificationStatus: 'binding_verified_bytes_not_read' }
  const { html } = renderHistorySteps(475, 0, { artifacts: [image], failureSummary: { type: 'RuntimeError', message: 'unknown failure' } }, [image])
  assert.match(html, /<img[^>]+src="\/api\/ai-console\/training\/history\/history-gd-run\/artifacts\/failed-preview"/u)
  assert.match(html, /机器审核未通过/u)
  assert.doesNotMatch(html, /本轮无已登记结果图/u)
  assert.match(html, /RuntimeError: 错误详情见已绑定终态证据/u)
})

test('training diagnostic previews remain unreviewed despite forged passed fields or output role', () => {
  for (const role of ['image', 'output']) for (const passed of [true, false, 'true', { secret: 'do-not-render' }]) {
    const item = { artifactId: 'preview', role, evidenceKind: 'training_diagnostic_preview', passed,
      sourceLabel: 'machine approved', sampleId: 'train-a', epoch: 2, logicalPath: 'run/train-preview.png',
      sha256: 'd'.repeat(64), url: '/api/ai-console/training/history/run/artifacts/preview' }
    const html = renderToStaticMarkup(React.createElement(imageExports.EvidenceImage, { item }))
    assert.match(html, /未审核训练预览，非Checkpoint／正式输出/u)
    assert.match(html, /<img/u)
    assert.match(html, /不证明画质合格或当步权重可恢复/u)
    assert.doesNotMatch(html, /机器审核通过|机器审核未通过|machine approved|do-not-render|\[object Object\]/u)
  }
})

test('diagnostic gallery is separate from original/results and keeps per-source coverage truthful', () => {
  const image = { artifactId: 'preview', role: 'image', evidenceKind: 'training_diagnostic_preview', sampleId: 'train-a',
    epoch: 1, passed: true, logicalPath: 'run/train-preview.png', sha256: 'd'.repeat(64),
    url: '/api/ai-console/training/history/run/artifacts/preview' }
  for (const [status, expected] of [['available', '已核验绑定'], ['partial', '部分训练预览不可用'],
    ['not_recorded', '未登记训练预览'], ['capture_failed', '捕获失败'], ['hash_conflict', '摘要冲突'],
    ['missing', '文件缺失'], ['unsupported_schema', '尚未支持'], ['unreadable', '无法读取'],
    ['budget_exhausted', '预算耗尽'], ['publication_incomplete', '发布不完整'], ['binding_mismatch', '绑定冲突']]) {
    const { html } = renderHistorySteps(0, null, { artifacts: [image], detailCoverage: {
      trainingPreview: { status, reasonCode: 'secret=do-not-render' },
    } }, [image])
    assert.match(html, /aria-label="未审核训练预览"/u)
    assert.ok(html.includes(expected))
    assert.equal((html.match(/<img/g) ?? []).length, 1)
    assert.match(html, /本轮无已登记结果图/u)
    assert.doesNotMatch(html, /机器审核通过/u)
    // Raw coverage remains in the existing collapsed technical JSON, but the
    // user-facing status component must not echo arbitrary reason text.
    const statusText = html.match(/<p role="status">训练诊断预览：[\s\S]*?<\/p>/u)?.[0]
    assert.ok(statusText && !statusText.includes('do-not-render'))
  }
})

// Opt-in read-only acceptance against an already-running console. Never start a
// service, seed a production record or make network access part of unit tests.
test('live parent training timeout renders its own limit and the actual unbound-image gap', {
  skip: !process.env.AI_CONSOLE_HISTORY_TIMEOUT_HTTP_TEST_ORIGIN,
}, async t => {
  const origin = new URL(process.env.AI_CONSOLE_HISTORY_TIMEOUT_HTTP_TEST_ORIGIN)
  assert.equal(origin.protocol, 'http:')
  assert.equal(origin.hostname, '127.0.0.1')
  assert.equal(origin.pathname, '/')
  assert.equal(origin.username + origin.password + origin.search + origin.hash, '')
  const runId = process.env.AI_CONSOLE_HISTORY_TIMEOUT_HTTP_TEST_RUN_ID
  assert.match(runId ?? '', /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/u)
  const endpoint = new URL(`/api/ai-console/training/history/${encodeURIComponent(runId)}`, origin)
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200)
  const detail = await response.json(), run = detail.record
  assert.equal(detail.schemaVersion, 'ai_console_training_run_detail_v1')
  assert.equal(run.runId, runId)
  assert.equal(run.terminalStatus, 'failed_closed')
  assert.deepEqual(run.failureSummary, { type: 'Error', message: 'wall_timeout' })
  assert.equal(run.detailCoverage.phase, 'training')
  assert.equal(run.detailCoverage.artifactSourceGap, artifactSourceGap)
  assert.ok(Number.isSafeInteger(run.trainingPlan.maxWallSeconds) && run.trainingPlan.maxWallSeconds > 0)
  const pageResponse = await fetch(new URL(`${endpoint.pathname}?section=artifacts&limit=20`, origin), { signal: AbortSignal.timeout(20000) })
  assert.equal(pageResponse.status, 200)
  const page = await pageResponse.json()
  assert.equal(page.record.runId, runId)
  assert.equal(page.section, 'artifacts')
  assert.equal(page.nextCursor, null)
  assert.ok(page.items.length > 0)
  assert.ok(page.items.every(item => !['image', 'original', 'output'].includes(item.role)))
  const { html } = renderHistorySteps(run.optimizerSteps, null, run, page.items, { nextCursor: page.nextCursor })
  assert.match(html, /达到本轮训练时间上限，已停止/u)
  assert.ok(html.includes(`本轮冻结训练时限：${run.trainingPlan.maxWallSeconds}秒`))
  assert.match(html, /aria-label="产物来源缺口"/u)
  assert.match(html, /本节没有下一页/u)
  assert.doesNotMatch(html, /<img|其他内容可继续分页|预览另列/u)
  t.diagnostic(JSON.stringify({ observedAtUtc: new Date().toISOString(), runId,
    httpStatus: response.status, artifactPageHttpStatus: pageResponse.status,
    registeredArtifacts: page.items.length, maxWallSeconds: run.trainingPlan.maxWallSeconds,
    acceptance: 'live_http_and_actual_component_ssr_not_browser_or_image_reader_admission' }))
})

test('live failure detail and original safe JSON artifact APIs render through the actual component', {
  skip: !process.env.AI_CONSOLE_HISTORY_HTTP_TEST_ORIGIN,
}, async t => {
  const origin = new URL(process.env.AI_CONSOLE_HISTORY_HTTP_TEST_ORIGIN)
  assert.equal(origin.protocol, 'http:')
  assert.equal(origin.hostname, '127.0.0.1')
  assert.equal(origin.pathname, '/')
  assert.equal(origin.username + origin.password + origin.search + origin.hash, '')
  const runId = process.env.AI_CONSOLE_HISTORY_HTTP_TEST_RUN_ID
  assert.match(runId ?? '', /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/u)
  const endpoint = new URL(`/api/ai-console/training/history/${encodeURIComponent(runId)}`, origin)
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200)
  const detail = await response.json(), run = detail.record
  assert.equal(detail.schemaVersion, 'ai_console_training_run_detail_v1')
  assert.equal(run.runId, runId)
  const pageResponse = await fetch(new URL(`${endpoint.pathname}?section=artifacts&limit=20`, origin), { signal: AbortSignal.timeout(20000) })
  assert.equal(pageResponse.status, 200)
  const page = await pageResponse.json()
  assert.equal(page.record.runId, runId)
  assert.equal(page.section, 'artifacts')
  assert.equal(page.nextCursor, null, 'this exact failure acceptance must cover both fault links in one page')
  const { html } = renderHistorySteps(run.optimizerSteps, null, run, page.items)
  assert.match(html, /四项总梯度一致性检查未通过（参数索引 88）/u)
  assert.match(html, /已完成轮数：11 \/ 计划轮数：24/u)
  assert.match(html, /G（生成器）：539 · D（判别器）：540/u)
  assert.match(html, /本轮无已登记结果图/u)
  assert.doesNotMatch(html, /<img/u)
  for (const [kind, label] of [['gradientFailureManifest', '故障清单'], ['gradientFailurePrimary', '首错记录']]) {
    const artifact = page.items.find(item => item.evidenceKind === kind)
    assert.ok(artifact && artifact.role === 'evidence')
    const url = new URL(artifact.url, origin)
    assert.equal(url.origin, origin.origin)
    assert.ok(url.pathname.startsWith(`${endpoint.pathname}/artifacts/`))
    assert.ok(html.includes(`href="${artifact.url}"`))
    assert.ok(html.includes(label))
    const evidenceResponse = await fetch(url, { signal: AbortSignal.timeout(20000) })
    assert.equal(evidenceResponse.status, 200)
    assert.match(evidenceResponse.headers.get('content-type') ?? '', /^application\/json/u)
    assert.equal(evidenceResponse.headers.get('cache-control'), 'no-store')
    assert.equal(evidenceResponse.headers.get('x-content-type-options'), 'nosniff')
    const evidence = await evidenceResponse.json()
    assert.equal(evidence.artifactId, artifact.artifactId)
    assert.equal(evidence.evidenceKind, kind)
    assert.equal(evidence.sha256, artifact.sha256)
    assert.equal(typeof evidence.truncated, 'boolean')
    assert.equal(typeof evidence.text, 'string')
    t.diagnostic(JSON.stringify({ evidenceKind: kind, httpStatus: evidenceResponse.status, sha256: evidence.sha256, truncated: evidence.truncated }))
  }
  t.diagnostic(JSON.stringify({ observedAtUtc: new Date().toISOString(), runId, completedEpochs: run.completedEpochs,
    targetEpochs: run.targetEpochs, optimizerSteps: run.optimizerSteps, httpStatus: response.status,
    browserAcceptance: 'not_performed_actual_component_server_render_only' }))
})
