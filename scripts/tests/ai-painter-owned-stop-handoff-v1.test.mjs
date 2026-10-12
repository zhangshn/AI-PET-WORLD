import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import { createOwnedStopHandoff as production, createOwnedStopHandoffForIsolatedTests as isolated } from '../lib/ai-painter-owned-stop-handoff-v1.mjs';
import { createOwnedStopRequestComponent, STOP_REQUEST_LIMITS } from '../lib/ai-painter-owned-stop-request-v1.mjs';
import { CURRENT_EXECUTION_REGISTRY_PATH } from '../../src/server/ai-painter-current-execution-registry.mjs';
import { issueLocalOperatorSession } from '../../src/server/ai-console-control/operator-session.ts';

const root = process.env.AI_PAINTER_STOP_HANDOFF_TEST_ROOT;
assert.ok(root && path.isAbsolute(root), 'explicit private test root required');
assert.equal(fs.existsSync(root), false, 'one batch; no fixture reuse or retry');
assert.equal(fs.existsSync(path.resolve('.runtime/ai-painter/owned-worker-guards/active.json')), false, 'no shared active owner before CPU test');
fs.mkdirSync(root, { recursive: true });
const oldSecret = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = crypto.randomBytes(48).toString('hex');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const put = (p, v) => fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let serial = 0;
function operatorRequest(patch = {}) {
  const issued = issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session', { headers: { host: 'localhost:3000' } }));
  assert.equal(issued.ok, true);
  return new Request('http://localhost:3000/api/ai-console/control/commands', { method: 'POST', headers: {
    host: 'localhost:3000', origin: 'http://localhost:3000', cookie: issued.setCookie.split(';')[0], 'x-ai-console-csrf': issued.session.csrfToken, ...patch } });
}
function fixture({ count = 179, maximumAgeMs, maximumRefreshMs, getter } = {}) {
  const projectRoot = path.join(root, `fixture-${++serial}`), evidenceRoot = path.join(projectRoot, 'requests');
  fs.mkdirSync(path.join(projectRoot, path.dirname(CURRENT_EXECUTION_REGISTRY_PATH)), { recursive: true }); fs.mkdirSync(evidenceRoot);
  put(path.join(projectRoot, 'source.mjs'), '// handoff synthetic source; not executed');
  put(path.join(projectRoot, 'last.mjs'), '// final independent role');
  const roles = Object.fromEntries(Array.from({ length: count }, (_, i) => [`role${i}`, {
    path: i === count - 1 ? 'last.mjs' : 'source.mjs', sha256: hash(fs.readFileSync(path.join(projectRoot, i === count - 1 ? 'last.mjs' : 'source.mjs'))) }]));
  put(path.join(projectRoot, 'package.json'), { packageIdentity: 'fixture-package', programLineage: Object.fromEntries(Object.entries(roles).map(([k, b]) => [k, b.sha256])) });
  const context = { runId: 'fixture-run', packageId: 'fixture-package', executionPackagePath: 'package.json', executionPackageSha256: hash(fs.readFileSync(path.join(projectRoot, 'package.json'))),
    supervisorProcessId: 123, supervisorProcessStartIdentity: '134359011720230661', phase: 'training' };
  let descriptor = { callId: 'fixture-call', ...context }, getterImplementation = getter;
  let wall = Date.now(), mono = 100, readerCalls = 0, getterCalls = 0, readerImplementation = null;
  const lock = { runId: context.runId, packageId: context.packageId, processId: context.supervisorProcessId, processStartIdentity: context.supervisorProcessStartIdentity };
  put(path.join(projectRoot, 'lock.json'), lock);
  const heartbeat = { schemaVersion: 'ai-painter-current-active-execution-heartbeat-v1', capabilityVersion: 'fixture-capability', ...lock,
    executionState: 'executing', heartbeatAtUtc: new Date(wall).toISOString(), ttlSeconds: 120 };
  const writeHeartbeat = () => put(path.join(projectRoot, 'heartbeat.json'), heartbeat); writeHeartbeat();
  const registry = { runId: context.runId, packageId: context.packageId, registryRevision: 4, executionState: 'executing', activeExecution: { ...lock,
    executionState: 'executing', capabilityVersion: 'fixture-capability', programLineage: roles,
    lock: { path: 'lock.json', sha256: hash(fs.readFileSync(path.join(projectRoot, 'lock.json'))) }, heartbeat: { path: 'heartbeat.json', ttlSeconds: 120 } } };
  const saveRegistry = () => put(path.join(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH), registry); saveRegistry();
  const result = () => ({ ok: true, status: 'verified', registry: structuredClone(registry), registrySha256: hash(fs.readFileSync(path.join(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH))) });
  const readRetainedNativeCall = () => { getterCalls++; return getterImplementation ? getterImplementation() : descriptor; };
  const options = { projectRoot, evidenceRoot, expectedContext: context, readRetainedNativeCall,
    ...(maximumAgeMs === undefined ? {} : { maximumAgeMs }), ...(maximumRefreshMs === undefined ? {} : { maximumRefreshMs }) };
  const dependencies = { reader: async () => { readerCalls++; return readerImplementation ? readerImplementation() : result(); }, wallNow: () => wall, monotonicNow: () => mono };
  const handoff = isolated(options, dependencies);
  const { phase, ...target } = context;
  const input = { ...target, expectedRegistryRevision: 4, idempotencyKey: 'handoff_private_key_000001', reasonText: 'private handoff stop' };
  return { projectRoot, evidenceRoot, context, registry, roles, heartbeat, handoff, options, dependencies, input, result, saveRegistry,
    prepare: (request = operatorRequest(), value = input) => handoff.prepare({ input: value, operatorRequest: request }),
    descriptor: () => descriptor, replaceDescriptor: () => { descriptor = { ...descriptor }; },
    setGetter: fn => { getterImplementation = fn; }, setReader: fn => { readerImplementation = fn; },
    readerCalls: () => readerCalls, getterCalls: () => getterCalls,
    setWall: value => { wall = value; }, setMono: value => { mono = value; },
    advance: ms => { wall += ms; mono += ms; }, advanceWall: ms => { wall += ms; }, advanceMono: ms => { mono += ms; },
    updateHeartbeat: () => { heartbeat.heartbeatAtUtc = new Date(wall).toISOString(); writeHeartbeat(); },
    existing: (request = operatorRequest()) => createOwnedStopRequestComponent({ projectRoot, evidenceRoot, now: () => wall,
      readCurrentExecution: () => ({ registryPath: CURRENT_EXECUTION_REGISTRY_PATH, registrySha256: hash(fs.readFileSync(path.join(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH))) }),
      readRetainedNativeCall }).submit({ input, operatorRequest: request }) };
}
function unknown(h) {
  const s = h.inspect();
  for (const key of ['productionEligible', 'executionStopped', 'cleanupConfirmed', 'checkpointSaved', 'nativeHookConnected']) assert.equal(s[key], false, key);
  assert.equal(s.cleanupStatus, 'cleanup_unknown');
}
function noIo(action) {
  const original = [], counts = {};
  const deny = (object, key, label) => {
    original.push([object, key, object[key]]); counts[label] = 0;
    object[key] = () => { counts[label]++; throw Error(`fast_path_forbidden_${label}`); };
  };
  try {
    for (const key of ['readFileSync', 'lstatSync', 'statSync', 'fstatSync', 'realpathSync', 'openSync', 'readSync', 'readdirSync', 'existsSync', 'writeFileSync']) deny(fs, key, `fs_${key}`);
    for (const key of ['readFile', 'stat', 'readdir', 'open']) deny(fs.promises, key, `async_fs_${key}`);
    for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) deny(childProcess, key, `process_${key}`);
    deny(crypto, 'createHash', 'hash'); deny(crypto, 'createHmac', 'hmac');
    deny(globalThis, 'setTimeout', 'timer'); deny(globalThis, 'setInterval', 'interval');
    deny(Promise, 'resolve', 'promise_resolve'); deny(Promise, 'race', 'promise_race');
    const result = action(); assert.ok(Object.values(counts).every(n => n === 0)); return { result, counts };
  } finally { for (const [object, key, value] of original.reverse()) object[key] = value; }
}

test('real session and complete 179/256 closure hand off once; fast read touches no IO/reader/timer', async () => {
  const observations = [];
  for (const count of [179, 256]) {
    const f = fixture({ count }); assert.equal(f.handoff.abortReason(), null);
    assert.equal((await f.prepare()).ok, true); assert.equal(f.readerCalls(), 1);
    const beforeGetter = f.getterCalls();
    const observed = noIo(() => { const reason = f.handoff.abortReason(); assert.match(reason, /^operator_stop:[a-f0-9]{64}:private handoff stop$/u); assert.equal(f.handoff.abortReason(), null); return reason; });
    assert.equal(f.readerCalls(), 1); assert.equal(f.getterCalls(), beforeGetter + 1);
    assert.equal(fs.readdirSync(f.evidenceRoot).filter(n => n.endsWith('.consumed.json')).length, 1);
    assert.equal((await f.prepare()).errorCode, 'handoff_already_delivered'); assert.equal(f.readerCalls(), 1); unknown(f.handoff);
    observations.push({ count, fastReadZeroCalls: observed.counts, readerCalls: f.readerCalls(), onceOnly: true, cleanupStatus: 'cleanup_unknown' });
  }
  put(path.join(root, 'fast-path-zero-io-observation.json'), observations);
});
test('forged authentication, CSRF/origin and exact target mismatches cannot hand off', async () => {
  for (const mode of ['boolean', 'cookie', 'csrf', 'origin', 'run', 'package', 'revision', 'pid-reuse']) {
    const f = fixture(), patch = { cookie: { cookie: 'ai_console_operator_session=forged' }, csrf: { 'x-ai-console-csrf': 'forged' }, origin: { origin: 'http://remote.example' } };
    const request = mode === 'boolean' ? { verified: true } : operatorRequest(patch[mode] ?? {});
    const input = { ...f.input };
    if (mode === 'run') input.runId = 'wrong-run';
    if (mode === 'package') input.executionPackageSha256 = 'a'.repeat(64);
    if (mode === 'revision') input.expectedRegistryRevision++;
    if (mode === 'pid-reuse') input.supervisorProcessStartIdentity = '134359011720230662';
    assert.equal((await f.prepare(request, input)).ok, false, mode); assert.equal(noIo(() => f.handoff.abortReason()).result, null);
    assert.equal(fs.readdirSync(f.evidenceRoot).length, 0); unknown(f.handoff);
  }
});
test('257 roles, missing/tampered last source, role mismatch and redirects reject before consuming', async () => {
  for (const mode of ['257', 'missing', 'tampered', 'role', 'redirect']) {
    const f = fixture({ count: mode === '257' ? 257 : 256 });
    if (mode === 'missing') fs.renameSync(path.join(f.projectRoot, 'last.mjs'), path.join(f.projectRoot, 'preserved-last.mjs'));
    if (mode === 'tampered') put(path.join(f.projectRoot, 'last.mjs'), 'tampered last role');
    if (mode === 'role') { delete f.registry.activeExecution.programLineage.role255; f.saveRegistry(); }
    if (mode === 'redirect') { const target = path.join(f.projectRoot, 'redirect-target'); fs.mkdirSync(target); fs.symlinkSync(target, path.join(f.projectRoot, 'redirect'), process.platform === 'win32' ? 'junction' : 'dir'); f.roles.role255.path = 'redirect/missing.mjs'; f.saveRegistry(); }
    const result = await f.prepare(); assert.equal(result.ok, false, mode);
    assert.equal(f.handoff.abortReason(), null); assert.equal(fs.readdirSync(f.evidenceRoot).length, 0); unknown(f.handoff);
  }
});
test('existing exact authenticated request consumes once; copied/forged/unknown records grant nothing', async () => {
  const f = fixture(), accepted = f.existing();
  assert.equal((await f.handoff.prepare({ requestId: accepted.requestId })).ok, true); assert.ok(noIo(() => f.handoff.abortReason()).result);
  const foreign = fixture(); fs.copyFileSync(accepted.request.path, path.join(foreign.evidenceRoot, path.basename(accepted.request.path)));
  assert.equal((await foreign.handoff.prepare({ requestId: accepted.requestId })).errorCode, 'stop_record_scope_mismatch'); assert.equal(foreign.handoff.abortReason(), null);
  const forged = fixture(), old = forged.existing(), raw = JSON.parse(fs.readFileSync(old.request.path)); raw.payload.reasonText = 'forged stop'; put(old.request.path, raw);
  assert.equal((await forged.handoff.prepare({ requestId: old.requestId })).errorCode, 'stop_record_mac_invalid');
  for (const requestId of ['b'.repeat(64), '../outside', 'bad']) {
    const absent = fixture(); assert.equal((await absent.handoff.prepare({ requestId })).ok, false); assert.equal(absent.handoff.abortReason(), null);
    assert.equal(fs.readdirSync(absent.evidenceRoot).some(n => n.endsWith('.consumed.json')), false);
  }
  const consumed = fixture(), once = consumed.existing();
  const first = isolated(consumed.options, consumed.dependencies); assert.equal((await first.prepare({ requestId: once.requestId })).ok, true);
  assert.equal((await consumed.handoff.prepare({ requestId: once.requestId })).errorCode, 'handoff_request_not_consumed');
  assert.equal(consumed.handoff.abortReason(), null); assert.ok(first.abortReason());
});
test('shared source byte bounds remain enforced before handoff; repeated paths cannot hide total bytes', async () => {
  for (const mode of ['single-file', 'total']) {
    const f = fixture({ count: 256 }), bytes = Buffer.alloc(mode === 'single-file' ? STOP_REQUEST_LIMITS.sourceFileBytes + 1 : STOP_REQUEST_LIMITS.sourceTotalBytes / 256 + 1, 0x61);
    fs.writeFileSync(path.join(f.projectRoot, 'source.mjs'), bytes);
    for (const role of Object.values(f.roles)) { role.path = 'source.mjs'; role.sha256 = hash(bytes); }
    put(path.join(f.projectRoot, 'package.json'), { packageIdentity: f.context.packageId, programLineage: Object.fromEntries(Object.entries(f.roles).map(([k, b]) => [k, b.sha256])) });
    const sha256 = hash(fs.readFileSync(path.join(f.projectRoot, 'package.json')));
    f.context.executionPackageSha256 = sha256; f.input.executionPackageSha256 = sha256; f.descriptor().executionPackageSha256 = sha256; f.saveRegistry();
    const h = isolated(f.options, f.dependencies);
    assert.equal((await h.prepare({ input: f.input, operatorRequest: operatorRequest() })).errorCode,
      mode === 'single-file' ? 'bridge_file_bound_invalid' : 'bridge_source_budget');
    assert.equal(h.abortReason(), null); assert.equal(fs.readdirSync(f.evidenceRoot).length, 0);
  }
});
test('changed call reference, callId, phase, Run/package/PID creation deny without IO', async () => {
  const changes = { callId: 'another-call', phase: 'review', runId: 'other-run', packageId: 'other-package', executionPackageSha256: 'b'.repeat(64), supervisorProcessId: 124, supervisorProcessStartIdentity: '134359011720230662' };
  for (const mode of ['reference', ...Object.keys(changes)]) {
    const f = fixture(); assert.equal((await f.prepare()).ok, true);
    if (mode === 'reference') f.replaceDescriptor(); else f.descriptor()[mode] = changes[mode];
    assert.equal(noIo(() => f.handoff.abortReason()).result, null, mode); assert.equal(f.readerCalls(), 1); unknown(f.handoff);
    if (mode === 'reference') assert.equal((await f.prepare()).errorCode, 'handoff_owner_call_changed');
  }
});
test('missing/throwing/async/thenable/rejected getter fails closed; identity accessors cannot run', async () => {
  for (const mode of ['missing', 'throw', 'async', 'promise', 'thenable', 'accessor']) {
    const f = fixture(); assert.equal((await f.prepare()).ok, true);
    if (mode === 'missing') f.setGetter(() => null);
    if (mode === 'throw') f.setGetter(() => { throw Error('getter failed'); });
    if (mode === 'async') f.setGetter(async () => f.descriptor());
    if (mode === 'promise') f.setGetter(() => Promise.reject(Error('untrusted rejected getter')));
    if (mode === 'thenable') f.setGetter(() => ({ then() { throw Error('must not await thenable'); } }));
    if (mode === 'accessor') Object.defineProperty(f.descriptor(), 'callId', { get() { throw Error('accessor must not execute'); } });
    assert.equal(f.handoff.abortReason(), null, mode); unknown(f.handoff);
  }
  const f = fixture(); let invoked = 0;
  const h = isolated({ ...f.options, readRetainedNativeCall: async () => { invoked++; return f.descriptor(); } }, f.dependencies);
  assert.equal((await h.prepare({ input: f.input, operatorRequest: operatorRequest() })).errorCode, 'handoff_retained_getter_async');
  assert.equal(invoked, 0, 'known async getter is rejected before invocation'); assert.equal(h.abortReason(), null);
  const missing = isolated({ ...f.options, readRetainedNativeCall: null }, f.dependencies);
  assert.equal((await missing.prepare({ requestId: 'b'.repeat(64) })).errorCode, 'handoff_retained_getter_missing');
});
test('exact 1000ms age, wall/monotonic rollback and invalid clocks permanently discard readiness', async () => {
  for (const mode of ['age', 'wall-rollback', 'mono-rollback']) {
    const f = fixture(); assert.equal((await f.prepare()).ok, true);
    f.advance(500);
    if (mode === 'age') f.advance(500);
    else { assert.equal(f.handoff.inspect().status, 'ready_for_same_call'); if (mode === 'wall-rollback') f.advanceWall(-501); else f.advanceMono(-501); }
    assert.equal(noIo(() => f.handoff.abortReason()).result, null, mode); f.advance(1000); assert.equal(f.handoff.abortReason(), null);
  }
  const f = fixture({ maximumAgeMs: 20 }); await f.prepare(); f.advance(20); assert.equal(f.handoff.abortReason(), null);
  for (const clock of ['wall', 'mono']) {
    const g = fixture(); await g.prepare(); if (clock === 'wall') g.setWall(NaN); else g.setMono(Infinity);
    assert.equal(noIo(() => g.handoff.abortReason()).result, null); assert.equal(g.handoff.inspect().lastError, 'handoff_clock_invalid');
  }
});
test('existing request expiry caps handoff below bridge age; expired requests never consume', async () => {
  const f = fixture(), old = f.existing(); f.advance(STOP_REQUEST_LIMITS.maximumAgeMs - 100); f.updateHeartbeat();
  assert.equal((await f.handoff.prepare({ requestId: old.requestId })).ok, true); f.advance(100);
  assert.equal(noIo(() => f.handoff.abortReason()).result, null); assert.equal(f.handoff.inspect().lastError, 'handoff_request_expired');
  const expired = fixture(), request = expired.existing(); expired.advance(STOP_REQUEST_LIMITS.maximumAgeMs); expired.updateHeartbeat();
  assert.equal((await expired.handoff.prepare({ requestId: request.requestId })).ok, false);
  assert.equal(fs.readdirSync(expired.evidenceRoot).some(n => n.endsWith('.consumed.json')), false);
});
test('invalidate/dispose clear readiness and cancelled pending work cannot resurrect', async () => {
  for (const method of ['invalidate', 'dispose']) {
    const f = fixture(); await f.prepare(); f.handoff[method](); assert.equal(noIo(() => f.handoff.abortReason()).result, null);
    const g = fixture(), d = deferred(); g.setReader(() => d.promise); const pending = g.prepare();
    assert.equal(g.handoff.abortReason(), null); g.handoff[method](); d.resolve(g.result());
    assert.equal((await pending).ok, false); assert.equal(g.handoff.abortReason(), null);
    assert.equal(fs.readdirSync(g.evidenceRoot).length, 0);
  }
});
test('overlapping prepares reject both without an additional reader or late resurrection', async () => {
  const f = fixture(), d = deferred(); f.setReader(() => d.promise); const first = f.prepare();
  assert.equal(f.handoff.abortReason(), null); assert.equal((await f.prepare()).errorCode, 'handoff_prepare_concurrency');
  assert.equal(f.readerCalls(), 1); d.resolve(f.result()); assert.equal((await first).ok, false);
  assert.equal(f.handoff.abortReason(), null); assert.equal(fs.readdirSync(f.evidenceRoot).length, 0);
});
test('call, source and registry changed while awaiting verification cannot mint a fast reason', async () => {
  for (const mode of ['call', 'source', 'registry']) {
    const f = fixture(), d = deferred(), before = f.result(); f.setReader(() => d.promise); const pending = f.prepare();
    f.advance(1200);
    if (mode === 'call') f.descriptor().callId = 'changed-while-pending';
    if (mode === 'source') put(path.join(f.projectRoot, 'last.mjs'), 'changed while pending');
    if (mode === 'registry') { f.registry.registryRevision++; f.saveRegistry(); }
    d.resolve(before); assert.equal((await pending).ok, false); assert.equal(noIo(() => f.handoff.abortReason()).result, null);
    assert.equal(fs.readdirSync(f.evidenceRoot).length, 0);
  }
});
test('timeout and two still-running reader limit remain enforced; late settlement cannot restore reason', async () => {
  const f = fixture({ maximumRefreshMs: 20 }), d = deferred(); f.setReader(() => d.promise);
  assert.equal((await f.prepare()).errorCode, 'bridge_refresh_timeout');
  assert.equal((await f.prepare()).errorCode, 'bridge_refresh_timeout');
  assert.equal((await f.prepare()).errorCode, 'bridge_refresh_concurrency_bound'); assert.equal(f.readerCalls(), 2);
  assert.equal(f.handoff.abortReason(), null); d.resolve(f.result()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.handoff.abortReason(), null); assert.equal(fs.readdirSync(f.evidenceRoot).length, 0);
});
test('legitimate slow refresh retains post-verification lifetime; exact refresh deadline denies', async () => {
  const f = fixture(), d = deferred(); f.setReader(() => d.promise); const pending = f.prepare();
  f.advance(1200); d.resolve(f.result()); assert.equal((await pending).ok, true);
  f.advance(999); assert.ok(noIo(() => f.handoff.abortReason()).result);
  const g = fixture(), late = deferred(); g.setReader(() => late.promise); const p = g.prepare();
  g.advance(15000); late.resolve(g.result()); assert.equal((await p).errorCode, 'bridge_refresh_timeout'); assert.equal(g.handoff.abortReason(), null);
});
test('UTF8 complete reason stays bounded; copied cleanup/permission fields and factory injection denied', async () => {
  const f = fixture(); f.input.reasonText = '停'.repeat(144) + 'a'; assert.equal((await f.prepare()).ok, true);
  const reason = f.handoff.abortReason(); assert.equal(Buffer.byteLength(reason, 'utf8'), 512); unknown(f.handoff);
  const bad = fixture(); bad.input.reasonText = '停'.repeat(144) + 'ab'; assert.equal((await bad.prepare()).errorCode, 'stop_reason_utf8_limit');
  assert.equal(fs.readdirSync(bad.evidenceRoot).length, 0);
  for (const patch of [{ reader: () => ({ verified: true }) }, { cleanupConfirmed: true }, { permission: true }, { wallNow: Date.now }, { maximumAgeMs: 1001 }, { maximumRefreshMs: 15001 }]) {
    assert.throws(() => production({ ...bad.options, ...patch }), /handoff_option_not_allowed|bridge_(age|refresh)_bound_invalid/u);
  }
  assert.equal((await bad.handoff.prepare({ requestId: 'a'.repeat(64), cleanupConfirmed: true })).errorCode, 'handoff_command_fields');
});
test('default production construction uses actual root and official reader, but no refresh/native hook', () => {
  const f = fixture(), ledger = path.join(root, 'real-root-ledger'); fs.mkdirSync(ledger);
  const h = production({ ...f.options, projectRoot: process.cwd(), evidenceRoot: ledger });
  assert.equal(h.inspect().readerTrust, 'official_reader'); assert.equal(noIo(() => h.abortReason()).result, null); unknown(h);
  assert.equal(fs.readdirSync(ledger).length, 0);
  put(path.join(root, 'real-root-construction-observation.json'), { factoryAccepted: true, readerTrust: h.inspect().readerTrust,
    defaultRefreshVerified: false, actualRetainedNativeCallVerified: false, nativeHookConnected: false, productionAdopted: false, requestsIssued: 0 });
});
test.after(() => {
  assert.equal(fs.existsSync(path.resolve('.runtime/ai-painter/owned-worker-guards/active.json')), false);
  if (oldSecret === undefined) delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = oldSecret;
});
