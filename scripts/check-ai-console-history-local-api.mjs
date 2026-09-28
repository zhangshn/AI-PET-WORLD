import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Real local acceptance only. No fixture creation, index scans or service control.
const base = 'http://127.0.0.1:3000'
const evidenceDir = path.resolve('.runtime/ai-console/bounded-repair-20260928')
const startedAtUtc = new Date().toISOString()
const report = { startedAtUtc, base, listing: null, details: [], sections: [], images: [], checkpoints: [], guards: [], live: null, current: null,
  browser: { verified: false, reason: 'computer_use_native_pipe_unavailable_after_retry' }, failures: [] }
const sha = value => createHash('sha256').update(value).digest('hex')
async function request(url, headers) {
  const response = await fetch(base + url, { headers, signal: AbortSignal.timeout(20000) })
  assert.match(response.headers.get('cache-control') ?? '', /(?:^|,)\s*no-store\s*(?:,|$)/u)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  return response
}
async function json(url, headers) {
  const response = await request(url, headers)
  return { status: response.status, body: await response.json() }
}
try {
  const records = [], ids = new Set()
  let cursor = null, first
  do {
    const page = await json(`/api/ai-console/training/history?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
    assert.equal(page.status, 200)
    first ??= page.body
    assert.ok(Array.isArray(page.body.records))
    for (const row of page.body.records) { assert.ok(!ids.has(row.recordId ?? row.runId)); ids.add(row.recordId ?? row.runId); records.push(row) }
    cursor = page.body.nextCursor
  } while (cursor)
  report.listing = { dataStatus: first.dataStatus, reasonCode: first.reasonCode, sourceRevision: first.sourceRevision,
    indexRevision: first.indexRevision, total: first.total, returnedRecordCount: records.length, coverage: first.coverage }
  for (const row of records) {
    const id = row.recordId ?? row.runId, url = `/api/ai-console/training/history/${encodeURIComponent(id)}`
    const detail = await json(url)
    report.details.push({ recordId: id, status: detail.status, dataStatus: detail.body.dataStatus, reasonCode: detail.body.reasonCode,
      artifactCount: detail.body.record?.artifacts?.length ?? null, metricCount: detail.body.record?.metrics?.length ?? null,
      unavailableFields: detail.body.unavailableFields ?? null })
    if (detail.status !== 200) { report.failures.push({ id, reason: detail.body.reasonCode }); continue }
    for (const section of ['artifacts', 'metrics', 'events', 'logs']) {
      let sectionCursor = null, pages = 0, sample
      const items = []
      do {
        const page = await json(`${url}?section=${section}&limit=20${sectionCursor ? `&cursor=${encodeURIComponent(sectionCursor)}` : ''}`)
        assert.equal(page.status, 200, `${id}/${section}`)
        assert.equal(page.body.section, section)
        assert.ok(page.body.items.length <= 20)
        assert.equal(page.body.record.runId, row.runId)
        items.push(...page.body.items); pages++; sample ??= page.body
        sectionCursor = page.body.nextCursor
        assert.ok(pages <= 100)
      } while (sectionCursor)
      if (section !== 'logs') assert.equal(JSON.stringify(items), JSON.stringify(detail.body.record[section] ?? []), `${id}/${section} no loss or mixing`)
      report.sections.push({ recordId: id, section, pages, returnedItems: items.length, knownItemCount: sample.knownItemCount,
        total: sample.total, dataStatus: sample.dataStatus, reasonCode: sample.reasonCode, matchesFullDetail: section !== 'logs' })
    }
    if (/^v21-train-only|^mvp-v21-dry|^mvp-stage0-23a1c966/u.test(id)) {
      const artifacts = detail.body.record.artifacts
      for (const item of artifacts.filter(a => ['original', 'output', 'image'].includes(a.role)).slice(0, 3)) {
        const response = await request(item.url)
        const content = Buffer.from(await response.arrayBuffer())
        assert.equal(response.status, 200); assert.ok(['image/png', 'image/jpeg'].includes(response.headers.get('content-type')))
        assert.equal(sha(content), item.sha256)
        report.images.push({ recordId: id, artifactId: item.artifactId, role: item.role, status: response.status,
          contentType: response.headers.get('content-type'), byteLength: content.length, sha256Verified: true })
      }
      for (const cp of detail.body.record.checkpoints ?? []) {
        const value = await json(cp.url)
        assert.equal(value.status, 200); assert.equal(value.body.verificationStatus, 'binding_verified_bytes_not_read')
        assert.equal(value.body.bytes, undefined)
        report.checkpoints.push({ recordId: id, artifactId: cp.artifactId, status: value.status, byteLength: value.body.byteLength,
          verificationStatus: value.body.verificationStatus, weightBytesDownloaded: false })
      }
    }
  }
  for (const [url, expected, headers] of [
    ['/api/ai-console/training/history?limit=51', 400],
    ['/api/ai-console/training/history?cursor=bad', 400],
    ['/api/ai-console/training/history?limit=1&limit=2', 400],
    ['/api/ai-console/training/history/missing-real-run', 404],
    [`/api/ai-console/training/history/${records[0].runId}?section=invalid`, 400],
    ['/api/ai-console/training/history', 403, { 'x-forwarded-host': 'example.invalid' }],
  ]) {
    const value = await json(url, headers)
    assert.equal(value.status, expected)
    report.guards.push({ url, status: value.status, reasonCode: value.body.reasonCode, forwardedHostRejected: !!headers })
  }
  const current = await json('/api/ai-console/observability/current-execution')
  report.current = { status: current.status, dataStatus: current.body.dataStatus, sourceRevision: current.body.sourceRevision,
    registryRevision: current.body.registryRevision, activeExecution: current.body.activeExecution,
    currentProjectTask: current.body.currentProjectTask, latestTrainingTerminal: current.body.latestTrainingTerminal }
  assert.equal(current.status, 200)
  const live = await json('/api/ai-console/observability/live')
  report.live = { status: live.status, schemaVersion: live.body.schemaVersion, sampleSequence: live.body.sampleSequence,
    observedAtUtc: live.body.observedAtUtc, trainingTelemetry: live.body.trainingTelemetry,
    reasonCodes: live.body.reasonCodes }
  assert.equal(live.status, 200)
  const ui = await fetch(base + '/ai-console/training/runs', { signal: AbortSignal.timeout(20000) })
  assert.equal(ui.status, 200)
  report.page = { status: ui.status, url: '/ai-console/training/runs', browserRenderingVerified: false }
} catch (error) { report.failures.push({ message: error.message, stack: error.stack }); process.exitCode = 1 }
if (report.failures.length) process.exitCode = 1
report.finishedAtUtc = new Date().toISOString()
await mkdir(evidenceDir, { recursive: true })
const evidencePath = path.join(evidenceDir, `real-api-acceptance-${startedAtUtc.replace(/[:.]/gu, '-')}.json`)
await writeFile(evidencePath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ evidencePath,
  recordCount: report.details.length, detailErrors: report.details.filter(x => x.status !== 200).length,
  sectionCount: report.sections.length, imageCount: report.images.length, checkpointCount: report.checkpoints.length,
  guards: report.guards, current: report.current, live: report.live, failures: report.failures }, null, 2)}\n`)
