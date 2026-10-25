import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {validateWorkerResult,validatePolicy,resourceStopReason} from '../diagnose-ai-painter-parameter40-qualification-v1.mjs'

const base={runId:'p40-cpu-test',status:'cpu_preflight_passed',testCount:15,trainingAllowed:false,stage4Qualified:false,historicalReplayAllowed:false,optimizerSteps:0,optimizerConstruction:0,modelForwards:0,modelAutograd:0,cudaCalls:0,samplePreflight:{sampleId:'ai-cold-start-v7-v7-capacity-slot-186-grassland-forest-transition-v2',split:'train',resolution:[256,192],conditionChannels:23,sourceIdentityVerified:true,originalLoaderAndEcologyBindingCompleted:true,modelConstructed:false}}
test('CPU result ABI accepts zero real calls only',()=>validateWorkerResult(base,'cpu',base.runId))
test('CPU rejects missing actual target sample preflight',()=>assert.throws(()=>validateWorkerResult({...base,samplePreflight:undefined},'cpu',base.runId)))
test('CPU rejects incomplete target source/ecology chain',()=>assert.throws(()=>validateWorkerResult({...base,samplePreflight:{...base.samplePreflight,originalLoaderAndEcologyBindingCompleted:false}},'cpu',base.runId)))
for(const field of ['modelForwards','modelAutograd','cudaCalls','optimizerSteps','optimizerConstruction'])test('CPU rejects '+field,()=>assert.throws(()=>validateWorkerResult({...base,[field]:1},'cpu',base.runId)))
test('GPU not reproduced has exact original one/five/one counts',()=>validateWorkerResult({...base,status:'diagnostic_not_reproduced',actualCounts:{forwardAttempted:1,forwardCompleted:1,generatorAttempted:5,generatorCompleted:5,discriminatorAttempted:1,discriminatorCompleted:1}},'gpu',base.runId))
test('GPU rejects extra discriminator call',()=>assert.throws(()=>validateWorkerResult({...base,status:'diagnostic_not_reproduced',actualCounts:{forwardAttempted:1,forwardCompleted:1,generatorAttempted:5,generatorCompleted:5,discriminatorAttempted:2,discriminatorCompleted:2}},'gpu',base.runId)))
test('unregistered policy schema rejected',()=>assert.throws(()=>validatePolicy({schemaVersion:'wrong'})))
test('runtime resource observation keeps original thresholds',()=>assert.equal(resourceStopReason({uuid:'a',freeMiB:2048,temperatureC:84},'a',2048*1048576),null))
for(const [name,current,disk]of [['vram',{uuid:'a',freeMiB:2047,temperatureC:42},3*1024**3],['temperature',{uuid:'a',freeMiB:4000,temperatureC:85},3*1024**3],['identity',{uuid:'b',freeMiB:4000,temperatureC:42},3*1024**3],['disk',{uuid:'a',freeMiB:4000,temperatureC:42},2048*1048576-1]])test('runtime '+name+' protection',()=>assert(resourceStopReason(current,'a',disk)))

function parameter0Policy(){
 const p=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-parameter40-qualification-diagnostic-policy-v3.json'))
 Object.assign(p,{schemaVersion:'parameter40-qualification-diagnostic-policy-v4',failureRunId:'d2o-ss1-v1-a15f7de7-c24c-40ea-8e31-43f52eed35d8',
  sampleId:'ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2',sampleOrdinal:17,
  target:{index:0,name:'core.core.terrain.base_stem.layers.0.weight',shape:[48,31,3,3]},
  outputRoot:'.runtime/ai-painter/parameter0-qualification-diagnostics-v1',selectedTargetPacketBytes:2097152,
  modelCapabilityVersion:'stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1'})
 Object.assign(p.formalSpecification,{version:'AI-PAINTER-SPEC-1.120',clause:'15.12'})
 Object.assign(p.scope,{coordinateSelection:'max_original_tolerance_ratio_first_flat_index_or_first_nonfinite_sum',nonfiniteComponentSumPreserved:true})
 return p
}
test('parameter0 registered successor preserves old policy while binding exact new target and resources',()=>{
 assert(validatePolicy(parameter0Policy()))
 assert(validatePolicy(JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-parameter40-qualification-diagnostic-policy-v3.json'))))
})
for(const [name,change]of [
 ['old Run',p=>p.failureRunId='d1-ss1-v1-520e1238-6bda-43e5-a2eb-850fe5a8dffb'],
 ['old sample',p=>p.sampleId=base.samplePreflight.sampleId],['wrong ordinal',p=>p.sampleOrdinal=18],
 ['old model',p=>p.modelCapabilityVersion='stage4_mvp256_dry_factorized_ecology_decode2_entry_weight_precision_v1'],
 ['other target',p=>p.target.index=90],['other shape',p=>p.target.shape=[48,32,3,3]],
 ['packet budget expansion',p=>p.selectedTargetPacketBytes++],['nonfinite omission',p=>p.scope.nonfiniteComponentSumPreserved=false],
 ['extra GPU time',p=>p.resources.gpuSeconds=181],['extra updates',p=>p.counts.optimizerSteps=1]
])test('parameter0 policy rejects '+name,()=>{const p=parameter0Policy();change(p);assert.throws(()=>validatePolicy(p))})
test('parameter0 CPU proof binds actual sample without inheriting old sample qualification',()=>{
 const p=parameter0Policy(),v={...base,samplePreflight:{...base.samplePreflight,sampleId:p.sampleId}}
 validateWorkerResult(v,'cpu',v.runId,p)
 assert.throws(()=>validateWorkerResult(base,'cpu',base.runId,p))
})
test('parameter0 nonfinite-sum evidence keeps exact original counts and no fake local reference',()=>{
 const p=parameter0Policy(),v={...base,status:'diagnostic_nonfinite_component_sum_evidence_complete',
  actualCounts:{forwardAttempted:1,forwardCompleted:1,generatorAttempted:5,generatorCompleted:5,discriminatorAttempted:1,discriminatorCompleted:1},
  originalGate:{sameCallInputsVerified:true},comparison:{localReferenceCount:0,componentSumFinite:false}}
 validateWorkerResult(v,'gpu',v.runId,p)
 assert.throws(()=>validateWorkerResult(v,'gpu',v.runId))
 assert.throws(()=>validateWorkerResult({...v,comparison:{...v.comparison,localReferenceCount:5}},'gpu',v.runId,p))
})
