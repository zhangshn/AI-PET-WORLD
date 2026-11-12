import test from 'node:test'
import assert from 'node:assert/strict'
import * as decode1 from '../lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs'
import * as decode1Package from '../lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs'
import * as ecologyDecode1 from '../lib/ai-painter-ecology-decode1-quality-owned-native-v1.mjs'
import * as ecologyDecode1Package from '../lib/ai-painter-ecology-decode1-quality-package-chain-v1.mjs'
import * as failureCapture from '../lib/ai-painter-ecology-failure-capture-owned-native-v1.mjs'
import * as failureCapturePackage from '../lib/ai-painter-ecology-failure-capture-package-chain-v1.mjs'
import * as ecology from '../lib/ai-painter-ecology-quality-owned-native-v1.mjs'
import * as ecologyPackage from '../lib/ai-painter-ecology-quality-package-chain-v1.mjs'
import * as terrainDetail from '../lib/ai-painter-ecology-terrain-detail-quality-owned-native-v1.mjs'
import * as terrainDetailPackage from '../lib/ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs'
import * as support from '../lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs'
import * as supportPackage from '../lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs'

// Exercise the actual admission functions, without launching an owner or
// creating any execution package, registry record, file or GPU process.
for (const [name, native, chain] of [
  ['decode1', decode1, decode1Package],
  ['ecology-decode1', ecologyDecode1, ecologyDecode1Package],
  ['failure-capture', failureCapture, failureCapturePackage],
  ['ecology', ecology, ecologyPackage],
  ['terrain-detail', terrainDetail, terrainDetailPackage],
  ['support', support, supportPackage],
]) {
  test(`${name} CPU finalization rejects caller-created and serialized receipts`, async () => {
    assert.equal(Object.hasOwn(chain, 'finalizeCpuAcceptance'), false)
    const claimed = { phase: 'cpu', proof: { exitCode: 0, activeProcessesAfterCleanup: 0, killOnJobClose: true }, cpuNegativeInputs: { fixtureLinksRemoved: true } }
    for (const receipt of [null, {}, claimed, JSON.parse(JSON.stringify(claimed)), Object.create(claimed)]) {
      assert.equal(native.hasLiveOwnedProof(receipt), false)
      assert.equal(native.hasLiveCpuFixtureCleanup(receipt), false)
      await assert.rejects(() => native.finalizeCpuAcceptance({
        root: process.cwd(), requestBinding: null,
        result: { ownedReceipt: receipt, stdout: '{}', receiptBinding: null },
      }), /same live CPU call required/u)
    }
    assert.equal(Object.hasOwn(native, 'retainLiveOwnedReceipt'), false)
    assert.equal(Object.hasOwn(native, 'liveReceipts'), false)
  })
}
