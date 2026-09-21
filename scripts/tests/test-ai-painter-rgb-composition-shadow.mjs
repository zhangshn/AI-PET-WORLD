import test from "node:test";
import assert from "node:assert/strict";
import {summarizeRgbComposition,checkAttribution,decideRgbComposition,projectFile,validateLaunchSnapshot,validatePredecessor} from "../lib/ai-painter-rgb-composition-shadow-v1.mjs";
const ARMS=["legacy_global_schedule_control","per_sample_schedule_candidate"];
const HEADS=["terrain_path_ground","object_footprints","object_tree","object_rock","object_vegetation"];
const METRICS=["rgbMae","laplacianMae","edgeMae","phase4ResidualRmsAfterGlobalBiasRemoval"];
const EVIDENCE={path:".runtime/fixture/review.json",sha256:"a".repeat(64)};
test("only the completed current sampling predecessor is accepted, not this adapter's own terminal",()=>{
  const previous={schemaVersion:"ai-painter-paired-sampling-shadow-result-v1",executionState:"completed",
    status:"paired_sampling_shadow_completed_not_visual_qualified",runId:"current"};
  validatePredecessor(previous,{runId:"current"});
  for(const patch of [{schemaVersion:"ai-painter-rgb-composition-shadow-result-v1"},{executionState:"failed_closed"},
    {status:"rgb_composition_shadow_completed_not_visual_qualified"},{runId:"historical"}])
    assert.throws(()=>validatePredecessor({...previous,...patch},{runId:"current"}));
});
const metrics=v=>Object.fromEntries(METRICS.map(k=>[k,v]));
const region=(n,v)=>({pixelWeight:n,rgbMae:n?v:null,absoluteRgbErrorSum:3*n*v,meanRgbBias:n?[0,0,0]:null});
function attribution(){
  const regions={};for(const [name,n] of Object.entries({uncovered:49000,coveredInterior:100,coveredBoundary:52,overlap:100,singleResponsibility:52}))
    regions[name]={base:region(n,1),final:region(n,name==="uncovered"?1:2)};
  const heads=Object.fromEntries(HEADS.map(h=>[h,{proposal:region(10,2),base:region(10,1),final:region(10,2),
    exclusivePixelWeight:5,overlapPixelWeight:5,replaceWithBase:metrics(0.9),symmetricMseChangeContribution:0.05}]));
  return {base:metrics(1),final:{...metrics(2),rgbMae:1+152/49152},heads,regions,
    compositorEquationExact:true,outsideChangeMax:0,additiveRgbMaxError:0,mseChange:0.25,mseAccountingError:0,
    absoluteRgbErrorSumChange:456,partitionError:0,counterfactualApplied:false,semanticQualification:false};
}
function fixture(){
  const rows=[];for(const arm of ARMS)for(const sampleId of ["146","147"])for(const seed of [1,2,3])for(const steps of [50,10]){
    const a=attribution();rows.push({arm,sampleId,seed,steps,split:"train",fullEndpoint:true,targetUsedForInitialization:false,baselineExact:true,
      image:{path:`.runtime/source/${arm}-${sampleId}-${seed}-${steps}.png`,sha256:"b".repeat(64)},noiseStateSha256:"c".repeat(64),
      measurements:{base:a.base,final:a.final},attribution:a});
  }
  return {sampled:{rows:structuredClone(rows)},replay:{schemaVersion:"ai-painter-paired-rgb-composition-v1",
    status:"composition_attribution_completed_not_qualified",rows,trainingControls:["146","147"].map(sampleId=>({sampleId,split:"train",
      purpose:"actual_head_fit_input_replay_not_new_generation",baselineExact:true,attribution:attribution()})),
    fixedSeedRollouts:24,cachedTrainingInputReplays:2,sourcePngPixelsReproduced:26,imagesWritten:0,checkpointsWritten:0,
    optimizerSteps:0,cudaInitialized:false,modelAndNormalizationUnchanged:true,limitations:[]}};
}
const summarize=f=>summarizeRgbComposition(f.sampled,f.replay);
test("all 24 replays and two actual head-fit controls are checked",()=>{
  const s=summarize(fixture()),d=decideRgbComposition(s,EVIDENCE);
  assert.equal(s.rowsChecked,24);assert.equal(s.pngBaselinesExact,26);assert.deepEqual(d.consistentlyRegressingHeads,HEADS);
  assert.equal(d.applied,false);assert.equal(d.nextMachineAction,null);assert.equal(d.uniqueRootCauseProven,false);
});
test("one opposite head result is retained and disqualifies consistency",()=>{
  const f=fixture();f.replay.rows[0].attribution.heads[HEADS[0]].replaceWithBase.rgbMae=5;
  const s=summarize(f),d=decideRgbComposition(s,EVIDENCE);
  assert.equal(s.groups[ARMS[0]]["50"].heads[HEADS[0]].replaceWithBaseVsFinal.rgbMae.worseCount,1);
  assert(!d.consistentlyRegressingHeads.includes(HEADS[0]));
});
test("missing, duplicated, reordered rows cannot pass",()=>{
  for(const mutate of [r=>r.pop(),r=>r.reverse(),r=>r[1]=r[0]]){const f=fixture();mutate(f.replay.rows);assert.throws(()=>summarize(f));}
});
test("source measurements, images, noise and endpoints must replay",()=>{
  for(const mutate of [r=>r.measurements={base:metrics(3),final:metrics(3)},r=>r.image={...r.image,sha256:"d".repeat(64)},
    r=>r.noiseStateSha256="e".repeat(64),r=>r.fullEndpoint=false,r=>r.baselineExact=false]){
    const f=fixture();mutate(f.replay.rows[0]);assert.throws(()=>summarize(f));
  }
});
test("nonfinite metrics and invalid region accounting rejected",()=>{
  for(const mutate of [a=>a.heads[HEADS[0]].replaceWithBase.rgbMae=NaN,a=>a.regions.coveredBoundary.final.absoluteRgbErrorSum++,
    a=>a.regions.uncovered.final.rgbMae=3,a=>a.regions.coveredBoundary.base.pixelWeight++,a=>a.final.rgbMae=5,
    a=>a.heads[HEADS[0]].symmetricMseChangeContribution++,a=>a.heads[HEADS[0]].exclusivePixelWeight=100]){
    const a=attribution();mutate(a);assert.throws(()=>checkAttribution(a));
  }
});
test("training controls are mandatory, ordered, train-only and exact",()=>{
  for(const mutate of [r=>r.pop(),r=>r.reverse(),r=>r[0].split="validation",r=>r[0].baselineExact=false]){
    const f=fixture();mutate(f.replay.trainingControls);assert.throws(()=>summarize(f));
  }
});
test("GPU, weight mutation, holdout and head bypass prohibited",()=>{
  for(const mutate of [r=>r.cudaInitialized=true,r=>r.optimizerSteps=1,r=>r.modelAndNormalizationUnchanged=false,
    r=>r.rows[0].split="challenge",r=>r.rows[0].targetUsedForInitialization=true,
    r=>r.rows[0].attribution.counterfactualApplied=true,r=>r.rows[0].attribution.semanticQualification=true]){
    const f=fixture();mutate(f.replay);assert.throws(()=>summarize(f));
  }
});
test("malformed decision counts cannot be treated as evidence",()=>{
  const s=summarize(fixture());s.groups[ARMS[0]]["50"].heads[HEADS[0]].proposalVsBaseRegionRgb.worseCount=7;
  assert.throws(()=>decideRgbComposition(s,EVIDENCE));assert.throws(()=>decideRgbComposition({},EVIDENCE));
});
test("summary does not alter raw observations",()=>{
  const f=fixture(),before=structuredClone(f);summarize(f);assert.deepEqual(f,before);
});
test("unsafe paths and stale registry snapshots fail closed",()=>{
  for(const p of ["../escape","C:/escape",".runtime/../escape"])assert.throws(()=>projectFile(process.cwd(),p));
  const request={expectedPreviousRevision:110,expectedPreviousSha256:"a",latestTrainingRunId:"train"};
  const current={ok:true,registrySha256:"a",registry:{registryRevision:110,activeExecution:null,latestTrainingTerminal:{runId:"train"}}};
  validateLaunchSnapshot(request,current);current.registry.registryRevision++;assert.throws(()=>validateLaunchSnapshot(request,current));
});
