// Read-only projections share the work-ledger evidence validator. All reads
// below follow explicit SHA bindings; neither current selection nor filenames
// discover missing evidence. No model, image pixels or training code is loaded.
import { isDeepStrictEqual } from 'node:util'
import { readTwoMapPostReviewWorkEvidence } from '../local-backup/two-map-post-review-work-evidence.mjs'
import { requireFact } from './training-history-safe-bytes.mjs'
import { publicMeasurements } from './training-observation-public-fields.mjs'

const OLD = 'ai-painter-two-map-post-review-terminal-v1'
const NEW = 'ai-painter-replay-retention-review-terminal-v1'
const SHA = /^[a-f0-9]{64}$/u
const TOTAL = 8 * 1024 * 1024
const ITEM = 1024 * 1024
const FLAGS = ['formalQualificationGranted', 'checkpointPromotable', 'runtimePublicationAllowed', 'automaticNextTraining']
const STATUS = new Set(['post_training_visual_review_failed', 'post_training_component_checks_passed_not_qualified',
  'post_training_review_execution_failed', 'replay_retention_review_evidence_unknown',
  'replay_retention_review_completed_absolute_failed', 'replay_retention_review_completed_not_qualified',
  'replay_retention_review_execution_failed'])

export function isReadonlyPostReviewTerminal(value) {
  return [OLD, NEW].includes(value?.schemaVersion) && STATUS.has(value.status)
}
function binding(value) {
  requireFact(value && typeof value.path === 'string' && /^(?:\.runtime|data)\//u.test(value.path)
    && !value.path.includes('\\') && !value.path.split('/').some(p => !p || p === '.' || p === '..')
    && SHA.test(value.sha256), 'history_post_review_binding_invalid')
  return { path: value.path, sha256: value.sha256 }
}
function same(a, b) { return isDeepStrictEqual(binding(a), binding(b)) }
function clock(value, source, scope) {
  const valid = t => typeof t === 'string' && Number.isFinite(Date.parse(t))
  return { scope, sourcePath: source?.path ?? null, sourceSha256: source?.sha256 ?? null,
    startedAtUtc: valid(value?.startedAtUtc) ? value.startedAtUtc : null,
    endedAtUtc: valid(value?.endedAtUtc) ? value.endedAtUtc : null,
    elapsedSeconds: typeof value?.elapsedSeconds === 'number' && Number.isFinite(value.elapsedSeconds)
      && value.elapsedSeconds >= 0 ? value.elapsedSeconds : null }
}

// Bounded list admission verifies the committed envelope/package. Expensive
// full evidence validation belongs to the selected detail/current projection.
export async function readReadonlyPostReviewEnvelope({ terminal, runId, readJson }) {
  requireFact(isReadonlyPostReviewTerminal(terminal) && terminal.runId === runId
    && terminal.packageId === runId && ['completed', 'failed_closed'].includes(terminal.executionState)
    && FLAGS.every(k => terminal[k] === false), 'history_post_review_terminal_conflict')
  const p = binding(terminal.executionPackage)
  const pkg = await readJson(p, ITEM)
  requireFact(pkg.schemaVersion === (terminal.schemaVersion === OLD
    ? 'ai-painter-two-map-post-review-package-v1' : 'ai-painter-replay-retention-review-package-v1')
    && pkg.reviewId === runId && typeof pkg.outputRoot === 'string'
    && p.path === pkg.outputRoot + '/package.json'
    && same(pkg.sourceTerminal, terminal.sourceTerminal)
    && FLAGS.every(k => pkg[k] === false), 'history_post_review_package_conflict')
  binding(pkg.sourceCheckpoint)
  return pkg
}

class NeededRead extends Error {
  constructor(value) { super('history_post_review_cache_miss'); this.binding = value }
}

export async function readReadonlyPostReviewEvidence({ terminal, runId,
  terminalBinding = /** @type {{path: string, sha256: string} | null} */ (null), readEvidenceJson, readJson }) {
  if (!isReadonlyPostReviewTerminal(terminal)) return null
  const cache = new Map(), identities = new Map()
  const storage = terminal.schemaVersion === NEW ? await import('../local-backup/replay-retention-work-evidence.mjs') : null
  const validatedLargeFits = new Set()
  let consumed = 0
  const load = async b => {
    b = binding(b)
    requireFact(!identities.has(b.path) || identities.get(b.path) === b.sha256,
      'history_post_review_read_identity_conflict')
    if (cache.has(b.path)) return cache.get(b.path)
    requireFact(cache.size < 512 && consumed < TOTAL, 'history_post_review_aggregate_limit')
    // Only source packages explicitly reached from this review/policy may use
    // the storage validator's precise existing large-package exception. This
    // internal check never exposes the package body through the public API.
    const largePackage = terminal.schemaVersion === NEW && [...cache.values()].some(({value:v}) =>
      v.schemaVersion === 'ai-painter-replay-retention-review-package-v1'
        && v.sourcePackage?.path === b.path && v.sourcePackage.sha256 === b.sha256
      || ['ai-painter-replay-retention-review-policy-v1','replay-retention-fit-policy-v1'].includes(v.schemaVersion)
        && v.parentExperiment?.package?.path === b.path && v.parentExperiment.package.sha256 === b.sha256)
    const max = Math.min(largePackage ? 4 * ITEM : ITEM, TOTAL - consumed)
    const r = readEvidenceJson ? await readEvidenceJson(b, max) : { value: await readJson(b, max) }
    const length = r.byteLength ?? Buffer.byteLength(JSON.stringify(r.value))
    requireFact(Number.isSafeInteger(length) && length >= 0 && length <= max,
      'history_post_review_aggregate_limit')
    if (length > ITEM) requireFact(r.value?.schemaVersion === 'replay-retention-fit-package-v1' && ['mixed','balanced'].includes(r.value.arm)
      || r.value?.schemaVersion === 'mixed-train-rehearsal-package-v1' && r.value.training?.pairs === 448,
      'history_post_review_large_package_conflict')
    consumed += length
    const row = { ...r, logicalPath: b.path, sha256: b.sha256, byteLength: length }
    identities.set(b.path, b.sha256); cache.set(b.path, row)
    return row
  }
  const pkg = await readReadonlyPostReviewEnvelope({ terminal, runId, readJson: async b => (await load(b)).value })
  const validator = terminal.schemaVersion === OLD ? readTwoMapPostReviewWorkEvidence
    : storage.readReplayRetentionWorkEvidence
  requireFact(typeof validator === 'function', 'history_post_review_schema_pending')
  const read = (p, sha256) => {
    const b = binding({ path: p, sha256 }), row = cache.get(p)
    if (!row) throw new NeededRead(b)
    requireFact(row.sha256 === sha256, 'history_post_review_read_identity_conflict')
    return row
  }
  let validated
  for (;;) {
    try {
      for (const r of cache.values()) if (r.byteLength > ITEM
        && r.value?.schemaVersion === 'replay-retention-fit-package-v1' && !validatedLargeFits.has(r.sha256)) {
        // The storage-owned validator binds the exact arm/policy SHA, original
        // roster, schedule, exposures and parent. A name alone grants no larger
        // read budget; short/unknown arms retain the ordinary JSON ceiling.
        storage.validateReplayRetentionFitPackage(r.value, read)
        validatedLargeFits.add(r.sha256)
      }
      validated = validator({ terminal, read }); break
    }
    catch (error) {
      if (error instanceof NeededRead) { await load(error.binding); continue }
      throw new Error('history_post_review_evidence_conflict', { cause: error })
    }
  }
  if (terminal.schemaVersion === NEW) return normalizeReplayReview({ terminal, terminalBinding, pkg, validated, consumed, cache })
  const source = validated.source.value
  requireFact(source.runId === terminal.sourceRunId && same(source.executionPackage, pkg.sourcePackage),
    'history_post_review_source_identity_conflict')
  const result = (await load(source.result)).value
  requireFact((result.runId ?? result.experimentIdentity) === terminal.sourceRunId
    && Array.isArray(result.artifacts) && result.artifacts.some(a => same(a, pkg.sourceCheckpoint)),
    'history_post_review_checkpoint_conflict')
  const report = validated.report?.value ?? null
  const inference = report ? read(report.inference.path, report.inference.sha256).value : null
  requireFact(pkg.trainSampleIds.length === 2 && pkg.validationSampleIds.length === 8
    && new Set([...pkg.trainSampleIds, ...pkg.validationSampleIds]).size === 10,
    'history_post_review_roster_conflict')
  if (report) requireFact(report.sourceRunId === terminal.sourceRunId
    && inference.schemaVersion === 'ai-painter-two-map-post-review-inference-v1', 'history_post_review_report_identity_conflict')
  const rows = (report?.audits ?? []).map((row, index) => {
    const audit = read(row.evidence.path, row.evidence.sha256).value
    requireFact(audit.projectionIsModelOutput === false && FLAGS.every(k => audit[k] === false),
      'history_post_review_projection_conflict')
    requireFact(binding(audit.prediction).path.startsWith(pkg.outputRoot + '/')
      && binding(audit.projection).path.startsWith(pkg.outputRoot + '/'), 'history_post_review_output_path_conflict')
    return { sampleId: row.sampleId, split: row.split, passed: row.passed, issueCodes: row.issueCodes,
      evidence: binding(row.evidence), prediction: binding(audit.prediction), original: binding(audit.reference),
      condition: binding(audit.condition), projection: binding(audit.projection),
      measurements: publicMeasurements(inference.observations[index].metrics), resolution: [256, 192] }
  })
  return { pkg, report, inference, rows, sourceRunId: terminal.sourceRunId,
    executionResult: validated.executionResult, absoluteOutcome: terminal.visualOutcome,
    relativeOutcome: null, sourceCheckpoint: binding(pkg.sourceCheckpoint),
    reviewTiming: clock(terminal, terminalBinding, 'post_training_readonly_review_controller'),
    inferenceTiming: inference ? clock(inference, report.inference, 'readonly_review_model_loading_and_prediction_publication') : null,
    readCoverage: { byteLength: consumed, documentCount: cache.size, maximumBytes: TOTAL } }
}

function normalizeReplayReview({ terminal, terminalBinding, pkg, validated, consumed, cache }) {
  const report = validated.report?.value ?? null, inference = validated.inference?.value ?? null
  const rows = report ? validated.samples.map((s, i) => {
    const audits = validated.auditRows[i], candidate = audits.candidate.value, parent = audits.parent.value
    requireFact(candidate.projectionIsModelOutput === false && parent.projectionIsModelOutput === false,
      'history_post_review_projection_conflict')
    return { sampleId: s.sampleId, split: s.split, passed: s.candidateAbsolute.passed,
      issueCodes: s.candidateAbsolute.issueCodes, evidence: binding(audits.candidate.binding),
      prediction: binding(s.prediction), original: binding(s.identity.image), condition: binding(s.identity.conditionPack),
      projection: binding(candidate.projection), resolution: [s.nativePredictionDimensions.width, s.nativePredictionDimensions.height],
      referenceResolution: [s.referenceNativeDimensions.width, s.referenceNativeDimensions.height],
      projectionResolution: [candidate.projectionDimensions.width, candidate.projectionDimensions.height],
      measurements: publicMeasurements(s.metrics), imageTiming: s.imageTiming,
      parentPrediction: binding(s.parentPrediction), aPrediction: binding(s.aPrediction),
      parentProjection: binding(parent.projection), parentEvidence: binding(audits.parent.binding),
      rowBinding: binding(s.rowBinding), observationBinding: binding(s.observationBinding),
      relative: publicComparison(s.relative), absolute: publicComparison(s.absolute),
      parentMeasurements: publicMeasurements(s.parentMetrics), aMeasurements: publicMeasurements(s.aMetrics) }
  }) : []
  return { pkg, report, inference, rows, arm: validated.arm, sourceRunId: terminal.sourceRunId,
    parentRunId: validated.parentTerminal.value.runId ?? validated.parentTerminal.value.experimentIdentity ?? null,
    comparisonATerminal: binding(validated.policy.value.single149Experiment.terminal),
    executionResult: validated.executionResult, absoluteOutcome: validated.absoluteOutcome,
    relativeOutcome: validated.relativeOutcome, sourceCheckpoint: binding(pkg.sourceCheckpoint),
    historicalMetricsAuthority: 'frozen_evaluations_revalidated_by_worker_not_ledger',
    reviewTiming: clock(terminal, terminalBinding, 'review_controller_package_worker_and_absolute_audits_before_terminal_commit'),
    inferenceTiming: inference ? clock(inference, report.inference, inference.timingScope) : null,
    readCoverage: { byteLength: consumed, documentCount: cache.size, maximumBytes: TOTAL } }
}

function publicComparison(value) {
  const output = {}
  const codes = v => Array.isArray(v) ? v.filter(c => typeof c === 'string' && /^[a-zA-Z0-9_.-]{1,192}$/u.test(c)).slice(0, 128) : []
  for (const key of ['status', 'fullRgbMaeDelta', 'parentPassed', 'candidatePassed']) {
    const v = value?.[key]
    if (typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v) || v === null
      || key === 'status' && ['passed','failed','retained','regressed','unknown','not_applicable'].includes(v)) output[key] = v
  }
  for (const key of ['newIssueCodes', 'existingIssueCodes', 'resolvedIssueCodes']) if (value?.[key]) output[key] = codes(value[key])
  if (Array.isArray(value?.checks)) output.checks = value.checks.slice(0, 32).map(c => ({
    name: typeof c.name === 'string' && /^[a-zA-Z0-9_.-]{1,96}$/u.test(c.name) ? c.name : null,
    ...publicComparison({ status: c.status }), ...Object.fromEntries(['before','after','delta'].map(k =>
      [k, typeof c[k] === 'number' && Number.isFinite(c[k]) ? c[k] : null])) }))
  return output
}

export async function adaptReadonlyPostReviewHistory({ terminal, runId, record, base,
  readJson, readEvidenceJson, makeArtifact, checkpointMetadata }) {
  if (!isReadonlyPostReviewTerminal(terminal)) return null
  record.runKind = 'readonly_post_training_visual_review'
  const review = await readReadonlyPostReviewEvidence({ terminal, runId, terminalBinding: record.terminalBinding, readJson, readEvidenceJson })
  record.reviewSummary = { executionState: terminal.executionState, executionResult: review.executionResult,
    absoluteOutcome: review.absoluteOutcome, relativeOutcome: review.relativeOutcome,
    arm: review.arm ?? null, historicalMetricsAuthority: review.historicalMetricsAuthority ?? null,
    sourceRunId: review.sourceRunId, completedReviewCount: review.executionResult === 'succeeded' ? review.rows.length : null,
    targetReviewCount: review.pkg.trainSampleIds.length + review.pkg.validationSampleIds.length,
    passedCount: review.executionResult === 'succeeded' ? review.rows.filter(r => r.passed === true).length : null,
    failedCount: review.executionResult === 'succeeded' ? review.rows.filter(r => r.passed === false).length : null,
    formalQualificationGranted: false, checkpointPromotable: false, runtimePublicationAllowed: false }
  record.reviewTiming = { ...review.reviewTiming, sourcePath: record.terminalBinding.path,
    sourceSha256: record.terminalBinding.sha256 }
  record.reviewInferenceTiming = review.inferenceTiming
  record.optimizerSteps = terminal.optimizerUpdates === 0 ? 0 : null
  record.qualification = { formalStageQualified: false, checkpointPromotable: false, runtimeFrameAllowed: false }
  record.artifacts.push(makeArtifact('request', terminal.executionPackage, { evidenceKind: 'readonly_post_review' }))
  if (terminal.report) record.artifacts.push(makeArtifact('result', terminal.report, { evidenceKind: 'readonly_post_review' }))
  if (review.report?.inference) record.artifacts.push(makeArtifact('evidence', review.report.inference, { evidenceKind: 'readonly_post_review' }))
  const cp = await checkpointMetadata(makeArtifact('checkpoint', review.sourceCheckpoint,
    { purpose: 'review_source_checkpoint_metadata_only', sourceRunId: review.sourceRunId, promotable: false }))
  record.checkpoints.push(cp); record.artifacts.push(cp)
  for (const r of review.rows) {
    const meta = { sampleId: r.sampleId, split: r.split, sourceRunId: review.sourceRunId, arm: review.arm ?? null }
    const original = makeArtifact('original', r.original, { ...meta, purpose: 'review_reference_original', resolution: r.referenceResolution })
    const condition = makeArtifact('condition', r.condition, meta)
    const prediction = makeArtifact('output', r.prediction, { ...meta, purpose: 'readonly_review_native_prediction',
      isModelOutput: true, resolution: r.resolution, imageTiming: r.imageTiming })
    const projection = makeArtifact('image', r.projection, { ...meta, purpose: 'audit_resized_projection', isModelOutput: false,
      resolution: r.projectionResolution })
    const evidence = makeArtifact('evidence', r.evidence, { ...meta, purpose: 'per_image_absolute_review' })
    record.samples.push({ sampleId: r.sampleId, split: r.split, original, condition })
    record.artifacts.push(original, condition, prediction, projection, evidence)
    if (r.parentPrediction) {
      record.artifacts.push(
        makeArtifact('output', r.parentPrediction, { ...meta, arm: 'parent', sourceRunId: review.parentRunId,
          purpose: 'parent_native_prediction', isModelOutput: true, resolution: r.resolution }),
        makeArtifact('output', r.aPrediction, { ...meta, arm: 'A', sourceRunId: null, sourceTerminal: review.comparisonATerminal,
          purpose: 'comparison_a_native_prediction', isModelOutput: true, resolution: r.resolution }),
        makeArtifact('image', r.parentProjection, { ...meta, arm: 'parent', sourceRunId: review.parentRunId,
          purpose: 'parent_audit_resized_projection', isModelOutput: false,
          resolution: r.projectionResolution }),
        makeArtifact('evidence', r.parentEvidence, { ...meta, arm: 'parent', sourceRunId: review.parentRunId,
          purpose: 'parent_per_image_absolute_review' }),
        makeArtifact('evidence', r.rowBinding, { ...meta, purpose: 'paired_review_row' }),
        makeArtifact('evidence', r.observationBinding, { ...meta, purpose: 'native_prediction_observation' }))
    }
    record.metrics.push({ ...meta, measurementScope: 'readonly_post_training_visual_review',
      measurements: r.measurements, passed: r.passed, issueCodes: r.issueCodes,
      ...(r.parentPrediction ? { parentMeasurements: r.parentMeasurements, aMeasurements: r.aMeasurements,
        relativeComparison: r.relative, absoluteComparison: r.absolute } : {}),
      sourcePath: r.evidence.path, sourceSha256: r.evidence.sha256 })
  }
  // Artifact identity is Run/role/path/SHA, not a display arm. An explicitly
  // shared parent/A file is one artifact with two associations, never duplicate
  // cursor entries or an arm label silently overwriting the other reference.
  const unique = new Map()
  const association = a => Object.fromEntries(['sampleId','split','arm','purpose','sourceRunId','sourceTerminal']
    .filter(k => a[k] !== undefined).map(k => [k, a[k]]))
  for (const a of record.artifacts) {
    const key = JSON.stringify([a.role, a.logicalPath, a.sha256]), previous = unique.get(key)
    if (!previous) unique.set(key, a)
    else previous.associations = [...(previous.associations ?? [association(previous)]), association(a)]
  }
  record.artifacts = [...unique.values()]
  record.logs = []
  record.detailCoverage = { adapter: 'readonly_post_review_v1', supported: true,
    sourcePolicy: 'verified_registry_explicit_sha256_parents_only', ...review.readCoverage }
  base.unavailableFields = [...new Set([...base.unavailableFields, 'trainingWorkerTiming', 'programLogs'])]
  return { ...base, schemaVersion: 'ai_console_training_run_detail_v1', record,
    dataStatus: review.executionResult === 'succeeded' ? 'connected' : 'partial',
    reasonCode: review.executionResult === 'succeeded' ? null : 'history_post_review_execution_failed' }
}

// Never expose raw reports, conditions, exception text, environment or commands.
export function publicReadonlyReviewArtifact(value) {
  const result = {}
  for (const k of ['schemaVersion', 'status', 'executionState', 'runId', 'packageId', 'reviewId', 'sourceRunId',
    'sampleId', 'split', 'visualOutcome', 'absoluteOutcome', 'relativeOutcome', 'recordedAtUtc',
    'startedAtUtc', 'endedAtUtc', 'elapsedSeconds', 'optimizerUpdates', 'gpuInitialized', ...FLAGS]) {
    const v = value?.[k]
    if (v === null || ['boolean', 'number', 'string'].includes(typeof v) && (typeof v !== 'string' || v.length <= 192)) result[k] = v
  }
  result.previewScope = 'controlled_readonly_review_metadata_only'
  return result
}
