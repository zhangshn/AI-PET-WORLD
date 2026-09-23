// Internal CPU worker transport, not input admission or training authorization.
// Its caller must establish the allowed operation and candidate qualification.
// Bindings prove byte identity only; this module has no public CLI or scheduler.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createReader} from './ai-painter-stage4-dataset-audit.mjs';
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export async function runBoundCpuCheckpointWorker({root, executable, script, args, programBindings,
  timeoutMs=60000, abortReason=()=>null}) {
  assert.ok(path.isAbsolute(root),'absolute project root required');
  assert.ok(path.isAbsolute(executable.path),'absolute Python executable required');
  assert.match(executable.sha256??'',/^[a-f0-9]{64}$/u);
  assert.equal(hash(fs.readFileSync(executable.path)),executable.sha256,'Python executable changed');
  assert.ok(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=60000,'CPU worker wall limit exceeded');
  assert.ok(Array.isArray(args)&&args.every(v=>typeof v==='string'),'argument array required');
  assert.ok(Array.isArray(programBindings)&&programBindings.length>0,'program lineage required');
  const reader=createReader(root), seen=new Set();
  for(const binding of programBindings){
    assert.ok(!seen.has(binding.path),'duplicate program binding');seen.add(binding.path);
    assert.match(binding.sha256??'',/^[a-f0-9]{64}$/u);
    reader.bytes(binding.path,binding.sha256);
  }
  assert.ok(programBindings.some(b=>b.path===script.path&&b.sha256===script.sha256),'worker script not bound');
  reader.verifyStable();
  // Empty CUDA visibility prevents accidental default CUDA selection by the
  // bound worker; this is not a sandbox against a malicious Python program.
  const commandArgs=['-B',path.resolve(root,script.path),...args];
  const result=await runOwnedWorker(executable.path,commandArgs,{cwd:root,
    timeout:timeoutMs,maxBuffer:8*1024*1024,abortReason,
    env:{...process.env,CUDA_VISIBLE_DEVICES:'',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',
      PYTHONPATH:[path.join(root,'ml/ai-painter/src'),path.join(root,'ml/ai-painter/scripts')].join(path.delimiter),
      OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1'}});
  try {
    const receipt=result.ownedReceipt;
    assert.equal(receipt.cleanupConfirmed,true,'worker cleanup unconfirmed');
    assert.equal(receipt.guardReleaseConfirmed,true,'worker guard not released');
    assert.equal(receipt.ownerClosed,true,'native owner not closed');
    const liveBinding=JSON.parse(Buffer.from(receipt.proof.bindingBase64,'base64').toString('utf8'));
    assert.equal(liveBinding.guard.commandSha256,hash(JSON.stringify(commandArgs)),'owner command mismatch');
    assert.equal(path.resolve(liveBinding.guard.executable),path.resolve(executable.path),'owner executable mismatch');
    assert.equal(liveBinding.guard.executableSha256,executable.sha256,'owner executable hash mismatch');
    assert.equal(path.resolve(liveBinding.scope),path.resolve(root),'owner scope mismatch');
    reader.verifyStable();
    assert.equal(hash(fs.readFileSync(executable.path)),executable.sha256,'Python executable changed during run');
    const value=JSON.parse(result.stdout);
    assert.ok(value&&typeof value==='object'&&!Array.isArray(value),'worker JSON object required');
    return {value,stderr:result.stderr,ownedReceipt:receipt,programReceipts:reader.receipts(),
      executable,commandArgs,qualificationGranted:false};
  } catch(error) {
    // Keep real cleanup evidence even if post-execution binding or JSON fails.
    error.ownedReceipt=result.ownedReceipt;throw error;
  }
}
