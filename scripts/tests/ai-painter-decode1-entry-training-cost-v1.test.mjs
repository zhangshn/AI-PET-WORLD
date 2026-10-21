import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePolicy,RESOURCES,validateWorker,binding,POLICY,requireTotalBudget} from '../diagnose-ai-painter-decode1-entry-training-cost-v1.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const policy=()=>JSON.parse(fs.readFileSync(path.join(root,POLICY.path),'utf8'));
test('registered policy is exact one-shot zero-update scope; reject relaxed guards',()=>{
  assert.equal(validatePolicy(policy()),true);
  for(const [section,key,value] of [['resources','gpuDiagnosticSeconds',181],['resources','maxGpuMemoryFraction',.71],
    ['resources','maximumTemperatureC',86],['executionBoundary','automaticRetries',1],
    ['executionBoundary','training',true],['executionBoundary','preserveAllOriginalResourceChecksAndFrequencies',false],
    ['sourceBoundary','maximumFiles',260],['scope','initializationSeed',1],['observation','extraCudaSynchronizations',1]]){
    const p=policy();p[section][key]=value;assert.throws(()=>validatePolicy(p));
  }
});
test('bindings cannot escape project or claim unobserved bytes',()=>{
  for(const name of ['../x','/x','C:/x','x\\y','x//y','x/./y'])assert.throws(()=>binding({path:name,sha256:'a'.repeat(64)}));
  assert.throws(()=>binding({path:'ok',sha256:'guessed'}));
  assert.deepEqual(binding({path:'data/ok.json',sha256:'a'.repeat(64)}),{path:'data/ok.json',sha256:'a'.repeat(64)});
});
test('failure closure can use the last64KiB without exceeding the original128MiB',()=>{
  const max=RESOURCES.maxOutputBytes,reserve=RESOURCES.failureTerminalReserveBytes;
  requireTotalBudget(max-reserve,0,false);
  assert.throws(()=>requireTotalBudget(max-reserve,1,false));
  requireTotalBudget(max-reserve,reserve,true);
  requireTotalBudget(max,0,true);
  assert.throws(()=>requireTotalBudget(max,1,true));
  for(const bad of [-1,NaN,Infinity,.1])assert.throws(()=>requireTotalBudget(bad,0,true));
});
test('CPU and GPU terminal counts cannot masquerade as each other or qualification',()=>{
  const sample=cpu=>({executionState:'completed',status:cpu?'cpu_preparation_passed':'probe_completed_no_training_qualification',
    trainingAllowed:false,gpuQualified:false,stage4Qualified:false,checkpointWritten:false,imageWritten:false,capabilityReleased:false,historicalReplayAllowed:false,
    cudaInitialized:!cpu,counts:{generatorForwards:cpu?0:1,generatorAutograd:cpu?0:5,discriminatorAutograd:cpu?0:1,
      autogradAttempts:cpu?0:6,autogradCompleted:cpu?0:6,sampleDecodeAttempts:cpu?0:1,decodedSamples:cpu?0:1,optimizerConstruction:0,optimizerUpdates:0},
    timings:{schemaVersion:'ai-painter-decode1-entry-training-cost-observation-v1',spans:[]}});
  for(const cpu of [true,false]){assert(validateWorker(sample(cpu),cpu));assert.throws(()=>validateWorker(sample(cpu),!cpu));
    for(const key of ['generatorAutograd','discriminatorAutograd','optimizerConstruction','optimizerUpdates']){
      const value=sample(cpu);value.counts[key]++;assert.throws(()=>validateWorker(value,cpu));}
    const value=sample(cpu);value.trainingAllowed=true;assert.throws(()=>validateWorker(value,cpu));}
  assert.equal(RESOURCES.cpuPreparationSeconds,120);assert.equal(RESOURCES.gpuDiagnosticSeconds,180);
});
