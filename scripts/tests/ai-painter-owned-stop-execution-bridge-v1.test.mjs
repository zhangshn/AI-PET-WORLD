import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createOwnedStopExecutionBridge as production, createOwnedStopExecutionBridgeForIsolatedTests as isolated, STOP_EXECUTION_BRIDGE_LIMITS as L } from '../lib/ai-painter-owned-stop-execution-bridge-v1.mjs';
import { createOwnedStopRequestComponent, STOP_REQUEST_LIMITS as SOURCE_LIMITS } from '../lib/ai-painter-owned-stop-request-v1.mjs';
import { CURRENT_EXECUTION_REGISTRY_PATH, readCurrentExecutionRegistry } from '../../src/server/ai-painter-current-execution-registry.mjs';
import { projectRoot as configuredProjectRoot, physicalRuntimeRoot as configuredPhysicalRuntimeRoot } from '../lib/ai-pet-world-storage.mjs';
import { issueLocalOperatorSession } from '../../src/server/ai-console-control/operator-session.ts';

const root = process.env.AI_PAINTER_STOP_BRIDGE_TEST_ROOT;
assert.ok(root && path.isAbsolute(root), 'fresh explicit isolated fixture root required');
assert.equal(fs.existsSync(root), false, 'no reuse or automatic retry');
assert.equal(fs.existsSync(path.resolve('.runtime/ai-painter/owned-worker-guards/active.json')), false, 'shared guard must be absent before test');
fs.mkdirSync(root, { recursive: true });
const originalSecret = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = crypto.randomBytes(48).toString('hex');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const put = (p, v) => fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return { promise, resolve, reject }; };
let serial = 0;
function fixture(bridgeOptions = {}) {
  const projectRoot = path.join(root, `fixture-${++serial}`), evidenceRoot = path.join(projectRoot, 'requests');
  fs.mkdirSync(path.join(projectRoot, path.dirname(CURRENT_EXECUTION_REGISTRY_PATH)), { recursive: true });
  fs.mkdirSync(evidenceRoot);
  put(path.join(projectRoot, 'source.mjs'), '// isolated synthetic source, never executed');
  const sourceSha = hash(fs.readFileSync(path.join(projectRoot, 'source.mjs')));
  put(path.join(projectRoot, 'package.json'), { packageIdentity: 'fixture-package', programLineage: { worker: sourceSha } });
  const context = { runId: 'fixture-run', packageId: 'fixture-package', executionPackagePath: 'package.json', executionPackageSha256: hash(fs.readFileSync(path.join(projectRoot, 'package.json'))), supervisorProcessId: 123, supervisorProcessStartIdentity: '134359011720230661', phase: 'training' };
  let retained = { callId: 'fixture-call', ...context };
  const lock = { runId: context.runId, packageId: context.packageId, processId: context.supervisorProcessId, processStartIdentity: context.supervisorProcessStartIdentity };
  put(path.join(projectRoot, 'lock.json'), lock);
  let wall = Date.now(), mono = 100, calls = 0, readerImplementation = null, getterImplementation = null;
  const heartbeat = { schemaVersion: 'ai-painter-current-active-execution-heartbeat-v1', capabilityVersion: 'fixture-capability', ...lock, executionState: 'executing', heartbeatAtUtc: new Date(wall).toISOString(), ttlSeconds: 2 };
  put(path.join(projectRoot, 'heartbeat.json'), heartbeat);
  const registry = { runId: context.runId, packageId: context.packageId, registryRevision: 4, executionState: 'executing', activeExecution: { ...lock, executionState: 'executing', capabilityVersion: 'fixture-capability', programLineage: { worker: { path: 'source.mjs', sha256: sourceSha } }, lock: { path: 'lock.json', sha256: hash(fs.readFileSync(path.join(projectRoot, 'lock.json'))) }, heartbeat: { path: 'heartbeat.json', ttlSeconds: 2 } } };
  const saveRegistry = () => put(path.join(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH), registry);
  saveRegistry();
  const result = () => ({ ok: true, status: 'verified', registry: structuredClone(registry), registrySha256: hash(fs.readFileSync(path.join(projectRoot, CURRENT_EXECUTION_REGISTRY_PATH))) });
  const options = { projectRoot, expectedContext: context, readRetainedNativeCall: () => getterImplementation ? getterImplementation() : retained };
  const dependencies = { reader: async () => { calls++; return readerImplementation ? readerImplementation() : result(); }, wallNow: () => wall, monotonicNow: () => mono };
  const bridge = isolated({ ...options, ...bridgeOptions }, dependencies);
  return { projectRoot, evidenceRoot, context, registry, heartbeat, bridge, options, result, saveRegistry,
    makeBridge: (extra = {}, mapping = () => null) => isolated({ ...options, ...extra }, { ...dependencies, readRuntimeMapping: mapping }),
    advance: ms => { wall += ms; mono += ms; }, wallBack: () => { wall--; },
    setReader: fn => { readerImplementation = fn; }, setGetter: fn => { getterImplementation = fn; },
    retained: () => retained, replaceRetained: () => { retained = { ...retained }; }, calls: () => calls,
    writeHeartbeat: () => put(path.join(projectRoot, 'heartbeat.json'), heartbeat) };
}
function operatorRequest() {
  const issued = issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session', { headers: { host: 'localhost:3000' } }));
  assert.equal(issued.ok, true);
  return new Request('http://localhost:3000/api/ai-console/control/commands', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', cookie: issued.setCookie.split(';')[0], 'x-ai-console-csrf': issued.session.csrfToken } });
}
test('fresh snapshot feeds existing component; real auth, once-only reason, cleanup remains unknown', async () => {
  const f = fixture();
  assert.equal(f.bridge.readCurrentExecution(), null);
  assert.equal((await f.bridge.refresh()).ok, true);
  const component = createOwnedStopRequestComponent({ projectRoot: f.projectRoot, evidenceRoot: f.evidenceRoot, readCurrentExecution: f.bridge.readCurrentExecution, readRetainedNativeCall: f.bridge.readRetainedNativeCall });
  const { phase, ...target } = f.context;
  const accepted = component.submit({ input: { ...target, expectedRegistryRevision: 4, idempotencyKey: 'bridge_test_key_000001', reasonText: 'isolated bridge stop' }, operatorRequest: operatorRequest() });
  const provider = component.createAbortReasonProvider({ requestId: accepted.requestId });
  assert.match(provider.abortReason(), /^operator_stop:[a-f0-9]{64}:isolated bridge stop$/u);
  assert.equal(provider.abortReason(), null);
  assert.throws(() => provider.acknowledge({ cleanupConfirmed: true }), /copied_cleanup_receipt/u);
  const ack = provider.acknowledge();
  assert.equal(ack.body.cleanupStatus, 'cleanup_unknown');
  for (const field of ['cleanupConfirmed', 'executionStopped', 'checkpointSaved']) assert.equal(ack.body[field], false);
  assert.equal(f.calls(), 1, 'sync callbacks never invoke reader');
  assert.equal(f.bridge.inspect().readerTrust, 'unverified_isolated_test_reader');
  assert.equal(component.trustStatus.productionEligible, false);
});
test('bounded expiry, wall rollback, explicit invalidation deny without refreshing', async () => {
  for (const mode of ['expiry', 'rollback', 'invalidate']) {
    const f = fixture(); assert.equal((await f.bridge.refresh()).ok, true);
    if (mode === 'expiry') f.advance(L.maximumAgeMs);
    if (mode === 'rollback') f.wallBack();
    if (mode === 'invalidate') f.bridge.invalidate();
    assert.equal(f.bridge.readCurrentExecution(), null);
    assert.equal(f.bridge.readRetainedNativeCall(), null);
    assert.equal(f.calls(), 1);
  }
});
test('sync reads while refresh is pending deny without cancelling a fresh result', async () => {
  const f = fixture(), d = deferred(); f.setReader(() => d.promise);
  const pending = f.bridge.refresh();
  assert.equal(f.bridge.readCurrentExecution(), null);
  assert.equal(f.bridge.readRetainedNativeCall(), null);
  d.resolve(f.result()); assert.equal((await pending).ok, true);
  assert.notEqual(f.bridge.readCurrentExecution(), null);
});
test('failed or malformed refresh invalidates prior good snapshot; boolean is insufficient', async () => {
  for (const value of [{ verified: true }, { ok: true, status: 'verified', registry: {} }, { ok: false, status: 'unknown_or_stale' }]) {
    const f = fixture(); assert.equal((await f.bridge.refresh()).ok, true);
    f.setReader(() => value); assert.equal((await f.bridge.refresh()).ok, false);
    assert.equal(f.bridge.readCurrentExecution(), null);
  }
  const f = fixture(); await f.bridge.refresh(); f.setReader(() => { throw Error('read failed'); });
  assert.equal((await f.bridge.refresh()).errorCode, 'read failed'); assert.equal(f.bridge.readCurrentExecution(), null);
});
test('late reader and call change while awaiting verification are denied', async () => {
  for (const mode of ['late', 'call']) {
    const f = fixture(), d = deferred(); f.setReader(() => d.promise);
    const refresh = f.bridge.refresh();
    assert.equal(f.bridge.readCurrentExecution(), null, 'pending sync read does not cancel refresh');
    if (mode === 'late') f.advance(L.maximumRefreshMs); else f.retained().callId = 'changed-call';
    d.resolve(f.result()); assert.equal((await refresh).ok, false);
    assert.equal(f.bridge.readCurrentExecution(), null);
  }
});
test('legitimate slow refresh preserves full post-validation snapshot lifetime', async () => {
  const f = fixture(), d = deferred(); f.setReader(() => d.promise);
  const pending = f.bridge.refresh(); f.advance(1200); d.resolve(f.result());
  assert.equal((await pending).ok, true, '1200ms verification must not consume 1000ms snapshot lifetime');
  assert.notEqual(f.bridge.readCurrentExecution(), null);
  f.advance(799); assert.notEqual(f.bridge.readCurrentExecution(), null);
  f.advance(201); assert.equal(f.bridge.readCurrentExecution(), null);
  assert.equal(f.bridge.inspect().lastError, 'bridge_snapshot_expired');
});
test('refresh timeout settles promptly but outstanding reader remains bounded and cannot resurrect', async () => {
  const f = fixture({ maximumRefreshMs: 20 }), d = deferred(); f.setReader(() => d.promise);
  const timed = await f.bridge.refresh();
  assert.equal(timed.errorCode, 'bridge_refresh_timeout');
  assert.equal(f.bridge.inspect().pendingRefreshes, 1, 'timed out reader stays counted');
  assert.equal(f.bridge.readCurrentExecution(), null);
  d.resolve(f.result()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.bridge.inspect().pendingRefreshes, 0);
  assert.equal(f.bridge.readCurrentExecution(), null);
  assert.throws(() => production({ ...f.options, maximumRefreshMs: 15001 }), /bridge_refresh_bound_invalid/u);
});
test('refresh wall rollback and final changed bytes remain denied after slow verification', async () => {
  for (const mode of ['rollback', 'registry', 'package']) {
    const f = fixture(), d = deferred(); const original = f.result();
    f.setReader(() => d.promise); const pending = f.bridge.refresh();
    f.advance(1200);
    if (mode === 'rollback') { for (let i = 0; i < 1201; i++) f.wallBack(); }
    if (mode === 'registry') { f.registry.registryRevision++; f.saveRegistry(); }
    if (mode === 'package') put(path.join(f.projectRoot, 'package.json'), 'changed during verification');
    d.resolve(original); assert.equal((await pending).ok, false, mode);
    assert.equal(f.bridge.readCurrentExecution(), null);
  }
});
test('out-of-order refresh completion cannot erase new good snapshot or resurrect after new failure', async () => {
  for (const latestSuccess of [true, false]) {
    const f = fixture(), first = deferred(), second = deferred(); let n = 0;
    f.setReader(() => ++n === 1 ? first.promise : second.promise);
    const old = f.bridge.refresh(), latest = f.bridge.refresh();
    second.resolve(latestSuccess ? f.result() : { ok: false });
    assert.equal((await latest).ok, latestSuccess);
    first.resolve(f.result()); assert.equal((await old).errorCode, 'bridge_refresh_superseded');
    assert.equal(f.bridge.readCurrentExecution() !== null, latestSuccess);
  }
});
test('explicit invalidation and refresh concurrency cap prevent pending resurrection', async () => {
  const f = fixture(), d = deferred(); f.setReader(() => d.promise);
  const pending = f.bridge.refresh(); f.bridge.invalidate(); d.resolve(f.result());
  assert.equal((await pending).ok, false); assert.equal(f.bridge.readCurrentExecution(), null);
  const g = fixture(), a = deferred(), b = deferred(); let n = 0;
  g.setReader(() => ++n === 1 ? a.promise : b.promise);
  const one = g.bridge.refresh(), two = g.bridge.refresh();
  assert.equal((await g.bridge.refresh()).errorCode, 'bridge_refresh_concurrency_bound');
  a.resolve(g.result()); b.resolve(g.result()); await Promise.all([one, two]);
  assert.equal(g.bridge.readCurrentExecution(), null); assert.equal(g.calls(), 2);
});
test('changed call, phase, Run, package, SHA and PID creation invalidate cached context', async () => {
  for (const [key, value] of Object.entries({ callId: 'another-call', phase: 'review', runId: 'other-run', packageId: 'other-package', executionPackageSha256: 'a'.repeat(64), supervisorProcessId: 124, supervisorProcessStartIdentity: '134359011720230662' })) {
    const f = fixture(); await f.bridge.refresh(); f.retained()[key] = value;
    assert.equal(f.bridge.readCurrentExecution(), null, key);
    assert.equal(f.bridge.readRetainedNativeCall(), null, key);
  }
  const f = fixture(); await f.bridge.refresh(); f.replaceRetained();
  assert.equal(f.bridge.readCurrentExecution(), null, 'copied equal descriptor has no retained reference');
});
test('missing, async, thenable, rejected or throwing retained getters fail closed', async () => {
  for (const getter of [() => null, async () => ({}), () => ({ then() {} }), () => Promise.reject(Error('async failure')), () => { throw Error('getter failed'); }]) {
    const f = fixture(); f.setGetter(getter); assert.equal((await f.bridge.refresh()).ok, false);
    assert.equal(f.bridge.readCurrentExecution(), null);
  }
  const f = fixture();
  const b = isolated({ ...f.options, readRetainedNativeCall: null }, { reader: async () => f.result(), wallNow: Date.now, monotonicNow: () => 1 });
  assert.equal((await b.refresh()).errorCode, 'bridge_retained_getter_missing');
});
test('current registry revision/phase, package bytes, lock and heartbeat changes are detected', async () => {
  for (const mode of ['registry', 'phase', 'package', 'lock', 'heartbeat', 'heartbeat-expired']) {
    const f = fixture(); await f.bridge.refresh();
    if (mode === 'registry') { f.registry.registryRevision++; f.saveRegistry(); }
    if (mode === 'phase') { f.registry.executionState = 'reviewing'; f.saveRegistry(); }
    if (mode === 'package') put(path.join(f.projectRoot, 'package.json'), 'changed package');
    if (mode === 'lock') put(path.join(f.projectRoot, 'lock.json'), 'changed lock');
    if (mode === 'heartbeat') { f.heartbeat.processStartIdentity = 'reused'; f.writeHeartbeat(); }
    if (mode === 'heartbeat-expired') { f.heartbeat.heartbeatAtUtc = new Date(Date.now() - 10000).toISOString(); f.writeHeartbeat(); }
    assert.equal(f.bridge.readCurrentExecution(), null, mode);
  }
});
test('registry target mismatch and mutated source are denied before any consumption', async () => {
  for (const key of ['runId', 'packageId', 'executionState']) {
    const f = fixture(); f.registry[key] = 'wrong'; f.saveRegistry();
    assert.equal((await f.bridge.refresh()).ok, false);
  }
  const f = fixture(); await f.bridge.refresh();
  put(path.join(f.projectRoot, 'source.mjs'), 'source changed');
  const component = createOwnedStopRequestComponent({ projectRoot: f.projectRoot, evidenceRoot: f.evidenceRoot, readCurrentExecution: f.bridge.readCurrentExecution, readRetainedNativeCall: f.bridge.readRetainedNativeCall });
  const { phase, ...target } = f.context;
  assert.throws(() => component.submit({ input: { ...target, expectedRegistryRevision: 4, idempotencyKey: 'bridge_test_key_000002', reasonText: 'isolated source change' }, operatorRequest: operatorRequest() }), /stop_source_sha_mismatch/u);
  assert.equal(fs.readdirSync(f.evidenceRoot).length, 0);
});
test('production factory rejects verifier injection and unbounded age; snapshots are not caller mutable', async () => {
  const f = fixture();
  assert.throws(() => production({ ...f.options, reader: async () => ({ verified: true }) }), /bridge_option_not_allowed/u);
  assert.throws(() => production({ ...f.options, maximumAgeMs: 1001 }), /bridge_age_bound_invalid/u);
  await f.bridge.refresh(); const first = f.bridge.readCurrentExecution(); first.registrySha256 = 'b'.repeat(64);
  assert.notEqual(f.bridge.readCurrentExecution().registrySha256, first.registrySha256);
  const call = f.bridge.readRetainedNativeCall(); call.callId = 'copy-mutated';
  assert.equal(f.bridge.readRetainedNativeCall().callId, 'fixture-call');
  for (const key of ['productionEligible', 'cleanupConfirmed', 'executionStopped', 'checkpointSaved']) assert.equal(f.bridge.inspect()[key], false);
});
function junctionFixture({ wrongTarget = false } = {}) {
  const f = fixture(), physicalProject = fs.realpathSync(f.projectRoot);
  const logicalRuntime = path.join(physicalProject, '.runtime');
  const physicalRuntime = path.join(physicalProject, 'physical-runtime');
  const assertInside = p => { const rel = path.relative(physicalProject, path.resolve(p)); assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'fixture operation must stay inside its absolute physical project'); };
  assertInside(logicalRuntime); assertInside(physicalRuntime);
  fs.renameSync(logicalRuntime, physicalRuntime);
  const alternate = path.join(physicalProject, 'alternate-runtime'); fs.mkdirSync(alternate);
  fs.symlinkSync(wrongTarget ? alternate : physicalRuntime, logicalRuntime, process.platform === 'win32' ? 'junction' : 'dir');
  const mapping = { projectRoot: f.projectRoot, physicalRuntimeRoot: physicalRuntime };
  return { ...f, physicalProject, logicalRuntime, physicalRuntime, alternate, mapping, assertInside,
    mappedBridge: () => f.makeBridge({}, () => mapping) };
}
test('exact formal-root junction is accepted only via explicitly unverified fixture mapping', async () => {
  const f = junctionFixture(), b = f.mappedBridge();
  assert.equal((await b.refresh()).ok, true);
  assert.notEqual(b.readCurrentExecution(), null);
  assert.equal(b.inspect().readerTrust, 'unverified_isolated_test_reader');
  assert.equal(b.inspect().productionEligible, false);
  assert.throws(() => f.makeBridge(), /bridge_runtime_mapping_required/u);
  assert.throws(() => production({ ...f.options, readRuntimeMapping: () => f.mapping }), /bridge_option_not_allowed/u);
});
test('wrong runtime target, changed mapping, root replacement and root-link replacement reject', async () => {
  const wrong = junctionFixture({ wrongTarget: true });
  assert.throws(() => wrong.mappedBridge(), /bridge_runtime_target_mismatch/u);
  for (const mode of ['mapping', 'physical-root', 'root-link']) {
    const f = junctionFixture(), b = f.mappedBridge(); await b.refresh();
    if (mode === 'mapping') f.mapping.physicalRuntimeRoot = f.alternate;
    if (mode === 'physical-root') {
      const retired = path.join(f.physicalProject, 'retired-runtime'); f.assertInside(retired); f.assertInside(f.physicalRuntime);
      fs.renameSync(f.physicalRuntime, retired); fs.mkdirSync(f.physicalRuntime);
    }
    if (mode === 'root-link') {
      const retired = path.join(f.physicalProject, 'retired-runtime-link'); f.assertInside(retired); f.assertInside(f.logicalRuntime);
      fs.renameSync(f.logicalRuntime, retired);
      fs.symlinkSync(f.physicalRuntime, f.logicalRuntime, process.platform === 'win32' ? 'junction' : 'dir');
    }
    assert.equal(b.readCurrentExecution(), null, mode);
    assert.match(b.inspect().lastError, /bridge_runtime_(mapping|root)_changed/u);
  }
});
test('descendant junction still rejected below correctly configured runtime root', async () => {
  const f = junctionFixture(), outside = path.join(f.physicalProject, 'child-target'); fs.mkdirSync(outside);
  const lockBytes = fs.readFileSync(path.join(f.projectRoot, 'lock.json'));
  fs.writeFileSync(path.join(outside, 'lock.json'), lockBytes);
  fs.symlinkSync(outside, path.join(f.physicalRuntime, 'redirect'), process.platform === 'win32' ? 'junction' : 'dir');
  f.registry.activeExecution.lock = { path: '.runtime/redirect/lock.json', sha256: hash(lockBytes) }; f.saveRegistry();
  const b = f.mappedBridge();
  assert.equal((await b.refresh()).errorCode, 'bridge_redirect_rejected');
  assert.equal(b.readCurrentExecution(), null);
});
test('default factory binds actual configured runtime mapping without claiming a successful default refresh', () => {
  const f = fixture();
  assert.equal(path.resolve(process.cwd()), configuredProjectRoot);
  assert.equal(fs.realpathSync(path.join(configuredProjectRoot, '.runtime')), fs.realpathSync(configuredPhysicalRuntimeRoot));
  const b = production({ ...f.options, projectRoot: configuredProjectRoot });
  assert.equal(b.inspect().readerTrust, 'official_reader');
  assert.equal(b.readCurrentExecution(), null, 'no default refresh success is fabricated');
  put(path.join(root, 'configured-runtime-binding-observation.json'), {
    projectRoot: configuredProjectRoot, physicalRuntimeRoot: configuredPhysicalRuntimeRoot,
    actualRuntimeTarget: fs.realpathSync(path.join(configuredProjectRoot, '.runtime')),
    defaultFactoryConstructionAccepted: true, defaultRefreshPositiveVerified: false,
    callerMappingAccepted: false, stopDispatched: false, productionAdopted: false,
  });
});
test('one real official current-registry read is readonly and never dispatches a stop', { timeout: 60000 }, async () => {
  const before = fs.readFileSync(path.resolve(CURRENT_EXECUTION_REGISTRY_PATH));
  const result = await readCurrentExecutionRegistry(process.cwd());
  assert.ok(['verified', 'unknown_or_stale'].includes(result.status));
  assert.equal(result.ok, result.status === 'verified');
  // Concurrent legitimate registry publication is permitted; this test never writes.
  const after = fs.readFileSync(path.resolve(CURRENT_EXECUTION_REGISTRY_PATH));
  const evidence = { kind: 'real_official_readonly_registry_observation', status: result.status, errorCode: result.errorCode ?? null, registryRevision: result.registry?.registryRevision ?? null, registrySha256: result.registrySha256, beforeSha256: hash(before), afterSha256: hash(after), changedByOtherActorDuringRead: hash(before) !== hash(after), stopDispatched: false, nativeJobs: 0, qualificationGranted: false };
  put(path.join(root, 'real-official-readonly-observation.json'), evidence);
  assert.equal(fs.existsSync(path.resolve('.runtime/ai-painter/owned-worker-guards/active.json')), false, 'guard remained absent at test end');
});
function sourceClosureFixture(count, sourceBytes=41) {
  const f=fixture(), shared=Buffer.alloc(sourceBytes,0x62), last='// bridge final synthetic source';
  fs.writeFileSync(path.join(f.projectRoot,'source.mjs'),shared);put(path.join(f.projectRoot,'last.mjs'),last);
  const roles=Object.fromEntries(Array.from({length:count},(_,i)=>[`role${i}`,{
    path:i===count-1?'last.mjs':'source.mjs',sha256:hash(i===count-1?Buffer.from(last):shared)}]));
  const spec={packageIdentity:f.context.packageId,programLineage:Object.fromEntries(Object.entries(roles).map(([k,b])=>[k,b.sha256]))};
  const saveSpec=()=>{
    put(path.join(f.projectRoot,'package.json'),spec);f.context.executionPackageSha256=hash(fs.readFileSync(path.join(f.projectRoot,'package.json')));
    f.retained().executionPackageSha256=f.context.executionPackageSha256;
  };
  const saveRoles=()=>{f.registry.activeExecution.programLineage=roles;f.saveRegistry();};
  saveSpec();saveRoles();return {...f,roles,spec,saveSpec,saveRoles};
}
test('source-closure-v2 bridge accepts all 179/256 roles and feeds the request consumer once',async()=>{
  assert.equal(SOURCE_LIMITS.sourceClosureContract,'owned-stop-source-closure-v2');assert.equal(L.fileBytes,SOURCE_LIMITS.sourceFileBytes);
  for(const count of [179,256]){
    const f=sourceClosureFixture(count),b=f.makeBridge();assert.equal((await b.refresh()).ok,true);
    const component=createOwnedStopRequestComponent({projectRoot:f.projectRoot,evidenceRoot:f.evidenceRoot,
      readCurrentExecution:b.readCurrentExecution,readRetainedNativeCall:b.readRetainedNativeCall});
    const {phase,...target}=f.context;
    const accepted=component.submit({input:{...target,expectedRegistryRevision:4,idempotencyKey:'closure_bridge_key_000001',reasonText:'private closure stop'},operatorRequest:operatorRequest()});
    const p=component.createAbortReasonProvider({requestId:accepted.requestId});assert.ok(p.abortReason());assert.equal(p.abortReason(),null);
    assert.equal(p.acknowledge().body.cleanupStatus,'cleanup_unknown');assert.equal(Object.keys(f.roles).length,count);
    assert.equal(f.calls(),1,'sync polls never enter full reader');assert.equal(b.inspect().productionEligible,false);
  }
});
test('bridge rejects 257, missing/tampered final source, wrong or missing role sets before minting snapshot',async()=>{
  for(const mode of ['257','missing-last','tampered-last','missing-binding','wrong-role','extra-role','empty']){
    const f=sourceClosureFixture(mode==='257'?257:256);
    if(mode==='missing-last')fs.renameSync(path.join(f.projectRoot,'last.mjs'),path.join(f.projectRoot,'preserved-last.mjs'));
    if(mode==='tampered-last')put(path.join(f.projectRoot,'last.mjs'),'changed final source');
    if(mode==='missing-binding'){delete f.roles.role255;f.saveRoles();}
    if(mode==='wrong-role'){f.spec.programLineage.other=f.spec.programLineage.role255;delete f.spec.programLineage.role255;f.saveSpec();}
    if(mode==='extra-role'){f.spec.programLineage.extra=f.spec.programLineage.role255;f.saveSpec();}
    if(mode==='empty'){for(const k of Object.keys(f.roles))delete f.roles[k];f.saveRoles();}
    const b=f.makeBridge(),r=await b.refresh();assert.equal(r.ok,false,mode);
    assert.match(r.errorCode,mode==='missing-last'?/ENOENT/u:mode==='tampered-last'?/bridge_source_sha_mismatch/u:/bridge_package_lineage_mismatch/u);
    assert.equal(b.readCurrentExecution(),null);assert.equal(b.readRetainedNativeCall(),null);
    assert.equal(fs.readdirSync(f.evidenceRoot).length,0);assert.equal(b.inspect().cleanupConfirmed,false);
  }
});
test('bridge shares 1MiB/16MiB byte bounds and counts every role even at a repeated path',async()=>{
  const oversized=sourceClosureFixture(256,SOURCE_LIMITS.sourceFileBytes+1),large=oversized.makeBridge();
  assert.equal((await large.refresh()).errorCode,'bridge_file_bound_invalid');assert.equal(large.readCurrentExecution(),null);
  const f=sourceClosureFixture(256,SOURCE_LIMITS.sourceTotalBytes/256),shared=f.roles.role0;
  f.roles.role255={...shared};f.spec.programLineage.role255=shared.sha256;f.saveSpec();f.saveRoles();
  assert.equal((await f.makeBridge().refresh()).ok,true,'16MiB exact repeated-role total succeeds');
  fs.writeFileSync(path.join(f.projectRoot,'source.mjs'),Buffer.alloc(SOURCE_LIMITS.sourceTotalBytes/256+1,0x62));
  const sha=hash(fs.readFileSync(path.join(f.projectRoot,'source.mjs')));
  for(const [k,b] of Object.entries(f.roles)){b.sha256=sha;f.spec.programLineage[k]=sha;}
  f.saveSpec();f.saveRoles();const b=f.makeBridge();
  assert.equal((await b.refresh()).errorCode,'bridge_source_budget');assert.equal(b.readCurrentExecution(),null);
  assert.equal(fs.readdirSync(f.evidenceRoot).length,0);
});
test.after(() => {
  if (originalSecret === undefined) delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = originalSecret;
});
