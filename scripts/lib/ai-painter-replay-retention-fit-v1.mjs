import assert from 'node:assert/strict'

export const replayPolicies=Object.freeze({
 mixed:'data/ai-painter/system-governance/ai-painter-replay-retention-mixed-policy-v1.json',
 short:'data/ai-painter/system-governance/ai-painter-replay-retention-short-policy-v1.json',
 balanced:'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json',
 'balanced-boundary':'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-boundary-policy-v1.json',
})
export const replayWorker='ml/ai-painter/scripts/painter_replay_retention_fit_v1.py'
export const replayTests='test_replay_retention_fit_v1.py'

const TARGET='ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'
const CAPABILITY='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
const PARENT='.runtime/ai-painter/learning-capacity-experiments/mixed-train-terrain-ecology-v1-2b8a12c543a07576de72'
const CHECKPOINT=Object.freeze({path:PARENT+'/checkpoint-final.pt',sha256:'20c83c99b029d983a2bd15a9774d372abbd9c8bbf5f20626e90aaa4d276d8aef'})
const BALANCED_POLICY_SHA='4394bf6250cdd73f9271a414ead91a2ad8427c8586cfeabfdb408ee949ab68db'
export const boundaryPolicyBinding=Object.freeze({path:replayPolicies['balanced-boundary'],sha256:'d82723c8420eead460c4aeb8e28d44a430dee2f82800d6a332c8fc5ffb2cc235'})
export function boundaryTraining(){return {
 pairs:200,targetPairs:5,replayPairs:195,seed:20260929,supportStructureWeight:0.1,
 checkpointSelection:'final_step_only',observations:[0,25,50,100,150,200],sampling:'original48_round_robin_four_passes_then_first8',
 trainingObjective:'stage4_balanced_boundary_rgb_001_v1',boundaryRgbWeight:0.01,
 boundaryRgbDefinition:{reference:'bound_original_1024x768_RGB',prediction:'native_256x192_float_RGB_repeat_interleave_4_each_axis',
  expectedRoad:'bound_terrain_path_ground_first_component_gt_zero',
  requiredSides:'for each north/east/south/west projected 6px strip, include whole strip iff original expected road has any true pixel inside that strip',
  boundaryBandProjectedPixels:6,
  aggregation:'sum(abs(projected_prediction-reference_RGB_float_0_to_1)*mask[None,None]) / max(3*sum(mask),1)',
  gradient:'float_prediction_no_quantization_no_reference_downsample',missingInput:'fail_closed',structuralEmpty:'connected_zero_and_not_applicable',
  mask:'expectedRoad AND union_of_included_6px_strips',
  implementationReference:'ml/ai-painter/src/ai_painter/complete_world/road_attribution_observation_v1.py:21-33,53-55'}
}}
const PARENT_BINDINGS=Object.freeze({
 package:{path:PARENT+'/package.json',sha256:'41bf35d3f30a2ee4e6286041ed859a3e83a82c05ccb8b0461de6271cc6455291'},
 terminal:{path:PARENT+'/terminal.json',sha256:'8c576f90fe4d67fa276968edd0ecdac0d038abdc0ef5fa3aab22bd254bc8cf4d'},
 result:{path:PARENT+'/result.json',sha256:'c315800abf1bdda2f10a9b960a64069f3fa9d841b5cef8d07d0b73d06f7d5622'},
 checkpoint:CHECKPOINT,
 prediction:{path:PARENT+'/prediction-149-448.png',sha256:'c4bb12fbf3c01219211d43b73e3094a1cdc60eb11e243a9c40c11afe6f38dd46'},
})
// The published, corrected train split order is fixed; callers cannot select a
// different replay population by providing a self-consistent visit map.
const TRAIN=Object.freeze([
 '146-forested-low-mountain-v3','147-grassland-forest-transition-v4',
 '148-grassland-forest-transition-v3','149-tropical-forest-glade-v3',
 '150-tropical-forest-glade-v3','151-tropical-forest-glade-v2',
 '152-tropical-forest-glade-v2','153-forested-low-mountain-v2',
 '154-tropical-forest-glade-v2','155-grassland-forest-transition-v2',
 '156-seasonal-evergreen-semi-evergreen-forest-v2','157-grassland-forest-transition-v2',
 '158-forested-low-mountain-v2','159-dry-dipterocarp-woodland-v2',
 '160-forested-low-mountain-v2','161-grassland-forest-transition-v2',
 '162-grassland-forest-transition-v2','163-tropical-forest-glade-v2',
 '164','165-seasonal-evergreen-semi-evergreen-forest-v2',
 '166-seasonal-evergreen-semi-evergreen-forest-v2','167-tropical-forest-glade-v2',
 '168-dry-dipterocarp-woodland-v3','169-forested-low-mountain-v2',
 '170-forested-low-mountain-v2','171-grassland-forest-transition-v2',
 '172-seasonal-evergreen-semi-evergreen-forest-v2','173-grassland-forest-transition-v2',
 '174-forested-low-mountain-v2','175-dry-dipterocarp-woodland-v2',
 '176-forested-low-mountain-v2','177-dry-dipterocarp-woodland-v2',
 '178-forested-low-mountain-v3','179-forested-low-mountain-v2',
 '180-seasonal-evergreen-semi-evergreen-forest-v2','181-dry-dipterocarp-woodland-v2',
 '182-forested-low-mountain-v2','183-bamboo-grove-v2',
 '184-seasonal-evergreen-semi-evergreen-forest-v3','185-forested-low-mountain-v2',
 '186-grassland-forest-transition-v2','187-grassland-forest-transition-v2',
 '188-grassland-forest-transition-v3','190-wet-season-drainage-hollow-v7',
 '191-forested-low-mountain-v2','192-forested-low-mountain-v3',
 '193-tropical-forest-glade-v2','194-wet-season-drainage-hollow-v6',
].map(s=>s==='164'?'mvp64-slot164-objects-v5-20261020':'ai-cold-start-v7-v7-capacity-slot-'+s))

function logical(value){
 assert.equal(typeof value,'string')
 assert.ok(value.length>0&&value.length<=4096&&!/[\\:\x00-\x1f\x7f]/u.test(value))
 assert.ok(value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&part!=='latest'&&part!=='latest.json'))
 return value
}
function binding(value){
 assert.ok(value!==null&&typeof value==='object'&&!Array.isArray(value))
 logical(value.path);assert.match(value.sha256,/^[a-f0-9]{64}$/u)
 return value
}

export function validateBoundaryIdentity(pkg,result=null){
 assert.equal(pkg.arm,'balanced-boundary');assert.deepEqual(pkg.policy,boundaryPolicyBinding)
 assert.deepEqual(pkg.training,boundaryTraining());assert.deepEqual(pkg.parentExperiment,PARENT_BINDINGS)
 assert.deepEqual(pkg.selectedSampleIds,TRAIN)
 assert.deepEqual(pkg.sampleIdentities.map(i=>i.sampleId),TRAIN)
 const expected=pkg.sampleIdentities.map(i=>{
  assert.equal(i.split,'train');const roads=i.channels.filter(b=>b.id==='terrain_path_ground');assert.equal(roads.length,1)
  return {sampleId:i.sampleId,image:i.image,road:{path:roads[0].path,sha256:roads[0].sha256},conditionPack:i.conditionPack}
 })
 assert.deepEqual(pkg.boundaryInputBindings,expected)
 for(const row of expected)for(const key of ['image','road','conditionPack']){
  binding(row[key]);assert(pkg.inputs.some(b=>b.path===row[key].path&&b.sha256===row[key].sha256),'boundary input not frozen')
 }
 if(result)assert.equal(result.trainingObjective,pkg.training.trainingObjective)
}

// This pure completion check consumes the managed worker's evidence. It does
// not authenticate files, perform GPU admission, or grant visual qualification.
export function replaySucceeded(result,pkg,code,timedOut){
 try{
  assert.equal(code,0);assert.equal(timedOut,false)
  assert.equal(pkg.schemaVersion,'replay-retention-fit-package-v1')
  assert.ok(Object.hasOwn(replayPolicies,pkg.arm));assert.equal(pkg.policy.path,replayPolicies[pkg.arm]);binding(pkg.policy)
  assert.equal(pkg.modelCapability,CAPABILITY);assert.equal(result.modelCapability,CAPABILITY)
  assert.deepEqual(pkg.checkpoint,CHECKPOINT);assert.deepEqual(pkg.parentExperiment.checkpoint,CHECKPOINT)
  assert.equal(pkg.training.seed,20260929);assert.equal(pkg.training.supportStructureWeight,0.1)
  const boundary=pkg.arm==='balanced-boundary',mixed=pkg.arm==='mixed',balanced=pkg.arm==='balanced'||boundary,pairs=pkg.arm==='short'?100:200,
   target=balanced?5:100,replay=balanced?195:mixed?100:0,selected=pkg.arm==='short'?[TARGET]:TRAIN
  assert.equal(pkg.training.pairs,pairs);assert.equal(pkg.training.targetPairs,target);assert.equal(pkg.training.replayPairs,replay)
  if(balanced){
   assert.equal(pkg.policy.sha256,boundary?boundaryPolicyBinding.sha256:BALANCED_POLICY_SHA)
   assert.deepEqual(pkg.parentExperiment,PARENT_BINDINGS)
   assert.deepEqual(pkg.training,boundary?boundaryTraining():{pairs:200,targetPairs:5,replayPairs:195,seed:20260929,supportStructureWeight:0.1,
    checkpointSelection:'final_step_only',observations:[0,25,50,100,150,200],sampling:'original48_round_robin_four_passes_then_first8'})
   assert.deepEqual(pkg.resources,{maxWallSeconds:1800,cudaMemoryFraction:0.7,minimumFreeVramMiB:2048,
    maximumTemperatureC:85,minimumFreeDiskMiB:2048,maxOutputMiB:128,cpuThreads:2,automaticRetries:0})
   assert.equal(pkg.optimizerInitialization,'fresh_AdamW_no_parent_moments_available')
   assert.equal(pkg.qualificationGranted,false);assert.equal(pkg.a100Reference,null)
   assert.ok(pkg.experimentIdentity.startsWith('replay-retention-'+pkg.arm+'-v1-'))
  }
  if(boundary)validateBoundaryIdentity(pkg,result)
  assert.deepEqual(pkg.selectedSampleIds,selected)
  const others=TRAIN.filter(s=>s!==TARGET),schedule=balanced?[...TRAIN,...TRAIN,...TRAIN,...TRAIN,...TRAIN.slice(0,8)]:mixed?
   Array.from({length:100},(_,i)=>[TARGET,others[i%others.length]]).flat():Array(100).fill(TARGET)
  assert.deepEqual(pkg.schedule,schedule)
  const visits=Object.fromEntries(selected.map(s=>[s,0]))
  for(const id of schedule)visits[id]++
  assert.deepEqual(pkg.plannedSampleVisits,visits)
  assert.equal(typeof pkg.experimentIdentity,'string');assert.match(pkg.experimentIdentity,/^[a-z0-9][a-z0-9-]{7,127}$/u)
  logical(pkg.outputRoot);assert.equal(pkg.outputRoot,'.runtime/ai-painter/learning-capacity-experiments/'+pkg.experimentIdentity)
  assert.equal(result.experimentIdentity,pkg.experimentIdentity);assert.equal(result.arm,pkg.arm)
  assert.equal(result.status,'experiment_executed_not_visual_qualified')
  assert.deepEqual(result.optimizerSteps,{generator:pairs,discriminator:pairs})
  assert.deepEqual(result.plannedSampleVisits,visits);assert.deepEqual(result.sampleVisits,visits)
  assert.equal(result.targetUpdates,target);assert.equal(result.replayUpdates,replay)
  assert.equal(result.checkpointReloadExact,true);assert.equal(result.sameParentStartVerified,true)
  assert.deepEqual(result.zeroUpdateAdmission,{selectedSampleCount:selected.length,completedSampleCount:selected.length,passed:true})
  assert.equal(result.formalQualificationGranted,false)
  for(const flag of ['checkpointPromotable','runtimePublicationAllowed','runtimePublicationGranted','formalStage4QualificationGranted'])
   if(Object.hasOwn(result,flag))assert.equal(result[flag],false)
  assert.ok(Array.isArray(result.artifacts))
  const paths=new Set()
  for(const artifact of result.artifacts){
   binding(artifact);assert.ok(artifact.path.startsWith(pkg.outputRoot+'/'));assert.ok(!paths.has(artifact.path));paths.add(artifact.path)
  }
  for(const name of ['checkpoint-final.pt','zero-update-gpu-probes.json','parent-output-continuity.json'])
   assert.ok(paths.has(pkg.outputRoot+'/'+name))
  return true
 }catch{return false}
}
