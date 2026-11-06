import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { runNaturalWorldBaseline, readBaselineFile } from '../lib/natural-world-baseline.mjs'
import { BASELINE_DELIVERY, BASELINE_IDENTITY, verifyNaturalWorldBaselineProof,
  verifyNaturalWorldBaselinePrivateFixtureProof, verifyNaturalRecordBytes } from '../lib/natural-world-baseline-proof.mjs'

test('proof path and identity rejected before any evidence read', () => {
  let reads = 0
  const selection = { schemaVersion: 'natural-world-baseline-selection-v1', deliveryId: BASELINE_DELIVERY,
    identity: { ...BASELINE_IDENTITY }, proofRef: { path: 'docs/BUSINESS_SPEC.md', sha256: '0'.repeat(64), bytes: 1 }, selectedAtUtc: new Date().toISOString() }
  assert.throws(() => verifyNaturalWorldBaselineProof({ selection, read() { reads++; throw Error('unexpected') } }), /baseline_proof_location/)
  assert.equal(reads, 0)
  selection.identity.worldId = 'other'
  assert.throws(() => verifyNaturalWorldBaselineProof({ selection, read() { reads++ } }), /baseline_selection_identity/)
  assert.equal(reads, 0)
})

test('real isolated create exits, independent reader replays sources; verify and duplicate protection', { timeout: 115000 }, async () => {
  const fixtureRoot = '.runtime/ai-painter/controller-repair-reviews/mvp-world-baseline-145-20261029/t/' + randomUUID().replaceAll('-', '').slice(0, 8)
  console.log('isolated fixture: ' + fixtureRoot)
  fs.mkdirSync(fixtureRoot, { recursive: true }); fs.writeFileSync(fixtureRoot + '/fixture.marker', 'natural-world-baseline-private-fixture-v1', { flag: 'wx' })
  const created = await runNaturalWorldBaseline({ command: 'create', fixtureRoot })
  assert.equal(created.status, 'baseline_verified', JSON.stringify(created))
  const read = (logical, max) => readBaselineFile(logical, max)
  const selection = { schemaVersion: 'natural-world-baseline-selection-v1', deliveryId: BASELINE_DELIVERY,
    identity: created.identity, proofRef: created.proofRef, selectedAtUtc: new Date().toISOString() }
  const projected = verifyNaturalWorldBaselinePrivateFixtureProof({ selection, read, fixtureRoot })
  assert.equal(projected.status, 'verified_bound_machine_readback')
  assert.equal(projected.counts.conditionChannelCount, 23)
  assert.equal(projected.readCoverage.rawSourceBytesRehashed, false)
  assert.equal(projected.readCoverage.excludedLargeSourceRefs.length, 2)
  assert(projected.readCoverage.bytes < 16 * 1024 * 1024)
  const before = readBaselineFile(projected.store.path)
  await assert.rejects(runNaturalWorldBaseline({ command: 'create', fixtureRoot }), /baseline_existing_world_or_outputs/)
  assert.deepEqual(readBaselineFile(projected.store.path), before)
  const verified = await runNaturalWorldBaseline({ command: 'verify', fixtureRoot })
  assert.equal(verified.status, 'baseline_verified')
  const reselected = { ...selection, proofRef: verified.proofRef, selectedAtUtc: new Date().toISOString() }
  assert.equal(verifyNaturalWorldBaselinePrivateFixtureProof({ selection: reselected, read, fixtureRoot }).status, 'verified_bound_machine_readback')
  assert.throws(() => verifyNaturalWorldBaselineProof({ selection, read }), /baseline_selection_identity/)
  await assert.rejects(runNaturalWorldBaseline({ command: 'publish-selection', fixtureRoot }), /baseline_fixture_selection_forbidden/)
  const record = JSON.parse(before)
  record.eventCursor = 1
  assert.throws(() => verifyNaturalRecordBytes(Buffer.from(JSON.stringify(record)), created.identity), /baseline_record_identity|baseline_record_digest/)
  assert.throws(() => verifyNaturalWorldBaselinePrivateFixtureProof({ selection: { ...selection,
    proofRef: { ...selection.proofRef, sha256: '0'.repeat(64) } }, read, fixtureRoot }), /baseline_ref_digest/)
  const proof = JSON.parse(read(selection.proofRef.path))
  for (const target of [proof.source.sourcePackageRef.path, proof.conditions.manifestRef.path,
    proof.conditions.channels[0].path, proof.codeBindings[0].path, proof.readback.receiptRef.path]) {
    assert.throws(() => verifyNaturalWorldBaselinePrivateFixtureProof({ selection, fixtureRoot,
      read(logical, max) { const bytes = read(logical, max); if (logical !== target) return bytes
        const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1; return changed } }), /baseline_ref_digest/)
  }
  assert.throws(() => verifyNaturalWorldBaselinePrivateFixtureProof({
    selection: { ...selection, selectedAtUtc: '2000-01-01T00:00:00.000Z' }, read, fixtureRoot }), /baseline_timing_envelope/)
  fs.writeFileSync(fixtureRoot + '/test-result.json', JSON.stringify({ schemaVersion: 'natural-world-baseline-test-evidence-v1',
    fixtureRoot, created, verified, projectedReadCoverage: projected.readCoverage, actualStoreUnchanged: true,
    productionWorldCreated: false, qualification: created.qualification }, null, 2) + '\n', { flag: 'wx' })
  console.log('isolated baseline evidence: ' + fixtureRoot + '/test-result.json')
})
