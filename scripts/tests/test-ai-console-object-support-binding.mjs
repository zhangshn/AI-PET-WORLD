import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readBoundTrainingPresentation} from '../../src/server/ai-console/bound-training-presentation.mjs';
import {adaptLegacyTrainingDetail, readBoundIndependentTrainingReview} from '../../src/server/ai-console/training-history-detail-adapters.mjs';

// Synthetic JSON only: checkpoint/image bindings have no model or image bytes.
const hash = raw => createHash('sha256').update(raw).digest('hex');
const prefix = 'object-support-structure', now = Date.parse('2026-10-15T12:00:00Z');
const stamp = new Date(now - 1000).toISOString();
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-compat-console-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const outputRoot = '.runtime/ai-painter/object-support-structure-quality-executions/synthetic-run';
  const id = {runId:'synthetic-run', packageId:'synthetic-package',
    capabilityVersion:'stage4_mvp256_dry_object_support_structure_quality24_v1'};
  const docs = new Map(), calls = [], bind = (logical, value) => {
    const raw = Buffer.from(JSON.stringify(value)); docs.set(logical, raw); return {path:logical, sha256:hash(raw)};
  };
  const asset = name => ({path:`${outputRoot}/${name}`, sha256:hash(name)});
  const config = {schema:`${prefix}-quality-configuration-v1`, capabilityVersion:id.capabilityVersion,
    executionCeiling:{epochs:24, generatorOptimizerSteps:1152, discriminatorOptimizerSteps:1152},
    scope:{resolution:[256,192], subjectSampleId:'sample-1'},
    checkpointSelection:{eligibleEpochs:[24], observationOnlyEpochs:[12], validationRowsPerEligibleEpoch:8}};
  const plan = {...id, schema:`${prefix}-quality-plan-v1`, executionMode:'bounded-quality-training',
    executionProfile:'bounded_object_support_structure_quality24_v1', outputRoot, configuration:config};
  const envelope = {schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',
    packageIdentity:id.packageId, capabilityVersion:id.capabilityVersion, outputRoot};
  const cp = {epoch:24, checkpoint:asset('checkpoint.pt'), counts:{generator:1152, discriminator:1152},
    validation:Array.from({length:8}, (_, i) => ({sampleId:`sample-${i+1}`, split:'validation', epoch:24, fullRgbMae:.1}))};
  const worker = {...id, schema:`${prefix}-quality-worker-terminal-v1`, executionState:'completed',
    status:'training_completed_review_pending', completedEpochs:24, optimizerStepsGenerator:1152,
    optimizerStepsDiscriminator:1152, checkpoints:[cp], selectedCheckpointRecord:cp};
  const report = {...id, schema:`${prefix}-quality-native-review-input-v1`, selectedCheckpoint:cp.checkpoint,
    subject:{sampleId:'sample-1', split:'validation'}, originalRgb:asset('original.png'),
    candidateRgb:asset('candidate-1.png'), artifacts:Array.from({length:8}, (_, i) => asset(`candidate-${i+1}.png`))};
  report.validationImages = report.artifacts.map((binding, i) => ({sampleId:`sample-${i+1}`, split:'validation',
    epoch:24, optimizerStep:1152, purpose:'prediction', binding, checkpoint:cp.checkpoint}));
  const core = {...id, schema:`${prefix}-machine-audit-core-v1`, status:'dry_single_world_review_failed_closed',
    selectedCheckpoint:cp.checkpoint, detail:{passed:false}, aesthetic:{passed:true}, alignment:{passed:false},
    issueCodes:['tree_alignment_failed'], validationImprovedWithoutMeanRgbRegression:false};
  const audit = {...id, schema:`${prefix}-machine-audit-v1`, status:core.status, selectedCheckpoint:cp.checkpoint};
  const review = {...id, schema:`${prefix}-quality-review-terminal-v1`, status:core.status, executionState:'failed_closed'};
  const failure = {...id, schema:`${prefix}-review-failure-v1`, status:'review_execution_failed_closed',
    executionState:'failed_closed', error:'Error: synthetic review failure'};
  const observation = {...id, schemaVersion:'ai-painter-current-training-package-v1', outputRoot,
    resolution:[256,192], trainingPlan:{...config.executionCeiling, checkpointSelection:config.checkpointSelection},
    resourceBudget:{...config.executionCeiling}, observation:{progressPath:`${outputRoot}/progress.json`}};
  const lock = {...id, schemaVersion:'ai-painter-current-active-execution-lock-v1', processId:123, processStartIdentity:'synthetic:123'};
  const heartbeat = {...lock, schemaVersion:'ai-painter-current-active-execution-heartbeat-v1', executionState:'executing', heartbeatAtUtc:stamp};
  const progress = {...id, schemaVersion:'ai-painter-current-training-progress-v1', executionState:'executing',
    actualEpoch:13, completedEpochs:12, optimizerStepsGenerator:601, optimizerStepsDiscriminator:602, updatedAtUtc:stamp};
  const f = {root, outputRoot, id, docs, calls, bind, plan, config, envelope, observation, worker, cp, report,
    core, audit, review, failure, progress, lock, heartbeat, mode:'review', active:false,
    sync() {
      envelope.inputEvidence = [bind(`${outputRoot}/quality-plan.json`, plan), ...(this.extraInputs ?? [])];
      this.packageBinding = bind('.runtime/ai-painter/autonomous-closed-loop-packages/synthetic-package/package.json', envelope);
      for (const value of [worker, report, core, audit, review, failure]) value.executionPackage = this.packageBinding;
      this.workerBinding = bind(`${outputRoot}/worker-terminal.json`, worker);
      for (const value of [report, review, failure]) value.workerTerminal = this.workerBinding;
      this.reportBinding = bind(`${outputRoot}/dry-review/cpu-review.json`, report);
      core.input = this.reportBinding; audit.input = this.reportBinding;
      audit.core = bind(`${outputRoot}/dry-review/machine-audit-core.json`, core);
      review.audit = bind(`${outputRoot}/dry-review/machine-audit.json`, audit); review.reviewReport = this.reportBinding;
      observation.autonomousExecutionPackage = this.packageBinding;
      const observed = bind(`${outputRoot}/package.json`, observation);
      this.capsuleBinding = bind(`${outputRoot}/capsule.json`, {schemaVersion:'ai-painter-local-task-capsule-v1',
        integrity:{status:'verified'}, evidence:[observed]});
      this.terminal = this.mode === 'worker' ? worker : this.mode === 'failure' ? failure : review;
      this.terminalBinding = this.mode === 'worker' ? this.workerBinding
        : bind(`${outputRoot}/${this.mode === 'failure' ? 'dry-review-owned/review-failure' : 'finalization'}.json`, this.terminal);
      this.registry = {...id, packageSha256:this.terminalBinding.sha256, terminalEvidence:this.terminalBinding,
        activeExecution:this.active ? {...lock, executionState:'executing',
          lock:bind(`${outputRoot}/execution-lock.json`, lock), heartbeat:{path:`${outputRoot}/heartbeat.json`}} : null};
      bind(`${outputRoot}/heartbeat.json`, heartbeat); bind(`${outputRoot}/progress.json`, progress);
      return this;
    },
    async live() {
      for (const [logical, raw] of docs) {
        const file = path.join(root, logical); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, raw);
      }
      return readBoundTrainingPresentation(root, this.registry, {evidence:[this.packageBinding]}, this.terminal, {observedNow:now});
    },
    async history() {
      const record = {runId:id.runId, terminalBinding:this.terminalBinding, artifacts:[], samples:[], checkpoints:[], metrics:[], qualification:{}};
      return adaptLegacyTrainingDetail({runId:id.runId, terminal:this.terminal, record, base:{unavailableFields:['resolution','samples','checkpoints','metrics']},
        capsuleBinding:this.capsuleBinding,
        taskTerminalBinding:this.independentTaskBinding ?? (this.reviewAsTask ? bind(`${outputRoot}/finalization.json`, review) : undefined),
        readJson:async b => {
          calls.push(b.path); const raw = docs.get(b.path);
          if (!raw) throw Object.assign(Error('missing'), {code:'ENOENT'});
          assert.equal(hash(raw), b.sha256, 'history_sha_mismatch'); return JSON.parse(raw);
        }, readEvidenceJson:async (b, maximum) => {
          calls.push(b.path); const raw = docs.get(b.path);
          if (!raw) throw Object.assign(Error('missing'), {code:'ENOENT'});
          if (raw.length > maximum) throw Object.assign(Error('history_byte_limit'), {status:413});
          if (hash(raw) !== b.sha256) throw Error('history_sha_mismatch');
          return {value:JSON.parse(raw), byteLength:raw.length, sha256:hash(raw)};
        }, makeArtifact:(role, b, metadata) => ({role, logicalPath:b.path, sha256:b.sha256, ...metadata}),
        checkpointMetadata:async item => ({...item, byteLength:123}),
        requireFact:(ok, code) => { if (!ok) throw Error(code); }});
    }};
  return f.sync();
}

test('live new protocol projects 24/1152, refreshing unequal counts and terminal without new fields', async t => {
  const f = fixture(t); f.active = true; f.sync();
  const before = [...f.docs].map(([p, b]) => [p, hash(b)]), first = await f.live();
  assert.equal(first.availability, 'available'); assert.equal(first.targetEpochs, 24);
  assert.equal(first.targetOptimizerSteps, 1152); assert.equal(first.targetDiscriminatorOptimizerSteps, 1152);
  assert.equal(first.currentMetrics.optimizationStep, 601); assert.equal(first.currentMetrics.discriminatorOptimizerSteps, 602);
  assert.equal(first.completedEpochs, null); assert.equal(first.packageSha256, f.packageBinding.sha256);
  for (const [p, sha] of before) assert.equal(hash(fs.readFileSync(path.join(f.root, p))), sha);
  f.progress.optimizerStepsGenerator = 603; f.sync(); const next = await f.live();
  assert.equal(next.currentMetrics.optimizationStep, 603); assert.notEqual(next.currentMetrics.sourceSha256, first.currentMetrics.sourceSha256);
  f.active = false; f.sync(); const ended = await f.live();
  assert.equal(ended.completedEpochs, 24); assert.deepEqual(ended.actualOptimizerSteps, {generator:1152, critic:1152});
  assert.equal(ended.currentMetrics.reasonCode, 'active_execution_not_registered');
  f.plan.schema = 'ecology-terrain-detail-weight-quality-plan-v1';
  f.config.schema = 'ecology-terrain-detail-weight-quality-configuration-v2'; f.sync();
  assert.deepEqual(Object.keys(await f.live()).sort(), Object.keys(ended).sort());
});

for (const [name, change, code, metricsOnly] of [
  ['old configuration', f => { f.config.schema = 'ecology-terrain-detail-weight-quality-configuration-v2'; }, 'training_autonomous_configuration_schema_unsupported'],
  ['unknown plan', f => { f.plan.schema += '-unknown'; }, 'training_autonomous_plan_schema_unsupported'],
  ['foreign run', f => { f.plan.runId = 'foreign'; }, 'training_autonomous_plan_identity_conflict'],
  ['wrong mode', f => { f.plan.executionMode = 'managed-training'; }, 'training_autonomous_plan_schema_unsupported'],
  ['old observation limits', f => { f.observation.trainingPlan.epochs = 12; }, 'training_observation_plan_conflict'],
  ['over-limit G', f => { f.progress.optimizerStepsGenerator = 1153; }, 'training_progress_plan_limit_conflict', true],
  ['stale heartbeat', f => { f.heartbeat.heartbeatAtUtc = new Date(now - 15001).toISOString(); }, 'training_progress_heartbeat_stale_or_future', true],
]) test(`live rejects ${name}`, async t => {
  const f = fixture(t); f.active = true; change(f); f.sync(); const value = await f.live(), result = metricsOnly ? value.currentMetrics : value;
  assert.equal(result.availability, 'unavailable'); assert.equal(result.reasonCode, code);
});

test('history exposes only the eight bound images and core measurements, without granting qualification', async t => {
  const f = fixture(t), {record} = await f.history();
  assert.equal(record.detailCoverage.adapter, 'object_support_structure_quality_training_v1');
  assert.equal(record.targetEpochs, 24); assert.deepEqual(record.optimizerSteps, {generator:1152, discriminator:1152});
  assert.equal(record.selectedEpoch, 24); assert.equal(record.samples.length, 8); assert.equal(record.checkpoints.length, 1);
  assert.equal(record.checkpoints[0].metadataOnly, true); assert.equal(record.checkpoints[0].promotable, false);
  assert.equal(record.reviewStatus, f.core.status);
  const metrics = record.metrics.find(m => m.source === 'managed_machine_review');
  assert.deepEqual(metrics.measurements.issueCodes, ['tree_alignment_failed']);
  assert.equal(metrics.sourcePath, f.audit.core.path);
  for (let index=0; index<8; index++) assert.equal(record.samples[index].output.logicalPath, f.report.validationImages[index].binding.path);
  for (const flag of ['formalQualificationAllowed','worldEntryAllowed','checkpointPromotionEligible']) assert.equal(record.qualification[flag], false);
  assert.ok(f.calls.every(p => p.endsWith('.json')));
  f.mode = 'worker'; f.reviewAsTask = true; f.sync();
  const secondary = await f.history(); assert.equal(secondary.record.samples.length, 8);
  assert.equal(secondary.record.reviewStatus, f.core.status);
});

test('failed worker history retains partial unequal counts and invents no checkpoint or image', async t => {
  const f = fixture(t); f.mode = 'worker';
  Object.assign(f.worker, {executionState:'failed_closed', status:'failed_closed', completedEpochs:12,
    optimizerStepsGenerator:601, optimizerStepsDiscriminator:602, checkpoints:[]}); delete f.worker.selectedCheckpointRecord; f.sync();
  const {record} = await f.history(); assert.deepEqual(record.optimizerSteps, {generator:601, discriminator:602});
  assert.equal(record.samples.length, 0); assert.equal(record.checkpoints.length, 0); assert.equal(record.completedEpochs, 12);
});

test('direct new reviewFailure preserves original error and unknown classification', async t => {
  const f = fixture(t); f.mode = 'failure'; f.sync(); const {record} = await f.history();
  assert.equal(record.reviewStatus, 'review_execution_failed_closed'); assert.equal(record.failureSummary.detail, f.failure.error);
  assert.equal(record.failureSummary.failureCode, null); assert.equal(record.failureSummary.failureKind, null);
  assert.equal(record.failureSummary.sourcePath, f.terminalBinding.path); assert.equal(record.samples.length, 0);
});

for (const [name, change, code] of [
  ['foreign worker', f => { f.worker.runId = 'foreign'; }, 'history_managed_identity_conflict'],
  ['foreign core', f => { f.core.capabilityVersion = 'foreign'; }, 'history_managed_identity_conflict'],
  ['old core schema', f => { f.core.schema = 'ecology-terrain-detail-weight-machine-audit-core-v1'; }, 'history_managed_audit_schema_conflict'],
  ['mismatched core checkpoint', f => { f.core.selectedCheckpoint = {...f.cp.checkpoint, sha256:'f'.repeat(64)}; }, 'history_managed_parent_conflict'],
  ['mismatched core outcome', f => { f.core.status = 'dry_single_world_numeric_passed_visual_approval_pending'; }, 'history_managed_review_status_conflict'],
  ['duplicate image sample', f => { f.report.validationImages[1].sampleId = 'sample-1'; }, 'history_quality_image_identity_conflict'],
  ['foreign image root', f => { f.report.validationImages[1].binding.path = '.runtime/foreign.png'; }, 'history_managed_output_root_conflict'],
]) test(`history rejects ${name}`, async t => {
  const f = fixture(t); change(f); f.sync(); await assert.rejects(f.history(), error => error.message === code);
});

test('history refuses changed core bytes and leaves unknown report protocol partial', async t => {
  const f = fixture(t); f.docs.set(f.audit.core.path, Buffer.from('{}'));
  await assert.rejects(f.history(), /history_sha_mismatch/);
  f.report.schema = 'unknown-native-review-input-v1'; f.sync(); const result = await f.history();
  assert.equal(result.record.samples.length, 0); assert.equal(result.record.detailCoverage.availability.reviewReport, 'unsupported_schema');
});

test('new five-gradient capture exposes bound JSON only and refuses four-label metadata', async t => {
  const f = fixture(t); f.mode = 'worker';
  Object.assign(f.worker, {executionState:'failed_closed', status:'failed_closed', completedEpochs:12,
    optimizerStepsGenerator:601, optimizerStepsDiscriminator:602, checkpoints:[]}); delete f.worker.selectedCheckpointRecord;
  f.plan.programBindings = {worker:{path:'scripts/inert-worker.mjs', sha256:hash('inert')}};
  const graph = [{name:'synthetic.weight', shape:[1], elements:1, dtype:'torch.float32'}];
  const modelBinding = f.bind(`${f.outputRoot}/model-identity.json`, {...f.id,
    modelCapabilityVersion:'synthetic-model', architecture:'synthetic-graph', graph});
  f.extraInputs = [modelBinding]; f.sync();
  const position = {epoch:13, sampleId:'train-synthetic', trainIndex:0, zeroBasedEpochPosition:0};
  const source = {path:'data/synthetic-source.png', sha256:hash('source')};
  const condition = {path:'data/synthetic-condition.json', sha256:hash('condition')};
  const context = {runId:f.id.runId, executionPackage:f.packageBinding, modelBinding, failurePosition:position,
    optimizerSteps:{generator:601, discriminator:602}, programBindings:f.plan.programBindings,
    sampleBindings:{source, condition}, sampleId:position.sampleId, split:'train',
    sampleIdentity:{sampleId:position.sampleId, split:'train', image:source, conditionPack:condition}};
  const primaryError = {type:'ValueError', message:'synthetic gradient failure', messageSha256:hash('synthetic gradient failure')};
  const bound = (name, value) => { const b = f.bind(`${f.outputRoot}/${name}`, value); return {...b, bytes:f.docs.get(b.path).length}; };
  const executionBinding = bound('capture-execution.json', {schema:`${prefix}-failure-capture-execution-v1`,
    runId:f.id.runId, outputRoot:f.outputRoot, executionPackage:f.packageBinding, modelBinding});
  const primary = bound('gradient-failure/primary.json', {context, primaryError, timing:'after_exception'});
  const tensors = {path:`${f.outputRoot}/gradient-failure/tensors.pt`, sha256:hash('unread-tensors'), bytes:1024};
  const manifest = {schema:`${prefix}-gradient-failure-capture-v1`, status:'captured', missing:[], context, graph,
    labels:['actualTotal','structuredObjective','wholeFrameFidelity','objectCoreRgb','objectSupportStructure'],
    executionBinding, artifacts:{primary, tensors}};
  const receipt = {schema:manifest.schema, status:'captured', missing:[], primaryError,
    artifacts:{manifest:bound('gradient-failure/manifest.json', manifest), primary, tensors}};
  Object.assign(f.worker, {originalError:primaryError, failurePosition:position, captureReceipt:receipt,
    captureStatus:'captured', captureMissing:[]}); f.sync();
  const result = await f.history(), artifacts = result.record.artifacts;
  assert.deepEqual(artifacts.filter(a => a.evidenceKind?.startsWith('gradientFailure')).map(a => a.evidenceKind),
    ['gradientFailureManifest','gradientFailurePrimary']);
  assert.ok(!artifacts.some(a => a.logicalPath.endsWith('.pt'))); assert.ok(f.calls.every(p => p.endsWith('.json')));
  manifest.labels.pop(); receipt.artifacts.manifest = bound('gradient-failure/manifest.json', manifest); f.sync();
  const invalid = await f.history();
  assert.equal(invalid.record.detailCoverage.availability.artifacts, 'unsupported_schema');
  assert.ok(!invalid.record.artifacts.some(a => a.evidenceKind?.startsWith('gradientFailure')));
  assert.deepEqual(invalid.record.optimizerSteps, {generator:601, discriminator:602});
});

function independentFixture(t) {
  const f = fixture(t); f.mode = 'worker'
  const recoveryId = '00000000-0000-4000-8000-000000000005'
  const reviewRoot = `.runtime/ai-painter/controller-repair-reviews/independent-review-adoption-004-20261022/review-${recoveryId}`
  const images = Array.from({length:8}, (_, i) => ({ sampleId:`sample-${i+1}`, split:'validation', epoch:24,
    optimizerStep:1152, purpose:'prediction', checkpoint:f.cp.checkpoint,
    binding:{path:`${reviewRoot}/dry-review/${i}.png`, sha256:hash(`prediction-${i}`)},
    originalRgb:{path:`${f.outputRoot}/original-${i}.png`, sha256:hash(`reference-${i}`)},
    condition:{path:`${f.outputRoot}/condition-${i}.json`, sha256:hash(`condition-${i}`)} }))
  const splitBinding = f.bind('data/independent-fixture/validation.json', {schemaVersion:'ai-painter-stage4-source-correction-release-v1:membership', split:'validation', sampleIds:images.map(i=>i.sampleId)})
  const indexBinding = f.bind('data/independent-fixture/source-index.json', {schemaVersion:'ai-painter-stage4-source-correction-release-v1:source-index', samples:images.map(i=>({sampleId:i.sampleId,
    split:'validation', image:i.originalRgb, conditionPack:i.condition})) })
  f.plan.datasetManifest = f.bind('data/independent-fixture/manifest.json', {schemaVersion:'ai-painter-stage4-source-correction-release-v1', sourceIndex:indexBinding})
  f.plan.validationSplit = splitBinding; f.sync()
  const plan = {...f.id, schema:'completed-training-independent-review-v1', recoveryId, outputRoot:reviewRoot,
    sourceExecutionPackage:f.packageBinding, sourceTrainingPlan:f.envelope.inputEvidence[0],
    sourceWorkerTerminal:f.workerBinding, selectedCheckpoint:f.cp.checkpoint}
  const input = {...f.id, schema:`${prefix}-quality-native-review-input-v1`, executionPackage:f.packageBinding,
    workerTerminal:f.workerBinding, selectedCheckpoint:f.cp.checkpoint, validationImages:images,
    subject:{sampleId:'sample-1', split:'validation', referenceRgb:images[0].originalRgb, conditionPack:images[0].condition}}
  const core = {...f.core, executionPackage:f.packageBinding, selectedCheckpoint:f.cp.checkpoint, validationImages:images,
    visualApprovalGranted:false, formalStage4QualificationGranted:false, runtimePublicationGranted:false}
  const terminal = {...f.id, schema:plan.schema, executionState:'failed_closed', status:core.status,
    executionPackage:f.packageBinding, workerTerminal:f.workerBinding, selectedCheckpoint:f.cp.checkpoint}
  const seal = () => {
    core.input = f.bind(`${reviewRoot}/dry-review/cpu-review.json`, input)
    terminal.core = f.bind(`${reviewRoot}/dry-review/machine-audit-core.json`, core)
    terminal.reviewRecoveryPlan = f.bind(`${reviewRoot}/plan.json`, plan)
    f.independentTaskBinding = f.bind(`${reviewRoot}/finalization.json`, terminal)
    return f.independentTaskBinding
  }
  const read = async b => {
    const raw = f.docs.get(b.path); if (!raw) throw Object.assign(Error('missing'), {code:'ENOENT'})
    assert.equal(hash(raw), b.sha256, 'fixture_sha_conflict'); return JSON.parse(raw)
  }
  seal()
  return {...f, f, plan, input, core, terminal, images, seal, read, reviewRoot,
    verify: () => readBoundIndependentTrainingReview({terminal, terminalBinding:f.independentTaskBinding,
      runId:f.id.runId, workerBinding:f.workerBinding, readJson:read})}
}

test('independent review uses explicit own root, eight source associations and no invented audit wrapper', async t => {
  const s = independentFixture(t), verified = await s.verify()
  assert.equal(verified.core.status, 'dry_single_world_review_failed_closed')
  assert.equal(verified.jsonReads, 9)
  const {record} = await s.f.history()
  assert.equal(record.reviewStatus, s.core.status); assert.equal(record.samples.length, 8)
  assert.equal(record.completedEpochs, 24)
  assert.deepEqual(record.optimizerSteps, {generator:1152, discriminator:1152})
  assert.equal(record.qualification.formalQualificationAllowed, false)
  assert.ok(!record.artifacts.some(item => item.logicalPath.endsWith('/machine-audit.json')))
  for (const [i, sample] of record.samples.entries()) {
    assert.equal(sample.output.logicalPath, s.images[i].binding.path)
    assert.equal(sample.original, null)
    assert.equal(sample.sourceOriginal.logicalPath, s.images[i].originalRgb.path)
    assert.equal(sample.condition.logicalPath, s.images[i].condition.path)
  }
})
for (const [name, change, expected] of [
  ['foreign Run', s => {s.core.runId='foreign'}, /identity_conflict/],
  ['foreign package', s => {s.plan.packageId='foreign'}, /identity_conflict/],
  ['foreign capability', s => {s.input.capabilityVersion='foreign'}, /input_conflict/],
  ['wrong original worker SHA', s => {s.terminal.workerTerminal={...s.terminal.workerTerminal,sha256:'f'.repeat(64)}}, /parent_conflict/],
  ['wrong execution package', s => {s.plan.sourceExecutionPackage={...s.plan.sourceExecutionPackage,sha256:'f'.repeat(64)}}, /parent_conflict/],
  ['wrong selected Checkpoint', s => {s.core.selectedCheckpoint={...s.core.selectedCheckpoint,sha256:'f'.repeat(64)}}, /parent_conflict/],
  ['another review root', s => {s.plan.outputRoot += '-other'}, /root_conflict/],
  ['arbitrary controller directory', s => {s.plan.outputRoot='.runtime/ai-painter/controller-repair-reviews/other'}, /root_conflict/],
  ['unknown plan schema', s => {s.plan.schema+='-unknown'}, /root_conflict/],
  ['unknown core schema', s => {s.core.schema+='-unknown'}, /core_conflict/],
  ['path traversal', s => {s.images[0].binding.path=s.reviewRoot+'/../foreign.png'}, /binding_invalid/],
  ['foreign prediction root', s => {s.images[0].binding.path=s.f.outputRoot+'/foreign.png'}, /root_conflict/],
  ['prediction used as original', s => {s.images[0].originalRgb=s.images[0].binding}, /parent_conflict/],
  ['wrong condition', s => {s.images[0].condition=s.images[1].condition}, /parent_conflict/],
  ['duplicate sample', s => {s.images[1].sampleId=s.images[0].sampleId}, /image_identity_conflict/],
  ['duplicate prediction', s => {s.images[1].binding=s.images[0].binding}, /image_identity_conflict/],
  ['training split', s => {s.images[0].split='train'}, /image_identity_conflict/],
  ['wrong epoch', s => {s.images[0].epoch=12}, /image_identity_conflict/],
  ['wrong optimizer step', s => {s.images[0].optimizerStep=576}, /image_identity_conflict/],
  ['missing image', s => {s.images.pop()}, /image_coverage_conflict/],
  ['qualification promoted', s => {s.core.runtimePublicationGranted=true}, /core_conflict/],
]) test(`independent review rejects ${name}`, async t => {
  const s = independentFixture(t); change(s); s.seal()
  await assert.rejects(s.verify, expected)
  await assert.rejects(()=>s.f.history(), expected)
})
test('independent review rejects changed bound core bytes; missing evidence preserves completed training fields', async t => {
  const s = independentFixture(t), binding = s.terminal.core
  s.f.docs.set(binding.path, Buffer.from('{}'))
  await assert.rejects(s.verify, /sha_conflict/)
  await assert.rejects(()=>s.f.history(), /history_sha_mismatch/)
  s.f.docs.delete(binding.path)
  const detail = await s.f.history()
  assert.equal(detail.record.completedEpochs, 24)
  assert.deepEqual(detail.record.optimizerSteps, {generator:1152, discriminator:1152})
  assert.equal(detail.record.detailCoverage.availability.machineReview, 'missing')
  assert.equal(detail.record.samples.length, 0)
})
