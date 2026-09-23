import assert from 'node:assert/strict';
import test from 'node:test';
import {validateFoundationProbeResult} from '../lib/ai-painter-foundation-cpu-evidence.mjs';

const checkpoint = {path:'fixture/autoencoder.pt',sha256:'a'.repeat(64)};
function fixture() {
  return {schemaVersion:'foundation-cpu-load-probe-result-v1',runId:'fixture-run',
    status:'cpu_load_and_probe_freeze_verified_not_training_qualified',pid:42,
    policy:{path:'data/ai-painter/system-governance/ai-painter-foundation-cpu-load-probe-policy-v1.json',
      sha256:'e01ada89734708bd3bca15b52b2fec9954a7d87e913da9b30f93a63f9c8ab46c'},
    checkpoint:{...checkpoint},device:'cpu',checkpointDeserialized:true,restrictedWeightsOnly:true,
    parameterSelectionExcludesFoundation:true,inputGradientFinite:true,
    loadedStateSha256:'b'.repeat(64),afterModeSwitchStateSha256:'b'.repeat(64),afterProbeStateSha256:'b'.repeat(64),
    optimizerCreated:false,parameterGradientsCreated:false,gpuStarted:false,realDatasetRead:false,
    checkpointWritten:false,trainingFreezeProven:false,historicalIsolationQualified:false,
    trainingAllowed:false,capabilityReleased:false,optimizerSteps:0,
    probeInputShape:[1,3,16,16],probeLatentShape:[1,12,4,4]};
}
const validate = v => validateFoundationProbeResult(v,{runId:'fixture-run',checkpoint});
test('consistent probe supports only CPU load/freeze, not qualification',()=>{
  const v=fixture(); validate(v); assert.equal(v.trainingAllowed,false); assert.equal(v.trainingFreezeProven,false);
});
for (const [name,mutate] of [
  ['run substitution',v=>v.runId='other'],
  ['checkpoint substitution',v=>v.checkpoint.sha256='c'.repeat(64)],
  ['policy substitution',v=>v.policy.sha256='c'.repeat(64)],
  ['unsafe deserialization',v=>v.restrictedWeightsOnly=false],
  ['mode switch changes state',v=>v.afterModeSwitchStateSha256='c'.repeat(64)],
  ['probe changes state',v=>v.afterProbeStateSha256='c'.repeat(64)],
  ['malformed state identity',v=>{v.loadedStateSha256=v.afterModeSwitchStateSha256=v.afterProbeStateSha256='invalid';}],
  ['optimizer update',v=>v.optimizerSteps=1],
  ['gradient missing',v=>v.inputGradientFinite=false],
  ['GPU device',v=>v.device='cuda'],
  ['wrong shape',v=>v.probeInputShape=[1,3,192,256]],
  ...['optimizerCreated','parameterGradientsCreated','gpuStarted','realDatasetRead','checkpointWritten',
    'trainingFreezeProven','historicalIsolationQualified','trainingAllowed','capabilityReleased'].map(key=>[key,v=>v[key]=true]),
]) test(`reject ${name}`,()=>{const v=fixture();mutate(v);assert.throws(()=>validate(v));});
