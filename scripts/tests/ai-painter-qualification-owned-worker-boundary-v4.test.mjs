import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import {runParameter60OwnedWorker,runDecode1EntryQualificationOwnedWorkerV4} from '../lib/ai-painter-decode1-entry-qualification-owned-worker-v4.mjs';

const POLICY='data/ai-painter/system-governance/ai-painter-decode1-entry-gpu-qualification-policy-v4.json';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
test('v4 preserves the exact shared native transport implementation',()=>{
  const previous=fs.readFileSync(new URL('../lib/ai-painter-parameter60-owned-worker-v1.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
  const current=fs.readFileSync(new URL('../lib/ai-painter-decode1-entry-qualification-owned-worker-v4.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
  const marker='function runOwnedWorker(executable, args, {';
  assert(previous.includes(marker)&&current.includes(marker));
  assert.equal(current.slice(current.indexOf(marker)).trimEnd(),previous.slice(previous.indexOf(marker)).trimEnd());
});
test('frozen v3 transport body and runtime algorithm remain byte-identical after only selector replacements',()=>{
  const previous=fs.readFileSync(new URL('../lib/ai-painter-decode1-entry-qualification-owned-worker-v3.mjs',import.meta.url),'utf8');
  const current=fs.readFileSync(new URL('../lib/ai-painter-decode1-entry-qualification-owned-worker-v4.mjs',import.meta.url),'utf8');
  const marker='function runOwnedWorker(executable, args, {';
  assert.equal(current.slice(current.indexOf(marker)),previous.slice(previous.indexOf(marker)));
  const expected=previous.replaceAll('runDecode1EntryQualificationOwnedWorkerV3','runDecode1EntryQualificationOwnedWorkerV4')
    .replaceAll('qualification-policy-v3','qualification-policy-v4').replaceAll('gpu_qualification_v3','gpu_qualification_v4')
    .replaceAll('gpu-qualifications-v3','gpu-qualifications-v4').replaceAll('qualify_decode1_entry_gpu_v3.py','qualify_decode1_entry_gpu_v4.py')
    .replaceAll('qualification-request-v3','qualification-request-v4').replaceAll('qualification-v3-','qualification-v4-');
  assert.equal(current,expected); // Includes unchanged C# backend import and legacy180 adapter.
  const runtime1=fs.readFileSync(new URL('../lib/ai-painter-qualification-phase-runtime-v2.mjs',import.meta.url),'utf8');
  const runtime2=fs.readFileSync(new URL('../lib/ai-painter-qualification-phase-runtime-v3.mjs',import.meta.url),'utf8');
  assert.equal(runtime2,runtime1.replaceAll('qualification-owned-worker-v3.mjs','qualification-owned-worker-v4.mjs')
    .replaceAll('runDecode1EntryQualificationOwnedWorkerV3','runDecode1EntryQualificationOwnedWorkerV4'));
});
function fixture(t,phase='qualification'){
  const temporary=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(temporary,'p48-qualification-transport-v4-'));
  t.after(()=>{const absolute=fs.realpathSync(root);assert.equal(absolute,path.resolve(root));assert.equal(path.dirname(absolute),temporary);
    assert(path.basename(absolute).startsWith('p48-qualification-transport-v4-'));fs.rmSync(absolute,{recursive:true});});
  const p={schemaVersion:'ai-painter-decode1-entry-gpu-qualification-policy-v4',capabilityVersion:'stage4_mvp256_dry_decode1_entry_gpu_qualification_v4',
    allowedModes:['cpu_prepare','gpu_qualify'],executionBoundary:{training:false},resources:{cpuPreparationSeconds:240,gpuQualificationSeconds:720},
    outputRoot:'.runtime/ai-painter/decode1-entry-gpu-qualifications-v4'};
  const put=(name,value)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});const raw=JSON.stringify(value);fs.writeFileSync(file,raw);
    return {path:name,sha256:digest(raw)};};
  const policy=put(POLICY,p),runId='decode1-entry-qualification-v4-00000000-0000-4000-8000-000000000001';
  const r={schemaVersion:'decode1-entry-gpu-qualification-request-v4',policy,runId,mode:phase==='cpu'?'cpu_prepare':'gpu_qualify',outputRoot:p.outputRoot+'/'+runId};
  const request=put('request.json',r),args=['-B',path.join(root,'ml/ai-painter/scripts/qualify_decode1_entry_gpu_v4.py'),'--request',request.path,'--request-sha256',request.sha256];
  const options={cwd:root,timeout:phase==='cpu'?240000:720000,maxBuffer:0,qualificationPolicy:policy,phase};
  return {root,p,r,args,options,put};
}

test('legacy caller still rejects budgets above180s before acquiring a guard',()=>{
  assert.throws(()=>runParameter60OwnedWorker(process.execPath,[],{cwd:process.cwd(),timeout:181000}),/<=180s/);
});
for(const phase of ['cpu','qualification'])test('only registered '+phase+' scope reaches the unchanged stream guard',t=>{
  const f=fixture(t,phase);assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),/stream limit must remain/);
  assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards/active.json')),false);
});
test('new GPU interface refuses budgets over720s',t=>{
  const f=fixture(t);f.options.timeout=720001;
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),/<=720s/);
});
test('new CPU interface refuses budgets over240s',t=>{
  const f=fixture(t,'cpu');f.options.timeout=240001;
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),/<=240s/);
});
test('unknown policy path cannot select extended budgets',t=>{
  const f=fixture(t);f.options.qualificationPolicy={...f.options.qualificationPolicy,path:'other.json'};
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),/exact qualification policy/);
});
test('wrong policy content SHA fails before native execution',t=>{
  const f=fixture(t);f.options.qualificationPolicy={...f.options.qualificationPolicy,sha256:'0'.repeat(64)};
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),/policy bytes differ/);
});
test('training is not an accepted phase',t=>{
  const f=fixture(t);f.options.phase='training';
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),/qualification phase/);
});
test('phase and request mode must agree',t=>{
  const f=fixture(t);f.r.mode='cpu_prepare';const b=f.put('request.json',f.r);f.args[5]=b.sha256;
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),/phase mismatch/);
});
test('wrong worker cannot use extended budgets',t=>{
  const f=fixture(t);f.args[1]=path.join(f.root,'worker.py');
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options));
});
test('changed request and redirected output are refused before native execution',t=>{
  const f=fixture(t);f.args[5]='0'.repeat(64);
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),/request bytes differ/);
  f.r.outputRoot='../outside';const b=f.put('request.json',f.r);f.args[5]=b.sha256;
  assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options));
});
test('v3 policy, capability, output, worker, request and run identities never select v4 budgets',t=>{
  for(const field of ['policyPath','schemaVersion','capabilityVersion','outputRoot','worker','requestSchema','runId','requestOutput']){
    const f=fixture(t);
    if(field==='policyPath')f.options.qualificationPolicy.path=POLICY.replace('policy-v4','policy-v3');
    if(field==='schemaVersion')f.p.schemaVersion=f.p.schemaVersion.replace('policy-v4','policy-v3');
    if(field==='capabilityVersion')f.p.capabilityVersion=f.p.capabilityVersion.replace('_v4','_v3');
    if(field==='outputRoot')f.p.outputRoot=f.p.outputRoot.replace('qualifications-v4','qualifications-v3');
    if(['schemaVersion','capabilityVersion','outputRoot'].includes(field)){
      f.options.qualificationPolicy=f.put(POLICY,f.p);f.r.policy=f.options.qualificationPolicy;
    }
    if(field==='worker')f.args[1]=f.args[1].replace('gpu_v4.py','gpu_v3.py');
    if(field==='requestSchema')f.r.schemaVersion=f.r.schemaVersion.replace('request-v4','request-v3');
    if(field==='runId')f.r.runId=f.r.runId.replace('qualification-v4-','qualification-v3-');
    if(field==='requestOutput')f.r.outputRoot=f.r.outputRoot.replace('qualifications-v4','qualifications-v3');
    const b=f.put('request.json',f.r);f.args[5]=b.sha256;
    assert.throws(()=>runDecode1EntryQualificationOwnedWorkerV4(process.execPath,f.args,f.options),
      error=>!error.message.includes('stream limit must remain'),field);
    assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards/active.json')),false,field);
  }
});
