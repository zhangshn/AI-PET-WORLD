import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {loadCurrentExecutionProjectionForCpu} from './helpers/current-execution-projection-cpu.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t,mode){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'painter-projection-availability-'));
  t.after(()=>{const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('painter-projection-availability-'));fs.rmSync(resolved,{recursive:true});});
  const timeline={runId:'run',reviews:[],completedReviewCount:0,targetReviewCount:3,previewPassCount:0,previewFailCount:0};
  const bytes=Buffer.from(JSON.stringify(timeline));fs.writeFileSync(path.join(root,'timeline.json'),bytes);
  const binding={path:'timeline.json',sha256:digest(bytes)};
  if(mode==='bad-hash')binding.sha256='0'.repeat(64);
  if(mode==='bad-count'){timeline.completedReviewCount=1;const b=Buffer.from(JSON.stringify(timeline));
    fs.writeFileSync(path.join(root,'timeline.json'),b);binding.sha256=digest(b);}
  const registry={registryRevision:126,taskId:'task',runId:'run',lifecycleStage:'isolated_implementation',executionState:'completed',
    terminalEvidence:{path:'terminal.json',sha256:'1'.repeat(64),status:'experiment_completed'},activeExecution:null,selectedHistoricalRun:null,
    latestTrainingTerminal:{runId:'run',path:'terminal.json',sha256:'1'.repeat(64),status:'experiment_completed',
      evidence:mode==='absent'?{}:{machineReviewTimeline:binding}}};
  const module=loadCurrentExecutionProjectionForCpu(process.cwd(),{
    CURRENT_EXECUTION_REGISTRY_PATH:'.runtime/ai-painter/current-execution-registry/current.json',
    readCurrentExecutionRegistry:async()=>({ok:true,registry,registrySha256:'2'.repeat(64)})});
  return ()=>module.readAiPainterCurrentExecutionSnapshot(root);
}
test('absent timeline projects unavailable with null counts, never success or zero failures',async t=>{
  const result=await fixture(t,'absent')();assert.equal(result.ok,true);
  assert.equal(result.machineReview.availability,'unavailable');assert.equal(result.machineReview.reasonCode,'machine_review_timeline_not_bound');
  assert.equal(result.machineReview.previewPassCount,null);assert.equal(result.machineReview.previewFailCount,null);
});
test('bound valid timeline projects actual counts',async t=>{
  const result=await fixture(t,'valid')();assert.equal(result.ok,true);assert.equal(result.machineReview.availability,'available');
  assert.equal(result.machineReview.completedReviewCount,0);assert.equal(result.machineReview.targetReviewCount,3);
});
test('bound corrupt timeline remains unknown or stale, not merely unavailable',async t=>{
  const result=await fixture(t,'bad-hash')();assert.equal(result.ok,false);assert.equal(result.dataStatus,'unknown_or_stale');
  assert.equal(result.reasonCode,'machine_review_timeline_sha256_mismatch');
});
test('self-consistent hash cannot hide inconsistent review counts',async t=>{
  const result=await fixture(t,'bad-count')();assert.equal(result.ok,false);assert.equal(result.reasonCode,'machine_review_count_identity_invalid');
});
