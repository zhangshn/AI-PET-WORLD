import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import { bytes as readSafeBytes } from './training-history-safe-bytes.mjs';
import {readBoundTrainingInterface} from './training-preview-history-v1.mjs';
import {OBSERVATION_CONTRACT, OBSERVATION_PROGRESS, OBSERVATION_SCOPE, observationContract, observationCounts,
  observationClock, sameBinding, publicObservationTiming} from './training-observation-contract.mjs';
import {readObservationRecord,readInterruptedObservation} from './training-observation-history.mjs';
import {readLegacySingleMapPresentation} from './single-map-training-history.mjs';

const PACKAGE_SCHEMA = 'ai-painter-learning-capacity-experiment-package-v1';
const DRY_PACKAGE = /^ai-painter-stage4-mvp256-dry-v\d+(?:-v\d+)?-execution-package-v1$/u;
const OBSERVATION_SCHEMA = 'ai-painter-current-training-package-v1';
const AUTONOMOUS_SCHEMA = 'ai-painter-autonomous-closed-loop-package-v1';
// A plan protocol must have verified field semantics; capability names do not
// select behavior, and a matching filename/schema suffix grants no compatibility.
const AUTONOMOUS_PLAN_PROTOCOLS = new Map([
  ['ecology-plan.json', {schema:'ecology-regime-managed-plan-v1', mode:'managed-training',
    configuration:'ecology-regime-managed-configuration-v1'}],
  ['failure-capture-plan.json', {schema:'ecology-regime-failure-capture-plan-v1', mode:'bounded-failure-capture',
    configuration:'ecology-regime-failure-capture-configuration-v1'}],
  ['quality-plan.json', [
    {schema:'ecology-regime-quality-plan-v1', mode:'bounded-quality-training',
      configuration:'ecology-regime-quality-configuration-v1'},
    {schema:'ecology-decode1-weight-quality-plan-v1', mode:'bounded-quality-training',
      configuration:'ecology-decode1-weight-quality-configuration-v1'},
    {schema:'ecology-terrain-detail-weight-quality-plan-v1', mode:'bounded-quality-training',
      configuration:['ecology-terrain-detail-weight-quality-configuration-v1',
        'ecology-terrain-detail-weight-quality-configuration-v2']},
    {schema:'object-support-structure-quality-plan-v1', mode:'bounded-quality-training',
      configuration:'object-support-structure-quality-configuration-v1'},
  ]],
]);
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const positive = v => Number.isSafeInteger(v) && v > 0 ? v : null;
const count = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
const string = v => typeof v === 'string' && v.length > 0 ? v : null;
const empty = (runId, reasonCode) => ({availability:'unavailable', reasonCode, runId,
  scope:null, resolution:null, targetEpochs:null, targetOptimizerSteps:null, completedEpochs:null,
  actualOptimizerSteps:null, errorCode:null, packagePath:null, packageSha256:null, currentMetrics:null});

const need = (condition, code) => { if (!condition) throw new Error(code); };
async function json(root, binding, maximum = MAX_PACKAGE_BYTES) {
  need(record(binding) && typeof binding.path === 'string' && /^[a-f0-9]{64}$/u.test(binding.sha256), 'training_package_binding_invalid');
  const logical = binding.path.replaceAll('\\', '/');
  need(!path.posix.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical) && !logical.split('/').includes('..'), 'training_package_binding_invalid');
  try {
    const bytes = await readSafeBytes(root, logical, maximum, binding.sha256);
    return {value:JSON.parse(bytes.value.toString('utf8')), path:logical, sha256:bytes.sha256};
  } catch (error) {
    const mapped = {history_byte_limit:'training_package_size_limit', history_sha_mismatch:'training_package_sha256_mismatch',
      history_unregistered_mount:'training_package_boundary_violation', history_symlink_escape:'training_package_boundary_violation',
      history_path_outside_root:'training_package_binding_invalid'};
    throw new Error(mapped[error.message] ?? error.message);
  }
}

// Walk only explicit, authenticated lifecycle links. Never enumerate directories.
async function executionPackage(root, registry, capsule, terminal) {
  const direct = capsule.evidence.filter(b => record(b) && typeof b.path === 'string'
    && /\/(?:package|execution-package)\.json$/u.test(b.path.replaceAll('\\', '/')));
  need(direct.length <= 1, 'training_package_binding_unavailable');
  if (direct.length === 1) return json(root, direct[0]);
  let node = terminal;
  for (let depth = 0; depth < 3 && record(node); depth++) {
    need(node.runId === registry.runId, 'training_package_run_mismatch');
    if (record(node.executionPackage)) return json(root, node.executionPackage);
    if (!record(node.trainingTerminal)) break;
    node = (await json(root, node.trainingTerminal)).value;
  }
  throw new Error('training_package_binding_unavailable');
}

function unavailableMetrics(runId, reasonCode) {
  return {availability:'unavailable', reasonCode, runId, processId:null, processStartIdentity:null,
    phase:null, epoch:null, optimizationStep:null, discriminatorOptimizerSteps:null,
    loss:null, learningRate:null, batchIndex:null, batchCount:null, throughputSamplesPerSecond:null,
    estimatedCompletionAtUtc:null, checkpointIdentity:null, reportedAtUtc:null, heartbeatAtUtc:null,
    sourcePath:null, sourceSha256:null, progressTtlSeconds:120, sourceIdentity:'current_registry_bound_progress_v1'};
}
function recent(timestamp, now, ttlMs, code) {
  const instant = typeof timestamp === 'string' && timestamp.endsWith('Z') ? Date.parse(timestamp) : NaN;
  need(Number.isFinite(instant) && now - instant >= 0 && now - instant <= ttlMs, code);
}
function identity(value, registry, code) {
  need(record(value) && value.runId === registry.runId && value.packageId === registry.packageId
    && value.capabilityVersion === registry.capabilityVersion, code);
}
async function currentMetrics(root, registry, pkg, binding, plan, observedNow) {
  const absent = reason => unavailableMetrics(registry.runId, reason);
  if (!registry.activeExecution) return absent('active_execution_not_registered');
  try {
    const active = registry.activeExecution;
    identity(active, registry, 'training_progress_active_identity_conflict');
    need(active.executionState === 'executing', 'training_progress_active_phase_not_training');
    const outputRoot = pkg.outputRoot;
    need(typeof outputRoot === 'string' && outputRoot === path.posix.dirname(binding.path)
      && outputRoot.startsWith('.runtime/ai-painter/'), 'training_progress_output_root_conflict');
    const logical = pkg.schemaVersion === OBSERVATION_SCHEMA ? pkg.observation?.progressPath : `${outputRoot}/progress.json`;
    need(logical === `${outputRoot}/progress.json`, 'training_progress_path_conflict');
    need(active.heartbeat?.path === `${outputRoot}/heartbeat.json`
      && active.lock?.path === `${outputRoot}/execution-lock.json`, 'training_progress_active_binding_conflict');
    const lock = (await json(root, active.lock, 65536)).value;
    identity(lock, registry, 'training_progress_lock_identity_conflict');
    need(positive(active.processId) && string(active.processStartIdentity)
      && lock.schemaVersion === 'ai-painter-current-active-execution-lock-v1'
      && lock.processId === active.processId && lock.processStartIdentity === active.processStartIdentity,
      'training_progress_lock_process_conflict');
    const heartbeatRead = await readSafeBytes(root, active.heartbeat.path, 65536);
    const heartbeat = JSON.parse(heartbeatRead.value.toString('utf8'));
    identity(heartbeat, registry, 'training_progress_heartbeat_identity_conflict');
    need(heartbeat.schemaVersion === 'ai-painter-current-active-execution-heartbeat-v1'
      && heartbeat.processId === active.processId && heartbeat.processStartIdentity === active.processStartIdentity
      && heartbeat.executionState === active.executionState, 'training_progress_heartbeat_process_conflict');
    const progressRead = await readSafeBytes(root, logical, 65536);
    const value = JSON.parse(progressRead.value.toString('utf8'));
    identity(value, registry, 'training_progress_identity_conflict');
    const common = pkg.interfaceContract?.schemaVersion === OBSERVATION_CONTRACT;
    const schema = common ? OBSERVATION_PROGRESS : pkg.schemaVersion === OBSERVATION_SCHEMA ? 'ai-painter-current-training-progress-v1'
      : pkg.schemaVersion.replace('-execution-package-', '-progress-');
    need(value.schemaVersion === schema, 'training_progress_schema_unsupported');
    need(['executing','validating','completed','failed_closed','checkpoint_selected_review_pending'].includes(value.executionState),
      'training_progress_phase_unsupported');
    const epochs = common ? null : count(value.completedEpochs), epoch = common ? null : count(value.actualEpoch);
    const g = count(common ? value.optimizerSteps?.generator : value.optimizerStepsGenerator);
    const d = count(common ? value.optimizerSteps?.discriminator : value.optimizerStepsDiscriminator);
    if (common) {
      need(value.processId === active.processId && value.processStartIdentity === active.processStartIdentity,
        'training_progress_process_conflict');
      observationCounts(value.optimizerSteps, observationContract(pkg, registry.runId));
      need(sameBinding(value.executionPackage, binding), 'training_progress_package_conflict');
      observationClock(value.workerTiming, OBSERVATION_SCOPE, {partial:true});
      need(['loading','zero_update_gpu','training','checkpoint'].includes(value.phase),'training_progress_operation_phase_unsupported');
    }
    need(g !== null && d !== null && (common || epochs !== null && epoch !== null
      && epochs <= epoch && epoch <= plan.epochs && g <= plan.generatorOptimizerSteps
      && d <= plan.discriminatorOptimizerSteps), 'training_progress_plan_limit_conflict');
    const now = observedNow ?? Date.now();
    recent(heartbeat.heartbeatAtUtc, now, 15000, 'training_progress_heartbeat_stale_or_future');
    recent(value.updatedAtUtc, now, 120000, 'training_progress_stale_or_future');
    return {...absent(null), availability:'available', processId:active.processId,
      processStartIdentity:active.processStartIdentity,
      phase:common ? value.phase==='checkpoint'?'validating':value.phase==='training'&&(g>0||d>0)?'executing':'preparing'
        :value.executionState === 'checkpoint_selected_review_pending' ? 'completed' : value.executionState,
      epoch, optimizationStep:g, discriminatorOptimizerSteps:d, reportedAtUtc:value.updatedAtUtc,
      heartbeatAtUtc:heartbeat.heartbeatAtUtc, sourcePath:logical, sourceSha256:progressRead.sha256,
      ...(common ? {workerExecutionTiming:publicObservationTiming({workerTiming:value.workerTiming}, {path:logical,sha256:progressRead.sha256})} : {})};
  } catch (error) { return absent(error.message ?? 'training_progress_unavailable'); }
}

async function readManagedPresentation(root, registry, pkgRead, terminal, options) {
  const pkg = pkgRead.value, runId = registry.runId;
  identity(pkg, registry, 'training_package_run_mismatch');
  need(typeof pkg.outputRoot === 'string' && pkg.outputRoot === path.posix.dirname(pkgRead.path)
    && pkg.outputRoot.startsWith('.runtime/ai-painter/'), 'training_package_output_root_conflict');
  const plan = pkg.trainingPlan;
  need(record(plan) && positive(plan.epochs) && positive(plan.generatorOptimizerSteps)
    && positive(plan.discriminatorOptimizerSteps), 'training_plan_fields_unavailable');
  if (record(pkg.resourceBudget)) for (const key of ['epochs','generatorOptimizerSteps','discriminatorOptimizerSteps'])
    need(pkg.resourceBudget[key] === plan[key], 'training_plan_budget_conflict');
  let resolution = pkg.resolution;
  if (DRY_PACKAGE.test(pkg.schemaVersion)) {
    const candidate = (await json(root, pkg.sourceDataCandidate)).value;
    need(candidate.schemaVersion === 'stage4-mvp256-dry-v24-closed-loop-candidate-v1', 'training_source_candidate_schema_unsupported');
    resolution = candidate.scope?.resolution;
  }
  need(Array.isArray(resolution) && resolution.length === 2 && positive(resolution[0]) && positive(resolution[1]),
    'training_resolution_unavailable');
  let final = terminal;
  for (let depth = 0; depth < 3 && record(final?.trainingTerminal); depth++) {
    need(final.runId === runId, 'training_package_run_mismatch');
    final = (await json(root, final.trainingTerminal)).value;
  }
  if (record(final)) need(final.runId === runId, 'training_package_run_mismatch');
  const ended = !registry.activeExecution && final?.runId === runId;
  let worker = null;
  if (ended && record(final.workerTerminal)) worker = (await json(root, final.workerTerminal)).value;
  if (worker) identity(worker, registry, 'training_worker_terminal_identity_conflict');
  const epochs = ended ? count(worker?.completedEpochs ?? final.completedEpochs) : null;
  const generator = ended ? count(worker?.optimizerStepsGenerator ?? final.optimizerStepsGenerator) : null;
  const critic = ended ? count(worker?.optimizerStepsDiscriminator ?? final.optimizerStepsDiscriminator) : null;
  need(epochs === null || epochs <= plan.epochs, 'training_terminal_epoch_limit_conflict');
  need((generator === null || generator <= plan.generatorOptimizerSteps)
    && (critic === null || critic <= plan.discriminatorOptimizerSteps), 'training_terminal_step_limit_conflict');
  return {availability:'available', reasonCode:null, runId, scope:'bounded_local_training',
    resolution:{width:resolution[0],height:resolution[1]}, targetEpochs:plan.epochs,
    targetOptimizerSteps:plan.generatorOptimizerSteps, targetDiscriminatorOptimizerSteps:plan.discriminatorOptimizerSteps,
    completedEpochs:epochs, actualOptimizerSteps:generator !== null && critic !== null ? {generator,critic} : null,
    errorCode:ended ? string(final.errorCode) : null, packagePath:pkgRead.path, packageSha256:pkgRead.sha256,
    currentMetrics:await currentMetrics(root, registry, pkg, pkgRead, plan, options.observedNow)};
}

// The autonomous envelope and its one same-output-root plan are immutable SHA
// bindings. The runner's fixed observation surface is NOT another signed input:
// rehash its bounded current bytes, check its backlink and every projected plan
// value, and never use its eligibility flags. No directory/name-based discovery.
async function readAutonomousPresentation(root, registry, envelopeRead, terminal, options) {
  const envelope = envelopeRead.value;
  need(envelope.packageIdentity === registry.packageId && envelope.capabilityVersion === registry.capabilityVersion,
    'training_autonomous_package_identity_conflict');
  // The current registry writer uses packageSha256 for terminalEvidence bytes,
  // not the autonomous container. Its verified capsule supplies that distinct
  // container binding; never compare two digests with different provenance.
  if (record(registry.terminalEvidence))
    need(registry.packageSha256 === registry.terminalEvidence.sha256, 'training_registry_terminal_sha256_conflict');
  const outputRoot = envelope.outputRoot;
  need(typeof outputRoot === 'string' && outputRoot.startsWith('.runtime/ai-painter/')
    && !outputRoot.includes('\\') && !outputRoot.split('/').some(p => !p || p === '.' || p === '..'),
    'training_package_output_root_conflict');
  need(Array.isArray(envelope.inputEvidence) && envelope.inputEvidence.length > 0
    && envelope.inputEvidence.length <= 128, 'training_autonomous_plan_binding_unavailable');
  // Locate only registered plan paths among explicit bindings. Other metadata in
  // this directory is not a plan and is not opened by this presentation reader.
  const plans = envelope.inputEvidence.filter(b => record(b) && typeof b.path === 'string'
    && [...AUTONOMOUS_PLAN_PROTOCOLS.keys()].some(name => b.path === `${outputRoot}/${name}`));
  need(plans.length === 1, 'training_autonomous_plan_binding_unavailable');
  const planRead = await json(root, plans[0]), plan = planRead.value;
  const registered = AUTONOMOUS_PLAN_PROTOCOLS.get(path.posix.basename(plans[0].path));
  const protocol = (Array.isArray(registered) ? registered : [registered])
    .find(candidate => record(plan) && plan.schema === candidate.schema);
  need(record(plan) && protocol
    && plan.executionMode === protocol.mode, 'training_autonomous_plan_schema_unsupported');
  identity(plan, registry, 'training_autonomous_plan_identity_conflict');
  need(plan.outputRoot === outputRoot, 'training_package_output_root_conflict');
  need([protocol.configuration].flat().includes(plan.configuration?.schema),
    'training_autonomous_configuration_schema_unsupported');
  need(plan.configuration.capabilityVersion === registry.capabilityVersion,
    'training_autonomous_plan_identity_conflict');
  await readBoundTrainingInterface({envelope,plan,parent:registry,
    readJson:async(binding,maximum)=>(await json(root,binding,maximum)).value});
  const ceiling = plan.configuration?.executionCeiling, resolution = plan.configuration?.scope?.resolution;
  need(record(ceiling) && ['epochs','generatorOptimizerSteps','discriminatorOptimizerSteps'].every(k => positive(ceiling[k])),
    'training_plan_fields_unavailable');
  need(Array.isArray(resolution) && resolution.length === 2 && resolution.every(positive), 'training_resolution_unavailable');
  const observationPath = `${outputRoot}/package.json`;
  const observedBytes = await readSafeBytes(root, observationPath, MAX_PACKAGE_BYTES);
  const observation = JSON.parse(observedBytes.value.toString('utf8'));
  need(record(observation) && observation.schemaVersion === OBSERVATION_SCHEMA,
    'training_observation_package_schema_unsupported');
  identity(observation, registry, 'training_observation_package_identity_conflict');
  need(observation.outputRoot === outputRoot, 'training_package_output_root_conflict');
  need(record(observation.autonomousExecutionPackage)
    && observation.autonomousExecutionPackage.path === envelopeRead.path
    && observation.autonomousExecutionPackage.sha256 === envelopeRead.sha256,
    'training_observation_package_backlink_conflict');
  need(isDeepStrictEqual(observation.resolution, resolution), 'training_observation_resolution_conflict');
  need(record(observation.trainingPlan)
    && ['epochs','generatorOptimizerSteps','discriminatorOptimizerSteps'].every(k => observation.trainingPlan[k] === ceiling[k])
    && isDeepStrictEqual(observation.resourceBudget, ceiling)
    && isDeepStrictEqual(observation.trainingPlan.checkpointSelection, plan.configuration.checkpointSelection),
    'training_observation_plan_conflict');
  need(observation.observation?.progressPath === `${outputRoot}/progress.json`, 'training_progress_path_conflict');
  const presentation = await readManagedPresentation(root, registry,
    {value:observation, path:observationPath, sha256:observedBytes.sha256}, terminal, options);
  // Public package provenance remains the authenticated autonomous envelope.
  // The observed surface digest must not masquerade as an upstream signed SHA.
  return {...presentation, packagePath:envelopeRead.path, packageSha256:envelopeRead.sha256};
}

// The caller must first verify the current registry, process, lineage and transaction.
// Only its authenticated package chain may identify a mutable observation surface.
export async function readBoundTrainingPresentation(projectRoot, registry, capsule, terminal, options = {}) {
  const runId = string(registry?.runId);
  try {
    if (!runId || !record(capsule) || !Array.isArray(capsule.evidence)) return empty(runId, 'training_package_not_bound');
    const managed = await executionPackage(projectRoot, registry, capsule, terminal);
    const legacySingle=await readLegacySingleMapPresentation({pkg:managed.value,packageBinding:managed,registry,terminal,
      readJson:async b=>(await json(projectRoot,b)).value});
    if(legacySingle)return legacySingle;
    if (managed.value?.interfaceContract?.schemaVersion === OBSERVATION_CONTRACT) {
      const pkg = managed.value, c = observationContract(pkg, runId);
      need(pkg.outputRoot === path.posix.dirname(managed.path), 'training_package_output_root_conflict');
      const plan = {epochs:null, generatorOptimizerSteps:c.optimizerStepCeiling.generator,
        discriminatorOptimizerSteps:c.optimizerStepCeiling.discriminator};
      const current = await currentMetrics(projectRoot, registry, pkg, managed, plan, options.observedNow);
      let final = null, interrupted = null, observationGap = null;
      if (!registry.activeExecution && terminal?.executionPackage) {
        need(sameBinding(terminal.executionPackage, managed), 'training_observation_package_conflict');
        const readJson=async b=>(await json(projectRoot,b,512*1024)).value;
        try { final = (await readObservationRecord({pkg,packageBinding:managed,runId,terminal,readJson})).value; }
        catch {
          observationGap='training_observation_evidence_unavailable';
          try { interrupted=await readInterruptedObservation({pkg,packageBinding:managed,runId,terminal,readJson}); } catch { /* Remain unknown. */ }
        }
      }
      return {availability:'available',reasonCode:observationGap,runId,scope:'protocol_observed_training',observationContractVersion:2,
        resolution:{width:c.resolution[0],height:c.resolution[1]},targetEpochs:null,
        targetOptimizerSteps:plan.generatorOptimizerSteps,targetDiscriminatorOptimizerSteps:plan.discriminatorOptimizerSteps,
        completedEpochs:null,actualOptimizerSteps:final?{generator:final.optimizerSteps.generator,critic:final.optimizerSteps.discriminator}:null,errorCode:terminal?.errorCode??null,
        packagePath:managed.path,packageSha256:managed.sha256,currentMetrics:current,
        workerExecutionTiming:final?publicObservationTiming(final,terminal.trainingObservation):interrupted?.workerExecutionTiming??current.workerExecutionTiming??null};
    }
    if (managed.value?.schemaVersion === AUTONOMOUS_SCHEMA)
      return await readAutonomousPresentation(projectRoot, registry, managed, terminal, options);
    if (DRY_PACKAGE.test(managed.value?.schemaVersion) || managed.value?.schemaVersion === OBSERVATION_SCHEMA)
      return await readManagedPresentation(projectRoot, registry, managed, terminal, options);
    if (record(managed.value)&&Object.hasOwn(managed.value,'interfaceContract'))
      return empty(runId,'training_observation_contract_unsupported');
    const bindings = capsule.evidence.filter(b => record(b) && typeof b.path === 'string'
      && b.path.replaceAll('\\', '/').endsWith('/package.json'));
    if (bindings.length !== 1) return empty(runId, 'training_package_binding_unavailable');
    const binding = bindings[0], logical = binding.path.replaceAll('\\', '/');
    if (!/^[a-f0-9]{64}$/u.test(binding.sha256) || path.posix.isAbsolute(logical)
      || /^[A-Za-z]:/u.test(logical) || logical.split('/').includes('..')) throw new Error('training_package_binding_invalid');
    let bytes;
    try { bytes = (await readSafeBytes(projectRoot, logical, MAX_PACKAGE_BYTES, binding.sha256)).value; }
    catch (error) {
      const mapped = {history_byte_limit:'training_package_size_limit', history_sha_mismatch:'training_package_sha256_mismatch',
        history_unregistered_mount:'training_package_boundary_violation', history_symlink_escape:'training_package_boundary_violation',
        history_path_outside_root:'training_package_binding_invalid'};
      throw new Error(mapped[error.message] ?? error.message);
    }
    const pkg = JSON.parse(bytes.toString('utf8'));
    if (!record(pkg) || pkg.schemaVersion !== PACKAGE_SCHEMA || pkg.evidenceContractVersion !== 1)
      return empty(runId, 'training_package_schema_unsupported');
    if (pkg.experimentIdentity !== runId) throw new Error('training_package_run_mismatch');
    const training = record(pkg.training) ? pkg.training : {};
    const resolution = Array.isArray(pkg.resolution) && pkg.resolution.length === 2
      && positive(pkg.resolution[0]) && positive(pkg.resolution[1])
      ? {width:pkg.resolution[0], height:pkg.resolution[1]} : null;
    const targetEpochs = positive(training.epochs);
    const targetOptimizerSteps = positive(training.maxGeneratorOptimizerSteps);
    const targetCriticSteps = positive(training.maxDiscriminatorOptimizerSteps);
    const ended = registry.activeExecution == null && record(terminal) && terminal.runId === runId;
    const steps = ended && record(terminal.actualFinalOptimizerSteps) ? terminal.actualFinalOptimizerSteps : null;
    const generator = count(steps?.generator), critic = count(steps?.discriminator);
    if (generator !== null && targetOptimizerSteps !== null && generator > targetOptimizerSteps)
      throw new Error('training_terminal_step_limit_conflict');
    if (critic !== null && targetCriticSteps !== null && critic > targetCriticSteps)
      throw new Error('training_terminal_step_limit_conflict');
    const complete = ended ? count(terminal.completedEpochs) : null;
    if (complete !== null && targetEpochs !== null && complete > targetEpochs)
      throw new Error('training_terminal_epoch_limit_conflict');
    return {availability:'available', reasonCode:resolution && targetEpochs && targetOptimizerSteps ? null : 'training_plan_fields_unavailable',
      runId, scope:string(pkg.scope), resolution, targetEpochs, targetOptimizerSteps,
      completedEpochs:complete, actualOptimizerSteps:generator !== null && critic !== null ? {generator, critic} : null,
      errorCode:ended ? string(terminal.errorCode) : null,
      packagePath:logical, packageSha256:binding.sha256};
  } catch (error) {
    return empty(runId, error instanceof Error ? error.message : 'training_presentation_unavailable');
  }
}
