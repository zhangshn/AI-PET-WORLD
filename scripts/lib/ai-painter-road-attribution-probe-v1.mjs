import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
import {auditAiAssistedConditionAlignment} from './ai-assisted-condition-alignment.mjs'

export const roadAttributionPolicy='data/ai-painter/system-governance/ai-painter-road-attribution-probe-policy-v1.json'
export const roadAttributionWorker='ml/ai-painter/scripts/painter_road_attribution_probe_v1.py'
export const roadAttributionTests='test_road_attribution*_v1.py'
const POLICY_SHA='2c1d57de45e47f18ba99e0236ff3a05d343d5f646eddb258d6ee357fd5ae634d'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const SAMPLE_IDS=['ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3',
 'ai-cold-start-v7-v7-capacity-slot-147-grassland-forest-transition-v4','mvp64-slot164-objects-v5-20261020',
 'ai-cold-start-v7-v7-capacity-slot-192-forested-low-mountain-v3']
const CASES=['parent077','D093'].flatMap((checkpointRole,n)=>SAMPLE_IDS.map((sampleId,i)=>
 ({caseIndex:n*4+i+1,checkpointRole,sampleId,slot:[146,147,164,192][i]})))
const RESOURCES={maxWallSeconds:600,cudaMemoryFraction:.7,minimumFreeVramMiB:2048,maximumTemperatureC:85,
 minimumFreeDiskMiB:2048,maxOutputMiB:128,cpuThreads:2,automaticRetries:0}
const TOTAL={cases:8,generatorForwards:8,criticForwards:24,originalGeneratorVjps:40,diagnosticGeneratorVjps:24,
 discriminatorVjps:8,allAutogradGradCalls:72,optimizerCreations:0,optimizerUpdates:0,backwardCalls:0}
const CONTEXT_HASHES={parent077:{package:'41bf35d3f30a2ee4e6286041ed859a3e83a82c05ccb8b0461de6271cc6455291',
 terminal:'8c576f90fe4d67fa276968edd0ecdac0d038abdc0ef5fa3aab22bd254bc8cf4d',
 result:'c315800abf1bdda2f10a9b960a64069f3fa9d841b5cef8d07d0b73d06f7d5622',
 checkpoint:'20c83c99b029d983a2bd15a9774d372abbd9c8bbf5f20626e90aaa4d276d8aef'},
 D093:{package:'7c1cdc172f9c5f74f423c55c00e6658664939f0ea4ab024b6bb8d98fb4b851a9',
 terminal:'ae50f9804f3c242b49375cb561b49640219eea7e0d809f6aae04eca957d07208',
 result:'4ed1f4f80fda92483d954816edb744258a25e78191d623e9017c5486d555ce45',
 checkpoint:'ac6a7f755cddc2fc29871502bf654e7b3ae2a88383ffc1bfdd4b7f816190217c'}}
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex')
function logical(p){
 assert.equal(typeof p,'string');assert(p.length>0&&p.length<=4096&&!/[\\:\x00-\x1f\x7f]/u.test(p))
 assert(p.split('/').every(x=>x&&x!=='.'&&x!=='..'&&x!=='latest'&&x!=='latest.json'));return p
}
function binding(b){logical(b.path);assert.match(b.sha256,/^[0-9a-f]{64}$/u);return b}
function read(b){binding(b);const raw=fs.readFileSync(path.join(ROOT,b.path));assert(raw.length<=64*1024**2);assert.equal(sha(raw),b.sha256);return raw}
function validatePackage(pkg){
 assert.equal(pkg.schemaVersion,'road-attribution-zero-update-package-v1')
 assert.deepEqual(pkg.policy,{path:roadAttributionPolicy,sha256:POLICY_SHA})
 assert.deepEqual(pkg.cases,CASES);assert.deepEqual(pkg.counts,TOTAL);assert.deepEqual(pkg.resources,RESOURCES)
 assert.equal(pkg.supportStructureWeight,.1);assert.equal(pkg.trainingAllowed,false);assert.equal(pkg.formalQualificationGranted,false)
 assert.equal(pkg.boundaryMeasurement.bandPixels,6);assert.equal(pkg.boundaryMeasurement.projectionWidth,1024)
 assert.equal(pkg.boundaryMeasurement.projectionHeight,768);assert.equal(pkg.boundaryMeasurement.predictionWidth,256)
 assert.equal(pkg.boundaryMeasurement.predictionHeight,192);assert.equal(pkg.boundaryMeasurement.kernel,'nearest_repeat_interleave_4')
 assert.equal(pkg.boundaryMeasurement.expectedRoadThreshold,'original_channel_first_component_gt_0')
 assert.equal(pkg.boundaryMeasurement.reference,'original_1024_rgb_no_preaveraging')
 assert.equal(pkg.boundaryMeasurement.nativeCoverageSummary,'sum_4x4_integer_0_to_16')
 for(const role of ['parent077','D093'])for(const key of ['package','terminal','result','checkpoint']){
  binding(pkg.contexts[role][key]);assert.equal(pkg.contexts[role][key].sha256,CONTEXT_HASHES[role][key])
  const run=role==='parent077'?'mixed-train-terrain-ecology-v1-2b8a12c543a07576de72':'replay-retention-balanced-v1-956e9be20834b962b865'
  assert.equal(pkg.contexts[role][key].path,'.runtime/ai-painter/learning-capacity-experiments/'+run+'/'+(key==='checkpoint'?'checkpoint-final.pt':key+'.json'))
 }
 assert.match(pkg.experimentIdentity,/^road-attribution-v1-[0-9a-f]{20}$/u)
 logical(pkg.outputRoot);assert.equal(pkg.outputRoot,'.runtime/ai-painter/learning-capacity-experiments/'+pkg.experimentIdentity)
 assert.equal(pkg.samples.length,4);assert.deepEqual(pkg.samples.map(x=>x.sampleId),SAMPLE_IDS)
 for(const sample of pkg.samples){assert.equal(sample.identity.split,'train');assert.equal(sample.identity.sampleId,sample.sampleId)}
}

// Completion contract only; the managed worker/reader authenticates actual
// source, checkpoint, image, numerical and state evidence before this check.
export function roadAttributionSucceeded(result,pkg,code,timedOut){
 try{
  assert.equal(code,0);assert.equal(timedOut,false);validatePackage(pkg)
  assert.equal(result.schemaVersion,'road-attribution-zero-update-result-v1')
  assert.equal(result.status,'road_attribution_completed_not_qualified');assert.equal(result.experimentIdentity,pkg.experimentIdentity)
  assert.equal(result.gpuStarted,true);assert.equal(result.trainingStarted,false)
  assert.equal(result.formalQualificationGranted,false);assert.equal(result.runtimePublicationAllowed,false)
  assert.equal(result.historicalReplayClaimed,false);assert.equal(result.optimizerCreations,0);assert.equal(result.backwardCalls,0)
  assert.deepEqual(result.optimizerSteps,{generator:0,discriminator:0})
  assert.deepEqual(result.counts,{generatorForwards:8,criticForwards:24,originalGeneratorVjps:40,
   diagnosticGeneratorVjps:24,discriminatorVjps:8,allAutogradGradCalls:72})
  assert.equal(result.cases.length,8)
  const artifacts=new Set()
  for(const b of result.artifacts){binding(b);assert(b.path.startsWith(pkg.outputRoot+'/'));assert(!artifacts.has(b.path));artifacts.add(b.path)}
  result.cases.forEach((row,i)=>{
   assert.deepEqual(row.case,CASES[i]);assert.equal(row.stateUnchanged,true);assert.equal(row.cleanupVerified,true)
   assert.equal(row.originalGatePassed,true);assert.equal(row.quantizedProjectionPixelsEqual,true)
   const expected={generatorForwards:1,generatorForwardCompleted:1,criticForwards:3,criticForwardCompleted:3,
    originalGeneratorVjpAttempted:5,originalGeneratorVjps:5,diagnosticGeneratorVjpAttempted:3,diagnosticGeneratorVjps:3,
    discriminatorVjpAttempted:1,discriminatorVjps:1,autogradAttempted:9,allAutogradGradCalls:9}
   assert.deepEqual(row.counts,expected)
   const prefix=pkg.outputRoot+'/case-'+String(i+1).padStart(2,'0')
   assert.equal(row.record.path,prefix+'.json');assert.equal(row.audit.path,prefix+'-audit.json')
   for(const name of ['.json','-audit.json','-native.png','-repeat.png','-projection.png','-audit-request.json'])assert(artifacts.has(prefix+name))
  })
  return true
 }catch{return false}
}

async function auditCase(requestBinding){
 assert.equal(path.resolve(process.cwd()),ROOT);sharp.concurrency(2)
 const started=Date.now(),request=JSON.parse(read(requestBinding)),pkg=JSON.parse(read(request.package))
 validatePackage(pkg);const registered=JSON.parse(read(pkg.policy))
 assert.deepEqual(pkg.contexts,registered.contexts)
 const registeredCases=JSON.parse(read(registered.sourceCases));assert.deepEqual(pkg.samples,registeredCases.samples)
 assert.deepEqual(request.case,CASES[request.case.caseIndex-1]);const sample=pkg.samples.find(x=>x.sampleId===request.case.sampleId)
 assert.deepEqual(request.identity,sample.identity)
 assert(Array.isArray(pkg.programs)&&pkg.programs.length>=6&&pkg.programs.length<=256)
 binding(request.library)
 assert.deepEqual(request.library,pkg.programs.find(x=>x.path==='scripts/lib/ai-painter-road-attribution-probe-v1.mjs'))
 for(const program of pkg.programs)read(program)
 const number=String(request.case.caseIndex).padStart(2,'0'),prefix=pkg.outputRoot+'/case-'+number
 assert.equal(requestBinding.path,prefix+'-audit-request.json');assert.equal(request.image.path,prefix+'-native.png')
 assert.equal(request.repeated.path,prefix+'-repeat.png')
 const native=read(request.image),repeated=read(request.repeated)
 const nativeInfo=await sharp(native).metadata();assert.equal(nativeInfo.width,256);assert.equal(nativeInfo.height,192)
 const projection=await sharp(native).resize(1024,768,{kernel:'nearest'}).png().toBuffer()
 const [actual,expected]=await Promise.all([sharp(projection).removeAlpha().raw().toBuffer({resolveWithObject:true}),
  sharp(repeated).removeAlpha().raw().toBuffer({resolveWithObject:true})])
 assert.equal(actual.info.width,1024);assert.equal(actual.info.height,768);assert.deepEqual(actual.info,expected.info)
 assert(actual.data.equals(expected.data),'U4(Q(pred)) differs from Sharp nearest PNG projection')
 const put=(name,raw)=>{
  const p=logical(prefix+name);let bytes=0
  const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name),s=fs.lstatSync(f);assert(!s.isSymbolicLink());if(e.isDirectory())walk(f);else bytes+=s.size}}
  walk(path.join(ROOT,pkg.outputRoot));assert(bytes+raw.length+65536<=128*1024**2,'audit output reserve')
  fs.writeFileSync(path.join(ROOT,p),raw,{flag:'wx'});return {path:p,sha256:sha(raw)}
 }
 const projected=put('-projection.png',projection)
 const reference=read(sample.identity.image);read(sample.identity.conditionPack);for(const b of sample.identity.channels)read(b)
 const referenceRaw=await sharp(reference).removeAlpha().raw().toBuffer({resolveWithObject:true})
 assert.equal(referenceRaw.info.width,1024);assert.equal(referenceRaw.info.height,768);assert.equal(referenceRaw.info.channels,3)
 assert.equal(sha(referenceRaw.data),request.referenceRawSha256,'measurement/audit reference RGB decode differs')
 const channel=sample.identity.channels.find(x=>x.id==='terrain_path_ground')
 const road=await sharp(read(channel)).raw().toBuffer({resolveWithObject:true})
 assert.equal(road.info.width,1024);assert.equal(road.info.height,768)
 const mask=Buffer.alloc(1024*768);for(let i=0;i<mask.length;i++)mask[i]=road.data[i*road.info.channels]>0?1:0
 assert.equal(sha(mask),request.expectedRoadMaskSha256,'measurement/audit road decode differs')
 const alignment=await auditAiAssistedConditionAlignment({record:{recordId:pkg.experimentIdentity+'-'+number,
  conditionBinding:{conditionPackPath:sample.identity.conditionPack.path,worldId:sample.identity.worldId,tick:sample.identity.tick},
  classification:{monsoonSeason:request.monsoonSeason,regionalLandscapeType:null}},imagePath:projected.path,referenceImagePath:sample.identity.image.path})
 const audit={schemaVersion:'road-attribution-case-audit-v1',case:request.case,package:request.package,
  native:request.image,projection:projected,reference:sample.identity.image,condition:sample.identity.conditionPack,
  quantizedProjectionPixelsEqual:true,rawDifferentiablePredictionNotQuantized:true,
  projectionDimensions:{width:1024,height:768,kernel:'nearest'},alignment,modelForwards:0,optimizerUpdates:0,
  elapsedMilliseconds:Date.now()-started,formalQualificationGranted:false}
 return put('-audit.json',Buffer.from(JSON.stringify(audit,null,2)+'\n'))
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  assert.equal(process.argv.length,5);assert.equal(process.argv[2],'audit-case')
  const b=await auditCase({path:process.argv[3],sha256:process.argv[4]});process.stdout.write(JSON.stringify(b)+'\n')
 }catch(error){process.stderr.write(JSON.stringify({status:'road_audit_failed_closed',error:String(error.message).slice(0,4096)})+'\n');process.exitCode=1}
}
