import assert from 'node:assert/strict'
export const rehearsalPolicy='data/ai-painter/system-governance/ai-painter-mixed-train-rehearsal-policy-v1.json'
export const supportWeight1Policy='data/ai-painter/system-governance/ai-painter-mixed-train-support-weight1-policy-v1.json'
export const stemPolicies={
 'stem-baseline':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-baseline-policy-v1.json',
 'stem-support1':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-support1-policy-v1.json'}
export const stemPairPolicies={
 'stem-pair-support1':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-pair-support1-policy-v1.json',
 'stem-pair-baseline':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-pair-baseline-policy-v1.json'}
export const stemDecoderPolicies={
 'stem-decoder-support1':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-decoder-support1-policy-v1.json',
 'stem-decoder-baseline':'data/ai-painter/system-governance/ai-painter-mixed-train-stem-decoder-baseline-policy-v1.json'}
export const rehearsalWorker='ml/ai-painter/scripts/painter_mixed_train_rehearsal_v1.py'
export const rehearsalTests='test_mixed_train_rehearsal_v1.py'
export const terrainEcologyPolicy='data/ai-painter/system-governance/ai-painter-mixed-train-terrain-ecology-policy-v1.json'
export function rehearsalSucceeded(result,pkg,code,timedOut){
 try{
  assert.equal(code,0);assert.equal(timedOut,false);assert.ok([rehearsalPolicy,supportWeight1Policy,terrainEcologyPolicy,...Object.values(stemPolicies),...Object.values(stemPairPolicies),...Object.values(stemDecoderPolicies)].includes(pkg.policy.path))
  const arm=Object.entries({...stemPolicies,...stemPairPolicies,...stemDecoderPolicies}).find(([,path])=>path===pkg.policy.path)?.[0] ?? (pkg.policy.path===terrainEcologyPolicy?'terrain-ecology':pkg.policy.path===supportWeight1Policy?'support-weight1':'rehearsal')
  if(arm==='terrain-ecology'){assert.equal(pkg.modelArchitectureChanged,true);assert.equal(pkg.terrainEcologyConditionAdded,true);assert.equal(pkg.numericOperatorsChanged,true);assert.equal(pkg.modelCapability,'stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1');assert.equal(result.modelCapability,pkg.modelCapability)}
  if(arm.startsWith('stem-')){assert.equal(pkg.numericOperatorsChanged,true);assert.equal(pkg.modelCapability,arm.startsWith('stem-decoder-')?'stage4_mvp256_dry_factorized_ecology_stem_pair_decode2_inner_weight_precision_v1':arm.startsWith('stem-pair-')?'stage4_mvp256_dry_factorized_ecology_stem_pair_weight_precision_v1':'stage4_mvp256_dry_factorized_ecology_stem_weight_precision_v1');assert.equal(result.modelCapability,pkg.modelCapability)}
  assert.equal(pkg.schemaVersion,'mixed-train-rehearsal-package-v1');assert.equal(pkg.training.pairs,448)
  assert.equal(pkg.selectedSampleIds.length,48);assert.equal(new Set(pkg.selectedSampleIds).size,48)
  assert.equal(result.experimentIdentity,pkg.experimentIdentity);assert.equal(result.arm,arm);assert.equal(pkg.arm,arm)
  assert.equal(pkg.training.supportStructureWeight,['support-weight1','stem-support1','stem-pair-support1','stem-decoder-support1'].includes(arm)?1:0.1)
  assert.equal(result.backgroundAuxiliaryChanged,true);assert.equal(result.status,'experiment_executed_not_visual_qualified')
  assert.equal(result.checkpointReloadExact,true);assert.equal(result.formalQualificationGranted,false)
  assert.deepEqual(result.optimizerSteps,{generator:448,discriminator:448})
  const anchor='mvp64-slot164-objects-v5-20261020';assert(pkg.selectedSampleIds.includes(anchor))
  assert.deepEqual(result.sampleVisits,Object.fromEntries(pkg.selectedSampleIds.map(s=>[s,s===anchor?72:8])))
  assert.equal(result.artifacts.filter(b=>b.path===pkg.outputRoot+'/checkpoint-final.pt').length,1)
  return true
 }catch{return false}
}
