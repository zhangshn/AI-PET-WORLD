// One post-mortem request, three sequential existing CPU Jobs, no retries.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {performance} from 'node:perf_hooks'
import {fileURLToPath} from 'node:url'
import {createHostPaths} from './check-ai-painter-saved-gradient-algebra-cpu-v4.mjs'
import {runParameter60OwnedWorker} from './lib/ai-painter-parameter60-owned-worker-v1.mjs'

export const ROOT = 'F:/ai-pet-world'
export const OUT = '.runtime/ai-painter/controller-repair-reviews/interface-contract-unification-20261019/namespace-v2/train-fit-02'
const BASE = '.runtime/ai-painter/registered-training-d1-if-v2-executions/d1-if-v2-89ac18ed-ade0-4dfa-8a51-8de6dc39b616'
const WORKER = 'ml/ai-painter/scripts/check_current_checkpoint_train_fit_cpu_v1.py'
const HOST = 'scripts/check-ai-painter-current-checkpoint-train-fit-cpu-v1.mjs'
const REGISTRY = '.runtime/ai-painter/current-execution-registry/current.json'
const MAX = 8 * 1024 ** 2
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const bind = (paths, logical, maximum = 2 * 1024 ** 2) => ({path:logical,sha256:hash(paths.read(logical,maximum))})
export function validateRows(rows, ids) {
  assert.equal(rows.length,48); assert.equal(new Set(ids).size,48)
  assert.deepEqual(rows.map(r=>r.sampleId),ids)
  for (const row of rows) {
    assert.equal(row.split,'train');assert.equal(row.epoch,24)
    assert.ok(Number.isFinite(row.fullRgbMae)&&row.fullRgbMae>=0&&row.fullRgbMae<=1)
    for(const role of ['object_footprints','object_tree','object_rock','object_vegetation']){
      const c=row.objectCorrelations[role];assert.ok(c===null||Number.isFinite(c)&&c>=-1&&c<=1)
    }
  }
  return true
}
export async function execute({root=ROOT}={}) {
  const started = performance.now(), startedAtUtc = new Date().toISOString()
  const paths = createHostPaths(root)
  assert.ok(paths.absent(OUT),'diagnostic attempt already exists; no automatic retry')
  const registry = bind(paths,REGISTRY), registryValue=JSON.parse(paths.bound(registry))
  assert.equal(registryValue.activeExecution,null,'active execution must be empty')
  assert.ok(paths.absent('.runtime/ai-painter/owned-worker-guards/active.json'),'existing guard is not recoverable by this task')
  const planBinding={path:BASE+'/quality-plan.json',sha256:'b4adff3111724f96e817bfee81bc7995e722293ed3b5c11308721eb78573bff9'}
  const plan=JSON.parse(paths.bound(planBinding))
  const terminal={path:BASE+'/worker-terminal.json',sha256:'bc95ed6b0d126b338771d57ae2d60d8a3593728ad556ae0df1090c79bdfea993'}
  const t=JSON.parse(paths.bound(terminal)),sourcePackage=t.executionPackage
  const checkpoint=t.selectedCheckpointRecord.checkpoint
  assert.equal(checkpoint.sha256,'ff702e41370756bb24f97c4950daac56d6abc75e8f0171d9a73c367fd837a3e0')
  paths.bound(checkpoint,32*1024**2);paths.bound(sourcePackage)
  const ids=JSON.parse(paths.bound(plan.trainSplit)).sampleIds
  assert.equal(ids.length,48);assert.equal(new Set(ids).size,48)
  const programs=[HOST,WORKER,'scripts/tests/ai-painter-current-checkpoint-train-fit-cpu-v1.test.mjs',
    'ml/ai-painter/tests/test_current_checkpoint_train_fit_cpu_v1.py'].map(p=>bind(paths,p))
  paths.mkdir(OUT)
  const write=(logical,value)=>{
    const raw=Buffer.from(JSON.stringify(value,null,2)+'\n')
    assert.ok(raw.length<=2*1024**2)
    const fd=fs.openSync(paths.file(logical),'wx')
    try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    return {path:logical,sha256:hash(raw)}
  }
  const request={schemaVersion:'current-checkpoint-train-fit-cpu-request-v1',diagnosticId:'current-train-fit-20261020-02',
    sourceRunId:plan.runId,sourcePlan:planBinding,sourcePackage,sourceTerminal:terminal,checkpoint,
    trainSplit:plan.trainSplit,trainSampleIds:ids,diagnosticPrograms:programs,outputRoot:OUT,
    deadlineUnixMs:Date.now()+Math.floor(600000-(performance.now()-started)),
    limits:{wallSeconds:600,batchWallSeconds:180,cpuThreads:2,modelForwards:48,batches:3,outputBytes:MAX,optimizerUpdates:0,automaticRetries:0},
    localRuntimeOwnerApprovalGateAdded:false,scope:'approved_external_postmortem_cpu_inference_not_training_or_capability_release',
    existingValidationReview:{path:BASE+'/dry-review/cpu-review.json',sha256:'a52723944a8a4255bcdd0676c2a9138d2e58b3df5ffe61050e9f0ef0c62beb76'}}
  const requestBinding=write(OUT+'/request.json',request)
  write(OUT+'/attempt-claim.json',{request:requestBinding,startedAtUtc,automaticRetries:0})
  const nativePaths=new Set(), results=[],receipts=[]
  let live=null, streams=0
  function bytesUnder(logical){
    if(paths.absent(logical))return 0
    const physical=paths.file(logical)
    return fs.statSync(physical).size
  }
  function directoryBytes(logical){
    let total=0
    for(const entry of fs.readdirSync(paths.directory(logical),{withFileTypes:true})){
      assert.ok(!entry.isSymbolicLink(),'accounting link refused')
      const next=logical+'/'+entry.name
      total+=entry.isDirectory()?directoryBytes(next):bytesUnder(next)
    }
    return total
  }
  function budget(){
    assert.ok(performance.now()-started<600000,'diagnostic total600s exhausted')
    let size=directoryBytes(OUT)+streams
    for(const logical of nativePaths){
      if(!paths.absent(logical))size+=fs.statSync(path.resolve(root,logical)).isDirectory()?directoryBytes(logical):bytesUnder(logical)
    }
    if(live){
      const v=live.getStreamBytes();size+=v.stdout+v.stderr
      const guard='.runtime/ai-painter/owned-worker-guards/active.json'
      const raw=paths.read(guard,65536);assert.equal(JSON.parse(raw).identity,live.guard.identity)
      size+=raw.length
    }
    assert.ok(size<MAX-65536,'diagnostic total8MiB reserve exhausted')
    return size
  }
  try{
    for(let batch=0;batch<3;batch++){
      budget();paths.mkdir(OUT+'/batch-'+batch)
      const args=['-B',path.resolve(root,WORKER),'--request',requestBinding.path,'--sha256',requestBinding.sha256,'--batch',String(batch)]
      console.log(JSON.stringify({stage:'batch_start',batch:batch+1,totalBatches:3,atUtc:new Date().toISOString()}))
      const response=await runParameter60OwnedWorker(path.resolve(root,'ml/ai-painter/.venv/Scripts/python.exe'),args,{
        cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',PYTHONDONTWRITEBYTECODE:'1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',NUMEXPR_NUM_THREADS:'2'},
        timeout:Math.min(180000,Math.floor(600000-(performance.now()-started)-2000)),maxBuffer:MAX,
        abortReason:()=>{try{budget();assert.equal(hash(paths.read(REGISTRY)),registry.sha256);return null}catch(e){return e}},
        onSpawn:value=>{live=value;const prefix='.runtime/ai-painter/owned-worker-guards/'+value.guard.identity;
          nativePaths.add(prefix+'-native');nativePaths.add(prefix+'-started.json');nativePaths.add(prefix+'-terminal.json');nativePaths.add(prefix+'-guard-terminal.json');budget()}})
      const receipt=response.ownedReceipt
      streams+=receipt.streamBytes.stdout+receipt.streamBytes.stderr;live=null
      assert.equal(receipt.cleanupConfirmed,true);assert.equal(receipt.guardReleaseConfirmed,true)
      assert.equal(receipt.proof.activeProcessesAfterCleanup,0)
      assert.equal(receipt.proof.stdoutClosed,true);assert.equal(receipt.proof.stderrClosed,true)
      receipts.push(write(OUT+'/batch-'+batch+'/owned-receipt.json',receipt))
      const lines=response.stdout.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))
      const resultBinding=lines.at(-1)?.result
      assert.equal(resultBinding?.path,OUT+'/batch-'+batch+'/result.json')
      const value=JSON.parse(paths.bound(resultBinding))
      assert.equal(value.status,'completed');assert.equal(value.batch,batch);assert.equal(value.actualCalls.generatorForwards,16)
      for(const key of ['criticForwards','autogradAttempts','optimizerConstructionAttempts','cudaInitializationAttempts'])assert.equal(value.actualCalls[key],0)
      assert.equal(value.modelStateBeforeAfterEqual,true);assert.equal(value.gradientsRemainAbsent,true)
      assert.deepEqual(value.checkpoint,checkpoint);results.push({binding:resultBinding,value})
      write(OUT+'/batch-'+batch+'/transport-log.json',{stdout:response.stdout,stderr:response.stderr})
      console.log(JSON.stringify({stage:'batch_completed',batch:batch+1,completedSamples:results.length*16,cleanupConfirmed:true}))
    }
    const rows=results.flatMap(result=>result.value.rows)
    validateRows(rows,ids);budget()
    const validation=JSON.parse(paths.bound(request.existingValidationReview))
    assert.equal(hash(paths.read(REGISTRY)),registry.sha256)
    const terminalResult={schemaVersion:'current-checkpoint-train-fit-cpu-terminal-v1',status:'completed',request:requestBinding,
      sourceRunId:plan.runId,checkpoint,trainRows:rows,existingValidationRows:validation.validation,
      batches:results.map(r=>r.binding),ownedReceipts:receipts,modelForwardCalls:48,optimizerUpdates:0,
      gpuInitialized:false,validationForwardCalls:0,modelStateBeforeAfterEqual:true,allBatchesCleanupConfirmed:true,
      startedAtUtc,endedAtUtc:new Date().toISOString(),elapsedSeconds:(performance.now()-started)/1000,
      productionRegistryUnchanged:true,formalQualificationGranted:false,runtimePublicationGranted:false,automaticRetries:0,
      limitations:['Train and validation are different samples, not a controlled causal intervention.','No new checkpoint choice, loss change or training follows this diagnostic.']}
    const result=write(OUT+'/terminal.json',terminalResult);budget();console.log(JSON.stringify({stage:'completed',result,elapsedSeconds:terminalResult.elapsedSeconds}));return result
  }catch(error){
    const failure={schemaVersion:'current-checkpoint-train-fit-cpu-terminal-v1',status:'failed_closed',request:requestBinding,
      errorType:error.name,error:String(error.message).slice(0,4096),ownedReceipt:error.ownedReceipt??null,
      completedBatches:results.map(r=>r.binding),startedAtUtc,endedAtUtc:new Date().toISOString(),
      elapsedSeconds:(performance.now()-started)/1000,automaticRetries:0,trainingStarted:false}
    write(OUT+'/failure.json',failure);throw error
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,3);assert.equal(process.argv[2],'--run')
  await execute()
}
