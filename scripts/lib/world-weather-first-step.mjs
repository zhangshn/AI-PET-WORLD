import fs from 'node:fs'
import assert from 'node:assert/strict'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {safe,bind,bound,json,sha,runtime} from './world-initialized-evolution.mjs'
import {EVOLUTION_STORE} from './natural-world-evolution-input.mjs'
import {prepareWorldEnvironmentInitialization} from './world-environment-initialization.mjs'
import {inspectWeatherReleasePolicy,FIRST_WEATHER_VERSION,FIRST_WEATHER_POLICY_PATH} from './world-weather-release-policy.mjs'

const namespace='.runtime/ai-painter/world-weather-first-step'
const budgetPath='data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json'
const supported = new Set(['forecast','timeout-probe'])

function availableDisk(file) {
  const info=fs.statfsSync(file,{bigint:true})
  return info.bavail*info.bsize
}

function save(name,value) {
  fs.writeFileSync(safe(name),JSON.stringify(value,null,2)+'\n',{flag:'wx',flush:true})
  return bind(name)
}

async function checkStore(identity,expectedSha) {
  const {store}=await runtime()
  const adapter=store.createProductionWorldRuntimeStore(safe('data/world-runtime'))
  const result=await adapter.readNatural({ownerId:identity.ownerId,worldId:identity.worldId,expectedPlayerId:identity.playerId})
  assert.equal(result.status,'found')
  assert.equal(result.fileSha256,expectedSha)
  assert.equal(result.record.tick,0)
  return {fileSha256:result.fileSha256,tick:result.record.tick,stateVersion:result.record.stateVersion,eventCursor:result.record.eventCursor}
}

function claim(dir) {
  fs.mkdirSync(safe(namespace),{recursive:true})
  try {fs.mkdirSync(safe(dir))}
  catch(error){if(error.code==='EEXIST')throw Error('weather_budget_already_reserved');throw error}
}

// Fixed qualification cases exercise the actual worker and deadline on a read-only world.
// A production transaction has to consume its own released ticket and a committed weather seed.
export async function qualifyFirstWeatherBudget(mode) {
  assert(supported.has(mode),'unknown budget qualification case')
  const started=performance.now(), assessment=inspectWeatherReleasePolicy(process.cwd(),FIRST_WEATHER_VERSION)
  assert(assessment.datasetRelease && assessment.lifecycle.state!=='absent','registered candidate and dataset required')
  const policy=json(FIRST_WEATHER_POLICY_PATH), config=JSON.parse(bound({path:budgetPath,sha256:policy.resourceContractRef.sha256}))
  const limits=config.resources, dir=namespace+'/'+mode
  const interpreter=JSON.parse(bound(config.interpreter)),exe=interpreter.directInterpreter
  assert.equal(sha(fs.readFileSync(exe.path)),exe.sha256)
  const seed=prepareWorldEnvironmentInitialization()
  assert.deepEqual(seed.identity,config.identity)
  const record=bind(EVOLUTION_STORE),before=await checkStore(config.identity,record.sha256)
  assert(availableDisk(fs.realpathSync('.runtime'))>=BigInt(limits.minimumFreeDiskMiB)*1048576n,'insufficient_free_disk')
  claim(dir)
  const input=save(dir+'/input.json',{identity:seed.identity,before,history:seed.context.values,
    interval:config.firstInterval,budgetSha256:policy.resourceContractRef.sha256,modelSha256:config.checkpoint.sha256})
  const wallMs=mode==='forecast'?limits.workerSecondsMaximum*1000:5000
  const startUtc=Date.now(),pulse=safe(dir+'/heartbeat')
  const reservation=save(dir+'/reservation.json',{mode,worldId:seed.identity.worldId,input,atUtc:new Date(startUtc).toISOString(),
    ownerDeadlineUtc:new Date(startUtc+wallMs).toISOString(),workerMs:wallMs,forwardsMaximum:mode==='forecast'?1:0,
    formalWritesMaximum:0,retries:0})
  let result,failed
  try {
    result=await runOwnedWorker(exe.path,[...interpreter.args,safe(config.worker.path),mode,safe(input.path),input.sha256],{
      cwd:process.cwd(),timeout:wallMs,maxBuffer:limits.logBytesPerStreamMaximum,
      env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',CUDA_VISIBLE_DEVICES:'',PYTHONDONTWRITEBYTECODE:'1'},
      abortReason(){
        if(fs.existsSync(safe(dir+'/cancel')))return 'weather_budget_cancelled'
        if(availableDisk(safe(dir))<BigInt(limits.minimumFreeDiskMiB)*1048576n)return 'weather_disk_reserve'
        const entries=fs.readdirSync(safe(dir))
        if(entries.length>limits.artifactFilesMaximum)return 'weather_artifact_count'
        let bytes=0
        for(const name of entries){
          try{bytes+=fs.lstatSync(safe(dir+'/'+name)).size}
          catch(error){if(error.code!=='ENOENT')throw error}
        }
        if(bytes>limits.artifactBytesMaximum)return 'weather_artifact_size'
        let beat=startUtc
        try{beat=fs.statSync(pulse).mtimeMs}catch(error){if(error.code!=='ENOENT')throw error}
        if(Date.now()-beat>limits.staleSeconds*1000)return 'weather_heartbeat_stale'
        if(performance.now()-started>limits.runSecondsMaximum*1000)return 'weather_run_deadline'
        return null
      }})
  }catch(error){failed=error}
  const receipt=result?.ownedReceipt??failed?.ownedReceipt
  save(dir+'/process.json',{error:failed?{code:failed.code??null,message:failed.message}:null,
    stdout:result?.stdout??failed?.stdout??'',stderr:result?.stderr??failed?.stderr??'',receipt:receipt??null})
  const after=await checkStore(config.identity,record.sha256)
  assert.deepEqual(after,before)
  assert(receipt?.cleanupConfirmed&&receipt.guardReleaseConfirmed&&receipt.proof.assignedBeforeResume&&
    receipt.proof.activeProcessesAfterCleanup===0,'owned_worker_cleanup_unconfirmed')
  assert(fs.existsSync(pulse) && Number(fs.readFileSync(pulse,'ascii'))===receipt.proof.rootPid,'worker_heartbeat_identity')
  let output=null
  if(mode==='timeout-probe'){
    assert.equal(failed?.code,'ETIMEDOUT','timeout did not stop the owned process')
    assert.equal(failed.stdout,'')
  }else{
    if(failed)throw failed
    output=JSON.parse(result.stdout)
    assert.equal(output.pid,receipt.proof.rootPid)
    assert.equal(output.modelForwards,1);assert.equal(output.trainingUpdates,0)
    assert.equal(output.inputSha256,input.sha256);assert.equal(output.checkpointSha256,config.checkpoint.sha256)
    assert.equal(output.job.maxCommittedBytes,limits.maxCommittedMemoryMiB*1048576)
    assert(output.job.peakCommittedBytes>0&&output.job.peakCommittedBytes<=output.job.maxCommittedBytes)
    assert.equal(output.job.cpuAffinityCount,limits.cpuThreadsMaximum);assert.equal(output.job.maxProcesses,1)
    assert.equal(output.values.length,policy.domainFields.length)
    policy.domainFields.forEach((field,index)=>{
      const value=output.values[index]
      assert(Number.isFinite(value)&&value>=field.constraints.min&&value<=field.constraints.max,'outside_weather_domain')
    })
    const historical=json('.runtime/ai-painter/controller-repair-reviews/world-initialized-evolution-164-20261030/runtime/actual-run/output.json')
    assert.deepEqual(output.values,historical.values,'fixed identical history must reproduce prior CPU forecast')
  }
  assert(performance.now()-started<=limits.runSecondsMaximum*1000,'overall deadline')
  const report={mode,atUtc:new Date().toISOString(),status:failed?'timeout_stopped_before_forecast':'forecast_verified',
    reservation,policySha256:assessment.policyFileSha256,worldBefore:before,worldAfter:after,formalWorldWrites:0,
    modelForwards:output?.modelForwards??0,output,elapsedMs:performance.now()-started,cleanupConfirmed:true,ownedProcessesRemaining:0}
  save(dir+'/result.json',report)
  return report
}
