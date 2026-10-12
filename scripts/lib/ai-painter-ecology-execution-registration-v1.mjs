// Read-only protocol sidecar. No dispatch, registry writes, load_package,
// tensor loading, CPU/GPU qualification, checkpoint eligibility or release.
// Pure APIs take {plan, planBinding, packageBinding, modelBinding, modelIdentity}.
// verifyBindings additionally rechecks the explicit files, without certifying
// their semantics. The existing registry remains the live process authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CAPABILITY = 'stage4_mvp256_dry_factorized_ecology_v1';
export const PLAN_SCHEMA = 'ecology-regime-managed-plan-v1';
export const EXECUTION_PROFILE = 'factorized_ecology_execution_v1';
export const ARCHITECTURE = 'fresh_detail_precision_four_heads_independent_season_ecology_training_v1';
export const NUMERIC_RULE = 'fp32_native_biased_conv_native_input_weight_vjp_fp64_bias_reduce_device_v1|fp32_native_biased_detail_conv_native_input_bias_vjp_fp64_unfold_matmul_weight_once_fp32_v1';
export const HEARTBEAT_SECONDS = 120;
export const COMPONENT_CPU_ACCEPTANCE = Object.freeze({
  path:'.runtime/ai-painter/ecology-lifecycle-cpu-t-q4-70/real/acceptance.json',
  sha256:'e5aa46e733b907eeaaec2678e595ce9ecf3750d85e8dd1ff01ad8a982e3e79cc',
});
const OUTPUT_ROOT = '.runtime/ai-painter/ecology-regime-managed-executions';
const PACKAGE_ROOT = '.runtime/ai-painter/autonomous-closed-loop-packages';
const SHA = /^[a-f0-9]{64}$/u;
const ACTIVE_STATES = ['preflight', 'executing', 'validating', 'reviewing', 'adjudicating', 'finalizing'];
const FIRST = 'core.core.appearance.base.layers.0';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const need = (condition, code) => { if (!condition) throw new Error(`ecology_registration_${code}`); };
const object = value => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function logicalPath(value) {
  need(typeof value === 'string' && value.length <= 1024 && !/[\\:\x00-\x1f]/u.test(value)
    && !path.posix.isAbsolute(value) && value.split('/').every(p => p && p !== '.' && p !== '..'), 'path_invalid');
  return value;
}
function binding(value) {
  need(object(value) && Object.keys(value).sort().join(',') === 'path,sha256', 'binding_invalid');
  logicalPath(value.path);
  need(typeof value.sha256 === 'string' && SHA.test(value.sha256), 'sha256_invalid');
}
function same(actual, expected, code) {
  try { assert.deepStrictEqual(actual, expected); } catch { throw new Error(`ecology_registration_${code}`); }
}
function digest(value, code) { need(typeof value === 'string' && SHA.test(value), code); }
function model(value) {
  need(object(value), 'model_missing');
  need(value.capabilityVersion === CAPABILITY && value.architecture === ARCHITECTURE
    && value.numericRule === NUMERIC_RULE, 'model_identity_mismatch');
  need(Array.isArray(value.graph) && value.graph.length === 108, 'complete108_graph_required');
  const names = new Set(); let elements = 0;
  for (const row of value.graph) {
    need(object(row) && typeof row.name === 'string' && /^[A-Za-z0-9_.]+$/u.test(row.name)
      && !names.has(row.name), 'parameter_identity_invalid');
    need(Array.isArray(row.shape) && row.shape.length <= 8
      && row.shape.every(n => Number.isSafeInteger(n) && n > 0), 'parameter_shape_invalid');
    const count = row.shape.reduce((a, b) => a * b, 1);
    need(Number.isSafeInteger(row.elements) && row.elements === count, 'parameter_elements_invalid');
    names.add(row.name); elements += count;
  }
  need(elements === 2242687, 'complete108_elements_required');
  same(value.graph.find(r => r.name === `${FIRST}.ecology_branch.weight`)?.shape,
    [32, 7, 3, 3], 'ecology_branch_missing');
  same(value.graph.find(r => r.name === `${FIRST}.season_branch.weight`)?.shape,
    [32, 4, 3, 3], 'season_branch_missing');
  need(value.graph.filter(r => r.name.startsWith('object_rgb_heads.')).length === 16, 'four_head_identity_missing');
  need(object(value.initialState), 'initial_state_missing');
  digest(value.initialState.generator, 'initial_generator_state_invalid');
  digest(value.initialState.discriminator, 'initial_discriminator_state_invalid');
}

/** Shape and binding consistency only; returns a detached copy, never authority. */
export function validate(input) {
  need(object(input) && object(input.plan), 'input_invalid');
  const {plan, planBinding, packageBinding, modelBinding, modelIdentity} = input;
  need(plan.schema === PLAN_SCHEMA && plan.executionProfile === EXECUTION_PROFILE
    && plan.capabilityVersion === CAPABILITY && plan.executionMode === 'managed-training', 'plan_identity_mismatch');
  same(plan.componentCpuAcceptance, COMPONENT_CPU_ACCEPTANCE, 'component_cpu_binding_mismatch');
  need(plan.historicalCheckpointMayInitialize === false && plan.trainingRestartAllowed === false,
    'plan_restart_forbidden');
  need(!Object.hasOwn(plan, 'resourcePolicy') && !Object.hasOwn(plan, 'effectiveExecutionCeiling'),
    'resource_successor_not_authenticated');
  for (const key of ['runId', 'packageId']) need(typeof plan[key] === 'string'
    && /^[a-z0-9][a-z0-9-]{7,127}$/u.test(plan[key]), `${key}_invalid`);
  need(plan.runId !== plan.packageId, 'run_package_collision');
  need(plan.outputRoot === `${OUTPUT_ROOT}/${plan.runId}`, 'output_root_mismatch');
  for (const item of [planBinding, packageBinding, modelBinding]) binding(item);
  need(planBinding.path === `${plan.outputRoot}/ecology-plan.json`, 'plan_binding_path_invalid');
  need(packageBinding.path === `${PACKAGE_ROOT}/${plan.packageId}/package.json`, 'package_binding_path_invalid');
  same(plan.modelBinding, modelBinding, 'model_binding_mismatch');
  model(modelIdentity);
  need(object(plan.programBindings) && Object.keys(plan.programBindings).length > 0
    && Object.keys(plan.programBindings).length <= 256, 'program_bindings_missing');
  for (const [role, item] of Object.entries(plan.programBindings)) {
    need(/^[A-Za-z0-9._-]{1,80}$/u.test(role)
      && !['__proto__', 'prototype', 'constructor'].includes(role), 'program_role_invalid');
    binding(item);
  }
  const configuration = plan.configuration;
  need(object(configuration) && configuration.capabilityVersion === CAPABILITY, 'configuration_identity_mismatch');
  same(configuration.scope?.resolution, [256, 192], 'resolution_mismatch');
  const ceiling = configuration.executionCeiling;
  need(object(ceiling), 'execution_ceiling_missing');
  for (const [key, expected] of Object.entries({epochs:48, generatorOptimizerSteps:2304,
    discriminatorOptimizerSteps:2304, cpuThreads:2, trainingAttempts:1, automaticRetries:0,
    maxWallSeconds:2700, maxGpuMemoryFraction:0.7, maximumTemperatureC:85,
    minimumFreeVramMiB:2048, minimumFreeDiskMiB:2048, maxOutputMiB:128})) {
    need(typeof ceiling[key] === 'number' && Number.isFinite(ceiling[key])
      && ceiling[key] === expected, `ceiling_${key}_invalid`);
  }
  same(configuration.checkpointSelection?.eligibleEpochs, [24, 36, 48], 'selection_epochs_invalid');
  need(configuration.historicalCheckpointMayInitialize === false
    && configuration.automaticResumeAllowed === false && configuration.freshInitializationOnly === true,
  'fresh_initialization_required');
  return structuredClone({plan, planBinding, packageBinding, modelBinding, modelIdentity});
}

/** Existing ai-console observation schema; carries zero execution eligibility. */
export function createPresentation(input) {
  const {plan, packageBinding, modelBinding} = validate(input);
  return {schemaVersion:'ai-painter-current-training-package-v1',
    capabilityVersion:CAPABILITY, runId:plan.runId, packageId:plan.packageId,
    outputRoot:plan.outputRoot, resolution:[256, 192],
    trainingPlan:{epochs:48, generatorOptimizerSteps:2304, discriminatorOptimizerSteps:2304,
      checkpointSelection:plan.configuration.checkpointSelection},
    resourceBudget:plan.configuration.executionCeiling,
    observation:{progressPath:`${plan.outputRoot}/progress.json`},
    autonomousExecutionPackage:packageBinding, modelBinding, observationOnly:true,
    cpuQualified:false, gpuQualified:false, trainingAllowed:false, checkpointPromotable:false,
    formalStage4QualificationAllowed:false, runtimePublicationAllowed:false,
    productionExecutionAuthenticated:false};
}

/** Registry-shaped identity. Liveness alone supplies no training state or eligibility. */
export function createActiveIdentity(input, execution) {
  const {plan} = validate(input);
  need(object(execution), 'execution_invalid');
  for (const key of ['runId', 'packageId', 'capabilityVersion']) {
    need(execution[key] === plan[key], `active_${key}_mismatch`);
  }
  need(ACTIVE_STATES.includes(execution.executionState), 'active_state_required');
  need(Number.isSafeInteger(execution.processId) && execution.processId > 0
    && execution.processId <= 0x7fffffff, 'pid_invalid');
  need(typeof execution.processStartIdentity === 'string' && execution.processStartIdentity.length > 0
    && execution.processStartIdentity.length <= 1024
    && execution.processStartIdentity === execution.processStartIdentity.trim(), 'process_start_invalid');
  binding(execution.lock);
  need(execution.lock.path === `${plan.outputRoot}/execution-lock.json`, 'lock_root_mismatch');
  same(execution.programBindings, plan.programBindings, 'active_lineage_mismatch');
  same(execution.heartbeat, {path:`${plan.outputRoot}/heartbeat.json`, ttlSeconds:HEARTBEAT_SECONDS}, 'heartbeat_mismatch');
  return {schemaVersion:'ai-painter-current-active-execution-v1', capabilityVersion:CAPABILITY,
    runId:plan.runId, packageId:plan.packageId, executionState:execution.executionState,
    processId:execution.processId, processStartIdentity:execution.processStartIdentity,
    programLineage:structuredClone(plan.programBindings), lock:structuredClone(execution.lock),
    heartbeat:structuredClone(execution.heartbeat)};
}

// Minimal safe immutable reads. Only the established F: runtime mount may leave
// the checkout. Other junctions/symlinks, including in a fixture, fail closed.
function readBinding(projectRoot, item) {
  binding(item);
  const root = fs.realpathSync(projectRoot);
  let current = root;
  const parts = item.path.split('/');
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const meta = fs.lstatSync(current);
    if (meta.isSymbolicLink()) {
      const registered = i === 0 && parts[i] === '.runtime' && process.platform === 'win32'
        && root.toLowerCase() === path.resolve('F:/ai-pet-world').toLowerCase()
        && fs.realpathSync(current).toLowerCase() === path.resolve('D:/AI-PET-WORLD-DATA/hot/runtime').toLowerCase();
      need(registered, 'unregistered_link');
    }
    current = fs.realpathSync(current);
  }
  const descriptor = fs.openSync(current, 'r');
  try {
    const before = fs.fstatSync(descriptor);
    need(before.isFile() && before.size <= 2 * 1024 ** 2, 'file_size_or_type_invalid');
    const bytes = Buffer.alloc(before.size + 1);
    let used = 0;
    while (used < bytes.length) {
      const count = fs.readSync(descriptor, bytes, used, bytes.length - used, used);
      if (!count) break;
      used += count;
    }
    const after = fs.fstatSync(descriptor), live = fs.statSync(current);
    need(used === before.size && after.size === before.size && after.mtimeMs === before.mtimeMs
      && live.ino === before.ino && live.dev === before.dev && live.size === before.size
      && live.mtimeMs === before.mtimeMs
      && fs.realpathSync(path.resolve(projectRoot, item.path)) === current, 'file_changed');
    const raw = bytes.subarray(0, used);
    need(hash(raw) === item.sha256, 'file_sha256_mismatch');
    return raw;
  } finally { fs.closeSync(descriptor); }
}

/** Explicit closure byte verification, still not load_package or qualification. */
export function verifyBindings(projectRoot, input) {
  const checked = validate(input);
  same(JSON.parse(readBinding(projectRoot, checked.planBinding)), checked.plan, 'bound_plan_mismatch');
  same(JSON.parse(readBinding(projectRoot, checked.modelBinding)), checked.modelIdentity, 'bound_model_mismatch');
  const pkg = JSON.parse(readBinding(projectRoot, checked.packageBinding));
  need(pkg.schemaVersion === 'ai-painter-autonomous-closed-loop-package-v1'
    && pkg.packageIdentity === checked.plan.packageId && pkg.capabilityVersion === CAPABILITY
    && pkg.outputRoot === checked.plan.outputRoot, 'bound_package_identity_mismatch');
  if (Object.hasOwn(pkg, 'runId')) need(pkg.runId === checked.plan.runId, 'bound_package_run_mismatch');
  same(pkg.programLineage, Object.fromEntries(Object.entries(checked.plan.programBindings)
    .map(([role, item]) => [role, item.sha256])), 'bound_package_lineage_mismatch');
  for (const item of [checked.planBinding, checked.modelBinding, COMPONENT_CPU_ACCEPTANCE]) {
    need(Array.isArray(pkg.inputEvidence) && pkg.inputEvidence.some(b => b.path === item.path
      && b.sha256 === item.sha256), 'package_input_binding_missing');
  }
  for (const item of Object.values(checked.plan.programBindings)) readBinding(projectRoot, item);
  // Recheck the whole closure at the boundary; there is no cached qualification.
  for (const item of [checked.planBinding, checked.modelBinding, checked.packageBinding, COMPONENT_CPU_ACCEPTANCE,
    ...Object.values(checked.plan.programBindings)]) readBinding(projectRoot, item);
  return checked;
}
