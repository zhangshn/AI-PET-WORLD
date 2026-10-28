//092 independent recovery controller. Frozen091 math/classification stay imported.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn,spawnSync} from 'node:child_process'
import sharp from 'sharp'
import {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {auditAiAssistedConditionAlignment} from './ai-assisted-condition-alignment.mjs'
import {auditMvp256DetailSufficiency} from './ai-painter-mvp-detail-sufficiency-v1.mjs'
import {auditProfessionalAestheticFromFrozenContract} from './ai-painter-stage4-v2-machine-review-execution-v1.mjs'
import {REPLAY_REVIEW_POLICY,REPLAY_REVIEW_POLICY_SHA,MAX_REVIEW_JSON_BYTES,TARGET,validateReviewPolicy,validateReviewSource,selectCurrentSource,encodeReviewJson,expandInferenceManifest,reviewRowShard,classifyReplayRetention} from './ai-painter-replay-retention-review-v1.mjs'

export const RECOVERY_POLICY='data/ai-painter/system-governance/ai-painter-replay-retention-review-recovery-policy-v1.json'
export const REPLAY_REVIEW_WORKER='ml/ai-painter/scripts/painter_replay_retention_review_recovery_v1.py'
export const RECOVERY_PY_TEST='ml/ai-painter/tests/test_replay_retention_review_recovery_v1.py'
export const RECOVERY_JS_TEST='scripts/tests/test-ai-painter-replay-retention-review-recovery.mjs'
export const RECOVERY_CLI='scripts/run-ai-painter-replay-retention-review-recovery-v1.mjs'
const BASE_REVIEW_MODULE='scripts/lib/ai-painter-replay-retention-review-v1.mjs'
const SELF='scripts/lib/ai-painter-replay-retention-review-recovery-v1.mjs'
const sha=b=>createHash('sha256').update(b).digest('hex')
const flags=Object.freeze({formalQualificationGranted:false,checkpointPromotable:false,runtimePublicationAllowed:false,automaticNextTraining:false})
const INITIAL_SHA='a33e18a2e71480174e520717840b456b616d6cf884d3604ebcf8d967cc75648c'
const retry=Object.freeze({maximumAttempts:5,maximumElapsedMs:500,retryErrnos:[13,1],retryWinerrors:[32,33],delaysMs:[25,50,100,150]})

export function validateRecoveryPolicy(p){
 assert.equal(p.schemaVersion,'ai-painter-replay-retention-review-recovery-policy-v1');assert.equal(p.mode,'one_new_review_attempt_zero_training')
 assert.deepEqual(p.baseReviewPolicy,{path:REPLAY_REVIEW_POLICY,sha256:REPLAY_REVIEW_POLICY_SHA})
 assert.deepEqual(p.initialRegistry,{revision:604,sha256:INITIAL_SHA});assert.deepEqual(p.dynamicReadRetry,retry)
 for(const [key,value]of Object.entries(flags))assert.equal(p[key],value)
 assert.equal(p.trainingAllowed,false);assert.equal(p.gpuAllowed,false);assert.equal(p.optimizerUpdates,0)
}

export function validateInitialRegistry(current,p){
 validateRecoveryPolicy(p);assert(current.ok&&current.registry.activeExecution===null,'current registry invalid or active')
 assert.equal(current.registry.registryRevision,604);assert.equal(current.registrySha256,p.initialRegistry.sha256)
 assert.equal(current.registry.executionState,'failed_closed');assert.equal(current.registry.runId,'replay-retention-review-v1-20d546bcfb9aa6fbe0e8')
 assert.deepEqual({path:current.registry.terminalEvidence.path,sha256:current.registry.terminalEvidence.sha256},p.priorFailure)
 assert.deepEqual({path:current.registry.latestTrainingTerminal.path,sha256:current.registry.latestTrainingTerminal.sha256},p.trainingSource.terminal)
}

export function validateRecoveryEvidence(p,pkg,failure,prior,inference,streams){
 validateRecoveryPolicy(p);assert.deepEqual(pkg.policy,p.baseReviewPolicy)
 for(const [a,b]of [['sourceTerminal','terminal'],['sourcePackage','package'],['sourceCheckpoint','checkpoint']])assert.deepEqual(pkg[a],p.trainingSource[b])
 assert.deepEqual(failure.executionPackage,p.priorPackage);assert.deepEqual(failure.sourceTerminal,p.trainingSource.terminal)
 assert.equal(failure.executionState,'failed_closed');assert.equal(failure.status,'replay_retention_review_execution_failed');assert.equal(failure.visualOutcome,'unknown')
 assert.equal(failure.cleanupError,null,'prior cleanup must have no unresolved error')
 assert.equal(failure.runId,'replay-retention-review-v1-20d546bcfb9aa6fbe0e8');assert.equal(prior.reviewId,failure.runId);assert.equal(inference.reviewId,failure.runId)
 for(const k of ['sourceTerminal','sourcePackage','sourceCheckpoint'])assert.deepEqual(prior[k],pkg[k])
 assert.equal(inference.status,'failed_closed');assert.deepEqual(inference.actualCalls,{generatorForwards:0,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0})
 assert.equal(streams.exitCode,1);assert.equal(streams.stdout,'');assert.match(streams.stderr,/heartbeat\.json/);assert.match(streams.stderr,/PermissionError: \[Errno 13\]/)
 assert.deepEqual(p.resources,pkg.resources);assert.deepEqual(p.resources,prior.resources)
}

async function runRecoveryReview({projectRoot=process.cwd(),sourceTerminal:explicitSource=null,policy:explicitPolicy=null,recovery:explicitRecovery=null}={}){
 const root=path.resolve(projectRoot);assert.equal(root,path.resolve(process.cwd()),'audit components require the actual project working directory')
 const {replaceHeartbeatFile}=await import('../run-ai-painter-learning-capacity-experiment.mjs')
 const {stopReviewWorker}=await import('./ai-painter-two-map-post-review-v1.mjs')
 const started=Date.now(),mono=performance.now(),observed=new Map()
 const absolute=p=>{assert(typeof p==='string'&&!p.includes('\\')&&!p.includes(':')&&!path.posix.isAbsolute(p)&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'),'logical path');return path.join(root,p)}
 const bind=p=>({path:p,sha256:sha(fs.readFileSync(absolute(p)))})
 const read=(b,maximum=16*1024**2)=>{const bytes=fs.readFileSync(absolute(b.path));assert(bytes.length<=maximum,'bounded JSON');assert.equal(sha(bytes),b.sha256,b.path);observed.set(b.path,b.sha256);return JSON.parse(bytes)}
 const readNew=b=>read(b,MAX_REVIEW_JSON_BYTES)
 const verify=b=>{assert.deepEqual(bind(b.path),{path:b.path,sha256:b.sha256});observed.set(b.path,b.sha256)}
 const policyBinding=bind(REPLAY_REVIEW_POLICY);assert.equal(policyBinding.sha256,REPLAY_REVIEW_POLICY_SHA,'frozen review policy changed');if(explicitPolicy)assert.deepEqual(explicitPolicy,policyBinding)
 const policy=read(policyBinding);validateReviewPolicy(policy)
 const recoveryBinding=bind(RECOVERY_POLICY);if(explicitRecovery)assert.deepEqual(explicitRecovery,recoveryBinding)
 const recovery=read(recoveryBinding);validateRecoveryPolicy(recovery)
 const priorFailure=read(recovery.priorFailure),priorPackage=read(recovery.priorPackage),inferenceFailure=read(recovery.inferenceFailure),workerStreams=read(recovery.workerStreams)
 validateRecoveryEvidence(recovery,{policy:policyBinding,sourceTerminal:recovery.trainingSource.terminal,sourcePackage:recovery.trainingSource.package,sourceCheckpoint:recovery.trainingSource.checkpoint,resources:policy.resources},priorFailure,priorPackage,inferenceFailure,workerStreams)
 const originalFreeze=read(recovery.originalSourceFreeze);assert.equal(originalFreeze.programs.length,181)
 for(const b of originalFreeze.programs)verify(b)
 for(const b of [...policy.absolutePrograms,policy.numericReview,policy.detailReview])verify(b)
 const thresholds=read(policy.numericReview),detailContract=read(policy.detailReview);verify(thresholds.styleFingerprint)
 const previous=await readCurrentExecutionRegistry(root);validateInitialRegistry(previous,recovery)
 const sourceTerminal=selectCurrentSource(previous,explicitSource);assert.deepEqual(sourceTerminal,recovery.trainingSource.terminal)
 const terminal=read(sourceTerminal),source=read(terminal.executionPackage),result=read(terminal.result);validateReviewSource(policy,terminal,source,result)
 const checkpoint=result.artifacts.find(b=>b.path===source.outputRoot+'/checkpoint-final.pt');verify(checkpoint)
 assert.deepEqual(terminal.executionPackage,recovery.trainingSource.package);assert.deepEqual(terminal.result,recovery.trainingSource.result);assert.deepEqual(checkpoint,recovery.trainingSource.checkpoint)
 for(const b of [...Object.values(policy.parentExperiment),...Object.values(policy.single149Experiment)])verify(b)
 const parent=read(policy.parentEvaluation),single=read(policy.single149Evaluation),parentRows=parent.rows.filter(r=>r.arm==='candidate')
 assert.equal(parentRows.length,56);assert.equal(single.rows.length,56)
 const parentPackage=read(policy.parentExperiment.package),plan=read(source.sourcePlan)
 assert.deepEqual(source.sourcePlan,parentPackage.sourcePlan)
 const train=read(plan.trainSplit).sampleIds,validation=read(plan.validationSplit).sampleIds
 assert.equal(train.length,48);assert.equal(validation.length,8);assert.equal(new Set([...train,...validation]).size,56);assert(train.includes(TARGET))
 assert.deepEqual(parentRows.map(r=>r.sampleId),[...train,...validation]);assert.deepEqual(single.rows.map(r=>r.sampleId),[...train,...validation])
 const programPaths=[...priorPackage.programs.map(b=>b.path),BASE_REVIEW_MODULE,SELF,REPLAY_REVIEW_WORKER,RECOVERY_PY_TEST,RECOVERY_JS_TEST,RECOVERY_CLI]
 const recoverySources=[SELF,REPLAY_REVIEW_WORKER,RECOVERY_PY_TEST,RECOVERY_JS_TEST,RECOVERY_CLI].map(bind)
 const payload={schemaVersion:'ai-painter-replay-retention-review-package-v1',policy:policyBinding,recovery:recoveryBinding,recoverySources,sourceTerminal,sourcePackage:terminal.executionPackage,sourceCheckpoint:checkpoint,sourceModelCapability:source.modelCapability,trainSampleIds:train,validationSampleIds:validation,programs:[...new Set(programPaths)].map(bind),specification:bind('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),resources:policy.resources,...flags}
 const reviewId='replay-retention-review-recovery-v1-'+sha(JSON.stringify(payload)).slice(0,20),outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+reviewId
 const put=(p,v,replace=false)=>{const file=absolute(p),bytes=Buffer.isBuffer(v)?v:encodeReviewJson(v);fs.mkdirSync(path.dirname(file),{recursive:true});if(replace){const tmp=file+'.'+process.pid+'.next';fs.writeFileSync(tmp,bytes,{flag:'wx'});replaceHeartbeatFile(tmp,file)}else fs.writeFileSync(file,bytes,{flag:'wx'});return bind(p)}
 assert(!fs.existsSync(absolute(outputRoot)),'consumed review output; no retry')
 const packageBinding=put(outputRoot+'/package.json',{...payload,reviewId,outputRoot,deadlineUnixMs:started+policy.resources.maxWallSeconds*1000})
 const proc=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${process.pid}';$p.CreationDate.ToUniversalTime().ToString('o')`],{windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(proc.status,0);assert(Number.isFinite(Date.parse(proc.stdout.trim())))
 const identity={runId:reviewId,packageId:reviewId,capabilityVersion:reviewId,processId:process.pid,processStartIdentity:process.pid+':'+proc.stdout.trim()}
 const lock=put(outputRoot+'/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity})
 let registered=false,child=null,childClosed=false,timer=null,heartbeatError=null,heartbeatBusy=false,cleanupPromise=null
 const requestStop=error=>{heartbeatError??=error;if(child&&!childClosed&&!cleanupPromise)cleanupPromise=stopReviewWorker(child,{closed:childClosed}).catch(e=>{heartbeatError.cleanupError=String(e.stack??e)})}
 const heartbeat=()=>put(outputRoot+'/heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'reviewing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120},fs.existsSync(absolute(outputRoot+'/heartbeat.json')))
 const budget=()=>{assert(Date.now()-started<900000,'total review deadline');let size=0;const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name),s=fs.lstatSync(p);assert(!s.isSymbolicLink());if(s.isDirectory())walk(p);else{assert(s.isFile()&&s.nlink===1);size+=s.size}}};walk(absolute(outputRoot));assert(size+65536<128*1024**2,'review output limit')}
 const commit=async(evidence,state,activity,active=null)=>{const current=await readCurrentExecutionRegistry(root);assert(current.ok);assert(registered?current.registry.runId===reviewId:current.registrySha256===previous.registrySha256,'registry changed');const capsule=put(outputRoot+(active?'/active-capsule.json':'/terminal-capsule-'+evidence.sha256.slice(0,12)+'.json'),{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:reviewId,integrity:{status:'verified'},evidence:[packageBinding,evidence].map(b=>({...b,kind:'replay_retention_review',sha256Verified:true}))});const changed=await advanceCurrentExecutionRegistry({projectRoot:root,...identity,taskId:reviewId,taskKind:'readonly_post_training_visual_review',taskGoal:'56-image relative retention and unchanged absolute audits; no training or qualification',queueStatus:active?'running':state==='failed_closed'?'failed_closed':'completed',nextMachineAction:null,lifecycleStage:'isolated_implementation',executionState:state,activity,taskCapsulePath:capsule.path,terminalEvidencePath:evidence.path,activeExecution:active,expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256});assert(changed.ok,changed.errorCode);return changed}
 try{
  heartbeat();budget()
  const ready=put(outputRoot+'/ready.json',{executionState:'completed',status:'replay_review_recovery_inputs_verified',recovery:recoveryBinding,sourceTerminal,recordedAtUtc:new Date().toISOString(),...flags})
  const active={schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'reviewing',programLineage:{controller:bind(SELF),worker:bind(REPLAY_REVIEW_WORKER)},lock,heartbeat:{path:outputRoot+'/heartbeat.json',ttlSeconds:120}}
  const activeCommit=await commit(ready,'reviewing','replay_retention_review_running',active);registered=true
  timer=setInterval(()=>{if(heartbeatBusy)return;heartbeatBusy=true;try{heartbeat();budget()}catch(error){requestStop(error)}finally{heartbeatBusy=false}},5000)
  let stdout='',stderr=''
  const exitCode=await new Promise((resolve,reject)=>{
   child=spawn(path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-B',absolute(REPLAY_REVIEW_WORKER),packageBinding.path,packageBinding.sha256],{cwd:root,windowsHide:true,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',PYTHONIOENCODING:'utf-8',PYTHONUNBUFFERED:'1'},stdio:['ignore','pipe','pipe']})
   assert(Number.isInteger(child.pid));put(outputRoot+'/worker-lease.json',{reviewId,controllerPid:process.pid,launcherPid:child.pid,controllerStartIdentity:identity.processStartIdentity,registryRevision:activeCommit.registry.registryRevision})
   const stream=(which,b)=>{if(which==='out')stdout+=b.toString();else stderr+=b.toString();if(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)>policy.resources.maximumStreamMiB*1024**2)requestStop(new Error('review stream limit'))}
   child.stdout.on('data',b=>stream('out',b));child.stderr.on('data',b=>stream('err',b));child.once('error',reject);child.once('close',code=>{childClosed=true;resolve(code)})
  })
  if(cleanupPromise)await cleanupPromise
  put(outputRoot+'/worker-streams.json',{exitCode,stdout,stderr});assert.ifError(heartbeatError);assert.equal(exitCode,0,'review inference failed');budget()
  const inferenceBinding=JSON.parse(stdout.trim());assert.equal(inferenceBinding.path,outputRoot+'/inference.json');const inference=readNew(inferenceBinding)
  assert.deepEqual(inference.executionPackage,packageBinding);assert.equal(inference.reviewId,reviewId);assert.deepEqual(inference.actualCalls,{generatorForwards:56,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0});assert.deepEqual(inference.stateBefore,inference.stateAfter);assert.equal(inference.gpuInitialized,false);assert.equal(inference.final149CrossDeviceComparison?.scope,'cross_device_observation_not_same_device_reload_gate');assert.equal(inference.historicalPixelReproductions.length,20)
  assert.equal(inference.optimizerUpdates,0);assert.deepEqual(inference.sourceCheckpoint,checkpoint);assert.deepEqual(inference.recovery,recoveryBinding);assert(inference.dynamicReadAudit&&inference.dynamicReadAudit.overflow===false)
  assert.deepEqual(inference.trainingNamedStateBefore,result.finalStateHashes);assert.deepEqual(inference.trainingNamedStateAfter,result.finalStateHashes)
  assert.deepEqual(inference.parentStateVerification.named091,result.parentStateHashes);assert.equal(inference.parentStateVerification.generatorForwards,0)
  for(const arm of ['parent','A'])assert.equal(new Set(inference.historicalPixelReproductions.filter(r=>r.arm===arm).map(r=>r.sampleId)).size,10)
  const expanded=expandInferenceManifest(inference,{pkg:{...payload,reviewId,outputRoot},packageBinding,read:readNew})
  assert.deepEqual(expanded.observations.map(r=>r.sampleId),[...train,...validation]);sharp.concurrency(2)
  const rows=[];let imageAudits=0
  const audit=async(observation,prediction,prefix)=>{
   budget();heartbeat();const id=observation.identity
   for(const b of [prediction,id.image,id.conditionPack,...id.channels])verify({path:b.path,sha256:b.sha256})
   const projection=put(outputRoot+'/'+prefix+'-projection.png',await sharp(absolute(prediction.path)).resize(1024,768,{kernel:'nearest'}).png().toBuffer())
   const detail=await auditMvp256DetailSufficiency({candidatePath:absolute(prediction.path),referencePath:absolute(id.image.path),contract:detailContract})
   const aesthetic=await auditProfessionalAestheticFromFrozenContract({imagePath:absolute(prediction.path),thresholdContract:thresholds,styleFingerprintPath:absolute(thresholds.styleFingerprint.path),expectedStyleFingerprintSha256:thresholds.styleFingerprint.sha256})
   const alignment=await auditAiAssistedConditionAlignment({record:{recordId:reviewId+'-'+prefix,conditionBinding:{conditionPackPath:id.conditionPack.path,worldId:id.worldId,tick:id.tick},classification:{monsoonSeason:observation.monsoonSeason,regionalLandscapeType:null}},imagePath:projection.path,referenceImagePath:id.image.path})
   const issueCodes=[...new Set([...detail.issueCodes,...aesthetic.issues.map(i=>i.code),...alignment.issues.map(i=>i.code)])]
   const passed=detail.passed&&aesthetic.passed&&alignment.passed;assert.equal(passed,issueCodes.length===0);imageAudits++;assert(imageAudits<=112)
   const evidence=put(outputRoot+'/'+prefix+'-audit.json',{sampleId:observation.sampleId,split:observation.split,prediction,reference:id.image,condition:id.conditionPack,projection,nativePredictionDimensions:observation.nativePredictionDimensions,referenceNativeDimensions:observation.referenceNativeDimensions,projectionDimensions:{width:1024,height:768,kernel:'nearest'},projectionIsModelOutput:false,detail,aesthetic,alignment,...flags})
   return {passed,issueCodes,evidence}
  }
  for(let n=0;n<56;n++){
   const observation=expanded.observations[n],parentRow=parentRows[n],aRow=single.rows[n]
   assert.deepEqual(observation.identity,parentRow.identity);assert.deepEqual(aRow.identity,parentRow.identity)
   verify(aRow.afterPrediction)
   assert.equal(observation.split,n<48?'train':'validation')
   const parentAbsolute=await audit(observation,parentRow.prediction,'parent-'+n),candidateAbsolute=await audit(observation,observation.prediction,'candidate-'+n)
   rows.push({...observation,parentMetrics:parentRow.metrics,aMetrics:aRow.afterMetrics,parentPrediction:parentRow.prediction,aPrediction:aRow.afterPrediction,parentAbsolute,candidateAbsolute})
  }
  const decision=classifyReplayRetention(rows,policy)
  const aComparison=classifyReplayRetention(rows.map(r=>({...r,metrics:r.aMetrics,parentAbsolute:null,candidateAbsolute:null})),policy)
  const candidateToA=classifyReplayRetention(rows.map(r=>({...r,parentMetrics:r.aMetrics,parentAbsolute:null,candidateAbsolute:null})),policy)
  const descriptive=comparison=>({groups:comparison.groups,targetFullRgbMaeImproved:comparison.targetFullRgbMaeImproved,targetObjectChanges:comparison.targetObjectChanges,absoluteEvaluated:false,note:'paired descriptive metrics only; absolute recommendations are reported only for the current candidate versus parent'})
  for(const b of [...payload.programs,payload.specification,payload.policy,payload.sourceTerminal,payload.sourceCheckpoint,...expanded.inputs])verify(b)
  for(const [p,h]of observed)assert.equal(bind(p).sha256,h,p);budget();assert.ifError(heartbeatError)
  const context={reviewId,executionPackage:packageBinding}
  const rowBindings=decision.rows.map((row,n)=>({sampleId:row.sampleId,split:row.split,binding:put(outputRoot+`/row-${String(n).padStart(2,'0')}.json`,reviewRowShard(row,inference.observationBindings[n].binding,context))}))
  const {rows:expandedRows,...summary}=decision
  const report=put(outputRoot+'/review.json',{schemaVersion:'ai-painter-replay-retention-review-result-v1',reviewId,sourceRunId:terminal.runId,arm:source.arm,executionPackage:packageBinding,sourceTerminal,sourceCheckpoint:checkpoint,inference:inferenceBinding,policy:policyBinding,recovery:recoveryBinding,dynamicReadAudit:inference.dynamicReadAudit,parentEvaluation:policy.parentEvaluation,single149Evaluation:policy.single149Evaluation,historicalMetricsAuthority:'frozen_evaluations_revalidated_by_worker_not_ledger',rowsStorage:'sha256_per_sample_json_v1',rowBindings,absoluteImageAudits:imageAudits,parentGeneratorForwards:0,...summary,aVersusParent:descriptive(aComparison),candidateVersusA:descriptive(candidateToA),final149CrossDeviceComparison:inference.final149CrossDeviceComparison,qualificationScope:'paired_numeric_and_existing_visual_components_not_object_recognition_or_release',recordedAtUtc:new Date().toISOString(),elapsedSeconds:(performance.now()-mono)/1000,timingScope:'review_controller_package_worker_and_absolute_audits_before_terminal_commit'})
  clearInterval(timer);timer=null
  const final=put(outputRoot+'/terminal.json',{schemaVersion:'ai-painter-replay-retention-review-terminal-v1',status:decision.absoluteOutcome==='unknown'?'replay_retention_review_evidence_unknown':decision.absoluteOutcome==='failed'?'replay_retention_review_completed_absolute_failed':'replay_retention_review_completed_not_qualified',executionState:'completed',runId:reviewId,packageId:reviewId,executionPackage:packageBinding,sourceRunId:terminal.runId,sourceTerminal,recovery:recoveryBinding,report,visualOutcome:decision.absoluteOutcome,relativeOutcome:decision.recommendation,recordedAtUtc:new Date().toISOString(),startedAtUtc:new Date(started).toISOString(),elapsedSeconds:(performance.now()-mono)/1000,optimizerUpdates:0,gpuInitialized:false,...flags})
  await commit(final,'completed','replay_retention_review_completed');return {terminal:final,report,visualOutcome:decision.absoluteOutcome,relativeOutcome:decision.recommendation}
 }catch(error){
  if(timer)clearInterval(timer);timer=null;let cleanupError=null
  try{if(cleanupPromise)await cleanupPromise;else await stopReviewWorker(child,{closed:childClosed})}catch(e){cleanupError=String(e.stack??e)}
  const failure=put(outputRoot+'/failure.json',{schemaVersion:'ai-painter-replay-retention-review-terminal-v1',status:'replay_retention_review_execution_failed',executionState:'failed_closed',runId:reviewId,packageId:reviewId,executionPackage:packageBinding,sourceRunId:terminal.runId,sourceTerminal,recovery:recoveryBinding,visualOutcome:'unknown',relativeOutcome:'unknown',recordedAtUtc:new Date().toISOString(),error:String(error.stack??error),heartbeatPublication:error.heartbeatPublication??heartbeatError?.heartbeatPublication??null,cleanupError,...flags})
  if(registered)await commit(failure,'failed_closed','replay_retention_review_execution_failed');error.reviewFailureEvidence=failure;throw error
 }finally{if(timer)clearInterval(timer)}
}

export async function runReplayRetentionReviewRecovery(options={}){
 try{return await runRecoveryReview(options)}catch(error){
  if(!error.reviewFailureEvidence){
   const root=path.resolve(options.projectRoot??process.cwd());assert.equal(root,path.resolve(process.cwd()))
   const reviewId='replay-retention-review-recovery-rejected-v1-'+process.pid+'-'+Date.now()
   const outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+reviewId,logical=outputRoot+'/failure.json'
   fs.mkdirSync(path.join(root,outputRoot),{recursive:true})
   const bytes=Buffer.from(JSON.stringify({schemaVersion:'ai-painter-replay-retention-review-terminal-v1',status:'replay_retention_review_preflight_failed',executionState:'failed_closed',runId:reviewId,registered:false,sourceTerminal:options.sourceTerminal??null,visualOutcome:'unknown',relativeOutcome:'unknown',recordedAtUtc:new Date().toISOString(),error:String(error.stack??error),...flags},null,2)+'\n')
   assert(bytes.length<65536);fs.writeFileSync(path.join(root,logical),bytes,{flag:'wx'});error.reviewFailureEvidence={path:logical,sha256:sha(bytes)}
  }
  throw error
 }
}


