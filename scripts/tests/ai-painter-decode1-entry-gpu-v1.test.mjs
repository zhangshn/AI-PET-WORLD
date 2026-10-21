// Synthetic source/ledger/ABI fixtures only; never calls a real owned worker.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {POLICY,bindPolicy,CAPABILITY,MODEL,validatePolicy,makePackage,validatePackage,validateRequest,
  validateWorkerResult,validateCpuAcceptance,sequenceQualification,createAccounting,createHostPaths,
  collectSourceClosure,requireDeadline,validateGpuResources} from '../qualify-ai-painter-decode1-entry-gpu-v1.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex'),copy=v=>structuredClone(v);
const policyRaw=fs.readFileSync(path.join(ROOT,POLICY.path)),p=JSON.parse(policyRaw),bound=bindPolicy({path:POLICY.path,sha256:hash(policyRaw)});
const runId='decode1-entry-qualification-00000000-0000-4000-8000-000000000001';
const packageBinding={path:p.outputRoot+'/'+runId+'/package.json',sha256:'a'.repeat(64)};
function privateRoot(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'decode1-qualification-host-fixture-'));
  t.after(()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('decode1-qualification-host-fixture-'));
    fs.rmSync(root,{recursive:true});});return root;}
function packageFixture(){
  const names=[...Object.values(p.implementations),...p.frozenCpuModelBindings.map(b=>b.path),p.metadataCanonicalProgram.path,
    'scripts/tests/ai-painter-qualification-owned-worker-boundary.test.mjs','scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs'];
  const rows=[...new Set(names)].map(name=>({path:name,sha256:'b'.repeat(64)}));
  for(const b of [...p.frozenCpuModelBindings,p.metadataCanonicalProgram])Object.assign(rows.find(row=>row.path===b.path),b);
  return makePackage(p,runId,rows,{path:process.execPath,sha256:'c'.repeat(64)},p.nodeInterpreter);
}
function requestFixture(mode){return {schemaVersion:p.wireProtocols.request,runId,mode,outputRoot:p.outputRoot+'/'+runId,policy:copy(bound),
  package:packageBinding,deadlineUnixMs:Date.now()+60000,...(mode==='gpu_qualify'?{cpuAcceptance:{path:p.outputRoot+'/'+runId+'/cpu-acceptance.json',sha256:'d'.repeat(64)}}:{})};}
function workerFixture(mode){const gpu=mode==='gpu_qualify';const counts={forwardAttempted:gpu?48:0,forwardCompleted:gpu?48:0,
  generatorAttempted:gpu?240:0,generatorCompleted:gpu?240:0,discriminatorAttempted:gpu?48:0,discriminatorCompleted:gpu?48:0,
  optimizerConstruction:0,optimizerUpdates:0,cudaCalls:gpu?20:0,cudaInitializationAttempted:gpu?1:0,cudaInitializationCompleted:gpu?1:0};
  const sampleIds=Array.from({length:gpu?48:8},(_,i)=>(gpu?'train-':'validation-')+i),graph=Array.from({length:108},(_,i)=>({name:'parameter'+i,shape:[1]}));
  graph[48]={name:p.target.parameterName,shape:p.target.weightShape};const digest={generator:'e'.repeat(64),discriminator:'f'.repeat(64)};
  return {schemaVersion:p.wireProtocols.worker,runId,mode,policy:bound,package:packageBinding,...p.qualification,
    status:gpu?'gpu_qualification_passed':'cpu_preparation_passed',executionState:'completed',counts,
    stateDigestBefore:digest,stateDigestAfter:copy(digest),modelIdentity:{capabilityVersion:MODEL,parameterCount:108,parameterElements:2242687,graph,initialState:copy(digest)},
    cpuAffinity:[0,1],sampleIds,completedSampleIds:gpu?copy(sampleIds):[],cudaInitialized:gpu,
    ...(!gpu?{componentTests:{status:'passed',testsRun:3,failures:0,errors:0,skipped:0,realModelAutograd:false}}:{})};}

test('exact registered route and immutable package stay qualification-only',()=>{
  validatePolicy(p);assert.equal(p.capabilityVersion,CAPABILITY);validatePackage(packageFixture(),p);assert.deepEqual(bindPolicy(bound),bound);
  assert.throws(()=>bindPolicy({path:bound.path,sha256:'0'.repeat(64)}));
});
for(const [name,mutate] of [
  ['training',q=>q.executionBoundary.training=true],['retry',q=>q.resources.automaticRetries=1],['CPU time',q=>q.resources.cpuPreparationSeconds=241],
  ['GPU time',q=>q.resources.gpuQualificationSeconds=721],['threads',q=>q.resources.threads=3],['old260',q=>q.sourceClosure.old260ExceptionInherited=true],
  ['source count',q=>q.sourceClosure.maximumEntries=260],['source bytes',q=>q.sourceClosure.maximumTotalBytes++],
  ['model scope',q=>q.target.parameterIndex=88],['train split',q=>q.gpuQualification.sampleSplit='validation'],
  ['old qualification',q=>q.gpuQualification.oldQualificationReusable=true],['CPU train image',q=>q.cpuPreparation.trainImageContentRead=true],
  ['formal',q=>q.formalSpecification.version='AI-PAINTER-SPEC-1.91'],['frozen operator',q=>q.frozenCpuModelBindings[0].sha256='0'.repeat(64)],
])test('policy rejects '+name,()=>{const q=copy(p);mutate(q);assert.throws(()=>validatePolicy(q));});
test('package and request exact fields prevent scope, phase, identity and legacy acceptance substitution',()=>{
  const pkg=packageFixture();for(const mutate of [v=>v.resources.threads=3,v=>v.scope.trainSamples=1,v=>v.policy.sha256='0'.repeat(64),
    v=>v.extra='training',v=>v.programBindings.push(v.programBindings[0]),v=>v.programBindings.pop()]){
    const broken=copy(pkg);mutate(broken);assert.throws(()=>validatePackage(broken,p));}
  for(const mode of p.allowedModes)validateRequest(requestFixture(mode),p,pkg);
  for(const mutate of [v=>v.mode='train',v=>v.outputRoot+='/other',v=>v.policy.sha256='0'.repeat(64),v=>v.deadlineUnixMs=1,
    v=>v.cpuAcceptance={path:'private/old.json',sha256:'0'.repeat(64)}]){
    const broken=requestFixture('cpu_prepare');mutate(broken);assert.throws(()=>validateRequest(broken,p,pkg));}
});
test('CPU and GPU real-count ABIs, finite state identity and original splits cannot substitute',()=>{
  for(const mode of p.allowedModes){const result=workerFixture(mode);assert(validateWorkerResult(result,p,mode,packageBinding,runId,result.sampleIds));}
  for(const mutate of [v=>v.counts.generatorCompleted=239,v=>v.counts.optimizerUpdates=1,v=>v.counts.cudaInitializationCompleted=0,
    v=>v.stateDigestAfter.generator='0'.repeat(64),v=>v.trainingAllowed=true,v=>v.completedSampleIds.pop(),v=>v.modelIdentity.parameterCount=107]){
    const result=workerFixture('gpu_qualify');mutate(result);assert.throws(()=>validateWorkerResult(result,p,'gpu_qualify',packageBinding,runId));}
  const cpu=workerFixture('cpu_prepare');cpu.counts.forwardAttempted=1;assert.throws(()=>validateWorkerResult(cpu,p,'cpu_prepare',packageBinding,runId));
  const failed=workerFixture('gpu_qualify');failed.status='failed_closed';failed.executionState='failed_closed';failed.firstError={message:'first scalar gate'};
  assert.equal(validateWorkerResult(failed,p,'gpu_qualify',packageBinding,runId),false);
});
test('CPU acceptance binds own immutable package and returned receipt, not historical status',()=>{
  const value={schemaVersion:'decode1-entry-gpu-qualification-cpu-acceptance-v1',status:'cpu_preparation_passed',runId,
    policy:bound,package:packageBinding,worker:workerFixture('cpu_prepare'),ownedReceipt:{path:p.outputRoot+'/'+runId+'/cpu-owned-receipt.json',sha256:'d'.repeat(64)}};
  validateCpuAcceptance(value,p,packageBinding,runId);
  for(const mutate of [v=>v.package.sha256='0'.repeat(64),v=>v.runId='old-run',v=>v.worker.componentTests.skipped=1,v=>v.ownedReceipt={cleanupConfirmed:true}]){
    const broken=copy(value);mutate(broken);assert.throws(()=>validateCpuAcceptance(broken,p,packageBinding,runId));}
});
test('CPU failure stops GPU, both phases run once and GPU success does not start training',async()=>{
  const events=[];await assert.rejects(sequenceQualification(async()=>{events.push('cpu');throw Error('CPU failed');},async()=>events.push('gpu')),/CPU failed/);
  assert.deepEqual(events,['cpu']);await assert.rejects(sequenceQualification(async()=>({status:'failed_closed'}),async()=>events.push('gpu')),/CPU did not pass/);
  events.length=0;const value=await sequenceQualification(async()=>{events.push('cpu');return {status:'cpu_preparation_passed'};},async()=>{events.push('gpu');return {status:'qualification_completed_training_not_started'};});
  assert.deepEqual(events,['cpu','gpu']);assert.equal(value.status,'qualification_completed_training_not_started');
});
test('phase ledger counts final writes and shared claim once, preserves failure reserve',t=>{
  const root=privateRoot(t),absolute=path.join(root,p.outputRoot,runId);fs.mkdirSync(absolute,{recursive:true});
  fs.writeFileSync(path.join(root,p.attemptClaimPath),'claim');const a=createAccounting(root,absolute,p);a.begin('cpu_prepare');
  const before=a.requireBudget();assert.equal(before.claimBytes,5);assert.equal(before.totalBytes,5+65536+16384);
  fs.writeFileSync(path.join(absolute,'cpu-terminal.json'),'cpu');assert.equal(a.requireBudget().totalBytes-before.totalBytes,3);
  a.begin('gpu_qualify');const gpu=a.requireBudget();assert(gpu.totalBytes>gpu.phaseBytes);assert.equal(gpu.claimBytes,5);
  fs.writeFileSync(path.join(absolute,'gpu-terminal.json'),'gpu');assert.equal(a.requireBudget().phaseBytes-gpu.phaseBytes,3);
  assert.throws(()=>a.begin('gpu_qualify'),/already consumed/);
});
test('current live receipt identity is mandatory, no disk boolean or wrong UUID clears active',t=>{
  const root=privateRoot(t),absolute=path.join(root,p.outputRoot,runId);fs.mkdirSync(absolute,{recursive:true});
  const a=createAccounting(root,absolute,p);a.begin('cpu_prepare');assert.throws(()=>a.requireLive({cleanupConfirmed:true}),/retained owner/);
  const id='00000000-0000-4000-8000-000000000001',guardRoot=path.join(root,'.runtime/ai-painter/owned-worker-guards');
  const native=path.join(guardRoot,id+'-native');fs.mkdirSync(native,{recursive:true});fs.writeFileSync(path.join(native,'owner.exe'),'binary');
  const scope={ownerPid:42,bindingBase64:'current',guardRecord:{identity:id},nativeBuildDirectory:native,getStreamBytes:()=>({stdout:3,stderr:2}),
    guard:{path:path.join(guardRoot,'active.json'),startedEvidence:path.join(guardRoot,id+'-started.json'),terminalEvidence:path.join(guardRoot,id+'-terminal.json'),terminalPath:path.join(guardRoot,id+'-guard-terminal.json')}};
  a.observe(scope);assert.equal(a.measure().streamBytes,5);assert.equal(a.measure().nativeBytes,6);
  assert.throws(()=>a.requireLive({guard:{identity:'old'},ownerIdentity:{pid:42},proof:{bindingBase64:'current'}}));
  assert.throws(()=>a.requireLive({guard:{identity:id},ownerIdentity:{pid:42},proof:{bindingBase64:'current'},cleanupConfirmed:true}));
});
test('deadline, GPU identity/thermal/free-memory and nested redirects fail closed',t=>{
  assert.throws(()=>requireDeadline(1,1));requireDeadline(2,1);
  const gpu={index:0,uuid:'GPU-fixture',freeMiB:4096,temperatureC:40};validateGpuResources(gpu,p,'GPU-fixture');
  for(const q of [{...gpu,temperatureC:85},{...gpu,freeMiB:2047},{...gpu,uuid:'other'}])assert.throws(()=>validateGpuResources(q,p,'GPU-fixture'));
  const root=privateRoot(t);fs.mkdirSync(path.join(root,'.runtime'));fs.mkdirSync(path.join(root,'elsewhere'));
  fs.symlinkSync(path.join(root,'elsewhere'),path.join(root,'.runtime','redirect'),'junction');
  assert.throws(()=>createHostPaths(root).directory('.runtime/redirect'),/redirect/);
});

function closureFixture(){const profile='ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_v1.py';
  const source='from ai_painter.complete_world import parameter48_causal_observation_v1\n';
  const code=new Map([[profile,source],[p.implementations.host,"import '@babel/parser';\n"],[p.metadataCanonicalProgram.path,fs.readFileSync(path.join(ROOT,p.metadataCanonicalProgram.path))]]);
  const q=copy(p);q.sourceAlgorithmBindings=[];const original={profile:{path:profile,sha256:hash(source)}},reads=[];
  const reader={bound:()=>({context:{programBindings:original}}),bytes(name,sha){reads.push(name);const raw=Buffer.from(code.get(name)??'');if(sha!==undefined)assert.equal(hash(raw),sha);return raw;},verifyStable(){}};
  return {q,reader,code,reads};}
test('synthetic closure walks actual Node imports/provider manifest and includes boundary test without tensors',()=>{
  const f=closureFixture(),rows=collectSourceClosure(ROOT,f.reader,f.q,Date.now()+30000),names=rows.map(row=>row.path);
  assert(names.includes('node_modules/@babel/parser/package.json'));assert(names.some(name=>name.startsWith('node_modules/@babel/parser/')&&name.endsWith('.js')));
  assert(names.includes('scripts/tests/ai-painter-qualification-owned-worker-boundary.test.mjs'));assert(rows.length<=256);
  assert(!f.reads.some(name=>name.endsWith('.pt')||name.endsWith('.png')));assert(rows.preparationStreamBytes>0);
});
test('new arbitrary dynamic loader is rejected, only the exact fixed TEST loader is closed',()=>{
  const f=closureFixture();f.code.set(p.implementations.worker,'import importlib\nimportlib.import_module(untrusted)\n');
  assert.throws(()=>collectSourceClosure(ROOT,f.reader,f.q,Date.now()+30000),/dynamic/);
  const fixture=closureFixture();fixture.code.set(p.implementations.worker,"import importlib.util\nTEST = 'ml/ai-painter/tests/test_decode1_entry_gpu_qualification_cpu_v1.py'\ndef preparation_abi_tests(reader):\n return importlib.util.spec_from_file_location('_decode1_entry_qualification_abi_tests',reader.path(TEST))\n");
  collectSourceClosure(ROOT,fixture.reader,fixture.q,Date.now()+30000);
  fixture.code.set(p.implementations.worker,fixture.code.get(p.implementations.worker).replace('reader.path(TEST)','reader.path(other)'));
  assert.throws(()=>collectSourceClosure(ROOT,fixture.reader,fixture.q,Date.now()+30000));
});
test('CLI has no training, phase-only or scope override and consumes no actual claim',()=>{
  const claim=path.join(ROOT,p.attemptClaimPath),before=fs.existsSync(claim);
  const result=spawnSync(process.execPath,[path.join(ROOT,p.implementations.host),'--train'],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.notEqual(result.status,0);assert.match(result.stderr,/qualification-only/);assert.equal(fs.existsSync(claim),before);
});
