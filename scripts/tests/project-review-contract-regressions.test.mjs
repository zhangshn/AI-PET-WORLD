import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { isActiveUniqueModulePlan } from '../lib/unique-module-plan-contract.mjs'

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
test('module plan checker accepts current meaning and old equivalent wording, not missing or retired declarations', () => {
  const guide = read('docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md')
  assert.equal(isActiveUniqueModulePlan(guide), true)
  assert.equal(isActiveUniqueModulePlan(guide.replace('本文是全项目唯一模块计划表', '本文档是项目唯一计划表')), true)
  for (const invalid of [
    guide.replace('active-module-plan', 'retired-module-plan'),
    guide.replace('# AI-PET-WORLD 唯一模块计划表', '# 隔离实验'),
    guide.replace('本文是全项目唯一模块计划表', '本文是另一个计划表'),
    guide.replace('本文是全项目唯一模块计划表', '本文不是全项目唯一模块计划表'),
  ]) assert.equal(isActiveUniqueModulePlan(invalid), false)
})

test('both Stage4 workflow triggers include actual execution, helpers and native source paths', () => {
  const workflow = read('.github/workflows/ai-painter-stage4-core.yml')
  const events = [workflow.split('  pull_request:')[1].split('  push:')[0], workflow.split('  push:')[1].split('permissions:')[0]]
  const paths = [
    'ml/ai-painter/scripts/ecology_decode1_weight_quality_auth_v1.py',
    'scripts/lib/ai-painter-ecology-decode1-quality-package-chain-v1.mjs',
    'scripts/run-ai-painter-ecology-decode1-quality-v1.mjs',
    'scripts/windows/ai-painter-ecology-decode1-quality-owned-worker-v1.cs',
    'scripts/tests/helpers/world-runtime-gateway-cpu.mjs',
    'src/world/runtime/world-runtime-gateway.ts',
    'src/app/ai-console/ai-console-training-history.tsx',
  ]
  for (const event of events) {
    const filters = [...event.matchAll(/^\s+- "([^"]+)"$/gm)].map(match => match[1])
    for (const file of paths) assert.ok(filters.some(filter => path.matchesGlob(file, filter)), file)
    assert.equal(filters.some(filter => path.matchesGlob('unrelated/example.txt', filter)), false)
  }
})

test('document and Stage4 workflows use the declared project Node version', () => {
  const manifest = JSON.parse(read('package.json'))
  for (const file of ['.github/workflows/ai-painter-stage4-core.yml', '.github/workflows/ai-painter-document-contracts.yml']) {
    const version = read(file).match(/node-version:\s*"([^"]+)"/)[1]
    assert.equal(version, '24.14.0')
    assert.ok(manifest.engines.node.includes('24'), 'project Node engine must remain aligned')
  }
})
