import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {HOST_V4, createHostPaths, createHostBudget, createHostDeadline, captureHostNativeCall,
  runHostAuditForIsolatedTests} from '../check-ai-painter-saved-gradient-algebra-cpu-v4.mjs';

const project = process.cwd();
const moduleFile = fileURLToPath(new URL('../check-ai-painter-saved-gradient-algebra-cpu-v4.mjs', import.meta.url));
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const put = (root, logical, value) => {
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  const file = path.join(root, logical); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, raw);
  return {path:logical, sha256:sha(raw)};
};
function fixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'saved-gradient-host-v4-')));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync.native(os.tmpdir()));
    assert.match(path.basename(root), /^saved-gradient-host-v4-[A-Za-z0-9]+$/u);
    fs.rmSync(root, {recursive:true, force:true});
  });
  const inventoryRaw = fs.readFileSync(path.join(project, HOST_V4.audit, 'registration-inputs-v4.json'));
  assert.equal(sha(inventoryRaw), HOST_V4.inventorySha);
  const inventory = JSON.parse(inventoryRaw);
  put(root, HOST_V4.audit + '/registration-inputs-v4.json', inventoryRaw);
  for (const b of Object.values(inventory.minimalSourceBindings)) put(root, b.path, fs.readFileSync(path.join(project, b.path)));
  fs.mkdirSync(path.join(root, HOST_V4.guard), {recursive:true});
  put(root, '.runtime/ai-painter/current-execution-registry/current.json', {activeExecution:null});
  const policy = {
    schemaVersion:HOST_V4.schema, scope:'saved_gradient_algebra_only', runId:HOST_V4.runId,
    formalSpecification:{...put(root, 'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md', '# private synthetic specification'), version:'AI-PAINTER-SPEC-1.100'},
    registrationInputs:{path:HOST_V4.audit + '/registration-inputs-v4.json', sha256:HOST_V4.inventorySha},
    executionHost:put(root, HOST_V4.host, '// private inert host source'),
    programBindings:{driver:put(root, HOST_V4.driver, '# private inert driver'), tests:put(root, HOST_V4.tests, '# private inert tests')},
    containmentProgramBindings:{owner:put(root, 'scripts/lib/ai-painter-owned-worker-v1.mjs', '// inert owner'),
      nativeBridge:put(root, 'scripts/lib/ai-painter-owned-worker-native-v1.mjs', '// inert bridge'),
      nativeOwnerSource:put(root, 'scripts/windows/ai-painter-owned-worker-owner.cs', '// inert native source')},
    interpreter:{absolutePath:path.join(root, 'ml/ai-painter/.venv/Scripts/python.exe'),
      sha256:put(root, 'ml/ai-painter/.venv/Scripts/python.exe', 'not an executable').sha256},
    target:{parameterIndex:90, name:'core.core.final_rgb_decoder.base.layers.4.weight', shape:[3,48,1,1]}, comparison:{atol:1e-6,rtol:1e-5},
    resources:{cpuThreads:2,cpuAffinityMaximum:2,maxWallSecondsIncludingStartup:120,maxRssMiB:1536,maxOutputMiB:8,
      maxSingleJsonMiB:2,failureReserveBytes:65536,archiveReadMaximumBytes:67108864,decodedMaximumBytesIncludingArchiveMetadata:67108864,
      attempts:1,automaticRetries:0}, outputRoot:HOST_V4.audit + '/attempt-001',
  };
  const f = {root, policy, inventory, calls:0, time:1000, behavior:{}};
  f.save = () => { f.policyBinding = put(root, HOST_V4.policy, policy); return f.policyBinding.sha256; };
  f.options = () => ({root, policySha:f.save(), now:() => f.time, started:1000, worker:f.worker,
    afterWrite:name => { if (f.behavior.lateWrite === name) f.time = 121001; }});
  f.worker = async (executable, args, options) => {
    f.calls++; assert.equal(options.maxBuffer, 8 * 1024 ** 2); assert.ok(options.timeout <= 120000);
    assert.equal(options.env.CUDA_VISIBLE_DEVICES, ''); assert.equal(options.env.OMP_NUM_THREADS, '2');
    const id = crypto.randomUUID(), build = HOST_V4.guard + '/' + id + '-native';
    const nativeBuild = {binary:path.join(root, build, 'owner.exe'), snapshot:path.join(root, build, 'owner.cs'), output:'synthetic compiler stdout'};
    put(root, build + '/owner.exe', 'not an executable'); put(root, build + '/owner.cs', '// synthetic'); put(root, build + '/build.json', nativeBuild);
    const started = HOST_V4.guard + '/' + id + '-started.json', terminal = HOST_V4.guard + '/' + id + '-terminal.json';
    const guard = {identity:id, runnerPid:process.pid, executable, executableSha256:policy.interpreter.sha256,
      helperSha256:policy.containmentProgramBindings.owner.sha256, commandSha256:sha(JSON.stringify(args)),
      nativeOwnerSource:{sha256:policy.containmentProgramBindings.nativeOwnerSource.sha256}, startedEvidence:path.join(root, started)};
    put(root, HOST_V4.guard + '/active.json', guard); put(root, started, {guard, privateFixture:true});
    f.id = id; f.nativeBuild = build;
    await Promise.resolve(); // Let the host bind this synthetic current call.
    const output = policy.outputRoot + '/real-cpu-algebra-result-v4.json';
    const report = {status:'saved_gradient_algebra_review_completed', runId:HOST_V4.runId, policy:f.policyBinding,
      schema:'parameter90-saved-gradient-cpu-algebra-result-v4',
      inputs:inventory.inputs, modelForwards:0,autogradCalls:0,optimizerSteps:0,cudaInitialized:false,modelStatesInstalled:false,
      qualificationGranted:false,rootCauseProven:false,resourceObservation:{sampledPeakRssBytes:1024,cpuAffinity:[0,1],torchThreads:2},
      recordedFailureComparison:'synthetic_nonreproduction'};
    const resultBinding = put(root, output, report);
    const stdout = JSON.stringify({result:fs.realpathSync.native(path.join(root, output)), sha256:resultBinding.sha256});
    const receipt = {guard:{identity:id, path:path.join(root, HOST_V4.guard, 'active.json'), startedEvidence:path.join(root, started), terminalEvidence:path.join(root, terminal)},
      nativeBuild, observationPath:path.join(root, build, 'cleanup-observation.json'),
      streamBytes:{stdout:Buffer.byteLength(stdout),stderr:0}, proof:{stdoutBytes:Buffer.byteLength(stdout),stderrBytes:0},
      cleanupConfirmed:true,guardReleaseConfirmed:true,ownerClosed:true};
    if (f.behavior.streams) { receipt.streamBytes = {...f.behavior.streams}; receipt.proof = {stdoutBytes:receipt.streamBytes.stdout,stderrBytes:receipt.streamBytes.stderr}; }
    if (f.behavior.foreignReceipt) receipt.guard.identity = crypto.randomUUID();
    if (f.behavior.uncleaned) receipt.cleanupConfirmed = false;
    put(root, build + '/cleanup-observation.json', {synthetic:true}); put(root, terminal, receipt);
    fs.unlinkSync(path.join(root, HOST_V4.guard, 'active.json'));
    f.receipt = receipt;
    if (f.behavior.overDisk) put(root, policy.outputRoot + '/excess.bin', Buffer.alloc(HOST_V4.maximum));
    if (f.behavior.throwWorker) throw Object.assign(f.behavior.throwWorker, {ownedReceipt:receipt,stdout,stderr:''});
    return {stdout,stderr:'',ownedReceipt:receipt};
  };
  return f;
}

test('import is inert and private hook refuses a production root before execution', async () => {
  let called = false;
  await assert.rejects(runHostAuditForIsolatedTests({root:project, worker:() => { called = true; }}), /private_fixture_required/);
  assert.equal(called, false);
});

test('same-call success accounts result, host files, native files, compiler and raw worker streams', async t => {
  const f = fixture(t), result = await runHostAuditForIsolatedTests(f.options());
  assert.equal(f.calls, 1); assert.match(result.status, /^cpu_audit_completed/);
  assert.equal(result.outputAccounting.nativeCallIdentity, f.id);
  assert.equal(result.outputAccounting.workerStreamBytes, f.receipt.streamBytes.stdout);
  assert.equal(result.outputAccounting.compilerStreamBytes, Buffer.byteLength('synthetic compiler stdout'));
  const size = directory => fs.readdirSync(directory,{withFileTypes:true}).reduce((n,e) => n + (e.isDirectory() ? size(path.join(directory,e.name)) : fs.statSync(path.join(directory,e.name)).size),0);
  const disk = size(path.join(f.root,f.policy.outputRoot)) + size(path.join(f.root,HOST_V4.audit,'host-attempt-001')) +
    size(path.join(f.root,f.nativeBuild)) + fs.statSync(path.join(f.root,HOST_V4.guard,f.id+'-started.json')).size +
    fs.statSync(path.join(f.root,HOST_V4.guard,f.id+'-terminal.json')).size;
  assert.equal(result.outputAccounting.diskBytes, disk);
  assert.equal(result.outputAccounting.hostTransportDebitBytes,16384);
  assert.equal(result.outputAccounting.hostTransportDebitIsConservative,true);
  assert.equal(result.outputAccounting.totalBytes, disk + result.outputAccounting.workerStreamBytes + result.outputAccounting.compilerStreamBytes + 16384);
  assert.match(result.outputAccountingSnapshot,/including_report_bytes/);
  const saved = JSON.parse(fs.readFileSync(path.join(f.root,HOST_V4.audit,'host-attempt-001/report.json')));
  assert.equal(saved.outputAccountingSnapshot,'before_this_report_file_write');
  await assert.rejects(runHostAuditForIsolatedTests(f.options()), /attempt_consumed/); assert.equal(f.calls,1);
});

test('combined streams, disk overflow, foreign receipt and unknown cleanup never succeed', async t => {
  for (const [behavior,expected] of [
    [{streams:{stdout:5*1024**2,stderr:5*1024**2}},/total_output_budget/],
    [{overDisk:true},/total_output_budget/], [{foreignReceipt:true},/receipt_call_differs/], [{uncleaned:true},/cleanup_unconfirmed/],
  ]) {
    const f = fixture(t); Object.assign(f.behavior,behavior);
    await assert.rejects(runHostAuditForIsolatedTests(f.options()),expected); assert.equal(f.calls,1);
    assert.equal(fs.existsSync(path.join(f.root,HOST_V4.audit,'host-attempt-001/report.json')),false);
  }
});

test('original worker failure is preserved and its exact raw stdio is still settled', async t => {
  const f = fixture(t), original = Error('synthetic worker primary failure'); f.behavior.throwWorker = original;
  await assert.rejects(runHostAuditForIsolatedTests(f.options()),error => error === original);
  const failure = JSON.parse(fs.readFileSync(path.join(f.root,HOST_V4.audit,'host-attempt-001/failure.json')));
  assert.equal(failure.nativeStreamsSettled,true); assert.equal(failure.nativeCallIdentity,f.id);
  assert.equal(failure.outputAccounting.workerStreamBytes,f.receipt.streamBytes.stdout);
});

test('deadline includes preparation, claim fsync, final report fsync and final rename', async t => {
  const deadline = createHostDeadline({now:() => 121001,started:1000}); assert.throws(() => deadline.check(),/deadline/);
  for (const name of ['claim.json','report.pending.json','rename']) {
    const f = fixture(t), options = f.options(); f.behavior.lateWrite = name;
    if (name === 'rename') options.now = () => fs.existsSync(path.join(f.root,HOST_V4.audit,'host-attempt-001/report.json')) ? 121001 : f.time;
    await assert.rejects(runHostAuditForIsolatedTests(options),/total_deadline_exceeded/);
    assert.equal(f.calls,name === 'claim.json' ? 0 : 1);
    assert.equal(fs.existsSync(path.join(f.root,HOST_V4.audit,'host-attempt-001/report.json')),false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root,HOST_V4.audit,'host-attempt-001/failure.json'))).status,'failed_closed');
    if (name === 'rename') assert.equal(fs.existsSync(path.join(f.root,HOST_V4.audit,'host-attempt-001/report.not-accepted.json')),true);
  }
});

test('cumulative ledger reserves exactly 64KiB and never scans old guard namespaces', t => {
  const f = fixture(t), paths = createHostPaths(f.root); paths.mkdir(HOST_V4.audit+'/host-attempt-001');
  const budget = createHostBudget(paths); put(f.root,f.policy.outputRoot+'/payload.bin',Buffer.alloc(HOST_V4.maximum-HOST_V4.reserve-HOST_V4.hostTransportDebit));
  put(f.root,HOST_V4.guard+'/old-native/old.bin',Buffer.alloc(1024));
  assert.equal(budget.check().totalBytes,HOST_V4.maximum-HOST_V4.reserve);
  assert.throws(() => budget.check(1),/total_output_budget/);
  assert.doesNotThrow(() => budget.check(HOST_V4.reserve,true));
});

test('nested junctions, final links, hardlinks and directory replacement are refused', async t => {
  for (const mode of ['ancestor','file','hardlink','replace']) {
    await t.test(mode, sub => {
    const f = fixture(sub), paths = createHostPaths(f.root), parent = HOST_V4.audit+'/private'; paths.mkdir(parent);
    put(f.root,parent+'/value.json','{}'); paths.read(parent+'/value.json');
    const original = path.join(f.root,parent), retired = original+'-retired'; fs.renameSync(original,retired);
    if (mode === 'ancestor') fs.symlinkSync(retired,original,process.platform==='win32'?'junction':'dir');
    else {
      fs.mkdirSync(original);
      if (mode === 'file') {
        try { fs.symlinkSync(path.join(retired,'value.json'),path.join(original,'value.json')); }
        catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') { sub.skip('Windows file symlink privilege unavailable; directory-junction rejection is exercised separately'); return; } throw error; }
      }
      if (mode === 'hardlink') fs.linkSync(path.join(retired,'value.json'),path.join(original,'value.json'));
      if (mode === 'replace') put(f.root,parent+'/value.json','{}');
    }
    assert.throws(() => paths.read(parent+'/value.json'),/redirect|directory_changed|regular_file/);
    });
  }
});

test('formal runtime mapping is accepted in an isolated configured process; internal redirects still reject', t => {
  const f = fixture(t), physical = path.join(f.root,'storage/hot/runtime'); fs.mkdirSync(path.dirname(physical),{recursive:true});
  fs.renameSync(path.join(f.root,'.runtime'),physical);
  fs.symlinkSync(physical,path.join(f.root,'.runtime'),process.platform==='win32'?'junction':'dir');
  const script = `import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
    const {createHostPaths,HOST_V4}=await import(${JSON.stringify(pathToFileURL(moduleFile).href)});
    const paths=createHostPaths(process.cwd()),logical=HOST_V4.audit+'/registration-inputs-v4.json';
    assert.equal(JSON.parse(paths.read(logical)).runId,HOST_V4.runId);
    assert.equal(paths.file(logical),path.join(process.env.AI_PET_WORLD_DATA_ROOT,'hot/runtime',logical.slice(9)));
    const parent=paths.directory(HOST_V4.audit),alias=path.join(parent,'redirect'),target=path.join(process.cwd(),'redirect-target');
    fs.mkdirSync(target);fs.symlinkSync(target,alias,process.platform==='win32'?'junction':'dir');
    assert.throws(()=>paths.read(HOST_V4.audit+'/redirect/registration-inputs-v4.json'),/redirect/);
    console.log('private_formal_mapping_verified');`;
  const child = spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:f.root,windowsHide:true,encoding:'utf8',timeout:15000,
    env:{...process.env,AI_PET_WORLD_DATA_ROOT:path.join(f.root,'storage')}});
  assert.equal(child.status,0,child.stderr); assert.match(child.stdout,/private_formal_mapping_verified/);
});

test('foreign active guard and policy resource drift refuse before the worker is invoked', async t => {
  for (const mode of ['guard','resource','inventory']) {
    const f = fixture(t); if (mode === 'guard') put(f.root,HOST_V4.guard+'/active.json',{identity:'foreign'});
    if (mode === 'resource') f.policy.resources.maxWallSecondsIncludingStartup=121;
    if (mode === 'inventory') f.policy.registrationInputs.sha256='0'.repeat(64);
    await assert.rejects(runHostAuditForIsolatedTests(f.options()),/existing_guard|policy_resource|inventory_identity/);
    assert.equal(f.calls,0);
  }
});

test('native identity capture rejects foreign command instead of selecting any old guard', t => {
  const f = fixture(t), paths = createHostPaths(f.root);
  put(f.root,HOST_V4.guard+'/active.json',{identity:crypto.randomUUID(),runnerPid:process.pid,executable:f.policy.interpreter.absolutePath,
    executableSha256:f.policy.interpreter.sha256,helperSha256:'0'.repeat(64),commandSha256:'1'.repeat(64),nativeOwnerSource:{sha256:'2'.repeat(64)}});
  assert.throws(() => captureHostNativeCall(paths,{executable:f.policy.interpreter.absolutePath,executableSha256:f.policy.interpreter.sha256,
    helperSha256:'0'.repeat(64),commandSha256:'wrong',ownerSha256:'2'.repeat(64)}),/foreign_native_call/);
});

test('foreign Run, target, old policy, source SHA and output drift reject before consumption', async t => {
  for (const mode of ['run','targetIndex','targetName','targetShape','oldPolicy','output','sourceSha','inventoryBytes','activeRegistry']) {
    const f = fixture(t);
    if (mode === 'run') f.policy.runId = 'foreign';
    if (mode === 'targetIndex') f.policy.target.parameterIndex = 48;
    if (mode === 'targetName') f.policy.target.name = 'foreign';
    if (mode === 'targetShape') f.policy.target.shape = [144];
    if (mode === 'oldPolicy') f.policy.schemaVersion = 'ai-painter-saved-gradient-algebra-cpu-policy-v3';
    if (mode === 'output') f.policy.outputRoot = HOST_V4.audit + '/attempt-002';
    if (mode === 'sourceSha') put(f.root,f.inventory.minimalSourceBindings.boundedArchiveLoader.path,'# changed loader');
    if (mode === 'inventoryBytes') put(f.root,HOST_V4.audit+'/registration-inputs-v4.json',{...f.inventory,runId:'foreign'});
    if (mode === 'activeRegistry') put(f.root,'.runtime/ai-painter/current-execution-registry/current.json',{activeExecution:{runId:'foreign'}});
    await assert.rejects(runHostAuditForIsolatedTests(f.options()));
    assert.equal(f.calls,0,mode);
    assert.equal(fs.existsSync(path.join(f.root,HOST_V4.audit,'host-attempt-001')),false,mode);
    assert.equal(fs.existsSync(path.join(f.root,HOST_V4.audit,'attempt-001')),false,mode);
  }
});

test('every pinned resource rejects drift and a consumed output alone cannot be replayed', async t => {
  for (const key of Object.keys(fixture(t).policy.resources)) {
    const f = fixture(t); f.policy.resources[key]++;
    await assert.rejects(runHostAuditForIsolatedTests(f.options()),/policy_resource/);
    assert.equal(f.calls,0);
  }
  const f = fixture(t);
  put(f.root,f.policy.outputRoot+'/retained-failure.json',{status:'failed_closed'});
  await assert.rejects(runHostAuditForIsolatedTests(f.options()),/attempt_consumed/);
  assert.equal(f.calls,0);
});
