import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { baselineDigest, baselineSha256 } from '../lib/natural-world-baseline-proof.mjs'
import { CANDIDATE_ROOT, CANDIDATE_CONTRACT_SHA, CANDIDATE_EVIDENCE, prepareCandidateContext,
  candidateInputBytes, candidateContextEvidence, recheckCandidateContext,
  validateCandidateOutput, parseCandidateOutput, buildExecutedCandidate,
  validateCandidateProcessReceipt } from '../lib/natural-world-evolution-candidate.mjs'

// Actual fixed baseline/archive reads; ALL output values and process claims below are fixtures.
// This test file never calls executeCandidateWorker and never runs a real model forward.
let context, evidence, input, initialWorldSha
const worldPath = path.join(CANDIDATE_ROOT, 'data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json')
before(async () => {
  initialWorldSha = baselineSha256(fs.readFileSync(worldPath))
  context = await prepareCandidateContext(); evidence = candidateContextEvidence(context); input = evidence.input
})
function fixture(overrides = {}) {
  return { schemaVersion: 'world-environment-forward-output-v1', taskId: 'WORLD-EVOLUTION-CANDIDATE-155',
    contractSha256: CANDIDATE_CONTRACT_SHA, inputBytesSha256: baselineSha256(candidateInputBytes(context)),
    inputContentSha256: input.features.inputContentSha256, worldBindingSha256: baselineDigest(input.worldBinding),
    checkpointSha256: '36a5e5973228295f38392b50680868331caab7b1588e3fc10f54d2f084ce05c8',
    fieldOrder: ['PRECTOTCORR', 'RH2M', 'T2M', 'WS2M'], units: ['mm/day', '%', 'C', 'm/s'],
    forecastInterval: { startUtc: '2020-01-08T00:00:00.000Z', endUtc: '2020-01-09T00:00:00.000Z', durationSeconds: 86400 },
    values: [0.1, 70, 25, 2], modelExecuted: true, trainingUpdates: 0,
    featureValueSha256: baselineDigest(input.features.values), startedAtUtc: '2026-10-29T10:00:00.000Z',
    finishedAtUtc: '2026-10-29T10:00:01.000Z', elapsedSeconds: 1,
    codeBindings: evidence.workerCodeBindings, productionReady: false, worldWrites: 0, ...overrides }
}
const bytes = obj => Buffer.from(JSON.stringify(obj))

test('real reader binds original world; valid synthetic output gives validation only', () => {
  assert.equal(input.worldBinding.before.fileSha256, initialWorldSha)
  assert.equal(evidence.diagnostic.worldClock.status, 'uninitialized')
  assert.equal(evidence.diagnostic.worldHistory.eventCursor, 0)
  assert.equal(input.historyOrigin, 'external_archival_context')
  assert.equal(input.features.sourceSha256, '008167c9aa000feb9197b7f3dcbfed1e94e889473486cd33085045204cae1ef8')
  const result = validateCandidateOutput(context, bytes(fixture()))
  assert.equal(result.validationOnly, true)
  assert.equal(result.processExecutionVerified, false)
  assert.equal(result.productionReady, false)
})

test('serialized/rehashed caller DTO and fake process receipt cannot acquire trust', async () => {
  const forged = structuredClone(evidence)
  forged.input.features.values[0][0] += 1
  const { inputContentSha256: ignored, ...features } = forged.input.features
  forged.input.features.inputContentSha256 = baselineDigest(features)
  assert.throws(() => validateCandidateOutput(forged, bytes(fixture())), /reader_owned_context/)
  assert.throws(() => candidateInputBytes({ ...context }), /reader_owned_context/)
  assert.throws(() => buildExecutedCandidate(context, { receipt: { exitCode: 0, pid: 123 }, stdout: bytes(fixture()) }), /owned_process/)
  await assert.rejects(prepareCandidateContext({ input: forged }), /no_caller_configuration/)
  const copy = candidateInputBytes(context); copy.fill(0)
  assert.notEqual(candidateInputBytes(context)[0], 0)
})

test('reject wrong source-derived features, world before/identity, checkpoint and worker bindings', () => {
  for (const field of ['inputBytesSha256', 'inputContentSha256', 'worldBindingSha256', 'checkpointSha256', 'featureValueSha256']) {
    assert.throws(() => validateCandidateOutput(context, bytes(fixture({ [field]: '0'.repeat(64) }))), /binding/)
  }
  assert.throws(() => validateCandidateOutput(context, bytes(fixture({ codeBindings: [] }))), /model_binding/)
  const changedWorld = structuredClone(input.worldBinding); changedWorld.before.tick = 1
  assert.throws(() => validateCandidateOutput(context, bytes(fixture({ worldBindingSha256: baselineDigest(changedWorld) }))), /input_binding/)
})

test('reject extra future fields, arbitrary paths, field order, units and time interval changes', () => {
  for (const overrides of [{ futureTarget: [1, 2, 3, 4] }, { changes: [{ path: 'worldState.resources', value: 10 }] },
    { fieldOrder: ['RH2M', 'PRECTOTCORR', 'T2M', 'WS2M'] }, { units: ['mm', '%', 'C', 'm/s'] },
    { forecastInterval: { startUtc: '2026-10-29T00:00:00.000Z', endUtc: '2026-10-30T00:00:00.000Z', durationSeconds: 86400 } }]) {
    assert.throws(() => validateCandidateOutput(context, bytes(fixture(overrides))), /output_/)
  }
})

test('raw finite guard violations reject with no clipping; null/nonfinite/shape invalid', () => {
  for (const values of [[-0.001, 70, 25, 2], [0, 101, 25, 2], [0, 70, 40, 2], [0, 70, 25, 8.601],
    [0, 70, 25], [0, 70, 25, 2, 0], ['0', 70, 25, 2], [null, 70, 25, 2]]) {
    assert.throws(() => validateCandidateOutput(context, bytes(fixture({ values }))), /raw_values/)
  }
  assert.throws(() => validateCandidateOutput(context, Buffer.from(JSON.stringify(fixture()).replace('"values":[0.1', '"values":[1e999'))), /json_number/)
})

test('never trusts production/training/write claims and invalid timing', () => {
  for (const overrides of [{ productionReady: true }, { worldWrites: 1 }, { trainingUpdates: 1 }, { modelExecuted: false },
    { elapsedSeconds: 31 }, { finishedAtUtc: '2026-10-29T09:59:59.000Z' }, { startedAtUtc: 'not-a-date' }]) {
    assert.throws(() => validateCandidateOutput(context, bytes(fixture(overrides))), /output_/)
  }
})

test('failed/timeout/truncated process receipts reject; even valid fixture receipt is not process evidence', () => {
  const synthetic = { executionKind: 'actual_child_process', exitCode: 0, signal: null, failure: null,
    pid: 123, stdoutComplete: true, stderrComplete: true, elapsedMs: 100 }
  validateCandidateProcessReceipt(synthetic)
  for (const invalid of [{ exitCode: 1 }, { signal: 'SIGTERM' }, { failure: 'worker_timeout' },
    { pid: null }, { stdoutComplete: false }, { stderrComplete: false }, { elapsedMs: 30001 }]) {
    assert.throws(() => validateCandidateProcessReceipt({ ...synthetic, ...invalid }), /worker_process_failed/)
  }
  assert.throws(() => buildExecutedCandidate(context, synthetic), /owned_process_required/)
})

test('bounded strict wire parser rejects duplicates, trailing bytes and empty/oversized output', () => {
  for (const raw of ['', '{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"a":{"x":1,"x":2}}', '{}{}', '{"x":NaN}', '{"x":1,}']) {
    assert.throws(() => parseCandidateOutput(Buffer.from(raw)), /evolution_candidate|JSON/)
  }
  assert.throws(() => parseCandidateOutput(Buffer.alloc(65537, 32)), /byte_limit/)
  assert.throws(() => parseCandidateOutput(Buffer.from([255])), /utf8/)
  assert.deepEqual(parseCandidateOutput(Buffer.from('{"x":"escaped \\" text","a":[1,true,null]}')), { x: 'escaped " text', a: [1, true, null] })
})

test('final live hashes/facade remain consistent; fixture tests neither launch worker nor alter world', async () => {
  const checked = await recheckCandidateContext(context)
  assert.equal(checked.liveWorldSha256, initialWorldSha)
  assert.equal(baselineSha256(fs.readFileSync(worldPath)), initialWorldSha)
  // The runner only offers its fixed command; fixture validity never creates execution evidence.
  const entry = fs.readFileSync(path.join(CANDIDATE_ROOT, 'scripts/run-natural-world-evolution-candidate.mjs'), 'utf8')
  assert.match(entry, /process\.argv\.length !== 2/)
  assert.equal(CANDIDATE_EVIDENCE.includes('155-20261029'), true)
})
