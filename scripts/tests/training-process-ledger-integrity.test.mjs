import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import test from 'node:test'
import ts from 'typescript'

const event={id:'private-event',timestamp:'2026-11-11T00:00:00Z',action:'private-check',runId:'private-run',kind:'run_completed',status:'success',title:'private event'}
const emptySummary={total:0,running:0,success:0,failed:0,error:0,blocked:0,info:0,lastEvent:null}

for(const [callbackFails,releaseFails,primary] of [
  [false,false,new Error('unused')], [false,true,new Error('unused')],
  [true,false,new Error('commit failed')], [true,true,new Error('commit failed')],
  [true,true,Object.freeze(new Error('frozen commit failed'))], [true,true,null],
]) test(`program ledger preserves commit error: callback=${callbackFails}, release=${releaseFails}, primary=${String(primary)}`,()=>{
  const file='scripts/lib/ai-painter-program-event-store.mjs'
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='withLedgerCommitLock')
  assert(fn)
  const calls=[],identity={source:'test_process_start_identity_v1',value:'private'},value={committed:true},releaseError=new Error('release failed')
  const run=new Function('fs','LEDGER_DIR','randomUUID','currentProcessStartIdentity','acquireLedgerCommitLock','releaseLedgerCommitLock',`return (${fn.getText(source)});`)(
    {mkdirSync:()=>calls.push('mkdir')},'private-ledger',()=> 'private-token',()=>identity,
    (token,started,owner)=>{assert.equal(token,'private-token');assert(Number.isFinite(started));assert.equal(owner,identity);calls.push('acquire')},
    (token,owner)=>{assert.equal(token,'private-token');assert.equal(owner,identity);calls.push('release');if(releaseFails)throw releaseError},
  )
  let threw=false,actual,result
  try{result=run(()=>{calls.push('callback');if(callbackFails)throw primary;return value})}catch(error){threw=true;actual=error}
  assert.deepEqual(calls,['mkdir','acquire','callback','release'])
  assert.equal(threw,callbackFails||releaseFails)
  if(threw)assert.equal(actual,callbackFails?primary:releaseError)
  else assert.equal(result,value)
})

test('program ledger never releases or invokes callback after failed acquisition',()=>{
  const file='scripts/lib/ai-painter-program-event-store.mjs'
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='withLedgerCommitLock')
  const failure=new Error('acquisition failed'),calls=[]
  const run=new Function('fs','LEDGER_DIR','randomUUID','currentProcessStartIdentity','acquireLedgerCommitLock','releaseLedgerCommitLock',`return (${fn.getText(source)});`)(
    {mkdirSync:()=>calls.push('mkdir')},'private-ledger',()=> 'private-token',()=>({}),
    ()=>{calls.push('acquire');throw failure},()=>calls.push('release'),
  )
  assert.throws(()=>run(()=>calls.push('callback')),e=>e===failure)
  assert.deepEqual(calls,['mkdir','acquire'])
})

function loadLedgerPrivate(name,bindings) {
  const file='scripts/lib/ai-painter-program-event-store.mjs'
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)
  assert(fn)
  return new Function(...Object.keys(bindings),`return (${fn.getText(source)});`)(...Object.values(bindings))
}

for(const kind of ['atomic','lock']) for(const scenario of [
  'success','open','write','sync','close','directory','write+close','sync+close',
  'write+unlink','write+exists','null+close','frozen+close','write-eexist',
  ...(kind==='atomic'?['rename','hook']:['existing-lock']),
]) test(`ledger file cleanup ${kind}: ${scenario}`,t=>{
  const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'ledger-cleanup-'))
  t.after(()=>{
    assert.equal(path.dirname(root),parent);assert.equal(fs.realpathSync(root),root)
    assert(path.basename(root).startsWith('ledger-cleanup-'));assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root,{recursive:true})
  })
  const target=path.join(root,kind==='atomic'?'events.json':'commit.lock'),calls=[]
  const primary=scenario==='null+close'?null:Object.freeze(Object.assign(new Error('primary '+scenario),{code:scenario==='write-eexist'?'EEXIST':'EIO'}))
  const cleanupError=new Error('secondary cleanup'),identity={source:'private',value:'process-start'}
  const writeFails=['write','write+close','write+unlink','write+exists','null+close','frozen+close','write-eexist'].includes(scenario)
  let temp,probes=0,closed=0
  if(kind==='atomic'||scenario==='existing-lock')fs.writeFileSync(target,'original')
  const io={
    mkdirSync:fs.mkdirSync,
    openSync(file,flags){calls.push('open');temp=file;if(scenario==='open')throw primary;return fs.openSync(file,flags)},
    writeFileSync(fd,bytes,encoding){calls.push('write');if(writeFails){fs.writeFileSync(fd,'partial');throw primary}fs.writeFileSync(fd,bytes,encoding)},
    fsyncSync(fd){calls.push('sync');if(['sync','sync+close'].includes(scenario))throw primary;fs.fsyncSync(fd)},
    closeSync(fd){calls.push('close');closed++;fs.closeSync(fd);if(scenario==='close')throw primary;if(scenario.endsWith('+close'))throw cleanupError},
    existsSync(file){calls.push('exists');if(scenario==='write+exists')throw cleanupError;return fs.existsSync(file)},
    unlinkSync(file){calls.push('unlink');if(scenario==='write+unlink')throw cleanupError;fs.unlinkSync(file)},
    renameSync(from,to){calls.push('rename');if(scenario==='rename')throw primary;fs.renameSync(from,to)},
  }
  const directorySync=()=>{calls.push('directory');if(scenario==='directory')throw primary}
  const hook=()=>{calls.push('hook');if(scenario==='hook')throw primary}
  const run=loadLedgerPrivate(kind==='atomic'?'writeTextAtomic':'acquireLedgerCommitLock',{
    fs:io,path,process,randomUUID:()=> 'private',fsyncDirectoryBestEffort:directorySync,invokeProgramEventStoreTestHook:hook,
    LEDGER_DIR:root,LEDGER_LOCK_PATH:target,LOCK_TIMEOUT_MS:0,LOCK_RETRY_MS:0,LOCK_WAIT_ARRAY:new Int32Array(new SharedArrayBuffer(4)),projectPath:v=>v,
    probeLedgerCommitLock:()=>{probes++;return {state:'indeterminate',reason:'private-existing-owner'}},
    archiveDeadLedgerCommitLock:()=>{throw new Error('unexpected takeover')},
  })
  let threw=false,actual
  try{if(kind==='atomic')run(target,'replacement','private-hook');else run('private-token',Date.now(),identity)}catch(error){threw=true;actual=error}
  assert.equal(threw,scenario!=='success')
  if(scenario==='existing-lock'){
    assert.match(actual.message,/identity is indeterminate/);assert.equal(probes,1)
    assert.equal(fs.readFileSync(target,'utf8'),'original');assert.equal(closed,0);assert(!calls.includes('unlink'));return
  }
  if(threw)assert.equal(actual,primary,'the original failure must survive cleanup')
  assert.equal(probes,0,'an error after own lock creation must not enter contention handling')
  assert.equal(closed,scenario==='open'?0:1,'never retry a possibly consumed descriptor')
  if(kind==='atomic'){
    assert.equal(fs.readFileSync(target,'utf8'),['success','directory'].includes(scenario)?'replacement':'original')
    if(['write+unlink','write+exists'].includes(scenario))assert.equal(fs.readFileSync(temp,'utf8'),'partial')
    else assert.equal(fs.existsSync(temp),false)
  }else if(scenario==='success'){
    const record=JSON.parse(fs.readFileSync(target,'utf8'))
    assert.equal(record.token,'private-token');assert.deepEqual(record.processStartIdentity,identity)
    assert.equal(record.schemaVersion,'ai-painter-program-event-commit-lock-v2');assert.equal(record.pid,process.pid)
  }else if(['write+unlink','write+exists'].includes(scenario))assert.equal(fs.readFileSync(target,'utf8'),'partial')
  else assert.equal(fs.existsSync(target),false)
})

for(const phase of ['success','open','sync','unsupported']) for(const closeFails of [false,true])
test(`ledger directory cleanup ${phase}, close=${closeFails}`,()=>{
  const primary=Object.freeze(Object.assign(new Error('directory failure'),{code:phase==='unsupported'?'EPERM':'EIO'})),secondary=new Error('close failed')
  let closes=0
  const run=loadLedgerPrivate('fsyncDirectoryBestEffort',{fs:{
    openSync:()=>{if(phase==='open')throw primary;return 42},
    fsyncSync:()=>{if(['sync','unsupported'].includes(phase))throw primary},
    closeSync:fd=>{assert.equal(fd,42);closes++;if(closeFails)throw secondary},
  }})
  let actual,threw=false
  try{run('private')}catch(error){threw=true;actual=error}
  assert.equal(closes,phase==='open'?0:1)
  assert.equal(threw,['open','sync'].includes(phase)||closeFails)
  if(threw)assert.equal(actual,['open','sync'].includes(phase)?primary:secondary)
})

for(const scenario of ['new','existing','racing-writer','racing-identical','publish-failure'])
test(`immutable program run preserves original: ${scenario}`,t=>{
  const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'immutable-run-'))
  t.after(()=>{
    assert.equal(path.dirname(root),parent);assert.equal(fs.realpathSync(root),root)
    assert(path.basename(root).startsWith('immutable-run-'));assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root,{recursive:true})
  })
  const runPath=path.join(root,'runs','run-id','report.json'),latestPath=path.join(root,'runs','latest.json')
  const record={schemaVersion:'private-run-v1',status:'passed',createdAtUtc:'2026-11-12T00:00:00Z',payload:'candidate'}
  const expected=JSON.stringify(record,null,2)+'\n',original=scenario==='racing-identical'?expected:'original immutable bytes\n',indexed=[]
  fs.mkdirSync(path.dirname(runPath),{recursive:true});fs.writeFileSync(latestPath,'original latest')
  if(scenario==='existing')fs.writeFileSync(runPath,original)
  const failure=Object.freeze(Object.assign(new Error('private publication failed'),{code:'EACCES'}))
  const publish=(operation,from,to)=>{
    if(to===runPath){
      if(scenario==='publish-failure')throw failure
      if(scenario.startsWith('racing-'))fs.writeFileSync(to,original,{flag:'wx'})
    }
    return fs[operation](from,to)
  }
  const io={...fs,renameSync:(from,to)=>publish('renameSync',from,to),linkSync:(from,to)=>publish('linkSync',from,to)}
  const file='scripts/lib/ai-painter-program-event-store.mjs',source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true)
  const names=['writeImmutableProgramRun','writeJsonAtomic','writeTextAtomic','fsyncDirectoryBestEffort']
  const functions=names.map(name=>{const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert(fn);return fn.getText(source).replace(/^export\s+/u,'')})
  const run=new Function('fs','path','ROOT','process','randomUUID','projectPath','indexWrittenArtifact',`${functions.join('\n')}\nreturn writeImmutableProgramRun;`)(
    io,path,root,process,()=> 'private',v=>path.relative(root,v).replaceAll('\\','/'),(file,id)=>indexed.push({file,id}),
  )
  let threw=false,error,result
  try{result=run({root:'runs',runId:'run-id',fileName:'report.json',record,latest:{purpose:'private'}})}catch(caught){threw=true;error=caught}
  assert.equal(threw,scenario!=='new','same-name publication must fail even after the existence precheck')
  assert.deepEqual(fs.readdirSync(path.dirname(runPath)).filter(n=>n.endsWith('.tmp')),[])
  if(scenario==='new'){
    assert.equal(fs.readFileSync(runPath,'utf8'),expected)
    assert.deepEqual(result,{runPath:'runs/run-id/report.json',runRoot:'runs/run-id'})
    const latest=JSON.parse(fs.readFileSync(latestPath,'utf8'))
    assert.equal(latest.runPath,result.runPath);assert.equal(latest.purpose,'private');assert.equal(latest.status,record.status)
    assert.deepEqual(indexed,[{file:runPath,id:'run-id'},{file:latestPath,id:'run-id'}])
  }else{
    assert.equal(fs.readFileSync(latestPath,'utf8'),'original latest');assert.deepEqual(indexed,[])
    if(scenario==='publish-failure'){assert.equal(error,failure);assert.equal(fs.existsSync(runPath),false)}
    else {assert.equal(fs.readFileSync(runPath,'utf8'),original);if(scenario.startsWith('racing-'))assert.equal(error.code,'EEXIST')}
  }
})

test('ledger summary counts supported statuses and preserves the actual last event',()=>{
  const summarize=loadLedgerPrivate('buildLedgerSummary',{})
  assert.deepEqual(summarize([]),emptySummary)
  const events=['running','success','failed','error','blocked','info','success'].map((status,id)=>Object.freeze({...event,id:String(id),status}))
  const actual=summarize(Object.freeze(events))
  assert.deepEqual(actual,{total:7,running:1,success:2,failed:1,error:1,blocked:1,info:1,lastEvent:events.at(-1)})
  assert.equal(actual.lastEvent,events.at(-1))
})

for(const status of ['total','lastEvent','constructor','__proto__','unrecognized','',null,undefined,['success']])
test(`ledger summary ignores unknown status counters: ${JSON.stringify(status)}`,()=>{
  const summarize=loadLedgerPrivate('buildLedgerSummary',{})
  const unknown=Object.freeze({...event,id:'unknown',status}),events=Object.freeze([event,unknown])
  const summary=summarize(events)
  assert.deepEqual(summary,{...emptySummary,total:2,success:1,lastEvent:unknown})
  assert.equal(summary.lastEvent,unknown)
  assert.equal(unknown.status,status)
  assert.equal(Object.getPrototypeOf(summary),Object.prototype)
})

function load(file,resolve,clock=Date) {
  const source=fs.readFileSync(file,'utf8')
    .replace('createRequire(import.meta.url)','createRequire("file:///private-catalog-fixture.mjs")')
    .replace('const require = createRequire','const catalogRequire = createRequire')
    .replace('const sqlite = require("node:sqlite")','const sqlite = catalogRequire("node:sqlite")')
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const exports={};new Function('require','exports','Date',output)(resolve,exports,clock);return exports
}

function loadCatalog(Database,filename='private-catalog') {
  return load('src/server/ai-pet-world-storage-catalog.ts',id=>{
    if(id==='node:path')return path
    if(id==='node:fs/promises')return {}
    if(id==='@/server/ai-pet-world-storage')return {aiPetWorldCatalogPath:filename}
    if(id==='node:module')return {createRequire:()=>name=>{assert.equal(name,'node:sqlite');return {DatabaseSync:Database}}}
    throw Error('unexpected dependency '+id)
  })
}

test('invalid training event identities do not open a catalog connection',()=>{
  let opened=0,closed=0
  const catalog=loadCatalog(class {constructor(){opened++};exec(){};close(){closed++}})
  for(const invalid of [{},{id:1,timestamp:event.timestamp},{id:event.id,timestamp:null}])assert.equal(catalog.indexTrainingProcessEvent(invalid),false)
  assert.equal(opened,0);assert.equal(closed,0)
})

test('catalog closes a database whose initialization pragma fails',()=>{
  let closes=0
  const catalog=loadCatalog(class {
    exec(){throw Error('private initialization failure')}
    close(){closes++}
  })
  assert.equal(catalog.readIndexedTrainingProcessLedger(),null)
  assert.equal(closes,1)
})

test('catalog reads counts and latest events from one snapshot during a concurrent insert',t=>{
  const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'training-ledger-snapshot-')),filename=path.join(root,'catalog.sqlite')
  let writer,readers=[]
  t.after(()=>{
    for(const reader of readers)if(reader.isOpen)reader.close()
    if(writer?.isOpen)writer.close()
    assert.equal(path.dirname(root),parent);assert(path.basename(root).startsWith('training-ledger-snapshot-'));assert.equal(fs.realpathSync(root),root);assert(!fs.lstatSync(root).isSymbolicLink());fs.rmSync(root,{recursive:true})
  })
  writer=new DatabaseSync(filename)
  writer.exec('PRAGMA journal_mode=WAL; CREATE TABLE program_events(status TEXT, timestamp_utc TEXT, event_json TEXT)')
  const insert=value=>writer.prepare('INSERT INTO program_events VALUES (?,?,?)').run(value.status,value.timestamp,JSON.stringify(value))
  insert(event)
  let inserted=false,closes=0
  const second={...event,id:'concurrent-event',timestamp:'2026-11-11T00:00:01Z',status:'failed'}
  const catalog=loadCatalog(class {
    constructor(file,options){assert.equal(options.readOnly,true);this.db=new DatabaseSync(file,options);readers.push(this.db)}
    exec(sql){this.db.exec(sql)}
    close(){this.db.close();closes++}
    prepare(sql){const statement=this.db.prepare(sql);return {
      all:(...args)=>{const rows=statement.all(...args);if(sql.includes('GROUP BY')&&!inserted){inserted=true;insert(second)}return rows},
      get:(...args)=>statement.get(...args),
    }}
  },filename)
  const result=catalog.readIndexedTrainingProcessLedger()
  assert.equal(inserted,true);assert.equal(writer.prepare('SELECT COUNT(*) AS count FROM program_events').get().count,2)
  assert.equal(result.summary.total,1);assert.equal(result.summary.success,1);assert.equal(result.summary.failed,0)
  assert.deepEqual(result.events,[event]);assert.deepEqual(result.summary.lastEvent,event);assert.equal(result.updatedAt,event.timestamp)
  assert.equal(closes,1)
})

test('catalog closes the readonly connection and preserves a query error',()=>{
  const failure=Error('private query failure');let closes=0
  const catalog=loadCatalog(class {exec(){};prepare(){throw failure};close(){closes++}})
  assert.throws(()=>catalog.readIndexedTrainingProcessLedger(),error=>error===failure);assert.equal(closes,1)
})
function stateFixture({journal,marker,indexed=null,indexedReader,fsOperations={},uuid,recordEvent,clock=Date}={}) {
  const reads=[]
  const state=load('src/server/ai-painter-training-state.ts',id=>{
    if(id==='node:path')return path
    if(id==='node:crypto')return {randomUUID:uuid??(()=>{throw Error('read must not allocate event identity')})}
    if(id==='@/server/ai-pet-world-storage')return {aiPainterRuntimeRoot:path.resolve('private-ledger-fixture')}
    if(id==='@/server/ai-pet-world-storage-catalog')return {readIndexedTrainingProcessLedger:indexedReader??(()=>indexed),indexTrainingProcessEvent:recordEvent??(()=>{throw Error('read must not write index')})}
    if(id==='node:fs/promises')return {readFile:async file=>{
      reads.push(file)
      const value=file.endsWith('degraded.json')?marker:file.endsWith('events.jsonl')?journal:undefined
      if(value instanceof Error)throw value
      if(value===undefined)throw Object.assign(Error('private absent'),{code:'ENOENT'})
      return value
    },...fsOperations}
    throw Error('unexpected dependency '+id)
  },clock)
  return {state,reads}
}

test('future runtime heartbeat is unavailable instead of a fresh zero-age observation',async()=>{
  const now=Date.parse('2026-11-11T00:00:00Z')
  class Clock extends Date { static now(){return now} }
  const heartbeat={schemaVersion:'ai-painter-runtime-heartbeat-v1',heartbeatId:'private',timestampUtc:new Date(now+1).toISOString(),timestampLocal:'private-original',timezone:'Asia/Shanghai',status:'training',activeTaskId:null,activeAction:null,activeModelRole:null,activeStep:null,activeScript:null,pid:1,controllerPid:1,childPid:null,lastOutputRef:null,source:'training_controller'}
  const {state}=stateFixture({clock:Clock,fsOperations:{readFile:async()=>JSON.stringify(heartbeat)}})
  const future=await state.readTrainingRuntimeStatus()
  assert.equal(future.statusSource,'future_runtime_heartbeat');assert.equal(future.status,'blocked')
  assert.equal(future.stale,true);assert.equal(future.ageMs,null);assert.deepEqual(future.heartbeat,heartbeat)
  for(const age of [0,1,120000,120001]){
    heartbeat.timestampUtc=new Date(now-age).toISOString()
    const result=await state.readTrainingRuntimeStatus()
    assert.equal(result.ageMs,age);assert.equal(result.stale,age>120000)
    assert.equal(result.statusSource,age>120000?'stale_runtime_heartbeat':'runtime_heartbeat')
  }
  const {route}=progressFixture({control:{status:'running',action:'private'},runtimeStatus:future})
  const result=await route.GET(progressRequest('summary'))
  assert.equal(result.control.status,'blocked');assert.equal(result.control.statusSource,'future_runtime_heartbeat')
})

test('training log zero and invalid line limits do not read or expose the full file',async()=>{
  let reads=0
  const {state}=stateFixture({fsOperations:{readFile:async()=>{reads++;return 'first\nsecond\n'}}})
  assert.deepEqual(await state.readTrainingLogTail(0),[])
  assert.equal(reads,0)
  for(const limit of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'2',null]){
    await assert.rejects(state.readTrainingLogTail(limit),RangeError)
  }
  assert.equal(reads,0)
})

test('training log empty files have no rows and positive/default limits preserve tail order',async()=>{
  for(const text of ['', '\n', '\r\n', '  \n']){
    const {state}=stateFixture({fsOperations:{readFile:async()=>text}})
    assert.deepEqual(await state.readTrainingLogTail(),[])
  }
  const lines=Array.from({length:100},(_,i)=>'line-'+i)
  const {state}=stateFixture({fsOperations:{readFile:async()=>lines.join('\r\n')+'\r\n'}})
  assert.deepEqual(await state.readTrainingLogTail(),lines.slice(20))
  assert.deepEqual(await state.readTrainingLogTail(2),lines.slice(98))
  assert.deepEqual(await state.readTrainingLogTail(Number.MAX_SAFE_INTEGER),lines)
})

test('training log observations distinguish readable empty, missing, failed and unrequested logs',async()=>{
  const missing=stateFixture()
  assert.deepEqual(await missing.state.readTrainingLogObservation(),{lines:[],status:'not_recorded',errorCode:null})
  for(const text of ['', 'one\ntwo\n']){
    const {state}=stateFixture({fsOperations:{readFile:async()=>text}})
    const result=await state.readTrainingLogObservation(1)
    assert.deepEqual(result,{lines:text?['two']:[],status:'available',errorCode:null})
  }
  for(const code of ['EACCES','EIO','EISDIR',undefined]){
    const {state}=stateFixture({fsOperations:{readFile:async()=>{throw Object.assign(Error('private path and secret'),{code})}}})
    const result=await state.readTrainingLogObservation()
    assert.deepEqual(result,{lines:[],status:'unreadable',errorCode:'training_log_read_failed'})
    assert.equal(JSON.stringify(result).includes('secret'),false)
    assert.deepEqual(await state.readTrainingLogTail(),[])
  }
  const zero=stateFixture({fsOperations:{readFile:async()=>{throw Error('must not read')}}})
  assert.deepEqual(await zero.state.readTrainingLogObservation(0),{lines:[],status:'not_requested',errorCode:null})
  for(const limit of [-1,NaN,1.1,'2'])await assert.rejects(zero.state.readTrainingLogObservation(limit),RangeError)
})

function progressFixture({
  observation={lines:[],status:'unreadable',errorCode:'training_log_read_failed'},
  control={status:'idle',action:null},
  runtimeStatus={heartbeat:null,status:'idle',statusSource:'missing_heartbeat'},
  gpuResponses=[],
}={}) {
  let logReads=0
  const missing=async()=>{throw Object.assign(Error('private absent'),{code:'ENOENT'})}
  const resolve=id=>{
    if(id==='node:path')return path
    if(id==='node:os')return os
    if(id==='@/server/ai-painter-training-progress-projection')return {}
    if(id==='@/server/ai-painter-training-hardware')return load('src/server/ai-painter-training-hardware.ts',resolve)
    if(id==='node:fs/promises')return {readFile:missing,readdir:missing,stat:missing}
    if(id==='node:util')return {promisify:()=>async()=>gpuResponses.length?{stdout:gpuResponses.shift()}:missing()}
    if(id==='node:child_process')return {execFile:()=>{throw Error('native process forbidden')}}
    if(id.endsWith('runtime-working-directory.mjs'))return {runtimeWorkingDirectory:()=>path.resolve('private-progress-fixture')}
    if(id==='next/server')return {NextResponse:{json:value=>value}}
    if(id==='@/server/ai-painter-resource-usage')return {readResourceUsageLedger:async()=>({privateMarker:'resource-preserved'})}
    if(id==='@/server/ai-painter-training-quality-gate')return {buildTrainingQualityGateReport:()=>{throw Error('no quality source')}}
    if(id==='@/world/world-visual-painter')return {buildVisualUnitV0Status:()=>({privateMarker:'visual-preserved'})}
    if(id==='@/server/ai-painter-training-state')return {
      readTrainingControlState:async()=>control,
      readTrainingLogObservation:async()=>{logReads++;return observation},
      readTrainingLogTail:async()=>[],
      readTrainingProcessLedger:async()=>({summary:emptySummary,events:[],updatedAt:null}),
      readTrainingRuntimeStatus:async()=>runtimeStatus,
    }
    throw Error('unexpected dependency '+id)
  }
  const route=load('src/app/api/ai-painter/training-progress/route.ts',resolve)
  return {route,get logReads(){return logReads}}
}

test('full training progress preserves other observations when logs are unreadable',async()=>{
  const fixture=progressFixture(),{route}=fixture
  const result=await route.GET({nextUrl:new URL('http://private/api/ai-painter/training-progress')})
  assert.equal(fixture.logReads,1)
  assert.deepEqual(result.logs,[])
  assert.deepEqual(result.logObservation,{status:'unreadable',errorCode:'training_log_read_failed'})
  assert.equal(result.resourceUsage.privateMarker,'resource-preserved')
  assert.equal(result.visualUnitV0.privateMarker,'visual-preserved')
  const summary=await route.GET({nextUrl:new URL('http://private/api/ai-painter/training-progress?view=summary')})
  assert.equal(fixture.logReads,1)
  assert.equal('logs' in summary,false)
  assert.equal('logObservation' in summary,false)
})

const progressRequest=view=>({nextUrl:new URL('http://private/api/ai-painter/training-progress'+(view==='summary'?'?view=summary':''))})
const busyGpu=()=>['Private GPU, 24000, 22000, 98, 80, 1.2','888, other-python.exe, 22000']

test('legacy GPU observation distinguishes unreadable from zero and reuses detailed observer',async()=>{
  const missing=await progressFixture().route.GET(progressRequest('summary'))
  for(const field of ['memoryTotalMiB','memoryUsedMiB','utilizationPercent','temperatureCelsius','activeComputeProcessCount','computeProcesses','gpuBusy'])assert.equal(missing.system[field],null,field)
  assert.deepEqual(missing.system.observationIssues,['gpu_query_failed'])
  const zero=await progressFixture({gpuResponses:['Private GPU, 24000, 0, 0, 0, 1.2','']}).route.GET(progressRequest('summary'))
  for(const field of ['memoryUsedMiB','utilizationPercent','temperatureCelsius','activeComputeProcessCount'])assert.equal(zero.system[field],0,field)
  assert.deepEqual(zero.system.computeProcesses,[]);assert.equal(zero.system.gpuBusy,false)
  const busy=await progressFixture({gpuResponses:busyGpu()}).route.GET(progressRequest('summary'))
  assert.equal(busy.system.activeComputeProcessCount,1)
  assert.deepEqual(busy.system.computeProcesses,[{pid:888,processName:'other-python.exe',usedMemoryMiB:22000}])
  const partial=await progressFixture({gpuResponses:['Private GPU, 24000, 0, N/A, 0, 1.2','']}).route.GET(progressRequest('summary'))
  assert.equal(partial.system.gpuBusy,null)
})

test('legacy training progress does not turn unrelated GPU activity into training',async()=>{
  for(const view of ['summary','full']){
    const {route}=progressFixture({gpuResponses:busyGpu()})
    const result=await route.GET(progressRequest(view))
    assert.equal(result.system.gpuBusy,true)
    assert.equal(result.control.status,'idle')
    assert.equal(result.control.liveDetected,false)
  }
})

test('legacy running records without matched fresh heartbeat remain explicitly unverified',async()=>{
  for(const view of ['summary','full'])for(const gpuResponses of [[],busyGpu()]){
    const {route}=progressFixture({control:{status:'running',action:'private',currentStep:'prior stage'},gpuResponses})
    const result=await route.GET(progressRequest(view))
    assert.equal(result.control.status,'unknown')
    assert.equal(result.control.controlFileStatus,'running')
    assert.equal(result.control.liveDetected,false)
    assert.equal(result.control.statusSource,'unverified_training_control')
    if(view==='full')assert.equal(result.training.status,'unknown')
  }
})

test('legacy training projection preserves corruption, recovery and terminal observations',async()=>{
  const runtimeStatus={heartbeat:{activeStep:'old training'},status:'training',statusSource:'runtime_heartbeat',stale:false}
  for(const status of ['corrupted_state','recovery_required','completed','failed']){
    const {route}=progressFixture({control:{status,action:'private'},runtimeStatus,gpuResponses:busyGpu()})
    const result=await route.GET(progressRequest('full'))
    assert.equal(result.control.status,['completed','failed'].includes(status)?status:'blocked')
    assert.equal(result.control.controlFileStatus,status)
    assert.equal(result.control.liveDetected,false)
    assert.equal(result.training.status,result.control.status)
  }
})

test('legacy active heartbeat must match control identity and start time',async()=>{
  const control={status:'running',action:'private',controllerPid:1234,childPid:5678,startedAt:'2026-11-11T00:00:00Z'}
  const heartbeat={activeAction:'private',controllerPid:1234,childPid:5678,timestampUtc:'2026-11-11T00:00:01Z',activeStep:'current stage'}
  const runtimeStatus={heartbeat,status:'training',statusSource:'runtime_heartbeat',stale:false}
  const good=progressFixture({control,runtimeStatus})
  const result=await good.route.GET(progressRequest('summary'))
  assert.equal(result.control.status,'running');assert.equal(result.control.liveDetected,true)
  for(const changed of [{activeAction:'other'},{controllerPid:9876},{childPid:9999},{timestampUtc:'2026-11-10T23:59:59Z'}]){
    const {route}=progressFixture({control,runtimeStatus:{...runtimeStatus,heartbeat:{...heartbeat,...changed}}})
    assert.equal((await route.GET(progressRequest('summary'))).control.status,'unknown')
  }
  for(const altered of [{...runtimeStatus,stale:true},{...runtimeStatus,status:'completed_round'}]){
    const {route}=progressFixture({control,runtimeStatus:altered})
    assert.equal((await route.GET(progressRequest('summary'))).control.status,'unknown')
  }
})

test('training control state validates supplied process identities while keeping absent/null compatibility',async()=>{
  const valid={status:'running',action:'private',currentStep:'private',startedAt:null,finishedAt:null,error:null}
  for(const field of ['controllerPid','childPid']){
    for(const pid of [undefined,null,1,2147483647]){
      const value={...valid,[field]:pid},{state}=stateFixture({fsOperations:{readFile:async()=>JSON.stringify(value)}})
      assert.equal((await state.readTrainingControlState()).status,'running')
    }
    for(const pid of [0,-1,1.5,'1234',2147483648]){
      const {state}=stateFixture({fsOperations:{readFile:async()=>JSON.stringify({...valid,[field]:pid})}})
      assert.equal((await state.readTrainingControlState()).status,'corrupted_state')
    }
  }
})

test('training heartbeat rejects invalid process identities instead of presenting them as valid observations',async()=>{
  const valid={schemaVersion:'ai-painter-runtime-heartbeat-v1',heartbeatId:'private-heartbeat',timestampUtc:'2026-11-11T00:00:00Z',timestampLocal:'2026-11-11T08:00:00+08:00',timezone:'Asia/Shanghai',status:'training',activeTaskId:null,activeAction:null,activeModelRole:null,activeStep:null,activeScript:null,pid:1234,controllerPid:1234,childPid:null,lastOutputRef:null,source:'training_controller'}
  const good=stateFixture({fsOperations:{readFile:async()=>JSON.stringify(valid)}})
  assert.deepEqual(await good.state.readTrainingRuntimeHeartbeat(),valid)
  for(const field of ['pid','controllerPid','childPid'])for(const pid of [0,-1,1.5,'1234',2147483648]){
    const {state}=stateFixture({fsOperations:{readFile:async()=>JSON.stringify({...valid,[field]:pid})}})
    const result=await state.readTrainingRuntimeStatus()
    assert.equal(result.statusSource,'corrupted_runtime_heartbeat');assert.equal(result.heartbeat,null)
  }
})

test('training ledger retains genuine empty/missing and valid journal observations',async()=>{
  for(const journal of [undefined,'','\n',JSON.stringify(event)+'\n']){
    const {state}=stateFixture({journal}),result=await state.readTrainingProcessLedger()
    assert.equal(result.integrityStatus,'complete')
    assert.equal(result.integrityError,null)
    assert.equal(result.summary.total,journal?.includes('private-event')?1:0)
  }
})

test('zero-event journal query retains summary and integrity checks without returning all events',async()=>{
  const {state}=stateFixture({journal:JSON.stringify(event)+'\n'}),result=await state.readTrainingProcessLedger(0)
  assert.deepEqual(result.events,[])
  assert.equal(result.summary.total,1);assert.deepEqual(result.summary.lastEvent,event)
  assert.equal(result.updatedAt,event.timestamp);assert.equal(result.integrityStatus,'complete')
  const broken=stateFixture({journal:JSON.stringify(event)+'\n{truncated'})
  assert.equal((await broken.state.readTrainingProcessLedger(0)).integrityStatus,'degraded')
})

test('indexed and journal event limits agree while retaining complete summaries',async()=>{
  const rows=Array.from({length:3},(_,i)=>({...event,id:'event-'+i,timestamp:`2026-11-11T00:00:0${i}Z`}))
  let opened=0,closed=0
  const catalog=loadCatalog(class {
    constructor(){opened++;this.db=new DatabaseSync(':memory:');this.db.exec('CREATE TABLE program_events(status TEXT,timestamp_utc TEXT,event_json TEXT)');const insert=this.db.prepare('INSERT INTO program_events VALUES(?,?,?)');for(const row of rows)insert.run(row.status,row.timestamp,JSON.stringify(row))}
    exec(sql){this.db.exec(sql)}
    prepare(sql){return this.db.prepare(sql)}
    close(){this.db.close();closed++}
  })
  for(const limit of [0,1,2,3,80,Number.MAX_SAFE_INTEGER]){
    const indexed=catalog.readIndexedTrainingProcessLedger(limit)
    const {state}=stateFixture({journal:rows.map(row=>JSON.stringify(row)).join('\n')}),fallback=await state.readTrainingProcessLedger(limit)
    assert.deepEqual(fallback,indexed,'limit='+limit)
    assert.equal(indexed.summary.total,3);assert.deepEqual(indexed.summary.lastEvent,rows[2])
    assert.equal(indexed.events.length,Math.min(limit,3))
  }
  assert.equal(opened,6);assert.equal(closed,6)
})

test('invalid event limits reject before opening SQLite instead of selecting unlimited or partial rows',async()=>{
  let opened=0
  const catalog=loadCatalog(class {constructor(){opened++};exec(){};close(){}})
  const {state,reads}=stateFixture({journal:JSON.stringify(event),indexedReader:catalog.readIndexedTrainingProcessLedger})
  for(const limit of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'2',null]){
    assert.throws(()=>catalog.readIndexedTrainingProcessLedger(limit),error=>error instanceof RangeError&&error.message==='training_ledger_limit_invalid')
    await assert.rejects(()=>state.readTrainingProcessLedger(limit),error=>error instanceof RangeError&&error.message==='training_ledger_limit_invalid')
  }
  assert.equal(opened,0);assert(!reads.some(file=>file.endsWith('events.jsonl')))
})

function memoryWriter({failurePhase=null,indexResult=true}={}) {
  const files=new Map(),operations=[],indexedEvents=[],failure=Object.assign(Error('private write failure'),{code:'EIO'})
  const {state}=stateFixture({uuid:()=> 'private-write-identity',recordEvent:value=>{operations.push('index');indexedEvents.push(value);return indexResult},fsOperations:{
    mkdir:async()=>{},
    open:async(file,mode)=>{
      const handle={file,closed:false,synced:false}
      operations.push(['open',file,mode])
      if(mode==='wx')assert(!files.has(file))
      files.set(file,files.get(file)??Buffer.alloc(0))
      return {
        write:async bytes=>{files.set(file,Buffer.concat([files.get(file),bytes.subarray(0,2)]));return {bytesWritten:2,buffer:bytes}},
        writeFile:async bytes=>{
          operations.push(['writeFile',file])
          if(failurePhase==='writeFile')throw failure
          files.set(file,Buffer.concat([files.get(file),bytes]))
        },
        sync:async()=>{if(failurePhase==='sync')throw failure;handle.synced=true;operations.push(['sync',file])},
        close:async()=>{handle.closed=true;operations.push(['close',file])},
      }
    },
    readFile:async file=>{if(!files.has(file))throw Object.assign(Error('absent'),{code:'ENOENT'});return files.get(file).toString('utf8')},
    rename:async(from,to)=>{operations.push(['rename',from,to]);files.set(to,files.get(from));files.delete(from)},
    rm:async file=>{operations.push(['rm',file]);files.delete(file)},
  }})
  return {state,files,operations,indexedEvents,failure}
}

test('training event identity and time belong to the writer, not extra caller properties',async()=>{
  const f=memoryWriter()
  const written=await f.state.appendTrainingProcessEvent({...event,id:'caller-forged',timestamp:'1900-01-01T00:00:00Z'})
  assert.equal(written.id,'private-write-identity')
  assert.notEqual(written.timestamp,'1900-01-01T00:00:00Z')
  assert(Number.isFinite(Date.parse(written.timestamp)))
  assert.deepEqual(f.indexedEvents,[written])
  assert.deepEqual(JSON.parse(f.files.get(f.state.trainingProcessLedgerPath).toString()),written)
})

test('invalid training event payloads never enter the journal, index or latest projection',async()=>{
  for(const invalid of [{status:'invalid'},{runId:null},{kind:42},{title:[]}]){
    const f=memoryWriter(),prior=Buffer.from('prior latest')
    f.files.set(f.state.trainingProcessLedgerLatestPath,prior)
    assert.equal(await f.state.appendTrainingProcessEvent({...event,...invalid}),null)
    assert.equal(f.files.has(f.state.trainingProcessLedgerPath),false)
    assert.deepEqual(f.indexedEvents,[])
    assert.deepEqual(f.files.get(f.state.trainingProcessLedgerLatestPath),prior)
    const marker=JSON.parse(f.files.get(f.state.trainingProcessLedgerDegradedPath).toString())
    assert.equal(marker.error,'training_ledger_event_invalid')
  }
})

test('training journal and index use the same validated serialized event',async()=>{
  const bad=memoryWriter()
  assert.equal(await bad.state.appendTrainingProcessEvent({...event,toJSON(){return {...event,id:'serialized-forgery'}}}),null)
  assert.equal(bad.files.has(bad.state.trainingProcessLedgerPath),false)
  assert.deepEqual(bad.indexedEvents,[])
  const good=memoryWriter()
  const written=await good.state.appendTrainingProcessEvent({...event,toJSON(){return {...event,id:this.id,timestamp:this.timestamp,title:'serialized-title'}}})
  assert(written);assert.equal(written.title,'serialized-title')
  assert.equal('toJSON' in written,false)
  assert.deepEqual(good.indexedEvents,[written])
  assert.deepEqual(JSON.parse(good.files.get(good.state.trainingProcessLedgerPath).toString()),written)
})

test('atomic training state stores the complete JSON before sync, close and rename despite short-write handles',async()=>{
  const f=memoryWriter(),value={status:'idle',action:null,currentStep:null,startedAt:null,finishedAt:null,error:null}
  await f.state.writeTrainingControlState(value)
  assert.deepEqual(JSON.parse(f.files.get(f.state.trainingControlStatePath).toString()),value)
  assert.deepEqual(f.operations.filter(Array.isArray).map(row=>row[0]),['open','writeFile','sync','close','rename'])
})

test('training event journal is complete before indexing and latest projection',async()=>{
  const f=memoryWriter(),{id,timestamp,...input}=event;void id;void timestamp
  const written=await f.state.appendTrainingProcessEvent(input)
  assert(written)
  assert.deepEqual(JSON.parse(f.files.get(f.state.trainingProcessLedgerPath).toString()),written)
  const index=f.operations.indexOf('index')
  assert(index>0)
  assert.deepEqual(f.operations[index-1],['close',f.state.trainingProcessLedgerPath])
  const latest=JSON.parse(f.files.get(f.state.trainingProcessLedgerLatestPath).toString())
  assert.equal(latest.summary.total,1)
  assert.equal(latest.integrityStatus,'complete')
})

test('rejected training event indexing preserves the journal and prior projection and records degradation',async()=>{
  const f=memoryWriter({indexResult:false}),prior=Buffer.from('prior projection'),{id,timestamp,...input}=event;void id;void timestamp
  f.files.set(f.state.trainingProcessLedgerLatestPath,prior)
  assert.equal(await f.state.appendTrainingProcessEvent(input),null)
  const written=JSON.parse(f.files.get(f.state.trainingProcessLedgerPath).toString())
  assert.equal(written.id,'private-write-identity');assert.equal(written.title,event.title)
  assert.deepEqual(f.files.get(f.state.trainingProcessLedgerLatestPath),prior)
  const marker=[...f.files.entries()].find(([file])=>file.endsWith('degraded.json'))
  assert(marker)
  const degraded=JSON.parse(marker[1].toString())
  assert.equal(degraded.eventId,written.id);assert.equal(degraded.error,'training_ledger_index_unavailable')
  const observed=await f.state.readTrainingProcessLedger()
  assert.equal(observed.integrityStatus,'degraded');assert.equal(observed.summary.total,1)
})

test('training state write and sync failures preserve the original target and close the temporary handle',async()=>{
  for(const failurePhase of ['writeFile','sync']){
    const f=memoryWriter({failurePhase}),original=Buffer.from('original state')
    f.files.set(f.state.trainingControlStatePath,original)
    await assert.rejects(f.state.writeTrainingControlState({status:'idle'}),error=>error===f.failure)
    assert.deepEqual(f.files.get(f.state.trainingControlStatePath),original)
    assert(f.operations.some(row=>Array.isArray(row)&&row[0]==='close'))
    assert(!f.operations.some(row=>Array.isArray(row)&&['rename','rm'].includes(row[0])))
    assert.equal(f.files.size,2,'failed temporary evidence remains available')
  }
})

test('malformed or unreadable training journal is degraded instead of a complete empty ledger',async()=>{
  for(const journal of ['{broken',JSON.stringify(event)+'\n{truncated', 'null\n','[]\n','{"status":"not-a-status"}\n',Object.assign(Error('private permission failure'),{code:'EACCES'})]){
    const {state}=stateFixture({journal}),result=await state.readTrainingProcessLedger()
    assert.equal(result.integrityStatus,'degraded')
    assert.match(result.integrityError,/^training_ledger_/)
    assert.deepEqual(result.events,[])
  }
})

test('unreadable or invalid degraded markers cannot erase a known integrity problem',async()=>{
  for(const marker of ['{broken','null','[]','{}',Object.assign(Error('private IO failure'),{code:'EIO'})]){
    const {state}=stateFixture({journal:JSON.stringify(event),marker}),result=await state.readTrainingProcessLedger()
    assert.equal(result.integrityStatus,'degraded')
    assert.match(result.integrityError,/^training_ledger_/)
    assert.equal(result.summary.total,1)
  }
})

test('indexed integrity failures survive the training ledger adapter',async()=>{
  const indexed={schemaVersion:'ai-painter-training-process-ledger-v1',updatedAt:event.timestamp,events:[event],summary:{...emptySummary,total:2,success:2,lastEvent:event},integrityStatus:'degraded',integrityError:'training_ledger_index_event_invalid'}
  const {state,reads}=stateFixture({indexed}),result=await state.readTrainingProcessLedger()
  assert.equal(result.integrityStatus,'degraded')
  assert.equal(result.integrityError,'training_ledger_index_event_invalid')
  assert.equal(result.summary.total,2)
  assert.deepEqual(result.events,[event])
  assert(!reads.some(file=>file.endsWith('events.jsonl')))
})

for(const limit of [0,80])for(const [label,lastEvent]of [
  ['malformed',{}],['invalid status',{...event,status:'not-a-status'}],['missing',null],
])test(`indexed summary rejects ${label} latest event with limit ${limit}`,async()=>{
  const indexed={schemaVersion:'ai-painter-training-process-ledger-v1',updatedAt:event.timestamp,
    events:limit===0?[]:[event],summary:{...emptySummary,total:2,success:2,lastEvent},
    integrityStatus:'complete',integrityError:null}
  const original=structuredClone(indexed),{state,reads}=stateFixture({indexed})
  const result=await state.readTrainingProcessLedger(limit)
  assert.equal(result.integrityStatus,'degraded')
  assert.equal(result.integrityError,'training_ledger_event_invalid')
  assert.equal(result.summary.lastEvent,null)
  assert.equal(result.summary.total,2)
  assert.equal(result.updatedAt,event.timestamp)
  assert.deepEqual(result.events,limit===0?[]:[event])
  assert.deepEqual(indexed,original,'projection must not mutate indexed evidence')
  assert(!reads.some(file=>file.endsWith('events.jsonl')),'invalid indexed evidence is not replaced by journal fallback')
})

test('invalid indexed latest event does not hide an existing degradation reason',async()=>{
  const indexed={schemaVersion:'ai-painter-training-process-ledger-v1',updatedAt:event.timestamp,
    events:[],summary:{...emptySummary,total:1,success:1,lastEvent:{}},
    integrityStatus:'degraded',integrityError:'training_ledger_index_event_invalid'}
  const {state}=stateFixture({indexed}),result=await state.readTrainingProcessLedger(0)
  assert.equal(result.integrityStatus,'degraded')
  assert.equal(result.integrityError,indexed.integrityError)
  assert.equal(result.summary.lastEvent,null)
})

test('catalog retains valid rows, reports invalid JSON or statuses and closes its readonly database',()=>{
  for(const [invalid,status] of [[null,'success'],['{broken','success'],['null','success'],['[]','success'],[null,'toString'],[null,'unexpected']]){
    let closes=0
    const second={...event,id:'second-event'},payload=invalid??JSON.stringify(second)
    const catalog=load('src/server/ai-pet-world-storage-catalog.ts',id=>{
      if(id==='node:path')return path
      if(id==='node:fs/promises')return {}
      if(id==='@/server/ai-pet-world-storage')return {aiPetWorldCatalogPath:'private-catalog'}
      if(id==='node:module')return {createRequire:()=>name=>{
        assert.equal(name,'node:sqlite')
        return {DatabaseSync:class {
          constructor(file,options){assert.equal(file,'private-catalog');assert.equal(options.readOnly,true)}
          exec(sql){assert(['PRAGMA busy_timeout=5000','BEGIN','COMMIT'].includes(sql))}
          close(){closes++}
          prepare(sql){return {
            all:()=>sql.includes('GROUP BY')?[{status,count:2}]:[{event_json:JSON.stringify(event)},{event_json:payload}],
            get:()=>sql.includes('COUNT(*)')?{count:2}:{timestamp_utc:event.timestamp,event_json:payload},
          }}
        }}
      }}
      throw Error('unexpected dependency '+id)
    })
    const result=catalog.readIndexedTrainingProcessLedger()
    assert.equal(result.integrityStatus,invalid||status!=='success'?'degraded':'complete')
    assert.equal(result.integrityError,invalid?'training_ledger_index_event_invalid':status!=='success'?'training_ledger_index_status_invalid':null)
    assert.deepEqual(result.events,invalid?[event]:[event,second])
    assert.equal(result.summary.total,2)
    assert.deepEqual(result.summary.lastEvent,invalid?null:second)
    assert.equal(Object.hasOwn(result.summary,'toString'),false)
    assert.equal(closes,1)
  }
})
