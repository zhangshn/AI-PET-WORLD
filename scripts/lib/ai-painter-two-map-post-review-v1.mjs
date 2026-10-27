import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn,spawnSync} from 'node:child_process'
import sharp from 'sharp'
import {replaceHeartbeatFile,ownedWorkerIsRunning} from '../run-ai-painter-learning-capacity-experiment.mjs'
import {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {auditAiAssistedConditionAlignment} from './ai-assisted-condition-alignment.mjs'
import {auditMvp256DetailSufficiency} from './ai-painter-mvp-detail-sufficiency-v1.mjs'
import {auditProfessionalAestheticFromFrozenContract} from './ai-painter-stage4-v2-machine-review-execution-v1.mjs'
import {rehearsalSucceeded} from './ai-painter-mixed-train-rehearsal-v1.mjs'
import {twoMapExperimentSucceeded,twoMapSamples} from './ai-painter-two-map-experiment-v1.mjs'
import {single149Policy,single149Succeeded} from './ai-painter-single149-terrain-ecology-fit-v1.mjs'

export const POST_REVIEW_POLICY='data/ai-painter/system-governance/ai-painter-two-map-post-review-policy-v1.json'
export const MIXED_POST_REVIEW_POLICY='data/ai-painter/system-governance/ai-painter-mixed-train-post-review-policy-v1.json'
export const SINGLE149_POST_REVIEW_POLICY='data/ai-painter/system-governance/ai-painter-single149-post-review-policy-v1.json'
export const POST_REVIEW_WORKER='ml/ai-painter/scripts/painter_two_map_post_review_v1.py'
export const POST_REVIEW_SCHEMA='ai-painter-two-map-post-review-terminal-v1'
const SELF='scripts/lib/ai-painter-two-map-post-review-v1.mjs'
const ENTRY='scripts/run-ai-painter-learning-capacity-experiment.mjs'
const sha=b=>createHash('sha256').update(b).digest('hex')
const flags={formalQualificationGranted:false,checkpointPromotable:false,runtimePublicationAllowed:false,automaticNextTraining:false}

export function validateReviewSource(policy,terminal,pkg,result){
 assert.equal(policy.schemaVersion,'ai-painter-two-map-post-review-policy-v1')
 assert.equal(policy.trainingAllowed,false);assert.equal(policy.gpuAllowed,false);assert.equal(policy.optimizerUpdates,0)
 for(const [k,v] of Object.entries(flags))assert.equal(policy[k],v)
 assert.deepEqual(policy.resources,{maxWallSeconds:300,cpuThreads:2,generatorForwards:10,maxOutputMiB:24,minimumFreeDiskMiB:2048,automaticRetries:0})
 assert.deepEqual(policy.trainSampleIds,twoMapSamples)
 assert.equal(terminal.executionState,'completed');assert.equal(terminal.runId,pkg.experimentIdentity)
 assert.equal(terminal.executionPackage.path,pkg.outputRoot+'/package.json')
 assert.equal(policy.sourceTerminal.path,pkg.outputRoot+'/terminal.json')
 assert.equal(policy.sourceCheckpoint.path,pkg.outputRoot+'/checkpoint-final.pt')
 const mixed=policy.sourceKind==='mixed-train',single149=policy.sourceKind==='single149-fit'
 assert.ok(policy.sourceKind===undefined||mixed||single149,'unknown review source kind')
 assert.ok((single149?single149Succeeded:mixed?rehearsalSucceeded:twoMapExperimentSucceeded)(result,pkg,terminal.exitCode,terminal.timedOut),'source is not successful declared training')
 assert.ok(result.artifacts.some(b=>b.path===policy.sourceCheckpoint.path&&b.sha256===policy.sourceCheckpoint.sha256))
}
export function reviewDecision(audits){
 assert.equal(audits.length,10)
 assert.equal(new Set(audits.map(a=>a.sampleId)).size,10)
 assert.deepEqual(audits.slice(0,2).map(a=>a.sampleId),twoMapSamples)
 assert.ok(audits.every((a,i)=>a.split===(i<2?'train':'validation')))
 for(const a of audits){assert.equal(typeof a.passed,'boolean');assert.ok(Array.isArray(a.issueCodes));assert.equal(a.passed,a.issueCodes.length===0)}
 const failed=audits.filter(a=>!a.passed)
 return {visualOutcome:failed.length?'failed':'component_checks_passed_not_qualified',failedSampleIds:failed.map(a=>a.sampleId),issueCodes:[...new Set(failed.flatMap(a=>a.issueCodes))],...flags}
}

export async function stopReviewWorker(child,{closed=false,timeoutMs=10000,stop=null}={}){
 if(closed||!ownedWorkerIsRunning(child))return {alreadyStopped:true}
 return await new Promise((resolve,reject)=>{
  const done=()=>{clearTimeout(timer);child.removeListener('close',done);resolve({alreadyStopped:false})}
  const timer=setTimeout(()=>{child.removeListener('close',done);reject(new Error('post-review owned worker cleanup timeout'))},timeoutMs)
  child.once('close',done)
  try{
   if(stop)stop(child)
   else if(process.platform==='win32'){
    const r=spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:8000,encoding:'utf8'})
    if(r.error)throw r.error
   }else child.kill('SIGTERM')
  }catch(e){clearTimeout(timer);child.removeListener('close',done);reject(e)}
 })
}

export async function runTwoMapPostReview({projectRoot=process.cwd()}={}){
 const root=path.resolve(projectRoot),started=Date.now(),mono=performance.now()
 const absolute=p=>{assert.equal(typeof p,'string');assert.ok(!p.includes('\\')&&!path.posix.isAbsolute(p)&&!p.includes(':')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'));return path.join(root,p)}
 const bind=p=>({path:p,sha256:sha(fs.readFileSync(absolute(p)))})
 const read=b=>{const bytes=fs.readFileSync(absolute(b.path));assert.ok(bytes.length<=16*1024**2);assert.equal(sha(bytes),b.sha256,b.path);return JSON.parse(bytes)}
 const snapshot=p=>read(bind(p))
 const put=(p,v,replace=false)=>{const file=absolute(p),bytes=Buffer.isBuffer(v)?v:Buffer.from(JSON.stringify(v,null,2)+'\n');fs.mkdirSync(path.dirname(file),{recursive:true});if(replace){const temp=file+'.'+process.pid+'.next';fs.writeFileSync(temp,bytes,{flag:'wx'});replaceHeartbeatFile(temp,file)}else fs.writeFileSync(file,bytes,{flag:'wx'});return bind(p)}
 const previous=await readCurrentExecutionRegistry(root);assert.ok(previous.ok&&previous.registry.activeExecution===null,'active execution or invalid registry')
 const latest=previous.registry.latestTrainingTerminal
 assert.ok(latest?.path&&latest?.sha256,'no verified training terminal')
 const sourceTerminal={path:latest.path,sha256:latest.sha256},terminal=read(sourceTerminal),source=read(terminal.executionPackage),result=read(terminal.result)
 const mixed=source.schemaVersion==='mixed-train-rehearsal-package-v1',single149=source.schemaVersion==='single-map-checkpoint-fit-package-v1'&&source.policy.path===single149Policy
 const policyPath=single149?SINGLE149_POST_REVIEW_POLICY:mixed?MIXED_POST_REVIEW_POLICY:POST_REVIEW_POLICY
 const declaredPolicy=read(bind(policyPath))
 assert.equal(declaredPolicy.sourceSelection,single149?'current_registry_latest_successful_single149_fit_terminal':mixed?'current_registry_latest_successful_mixed_train_terminal':'current_registry_latest_successful_two_map_training_terminal');assert.equal(declaredPolicy.automaticPostReview,true)
 assert.equal(declaredPolicy.sourceKind,single149?'single149-fit':mixed?'mixed-train':undefined)
 const checkpoints=result.artifacts.filter(b=>b.path===source.outputRoot+'/checkpoint-final.pt');assert.equal(checkpoints.length,1)
 const policy={...declaredPolicy,sourceTerminal,sourceCheckpoint:checkpoints[0]}
 validateReviewSource(policy,terminal,source,result);assert.deepEqual(bind(policy.sourceCheckpoint.path),policy.sourceCheckpoint)
 const plan=read(source.sourcePlan),manifest=read(plan.datasetManifest),validation=read(plan.validationSplit).sampleIds
 assert.equal(validation.length,8);assert.equal(new Set(validation).size,8);assert.ok(validation.every(x=>!twoMapSamples.includes(x)))
 const entry=snapshot('data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json')
 assert.ok(entry.currentEntrypoints.some(e=>e.entryFile===ENTRY))
 assert.equal(previous.registry.latestTrainingTerminal.sha256,policy.sourceTerminal.sha256,'newer training must not be reviewed by old policy')
 const programPaths=[SELF,ENTRY,POST_REVIEW_WORKER,'scripts/tests/test-ai-painter-two-map-post-review.mjs','scripts/lib/ai-painter-two-map-experiment-v1.mjs','scripts/lib/ai-assisted-condition-alignment.mjs','scripts/lib/ai-painter-mvp-detail-sufficiency-v1.mjs','scripts/lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs','src/server/local-backup/two-map-post-review-work-evidence.mjs']
 programPaths.push('ml/ai-painter/tests/test_two_map_post_review_v1.py','scripts/lib/ai-painter-mixed-train-rehearsal-v1.mjs','scripts/lib/ai-assisted-style-fingerprint.mjs','src/server/ai-painter-current-execution-registry.mjs')
 programPaths.push('scripts/lib/ai-painter-post-review-delivery-v1.mjs','src/server/local-backup/work-producers.mjs','src/server/local-backup/work-registry-consumer.mjs')
 programPaths.push('scripts/lib/ai-painter-single149-terrain-ecology-fit-v1.mjs','scripts/tests/test-ai-painter-single149-terrain-ecology-fit.mjs')
 const payload={schemaVersion:'ai-painter-two-map-post-review-package-v1',policy:bind(policyPath),trainingSourceKind:single149?'single149-fit':mixed?'mixed-train':'two-map',sourceModelCapability:source.modelCapability??'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',sourceTerminal:policy.sourceTerminal,sourcePackage:terminal.executionPackage,sourceCheckpoint:policy.sourceCheckpoint,trainSampleIds:twoMapSamples,validationSampleIds:validation,programs:programPaths.map(bind),specification:bind('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'),resources:policy.resources,...flags}
 const reviewId=(single149?'single149-post-review-v1-':mixed?'mixed-train-post-review-v1-':'two-map-post-review-v1-')+sha(JSON.stringify(payload)).slice(0,20),outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+reviewId
 const packageBinding=put(outputRoot+'/package.json',{...payload,reviewId,outputRoot})
 const proc=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${process.pid}'; $p.CreationDate.ToUniversalTime().ToString('o')`],{windowsHide:true,encoding:'utf8',timeout:10000})
 assert.equal(proc.status,0);const creation=proc.stdout.trim();assert.ok(Number.isFinite(Date.parse(creation)))
 const identity={runId:reviewId,packageId:reviewId,capabilityVersion:reviewId,processId:process.pid,processStartIdentity:process.pid+':'+creation}
 const lock=put(outputRoot+'/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity})
 const heartbeat=()=>put(outputRoot+'/heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'reviewing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120},fs.existsSync(absolute(outputRoot+'/heartbeat.json')))
 const capsule=(name,evidence)=>put(outputRoot+'/'+name,{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:reviewId,integrity:{status:'verified'},evidence:evidence.map(b=>({...b,kind:'post_training_review',sha256Verified:true}))})
 let registered=false,child=null,timer=null,heartbeatError=null,childClosed=false
 const budget=()=>{assert.ok(Date.now()-started<300000,'review wall limit');let size=0;const walk=p=>{for(const f of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,f.name);assert.ok(!f.isSymbolicLink());if(f.isDirectory())walk(q);else size+=fs.statSync(q).size}};walk(absolute(outputRoot));assert.ok(size<24*1024**2,'review output limit')}
 const commit=async(evidence,state,activity,active=null)=>{const current=await readCurrentExecutionRegistry(root);assert.ok(current.ok);assert.ok(!registered||current.registry.runId===reviewId);const cap=capsule(active?'active-capsule.json':'terminal-capsule.json',[packageBinding,evidence]);const v=await advanceCurrentExecutionRegistry({projectRoot:root,...identity,taskId:reviewId,taskKind:'readonly_post_training_visual_review',taskGoal:'Review completed weights on two fixed train views and eight validation samples; no retraining or release.',queueStatus:active?'running':state==='failed_closed'?'failed_closed':'completed',nextMachineAction:null,lifecycleStage:'isolated_implementation',executionState:state,activity,taskCapsulePath:cap.path,terminalEvidencePath:evidence.path,activeExecution:active,expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256});assert.ok(v.ok,v.errorCode);return v}
 try{
  const tests=spawnSync(process.execPath,['--test','scripts/tests/test-ai-painter-two-map-post-review.mjs'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:2**20})
  const testEvidence=put(outputRoot+'/cpu-tests.json',{executionState:tests.status===0?'completed':'failed_closed',status:tests.status===0?'review_cpu_checks_passed':'review_cpu_checks_failed',stdout:tests.stdout,stderr:tests.stderr,exitCode:tests.status,error:tests.error?.message??null})
  assert.equal(tests.status,0,'post-review own tests failed')
  const pytests=spawnSync(path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-B','-m','unittest','discover','-s','ml/ai-painter/tests','-p','test_two_map_post_review_v1.py','-v'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:2**20})
  put(outputRoot+'/cpu-lease-tests.json',{exitCode:pytests.status,stdout:pytests.stdout,stderr:pytests.stderr});assert.equal(pytests.status,0,'review lease tests failed')
  heartbeat();const active={schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'reviewing',programLineage:{controller:bind(ENTRY),reviewer:bind(SELF),worker:bind(POST_REVIEW_WORKER)},lock,heartbeat:{path:outputRoot+'/heartbeat.json',ttlSeconds:120}}
  const activeCommit=await commit(testEvidence,'reviewing','post_training_visual_review_running',active);registered=true
  timer=setInterval(()=>{try{heartbeat();budget()}catch(e){heartbeatError??=e;clearInterval(timer);timer=null;child?.kill()}},5000)
  let stdout='',stderr=''
  const exitCode=await new Promise((resolve,reject)=>{
   child=spawn(path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-B',absolute(POST_REVIEW_WORKER),packageBinding.path,packageBinding.sha256],{cwd:root,windowsHide:true,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',PYTHONIOENCODING:'utf-8',PYTHONUNBUFFERED:'1'},stdio:['ignore','pipe','pipe']})
   assert.ok(Number.isInteger(child.pid));put(outputRoot+'/worker-lease.json',{reviewId,controllerPid:process.pid,launcherPid:child.pid,controllerStartIdentity:identity.processStartIdentity,registryRevision:activeCommit.registry.registryRevision})
   child.stdout.on('data',b=>{stdout+=b.toString();if(Buffer.byteLength(stdout)>2**20)child.kill()});child.stderr.on('data',b=>{stderr+=b.toString();if(Buffer.byteLength(stderr)>2**20)child.kill()});child.once('error',reject);child.once('close',(code)=>{childClosed=true;resolve(code)})
  })
  put(outputRoot+'/worker-streams.json',{exitCode,stdout,stderr});assert.ifError(heartbeatError);assert.equal(exitCode,0,'post-review inference failed');budget()
  const inferenceBinding=JSON.parse(stdout.trim()),inference=read(inferenceBinding)
  assert.equal(inferenceBinding.path,outputRoot+'/inference.json');assert.equal(inference.reviewId,reviewId);assert.deepEqual(inference.executionPackage,packageBinding)
  assert.deepEqual(inference.actualCalls,{generatorForwards:10,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0});assert.deepEqual(inference.stateBefore,inference.stateAfter)
  assert.deepEqual(inference.observations.map(r=>r.sampleId),[...twoMapSamples,...validation]);assert.equal(inference.optimizerUpdates,0);assert.equal(inference.gpuInitialized,false)
  const thresholds=read(policy.numericReview),detailContract=read(policy.detailReview),audits=[];sharp.concurrency(2)
  for(const observation of inference.observations){
   heartbeat();budget();const n=audits.length,id=observation.identity;assert.equal(observation.split,n<2?'train':'validation');assert.equal(id.sampleId,observation.sampleId)
   for(const b of [observation.prediction,id.image,id.conditionPack])assert.deepEqual(bind(b.path),b)
   const projection=put(outputRoot+`/auditor-projection-${n}.png`,await sharp(absolute(observation.prediction.path)).resize(1024,768,{kernel:'nearest'}).png().toBuffer())
   const detail=await auditMvp256DetailSufficiency({candidatePath:absolute(observation.prediction.path),referencePath:absolute(id.image.path),contract:detailContract})
   const aesthetic=await auditProfessionalAestheticFromFrozenContract({imagePath:absolute(observation.prediction.path),thresholdContract:thresholds,styleFingerprintPath:absolute(thresholds.styleFingerprint.path),expectedStyleFingerprintSha256:thresholds.styleFingerprint.sha256})
   const alignment=await auditAiAssistedConditionAlignment({record:{recordId:reviewId+'-'+n,conditionBinding:{conditionPackPath:id.conditionPack.path,worldId:id.worldId,tick:id.tick},classification:{monsoonSeason:observation.monsoonSeason,regionalLandscapeType:null}},imagePath:projection.path,referenceImagePath:id.image.path})
   const issueCodes=[...detail.issueCodes,...aesthetic.issues.map(i=>i.code),...alignment.issues.map(i=>i.code)]
   const evidence=put(outputRoot+`/audit-${n}.json`,{sampleId:observation.sampleId,split:observation.split,prediction:observation.prediction,reference:id.image,condition:id.conditionPack,projection,projectionIsModelOutput:false,detail,aesthetic,alignment,...flags})
   audits.push({sampleId:observation.sampleId,split:observation.split,passed:detail.passed&&aesthetic.passed&&alignment.passed,issueCodes,evidence})
  }
  const decision=reviewDecision(audits)
  for(const b of [...payload.programs,payload.policy,payload.specification,payload.sourceTerminal,payload.sourceCheckpoint,...inference.inputs])assert.deepEqual(bind(b.path),b)
  const report=put(outputRoot+'/review.json',{schemaVersion:'ai-painter-two-map-post-review-result-v1',reviewId,sourceRunId:terminal.runId,executionPackage:packageBinding,sourceTerminal:policy.sourceTerminal,sourceCheckpoint:policy.sourceCheckpoint,inference:inferenceBinding,audits,...decision,limits:policy.resources,qualificationScope:'numeric_visual_components_only_not_instance_recognition_or_formal_stage',nextDiagnostic:{action:decision.visualOutcome==='failed'?'inspect_failed_object_alignment_and_cross_map_regression':'independent_semantic_and_generalization_review',automaticTraining:false}})
  clearInterval(timer);timer=null;assert.ifError(heartbeatError)
  const final=put(outputRoot+'/terminal.json',{schemaVersion:POST_REVIEW_SCHEMA,status:decision.visualOutcome==='failed'?'post_training_visual_review_failed':'post_training_component_checks_passed_not_qualified',executionState:'completed',runId:reviewId,packageId:reviewId,executionPackage:packageBinding,sourceRunId:terminal.runId,sourceTerminal:policy.sourceTerminal,report,visualOutcome:decision.visualOutcome,recordedAtUtc:new Date().toISOString(),startedAtUtc:new Date(started).toISOString(),elapsedSeconds:(performance.now()-mono)/1000,optimizerUpdates:0,gpuInitialized:false,...flags})
  await commit(final,'completed','post_training_visual_review_completed');console.log(JSON.stringify({terminal:final,report,visualOutcome:decision.visualOutcome,failedSamples:decision.failedSampleIds.length}));return {terminal:final,report}
 }catch(error){
  if(timer)clearInterval(timer);timer=null
  let cleanupError=null
  try{await stopReviewWorker(child,{closed:childClosed})}catch(e){cleanupError=e.stack}
  const failure=put(outputRoot+'/failure.json',{schemaVersion:POST_REVIEW_SCHEMA,status:'post_training_review_execution_failed',executionState:'failed_closed',runId:reviewId,packageId:reviewId,executionPackage:packageBinding,sourceRunId:terminal.runId,sourceTerminal:policy.sourceTerminal,visualOutcome:'unknown',recordedAtUtc:new Date().toISOString(),error:error.stack,heartbeatPublication:error.heartbeatPublication??heartbeatError?.heartbeatPublication??null,cleanupError,optimizerUpdates:0,gpuInitialized:false,...flags})
  if(registered)await commit(failure,'failed_closed','post_training_visual_review_execution_failed');throw error
 }finally{if(timer)clearInterval(timer)}
}
