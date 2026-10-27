export const consumedBackgroundPolicy='data/ai-painter/system-governance/ai-painter-rock-background-policy-v1.json'
import assert from 'node:assert/strict'
export const backgroundPolicy='data/ai-painter/system-governance/ai-painter-rock-background-policy-v2.json'
export const backgroundWorker='ml/ai-painter/scripts/painter_rock_background_probe_v1.py'
export const backgroundTests='test_rock_background_probe_v1.py'
export function backgroundSucceeded(result,pkg,code,timedOut){
 try{
  assert.equal(code,0);assert.equal(timedOut,false);assert.equal(pkg.policy.path,backgroundPolicy)
  assert.equal(pkg.schemaVersion,'rock-background-probe-package-v1');assert.equal(pkg.training.pairs,100)
  assert.equal(result.experimentIdentity,pkg.experimentIdentity);assert.equal(result.arm,'background');assert.equal(pkg.arm,'background')
  assert.equal(result.backgroundAuxiliaryChanged,true);assert.equal(result.status,'experiment_executed_not_visual_qualified')
  assert.equal(result.checkpointReloadExact,true);assert.equal(result.formalQualificationGranted,false)
  assert.deepEqual(result.optimizerSteps,{generator:100,discriminator:100});assert.deepEqual(result.sampleVisits,Object.fromEntries(pkg.selectedSampleIds.map(s=>[s,50])))
  assert.equal(result.artifacts.filter(b=>b.path===pkg.outputRoot+'/checkpoint-final.pt').length,1)
  return true
 }catch{return false}
}
