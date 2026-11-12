// Private Store transaction fixtures only; no model or production qualification.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import ts from 'typescript'

const require=createRequire(import.meta.url)
export const self=fileURLToPath(import.meta.url)
export const project=path.resolve(path.dirname(self),'../../..')
export const evidence=path.resolve(process.env.WORLD_TRANSACTION_TEST_OUTPUT_ROOT??path.join(os.tmpdir(),'world-evolution-transaction-tests'))
export const sha=b=>createHash('sha256').update(b).digest('hex')
export const json=v=>JSON.stringify(v,null,2)+'\n'
export const lookup={ownerId:'owner-fixture',worldId:'natural-world-fixture'}
const compiled=new Map()
function compile(){
 if(compiled.size)return
 for(const name of ['world-runtime-store','world-runtime-production-store','world-runtime-record-validation','runtime-path-security','world-runtime-store-adapter','world-evolution-transaction']){
  const r=ts.transpileModule(fs.readFileSync(path.join(project,'src/world/runtime',name+'.ts'),'utf8'),{fileName:name+'.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}})
  assert.deepEqual(r.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error),[])
  compiled.set(name,r.outputText)
 }
}
export function record(){
 const identity={worldId:lookup.worldId,regionId:'natural-region-fixture',tick:0}
 return {version:'natural-world-runtime-save-v1',...lookup,playerId:'player-fixture',worldSeed:'fixture-seed',worldProfileId:'fixture-profile',regionId:identity.regionId,tick:0,stateVersion:0,savedAt:'2026-10-30T00:00:00.000Z',
  worldFacts:{schemaVersion:'natural-world-facts-snapshot-v1',...identity,payload:{terrainRegions:[{id:'terrain-fixture',kind:'grass',polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]}],objectFootprints:[],walkableRegions:[{id:'walkable-fixture',terrainId:'terrain-fixture'}],collisionRegions:[]}},
  worldState:{schemaVersion:'natural-world-state-snapshot-v1',...identity,payload:{environment:{weather:{status:'unknown',reason:'synthetic transaction fixture; no model qualification'},evolution:{logicalEndUtc:'2026-10-30T00:00:00.000Z'}},objects:[],resources:[]}},ruleVersion:'fixture-rule-v1',eventCursor:0,
  randomState:{status:'captured',algorithmId:'fixture-serialized-state',algorithmVersion:'1',state:{counter:0}},sourceBindings:[{role:'synthetic_test_only_not_qualified_source',uri:'fixture://private/source',fileSha256:'a'.repeat(64)}]}
}
export const initial=r=>({record:r,expectedTick:-1,expectedStateVersion:-1,expectedFileSha256:null})
export const identityOf=r=>Object.fromEntries(['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId'].map(k=>[k,r[k]]))
export const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v)
export function transitionInput(f,before,kind='evolution'){
 const old=before.record,r=structuredClone(old)
 delete r.worldFactsPayloadSha256;delete r.statePayloadSha256;delete r.recordContentSha256
 r.tick+=kind==='evolution'?1:0;r.stateVersion++;r.eventCursor++;r.worldFacts.tick=r.tick;r.worldState.tick=r.tick
 const start=old.worldState.payload.environment.evolution?.logicalEndUtc??'2026-10-30T00:00:00.000Z'
 const end=new Date(Date.parse(start)+(kind==='evolution'?60000:0)).toISOString()
 r.savedAt=end;r.worldState.payload.environment.evolution={logicalEndUtc:end}
 r.worldState.payload.environment.weather={status:'fixture',temperatureC:r.stateVersion}
 const ref=id=>({id:'synthetic-'+id,version:'test-only-v1',sha256:sha(id)})
 const event={schemaVersion:'world-evolution-event-v1',identity:identityOf(r),eventId:'synthetic-event-'+r.stateVersion,businessKey:'0'.repeat(64),cursor:r.eventCursor,eventKind:kind,
  fromTick:old.tick,toTick:r.tick,fromStateVersion:old.stateVersion,toStateVersion:r.stateVersion,
  before:{expectedTick:old.tick,expectedStateVersion:old.stateVersion,expectedFileSha256:before.fileSha256,worldFactsPayloadSha256:old.worldFactsPayloadSha256,statePayloadSha256:old.statePayloadSha256,recordContentSha256:old.recordContentSha256},
  interval:{logicalStartUtc:start,logicalEndUtc:end,durationSeconds:kind==='evolution'?60:0},policyRef:ref('policy'),externalInputRefs:[],historyInputRef:ref('history'),
  evidence:kind==='evolution'?{kind,capabilityRef:ref('capability'),modelRef:ref('model'),inputRef:ref('input'),outputRef:ref('output'),validatorRef:ref('validator')}:{kind,maintenanceContext:{targetPolicyRef:ref('policy'),targetRuleVersion:r.ruleVersion,targetModelRef:ref('model'),migrationEvidenceRef:ref('migration'),executorId:'synthetic-executor'},migrationArtifactRef:ref('migration'),validationRef:ref('validation')},
  changes:[{fieldId:'worldState.payload.environment.weather',operation:'replace',beforeValueSha256:sha(canonical(old.worldState.payload.environment.weather)),newValue:r.worldState.payload.environment.weather,reasonRefs:[sha('synthetic-reason')]}],reasonRefs:[sha('synthetic-reason')],previousEventSha256:old.worldState.payload.environment.evolution?.commit?.eventSha256??null,domainAfterSha256:f.transaction.computeWorldEvolutionDomainSha(r)}
 event.businessKey=f.transaction.computeWorldEvolutionBusinessKey(event)
 const sealed=f.transaction.sealWorldEvolutionEvent(event)
 r.worldState.payload.environment.evolution.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:sealed.cursor,eventSha256:sealed.eventSha256}}
 return {record:r,event:sealed,expectedTick:old.tick,expectedStateVersion:old.stateVersion,expectedFileSha256:before.fileSha256}
}
export async function bootstrap(f){const w=await f.facade.writeNaturalWorldRuntimeSaveRecord(initial(record()));assert.equal(w.ok,true,JSON.stringify(w));const r=await f.facade.readNaturalWorldRuntimeSaveRecord(lookup);assert.equal(r.status,'found');return r}
export const query=input=>({identity:identityOf(input.record),businessKey:input.event.businessKey})
export function fixture(kind,root=null){
 compile();fs.mkdirSync(evidence,{recursive:true})
 const privateRoot=root??fs.mkdtempSync(path.join(evidence,'transaction-'+kind+'-'))
 const runtimeRoot=kind==='development'?path.join(privateRoot,'data/world-runtime'):path.join(privateRoot,'configured-runtime')
 const recordPath=path.join(runtimeRoot,lookup.ownerId,lookup.worldId+'.json'),transactionPath=recordPath+'.transaction.json'
 const cache=new Map(),io=[];let hook=null,fired=false
 const inside=p=>{const r=path.relative(privateRoot,path.resolve(p));assert(r===''||!r.startsWith('..')&&!path.isAbsolute(r),'private fixture scope: '+p)}
 const guarded={}
 for(const name of ['mkdir','open','readFile','rename','rm','readdir','lstat','realpath','stat','unlink','link','access','writeFile','copyFile'])guarded[name]=async(...args)=>{
  inside(args[0]);if(['rename','link','copyFile'].includes(name))inside(args[1])
  const operation={operation:name,path:String(args[0]),target:['rename','link','copyFile'].includes(name)?String(args[1]):null}
  io.push(operation)
  if(hook&&await hook({phase:'before',...operation,args})){fired=true;throw Error('transaction_fixture_injected_io_failure')}
  const result=await fsp[name](...args)
  if(hook&&await hook({phase:'after',...operation,args})){fired=true;throw Error('transaction_fixture_injected_io_failure')}
  return result
 }
 const env={...process.env,NODE_ENV:kind==='development'?'test':'production',AI_PET_WORLD_RUNTIME_STORE_ROOT:runtimeRoot}
 function load(name){
  if(cache.has(name))return cache.get(name)
  assert(compiled.has(name),'compile whitelist excludes '+name)
  const exports={};cache.set(name,exports)
  const get=id=>{
   if(id==='../../../scripts/lib/runtime-working-directory.mjs')return {runtimeWorkingDirectory:()=>privateRoot,resolveRuntimePath:path.resolve}
   if(id==='node:fs/promises')return guarded
   if(id==='node:fs')return {existsSync:p=>{inside(p);return fs.existsSync(p)}}
   if(id.startsWith('./'))return load(id.slice(2))
   assert(['node:crypto','node:os','node:path'].includes(id),'unexpected dependency '+id);return require(id)
  }
  new Function('require','exports','process',compiled.get(name))(get,exports,{cwd:()=>privateRoot,pid:process.pid,kill:process.kill.bind(process),env})
  return exports
 }
 const store=kind==='development'?load('world-runtime-store').localFileRuntimeStore:load('world-runtime-production-store').createProductionWorldRuntimeStore(runtimeRoot)
 return {kind,store,facade:load('world-runtime-store-adapter'),validator:load('world-runtime-record-validation'),transaction:load('world-evolution-transaction'),load,env,privateRoot,runtimeRoot,recordPath,transactionPath,io,inject:fn=>{hook=fn},faultFired:()=>fired}
}
export function saveReply(file,value){fs.writeFileSync(file,json(value),{flag:'wx'})}
export function spawnOne(f,action,input,options={}){
 const id=randomUUID(),inputPath=path.join(f.privateRoot,id+'-input.json'),outputPath=path.join(f.privateRoot,id+'-output.json')
 saveReply(inputPath,{action,input,options})
 const child=spawn(process.execPath,[self,'--transaction-child',f.kind,f.privateRoot,inputPath,outputPath],{cwd:project,windowsHide:true,env:{...process.env,OMP_NUM_THREADS:'2',UV_THREADPOOL_SIZE:'2',WORLD_TRANSACTION_TEST_OUTPUT_ROOT:evidence},stdio:['ignore','pipe','pipe']})
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b)
 const done=new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{child.kill();reject(Error('private child deadline; terminated process lock is not reclaimed'))},18000)
  child.on('error',reject);child.on('close',(code,signal)=>{clearTimeout(timeout);fs.writeFileSync(outputPath+'.streams.json',json({code,signal,stdout,stderr}));if(options.hardKillCut&&fs.existsSync(outputPath+'.cut-reached'))resolve({pid:child.pid,code,signal,hardTerminated:true,lockRemains:fs.existsSync(f.recordPath+'.lock')});else if(code!==0)reject(Error('child exit '+code+': '+stderr));else resolve(JSON.parse(fs.readFileSync(outputPath,'utf8')))})
 })
 return {done,ready:outputPath+'.ready',checkpoint:outputPath+'.cut-reached',terminate:()=>child.kill('SIGKILL'),pid:child.pid}
}
export async function untilFiles(paths){const end=Date.now()+15000;while(!paths.every(p=>fs.existsSync(p))){assert(Date.now()<end,'ready deadline');await new Promise(r=>setTimeout(r,5))}}

export function faultAt(f,cut,onHit=null){
 let injected=false
 f.inject(async op=>{
  if(injected)return false
  const isJournal=op.operation==='rename'&&op.target===f.transactionPath
  let journal=null
  if(isJournal){try{journal=JSON.parse(fs.readFileSync(op.phase==='before'?op.path:op.target,'utf8'))}catch{}}
  const yes=cut==='after-prepared'&&op.phase==='after'&&isJournal&&journal?.state==='prepared'
   ||cut==='before-state'&&op.phase==='before'&&op.operation==='rename'&&op.target===f.recordPath
   ||cut==='after-state'&&op.phase==='after'&&op.operation==='rename'&&op.target===f.recordPath
   ||cut==='after-committed'&&op.phase==='after'&&isJournal&&journal?.state==='committed'
   ||cut==='receipt'&&op.phase==='before'&&op.operation==='rename'&&op.target?.endsWith('.receipt.json')
  if(yes){injected=true;if(onHit)await onHit()}
  return yes
 })
}
async function childMain(){
 const [kind,root,inputPath,outputPath]=process.argv.slice(3)
 const {action,input,options}=JSON.parse(fs.readFileSync(inputPath,'utf8')),f=fixture(kind,root)
 if(options.barrier){fs.writeFileSync(outputPath+'.ready',String(process.pid));await untilFiles([options.barrier])}
 if(options.cut)faultAt(f,options.cut)
 if(options.hardKillCut)faultAt(f,options.hardKillCut,async()=>{fs.writeFileSync(outputPath+'.cut-reached',String(process.pid));await new Promise(()=>{setInterval(()=>{},1000)})})
 const functions={bootstrap:'writeNaturalWorldRuntimeSaveRecord',read:'readNaturalWorldRuntimeSaveRecord',write:'writeNaturalWorldRuntimeTransition',transition:'readNaturalWorldRuntimeTransition',recover:'recoverNaturalWorldRuntimeTransition'}
 assert(functions[action],'unknown child action')
 const result=await f.facade[functions[action]](input)
 saveReply(outputPath,{pid:process.pid,result,faultFired:f.faultFired(),io:f.io,lockRemains:fs.existsSync(f.recordPath+'.lock')})
 console.log(JSON.stringify({pid:process.pid,action,status:result.status??result.ok}))
}
if(process.argv[2]==='--transaction-child')await childMain()
