import test from 'node:test'
import assert from 'node:assert/strict'
import {backgroundPolicy,backgroundSucceeded} from '../lib/ai-painter-rock-background-probe-v1.mjs'
test('auxiliary experiment cannot certify a partial run or grant qualification',()=>{
 const pkg={policy:{path:backgroundPolicy},schemaVersion:'rock-background-probe-package-v1',training:{pairs:100},experimentIdentity:'private',arm:'background',selectedSampleIds:['a','b'],outputRoot:'private'}
 const result={experimentIdentity:'private',arm:'background',backgroundAuxiliaryChanged:true,status:'experiment_executed_not_visual_qualified',checkpointReloadExact:true,formalQualificationGranted:false,optimizerSteps:{generator:100,discriminator:100},sampleVisits:{a:50,b:50},artifacts:[{path:'private/checkpoint-final.pt'}]}
 assert.equal(backgroundSucceeded(result,pkg,0,false),true)
 for(const patch of [{formalQualificationGranted:true},{checkpointReloadExact:false},{backgroundAuxiliaryChanged:false},{sampleVisits:{a:100,b:0}},{optimizerSteps:{generator:99,discriminator:100}},{arm:'routed'}])assert.equal(backgroundSucceeded({...result,...patch},pkg,0,false),false)
 assert.equal(backgroundSucceeded(result,pkg,1,false),false);assert.equal(backgroundSucceeded(result,pkg,0,true),false)
})
