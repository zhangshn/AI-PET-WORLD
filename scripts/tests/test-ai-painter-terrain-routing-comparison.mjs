import test from 'node:test'
import assert from 'node:assert/strict'
import {routingPolicies,routingSucceeded} from '../lib/ai-painter-terrain-routing-comparison-v1.mjs'
test('routing comparison cannot certify partial, unbound or unequal arms',()=>{
 const pkg={policy:{path:routingPolicies[1]},schemaVersion:'terrain-routing-comparison-package-v1',training:{pairs:100},arm:'routed',experimentIdentity:'x',selectedSampleIds:['a','b'],outputRoot:'out'}
 const r={experimentIdentity:'x',arm:'routed',backwardRoutingChanged:true,status:'experiment_executed_not_visual_qualified',checkpointReloadExact:true,formalQualificationGranted:false,optimizerSteps:{generator:100,discriminator:100},sampleVisits:{a:50,b:50},artifacts:[{path:'out/checkpoint-final.pt'}]}
 assert(routingSucceeded(r,pkg,0,false))
 for(const change of [{arm:'baseline'},{backwardRoutingChanged:false},{checkpointReloadExact:false},{formalQualificationGranted:true},{sampleVisits:{a:100,b:0}},{optimizerSteps:{generator:99,discriminator:100}},{artifacts:[]}])assert.equal(routingSucceeded({...r,...change},pkg,0,false),false)
 assert.equal(routingSucceeded(r,pkg,0,true),false);assert.equal(routingSucceeded(r,pkg,1,false),false)
})
