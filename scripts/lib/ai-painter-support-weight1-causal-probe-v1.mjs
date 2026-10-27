import assert from 'node:assert/strict'
export const causalProbePolicy='data/ai-painter/system-governance/ai-painter-support-weight1-causal-probe-policy-v1.json'
export const target44CausalProbePolicy='data/ai-painter/system-governance/ai-painter-parameter44-causal-probe-policy-v1.json'
export const causalProbeWorker='ml/ai-painter/scripts/painter_support_weight1_causal_probe_v1.py'
export const causalProbeTests='test_support_weight1_causal_probe_v1.py'
export function causalProbeSucceeded(result,pkg,code,timedOut){
 try{
  assert.equal(code,0);assert.equal(timedOut,false);assert.ok([causalProbePolicy,target44CausalProbePolicy].includes(pkg.policy.path));const target=pkg.policy.path===target44CausalProbePolicy?44:0;if(target===44){assert.equal(pkg.targetIndex,44);assert.equal(result.targetIndex,44)}
  assert.equal(pkg.schemaVersion,'support-weight1-causal-probe-package-v1')
  assert.equal(result.experimentIdentity,pkg.experimentIdentity);assert.equal(result.sampleId,pkg.sampleId)
  assert.equal(result.status,'zero_update_causal_observation_completed_not_qualified')
  assert.equal(result.gpuStarted,true);assert.equal(result.trainingStarted,false)
  assert.equal(result.formalQualificationGranted,false);assert.equal(result.historicalReplayClaimed,false)
  assert.equal(result.modelStateUnchanged,true);assert.deepEqual(result.stateBefore,result.stateAfter)
  assert.deepEqual(result.optimizerSteps,{generator:0,discriminator:0})
  assert.deepEqual(result.counts,{forwardAttempted:1,forwardCompleted:1,generatorAttempted:5,generatorCompleted:5,discriminatorAttempted:1,discriminatorCompleted:1})
  assert.equal(result.artifacts.filter(b=>b.path===pkg.outputRoot+'/same-call-target'+target+'.pt').length,1)
  return true
 }catch{return false}
}
