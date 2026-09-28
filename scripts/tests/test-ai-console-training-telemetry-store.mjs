import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
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

test('isolated writer/read round-trip is independent of input property order; tampering fails closed', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ai-console-telemetry-test-'))
  const storePath = path.join(directory, 'telemetry.sqlite')
  try {
    const reversedInput = Object.fromEntries(Object.entries(input).reverse())
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
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('unsafe and empty identities are rejected before opening a store', () => {
  const storePath = path.join(tmpdir(), 'ai-console-telemetry-never-created.sqlite')
  for (const invalid of ['', '../run', 'run/../../outside']) {
    assert.throws(() => recordAiConsoleTrainingTelemetry({ ...input, runId: invalid }, { storePath }), /run_id_invalid/)
  }
})
