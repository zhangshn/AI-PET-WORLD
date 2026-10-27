import assert from 'node:assert/strict'
export const consumedSingle149Policy='data/ai-painter/system-governance/ai-painter-single149-terrain-ecology-fit-policy-v1.json'
export const single149Policy='data/ai-painter/system-governance/ai-painter-single149-terrain-ecology-fit-policy-v2.json'
export const single149Worker='ml/ai-painter/scripts/painter_single149_terrain_ecology_fit_v1.py'
export const single149Tests='test_single149_terrain_ecology_fit_v1.py'
export const single149Sample='ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'
export const single149Capability='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
export function single149Succeeded(result,pkg,code,timedOut){
 try{
  assert.equal(code,0);assert.equal(timedOut,false)
  assert.equal(pkg.schemaVersion,'single-map-checkpoint-fit-package-v1');assert.equal(pkg.policy.path,single149Policy)
  assert.equal(pkg.selectedSampleId,single149Sample);assert.equal(pkg.sampleIdentity.sampleId,single149Sample);assert.equal(pkg.sampleIdentity.split,'train')
  assert.equal(pkg.modelCapability,single149Capability);assert.equal(pkg.training.pairs,200);assert.equal(pkg.training.supportStructureWeight,0.1)
  assert.equal(pkg.checkpoint.sha256,'20c83c99b029d983a2bd15a9774d372abbd9c8bbf5f20626e90aaa4d276d8aef');assert.deepEqual(pkg.checkpoint,pkg.parentExperiment.checkpoint)
  assert.equal(result.experimentIdentity,pkg.experimentIdentity);assert.equal(result.status,'experiment_executed_not_visual_qualified')
  assert.deepEqual(result.optimizerSteps,{generator:200,discriminator:200});assert.equal(result.checkpointReloadExact,true);assert.equal(result.formalQualificationGranted,false)
  for(const name of ['checkpoint-final.pt','zero-update-gpu-probe.json','parent-output-continuity.json'])assert.equal(result.artifacts.filter(b=>b.path===pkg.outputRoot+'/'+name).length,1)
  return true
 }catch{return false}
}
