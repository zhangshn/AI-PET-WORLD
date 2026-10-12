import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { adaptLegacyTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'
import { readCurrentExecutionRegistry } from '../../src/server/ai-painter-current-execution-registry.mjs'
import { readTrainingRun } from '../../src/server/ai-console/training-history-store.mjs'
import { bytes } from '../../src/server/ai-console/training-history-safe-bytes.mjs'

const digest = value => createHash('sha256').update(value).digest('hex')
function fixture(quality = false, decode1 = false, configurationSchema = null) {
  const root = '.runtime/ai-painter/managed-test', runId = 'managed-test-run', packageId = 'managed-test-package', capabilityVersion = 'managed-test-capability'
  const documents = new Map(), identity = { runId, packageId, capabilityVersion }
  const bind = (path, value) => { const raw = Buffer.from(JSON.stringify(value)); documents.set(path, raw); return { path, sha256: digest(raw) } }
  const ceiling = { epochs: quality ? 12 : 48, generatorOptimizerSteps: quality ? 576 : 2304, discriminatorOptimizerSteps: quality ? 576 : 2304 }
  const selection = { eligibleEpochs: quality ? [12] : [24, 36, 48], validationRowsPerEligibleEpoch: quality ? 8 : 1 }
  const config = { executionCeiling: ceiling, checkpointSelection: selection, scope: { resolution: [256, 192], subjectSampleId: 'sample-1' } }
  if (quality) config.schema=configurationSchema ?? (decode1 ? 'ecology-decode1-weight-quality-configuration-v1' : 'ecology-regime-quality-configuration-v1')
  const plan = { schema: quality ? (decode1 ? 'ecology-decode1-weight-quality-plan-v1' : 'ecology-regime-quality-plan-v1') : 'detail-weight-capture-managed-plan-v1',
    ...(quality ? {executionMode:'bounded-quality-training'} : {}), ...identity, outputRoot: root, configuration: config }
  const planBinding = bind(`${root}/${quality ? 'quality-plan.json' : 'detail-weight-capture-plan.json'}`, plan)
  const autonomous = { schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: packageId,
    capabilityVersion, outputRoot: root, inputEvidence: [planBinding] }
  const executionPackage = bind(`${root}/autonomous-package.json`, autonomous)
  const observation = { schemaVersion: 'ai-painter-current-training-package-v1', ...identity, outputRoot: root,
    resolution: [256, 192], trainingPlan: { ...ceiling }, resourceBudget: { ...ceiling }, autonomousExecutionPackage: executionPackage }
  const observationBinding = bind(`${root}/package.json`, observation)
  const capsule = bind(`${root}/capsule.json`, { schemaVersion: 'ai-painter-local-task-capsule-v1', integrity: { status: 'verified' }, evidence: [observationBinding] })
  const worker = { schema: quality ? (decode1 ? 'ecology-decode1-weight-quality-worker-terminal-v1' : 'ecology-regime-quality-worker-terminal-v1') : 'detail-weight-managed-worker-terminal-v1', ...identity, executionPackage, executionState: 'failed_closed', status: 'failed_closed',
    optimizerStepsGenerator: 475, optimizerStepsDiscriminator: 476, optimizerSteps: { generator: 475, discriminator: 476 }, completedEpochs: 9, checkpoints: [] }
  const cpBinding = { path: `${root}/checkpoint.pt`, sha256: 'a'.repeat(64) }
  const cpEpoch=quality ? 12 : 24, cpUpdates=cpEpoch*48
  const cp = { epoch: cpEpoch, checkpoint: cpBinding, counts: { generator: cpUpdates, discriminator: cpUpdates }, selection: { epoch: cpEpoch },
    validation: Array.from({length:quality ? 8 : 1},(_,index)=>({ sampleId: `sample-${index+1}`, split: 'validation', epoch: cpEpoch, fullRgbMae: 0.03 })) }
  const calls = [], metadataCalls = []
  const readJson = async bound => {
    calls.push(bound.path)
    const raw = documents.get(bound.path)
    if (!raw) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    if (digest(raw) !== bound.sha256) throw new Error('history_sha_mismatch')
    return JSON.parse(raw)
  }
  const requireFact = (condition, code, status = 409) => { if (!condition) throw Object.assign(new Error(code), { status }) }
  const makeArtifact = (role, b, metadata = {}) => ({ role, logicalPath: b.path, sha256: b.sha256,
    artifactId: digest(JSON.stringify([runId, role, b.path, b.sha256])), verificationStatus: 'binding_verified_bytes_not_read', ...metadata })
  const complete = () => {
    Object.assign(worker, { executionState: 'completed', status: 'training_completed_review_pending', completedEpochs: cpEpoch,
      optimizerStepsGenerator: cpUpdates, optimizerStepsDiscriminator: cpUpdates, optimizerSteps: { generator: cpUpdates, discriminator: cpUpdates },
      checkpoints: [cp], selectedCheckpointRecord: cp, checkpointReloadVerified: true })
  }
  const complete48 = () => {
    complete(); selection.validationRowsPerEligibleEpoch = 8
    // Refresh the already-bound plan/package, just as an isolated immutable
    // fixture would be materialized before training (never production data).
    const updatedPlan = bind(planBinding.path, plan)
    autonomous.inputEvidence = [updatedPlan]
    Object.assign(executionPackage, bind(executionPackage.path, autonomous))
    Object.assign(observation.autonomousExecutionPackage, executionPackage)
    Object.assign(observationBinding, bind(observationBinding.path, observation))
    bind(capsule.path, { schemaVersion: 'ai-painter-local-task-capsule-v1', integrity: { status: 'verified' }, evidence: [observationBinding] })
    // The capsule hash changes too; only this in-memory binding is refreshed.
    capsule.sha256 = digest(documents.get(capsule.path))
    worker.checkpoints = [24, 36, 48].map(epoch => ({ ...cp, epoch,
      checkpoint: { ...cpBinding, path: `${root}/checkpoint-${epoch}.pt` },
      counts: { generator: epoch * 48, discriminator: epoch * 48 },
      validation: Array.from({ length: 8 }, (_, i) => ({ sampleId: `sample-${i + 1}`, split: 'validation', epoch, fullRgbMae: 0.03 })) }))
    Object.assign(worker, { completedEpochs: 48, optimizerStepsGenerator: 2304, optimizerStepsDiscriminator: 2304,
      optimizerSteps: { generator: 2304, discriminator: 2304 }, selectedCheckpointRecord: worker.checkpoints[1] })
  }
  const options = {}
  const run = async () => {
    const workerBinding = bind(`${root}/worker-terminal.json`, worker)
    let terminal = options.wrapper ? { ...identity, executionPackage, workerTerminal: workerBinding,
      executionState: worker.executionState, status: worker.status } : worker
    if (options.changeWrapper) options.changeWrapper(terminal)
    let taskTerminalBinding = null
    let task = null
    if (options.review) {
      const reviewRoot = options.preciseReview ? `${root}/review-recovery-v1` : root
      const candidateRgb = { path: `${reviewRoot}/output.png`, sha256: 'b'.repeat(64) }
      const originalRgb = { path: `${reviewRoot}/original.png`, sha256: 'c'.repeat(64) }
      const selectedCheckpoint = worker.selectedCheckpointRecord?.checkpoint ?? cpBinding
      const review = { schema: quality ? 'ecology-regime-native-review-input-v1' : 'detail-weight-native-review-input-v1', capabilityVersion, executionPackage, workerTerminal: workerBinding,
        selectedCheckpoint, subject: { sampleId: 'sample-1', split: 'validation' }, candidateRgb, originalRgb,
        artifacts: [candidateRgb] }
      if (quality) {
        review.artifacts=Array.from({length:8},(_,i)=>i===0 ? candidateRgb : {path:`${reviewRoot}/declared-${i}.png`,sha256:'e'.repeat(64)})
        review.validationImages=review.artifacts.map((binding,i)=>({sampleId:`sample-${i+1}`,split:'validation',
          epoch:12,optimizerStep:576,purpose:'prediction',binding,checkpoint:selectedCheckpoint}))
      }
      if (options.changeReview) options.changeReview(review)
      const reportBinding = bind(`${reviewRoot}/review.json`, review)
      task = { ...identity, executionPackage, reviewReport: reportBinding }
      if (options.audit) {
        const audit = { runId, executionPackage, selectedCheckpoint, input: reportBinding,
          status: options.auditStatus ?? 'dry_single_world_review_failed_closed', issueCodes: ['tree_alignment_failed'] }
        if (options.changeAudit) options.changeAudit(audit)
        task.audit = bind(`${reviewRoot}/audit.json`, audit)
      }
    } else if (options.finalization) {
      task = { ...identity, executionPackage, status: 'dry_review_failed_closed' }
    }
    if (options.preciseReview) {
      task = { ...task, schema: quality ? (decode1 ? 'ecology-decode1-weight-quality-review-terminal-v1' : 'ecology-regime-quality-review-terminal-v1') : 'detail-weight-managed-review-terminal-v1', ...identity, executionPackage, workerTerminal: workerBinding,
        executionState: options.reviewState ?? 'failed_closed', status: options.reviewStatus ?? 'review_execution_failed_closed' }
      if (options.reviewFailure) {
        const failure = { ...identity, executionPackage, workerTerminal: workerBinding, executionState: 'failed_closed',
          status: 'review_execution_failed_closed', failureKind: 'program', failureCode: 'adapter_exception', detail: 'TypeError: receipt is undefined' }
        if (options.changeFailure) options.changeFailure(failure)
        task.reviewFailure = bind(`${root}/review-recovery-v1/failure.json`, failure)
      }
      if (options.recoveryPlan) task.reviewRecoveryPlan = bind(`${root}/review-recovery-v1/plan.json`, { ...identity, applied: false })
      if (options.changePreciseWrapper) options.changePreciseWrapper(task)
    }
    if (task) {
      taskTerminalBinding = bind(`${root}/${options.preciseReview ? 'review-recovery-v1/terminal' : 'finalization'}.json`, task)
      if (options.preciseAsTerminal) terminal = task
    }
    const terminalBinding = options.preciseAsTerminal ? taskTerminalBinding : options.wrapper ? bind(`${root}/wrapper.json`, terminal) : workerBinding
    const record = { runId, terminalStatus: terminal.status, terminalBinding, artifacts: [makeArtifact('terminal', terminalBinding)], samples: [], checkpoints: [], metrics: [], qualification: {} }
    const base = { sourceRevision: 377, observedAtUtc: '2026-10-08T09:00:00.000Z', unavailableFields: ['resolution', 'metrics', 'samples', 'checkpoints'] }
    return adaptLegacyTrainingDetail({ runId, terminal, record, base, capsuleBinding: capsule, taskTerminalBinding,
      readJson, readEvidenceJson: async (b, limit) => {
        if ((documents.get(b.path)?.length ?? 0) > limit) throw Object.assign(new Error('history_byte_limit'), { status: 413 })
        return { value: await readJson(b) }
      }, makeArtifact, checkpointMetadata: async item => {
        metadataCalls.push(item.logicalPath)
        if (options.missingCheckpoint) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
        return { ...item, byteLength: 123 }
      }, requireFact })
  }
  return { run, options, worker, complete, complete48, bind, documents, calls, metadataCalls, plan, autonomous, observation, executionPackage, config, cp, root }
}

test('decode1 history preserves failed counts and explicit reviewed image bindings',async()=>{
  const failed=await fixture(true,true).run();
  assert.equal(failed.record.detailCoverage.adapter,'ecology_decode1_weight_quality_training_v1');
  assert.deepEqual(failed.record.optimizerSteps,{generator:475,discriminator:476});
  assert.equal(failed.record.samples.length,0);assert.equal(failed.record.checkpoints.length,0);
  const f=fixture(true,true);f.complete();Object.assign(f.options,{review:true,audit:true,preciseReview:true,
    preciseAsTerminal:true,reviewStatus:'dry_single_world_review_failed_closed'});
  const result=await f.run();
  assert.equal(result.record.detailCoverage.adapter,'ecology_decode1_weight_quality_training_v1');
  assert.equal(result.record.samples.length,8);assert.equal(result.record.checkpoints.length,1);
  assert.equal(result.record.selectedEpoch,12);assert.equal(result.record.qualification.formalQualificationAllowed,false);
});

test('decode1 history rejects old paired configuration without hiding it as missing images',async()=>{
  const f=fixture(true,true,'ecology-regime-quality-configuration-v1');
  await assert.rejects(f.run,/history_managed_plan_conflict/u);
});

test('quality history preserves failed unequal counts without fabricating images',async()=>{
  const result=await fixture(true).run()
  assert.equal(result.record.detailCoverage.adapter,'ecology_quality_training_v1')
  assert.equal(result.record.targetEpochs,12);assert.equal(result.record.targetOptimizerSteps,576)
  assert.deepEqual(result.record.optimizerSteps,{generator:475,discriminator:476})
  assert.equal(result.record.samples.length,0);assert.equal(result.record.checkpoints.length,0)
})
test('quality history reads eight explicitly bound sample outputs and keeps weights metadata only',async()=>{
  const f=fixture(true);f.complete();Object.assign(f.options,{review:true,audit:true,preciseReview:true,
    preciseAsTerminal:true,reviewStatus:'dry_single_world_review_failed_closed'})
  const result=await f.run()
  assert.equal(result.record.detailCoverage.adapter,'ecology_quality_training_v1')
  assert.equal(result.record.samples.length,8);assert.equal(result.record.checkpoints.length,1)
  assert.equal(result.record.selectedEpoch,12);assert.equal(result.record.reviewStatus,'dry_single_world_review_failed_closed')
  assert.equal(result.record.qualification.formalQualificationAllowed,false)
  for(let i=0;i<8;i++) assert.equal(result.record.samples[i].output.sampleId,`sample-${i+1}`)
  assert.ok(f.calls.every(p=>!p.endsWith('.pt')))
})
for(const [label,change] of [
  ['missing row',r=>r.validationImages.pop()],
  ['foreign sample',r=>r.validationImages[3].sampleId='foreign'],
  ['wrong split',r=>r.validationImages[3].split='train'],
  ['wrong epoch',r=>r.validationImages[3].epoch=48],
  ['wrong updates',r=>r.validationImages[3].optimizerStep=2304],
  ['wrong purpose',r=>r.validationImages[3].purpose='approved'],
  ['changed image SHA',r=>r.validationImages[3].binding={...r.validationImages[3].binding,sha256:'f'.repeat(64)}],
  ['different checkpoint',r=>r.validationImages[3].checkpoint={...r.selectedCheckpoint,sha256:'f'.repeat(64)}],
]) test(`quality history rejects ${label}`,async()=>{
  const f=fixture(true);f.complete();Object.assign(f.options,{review:true,audit:true,changeReview:change})
  await assert.rejects(f.run())
})

test('stable original failure preserves unequal G/D and plan; no CP/image invented', async () => {
  const f = fixture(), result = await f.run()
  assert.equal(result.record.detailCoverage.adapter, 'detail_weight_managed_training_v1')
  assert.deepEqual(result.record.optimizerSteps, { generator: 475, discriminator: 476 })
  assert.equal(result.record.completedEpochs, 9)
  assert.equal(result.record.targetEpochs, 48)
  assert.equal(result.record.targetOptimizerSteps, 2304)
  assert.equal(result.record.resolution.width, 256)
  assert.equal(result.sourceRevision, 377)
  assert.equal(result.dataStatus, 'partial')
  assert.equal(result.record.checkpoints.length, 0)
  assert.equal(result.record.samples.length, 0)
  assert.ok(!result.record.artifacts.some(a => ['output', 'image', 'checkpoint'].includes(a.role)))
  assert.equal(f.metadataCalls.length, 0)
})
test('explicit wrapper follows authenticated worker, not wrapper counts', async () => {
  const f = fixture(); f.options.wrapper = true
  f.options.changeWrapper = w => { w.optimizerStepsGenerator = 999 }
  assert.deepEqual((await f.run()).record.optimizerSteps, { generator: 475, discriminator: 476 })
})
test('completed CP remains metadata only with separately declared G/D', async () => {
  const f = fixture(); f.complete(); const result = await f.run()
  assert.equal(result.record.checkpoints.length, 1)
  assert.deepEqual(result.record.checkpoints[0].optimizerSteps, { generator: 1152, discriminator: 1152 })
  assert.equal(result.record.checkpoints[0].metadataOnly, true)
  assert.equal(result.record.checkpoints[0].selected, true)
  assert.ok(!f.calls.includes(f.cp.checkpoint.path))
  assert.equal(result.record.metrics.find(m => m.sampleId)?.epoch, 24)
})
test('explicit report and audit preserve saved images, failed review and no release', async () => {
  const f = fixture(); f.complete(); Object.assign(f.options, { review: true, audit: true })
  const result = await f.run()
  assert.equal(result.record.samples.length, 1)
  assert.equal(result.record.samples[0].sampleId, 'sample-1')
  assert.equal(result.record.qualification.independentReviewStatus, 'dry_single_world_review_failed_closed')
  assert.equal(result.record.qualification.formalQualificationAllowed, false)
  assert.equal(result.record.qualification.worldEntryAllowed, false)
  assert.equal(result.record.detailCoverage.availability.machineReview, 'available')
  assert.ok(!f.calls.some(p => /\.png$/u.test(p))) // Actual media bytes belong to the artifact endpoint.
})
for (const preciseAsTerminal of [false, true]) test(`precise review wrapper verifies numeric result, 24 rows and 3 CPs (primary=${preciseAsTerminal})`, async () => {
  const f = fixture(); f.complete48()
  Object.assign(f.options, { preciseReview: true, preciseAsTerminal, review: true, audit: true,
    reviewState: 'completed', reviewStatus: 'dry_single_world_numeric_passed_visual_approval_pending',
    auditStatus: 'dry_single_world_numeric_passed_visual_approval_pending', recoveryPlan: true })
  const r = await f.run()
  assert.equal(r.record.trainingStatus, 'training_completed_review_pending')
  assert.equal(r.record.trainingExecutionState, 'completed')
  assert.equal(r.record.reviewExecutionState, 'completed')
  assert.equal(r.record.reviewStatus, f.options.reviewStatus)
  assert.equal(r.record.failureSummary, null)
  assert.equal(r.record.completedEpochs, 48)
  assert.deepEqual(r.record.optimizerSteps, { generator: 2304, discriminator: 2304 })
  assert.equal(r.record.metrics.filter(m => m.split === 'validation').length, 24)
  assert.deepEqual(r.record.checkpoints.map(c => c.epoch), [24, 36, 48])
  assert.equal(r.record.selectedEpoch, 36)
  assert.equal(r.record.samples[0].output.epoch, 36)
  assert.ok(r.record.samples[0].original.logicalPath.startsWith(`${f.root}/review-recovery-v1/`))
  assert.equal(r.record.qualification.checkpointReloadVerified, true)
  for (const key of ['formalQualificationAllowed', 'worldEntryAllowed', 'checkpointPromotionEligible']) assert.equal(r.record.qualification[key], false)
  assert.ok(r.record.checkpoints.every(c => c.promotable === false && c.metadataOnly === true))
  assert.equal(r.record.detailCoverage.limits.jsonReads, 16)
  assert.equal(r.record.detailCoverage.limits.jsonBytes, 2 * 1024 * 1024)
  assert.ok(!f.calls.some(p => /\.(png|pt)$/u.test(p)))
  assert.ok(r.record.artifacts.some(a => a.evidenceKind === 'reviewRecoveryPlan'))
})
test('precise program failure preserves completed training and bound candidate without a model rejection', async () => {
  const f = fixture(); f.complete48()
  Object.assign(f.options, { preciseReview: true, review: true, reviewFailure: true })
  const r = await f.run()
  assert.equal(r.record.terminalStatus, 'training_completed_review_pending')
  assert.equal(r.record.trainingExecutionState, 'completed')
  assert.equal(r.record.reviewStatus, 'review_execution_failed_closed')
  assert.equal(r.record.reviewExecutionState, 'failed_closed')
  assert.equal(r.record.failureSummary.failureKind, 'program')
  assert.equal(r.record.failureSummary.failureCode, 'adapter_exception')
  assert.equal(r.record.failureSummary.detail, 'TypeError: receipt is undefined')
  assert.equal(r.record.failureSummary.phase, 'review')
  const diagnostic = r.record.metrics.find(m => m.source === 'managed_review_execution_failure')
  assert.equal(diagnostic.measurements.failureCode, 'adapter_exception')
  assert.equal(diagnostic.sourceSha256, r.record.failureSummary.sourceSha256)
  assert.equal(r.record.qualification.independentReviewStatus, undefined)
  assert.equal(r.record.independentReviewStatus, undefined)
  assert.equal(r.record.samples.length, 1)
  assert.equal(r.record.checkpoints.length, 3)
  assert.equal(r.record.metrics.filter(m => m.split === 'validation').length, 24)
  assert.equal(r.record.detailCoverage.availability.machineReview, 'not_recorded')
  assert.ok(!f.calls.some(p => p.includes('/dry-review/')))
})
test('original autonomous review failure has an exact package and review-phase binding', async () => {
  const f = fixture(); f.complete()
  Object.assign(f.options, { preciseReview: true, reviewFailure: true,
    changeFailure: failure => {
      for (const key of Object.keys(failure)) delete failure[key]
      Object.assign(failure, { schemaVersion: 'ai-painter-autonomous-closed-loop-terminal-v1',
        packageIdentity: f.worker.packageId, status: 'failed_closed', failureCode: 'adapter_exception',
        latestEvidence: { phase: 'review' }, finalResult: { status: 'failed', failureKind: 'program',
          failureCode: 'adapter_exception', detail: 'Original saved stack' } })
    } })
  const r = await f.run()
  assert.equal(r.record.failureSummary.detail, 'Original saved stack')
  assert.equal(r.record.reviewStatus, 'review_execution_failed_closed')
})
test('bound model audit rejection is separate from review program failure', async () => {
  const f = fixture(); f.complete()
  Object.assign(f.options, { preciseReview: true, review: true, audit: true,
    reviewStatus: 'dry_single_world_review_failed_closed' })
  const r = await f.run()
  assert.equal(r.record.reviewStatus, 'dry_single_world_review_failed_closed')
  assert.equal(r.record.failureSummary, null)
  assert.equal(r.record.independentReviewStatus, 'dry_single_world_review_failed_closed')
})
test('unbound wrapper error and absent audit/failure never invent a verdict or files', async () => {
  const f = fixture(); f.complete()
  Object.assign(f.options, { preciseReview: true, changePreciseWrapper: w => { w.error = 'Unbound claim'; w.checkpointReloadVerified = true } })
  const r = await f.run()
  assert.equal(r.record.failureSummary, null)
  assert.equal(r.record.reviewStatus, null)
  assert.equal(r.record.detailCoverage.availability.reviewFailure, 'not_recorded')
  assert.equal(r.record.samples.length, 0)
  assert.ok(!f.calls.some(p => p.includes('/dry-review/') || p.includes('/failure.json')))
})
test('precise primary wrapper rejects a foreign worker before reading its bytes', async () => {
  const f = fixture(); f.complete()
  Object.assign(f.options, { preciseReview: true, preciseAsTerminal: true,
    changePreciseWrapper: w => { w.workerTerminal = { ...w.workerTerminal, path: '.runtime/ai-painter/foreign/worker.json' } } })
  await assert.rejects(f.run, /history_managed_output_root_conflict/u)
  assert.ok(!f.calls.some(p => p.includes('/foreign/')))
})
test('missing bound failure retains available training and report with an explicit local gap', async () => {
  const f = fixture(); f.complete()
  Object.assign(f.options, { preciseReview: true, review: true, reviewFailure: true,
    changePreciseWrapper: w => { f.documents.delete(w.reviewFailure.path) } })
  const r = await f.run()
  assert.equal(r.record.detailCoverage.availability.reviewFailure, 'missing')
  assert.equal(r.record.failureSummary, null)
  assert.equal(r.record.reviewStatus, null)
  assert.equal(r.record.samples.length, 1)
  assert.equal(r.record.checkpoints.length, 1)
})
test('bound failure exceeding the existing 2MiB limit cannot supply a guessed reason', async () => {
  const f = fixture(); f.complete()
  Object.assign(f.options, { preciseReview: true, reviewFailure: true,
    changeFailure: failure => { failure.detail = 'x'.repeat(2 * 1024 * 1024) } })
  const r = await f.run()
  assert.equal(r.record.detailCoverage.availability.reviewFailure, 'over_limit')
  assert.equal(r.record.failureSummary, null)
  assert.equal(r.record.reviewStatus, null)
})
for (const [name, mutate, code] of [
  ['wrong Run', w => { w.runId = 'wrong' }, 'history_managed_identity_conflict'],
  ['wrong package', w => { w.packageId = 'wrong' }, 'history_managed_identity_conflict'],
  ['wrong capability', w => { w.capabilityVersion = 'wrong' }, 'history_managed_identity_conflict'],
  ['wrong package SHA', w => { w.executionPackage = { ...w.executionPackage, sha256: '0'.repeat(64) } }, 'history_managed_parent_conflict'],
  ['wrong worker SHA', w => { w.workerTerminal = { ...w.workerTerminal, sha256: '0'.repeat(64) } }, 'history_managed_parent_conflict'],
  ['wrong worker path', w => { w.workerTerminal = { ...w.workerTerminal, path: '.runtime/ai-painter/other/worker.json' } }, 'history_managed_parent_conflict'],
  ['wrong failure SHA', w => { w.reviewFailure.sha256 = '0'.repeat(64) }, 'history_sha_mismatch'],
  ['foreign failure', w => { w.reviewFailure.path = '.runtime/ai-painter/other/failure.json' }, 'history_managed_output_root_conflict'],
  ['foreign report', w => { w.reviewReport.path = '.runtime/ai-painter/other/report.json' }, 'history_managed_output_root_conflict'],
  ['foreign audit', w => { w.audit.path = '.runtime/ai-painter/other/audit.json' }, 'history_managed_output_root_conflict'],
  ['foreign recovery plan', w => { w.reviewRecoveryPlan.path = '.runtime/ai-painter/other/plan.json' }, 'history_managed_output_root_conflict'],
  ['traversal failure', w => { w.reviewFailure.path = '../failure.json' }, 'history_managed_binding_invalid'],
  ['success paired with program failure status', w => { w.executionState = 'completed' }, 'history_managed_review_terminal_state_conflict'],
  ['unknown status', w => { w.status = 'qualified' }, 'history_managed_review_terminal_state_conflict'],
]) test(`precise wrapper ${name} fails closed`, async () => {
  const f = fixture(); f.complete()
  Object.assign(f.options, { preciseReview: true, review: true, audit: true, reviewFailure: true, recoveryPlan: true, changePreciseWrapper: mutate })
  await assert.rejects(f.run, new RegExp(code, 'u'))
  if (name.startsWith('foreign')) assert.ok(!f.calls.some(p => p.includes('/other/')))
})
for (const [name, mutate, code] of [
  ['failure Run', v => { v.runId = 'other' }, 'history_managed_identity_conflict'],
  ['failure package', v => { v.packageId = 'other' }, 'history_managed_identity_conflict'],
  ['failure worker SHA', v => { v.workerTerminal = { ...v.workerTerminal, sha256: '0'.repeat(64) } }, 'history_managed_parent_conflict'],
  ['failure is a visual verdict', v => { v.failureKind = 'visual' }, 'history_managed_review_failure_conflict'],
  ['report Run', v => { v.runId = 'other' }, 'history_managed_identity_conflict'],
  ['report package', v => { v.packageId = 'other' }, 'history_managed_identity_conflict'],
  ['audit conflicts with claimed success', v => { v.status = 'dry_single_world_review_failed_closed' }, 'history_managed_review_status_conflict'],
]) test(`precise ${name} fails closed`, async () => {
  const f = fixture(); f.complete()
  Object.assign(f.options, { preciseReview: true, review: true, audit: true,
    reviewStatus: 'dry_single_world_numeric_passed_visual_approval_pending', reviewState: 'completed',
    auditStatus: 'dry_single_world_numeric_passed_visual_approval_pending' })
  if (name.startsWith('failure')) {
    Object.assign(f.options, { reviewStatus: 'review_execution_failed_closed', reviewState: 'failed_closed', reviewFailure: true, changeFailure: mutate })
  } else f.options[name.startsWith('report') ? 'changeReview' : 'changeAudit'] = mutate
  await assert.rejects(f.run, new RegExp(code, 'u'))
})
test('finalization without an explicit audit binding never guesses dry-review paths', async () => {
  const f = fixture(); f.complete(); f.options.finalization = true
  const result = await f.run()
  assert.equal(result.record.samples.length, 0)
  assert.equal(result.record.detailCoverage.availability.reviewReport, 'not_recorded')
  assert.ok(!f.calls.some(p => p.includes('/dry-review/')))
})
test('missing optimizer sides remain null rather than zero', async () => {
  const f = fixture(); delete f.worker.optimizerStepsDiscriminator; delete f.worker.optimizerSteps.discriminator
  assert.deepEqual((await f.run()).record.optimizerSteps, { generator: 475, discriminator: null })
})
test('genuine paired zero remains zero', async () => {
  const f = fixture(); Object.assign(f.worker, { optimizerStepsGenerator: 0, optimizerStepsDiscriminator: 0, completedEpochs: 0, optimizerSteps: { generator: 0, discriminator: 0 } })
  assert.deepEqual((await f.run()).record.optimizerSteps, { generator: 0, discriminator: 0 })
})
test('missing Checkpoint file is a per-item gap, not forgotten evidence', async () => {
  const f = fixture(); f.complete(); f.options.missingCheckpoint = true; const r = await f.run()
  assert.equal(r.record.artifacts.find(a => a.role === 'checkpoint').availability, 'missing')
  assert.equal(r.record.detailCoverage.availability.checkpoints, 'missing')
})
test('unknown terminal protocol retains existing unsupported partial fallback', async () => {
  const f = fixture(); f.worker.schema = 'future-managed-terminal-v9'
  const r = await f.run(); assert.equal(r.reasonCode, 'history_terminal_schema_unsupported')
  assert.equal(r.record.detailCoverage.supported, false)
})
test('unknown autonomous package stays supported-partial without guessing', async () => {
  const f = fixture(); const raw = { ...f.autonomous, schemaVersion: 'future-package-v9' }
  f.worker.executionPackage = f.bind(f.executionPackage.path, raw)
  const r = await f.run(); assert.equal(r.record.detailCoverage.availability.autonomousExecutionPackage, 'unsupported_schema')
})
for (const [name, change, error] of [
  ['wrong wrapper Run', f => { f.options.wrapper = true; f.options.changeWrapper = w => { w.runId = 'foreign-run' } }, 'history_managed_identity_conflict'],
  ['wrong package SHA', f => { f.worker.executionPackage.sha256 = '0'.repeat(64) }, 'history_sha_mismatch'],
  ['path traversal', f => { f.worker.executionPackage.path = '../foreign.json' }, 'history_managed_binding_invalid'],
  ['count exceeds plan', f => { f.worker.optimizerStepsGenerator = 9999; f.worker.optimizerSteps.generator = 9999 }, 'history_managed_plan_limit_conflict'],
  ['conflicting duplicate G count', f => { f.worker.optimizerSteps.generator = 474 }, 'history_managed_count_conflict'],
  ['foreign CP root', f => { f.complete(); f.cp.checkpoint.path = '.runtime/ai-painter/foreign/checkpoint.pt' }, 'history_managed_output_root_conflict'],
  ['foreign review sample', f => { f.complete(); f.options.review = true; f.options.changeReview = r => { r.subject.sampleId = 'foreign-sample' } }, 'history_managed_review_conflict'],
  ['foreign review worker SHA', f => { f.complete(); f.options.review = true; f.options.changeReview = r => { r.workerTerminal = { ...r.workerTerminal, sha256: '0'.repeat(64) } } }, 'history_managed_parent_conflict'],
]) test(`${name} fails closed`, async () => {
  const f = fixture(); change(f); await assert.rejects(f.run, new RegExp(error, 'u'))
})
test('real production failure detail is read-only and current registry unchanged', async () => {
  const before = await readCurrentExecutionRegistry(process.cwd())
  assert.equal(before.ok, true)
  const run = 'mvp256-dry-detail-weight-t47-20261008-0327-run'
  const result = await readTrainingRun(run)
  assert.equal(result.record.detailCoverage.adapter, 'detail_weight_managed_training_v1')
  assert.deepEqual(result.record.optimizerSteps, { generator: 475, discriminator: 476 })
  assert.equal(result.record.checkpoints.length, 0)
  assert.equal(result.record.samples.length, 0)
  const after = await readCurrentExecutionRegistry(process.cwd())
  assert.equal(after.registrySha256, before.registrySha256)
})
test('existing safe byte reader rejects stale SHA before using source content', async () => {
  const binding = {
    path: '.runtime/ai-painter/detail-weight-capture-managed-launch-t-q4-52/console/preparation.json',
    sha256: '700126401f42fa427ee330995d90a4f84db17ffbbd1c9af11a7b8f1d285b99b8',
  }
  assert.equal((await bytes(process.cwd(), binding.path, 2 * 1024 * 1024, binding.sha256)).sha256, binding.sha256)
  await assert.rejects(bytes(process.cwd(), binding.path, 2 * 1024 * 1024, '0'.repeat(64)), /history_sha_mismatch/u)
})
