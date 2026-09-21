import test from "node:test";
import assert from "node:assert/strict";
import { summarizePairedSampling, decidePairedSampling, projectFile, validateLaunchSnapshot } from "../lib/ai-painter-paired-sampling-shadow-v1.mjs";

const ARMS=["legacy_global_schedule_control","per_sample_schedule_candidate"];
const STEPS=[50,25,10];
const METRICS=["rgbMae","laplacianMae","edgeMae","phase4ResidualRmsAfterGlobalBiasRemoval"];
const HEADS=["terrain_path_ground","object_footprints","object_tree","object_rock","object_vegetation"];
const OUTPUT=".runtime/ai-painter/learning-capacity-experiments/test-sampling";
const evidence={path:OUTPUT+"/review.json",sha256:"a".repeat(64)};
function measured(value){return {final:Object.fromEntries(METRICS.map(m=>[m,value])),base:{rgbMae:value},
  semanticRegions:Object.fromEntries(HEADS.map(m=>[m,{rgbMae:value,pixelWeight:10}])),coverageFraction:0.05,outsideCoverageMaxAbsoluteChange:0};}
function fixture(){
  const samples=["sample146","sample147"],seeds=[[20264008,20264108,20264208],[20264009,20264109,20264209]];
  const sourceRows=[],rows=[],images=[],artifacts=[];
  for(const arm of ARMS)for(let i=0;i<2;i++)for(let j=0;j<3;j++){
    const sampleId=samples[i],seed=seeds[i][j];
    const image={path:`.runtime/source/${arm}-${i}-${j}.png`,sha256:"b".repeat(64)};artifacts.push(image);
    sourceRows.push({arm,sampleId,seed,split:"train",targetUsedForInitialization:false,baseline:{final:measured(2).final},measurements:measured(1)});
    for(const steps of STEPS){
      const img=steps===50?image:{path:`${OUTPUT}/${arm}-${steps}-${i}-${j}.png`,sha256:"c".repeat(64)};
      if(steps!==50)images.push(img);
      rows.push({arm,sampleId,seed,steps,split:"train",targetUsedForInitialization:false,fullEndpoint:true,
        noiseStateSha256:"d".repeat(64),measurements:measured(steps===50?1:steps===25?0.9:0.8),image:img,baselinePixelsAndMeasurementsExact:steps===50});
    }
  }
  const groups={};for(const arm of ARMS){groups[arm]={};for(const steps of [25,10]){
    const v=steps===25?0.9:0.8,delta=v-1,pct=(1-v)*100;
    groups[arm][String(steps)]=Object.fromEntries([...METRICS,...HEADS].map(m=>[m,{improvedCount:6,worseCount:0,equalCount:0,
      absoluteChangeRange:[delta,delta],relativeReductionPercentRange:[pct,pct]}]));
  }}
  const summary={fixture:"original paired training"};
  return {source:{schemaVersion:"ai-painter-timestep-ab-result-v1",executionState:"completed",optimizerSteps:2000,checkpointReloadExact:true,
      rows:sourceRows,summary,artifacts,qualification:Object.fromEntries(["formalDatasetQualified","formalGpuQualified","formalTrainingAllowed",
        "checkpointPromotable","formalInferenceEligible","worldEntryAllowed"].map(k=>[k,false]))},
    replay:{schemaVersion:"ai-painter-paired-sampling-comparison-v1",status:"sampling_comparison_completed_not_qualified",
      sourceResult:{path:".runtime/source/result.json",sha256:"e".repeat(64)},rows,images,
      summary:{comparedWithOwn50Steps:groups,checkpointSelected:false,samplerSelected:false,rootCauseProven:false,formalVisualQualification:false},
      fixedSeedRollouts:36,imagesWritten:24,checkpointsWritten:0,optimizerSteps:0,cudaInitialized:false,
      modelAndNormalizationUnchanged:true,sourcePngPixelsReproduced:12,limitations:[],
      baselineReplay:{status:"metrics_replayed_exactly",cudaInitialized:false,optimizerSteps:0,fixedSeedRollouts:12,
        imagesWritten:0,checkpointsWritten:0,rowsReplayed:12,summary}}};
}
function summarize(f=fixture()){return summarizePairedSampling(f.source,f.replay,OUTPUT);}

test("36 rollouts, four per-model comparisons, no selected sampler",()=>{
  const s=summarize(),d=decidePairedSampling(s,evidence);
  assert.equal(s.rowsChecked,36);assert.equal(s.images.length,24);assert.equal(d.matchedOption,"short_grids_reduce_recorded_errors");
  assert.equal(d.applied,false);assert.equal(d.nextMachineAction,null);assert.equal(d.uniqueRootCauseProven,false);
});
test("a single scene regression remains mixed, not silently averaged away",()=>{
  const f=fixture();f.replay.rows[2].measurements.final.rgbMae=2;
  const m=f.replay.summary.comparedWithOwn50Steps[ARMS[0]]["10"].rgbMae;
  m.improvedCount=5;m.worseCount=1;m.absoluteChangeRange[1]=1;m.relativeReductionPercentRange[0]=-100;
  assert.equal(decidePairedSampling(summarize(f),evidence).matchedOption,"mixed_short_grid_effect");
});
test("road or object regression prevents unanimous improvement advice",()=>{
  const f=fixture();f.replay.rows[1].measurements.semanticRegions.terrain_path_ground.rgbMae=2;
  const m=f.replay.summary.comparedWithOwn50Steps[ARMS[0]]["25"].terrain_path_ground;
  m.improvedCount=5;m.worseCount=1;m.absoluteChangeRange[1]=1;m.relativeReductionPercentRange[0]=-100;
  assert.equal(decidePairedSampling(summarize(f),evidence).matchedOption,"mixed_short_grid_effect");
});
test("incomplete, repeated or reordered grids rejected",()=>{
  for(const change of [r=>r.pop(),r=>r.reverse(),r=>r[1]=r[0]]){const f=fixture();change(f.replay.rows);assert.throws(()=>summarize(f));}
});
test("50-step baseline metrics and pixel receipts must match exact source",()=>{
  for(const change of [r=>r.baselinePixelsAndMeasurementsExact=false,r=>r.measurements.final.rgbMae++,
    r=>r.image={path:r.image.path,sha256:"a".repeat(64)}]){const f=fixture();change(f.replay.rows[0]);assert.throws(()=>summarize(f));}
});
test("all grids must share noise and complete the clean endpoint",()=>{
  for(const change of [r=>r.noiseStateSha256="0".repeat(64),r=>r.fullEndpoint=false,r=>r.targetUsedForInitialization=true]){
    const f=fixture();change(f.replay.rows[1]);assert.throws(()=>summarize(f));
  }
});
test("short-grid outputs cannot escape, overwrite baselines or omit an image",()=>{
  for(const change of [f=>f.replay.rows[1].image={path:"../outside.png",sha256:"c".repeat(64)},
    f=>f.replay.images.pop(),f=>f.replay.images[1]=f.replay.images[0]]){const f=fixture();change(f);assert.throws(()=>summarize(f));}
});
test("nonfinite, boolean or negative measurements rejected",()=>{
  for(const v of [NaN,Infinity,true,null,-1]){const f=fixture();f.replay.rows[1].measurements.final.rgbMae=v;assert.throws(()=>summarize(f));}
});
test("fabricated metric summary cannot replace independently computed deltas",()=>{
  const f=fixture();f.replay.summary.comparedWithOwn50Steps[ARMS[0]]["10"].rgbMae.improvedCount=5;assert.throws(()=>summarize(f));
});
test("GPU, optimizer, holdout and formal qualification remain blocked",()=>{
  for(const change of [f=>f.replay.cudaInitialized=true,f=>f.replay.optimizerSteps=1,f=>f.replay.rows[1].split="challenge",
    f=>f.replay.modelAndNormalizationUnchanged=false,f=>f.source.qualification.worldEntryAllowed=true,
    f=>f.replay.summary.samplerSelected=true]){const f=fixture();change(f);assert.throws(()=>summarize(f));}
});
test("empty or malformed adjudication fails closed",()=>{
  assert.throws(()=>decidePairedSampling({},evidence));const s=summarize();s.comparedWithOwn50Steps[ARMS[0]]["25"].rgbMae.improvedCount=7;
  assert.throws(()=>decidePairedSampling(s,evidence));
});
test("stale launch and paths outside project rejected",()=>{
  assert.throws(()=>projectFile(process.cwd(),"../outside"));
  const request={expectedPreviousRevision:108,expectedPreviousSha256:"a",latestTrainingRunId:"train"};
  const current={ok:true,registrySha256:"a",registry:{registryRevision:108,activeExecution:null,latestTrainingTerminal:{runId:"train"}}};
  validateLaunchSnapshot(request,current);current.registry.registryRevision++;assert.throws(()=>validateLaunchSnapshot(request,current));
});
