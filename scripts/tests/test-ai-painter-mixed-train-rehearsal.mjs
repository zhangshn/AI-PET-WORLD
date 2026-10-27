import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {rehearsalPolicy,supportWeight1Policy,stemPolicies,stemPairPolicies,stemDecoderPolicies,terrainEcologyPolicy,rehearsalSucceeded} from '../lib/ai-painter-mixed-train-rehearsal-v1.mjs'
test('mixed training needs exact 48-map exposure and 448 completed pairs',()=>{
 const p=JSON.parse(fs.readFileSync(rehearsalPolicy,'utf8'))
 const pkg={policy:{path:rehearsalPolicy},schemaVersion:'mixed-train-rehearsal-package-v1',training:p.training,experimentIdentity:'private',arm:'rehearsal',selectedSampleIds:p.sampleIds,outputRoot:'private'}
 const result={experimentIdentity:'private',arm:'rehearsal',backgroundAuxiliaryChanged:true,status:'experiment_executed_not_visual_qualified',checkpointReloadExact:true,formalQualificationGranted:false,optimizerSteps:{generator:448,discriminator:448},sampleVisits:Object.fromEntries(p.sampleIds.map(s=>[s,s===p.anchorSampleId?72:8])),artifacts:[{path:'private/checkpoint-final.pt'}]}
 assert.equal(rehearsalSucceeded(result,pkg,0,false),true)
 for(const patch of [{formalQualificationGranted:true},{checkpointReloadExact:false},{sampleVisits:Object.fromEntries(p.sampleIds.map(s=>[s,8]))},{optimizerSteps:{generator:447,discriminator:448}},{arm:'background'}])assert.equal(rehearsalSucceeded({...result,...patch},pkg,0,false),false)
 assert.equal(rehearsalSucceeded(result,{...pkg,selectedSampleIds:p.sampleIds.slice(1)},0,false),false)
 assert.equal(rehearsalSucceeded(result,pkg,1,false),false);assert.equal(rehearsalSucceeded(result,pkg,0,true),false)
 const stronger={...pkg,policy:{path:supportWeight1Policy},arm:'support-weight1',training:{...p.training,supportStructureWeight:1}}
 const strongerResult={...result,arm:'support-weight1'}
 assert.equal(rehearsalSucceeded(strongerResult,stronger,0,false),true)
 assert.equal(rehearsalSucceeded(strongerResult,{...stronger,training:p.training},0,false),false)
 assert.equal(rehearsalSucceeded(result,stronger,0,false),false)
 const terrain={...pkg,policy:{path:terrainEcologyPolicy},arm:'terrain-ecology',modelArchitectureChanged:true,terrainEcologyConditionAdded:true,numericOperatorsChanged:true,modelCapability:'stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1'}
 const terrainResult={...result,arm:'terrain-ecology',modelCapability:terrain.modelCapability}
 assert.equal(rehearsalSucceeded(terrainResult,terrain,0,false),true)
 for(const patch of [{modelArchitectureChanged:false},{terrainEcologyConditionAdded:false},{numericOperatorsChanged:false},{modelCapability:'old'}])assert.equal(rehearsalSucceeded(terrainResult,{...terrain,...patch},0,false),false)
 assert.equal(rehearsalSucceeded({...terrainResult,modelCapability:'old'},terrain,0,false),false)
 for(const [arm,path] of Object.entries({...stemPolicies,...stemPairPolicies,...stemDecoderPolicies})){
  const stem={...pkg,policy:{path},arm,numericOperatorsChanged:true,modelCapability:arm.startsWith('stem-decoder-')?'stage4_mvp256_dry_factorized_ecology_stem_pair_decode2_inner_weight_precision_v1':arm.startsWith('stem-pair-')?'stage4_mvp256_dry_factorized_ecology_stem_pair_weight_precision_v1':'stage4_mvp256_dry_factorized_ecology_stem_weight_precision_v1',training:{...pkg.training,supportStructureWeight:arm.endsWith('support1')?1:.1}}
  const done={...result,arm,modelCapability:stem.modelCapability}
  assert.equal(rehearsalSucceeded(done,stem,0,false),true)
  assert.equal(rehearsalSucceeded({...done,modelCapability:'old'},stem,0,false),false)
  assert.equal(rehearsalSucceeded(done,{...stem,numericOperatorsChanged:false},0,false),false)
 }
})
