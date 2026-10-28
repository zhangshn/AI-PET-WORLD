import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import sharp from 'sharp'
import {roadAttributionPolicy,roadAttributionWorker,roadAttributionTests,roadAttributionSucceeded} from '../lib/ai-painter-road-attribution-probe-v1.mjs'
import {roadAttributionRemainingMs,experimentMayUpdateTrainingTerminal} from '../run-ai-painter-learning-capacity-experiment.mjs'
sharp.concurrency(2)
const policy=JSON.parse(fs.readFileSync(roadAttributionPolicy,'utf8'))
const samples=JSON.parse(fs.readFileSync(policy.sourceCases.path,'utf8')).samples
const POLICY_SHA='2c1d57de45e47f18ba99e0236ff3a05d343d5f646eddb258d6ee357fd5ae634d'
const PER={generatorForwards:1,generatorForwardCompleted:1,criticForwards:3,criticForwardCompleted:3,
 originalGeneratorVjpAttempted:5,originalGeneratorVjps:5,diagnosticGeneratorVjpAttempted:3,diagnosticGeneratorVjps:3,
 discriminatorVjpAttempted:1,discriminatorVjps:1,autogradAttempted:9,allAutogradGradCalls:9}
function fixture(){
 const experimentIdentity='road-attribution-v1-'+'a'.repeat(20),outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+experimentIdentity
 const pkg={schemaVersion:'road-attribution-zero-update-package-v1',policy:{path:roadAttributionPolicy,sha256:POLICY_SHA},
  contexts:structuredClone(policy.contexts),cases:structuredClone(policy.cases),counts:structuredClone(policy.counts),resources:structuredClone(policy.resources),
  samples:structuredClone(samples),boundaryMeasurement:structuredClone(policy.boundaryMeasurement),supportStructureWeight:.1,
  experimentIdentity,outputRoot,trainingAllowed:false,formalQualificationGranted:false}
 const b=p=>({path:p,sha256:'a'.repeat(64)})
 const cases=pkg.cases.map(c=>{const p=outputRoot+'/case-'+String(c.caseIndex).padStart(2,'0');return {case:structuredClone(c),
  record:b(p+'.json'),audit:b(p+'-audit.json'),counts:structuredClone(PER),stateUnchanged:true,cleanupVerified:true,
  originalGatePassed:true,quantizedProjectionPixelsEqual:true}})
 const artifacts=cases.flatMap((c,i)=>['.json','-audit.json','-native.png','-repeat.png','-projection.png','-audit-request.json']
  .map(s=>b(outputRoot+'/case-'+String(i+1).padStart(2,'0')+s)))
 const result={schemaVersion:'road-attribution-zero-update-result-v1',status:'road_attribution_completed_not_qualified',experimentIdentity,
  gpuStarted:true,trainingStarted:false,formalQualificationGranted:false,runtimePublicationAllowed:false,historicalReplayClaimed:false,
  optimizerCreations:0,backwardCalls:0,optimizerSteps:{generator:0,discriminator:0},cases,
  counts:{generatorForwards:8,criticForwards:24,originalGeneratorVjps:40,diagnosticGeneratorVjps:24,discriminatorVjps:8,allAutogradGradCalls:72},artifacts}
 return {pkg,result}
}
test('exact dedicated exports use existing managed worker and both CPU test suites',()=>{
 assert.equal(roadAttributionWorker,'ml/ai-painter/scripts/painter_road_attribution_probe_v1.py')
 assert.equal(roadAttributionTests,'test_road_attribution*_v1.py')
 assert.equal(policy.resources.maxOutputMiB,128)
})
test('accepts only complete synthetic8-case carrier without mutating it',()=>{
 const f=fixture(),before=structuredClone(f);assert(roadAttributionSucceeded(f.result,f.pkg,0,false));assert.deepEqual(f,before)
 for(const [code,timeout]of [[1,false],[0,true],[false,false],[0,0]])assert.equal(roadAttributionSucceeded(f.result,f.pkg,code,timeout),false)
})
const mutations=[
 ['wrong policy path',f=>f.pkg.policy.path='other.json'],['formatted but unregistered SHA',f=>f.pkg.policy.sha256='0'.repeat(64)],
 ['oldtarget schema',f=>f.pkg.schemaVersion='support-weight1-causal-probe-package-v1'],
 ['oldtarget result',f=>f.result.status='zero_update_causal_observation_completed_not_qualified'],
 ['changed contexts',f=>f.pkg.contexts.D093.checkpoint.sha256='0'.repeat(64)],
 ['case order',f=>f.pkg.cases.reverse()],['foreign case',f=>f.result.cases[0].case.sampleId='foreign'],
 ['short prefix',f=>f.result.cases.pop()],['duplicate case',f=>f.result.cases[7]=structuredClone(f.result.cases[0])],
 ['wrong record root',f=>f.result.cases[0].record.path='elsewhere.json'],['changed audit binding',f=>f.result.cases[0].audit.path='elsewhere.json'],
 ['state mutation',f=>f.result.cases[2].stateUnchanged=false],['cleanup unknown',f=>f.result.cases[2].cleanupVerified=null],
 ['original gate failed',f=>f.result.cases[0].originalGatePassed=false],['projection mismatch',f=>f.result.cases[0].quantizedProjectionPixelsEqual=false],
 ['native6 geometry',f=>f.pkg.boundaryMeasurement.projectionWidth=256],['bilinear projection',f=>f.pkg.boundaryMeasurement.kernel='bilinear'],
 ['averaged reference',f=>f.pkg.boundaryMeasurement.reference='native_average'],['threshold',f=>f.pkg.boundaryMeasurement.expectedRoadThreshold='gt128'],
 ['support weight1',f=>f.pkg.supportStructureWeight=1],['validation identity',f=>f.pkg.samples[0].identity.split='validation'],
 ['wrong sample identity',f=>f.pkg.samples[0].sampleId='foreign'],['package qualification',f=>f.pkg.formalQualificationGranted=true],
 ['training allowed',f=>f.pkg.trainingAllowed=true],['actual training',f=>f.result.trainingStarted=true],
 ['GPU not reached',f=>f.result.gpuStarted=false],['publication',f=>f.result.runtimePublicationAllowed=true],
 ['qualification',f=>f.result.formalQualificationGranted=true],['historical replay',f=>f.result.historicalReplayClaimed=true],
 ['optimizer created',f=>f.result.optimizerCreations=1],['optimizer update',f=>f.result.optimizerSteps.generator=1],
 ['backward',f=>f.result.backwardCalls=1],['different run',f=>f.result.experimentIdentity='other'],
 ['output traversal',f=>f.pkg.outputRoot+='/../other'],['missing artifact',f=>f.result.artifacts.shift()],
 ['duplicate artifact',f=>f.result.artifacts.push(structuredClone(f.result.artifacts[0]))],
 ['artifact SHA',f=>f.result.artifacts[0].sha256='bad'],['artifact foreign',f=>f.result.artifacts[0].path='foreign/artifact.json'],
 ...Object.keys(PER).map(k=>['percase counter '+k,f=>f.result.cases[0].counts[k]++]),
 ...Object.keys(policy.counts).map(k=>['plan counter '+k,f=>f.pkg.counts[k]++]),
 ...Object.keys(policy.resources).map(k=>['resource '+k,f=>f.pkg.resources[k]++]),
]
for(const [name,mutate]of mutations)test('rejects '+name,()=>{const f=fixture();mutate(f);assert.equal(roadAttributionSucceeded(f.result,f.pkg,0,false),false)})
test('missing or malformed carrier never throws or treats unknown as pass',()=>{
 const f=fixture();for(const bad of [null,undefined,{},true,[],1,'passed']){
  assert.equal(roadAttributionSucceeded(bad,f.pkg,0,false),false);assert.equal(roadAttributionSucceeded(f.result,bad,0,false),false)
 }
})
test('controller overall deadline clamps CPU prepare/worker budgets and rejects exhaustion',()=>{
 assert.equal(roadAttributionRemainingMs(100,600000,100),600000)
 assert.equal(roadAttributionRemainingMs(100,600000,400101),499999)
 assert.equal(roadAttributionRemainingMs(100,300000,900099),1)
 assert.throws(()=>roadAttributionRemainingMs(100,1,900100),/budget exhausted/)
 for(const [start,requested,clock]of [[NaN,1,1],[0,1,NaN],[2,1,1],[0,0,1],[0,-1,1],[0,1.5,1],[0,Infinity,1]])
  assert.throws(()=>roadAttributionRemainingMs(start,requested,clock))
})
test('diagnostic cannot update training terminal even with a forged true training flag',()=>{
 for(const readonly of [false,true])for(const flag of [true,false,null,undefined])
  assert.equal(experimentMayUpdateTrainingTerminal(roadAttributionPolicy,readonly,flag),false)
 assert.equal(experimentMayUpdateTrainingTerminal('other',false,true),true)
 assert.equal(experimentMayUpdateTrainingTerminal('other',true,true),false)
 assert.equal(experimentMayUpdateTrainingTerminal('other',false,1),false)
 assert.equal(experimentMayUpdateTrainingTerminal('other',false,false),false)
})
test('both success/failure registry paths use terminal helper and no post-training review includes road',()=>{
 const source=fs.readFileSync(new URL('../run-ai-painter-learning-capacity-experiment.mjs',import.meta.url),'utf8')
 const writes=[...source.matchAll(/latestTrainingTerminal:\s*experimentMayUpdateTrainingTerminal\(policy,\s*readonlyTrainFit,/gu)]
 assert.equal(writes.length,2)
 assert.match(source,/postReviewEligible\s*=\s*\(twoMap\s*\|\|\s*rehearsal\s*\|\|\s*single149\s*\|\|\s*replay\)\s*&&\s*success/u)
 assert.match(source,/roadAttribution\s*\?\s*boundedTimeout\(600000\)/u)
 assert(/const boundedTimeout\s*=[\s\S]{0,180}roadAttributionRemainingMs/u.test(source),'boundedTimeout must call overall-budget helper')
})
test('U4 of quantized native RGB equals Sharp nearest projection pixel for pixel',async()=>{
 const bytes=Buffer.alloc(256*192*3)
 for(let y=0;y<192;y++)for(let x=0;x<256;x++)for(let c=0;c<3;c++)bytes[(y*256+x)*3+c]=(x*7+y*11+c*31)%256
 const png=await sharp(bytes,{raw:{width:256,height:192,channels:3}}).png().toBuffer()
 const projected=await sharp(png).resize(1024,768,{kernel:'nearest'}).raw().toBuffer()
 const repeated=Buffer.alloc(1024*768*3)
 for(let y=0;y<768;y++)for(let x=0;x<1024;x++)for(let c=0;c<3;c++)repeated[(y*1024+x)*3+c]=bytes[(Math.floor(y/4)*256+Math.floor(x/4))*3+c]
 assert(projected.equals(repeated))
})
