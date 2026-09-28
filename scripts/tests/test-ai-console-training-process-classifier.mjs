import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/server/ai-console-observability/local-observability.ts', import.meta.url), 'utf8')
const start = source.indexOf('function trainingProcessPatternMatches(')
const end = source.indexOf('function commandSummary(', start)
assert.ok(start >= 0 && end > start)
const compiled = ts.transpileModule(`${source.slice(start, end)}\nexport { trainingProcessPatternMatches }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
new Function('exports', compiled)(exports)
const matches = exports.trainingProcessPatternMatches

test('console history indexer is not a training process, real worker still is', () => {
  assert.equal(matches('node.exe', 'node.exe scripts/run-ai-console-training-history-indexer.mjs'), false)
  assert.equal(matches('node.exe', 'node.exe scripts/run-ai-painter-stage4-mvp-v21-dry-training.mjs'), true)
  assert.equal(matches('python.exe', 'python.exe train_stage4_mvp_v21_dry_stage0.py'), true)
  assert.equal(matches('node.exe', 'node.exe scripts/unrelated-service.mjs'), false)
})
