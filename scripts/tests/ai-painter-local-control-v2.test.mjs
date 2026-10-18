import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {LOCAL_CONTROL_REGISTRATION, LOCAL_CONTROL_PROTOCOL, parseLocalPrepareArguments,
  verifyPreparationSources, projectLocalPreparationStopTarget, readLocalPreparationStatus, stopLocalPreparation, runLocalPreparationRequest,preparationTerminalBudget,preservePreparationFailure,
  LOCAL_DECODE1_PREPARE_REGISTRATION,LOCAL_TERRAIN_DETAIL_PREPARE_REGISTRATION,localPreparationRoute,localPreparationSelectionFromRequestPath,startLocalPreparation} from '../lib/ai-painter-local-prepare-v1.mjs';
import {withOutputBudget,write as writeBudgeted,directoryBytes} from '../lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';
import {runLocalControlV2,LOCAL_CONTROL_HELP,LOCAL_OPERATOR_DEPLOYMENT_DEPENDENCIES,
 verifyLocalOperatorDeploymentDependencyBindings} from '../run-ai-painter-local-control-v2.mjs';
import {issueLocalOperatorSession} from '../../src/server/ai-console-control/operator-session.ts';
import {prepareExactlyOnceBackgroundSpawn} from '../lib/ai-painter-exactly-once-background-spawn-v1.mjs';
const parent=process.env.AI_PAINTER_LOCAL_PREPARE_COMPONENT_ROOT;
assert.ok(parent&&path.isAbsolute(parent)&&!fs.existsSync(parent),'explicit fresh private component root required');fs.mkdirSync(parent);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const put=(root,name,value)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
let serial=0;const fixture=()=>{const root=path.join(parent,`fixture-${++serial}`);fs.mkdirSync(root);return root;};
const secretBefore=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
const authenticationTestsAllowed=process.env.AI_PAINTER_LOCAL_PREPARE_READONLY_TESTS!=='1';
let privateAuthenticationInitialized=false;
function credentials(){assert.ok(authenticationTestsAllowed,'authentication fixtures disabled in readonly component mode');
 if(!privateAuthenticationInitialized){process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=crypto.randomBytes(48).toString('hex');privateAuthenticationInitialized=true;}
 const issued=issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session',{headers:{host:'localhost:3000'}}));assert.equal(issued.ok,true);return {cookie:issued.setCookie.split(';')[0],csrf:issued.session.csrfToken};}
function requestFixture(){
 const root=fixture(),id=`quality-v2-${crypto.randomUUID()}`,outputRoot=LOCAL_CONTROL_REGISTRATION.candidateBinding&&`.runtime/ai-painter/ecology-regime-quality-executions/${id}`;
 const request={schema:'ai-painter-local-prepare-request-v1',protocol:LOCAL_CONTROL_PROTOCOL,requestId:id,runId:id,packageId:`quality-v2-package-${crypto.randomUUID()}`,outputRoot,
  candidateSelection:LOCAL_CONTROL_REGISTRATION.candidateSelection,candidateBinding:LOCAL_CONTROL_REGISTRATION.candidateBinding,executionPackage:null,automaticRetries:0};
 const relative=`${outputRoot}/local-prepare/request.json`;put(root,relative,request);
 put(root,`${outputRoot}/local-prepare/state.json`,{requestId:id,runId:id,plannedPackageId:request.packageId,stage:'prepared_request_not_cpu_qualified',executionPackage:null});
 return {root,id,request,relative};
}
test('v2 is the exact confirmed registration and retains frozen v1 identity',()=>{
 const declared=JSON.parse(fs.readFileSync('.runtime/ai-painter/controller-parallel-20261011/migration-local-control/r2-v2-implementation-interface.json'));
 assert.deepEqual(LOCAL_CONTROL_REGISTRATION,declared.LOCAL_CONTROL_REGISTRATION);
 assert.equal(sha(fs.readFileSync('.runtime/ai-painter/controller-parallel-20261011/migration-local-control/ns003-shared-before/run-ai-painter-local-control-v1.mjs')),'2574f558d275a7c2d2721a3a37b18b75d879fe4b9bec20198b96e361e1e37d4b');
 assert.match(LOCAL_CONTROL_HELP,/unavailable before a final package/);
});
test('fixed candidate grammar rejects paths, caller hashes, runners, parameters and internal runner invocation',()=>{
 const start=['--protocol',LOCAL_CONTROL_PROTOCOL,'start','--candidate','ecology-quality-v1'];
 assert.deepEqual(parseLocalPrepareArguments(start),{command:'start',candidateSelection:'ecology-quality-v1'});
 assert.deepEqual(parseLocalPrepareArguments(['--protocol',LOCAL_CONTROL_PROTOCOL,'status']),{command:'status'});
 const id=`quality-v2-${crypto.randomUUID()}`;for(const command of ['status','stop'])assert.equal(parseLocalPrepareArguments(['--protocol',LOCAL_CONTROL_PROTOCOL,command,'--request-id',id]).requestId,id);
 for(const args of [start.concat('--sha256','a'.repeat(64)),start.concat('--epochs','1'),start.map(v=>v==='ecology-quality-v1'?'../candidate.json':v),['--protocol','ai-painter-local-control-v1','start'],['--internal-prepare-v2'],['--protocol',LOCAL_CONTROL_PROTOCOL,'exec'],['--protocol',LOCAL_CONTROL_PROTOCOL,'stop']])assert.throws(()=>parseLocalPrepareArguments(args));
});
test('new fixed selection and prefixes remain explicit; unknown selection and cross-route paths reject',()=>{
 assert.deepEqual(parseLocalPrepareArguments(['--protocol',LOCAL_CONTROL_PROTOCOL,'start','--candidate','ecology-decode1-quality-v1']),{command:'start',candidateSelection:'ecology-decode1-quality-v1'});
 const id='decode1-quality-v2-'+crypto.randomUUID(),route=localPreparationRoute('ecology-decode1-quality-v1');
 assert.equal(route.registration,LOCAL_DECODE1_PREPARE_REGISTRATION);assert.equal(route.outputRoot,'.runtime/ai-painter/ecology-decode1-weight-quality-executions');
 for(const command of ['status','stop'])assert.equal(parseLocalPrepareArguments(['--protocol',LOCAL_CONTROL_PROTOCOL,command,'--request-id',id]).requestId,id);
 assert.equal(localPreparationSelectionFromRequestPath(route.outputRoot+'/'+id+'/local-prepare/request.json'),'ecology-decode1-quality-v1');
 for(const value of ['unknown','../candidate','ecology-decode1-weight-quality-v1','__proto__'])assert.throws(()=>localPreparationRoute(value));
 assert.throws(()=>localPreparationSelectionFromRequestPath('.runtime/ai-painter/ecology-regime-quality-executions/'+id+'/local-prepare/request.json'));
 assert.throws(()=>localPreparationSelectionFromRequestPath(route.outputRoot+'/quality-v2-'+crypto.randomUUID()+'/local-prepare/request.json'));
 assert.equal(LOCAL_CONTROL_REGISTRATION.candidateSelection,'ecology-quality-v1');
});
test('new route source closure requires exact new chain/adapter; legacy defaults stay unchanged',()=>{
 const root=fixture(),selection='ecology-decode1-quality-v1',files=['scripts/run-ai-painter-local-control-v2.mjs','scripts/lib/ai-painter-local-prepare-v1.mjs','scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs',
 'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','scripts/lib/ai-painter-ecology-decode1-quality-package-chain-v1.mjs','scripts/run-ai-painter-ecology-decode1-quality-v1.mjs','src/server/ai-console-control/operator-session.ts'];
 const bindings={};for(const [i,p]of files.entries()){const bytes=fs.readFileSync(p);put(root,p,bytes);bindings['role'+i]={path:p,sha256:sha(bytes)}}
 assert.equal(verifyPreparationSources(root,bindings,selection).uniqueFiles,8);assert.throws(()=>verifyPreparationSources(root,bindings),/source_not_registered/);
 const bad={...bindings};delete bad.role5;assert.throws(()=>verifyPreparationSources(root,bad,selection),/source_not_registered/);
 put(root,files[6],'// deliberate private new source drift');assert.throws(()=>verifyPreparationSources(root,bindings,selection),/source_drift/);
});
test('new request prefix/cap/selection/output root is bound before nonce consumption',async()=>{
 const root=fixture(),id='decode1-quality-v2-'+crypto.randomUUID(),route=localPreparationRoute('ecology-decode1-quality-v1'),outputRoot=route.outputRoot+'/'+id;
 const request={schema:'ai-painter-local-prepare-request-v1',protocol:LOCAL_CONTROL_PROTOCOL,capabilityVersion:route.capability,requestId:id,runId:id,
 packageId:route.packagePrefix+crypto.randomUUID(),outputRoot,candidateSelection:route.registration.candidateSelection,candidateBinding:route.registration.candidateBinding,executionPackage:null,automaticRetries:0};
 const relative=outputRoot+'/local-prepare/request.json';put(root,relative,request);put(root,'scripts/run-ai-painter-local-control-v2.mjs','// inert private runner');
 for(const change of [v=>v.capabilityVersion=LOCAL_CONTROL_REGISTRATION.capabilityVersion,v=>v.candidateSelection='ecology-quality-v1',v=>v.outputRoot='.runtime/ai-painter/ecology-regime-quality-executions/'+id]){
  const bad=structuredClone(request);change(bad);put(root,relative,bad);await assert.rejects(runLocalPreparationRequest({root,relativePath:relative,sha256:sha(fs.readFileSync(path.join(root,relative)))}),/identity_mismatch|capability_mismatch/);
 }
 assert.equal(fs.existsSync(path.join(root,outputRoot,'local-prepare','consumed.json')),false);
});
test('new v2 registration missing/duplicate/extra/tampered/legacy rows refuses before preparation or background',{skip:!authenticationTestsAllowed},async()=>{
 for(const rows of [[],[LOCAL_CONTROL_REGISTRATION],[LOCAL_DECODE1_PREPARE_REGISTRATION,LOCAL_DECODE1_PREPARE_REGISTRATION],
  [{...LOCAL_DECODE1_PREPARE_REGISTRATION,extra:true}],[{...LOCAL_DECODE1_PREPARE_REGISTRATION,capabilityVersion:LOCAL_CONTROL_REGISTRATION.capabilityVersion}],
  [{...LOCAL_DECODE1_PREPARE_REGISTRATION,candidateSelection:'ecology-quality-v1'}]]){
  const root=fixture();put(root,'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json',{schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',currentEntrypoints:[],localControlEntrypoints:rows});
  await assert.rejects(startLocalPreparation({root,credentials:credentials(),candidateSelection:'ecology-decode1-quality-v1'}),/capability_not_registered/);
  assert.equal(fs.existsSync(path.join(root,'.runtime')),false);
 }
});
test('real authentication failure refuses start without preparing any files; no production key creation',{skip:!authenticationTestsAllowed},async()=>{
 const root=fixture(),body={credentials:credentials()},original=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
 delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
 try{await assert.rejects(runLocalControlV2({command:'start',candidateSelection:'ecology-quality-v1'},body,root));assert.deepEqual(fs.readdirSync(root),[]);assert.equal(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET,undefined);}finally{process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=original;}
});
test('source gate recomputes actual files and requires the complete preparation entry closure',()=>{
 const root=fixture(),files=['scripts/run-ai-painter-local-control-v2.mjs','scripts/lib/ai-painter-local-prepare-v1.mjs','scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs',
 'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','scripts/lib/ai-painter-ecology-quality-package-chain-v1.mjs','scripts/run-ai-painter-ecology-quality-v1.mjs','src/server/ai-console-control/operator-session.ts'];
 const bindings={};for(const [n,file]of files.entries()){const bytes=fs.readFileSync(file);put(root,file,bytes);bindings[`role${n}`]={path:file,sha256:sha(bytes)};}
 assert.equal(verifyPreparationSources(root,bindings).uniqueFiles,files.length);
 const duplicate={...bindings,duplicate:bindings.role0};assert.equal(verifyPreparationSources(root,duplicate).bytes,verifyPreparationSources(root,bindings).bytes);
 assert.throws(()=>verifyPreparationSources(root,Object.fromEntries(Array.from({length:257},(_,n)=>[`role${n}`,bindings.role0]))),/source_count_limit/);
 const missing={...bindings};delete missing.role0;assert.throws(()=>verifyPreparationSources(root,missing),/source_not_registered/);
 put(root,files[0],'// private deliberate drift');assert.throws(()=>verifyPreparationSources(root,bindings),/source_drift/);
});
test('status remains read-only and preserves unknown official current/preparation evidence',async()=>{
 const f=requestFixture(),before=fs.readdirSync(f.root);
 const state=await readLocalPreparationStatus(f.root,f.id);assert.equal(state.readOnly,true);assert.equal(state.preparation.status,'unknown_or_evidence_conflict');assert.equal(state.preparation.trainingQualificationFromPreparation,false);
 const plain=await runLocalControlV2({command:'status'},null,f.root);assert.equal(plain.preparation,null);assert.equal(plain.readOnly,true);
 assert.deepEqual(fs.readdirSync(f.root),before);
 assert.equal(state.preparation.stopTarget.available,false);assert.equal(state.preparation.stopTarget.input,null);assert.equal(state.preparation.retainedNativeHookVerified,false);
});
test('authenticated preparation stop is unavailable without final package/current training; no PID kill or mutation',{skip:!authenticationTestsAllowed},async()=>{
 const f=requestFixture(),before=fs.readFileSync(path.join(f.root,f.relative));
 await assert.rejects(stopLocalPreparation({root:f.root,requestId:f.id,body:{credentials:credentials(),input:{runId:f.id,packageId:f.request.packageId}}}),/stop_unavailable_before_final_package/);
 assert.deepEqual(fs.readFileSync(path.join(f.root,f.relative)),before);assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards/active.json')),false);
});
test('manual internal request cannot consume a ticket or run CPU without the real same launch nonce',async()=>{
 const f=requestFixture(),runner=LOCAL_CONTROL_REGISTRATION.runnerFile;put(f.root,runner,fs.readFileSync(runner));
 const digest=sha(fs.readFileSync(path.join(f.root,f.relative))),launchRoot=path.join(f.root,f.request.outputRoot,'local-prepare/background-launches',f.id);
 prepareExactlyOnceBackgroundSpawn({projectRoot:f.root,attemptPath:path.join(launchRoot,'spawn-attempt.json'),launchIdentity:f.id,runnerPath:runner,runnerSha256:sha(fs.readFileSync(runner)),runnerArgs:['--internal-prepare-v2','--request',f.relative,'--request-sha256',digest],recordedAtUtc:new Date().toISOString()});
 await assert.rejects(runLocalPreparationRequest({root:f.root,relativePath:f.relative,sha256:digest}),/internal_launch_nonce_required/);
 assert.equal(fs.existsSync(path.join(f.root,f.request.outputRoot,'local-prepare/consumed.json')),false);
});
test('executable v2 errors never echo submitted credentials',{skip:!authenticationTestsAllowed},()=>{
 const marker='private_v2_cookie_must_not_appear';
 for(const input of [`{"credentials":"${marker}"`,JSON.stringify({credentials:{cookie:marker,csrf:marker}})]){
  const child=spawnSync(process.execPath,[path.resolve('scripts/run-ai-painter-local-control-v2.mjs'),'--protocol',LOCAL_CONTROL_PROTOCOL,'start','--candidate','ecology-quality-v1'],{input,encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(child.status,1);assert.equal(child.stdout.includes(marker),false);assert.equal(child.stderr.includes(marker),false);
 }
});
test('terminal budget counts same-Run launch logs and conservatively debits each native call once',()=>{
 const f=requestFixture(),relative=f.request.outputRoot;
 put(f.root,`${relative}/local-prepare/background-launches/${f.id}/stdout.log`,'x'.repeat(262144));
 const uuid=crypto.randomUUID(),nativeRelative=`${relative}/owned-cpu-${uuid}`;
 const receipt={schema:'detail-weight-live-native-owner-receipt-v1',proof:{bindingBase64:'synthetic-budget-call-only'},streamBytes:{stdout:1000,stderr:2000}};
 put(f.root,`${nativeRelative}/original-receipt.json`,receipt);put(f.root,`${nativeRelative}/release-receipt.json`,receipt);
 const native={nativeAccountingRoots:()=>[relative]},measured=preparationTerminalBudget(f.root,f.request,native,8388608);
 assert.equal(measured.originalMaximum,8388608);assert.equal(measured.streamDebit,3000);assert.equal(measured.maximum,8388608-3000);
 assert.ok(directoryBytes(path.join(f.root,relative))>=262144);
 const before=directoryBytes(path.join(f.root,relative));
 assert.throws(()=>withOutputBudget({...measured,maximum:before+2,reserveBytes:0},()=>writeBudgeted(f.root,`${relative}/local-prepare/terminal.json`,{status:'fixture_only'})),/total output reserve/u);
 assert.equal(fs.existsSync(path.join(f.root,relative,'local-prepare/terminal.json')),false,'budget denial cannot claim a completed terminal');
 assert.throws(()=>preparationTerminalBudget(f.root,f.request,native,8388609),/terminal_budget_invalid/);
});
test('terminal evidence and diagnostic stream failures preserve the exact original pipeline error',()=>{
 const original=Object.assign(Error('original_pipeline_failure'),{code:'fixture_original'}),write=process.stderr.write;
 try{
  let diagnostic='';process.stderr.write=chunk=>{diagnostic+=chunk;return true;};
  assert.throws(()=>preservePreparationFailure(original,()=>{throw Error('x'.repeat(9000));}),error=>error===original);
  const record=JSON.parse(diagnostic);assert.equal(record.originalErrorPreserved,true);assert.equal(record.detail.length,2048);
  process.stderr.write=()=>{throw Error('diagnostic_stream_identity_failed');};
  assert.throws(()=>preservePreparationFailure(original,()=>{throw Error('terminal_budget_failed');}),error=>error===original);
  assert.throws(()=>preservePreparationFailure(original,()=>{}),error=>error===original);
 }finally{process.stderr.write=write;}
});
function stopTargetFixture(){
 const f=requestFixture(),packagePath=`.runtime/ai-painter/autonomous-closed-loop-packages/${f.request.packageId}/package.json`;
 const spec={packageIdentity:f.request.packageId,capabilityVersion:LOCAL_CONTROL_REGISTRATION.capabilityVersion,outputRoot:f.request.outputRoot};
 put(f.root,packagePath,spec);const bytes=fs.readFileSync(path.join(f.root,packagePath));
 const state={requestId:f.id,runId:f.id,plannedPackageId:f.request.packageId,stage:'quality_loop_running',executionPackage:{path:packagePath,sha256:sha(bytes)}};
 const active={runId:f.id,packageId:f.request.packageId,executionState:'executing',processId:4242,processStartIdentity:'4242:2026-10-12T00:00:00.000Z'};
 const current={ok:true,status:'verified',registry:{capabilityVersion:LOCAL_CONTROL_REGISTRATION.capabilityVersion,registryRevision:41,runId:f.id,packageId:f.request.packageId,executionState:'executing',activeExecution:active}};
 for(const suffix of ['','/inbox','/requests'])fs.mkdirSync(path.join(f.root,f.request.outputRoot,'operator-stop-control'+suffix),{recursive:true});
 return {...f,packagePath,spec,state,current};
}
function treeSnapshot(root){
 const result={};const visit=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())visit(file);else result[path.relative(root,file)]=sha(fs.readFileSync(file));}};visit(root);return result;
}
test('stop target projection returns the seven validated fields without credentials, key generation or writes',()=>{
 const authenticationBefore=privateAuthenticationInitialized,keyBefore=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
 const f=stopTargetFixture(),before=treeSnapshot(f.root),projected=projectLocalPreparationStopTarget(f.root,f);
 assert.equal(projected.available,true);assert.equal(projected.status,'verified_submission_target_only');assert.equal(projected.retainedNativeHookVerified,false);
 assert.equal(projected.freshAuthenticationRequired,true);assert.deepEqual(projected.requiredOperatorFields,['idempotencyKey','reasonText']);
 assert.deepEqual(projected.input,{runId:f.id,packageId:f.request.packageId,executionPackagePath:f.packagePath,executionPackageSha256:f.state.executionPackage.sha256,
 expectedRegistryRevision:41,supervisorProcessId:4242,supervisorProcessStartIdentity:f.current.registry.activeExecution.processStartIdentity});
 assert.deepEqual(treeSnapshot(f.root),before);assert.equal(privateAuthenticationInitialized,authenticationBefore);assert.ok(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET===keyBefore);
});
test('stop target projection rejects unverified, idle, non-executing, mismatched and malformed current identities',()=>{
 const f=stopTargetFixture();
 const changes=[v=>v.current.ok=false,v=>v.current.status='unknown_or_stale',v=>v.current.registry.activeExecution=null,
 v=>v.current.registry.executionState='validating',v=>v.current.registry.activeExecution.executionState='validating',
 v=>v.current.registry.runId='different-run-id',v=>v.current.registry.packageId='different-package-id',v=>v.current.registry.capabilityVersion='other',
 v=>v.current.registry.activeExecution.runId='different-run-id',v=>v.current.registry.activeExecution.packageId='different-package-id',
 v=>v.current.registry.registryRevision=0,v=>v.current.registry.activeExecution.processId=0,
 v=>v.current.registry.activeExecution.processStartIdentity=null,v=>v.current.registry.activeExecution.processStartIdentity='invalid\ncreation'];
 for(const change of changes){const altered=structuredClone(f);change(altered);const projected=projectLocalPreparationStopTarget(f.root,altered);assert.equal(projected.available,false);assert.equal(projected.input,null);assert.equal(projected.retainedNativeHookVerified,false);}
});
test('stop target projection rejects incomplete, conflicting and terminal preparation states',()=>{
 const f=stopTargetFixture();
 const changes=[v=>v.state.executionPackage=null,v=>v.state.executionPackage=false,v=>delete v.state.executionPackage,
 v=>v.state.requestId='other-request',v=>v.state.runId='other-run',v=>v.state.plannedPackageId='other-package',v=>v.state.stage='failed_closed',v=>v.state.stage='completed',
 v=>v.state.stage='cpu_running',v=>v.state.stage='unknown',v=>v.processTerminal={exitCode:0},v=>v.processTerminal={exitCode:1}];
 for(const change of changes){const altered=structuredClone(f);change(altered);assert.equal(projectLocalPreparationStopTarget(f.root,altered).available,false);}
});
test('stop target projection recomputes package bytes and rejects forged paths, hashes and identities',()=>{
 const f=stopTargetFixture(),before=treeSnapshot(f.root);
 for(const binding of [{path:'../escape.json',sha256:'a'.repeat(64)},{path:f.packagePath,sha256:'a'.repeat(64)},{path:f.packagePath,sha256:'invalid'},
 {path:'.runtime/ai-painter/autonomous-closed-loop-packages/another-package/package.json',sha256:f.state.executionPackage.sha256}]){
  const altered=structuredClone(f);altered.state.executionPackage=binding;assert.equal(projectLocalPreparationStopTarget(f.root,altered).available,false);
 }
 assert.deepEqual(treeSnapshot(f.root),before);
 for(const patch of [{packageIdentity:'other-package'},{capabilityVersion:'other-capability'},{outputRoot:f.request.outputRoot+'-other'}]){
  put(f.root,f.packagePath,{...f.spec,...patch});const altered=structuredClone(f);altered.state.executionPackage.sha256=sha(fs.readFileSync(path.join(f.root,f.packagePath)));
  const projected=projectLocalPreparationStopTarget(f.root,altered);assert.equal(projected.available,false);assert.equal(projected.errorCode,'local_stop_target_package_identity_mismatch');
 }
 put(f.root,f.packagePath,'{');const altered=structuredClone(f);altered.state.executionPackage.sha256=sha(fs.readFileSync(path.join(f.root,f.packagePath)));
 assert.equal(projectLocalPreparationStopTarget(f.root,altered).errorCode,'local_stop_target_evidence_unreadable');
});
test('stop target projection requires an existing ledger and preserves evidence when package becomes unreadable',()=>{
 const f=stopTargetFixture(),other=stopTargetFixture();
 fs.renameSync(path.join(f.root,f.request.outputRoot,'operator-stop-control/inbox'),path.join(f.root,f.request.outputRoot,'operator-stop-control/inbox-preserved'));
 const before=treeSnapshot(f.root),projected=projectLocalPreparationStopTarget(f.root,f);assert.equal(projected.available,false);assert.equal(projected.input,null);assert.deepEqual(treeSnapshot(f.root),before);
 fs.renameSync(path.join(other.root,other.packagePath),path.join(other.root,other.packagePath+'.preserved'));
 const second=treeSnapshot(other.root);assert.equal(projectLocalPreparationStopTarget(other.root,other).available,false);assert.deepEqual(treeSnapshot(other.root),second);
});
test('stop target projection pins revision and creation identity per snapshot without claiming live stop authority',()=>{
 const authenticationBefore=privateAuthenticationInitialized,keyBefore=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
 const f=stopTargetFixture(),first=projectLocalPreparationStopTarget(f.root,f);assert.equal(first.available,true);
 f.current.registry.registryRevision=42;f.current.registry.activeExecution.processStartIdentity='4242:2026-10-12T00:00:01.000Z';
 const second=projectLocalPreparationStopTarget(f.root,f);assert.equal(second.available,true);assert.notEqual(first.input.expectedRegistryRevision,second.input.expectedRegistryRevision);
 assert.notEqual(first.input.supervisorProcessStartIdentity,second.input.supervisorProcessStartIdentity);assert.equal(first.retainedNativeHookVerified,false);assert.equal(second.retainedNativeHookVerified,false);
 assert.equal(privateAuthenticationInitialized,authenticationBefore);assert.ok(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET===keyBefore);
});
// Explicit fictitious deployment values are confined to fresh private files or
// child memory; no authentication/session/start/native operation occurs here.
const deploymentA='fixture-only-deployment-A-000000000000000000000000';
const deploymentB='fixture-only-deployment-B-000000000000000000000000';
function deploymentCase({files={},processKey,expectedKey,errorCode,status=false,internal=false,both=false,nodeEnv='production',directoryFile=false,hardlinkFile=false}) {
 const root=fixture();for(const [name,value] of Object.entries(files))put(root,name,value);
 if(directoryFile)fs.mkdirSync(path.join(root,'.env.local'));
 if(hardlinkFile)fs.linkSync(path.join(root,'.env.local'),path.join(root,'preserved-env-hardlink'));
 const env={...process.env,UV_THREADPOOL_SIZE:'1',NODE_ENV:nodeEnv,AI_PAINTER_LOCAL_PREPARE_COMPONENT_ROOT:parent,
  R7_TEST_ROOT:root,R7_EXPECTED_KEY:expectedKey??'',R7_EXPECTED_ERROR:errorCode??'',R7_TEST_KIND:status?'status':internal?'internal':'external',R7_TEST_BOTH:both?'1':'0'};
 delete env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;delete env.__NEXT_PROCESSED_ENV;
 if(processKey!==undefined)env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=processKey;
 const script=String.raw`
import assert from 'node:assert/strict';
import {prepareLocalControlV2InvocationForIsolatedTests} from './scripts/run-ai-painter-local-control-v2.mjs';
const keyName='AI_PET_WORLD_OPERATOR_SESSION_SECRET',before={...process.env};
const args=kind=>kind==='status'?['--protocol','ai-painter-local-control-v2','status']:kind==='internal'
 ?['--internal-prepare-v2','--request','not-executed-request','--request-sha256','a'.repeat(64)]
 :['--protocol','ai-painter-local-control-v2','start','--candidate','ecology-quality-v1'];
let result,errorCode=null;
try{result=prepareLocalControlV2InvocationForIsolatedTests(args(process.env.R7_TEST_KIND),process.env.R7_TEST_ROOT);}catch(error){errorCode=error.message;}
assert.ok(errorCode===(process.env.R7_EXPECTED_ERROR||null),'unexpected static configuration error');
if(errorCode){assert.ok(process.env[keyName]===before[keyName],'failure changed process signing value');}
else if(process.env.R7_TEST_KIND==='status'){assert.equal(result.deployment,undefined);assert.ok(process.env[keyName]===before[keyName],'status adopted signing configuration');}
else{assert.ok(process.env[keyName]===process.env.R7_EXPECTED_KEY,'configured value mismatch');assert.equal(result.executionNotInvoked,true);assert.equal(result.deployment.configured,true);}
for(const name of new Set([...Object.keys(before),...Object.keys(process.env)])){if(name!==keyName)assert.ok(before[name]===process.env[name],'loader changed another process setting');}
if(process.env.R7_TEST_BOTH==='1'){
 const second=prepareLocalControlV2InvocationForIsolatedTests(args('internal'),process.env.R7_TEST_ROOT);
 assert.deepEqual(second.deployment,result.deployment);assert.equal(second.internal,true);assert.equal(second.executionNotInvoked,true);
}
console.log(JSON.stringify({ok:true,errorCode,configured:result?.deployment?.configured??false,source:result?.deployment?.source??null,mode:result?.deployment?.mode??null,both:process.env.R7_TEST_BOTH==='1',executionCalls:0,sessionCalls:0}));
`;
 const child=spawnSync(process.execPath,['--input-type=module'],{input:script,cwd:process.cwd(),env,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});
 const output=(child.stdout??'')+(child.stderr??'');
 assert.ok(!output.includes(deploymentA)&&!output.includes(deploymentB),'fictitious signing value leaked into child output');
 assert.equal(child.status,0,output.slice(-2048));
 const result=JSON.parse(child.stdout.trim());assert.equal(result.executionCalls,0);assert.equal(result.sessionCalls,0);return result;
}
test('deployment config refuses absent key without inventing a signing value',()=>{
 assert.equal(deploymentCase({errorCode:'local_v2_deployment_key_missing'}).errorCode,'local_v2_deployment_key_missing');
});
test('deployment config adopts existing project value for external and internal paths through one loader',()=>{
 const result=deploymentCase({files:{'.env.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`},expectedKey:deploymentA,both:true});
 assert.equal(result.source,'project_env');assert.equal(result.both,true);
});
test('deployment config internal path adopts project configuration without caller environment transfer',()=>{
 assert.equal(deploymentCase({files:{'.env.production.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`},expectedKey:deploymentA,internal:true}).configured,true);
});
test('deployment config uses official quoting and expansion while restoring unrelated import-time environment',()=>{
 assert.equal(deploymentCase({files:{'.env.local':`R7_FILE_VALUE=${deploymentA}\nAI_PET_WORLD_OPERATOR_SESSION_SECRET="\${R7_FILE_VALUE}"\nAI_PET_WORLD_DATA_ROOT=D:/fixture-not-adopted\n`},expectedKey:deploymentA}).configured,true);
});
test('deployment config preserves process priority over differing file values',()=>{
 const result=deploymentCase({files:{'.env.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentB}\n`},processKey:deploymentA,expectedKey:deploymentA});assert.equal(result.source,'process');
});
test('deployment config accepts valid process deployment without any environment file',()=>{
 assert.equal(deploymentCase({processKey:deploymentA,expectedKey:deploymentA}).source,'process');
});
test('deployment config refuses short or blank process values instead of falling back to a valid file',()=>{
 for(const processKey of ['short',''])assert.equal(deploymentCase({files:{'.env.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`},processKey,errorCode:'local_v2_deployment_key_short'}).configured,false);
});
test('deployment config refuses short or conflicting file values with static errors',()=>{
 deploymentCase({files:{'.env.local':'AI_PET_WORLD_OPERATOR_SESSION_SECRET=short\n'},errorCode:'local_v2_deployment_key_short'});
 deploymentCase({files:{'.env.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`,'.env':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentB}\n`},errorCode:'local_v2_deployment_key_conflict'});
});
test('deployment config accepts equal selected file definitions without printing fingerprints',()=>{
 deploymentCase({files:{'.env.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`,'.env':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`},expectedKey:deploymentA});
});
test('deployment config rejects directories, oversized data and invalid UTF8 without leaking content',()=>{
 deploymentCase({directoryFile:true,errorCode:'local_v2_deployment_file_invalid'});
 deploymentCase({files:{'.env.local':'x'.repeat(65537)},errorCode:'local_v2_deployment_file_invalid'});
 deploymentCase({files:{'.env.local':Buffer.from([0xff,0xfe,0xff])},errorCode:'local_v2_deployment_file_encoding_invalid'});
 deploymentCase({files:{'.env.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`},hardlinkFile:true,errorCode:'local_v2_deployment_file_invalid'});
});
test('deployment config status never loads or requires signing configuration even if files or mode are invalid',()=>{
 deploymentCase({directoryFile:true,nodeEnv:'invalid-mode',status:true});
 deploymentCase({files:{'.env.local':'AI_PET_WORLD_OPERATOR_SESSION_SECRET=short\n'},status:true});
});
test('deployment config follows installed development and test filename semantics',()=>{
 deploymentCase({files:{'.env.development.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`},nodeEnv:'development',expectedKey:deploymentA});
 deploymentCase({files:{'.env.test.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`,'.env.local':`AI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentB}\n`},nodeEnv:'test',expectedKey:deploymentA});
});
test('deployment config malformed contents, bad mode and BOM cases remain bounded and use official interpretation',()=>{
 deploymentCase({files:{'.env.local':'this is not a dotenv assignment\n'},errorCode:'local_v2_deployment_key_missing'});
 deploymentCase({nodeEnv:'unsupported',errorCode:'local_v2_deployment_mode_invalid'});
 deploymentCase({files:{'.env.local':`\ufeffAI_PET_WORLD_OPERATOR_SESSION_SECRET=${deploymentA}\n`},expectedKey:deploymentA});
});
test('deployment dependency closure requires both installed official files and their actual source hashes',()=>{
 const bindings=Object.fromEntries(LOCAL_OPERATOR_DEPLOYMENT_DEPENDENCIES.map((dependency,i)=>['dependency'+i,{path:dependency.path,sha256:sha(fs.readFileSync(dependency.path))}]));
 assert.deepEqual(verifyLocalOperatorDeploymentDependencyBindings(bindings),{dependenciesVerified:2});
 assert.throws(()=>verifyLocalOperatorDeploymentDependencyBindings({}),/dependency_not_frozen/);
 const drift=structuredClone(bindings);drift.dependency1.sha256='0'.repeat(64);assert.throws(()=>verifyLocalOperatorDeploymentDependencyBindings(drift),/dependency_not_frozen/);
});
test.after(()=>{if(secretBefore===undefined)delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=secretBefore;});

test('TD fixed preparation: new fixed selection and prefixes remain explicit; unknown selection and cross-route paths reject',()=>{
 assert.deepEqual(parseLocalPrepareArguments(['--protocol',LOCAL_CONTROL_PROTOCOL,'start','--candidate','ecology-terrain-detail-quality-v1']),{command:'start',candidateSelection:'ecology-terrain-detail-quality-v1'});
 const id='terrain-detail-quality-v2-'+crypto.randomUUID(),route=localPreparationRoute('ecology-terrain-detail-quality-v1');
 assert.equal(route.registration,LOCAL_TERRAIN_DETAIL_PREPARE_REGISTRATION);assert.equal(route.outputRoot,'.runtime/ai-painter/ecology-terrain-detail-weight-quality-executions');
 for(const command of ['status','stop'])assert.equal(parseLocalPrepareArguments(['--protocol',LOCAL_CONTROL_PROTOCOL,command,'--request-id',id]).requestId,id);
 assert.equal(localPreparationSelectionFromRequestPath(route.outputRoot+'/'+id+'/local-prepare/request.json'),'ecology-terrain-detail-quality-v1');
 for(const value of ['unknown','../candidate','ecology-terrain-detail-weight-quality-v1','__proto__'])assert.throws(()=>localPreparationRoute(value));
 assert.throws(()=>localPreparationSelectionFromRequestPath('.runtime/ai-painter/ecology-regime-quality-executions/'+id+'/local-prepare/request.json'));
 assert.throws(()=>localPreparationSelectionFromRequestPath(route.outputRoot+'/quality-v2-'+crypto.randomUUID()+'/local-prepare/request.json'));
 assert.equal(LOCAL_CONTROL_REGISTRATION.candidateSelection,'ecology-quality-v1');
});
test('TD fixed preparation: new route source closure requires exact new chain/adapter; legacy defaults stay unchanged',()=>{
 const root=fixture(),selection='ecology-terrain-detail-quality-v1',files=['scripts/run-ai-painter-local-control-v2.mjs','scripts/lib/ai-painter-local-prepare-v1.mjs','scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs',
 'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','scripts/lib/ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs','scripts/run-ai-painter-ecology-terrain-detail-quality-v1.mjs','src/server/ai-console-control/operator-session.ts'];
 const bindings={};for(const [i,p]of files.entries()){const bytes=fs.readFileSync(p);put(root,p,bytes);bindings['role'+i]={path:p,sha256:sha(bytes)}}
 assert.equal(verifyPreparationSources(root,bindings,selection).uniqueFiles,8);assert.throws(()=>verifyPreparationSources(root,bindings),/source_not_registered/);
 const bad={...bindings};delete bad.role5;assert.throws(()=>verifyPreparationSources(root,bad,selection),/source_not_registered/);
 put(root,files[6],'// deliberate private new source drift');assert.throws(()=>verifyPreparationSources(root,bindings,selection),/source_drift/);
});
test('TD fixed preparation: new request prefix/cap/selection/output root is bound before nonce consumption',async()=>{
 const root=fixture(),id='terrain-detail-quality-v2-'+crypto.randomUUID(),route=localPreparationRoute('ecology-terrain-detail-quality-v1'),outputRoot=route.outputRoot+'/'+id;
 const request={schema:'ai-painter-local-prepare-request-v1',protocol:LOCAL_CONTROL_PROTOCOL,capabilityVersion:route.capability,requestId:id,runId:id,
 packageId:route.packagePrefix+crypto.randomUUID(),outputRoot,candidateSelection:route.registration.candidateSelection,candidateBinding:route.registration.candidateBinding,executionPackage:null,automaticRetries:0};
 const relative=outputRoot+'/local-prepare/request.json';put(root,relative,request);put(root,'scripts/run-ai-painter-local-control-v2.mjs','// inert private runner');
 for(const change of [v=>v.capabilityVersion=LOCAL_CONTROL_REGISTRATION.capabilityVersion,v=>v.candidateSelection='ecology-quality-v1',v=>v.outputRoot='.runtime/ai-painter/ecology-regime-quality-executions/'+id]){
  const bad=structuredClone(request);change(bad);put(root,relative,bad);await assert.rejects(runLocalPreparationRequest({root,relativePath:relative,sha256:sha(fs.readFileSync(path.join(root,relative)))}),/identity_mismatch|capability_mismatch/);
 }
 assert.equal(fs.existsSync(path.join(root,outputRoot,'local-prepare','consumed.json')),false);
});
test('TD fixed preparation: new v2 registration missing/duplicate/extra/tampered/legacy rows refuses before preparation or background',{skip:!authenticationTestsAllowed},async()=>{
 for(const rows of [[],[LOCAL_CONTROL_REGISTRATION],[LOCAL_TERRAIN_DETAIL_PREPARE_REGISTRATION,LOCAL_TERRAIN_DETAIL_PREPARE_REGISTRATION],
  [{...LOCAL_TERRAIN_DETAIL_PREPARE_REGISTRATION,extra:true}],[{...LOCAL_TERRAIN_DETAIL_PREPARE_REGISTRATION,capabilityVersion:LOCAL_CONTROL_REGISTRATION.capabilityVersion}],
  [{...LOCAL_TERRAIN_DETAIL_PREPARE_REGISTRATION,candidateSelection:'ecology-quality-v1'}]]){
  const root=fixture();put(root,'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json',{schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',currentEntrypoints:[],localControlEntrypoints:rows});
  await assert.rejects(startLocalPreparation({root,credentials:credentials(),candidateSelection:'ecology-terrain-detail-quality-v1'}),/capability_not_registered/);
  assert.equal(fs.existsSync(path.join(root,'.runtime')),false);
 }
});
