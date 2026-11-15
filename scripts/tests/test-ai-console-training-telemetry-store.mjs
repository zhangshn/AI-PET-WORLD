import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync, realpathSync, lstatSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/server/ai-console-observability/training-telemetry-store.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
const { recordAiConsoleTrainingTelemetry, readLatestAiConsoleTrainingTelemetry } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`)
const runId = 'mvp-v18-dry-stage0-6061ccf56942a9bfaec776761e5ec30f6bf52629cd871898'
const input = {
  runId, executionId: 'execution-v18-1', processId: 17704,
  trainingStage: 'dry_single_world_256x192', epoch: 20, batchIndex: 2, batchCount: 50,
  optimizationStep: 962, loss: 0.25, learningRate: 0.0001,
  throughputSamplesPerSecond: 1.5, estimatedCompletionAtUtc: null,
  checkpointIdentity: null, heartbeatAtUtc: new Date().toISOString(),
  reporterIdentity: 'local_training_reporter_v1',
}

function privateStore(t) {
  const parent = realpathSync(tmpdir()), directory = mkdtempSync(path.join(parent, 'ai-console-telemetry-test-'))
  t.after(() => {
    assert.equal(path.dirname(directory), parent)
    assert(path.basename(directory).startsWith('ai-console-telemetry-test-'))
    assert.equal(realpathSync(directory), directory)
    assert(!lstatSync(directory).isSymbolicLink())
    rmSync(directory, { recursive: true })
  })
  return path.join(directory, 'telemetry.sqlite')
}

test('isolated writer/read round-trip is independent of input property order; tampering fails closed', t => {
  const storePath = privateStore(t)
    const reversedInput = Object.fromEntries(Object.entries({ ...input, heartbeatAtUtc: new Date().toISOString() }).reverse())
    const written = recordAiConsoleTrainingTelemetry(reversedInput, { storePath })
    const read = readLatestAiConsoleTrainingTelemetry({ storePath })
    assert.equal(read.status, 'connected')
    assert.equal(read.latest?.sampleId, written.sampleId)
    assert.equal(read.latest?.runId, runId)
    const database = new DatabaseSync(storePath)
    try { database.prepare('UPDATE training_telemetry SET loss = ? WHERE sample_sequence = ?').run(0.75, written.sampleSequence) }
    finally { database.close() }
    const tampered = readLatestAiConsoleTrainingTelemetry({ storePath })
    assert.equal(tampered.status, 'unknown_or_stale')
    assert.equal(tampered.reasonCode, 'ai_console_training_telemetry_record_integrity_failed')
})

test('future telemetry is unavailable while retaining the original hashed sample and source revision', t => {
  const now = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  t.mock.method(Date, 'now', () => now)
  const written = recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(now + 60000).toISOString() }, { storePath })
  const bytes = readFileSync(storePath), result = readLatestAiConsoleTrainingTelemetry({ storePath })
  assert.equal(result.status, 'unknown_or_stale')
  assert.equal(result.reasonCode, 'new_platform_training_telemetry_heartbeat_future')
  assert.deepEqual(result.latest, written)
  assert.equal(result.sourceRevision, written.sampleSequence)
  assert(readFileSync(storePath).equals(bytes))
})

test('telemetry retains zero age and its existing inclusive 15 second freshness boundary', t => {
  const now = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  t.mock.method(Date, 'now', () => now)
  for (const age of [0,14999,15000,15001]) {
    recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(now - age).toISOString() }, { storePath })
    const result = readLatestAiConsoleTrainingTelemetry({ storePath })
    assert.equal(result.status, age > 15000 ? 'unknown_or_stale' : 'connected')
    assert.equal(result.reasonCode, age > 15000 ? 'new_platform_training_telemetry_heartbeat_stale' : null)
  }
})

test('clock rollback makes telemetry unavailable and recovery does not rewrite its sample', t => {
  const initial = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  let now = initial
  t.mock.method(Date, 'now', () => now)
  const written = recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(initial).toISOString() }, { storePath })
  assert.equal(readLatestAiConsoleTrainingTelemetry({ storePath }).status, 'connected')
  now -= 1000
  assert.equal(readLatestAiConsoleTrainingTelemetry({ storePath }).reasonCode, 'new_platform_training_telemetry_heartbeat_future')
  now = initial
  const recovered = readLatestAiConsoleTrainingTelemetry({ storePath })
  assert.equal(recovered.status, 'connected'); assert.deepEqual(recovered.latest, written)
})

test('invalid stale durations cannot bypass telemetry freshness checks', t => {
  const now = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  t.mock.method(Date, 'now', () => now)
  recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(now - 60000).toISOString() }, { storePath })
  const bytes = readFileSync(storePath)
  for (const staleAfterMs of [NaN,Infinity,-Infinity,-1]) {
    const result = readLatestAiConsoleTrainingTelemetry({ storePath, staleAfterMs })
    assert.equal(result.status, 'unknown_or_stale')
    assert.equal(result.reasonCode, 'ai_console_training_telemetry_stale_after_invalid')
  }
  assert(readFileSync(storePath).equals(bytes))
})

test('a future timestamp does not bypass telemetry integrity verification', t => {
  const now = Date.parse('2026-11-12T00:00:00Z'), storePath = privateStore(t)
  t.mock.method(Date, 'now', () => now)
  const written = recordAiConsoleTrainingTelemetry({ ...input, heartbeatAtUtc: new Date(now + 60000).toISOString() }, { storePath })
  const database = new DatabaseSync(storePath)
  try { database.prepare('UPDATE training_telemetry SET loss = ? WHERE sample_sequence = ?').run(0.75, written.sampleSequence) }
  finally { database.close() }
  const result = readLatestAiConsoleTrainingTelemetry({ storePath })
  assert.equal(result.latest, null)
  assert.equal(result.reasonCode, 'ai_console_training_telemetry_record_integrity_failed')
})

test('unsafe and empty identities are rejected before opening a store', () => {
  const storePath = path.join(tmpdir(), 'ai-console-telemetry-never-created.sqlite')
  for (const invalid of ['', '../run', 'run/../../outside']) {
    assert.throws(() => recordAiConsoleTrainingTelemetry({ ...input, runId: invalid }, { storePath }), /run_id_invalid/)
  }
})

const telemetryCleanupCases=[
  ...['error','undefined','null','false'].map(value=>({phase:'initialize',mode:value+'-cleanup'})),
  {phase:'initialize',mode:'primary-only'},
  ...['begin','query','insert','commit'].map(phase=>({phase,mode:'error-cleanup'})),
  ...['undefined','null','false'].map(value=>({phase:'query',mode:value+'-cleanup'})),
  {phase:'query',mode:'primary-only'},{phase:'success',mode:'close-only'},{phase:'success',mode:'success'},
  ...['error','undefined','null','false'].map(value=>({phase:'read',mode:value+'-cleanup'})),
  {phase:'read',mode:'primary-only'},{phase:'read',mode:'close-only'},
]
for(const {phase,mode} of telemetryCleanupCases)test(`telemetry storage cleanup ${phase} ${mode}`,t=>{
  const storePath=path.join(mkdtempSync(path.join(tmpdir(),'telemetry-cleanup-')),'telemetry.sqlite')
  const value={...input,heartbeatAtUtc:new Date().toISOString()}
  if(phase!=='initialize')recordAiConsoleTrainingTelemetry(value,{storePath})
  const before=phase==='read'?readFileSync(storePath):null
  const primary=mode.startsWith('undefined')?undefined:mode.startsWith('null')?null:mode.startsWith('false')?false:Object.freeze(new Error('telemetry private operation'))
  const rollback=Object.freeze(new Error('telemetry rollback acknowledgement')),close=Object.freeze(new Error('telemetry close'))
  const injectPrimary=mode!=='success'&&mode!=='close-only',injectClose=mode!=='success'&&mode!=='primary-only'
  const exec=DatabaseSync.prototype.exec,prepare=DatabaseSync.prototype.prepare,closeDb=DatabaseSync.prototype.close
  let closes=0,rollbacks=0,caught,result,threw=false
  t.mock.method(DatabaseSync.prototype,'exec',function(sql){
    if(injectPrimary&&((phase==='initialize'&&sql.startsWith('PRAGMA busy_timeout'))||(phase==='begin'&&sql==='BEGIN IMMEDIATE')||(phase==='commit'&&sql==='COMMIT')))throw primary
    if(sql==='ROLLBACK'){rollbacks++;exec.call(this,sql);if(injectClose)throw rollback;return}
    return exec.call(this,sql)
  })
  t.mock.method(DatabaseSync.prototype,'prepare',function(sql){
    if(injectPrimary&&((phase==='query'&&sql.startsWith('SELECT COALESCE'))||(phase==='insert'&&sql.includes('INSERT INTO training_telemetry'))||(phase==='read'&&sql==='SELECT * FROM training_telemetry ORDER BY sample_sequence DESC LIMIT 1')))throw primary
    return prepare.call(this,sql)
  })
  t.mock.method(DatabaseSync.prototype,'close',function(){closes++;closeDb.call(this);if(injectClose)throw close})
  try{result=phase==='read'?readLatestAiConsoleTrainingTelemetry({storePath,staleAfterMs:60000}):recordAiConsoleTrainingTelemetry(value,{storePath})}catch(error){caught=error;threw=true}finally{t.mock.restoreAll()}
  assert.equal(closes,1)
  const shouldRollback=injectPrimary&&['query','insert','commit'].includes(phase)
  assert.equal(rollbacks,shouldRollback?1:0)
  if(mode==='success'){assert.equal(threw,false);assert.equal(result.sampleSequence,2)}
  else if(phase==='read'&&mode==='primary-only'){
    assert.equal(threw,false);assert.equal(result.status,'unknown_or_stale');assert.equal(result.latest,null)
    assert.equal(result.reasonCode,primary instanceof Error?primary.message:'ai_console_training_telemetry_read_failed')
  }else{
    assert.equal(threw,true)
    if(!injectPrimary)assert.equal(caught,close)
    else if(!injectClose)assert.equal(caught,primary)
    else{assert(caught instanceof AggregateError);assert.equal(caught.cause,primary);assert.deepEqual(caught.errors,[primary,...(shouldRollback?[rollback]:[]),close])}
  }
  if(before)assert(readFileSync(storePath).equals(before),'readonly telemetry bytes changed')
  if(phase!=='initialize'){
    const db=new DatabaseSync(storePath,{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) count FROM training_telemetry').get().count,phase==='success'?2:1)}finally{db.close()}
  }
  const next=recordAiConsoleTrainingTelemetry({...value,heartbeatAtUtc:new Date().toISOString()},{storePath})
  assert.equal(next.sampleSequence,phase==='initialize'?1:phase==='success'?3:2)
  const read=readLatestAiConsoleTrainingTelemetry({storePath,staleAfterMs:60000});assert.equal(read.status,'connected');assert.equal(read.latest.sampleId,next.sampleId)
})

test('telemetry storage cleanup preserves actual record-integrity rejection plus close error',t=>{
  const storePath=path.join(mkdtempSync(path.join(tmpdir(),'telemetry-integrity-cleanup-')),'telemetry.sqlite')
  recordAiConsoleTrainingTelemetry({...input,heartbeatAtUtc:new Date().toISOString()},{storePath})
  const db=new DatabaseSync(storePath);try{db.exec("UPDATE training_telemetry SET record_sha256='tampered'")}finally{db.close()}
  const before=readFileSync(storePath),close=Object.freeze(new Error('close acknowledgement')),closeDb=DatabaseSync.prototype.close
  t.mock.method(DatabaseSync.prototype,'close',function(){closeDb.call(this);throw close})
  let caught;try{readLatestAiConsoleTrainingTelemetry({storePath})}catch(error){caught=error}finally{t.mock.restoreAll()}
  assert(caught instanceof AggregateError);assert.equal(caught.cause.message,'ai_console_training_telemetry_record_integrity_failed');assert.equal(caught.errors[0],caught.cause);assert.equal(caught.errors[1],close)
  assert(readFileSync(storePath).equals(before));assert.equal(readLatestAiConsoleTrainingTelemetry({storePath}).status,'unknown_or_stale')
})

for(const [field,value] of [['sampleId','caller-id'],['sampleSequence',777],['reportedAtUtc','2026-01-01T00:00:00Z'],['schemaVersion','caller-schema'],['recordSha256','caller-hash']]){
  test(`telemetry storage cleanup producer-owned ${field} cannot change committed records`,()=>{
    const storePath=path.join(mkdtempSync(path.join(tmpdir(),'telemetry-owned-fields-')),'telemetry.sqlite')
    const first=recordAiConsoleTrainingTelemetry({...input,heartbeatAtUtc:new Date().toISOString()},{storePath}),before=readFileSync(storePath)
    assert.throws(()=>recordAiConsoleTrainingTelemetry({...input,[field]:value},{storePath}),/ai_console_training_telemetry_input_fields_invalid/)
    assert(readFileSync(storePath).equals(before));const current=readLatestAiConsoleTrainingTelemetry({storePath,staleAfterMs:60000})
    assert.equal(current.status,'connected');assert.equal(current.latest.sampleId,first.sampleId);assert.equal(current.sourceRevision,1)
  })
}
test('telemetry storage cleanup rejects incomplete or noncontract input before creating a database',()=>{
  const missing={...input};delete missing.processId
  const hidden={...input};Object.defineProperty(hidden,'runId',{value:input.runId,enumerable:false})
  for(const candidate of [null,[],{},missing,Object.create(input),hidden,{...input,extra:'unbound'},Object.assign({...input},{[Symbol('unbound')]:true})]){
    const storePath=path.join(mkdtempSync(path.join(tmpdir(),'telemetry-invalid-input-')),'telemetry.sqlite')
    assert.throws(()=>recordAiConsoleTrainingTelemetry(candidate,{storePath}),/ai_console_training_telemetry_input_fields_invalid/)
    assert.throws(()=>readFileSync(storePath),{code:'ENOENT'})
  }
})
test('telemetry storage cleanup rejects accessors without evaluating caller code',()=>{
  let reads=0;const candidate={...input};Object.defineProperty(candidate,'runId',{enumerable:true,get(){reads++;return input.runId}})
  const storePath=path.join(mkdtempSync(path.join(tmpdir(),'telemetry-accessor-input-')),'telemetry.sqlite')
  assert.throws(()=>recordAiConsoleTrainingTelemetry(candidate,{storePath}),/ai_console_training_telemetry_input_fields_invalid/)
  assert.equal(reads,0);assert.throws(()=>readFileSync(storePath),{code:'ENOENT'})
})
test('telemetry storage cleanup accepts plain null-prototype data with producer identity intact',()=>{
  const storePath=path.join(mkdtempSync(path.join(tmpdir(),'telemetry-null-prototype-')),'telemetry.sqlite')
  const candidate=Object.assign(Object.create(null),input,{heartbeatAtUtc:new Date().toISOString()})
  const record=recordAiConsoleTrainingTelemetry(candidate,{storePath});assert.equal(record.sampleSequence,1)
  assert.match(record.sampleId,/^[a-f0-9]{64}$/);assert.equal(readLatestAiConsoleTrainingTelemetry({storePath}).latest.sampleId,record.sampleId)
})
