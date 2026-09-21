import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { summarizeTrainingComparison, decideTrainingComparison, projectFile, boundJson,
  requestOf, validateLaunchSnapshot, retryTransientIo } from "../lib/ai-painter-training-result-shadow-v1.mjs";

const evidence={path:".runtime/ai-painter/review.json",sha256:"a".repeat(64)};
const arms=["legacy_global_schedule_control","per_sample_schedule_candidate"];
const metrics=["rgbMae","laplacianMae","phase4ResidualRmsAfterGlobalBiasRemoval"];
function fixture(){
  const seeds=[[20264008,20264108,20264208],[20264009,20264109,20264209]];
  const rows=arms.flatMap((arm,a)=>["sample146","sample147"].flatMap((sampleId,i)=>seeds[i].map(seed=>({arm,sampleId,seed,
    split:"train",targetUsedForInitialization:false,baseline:{final:Object.fromEntries(metrics.map(m=>[m,2]))},
    measurements:{final:Object.fromEntries(metrics.map(m=>[m,a?1:1.5]))}}))));
  const summary={fixture:"same frozen summary"};
  return {source:{schemaVersion:"ai-painter-timestep-ab-result-v1",executionState:"completed",optimizerSteps:2000,
    checkpointReloadExact:true,rows,summary,qualification:Object.fromEntries(["formalDatasetQualified","formalGpuQualified",
      "formalTrainingAllowed","checkpointPromotable","formalInferenceEligible","worldEntryAllowed"].map(k=>[k,false]))},
    replay:{status:"metrics_replayed_exactly",cudaInitialized:false,optimizerSteps:0,fixedSeedRollouts:12,
      imagesWritten:0,checkpointsWritten:0,rowsReplayed:12,summary}};
}
function summary(f=fixture()){return summarizeTrainingComparison(f.source,f.replay);}

test("all twelve paired rows retain two scenes and six seeds",()=>{
  const s=summary();assert.equal(s.sceneCount,2);assert.equal(s.sampleSeedCount,6);assert.equal(s.rows.length,6);
  assert.equal(s.allRgbImproved,true);assert.equal(s.allLaplacianImproved,true);
});
test("unanimous improvement produces advice, never training or release",()=>{
  const d=decideTrainingComparison(summary(),evidence);
  assert.equal(d.matchedOption,"candidate_improved_train_only");assert.equal(d.applied,false);assert.equal(d.nextMachineAction,null);
});
test("a regression is retained as mixed evidence",()=>{
  const f=fixture();f.source.rows[6].measurements.final.rgbMae=3;
  assert.equal(decideTrainingComparison(summary(f),evidence).matchedOption,"candidate_mixed_train_only");
});
test("phase artifacts cannot be hidden by better RGB and Laplacian",()=>{
  const f=fixture();f.source.rows[6].measurements.final.phase4ResidualRmsAfterGlobalBiasRemoval=2;
  assert.equal(decideTrainingComparison(summary(f),evidence).matchedOption,"candidate_mixed_train_only");
});
test("complete nonimprovement is not declared promising",()=>{
  const f=fixture();f.source.rows.slice(6).forEach(r=>metrics.forEach(m=>r.measurements.final[m]=2));
  assert.equal(decideTrainingComparison(summary(f),evidence).matchedOption,"candidate_not_improved_train_only");
});
test("ties and partial improvement stay inconclusive",()=>{
  const f=fixture();f.source.rows[6].measurements.final.rgbMae=1.5;
  assert.equal(decideTrainingComparison(summary(f),evidence).matchedOption,"inconclusive_train_only");
});
test("missing, duplicate and reordered rows fail closed",()=>{
  for(const change of [f=>f.source.rows.pop(),f=>{f.source.rows[1].seed=f.source.rows[0].seed},f=>f.source.rows.reverse()]){
    const f=fixture();change(f);assert.throws(()=>summary(f));
  }
});
test("nonfinite, negative and boolean metrics fail closed",()=>{
  for(const value of [NaN,Infinity,-1,true,null]){const f=fixture();f.source.rows[0].measurements.final.rgbMae=value;assert.throws(()=>summary(f));}
});
test("source holdout and target-fed generation are rejected",()=>{
  for(const [key,value] of [["split","validation"],["targetUsedForInitialization",true]]){
    const f=fixture();f.source.rows[0][key]=value;assert.throws(()=>summary(f));
  }
});
test("GPU, optimizer or output creation invalidates CPU replay",()=>{
  for(const [key,value] of [["cudaInitialized",true],["optimizerSteps",1],["imagesWritten",1],["checkpointsWritten",1],["fixedSeedRollouts",11]]){
    const f=fixture();f.replay[key]=value;assert.throws(()=>summary(f));
  }
});
test("incomplete source and forged qualification or summary are rejected",()=>{
  for(const change of [f=>{f.source.executionState="failed_closed"},f=>{f.source.optimizerSteps=1999},
    f=>{f.source.qualification={}},f=>{f.source.qualification.worldEntryAllowed=true},f=>{f.replay.summary={changed:true}}]){
    const f=fixture();change(f);assert.throws(()=>summary(f));
  }
});
test("decision recomputes signs instead of trusting reported booleans",()=>{
  const s=summary();s.allRgbImproved=false;s.anyRgbRegression=true;
  assert.equal(decideTrainingComparison(s,evidence).matchedOption,"candidate_improved_train_only");
  s.rows[0].changes.rgbMae.delta=100;assert.throws(()=>decideTrainingComparison(s,evidence));
});
test("empty advice cannot pass vacuously",()=>{assert.throws(()=>decideTrainingComparison({rows:[]},evidence));});
test("unsafe paths and stale registry snapshots are rejected",()=>{
  for(const p of ["../escape","F:/elsewhere","/elsewhere","data\\bad",""])assert.throws(()=>projectFile(process.cwd(),p));
  const request={expectedPreviousRevision:3,expectedPreviousSha256:"a",latestTrainingRunId:"train"};
  const current={ok:true,registrySha256:"a",registry:{registryRevision:3,activeExecution:null,latestTrainingTerminal:{runId:"train"}}};
  validateLaunchSnapshot(request,current);current.registry.registryRevision++;assert.throws(()=>validateLaunchSnapshot(request,current));
});
test("request path is exact and bound contents are rehashed",()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"painter-result-shadow-test-"));
  fs.mkdirSync(path.join(root,"current"));const p="current/diagnostic-request.json",file=path.join(root,p);
  const value={schemaVersion:"ai-painter-training-result-shadow-request-v1",identity:"current-id",outputRoot:"current",
    mode:"cpu_frozen_training_result_replay_no_training_or_release",limits:{wallSeconds:300,cpuThreads:4,optimizerSteps:0,
      fixedSeedRollouts:12,automaticRetries:0,maxOutputMiB:4}};
  const bytes=Buffer.from(JSON.stringify(value));fs.writeFileSync(file,bytes,{flag:"wx"});
  const b={path:p,sha256:crypto.createHash("sha256").update(bytes).digest("hex")};
  try{
    assert.equal(requestOf({projectRoot:root,packageIdentity:"current-id",outputRoot:"current",inputEvidence:[evidence,b]}).request.identity,"current-id");
    fs.writeFileSync(file,"{}");assert.throws(()=>boundJson(root,b),/hash mismatch/);
  }finally{fs.unlinkSync(file);fs.rmdirSync(path.join(root,"current"));fs.rmdirSync(root);}
});
test("only transient IO retries, with a fixed bound",async()=>{
  let n=0;await retryTransientIo(()=>{if(++n<3)throw Object.assign(new Error("busy"),{code:"EBUSY"});},{sleep:async()=>{}});assert.equal(n,3);
  n=0;await assert.rejects(()=>retryTransientIo(()=>{n++;throw new Error("invalid evidence");},{sleep:async()=>{}}));assert.equal(n,1);
});
