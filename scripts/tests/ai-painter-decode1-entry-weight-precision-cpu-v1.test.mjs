// Private synthetic metadata/accounting only. No real owned-worker invocation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {POLICY,bindPolicy,CANDIDATE,LIMITS,validatePolicy,validateResult,collectSourceClosure,
  createHostPaths,createCpuAccounting,requireDeadline,runCpuCheck} from '../check-ai-painter-decode1-entry-weight-precision-cpu-v1.mjs';
import {proofPassed} from '../diagnose-ai-painter-parameter48-causal-gpu-v2.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex'),copy=v=>structuredClone(v);
const raw=fs.readFileSync(path.join(ROOT,POLICY.path)),policy=JSON.parse(raw);
const bound=bindPolicy({path:POLICY.path,sha256:hash(raw)});
function privateRoot(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'p48-entry-host-fixture-'));
  t.after(()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert(path.basename(root).startsWith('p48-entry-host-fixture-'));fs.rmSync(root,{recursive:true});});return root;}
function put(root,name,value){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value),{flag:'wx'});return file;}
function result(){return {schemaVersion:'decode1-entry-precision-cpu-worker-result-v1',status:'cpu_candidate_verified_inactive',executionState:'completed',
  policy:copy(bound),candidate:CANDIDATE,counts:copy(LIMITS),nativeFull256ForwardBytesEqual:true,fullOriginalLossGradientGatePassed:true,
  beforeAfterStateBytesEqual:true,strictReloadPassed:true,cudaInitialized:false,trainingAllowed:false,stage4Qualified:false,checkpointWritten:false,
  failedStateOrCheckpointLoaded:false,pngOrCheckpointWritten:false,fullForwardHashes:{baseline:'a'.repeat(64),candidate:'a'.repeat(64)},
  gradientFacts:{modelCapabilityVersion:CANDIDATE,actualTotalProvenanceVerified:true,actualTotalIndependentFullModelGradient:true,
    originalGateAndProjectionUnchanged:true,carrierAllParameterNamesShapesBytesVerified:true,nonHeadActualTotalIdentityPreserved:true,
    nonConflictHeadActualTotalBytesPreserved:true,autogradGradCalls:5,independentFullParameterGradientTensorCounts:[108,108,108,108,108],
    carrierQualificationInherited:false,arithmeticCarrierCapabilityVersion:policy.arithmeticCarrier.capability,
    gradientIdentityAtol:1e-6,gradientIdentityRtol:1e-5,generatorGradientFacts:{tensorCount:108,allFinite:true,parameterElements:2242687,parametersUpdated:false}}};}

test('exact registered policy and explicit immutable binding',()=>{
  assert.equal(validatePolicy(policy),true);assert.deepEqual(bindPolicy(bound),bound);
  assert.throws(()=>bindPolicy({path:bound.path,sha256:'0'.repeat(64)}),/cannot change/);
  assert.throws(()=>bindPolicy({path:'private/other.json',sha256:bound.sha256}));
});
for(const [name,change] of [
  ['GPU',p=>p.qualification.gpuExecutionAllowed=true],['training',p=>p.qualification.trainingAllowed=true],
  ['wrong target',p=>p.target.parameterIndex=60],['wrong shape',p=>p.target.weightShape[1]=48],
  ['validation',p=>p.scope.split='validation'],['failure state',p=>p.scope.failureStateInitializationAllowed=true],
  ['sample',p=>p.scope.sampleId='other'],['time',p=>p.resources.maxWallSeconds=121],['threads',p=>p.resources.threads=3],
  ['output expansion',p=>p.resources.maxOutputBytes++],['retry',p=>p.resources.automaticRetries=1],
  ['four VJPs',p=>p.limits.fullGeneratorAutogradCalls=4],['original tolerance',p=>p.comparison.atol=1e-5],
  ['reload identity',p=>p.candidate='old'],['formal',p=>p.formalSpecification.version='AI-PAINTER-SPEC-1.90'],
  ['closure size',p=>p.sourceClosure.maxFiles=257],['canonical',p=>p.metadataCanonicalProgram.sha256='0'.repeat(64)],
  ['old namespace',p=>p.outputRoot+='/other'],['extra fixture',p=>p.limits.operatorFixtureForwards=1],
])test('policy refuses '+name,()=>{const p=copy(policy);change(p);assert.throws(()=>validatePolicy(p));});

test('complete inactive result and all original five-gradient facts',()=>assert.equal(validateResult(result(),policy),true));
test('success requires strict reload, byte equality and every forbidden flag false',()=>{
  for(const name of ['strictReloadPassed','nativeFull256ForwardBytesEqual','fullOriginalLossGradientGatePassed','beforeAfterStateBytesEqual',
    'cudaInitialized','trainingAllowed','stage4Qualified','checkpointWritten','failedStateOrCheckpointLoaded','pngOrCheckpointWritten']){
    const r=result();r[name]=!r[name];assert.throws(()=>validateResult(r,policy),name);}
  const r=result();r.status='failed_closed';assert.throws(()=>validateResult(r,policy));
});
test('counts, original carrier, current policy and gradient provenance cannot be forged by booleans',()=>{
  for(const mutate of [r=>r.counts.fullGeneratorAutogradCalls=4,r=>r.fullForwardHashes.candidate='b'.repeat(64),
    r=>r.gradientFacts.independentFullParameterGradientTensorCounts[4]=107,r=>r.gradientFacts.carrierQualificationInherited=true,
    r=>r.gradientFacts.arithmeticCarrierCapabilityVersion=CANDIDATE,r=>r.gradientFacts.actualTotalProvenanceVerified=false,
    r=>r.gradientFacts.generatorGradientFacts.parametersUpdated=true,r=>r.gradientFacts.generatorGradientFacts.parameterElements--,
    r=>r.policy.sha256='0'.repeat(64)]){const r=result();mutate(r);assert.throws(()=>validateResult(r,policy));}
  assert.throws(()=>proofPassed({cleanupConfirmed:true,guardReleaseConfirmed:true,emptyJob:true,ownerClosed:true}));
});

test('explicit claim and final terminal bytes are in the cumulative ledger',t=>{
  const root=privateRoot(t),p=copy(policy),out=path.join(root,p.outputRoot,'decode1-entry-cpu-fixture');fs.mkdirSync(out,{recursive:true});
  put(root,p.attemptClaimPath,'claim');const a=createCpuAccounting(root,out,p,{preparationStreamBytes:23});
  const before=a.requireBudget();assert.equal(before.phaseSharedBytes,5);assert.equal(before.preparationStreamBytes,23);
  assert.equal(before.totalBytes,5+23+65536+16384);
  fs.writeFileSync(path.join(out,'terminal.json'),'final-seven');
  const after=a.requireBudget();assert.equal(after.totalBytes-before.totalBytes,11);
});
test('failure reserve remains unavailable to success and is available only after failure closure',t=>{
  const root=privateRoot(t),out=path.join(root,policy.outputRoot,'decode1-entry-cpu-fixture');fs.mkdirSync(out,{recursive:true});
  const a=createCpuAccounting(root,out,policy);const remaining=8388608-65536-a.measure().totalBytes;
  fs.writeFileSync(path.join(out,'worker.json'),Buffer.alloc(remaining));a.requireBudget();
  fs.writeFileSync(path.join(out,'failure-byte'),Buffer.alloc(1));assert.throws(()=>a.requireBudget(),/quota/);
  a.beginFailureClosure();assert.equal(a.requireBudget().totalBytes,8388608-65536+1);
});
test('only this invocation native paths and its actual stdio join the ledger',t=>{
  const root=privateRoot(t),out=path.join(root,policy.outputRoot,'decode1-entry-cpu-fixture');fs.mkdirSync(out,{recursive:true});
  const guardRoot=path.join(root,'.runtime/ai-painter/owned-worker-guards'),id='00000000-0000-4000-8000-000000000001';
  const guard={path:path.join(guardRoot,'active.json'),startedEvidence:path.join(guardRoot,id+'-started.json'),
    terminalEvidence:path.join(guardRoot,id+'-terminal.json'),terminalPath:path.join(guardRoot,id+'-guard-terminal.json')};
  const native=path.join(guardRoot,id+'-native');fs.mkdirSync(native,{recursive:true});fs.writeFileSync(path.join(native,'binary'),'abc');
  fs.writeFileSync(guard.path,JSON.stringify({identity:id}));fs.writeFileSync(guard.startedEvidence,'start');
  put(root,'.runtime/ai-painter/owned-worker-guards/other-native/old.exe',Buffer.alloc(10000));
  const a=createCpuAccounting(root,out,policy),scope={guard,guardRecord:{identity:id},nativeBuildDirectory:native,getStreamBytes:()=>({stdout:5,stderr:2})};
  a.observe(scope);const value=a.requireBudget();assert.equal(value.nativeBytes,8);assert.equal(value.streamBytes,7);
  assert.equal(value.conservativeTransportBytes,8*7+65536+16384);assert(value.activeGuardBytes>0);
  assert.throws(()=>a.observe(scope),/one managed/);
  const bad=createCpuAccounting(root,out,policy);assert.throws(()=>bad.observe({...scope,nativeBuildDirectory:path.join(guardRoot,'other-native')}));
});
test('deadline and redirected or replaced private output parents fail closed',t=>{
  assert.throws(()=>requireDeadline(10,10),/deadline/);requireDeadline(10,9);
  const root=privateRoot(t);fs.mkdirSync(path.join(root,'.runtime'));const paths=createHostPaths(root);paths.mkdir('.runtime/ai-painter');
  paths.mkdir(policy.outputRoot);paths.directory(policy.outputRoot);
  const moved=path.join(root,policy.outputRoot+'-retained');fs.renameSync(path.join(root,policy.outputRoot),moved);
  fs.mkdirSync(path.join(root,policy.outputRoot));assert.throws(()=>paths.directory(policy.outputRoot),/identity changed/);
  assert.throws(()=>paths.file('../outside'));
  fs.rmdirSync(path.join(root,policy.outputRoot));fs.symlinkSync(moved,path.join(root,policy.outputRoot),'junction');
  assert.throws(()=>createHostPaths(root).directory(policy.outputRoot),/redirect/);
});

function closureFixture(){
  const profile='ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_v1.py';
  const worker=policy.workerPath,model=policy.candidateImplementation.model,operator=policy.candidateImplementation.operator;
  const profileSource='from ai_painter.complete_world import parameter48_causal_observation_v1\n';
  const code=new Map([[profile,profileSource],[worker,'from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1\n'],
    [model,'from . import decode1_entry_weight_reduction_precision_v1\n'],[operator,'']]);
  code.set(policy.metadataCanonicalProgram.path,fs.readFileSync(path.join(ROOT,policy.metadataCanonicalProgram.path)));
  const p=copy(policy);p.sourceAlgorithmBindings=[];
  const original={profile:{path:profile,sha256:hash(Buffer.from(profileSource))}},reads=[];
  const reader={bound:()=>({context:{programBindings:original}}),bytes(name,sha){reads.push(name);const bytes=Buffer.from(code.get(name)??'');
    if(sha!==undefined)assert.equal(hash(bytes),sha,'synthetic SHA mismatch');return bytes;},verifyStable(){}};
  return {p,reader,code,reads,worker};
}
test('dry AST closure includes new OWN, canonical and old dependency set without importing models',()=>{
  const f=closureFixture(),rows=collectSourceClosure(ROOT,f.reader,f.p,Date.now()+30000);
  assert(rows.length>15&&rows.length<=256);assert(Number.isSafeInteger(rows.preparationStreamBytes)&&rows.preparationStreamBytes>0);
  for(const name of [f.worker,...Object.values(policy.candidateImplementation),...policy.testPaths,policy.metadataCanonicalProgram.path])
    assert.equal(rows.filter(b=>b.path===name).length,1);
  assert(!f.reads.some(p=>p.endsWith('.pt')||p.endsWith('.png')));
  assert(!JSON.stringify(rows).includes('preparationStreamBytes'));
});
test('new dynamic or undeclared existing static project imports cannot escape OWN',()=>{
  for(const code of ['import importlib\nimportlib.import_module(arbitrary)\n','from ai_painter.complete_world import isolated_foundation\n']){
    const f=closureFixture();f.code.set(f.worker,code);
    assert.throws(()=>collectSourceClosure(ROOT,f.reader,f.p,Date.now()+30000),/dynamic project loader|unregistered new static import/);}
});
test('consumed private claim refuses before official registry or real worker',async t=>{
  const root=privateRoot(t);put(root,POLICY.path,raw);fs.mkdirSync(path.join(root,'.runtime'));
  put(root,policy.attemptClaimPath,'{"private":true}');
  await assert.rejects(runCpuCheck(root,bound),/already consumed/);
});
test('CLI unknown flag cannot consume the actual once claim',()=>{
  const claim=path.join(ROOT,policy.attemptClaimPath),before=fs.existsSync(claim);
  const result=spawnSync(process.execPath,[path.join(ROOT,policy.entrypointPath),'--run'],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.notEqual(result.status,0);assert.match(result.stderr,/fixed CPU scope/);assert.equal(fs.existsSync(claim),before);
});
