import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import { initializeOwnedStopControlEvidence, submitOwnedStopIntent, localOperatorRequest,
  createOwnedStopNativeControl, createOwnedStopNativeControlForIsolatedTests as createControl, NATIVE_STOP_CONTROL_LIMITS } from '../lib/ai-painter-owned-stop-native-control-v1.mjs';
import { issueLocalOperatorSession } from '../../src/server/ai-console-control/operator-session.ts';
import { CURRENT_EXECUTION_REGISTRY_PATH } from '../../src/server/ai-painter-current-execution-registry.mjs';
const root = process.env.AI_PAINTER_NATIVE_STOP_COMPONENT_ROOT;
assert.ok(root && path.isAbsolute(root) && !fs.existsSync(root), 'explicit fresh private fixture root required');
fs.mkdirSync(root, { recursive: true });
const oldSecret = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = crypto.randomBytes(48).toString('hex');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const put = (file, value) => fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
let serial = 0;
function credentials() {
  const issued = issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session', { headers: { host: 'localhost:3000' } }));
  assert.equal(issued.ok, true);
  return { cookie: issued.setCookie.split(';')[0], csrf: issued.session.csrfToken };
}
function fixture(count = 179) {
  const projectRoot = path.join(fs.realpathSync(root), `fixture-${++serial}`); fs.mkdirSync(projectRoot);
  const evidenceRoot = path.join(projectRoot, 'operator-stop-control'); initializeOwnedStopControlEvidence(evidenceRoot);
  fs.mkdirSync(path.join(projectRoot, path.dirname(CURRENT_EXECUTION_REGISTRY_PATH)), { recursive: true });
  put(path.join(projectRoot, 'source.mjs'), '// actual fixture source bytes, never executed');
  const roles = Object.fromEntries(Array.from({ length: count }, (_, n) => [`role${n}`, { path: 'source.mjs', sha256: hash(fs.readFileSync(path.join(projectRoot, 'source.mjs'))) }]));
  put(path.join(projectRoot, 'package.json'), { packageIdentity: 'fixture-package', programLineage: Object.fromEntries(Object.entries(roles).map(([k, b]) => [k, b.sha256])) });
  const context = { runId: 'fixture-run', packageId: 'fixture-package', executionPackagePath: 'package.json', executionPackageSha256: hash(fs.readFileSync(path.join(projectRoot, 'package.json'))),
    supervisorProcessId: 123, supervisorProcessStartIdentity: '134359011720230661', phase: 'training' };
  let descriptor = Object.freeze({ callId: 'private-fixture-call', ...context }), wall = Date.now(), mono = 0, readerCalls = 0, readerPatch = null, getterPatch = null;
  const lock = { runId: context.runId, packageId: context.packageId, processId: context.supervisorProcessId, processStartIdentity: context.supervisorProcessStartIdentity };
  put(path.join(projectRoot, 'lock.json'), lock);
  put(path.join(projectRoot, 'heartbeat.json'), { schemaVersion: 'ai-painter-current-active-execution-heartbeat-v1', capabilityVersion: 'fixture-capability', ...lock,
    executionState: 'executing', heartbeatAtUtc: new Date(wall).toISOString(), ttlSeconds: 120 });
  const registry = { ...lock, registryRevision: 4, executionState: 'executing', activeExecution: { ...lock, executionState: 'executing', capabilityVersion: 'fixture-capability', programLineage: roles,
    lock: { path: 'lock.json', sha256: hash(fs.readFileSync(path.join(projectRoot, 'lock.json'))) }, heartbeat: { path: 'heartbeat.json', ttlSeconds: 120 } } };
  const save = () => put(path.join(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH), registry); save();
  const dependencies = { wallNow: () => wall, monotonicNow: () => mono,
    reader: async () => { readerCalls++; if (readerPatch) return readerPatch(); return { ok: true, status: 'verified', registry: structuredClone(registry), registrySha256: hash(fs.readFileSync(path.join(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH))) }; } };
  const options = { projectRoot, evidenceRoot, expectedContext: context, readRetainedNativeCall: () => getterPatch ? getterPatch() : descriptor };
  const control = createControl(options, dependencies), { phase, ...target } = context;
  const input = { ...target, expectedRegistryRevision: 4, idempotencyKey: 'private_stop_intent_00001', reasonText: 'private local stop' };
  const auth = credentials();
  return { projectRoot, evidenceRoot, options, dependencies, control, input, auth, registry, save,
    submit: value => submitOwnedStopIntent({ evidenceRoot, input: value ?? input, credentials: auth }),
    close: () => { descriptor = null; }, replace: () => { descriptor = Object.freeze({ ...descriptor }); },
    advance: ms => { wall += ms; mono += ms; }, readerCalls: () => readerCalls,
    patchReader: fn => { readerPatch = fn; }, patchGetter: fn => { getterPatch = fn; } };
}
function withoutIO(action) {
  const originals = [];
  const deny = (obj, name) => { originals.push([obj, name, obj[name]]); obj[name] = () => { throw Error(`fast_path_io_${name}`); }; };
  try {
    for (const name of ['readFileSync', 'lstatSync', 'statSync', 'fstatSync', 'realpathSync', 'openSync', 'readSync', 'readdirSync', 'existsSync', 'writeFileSync']) deny(fs, name);
    for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) deny(childProcess, name);
    for (const name of ['createHash', 'createHmac']) deny(crypto, name);
    for (const name of ['setInterval', 'setTimeout']) deny(globalThis, name);
    return action();
  } finally { for (const [obj, name, original] of originals.reverse()) obj[name] = original; }
}
test('encrypted real-session intent prepares 179/256 source closure and delivers once without IO', async () => {
  for (const count of [179, 256]) {
    const f = fixture(count), intent = f.submit();
    assert.equal(intent.requestAccepted, false); assert.equal(intent.executionStopped, false);
    const raw = fs.readFileSync(intent.binding.path, 'utf8');
    assert.equal(raw.includes(f.auth.cookie), false); assert.equal(raw.includes(f.auth.csrf), false);
    assert.equal((await f.control.preparePending()).ok, true);
    assert.equal(f.readerCalls(), 1);
    const reason = withoutIO(() => f.control.abortReason()); assert.match(reason, /^operator_stop:[a-f0-9]{64}:private local stop$/u);
    assert.equal(withoutIO(() => f.control.abortReason()), null);
    assert.equal((await f.control.preparePending()).status, 'reason_delivered_not_stop_proof');
    const delivered = JSON.parse(fs.readFileSync(path.join(f.evidenceRoot, 'inbox', `${intent.intentId}.delivered.json`)));
    assert.equal(delivered.reasonDelivered, true);
    for (const key of ['executionStopped', 'cleanupConfirmed', 'checkpointSaved']) assert.equal(delivered[key], false);
    assert.equal(f.control.inspect().handoff.readerTrust, 'unverified_isolated_test_reader'); f.control.dispose();
  }
});
test('bad session, CSRF, header injection and missing stable secret fail before transport writes', () => {
  const f = fixture();
  for (const auth of [{ ...f.auth, cookie: 'ai_console_operator_session=forged' }, { ...f.auth, csrf: 'forged' }, { ...f.auth, cookie: '\nsecret' }])
    assert.throws(() => submitOwnedStopIntent({ evidenceRoot: f.evidenceRoot, input: f.input, credentials: auth }));
  const current = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET; delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  assert.throws(() => localOperatorRequest(f.auth)); process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = current;
  assert.deepEqual(fs.readdirSync(path.join(f.evidenceRoot, 'inbox')), []);
});
test('absent operator secret disables stop without becoming an autonomous training startup gate', async () => {
  const previous = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET; delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  try {
    const evidenceRoot = path.join(fs.realpathSync(root), 'secret-unavailable'); initializeOwnedStopControlEvidence(evidenceRoot);
    const control = createOwnedStopNativeControl({});
    assert.equal(control.inspect().status, 'operator_secret_unavailable');
    assert.equal((await control.preparePending()).ok, false); assert.equal(withoutIO(() => control.abortReason()), null);
    assert.equal(control.inspect().nativeHookConnected, false); control.dispose(); assert.equal(control.inspect().status, 'disposed');
    assert.deepEqual(fs.readdirSync(path.join(evidenceRoot, 'inbox')), []);
  } finally { process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = previous; }
});
test('intent replay is idempotent; conflicting content and concurrent/interrupted ledger lock reject', () => {
  const f = fixture(), first = f.submit(), again = f.submit(); assert.equal(first.intentId, again.intentId); assert.equal(again.replayed, true);
  assert.throws(() => f.submit({ ...f.input, reasonText: 'conflicting reason' }), /idempotency/);
  fs.mkdirSync(path.join(f.evidenceRoot, '.write-lock'));
  assert.throws(() => f.submit(), /conflict_or_busy/); assert.equal(fs.existsSync(path.join(f.evidenceRoot, '.write-lock')), true);
});
test('MAC tampering, copying to another namespace and root child replacement do not stop', async () => {
  for (const mode of ['mac', 'copy', 'directory']) {
    const f = fixture(), intent = f.submit();
    if (mode === 'mac') { const raw = JSON.parse(fs.readFileSync(intent.binding.path)); raw.payload.reasonText = 'tampered reason'; put(intent.binding.path, raw); }
    if (mode === 'copy') { const other = fixture(); fs.copyFileSync(intent.binding.path, path.join(other.evidenceRoot, 'inbox', path.basename(intent.binding.path))); assert.equal((await other.control.preparePending()).ok, false); assert.equal(other.control.abortReason(), null); continue; }
    if (mode === 'directory') { fs.renameSync(path.join(f.evidenceRoot, 'inbox'), path.join(f.projectRoot, 'preserved-inbox')); fs.mkdirSync(path.join(f.evidenceRoot, 'inbox')); }
    assert.equal((await f.control.preparePending()).ok, false); assert.equal(withoutIO(() => f.control.abortReason()), null);
    assert.deepEqual(fs.readdirSync(path.join(f.evidenceRoot, 'requests')), []);
  }
});
test('target, source cap, changed descriptor and actual owner close reject delivery', async () => {
  for (const mode of ['target', '257', 'source', 'replace-before', 'replace-after', 'closed', 'expired']) {
    const f = fixture(mode === '257' ? 257 : 179);
    f.submit(mode === 'target' ? { ...f.input, expectedRegistryRevision: 5 } : undefined);
    if (mode === 'source') put(path.join(f.projectRoot, 'source.mjs'), 'changed frozen source');
    if (mode === 'replace-before') f.patchGetter(() => ({ callId: 'private-fixture-call', ...f.options.expectedContext }));
    if (mode === 'closed') f.close();
    const result = await f.control.preparePending();
    if (['replace-after', 'expired'].includes(mode)) {
      assert.equal(result.ok, true); if (mode === 'replace-after') f.replace(); else f.advance(1000);
    } else assert.equal(result.ok, false, mode);
    assert.equal(withoutIO(() => f.control.abortReason()), null, mode);
  }
});
test('overlapping prepare never starts second slow reader, dispose invalidates pending result', async () => {
  const f = fixture(); f.submit(); let release;
  f.patchReader(() => new Promise(resolve => { release = resolve; }));
  const first = f.control.preparePending(); await Promise.resolve();
  assert.equal((await f.control.preparePending()).status, 'busy'); assert.equal(f.readerCalls(), 1);
  f.control.dispose(); release({ ok: false }); await first; assert.equal(f.control.abortReason(), null);
});
test('same-call result distinguishes accepted/consumed from failed final preparation', async () => {
  const f = fixture(); f.submit();
  assert.equal((await f.control.preparePending()).ok, true);
  const resultFile = fs.readdirSync(path.join(f.evidenceRoot, 'inbox')).find(n => n.endsWith('.result.json'));
  const result = JSON.parse(fs.readFileSync(path.join(f.evidenceRoot, 'inbox', resultFile)));
  assert.equal(result.requestAccepted, true); assert.equal(result.requestConsumed, true); assert.equal(result.reasonDelivered, false);
  f.close(); assert.equal(f.control.abortReason(), null); assert.equal(f.control.inspect().cleanupConfirmed, false);
});
test('bounded inbox counts all records and preserves reserve, refusing overflow without retry', () => {
  const f = fixture();
  for (let n = 0; n < NATIVE_STOP_CONTROL_LIMITS.records; n++) put(path.join(f.evidenceRoot, 'inbox', `${String(n).padStart(64, '0')}.result.json`), '{}');
  assert.throws(() => f.submit(), /budget/); assert.equal(fs.readdirSync(path.join(f.evidenceRoot, 'inbox')).length, 64);
});
test.after(() => { if (oldSecret === undefined) delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET; else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = oldSecret; });
