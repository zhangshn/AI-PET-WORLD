import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {readBaselineFile} from './lib/natural-world-baseline.mjs'
import {BASELINE_IDENTITY, BASELINE_SELECTION, baselineSha256 as sha, baselineCanonical as canonical,
  baselineNeed as need, baselineQualification} from './lib/natural-world-baseline-proof.mjs'
import {COMPAT_ROOT,COMPAT_SCHEMA,COMPAT_CODES,verifyHistoricalBaselineArchive,verifyNaturalWorldBaselineCompatibility} from './lib/natural-world-baseline-compatibility.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const ref=p=>{const b=readBaselineFile(p);return {path:p,sha256:sha(b),bytes:b.length}}
const store='data/world-runtime/'+BASELINE_IDENTITY.ownerId+'/'+BASELINE_IDENTITY.worldId+'.json'
const bindings=()=>COMPAT_CODES.map(ref)
function write(p,v){const b=Buffer.from(JSON.stringify(v,null,2)+'\n'),fd=fs.openSync(path.join(root,p),'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}return ref(p)}
need(path.resolve(process.cwd())===root,'compat_cwd')
need(process.env.NODE_ENV!=='production'&&!process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT,'compat_local_only')
if(process.argv[2]==='--reader'){
  need(process.argv.length===3,'compat_args');const startedAtUtc=new Date().toISOString(),before=ref(store),codes=bindings()
  const {loadNaturalWorldBaselineRuntime}=await import('./lib/natural-world-baseline-ts-loader.mjs')
  const runtime=await loadNaturalWorldBaselineRuntime(root)
  const result=await runtime.facade.readNaturalWorldRuntimeSaveRecord({ownerId:BASELINE_IDENTITY.ownerId,worldId:BASELINE_IDENTITY.worldId,
    expectedPlayerId:BASELINE_IDENTITY.playerId,expectedTick:0,expectedStateVersion:0,expectedFileSha256:before.sha256})
  need(result.status==='found'&&result.record&&result.fileSha256===before.sha256,'compat_store_read')
  need(Object.entries(BASELINE_IDENTITY).every(([k,v])=>result.record[k]===v),'compat_store_identity')
  need(canonical(ref(store))===canonical(before)&&canonical(bindings())===canonical(codes),'compat_concurrent_change')
  process.stdout.write(JSON.stringify({schemaVersion:'natural-world-baseline-current-reader-v1',pid:process.pid,
    identity:BASELINE_IDENTITY,storeRef:before,digests:Object.fromEntries(['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256','tick','stateVersion','eventCursor'].map(k=>[k,result.record[k]])),
    currentCodeBindings:codes,startedAtUtc,finishedAtUtc:new Date().toISOString()}))
}else{
  need(process.argv.length===2||process.argv.length===3&&process.argv[2]==='--publish','compat_args')
  const startedAtUtc=new Date().toISOString(),oldSelection=readBaselineFile(BASELINE_SELECTION),before=ref(store)
  const previousSelectionRef=ref(COMPAT_ROOT+'previous-selection.json'),archiveManifestRef=ref(COMPAT_ROOT+'prior-source-manifest.json')
  verifyHistoricalBaselineArchive({previousSelectionRef,archiveManifestRef,read:readBaselineFile})
  const currentCodeBindings=bindings(),run=COMPAT_ROOT+'compat-'+randomUUID().replaceAll('-','')+'/'
  fs.mkdirSync(path.join(root,run));const began=performance.now(),childStart=new Date().toISOString()
  const cp=spawn(process.execPath,[fileURLToPath(import.meta.url),'--reader'],{cwd:root,windowsHide:true,env:{...process.env,NODE_ENV:'development',AI_PET_WORLD_RUNTIME_STORE_ROOT:''},stdio:['ignore','pipe','pipe']})
  let stdout='',stderr='',failure=null,total=0
  for(const [stream,key] of [[cp.stdout,'stdout'],[cp.stderr,'stderr']])stream.on('data',b=>{total+=b.length;if(total>65536){failure='stream_limit';cp.kill()}else if(key==='stdout')stdout+=b;else stderr+=b})
  const timer=setTimeout(()=>{failure='timeout';cp.kill()},29000)
  const {exitCode,signal}=await new Promise((resolve,reject)=>{cp.once('error',reject);cp.once('close',(exitCode,signal)=>resolve({exitCode,signal}))}).finally(()=>clearTimeout(timer))
  const finishedAtUtc=new Date().toISOString();let readerRef=null
  if(exitCode===0&&!failure){try{readerRef=write(run+'reader.json',JSON.parse(stdout))}catch(e){failure=e.message}}
  const processRef=write(run+'process.json',{schemaVersion:'natural-world-baseline-current-reader-process-v1',pid:cp.pid,parentPid:process.pid,exitCode,signal,startedAtUtc:childStart,finishedAtUtc,elapsedMs:performance.now()-began,stdout,stderr,failure,readerRef})
  need(readerRef&&!failure&&exitCode===0,'compat_child_failed')
  need(canonical(before)===canonical(ref(store))&&canonical(currentCodeBindings)===canonical(bindings()),'compat_concurrent_change')
  const proofRef=write(run+'result.json',{schemaVersion:'natural-world-baseline-compatibility-proof-v1',previousSelectionRef,archiveManifestRef,readerRef,processRef,currentCodeBindings,qualification:baselineQualification(),startedAtUtc,finishedAtUtc:new Date().toISOString()})
  const selection={schemaVersion:COMPAT_SCHEMA,deliveryId:'WORLD-BASELINE-001',identity:BASELINE_IDENTITY,proofRef,selectedAtUtc:new Date().toISOString()}
  const verified=verifyNaturalWorldBaselineCompatibility({selection,read:readBaselineFile});write(run+'selection.json',selection)
  if(process.argv[2]==='--publish'){
    need(readBaselineFile(BASELINE_SELECTION).equals(oldSelection),'compat_selection_changed')
    const temporary=BASELINE_SELECTION+'.'+randomUUID()+'.tmp';write(temporary,selection);fs.renameSync(path.join(root,temporary),path.join(root,BASELINE_SELECTION))
  }
  process.stdout.write(JSON.stringify({selection,verified,published:process.argv[2]==='--publish'})+'\n')
}
