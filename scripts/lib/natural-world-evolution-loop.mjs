import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash,randomUUID} from 'node:crypto'
import {ChildProcess,spawn,spawnSync} from 'node:child_process'
import {baselineCanonical as canonical,baselineDigest as digest} from './natural-world-baseline-proof.mjs'
import {loadLoopRuntime,LOOP_RUNTIME_FILES} from '../tests/helpers/world-evolution-loop-loader.mjs'

export const LOOP_ROOT=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'))
export const LOOP_EVIDENCE='.runtime/ai-painter/controller-repair-reviews/world-evolution-loop-158-20261030'
export const LOOP_EXECUTION_EVIDENCE='.runtime/ai-painter/controller-repair-reviews/world-evolution-verification-159-20261030'
const EXECUTION_SHA='f2884fc2f0b385b5c79597269e48c95bc9d0ad7607696c1de683703ba3e5c46d'
const EXECUTION_TASK='WORLD-EVOLUTION-VERIFICATION-159'
export const LOOP_CONTRACT_SHA='822db6bd5daffdd438c9b2490b3e665a32c4cc6d52930135fbedae203a0ed526'
const HASH_CONTRACT_SHA='7de1f14a87a48386bed5110385fdba25984cc42d523b93e53c5fda380b7bfa56'
const CLI='scripts/run-natural-world-evolution-loop.mjs',WORKER='ml/ai-painter/scripts/world_environment_loop_forward.py'
const WORKER_SHA='0df00784d1a63a40e0cc25099ef5f5839003a3b4c4af4dc34ef8d3ed43855c62'
const BOOTSTRAP='ml/ai-painter/scripts/world_environment_loop_bootstrap.py'
const BOOTSTRAP_SHA='48ca6102803e5325db7b7b7ec3e908c96491d2c22f64fca53dfb0871bf8a6c3e'
const INTERPRETER_CONTRACT=LOOP_EVIDENCE+'/interpreter-contract-v2.json'
const INTERPRETER_SHA='316902480cc389b8d73df48fab6a314d5d1233d177f89937111d047c45f8a4d8'
const DIRECT_EXE='D:/DevCaches/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
const IDS=['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId']
const CODES=[CLI,'scripts/lib/natural-world-evolution-loop.mjs','scripts/tests/helpers/world-evolution-loop-loader.mjs',
  'scripts/lib/natural-world-baseline-proof.mjs',WORKER,...LOOP_RUNTIME_FILES.map(n=>'src/world/runtime/'+n)]
export const loopSha=b=>createHash('sha256').update(b).digest('hex')
const need=(v,why)=>{if(!v)throw Error('world_loop_'+why)}
const equal=(a,b)=>canonical(a)===canonical(b)
const exact=(v,keys)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&equal(Object.keys(v).sort(),[...keys].sort()),'fields')
const encoded=v=>Buffer.from(JSON.stringify(v,null,2)+'\n')
const idOf=r=>Object.fromEntries(IDS.map(k=>[k,r[k]]))
const iso=t=>new Date(t).toISOString()
const now=()=>new Date().toISOString()
const jsonRef=(id,sha256)=>({id,version:'private-loop-158-v1',sha256})
export function matrixSha(values){
  need(Array.isArray(values)&&values.length===7&&values.every(r=>Array.isArray(r)&&r.length===4&&r.every(x=>typeof x==='number'&&Number.isFinite(x))),'matrix')
  const b=Buffer.alloc(224);values.flat().forEach((v,i)=>b.writeDoubleLE(v,i*8));return loopSha(b)
}
export function parseLoopJson(raw,max=65536){
  need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=max,'json_budget')
  const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);let i=0
  const ws=()=>{while(i<text.length&&/[\t\n\r ]/.test(text[i]))i++}
  const str=()=>{const start=i++;let escape=false;while(i<text.length){const c=text[i++];if(!escape&&c==='"')return JSON.parse(text.slice(start,i));if(!escape&&c==='\\')escape=true;else escape=false}throw Error('world_loop_json_string')}
  const value=depth=>{need(depth<=64,'json_depth');ws();if(text[i]==='{'){i++;ws();const seen=new Set();if(text[i]==='}'){i++;return}while(i<text.length){ws();need(text[i]==='"','json');const key=str();need(!seen.has(key),'duplicate_key');seen.add(key);ws();need(text[i++]===':','json');value(depth+1);ws();const c=text[i++];if(c==='}')return;need(c===',','json')}}
    else if(text[i]==='['){i++;ws();if(text[i]===']'){i++;return}while(i<text.length){value(depth+1);ws();const c=text[i++];if(c===']')return;need(c===',','json')}}
    else if(text[i]==='"'){str();return}else{const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));need(m,'json');i+=m[0].length;return}throw Error('world_loop_json')}
  value(0);ws();need(i===text.length,'json_tail');const result=JSON.parse(text);canonical(result);return result
}
function safe(logical){
  need(typeof logical==='string'&&!/[\\:\0]/.test(logical)&&!logical.startsWith('/')&&logical.split('/').every(x=>x&&x!=='.'&&x!=='..'),'path')
  const base=logical.startsWith('.runtime/')?path.join(LOOP_ROOT,'.runtime'):LOOP_ROOT
  let cursor=base;for(const part of (logical.startsWith('.runtime/')?logical.slice(9):logical).split('/')){
    cursor=path.join(cursor,part);try{need(!fs.lstatSync(cursor).isSymbolicLink(),'path_link')}catch(e){if(e.code!=='ENOENT')throw e}
  }return cursor
}
function read(logical,max=4*1024*1024){
  const fd=fs.openSync(safe(logical),'r');try{const before=fs.fstatSync(fd);need(before.isFile()&&before.nlink===1&&before.size>0&&before.size<=max,'file_shape');const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd);need(bytes.length===before.size&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'read_changed');return bytes}finally{fs.closeSync(fd)}
}
function bind(p){const b=read(p);return {path:p,sha256:loopSha(b),bytes:b.length}}
function bound(ref,max=4*1024*1024){const b=read(ref.path,max);need(loopSha(b)===ref.sha256&&(ref.bytes===undefined||ref.bytes===b.length),'binding_changed');return b}
export function fixedLoopInterpreter(){
  const c=parseLoopJson(bound({path:INTERPRETER_CONTRACT,sha256:INTERPRETER_SHA}))
  need(c.directInterpreter.path===DIRECT_EXE&&c.worker.path===WORKER&&c.worker.sha256===WORKER_SHA&&c.venvConfig.path==='ml/ai-painter/.venv/pyvenv.cfg'&&c.sitePackages==='ml/ai-painter/.venv/Lib/site-packages'&&equal(c.args,['-I','-X','utf8','-B']),'interpreter_contract')
  let cursor=path.parse(DIRECT_EXE).root
  for(const segment of path.relative(cursor,DIRECT_EXE).split(path.sep)){cursor=path.join(cursor,segment);need(!fs.lstatSync(cursor).isSymbolicLink()&&path.resolve(fs.realpathSync(cursor)).toLowerCase()===path.resolve(cursor).toLowerCase(),'interpreter_link')}
  const fd=fs.openSync(DIRECT_EXE,'r');try{const before=fs.fstatSync(fd),b=fs.readFileSync(fd),after=fs.fstatSync(fd);need(before.isFile()&&before.nlink===1&&before.size===c.directInterpreter.bytes&&b.length===before.size&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&loopSha(b)===c.directInterpreter.sha256,'interpreter_changed')}finally{fs.closeSync(fd)}
  bound(c.venvConfig);bound(c.worker);bound({path:BOOTSTRAP,sha256:BOOTSTRAP_SHA});safe(c.sitePackages+'/torch/__init__.py')
  return c
}
export function validateLoopInterpreterIdentity(raw,observation){
  const c=fixedLoopInterpreter(),o=parseLoopJson(raw)
  exact(o,['schemaVersion','taskId','pid','executable','interpreterSha256','venvConfigSha256','workerSha256','sitePackages','torchOrigin','modelForwardRuns','trainingUpdates','worldWrites','productionReady'])
  const samePath=(a,b)=>typeof a==='string'&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase()
  need(o.schemaVersion==='world-environment-loop-interpreter-identity-v1'&&o.taskId==='WORLD-EVOLUTION-LOOP-158'&&o.pid===observation.pid&&Number.isSafeInteger(o.pid)&&o.pid>0,'interpreter_pid')
  need(samePath(o.executable,DIRECT_EXE)&&samePath(o.sitePackages,safe(c.sitePackages))&&samePath(o.torchOrigin,safe(c.sitePackages+'/torch/__init__.py'))&&o.interpreterSha256===c.directInterpreter.sha256&&o.venvConfigSha256===c.venvConfig.sha256&&o.workerSha256===WORKER_SHA,'interpreter_identity')
  need(o.modelForwardRuns===0&&o.trainingUpdates===0&&o.worldWrites===0&&o.productionReady===false&&observation.exitCode===0&&observation.signal===null&&observation.failure===null&&equal(parseLoopJson(Buffer.from(observation.stdout)),o),'interpreter_observation')
  return o
}
export function reserveLoopReplacement(run){
  privateRunPath(run);fixedLoopExecution()
  return write(LOOP_EXECUTION_EVIDENCE,'execution-reservation.json',{schemaVersion:'world-loop-execution-reservation-v1',run,reservedAtUtc:now(),executionTaskId:EXECUTION_TASK,protocolTaskId:'WORLD-EVOLUTION-LOOP-158',executionContractSha256:EXECUTION_SHA,alreadySpentModelForwards:4,additionalModelForwardsMaximum:5,taskCumulativeModelForwardsMaximum:9,meaning:'Exclusive new bounded verification, not production authorization.'})
}
export function fixedLoopExecution(){
  const e=parseLoopJson(bound({path:LOOP_EXECUTION_EVIDENCE+'/execution-contract.json',sha256:EXECUTION_SHA}))
  need(e.taskId===EXECUTION_TASK&&e.experimentContract.path===LOOP_EVIDENCE+'/experiment-contract.json'&&e.experimentContract.sha256===LOOP_CONTRACT_SHA&&e.alignment.path===LOOP_EXECUTION_EVIDENCE+'/task-alignment.json'&&e.alignment.sha256==='14ab942f7e4c8dc813ae380340e40eea2b74e491180bba528c7c0082af0f5f61'&&e.reservationPath===LOOP_EXECUTION_EVIDENCE+'/execution-reservation.json'&&e.previousActualModelForwards===4&&e.budget.newRunsMaximum===1&&e.budget.newModelForwardsMaximum===5&&e.budget.cumulativeModelForwardsMaximum===9&&e.budget.wallSeconds===180&&e.budget.workerSeconds===30,'execution_contract')
  for(const ref of [e.experimentContract,e.alignment,e.priorActualAcceptance,e.repairReview,...e.priorReservations])bound(ref)
  const alignment=parseLoopJson(bound(e.alignment));need(alignment.taskId===EXECUTION_TASK,'execution_alignment')
  return {contract:e,alignment}
}
export function validateLoopDeadline(start,end,current=Date.now()){
  for(const s of [start,end])need(typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&iso(Date.parse(s))===s,'manifest_time')
  need(Number.isFinite(current)&&Date.parse(end)-Date.parse(start)===180000&&current>=Date.parse(start)&&current<Date.parse(end),'manifest_deadline')
}
export function writeLoopExclusiveBytes(filename,bytes){const fd=fs.openSync(filename,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
export function writeLoopRecord(run,name,v){need(/^[a-z0-9][a-z0-9._-]*$/i.test(name),'output_name');const p=run+'/'+name,b=encoded(v);need(b.length<=4*1024*1024,'output_bytes');writeLoopExclusiveBytes(safe(p),b);return bind(p)}
const write=writeLoopRecord
export function privateRunPath(run){need(typeof run==='string'&&new RegExp('^'+LOOP_EVIDENCE.replaceAll('.','\\.')+'/run-[a-f0-9]{32}$').test(run),'private_run');safe(run);return run}
function identity(run){const token=run.split('/').at(-1).slice(4);return Object.fromEntries(IDS.map(k=>[k,'integration158-'+k.toLowerCase()+'-'+token]))}
function contracts(){const c=parseLoopJson(bound({path:LOOP_EVIDENCE+'/experiment-contract.json',sha256:LOOP_CONTRACT_SHA}));bound({path:LOOP_EVIDENCE+'/feature-hash-contract.json',sha256:HASH_CONTRACT_SHA});need(c.taskId==='WORLD-EVOLUTION-LOOP-158'&&c.limits.primarySteps===3&&c.limits.maximumModelForwards===5,'contract');return c}
function fixedBindings(c){const interpreter=fixedLoopInterpreter(),{contract:e}=fixedLoopExecution();return [...CODES.map(bind),...[...c.modelCodeBindings,...c.archiveBindings,c.modelIdentityEvidence].map(r=>{bound(r);return bind(r.path)}),bind(c.checkpoint.path),bind(LOOP_EVIDENCE+'/experiment-contract.json'),bind(LOOP_EVIDENCE+'/feature-hash-contract.json'),bind(BOOTSTRAP),bind(INTERPRETER_CONTRACT),bind(interpreter.venvConfig.path),bind(interpreter.sitePackages+'/torch/__init__.py'),bind(LOOP_EXECUTION_EVIDENCE+'/execution-contract.json'),...[e.alignment,e.priorActualAcceptance,e.repairReview,...e.priorReservations].map(r=>bind(r.path))]}
function artifactBudget(run,limit){let bytes=0,files=0;const visit=p=>{for(const entry of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,entry.name),s=fs.lstatSync(q);need(!s.isSymbolicLink(),'artifact_link');if(s.isDirectory())visit(q);else{need(s.isFile()&&s.nlink===1&&++files<=512,'artifact_file');bytes+=s.size;need(bytes<=limit,'artifact_budget')}}};visit(safe(run));return {bytes,files}}
function seedRows(c){
  const bytes=bound(c.archiveBindings[0]),archive=parseLoopJson(bytes),receipt=parseLoopJson(bound(c.archiveBindings[1]))
  need(receipt.responseSha256===loopSha(bytes)&&receipt.responseBytes===bytes.length&&receipt.httpStatus===200&&archive.header.time_standard==='UTC','archive_receipt')
  need(archive.header.start==='20200101'&&archive.header.end==='20200131','archive_period')
  const rows=c.seedDates.map(date=>c.fieldOrder.map((field,j)=>{need(archive.parameters[field].units===c.units[j],'archive_units');const n=archive.properties.parameter[field][date];need(typeof n==='number'&&Number.isFinite(n)&&n!==archive.header.fill_value&&n>=c.guards[field].minimum&&n<=c.guards[field].maximum,'seed_value');return n}))
  const provenance=c.seedDates.map(date=>{const start=Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00.000Z');return {origin:'external_archival_context',sourceRef:{path:c.archiveBindings[0].path,sha256:c.archiveBindings[0].sha256},periodStartUtc:iso(start),periodEndUtc:iso(start+86400000),note:'External archival seed, not world-lived history; publication availability unknown.'}})
  return {rows,provenance}
}
function unchangedDomain(r){const environment=structuredClone(r.worldState.payload.environment);delete environment.evolution;return {worldFactsPayload:r.worldFacts.payload,environment,objects:r.worldState.payload.objects,resources:r.worldState.payload.resources,randomState:r.randomState,ruleVersion:r.ruleVersion,sourceBindings:r.sourceBindings}}
function beforeOf(r){return {tick:r.record.tick,stateVersion:r.record.stateVersion,eventCursor:r.record.eventCursor,fileSha256:r.fileSha256,recordContentSha256:r.record.recordContentSha256}}
export function makeLoopModelInput(c,id,before,interval,rows,provenance){return {schemaVersion:c.inputContract.schemaVersion,taskId:c.taskId,contractSha256:LOOP_CONTRACT_SHA,mode:'primary',identity:id,before,interval,window:{fieldOrder:c.fieldOrder,units:c.units,values:rows},provenance}}
function eventProjection(event){const keys=['identity','eventId','businessKey','cursor','eventKind','fromTick','toTick','fromStateVersion','toStateVersion','interval','previousEventSha256','domainAfterSha256','reasonRefs'];const content={projectionVersion:'world-evolution-history-projection-v1',origin:'world_lived_event',...Object.fromEntries(keys.map(k=>[k,event[k]]))};return {originalEvent:event,content,projectionSha256:digest(content)}}
async function historyFor(run,step,c,runtime,store,current){
  const initial=parseLoopJson(read(run+'/initial-readback.json',512*1024),512*1024),entries=[],rows=seedRows(c)
  need(equal(initial.identity,idOf(current.record)),'initial_identity')
  for(let n=1;n<step;n++){
    const saved=parseLoopJson(read(run+'/step-'+n+'.json',512*1024),512*1024)
    need(saved.step===n&&saved.pid>0&&equal(saved.identity,idOf(current.record)),'prior_step')
    const found=await store.readNaturalTransition({identity:idOf(current.record),businessKey:saved.transaction.receipt.businessKey})
    need(found.status==='found'&&found.event&&equal(found.receipt,saved.transaction.receipt),'committed_history')
    const event=found.event;need(event.cursor===n&&event.toTick===n&&event.eventKind==='evolution','history_cursor')
    const recordPath=path.join(safe(run),'store',current.record.ownerId,current.record.worldId+'.json')
    const eventPath=recordPath+'.evolution/'+event.businessKey+'.'+event.eventSha256+'.event.json'
    const logical=path.relative(LOOP_ROOT,eventPath).replaceAll('\\','/'),raw=read(logical)
    need(equal(parseLoopJson(raw,256*1024),event),'event_original_bytes')
    need(event.changes.length===4&&event.changes.every((v,j)=>v.fieldId==='environment.'+c.fieldOrder[j]),'history_weather_change')
    const weather={fieldOrder:c.fieldOrder,units:c.units,values:event.changes.map(v=>v.newValue),period:event.interval,origin:'actual_model_private_fixture'}
    matrixSha([...rows.rows.slice(1),weather.values])
    rows.rows.shift();rows.rows.push(weather.values);rows.provenance.shift();rows.provenance.push({origin:'committed_fixture_event',sourceRef:{path:logical,sha256:loopSha(raw)},periodStartUtc:event.interval.logicalStartUtc,periodEndUtc:event.interval.logicalEndUtc,note:'Verified original Store event in private integration fixture.'});entries.push(eventProjection(event))
  }
  const head={cursor:current.record.eventCursor,tick:current.record.tick,stateVersion:current.record.stateVersion,logicalEndUtc:current.record.worldState.payload.environment.evolution.logicalEndUtc,eventSha256:current.record.worldState.payload.environment.evolution.commit?.eventSha256??null}
  const selected=runtime.history.validateWorldEvolutionHistory({identity:idOf(current.record),startAnchor:{cursor:0,tick:0,stateVersion:0,logicalEndUtc:c.simulationEpochUtc,eventSha256:null},committedHead:head,limits:{maxEvents:3,maxBytes:1024*1024,minimumContextEvents:0},events:entries})
  need(selected.status===(step===1?'cold_start_qualification_missing':'chain_matches_supplied_anchors'),'history_selection')
  if(step>1){const last=entries.at(-1).originalEvent;need(equal(current.record.worldState.payload.environment.evolution.weather,{fieldOrder:c.fieldOrder,units:c.units,values:last.changes.map(v=>v.newValue),period:last.interval,origin:'actual_model_private_fixture'}),'state_history_weather')}
  return {...rows,selected}
}
export function validateLoopOutput(c,input,inputRaw,raw,observation){
  const o=parseLoopJson(raw);exact(o,c.outputContract.exactFields)
  need(o.schemaVersion===c.outputContract.schemaVersion&&o.taskId===c.taskId&&o.contractSha256===LOOP_CONTRACT_SHA&&o.mode===input.mode,'output_identity')
  need(o.inputBytesSha256===loopSha(inputRaw)&&o.featureValueSha256===matrixSha(input.window.values)&&o.checkpointSha256===c.checkpoint.sha256,'output_binding')
  need(equal(o.fieldOrder,c.fieldOrder)&&equal(o.units,c.units)&&Array.isArray(o.values)&&o.values.length===4,'output_fields')
  o.values.forEach((n,i)=>need(typeof n==='number'&&Number.isFinite(n)&&n>=c.guards[c.fieldOrder[i]].minimum&&n<=c.guards[c.fieldOrder[i]].maximum,'output_range'))
  need(o.pid===observation.pid&&Number.isSafeInteger(o.pid)&&o.pid>0&&o.modelForwardRuns===1&&o.trainingUpdates===0&&o.worldWrites===0&&o.productionReady===false,'output_process')
  for(const stamp of [o.startedAtUtc,o.finishedAtUtc,observation.startedAtUtc,observation.finishedAtUtc])need(typeof stamp==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp)&&Number.isFinite(Date.parse(stamp))&&iso(Date.parse(stamp))===stamp,'output_utc')
  const start=Date.parse(o.startedAtUtc),end=Date.parse(o.finishedAtUtc)
  need(Number.isFinite(start)&&Number.isFinite(end)&&start>=Date.parse(observation.startedAtUtc)&&end>=start&&end<=Date.parse(observation.finishedAtUtc)&&end-start<=30000&&Number.isFinite(o.elapsedSeconds)&&o.elapsedSeconds>=0&&o.elapsedSeconds<=30,'output_time')
  need(observation.exitCode===0&&observation.signal===null&&observation.failure===null&&equal(parseLoopJson(Buffer.from(observation.stdout)),o),'actual_output')
  return o
}
/** Only accepts a live ChildProcess handle created by this runner/caller, never a PID request. */
export function stopLoopChildTree(cp){
  need(cp instanceof ChildProcess&&typeof cp.kill==='function'&&typeof cp.once==='function'&&Number.isSafeInteger(cp.pid)&&cp.pid>0&&cp.pid!==process.pid,'owned_child_handle')
  if(cp.exitCode!==null||cp.signalCode!==null)return {status:'already_exited',pid:cp.pid}
  if(process.platform==='win32'){
    const r=spawnSync('taskkill.exe',['/PID',String(cp.pid),'/T','/F'],{windowsHide:true,encoding:'utf8',timeout:4000,maxBuffer:65536})
    if(r.status!==0)cp.kill()
    return {status:r.status===0?'tree_stop_command_succeeded':'tree_stop_unconfirmed',pid:cp.pid,exitCode:r.status,error:r.error?.message??null,stdout:r.stdout??'',stderr:r.stderr??''}
  }
  try{process.kill(-cp.pid,'SIGKILL');return {status:'process_group_stop_sent',pid:cp.pid}}catch(error){cp.kill();return {status:'tree_stop_unconfirmed',pid:cp.pid,error:error.message}}
}
async function child(executable,args,input,timeoutMs,run,c){
  const start=now(),began=performance.now();let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),failure=null
  const cp=spawn(executable,args,{cwd:LOOP_ROOT,windowsHide:true,detached:process.platform!=='win32',env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',UV_THREADPOOL_SIZE:'2',PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','pipe']})
  let cleanup=null
  const stop=reason=>{if(failure)return;failure=reason;cleanup=stopLoopChildTree(cp)}
  const consume=(key,b)=>{if(stdout.length+stderr.length+b.length>c.limits.workerBytes)stop('stream_budget');else if(key==='stdout')stdout=Buffer.concat([stdout,b]);else stderr=Buffer.concat([stderr,b])}
  cp.stdout.on('data',b=>consume('stdout',b));cp.stderr.on('data',b=>consume('stderr',b));cp.stdin.on('error',()=>{});cp.stdin.end(input)
  const timer=setTimeout(()=>stop('timeout'),Math.max(1,timeoutMs)),monitor=setInterval(()=>{try{artifactBudget(run,c.limits.artifactBytes)}catch(e){stop(e.message)}},200)
  let exitCode,signal
  try{({exitCode,signal}=await new Promise((resolve,reject)=>{cp.once('error',reject);cp.once('close',(exitCode,signal)=>resolve({exitCode,signal}))}))}finally{clearTimeout(timer);clearInterval(monitor)}
  return {pid:cp.pid,parentPid:process.pid,exitCode,signal,startedAtUtc:start,finishedAtUtc:now(),elapsedMs:performance.now()-began,stdout:stdout.toString('utf8'),stderr:stderr.toString('utf8'),failure,cleanup}
}
function recheck(manifest){const interpreter=fixedLoopInterpreter();need(equal(manifest.directInterpreter,interpreter.directInterpreter),'manifest_interpreter');for(const ref of [...manifest.sourceBindings,...manifest.protected])bound(ref);const reservation=parseLoopJson(bound(manifest.reservationRef));need(manifest.reservationRef.path===LOOP_EXECUTION_EVIDENCE+'/execution-reservation.json'&&reservation.run===manifest.run&&reservation.executionTaskId===EXECUTION_TASK&&reservation.protocolTaskId==='WORLD-EVOLUTION-LOOP-158'&&reservation.executionContractSha256===EXECUTION_SHA&&reservation.alreadySpentModelForwards===4&&reservation.additionalModelForwardsMaximum===5&&reservation.taskCumulativeModelForwardsMaximum===9,'replacement_reservation')}
async function model(run,step,mode,input,c,manifest,monotonicDeadline){
  recheck(manifest)
  const interpreter=fixedLoopInterpreter(),identityRemaining=Math.min(Date.parse(manifest.deadlineUtc)-Date.now(),monotonicDeadline-performance.now());need(identityRemaining>0,'run_timeout')
  const identityObservation=await child(DIRECT_EXE,[...interpreter.args,BOOTSTRAP,'--identity-check'],Buffer.alloc(0),Math.min(30000,identityRemaining),run,c)
  write(run,'forward-'+step+'-'+mode+'.identity-process.json',identityObservation)
  const identityOutput=validateLoopInterpreterIdentity(Buffer.from(identityObservation.stdout),identityObservation)
  write(run,'forward-'+step+'-'+mode+'.identity.json',identityOutput);recheck(manifest)
  write(run,'forward-'+step+'-'+mode+'.attempt.json',{mode,step,atUtc:now(),inputSha256:digest(input)})
  const inputRaw=encoded(input);need(inputRaw.length<=c.limits.workerBytes,'input_budget');write(run,'forward-'+step+'-'+mode+'.input.json',input)
  const remaining=Math.min(Date.parse(manifest.deadlineUtc)-Date.now(),monotonicDeadline-performance.now());need(remaining>0,'run_timeout')
  const observed=await child(DIRECT_EXE,[...interpreter.args,BOOTSTRAP],inputRaw,Math.min(30000,remaining),run,c)
  const processRef=write(run,'forward-'+step+'-'+mode+'.process.json',observed)
  recheck(manifest)
  need(observed.exitCode===0&&observed.signal===null&&!observed.failure,'model_child_failed')
  const output=validateLoopOutput(c,input,inputRaw,Buffer.from(observed.stdout),observed)
  const outputRef=write(run,'forward-'+step+'-'+mode+'.output.json',output)
  recheck(manifest);return {output,processRef,outputRef,inputRef:bind(run+'/forward-'+step+'-'+mode+'.input.json')}
}
async function currentStore(run,c,runtime){const id=identity(run),store=runtime.store.createProductionWorldRuntimeStore(safe(run+'/store'));const current=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId});need(current.status==='found'&&equal(idOf(current.record),id),'current_store');const originalDomain=unchangedDomain(parseLoopJson(bound(c.initialWorld),512*1024));need(equal(unchangedDomain(current.record),originalDomain)&&equal(parseLoopJson(read(run+'/initial-readback.json',512*1024),512*1024).unchangedDomain,originalDomain),'unchanged_domain');return {id,store,current}}
export async function loopStepChild(run,step,manifestSha){
  privateRunPath(run);need(Number.isInteger(step)&&step>=1&&step<=3,'step');const manifestRaw=read(run+'/manifest.json');need(loopSha(manifestRaw)===manifestSha,'manifest_sha');const manifest=parseLoopJson(manifestRaw),c=contracts()
  exact(manifest,['schemaVersion','taskId','executionTaskId','protocolTaskId','executionContractRef','run','identity','contractSha256','featureHashContractSha256','sourceBindings','directInterpreter','reservationRef','protected','startedAtUtc','deadlineUtc','qualification'])
  need(manifest.executionTaskId===EXECUTION_TASK&&manifest.protocolTaskId===c.taskId&&equal(manifest.executionContractRef,{path:LOOP_EXECUTION_EVIDENCE+'/execution-contract.json',sha256:EXECUTION_SHA}),'manifest_execution');bound(manifest.executionContractRef);validateLoopDeadline(manifest.startedAtUtc,manifest.deadlineUtc)
  need(manifest.run===run&&manifest.schemaVersion==='world-evolution-loop-run-v1'&&manifest.taskId===c.taskId&&manifest.contractSha256===LOOP_CONTRACT_SHA&&manifest.featureHashContractSha256===HASH_CONTRACT_SHA&&equal(manifest.identity,identity(run))&&Date.now()<Date.parse(manifest.deadlineUtc)&&Date.parse(manifest.deadlineUtc)-Date.parse(manifest.startedAtUtc)===180000&&equal(manifest.qualification,c.qualification),'manifest')
  need(equal(manifest.sourceBindings,fixedBindings(c)),'manifest_source_set')
  const expectedProtected=[c.initialWorld,...fixedLoopExecution().alignment.protected.filter(x=>x.path!==c.initialWorld.path)]
  need(equal(manifest.protected,expectedProtected),'manifest_protected_set')
  const monotonicDeadline=performance.now()+Math.min(180000,Date.parse(manifest.deadlineUtc)-Date.now())
  write(run,'step-'+step+'.attempt.json',{step,pid:process.pid,atUtc:now()});recheck(manifest)
  const runtime=await loadLoopRuntime(LOOP_ROOT),{id,store,current}=await currentStore(run,c,runtime)
  need(current.record.tick===step-1&&current.record.stateVersion===step-1&&current.record.eventCursor===step-1,'step_before')
  const history=await historyFor(run,step,c,runtime,store,current),historyRef=write(run,'step-'+step+'.history.json',history.selected)
  const policy={simulationEpochUtc:c.simulationEpochUtc,stepSeconds:86400,scheduleIntervalSeconds:86400,modelHorizonSeconds:86400,downtimeMode:'freeze',maxCatchupSteps:0,maxCatchupLogicalSeconds:0}
  const anchor=runtime.clock.createWorldEvolutionClockAnchor({policy,lastCommittedLogicalEndUtc:current.record.worldState.payload.environment.evolution.logicalEndUtc,monotonicNowMs:0,recoveredPendingSteps:0})
  const proposed=runtime.clock.planWorldEvolutionBatch(anchor,{monotonicNowMs:86400000,committedLogicalEndUtc:current.record.worldState.payload.environment.evolution.logicalEndUtc,remainingStepBudget:1,remainingLogicalSeconds:86400,maxBatchSteps:1});need(proposed.intervals.length===1,'clock_proposal')
  const interval=proposed.intervals[0];write(run,'step-'+step+'.clock.json',{clockKind:'controlled_component_schedule_not_actual_elapsed_day',proposed,actualNodePid:process.pid,atUtc:now()})
  const input=makeLoopModelInput(c,id,beforeOf(current),interval,history.rows,history.provenance)
  const primary=await model(run,step,'primary',input,c,manifest,monotonicDeadline);let probes=null
  if(step===3){
    const positive=structuredClone(input);positive.mode='history_probe';const rh=positive.window.values[5][1];positive.window.values[5][1]+=rh+1<=100?1:-1;positive.provenance[5].note+=' Counterfactual RH perturbation; not a committed event value.'
    const negative=structuredClone(input);negative.mode='metadata_probe';negative.provenance[0].note+=' Irrelevant explanatory metadata control.'
    const p=await model(run,step,'history_probe',positive,c,manifest,monotonicDeadline),n=await model(run,step,'metadata_probe',negative,c,manifest,monotonicDeadline)
    const difference=Math.max(...primary.output.values.map((v,i)=>Math.abs(v-p.output.values[i])));need(difference>1e-9&&equal(primary.output.values,n.output.values),'history_probe_assertions')
    probes={positive:p,negative:n,maximumOutputDifference:difference,unchangedCurrentRow:equal(input.window.values[6],positive.window.values[6]),meaning:'Numerical lag sensitivity only; counterfactual outputs never committed.'};write(run,'step-3.probes.json',probes)
  }
  const next=structuredClone(current.record);for(const k of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])delete next[k]
  next.tick++;next.stateVersion++;next.eventCursor++;next.worldFacts.tick=next.tick;next.worldState.tick=next.tick;next.savedAt=now()
  const weather={fieldOrder:c.fieldOrder,units:c.units,values:primary.output.values,period:interval,origin:'actual_model_private_fixture'}
  next.worldState.payload.environment.evolution={...next.worldState.payload.environment.evolution,logicalEndUtc:interval.logicalEndUtc,weather};delete next.worldState.payload.environment.evolution.commit
  need(equal(unchangedDomain(next),unchangedDomain(current.record)),'candidate_changed_protected_domain')
  const reason=primary.outputRef.sha256,previousWeather=current.record.worldState.payload.environment.evolution.weather
  const changes=c.fieldOrder.map((field,j)=>({fieldId:'environment.'+field,operation:step===1?'set':'replace',beforeValueSha256:digest(previousWeather?.values[j]??{status:'unavailable',reason:'private initial weather absent'}),newValue:primary.output.values[j],reasonRefs:[reason]}))
  const event={schemaVersion:'world-evolution-event-v1',identity:id,eventId:'integration158-event-'+step,businessKey:'0'.repeat(64),cursor:step,eventKind:'evolution',fromTick:step-1,toTick:step,fromStateVersion:step-1,toStateVersion:step,before:{expectedTick:step-1,expectedStateVersion:step-1,expectedFileSha256:current.fileSha256,worldFactsPayloadSha256:current.record.worldFactsPayloadSha256,statePayloadSha256:current.record.statePayloadSha256,recordContentSha256:current.record.recordContentSha256},interval,policyRef:jsonRef('private-loop-experiment',LOOP_CONTRACT_SHA),externalInputRefs:c.archiveBindings.map(r=>jsonRef(r.path,r.sha256)),historyInputRef:jsonRef(historyRef.path,historyRef.sha256),evidence:{kind:'evolution',capabilityRef:jsonRef('private-experiment-no-production-capability',LOOP_CONTRACT_SHA),modelRef:jsonRef(c.checkpoint.path,c.checkpoint.sha256),inputRef:jsonRef(primary.inputRef.path,primary.inputRef.sha256),outputRef:jsonRef(primary.outputRef.path,primary.outputRef.sha256),validatorRef:jsonRef('scripts/lib/natural-world-evolution-loop.mjs',bind('scripts/lib/natural-world-evolution-loop.mjs').sha256)},changes,reasonRefs:[reason],previousEventSha256:current.record.worldState.payload.environment.evolution.commit?.eventSha256??null,domainAfterSha256:runtime.transaction.computeWorldEvolutionDomainSha(next)}
  event.businessKey=runtime.transaction.computeWorldEvolutionBusinessKey(event);const sealed=runtime.transaction.sealWorldEvolutionEvent(event)
  next.worldState.payload.environment.evolution.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:step,eventSha256:sealed.eventSha256}}
  recheck(manifest);need(Date.now()<Date.parse(manifest.deadlineUtc)&&performance.now()<monotonicDeadline,'commit_deadline')
  const writeInput={record:next,event:sealed,expectedTick:step-1,expectedStateVersion:step-1,expectedFileSha256:current.fileSha256}
  write(run,'step-'+step+'.candidate.json',writeInput)
  const transaction=await store.writeNaturalTransition(writeInput);need(transaction.ok,'transaction_rejected')
  const restored=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedTick:step,expectedStateVersion:step,expectedFileSha256:transaction.receipt.fileSha256});need(restored.status==='found'&&equal(unchangedDomain(restored.record),unchangedDomain(current.record)),'post_commit_read')
  const replay=await store.writeNaturalTransition(writeInput);need(replay.ok&&replay.replayed&&equal(replay.receipt,transaction.receipt),'duplicate_replay')
  recheck(manifest)
  const result={schemaVersion:'world-evolution-loop-step-v1',step,pid:process.pid,identity:id,before:beforeOf(current),after:beforeOf(restored),historyRef,window:input.window,provenance:input.provenance,primary,probes:probes?{maximumOutputDifference:probes.maximumOutputDifference,unchangedCurrentRow:probes.unchangedCurrentRow}:null,transaction,replay,productionReady:false}
  write(run,'step-'+step+'.json',result);return result
}
export async function runNaturalWorldEvolutionLoop(){
  need(arguments.length===0,'no_caller_config');need(fs.realpathSync(process.cwd())===LOOP_ROOT,'cwd');const c=contracts(),startedAtUtc=now(),began=performance.now()
  const run=LOOP_EVIDENCE+'/run-'+randomUUID().replaceAll('-','');privateRunPath(run);fs.mkdirSync(safe(run));const id=identity(run)
  const reservationRef=reserveLoopReplacement(run)
  const protectedFiles=[c.initialWorld,...fixedLoopExecution().alignment.protected.filter(x=>x.path!==c.initialWorld.path)]
  for(const ref of protectedFiles)bound(ref);for(const ref of [c.checkpoint,...c.modelCodeBindings,c.modelIdentityEvidence,...c.archiveBindings])bound(ref)
  const manifest={schemaVersion:'world-evolution-loop-run-v1',taskId:c.taskId,executionTaskId:EXECUTION_TASK,protocolTaskId:c.taskId,executionContractRef:{path:LOOP_EXECUTION_EVIDENCE+'/execution-contract.json',sha256:EXECUTION_SHA},run,identity:id,contractSha256:LOOP_CONTRACT_SHA,featureHashContractSha256:HASH_CONTRACT_SHA,sourceBindings:fixedBindings(c),directInterpreter:fixedLoopInterpreter().directInterpreter,reservationRef,protected:protectedFiles,startedAtUtc,deadlineUtc:iso(Date.parse(startedAtUtc)+c.limits.runSeconds*1000),qualification:c.qualification}
  const manifestRef=write(run,'manifest.json',manifest)
  try{
    const runtime=await loadLoopRuntime(LOOP_ROOT),record=parseLoopJson(bound(c.initialWorld),512*1024)
    Object.assign(record,id);for(const k of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])delete record[k]
    for(const k of ['worldFacts','worldState']){record[k].worldId=id.worldId;record[k].regionId=id.regionId}
    record.savedAt=now();record.worldState.payload.environment.evolution={logicalEndUtc:c.simulationEpochUtc,initialization:{kind:'private_clone_not_world_creation',sourceWorldRef:c.initialWorld,timeMeaning:c.timeMeaning}}
    const store=runtime.store.createProductionWorldRuntimeStore(safe(run+'/store'));const initial=await store.writeNatural({record,expectedTick:-1,expectedStateVersion:-1,expectedFileSha256:null});need(initial.ok,'fixture_initial_write')
    const restored=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedTick:0,expectedStateVersion:0});need(restored.status==='found','fixture_initial_read')
    write(run,'initial-readback.json',{identity:id,pid:process.pid,before:beforeOf(restored),unchangedDomain:unchangedDomain(restored.record),qualification:c.qualification,fixtureOnly:true})
    const steps=[]
    for(let step=1;step<=3;step++){
      recheck(manifest);const left=c.limits.runSeconds*1000-(performance.now()-began);need(left>0,'run_timeout')
      const observation=await child(process.execPath,[CLI,'--step',run,String(step),manifestRef.sha256],Buffer.alloc(0),left,run,c)
      write(run,'step-'+step+'.process.json',observation);need(observation.exitCode===0&&!observation.signal&&!observation.failure,'step_child_failed')
      const receipt=parseLoopJson(read(run+'/step-'+step+'.json',512*1024),512*1024),stdout=parseLoopJson(Buffer.from(observation.stdout))
      need(receipt.pid===observation.pid&&receipt.pid!==process.pid&&stdout.pid===receipt.pid&&stdout.step===step&&stdout.receiptSha256===bind(run+'/step-'+step+'.json').sha256,'step_process_binding')
      need(!steps.some(x=>x.pid===receipt.pid),'step_process_reused');steps.push({pid:receipt.pid,step,receiptRef:bind(run+'/step-'+step+'.json')})
    }
    const final=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedTick:3,expectedStateVersion:3});need(final.status==='found'&&final.record.eventCursor===3,'final_store')
    recheck(manifest);const artifact=artifactBudget(run,c.limits.artifactBytes)
    const forwardEvidence=[]
    for(const [step,mode] of [[1,'primary'],[2,'primary'],[3,'primary'],[3,'history_probe'],[3,'metadata_probe']]){
      const base=run+'/forward-'+step+'-'+mode,inputRaw=read(base+'.input.json'),outputRaw=read(base+'.output.json'),observation=parseLoopJson(read(base+'.process.json'))
      const output=validateLoopOutput(c,parseLoopJson(inputRaw),inputRaw,outputRaw,observation)
      forwardEvidence.push({step,mode,pid:observation.pid,modelForwardRuns:output.modelForwardRuns,inputRef:bind(base+'.input.json'),outputRef:bind(base+'.output.json'),processRef:bind(base+'.process.json')})
    }
    const realModelForwards=forwardEvidence.reduce((sum,x)=>sum+x.modelForwardRuns,0);need(realModelForwards===c.limits.maximumModelForwards&&new Set(forwardEvidence.map(x=>x.pid)).size===5,'forward_total')
    const result={schemaVersion:'world-evolution-loop-result-v1',status:'private_three_step_integration_verified',executionTaskId:EXECUTION_TASK,protocolTaskId:c.taskId,taskId:c.taskId,run,identity:id,manifestRef,steps,final:beforeOf(final),realModelForwards,previousActualModelForwards:4,taskCumulativeModelForwards:4+realModelForwards,forwardEvidence,trainingUpdates:0,formalWorldWrites:0,clientSessionsRequired:0,startedAtUtc,finishedAtUtc:now(),elapsedMs:performance.now()-began,artifact,qualification:c.qualification,limits:['Private clone and controlled clock; not production world evolution, cold-start qualification or operational scheduling.','External archival seed and lived fixture events remain separate; probes are numerical sensitivity only.']}
    write(run,'result.json',result);return result
  }catch(error){
    const observedForwards=[]
    for(const name of fs.readdirSync(safe(run)).filter(n=>/^forward-[123]-(primary|history_probe|metadata_probe)\.process\.json$/.test(n))){
      try{const p=parseLoopJson(read(run+'/'+name)),out=parseLoopJson(Buffer.from(p.stdout));observedForwards.push({processRef:bind(run+'/'+name),spawnedPid:p.pid,reportedPid:out.pid,exitCode:p.exitCode,reportedModelForwards:out.modelForwardRuns===1?1:null})}catch{observedForwards.push({processRef:bind(run+'/'+name),reportedModelForwards:null})}
    }
    const unresolvedAttempts=fs.readdirSync(safe(run)).filter(n=>/^forward-[123]-(primary|history_probe|metadata_probe)\.attempt\.json$/.test(n)&&!fs.existsSync(safe(run+'/'+n.replace('.attempt.','.process.')))).length
    const reportedCompletedForwards=observedForwards.reduce((n,x)=>n+(x.reportedModelForwards??0),0)
    const result={schemaVersion:'world-evolution-loop-result-v1',status:'failed_closed',executionTaskId:EXECUTION_TASK,protocolTaskId:c.taskId,taskId:c.taskId,run,error:String(error.message),previousActualModelForwards:4,reportedCompletedForwards,taskReportedCompletedForwards:4+reportedCompletedForwards,forwardAccountingUnresolved:unresolvedAttempts+observedForwards.filter(x=>x.reportedModelForwards===null).length,observedForwards,startedAtUtc,finishedAtUtc:now(),elapsedMs:performance.now()-began,qualification:c.qualification};write(run,'result.json',result);throw Object.assign(error,{run})
  }
}
export function loopStepReceiptRef(run,step){privateRunPath(run);return bind(run+'/step-'+step+'.json')}
