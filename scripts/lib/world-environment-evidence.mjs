import { createHash } from 'node:crypto'
import { createEvolutionInputReader } from './natural-world-evolution-input.mjs'
import { baselineCanonical, baselineDigest, baselineJson, verifyNaturalRecordBytes } from './natural-world-baseline-proof.mjs'
import { inspectCapabilityScopeAdmission } from './ai-painter-autonomous-package-decision-core-v3.mjs'

export const ENVIRONMENT_EVIDENCE_MANIFEST = '.runtime/ai-painter/controller-repair-reviews/world-environment-admission-162-20261030/evidence/manifest.json'
export const ENVIRONMENT_EVIDENCE_MANIFEST_SHA = '20c8d2816641e7e3bd8b8b37b283f5e37f09d59b7a65b5ffe308193adad68b71'
const FIELDS = ['PRECTOTCORR', 'RH2M', 'T2M', 'WS2M'], UNITS = ['mm/day', '%', 'C', 'm/s']
const IDS = ['ownerId', 'playerId', 'worldId', 'worldSeed', 'worldProfileId', 'regionId']
const CHECKPOINT = '36a5e5973228295f38392b50680868331caab7b1588e3fc10f54d2f084ce05c8'
const PARENT = 'ef9a67f8a6078dc4f39e3280351ecca94f7a31677a3fc4ad0620fc186adbda54'
const sha = b => createHash('sha256').update(b).digest('hex')
const same = (a, b) => baselineCanonical(a) === baselineCanonical(b)
function need(ok, code) { if (!ok) throw new Error('environment_evidence_' + code) }
function vector(v) { need(Array.isArray(v) && v.length === 4 && v.every(x => typeof x === 'number' && Number.isFinite(x)), 'vector'); return v }
function near(a, b) { need(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(b)), 'metric_mismatch') }
function day(date, offset = 0) {
  need(typeof date === 'string' && /^\d{8}$/.test(date), 'date')
  const ms = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T00:00:00.000Z`)
  need(Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10).replaceAll('-', '') === date, 'date')
  return new Date(ms + offset * 86400000).toISOString().slice(0, 10).replaceAll('-', '')
}
function metrics(predicted, truth, std) {
  need(predicted.length === truth.length && truth.length > 0, 'metric_rows')
  const mae = [0, 0, 0, 0]
  predicted.forEach((v, i) => vector(v).forEach((x, j) => { mae[j] += Math.abs(x - vector(truth[i])[j]) / truth.length }))
  return { count: truth.length, perFieldMAE: Object.fromEntries(FIELDS.map((f, j) => [f, mae[j]])),
    meanNormalizedMAE: mae.reduce((s, v, j) => s + v / std[j], 0) / 4 }
}
function guardViolations(rows, bounds) {
  return rows.reduce((n, row) => n + vector(row).filter((x, j) => x < bounds[j][0] || x > bounds[j][1]).length, 0)
}

// Pure arithmetic over saved observations. This does not load or run a model,
// certify provenance, or grant any release qualification.
export function recomputeEnvironmentHoldout({ contract, source, receipt, dataset, trainingDataset, result, predictions, rollouts }) {
  need(contract.schemaVersion === 'world-environment-holdout2025-evaluation-v1', 'contract_schema')
  need(contract.candidateCheckpoint.sha256 === CHECKPOINT && contract.parentCheckpoint.sha256 === PARENT, 'model_identity')
  need(same(contract.source.fields, FIELDS) && same(contract.source.units, UNITS), 'contract_fields_units')
  need(contract.source.latitude === 14.5078 && contract.source.longitude === 101.895
    && same(contract.source.returnedCoordinates, [101.895, 14.508]), 'region')
  need(contract.source.start === '20250101' && contract.source.end === '20251231'
    && contract.data.historyDays === 7 && contract.data.expectedWindows === 358
    && same(contract.origins.horizons, [7, 30]), 'period_horizon')
  need(source.header.start === '20250101' && source.header.end === '20251231' && source.header.time_standard === 'UTC'
    && same(source.geometry.coordinates.slice(0, 2), [101.895, 14.508]), 'source_region_period')
  need(receipt.parameters.latitude === '14.5078' && receipt.parameters.longitude === '101.895'
    && receipt.parameters.start === '20250101' && receipt.parameters.end === '20251231'
    && receipt.parameters['time-standard'] === 'UTC', 'receipt_region_period')
  need(same(FIELDS.map(f => source.parameters[f]?.units), UNITS), 'source_units')
  for (const item of [dataset, trainingDataset]) need(same(item.fieldOrder, FIELDS) && same(item.units, UNITS), 'dataset_units')
  need(same(predictions.fieldOrder, FIELDS) && same(rollouts.fieldOrder, FIELDS), 'output_fields')
  need(dataset.windows.length === 358 && predictions.rows.length === 358 && dataset.sourceDays === 365, 'row_count')
  need(same(result.candidateCheckpoint, contract.candidateCheckpoint) && same(result.parentCheckpoint, contract.parentCheckpoint), 'result_model')
  const truthByDate = new Map()
  for (const f of FIELDS) need(Object.keys(source.properties.parameter[f]).length === 365, 'source_count')
  for (let i = 0; i < 365; i++) {
    const date = day('20250101', i), v = vector(FIELDS.map(f => source.properties.parameter[f][date]))
    need(!v.includes(source.header.fill_value), 'source_missing'); truthByDate.set(date, v)
  }
  const train = trainingDataset.trainDays
  need(Array.isArray(train) && train.length === 731 && trainingDataset.trainDates.length === train.length, 'normalizer_training_days')
  train.forEach(vector)
  const mean = FIELDS.map((_, j) => train.reduce((s, v) => s + v[j] / train.length, 0))
  const std = FIELDS.map((_, j) => Math.max(1e-6, Math.sqrt(train.reduce((s, v) => s + (v[j] - mean[j]) ** 2 / train.length, 0))))
  mean.forEach((v, j) => near(v, result.normalizer.mean[j])); std.forEach((v, j) => near(v, result.normalizer.std[j]))
  const bounds = FIELDS.map(f => { const g = contract.guards[f]; need(g.purpose === 'empirical_diagnostic_only'
    && Number.isFinite(g.minimum) && Number.isFinite(g.maximum) && g.minimum <= g.maximum, 'guards'); return [g.minimum, g.maximum] })
  need(same(rollouts.guards, bounds), 'rollout_guards')
  const candidate = [], persistence = [], targets = [], ablation = []
  for (let i = 0; i < 358; i++) {
    const w = dataset.windows[i], p = predictions.rows[i], date = day('20250108', i)
    need(w.split === 'holdout2025' && w.targetDate === date && p.targetDate === date, 'window_date')
    need(same(w.historyDates, Array.from({ length: 7 }, (_, k) => day(date, k - 7))), 'history_dates')
    need(same(w.history, w.historyDates.map(d => truthByDate.get(d)))
      && same(w.target, truthByDate.get(date)) && same(p.target, w.target)
      && same(p.persistence, w.history[6]), 'source_window_values')
    candidate.push(vector(p.candidate153.prediction)); ablation.push(vector(p.candidate153.historyAblated))
    persistence.push(p.persistence); targets.push(w.target)
  }
  const oneStep = { candidate: metrics(candidate, targets, std), persistence: metrics(persistence, targets, std),
    guardViolations: guardViolations(candidate, bounds), ablationGuardViolations: guardViolations(ablation, bounds) }
  near(oneStep.candidate.meanNormalizedMAE, result.oneStep.candidate153.metrics.meanNormalizedMAE)
  near(oneStep.persistence.meanNormalizedMAE, result.oneStep.persistence.meanNormalizedMAE)
  const expectedOrigins = Array.from({ length: 12 }, (_, m) => dataset.windows.find(w => Number(w.targetDate.slice(4, 6)) === m + 1
    && day(w.targetDate, 29) <= '20251231').targetDate)
  need(same(rollouts.trajectories.map(t => t.originDate), expectedOrigins), 'origins')
  const aggregate = { candidate153: {}, parent150: {} }, violations = { candidate153: 0, parent150: 0 }
  for (const model of ['candidate153', 'parent150']) {
    for (const horizon of [7, 30]) {
      const predicted = [], expected = [], constant = []
      for (const trajectory of rollouts.trajectories) {
        const r = trajectory[model], initial = dataset.windows.find(w => w.targetDate === trajectory.originDate)
        need(r.originDate === trajectory.originDate && r.steps.length === 30 && same(r.initialHistory, initial.history), 'trajectory_shape')
        for (let i = 0; i < horizon; i++) {
          const step = r.steps[i], date = day(trajectory.originDate, i)
          need(step.step === i + 1 && step.date === date && truthByDate.has(date), 'trajectory_date')
          predicted.push(vector(step.prediction)); expected.push(truthByDate.get(date)); constant.push(initial.history[6])
        }
      }
      const score = metrics(predicted, expected, std), baseline = metrics(constant, expected, std)
      aggregate[model][horizon] = { candidate: score, constant: baseline }
      near(score.meanNormalizedMAE, result.rolloutAggregates[model][horizon].metrics.meanNormalizedMAE)
      near(baseline.meanNormalizedMAE, result.rolloutAggregates[model][horizon].constantLastDay.meanNormalizedMAE)
      near(score.perFieldMAE.RH2M, result.rolloutAggregates[model][horizon].metrics.perField.RH2M.MAE)
      if (horizon === 30) violations[model] = guardViolations(predicted, bounds)
    }
  }
  const conditions = {
    oneStepBetter: oneStep.candidate.meanNormalizedMAE < oneStep.persistence.meanNormalizedMAE,
    oneStepAndAblationGuards: oneStep.guardViolations === 0 && oneStep.ablationGuardViolations === 0,
    all12CandidateThirtyDayRolloutsComplete: violations.candidate153 === 0,
    sevenDayBetter: aggregate.candidate153[7].candidate.meanNormalizedMAE < aggregate.candidate153[7].constant.meanNormalizedMAE,
    thirtyDayRhBetterThanParent: aggregate.candidate153[30].candidate.perFieldMAE.RH2M < aggregate.parent150[30].candidate.perFieldMAE.RH2M,
    thirtyDayBetterThanConstant: aggregate.candidate153[30].candidate.meanNormalizedMAE < aggregate.candidate153[30].constant.meanNormalizedMAE,
  }
  return { calculation: 'saved_numeric_predictions_against_source_verified_targets', oneStep, aggregate, conditions,
    normalizer: { mean, std, recomputedTrainingDayCount: train.length }, trajectoryOrigins: expectedOrigins,
    productionAdmitted: false, modelForwards: 0 }
}

function logicalRef(p) {
  // Historical Python reports used this one original checkout spelling. Only
  // explicit manifest membership below permits its corresponding logical path.
  return typeof p === 'string' && p.startsWith('F:\\ai-pet-world\\') ? p.slice(16).replaceAll('\\', '/') : p
}
function matrixSha(values) { need(values.length === 7, 'matrix_rows'); const b = Buffer.alloc(224); values.flatMap(vector).forEach((v, i) => b.writeDoubleLE(v, i * 8)); return sha(b) }

export function auditWorldEnvironmentEvidence(options = {}) {
  need(options && Object.getPrototypeOf(options) === Object.prototype && Reflect.ownKeys(options).every(k => k === 'projectRoot'), 'options')
  if (Object.hasOwn(options, 'projectRoot')) need(Object.hasOwn(Object.getOwnPropertyDescriptor(options, 'projectRoot'), 'value'), 'options_accessor')
  const projectRoot = options.projectRoot ?? process.cwd(), reader = createEvolutionInputReader(projectRoot)
  const rawManifest = reader.read(ENVIRONMENT_EVIDENCE_MANIFEST, 65536)
  need(sha(rawManifest) === ENVIRONMENT_EVIDENCE_MANIFEST_SHA, 'manifest_sha')
  const manifest = baselineJson(rawManifest, 65536), raw = new Map(), refs = new Map()
  need(manifest.schemaVersion === 'world-environment-fixed-evidence-manifest-v1' && manifest.refs.length <= 100, 'manifest_schema')
  for (const ref of manifest.refs) {
    need(!refs.has(ref.path) && Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= 4 * 1024 * 1024, 'reference_shape')
    const bytes = reader.read(ref.path, ref.bytes)
    need(bytes.length === ref.bytes && sha(bytes) === ref.sha256, 'reference_sha:' + ref.path)
    raw.set(ref.path, bytes); refs.set(ref.path, ref)
  }
  const get = p => { need(raw.has(p), 'unlisted_reference'); return baselineJson(raw.get(p)) }
  const root = key => get(manifest.roots[key])
  const bound = ref => { const p = logicalRef(ref.path); need(refs.has(p) && refs.get(p).sha256 === ref.sha256
    && (ref.bytes === undefined || refs.get(p).bytes === ref.bytes), 'bound_identity'); return p }
  const c = root('evaluationContract'), result = root('evaluationResult'), model = root('modelResult'), trainContract = root('modelContract')
  need(result.contractSha256 === refs.get(manifest.roots.evaluationContract).sha256
    && result.datasetSha256 === refs.get(manifest.roots.dataset).sha256
    && model.contractSha256 === refs.get(manifest.roots.modelContract).sha256, 'contract_dataset_identity')
  need(c.candidateCheckpoint.trainingContractSha256 === model.contractSha256
    && c.candidateCheckpoint.trainingDatasetSha256 === refs.get(manifest.roots.trainingDataset).sha256, 'training_identity')
  for (const r of [c.candidateCheckpoint, c.parentCheckpoint, model.checkpoint, model.trainingDataset,
    trainContract.trainingDataset, result.predictions, result.rollouts, ...c.codeBindings, ...result.codeBindings,
    ...Object.values(root('dataset').sourceBinding), root('sourceQualification').sourceRef, root('sourceQualification').rightsRef]) bound(r)
  need(root('dataset').contractSha256 === result.contractSha256 && root('sourceReceipt').responseSha256 === refs.get(manifest.roots.source).sha256, 'source_binding')
  const recomputed = recomputeEnvironmentHoldout({ contract: c, source: root('source'), receipt: root('sourceReceipt'),
    dataset: root('dataset'), trainingDataset: root('trainingDataset'), result, predictions: root('predictions'), rollouts: root('rollouts') })
  const run = root('runResult'), runManifest = root('runManifest'), loopContract = root('loopContract'), formal = root('formalWorld')
  need(run.executionTaskId === 'WORLD-EVOLUTION-VERIFICATION-159' && run.forwardEvidence.length === 5 && run.steps.length === 3, 'run_identity')
  need(bound(run.manifestRef) === manifest.roots.runManifest && same(run.identity, runManifest.identity), 'run_manifest')
  runManifest.sourceBindings.forEach(bound)
  const id = Object.fromEntries(IDS.map(k => [k, formal[k]]))
  verifyNaturalRecordBytes(raw.get(manifest.roots.formalWorld), id)
  need(IDS.every(k => run.identity[k].startsWith('integration158-') && run.identity[k] !== formal[k]), 'private_identity')
  const forwards = []
  for (const f of run.forwardEvidence) {
    const inputPath = bound(f.inputRef), input = get(inputPath), output = get(bound(f.outputRef)), process = get(bound(f.processRef))
    need(input.contractSha256 === refs.get(manifest.roots.loopContract).sha256 && output.contractSha256 === input.contractSha256
      && output.checkpointSha256 === CHECKPOINT && loopContract.checkpoint?.sha256 === CHECKPOINT, 'forward_model')
    need(same(input.identity, run.identity) && input.mode === f.mode && output.mode === f.mode, 'forward_identity')
    need(same(input.window.fieldOrder, FIELDS) && same(input.window.units, UNITS)
      && same(output.fieldOrder, FIELDS) && same(output.units, UNITS), 'forward_units')
    need(output.inputBytesSha256 === sha(raw.get(inputPath)) && output.featureValueSha256 === matrixSha(input.window.values), 'forward_input_binding')
    need(process.pid === f.pid && output.pid === f.pid && process.exitCode === 0 && same(baselineJson(Buffer.from(process.stdout)), output), 'forward_process')
    vector(output.values); forwards.push({ mode: f.mode, step: f.step, input, output })
  }
  const primary = forwards.filter(f => f.mode === 'primary')
  need(same(primary.map(f => f.step), [1, 2, 3]), 'primary_steps')
  for (let i = 0; i < 3; i++) {
    const f = primary[i], step = get(bound(run.steps[i].receiptRef)), interval = f.input.interval
    need(same(step.identity, run.identity) && same(step.primary.output, f.output), 'step_identity')
    need(step.before.tick === i && step.after.tick === i + 1 && step.after.stateVersion === i + 1 && step.after.eventCursor === i + 1, 'step_counters')
    need(f.input.before.tick === i && interval.durationSeconds === 86400
      && interval.logicalStartUtc === new Date(Date.parse('2020-01-08T00:00:00.000Z') + i * 86400000).toISOString()
      && Date.parse(interval.logicalEndUtc) - Date.parse(interval.logicalStartUtc) === 86400000, 'step_interval')
    f.input.provenance.forEach(p => bound(p.sourceRef))
    if (i) need(same(f.input.window.values, [...primary[i - 1].input.window.values.slice(1), primary[i - 1].output.values]), 'history_feedback')
  }
  const history = forwards.find(f => f.mode === 'history_probe'), metadata = forwards.find(f => f.mode === 'metadata_probe'), third = primary[2]
  const changed = structuredClone(third.input.window.values); changed[5][1] += changed[5][1] + 1 > 100 ? -1 : 1
  need(same(history.input.window.values, changed) && same(metadata.input.window.values, third.input.window.values), 'probe_input')
  const difference = Math.max(...history.output.values.map((v, j) => Math.abs(v - third.output.values[j])))
  need(difference > 1e-9 && same(metadata.output.values, third.output.values), 'probe_result')
  const finalPath = run.run + '/store/' + run.identity.ownerId + '/' + run.identity.worldId + '.json'
  need(refs.get(finalPath)?.sha256 === run.final.fileSha256, 'private_final_sha')
  const final = get(finalPath), { recordContentSha256, ...withoutOwn } = final
  need(final.tick === 3 && final.stateVersion === 3 && final.eventCursor === 3
    && IDS.every(k => final[k] === run.identity[k]), 'private_final_counters')
  need(recordContentSha256 === baselineDigest(withoutOwn) && recordContentSha256 === run.final.recordContentSha256
    && final.worldFactsPayloadSha256 === baselineDigest(final.worldFacts)
    && final.statePayloadSha256 === baselineDigest({ ...run.identity, worldState: final.worldState, randomState: final.randomState,
      ruleVersion: final.ruleVersion, eventCursor: final.eventCursor, tick: final.tick, stateVersion: final.stateVersion }), 'private_final_content_hash')
  const admission = inspectCapabilityScopeAdmission({ projectRoot, requiredCapabilityScope: 'world_evolution' })
  need(admission.registry.sha256 === refs.get(manifest.roots.registry).sha256, 'registry_changed')
  return {
    schemaVersion: 'world-environment-evidence-audit-v1', taskId: 'WORLD-ENVIRONMENT-ADMISSION-162', observedAtUtc: new Date().toISOString(),
    referenceBytesVerified: { manifest: { path: ENVIRONMENT_EVIDENCE_MANIFEST, sha256: ENVIRONMENT_EVIDENCE_MANIFEST_SHA },
      count: refs.size, refs: [...refs.values()], coverage: 'Only listed files; no recursive or implied verification of every nested reference.' },
    scope: { fields: FIELDS, units: UNITS, requestedLatitude: 14.5078, requestedLongitude: 101.895,
      returnedCoordinates: [101.895, 14.508], statistics: 'daily UTC', evaluationPeriod: ['20250101', '20251231'],
      checkpointSha256: CHECKPOINT, historyDays: 7, singleForwardHorizonSeconds: 86400, evaluatedRolloutDays: [7, 30],
      regionGenerality: 'same_point_only', publicationAvailability: 'unknown_retrospective_only',
      normalization: 'recomputed_from_731_training_days', checkpointVerification: 'file_bytes_only_not_tensor_reload' },
    recomputedHoldout: recomputed,
    historicalIntegration: { executionTaskId: run.executionTaskId, identity: run.identity, verifiedSavedForwardRecords: forwards.length,
      consecutiveSavedSteps: 3, finalPrivateTick: final.tick, numericalHistoryDifference: difference, metadataOutputIdentical: true,
      interpretation: 'Saved private numerical integration; not fresh inference or formal-world cold-start evidence.' },
    formalWorld: { identity: id, sha256: refs.get(manifest.roots.formalWorld).sha256, tick: formal.tick, stateVersion: formal.stateVersion, eventCursor: formal.eventCursor },
    admission, coldStartStatus: 'not_proven_for_formal_world', domainConsumerStatus: 'not_integrated', productionAdmitted: false,
    gaps: ['world_evolution_semantic_release_verifier_unsupported', 'registered_environment_capability_missing',
      'production_policy_not_provided', 'formal_world_epoch_and_cold_start_not_proven',
      'operational_source_publication_availability_unknown', 'registered_production_consumer_not_integrated'],
    reusableEvidence: ['exact_frozen153_checkpoint_and_model_source_bytes', 'source_aligned_2025_saved_numeric_evaluation',
      'saved_private_three_step_forward_and_history_bindings'],
    exclusions: ['No production release, new geography, unlimited rollout, ecology, visual quality or complete MVP qualification.',
      'Frozen diagnostic guards are not registered production field limits.', 'Historical training and clean checkpoint tensor loading were not rerun.'],
    modelForwards: 0, trainingUpdates: 0, registryWrites: 0, worldWrites: 0,
  }
}
