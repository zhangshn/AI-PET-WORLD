import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
import {bind,bound,digest,idOf,json,ROOT,safe,sha} from './lib/world-initialized-evolution.mjs'
import {prepareNaturalWorldLiveMapInput} from './lib/natural-world-live-map-input.mjs'
import {runOwnedWorker} from './lib/ai-painter-owned-worker-v1.mjs'

const reviews='.runtime/ai-painter/controller-repair-reviews/'
const audit=reviews+'natural-world-current-map-render-227-20261103'
const prior=reviews+'world-first-current-rgb-192-20261103/run'
const nativeSource={path:prior+'/snapshot-manifest.json',sha256:'dd4d77370bdc544b2cfb5aa3440d01141b21819be5a6c29d205a2f2fc3939bc2'}
const trainingSource={path:prior+'/inference-result.json',sha256:'dcb77f51a63951c2e561bd467cecf543719ae42befc2edf0ec69516dd06f8d2c'}
const entry='scripts/prepare-natural-world-live-map-candidate.mjs',worker='ml/ai-painter/scripts/render_current_natural_world_candidate.py'
const live='ml/ai-painter/src/ai_painter/complete_world/live_natural_world_input.py',common=reviews+'native-p86-telemetry-196-20261103/'
const storePath='data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json',world='mvp-natural-world-001'
const home='.runtime/ai-painter/natural-world-live-map-candidates/'+world
const guardDir='.runtime/ai-painter/owned-worker-guards',MiB=1024**2
const evidence216={path:reviews+'current-map-scheduled-weather-216-20261103/after/verified.json',sha256:'25e0471dd82c02da0b2e3b986f49aba6e1c14e90bf1d4669abeb3813a0e3baa8'}
const put=(logical,value)=>fs.writeFileSync(safe(logical),JSON.stringify(value,null,2)+'\n',{flag:'wx',flush:true})
function bytes(file,max=64*MiB){
  const fd=fs.openSync(safe(file),'r')
  try{const a=fs.fstatSync(fd);assert(a.isFile()&&a.nlink===1&&a.size>0&&a.size<=max,file)
    const b=fs.readFileSync(fd),end=fs.fstatSync(fd);assert.equal(a.ino,end.ino);assert.equal(a.mtimeMs,end.mtimeMs);assert.equal(b.length,a.size);return b
  }finally{fs.closeSync(fd)}
}
const ref=(file,max)=>{const b=bytes(file,max);return {path:file,sha256:sha(b),bytes:b.length}}
export function naturalCandidateKey(identity){
  assert.equal(identity.stage,2);assert.equal(identity.world.worldId,world);assert.equal(identity.store.path,storePath)
  for(const v of [identity.store,identity.descriptor,identity.model.checkpoint,identity.numericSource,...identity.programs])assert(/^[0-9a-f]{64}$/.test(v.sha256))
  return digest(identity)
}
async function plan(){
  const current=await prepareNaturalWorldLiveMapInput(),old=JSON.parse(bound(trainingSource))
  assert.equal(current.identity.worldId,world);assert.equal(current.head.path,storePath);assert.equal(current.executionQualificationGranted,false)
  assert.equal(current.channels,23)
  const dataset=JSON.parse(bound(old.parentBindings.package));assert.equal(dataset.modelCapability,'stage4_mvp256_dry_terrain_ecology_stem_decoder_precision_v1')
  const model=old.parentBindings
  for(const r of Object.values(model))assert.equal(ref(r.path).sha256,r.sha256)
  const source=JSON.parse(bound(nativeSource));assert(Object.keys(source.files).length>0)
  for(const [local,r] of Object.entries(source.files))assert.equal(bind(prior+'/import-snapshot/'+local).sha256,r.sha256)
  const interpreter={path:'D:\\DevCaches\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe',sha256:'dd5f8d19f6755d6491ee7c4bef2fe35ddd521334cc3ca3ed8fc93ebcadf135d0'}
  assert.equal(sha(fs.readFileSync(interpreter.path)),interpreter.sha256)
  const programs=[entry,worker,live,'scripts/lib/natural-world-live-map-input.mjs','scripts/lib/ai-painter-owned-worker-v1.mjs',
    'scripts/lib/ai-painter-owned-worker-native-v1.mjs','scripts/windows/ai-painter-owned-worker-owner.cs',common+'safety.py',common+'operands.py',common+'telemetry.py'].map(bind)
  const identity={stage:2,world:current.identity,store:current.head,descriptor:current.descriptor,model,numericSource:nativeSource,programs,interpreterSha256:interpreter.sha256,
    numericRule:'077_native_parameter_migration_cpu_float32_deterministic_2_threads_integer_round_to_even_rgb8'}
  const key=naturalCandidateKey(identity)
  return {key,identity:current.identity,store:current.head,descriptor:current.descriptor,tick:current.tick,stateVersion:current.stateVersion,eventCursor:current.eventCursor,
    nativeSource,model,programs,trainingSource,interpreter,identityPayload:identity}
}
export async function verifyNativeCandidateRasters(npy,png,expectedPixelSha,expectedNchw){
  assert(npy.length>128&&npy.subarray(0,6).equals(Buffer.from([147,78,85,77,80,89]))&&npy[6]===1&&npy[7]===0)
  const offset=10+npy.readUInt16LE(8),header=npy.subarray(10,offset).toString('ascii')
  assert(offset<=512&&header.includes("'descr': '<f4'")&&header.includes("'fortran_order': False")&&header.includes("'shape': (768, 1024, 3)"))
  assert.equal(npy.length-offset,768*1024*3*4)
  const im=sharp(png,{limitInputPixels:1024*768,failOn:'error'}),m=await im.metadata()
  assert.deepEqual([m.format,m.width,m.height,m.channels,m.depth,m.hasAlpha],['png',1024,768,3,'uchar',false])
  const pixels=await im.raw().toBuffer();assert.equal(sha(pixels),expectedPixelSha)
  const planar=Buffer.allocUnsafe(768*1024*3*4),plane=768*1024
  for(let i=0;i<plane*3;i++){
    const value=npy.readFloatLE(offset+i*4);assert(Number.isFinite(value)&&value>=0&&value<=1)
    const x=Math.fround(value*255),below=Math.floor(x),mapped=x-below===0.5?below+(below%2):Math.round(x)
    assert.equal(mapped,pixels[i],'saved RGB differs from actual native float')
    npy.copy(planar,((i%3)*plane+Math.floor(i/3))*4,offset+i*4,offset+i*4+4)
  }
  assert.equal(sha(planar),expectedNchw)
}
function checkHead(p){
  const snapshot=JSON.parse(bound(p.store)),d=JSON.parse(bound(p.descriptor))
  assert.deepEqual(idOf(snapshot),p.identity);assert.deepEqual(d.identity,p.identity)
  assert.deepEqual([snapshot.tick,snapshot.stateVersion,snapshot.eventCursor],[p.tick,p.stateVersion,p.eventCursor])
  assert.deepEqual(d.head,p.store);assert.deepEqual([d.factHash,d.statePayloadSha256,d.recordContentSha256],
    [snapshot.worldFactsPayloadSha256,snapshot.statePayloadSha256,snapshot.recordContentSha256])
  return d
}
function grant(p){
  const file=bind(audit+'/dispatch.json'),g=JSON.parse(bound(file)),now=Date.now()
  assert.equal(g.mode,'one_current_native_cpu_candidate');assert.equal(g.key,p.key);assert.equal(g.planSha256,digest(p))
  assert.equal(g.storeSha256,p.store.sha256);assert.equal(g.descriptorSha256,p.descriptor.sha256);assert.equal(g.independentInputSha256,evidence216.sha256)
  assert(now<Date.parse(g.startBeforeUtc)&&Date.parse(g.startBeforeUtc)-now<=600000,'invalid external execution window')
  const verified=JSON.parse(bound(evidence216));assert.deepEqual(verified.head,p.store);assert.deepEqual(verified.input,p.descriptor)
  const v=json(reviews+'current-map-scheduled-weather-216-20261103/after/python/inference-result.json')
  assert.equal(v.descriptor.sha256,p.descriptor.sha256);assert.equal(v.tensorSha256,verified.tensor);assert.equal(v.instances,verified.instances)
  return {file,input:{tensorSha256:verified.tensor,objectTableSha256:v.objectTableSha256,shape:verified.shape,instances:verified.instances,seasonCode:v.seasonCode,ecologyCode:v.ecologyCode}}
}
async function verifyAt(dir,p){
  const d=checkHead(p),result=json(dir+'/render.json'),owned=json(dir+'/ownership.json'),w=json(dir+'/worker-start.json'),reservation=json(dir+'/reservation.json')
  assert.deepEqual(reservation.plan,p);assert.equal(result.key,p.key);assert.equal(w.key,p.key);assert.deepEqual(result.descriptor,p.descriptor)
  assert.deepEqual(result.store,p.store);assert.deepEqual(result.identity,p.identity);assert.deepEqual(result.parent,p.model);assert.equal(result.snapshot,nativeSource.sha256)
  assert.deepEqual([result.provenance.tick,result.provenance.stateVersion,result.provenance.eventCursor],[p.tick,p.stateVersion,p.eventCursor])
  assert.equal(result.provenance.factHash,d.factHash);assert.deepEqual(result.provenance.committedWeather,d.weather)
  assert.deepEqual(result.provenance.snapshot,p.descriptor);assert.deepEqual(result.inputs,reservation.independentExpected)
  assert.deepEqual(result.counts,{checkpointLoads:1,generatorForwards:1,criticForwards:0,gradientCalls:0,optimizerStarts:0,cudaStarts:0,sourceRgbReads:0})
  assert.equal(result.published,false);assert.equal(result.formalImageReviews,0);assert.equal(result.scope,'diagnostic_unpublished')
  assert(result.forwardSeconds>0&&Date.parse(result.forwardFinishedUtc)>=Date.parse(result.forwardStartedUtc))
  const r=owned.receipt,proof=r?.proof
  assert(owned.ok&&r.ownerClosed&&r.guardReleaseConfirmed&&r.liveOwnerCleanupConfirmed&&r.cleanupConfirmed&&proof.assignedBeforeResume&&proof.killOnJobClose)
  assert.equal(proof.exitCode,0);assert.equal(proof.activeProcessesAfterCleanup,0);assert.equal(proof.rootPid,w.pid);assert.equal(result.pid,w.pid)
  assert.equal(result.guard,w.guard);assert.equal(w.guard,r.guard.identity);assert.equal(result.job.limitBytes,8*1024**3);assert.equal(result.job.cores.length,2)
  const cleanup=json(guardDir+'/'+w.guard+'-native/cleanup-observation.json');assert.equal(cleanup.bindingBase64,proof.bindingBase64);assert.equal(cleanup.rootPid,w.pid)
  const native=JSON.parse(Buffer.from(cleanup.bindingBase64,'base64'))
  assert.equal(native.guard.runnerPid,reservation.launcherPid);assert.equal(native.guard.executableSha256,p.interpreter.sha256)
  assert.equal(native.guard.commandSha256,sha(Buffer.from(JSON.stringify(['-I','-B',path.join(ROOT,worker),p.key]))))
  const artifacts={}
  for(const name of ['native-rgb.npy','native-rgb.png']){
    const b=bytes(dir+'/'+name,12*MiB);assert.equal(result.artifacts[name].sha256,sha(b));assert.equal(b.length,result.artifacts[name].bytes)
    artifacts[name]=b
  }
  await verifyNativeCandidateRasters(artifacts['native-rgb.npy'],artifacts['native-rgb.png'],result.outputPixelSha256,result.outputFloatNchwSha256)
  const old=JSON.parse(bound(trainingSource));assert.equal(result.nativeParameters,old.nativeParameterSha256);assert.equal(result.nativeState,old.before.modelStateSha256)
  const final=home+'/'+p.key
  return {status:'current_native_candidate_unpublished',key:p.key,world:p.identity,tick:p.tick,stateVersion:p.stateVersion,eventCursor:p.eventCursor,store:p.store,descriptor:p.descriptor,
    model:p.model.checkpoint,execution:ref(dir+'/render.json'),owned:ref(dir+'/ownership.json'),artifacts:Object.fromEntries(Object.entries(result.artifacts).map(([name,r])=>[name,{path:final+'/'+name,...r}])),
    pixelSha256:result.outputPixelSha256,published:false,formalVisualReviews:0}
}
function filesSize(dir){return fs.readdirSync(safe(dir)).reduce((s,k)=>{const v=fs.lstatSync(safe(dir+'/'+k));assert(v.isFile()&&v.nlink===1);return s+v.size},0)}
export async function currentNaturalCandidate(action='run'){
  assert(['run','preflight','status'].includes(action))
  const p=await plan(),final=home+'/'+p.key,tmp=home+'/.pending-'+p.key
  if(fs.existsSync(safe(final))){
    const actual=await verifyAt(final,p);assert.deepEqual(json(final+'/candidate.json'),actual);checkHead(p)
    return {cacheHit:true,modelForwardsThisCall:0,candidate:actual}
  }
  if(action==='preflight'||action==='status')return {status:fs.existsSync(safe(tmp))?'reserved_or_failed':'current_candidate_missing',key:p.key,planSha256:digest(p),plan:p,
    independentInput:evidence216,outputDirectory:final,modelForwardsThisCall:0}
  checkHead(p)
  let modelForwards=0
  if(!fs.existsSync(safe(tmp))){
    const g=grant(p);assert(!fs.existsSync(safe(guardDir+'/active.json')),'original Job busy');assert(os.freemem()>=10*1024**3,'host reserve')
    const disk=fs.statfsSync(safe('.runtime/ai-painter'));assert(disk.bavail*disk.bsize>=2048*MiB)
    fs.mkdirSync(safe(home),{recursive:true});fs.mkdirSync(safe(tmp))
    const start=Date.now(),deadline=start+300000
    put(tmp+'/reservation.json',{plan:p,launcherPid:process.pid,startedAt:new Date(start).toISOString(),deadlineMs:deadline,
      dispatch:g.file,independentInput:evidence216,independentExpected:g.input})
    const limits=()=>{
      if(Date.now()>=deadline)return 'wall_deadline'
      if(fs.existsSync(safe(tmp+'/cancel')))return 'cancel'
      if(os.freemem()<10*1024**3||filesSize(tmp)>64*MiB)return 'host_or_artifact_limit'
      const d=fs.statfsSync(safe(tmp));return d.bavail*d.bsize<2048*MiB?'disk_reserve':null
    }
    let out
    try{
      out=await runOwnedWorker(p.interpreter.path,['-I','-B',path.join(ROOT,worker),p.key],{cwd:ROOT,timeout:deadline-Date.now(),maxBuffer:8*MiB,
        env:{...process.env,CUDA_VISIBLE_DEVICES:'',PYTHONDONTWRITEBYTECODE:'1',OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',MKL_NUM_THREADS:'2'},abortReason:limits})
      put(tmp+'/ownership.json',{ok:true,receipt:out.ownedReceipt,stderr:out.stderr})
      modelForwards=1
    }catch(e){put(tmp+'/ownership.json',{ok:false,code:e.code??null,reason:e.message,receipt:e.ownedReceipt??null,stderr:e.stderr??null});throw e}
  }
  // In-flight, failed or uncertain reservations can never issue a second model call.
  assert(fs.existsSync(safe(tmp+'/ownership.json')),'pending candidate lacks terminal owned receipt')
  const result=await verifyAt(tmp,p)
  for(const key of ['execution','owned'])result[key].path=final+'/'+path.posix.basename(result[key].path)
  if(fs.existsSync(safe(tmp+'/candidate.json')))assert.deepEqual(json(tmp+'/candidate.json'),result);else put(tmp+'/candidate.json',result)
  checkHead(p);fs.renameSync(safe(tmp),safe(final));checkHead(p)
  return {cacheHit:false,modelForwardsThisCall:modelForwards,candidate:result}
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
  const args=process.argv.slice(2);assert(args.length===0||args.length===1&&['--preflight','--status'].includes(args[0]))
  console.log(JSON.stringify(await currentNaturalCandidate(args[0]?.slice(2)??'run')))
}
