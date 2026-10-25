import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateGpuPolicy,validateCoordinateNarrative,validateWorkerTerminal,proofPassed,
  collectNodeClosure,createOwnedAccounting,makeOutput,preserveFinalizationError,resourceStopReason,
  verifyWorkerResult,workerFailureError,
  runCpuPreflight,OUTPUT_ROOT,SOURCE_SAMPLE,OWN} from '../diagnose-ai-painter-parameter0-training-causal-gpu-v1.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const policyPath='data/ai-painter/system-governance/ai-painter-parameter0-training-causal-gpu-policy-v1.json';
const raw=fs.readFileSync(path.join(root,policyPath)),policy=JSON.parse(raw),copy=x=>structuredClone(x);
const policyBinding={path:policyPath,sha256:crypto.createHash('sha256').update(raw).digest('hex')};
function privateRoot(){return fs.mkdtempSync(path.join(os.tmpdir(),'p0-training-node-fixture-'));}
function removePrivate(p){assert.equal(path.dirname(p),os.tmpdir());assert(path.basename(p).startsWith('p0-training-node-fixture-'));fs.rmSync(p,{recursive:true,force:true});}
function worker(cpu){return {schemaVersion:'parameter0-training-causal-worker-result-v1',sampleId:SOURCE_SAMPLE,sourceStateTiming:'after_exception',
  status:cpu?'cpu_preflight_passed_not_gpu_or_root_cause':'diagnostic_target_evidence_complete',trainingAllowed:false,stage4Qualified:false,historicalReplayAllowed:false,
  counts:{generatorForwards:cpu?0:1,generatorAutogradAttempts:cpu?0:5,generatorAutogradCompleted:cpu?0:5,discriminatorAutograd:0,optimizerConstruction:0,optimizerUpdates:0,cudaCalls:0,localFp64WeightVjp:cpu?0:5},
  cpuComponentTests:{status:'passed',testsRun:7,failures:0,errors:0,skipped:0,testPaths:OWN.filter(p=>p.startsWith('ml/ai-painter/tests/'))}};}
test('actual independently registered policy fixes020 saved-state target and inherited limits',()=>{assert.equal(validateGpuPolicy(policy),true);validateCoordinateNarrative(policy);});
test('old identities, changed state/coordinate/math/resources and CPU quotas fail closed',()=>{
  for(const mutate of [p=>p.schemaVersion='ai-painter-parameter90-causal-gpu-policy-v2',p=>p.capabilityVersion='other',p=>p.scope.failureRunId='old016',
    p=>p.scope.failureSampleId='slot163',p=>p.scope.sourceStateTiming='before_pair',p=>p.sourceOptimizerSteps.generator=15,
    p=>p.sourceFailurePosition.trainIndex=9,p=>p.target.parameterIndex=90,p=>p.target.coordinates=[[1,12,0,0]],
    p=>p.target.weightShape=[3,48,1,1],p=>p.modelCapabilityVersion='caller-model',p=>p.objectSupportStructureWeight=4,
    p=>p.resources.maxWallSeconds=181,p=>p.resources.maxTargetPersistedBytes=2097153,p=>p.cpuPreparation.maxWallSeconds=121,
    p=>p.counts.discriminatorAutograd=1,p=>p.counts.fullGeneratorForward=2,p=>p.comparison.atol=1e-5,p=>p.sourceTensorArchive.sha256='0'.repeat(64)]){
    const p=copy(policy);mutate(p);assert.throws(()=>validateGpuPolicy(p));
  }
});
test('coordinate narrative cannot retain historical parameter90 values',()=>{const p=copy(policy);p.captureRestrictions.upstreamDifference='channel1/output0';assert.throws(()=>validateCoordinateNarrative(p));});
test('CPU worker needs current nonempty components, no skips and zero real calls',()=>{
  validateWorkerTerminal(worker(true),true);
  for(const mutate of [v=>v.counts.cudaCalls=1,v=>v.counts.generatorForwards=1,v=>v.counts.generatorAutogradAttempts=1,v=>v.cpuComponentTests.testsRun=0,
    v=>v.cpuComponentTests.skipped=1,v=>v.cpuComponentTests.testPaths=['old.py'],v=>v.sampleId='other',v=>v.sourceStateTiming='fresh']){
    const v=worker(true);mutate(v);assert.throws(()=>validateWorkerTerminal(v,true));
  }
});
test('GPU requires exact completed1G5G0D and permits bounded classified partial failure',()=>{
  validateWorkerTerminal(worker(false),false);
  for(const mutate of [v=>v.counts.generatorForwards=2,v=>v.counts.generatorAutogradAttempts=6,v=>v.counts.discriminatorAutograd=1,
    v=>v.counts.optimizerConstruction=1,v=>v.counts.optimizerUpdates=1,v=>v.counts.localFp64WeightVjp=6,v=>v.status='unknown']){
    const v=worker(false);mutate(v);assert.throws(()=>validateWorkerTerminal(v,false));
  }
  const v=worker(false);v.status='diagnostic_failed_closed';v.counts.generatorAutogradAttempts=2;v.counts.generatorAutogradCompleted=1;v.counts.localFp64WeightVjp=0;validateWorkerTerminal(v,false);
});
test('cleanup booleans or historical-shaped receipt alone are not native proof',()=>{
  assert.throws(()=>proofPassed({cleanupConfirmed:true,guardReleaseConfirmed:true,ownerClosed:true,emptyJob:true,ownerIdentity:{pid:2},ownerPipeEOF:{stdout:true,stderr:true},streamBytes:{stdout:0,stderr:0},proof:{}}));
});
test('all resource gates preserve exact triggering sample and thresholds',()=>{
  const sample={uuid:'gpu',temperatureC:84,freeMiB:2048,observedAtUtc:'2026-01-01T00:00:00Z'};
  assert.equal(resourceStopReason(sample,'gpu',2048*1048576),null);
  const changed={...sample,uuid:'other',temperatureC:85,freeMiB:2047};const reason=JSON.parse(resourceStopReason(changed,'gpu',2048*1048576-1));
  assert.deepEqual(reason.failed,['gpu_identity','temperature','free_vram','free_disk']);assert.deepEqual(reason.sample,changed);
});
test('actual Node closure retains transitive module-level files and native source bytes',()=>{
  const p=privateRoot();try{
    fs.writeFileSync(path.join(p,'entry.mjs'),"import './middle.mjs';\n");fs.writeFileSync(path.join(p,'middle.mjs'),"export {x} from './leaf.mjs';\n");fs.writeFileSync(path.join(p,'leaf.mjs'),'export const x=1;\n');fs.writeFileSync(path.join(p,'owner.cs'),'// bound native source\n');
    const reader={bytes:n=>fs.readFileSync(path.join(p,n))};const result=collectNodeClosure(p,reader,['entry.mjs','owner.cs'],Date.now()+3000);
    assert.deepEqual(result.bindings.map(x=>x.path).sort(),['entry.mjs','leaf.mjs','middle.mjs','owner.cs']);assert(result.edges.some(x=>x.from==='middle.mjs'&&x.to==='leaf.mjs'));
    fs.writeFileSync(path.join(p,'leaf.mjs'),Buffer.alloc(1048577,32));assert.throws(()=>collectNodeClosure(p,reader,['entry.mjs'],Date.now()+3000),/individual byte limit/);
  }finally{removePrivate(p);}
});
test('unknown required Node import is refused rather than omitted',()=>{
  const p=privateRoot();try{fs.writeFileSync(path.join(p,'entry.mjs'),"import './missing.mjs';\n");assert.throws(()=>collectNodeClosure(p,{bytes:n=>fs.readFileSync(path.join(p,n))},['entry.mjs'],Date.now()+3000));}finally{removePrivate(p);}
});
test('CPU phase accounting includes its own new claim and acceptance pointer',()=>{
  const p=privateRoot();try{const base=path.join(p,OUTPUT_ROOT),dir=path.join(base,'parameter0-training-cpu-current-fixture');fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(base,'cpu-preparation-attempt-v1.json'),'claim');fs.writeFileSync(path.join(base,'current-cpu-acceptance.json'),'pointer');
    const account=createOwnedAccounting(p,dir,{outputRoot:OUTPUT_ROOT,resources:{maxOutputBytes:8388608,maxStreamBytes:8388608}});assert.equal(account.measure().phaseSharedBytes,12);
  }finally{removePrivate(p);}
});
test('secondary registry failure is persisted without replacing original gate error',()=>{
  const primary=new Error('original gate failure'),secondary=Object.assign(new Error('registry finalize failed'),{registryTransactionId:'tx1',registryTransactionRoot:'txroot'});let saved;
  const context={runId:'fixture',put:(name,value,options)=>{saved={name,value,options};return {path:'finalization-failure.json',sha256:'a'.repeat(64)}}};
  const result=preserveFinalizationError(primary,secondary,context,{path:'original.json',sha256:'b'.repeat(64)});
  assert.equal(result,primary);assert.equal(result.message,'original gate failure');assert.match(result.secondaryFinalizationError,/registry finalize failed/);
  assert.equal(saved.value.registryTransactionId,'tx1');assert.equal(saved.value.cleanupAuthorityGranted,false);assert.equal(saved.options.failure,true);
});
test('bound failed worker preserves original Python type/message and secondary invariant error',()=>{
  const value={...worker(false),status:'diagnostic_failed_closed',error:{type:'ValueError',message:'actual four-term total gradient identity differs at parameter 0'},
    secondaryErrors:['state invariant: parameter buffer changed']};
  const raw=Buffer.from(JSON.stringify(value));value.workerResult={path:'private/worker-result.json',sha256:crypto.createHash('sha256').update(raw).digest('hex'),bytes:raw.length};
  const reader={bytes:(logical,expected)=>{assert.equal(logical,value.workerResult.path);assert.equal(expected,crypto.createHash('sha256').update(raw).digest('hex'));return raw;}};
  verifyWorkerResult(reader,value,'private',false);
  const error=workerFailureError(value,{ownedReceipt:{fixture:true},stdout:JSON.stringify(value),stderr:'native original gate'});
  assert.equal(error.name,'ValueError');assert.equal(error.message,value.error.message);assert.deepEqual(error.workerError,value.error);
  assert.deepEqual(error.workerSecondaryErrors,value.secondaryErrors);assert.equal(error.stderr,'native original gate');
  const altered=copy(value);altered.error.message='generic failed closed';assert.throws(()=>verifyWorkerResult(reader,altered,'private',false),/stdout differs/);
  const unbound=copy(value);delete unbound.workerResult.sha256;assert.throws(()=>verifyWorkerResult(reader,unbound,'private',false));
  assert.throws(()=>verifyWorkerResult(reader,value,'other',false));
});
test('secondary evidence write failure remains bounded and does not mask first error',()=>{
  const primary=new Error('original gate');const result=preserveFinalizationError(primary,new Error('registry error'),{runId:'x',put(){throw new Error('disk full');}},null);
  assert.equal(result,primary);assert.match(result.secondaryEvidenceError,/disk full/);assert.match(result.secondaryFinalizationError,/registry error/);
});
test('failure evidence quota is checked before writing and uses existing reserve',()=>{
  const p=privateRoot();try{fs.mkdirSync(path.join(p,'.runtime'),{recursive:true});const policyCopy={...policy,resources:{...policy.resources,maxOutputBytes:66000}};
    const context=makeOutput(p,'fixture',policyCopy);assert.throws(()=>context.put('ordinary.json',{data:'x'.repeat(1000)}));
    const b=context.put('failure.json',{error:'original'},{failure:true});assert(fs.existsSync(path.join(p,b.path)));
  }finally{removePrivate(p);}
});
test('consumed own CPU attempt refuses before archive/source access or native launch',async()=>{
  const p=privateRoot();try{const b=path.join(p,OUTPUT_ROOT);fs.mkdirSync(b,{recursive:true});fs.writeFileSync(path.join(b,'cpu-preparation-attempt-v1.json'),'{}');
    await assert.rejects(runCpuPreflight(p,policyBinding),/CPU preparation already consumed/);
  }finally{removePrivate(p);}
});
