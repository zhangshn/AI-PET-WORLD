import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('retired training dashboard checker exits as not applicable and never reports validation passed', () => {
  const result = spawnSync(process.execPath, ['scripts/check-ai-painter-current-training-dashboard.mjs'], {
    cwd: process.cwd(), windowsHide: true, encoding: 'utf8', timeout: 10000, maxBuffer: 16384,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  const notice = JSON.parse(result.stderr)
  assert.equal(notice.schemaVersion, 'retired-engineering-check-v1')
  assert.equal(notice.status, 'not_applicable_retired_interface')
  assert.equal(notice.passed, false)
  assert.match(notice.historicalSource.sha256, /^[a-f0-9]{64}$/u)
  assert.match(notice.historicalSource.path, /^cold\/runs\/[^/]+\/check-ai-painter-current-training-dashboard\.mjs$/u)
  assert.equal(notice.currentSpecification, 'docs/ai-console/AI_CONSOLE_ARCHITECTURE_SPEC.md')
})
