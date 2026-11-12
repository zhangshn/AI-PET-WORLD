import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync, realpathSync, lstatSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/server/ai-console-observability/training-telemetry-store.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
const { recordAiConsoleTrainingTelemetry, readLatestAiConsoleTrainingTelemetry } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`)
const runId = 'mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898'
const input = {
  runId, executionId: 'execution-v18-1', processId: 17704,
  trainingStage: 'dry_single_world_256x192', epoch: 20, batchIndex: 2, batchCount: 50,
  optimizationStep: 962, loss: 0.25, learningRate: 0.0001,
  throughputSamplesPerSecond: 1.5, estimatedCompletionAtUtc: null,
  checkpointIdentity: null, heartbeatAtUtc: new Date().toISOString(),
  reporterIdentity: 'local_training_reporter_v1',
}

function privateStore(t) {
  const parent = realpathSync(tmpdir()), directory = mkdtempSync(path.join(parent, 'ai-console-telemetry-test-'))
  t.after(() => {
    assert.equal(path.dirname(directory), parent)
    assert(path.basename(directory).startsWith('ai-console-telemetry-test-'))
    assert.equal(realpathSync(directory), directory)
    assert(!lstatSync(directory).isSymbolicLink())
    rmSync(directory, { recursive: true })
  })
  return path.join(directory, 'telemetry.sqlite')
}

test('isolated writer/read round-trip is independent of input property order; tampering fails closed', t => {
  const storePath = privateStore(t)
    const reversedInput = Object.fromEntries(Object.entries({ ...input, heartbeatAtUtc: new Date().toISOString() }).reverse())
    const written = recordAiConsoleTrainingTelemetry(reversedInput, { storePath })
    const read = readLatestAiConsoleTrainingTelemetry({ storePath })
    assert.equal(read.status, 'connected')
    assert.equal(read.latest?.sampleId, written.sampleId)
    assert.equal(read.latest?.runId, runId)
    const database = new DatabaseSync(storePath)
    try { database.prepare('UPDATE training_telemetry SET loss = ? WHERE sample_sequence = ?').run(0.75, written.sampleSequence) }
    finally { database.close() }
    const tampered = readLatestAiConsoleTrainingTelemetry({ storePath })
    assert.equal(tampered.status, 'unknown_or_stale')
    assert.equal(tampered.reasonCode, 'ai_console_training_telemetry_record_integrity_failed')
})

test('future telemetry is unavailable while retaining the original hashed sample and source revision', t => {
  const now = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  t.mock.method(Date, 'now', () => now)
  const written = recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(now + 60000).toISOString() }, { storePath })
  const bytes = readFileSync(storePath), result = readLatestAiConsoleTrainingTelemetry({ storePath })
  assert.equal(result.status, 'unknown_or_stale')
  assert.equal(result.reasonCode, 'new_platform_training_telemetry_heartbeat_future')
  assert.deepEqual(result.latest, written)
  assert.equal(result.sourceRevision, written.sampleSequence)
  assert(readFileSync(storePath).equals(bytes))
})

test('telemetry retains zero age and its existing inclusive 15 second freshness boundary', t => {
  const now = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  t.mock.method(Date, 'now', () => now)
  for (const age of [0,14999,15000,15001]) {
    recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(now - age).toISOString() }, { storePath })
    const result = readLatestAiConsoleTrainingTelemetry({ storePath })
    assert.equal(result.status, age > 15000 ? 'unknown_or_stale' : 'connected')
    assert.equal(result.reasonCode, age > 15000 ? 'new_platform_training_telemetry_heartbeat_stale' : null)
  }
})

test('clock rollback makes telemetry unavailable and recovery does not rewrite its sample', t => {
  const initial = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  let now = initial
  t.mock.method(Date, 'now', () => now)
  const written = recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(initial).toISOString() }, { storePath })
  assert.equal(readLatestAiConsoleTrainingTelemetry({ storePath }).status, 'connected')
  now -= 1000
  assert.equal(readLatestAiConsoleTrainingTelemetry({ storePath }).reasonCode, 'new_platform_training_telemetry_heartbeat_future')
  now = initial
  const recovered = readLatestAiConsoleTrainingTelemetry({ storePath })
  assert.equal(recovered.status, 'connected'); assert.deepEqual(recovered.latest, written)
})

test('invalid stale durations cannot bypass telemetry freshness checks', t => {
  const now = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  t.mock.method(Date, 'now', () => now)
  recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(now - 60000).toISOString() }, { storePath })
  const bytes = readFileSync(storePath)
  for (const staleAfterMs of [NaN,Infinity,-Infinity,-1]) {
    const result = readLatestAiConsoleTrainingTelemetry({ storePath, staleAfterMs })
    assert.equal(result.status, 'unknown_or_stale')
    assert.equal(result.reasonCode, 'ai_console_training_telemetry_stale_after_invalid')
  }
  assert(readFileSync(storePath).equals(bytes))
})

test('a future timestamp does not bypass telemetry integrity verification', t => {
  const now = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  t.mock.method(Date, 'now', () => now)
  const written = recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(now + 60000).toISOString() }, { storePath })
  const database = new DatabaseSync(storePath)
  try { database.prepare('UPDATE training_telemetry SET loss = ? WHERE sample_sequence = ?').run(0.75, written.sampleSequence) }
  finally { database.close() }
  const result = readLatestAiConsoleTrainingTelemetry({ storePath })
  assert.equal(result.latest, null)
  assert.equal(result.reasonCode, 'ai_console_training_telemetry_record_integrity_failed')
})

test('unsafe and empty identities are rejected before opening a store', () => {
  const storePath = path.join(tmpdir(), 'ai-console-telemetry-never-created.sqlite')
  for (const invalid of ['', '../run', 'run/../../outside']) {
    assert.throws(() => recordAiConsoleTrainingTelemetry({ ...input, runId: invalid }, { storePath }), /run_id_invalid/)
  }
})
