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
