import test from 'node:test'
import assert from 'node:assert/strict'
import {causalProbePolicy,target44CausalProbePolicy,causalProbeSucceeded} from '../lib/ai-painter-support-weight1-causal-probe-v1.mjs'
test('causal completion requires one call, no updates, unchanged state and saved target evidence',()=>{
 const pkg={policy:{path:causalProbePolicy},schemaVersion:'support-weight1-causal-probe-package-v1',experimentIdentity:'private',sampleId:'sample',outputRoot:'private'}
 const r={experimentIdentity:'private',sampleId:'sample',status:'zero_update_causal_observation_completed_not_qualified',gpuStarted:true,trainingStarted:false,formalQualificationGranted:false,historicalReplayClaimed:false,modelStateUnchanged:true,stateBefore:['a','b'],stateAfter:['a','b'],optimizerSteps:{generator:0,discriminator:0},counts:{forwardAttempted:1,forwardCompleted:1,generatorAttempted:5,generatorCompleted:5,discriminatorAttempted:1,discriminatorCompleted:1},artifacts:[{path:'private/same-call-target0.pt'}]}
 assert.equal(causalProbeSucceeded(r,pkg,0,false),true)
 for(const patch of [{trainingStarted:true},{optimizerSteps:{generator:1,discriminator:0}},{stateAfter:['a','c']},{counts:{...r.counts,forwardCompleted:2}},{artifacts:[]},{formalQualificationGranted:true}])assert.equal(causalProbeSucceeded({...r,...patch},pkg,0,false),false)
 const next={...pkg,policy:{path:target44CausalProbePolicy},targetIndex:44},nr={...r,targetIndex:44,artifacts:[{path:'private/same-call-target44.pt'}]}
 assert.equal(causalProbeSucceeded(nr,next,0,false),true);assert.equal(causalProbeSucceeded(r,next,0,false),false);assert.equal(causalProbeSucceeded({...nr,targetIndex:0},next,0,false),false)
 assert.equal(causalProbeSucceeded(r,pkg,1,false),false);assert.equal(causalProbeSucceeded(r,pkg,0,true),false)
})
