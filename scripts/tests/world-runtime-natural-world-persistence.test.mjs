// Persistence component only. All fixtures stay below the caller's private evidence root.
import test from 'node:test'
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

const require=createRequire(import.meta.url),self=fileURLToPath(import.meta.url)
const project=path.resolve(path.dirname(self),'../..'),sourceRoot=path.join(project,'src/world/runtime')
const evidence=path.resolve(process.env.WORLD_RUNTIME_TEST_OUTPUT_ROOT??path.join(os.tmpdir(),'natural-world-runtime-tests'))
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
const compiled=new Map()
for(const name of ['world-runtime-store','world-runtime-production-store','world-runtime-record-validation','runtime-path-security','world-runtime-store-adapter']){
 const r=ts.transpileModule(fs.readFileSync(path.join(sourceRoot,name+'.ts'),'utf8'),{fileName:name+'.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}})
 assert.deepEqual(r.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error),[])
 compiled.set(name,r.outputText)
}
function record(){
 const identity={worldId:'natural-world-fixture',regionId:'natural-region-fixture',tick:0}
 return {version:'natural-world-runtime-save-v1',ownerId:'owner-fixture',playerId:'player-fixture',worldId:identity.worldId,worldSeed:'fixture-seed',worldProfileId:'fixture-profile',regionId:identity.regionId,tick:0,stateVersion:0,savedAt:'2026-10-27T15:00:00.000Z',
  worldFacts:{schemaVersion:'natural-world-facts-snapshot-v1',...identity,payload:{terrainRegions:[{id:'terrain-fixture',kind:'grass',polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]}],objectFootprints:[],walkableRegions:[{id:'walkable-fixture',terrainId:'terrain-fixture'}],collisionRegions:[]}},
  worldState:{schemaVersion:'natural-world-state-snapshot-v1',...identity,payload:{environment:{weather:{status:'unknown',reason:'synthetic persistence fixture, not a generated world'}},objects:[],resources:[]}},ruleVersion:'fixture-rule-v1',eventCursor:7,
  randomState:{status:'captured',algorithmId:'fixture-serialized-state',algorithmVersion:'1',state:{counter:7,word64:'18446744073709551615'}},sourceBindings:[{role:'synthetic_test_only_not_qualified_source',uri:'fixture://private/source',fileSha256:'a'.repeat(64)}]}
}
function legacy(){return {version:'v2.6-runtime-00',ownerId:'owner-fixture',worldId:'legacy-world-fixture',tick:0,savedAt:'2026-10-27T15:00:00.000Z',butlerProfile:{},butlerRuntimeProfile:{},butlerBirthInput:{},butlerMappingMode:'fixture',butlerConstructionStyle:{},worldCreationStyleSource:'fixture',homeMapState:{worldId:'legacy-world-fixture',ownerId:'owner-fixture',seed:'fixture',mapSize:{columns:1,rows:1,tileSize:1},zones:[],placements:[],resources:{groundHealth:0,naturalGrowth:0,materialReadiness:0,careReadiness:0,spacePressure:0,tags:[]},constructionPlans:[],mapDiffs:[],createdAt:0,updatedAt:0,tags:[]},recentEvents:[],tags:[]}}
const initial=r=>({record:r,expectedTick:-1,expectedStateVersion:-1,expectedFileSha256:null})
function next(r){const v=structuredClone(r);v.tick++;v.stateVersion++;v.worldFacts.tick=v.tick;v.worldState.tick=v.tick;v.eventCursor++;v.randomState.state.counter++;return v}
function fixture(kind,root=null){
 fs.mkdirSync(evidence,{recursive:true});const privateRoot=root??fs.mkdtempSync(path.join(evidence,'natural-'+kind+'-'))
 const runtimeRoot=kind==='development'?path.join(privateRoot,'data/world-runtime'):path.join(privateRoot,'configured-runtime')
 const cache=new Map(),io=[];let fault=null,fired=false
 const inside=p=>{const r=path.relative(privateRoot,path.resolve(p));assert(r===''||!r.startsWith('..')&&!path.isAbsolute(r),'private fixture scope: '+p)}
 const guarded={}
 for(const name of ['mkdir','open','readFile','rename','rm','readdir','lstat','realpath','stat'])guarded[name]=async(...args)=>{
  inside(args[0]);if(name==='rename')inside(args[1]);io.push({operation:name,path:args[0],target:name==='rename'?args[1]:null})
  const txn=String(args[1]??'').endsWith('.transaction.json')
  const inject=fault==='record'&&name==='rename'&&args[1]===recordPath
   ||fault==='commit'&&name==='rename'&&txn&&JSON.parse(fs.readFileSync(args[0],'utf8')).state==='committed'
   ||fault==='cleanup'&&name==='rm'&&args[0]===transactionPath
  if(inject){fired=true;throw Error('natural_fixture_fault:'+fault)}
  return fsp[name](...args)
 }
 const env={...process.env,NODE_ENV:kind==='development'?'test':'production',AI_PET_WORLD_RUNTIME_STORE_ROOT:runtimeRoot}
 function load(name){if(cache.has(name))return cache.get(name);const exports={};cache.set(name,exports)
  const get=id=>{if(id==='node:fs/promises')return guarded;if(id==='node:fs')return {existsSync:p=>{inside(p);return fs.existsSync(p)}};if(id.startsWith('./'))return load(id.slice(2));assert(['node:crypto','node:os','node:path'].includes(id),'unexpected dependency '+id);return require(id)}
  assert(compiled.has(name));new Function('require','exports','process',compiled.get(name))(get,exports,{cwd:()=>privateRoot,pid:process.pid,env});return exports
 }
 const store=kind==='development'?load('world-runtime-store').localFileRuntimeStore:load('world-runtime-production-store').createProductionWorldRuntimeStore(runtimeRoot)
 const recordPath=path.join(runtimeRoot,'owner-fixture','natural-world-fixture.json'),transactionPath=recordPath+'.transaction.json'
 return {store,facade:load('world-runtime-store-adapter'),validator:load('world-runtime-record-validation'),load,env,privateRoot,runtimeRoot,recordPath,transactionPath,latestPath:path.join(runtimeRoot,'latest-world.json'),io,inject:s=>{fault=s},faultFired:()=>fired}
}
function saveReply(file,value){fs.writeFileSync(file,json(value),{flag:'wx'})}
async function childMain(){
 const [action,kind,root,inputPath,outputPath,barrier]=process.argv.slice(3),f=fixture(kind,root),input=JSON.parse(fs.readFileSync(inputPath,'utf8'))
 if(barrier){fs.writeFileSync(outputPath+'.ready',String(process.pid));const end=Date.now()+12000;while(!fs.existsSync(barrier)){assert(Date.now()<end,'barrier timeout');await new Promise(r=>setTimeout(r,5))}}
 const result=action==='write'?await f.facade.writeNaturalWorldRuntimeSaveRecord(input):await f.facade.readNaturalWorldRuntimeSaveRecord(input)
 saveReply(outputPath,{pid:process.pid,result});console.log(JSON.stringify({pid:process.pid,ok:result.ok??result.status==='found'}))
}
function spawnOne(f,action,input,barrier=null){
 const id=randomUUID(),inputPath=path.join(f.privateRoot,id+'-input.json'),outputPath=path.join(f.privateRoot,id+'-output.json');saveReply(inputPath,input)
 const args=[self,'--natural-child',action,f.store.kind==='local_file_runtime_store'?'development':'production',f.privateRoot,inputPath,outputPath,...(barrier?[barrier]:[])]
 const child=spawn(process.execPath,args,{cwd:project,windowsHide:true,env:{...process.env,OMP_NUM_THREADS:'2',UV_THREADPOOL_SIZE:'2',WORLD_RUNTIME_TEST_OUTPUT_ROOT:evidence},stdio:['ignore','pipe','pipe']})
 let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;assert(stdout.length<65536)});child.stderr.on('data',b=>{stderr+=b;assert(stderr.length<65536)})
 const done=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill();reject(Error('child deadline'))},18000);child.on('error',reject);child.on('close',code=>{clearTimeout(timeout);fs.writeFileSync(outputPath+'.streams.json',json({code,stdout,stderr}));if(code!==0)reject(Error('child exit '+code+': '+stderr));else resolve(JSON.parse(fs.readFileSync(outputPath,'utf8')))})})
 return {done,ready:outputPath+'.ready',pid:child.pid}
}
async function untilFiles(paths){const end=Date.now()+15000;while(!paths.every(p=>fs.existsSync(p))){assert(Date.now()<end,'ready deadline');await new Promise(r=>setTimeout(r,5))}}
if(process.argv[2]==='--natural-child')await childMain()
else {
 for(const kind of ['development','production']){
  test(kind+': real adapter/facade persistence, complete hashes, no legacy latest or person construction',async()=>{
   const f=fixture(kind),input=initial(record()),pending=f.facade.writeNaturalWorldRuntimeSaveRecord(input);input.record.worldState.payload.environment.changedAfterCall=true
   const w=await pending;assert.equal(w.ok,true,JSON.stringify(w));assert.equal(fs.existsSync(f.latestPath),false)
   const r=await f.facade.readNaturalWorldRuntimeSaveRecord({ownerId:'owner-fixture',worldId:'natural-world-fixture',expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256,expectedPlayerId:'player-fixture'})
   assert.equal(r.status,'found',JSON.stringify(r));assert.equal(r.fileSha256,sha(fs.readFileSync(f.recordPath)));assert.deepEqual(r.record,f.validator.sealNaturalWorldRuntimeRecord(record()));assert.equal('butlerProfile' in r.record,false);assert.equal('homeMapState' in r.record,false)
   const fresh=fixture(kind,f.privateRoot);assert.equal((await fresh.store.readNatural({ownerId:r.record.ownerId,worldId:r.record.worldId})).status,'found')
   const updated=next(record()),u=await f.store.writeNatural({record:updated,expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256});assert.equal(u.ok,true,JSON.stringify(u));assert.equal(u.stateVersion,1);assert.equal(u.tick,1)
   const duplicate=await f.store.writeNatural({record:updated,expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256});assert.equal(duplicate.ok,false);assert.equal(duplicate.code,'conflict')
  })
  test(kind+': independent writer exits, fresh reader process restores all fields and actual bytes',async()=>{
   const f=fixture(kind),a=await spawnOne(f,'write',initial(record())).done;assert.equal(a.result.ok,true)
   const b=await spawnOne(f,'read',{ownerId:'owner-fixture',worldId:'natural-world-fixture',expectedTick:0,expectedStateVersion:0,expectedFileSha256:a.result.fileSha256}).done
   assert.notEqual(a.pid,b.pid);assert.notEqual(b.pid,process.pid);assert.equal(b.result.status,'found');assert.deepEqual(b.result.record,f.validator.sealNaturalWorldRuntimeRecord(record()));saveReply(path.join(f.privateRoot,'cross-process-proof.json'),{a,b,recordSha256:sha(fs.readFileSync(f.recordPath))})
  })
  test(kind+': two real processes with same CAS produce exactly one winner',async()=>{
   const f=fixture(kind),w=await f.store.writeNatural(initial(record()));assert(w.ok);const input={record:next(record()),expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256},barrier=path.join(f.privateRoot,'go')
   const a=spawnOne(f,'write',input,barrier),b=spawnOne(f,'write',input,barrier);await untilFiles([a.ready,b.ready]);fs.writeFileSync(barrier,'go');const results=await Promise.all([a.done,b.done]);assert.notEqual(results[0].pid,results[1].pid);assert.equal(results.filter(r=>r.result.ok).length,1);assert.equal(results.find(r=>!r.result.ok).result.code,'conflict');assert.equal((await f.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'})).record.stateVersion,1);saveReply(path.join(f.privateRoot,'concurrent-CAS-proof.json'),{results})
  })
  test(kind+': wrong expectations, identity, content/file hashes and damaged records never return data',async()=>{
   const f=fixture(kind),w=await f.store.writeNatural(initial(record()));assert(w.ok)
   for(const fields of [{expectedTick:1},{expectedStateVersion:1},{expectedPlayerId:'foreign'},{expectedFileSha256:'0'.repeat(64)}]){const r=await f.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture',...fields});assert.equal(r.status,'invalid');assert.equal(r.record,null)}
   assert.equal((await f.store.readNatural({ownerId:'owner-fixture',worldId:'missing'})).status,'empty')
   const original=fs.readFileSync(f.recordPath)
   for(const mutate of [r=>r.worldState.payload.environment.tampered=true,r=>r.worldFacts.worldId='foreign',r=>r.worldFacts.tick=1,r=>r.recordContentSha256='0'.repeat(64),r=>r.statePayloadSha256='f'.repeat(64),r=>r.ownerId='foreign']){
    const g=fixture(kind),v=JSON.parse(original);mutate(v);fs.mkdirSync(path.dirname(g.recordPath),{recursive:true});fs.writeFileSync(g.recordPath,json(v));const r=await g.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'});assert.equal(r.status,'invalid');assert.equal(r.record,null)
   }
   const malformed=fixture(kind);fs.mkdirSync(path.dirname(malformed.recordPath),{recursive:true});fs.writeFileSync(malformed.recordPath,'{"broken"');assert.equal((await malformed.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'})).status,'invalid');assert.equal((await malformed.store.writeNatural(initial(record()))).ok,false)
  })
  test(kind+': malformed UTF8 cannot alias valid replacement-character content hashes',async()=>{
   const f=fixture(kind),r=record();r.worldState.payload.environment.note='\uFFFD'
   const raw=Buffer.from(json(f.validator.sealNaturalWorldRuntimeRecord(r))),marker=Buffer.from('\uFFFD'),at=raw.indexOf(marker);assert(at>=0)
   const corrupt=Buffer.concat([raw.subarray(0,at),Buffer.from([255]),raw.subarray(at+marker.length)])
   fs.mkdirSync(path.dirname(f.recordPath),{recursive:true});fs.writeFileSync(f.recordPath,corrupt)
   const result=await f.store.readNatural({ownerId:r.ownerId,worldId:r.worldId});assert.equal(result.status,'invalid');assert.equal(result.record,null)
  })
  test(kind+': invalid structure, nonfinite/unsafe counters, missing CAS and immutable identity are rejected',async()=>{
   const f=fixture(kind),w=await f.store.writeNatural(initial(record()));assert(w.ok);const before=fs.readFileSync(f.recordPath)
   const mutations=[r=>r.version='unknown',r=>r.worldFacts.schemaVersion='unknown',r=>r.worldFacts.payload={},r=>r.worldFacts.payload.terrainRegions=[],r=>r.worldFacts.payload.walkableRegions=[],r=>r.worldFacts.payload.objectFootprints=[1],r=>r.worldState.payload.environment={},r=>r.worldState.payload.objects=[null],r=>r.randomState={status:'unknown'},r=>r.randomState={status:'not_consumed'},r=>r.sourceBindings=[],r=>r.sourceBindings[0].fileSha256='bad',r=>r.tick=NaN,r=>r.stateVersion=.1,r=>r.eventCursor=Number.MAX_SAFE_INTEGER+1,r=>r.worldState.payload.environment.nan=Infinity,r=>r.butlerProfile={}]
   for(const mutate of mutations){const r=next(record());mutate(r);assert.equal((await f.store.writeNatural({record:r,expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256})).ok,false);assert(fs.readFileSync(f.recordPath).equals(before))}
   for(const key of ['expectedTick','expectedStateVersion','expectedFileSha256']){const v={record:next(record()),expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256};delete v[key];assert.equal((await f.store.writeNatural(v)).ok,false)}
   for(const key of ['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId']){const r=next(record());r[key]+='-changed';if(key==='worldId'||key==='regionId'){r.worldFacts[key]=r[key];r.worldState[key]=r[key]}assert.equal((await f.store.writeNatural({record:r,expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256})).ok,false)}
   const rollback=next(record());rollback.tick=-1;assert.equal((await f.store.writeNatural({record:rollback,expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256})).ok,false)
  })
  test(kind+': old files/latest preserved and cross-format overwrite refused in both directions',async()=>{
   const f=fixture(kind),old=legacy();assert((await f.store.write({record:old,expectedTick:-1})).ok);const oldPath=path.join(f.runtimeRoot,old.ownerId,old.worldId+'.json'),oldBytes=fs.readFileSync(oldPath),latest=fs.readFileSync(f.latestPath)
   const w=await f.store.writeNatural(initial(record()));assert(w.ok);assert(fs.readFileSync(oldPath).equals(oldBytes));assert(fs.readFileSync(f.latestPath).equals(latest));assert.equal((await f.store.read()).record.version,'v2.6-runtime-00');assert.equal((await f.store.read({ownerId:'owner-fixture',worldId:'natural-world-fixture'})).status,'invalid')
   const collide=record();collide.worldId=old.worldId;collide.worldFacts.worldId=old.worldId;collide.worldState.worldId=old.worldId;assert.equal((await f.store.writeNatural(initial(collide))).ok,false);assert(fs.readFileSync(oldPath).equals(oldBytes))
   const legacyOther=legacy();legacyOther.worldId='natural-world-fixture';legacyOther.homeMapState.worldId=legacyOther.worldId;const naturalBefore=fs.readFileSync(f.recordPath);assert.equal((await f.store.write({record:legacyOther,expectedTick:0})).ok,false);assert(fs.readFileSync(f.recordPath).equals(naturalBefore));assert(fs.readFileSync(f.latestPath).equals(latest))
  })
  const journalCases=[
   ['unknown_state',j=>({...j,state:'unknown'})],['unknown_schema',j=>({...j,schemaVersion:'future-transaction-v2'})],
   ['json_null',()=>null],['json_number',()=>7],['json_string',()=> 'committed'],['json_array',()=>[]],
   ['missing_schema',j=>{delete j.schemaVersion;return j}],['wrong_record_kind',j=>({...j,recordKind:'legacy'})],
   ['wrong_record_path',j=>({...j,recordPath:j.recordPath+'.other'})],['wrong_latest_path',j=>({...j,latestPath:'latest-world.json'})],
   ['wrong_world',j=>({...j,worldId:'other-world'})],['wrong_tick',j=>({...j,tick:j.tick+1})],
   ['wrong_state_version',j=>({...j,stateVersion:j.stateVersion+1})],['wrong_content_hash',j=>({...j,recordContentSha256:'f'.repeat(64)})],
   ['malformed_content_hash',j=>({...j,recordContentSha256:'bad'})],['unsafe_tick',j=>({...j,tick:Number.MAX_SAFE_INTEGER+1})],
   ['negative_state_version',j=>({...j,stateVersion:-1})],['prepared',j=>({...j,state:'prepared',createdAtUtc:j.committedAtUtc})],
   ['committed_orphan',j=>j],['committed_record_wrong_owner',j=>j],['committed_record_wrong_world',j=>j],
  ]
  for(const [name,mutate] of journalCases)for(const present of [false,true]){
   if(name==='committed_orphan'&&present||name.startsWith('committed_record_')&&!present)continue
   test(kind+': transaction guard '+name+' '+(present?'existing':'missing')+' preserves record and journal bytes',async()=>{
    const f=fixture(kind),base=f.validator.sealNaturalWorldRuntimeRecord(record()),stored=structuredClone(base)
    if(name==='committed_record_wrong_owner')stored.ownerId='foreign-owner'
    if(name==='committed_record_wrong_world'){stored.worldId='foreign-world';stored.worldFacts.worldId=stored.worldId;stored.worldState.worldId=stored.worldId}
    const sealed=f.validator.sealNaturalWorldRuntimeRecord(stored)
    const journal=mutate({schemaVersion:'world-runtime-transaction-v1',recordKind:'natural_world',state:'committed',recordPath:f.recordPath,latestPath:null,worldId:base.worldId,tick:base.tick,stateVersion:base.stateVersion,recordContentSha256:sealed.recordContentSha256,committedAtUtc:base.savedAt})
    fs.mkdirSync(path.dirname(f.recordPath),{recursive:true});if(present)fs.writeFileSync(f.recordPath,json(sealed));fs.writeFileSync(f.transactionPath,json(journal))
    const beforeRecord=present?fs.readFileSync(f.recordPath):null,beforeJournal=fs.readFileSync(f.transactionPath)
    fs.writeFileSync(path.join(f.privateRoot,'journal-before.bytes'),beforeJournal);if(beforeRecord)fs.writeFileSync(path.join(f.privateRoot,'record-before.bytes'),beforeRecord)
    const read=await f.store.readNatural({ownerId:base.ownerId,worldId:base.worldId})
    const write=await f.store.writeNatural(present?{record:next(record()),expectedTick:0,expectedStateVersion:0,expectedFileSha256:sha(beforeRecord)}:initial(record()))
    const afterRecord=fs.existsSync(f.recordPath)?fs.readFileSync(f.recordPath):null,afterJournal=fs.existsSync(f.transactionPath)?fs.readFileSync(f.transactionPath):null
    if(afterRecord)fs.writeFileSync(path.join(f.privateRoot,'record-after.bytes'),afterRecord);if(afterJournal)fs.writeFileSync(path.join(f.privateRoot,'journal-after.bytes'),afterJournal)
    const bytes=b=>b===null?null:{bytes:b.length,sha256:sha(b)}
    saveReply(path.join(f.privateRoot,'transaction-guard-proof.json'),{case:name,present,read,write,before:{record:bytes(beforeRecord),journal:bytes(beforeJournal)},after:{record:bytes(afterRecord),journal:bytes(afterJournal)}})
    assert.equal(read.status,'invalid');assert.equal(read.record,null);assert.equal(write.ok,false)
    assert.deepEqual(afterRecord,beforeRecord);assert.deepEqual(afterJournal,beforeJournal)
   })
  }
  test(kind+': transaction guard valid cleanup committed permits read and subsequent CAS without eager recovery',async()=>{
   const f=fixture(kind),w=await f.store.writeNatural(initial(record()));assert(w.ok);f.inject('cleanup')
   const failed=await f.store.writeNatural({record:next(record()),expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256});assert.equal(failed.ok,false);f.inject(null)
   const beforeRecord=fs.readFileSync(f.recordPath),beforeJournal=fs.readFileSync(f.transactionPath)
   fs.writeFileSync(path.join(f.privateRoot,'record-before.bytes'),beforeRecord);fs.writeFileSync(path.join(f.privateRoot,'journal-before.bytes'),beforeJournal)
   const r=await f.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'});assert.equal(r.status,'found');assert.equal(r.record.stateVersion,1);assert(fs.readFileSync(f.transactionPath).equals(beforeJournal));assert(fs.readFileSync(f.recordPath).equals(beforeRecord))
   const stale=await f.store.writeNatural({record:next(record()),expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256});assert.equal(stale.ok,false);assert(fs.readFileSync(f.transactionPath).equals(beforeJournal));assert(fs.readFileSync(f.recordPath).equals(beforeRecord))
   const updated=await f.store.writeNatural({record:next(next(record())),expectedTick:1,expectedStateVersion:1,expectedFileSha256:sha(beforeRecord)});assert.equal(updated.ok,true,JSON.stringify(updated));assert.equal(fs.existsSync(f.transactionPath),false)
   saveReply(path.join(f.privateRoot,'transaction-cleanup-proof.json'),{failed,read:r,stale,updated,before:{recordSha256:sha(beforeRecord),journalSha256:sha(beforeJournal)},after:{recordSha256:sha(fs.readFileSync(f.recordPath)),journalExists:false}})
  })
  for(const fault of ['record','commit','cleanup'])test(kind+': '+fault+' failure keeps real journal and replacement outcome',async()=>{
   const f=fixture(kind),w=await f.store.writeNatural(initial(record()));assert(w.ok);const old=fs.readFileSync(f.recordPath);f.inject(fault);const result=await f.store.writeNatural({record:next(record()),expectedTick:0,expectedStateVersion:0,expectedFileSha256:w.fileSha256});assert(f.faultFired());assert.equal(result.ok,false);assert(fs.existsSync(f.transactionPath));const journal=JSON.parse(fs.readFileSync(f.transactionPath,'utf8'));assert.equal(journal.latestPath,null);assert.equal(journal.recordKind,'natural_world');assert.equal(journal.stateVersion,1)
   assert.equal(result.tags.includes('runtime_save_record_replaced'),fault!=='record');assert.equal(fs.readFileSync(f.recordPath).equals(old),fault==='record');const r=await f.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'});assert.equal(r.status,fault==='cleanup'?'found':'invalid');saveReply(path.join(f.privateRoot,'fault-proof.json'),{fault,result,journal,read:r.status})
  })
  test(kind+': real path-security rejects traversal and owner junction redirection',async()=>{
   const f=fixture(kind);const traversal=record();traversal.ownerId='../outside';assert.equal((await f.store.writeNatural(initial(traversal))).ok,false)
   const target=path.join(f.privateRoot,'outside-runtime'),link=path.join(f.runtimeRoot,'owner-fixture');fs.mkdirSync(f.runtimeRoot,{recursive:true});fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'marker'),'unchanged');fs.symlinkSync(target,link,'junction');assert.equal((await f.store.writeNatural(initial(record()))).ok,false);assert.equal((await f.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'})).status,'invalid');assert.deepEqual(fs.readdirSync(target),['marker'])
  })
  test(kind+': new owner/missing read and target-root rejection use real path code',async()=>{
   const f=fixture(kind);assert.equal((await f.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'})).status,'empty')
   assert.equal(fs.existsSync(path.dirname(f.recordPath)),false)
   await assert.rejects(()=>f.load('runtime-path-security').assertRuntimePath(f.runtimeRoot,f.runtimeRoot),/outside configured root/)
   const w=await f.store.writeNatural(initial(record()));assert.equal(w.ok,true,JSON.stringify(w))
  })
  test(kind+': legacy segment permits ADS but natural read/write reject before filesystem calls',async()=>{
   const f=fixture(kind),segment=f.load('runtime-path-security').assertRuntimePathSegment
   for(const key of ['ownerId','worldId'])for(const id of ['owner:stream','natural-world-fixture.json:alternate']){
    assert.doesNotThrow(()=>segment(id,key));const r=record();r[key]=id;if(key==='worldId'){r.worldFacts.worldId=id;r.worldState.worldId=id}
    const written=await f.store.writeNatural(initial(r));assert.equal(written.ok,false);assert.match(written.warnings.join(' '),/path_identity_ads/)
    const read=await f.store.readNatural({ownerId:key==='ownerId'?id:'owner-fixture',worldId:key==='worldId'?id:'natural-world-fixture'});assert.equal(read.status,'invalid')
   }
   assert.equal(f.io.length,0)
  })
  test(kind+': actual file symlink read/write is rejected',async(t)=>{
   const f=fixture(kind),target=path.join(f.privateRoot,'outside-file.json');fs.mkdirSync(path.dirname(f.recordPath),{recursive:true});fs.writeFileSync(target,json(f.validator.sealNaturalWorldRuntimeRecord(record())))
   try{fs.symlinkSync(target,f.recordPath,'file')}catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('Native file symlink privilege unavailable: '+error.code);return}throw error}
   const original=fs.readFileSync(target);assert.equal((await f.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'})).status,'invalid');assert.equal((await f.store.writeNatural(initial(record()))).ok,false);assert(fs.readFileSync(target).equals(original))
  })
  test(kind+': existing lock and orphan prepared transaction are not empty or stolen',async()=>{
   const f=fixture(kind);fs.mkdirSync(path.dirname(f.recordPath),{recursive:true});fs.writeFileSync(f.recordPath+'.lock','{"lockToken":"foreign"}');assert.equal((await f.store.writeNatural(initial(record()))).code,'conflict');assert.equal(fs.readFileSync(f.recordPath+'.lock','utf8'),'{"lockToken":"foreign"}')
   const g=fixture(kind);fs.mkdirSync(path.dirname(g.recordPath),{recursive:true});fs.writeFileSync(g.transactionPath,'{"state":"prepared"}');assert.equal((await g.store.writeNatural(initial(record()))).ok,false);assert.equal(fs.existsSync(g.recordPath),false);assert.equal((await g.store.readNatural({ownerId:'owner-fixture',worldId:'natural-world-fixture'})).status,'invalid')
  })
 }
 test('JSON max depth64/bytes4MiB, key order hashing, arrays, accessors and cycles',async()=>{
  const f=fixture('production'),v=f.validator
  const a=record(),b=JSON.parse(JSON.stringify(a));b.worldState.payload.environment={weather:{reason:'synthetic persistence fixture, not a generated world',status:'unknown'}};assert.equal(v.sealNaturalWorldRuntimeRecord(a).recordContentSha256,v.sealNaturalWorldRuntimeRecord(b).recordContentSha256)
  const numeric=record();numeric.worldState.payload.environment={"2":"second","10":"tenth"};const sealedNumeric=v.sealNaturalWorldRuntimeRecord(numeric)
  const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x)
  const {recordContentSha256,...content}=sealedNumeric;assert.equal(recordContentSha256,sha(Buffer.from(canonical(content))))
  const depth=(x)=>x&&typeof x==='object'?Math.max(0,...Object.values(x).map(n=>1+depth(n))):0
  const d=record();let current={end:true};d.worldState.payload.environment.deep=current;while(depth(d)<64){current={next:current};d.worldState.payload.environment.deep=current}assert.equal(depth(d),64);v.sealNaturalWorldRuntimeRecord(d);d.worldState.payload.environment.deep={next:current};assert.throws(()=>v.sealNaturalWorldRuntimeRecord(d),/depth/)
  const big=record();big.worldState.payload.environment.blob='';const overhead=Buffer.byteLength(json(v.sealNaturalWorldRuntimeRecord(big)));big.worldState.payload.environment.blob='x'.repeat(v.NATURAL_WORLD_MAX_BYTES-overhead);const sealed=v.sealNaturalWorldRuntimeRecord(big);assert.equal(Buffer.byteLength(json(sealed)),v.NATURAL_WORLD_MAX_BYTES);big.worldState.payload.environment.blob+='x';assert.throws(()=>v.sealNaturalWorldRuntimeRecord(big),/size/)
  const cycle=record();cycle.worldState.payload.environment.self=cycle;assert.throws(()=>v.sealNaturalWorldRuntimeRecord(cycle),/cycle/)
  const accessor=record();Object.defineProperty(accessor.worldState.payload.environment,'getter',{enumerable:true,get(){throw Error('must not call accessor')}});assert.throws(()=>v.sealNaturalWorldRuntimeRecord(accessor),/accessor/)
  const sparse=record();sparse.worldFacts.payload.objectFootprints=Array(2);assert.throws(()=>v.sealNaturalWorldRuntimeRecord(sparse),/sparse_array/)
  const custom=record();custom.worldState.payload.environment=new Date();assert.throws(()=>v.sealNaturalWorldRuntimeRecord(custom),/prototype/)
  const notConsumed=record();notConsumed.randomState={status:'not_consumed',reason:'fixture has not used randomness'};v.sealNaturalWorldRuntimeRecord(notConsumed)
 })
 test('exact4MiB natural file is persisted and verified at the byte ceiling',async()=>{
  const f=fixture('production'),v=f.validator,big=record();big.worldState.payload.environment.blob=''
  const overhead=Buffer.byteLength(json(v.sealNaturalWorldRuntimeRecord(big)));big.worldState.payload.environment.blob='x'.repeat(v.NATURAL_WORLD_MAX_BYTES-overhead)
  const w=await f.store.writeNatural(initial(big));assert.equal(w.ok,true,JSON.stringify(w));assert.equal(fs.statSync(f.recordPath).size,v.NATURAL_WORLD_MAX_BYTES)
  assert.equal((await f.store.readNatural({ownerId:big.ownerId,worldId:big.worldId,expectedFileSha256:w.fileSha256})).status,'found')
 })
 test('adapter without explicit natural capability fails instead of using legacy methods',async()=>{
  const f=fixture('development');f.store.readNatural=undefined;f.store.writeNatural=undefined
  await assert.rejects(()=>f.facade.readNaturalWorldRuntimeSaveRecord({ownerId:'owner-fixture',worldId:'natural-world-fixture'}),/natural_world_store_capability_unavailable/)
  await assert.rejects(()=>f.facade.writeNaturalWorldRuntimeSaveRecord(initial(record())),/natural_world_store_capability_unavailable/)
  assert.equal(f.io.length,0)
 })
 test('production facade without configured root fails explicitly, without fallback writes',async()=>{
  const f=fixture('production');delete f.env.AI_PET_WORLD_RUNTIME_STORE_ROOT;await assert.rejects(()=>f.facade.writeNaturalWorldRuntimeSaveRecord(initial(record())),/AI_PET_WORLD_RUNTIME_STORE_ROOT/);assert.equal(fs.existsSync(f.recordPath),false)
 })
}
