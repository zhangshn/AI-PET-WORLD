import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseLocalControlArguments as parse, LOCAL_CONTROL_PROTOCOL as protocol, LOCAL_CONTROL_HELP,
  LOCAL_CONTROL_REGISTRATION as registration, LOCAL_CONTROL_CAPABILITY as capability, LOCAL_CONTROL_ADAPTER as adapter,
  LOCAL_CONTROL_PLAN_SCHEMA, LOCAL_CONTROL_OUTPUT_ROOT,LOCAL_DECODE1_CONTROL_REGISTRATION,
  validateLocalStartPackage, runLocalControlForIsolatedTests as run } from '../run-ai-painter-local-control-v1.mjs';
import { PHASES, CLOSED_LOOP_CONTRACT_PATH, CURRENT_ENTRYPOINT_REGISTRY_PATH } from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
import { initializeOwnedStopControlEvidence } from '../lib/ai-painter-owned-stop-native-control-v1.mjs';
import { issueLocalOperatorSession } from '../../src/server/ai-console-control/operator-session.ts';
const root = process.env.AI_PAINTER_LOCAL_CONTROL_COMPONENT_ROOT;
assert.ok(root && path.isAbsolute(root) && !fs.existsSync(root), 'explicit fresh isolated fixture root required');
fs.mkdirSync(root, { recursive: true });
const actualContract = fs.readFileSync(CLOSED_LOOP_CONTRACT_PATH);
const oldSecret = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = crypto.randomBytes(48).toString('hex');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const put = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n'); };
let serial = 0;
function fixture(decode1=false) {
  const selectedRegistration=decode1?LOCAL_DECODE1_CONTROL_REGISTRATION:registration;
  const selectedCapability=selectedRegistration.capabilityVersion,selectedAdapter=selectedRegistration.adapterFile;
  const projectRoot = path.join(fs.realpathSync(root), `fixture-${++serial}`); fs.mkdirSync(projectRoot);
  put(path.join(projectRoot, CLOSED_LOOP_CONTRACT_PATH), actualContract);
  put(path.join(projectRoot, CURRENT_ENTRYPOINT_REGISTRY_PATH), { schemaVersion: 'ai-painter-current-entrypoint-registry-v1', status: 'active', currentEntrypoints: [], localControlEntrypoints: [selectedRegistration] });
  const required = [registration.entryFile, selectedAdapter, 'scripts/lib/ai-painter-owned-stop-native-control-v1.mjs',
    'scripts/lib/ai-painter-owned-stop-request-v1.mjs', 'scripts/lib/ai-painter-owned-stop-handoff-v1.mjs',
    'scripts/lib/ai-painter-owned-stop-execution-bridge-v1.mjs', 'src/server/ai-console-control/operator-session.ts'];
  const bindings = {};
  for (const [n, file] of required.entries()) { put(path.join(projectRoot, file), '// inert isolated CLI gate fixture; never imported or executed'); bindings[`role${n}`] = { path: file, sha256: hash(fs.readFileSync(path.join(projectRoot, file))) }; }
  const outputRoot = (decode1?'.runtime/ai-painter/ecology-decode1-weight-quality-executions':'.runtime/ai-painter/ecology-regime-quality-executions')+'/private-quality-fixture-run';
  const plan = { schema: decode1?'ecology-decode1-weight-quality-plan-v1':'ecology-regime-quality-plan-v1', runId: 'private-quality-fixture-run', packageId: 'private-quality-fixture-package', capabilityVersion: selectedCapability, outputRoot, programBindings: bindings };
  put(path.join(projectRoot, outputRoot, 'quality-plan.json'), plan);
  put(path.join(projectRoot, 'docs/formal-fixture.md'), '# Bound non-JSON input; not a training qualification');
  const spec = { schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: plan.packageId, capabilityVersion: selectedCapability,
    ownerAuthorizationRequired: false, ownerInStateMachine: false, maxInfrastructureRecoveryAttempts: 0, outputRoot,
    programLineage: Object.fromEntries(Object.entries(bindings).map(([k, b]) => [k, b.sha256])),
    inputEvidence: [outputRoot + '/quality-plan.json', 'docs/formal-fixture.md'].map(file => ({ path: file, sha256: hash(fs.readFileSync(path.join(projectRoot, file))) })),
    phaseAdapters: Object.fromEntries(PHASES.map(phase => [phase, { kind: 'project_module_export', path: selectedAdapter, sha256: bindings.role1.sha256, exportName: phase }])) };
  const packagePath = `.runtime/ai-painter/autonomous-closed-loop-packages/${plan.packageId}/package.json`;
  const command = { command: 'start', packagePath, packageSha256: null };
  const save = () => { put(path.join(projectRoot, packagePath), spec); command.packageSha256 = hash(fs.readFileSync(path.join(projectRoot, packagePath))); }; save();
  for (const directory of ['autonomous-background-launches', 'autonomous-closed-loop-executions', 'owned-worker-guards']) fs.mkdirSync(path.join(projectRoot, '.runtime/ai-painter', directory));
  initializeOwnedStopControlEvidence(path.join(projectRoot, outputRoot, 'operator-stop-control'));
  const session = issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session', { headers: { host: 'localhost:3000' } })); assert.equal(session.ok, true);
  const credentials = { cookie: session.setCookie.split(';')[0], csrf: session.session.csrfToken };
  let launches = 0, reads = 0;
  const registry = { runId: plan.runId, packageId: plan.packageId, capabilityVersion: selectedCapability, registryRevision: 4, executionState: 'package_materialized', activeExecution: null };
  const deps = { reader: async () => { reads++; return { ok: true, status: 'verified', registry }; },
    launcher: async options => { launches++; return { status: 'unverified_test_launcher_called', ...options }; } };
  const input = { runId: plan.runId, packageId: plan.packageId, executionPackagePath: packagePath, executionPackageSha256: command.packageSha256,
    expectedRegistryRevision: 4, supervisorProcessId: 123, supervisorProcessStartIdentity: '134359011720230661', idempotencyKey: 'private_cli_intent_00001', reasonText: 'isolated CPU stop' };
  return { projectRoot, spec, plan, command, credentials, deps, registry, input, save, launches: () => launches, reads: () => reads };
}
test('explicit version and only fixed start/status/stop argument grammar', () => {
  assert.deepEqual(parse(['--help']), { help: true });
  for (const command of ['status', 'stop']) assert.deepEqual(parse(['--protocol', protocol, command]), { command });
  const args = ['--protocol', protocol, 'start', '--package', '.runtime/ai-painter/autonomous-closed-loop-packages/private-fixture-package/package.json', '--package-sha256', 'a'.repeat(64)];
  assert.equal(parse(args).command, 'start');
  for (const invalid of [[], ['start'], ['--protocol', 'v0', 'status'], ['--protocol', protocol, 'exec'], [...args, '--runner', 'evil.exe'], ['--protocol', protocol, 'status', '--stop'], args.map((v, i) => i === 4 ? '../escape.json' : v), args.map((v, i) => i === 6 ? 'A'.repeat(64) : v)]) assert.throws(() => parse(invalid));
  assert.match(LOCAL_CONTROL_HELP, /automatic code repair remain unavailable/);
});
test('CLI plan/output mapping matches actual quality registration; former delivery aliases refuse', () => {
  const actual = fs.readFileSync('scripts/lib/ai-painter-ecology-quality-registration-v1.mjs', 'utf8');
  assert.equal(actual.match(/export const PLAN_SCHEMA='([^']+)'/u)?.[1], LOCAL_CONTROL_PLAN_SCHEMA);
  assert.equal(actual.match(/export const OUTPUT_ROOT='([^']+)'/u)?.[1], LOCAL_CONTROL_OUTPUT_ROOT);
  const f = fixture(); f.plan.schema = 'ecology-quality-plan-v1';
  put(path.join(f.projectRoot, f.plan.outputRoot, 'quality-plan.json'), f.plan);
  f.spec.inputEvidence[0].sha256 = hash(fs.readFileSync(path.join(f.projectRoot, f.plan.outputRoot, 'quality-plan.json'))); f.save();
  assert.throws(() => validateLocalStartPackage(f.projectRoot, f.command), /exact_quality_plan/);
});
test('executable CLI refuses malformed mutation input without echoing submitted credentials', () => {
  const sensitiveMarker = 'private_test_credential_must_not_be_printed';
  for (const input of [`{"credentials":"${sensitiveMarker}"`, JSON.stringify({ credentials: { cookie: sensitiveMarker + '\n', csrf: sensitiveMarker } })]) {
    const result = spawnSync(process.execPath, [path.resolve('scripts/run-ai-painter-local-control-v1.mjs'), '--protocol', protocol, 'stop'],
      { input, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(result.status, 1); assert.equal(result.stdout.includes(sensitiveMarker), false); assert.equal(result.stderr.includes(sensitiveMarker), false);
    assert.match(result.stderr, /local_(stdin_invalid_json|operator_credentials_invalid)/u);
  }
});
test('status is read only, preserves unknown/unverified data and needs no session', async () => {
  const f = fixture(), before = fs.readdirSync(f.projectRoot);
  f.deps.reader = async () => ({ ok: false, status: 'unknown_or_stale', errorCode: 'fixture_conflict' });
  const saved = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET; delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  const result = await run({ command: 'status' }, null, f.projectRoot, f.deps); process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = saved;
  assert.equal(result.readOnly, true); assert.equal(result.current.errorCode, 'fixture_conflict'); assert.equal(f.launches(), 0);
  assert.deepEqual(fs.readdirSync(f.projectRoot), before);
});
test('fully bound fixture package hands off to existing launcher seam once; no model or process is executed', async () => {
  const f = fixture(); assert.equal(validateLocalStartPackage(f.projectRoot, f.command).plan.runId, f.plan.runId);
  const result = await run(f.command, { credentials: f.credentials }, f.projectRoot, f.deps);
  assert.equal(f.launches(), 1); assert.equal(result.receipt.packageSha256, f.command.packageSha256); assert.equal(result.trainingQualified, false);
});
test('direct local entry requires one exact row; old npm entry, missing table, duplicates and changed fields refuse', () => {
  const altered = change => ({ ...registration, ...change });
  const oldNpmRow = { packageScript: 'control:ai-painter-local-v1', entryFile: registration.entryFile, role: registration.role,
    capabilityVersion: capability, adapterFile: adapter };
  const cases = [undefined, [], [oldNpmRow], [registration, registration], [altered({ entryId: 'unknown' })],
    [altered({ entryFile: 'scripts/evil.mjs' })], [altered({ role: 'arbitrary' })], [altered({ protocol: 'v0' })],
    [altered({ capabilityVersion: 'unknown' })], [altered({ adapterFile: 'scripts/evil.mjs' })],
    [altered({ commands: ['start', 'status', 'stop', 'exec'] })], [altered({ commands: ['stop', 'status', 'start'] })],
    [altered({ commands: ['start', 'status'] })], [altered({ runner: 'evil.exe' })]];
  for (const localControlEntrypoints of cases) {
    const f = fixture(), index = { schemaVersion: 'ai-painter-current-entrypoint-registry-v1', status: 'active', currentEntrypoints: [oldNpmRow] };
    if (localControlEntrypoints !== undefined) index.localControlEntrypoints = localControlEntrypoints;
    put(path.join(f.projectRoot, CURRENT_ENTRYPOINT_REGISTRY_PATH), index);
    assert.throws(() => validateLocalStartPackage(f.projectRoot, f.command), /local_(entrypoint_registry_invalid|capability_entry_not_registered)/u);
    assert.equal(f.launches(), 0);
  }
});
test('unknown capability, arbitrary adapter, missing registration, source drift and missing stop closure reject before launch', async () => {
  for (const mode of ['capability', 'adapter', 'registration', 'source', 'closure', 'sha', 'role']) {
    const f = fixture();
    if (mode === 'capability') f.spec.capabilityVersion = 'unknown';
    if (mode === 'adapter') f.spec.phaseAdapters.execute.path = 'scripts/evil.mjs';
    if (mode === 'registration') put(path.join(f.projectRoot, CURRENT_ENTRYPOINT_REGISTRY_PATH), { schemaVersion: 'ai-painter-current-entrypoint-registry-v1', status: 'active', currentEntrypoints: [] });
    if (mode === 'source') put(path.join(f.projectRoot, adapter), '// changed source');
    if (mode === 'closure') delete f.spec.programLineage.role2;
    if (mode === 'role') f.spec.programLineage.role2 = 'a'.repeat(64);
    f.save(); if (mode === 'sha') f.command.packageSha256 = 'a'.repeat(64);
    await assert.rejects(run(f.command, { credentials: f.credentials }, f.projectRoot, f.deps), undefined, mode); assert.equal(f.launches(), 0);
  }
});
test('active/unverified registry, existing launch/execution or unknown guard refuse replay without cleanup', async () => {
  for (const mode of ['active', 'unverified', 'launch', 'execution', 'guard']) {
    const f = fixture();
    if (mode === 'active') f.registry.activeExecution = { running: true };
    if (mode === 'unverified') f.deps.reader = async () => ({ ok: false });
    if (mode === 'launch') fs.mkdirSync(path.join(f.projectRoot, '.runtime/ai-painter/autonomous-background-launches', f.plan.packageId));
    if (mode === 'execution') fs.mkdirSync(path.join(f.projectRoot, '.runtime/ai-painter/autonomous-closed-loop-executions', f.plan.packageId));
    const guard = path.join(f.projectRoot, '.runtime/ai-painter/owned-worker-guards/active.json'); if (mode === 'guard') put(guard, 'unknown guard');
    await assert.rejects(run(f.command, { credentials: f.credentials }, f.projectRoot, f.deps)); assert.equal(f.launches(), 0);
    if (mode === 'guard') assert.equal(fs.readFileSync(guard, 'utf8'), 'unknown guard');
  }
});
test('stop submits only authenticated intent against exact current target; never reconstructs descriptor', async () => {
  const f = fixture(); f.registry.executionState = 'executing'; f.registry.activeExecution = { runId: f.input.runId, packageId: f.input.packageId, processId: 123, processStartIdentity: f.input.supervisorProcessStartIdentity, executionState: 'executing' };
  const outcome = await run({ command: 'stop' }, { credentials: f.credentials, input: f.input }, f.projectRoot, f.deps);
  assert.equal(outcome.status, 'intent_submitted'); assert.equal(outcome.requestAccepted, false); assert.equal(outcome.executionStopped, false); assert.equal(f.launches(), 0);
  for (const input of [{ ...f.input, expectedRegistryRevision: 5 }, { ...f.input, supervisorProcessStartIdentity: 'different' }, { ...f.input, executionPackageSha256: 'b'.repeat(64) }])
    await assert.rejects(run({ command: 'stop' }, { credentials: f.credentials, input }, f.projectRoot, f.deps));
});
test.after(() => { if (oldSecret === undefined) delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET; else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = oldSecret; });

test('new exact decode1 package uses the same authenticated launcher seam and preserves legacy constants',async()=>{
 const f=fixture(true);validateLocalStartPackage(f.projectRoot,f.command);const result=await run(f.command,{credentials:f.credentials},f.projectRoot,f.deps);
 assert.equal(f.launches(),1);assert.equal(result.receipt.status,'unverified_test_launcher_called');
 assert.equal(capability,'stage4_mvp256_dry_factorized_ecology_quality_v1');assert.equal(adapter,'scripts/run-ai-painter-ecology-quality-v1.mjs');
});
test('new route registration missing/duplicate/extra/tampered fields rejects; legacy row cannot authenticate new cap',()=>{
 for(const rows of [[],[registration],[LOCAL_DECODE1_CONTROL_REGISTRATION,LOCAL_DECODE1_CONTROL_REGISTRATION],[{...LOCAL_DECODE1_CONTROL_REGISTRATION,extra:true}],
  [{...LOCAL_DECODE1_CONTROL_REGISTRATION,capabilityVersion:capability}],[{...LOCAL_DECODE1_CONTROL_REGISTRATION,adapterFile:adapter}]]){
  const f=fixture(true);put(path.join(f.projectRoot,CURRENT_ENTRYPOINT_REGISTRY_PATH),{schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',currentEntrypoints:[],localControlEntrypoints:rows});
  assert.throws(()=>validateLocalStartPackage(f.projectRoot,f.command),/registered/);assert.equal(f.launches(),0);
 }
});
test('new package cross-cap/schema/root/adapter mismatch fails before launcher',()=>{
 for(const change of [f=>f.spec.capabilityVersion=capability,f=>f.plan.schema=LOCAL_CONTROL_PLAN_SCHEMA,f=>f.plan.capabilityVersion=capability,
  f=>{f.plan.outputRoot=LOCAL_CONTROL_OUTPUT_ROOT+'/'+f.plan.runId;f.spec.outputRoot=f.plan.outputRoot},f=>f.spec.phaseAdapters.execute.path=adapter]){
  const f=fixture(true);change(f);put(path.join(f.projectRoot,f.spec.inputEvidence[0].path),f.plan);f.spec.inputEvidence[0].sha256=hash(fs.readFileSync(path.join(f.projectRoot,f.spec.inputEvidence[0].path)));f.save();
  assert.throws(()=>validateLocalStartPackage(f.projectRoot,f.command));assert.equal(f.launches(),0);
 }
});
