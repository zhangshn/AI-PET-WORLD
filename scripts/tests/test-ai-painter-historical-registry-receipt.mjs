import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createReader, sha256} from '../lib/ai-painter-stage4-dataset-audit.mjs';
import {readHistoricalAuditReceipt} from '../lib/ai-painter-stage4-split-data-adjudication.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'painter-registry-receipt-'));
  t.after(()=>{const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('painter-registry-receipt-'));fs.rmSync(resolved,{recursive:true});});
  const put=(p,value)=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value)+'\n');
    const target=path.join(root,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
    return {path:p,sha256:sha256(bytes),bytes:bytes.length};};
  const base='.runtime/ai-painter/current-execution-registry',id='current-execution-registry-advance-fixture-59';
  const txbase=`${base}/transactions/${id}`,currentPath=`${base}/current.json`;
  const snapshot={schemaVersion:'ai-painter-current-execution-registry-v1',registryIdentity:'ai-painter-current-execution',
    transactionId:id,registryRevision:59,eventSequence:59,activeExecution:null};
  const snapshotBinding=put(`${txbase}/current.staged.json`,snapshot);
  const receipt={...snapshotBinding,path:currentPath};
  const event={schemaVersion:'ai-painter-current-execution-registry-event-v1',transactionId:id,registryRevision:59,
    eventSequence:59,currentSha256:receipt.sha256};
  const eventBinding=put(`${txbase}/registry-event.staged.jsonl`,event);
  const transaction={schemaVersion:'ai-painter-current-execution-registry-transaction-v1',status:'committed',
    transactionId:id,registryRevision:59,eventSequence:59,currentSha256:receipt.sha256,
    currentStaged:snapshotBinding,registryEventStaged:eventBinding};
  put(`${txbase}/transaction.json`,transaction);put(`${base}/events.jsonl`,event);
  put(currentPath,{...snapshot,registryRevision:126,eventSequence:126,transactionId:'current'});
  return {root,put,base,txbase,currentPath,receipt,snapshot,event,transaction};
}

test('exact historical bytes are recovered without changing current task or granting qualification',t=>{
  const f=fixture(t),before=fs.readFileSync(path.join(f.root,f.currentPath));
  const reader=createReader(f.root),result=readHistoricalAuditReceipt(reader,f.receipt);
  assert.equal(result.registryRevision,59);assert.equal(result.qualificationGranted,false);
  assert.equal(result.currentTaskSelected,false);
  assert.equal(reader.json(f.currentPath).registryRevision,126);
  reader.verifyStable();assert.deepEqual(fs.readFileSync(path.join(f.root,f.currentPath)),before);
});
test('matching current bytes require no historical fallback',t=>{
  const f=fixture(t);f.put(f.currentPath,f.snapshot);
  assert.equal(readHistoricalAuditReceipt(createReader(f.root),f.receipt),null);
});
for(const [name,mutate,pattern] of [
  ['missing event',f=>f.put(`${f.base}/events.jsonl`,Buffer.from('')),/missing_or_ambiguous/],
  ['duplicate event',f=>f.put(`${f.base}/events.jsonl`,Buffer.from(JSON.stringify(f.event)+'\n'+JSON.stringify(f.event))),/missing_or_ambiguous/],
  ['uncommitted transaction',f=>{f.transaction.status='pending';f.put(`${f.txbase}/transaction.json`,f.transaction);},/not_committed/],
  ['snapshot tampering',f=>f.put(`${f.txbase}/current.staged.json`,{...f.snapshot,registryRevision:60}),/SHA mismatch/],
  ['receipt size tampering',f=>{f.receipt.bytes++;},/snapshot_size_conflict/],
  ['transaction revision conflict',f=>{f.transaction.registryRevision=60;f.put(`${f.txbase}/transaction.json`,f.transaction);},/transaction_conflict/],
  ['snapshot path escape',f=>{f.transaction.currentStaged.path='../outside';f.put(`${f.txbase}/transaction.json`,f.transaction);},/binding_conflict/],
  ['event tampering',f=>f.put(`${f.txbase}/registry-event.staged.jsonl`,{...f.event,eventSequence:60}),/SHA mismatch/],
]) test(`historical replay rejects ${name}`,t=>{
  const f=fixture(t);mutate(f);assert.throws(()=>readHistoricalAuditReceipt(createReader(f.root),f.receipt),pattern);
});
test('ordinary data hash conflicts never use registry recovery',t=>{
  const f=fixture(t),receipt=f.put('data/source.json',{a:1});f.put('data/source.json',{a:2});
  assert.throws(()=>readHistoricalAuditReceipt(createReader(f.root),receipt),/SHA mismatch: data\/source.json/);
});
test('snapshot changes after verification are detected at final recheck',t=>{
  const f=fixture(t),reader=createReader(f.root);readHistoricalAuditReceipt(reader,f.receipt);
  f.put(`${f.txbase}/current.staged.json`,{...f.snapshot,activeExecution:{runId:'forged'}});
  assert.throws(()=>reader.verifyStable(),/SHA mismatch/);
});
