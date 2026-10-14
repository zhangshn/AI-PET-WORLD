import assert from 'node:assert/strict'
import test from 'node:test'
import { loadGatewayCpu, privateRead, privateRecord } from './helpers/world-runtime-gateway-cpu.mjs'

for (const status of ['empty', 'invalid', 'failed', 'found']) {
  test(`normal tick refuses ${status === 'found' ? 'found without record' : status} without initializing or writing`, async () => {
    const read = privateRead(status, null)
    const cpu = loadGatewayCpu({ reads: [read] })
    await assert.rejects(cpu.runAndPersistOneRuntimeTick({ worldId: 'private-world', ownerId: 'private-owner' }), error => {
      assert.ok(error instanceof cpu.WorldRuntimeSaveReadError)
      assert.equal(error.readResult.status, status === 'found' ? 'invalid' : status)
      assert.ok(error.readResult.tags.includes(`fixture_${status}`))
      return true
    })
    assert.deepEqual(cpu.calls.reads, [{ worldId: 'private-world', ownerId: 'private-owner' }])
    for (const key of ['builds', 'ticks', 'writes']) assert.deepEqual(cpu.calls[key], [])
  })
}

test('valid normal tick uses the loaded identity and original tick compare-and-set', async () => {
  const previous = privateRecord()
  const cpu = loadGatewayCpu({ reads: [privateRead('found', previous)] })
  const result = await cpu.runAndPersistOneRuntimeTick({ worldId: previous.worldId, now: 1000 })
  assert.equal(result.persisted, true)
  assert.equal(result.previousSaveRecord, previous)
  assert.equal(result.nextSaveRecord.worldId, previous.worldId)
  assert.equal(result.nextSaveRecord.ownerId, previous.ownerId)
  assert.equal(result.nextSaveRecord.tick, 8)
  assert.equal(cpu.calls.writes[0].expectedTick, 7)
  assert.deepEqual(cpu.calls.builds, [])
})

test('failed audit does not write a candidate tick', async () => {
  const cpu = loadGatewayCpu({ reads: [privateRead()], auditOk: false })
  const result = await cpu.runAndPersistOneRuntimeTick()
  assert.equal(result.persisted, false)
  assert.deepEqual(cpu.calls.writes, [])
})

for (const status of ['invalid', 'failed', 'found']) {
  test(`Smoke initialization refuses ${status === 'found' ? 'found without record' : status}`, async () => {
    const cpu = loadGatewayCpu({ reads: [privateRead(status, null)] })
    await assert.rejects(cpu.loadOrCreateRuntimeWorldForSmokeOnly(), cpu.WorldRuntimeSaveReadError)
    assert.deepEqual(cpu.calls.builds, [])
    assert.deepEqual(cpu.calls.writes, [])
  })
}

test('only explicitly named Smoke helper can initialize a truly empty slot, with expectedTick=-1', async () => {
  const cpu = loadGatewayCpu({ reads: [privateRead('empty')] })
  const result = await cpu.loadOrCreateRuntimeWorldForSmokeOnly({ now: 1000 })
  assert.equal(result.worldId, 'initial-runtime-world')
  assert.equal(result.tick, 0)
  assert.equal(cpu.calls.writes[0].expectedTick, -1)
  assert.equal(cpu.calls.writes[0].record, result)
  assert.equal(cpu.calls.builds.length, 1)
})

test('Smoke returns a found world unchanged, and never reports failed initialization as success', async () => {
  const existing = privateRecord()
  const found = loadGatewayCpu({ reads: [privateRead('found', existing)] })
  assert.equal(await found.loadOrCreateRuntimeWorldForSmokeOnly(), existing)
  assert.deepEqual(found.calls.writes, [])
  const failed = loadGatewayCpu({ reads: [privateRead('empty')], writeResult: { ok: false } })
  await assert.rejects(failed.loadOrCreateRuntimeWorldForSmokeOnly({ now: 1000 }), /initialization failed/)
})

for (const status of ['empty', 'invalid', 'failed', 'found']) {
  test(`API second-read ${status === 'found' ? 'missing record' : status} returns 409, not default world or success`, async () => {
    const cpu = loadGatewayCpu({ reads: [privateRead(), privateRead(status, null)] })
    const response = await cpu.POST(new Request('http://localhost/api/world/tick?worldId=private-world', { method: 'POST' }))
    const body = await response.json()
    assert.equal(response.status, 409)
    assert.equal(body.ok, false)
    assert.equal(body.readStatus, status === 'found' ? 'invalid' : status)
    assert.equal(cpu.calls.reads.length, 2)
    for (const key of ['builds', 'ticks', 'writes']) assert.deepEqual(cpu.calls[key], [])
  })
}

test('existing API preconditions still reject missing world and unauthenticated mutation without reading', async () => {
  const missing = loadGatewayCpu()
  assert.equal((await missing.POST(new Request('http://localhost/api/world/tick', { method: 'POST' }))).status, 400)
  assert.deepEqual(missing.calls.reads, [])
  const denied = loadGatewayCpu({ operatorOk: false })
  assert.equal((await denied.POST(new Request('http://localhost/api/world/tick?worldId=private-world', { method: 'POST' }))).status, 403)
  assert.deepEqual(denied.calls.reads, [])
})

test('valid API tick returns the same identity, persisted result and operator evidence', async () => {
  const cpu = loadGatewayCpu({ reads: [privateRead(), privateRead()] })
  const response = await cpu.POST(new Request('http://localhost/api/world/tick?worldId=private-world', { method: 'POST' }))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.worldId, 'private-world')
  assert.equal(body.previousTick, 7)
  assert.equal(body.tick, 8)
  assert.ok(body.tags.includes('local_operator:private-operator'))
})
