import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {loadCurrentExecutionProjectionForCpu} from './helpers/current-execution-projection-cpu.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

function currentHttpRoute(snapshot){
  const exports={},calls=[];
  const source=fs.readFileSync(new URL('../../src/app/api/ai-console/observability/current-execution/route.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{exports,URL,Response,require:name=>{
    assert.equal(name,'@/server/ai-console/ai-painter-current-execution-projection');
    return {readAiPainterCurrentExecutionSnapshot:async()=>{calls.push('read');return snapshot;}};
  }});
  return {get:exports.GET,calls};
}

for(const query of ['runId=foreign-run','path=data/other.json','source=history','selectedHistoricalRun=old-run',
  'runId=','runId=first&runId=second','%72unId=foreign-run','runId%5B%5D=foreign-run','limit=20','unknown=1']){
  test('current HTTP route refuses unsupported query before reading current evidence: '+query,async()=>{
    const route=currentHttpRoute({ok:true,registryRevision:7});
    const response=await route.get(new Request('http://localhost:3000/api/ai-console/observability/current-execution?'+query));
    assert.equal(response.status,400);assert.deepEqual(route.calls,[]);
    assert.equal(response.headers.get('Cache-Control'),'no-store, max-age=0');
    assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
    assert.deepEqual(await response.json(),{ok:false,dataStatus:'unknown_or_stale',reasonCode:'current_execution_parameters_invalid'});
  });
}

for(const ok of [true,false]) test('current HTTP route keeps original '+(ok?'200':'503')+' and snapshot for parameter-free requests',async()=>{
  const snapshot={ok,registryRevision:7,dataStatus:ok?'connected':'unknown_or_stale',activeExecution:null};
  const route=currentHttpRoute(snapshot);
  const response=await route.get(new Request('http://localhost:3000/api/ai-console/observability/current-execution'));
  assert.equal(response.status,ok?200:503);assert.deepEqual(await response.json(),snapshot);
  assert.deepEqual(route.calls,['read']);assert.equal(response.headers.get('Cache-Control'),'no-store, max-age=0');
});

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
  const registryPath=path.join(root,'.runtime/ai-painter/current-execution-registry/current.json');
  const registryBytes=Buffer.from(JSON.stringify(registry));
  fs.mkdirSync(path.dirname(registryPath),{recursive:true});fs.writeFileSync(registryPath,registryBytes);
  const projection=loadCurrentExecutionProjectionForCpu(process.cwd(),{
    CURRENT_EXECUTION_REGISTRY_PATH:'.runtime/ai-painter/current-execution-registry/current.json',
    readCurrentExecutionRegistry:async()=>{
      if(mode==='changed-registry')fs.writeFileSync(registryPath,JSON.stringify({...registry,registryRevision:127}));
      return {ok:true,registry,registrySha256:digest(registryBytes)};
    }});
  return ()=>projection.readAiPainterCurrentExecutionSnapshot(root);
}
test('absent timeline projects unavailable with null counts, never success or zero failures',async t=>{
  const result=await fixture(t,'absent')();assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.machineReview.availability,'unavailable');assert.equal(result.machineReview.reasonCode,'machine_review_timeline_not_bound');
  assert.equal(result.machineReview.previewPassCount,null);assert.equal(result.machineReview.previewFailCount,null);
});
test('bound valid timeline projects actual counts',async t=>{
  const result=await fixture(t,'valid')();assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.machineReview.availability,'available');
  assert.equal(result.machineReview.completedReviewCount,0);assert.equal(result.machineReview.targetReviewCount,3);
});
test('bound corrupt timeline remains unknown or stale, not merely unavailable',async t=>{
  const result=await fixture(t,'bad-hash')();assert.equal(result.ok,false);assert.equal(result.dataStatus,'unknown_or_stale');
  assert.equal(result.reasonCode,'machine_review_timeline_sha256_mismatch');
});
test('self-consistent hash cannot hide inconsistent review counts',async t=>{
  const result=await fixture(t,'bad-count')();assert.equal(result.ok,false);assert.equal(result.reasonCode,'machine_review_count_identity_invalid');
});

test('registry change during projection cannot mix two revisions into a connected snapshot',async t=>{
  const result=await fixture(t,'changed-registry')();assert.equal(result.ok,false);
  assert.equal(result.reasonCode,'current_execution_changed_during_projection');
  assert.equal(result.dataStatus,'unknown_or_stale');
});
