import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { scanHistoryEvidence, readHistoryEvidenceIndex } from '../../src/server/ai-console/training-history-evidence-index.mjs'

const digest = value => createHash('sha256').update(value).digest('hex')
async function put(root, logical, value) {
  const content = Buffer.from(JSON.stringify(value))
  const absolute = path.join(root, logical)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, content)
  return { path: logical, sha256: digest(content) }
}
async function indexed(root, runId) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await scanHistoryEvidence({ root, maxEntries: 2000, maxMs: 5000 })
    const rows = readHistoryEvidenceIndex(root, runId).sources
    if (rows.some(row => row.kind === 'materialization')) return rows
  }
  return readHistoryEvidenceIndex(root, runId).sources
}

test('new source is discovered without a server restart or version-specific schema branch', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ai-console-index-test-'))
  try {
    const runId = 'dynamic-run-1'
    const terminal = await put(root, '.runtime/ai-painter/new-capability/terminal.json', { runId, status: 'completed' })
    const worker = await put(root, '.runtime/ai-painter/new-capability/worker.json', { runId, optimizerSteps: 1 })
    const checkpoint = await put(root, '.runtime/ai-painter/new-capability/checkpoint.json', { runId })
    const reference = await put(root, '.runtime/ai-painter/new-capability/reference.json', { runId })
    const candidate = await put(root, '.runtime/ai-painter/new-capability/candidate.json', { runId })
    await scanHistoryEvidence({ root })
    assert.equal(readHistoryEvidenceIndex(root, runId).sources.length, 0)
    const report = await put(root, '.runtime/ai-painter/new-capability/materialized.json', {
      schemaVersion: 'future-materialization-v27', runId, trainingTerminal: terminal, workerTerminal: worker, checkpoint,
      candidate: { sampleId: 'sample-1', split: 'validation', referenceRgb: reference, candidateRgb: candidate }, artifacts: {},
    })
    let rows = await indexed(root, runId)
    assert.equal(rows.find(row => row.kind === 'materialization')?.status, 'verified')
    await put(root, '.runtime/ai-painter/new-capability/review.json', {
      schemaVersion: 'future-review-v27', runId, materialization: report, candidateRgb: candidate, issueCodes: ['visual_failure'],
    })
    for (let attempt = 0; attempt < 8; attempt++) {
      await scanHistoryEvidence({ root })
      rows = readHistoryEvidenceIndex(root, runId).sources
      if (rows.some(row => row.kind === 'review')) break
    }
    assert.equal(rows.find(row => row.kind === 'review')?.status, 'verified')
    assert.equal(rows.find(row => row.kind === 'review')?.parentBinding.sha256, report.sha256)
    await put(root, '.runtime/ai-painter/new-capability/wrong-run-review.json', {
      schemaVersion: 'future-review-v27', runId: 'different-run', materialization: report,
      candidateRgb: candidate, issueCodes: ['visual_failure'],
    })
    for (let attempt = 0; attempt < 8; attempt++) {
      await scanHistoryEvidence({ root })
      rows = readHistoryEvidenceIndex(root, 'different-run').sources
      if (rows.length) break
    }
    assert.equal(rows[0]?.status, 'partial')
    assert.equal(rows[0]?.reasonCode, 'history_source_parent_run_conflict')
  } finally {
    if (root.startsWith(path.join(tmpdir(), 'ai-console-index-test-'))) await rm(root, { recursive: true, force: true })
  }
})

test('unknown shape and broken parent stay visible as partial, never trusted', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ai-console-index-test-'))
  try {
    const runId = 'dynamic-run-2'
    const terminal = await put(root, '.runtime/ai-painter/new-capability/terminal.json', { runId, status: 'completed' })
    await put(root, '.runtime/ai-painter/new-capability/unknown.json', {
      schemaVersion: 'future-unknown-v1', runId, trainingTerminal: terminal,
    })
    let rows = await indexed(root, runId)
    assert.equal(rows[0].status, 'partial')
    assert.equal(rows[0].reasonCode, 'history_source_schema_unsupported')
    await put(root, '.runtime/ai-painter/new-capability/broken.json', {
      schemaVersion: 'future-materialization-v1', runId, trainingTerminal: { ...terminal, sha256: '0'.repeat(64) },
      candidate: { sampleId: 'sample-1' }, artifacts: {},
    })
    for (let attempt = 0; attempt < 8; attempt++) {
      await scanHistoryEvidence({ root })
      rows = readHistoryEvidenceIndex(root, runId).sources
      if (rows.length === 2) break
    }
    assert.equal(rows.find(row => row.logicalPath.endsWith('/broken.json'))?.status, 'partial')
  } finally {
    if (root.startsWith(path.join(tmpdir(), 'ai-console-index-test-'))) await rm(root, { recursive: true, force: true })
  }
})
