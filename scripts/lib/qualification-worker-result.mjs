// Pure worker-result validation. Each version supplies its original policy, model and binding checks.
import assert from "node:assert/strict";

export function createQualificationWorkerResultValidator({ policy, MODEL, COUNTS, byteBinding }) {
  return function validateWorkerResult(value,p,mode,packageBinding,runId,expectedSampleIds=null){
  assert.equal(value.schemaVersion,p.wireProtocols.worker);assert.equal(value.runId,runId);assert.equal(value.mode,mode);
  assert.deepEqual(value.policy,policy());assert.deepEqual(value.package,byteBinding(packageBinding));
  for(const [key,want] of Object.entries(p.qualification))assert.equal(value[key],want,key);
  assert.deepEqual(Object.keys(value.counts).sort(),[...COUNTS].sort());
  for(const key of COUNTS)assert(Number.isSafeInteger(value.counts[key])&&value.counts[key]>=0,'invalid observed count '+key);
  for(const [kind,max] of [['forward',48],['generator',240],['discriminator',48],['cudaInitialization',1]]){
    assert(value.counts[kind+'Completed']<=value.counts[kind+'Attempted']&&value.counts[kind+'Attempted']<=max,'observed call ceiling '+kind);}
  assert.equal(value.counts.optimizerConstruction,0);assert.equal(value.counts.optimizerUpdates,0);
  if(mode==='cpu_prepare')for(const key of COUNTS)assert.equal(value.counts[key],0,'CPU no-compute boundary');
  if(value.status==='failed_closed'){assert.equal(value.executionState,'failed_closed');assert(value.firstError&&typeof value.firstError.message==='string');return false;}
  assert.equal(value.executionState,'completed');assert.equal(value.status,mode==='cpu_prepare'?'cpu_preparation_passed':'gpu_qualification_passed');
  assert.deepEqual(value.stateDigestBefore,value.stateDigestAfter);assert.deepEqual(value.stateDigestBefore,value.modelIdentity.initialState);
  assert.equal(value.modelIdentity.capabilityVersion,MODEL);assert.equal(value.modelIdentity.parameterCount,108);assert.equal(value.modelIdentity.parameterElements,2242687);
  assert.equal(value.modelIdentity.graph[48].name,p.target.parameterName);assert.deepEqual(value.modelIdentity.graph[48].shape,p.target.weightShape);
  assert(Array.isArray(value.cpuAffinity)&&value.cpuAffinity.length>=1&&value.cpuAffinity.length<=2
    &&new Set(value.cpuAffinity).size===value.cpuAffinity.length&&value.cpuAffinity.every(v=>Number.isInteger(v)&&v>=0));
  assert.equal(value.sampleIds.length,mode==='cpu_prepare'?8:48);assert.equal(new Set(value.sampleIds).size,value.sampleIds.length);
  if(expectedSampleIds!==null)assert.deepEqual(value.sampleIds,expectedSampleIds,'exact original split sample order');
  if(mode==='cpu_prepare'){
    assert.equal(value.cudaInitialized,false);assert.deepEqual(value.completedSampleIds,[]);
    assert.equal(value.componentTests.status,'passed');assert(value.componentTests.testsRun>0);
    for(const key of ['failures','errors','skipped'])assert.equal(value.componentTests[key],0);assert.equal(value.componentTests.realModelAutograd,false);
  }else{
    assert.equal(value.cudaInitialized,true);assert(value.counts.cudaCalls>0);
    for(const [kind,count] of [['forward',48],['generator',240],['discriminator',48],['cudaInitialization',1]])
      for(const suffix of ['Attempted','Completed'])assert.equal(value.counts[kind+suffix],count);
    assert.deepEqual(value.completedSampleIds,value.sampleIds);
  }return true;
}
}
