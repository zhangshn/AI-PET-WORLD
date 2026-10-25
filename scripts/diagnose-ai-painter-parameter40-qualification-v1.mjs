// One fresh-state, single-sample observation. Never a training/retry entry.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {createReader} from './lib/ai-painter-stage4-dataset-audit.mjs'
import {runParameter60OwnedWorker} from './lib/ai-painter-parameter60-owned-worker-v1.mjs'
import {createOwnedAccounting, proofPassed, directoryBytes} from './diagnose-ai-painter-parameter48-causal-gpu-v2.mjs'
import {readCurrentExecutionRegistry, prepareCurrentExecutionRegistryAdvance, finalizePreparedCurrentExecutionRegistryAdvance} from '../src/server/ai-painter-current-execution-registry.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const POLICY='data/ai-painter/system-governance/ai-painter-parameter40-qualification-diagnostic-policy-v3.json'
const PARAMETER0_POLICY='data/ai-painter/system-governance/ai-painter-parameter40-qualification-diagnostic-policy-v4.json'
const PARAMETER0_SAMPLE='ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2'
const hash=b=>crypto.createHash('sha256').update(b).digest('hex')
const identity=p=>{const text=execFileSync('powershell.exe',['-NoProfile','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${p}'; $p.CreationDate.ToUniversalTime().ToString('o')`],{encoding:'utf8',windowsHide:true,timeout:3000});return p+':'+text.trim()}
function gpuObservation(){
  const line=execFileSync('nvidia-smi',['--query-gpu=index,uuid,memory.free,temperature.gpu','--format=csv,noheader,nounits'],{encoding:'utf8',windowsHide:true,timeout:2500,maxBuffer:16384}).split(/\r?\n/).find(v=>v.trim().startsWith('0,'))
  assert(line,'GPU0 observation missing')
  const [index,uuid,free,temp]=line.split(',').map(v=>v.trim())
  assert([+index,+free,+temp].every(Number.isFinite))
  return {index:+index,uuid,freeMiB:+free,temperatureC:+temp,observedAtUtc:new Date().toISOString()}
}
export function validatePolicy(p){
  const parameter0=p.schemaVersion==='parameter40-qualification-diagnostic-policy-v4'
  assert.equal(p.schemaVersion,parameter0?'parameter40-qualification-diagnostic-policy-v4':'parameter40-qualification-diagnostic-policy-v3')
  assert.equal(p.failureRunId,parameter0?'d2o-ss1-v1-a15f7de7-c24c-40ea-8e31-43f52eed35d8':'d1-ss1-v1-520e1238-6bda-43e5-a2eb-850fe5a8dffb')
  assert.equal(p.sampleId,parameter0?PARAMETER0_SAMPLE:'ai-cold-start-v7-v7-capacity-slot-186-grassland-forest-transition-v2')
  assert.deepEqual(p.target,parameter0?{index:0,name:'core.core.terrain.base_stem.layers.0.weight',shape:[48,31,3,3]}:{index:40,name:'core.core.terrain.decode_2.layers.0.weight',shape:[96,192,3,3]})
  assert.equal(p.outputRoot,parameter0?'.runtime/ai-painter/parameter0-qualification-diagnostics-v1':'.runtime/ai-painter/parameter40-qualification-diagnostics-v3')
  if(parameter0){
    assert.equal(p.sampleOrdinal,17);assert.equal(p.selectedTargetPacketBytes,2097152)
    assert.equal(p.modelCapabilityVersion,'stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1')
    assert.equal(p.formalSpecification.version,'AI-PAINTER-SPEC-1.120');assert.equal(p.formalSpecification.clause,'15.12')
    assert.equal(p.scope.coordinateSelection,'max_original_tolerance_ratio_first_flat_index_or_first_nonfinite_sum')
    assert.equal(p.scope.nonfiniteComponentSumPreserved,true)
  }
  assert.equal(p.workerPath,'ml/ai-painter/scripts/diagnose_parameter40_qualification_v1.py')
  assert.deepEqual(p.counts,{generatorForward:1,generatorAutograd:5,discriminatorAutograd:1,optimizerConstruction:0,optimizerSteps:0,localCoordinateReferences:5})
  assert.deepEqual(p.resources,{cpuSeconds:120,gpuSeconds:180,threads:2,gpuMemoryFraction:0.7,maximumTemperatureC:85,minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,cpuOutputBytes:8388608,gpuOutputBytes:16777216,runOutputBytes:134217728,captureBytes:67108864,streamBytes:8388608,cleanupReserveMs:1000,finalizationReserveMs:8000,attempts:1,automaticRetries:0})
  assert.equal(p.trainingAllowed,false)
  return true
}
export function resourceStopReason(current,expectedUuid,freeDiskBytes){
  const failures=[]
  if(current.uuid!==expectedUuid)failures.push('gpu_identity')
  if(current.temperatureC>=85)failures.push('temperature')
  if(current.freeMiB<2048)failures.push('free_vram')
  if(freeDiskBytes<2048*1048576)failures.push('free_disk')
  return failures.length?JSON.stringify({reason:'diagnostic_resource_protection',sample:current,freeDiskBytes,failures}):null
}
async function publish(options,accounting){
  const prepared=await prepareCurrentExecutionRegistryAdvance(options)
  assert(prepared.ok,prepared.errorCode)
  accounting.observeRegistryTransaction(prepared.transactionRoot)
  accounting.requireBudget()
  const result=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:ROOT,transactionId:prepared.transactionId,deadlineUnixMs:options.deadlineUnixMs,beforeAtomicWrite:accounting.beforeAtomicWrite})
  assert(result.ok,result.errorCode)
}
export function validateWorkerResult(worker,mode,runId,policy=null){
  const parameter0=policy?.schemaVersion==='parameter40-qualification-diagnostic-policy-v4'
  assert.equal(worker.runId,runId);assert.equal(worker.trainingAllowed,false);assert.equal(worker.stage4Qualified,false)
  assert.equal(worker.historicalReplayAllowed,false);assert.equal(worker.optimizerSteps,0);assert.equal(worker.optimizerConstruction,0)
  if(mode==='cpu'){
    assert.equal(worker.status,'cpu_preflight_passed');assert(worker.testCount>0)
    for(const key of ['modelForwards','modelAutograd','cudaCalls'])assert.equal(worker[key],0)
    assert.deepEqual(worker.samplePreflight,{sampleId:parameter0?PARAMETER0_SAMPLE:'ai-cold-start-v7-v7-capacity-slot-186-grassland-forest-transition-v2',split:'train',resolution:[256,192],conditionChannels:23,sourceIdentityVerified:true,originalLoaderAndEcologyBindingCompleted:true,modelConstructed:false})
  }else{
    assert(['diagnostic_target_evidence_complete','diagnostic_not_reproduced','diagnostic_failed_closed',...(parameter0?['diagnostic_nonfinite_component_sum_evidence_complete']:[])].includes(worker.status))
    for(const [kind,max]of [['forward',1],['generator',5],['discriminator',1]]){
      const a=worker.actualCounts[kind+'Attempted'],c=worker.actualCounts[kind+'Completed']
      assert(Number.isSafeInteger(a)&&Number.isSafeInteger(c)&&a>=c&&c>=0&&a<=max)
      if(worker.status!=='diagnostic_failed_closed')assert.equal(c,max)
    }
    if(worker.status==='diagnostic_target_evidence_complete'){
      assert.equal(worker.originalGate.sameCallInputsVerified,true);assert.equal(worker.comparison.localReferenceCount,5)
      assert.equal(worker.comparison.productionGeometry,true)
    }
    if(worker.status==='diagnostic_nonfinite_component_sum_evidence_complete'){
      assert.equal(worker.originalGate.sameCallInputsVerified,true)
      assert.equal(worker.comparison.localReferenceCount,0)
      assert.equal(worker.comparison.componentSumFinite,false)
    }
  }
}
export async function run(mode,sha256,{policyPath=POLICY}={}){
  assert(['cpu','gpu'].includes(mode));assert.match(sha256,/^[a-f0-9]{64}$/)
  assert([POLICY,PARAMETER0_POLICY].includes(policyPath),'registered diagnostic policy required')
  const parameter0=policyPath===PARAMETER0_POLICY
  const seconds=mode==='cpu'?120:180,start=Date.now(),monotonicStarted=performance.now(),startedAtUtc=new Date(start).toISOString(),deadline=start+seconds*1000
  const reader=createReader(ROOT),binding={path:policyPath,sha256},policy=reader.bound(binding)
  validatePolicy(policy)
  reader.bytes(policy.formalSpecification.path,policy.formalSpecification.sha256)
  assert.equal(policy.formalSpecification.version,parameter0?'AI-PAINTER-SPEC-1.120':'AI-PAINTER-SPEC-1.116')
  const plan=reader.bound(policy.sourcePlan),failure=reader.bound(policy.sourceFailure)
  assert.equal(plan.runId,policy.failureRunId);assert.equal(failure.runId,plan.runId)
  assert.equal(failure.originalError.message,'actual four-term total gradient identity differs at parameter '+(parameter0?0:40))
  assert.equal(failure.optimizerSteps,0)
  for(const original of Object.values(plan.programBindings)){
    if(original.path===policy.originalNormativePath){assert.equal(original.sha256,policy.originalNormativeBytes.sha256);reader.bytes(policy.originalNormativeBytes.path,original.sha256)}
    else reader.bytes(original.path,original.sha256)
  }
  assert(policy.programBindings.length<=256)
  for(const b of [...policy.programBindings,...policy.sourceInputs])reader.bytes(b.path,b.sha256)
  const python=plan.runtimeIdentity.python.absolutePath,node=plan.runtimeIdentity.node.absolutePath
  assert.equal(hash(fs.readFileSync(python)),plan.runtimeIdentity.python.sha256)
  assert.equal(path.resolve(process.execPath),path.resolve(node))
  assert.equal(hash(fs.readFileSync(node)),plan.runtimeIdentity.node.sha256)
  const previous=await readCurrentExecutionRegistry(ROOT,{deadlineUnixMs:deadline})
  assert(previous.ok,previous.errorCode);assert.equal(previous.registry.activeExecution,null)
  assert(!fs.existsSync(path.join(ROOT,'.runtime/ai-painter/owned-worker-guards/active.json')),'existing guard refused')
  const base=path.join(ROOT,policy.outputRoot)
  fs.mkdirSync(base,{recursive:true})
  assert.equal(fs.realpathSync(base),path.join(fs.realpathSync(path.join(ROOT,'.runtime')),'ai-painter',parameter0?'parameter0-qualification-diagnostics-v1':'parameter40-qualification-diagnostics-v3'))
  const claim=path.join(base,mode+'-attempt.json')
  assert(!fs.existsSync(claim),'diagnostic attempt already consumed; no retry')
  let cpu=null,gpu=null
  if(mode==='gpu'){
    cpu=reader.json(policy.outputRoot+'/cpu-acceptance.json')
    assert.deepEqual(cpu.policy,binding);assert.equal(cpu.worker.status,'cpu_preflight_passed');proofPassed(cpu.ownedReceipt)
    const cpuTerminal=reader.bound(cpu.terminal)
    assert.deepEqual(cpuTerminal.worker,cpu.worker);assert.deepEqual(cpuTerminal.ownedReceipt,cpu.ownedReceipt)
    const cpuRequest=reader.bound(cpu.request)
    assert.equal(cpuRequest.mode,'cpu');assert.deepEqual(cpuRequest.policy,binding)
    assert.deepEqual(cpuRequest.programBindings,policy.programBindings)
    validateWorkerResult(cpu.worker,'cpu',cpu.runId,policy)
    const originalInvocation=JSON.parse(Buffer.from(cpu.ownedReceipt.proof.bindingBase64,'base64').toString('utf8'))
    assert.equal(originalInvocation.guard.commandSha256,hash(JSON.stringify(['-B',path.join(ROOT,policy.workerPath),'--request',cpu.request.path,'--request-sha256',cpu.request.sha256])))
    assert.equal(originalInvocation.guard.executableSha256,plan.runtimeIdentity.python.sha256)
    for(const [file,sha]of [[originalInvocation.nativeBuild.binary,originalInvocation.nativeBuild.binarySha256],[originalInvocation.nativeBuild.source.path,originalInvocation.nativeBuild.source.sha256],[originalInvocation.nativeBuild.compiler,originalInvocation.nativeBuild.compilerSha256]])assert.equal(hash(fs.readFileSync(file)),sha)
    const recordedNative=JSON.parse(fs.readFileSync(cpu.ownedReceipt.guard.terminalEvidence,'utf8'))
    assert.deepEqual(recordedNative.proof,cpu.ownedReceipt.proof)
    gpu=gpuObservation();assert(gpu.freeMiB>=2048&&gpu.temperatureC<85,'GPU startup protection')
  }
  const storage=fs.statfsSync(base);assert(storage.bavail*storage.bsize>=2048*1048576,'disk protection')
  const runId=(parameter0?'p0-':'p40-')+mode+'-'+crypto.randomUUID(),logical=policy.outputRoot+'/'+runId,absolute=path.join(ROOT,logical)
  fs.mkdirSync(absolute)
  const cap=mode==='cpu'?8388608:16777216
  const accounting=createOwnedAccounting(ROOT,absolute,{...policy,resources:{maxOutputBytes:cap,maxStreamBytes:8388608}})
  function budget(){
    const measured=accounting.requireBudget()
    const phaseAndOtherBytes=directoryBytes(base)
    assert(phaseAndOtherBytes+measured.nativeBytes+measured.registryBytes+measured.streamBytes<=134217728-65536,'complete diagnostic Run budget')
    return measured
  }
  function put(name,value,replace=false){
    budget();const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n')
    assert(accounting.measure().totalBytes+bytes.length<=cap-65536)
    const target=path.join(absolute,name)
    if(replace){const tmp=target+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,bytes,{flag:'wx'});fs.renameSync(tmp,target)}
    else fs.writeFileSync(target,bytes,{flag:'wx'})
    return {path:logical+'/'+name,sha256:hash(bytes)}
  }
  fs.writeFileSync(claim,JSON.stringify({runId,policy:binding,recordedAtUtc:new Date().toISOString(),automaticRetries:0})+'\n',{flag:'wx'})
  const request=put('request.json',{schemaVersion:'parameter40-qualification-diagnostic-request-v1',mode,runId,outputRoot:logical,policy:binding,programBindings:policy.programBindings,deadlineUnixMs:deadline-8000})
  let heartbeat=null,heartbeatError=null,active=false,result=null,firstError=null,terminal=null,receipt=null
  const common={projectRoot:ROOT,capabilityVersion:parameter0?'parameter0_qualification_zero_update_diagnostic_v1':'parameter40_qualification_zero_update_diagnostic_v3',packageId:runId+'-package',taskId:runId,taskKind:'zero_update_causal_diagnostic',taskGoal:'One fresh-seed failed-sample observation; no training, gate change or retry.',priority:1,runId,lifecycleStage:'numerical_diagnosis',nextMachineAction:null,deadlineUnixMs:deadline}
  try{
    if(mode==='gpu'){
      const processStartIdentity=identity(process.pid),lockBase={schemaVersion:'ai-painter-current-active-execution-lock-v1',capabilityVersion:common.capabilityVersion,packageId:common.packageId,runId,processId:process.pid,processStartIdentity}
      const lock=put('active-lock.json',lockBase)
      const admission=put('admission.json',{runId,status:'verified_diagnostic_inputs_not_training',executionState:'completed',request})
      const capsule=put('task-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:runId,runId,integrity:{status:'verified'},evidence:[{...request,sha256Verified:true},{...admission,sha256Verified:true}]})
      common.taskCapsulePath=capsule.path
      const beat=()=>put('heartbeat.json',{...lockBase,schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:30},fs.existsSync(path.join(absolute,'heartbeat.json')))
      beat();heartbeat=setInterval(()=>{try{beat()}catch(e){heartbeatError=e}},5000)
      await publish({...common,executionState:'executing',activity:'zero_update_diagnostic_not_training',queueStatus:'running',terminalEvidencePath:admission.path,activeExecution:{...lockBase,schemaVersion:'ai-painter-current-active-execution-v1',executionState:'executing',programLineage:Object.fromEntries(policy.programBindings.map((b,i)=>['source'+i,b])),lock,heartbeat:{path:logical+'/heartbeat.json',ttlSeconds:30}},expectedPreviousRegistryRevision:previous.registry.registryRevision,expectedPreviousRegistrySha256:previous.registrySha256},accounting)
      active=true
    }
    let lastCheck=0
    result=await runParameter60OwnedWorker(python,['-B',path.join(ROOT,policy.workerPath),'--request',request.path,'--request-sha256',request.sha256],{cwd:ROOT,env:{...process.env,PYTHONPATH:[path.join(ROOT,'ml/ai-painter/src'),path.join(ROOT,'ml/ai-painter/scripts'),path.join(ROOT,'ml/ai-painter/tests')].join(path.delimiter),PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',Path:path.dirname(node)+path.delimiter+process.env.Path,...(mode==='cpu'?{CUDA_VISIBLE_DEVICES:'-1'}:{})},timeout:deadline-Date.now()-8000,maxBuffer:8388608,onSpawn:accounting.observe,abortReason:()=>{
      if(heartbeatError)return heartbeatError
      budget()
      if(Date.now()-lastCheck>=1000){
        lastCheck=Date.now();const space=fs.statfsSync(base),freeDiskBytes=space.bavail*space.bsize
        if(mode==='gpu'){const reason=resourceStopReason(gpuObservation(),gpu.uuid,freeDiskBytes);if(reason)return reason}
        else if(freeDiskBytes<2048*1048576)return 'CPU diagnostic free disk below2048MiB'
      }
      return null
    }})
    receipt=result.ownedReceipt;proofPassed(receipt)
    const worker=JSON.parse(result.stdout)
    validateWorkerResult(worker,mode,runId,policy)
    const failed=worker.status==='diagnostic_failed_closed'
    if(mode==='cpu')assert.equal(worker.status,'cpu_preflight_passed')
    reader.verifyStable()
    terminal=put('terminal.json',{runId,policy:binding,executionState:failed?'failed_closed':'completed',status:worker.status,request,worker,ownedReceipt:receipt,elapsedMs:parameter0?performance.now()-monotonicStarted:Date.now()-start,
      ...(parameter0?{startedAtUtc,endedAtUtc:new Date().toISOString(),durationScope:'managed_diagnostic_including_start_transport_cleanup',clock:'monotonic_performance_now'}:{}),recordedAtUtc:new Date().toISOString()})
    if(mode==='cpu')fs.writeFileSync(path.join(base,'cpu-acceptance.json'),JSON.stringify({runId,policy:binding,request,terminal,worker,ownedReceipt:receipt})+'\n',{flag:'wx'})
  }catch(error){
    firstError=error;receipt=error.ownedReceipt??result?.ownedReceipt??null
    accounting.beginFailureClosure()
    terminal=put('failure.json',{runId,executionState:'failed_closed',status:'diagnostic_failed_closed',error:String(error.stack??error).slice(0,16384),stdout:String(error.stdout??result?.stdout??'').slice(0,16384),stderr:String(error.stderr??result?.stderr??'').slice(0,16384),ownedReceipt:receipt,
      ...(parameter0?{startedAtUtc,endedAtUtc:new Date().toISOString(),elapsedMs:performance.now()-monotonicStarted,durationScope:'managed_diagnostic_including_start_transport_cleanup',clock:'monotonic_performance_now'}:{}),recordedAtUtc:new Date().toISOString(),automaticRetries:0})
  }finally{
    if(heartbeat)clearInterval(heartbeat)
  }
  if(active&&receipt?.cleanupConfirmed&&receipt.guardReleaseConfirmed){
    proofPassed(receipt)
    const current=await readCurrentExecutionRegistry(ROOT,{deadlineUnixMs:deadline})
    assert(current.ok&&current.registry.runId===runId,'own current registry changed')
    const value=reader.bound(terminal)
    await publish({...common,executionState:value.executionState,activity:'diagnostic_terminal_not_training',queueStatus:value.executionState==='completed'?'completed':'failed_closed',activeExecution:null,terminalEvidencePath:terminal.path,expectedPreviousRegistrySha256:current.registrySha256},accounting)
    const after=await readCurrentExecutionRegistry(ROOT,{deadlineUnixMs:deadline})
    assert(after.ok);assert.deepEqual(after.registry.latestTrainingTerminal,previous.registry.latestTrainingTerminal)
  }
  if(firstError)throw Object.assign(firstError,{evidence:terminal})
  return terminal
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,4,'cpu|gpu <policy-sha256> required')
  run(process.argv[2],process.argv[3]).then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(JSON.stringify({status:'failed_closed',error:e.message,evidence:e.evidence??null}));process.exitCode=1})
}
