import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import * as decode from '../lib/ai-painter-decode1-entry-weight-quality-review-context.mjs'
import * as decodeReview from '../lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs'
import * as terrain from '../lib/ai-painter-ecology-terrain-detail-review-context.mjs'
import * as terrainReview from '../lib/ai-painter-ecology-terrain-detail-review-recovery-v1.mjs'

const prior = () => ({ phase: 'review', cleanupConfirmed: true, ownerClosed: true,
  proof: { activeProcessesAfterCleanup: 0, exitCode: 1 },
  budget: { timeoutMs: 120000, outputBytes: 16777216 }, elapsedMs: 57148,
  streamBytes: { stdout: 0, stderr: 2112 } })

for (const route of ['ecology-decode1-quality', 'ecology-terrain-detail-quality',
  'decode1-entry-weight-quality', 'object-support-structure-quality']) {
  test(`${route} real entry retains its default receipt validator`, async () => {
    const entry = await import(`../run-ai-painter-${route}-v1.mjs`)
    const adapters = entry.createPreparationAdaptersForIsolatedTests({
      assertNoGuard() {}, readRegistry: async () => ({ ok: true, registry: { activeExecution: null } }),
      prepareCpuRequest: () => ({ path: 'private/inert-request.json', sha256: '0'.repeat(64) }),
      runtimeIdentity: () => ({ python: { absolutePath: process.execPath } }),
      inside: (_root, relative) => relative,
      runNative: async () => ({ ownedReceipt: {}, stdout: '{}', receiptBinding: null }),
      materialize: () => { throw Error('a forged receipt must never reach packaging') },
    })
    await assert.rejects(adapters.prepareOnly({ root: process.cwd(), runId: 'private-inert', packageId: 'private-inert-package' }),
      /same live CPU call required/u)
  })
}

for (const [name, context, review, allowance, admission] of [
  ['decode', decode, decodeReview, 'remainingRecoveryBudget', 'recoveryNativeContext'],
  ['terrain', terrain, terrainReview, 'remainingReviewBudget', 'reviewRecoveryNativeContext'],
]) {
  test(`${name} public review API uses the same context validator and debits prior costs`, () => {
    assert.equal(review[allowance], context[allowance])
    assert.equal(review.loadReviewRecovery, context.loadReviewRecovery)
    assert.equal(review[admission], context[admission])
    assert.deepEqual(review[allowance](prior()), {
      timeoutMs: 62852, streamBytes: 8386496, outputBytes: 16775104, priorStreamBytes: 2112,
    })
  })
  test(`${name} context refuses unproven cleanup and exhausted budgets`, () => {
    for (const mutate of [p => { p.cleanupConfirmed = false }, p => { p.ownerClosed = false },
      p => { p.proof.activeProcessesAfterCleanup = 1 }, p => { p.proof.exitCode = 0 },
      p => { p.elapsedMs = 120000 }, p => { p.elapsedMs = -1 },
      p => { p.streamBytes.stderr = 8388608 }, p => { p.streamBytes.stdout = NaN },
      p => { p.budget.timeoutMs = 240000 }, p => { p.budget.outputBytes *= 2 }]) {
      const value = prior(); mutate(value)
      assert.throws(() => context[allowance](value))
    }
  })
  test(`${name} native admission rejects a foreign binding before publication or native execution`, () => {
    assert.throws(() => context[admission](process.cwd(), { path: '../foreign/plan.json', sha256: '0'.repeat(64) }))
    for (const forbidden of ['runNative', 'runIndependentReview', 'executeReviewRecovery', 'reviewCli',
      'advanceCurrentExecutionRegistry', 'retainLiveOwnedReceipt']) assert.equal(Object.hasOwn(context, forbidden), false)
  })
}

test('dependency command rejects a delayed cycle and accepts its acyclic counterpart', t => {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'review-dependency-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('review-dependency-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, { recursive: true })
  })
  fs.mkdirSync(path.join(root, 'src')); fs.mkdirSync(path.join(root, 'scripts'))
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { allowJs: true, module: 'esnext', moduleResolution: 'bundler' } }))
  fs.writeFileSync(path.join(root, 'src/a.mjs'), "import './b.mjs'; throw Error('must not execute');")
  fs.writeFileSync(path.join(root, 'src/b.mjs'), "export const load = () => import('./a.mjs');")
  const command = path.resolve('scripts/check-project-dependencies.mjs')
  const cyclic = spawnSync(process.execPath, [command], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 20000 })
  assert.equal(cyclic.error, undefined)
  assert.equal(cyclic.status, 1, cyclic.stderr)
  assert.deepEqual(JSON.parse(cyclic.stdout).staticCycles, [])
  assert.deepEqual(JSON.parse(cyclic.stdout).includingDeferredCycles, [['src/a.mjs', 'src/b.mjs']])
  fs.writeFileSync(path.join(root, 'src/b.mjs'), 'export const value = 1;')
  const acyclic = spawnSync(process.execPath, [command], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 20000 })
  assert.equal(acyclic.status, 0, acyclic.stderr)
})
