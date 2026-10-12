import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createOwnedStopRequestComponent as create, STOP_REQUEST_LIMITS as L } from '../lib/ai-painter-owned-stop-request-v1.mjs';
import { issueLocalOperatorSession } from '../../src/server/ai-console-control/operator-session.ts';

assert.ok(process.env.AI_PAINTER_STOP_REQUEST_TEST_ROOT, 'explicit isolated fixture root required');
const root = path.resolve(process.env.AI_PAINTER_STOP_REQUEST_TEST_ROOT);
assert.ok(!fs.existsSync(root), 'fixture root must be fresh; no rerun/reuse');
assert.equal(fs.existsSync(path.resolve('.runtime/ai-painter/owned-worker-guards/active.json')),false,'shared guard must be absent before CPU test');
fs.mkdirSync(root, { recursive: true });
const oldSecret = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
const fixtureSecret = crypto.randomBytes(48).toString('hex');
process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = fixtureSecret;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const put = (file, value) => fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
const clone = x => structuredClone(x);
let sequence = 0;
function fixture() {
  const base = path.join(root, `fixture-${++sequence}`), project = path.join(base, 'project'), evidence = path.join(base, 'requests');
  fs.mkdirSync(project, {recursive:true}); fs.mkdirSync(evidence);
  put(path.join(project,'source.mjs'), '/* synthetic source; never executed */');
  const source = {path:'source.mjs',sha256:digest(fs.readFileSync(path.join(project,'source.mjs')))};
  put(path.join(project,'package.json'), {packageIdentity:'fixture-package',programLineage:{worker:source.sha256}});
  const packageSha=digest(fs.readFileSync(path.join(project,'package.json')));
  const registry={runId:'fixture-run',packageId:'fixture-package',registryRevision:4,executionState:'executing',activeExecution:{
    runId:'fixture-run',packageId:'fixture-package',executionState:'executing',processId:123,
    processStartIdentity:'134359011720230661',programLineage:{worker:source}}};
  put(path.join(project,'registry.json'),registry);
  put(path.join(project,'guard.json'),'synthetic guard unchanged');
  const guardSha=digest(fs.readFileSync(path.join(project,'guard.json')));
  let clock=Date.now();
  let current={registryPath:'registry.json',registrySha256:digest(fs.readFileSync(path.join(project,'registry.json')))};
  let call={callId:'fixture-retained-call',runId:'fixture-run',packageId:'fixture-package',
    executionPackageSha256:packageSha,supervisorProcessId:123,supervisorProcessStartIdentity:'134359011720230661'};
  const options={projectRoot:project,evidenceRoot:evidence,now:()=>clock,readCurrentExecution:()=>current,readRetainedNativeCall:()=>call};
  const component=create(options);
  const input={runId:'fixture-run',packageId:'fixture-package',executionPackagePath:'package.json',executionPackageSha256:packageSha,
    expectedRegistryRevision:4,supervisorProcessId:123,supervisorProcessStartIdentity:'134359011720230661',
    idempotencyKey:'fixture_key_00000001',reasonText:'fixture operator stop'};
  function mutateRegistry(change){Object.assign(registry,change);put(path.join(project,'registry.json'),registry);
    current={registryPath:'registry.json',registrySha256:digest(fs.readFileSync(path.join(project,'registry.json')))};}
  return {base,project,evidence,input,component,options,mutateRegistry,
    submit:(value=input,request=operatorRequest())=>component.submit({input:value,operatorRequest:request}),
    setCall:value=>{call=value},setCurrent:value=>{current=value},advance:ms=>{clock+=ms},
    untouched:()=>assert.equal(digest(fs.readFileSync(path.join(project,'guard.json'))),guardSha)};
}
function operatorRequest(extra={}) {
  const issueRequest=new Request('http://localhost:3000/api/ai-console/control/operator-session',{headers:{host:'localhost:3000'}});
  const issued=issueLocalOperatorSession(issueRequest);assert.equal(issued.ok,true);
  return new Request('http://localhost:3000/api/ai-console/control/commands',{method:'POST',headers:{
    host:'localhost:3000',origin:'http://localhost:3000',cookie:issued.setCookie.split(';')[0],
    'x-ai-console-csrf':issued.session.csrfToken,...extra}});
}
function totalBytes(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>{
  const p=path.join(dir,e.name),s=fs.lstatSync(p);assert.equal(s.isSymbolicLink(),false);
  return n+(s.isDirectory()?totalBytes(p):s.size);},0);}

test('1 matching actual bytes and fixture retained identity yields one bounded abortReason only',()=>{
  const f=fixture(),r=f.submit();assert.equal(r.status,'requested');assert.equal(r.executionStopped,false);
  const provider=f.component.createAbortReasonProvider({requestId:r.requestId});
  const reason=provider.abortReason();assert.match(reason,/^operator_stop:[a-f0-9]{64}:fixture operator stop$/u);
  assert.ok(Buffer.byteLength(reason)<=512);assert.equal(provider.inspect().status,'consumed');
  assert.equal(provider.abortReason(),null);assert.equal(provider.inspect().cleanupConfirmed,false);
  assert.equal(f.component.trustStatus.productionEligible,false);f.untouched();
});
test('2 stale Run/package/SHA/revision/PID reuse and source changes are rejected',()=>{
  for(const patch of [{runId:'old-run'},{packageId:'old-package'},{executionPackageSha256:'a'.repeat(64)},
    {expectedRegistryRevision:3},{supervisorProcessId:124},{supervisorProcessStartIdentity:'134359011720230662'}]){
    const f=fixture();assert.throws(()=>f.submit({...f.input,...patch}),/stop_(current_target|retained_call_identity)_mismatch/u);
    assert.equal(fs.readdirSync(f.evidence).length,0);f.untouched();
  }
  const f=fixture();put(path.join(f.project,'source.mjs'),'changed source');
  assert.throws(()=>f.submit(),/stop_source_sha_mismatch/u);assert.equal(fs.readdirSync(f.evidence).length,0);f.untouched();
});
test('3 actual session verification rejects missing/forged boolean context and bad trust headers',()=>{
  const f=fixture();assert.throws(()=>f.submit(f.input,{verified:true}),/authenticated_operator_request_required/u);
  assert.throws(()=>f.component.submit({input:f.input,authenticatedOperatorContext:{verified:true}}),/authenticated_operator_request_required/u);
  for(const headers of [{cookie:'ai_console_operator_session=forged'},{'x-ai-console-csrf':'forged'},
    {origin:'http://remote.example'},{host:'remote.example'},{'x-forwarded-host':'remote.example'}]){
    assert.throws(()=>f.submit(f.input,operatorRequest(headers)),/local_(operator|control)_/u);
  }
  assert.equal(fs.readdirSync(f.evidence).length,0);f.untouched();
});
test('4 duplicate immutable request and competing providers consume at most once across instances',()=>{
  const f=fixture(),a=f.submit(),before=fs.readFileSync(a.request.path),b=f.submit();
  assert.equal(b.requestId,a.requestId);assert.equal(b.replayed,true);assert.deepEqual(fs.readFileSync(a.request.path),before);
  const p=f.component.createAbortReasonProvider({requestId:a.requestId});assert.ok(p.abortReason());
  const second=create(f.options).createAbortReasonProvider({requestId:a.requestId});assert.equal(second.abortReason(),null);
  assert.equal(fs.readdirSync(f.evidence).filter(n=>n.endsWith('.consumed.json')).length,1);
  const copied=fixture();fs.copyFileSync(a.request.path,path.join(copied.evidence,path.basename(a.request.path)));
  const foreign=copied.component.createAbortReasonProvider({requestId:a.requestId});assert.equal(foreign.abortReason(),null);
  assert.equal(foreign.inspect().lastError,'stop_record_scope_mismatch');copied.untouched();
  assert.deepEqual(fs.readFileSync(a.request.path),before);f.untouched();
});
test('5 reused idempotency key with different payload or target refuses without overwriting',()=>{
  const f=fixture(),r=f.submit(),before=fs.readFileSync(r.request.path);
  assert.throws(()=>f.submit({...f.input,reasonText:'different reason'}),/stop_idempotency_conflict/u);
  assert.throws(()=>f.submit({...f.input,runId:'different-run'}),/stop_idempotency_conflict/u);
  assert.equal(fs.readdirSync(f.evidence).length,1);assert.deepEqual(fs.readFileSync(r.request.path),before);f.untouched();
});
test('6 malformed/oversized/missing/escaping/forged disk input cannot stop or touch guards',()=>{
  const f=fixture();for(const raw of [null,'{broken','x'.repeat(L.inputBytes+1),{...f.input,extra:true},
    {...f.input,executionPackagePath:'../guard.json'},{...f.input,executionPackagePath:'C:/outside.json'},
    {...f.input,executionPackagePath:'folder\\file.json'},{...f.input,reasonText:'bad\nreason'}]){
    assert.throws(()=>f.submit(raw),/stop_(input|path|reason)/u);
  }
  assert.throws(()=>f.component.createAbortReasonProvider({requestId:'../guard'}),/stop_request_id_invalid/u);
  const absent=f.component.createAbortReasonProvider({requestId:'b'.repeat(64)});assert.equal(absent.abortReason(),null);
  const r=f.submit();const raw=JSON.parse(fs.readFileSync(r.request.path));raw.payload.reasonText='forged disk reason';
  put(r.request.path,raw);const forged=f.component.createAbortReasonProvider({requestId:r.requestId});
  assert.equal(forged.abortReason(),null);assert.match(forged.inspect().lastError,/stop_record_mac_invalid/u);
  put(r.request.path,'x'.repeat(L.recordBytes+1));assert.equal(forged.abortReason(),null);
  assert.match(forged.inspect().lastError,/stop_file_size_or_type/u);f.untouched();
});
test('7 expired/no active/unverified current or changed retained identity stays closed',()=>{
  const expired=fixture(),r=expired.submit(),p=expired.component.createAbortReasonProvider({requestId:r.requestId});
  expired.advance(L.maximumAgeMs);assert.equal(p.abortReason(),null);assert.equal(p.inspect().lastError,'stop_request_expired');
  const inactive=fixture();inactive.mutateRegistry({activeExecution:null});assert.throws(()=>inactive.submit(),/stop_no_active_execution/u);
  const unverified=fixture();unverified.setCurrent({verified:true});assert.throws(()=>unverified.submit(),/stop_current_identity_unverified/u);
  const noBridge=fixture();assert.throws(()=>create({...noBridge.options,readCurrentExecution:null}).submit({input:noBridge.input,operatorRequest:operatorRequest()}),/bridge_not_connected/u);
  const reuse=fixture(),accepted=reuse.submit();reuse.setCall({verified:true,supervisorProcessId:123,supervisorProcessStartIdentity:'reused'});
  const wrong=reuse.component.createAbortReasonProvider({requestId:accepted.requestId});assert.equal(wrong.abortReason(),null);
  assert.equal(wrong.inspect().lastError,'stop_retained_call_identity_mismatch');
  const nextCall=fixture(),oldRequest=nextCall.submit();nextCall.setCall({...nextCall.input,callId:'another-native-call'});
  const moved=nextCall.component.createAbortReasonProvider({requestId:oldRequest.requestId});assert.equal(moved.abortReason(),null);
  assert.equal(moved.inspect().lastError,'stop_native_call_changed');
  for(const f of [expired,inactive,unverified,noBridge,reuse,nextCall])f.untouched();
});
test('8 requested/consumed/acknowledged/unknown never become confirmed from copied cleanup bytes',()=>{
  const f=fixture(),r=f.submit(),p=f.component.createAbortReasonProvider({requestId:r.requestId});
  assert.equal(p.inspect().status,'requested');assert.throws(()=>p.acknowledge(),/stop_not_consumed/u);
  assert.ok(p.abortReason());assert.equal(p.inspect().status,'consumed');
  assert.throws(()=>p.acknowledge({cleanupConfirmed:true,activeProcessesAfterCleanup:0,verified:true}),/copied_cleanup_receipt_rejected/u);
  const ack=p.acknowledge(),before=fs.readFileSync(ack.binding.path);assert.equal(ack.body.status,'acknowledged');
  assert.equal(ack.body.cleanupStatus,'cleanup_unknown');assert.equal(ack.body.cleanupConfirmed,false);
  assert.equal(ack.body.executionStopped,false);assert.equal(ack.body.checkpointSaved,false);
  assert.deepEqual(p.acknowledge(),ack);assert.deepEqual(fs.readFileSync(ack.binding.path),before);
  const other=f.component.createAbortReasonProvider({requestId:r.requestId});assert.equal(other.abortReason(),null);
  assert.throws(()=>other.acknowledge(),/stop_not_consumed/u);f.untouched();
  assert.ok(totalBytes(root)<=262144,'retained fixture budget');
});
test('9 complete Chinese and supplementary-plane reasons respect 511/512/513 UTF-8 byte boundaries',()=>{
  const prefixBytes=Buffer.byteLength(`operator_stop:${'0'.repeat(64)}:`,'utf8');
  assert.equal(prefixBytes,79);assert.equal(L.abortReasonBytes,512);
  const accepted=[
    '停'.repeat(144), '停'.repeat(144)+'a',
    '𐐀'.repeat(108), '𐐀'.repeat(108)+'a',
    '停'.repeat(143)+'𐐀', 'a'.repeat(240),
  ];
  for(const text of accepted){
    const f=fixture(),input={...f.input,reasonText:text},r=f.submit(input);
    const p=f.component.createAbortReasonProvider({requestId:r.requestId}),reason=p.abortReason();
    assert.equal(reason,`operator_stop:${r.requestId}:${text}`); // no identity or text truncation
    assert.ok(Buffer.byteLength(reason,'utf8')<=512);
    assert.equal(Buffer.byteLength(reason,'utf8'),prefixBytes+Buffer.byteLength(text,'utf8'));
    assert.equal(p.abortReason(),null);assert.equal(p.inspect().cleanupConfirmed,false);f.untouched();
  }
  const rejected=['停'.repeat(144)+'ab','𐐀'.repeat(108)+'ab','停'.repeat(143)+'𐐀'+'a','停'.repeat(240)];
  for(const text of rejected){
    const f=fixture();assert.ok(text.length<=240);assert.ok(prefixBytes+Buffer.byteLength(text,'utf8')>512);
    assert.throws(()=>f.submit({...f.input,reasonText:text}),/stop_reason_utf8_limit/u);
    assert.equal(fs.readdirSync(f.evidence).length,0);f.untouched();
  }
  // A validly signed M59 request can exceed the new byte bound: reject it at
  // consumption too, before creating a consumed record or returning a reason.
  const legacy=fixture(),old=legacy.submit(),record=JSON.parse(fs.readFileSync(old.request.path));
  record.payload.reasonText='停'.repeat(240);
  const {mac:_oldMac,...body}=record;
  record.mac=crypto.createHmac('sha256',fixtureSecret).update('ai-painter-owned-stop-request-v1\n').update(JSON.stringify(body)).digest('hex');
  put(old.request.path,record);
  const blocked=legacy.component.createAbortReasonProvider({requestId:old.requestId});
  assert.equal(blocked.abortReason(),null);assert.equal(blocked.inspect().lastError,'stop_reason_utf8_limit');
  assert.equal(fs.readdirSync(legacy.evidence).some(n=>n.endsWith('.consumed.json')),false);legacy.untouched();
  assert.ok(totalBytes(root)<=262144,'retained fixture budget including byte-boundary cases');
});
// Each child imports the real storage module from an explicitly private cwd
// and private AI_PET_WORLD_DATA_ROOT. No mapping callback or permission boolean
// is added to the component. Children never call a native owner or live API.
async function configuredRootCase({mode,moduleUrl,operatorUrl}) {
  const fs=(await import('node:fs')).default,path=(await import('node:path')).default;
  const crypto=(await import('node:crypto')).default,assert=(await import('node:assert/strict')).default;
  const project=fs.realpathSync(process.cwd()),base=path.dirname(project),data=path.resolve(process.env.AI_PET_WORLD_DATA_ROOT);
  const physical=path.join(data,'hot','runtime'),logical=path.join(project,'.runtime');
  const wrong=path.join(base,'wrong-runtime'),evidence=path.join(base,'requests');
  const insidePrivate=p=>{const rel=path.relative(base,path.resolve(p));assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel),'absolute fixture operation leaves private base');};
  for(const p of [data,physical,logical,wrong,evidence])insidePrivate(p);
  fs.mkdirSync(physical,{recursive:true});fs.mkdirSync(wrong);fs.mkdirSync(evidence);
  fs.symlinkSync(mode==='wrong-target'?wrong:physical,logical,process.platform==='win32'?'junction':'dir');
  const {createOwnedStopRequestComponent:create,STOP_REQUEST_LIMITS:L}=await import(moduleUrl);
  const {issueLocalOperatorSession}=await import(operatorUrl);
  assert.deepEqual(L,{sourceClosureContract:'owned-stop-source-closure-v2',inputBytes:4096,recordBytes:8192,records:64,evidenceBytes:262144,failureReserveBytes:65536,
    maximumAgeMs:120000,sourceFiles:256,sourceFileBytes:1048576,sourceTotalBytes:16777216,abortReasonBytes:512});
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  const write=(p,v)=>fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v));
  write(path.join(physical,'source.mjs'),'// private synthetic source, never executed');
  const source={path:'.runtime/source.mjs',sha256:hash(fs.readFileSync(path.join(physical,'source.mjs')))};
  const roles=mode==='overlimit'?Object.fromEntries(Array.from({length:257},(_,i)=>['role'+i,source])):{worker:source};
  write(path.join(physical,'package.json'),{packageIdentity:'mapped-fixture-package',programLineage:Object.fromEntries(Object.entries(roles).map(([k,b])=>[k,b.sha256]))});
  const packageSha=hash(fs.readFileSync(path.join(physical,'package.json')));
  const registry={runId:'mapped-fixture-run',packageId:'mapped-fixture-package',registryRevision:4,executionState:'executing',activeExecution:{
    runId:'mapped-fixture-run',packageId:'mapped-fixture-package',executionState:'executing',processId:123,
    processStartIdentity:'134359011720230661',programLineage:roles}};
  write(path.join(physical,'registry.json'),registry);
  write(path.join(physical,'guard.json'),'private sentinel; never a live guard');
  const sentinelPath=path.join(physical,'guard.json'),guardSha=hash(fs.readFileSync(sentinelPath));
  const registryRaw=fs.readFileSync(path.join(physical,'registry.json'));let currentPath='.runtime/registry.json';
  const input={runId:registry.runId,packageId:registry.packageId,executionPackagePath:'.runtime/package.json',executionPackageSha256:packageSha,
    expectedRegistryRevision:4,supervisorProcessId:123,supervisorProcessStartIdentity:'134359011720230661',
    idempotencyKey:'mapped_fixture_key_00000001',reasonText:'private configured root stop'};
  const call={callId:'mapped-private-call',runId:input.runId,packageId:input.packageId,executionPackageSha256:packageSha,
    supervisorProcessId:input.supervisorProcessId,supervisorProcessStartIdentity:input.supervisorProcessStartIdentity};
  let callerRoot=project;
  if(mode==='unregistered-root'){
    callerRoot=path.join(base,'other-project');insidePrivate(callerRoot);fs.mkdirSync(callerRoot);
    fs.symlinkSync(physical,path.join(callerRoot,'.runtime'),process.platform==='win32'?'junction':'dir');
  }
  const options={projectRoot:callerRoot,evidenceRoot:evidence,readCurrentExecution:()=>({registryPath:currentPath,registrySha256:hash(registryRaw)}),readRetainedNativeCall:()=>call};
  if(mode==='wrong-target'){
    assert.throws(()=>create(options),/stop_runtime_target_mismatch/u);
    return {mode,status:'rejected_wrong_target',requestRecords:fs.readdirSync(evidence).length,productionEligible:false};
  }
  const component=create(options);
  const issued=issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session',{headers:{host:'localhost:3000'}}));
  assert.equal(issued.ok,true);
  const request=new Request('http://localhost:3000/api/ai-console/control/commands',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000',
    cookie:issued.setCookie.split(';')[0],'x-ai-console-csrf':issued.session.csrfToken}});
  if(mode==='unregistered-root'||mode==='overlimit'){
    assert.throws(()=>component.submit({input,operatorRequest:request}),mode==='overlimit'?/stop_source_closure_missing/u:/stop_redirect_rejected/u);
    assert.equal(fs.readdirSync(evidence).length,0);assert.equal(hash(fs.readFileSync(sentinelPath)),guardSha);
    return {mode,status:'rejected',requestRecords:0,sourceFiles:L.sourceFiles,cleanupConfirmed:false};
  }
  const accepted=component.submit({input,operatorRequest:request}),provider=component.createAbortReasonProvider({requestId:accepted.requestId});
  let expectedError=null,guardFile=sentinelPath;
  if(mode==='mapping-change') { process.env.AI_PET_WORLD_DATA_ROOT=wrong;expectedError='stop_storage_configuration_changed'; }
  if(mode==='runtime-link-replace'){
    const retired=path.join(project,'.runtime-retired-link');insidePrivate(retired);insidePrivate(logical);
    fs.renameSync(logical,retired);fs.symlinkSync(physical,logical,process.platform==='win32'?'junction':'dir');expectedError='stop_runtime_root_changed';
  }
  if(mode==='physical-root-replace'){
    const retired=path.join(data,'hot','retired-runtime');insidePrivate(retired);insidePrivate(physical);
    fs.renameSync(physical,retired);fs.mkdirSync(physical);guardFile=path.join(retired,'guard.json');expectedError='stop_runtime_root_changed';
  }
  if(mode==='descendant'){
    const child=path.join(base,'child-target'),redirect=path.join(physical,'redirect');insidePrivate(child);insidePrivate(redirect);
    fs.mkdirSync(child);fs.writeFileSync(path.join(child,'registry.json'),registryRaw);
    fs.symlinkSync(child,redirect,process.platform==='win32'?'junction':'dir');currentPath='.runtime/redirect/registry.json';expectedError='stop_redirect_rejected';
  }
  if(expectedError){
    assert.equal(provider.abortReason(),null);assert.equal(provider.inspect().lastError,expectedError);
    assert.equal(fs.readdirSync(evidence).some(n=>n.endsWith('.consumed.json')),false);
    assert.equal(hash(fs.readFileSync(guardFile)),guardSha);
    return {mode,status:'denied_after_request',errorCode:expectedError,cleanupConfirmed:false,executionStopped:false};
  }
  assert.match(provider.abortReason(),/^operator_stop:[a-f0-9]{64}:private configured root stop$/u);
  assert.equal(provider.abortReason(),null);
  assert.throws(()=>provider.acknowledge({cleanupConfirmed:true}),/copied_cleanup_receipt_rejected/u);
  const ack=provider.acknowledge();assert.equal(ack.body.cleanupStatus,'cleanup_unknown');
  assert.equal(ack.body.cleanupConfirmed,false);assert.equal(ack.body.executionStopped,false);assert.equal(ack.body.checkpointSaved,false);
  assert.equal(hash(fs.readFileSync(guardFile)),guardSha);
  return {mode,status:'fixture_consumed_once',configuredProject:project,physicalRuntime:physical,cleanupStatus:'cleanup_unknown',productionEligible:false,sourceFiles:L.sourceFiles};
}
function runConfiguredCase(mode){
  const base=path.join(fs.realpathSync(root),`configured-${++sequence}-${mode}`),project=path.join(base,'project'),data=path.join(base,'data');
  fs.mkdirSync(project,{recursive:true});
  const config={mode,moduleUrl:new URL('../lib/ai-painter-owned-stop-request-v1.mjs',import.meta.url).href,
    operatorUrl:new URL('../../src/server/ai-console-control/operator-session.ts',import.meta.url).href};
  const script=`const result=await (${configuredRootCase.toString()})(${JSON.stringify(config)});process.stdout.write(JSON.stringify(result));`;
  const child=spawnSync(process.execPath,['--input-type=module','--eval',script],{cwd:project,
    env:{...process.env,AI_PET_WORLD_DATA_ROOT:data,UV_THREADPOOL_SIZE:'1',OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1'},
    timeout:10000,maxBuffer:65536,encoding:'utf8',windowsHide:true,shell:false});
  put(path.join(base,'child.stdout.txt'),child.stdout??'');put(path.join(base,'child.stderr.txt'),child.stderr??'');
  assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);
  const result=JSON.parse(child.stdout.trim());put(path.join(base,'case-result.json'),result);return result;
}
test('10 configured private runtime root redirects successfully; old safety limits and cleanup semantics remain',()=>{
  const result=runConfiguredCase('positive');assert.equal(result.status,'fixture_consumed_once');assert.equal(result.sourceFiles,256);
});
test('11 wrong target and unregistered caller root cannot grant mapping authority',()=>{
  assert.equal(runConfiguredCase('wrong-target').status,'rejected_wrong_target');
  assert.equal(runConfiguredCase('unregistered-root').status,'rejected');
});
test('12 changed configuration, logical root, physical root and descendant junction remain denied',()=>{
  for(const mode of ['mapping-change','runtime-link-replace','physical-root-replace','descendant'])assert.equal(runConfiguredCase(mode).status,'denied_after_request');
});
test('13 mapped 257-role fixture is rejected by the shared 256-role contract',()=>{
  const result=runConfiguredCase('overlimit');assert.equal(result.status,'rejected');assert.equal(result.sourceFiles,256);
});
test('14 real F-root factory construction observes mapping only; no active getter or request is issued',()=>{
  const project=path.resolve(process.cwd()),evidence=path.join(root,'real-root-construction-ledger');fs.mkdirSync(evidence);
  const component=create({projectRoot:project,evidenceRoot:evidence});
  assert.equal(component.trustStatus.productionEligible,false);assert.equal(fs.readdirSync(evidence).length,0);
  put(path.join(root,'real-root-construction-observation.json'),{projectRoot:project,actualRuntimeTarget:fs.realpathSync(path.join(project,'.runtime')),
    constructionAccepted:true,currentIdentityBridgeConnected:false,requestsIssued:0,activeRefreshVerified:false,cleanupConfirmed:false,productionAdopted:false});
});
// Complete synthetic closures keep all roles, including repeated paths.
function sourceClosureFixture(count, sourceBytes=37) {
  const f=fixture(), shared=Buffer.alloc(sourceBytes,0x61), last='// independently bound final role';
  fs.writeFileSync(path.join(f.project,'source.mjs'),shared);put(path.join(f.project,'last.mjs'),last);
  const roles=Object.fromEntries(Array.from({length:count},(_,i)=>[`role${i}`,{
    path:i===count-1?'last.mjs':'source.mjs',sha256:digest(i===count-1?Buffer.from(last):shared)}]));
  const spec={packageIdentity:f.input.packageId,programLineage:Object.fromEntries(Object.entries(roles).map(([k,b])=>[k,b.sha256]))};
  const saveSpec=()=>{
    put(path.join(f.project,'package.json'),spec);f.input.executionPackageSha256=digest(fs.readFileSync(path.join(f.project,'package.json')));
    f.setCall({callId:'closure-private-call',runId:f.input.runId,packageId:f.input.packageId,
      executionPackageSha256:f.input.executionPackageSha256,supervisorProcessId:f.input.supervisorProcessId,
      supervisorProcessStartIdentity:f.input.supervisorProcessStartIdentity});
  };
  const saveRoles=()=>{
    const registry=JSON.parse(fs.readFileSync(path.join(f.project,'registry.json')));
    registry.activeExecution.programLineage=roles;f.mutateRegistry(registry);
  };
  saveSpec();saveRoles();return {...f,roles,spec,saveSpec,saveRoles};
}
test('15 source-closure-v2 accepts complete 179 and 256 roles without granting cleanup',()=>{
  assert.equal(L.sourceClosureContract,'owned-stop-source-closure-v2');assert.equal(L.sourceFiles,256);assert.equal(Object.isFrozen(L),true);
  for(const count of [179,256]){
    const f=sourceClosureFixture(count),accepted=f.submit(),p=f.component.createAbortReasonProvider({requestId:accepted.requestId});
    assert.ok(p.abortReason());assert.equal(p.abortReason(),null);
    assert.equal(Object.keys(f.roles).length,count);assert.equal(Object.keys(f.spec.programLineage).length,count);
    assert.equal(p.acknowledge().body.cleanupStatus,'cleanup_unknown');assert.equal(f.component.trustStatus.productionEligible,false);f.untouched();
  }
});
test('16 all closure roles are checked: 257, missing/tampered last source and unequal role sets reject',()=>{
  for(const mode of ['257','missing-last','tampered-last','missing-binding','wrong-role','extra-role','empty']){
    const f=sourceClosureFixture(mode==='257'?257:256);
    if(mode==='missing-last')fs.renameSync(path.join(f.project,'last.mjs'),path.join(f.project,'preserved-last.mjs'));
    if(mode==='tampered-last')put(path.join(f.project,'last.mjs'),'changed final source');
    if(mode==='missing-binding'){delete f.roles.role255;f.saveRoles();}
    if(mode==='wrong-role'){f.spec.programLineage.other=f.spec.programLineage.role255;delete f.spec.programLineage.role255;f.saveSpec();}
    if(mode==='extra-role'){f.spec.programLineage.extra=f.spec.programLineage.role255;f.saveSpec();}
    if(mode==='empty'){for(const k of Object.keys(f.roles))delete f.roles[k];f.saveRoles();}
    const errors={'257':/stop_source_closure_missing/u,'missing-last':/ENOENT/u,'tampered-last':/stop_source_sha_mismatch/u,
      'missing-binding':/stop_source_closure_mismatch/u,'wrong-role':/stop_source_binding_mismatch/u,
      'extra-role':/stop_source_closure_mismatch/u,'empty':/stop_source_closure_missing/u};
    assert.throws(()=>f.submit(),errors[mode],mode);assert.equal(fs.readdirSync(f.evidence).length,0);f.untouched();
  }
});
test('17 source file and cumulative byte limits charge repeated paths for every role',()=>{
  const oversized=sourceClosureFixture(256,L.sourceFileBytes+1);
  assert.throws(()=>oversized.submit(),/stop_file_size_or_type/u);assert.equal(fs.readdirSync(oversized.evidence).length,0);
  const f=sourceClosureFixture(256,L.sourceTotalBytes/256),shared=f.roles.role0;
  f.roles.role255={...shared};f.spec.programLineage.role255=shared.sha256;f.saveSpec();f.saveRoles();
  assert.equal(f.submit().status,'requested','16MiB exact repeated-role total succeeds');
  fs.writeFileSync(path.join(f.project,'source.mjs'),Buffer.alloc(L.sourceTotalBytes/256+1,0x61));
  const sha=digest(fs.readFileSync(path.join(f.project,'source.mjs')));
  for(const [k,b] of Object.entries(f.roles)){b.sha256=sha;f.spec.programLineage[k]=sha;}
  f.saveSpec();f.saveRoles();
  assert.throws(()=>f.submit({...f.input,idempotencyKey:'closure_budget_key_000002'}),/stop_source_budget/u);
  assert.equal(fs.readdirSync(f.evidence).filter(n=>n.endsWith('.request.json')).length,1);
  assert.equal(fs.readdirSync(f.evidence).some(n=>n.endsWith('.consumed.json')),false);f.untouched();
});
test('18 changed final source after acceptance refuses consumption without a false native error',()=>{
  const f=sourceClosureFixture(256),accepted=f.submit(),p=f.component.createAbortReasonProvider({requestId:accepted.requestId});
  put(path.join(f.project,'last.mjs'),'final role changed after request');
  assert.equal(p.abortReason(),null);assert.equal(p.inspect().lastError,'stop_source_sha_mismatch');
  assert.equal(fs.readdirSync(f.evidence).some(n=>n.endsWith('.consumed.json')),false);
  assert.equal(p.inspect().executionStopped,false);assert.equal(p.inspect().cleanupConfirmed,false);f.untouched();
});
test.after(()=>{
  if(oldSecret===undefined)delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=oldSecret;
});
