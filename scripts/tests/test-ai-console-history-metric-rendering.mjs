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
