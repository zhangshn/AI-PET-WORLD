import test from 'node:test'
import assert from 'node:assert/strict'
import {twoMapCheckpointPolicy, twoMapCheckpointSuccessorPolicy, twoMapSamples, twoMapExperimentSucceeded} from '../lib/ai-painter-two-map-experiment-v1.mjs'

function fixture() {
  const pkg={schemaVersion:'two-map-checkpoint-fit-package-v1',policy:{path:twoMapCheckpointPolicy},selectedSampleIds:twoMapSamples,
    training:{pairs:200,visitsPerSample:100},experimentIdentity:'two-map-fixture',outputRoot:'.runtime/ai-painter/learning-capacity-experiments/two-map-fixture'}
  const result={experimentIdentity:pkg.experimentIdentity,status:'experiment_executed_not_visual_qualified',checkpointReloadExact:true,
    formalQualificationGranted:false,optimizerSteps:{generator:200,discriminator:200},sampleVisits:Object.fromEntries(twoMapSamples.map(id=>[id,100])),
    artifacts:[{path:pkg.outputRoot+'/checkpoint-final.pt',sha256:'a'.repeat(64)}]}
  return {pkg,result}
}
test('two-map terminal requires both samples and exact final counts',()=>{
  const {pkg,result}=fixture()
  assert(twoMapExperimentSucceeded(result,pkg,0,false))
  assert(twoMapExperimentSucceeded(result,{...pkg,policy:{path:twoMapCheckpointSuccessorPolicy}},0,false))
  for(const changed of [null,{...result,sampleVisits:{[twoMapSamples[0]]:200,[twoMapSamples[1]]:0}},
    {...result,optimizerSteps:{generator:199,discriminator:200}}, {...result,checkpointReloadExact:false},
    {...result,formalQualificationGranted:true},{...result,experimentIdentity:'another-run'}, {...result,artifacts:[]}])
    assert.equal(twoMapExperimentSucceeded(changed,pkg,0,false),false)
})
test('wrong route, failure, timeout and extra samples cannot be called success',()=>{
  const {pkg,result}=fixture()
  assert.equal(twoMapExperimentSucceeded(result,pkg,1,false),false)
  assert.equal(twoMapExperimentSucceeded(result,pkg,0,true),false)
  assert.equal(twoMapExperimentSucceeded(result,{...pkg,policy:{path:'old-policy'}},0,false),false)
  assert.equal(twoMapExperimentSucceeded(result,{...pkg,selectedSampleIds:[...twoMapSamples,'validation-map']},0,false),false)
})
