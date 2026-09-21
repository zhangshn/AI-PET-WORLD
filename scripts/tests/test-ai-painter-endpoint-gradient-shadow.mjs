import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeEndpointGradient,decideEndpointGradient,validatePredecessor,validateLaunchSnapshot,samplingOutputRoot} from '../lib/ai-painter-endpoint-gradient-shadow-v1.mjs';
const KEYS=['decodedRgb','decodedRgbGradient','decodedRgbLaplacian','decodedRgbQuietRegionExcess','sparseRegionDecodedRgb',
  'sparseRegionContrast','spatialGridRgb','pathBoundaryRgb','objectSemanticRgb','pathInteriorRgb','pathForbiddenBoundaryRgb'];
const checkpoint={path:'.runtime/source/control.pt',sha256:'a'.repeat(64)},evidence={path:'.runtime/test/review.json',sha256:'b'.repeat(64)};
test('sampling image namespace follows its bound execution, not the newer diagnostic task',()=>{
  assert.equal(samplingOutputRoot({path:'.runtime/original-sampling/execute.json',sha256:'a'.repeat(64)}),'.runtime/original-sampling');
  for(const path of ['../escape/execute.json','.runtime/later/finalize.json'])
    assert.throws(()=>samplingOutputRoot({path,sha256:'a'.repeat(64)}));
});
function fixture(){
  const weights=Object.fromEntries(KEYS.map(k=>[k,1]));
  const rows=[];for(const sampleId of ['146','147'])for(const seed of [1,2,3])rows.push({arm:'legacy_global_schedule_control',sampleId,seed,steps:10,
    split:'train',fullEndpoint:true,targetUsedForInitialization:false,targetEncoded:false,baselineExact:true,
    noiseStateSha256:'c'.repeat(64),image:{path:`.runtime/source/${sampleId}-${seed}.png`,sha256:'d'.repeat(64)},
    measurements:{final:{rgbMae:1}},objective:11,objectiveTerms:structuredClone(weights),
    gradient:seed===1?{nonzeroParameterCount:10,baseOutputReached:true,gradientL2:1,frozenAeGradientCount:0,frozenHeadGradientCount:0,
      activationCheckpointing:true,optimizerCreated:false}:null});
  return {sampled:{rows:structuredClone(rows)},weights,replay:{schemaVersion:'ai-painter-endpoint-rgb-gradient-probe-v1',
    status:'cpu_endpoint_gradient_verified_not_trained',rows,parentCheckpoint:checkpoint,rgbLossWeights:weights,
    modelStateSha256BeforeAndAfter:'e'.repeat(64),fixedSeedRollouts:6,backwardProbes:2,sourcePngPixelsReproduced:6,
    imagesWritten:0,checkpointsWritten:0,optimizerSteps:0,cudaInitialized:false,modelAndNormalizationUnchanged:true,limitations:[]}};
}
const summarize=f=>summarizeEndpointGradient(f.sampled,f.replay,f.weights,checkpoint);
test('six exact forwards and two nonzero actual gradients remain untrained',()=>{
  const s=summarize(fixture()),d=decideEndpointGradient(s,evidence);assert.equal(s.cpuCandidatePathVerified,true);
  assert.equal(s.gpuCandidateQualified,false);assert.equal(d.applied,false);assert.equal(d.nextMachineAction,null);
});
test('only the completed current RGB diagnosis is a valid predecessor',()=>{
  const p={schemaVersion:'ai-painter-rgb-composition-shadow-result-v1',status:'rgb_composition_shadow_completed_not_visual_qualified',executionState:'completed',runId:'current'};
  validatePredecessor(p,{runId:'current'});
  for(const patch of [{schemaVersion:'ai-painter-endpoint-gradient-shadow-result-v1'},{status:'failed'},{executionState:'failed_closed'},{runId:'historical'}])
    assert.throws(()=>validatePredecessor({...p,...patch},{runId:'current'}));
});
test('missing, reordered, duplicated, non-train or target-initialized probes fail',()=>{
  for(const mutate of [r=>r.pop(),r=>r.reverse(),r=>r[1]=r[0],r=>r[0].split='validation',
    r=>r[0].targetUsedForInitialization=true,r=>r[0].targetEncoded=true,r=>r[0].fullEndpoint=false]){
    const f=fixture();mutate(f.replay.rows);assert.throws(()=>summarize(f));
  }
});
test('forward evidence cannot differ from the exact current source',()=>{
  for(const mutate of [r=>r.image={...r.image,sha256:'f'.repeat(64)},r=>r.measurements={},r=>r.noiseStateSha256='0'.repeat(64),r=>r.baselineExact=false]){
    const f=fixture();mutate(f.replay.rows[0]);assert.throws(()=>summarize(f));
  }
});
test('gradient must reach base output without frozen parameter gradients',()=>{
  for(const patch of [{baseOutputReached:false},{nonzeroParameterCount:0},{gradientL2:0},{gradientL2:NaN},
    {frozenAeGradientCount:1},{frozenHeadGradientCount:1},{optimizerCreated:true},{activationCheckpointing:false}]){
    const f=fixture();Object.assign(f.replay.rows[0].gradient,patch);assert.throws(()=>summarize(f));
  }
});
test('only the two predeclared first-seed probes may run backward',()=>{
  for(const mutate of [r=>r[0].gradient=null,r=>r[1].gradient=structuredClone(r[0].gradient)]){
    const f=fixture();mutate(f.replay.rows);assert.throws(()=>summarize(f));
  }
});
test('RGB terms and weights cannot be added removed changed or fabricated',()=>{
  for(const mutate of [f=>f.replay.rgbLossWeights={...f.weights,velocity:1},f=>f.replay.rgbLossWeights={...f.weights,decodedRgb:2},
    f=>f.replay.rows[0].objective=12,f=>f.replay.rows[0].objectiveTerms.decodedRgb=NaN,
    f=>delete f.replay.rows[0].objectiveTerms.pathInteriorRgb]){
    const f=fixture();mutate(f);assert.throws(()=>summarize(f));
  }
});
test('GPU optimizer model changes and wrong parent are rejected',()=>{
  for(const mutate of [r=>r.cudaInitialized=true,r=>r.optimizerSteps=1,r=>r.modelAndNormalizationUnchanged=false,
    r=>r.parentCheckpoint={...checkpoint,sha256:'f'.repeat(64)}]){
    const f=fixture();mutate(f.replay);assert.throws(()=>summarize(f));
  }
});
test('source rows remain unchanged and stale launch fails closed',()=>{
  const f=fixture(),before=structuredClone(f);summarize(f);assert.deepEqual(f,before);
  const request={expectedPreviousRevision:112,expectedPreviousSha256:'a',latestTrainingRunId:'train'};
  const current={ok:true,registrySha256:'a',registry:{registryRevision:112,activeExecution:null,latestTrainingTerminal:{runId:'train'}}};
  validateLaunchSnapshot(request,current);current.registry.registryRevision++;assert.throws(()=>validateLaunchSnapshot(request,current));
});
