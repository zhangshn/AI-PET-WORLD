import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readCurrentExecutionRegistry } from '../src/server/ai-painter-current-execution-registry.mjs';
import { projectRoot } from './lib/ai-pet-world-storage.mjs';
import { launchAutonomousClosedLoopBackground, BACKGROUND_LAUNCH_ROOT } from './lib/ai-painter-autonomous-background-launcher-v1.mjs';
import { validateClosedLoopPackage, PHASES, CLOSED_LOOP_ROOT, CURRENT_ENTRYPOINT_REGISTRY_PATH } from './lib/ai-painter-autonomous-closed-loop-v1.mjs';
import { localOperatorRequest, submitOwnedStopIntent } from './lib/ai-painter-owned-stop-native-control-v1.mjs';
import { readOwnedStopProjectFile, resolveOwnedStopProjectDirectory, validateOwnedStopInput, STOP_REQUEST_LIMITS, ownedStopSourceFileMaximum } from './lib/ai-painter-owned-stop-request-v1.mjs';
import {registeredTrainingInterfaces} from './lib/ai-painter-decode1-entry-weight-quality-registration-v1.mjs';

export const LOCAL_CONTROL_PROTOCOL = 'ai-painter-local-control-v1';
export const LOCAL_CONTROL_CAPABILITY = 'stage4_mvp256_dry_factorized_ecology_quality_v1';
export const LOCAL_CONTROL_ADAPTER = 'scripts/run-ai-painter-ecology-quality-v1.mjs';
export const LOCAL_CONTROL_PLAN_SCHEMA = 'ecology-regime-quality-plan-v1';
export const LOCAL_CONTROL_OUTPUT_ROOT = '.runtime/ai-painter/ecology-regime-quality-executions';
export const LOCAL_CONTROL_ENTRY = 'scripts/run-ai-painter-local-control-v1.mjs';
export const LOCAL_CONTROL_REGISTRATION = Object.freeze({ entryId: LOCAL_CONTROL_PROTOCOL,
  entryFile: LOCAL_CONTROL_ENTRY, role: 'fixed_local_start_status_stop_v1', protocol: LOCAL_CONTROL_PROTOCOL,
  capabilityVersion: LOCAL_CONTROL_CAPABILITY, adapterFile: LOCAL_CONTROL_ADAPTER,
  commands: Object.freeze(['start', 'status', 'stop']) });
export const LOCAL_DECODE1_CONTROL_REGISTRATION = Object.freeze({...LOCAL_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-ecology-decode1-quality-v1',
 capabilityVersion:'stage4_mvp256_dry_factorized_ecology_decode1_weight_precision_quality_v1',
 adapterFile:'scripts/run-ai-painter-ecology-decode1-quality-v1.mjs'});
export const LOCAL_TERRAIN_DETAIL_CONTROL_REGISTRATION = Object.freeze({...LOCAL_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-ecology-terrain-detail-quality-v1',
 capabilityVersion:'stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_quality24_v1',
 adapterFile:'scripts/run-ai-painter-ecology-terrain-detail-quality-v1.mjs'});
export const LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION = Object.freeze({...LOCAL_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-object-support-structure-quality-v1',
 capabilityVersion:'stage4_mvp256_dry_object_support_structure_quality24_v1',
 adapterFile:'scripts/run-ai-painter-object-support-structure-quality-v1.mjs'});
export const LOCAL_FINAL_RGB_CONTROL_REGISTRATION=Object.freeze({...LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-final-rgb-base-weight-quality-v1',
 capabilityVersion:'stage4_mvp256_dry_final_rgb_base_weight_quality24_v1'});
export const LOCAL_JOINT_CONTROL_REGISTRATION=Object.freeze({...LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-joint-object-priority-quality-v1',
 capabilityVersion:'stage4_mvp256_dry_joint_object_priority_quality24_v1'});
export const LOCAL_DECODE1_ENTRY_WEIGHT_CONTROL_REGISTRATION=Object.freeze({...LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-decode1-entry-weight-quality-v1',
 capabilityVersion:'stage4_mvp256_dry_decode1_entry_weight_quality24_v1',
 adapterFile:'scripts/run-ai-painter-decode1-entry-weight-quality-v1.mjs'});
export const LOCAL_DECODE1_ENTRY_COMPLETION_CONTROL_REGISTRATION=Object.freeze({...LOCAL_DECODE1_ENTRY_WEIGHT_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-decode1-entry-weight-quality-completion-v1',
 capabilityVersion:'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1'});
export const LOCAL_DECODE1_ENTRY_COMPLETION_V2_CONTROL_REGISTRATION=Object.freeze({...LOCAL_DECODE1_ENTRY_COMPLETION_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-decode1-entry-weight-quality-completion-v2',
 capabilityVersion:'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2'});
export const LOCAL_DECODE1_ENTRY_SAME_CALL_CONTROL_REGISTRATION=Object.freeze({...LOCAL_DECODE1_ENTRY_COMPLETION_V2_CONTROL_REGISTRATION,
 entryId:'ai-painter-local-control-v1-decode1-entry-weight-quality-same-call-v1',
 capabilityVersion:'stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1'});
const CONTROL_ROUTES=Object.freeze([
 Object.freeze({registration:LOCAL_DECODE1_ENTRY_SAME_CALL_CONTROL_REGISTRATION,
  capability:LOCAL_DECODE1_ENTRY_SAME_CALL_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_DECODE1_ENTRY_SAME_CALL_CONTROL_REGISTRATION.adapterFile,
  planSchema:'object-support-structure-quality-plan-v1',outputRoot:'.runtime/ai-painter/decode1-entry-weight-quality-same-call-v1-executions'}),
 Object.freeze({registration:LOCAL_CONTROL_REGISTRATION,capability:LOCAL_CONTROL_CAPABILITY,adapter:LOCAL_CONTROL_ADAPTER,planSchema:LOCAL_CONTROL_PLAN_SCHEMA,outputRoot:LOCAL_CONTROL_OUTPUT_ROOT}),
 Object.freeze({registration:LOCAL_DECODE1_ENTRY_WEIGHT_CONTROL_REGISTRATION,
  capability:LOCAL_DECODE1_ENTRY_WEIGHT_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_DECODE1_ENTRY_WEIGHT_CONTROL_REGISTRATION.adapterFile,
  planSchema:'object-support-structure-quality-plan-v1',outputRoot:'.runtime/ai-painter/decode1-entry-weight-quality-executions'}),
 Object.freeze({registration:LOCAL_DECODE1_ENTRY_COMPLETION_CONTROL_REGISTRATION,
  capability:LOCAL_DECODE1_ENTRY_COMPLETION_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_DECODE1_ENTRY_COMPLETION_CONTROL_REGISTRATION.adapterFile,
  planSchema:'object-support-structure-quality-plan-v1',outputRoot:'.runtime/ai-painter/decode1-entry-weight-quality-completion-executions'}),
 Object.freeze({registration:LOCAL_DECODE1_ENTRY_COMPLETION_V2_CONTROL_REGISTRATION,
  capability:LOCAL_DECODE1_ENTRY_COMPLETION_V2_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_DECODE1_ENTRY_COMPLETION_V2_CONTROL_REGISTRATION.adapterFile,
  planSchema:'object-support-structure-quality-plan-v1',outputRoot:'.runtime/ai-painter/decode1-entry-weight-quality-completion-v2-executions'}),
 Object.freeze({registration:LOCAL_DECODE1_CONTROL_REGISTRATION,capability:LOCAL_DECODE1_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_DECODE1_CONTROL_REGISTRATION.adapterFile,
  planSchema:'ecology-decode1-weight-quality-plan-v1',outputRoot:'.runtime/ai-painter/ecology-decode1-weight-quality-executions'}),
 Object.freeze({registration:LOCAL_TERRAIN_DETAIL_CONTROL_REGISTRATION,capability:LOCAL_TERRAIN_DETAIL_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_TERRAIN_DETAIL_CONTROL_REGISTRATION.adapterFile,
  planSchema:'ecology-terrain-detail-weight-quality-plan-v1',outputRoot:'.runtime/ai-painter/ecology-terrain-detail-weight-quality-executions'}),
 Object.freeze({registration:LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION,capability:LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION.adapterFile,
  planSchema:'object-support-structure-quality-plan-v1',outputRoot:'.runtime/ai-painter/object-support-structure-quality-executions'}),
 Object.freeze({registration:LOCAL_FINAL_RGB_CONTROL_REGISTRATION,capability:LOCAL_FINAL_RGB_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_FINAL_RGB_CONTROL_REGISTRATION.adapterFile,
  planSchema:'object-support-structure-quality-plan-v1',outputRoot:'.runtime/ai-painter/final-rgb-base-weight-quality-executions'}),
 Object.freeze({registration:LOCAL_JOINT_CONTROL_REGISTRATION,capability:LOCAL_JOINT_CONTROL_REGISTRATION.capabilityVersion,adapter:LOCAL_JOINT_CONTROL_REGISTRATION.adapterFile,
  planSchema:'object-support-structure-quality-plan-v1',outputRoot:'.runtime/ai-painter/joint-object-priority-quality-executions'})]);
function controlRoute(capability,root=process.cwd()){
 const legacy=CONTROL_ROUTES.find(r=>r.capability===capability);if(legacy)return legacy;
 const profile=registeredTrainingInterfaces(root).find(r=>r.CAPABILITY===capability);need(profile,'local_unknown_capability_or_retries');
 return {capability,adapter:'scripts/run-ai-painter-decode1-entry-weight-quality-v1.mjs',
  planSchema:'object-support-structure-quality-plan-v1',outputRoot:profile.OUTPUT_ROOT,interfacePolicy:profile.EXECUTION_POLICY};
}
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
const need = (v, c) => { if (!v) throw Error(c); };
const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const validOutputRoot = (value,route=CONTROL_ROUTES[0]) => typeof value === 'string' && value.startsWith(route.outputRoot + '/') &&
  /^[a-z0-9][a-z0-9-]{7,127}$/u.test(value.slice(route.outputRoot.length + 1));

export function parseLocalControlArguments(args) {
  need(Array.isArray(args) && args.every(v => typeof v === 'string'), 'local_arguments_invalid');
  if (args.length === 1 && args[0] === '--help') return { help: true };
  need(args[0] === '--protocol' && args[1] === LOCAL_CONTROL_PROTOCOL, 'local_protocol_required');
  const command = args[2]; need(['start', 'status', 'stop'].includes(command), 'local_command_invalid');
  if (command !== 'start') { need(args.length === 3, 'local_arguments_not_allowed'); return { command }; }
  need(args.length === 7 && args[3] === '--package' && args[5] === '--package-sha256', 'local_start_arguments_invalid');
  need(typeof args[4] === 'string' && /^\.runtime\/ai-painter\/autonomous-closed-loop-packages\/[a-z0-9][a-z0-9-]{7,127}\/package\.json$/u.test(args[4]), 'local_package_path_invalid');
  need(/^[a-f0-9]{64}$/u.test(args[6]), 'local_package_sha_invalid');
  return { command, packagePath: args[4], packageSha256: args[6] };
}

function readJson(root, name) { return JSON.parse(readOwnedStopProjectFile(root, name).toString('utf8')); }
function registered(root,route=CONTROL_ROUTES[0]) {
  if(route.interfacePolicy){const current=controlRoute(route.capability,root);
    need(JSON.stringify(current)===JSON.stringify(route),'local_interface_registration_changed');return;}
  const expected=route.registration;
  const index = readJson(root, CURRENT_ENTRYPOINT_REGISTRY_PATH);
  need(index.schemaVersion === 'ai-painter-current-entrypoint-registry-v1' && index.status === 'active' &&
    Array.isArray(index.currentEntrypoints) && Array.isArray(index.localControlEntrypoints), 'local_entrypoint_registry_invalid');
  const entries = index.localControlEntrypoints.filter(v => plain(v) && v.entryId === expected.entryId);
  need(entries.length === 1 && Object.keys(entries[0]).length === Object.keys(expected).length &&
    Object.entries(expected).every(([k, v]) => k === 'commands'
      ? Array.isArray(entries[0][k]) && entries[0][k].length === v.length && v.every((command, i) => entries[0][k][i] === command)
      : entries[0][k] === v), 'local_capability_entry_not_registered');
}

export function validateLocalStartPackage(root, command) {
  need(command.command === 'start', 'local_start_command_required');
  const bytes = readOwnedStopProjectFile(root, command.packagePath);
  need(hash(bytes) === command.packageSha256, 'local_package_sha_mismatch');
  const spec = JSON.parse(bytes.toString('utf8'));
  const route=controlRoute(spec.capabilityVersion,root);registered(root,route);
  need(spec.maxInfrastructureRecoveryAttempts === 0, 'local_unknown_capability_or_retries');
  need(command.packagePath === `.runtime/ai-painter/autonomous-closed-loop-packages/${spec.packageIdentity}/package.json`, 'local_package_identity_mismatch');
  for (const phase of PHASES) need(spec.phaseAdapters?.[phase]?.path === route.adapter &&
    spec.phaseAdapters[phase].exportName === phase, 'local_arbitrary_adapter_rejected');
  const lineage = Object.keys(spec.programLineage ?? {});
  need(lineage.length > 0 && lineage.length <= ownedStopSourceFileMaximum(root,spec), 'local_source_count_limit');
  need(Array.isArray(spec.inputEvidence) && spec.inputEvidence.length > 0 && spec.inputEvidence.length <= 64, 'local_input_evidence_limit');
  const inputs = spec.inputEvidence.map(b => {
    const value = readOwnedStopProjectFile(root, b.path); need(hash(value) === b.sha256, 'local_input_sha_mismatch');
    return { binding: b, value: b.path.endsWith('.json') ? JSON.parse(value.toString('utf8')) : null };
  });
  const plans = inputs.filter(({ value }) => value?.schema === route.planSchema);
  need(plans.length === 1, 'local_exact_quality_plan_required');
  const plan = plans[0].value;
  need(plan.capabilityVersion === route.capability && plan.packageId === spec.packageIdentity &&
    plan.outputRoot === spec.outputRoot && validOutputRoot(plan.outputRoot,route) &&
    plan.outputRoot.endsWith(`/${plan.runId}`), 'local_quality_plan_identity_mismatch');
  const bindings = plan.programBindings;
  need(plain(bindings) && Object.keys(bindings).sort().join(',') === lineage.sort().join(','), 'local_source_roles_mismatch');
  let total = 0;
  for (const [role, b] of Object.entries(bindings)) {
    need(plain(b) && b.sha256 === spec.programLineage[role], 'local_source_binding_mismatch');
    const source = readOwnedStopProjectFile(root, b.path); total += source.length;
    need(total <= STOP_REQUEST_LIMITS.sourceTotalBytes && hash(source) === b.sha256, 'local_source_bytes_or_sha_mismatch');
  }
  for (const required of [LOCAL_CONTROL_ENTRY, route.adapter,
    'scripts/lib/ai-painter-owned-stop-native-control-v1.mjs', 'scripts/lib/ai-painter-owned-stop-request-v1.mjs',
    'scripts/lib/ai-painter-owned-stop-handoff-v1.mjs', 'scripts/lib/ai-painter-owned-stop-execution-bridge-v1.mjs',
    'src/server/ai-console-control/operator-session.ts'])
    need(Object.values(bindings).some(b => b.path === required), 'local_control_source_not_frozen');
  validateClosedLoopPackage(spec, { root, packageSha256: command.packageSha256 });
  return { spec, plan };
}

async function run(command, body, root, reader, launcher, fixture = false) {
  need(typeof root === 'string' && path.isAbsolute(root), 'local_absolute_root_required');
  if (command.command === 'status') {
    const current = await reader(root);
    return { protocol: LOCAL_CONTROL_PROTOCOL, command: 'status', readOnly: true,
      readerTrust: fixture ? 'unverified_isolated_test_reader' : 'official_reader', current };
  }
  need(plain(body), 'local_authenticated_body_required');
  localOperatorRequest(body.credentials);
  if (command.command === 'stop') {
    need(Object.keys(body).sort().join(',') === 'credentials,input', 'local_stop_body_fields');
    const input = validateOwnedStopInput(body.input), current = await reader(root);
    need(current?.ok === true && current.status === 'verified', 'local_current_registry_unverified');
    const registry = current.registry, active = registry.activeExecution;
    const route=controlRoute(registry.capabilityVersion);registered(root,route);
    need(plain(active) && registry.executionState === 'executing' && active.executionState === 'executing', 'local_no_active_execution');
    need(registry.capabilityVersion === route.capability && registry.registryRevision === input.expectedRegistryRevision &&
      registry.runId === input.runId && registry.packageId === input.packageId && active.runId === input.runId &&
      active.packageId === input.packageId && active.processId === input.supervisorProcessId &&
      active.processStartIdentity === input.supervisorProcessStartIdentity, 'local_stop_target_mismatch');
    const bytes = readOwnedStopProjectFile(root, input.executionPackagePath);
    need(hash(bytes) === input.executionPackageSha256, 'local_stop_package_sha_mismatch');
    const spec = JSON.parse(bytes.toString('utf8'));
    need(spec.packageIdentity === input.packageId && spec.capabilityVersion === route.capability &&
      validOutputRoot(spec.outputRoot,route) &&
      spec.outputRoot.endsWith(`/${input.runId}`), 'local_stop_package_identity_mismatch');
    const evidenceRoot = resolveOwnedStopProjectDirectory(root, `${spec.outputRoot}/operator-stop-control`);
    return submitOwnedStopIntent({ evidenceRoot, input, credentials: body.credentials });
  }
  need(command.command === 'start' && Object.keys(body).join(',') === 'credentials', 'local_start_body_fields');
  const { spec } = validateLocalStartPackage(root, command);
  const current = await reader(root);
  need(current?.ok === true && current.status === 'verified' && current.registry.activeExecution === null, 'local_active_or_unverified_registry');
  // Refuse attempts/leases/old executions rather than recover or replay them.
  for (const relative of [`${BACKGROUND_LAUNCH_ROOT}/${spec.packageIdentity}`, `${CLOSED_LOOP_ROOT}/${spec.packageIdentity}`,
    '.runtime/ai-painter/owned-worker-guards/active.json']) {
    const parent = resolveOwnedStopProjectDirectory(root, path.posix.dirname(relative));
    need(!fs.existsSync(path.join(parent, path.posix.basename(relative))), 'local_consumed_or_busy');
  }
  return { protocol: LOCAL_CONTROL_PROTOCOL, command: 'start', trainingQualified: false,
    receipt: await launcher({ root, packagePath: command.packagePath, packageSha256: command.packageSha256 }) };
}
export function runLocalControl(command, body, root = projectRoot) {
  return run(command, body, root, readCurrentExecutionRegistry, launchAutonomousClosedLoopBackground);
}
export function runLocalControlForIsolatedTests(command, body, root, { reader, launcher }) {
  need(typeof reader === 'function' && typeof launcher === 'function', 'local_test_dependencies_invalid');
  return run(command, body, root, reader, launcher, true);
}

export const LOCAL_CONTROL_HELP = `AI Painter fixed local control v1
Usage: node scripts/run-ai-painter-local-control-v1.mjs --protocol ai-painter-local-control-v1 start --package <exact-relative-package.json> --package-sha256 <sha256>
       node scripts/run-ai-painter-local-control-v1.mjs --protocol ai-painter-local-control-v1 status
       node scripts/run-ai-painter-local-control-v1.mjs --protocol ai-painter-local-control-v1 stop
Mutations read one JSON object from stdin, at most 8192 bytes, within 15 seconds.
start: {"credentials":{"cookie":"<existing signed operator cookie>","csrf":"<existing CSRF token>"}}
stop:  {"credentials":{...},"input":{"runId":...,"packageId":...,"executionPackagePath":...,"executionPackageSha256":...,"expectedRegistryRevision":...,"supervisorProcessId":...,"supervisorProcessStartIdentity":...,"idempotencyKey":...,"reasonText":...}}
Use the existing operator session; stable AI_PET_WORLD_OPERATOR_SESSION_SECRET must already be configured. Never pass secrets as command arguments. status needs no mutation credentials.
Only the registered ecology quality capability and fixed adapter are accepted. No arbitrary runner, shell command, resume or retry.
An intent, request acceptance, consumption or delivered reason is not proof of stopped processes, live cleanup or saved Checkpoint. Read exact native/terminal evidence separately.
Unknown fault diagnosis and automatic code repair remain unavailable.
`;
async function stdinBody() {
  return new Promise((resolve, reject) => {
    let bytes = 0, chunks = [];
    const finish = error => { clearTimeout(timer); process.stdin.removeListener('data', data); process.stdin.removeListener('end', end); process.stdin.removeListener('error', fail); process.stdin.pause(); if (error) reject(error); };
    const fail = error => finish(error);
    const data = chunk => { bytes += chunk.length; if (bytes > 8192) finish(Error('local_stdin_oversized')); else chunks.push(chunk); };
    const end = () => { try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); finish(); resolve(value); } catch { finish(Error('local_stdin_invalid_json')); } };
    const timer = setTimeout(() => finish(Error('local_stdin_timeout')), 15000);
    process.stdin.on('data', data); process.stdin.once('end', end); process.stdin.once('error', fail);
  });
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const command = parseLocalControlArguments(process.argv.slice(2));
    if (command.help) process.stdout.write(LOCAL_CONTROL_HELP);
    else process.stdout.write(JSON.stringify(await runLocalControl(command, command.command === 'status' ? null : await stdinBody())) + '\n');
  } catch (error) {
    // Only stable error messages, never the submitted credentials or raw body.
    const message = String(error.message ?? error);
    const errorCode = /^(?:local_|stop_|control_)[a-z0-9_]{1,180}$/u.test(message) ? message : 'local_control_internal_error';
    process.stderr.write(JSON.stringify({ protocol: LOCAL_CONTROL_PROTOCOL, status: 'failed_closed', errorCode }) + '\n');
    process.exitCode = 1;
  }
}
