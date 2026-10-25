// One post-mortem request, three sequential existing CPU Jobs, no retries.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {performance} from 'node:perf_hooks'
import {fileURLToPath} from 'node:url'
import {createHostPaths} from './check-ai-painter-saved-gradient-algebra-cpu-v4.mjs'
import {runParameter60OwnedWorker} from './lib/ai-painter-parameter60-owned-worker-v1.mjs'
import {collectActualExecutionSources} from './lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs'

export const ROOT = 'F:/ai-pet-world'
export const OUT = '.runtime/ai-painter/controller-repair-reviews/interface-contract-unification-20261019/namespace-v2/train-fit-02'
const WORKER = 'ml/ai-painter/scripts/check_current_checkpoint_train_fit_cpu_v1.py'
const HOST = 'scripts/check-ai-painter-current-checkpoint-train-fit-cpu-v1.mjs'
const REGISTRY = '.runtime/ai-painter/current-execution-registry/current.json'
const MAX = 8 * 1024 ** 2
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const bind = (paths, logical, maximum = 2 * 1024 ** 2) => ({path:logical,sha256:hash(paths.read(logical,maximum))})
export const FIT_OUT = '.runtime/ai-painter/controller-repair-reviews/fit-comparison-006-20261022/evaluation-v1'
const SOURCE_RUN = 'd1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8'
const SOURCE_BASE = '.runtime/ai-painter/registered-training-d1-src-v1-executions/' + SOURCE_RUN
export function prepareComparison(paths, root) {
  root=path.resolve(root)
  const programs = collectActualExecutionSources({root,capabilityVersion:'stage4_mvp256_dry_decode1_registered_source_v1',
    required:{diagnosticHost:HOST,diagnosticWorker:WORKER},
    dynamicPaths:['scripts/lib/real-earth-region-governance.mjs','scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs'],
    python:path.resolve(root,'ml/ai-painter/.venv/Scripts/python.exe'),bind:logical=>bind(paths,logical,1048576)})
  assert.ok(Object.keys(programs).length<=256)
  return Object.values(programs)
}
export function validateComparisonRows(rows, trainIds, validationIds) {
  assert.equal(rows.length,56)
  assert.equal(new Set([...trainIds,...validationIds]).size,56)
  assert.deepEqual(rows.map(row=>row.sampleId),[...trainIds,...validationIds])
  for (const [index,row] of rows.entries()) {
    assert.equal(row.split,index<48?'train':'validation')
    assert.ok(Number.isFinite(row.fullRgbMae)&&row.fullRgbMae>=0&&row.fullRgbMae<=1)
    for (const region of ['core','support']) for (const role of ['object_footprints','object_tree','object_rock','object_vegetation']) {
      const value=row.regions[region][role]
      assert.ok(Number.isSafeInteger(value.pixels)&&value.pixels>=0)
      assert.ok(value.rgbMae===null||Number.isFinite(value.rgbMae)&&value.rgbMae>=0&&value.rgbMae<=1)
      assert.ok(value.correlation===null||Number.isFinite(value.correlation)&&value.correlation>=-1&&value.correlation<=1)
      assert.equal(value.correlation===null,typeof value.naReason==='string')
    }
  }
  return true
}
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
export async function execute({root=ROOT,comparison=false}={}) {
  const OUT=comparison?FIT_OUT:'.runtime/ai-painter/controller-repair-reviews/interface-contract-unification-20261019/namespace-v2/train-fit-02'
  const BASE=comparison?SOURCE_BASE:'.runtime/ai-painter/registered-training-d1-if-v2-executions/d1-if-v2-89ac18ed-ade0-4dfa-8a51-8de6dc39b616'
  const batchCount=comparison?4:3
  const started = performance.now(), startedAtUtc = new Date().toISOString()
  const paths = createHostPaths(root)
  assert.ok(paths.absent(OUT),'diagnostic attempt already exists; no automatic retry')
  const registry = bind(paths,REGISTRY), registryValue=JSON.parse(paths.bound(registry))
  assert.equal(registryValue.activeExecution,null,'active execution must be empty')
  assert.ok(paths.absent('.runtime/ai-painter/owned-worker-guards/active.json'),'existing guard is not recoverable by this task')
  const planBinding={path:BASE+'/quality-plan.json',sha256:comparison?'fc2a9d8d4d1b9cdb280be9e8d2ad5459f3a0f24e0543e5ef030bc64741bfa641':'b4adff3111724f96e817bfee81bc7995e722293ed3b5c11308721eb78573bff9'}
  const plan=JSON.parse(paths.bound(planBinding))
  const terminal={path:BASE+'/worker-terminal.json',sha256:comparison?'9f11ec2f93cfcf1cf43ce4c384b16e208e29c57d7ae0f1468053b0cc12d7e708':'bc95ed6b0d126b338771d57ae2d60d8a3593728ad556ae0df1090c79bdfea993'}
  const t=JSON.parse(paths.bound(terminal)),sourcePackage=t.executionPackage
  const checkpoint=t.selectedCheckpointRecord.checkpoint
  assert.equal(checkpoint.sha256,comparison?'275886bb27c2ba1942c768f4cbb1bb7fc2c49024509d8b06e2ed6a5f832d49d4':'ff702e41370756bb24f97c4950daac56d6abc75e8f0171d9a73c367fd837a3e0')
  paths.bound(checkpoint,32*1024**2);paths.bound(sourcePackage)
  const ids=JSON.parse(paths.bound(plan.trainSplit)).sampleIds
  assert.equal(ids.length,48);assert.equal(new Set(ids).size,48)
  const programs=[HOST,WORKER,'scripts/tests/ai-painter-current-checkpoint-train-fit-cpu-v1.test.mjs',
    'ml/ai-painter/tests/test_current_checkpoint_train_fit_cpu_v1.py'].map(p=>bind(paths,p))
  const actualPrograms=comparison?prepareComparison(paths,root):null
  const validationIds=comparison?JSON.parse(paths.bound(plan.validationSplit)).sampleIds:[]
  paths.mkdir(OUT)
  const write=(logical,value)=>{
    const raw=Buffer.from(JSON.stringify(value,null,2)+'\n')
    assert.ok(raw.length<=2*1024**2)
    const fd=fs.openSync(paths.file(logical),'wx')
    try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    return {path:logical,sha256:hash(raw)}
  }
  const request={schemaVersion:comparison?'current-checkpoint-fit-comparison-cpu-request-v1':'current-checkpoint-train-fit-cpu-request-v1',
    diagnosticId:comparison?'painter-fit-comparison-006':'current-train-fit-20261020-02',
    sourceRunId:plan.runId,sourcePlan:planBinding,sourcePackage,sourceTerminal:terminal,checkpoint,
    trainSplit:plan.trainSplit,trainSampleIds:ids,diagnosticPrograms:programs,outputRoot:OUT,
    deadlineUnixMs:Date.now()+Math.floor(600000-(performance.now()-started)),
    limits:{wallSeconds:600,batchWallSeconds:180,cpuThreads:2,modelForwards:comparison?56:48,batches:batchCount,outputBytes:MAX,optimizerUpdates:0,automaticRetries:0},
    localRuntimeOwnerApprovalGateAdded:false,scope:'approved_external_postmortem_cpu_inference_not_training_or_capability_release',
    existingValidationReview:comparison?{path:'.runtime/ai-painter/controller-repair-reviews/independent-review-adoption-004-20261022/review-fb5bfe13-cf6e-4b79-9aa6-10baa323e31a/dry-review/cpu-review.json',sha256:'1ec73ab9f11a357a3f2787d99d893b830badbce6d10fd7a8c5413d6496168c39'}:
      {path:BASE+'/dry-review/cpu-review.json',sha256:'a52723944a8a4255bcdd0676c2a9138d2e58b3df5ffe61050e9f0ef0c62beb76'}}
  if(comparison) Object.assign(request,{taskId:'PAINTER-FIT-COMPARISON-006',actualPrograms,
    validationSampleIds:validationIds,validationSplit:plan.validationSplit,datasetManifest:plan.datasetManifest,
    specification:bind(paths,'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md')})
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
    for(let batch=0;batch<batchCount;batch++){
      budget();paths.mkdir(OUT+'/batch-'+batch)
      const args=['-B',path.resolve(root,WORKER),'--request',requestBinding.path,'--sha256',requestBinding.sha256,'--batch',String(batch)]
      console.log(JSON.stringify({stage:'batch_start',batch:batch+1,totalBatches:batchCount,atUtc:new Date().toISOString()}))
      const response=await runParameter60OwnedWorker(path.resolve(root,'ml/ai-painter/.venv/Scripts/python.exe'),args,{
        cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',PYTHONDONTWRITEBYTECODE:'1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',NUMEXPR_NUM_THREADS:'2',
          ...(comparison?{DETAIL_WEIGHT_OUTPUT_ROOTS:JSON.stringify([OUT]),DETAIL_WEIGHT_OUTPUT_MAX:String(MAX)}:{})},
        timeout:Math.min(180000,Math.floor(600000-(performance.now()-started)-2000)),maxBuffer:MAX,
        abortReason:()=>{try{budget();assert.equal(hash(paths.read(REGISTRY)),registry.sha256);
          if(comparison) for(const source of actualPrograms) paths.bound(source,1048576)
          return null}catch(e){return e}},
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
      assert.equal(value.status,'completed');assert.equal(value.batch,batch);assert.equal(value.actualCalls.generatorForwards,comparison&&batch===3?8:16)
      for(const key of ['criticForwards','autogradAttempts','optimizerConstructionAttempts','cudaInitializationAttempts'])assert.equal(value.actualCalls[key],0)
      assert.equal(value.modelStateBeforeAfterEqual,true);assert.equal(value.gradientsRemainAbsent,true)
      assert.deepEqual(value.checkpoint,checkpoint);results.push({binding:resultBinding,value})
      write(OUT+'/batch-'+batch+'/transport-log.json',{stdout:response.stdout,stderr:response.stderr})
      console.log(JSON.stringify({stage:'batch_completed',batch:batch+1,completedSamples:results.reduce((n,r)=>n+r.value.actualCalls.generatorForwards,0),cleanupConfirmed:true}))
    }
    const rows=results.flatMap(result=>result.value.rows)
    if(comparison) validateComparisonRows(rows,ids,validationIds)
    else validateRows(rows,ids)
    budget()
    const validation=JSON.parse(paths.bound(request.existingValidationReview))
    assert.equal(hash(paths.read(REGISTRY)),registry.sha256)
    const terminalResult={schemaVersion:'current-checkpoint-train-fit-cpu-terminal-v1',status:'completed',request:requestBinding,
      sourceRunId:plan.runId,checkpoint,trainRows:comparison?rows.slice(0,48):rows,existingValidationRows:validation.validation,
      ...(comparison?{taskId:request.taskId,validationRows:rows.slice(48),actualPrograms,scope:'diagnostic_only_not_qualification'}:{}),
      batches:results.map(r=>r.binding),ownedReceipts:receipts,modelForwardCalls:comparison?56:48,optimizerUpdates:0,
      gpuInitialized:false,validationForwardCalls:comparison?8:0,modelStateBeforeAfterEqual:true,allBatchesCleanupConfirmed:true,
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
  assert.equal(process.argv.length,3)
  assert.ok(['--run','--fit-comparison-006','--prepare-fit-comparison-006'].includes(process.argv[2]))
  if(process.argv[2]==='--prepare-fit-comparison-006') {
    const programs=prepareComparison(createHostPaths(ROOT),ROOT)
    console.log(JSON.stringify({status:'source_preflight_only',count:programs.length,programs}))
  } else await execute({comparison:process.argv[2]==='--fit-comparison-006'})
}
