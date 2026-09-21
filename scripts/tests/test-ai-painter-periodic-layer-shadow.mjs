import test from "node:test";
import assert from "node:assert/strict";
import { summarizePeriodicLayers, decidePeriodicLayers, verifyPhaseDecomposition,
  projectFile, validateLaunchSnapshot, retryTransientIo } from "../lib/ai-painter-periodic-layer-shadow-v1.mjs";

const evidence={path:".runtime/ai-painter/diagnostic.json",sha256:"a".repeat(64)};
const arms=["legacy_global_schedule_control","per_sample_schedule_candidate"];
const metric="phase4ResidualRmsAfterGlobalBiasRemoval";
const metricNames=["rgbMae","laplacianMae",metric];
const components=["reconstruction","generatedDecodeIncrement","compositionIncrement"];
function metrics(phase){return {rgbMae:0.1,laplacianMae:0.2,[metric]:phase};}
function decompose(rec,base,final){
  const values={reconstruction:rec,generatedDecodeIncrement:base-rec,compositionIncrement:final-base,baseResidual:base,finalResidual:final};
  const vectors=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Array.from({length:16},(_,i)=>[1,1,1].map(()=>i%2?v:-v))]));
  const energies=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v*v]));
  const crossTerms={};for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)crossTerms[components[i]+"__"+components[j]]=2*values[components[i]]*values[components[j]];
  return {vectors,energies,crossTerms,telescopingMaxError:0,summedEnergy:final*final};
}
function fixture(){
  const samples=["sample146","sample147"],seeds=[[20264008,20264108,20264208],[20264009,20264109,20264209]];
  const artifacts=[];
  const layers=arms.flatMap((arm,a)=>samples.flatMap((sampleId,i)=>seeds[i].map(seed=>{
    const b=0.003+a*0.001,f=b-0.0001,reconstruction=metrics(0.001);
    const baselinePng={path:`.runtime/${arm}-${seed}.png`,sha256:"b".repeat(64)};artifacts.push(baselinePng);
    return {arm,sampleId,seed,reconstruction,base:metrics(b),final:metrics(f),phaseDecomposition:decompose(0.001,b,f),
      reconstructionTensorSha256:"c".repeat(64),baselinePng,pngPixelsExact:true,noiseStateSha256:"d".repeat(64),
      generatedLatentSha256:"e".repeat(64),normalizedLatentMseAgainstEncodedTarget:0.01,
      outsideCoverageMaxAbsoluteChange:0,coverageFraction:0.05,regions:{covered:{pixelWeight:10}}};
  })));
  const rows=layers.map(r=>({arm:r.arm,sampleId:r.sampleId,seed:r.seed,split:"train",targetUsedForInitialization:false,
    baseline:{final:Object.fromEntries(metricNames.map(k=>[k,0.6]))},
    measurements:{base:r.base,final:r.final,coverageFraction:r.coverageFraction,regions:r.regions}}));
  const summary={fixture:"frozen result"};
  const source={schemaVersion:"ai-painter-timestep-ab-result-v1",executionState:"completed",optimizerSteps:2000,
    checkpointReloadExact:true,rows,summary,artifacts,qualification:Object.fromEntries(["formalDatasetQualified","formalGpuQualified",
      "formalTrainingAllowed","checkpointPromotable","formalInferenceEligible","worldEntryAllowed"].map(k=>[k,false]))};
  const replay={schemaVersion:"ai-painter-paired-periodic-layer-diagnosis-v1",status:"metrics_replayed_exactly",
    cudaInitialized:false,optimizerSteps:0,fixedSeedRollouts:12,imagesWritten:0,checkpointsWritten:0,rowsReplayed:12,
    summary,layers,modelAndNormalizationUnchanged:true,sourcePngPixelsReproduced:12,commonFrozenStateSha256:"f".repeat(64),
    reconstructions:samples.map(sampleId=>({sampleId,split:"train",purpose:"target_reconstruction_diagnostic_only",metrics:metrics(0.001),tensorSha256:"c".repeat(64)})),limitations:[]};
  return {source,replay};
}
function summarize(f=fixture()){return summarizePeriodicLayers(f.source,f.replay);}

test("all twelve layer rows independently checked, priority is not repair",()=>{
  const s=summarize();assert.equal(s.rows.length,12);
  const d=decidePeriodicLayers(s,evidence);assert.equal(d.matchedOption,"generated_latent_decode_boundary_priority");
  assert.equal(d.uniqueRootCauseProven,false);assert.equal(d.applied,false);assert.equal(d.nextMachineAction,null);
});
test("composition or reconstruction priority comes from actual row directions",()=>{
  for(const [values,expected] of [[[1,2,3],"rgb_composition_boundary_priority"],[[3,2,1],"reconstruction_boundary_priority"]]){
    const s=summarize();s.rows.forEach(r=>{
      [r.reconstruction,r.base,r.final]=values;r.baseMinusReconstruction=r.base-r.reconstruction;r.finalMinusBase=r.final-r.base;
    });assert.equal(decidePeriodicLayers(s,evidence).matchedOption,expected);
  }
});
test("inconsistent rows stay indeterminate and cannot be called a fix",()=>{
  const s=summarize();s.rows[0].final=1;s.rows[0].finalMinusBase=1-s.rows[0].base;
  assert.equal(decidePeriodicLayers(s,evidence).matchedOption,"indeterminate_layer_attribution");
});
test("positive component energies retain negative cancellation cross term",()=>{
  const row={reconstruction:metrics(0.1),base:metrics(0),final:metrics(0)},d=decompose(0.1,0,0);
  verifyPhaseDecomposition(d,row);assert(d.crossTerms.reconstruction__generatedDecodeIncrement<0);
  d.crossTerms.reconstruction__generatedDecodeIncrement=0;assert.throws(()=>verifyPhaseDecomposition(d,row));
});
test("forged energy, vector, mean or cross term rejected",()=>{
  for(const change of [d=>d.energies.baseResidual++,d=>d.vectors.baseResidual[0][0]++,
    d=>d.crossTerms.compositionIncrement__fake=1,d=>d.summedEnergy++,d=>d.vectors.finalResidual.pop()]){
    const f=fixture();change(f.replay.layers[0].phaseDecomposition);assert.throws(()=>summarize(f));
  }
});
test("missing reordered or duplicate row fails closed",()=>{
  for(const change of [x=>x.pop(),x=>x.reverse(),x=>x[1]=x[0]]){const f=fixture();change(f.replay.layers);assert.throws(()=>summarize(f));}
});
test("reconstruction or original metric substitution is rejected",()=>{
  for(const change of [f=>f.replay.reconstructions[0].sampleId="other",f=>f.replay.layers[0].reconstructionTensorSha256="0".repeat(64),
    f=>f.replay.layers[0].base={...f.replay.layers[0].base,rgbMae:0.9}]){
    const f=fixture();change(f);assert.throws(()=>summarize(f));
  }
});
test("same seed must have identical noise and PNG must belong to source",()=>{
  for(const change of [f=>f.replay.layers[6].noiseStateSha256="0".repeat(64),f=>f.replay.layers[0].baselinePng={path:"other",sha256:"b".repeat(64)},
    f=>f.replay.layers[0].pngPixelsExact=false]){const f=fixture();change(f);assert.throws(()=>summarize(f));}
});
test("invalid numbers or fabricated deltas fail closed",()=>{
  for(const n of [NaN,Infinity,true,null,-1]){const f=fixture();f.replay.layers[0].normalizedLatentMseAgainstEncodedTarget=n;assert.throws(()=>summarize(f));}
  const s=summarize();s.rows[0].baseMinusReconstruction++;assert.throws(()=>decidePeriodicLayers(s,evidence));
});
test("no GPU, optimization, model mutation or qualification may pass",()=>{
  for(const [key,value] of [["cudaInitialized",true],["optimizerSteps",1],["modelAndNormalizationUnchanged",false],
    ["sourcePngPixelsReproduced",11],["imagesWritten",1]]){const f=fixture();f.replay[key]=value;assert.throws(()=>summarize(f));}
  const f=fixture();f.source.qualification.worldEntryAllowed=true;assert.throws(()=>summarize(f));
});
test("holdout and target-fed generation remain forbidden",()=>{
  for(const [key,value] of [["split","challenge"],["targetUsedForInitialization",true]]){
    const f=fixture();f.source.rows[0][key]=value;assert.throws(()=>summarize(f));
  }
});
test("stale launches and unsafe paths are rejected",()=>{
  for(const p of ["../escape","F:/elsewhere","/elsewhere","data\\bad",""])assert.throws(()=>projectFile(process.cwd(),p));
  const request={expectedPreviousRevision:3,expectedPreviousSha256:"a",latestTrainingRunId:"train"};
  const current={ok:true,registrySha256:"a",registry:{registryRevision:3,activeExecution:null,latestTrainingTerminal:{runId:"train"}}};
  validateLaunchSnapshot(request,current);current.registry.activeExecution={};assert.throws(()=>validateLaunchSnapshot(request,current));
});
test("commit retries are bounded and cannot retry evidence failures",async()=>{
  let n=0;await retryTransientIo(()=>{if(++n<2)throw Object.assign(new Error("busy"),{code:"EBUSY"});},{sleep:async()=>{}});assert.equal(n,2);
  n=0;await assert.rejects(()=>retryTransientIo(()=>{n++;throw new Error("evidence");},{sleep:async()=>{}}));assert.equal(n,1);
});
