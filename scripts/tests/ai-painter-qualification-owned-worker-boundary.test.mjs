import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import {runParameter60OwnedWorker,runQualificationOwnedWorker} from '../lib/ai-painter-parameter60-owned-worker-v1.mjs';

const POLICY='data/ai-painter/system-governance/ai-painter-decode1-entry-gpu-qualification-policy-v1.json';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(t,phase='qualification'){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'p48-qualification-transport-'));
  t.after(()=>{const absolute=path.resolve(root);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));
    assert(path.basename(absolute).startsWith('p48-qualification-transport-'));fs.rmSync(absolute,{recursive:true});});
  const p={schemaVersion:'ai-painter-decode1-entry-gpu-qualification-policy-v1',capabilityVersion:'stage4_mvp256_dry_decode1_entry_gpu_qualification_v1',
    allowedModes:['cpu_prepare','gpu_qualify'],executionBoundary:{training:false},resources:{cpuPreparationSeconds:240,gpuQualificationSeconds:720},
    outputRoot:'.runtime/ai-painter/decode1-entry-gpu-qualifications'};
  const put=(name,value)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});const raw=JSON.stringify(value);fs.writeFileSync(file,raw);
    return {path:name,sha256:digest(raw)};};
  const policy=put(POLICY,p),runId='decode1-entry-qualification-00000000-0000-4000-8000-000000000001';
  const r={schemaVersion:'decode1-entry-gpu-qualification-request-v1',policy,runId,mode:phase==='cpu'?'cpu_prepare':'gpu_qualify',outputRoot:p.outputRoot+'/'+runId};
  const request=put('request.json',r),args=['-B',path.join(root,'ml/ai-painter/scripts/qualify_decode1_entry_gpu_v1.py'),'--request',request.path,'--request-sha256',request.sha256];
  const options={cwd:root,timeout:phase==='cpu'?240000:720000,maxBuffer:0,qualificationPolicy:policy,phase};
  return {root,p,r,args,options,put};
}

test('legacy caller still rejects budgets above180s before acquiring a guard',()=>{
  assert.throws(()=>runParameter60OwnedWorker(process.execPath,[],{cwd:process.cwd(),timeout:181000}),/<=180s/);
});
for(const phase of ['cpu','qualification'])test('only registered '+phase+' scope reaches the unchanged stream guard',t=>{
  const f=fixture(t,phase);assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options),/stream limit must remain/);
  assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards/active.json')),false);
});
test('new GPU interface refuses budgets over720s',t=>{
  const f=fixture(t);f.options.timeout=720001;
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options),/<=720s/);
});
test('new CPU interface refuses budgets over240s',t=>{
  const f=fixture(t,'cpu');f.options.timeout=240001;
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options),/<=240s/);
});
test('unknown policy path cannot select extended budgets',t=>{
  const f=fixture(t);f.options.qualificationPolicy={...f.options.qualificationPolicy,path:'other.json'};
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options),/exact qualification policy/);
});
test('wrong policy content SHA fails before native execution',t=>{
  const f=fixture(t);f.options.qualificationPolicy={...f.options.qualificationPolicy,sha256:'0'.repeat(64)};
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options),/policy bytes differ/);
});
test('training is not an accepted phase',t=>{
  const f=fixture(t);f.options.phase='training';
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options),/qualification phase/);
});
test('phase and request mode must agree',t=>{
  const f=fixture(t);f.r.mode='cpu_prepare';const b=f.put('request.json',f.r);f.args[5]=b.sha256;
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options),/phase mismatch/);
});
test('wrong worker cannot use extended budgets',t=>{
  const f=fixture(t);f.args[1]=path.join(f.root,'worker.py');
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options));
});
test('changed request and redirected output are refused before native execution',t=>{
  const f=fixture(t);f.args[5]='0'.repeat(64);
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options),/request bytes differ/);
  f.r.outputRoot='../outside';const b=f.put('request.json',f.r);f.args[5]=b.sha256;
  assert.throws(()=>runQualificationOwnedWorker(process.execPath,f.args,f.options));
});
