import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {spawn,spawnSync} from 'node:child_process'
import {LOOP_EVIDENCE,LOOP_EXECUTION_EVIDENCE,LOOP_CONTRACT_SHA,loopSha,matrixSha,parseLoopJson,privateRunPath,validateLoopOutput,makeLoopModelInput,stopLoopChildTree,fixedLoopInterpreter,validateLoopInterpreterIdentity,writeLoopExclusiveBytes,writeLoopRecord,fixedLoopExecution,validateLoopDeadline} from '../lib/natural-world-evolution-loop.mjs'
const c=JSON.parse(fs.readFileSync(LOOP_EVIDENCE+'/experiment-contract.json','utf8'))
const values=Array.from({length:7},()=>[0.05,60,25,2])
const encode=v=>Buffer.from(JSON.stringify(v))
const testRun=String(Date.now())+'-'+process.pid
fs.mkdirSync(LOOP_EXECUTION_EVIDENCE+'/runtime-delivery',{recursive:true})
function pair(){const input={mode:'primary',window:{values}},inputRaw=encode(input),o={schemaVersion:c.outputContract.schemaVersion,taskId:c.taskId,contractSha256:LOOP_CONTRACT_SHA,mode:'primary',inputBytesSha256:loopSha(inputRaw),featureValueSha256:matrixSha(values),checkpointSha256:c.checkpoint.sha256,values:[0.0000048255,59,25.4,1.4],fieldOrder:c.fieldOrder,units:c.units,pid:12345,startedAtUtc:'2026-10-30T01:00:00.010Z',finishedAtUtc:'2026-10-30T01:00:00.020Z',elapsedSeconds:0.01,modelForwardRuns:1,trainingUpdates:0,worldWrites:0,productionReady:false};const observation={pid:12345,exitCode:0,signal:null,failure:null,startedAtUtc:'2026-10-30T01:00:00.000Z',finishedAtUtc:'2026-10-30T01:00:00.030Z',stdout:JSON.stringify(o)};return {input,inputRaw,o,observation}}
test('pure synthetic output validator does not execute or qualify a model',()=>{const p=pair();assert.deepEqual(validateLoopOutput(c,p.input,p.inputRaw,encode(p.o),p.observation),p.o)})
for(const [label,change] of [['extra field',o=>o.extra=true],['wrong input',o=>o.inputBytesSha256='0'.repeat(64)],['wrong matrix',o=>o.featureValueSha256='0'.repeat(64)],['wrong checkpoint',o=>o.checkpointSha256='0'.repeat(64)],['wrong units',o=>o.units[0]='C'],['RH outside guard',o=>o.values[1]=101],['wrong pid',o=>o.pid=12346],['wrong output origin',o=>o.modelForwardRuns=0],['production self claim',o=>o.productionReady=true],['wrong time',o=>o.startedAtUtc='2026-10-30T00:59:59.000Z'],['noncanonical UTC',o=>o.finishedAtUtc='2026-10-30T01:00:00.020+00:00']]){
  test('rejects '+label,()=>{const p=pair();p.o=structuredClone(p.o);change(p.o);p.observation.stdout=JSON.stringify(p.o);assert.throws(()=>validateLoopOutput(c,p.input,p.inputRaw,encode(p.o),p.observation),/world_loop_/)})
}
test('actual process output and parsed receipt must match',()=>{const p=pair();p.observation.stdout='{}';assert.throws(()=>validateLoopOutput(c,p.input,p.inputRaw,encode(p.o),p.observation),/actual_output/)})
test('failed child cannot be declared successful using valid stdout',()=>{const p=pair();p.observation.exitCode=1;assert.throws(()=>validateLoopOutput(c,p.input,p.inputRaw,encode(p.o),p.observation),/actual_output/)})
test('duplicate JSON keys, nonfinite, trailing text and excessive bytes reject',()=>{for(const text of ['{"x":1,"x":2}','{"x":1e999}','{} true','{"x":NaN}'])assert.throws(()=>parseLoopJson(Buffer.from(text)));assert.throws(()=>parseLoopJson(Buffer.alloc(65537)))})
test('feature hash is explicit float64 LE and reacts to exact lag row change',()=>{const b=Buffer.alloc(224);values.flat().forEach((v,i)=>b.writeDoubleLE(v,8*i));assert.equal(matrixSha(values),loopSha(b));const changed=structuredClone(values);changed[5][1]++;assert.notEqual(matrixSha(changed),matrixSha(values));assert.throws(()=>matrixSha([[1,2,3,4]]))})
test('private path cannot reach actual Store, parent traversal or arbitrary run',()=>{assert.equal(privateRunPath(LOOP_EVIDENCE+'/run-'+'a'.repeat(32)),LOOP_EVIDENCE+'/run-'+'a'.repeat(32));for(const p of ['data/world-runtime',LOOP_EVIDENCE+'/run-a',LOOP_EVIDENCE+'/run-'+'a'.repeat(32)+'/../x',LOOP_EVIDENCE+'/runs/run-'+'a'.repeat(32)])assert.throws(()=>privateRunPath(p),/private_run/)})
test('all three step/probe input protocols preflight with Python parser only, zero model calls',()=>{
  const run=LOOP_EVIDENCE+'/run-'+'a'.repeat(32),ids=['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId'],id=Object.fromEntries(ids.map(k=>[k,'integration158-'+k.toLowerCase()+'-'+'a'.repeat(32)])),archive=JSON.parse(fs.readFileSync(c.archiveBindings[0].path,'utf8'))
  const seed=c.seedDates.map(date=>c.fieldOrder.map(field=>archive.properties.parameter[field][date])),examples=[]
  for(let tick=0;tick<3;tick++){
    const start=Date.parse(c.simulationEpochUtc)+tick*86400000,rows=[...seed.slice(tick),...Array.from({length:tick},()=>[0.000004825542730548925,59.556380140742235,25.412132169452057,1.473194755809901])]
    const provenance=rows.map((_,i)=>{const t=start-(7-i)*86400000,archival=t<Date.parse(c.simulationEpochUtc);return {origin:archival?'external_archival_context':'committed_fixture_event',sourceRef:archival?c.archiveBindings[0]:{path:run+'/store/'+id.ownerId+'/'+id.worldId+'.json.evolution/'+'b'.repeat(64)+'.'+'c'.repeat(64)+'.event.json',sha256:'d'.repeat(64)},periodStartUtc:new Date(t).toISOString(),periodEndUtc:new Date(t+86400000).toISOString(),note:'Protocol-only fixture; not real model output or committed event evidence.'}})
    examples.push(makeLoopModelInput(c,id,{tick,stateVersion:tick,eventCursor:tick,fileSha256:'e'.repeat(64),recordContentSha256:'f'.repeat(64)},{logicalStartUtc:new Date(start).toISOString(),logicalEndUtc:new Date(start+86400000).toISOString(),durationSeconds:86400},rows,provenance))
  }
  for(const mode of ['history_probe','metadata_probe']){const p=structuredClone(examples[2]);p.mode=mode;if(mode==='history_probe')p.window.values[5][1]++;else p.provenance[0].note+=' Irrelevant control.';examples.push(p)}
  const code="import json,sys,importlib.util\ns=importlib.util.spec_from_file_location('worker','ml/ai-painter/scripts/world_environment_loop_forward.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nm.load_model=lambda *_: (_ for _ in ()).throw(AssertionError('No model load permitted'))\nc=m.read_contract();values=json.loads(sys.stdin.buffer.read());out=[]\nfor item in values:\n v=m.validate_input(json.dumps(item,separators=(',',':')).encode(),c);out.append(m.feature_value_sha(v['window']['values']))\nprint(json.dumps({'count':len(out),'featureHashes':out,'modelForwards':0,'modelLoads':0}))"
  const r=spawnSync(path.resolve('ml/ai-painter/.venv/Scripts/python.exe'),['-X','utf8','-B','-c',code],{input:encode(examples),encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:65536});assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.count,5);assert.deepEqual(result.featureHashes,examples.map(x=>matrixSha(x.window.values)));assert.equal(result.modelForwards,0)
  fs.writeFileSync(LOOP_EXECUTION_EVIDENCE+'/runtime-delivery/protocol-preflight-v2-'+testRun+'.json',JSON.stringify({atUtc:new Date().toISOString(),scope:'Parser protocol fixture only, not Store or model evidence',examples,result},null,2)+'\n')
})
test('owned process tree cleanup terminates only a spawned private Node family, no model', {timeout:15000},async()=>{
  assert.throws(()=>stopLoopChildTree({pid:process.pid,kill(){},once(){}}),/owned_child_handle/)
  const code="const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});console.log(JSON.stringify({parent:process.pid,child:c.pid}));setInterval(()=>{},1000)"
  const cp=spawn(process.execPath,['-e',code],{stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'}),closed=new Promise(resolve=>cp.once('close',(code,signal)=>resolve({code,signal})))
  let data='';const ids=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('private cleanup readiness timeout')),3000);cp.stdout.on('data',b=>{data+=b;if(data.includes('\n')){clearTimeout(timer);resolve(JSON.parse(data))}})})
  const cleanup=stopLoopChildTree(cp);await closed
  const alive=pid=>{try{process.kill(pid,0);return true}catch(e){if(e.code==='ESRCH')return false;throw e}}
  for(let i=0;i<30&&alive(ids.child);i++)await new Promise(r=>setTimeout(r,50))
  assert.equal(alive(ids.parent),false);assert.equal(alive(ids.child),false);assert.notEqual(cleanup.status,'tree_stop_unconfirmed')
  fs.writeFileSync(LOOP_EXECUTION_EVIDENCE+'/runtime-delivery/process-tree-cleanup-test-v2-'+testRun+'.json',JSON.stringify({atUtc:new Date().toISOString(),ids,cleanup,parentAlive:false,childAlive:false,modelProcesses:0},null,2)+'\n')
})
test('fixed direct bootstrap identity is actual spawned PID, zero forwards; mismatch rejects',()=>{
  const c=fixedLoopInterpreter(),r=spawnSync(c.directInterpreter.path,[...c.args,'ml/ai-painter/scripts/world_environment_loop_bootstrap.py','--identity-check'],{encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:65536})
  assert.equal(r.status,0,r.stderr)
  const observation={pid:r.pid,exitCode:r.status,signal:r.signal,failure:null,stdout:r.stdout},output=validateLoopInterpreterIdentity(Buffer.from(r.stdout),observation)
  assert.equal(output.pid,r.pid);assert.equal(output.modelForwardRuns,0)
  assert.throws(()=>validateLoopInterpreterIdentity(Buffer.from(r.stdout),{...observation,pid:r.pid+1}),/interpreter_pid/)
  const bad={...output,executable:'C:/arbitrary/python.exe'}
  assert.throws(()=>validateLoopInterpreterIdentity(encode(bad),{...observation,stdout:JSON.stringify(bad)}),/interpreter_identity/)
  fs.writeFileSync(LOOP_EXECUTION_EVIDENCE+'/runtime-delivery/interpreter-preflight-v2-'+testRun+'.json',JSON.stringify({atUtc:new Date().toISOString(),observation,output,modelForwards:0},null,2)+'\n',{flag:'wx'})
})
test('exclusive replacement file primitive refuses second attempt and preserves original bytes',()=>{
  const p=LOOP_EXECUTION_EVIDENCE+'/runtime-delivery/exclusive-reservation-test-'+testRun+'.json',bytes=encode({testOnly:true,modelForwards:0})
  writeLoopExclusiveBytes(p,bytes)
  assert.throws(()=>writeLoopExclusiveBytes(p,encode({overwritten:true})),{code:'EEXIST'})
  assert.deepEqual(fs.readFileSync(p),bytes)
})
test('all fixed forward modes persist every record through the actual runner write path, zero model',()=>{
  const directory=LOOP_EXECUTION_EVIDENCE+'/runtime-delivery/write-path-test-'+testRun
  fs.mkdirSync(directory)
  for(const mode of ['primary','history_probe','metadata_probe']){
    for(const suffix of ['identity-process','identity','attempt','input','process','output']){
      const name='forward-3-'+mode+'.'+suffix+'.json',payload={testOnly:true,mode,suffix,modelForwards:0},ref=writeLoopRecord(directory,name,payload),raw=fs.readFileSync(ref.path)
      assert.equal(ref.sha256,loopSha(raw));assert.equal(ref.bytes,raw.length);assert.deepEqual(JSON.parse(raw),payload)
      assert.throws(()=>writeLoopRecord(directory,name,{changed:true}),{code:'EEXIST'})
    }
  }
  assert.equal(fs.readdirSync(directory).length,18)
  for(const name of ['../escape.json','x/../escape.json','x\\..\\escape.json','C:/escape.json','/escape.json','.','..','','forward-3-history_probe.json/escape'])assert.throws(()=>writeLoopRecord(directory,name,{}),/output_name/)
  for(const unsafe of [directory+'/../escape',directory+'\\escape','C:/escape'])assert.throws(()=>writeLoopRecord(unsafe,'valid.json',{}),/world_loop_path/)
  assert.equal(fs.readdirSync(directory).length,18)
})
test('159 fixed execution binds immutable scope and preserves reservation presence and bytes',()=>{
  const reservationPath=LOOP_EXECUTION_EVIDENCE+'/execution-reservation.json',beforeExists=fs.existsSync(reservationPath),beforeBytes=beforeExists?fs.readFileSync(reservationPath):null
  const {contract:e}=fixedLoopExecution()
  assert.equal(e.taskId,'WORLD-EVOLUTION-VERIFICATION-159');assert.equal(c.taskId,'WORLD-EVOLUTION-LOOP-158')
  assert.equal(e.previousActualModelForwards,4);assert.equal(e.budget.newModelForwardsMaximum,5);assert.equal(e.budget.cumulativeModelForwardsMaximum,9)
  assert.equal(e.reservationPath,LOOP_EXECUTION_EVIDENCE+'/execution-reservation.json')
  assert.notEqual(e.reservationPath,e.priorReservations[0].path)
  for(const ref of [e.alignment,e.priorActualAcceptance,e.repairReview,...e.priorReservations])assert.equal(loopSha(fs.readFileSync(ref.path)),ref.sha256)
  assert.equal(fs.existsSync(e.reservationPath),beforeExists,'read-only preparation must preserve reservation presence')
  if(beforeExists)assert.deepEqual(fs.readFileSync(e.reservationPath),beforeBytes)
})
test('fixed180second execution boundary rejects elapsed, future, enlarged and invalid time windows',()=>{
  const start='2026-10-30T08:00:00.000Z',end='2026-10-30T08:03:00.000Z',time=Date.parse(start)
  validateLoopDeadline(start,end,time);validateLoopDeadline(start,end,time+179999)
  for(const current of [time-1,time+180000,NaN,Infinity])assert.throws(()=>validateLoopDeadline(start,end,current),/manifest_deadline/)
  for(const bad of ['2026-10-30T08:03:00Z','2026-10-30T08:03:00.000+00:00','2026-02-30T08:03:00.000Z'])assert.throws(()=>validateLoopDeadline(start,bad,time),/manifest_time/)
  assert.throws(()=>validateLoopDeadline(start,'2026-10-30T08:03:00.001Z',time),/manifest_deadline/)
})
