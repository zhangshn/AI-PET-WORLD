// Internal adapters for the EXISTING materializer and six-phase engine.
// No public command, legacy entry dispatch, parallel store or automatic restart.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { createNativeOwnerCommand, nativeOwnerSourceIdentity } from "./lib/ai-painter-owned-worker-native-v1.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"
import { replaceHeartbeatFile } from "./run-ai-painter-learning-capacity-experiment.mjs"
import { processIdentity } from "./run-ai-painter-mvp256-dry-v24-training.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditMvp256DetailSufficiency } from "./lib/ai-painter-mvp-detail-sufficiency-v1.mjs"
import { auditProfessionalAestheticFromFrozenContract } from "./lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs"
import { decodeV17ResponsibilityArtifact } from "./lib/ai-painter-stage4-mvp-v17-responsibility-artifact.mjs"
import { decideMvp256DryReview } from "./lib/ai-painter-mvp256-dry-review-decision-v1.mjs"
import { CAPABILITY, inside, read, json, bind, write, sha, loadContext, validateCompleted } from "./lib/ai-painter-mvp256-dry-detail-weight-package-chain-v1.mjs"
const SELF=fileURLToPath(import.meta.url),STREAM=8*1024*1024

export function validateNativeReceipt({proof,ownerPid,bindingBase64,ownerClosed,protocolError,stdoutBytes,stderrBytes}) {
  return ownerClosed===true && !protocolError && proof!==null && typeof proof==="object" && Number.isInteger(ownerPid) && ownerPid>0 && proof.ownerPid===ownerPid && Number.isInteger(proof.rootPid) && proof.rootPid>0 && typeof proof.rootCreationDateUtc==="string" && proof.rootCreationDateUtc.length>0 && proof.bindingBase64===bindingBase64
    && proof.assignedBeforeResume===true && proof.killOnJobClose===true && proof.activeProcessesAfterCleanup===0
    && !proof.observationError && !proof.cleanupError && proof.stdoutBytes===stdoutBytes && proof.stderrBytes===stderrBytes
}
export function nativeBudget(phase){assert.ok(["cpu","qualification","training","review"].includes(phase));return {timeoutMs:phase==="training"?2700000:phase==="qualification"?600000:phase==="review"?120000:120000,streamBytes:STREAM,outputBytes:phase==="training"?128*1024**2:phase==="cpu"?8*1024**2:16*1024**2}}
function directoryBytes(file){if(!fs.existsSync(file))return 0;return fs.readdirSync(file,{withFileTypes:true}).reduce((sum,e)=>{const child=path.join(file,e.name);assert.equal(fs.lstatSync(child).isSymbolicLink(),false,"output junction prohibited");return sum+(e.isDirectory()?directoryBytes(child):e.isFile()?fs.statSync(child).size:0)},0)}
export function cleanupForCurrentCall(error,lastReceipt){return Object.hasOwn(error,"ownedReceipt")?error.ownedReceipt?.cleanupConfirmed===true:lastReceipt?.cleanupConfirmed===true}

export async function runNative({root,outputRoot,phase,executable,args,onHeartbeat=()=>{},abortReason=()=>null}) {
  assert.equal(process.platform,"win32");const budget=nativeBudget(phase),started=Date.now(),deadline=started+budget.timeoutMs-1000
  const guardRoot=inside(root,".runtime/ai-painter/owned-worker-guards"),guardPath=path.join(guardRoot,"active.json")
  fs.mkdirSync(guardRoot,{recursive:true});const id=crypto.randomUUID(),scope=`${outputRoot}/owned-${phase}-${id}`
  fs.mkdirSync(inside(root,scope),{recursive:true})
  const record={identity:id,runnerPid:process.pid,recordedAtUtc:new Date().toISOString(),executable,
    executableSha256:sha(fs.readFileSync(executable)),helperSha256:sha(fs.readFileSync(SELF)),nativeOwnerSource:nativeOwnerSourceIdentity(),
    commandSha256:sha(JSON.stringify(args)),startedEvidence:inside(root,scope+"/started.json")},guardBytes=JSON.stringify(record)
  fs.writeFileSync(guardPath,guardBytes,{flag:"wx"}) // existing/unknown guard is never taken over
  const accountingRoots=phase==="review"?[outputRoot,outputRoot.replace(/-owned$/u,"")]:[outputRoot]
  const outputBytes=()=>accountingRoots.reduce((n,r)=>n+directoryBytes(inside(root,r)),0)+Buffer.byteLength(guardBytes)
  let command
  try{command=createNativeOwnerCommand(executable,args,root,deadline,1000,record,guardBytes);assert.ok(outputBytes()<=budget.outputBytes-65536,"native build budget")}
  catch(error){error.ownedReceipt={phase,cleanupConfirmed:false,guard:{path:guardPath,state:"retained"},error:String(error)};try{error.receiptBinding=write(root,scope+"/original-receipt.json",error.ownedReceipt)}catch(secondary){error.secondaryEvidenceError=String(secondary)}throw error}
  return new Promise((resolve,reject)=>{
    let child;try{child=spawn(command.executable,command.args,{cwd:root,env:{...process.env,DETAIL_WEIGHT_OUTPUT_ROOTS:JSON.stringify(accountingRoots),DETAIL_WEIGHT_BUDGET_PROJECT_ROOT:root,DETAIL_WEIGHT_OUTPUT_MAX:String(budget.outputBytes),OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2",OPENBLAS_NUM_THREADS:"2",PYTHONDONTWRITEBYTECODE:"1"},windowsHide:true,shell:false,stdio:["pipe","pipe","pipe"]})}catch(error){error.ownedReceipt={phase,cleanupConfirmed:false,error:String(error),guard:{path:guardPath,state:"retained"}};try{error.receiptBinding=write(root,scope+"/original-receipt.json",error.ownedReceipt)}catch(secondary){error.secondaryEvidenceError=String(secondary)}reject(error);return}
    let timer,force,final;let pending="",proof=null,protocolError=null,ownerError="",closed=false,stopReason=null,settled=false
    const buffers={stdout:[],stderr:[]},counts={stdout:0,stderr:0}
    const stop=reason=>{if(!stopReason){stopReason=String(reason).slice(0,2048);if(!child.stdin.destroyed){try{child.stdin.write(Buffer.from(stopReason).toString("base64")+"\n")}catch(error){protocolError??=String(error)}}}}
    const finish=()=>{
      if(settled)return;settled=true;clearInterval(timer);clearTimeout(force);clearTimeout(final);child.stdin.destroy();child.stdout.destroy();child.stderr.destroy()
      const confirmed=validateNativeReceipt({proof,ownerPid:child.pid,bindingBase64:command.bindingBase64,ownerClosed:closed,protocolError,stdoutBytes:counts.stdout,stderrBytes:counts.stderr})
      const receipt={schema:"detail-weight-live-native-owner-receipt-v1",phase,budget,ownerIdentity:{pid:child.pid,identitySource:"retained_child_handle"},ownerClosed:closed,
        proof,protocolError,ownerError,workerStderrTail:Buffer.concat(buffers.stderr).toString("utf8").slice(-8192),stopReason,streamBytes:counts,nativeBuild:command.nativeBuild,guard:{path:guardPath,identity:id,state:"retained"},cleanupConfirmed:false,elapsedMs:Date.now()-started}
      try{
        // Original compact live receipt is persisted before optional audits.
        write(root,scope+"/original-receipt.json",receipt)
        if(confirmed){assert.equal(fs.readFileSync(guardPath,"utf8"),guardBytes);fs.unlinkSync(guardPath);receipt.cleanupConfirmed=true;receipt.guard.state="released_after_live_empty_job"}
        write(root,scope+"/release-receipt.json",receipt)
        assert.ok(outputBytes()+counts.stdout+counts.stderr<=budget.outputBytes,"owned phase total output budget")
      }catch(error){receipt.cleanupConfirmed=false;receipt.persistenceError=String(error)}
      let receiptBinding=null
      try{receiptBinding=bind(root,scope+"/release-receipt.json")}catch(error){receipt.persistenceError??=String(error)}
      const value={stdout:Buffer.concat(buffers.stdout).toString("utf8"),stderr:Buffer.concat(buffers.stderr).toString("utf8"),ownedReceipt:receipt,receiptBinding}
      if(receipt.persistenceError || !receiptBinding || !receipt.cleanupConfirmed || protocolError || stopReason || proof?.exitCode!==0 || counts.stdout>STREAM || counts.stderr>STREAM){const error=new Error(stopReason??protocolError??(proof?.exitCode ? `worker_exit_${proof.exitCode}` : receipt.persistenceError)??"native worker failed or cleanup unknown");Object.assign(error,value);reject(error)}else resolve(value)
    }
    child.stdout.on("data",chunk=>{
      pending+=chunk.toString("ascii");let index
      while((index=pending.indexOf("\n"))>=0){const line=pending.slice(0,index).trimEnd();pending=pending.slice(index+1)
        try{if(line.startsWith("O:")||line.startsWith("E:")){const name=line[0]==="O"?"stdout":"stderr",raw=Buffer.from(line.slice(2),"base64");assert.equal(raw.toString("base64"),line.slice(2));counts[name]+=raw.length;if(counts.stdout+counts.stderr>STREAM)stop("stream_limit");else buffers[name].push(raw)}
          else if(line.startsWith("R:")){assert.equal(proof,null);proof=JSON.parse(Buffer.from(line.slice(2),"base64").toString("utf8"))}else throw new Error("unknown native frame")
        }catch(error){protocolError=String(error);stop("native_protocol_error")}}
      if(pending.length>65536){protocolError="native_frame_overflow";pending="";stop(protocolError)}
    })
    child.stderr.on("data",raw=>{ownerError=(ownerError+raw.toString()).slice(0,8192)})
    child.stdin.on("error",error=>{protocolError??=String(error)})
    child.on("error",error=>{protocolError=String(error);stop(protocolError)})
    child.once("close",()=>{closed=true;if(pending.trim())protocolError??="incomplete_frame";finish()})
    timer=setInterval(()=>{try{onHeartbeat();const reason=abortReason();if(reason)stop(reason);if(Date.now()>=deadline)stop("wall_timeout");if(outputBytes()+counts.stdout+counts.stderr>budget.outputBytes-65536)stop("output_budget")}catch(error){stop(error)}},1000)
    force=setTimeout(()=>{stop("wall_timeout");try{child.kill("SIGKILL")}catch{}},Math.max(1,started+budget.timeoutMs-Date.now()-250))
    final=setTimeout(()=>{stop("cleanup_deadline");finish()},Math.max(1,started+budget.timeoutMs-Date.now()))
    try{write(root,scope+"/started.json",{...record,ownerPid:child.pid,commandBinding:command.bindingBase64})}catch(error){protocolError=String(error);stop(protocolError)}
  })
}

async function advance(context,ready,{activeExecution,evidence,state,activity,latestTrainingTerminal}) {
  const current=await readCurrentExecutionRegistry(ready.root);assert.equal(current.ok,true)
  const capsule=write(ready.root,`${ready.plan.outputRoot}/capsule-${crypto.randomUUID()}.json`,{schemaVersion:"ai-painter-local-task-capsule-v1",taskId:ready.plan.runId,
    integrity:{status:"verified"},evidence:[{...evidence,kind:"detail_weight_lifecycle_evidence",sha256Verified:true},{...bind(ready.root,ready.plan.outputRoot+"/package.json"),kind:"execution_package",sha256Verified:true}]})
  const result=await advanceCurrentExecutionRegistry({projectRoot:ready.root,capabilityVersion:CAPABILITY,packageId:ready.plan.packageId,taskId:ready.plan.runId,
    taskKind:"mvp256_dry_detail_weight_training",taskGoal:"Bounded same-model training, checkpoint and dry review.",priority:5,queueStatus:state==="executing"?"running":state,nextMachineAction:null,
    queuedAtUtc:new Date().toISOString(),runId:ready.plan.runId,lifecycleStage:"dry_single_world_256x192",executionState:state,activity,
    taskCapsulePath:capsule.path,terminalEvidencePath:evidence.path,activeExecution,...(latestTrainingTerminal?{latestTrainingTerminal}:{}),
    expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256})
  assert.equal(result.ok,true);return result
}
function heartbeat(context,ready,identity){
  context.heartbeat();const file=inside(ready.root,ready.plan.outputRoot+"/heartbeat.json"),value=JSON.parse(fs.readFileSync(file,"utf8"));assert.equal(value.processStartIdentity,identity.processStartIdentity)
  value.heartbeatAtUtc=new Date().toISOString();const staged=file+".staged-"+crypto.randomUUID();fs.writeFileSync(staged,JSON.stringify(value),{flag:"wx"});replaceHeartbeatFile(staged,file)
}
export async function preflight(context){
  const ready=loadContext(context)
  write(ready.root,ready.plan.outputRoot+"/package.json",{schemaVersion:"ai-painter-current-training-package-v1",runId:ready.plan.runId,packageId:ready.plan.packageId,capabilityVersion:CAPABILITY,
    outputRoot:ready.plan.outputRoot,resolution:[256,192],trainingPlan:{epochs:48,generatorOptimizerSteps:2304,discriminatorOptimizerSteps:2304,checkpointSelection:ready.plan.configuration.checkpointSelection},resourceBudget:ready.plan.configuration.executionCeiling,
    observation:{progressPath:ready.plan.outputRoot+"/progress.json"},autonomousExecutionPackage:ready.packageBinding,observationOnly:true})
  const file=inside(ready.root,"ml/ai-painter/.venv/Scripts/python.exe")
  const result=await runNative({root:ready.root,outputRoot:ready.plan.outputRoot,phase:"cpu",executable:file,args:["-B",inside(ready.root,ready.plan.programBindings.worker.path),"--preflight","--package",ready.packageBinding.path,"--sha256",ready.packageBinding.sha256],onHeartbeat:context.heartbeat})
  assert.equal(JSON.parse(result.stdout).status,"own_managed_preflight_passed")
  return {status:"passed",preflight:write(ready.root,ready.plan.outputRoot+"/preflight.json",{status:"passed",executionPackage:ready.packageBinding,ownedReceipt:result.receiptBinding})}
}
export async function execute(context){
  const ready=loadContext(context),{root,plan,packageBinding}=ready,current=await readCurrentExecutionRegistry(root)
  assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null)
  write(root,plan.outputRoot+"/execution-consumed.json",{executionPackage:packageBinding,attempt:1,automaticRetries:0})
  const identity={capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,processId:process.pid,processStartIdentity:processIdentity(process.pid)}
  const lock=write(root,plan.outputRoot+"/execution-lock.json",{schemaVersion:"ai-painter-current-active-execution-lock-v1",...identity})
  write(root,plan.outputRoot+"/heartbeat.json",{schemaVersion:"ai-painter-current-active-execution-heartbeat-v1",...identity,executionState:"executing",heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120})
  const active={schemaVersion:"ai-painter-current-active-execution-v1",...identity,executionState:"executing",programLineage:plan.programBindings,lock,heartbeat:{path:plan.outputRoot+"/heartbeat.json",ttlSeconds:120}}
  const dispatch=write(root,plan.outputRoot+"/dispatched.json",{status:"qualification_pending",executionState:"completed",runId:plan.runId,executionPackage:packageBinding,trainingStarted:false})
  await advance(context,ready,{activeExecution:active,evidence:dispatch,state:"executing",activity:"gpu_qualification_pending"})
  const executable=inside(root,"ml/ai-painter/.venv/Scripts/python.exe"),base=["--package",packageBinding.path,"--sha256",packageBinding.sha256]
  let lastReceipt=null
  try{
    const gate=await runNative({root,outputRoot:plan.outputRoot,phase:"qualification",executable,args:["-B",inside(root,plan.programBindings.gpuQualifier.path),...base],onHeartbeat:()=>heartbeat(context,ready,identity)})
    lastReceipt=gate.ownedReceipt;const gpu=JSON.parse(gate.stdout);read(root,gpu)
    lastReceipt=null // new owned call requires its own cleanup proof
    const trained=await runNative({root,outputRoot:plan.outputRoot,phase:"training",executable,args:["-B",inside(root,plan.programBindings.worker.path),...base,"--gpu",gpu.path,"--gpu-sha256",gpu.sha256],onHeartbeat:()=>heartbeat(context,ready,identity)})
    lastReceipt=trained.ownedReceipt;const terminal=JSON.parse(trained.stdout),body=json(root,terminal);validateCompleted(body,packageBinding,plan)
    await advance(context,ready,{activeExecution:null,evidence:terminal,state:"completed",activity:"training_completed_review_pending",latestTrainingTerminal:{runId:plan.runId,...terminal,status:body.status}})
    return {status:"passed",workerTerminal:terminal,ownedReceipt:trained.receiptBinding}
  }catch(error){
    let workerTerminal=null,body=null
    try{workerTerminal=bind(root,plan.outputRoot+"/worker-terminal.json");body=json(root,workerTerminal);assert.equal(body.runId,plan.runId);assert.equal(body.status,"failed_closed")}catch{workerTerminal=null;body=null}
    const failure=write(root,plan.outputRoot+"/execution-failure.json",{status:"failed_closed",executionState:"failed_closed",runId:plan.runId,capabilityVersion:CAPABILITY,packageId:plan.packageId,executionPackage:packageBinding,workerTerminal,optimizerStepsGenerator:body?.optimizerStepsGenerator??null,optimizerStepsDiscriminator:body?.optimizerStepsDiscriminator??null,completedEpochs:body?.completedEpochs??null,error:String(error),cleanupConfirmed:cleanupForCurrentCall(error,lastReceipt)})
    if(cleanupForCurrentCall(error,lastReceipt))await advance(context,ready,{activeExecution:null,evidence:failure,state:"failed_closed",activity:"failed_closed",...(workerTerminal?{latestTrainingTerminal:{runId:plan.runId,...workerTerminal,status:body.status}}:{})})
    throw error // unknown cleanup retains active identity and guard; no replay
  }
}
export async function validate(context){const ready=loadContext(context),terminal=bind(ready.root,ready.plan.outputRoot+"/worker-terminal.json"),body=json(ready.root,terminal);validateCompleted(body,ready.packageBinding,ready.plan);for(const r of body.checkpoints)read(ready.root,r.checkpoint);return {status:"passed",workerTerminal:terminal}}
export async function review(context){
  const ready=loadContext(context),{root,plan}=ready,terminal=bind(root,plan.outputRoot+"/worker-terminal.json")
  const result=await runNative({root,outputRoot:plan.outputRoot+"/dry-review-owned",phase:"review",executable:inside(root,"ml/ai-painter/.venv/Scripts/python.exe"),args:["-B",inside(root,plan.programBindings.cpuReview.path),"--package",ready.packageBinding.path,"--sha256",ready.packageBinding.sha256,"--terminal",terminal.path,"--terminal-sha256",terminal.sha256],onHeartbeat:context.heartbeat})
  const reportBinding=JSON.parse(result.stdout),report=json(root,reportBinding),candidate=json(root,plan.sourceCandidate),scope=json(root,candidate.frozenBindings.dryScope)
  assert.equal(report.subject.sampleId,candidate.scope.subjectSampleId);assert.equal(report.subject.split,"validation")
  for(const key of ["worldId","regionId","tick","factHash","conditionPack"])assert.deepEqual(report.subject[key],scope.preselectedSubject[key])
  const roles=decodeV17ResponsibilityArtifact({archiveBytes:read(root,report.responsibility.archive),evidence:report.responsibility.evidence,
    expectedIdentity:{worldId:report.subject.worldId,regionId:report.subject.regionId,tick:report.subject.tick,factHash:report.subject.factHash,
      visualFactManifestSha256:report.subject.visualFactManifestSha256,conditionPackSha256:report.subject.conditionPack.sha256,modelStateSha256:report.subject.modelStateSha256},
    schemaBytes:read(root,report.responsibility.interface),schemaSha256:report.responsibility.interface.sha256,candidatePackSchemaVersion:json(root,report.responsibility.interface).candidatePackSchemaVersion})
  const meta=await sharp(read(root,report.candidateRgb)).metadata();assert.deepEqual([meta.width,meta.height],[256,192])
  const projection=write(root,plan.outputRoot+"/dry-review/auditor-input-1024.png",await sharp(read(root,report.candidateRgb)).resize(1024,768,{kernel:"nearest"}).png().toBuffer())
  const thresholds=json(root,candidate.frozenBindings.numericReview),manifest=json(root,plan.datasetManifest),source=json(root,manifest.sourceIndex),row=source.samples.find(r=>r.sampleId===report.subject.sampleId)
  assert.equal(row.split,"validation");assert.deepEqual(row.image,report.subject.referenceRgb)
  const detail=await auditMvp256DetailSufficiency({candidatePath:inside(root,report.candidateRgb.path),referencePath:inside(root,row.image.path),contract:json(root,candidate.frozenBindings.detailReview)})
  const aesthetic=await auditProfessionalAestheticFromFrozenContract({imagePath:inside(root,report.candidateRgb.path),thresholdContract:thresholds,styleFingerprintPath:inside(root,thresholds.styleFingerprint.path),expectedStyleFingerprintSha256:thresholds.styleFingerprint.sha256})
  const alignment=await auditAiAssistedConditionAlignment({record:{recordId:plan.runId+"-dry-review",conditionBinding:{conditionPackPath:report.subject.conditionPack.path,worldId:report.subject.worldId,tick:report.subject.tick},classification:{monsoonSeason:row.monsoonSeason,regionalLandscapeType:null}},imagePath:inside(root,projection.path),referenceImagePath:inside(root,row.image.path)})
  const decision=decideMvp256DryReview({scope:scope.preselectedSubject,candidate:{sampleId:report.subject.sampleId,split:"validation",resolution:[256,192]},detail,aesthetic,alignment,responsibilityRoleCount:roles.roleOrder.length})
  assert.equal(typeof report.validationImprovedWithoutMeanRgbRegression,"boolean")
  if(!report.validationImprovedWithoutMeanRgbRegression){decision.status="dry_single_world_review_failed_closed";decision.issueCodes.push("validation_not_improved_without_mean_rgb_regression")}
  const audit=write(root,plan.outputRoot+"/dry-review/machine-audit.json",{...decision,runId:plan.runId,selectedCheckpoint:report.selectedCheckpoint,validationImprovedWithoutMeanRgbRegression:report.validationImprovedWithoutMeanRgbRegression,executionPackage:ready.packageBinding,input:reportBinding,detail,aesthetic,alignment})
  return {status:"passed",reviewOutcome:decision.status==="dry_single_world_review_failed_closed"?"machine_reviews_failed":"machine_reviews_completed",audit}
}
export async function adjudicate(context){const ready=loadContext(context),audit=bind(ready.root,ready.plan.outputRoot+"/dry-review/machine-audit.json"),body=json(ready.root,audit);assert.deepEqual(body.executionPackage,ready.packageBinding);assert.equal(body.formalStage4QualificationGranted,false);assert.equal(body.runtimePublicationGranted,false);return {status:"passed",audit,decision:body.status}}
export async function finalize(context){const ready=loadContext(context),audit=json(ready.root,bind(ready.root,ready.plan.outputRoot+"/dry-review/machine-audit.json"));const completed=audit.status==="dry_single_world_numeric_passed_visual_approval_pending";const finalization=write(ready.root,ready.plan.outputRoot+"/finalization.json",{status:completed?"bounded_comparison_completed_no_visual_release":"dry_review_failed_closed",executionState:completed?"completed":"failed_closed",runId:ready.plan.runId,executionPackage:ready.packageBinding,automaticRetries:0,formalStage4QualificationGranted:false,runtimePublicationGranted:false});await advance(context,ready,{activeExecution:null,evidence:finalization,state:completed?"completed":"failed_closed",activity:completed?"bounded_comparison_completed_no_visual_release":"dry_review_failed_closed"});return completed?{status:"passed",finalization}:{status:"failed",failureKind:"visual",failureCode:"dry_review_failed",summaryZh:"原审核器拒绝预选场景；不重训、不授予资格。",finalization}}
