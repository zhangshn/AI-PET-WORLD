import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {replayPolicies,replayWorker,replayTests,replaySucceeded,boundaryTraining,boundaryPolicyBinding} from '../lib/ai-painter-replay-retention-fit-v1.mjs'

const TARGET='ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'
const CAPABILITY='stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'
const train=JSON.parse(fs.readFileSync(new URL('../../data/ai-painter/system-governance/ai-painter-mixed-train-terrain-ecology-policy-v1.json',import.meta.url),'utf8')).sampleIds
const balancedPolicyBytes=fs.readFileSync(new URL('../../data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json',import.meta.url))
const balancedPolicy=JSON.parse(balancedPolicyBytes),balancedPolicySha=createHash('sha256').update(balancedPolicyBytes).digest('hex')
function fixture(arm='mixed'){
 if(arm==='balanced-boundary'){
  const f=fixture('balanced'),oldRoot=f.pkg.outputRoot
  f.pkg.arm=arm;f.pkg.policy={...boundaryPolicyBinding};f.pkg.training=boundaryTraining()
  f.pkg.experimentIdentity=f.pkg.experimentIdentity.replace('balanced-v1-','balanced-boundary-v1-')
  f.pkg.outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+f.pkg.experimentIdentity
  f.result.arm=arm;f.result.experimentIdentity=f.pkg.experimentIdentity;f.result.trainingObjective=f.pkg.training.trainingObjective
  f.result.artifacts=f.result.artifacts.map(b=>({...b,path:b.path.replace(oldRoot,f.pkg.outputRoot)}))
  f.pkg.sampleIdentities=train.map((sampleId,n)=>({sampleId,split:'train',
   image:{path:`data/synthetic/${n}.png`,sha256:'a'.repeat(64)},conditionPack:{path:`data/synthetic/${n}.json`,sha256:'b'.repeat(64)},
   channels:[{id:'terrain_path_ground',path:`data/synthetic/${n}-road.png`,sha256:'c'.repeat(64)}]}))
  f.pkg.boundaryInputBindings=f.pkg.sampleIdentities.map(i=>({sampleId:i.sampleId,image:i.image,road:{path:i.channels[0].path,sha256:i.channels[0].sha256},conditionPack:i.conditionPack}))
  f.pkg.inputs=f.pkg.boundaryInputBindings.flatMap(i=>[i.image,i.road,i.conditionPack])
  return f
 }
 const mixed=arm==='mixed',balanced=arm==='balanced',pairs=arm==='short'?100:200,target=balanced?5:100,
  replay=balanced?195:mixed?100:0,selected=arm==='short'?[TARGET]:[...train],others=train.filter(s=>s!==TARGET)
 const schedule=balanced?[...train,...train,...train,...train,...train.slice(0,8)]:mixed?
  Array.from({length:100},(_,i)=>[TARGET,others[i%47]]).flat():Array(100).fill(TARGET)
 const visits=Object.fromEntries(selected.map(s=>[s,0]));for(const sid of schedule)visits[sid]++
 const checkpoint={path:'.runtime/ai-painter/learning-capacity-experiments/mixed-train-terrain-ecology-v1-2b8a12c543a07576de72/checkpoint-final.pt',sha256:'20c83c99b029d983a2bd15a9774d372abbd9c8bbf5f20626e90aaa4d276d8aef'}
 const identity='replay-retention-'+arm+'-v1-synthetic',outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+identity
 const pkg={schemaVersion:'replay-retention-fit-package-v1',arm,policy:{path:replayPolicies[arm],sha256:balanced?balancedPolicySha:'a'.repeat(64)},modelCapability:CAPABILITY,
  checkpoint,parentExperiment:balanced?structuredClone(balancedPolicy.parentExperiment):{checkpoint:structuredClone(checkpoint)},
  training:balanced?structuredClone(balancedPolicy.training):{pairs,targetPairs:target,replayPairs:replay,seed:20260929,supportStructureWeight:.1},
  selectedSampleIds:selected,schedule,plannedSampleVisits:visits,experimentIdentity:identity,outputRoot}
 if(balanced)Object.assign(pkg,{resources:structuredClone(balancedPolicy.resources),
  optimizerInitialization:'fresh_AdamW_no_parent_moments_available',qualificationGranted:false,a100Reference:null})
 const result={experimentIdentity:identity,arm,modelCapability:CAPABILITY,status:'experiment_executed_not_visual_qualified',optimizerSteps:{generator:pairs,discriminator:pairs},
  plannedSampleVisits:structuredClone(visits),sampleVisits:structuredClone(visits),targetUpdates:target,replayUpdates:replay,checkpointReloadExact:true,sameParentStartVerified:true,
  zeroUpdateAdmission:{selectedSampleCount:selected.length,completedSampleCount:selected.length,passed:true},formalQualificationGranted:false,
  artifacts:['checkpoint-final.pt','zero-update-gpu-probes.json','parent-output-continuity.json'].map(n=>({path:outputRoot+'/'+n,sha256:'b'.repeat(64)}))}
 return {pkg,result}
}

test('exports retain the registered replay policies and fixed Python implementation paths',()=>{
 assert.deepEqual(replayPolicies,{mixed:'data/ai-painter/system-governance/ai-painter-replay-retention-mixed-policy-v1.json',short:'data/ai-painter/system-governance/ai-painter-replay-retention-short-policy-v1.json',balanced:'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-policy-v1.json','balanced-boundary':'data/ai-painter/system-governance/ai-painter-replay-retention-balanced-boundary-policy-v1.json'})
 assert.equal(replayWorker,'ml/ai-painter/scripts/painter_replay_retention_fit_v1.py');assert.equal(replayTests,'test_replay_retention_fit_v1.py')
 assert.equal(Object.isFrozen(replayPolicies),true)
})
for(const arm of ['mixed','short','balanced','balanced-boundary']){
 test(arm+' accepts only a completed synthetic managed-result contract, without running a worker',()=>{
  const f=fixture(arm),before=structuredClone(f)
  assert.equal(replaySucceeded(f.result,f.pkg,0,false),true);assert.deepEqual(f,before)
  assert.equal(replaySucceeded(f.result,f.pkg,1,false),false);assert.equal(replaySucceeded(f.result,f.pkg,0,true),false)
  assert.equal(replaySucceeded(f.result,f.pkg,false,false),false);assert.equal(replaySucceeded(f.result,f.pkg,0,0),false)
 })
 const cases=[
  ['unknown arm',f=>f.pkg.arm='foreign'],['inherited policy',f=>f.pkg.policy.path='data/ai-painter/system-governance/ai-painter-single149-terrain-ecology-fit-policy-v2.json'],
  ['policy SHA',f=>f.pkg.policy.sha256='not-a-digest'],['old schema',f=>f.pkg.schemaVersion='single-map-checkpoint-fit-package-v1'],
  ['old model',f=>f.pkg.modelCapability='old'],['foreign result model',f=>f.result.modelCapability='old'],
  ['different parent SHA',f=>f.pkg.checkpoint.sha256='c'.repeat(64)],['different parent path',f=>f.pkg.checkpoint.path='.runtime/foreign/checkpoint-final.pt'],
  ['relabelled parent',f=>f.pkg.parentExperiment.checkpoint.sha256='d'.repeat(64)],['seed',f=>f.pkg.training.seed++],
  ['stronger loss',f=>f.pkg.training.supportStructureWeight=1],['pair budget',f=>f.pkg.training.pairs++],
  ['target budget',f=>f.pkg.training.targetPairs=99],['replay budget',f=>f.pkg.training.replayPairs++],
  ['wrong selected member',f=>f.pkg.selectedSampleIds[0]='foreign'],['schedule length',f=>f.pkg.schedule.pop()],
  ['different schedule',f=>f.pkg.schedule[0]='foreign'],['planned count',f=>f.pkg.plannedSampleVisits[TARGET]++],
  ['result planned count',f=>f.result.plannedSampleVisits[TARGET]++],['actual count',f=>f.result.sampleVisits[TARGET]--],
  ['extra visit member',f=>f.result.sampleVisits.foreign=0],['result arm',f=>f.result.arm='other'],
  ['result identity',f=>f.result.experimentIdentity='foreign-result'],['failed status',f=>f.result.status='experiment_failed_closed'],
  ['partial G',f=>f.result.optimizerSteps.generator--],['partial D',f=>f.result.optimizerSteps.discriminator--],
  ['extra optimizer count',f=>f.result.optimizerSteps.unknown=0],['target updates',f=>f.result.targetUpdates--],
  ['replay updates',f=>f.result.replayUpdates++],['reload unknown',f=>f.result.checkpointReloadExact=null],
  ['same parent unknown',f=>f.result.sameParentStartVerified=false],['admission partial',f=>f.result.zeroUpdateAdmission.completedSampleCount--],
  ['admission selected count',f=>f.result.zeroUpdateAdmission.selectedSampleCount++],['admission failed',f=>f.result.zeroUpdateAdmission.passed=false],
  ['qualification',f=>f.result.formalQualificationGranted=true],['runtime qualification',f=>f.result.runtimePublicationAllowed=true],
  ['missing final checkpoint',f=>f.result.artifacts.shift()],['missing probe evidence',f=>f.result.artifacts.splice(1,1)],
  ['missing parent continuity',f=>f.result.artifacts.pop()],['duplicate artifact',f=>f.result.artifacts.push(structuredClone(f.result.artifacts[0]))],
  ['bad artifact SHA',f=>f.result.artifacts[0].sha256='x'.repeat(64)],['foreign artifact root',f=>f.result.artifacts[0].path='.runtime/foreign/checkpoint-final.pt'],
  ['traversal artifact',f=>f.result.artifacts[0].path=f.pkg.outputRoot+'/../checkpoint-final.pt'],['wrong output root',f=>f.pkg.outputRoot+='/other'],
  ['nonfinite count',f=>f.result.sampleVisits[TARGET]=Infinity],['boolean count',f=>f.result.targetUpdates=true],
 ]
 for(const [label,mutate]of cases)test(arm+' rejects '+label,()=>{const f=fixture(arm);mutate(f);assert.equal(replaySucceeded(f.result,f.pkg,0,false),false)})
}
test('mixed freezes target-first round robin, exactly six replay maps have three visits and forty-one have two',()=>{
 const f=fixture(),others=train.filter(s=>s!==TARGET)
 assert.equal(replaySucceeded(f.result,f.pkg,0,false),true)
 assert.equal(f.pkg.plannedSampleVisits[TARGET],100)
 assert.deepEqual(others.map(s=>f.pkg.plannedSampleVisits[s]),others.map((_,i)=>i<6?3:2))
 const wrong=fixture();[wrong.pkg.schedule[0],wrong.pkg.schedule[1]]=[wrong.pkg.schedule[1],wrong.pkg.schedule[0]]
 assert.equal(replaySucceeded(wrong.result,wrong.pkg,0,false),false)
 const reordered=fixture();[reordered.pkg.selectedSampleIds[0],reordered.pkg.selectedSampleIds[1]]=[reordered.pkg.selectedSampleIds[1],reordered.pkg.selectedSampleIds[0]]
 assert.equal(replaySucceeded(reordered.result,reordered.pkg,0,false),false)
})
test('short cannot inherit the mixed full48 admission or replay population',()=>{
 const f=fixture('short');f.result.zeroUpdateAdmission={selectedSampleCount:48,completedSampleCount:48,passed:true}
 assert.equal(replaySucceeded(f.result,f.pkg,0,false),false)
 const bad=fixture('short');bad.pkg.selectedSampleIds=[...train]
 assert.equal(replaySucceeded(bad.result,bad.pkg,0,false),false)
})
test('balanced freezes four original48 passes plus first8, with149five and164four visits',()=>{
 const f=fixture('balanced')
 assert.equal(replaySucceeded(f.result,f.pkg,0,false),true)
 assert.deepEqual(f.pkg.schedule,[...train,...train,...train,...train,...train.slice(0,8)])
 assert.deepEqual(train.map(id=>f.pkg.plannedSampleVisits[id]),[...Array(8).fill(5),...Array(40).fill(4)])
 assert.equal(f.pkg.plannedSampleVisits[TARGET],5)
 assert.equal(f.pkg.plannedSampleVisits['mvp64-slot164-objects-v5-20261020'],4)
 assert.equal(f.result.targetUpdates,5);assert.equal(f.result.replayUpdates,195)
 assert.deepEqual(f.result.zeroUpdateAdmission,{selectedSampleCount:48,completedSampleCount:48,passed:true})
})
for(const [label,mutate]of [
 ['well-formed unregistered policy SHA',f=>f.pkg.policy.sha256='0'.repeat(64)],
 ['relabelled parent terminal',f=>f.pkg.parentExperiment.terminal.sha256='0'.repeat(64)],
 ['reordered selected48',f=>f.pkg.selectedSampleIds.reverse()],
 ['single149 old admission',f=>f.result.zeroUpdateAdmission={selectedSampleCount:1,completedSampleCount:1,passed:true}],
 ['schedule definition',f=>f.pkg.training.sampling='alternate149_then_original_other47_round_robin'],
 ['intermediate checkpoint selection',f=>f.pkg.training.checkpointSelection='best_validation'],
 ['extra observation',f=>f.pkg.training.observations.push(175)],
 ['optimizer moments',f=>f.pkg.optimizerInitialization='parent_moments'],
 ['package qualification',f=>f.pkg.qualificationGranted=true],
 ['single-map A reference',f=>f.pkg.a100Reference={}],
 ['foreign arm run prefix',f=>{f.pkg.experimentIdentity='replay-retention-mixed-v1-synthetic';f.result.experimentIdentity=f.pkg.experimentIdentity;f.pkg.outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+f.pkg.experimentIdentity}],
 ...Object.entries({maxWallSeconds:1801,cudaMemoryFraction:.71,minimumFreeVramMiB:1024,maximumTemperatureC:86,
  minimumFreeDiskMiB:1024,maxOutputMiB:129,cpuThreads:3,automaticRetries:1}).map(([key,value])=>['resource '+key,f=>f.pkg.resources[key]=value]),
])test('balanced rejects '+label,()=>{
 const f=fixture('balanced');mutate(f);assert.equal(replaySucceeded(f.result,f.pkg,0,false),false)
})
test('balanced rejects a self-consistent changed schedule or4/5allocation',()=>{
 for(const kind of ['reverse','last8','mixed']){
  const f=fixture('balanced')
  f.pkg.schedule=kind==='reverse'?[...f.pkg.schedule].reverse():kind==='last8'?
   [...train,...train,...train,...train,...train.slice(-8)]:fixture('mixed').pkg.schedule
  const counts=Object.fromEntries(train.map(id=>[id,0]));for(const id of f.pkg.schedule)counts[id]++
  f.pkg.plannedSampleVisits=counts;f.result.plannedSampleVisits=structuredClone(counts);f.result.sampleVisits=structuredClone(counts)
  f.result.targetUpdates=counts[TARGET];f.result.replayUpdates=200-counts[TARGET]
  assert.equal(replaySucceeded(f.result,f.pkg,0,false),false)
 }
})
test('malformed and missing carriers fail closed instead of throwing or accepting success booleans',()=>{
 const f=fixture()
 for(const value of [null,undefined,true,[],{},'passed']){
  assert.equal(replaySucceeded(value,f.pkg,0,false),false);assert.equal(replaySucceeded(f.result,value,0,false),false)
 }
 for(const field of ['schedule','selectedSampleIds','plannedSampleVisits','training','checkpoint','parentExperiment','policy']){
  const x=fixture();delete x.pkg[field];assert.equal(replaySucceeded(x.result,x.pkg,0,false),false)
 }
 for(const field of ['modelCapability','sampleVisits','plannedSampleVisits','zeroUpdateAdmission','sameParentStartVerified','targetUpdates','replayUpdates','artifacts']){
  const x=fixture();delete x.result[field];assert.equal(replaySucceeded(x.result,x.pkg,0,false),false)
 }
})

test('boundary policy bytes exactly match shared objective and original new arm identity',()=>{
 const bytes=fs.readFileSync(boundaryPolicyBinding.path),policy=JSON.parse(bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),boundaryPolicyBinding.sha256)
 assert.deepEqual(policy.training,boundaryTraining());assert.equal(policy.lossChanged,true)
 const f=fixture('balanced-boundary');assert.equal(replaySucceeded(f.result,f.pkg,0,false),true)
 for(const mutate of [x=>x.pkg.policy.sha256=balancedPolicySha,x=>x.pkg.training.boundaryRgbWeight=.02,
  x=>x.pkg.training.boundaryRgbDefinition.boundaryBandProjectedPixels=5,x=>x.result.trainingObjective='balanced',
  x=>x.pkg.boundaryInputBindings.pop(),x=>x.pkg.inputs.pop(),x=>x.pkg.sampleIdentities.reverse()]){
  const x=structuredClone(f);mutate(x);assert.equal(replaySucceeded(x.result,x.pkg,0,false),false)
 }
})
