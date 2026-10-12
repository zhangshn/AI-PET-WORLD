// Internal adapters for the EXISTING materializer and six-phase engine.
// No public command, legacy entry dispatch, parallel store or automatic restart.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { createNativeOwnerCommand, nativeOwnerSourceIdentity, nativeBuildFailureObservation } from "./lib/ai-painter-owned-worker-native-v1.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"
import { replaceHeartbeatFile } from "./run-ai-painter-learning-capacity-experiment.mjs"
import { processIdentity } from "./run-ai-painter-mvp256-dry-v24-training.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditMvp256DetailSufficiency } from "./lib/ai-painter-mvp-detail-sufficiency-v1.mjs"
import { auditProfessionalAestheticFromFrozenContract } from "./lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs"
import { decodeV17ResponsibilityArtifact } from "./lib/ai-painter-stage4-mvp-v17-responsibility-artifact.mjs"
import { decideMvp256DryReview } from "./lib/ai-painter-mvp256-dry-review-decision-v1.mjs"
import { CAPABILITY, inside, read, json, bind, write, sha, loadContext, validatePlan, effectiveExecutionCeiling, validateCompleted, withOutputBudget, directoryBytes } from "./lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs"
const SELF=fileURLToPath(import.meta.url),STREAM=8*1024*1024
const PROOF_BYTES=65536,OUTER_TERMINAL_BYTES=65536

export function validateNativeReceipt({proof,ownerPid,bindingBase64,ownerClosed,protocolError,stdoutBytes,stderrBytes}) {
  return ownerClosed===true && !protocolError && proof!==null && typeof proof==="object" && Number.isInteger(ownerPid) && ownerPid>0 && proof.ownerPid===ownerPid && Number.isInteger(proof.rootPid) && proof.rootPid>0 && typeof proof.rootCreationDateUtc==="string" && proof.rootCreationDateUtc.length>0 && proof.bindingBase64===bindingBase64
    && proof.assignedBeforeResume===true && proof.killOnJobClose===true && proof.activeProcessesAfterCleanup===0
    && !proof.observationError && !proof.cleanupError && proof.stdoutBytes===stdoutBytes && proof.stderrBytes===stderrBytes
}
export function nativeBudget(phase,{root,plan}={}){assert.ok(["cpu","qualification","training","review"].includes(phase));let trainingMs=2700000;if(plan){validatePlan(root,plan);trainingMs=effectiveExecutionCeiling(root,plan).maxWallSeconds*1000}return {timeoutMs:phase==="training"?trainingMs:phase==="qualification"?600000:120000,streamBytes:STREAM,outputBytes:phase==="training"?128*1024**2:phase==="cpu"?8*1024**2:16*1024**2}}
export function priorReviewBudget(root,outputRoot,priorBinding){
  const prior=json(root,priorBinding)
  assert.equal(prior.phase,"review");assert.equal(prior.cleanupConfirmed,true);assert.equal(prior.ownerClosed,true)
  assert.equal(prior.proof?.activeProcessesAfterCleanup,0);assert.equal(prior.proof?.exitCode,1)
  assert.equal(prior.budget.outputBytes,16*1024**2);assert.equal(prior.budget.timeoutMs,120000)
  assert.ok(Number.isSafeInteger(prior.elapsedMs)&&prior.elapsedMs>0&&prior.elapsedMs<120000)
  const base=outputRoot.replace(/\/review-recovery-v1\/dry-review-owned$/u,"")
  assert.notEqual(base,outputRoot);assert.ok(priorBinding.path.startsWith(base+"/dry-review-owned/owned-review-"))
  assert.deepEqual(prior.outputAccountingRoots.slice(0,2),[base+"/dry-review-owned",base+"/dry-review"])
  assert.match(prior.outputAccountingRoots[2],/^\.runtime\/ai-painter\/owned-worker-guards\/[a-f0-9-]{36}$/u)
  for(const r of prior.outputAccountingRoots)directoryBytes(inside(root,r))
  assert.ok(Number.isSafeInteger(prior.streamBytes.stdout)&&Number.isSafeInteger(prior.streamBytes.stderr)&&prior.streamBytes.stdout>=0&&prior.streamBytes.stderr>=0)
  return {prior,remainingMs:120000-prior.elapsedMs,priorStreamBytes:prior.streamBytes.stdout+prior.streamBytes.stderr}
}
export function cleanupForCurrentCall(error,lastReceipt){return Object.hasOwn(error,"ownedReceipt")?error.ownedReceipt?.cleanupConfirmed===true:lastReceipt?.cleanupConfirmed===true}

export function reviewRecoveryAccounting(root,outputRoot,nativeEvidenceRoot,priorBudget,failureBinding){
  const recoveryRoot=outputRoot.replace(/\/dry-review-owned$/u,"")
  assert.notEqual(recoveryRoot,outputRoot)
  assert.ok(recoveryRoot.endsWith("/review-recovery-v1"))
  const failure=json(root,failureBinding)
  assert.equal(failure.phase,"review");assert.equal(failure.result?.failureCode,"adapter_exception")
  const externalEvidenceBytes=read(root,failureBinding).length
  return {roots:[recoveryRoot,nativeEvidenceRoot,...priorBudget.prior.outputAccountingRoots],externalEvidenceBytes}
}

function nativeEvidenceNamespace(root,outputRoot,currentScope){
  const logical=outputRoot+"/native-evidence-root.json",file=inside(root,logical)
  const key=sha(outputRoot).slice(0,32),namespace=[key.slice(0,8),key.slice(8,12),key.slice(12,16),key.slice(16,20),key.slice(20)].join("-")
  const expectedRoot=`.runtime/ai-painter/owned-worker-guards/${namespace}`
  if(!fs.existsSync(file)){
    const siblings=fs.readdirSync(inside(root,outputRoot)).filter(name=>name.startsWith("owned-")&&outputRoot+"/"+name!==currentScope)
    assert.equal(siblings.length,0,"previous call exists but namespace pointer is missing")
    const nativeEvidenceRoot=expectedRoot
    assert.equal(fs.existsSync(inside(root,nativeEvidenceRoot)),false,"existing namespace cannot be silently replaced")
    fs.mkdirSync(inside(root,nativeEvidenceRoot),{recursive:false})
    const value={schema:"detail-weight-native-evidence-root-v1",outputRoot,nativeEvidenceRoot}
    write(root,nativeEvidenceRoot+"/binding.json",value);write(root,logical,value)
  }
  const binding=bind(root,logical),value=json(root,binding)
  assert.deepEqual(Object.keys(value).sort(),["nativeEvidenceRoot","outputRoot","schema"])
  assert.equal(value.schema,"detail-weight-native-evidence-root-v1");assert.equal(value.outputRoot,outputRoot)
  assert.equal(value.nativeEvidenceRoot,expectedRoot,"namespace identity must derive from this Run outputRoot")
  assert.match(value.nativeEvidenceRoot,/^\.runtime\/ai-painter\/owned-worker-guards\/[a-f0-9-]{36}$/u)
  assert.deepEqual(read(root,bind(root,value.nativeEvidenceRoot+"/binding.json")),read(root,binding))
  return value.nativeEvidenceRoot
}
export function nativeAccountingRoots(root,outputRoot,nativeEvidenceRoot,cpuAccountingRoot=null,phase="cpu"){
  const roots=cpuAccountingRoot?[cpuAccountingRoot]:phase==="review"?[outputRoot,outputRoot.replace(/-owned$/u,"")]:[outputRoot]
  const namespaces=new Set(nativeEvidenceRoot?[nativeEvidenceRoot]:[])
  if(cpuAccountingRoot){
    assert.ok(outputRoot.startsWith(cpuAccountingRoot+"/"),"CPU output must belong to its accounting task")
    // Only this explicitly bound CPU task is inspected, never historical GPU
    // directories or alternative current execution registries.
    const visit=logical=>{const entries=fs.readdirSync(inside(root,logical),{withFileTypes:true})
      if(entries.some(entry=>entry.isDirectory()&&entry.name.startsWith("owned-cpu-")))assert.ok(entries.some(entry=>entry.isFile()&&entry.name==="native-evidence-root.json"),"prior CPU owned call is missing its namespace pointer")
      for(const entry of entries){
      const child=logical+"/"+entry.name;assert.equal(fs.lstatSync(inside(root,child)).isSymbolicLink(),false,"output junction prohibited")
      if(entry.isDirectory())visit(child)
      else if(entry.isFile()&&entry.name==="native-evidence-root.json"){
        const value=json(root,bind(root,child)),runRoot=logical,key=sha(runRoot).slice(0,32)
        const expected=".runtime/ai-painter/owned-worker-guards/"+[key.slice(0,8),key.slice(8,12),key.slice(12,16),key.slice(16,20),key.slice(20)].join("-")
        assert.deepEqual(Object.keys(value).sort(),["nativeEvidenceRoot","outputRoot","schema"])
        assert.equal(value.schema,"detail-weight-native-evidence-root-v1");assert.equal(value.outputRoot,runRoot);assert.equal(value.nativeEvidenceRoot,expected,"CPU namespace must derive from its Run")
        assert.deepEqual(read(root,bind(root,child)),read(root,bind(root,expected+"/binding.json")))
        namespaces.add(expected);assert.ok(namespaces.size<=31,"CPU namespace bound exceeded")
      }
    }}
    if(fs.existsSync(inside(root,cpuAccountingRoot)))visit(cpuAccountingRoot)
  }
  return [...new Set([...roots,...namespaces])]
}
export async function withNativeReceiptBudget(root,receipt,action,files=[]){
  assert.ok(Array.isArray(receipt.outputAccountingRoots)&&receipt.outputAccountingRoots.length<=32)
  const streams=receipt.streamBytes??{stdout:0,stderr:0};assert.ok(Number.isInteger(streams.stdout)&&streams.stdout>=0&&Number.isInteger(streams.stderr)&&streams.stderr>=0)
  const guardBytes=receipt.guard?.state==="retained"&&typeof receipt.guard.path==="string"&&fs.existsSync(receipt.guard.path)?fs.statSync(receipt.guard.path).size:0
  const maximum=receipt.budget.outputBytes-streams.stdout-streams.stderr-guardBytes
  assert.ok(Array.isArray(files)&&files.length<=2)
  const fileBytes=files.reduce((n,r)=>{const f=inside(root,r);if(!fs.existsSync(f))return n;const stat=fs.lstatSync(f);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),"explicit terminal file must be regular");return n+stat.size},0)
  if(!Number.isInteger(receipt.budget.terminalReserveBytes))return withOutputBudget({projectRoot:root,roots:receipt.outputAccountingRoots,files,maximum,reserveBytes:65536},action)
  const disk=receipt.outputAccountingRoots.reduce((n,r)=>n+directoryBytes(inside(root,r)),0)+fileBytes
  return withOutputBudget({projectRoot:root,roots:receipt.outputAccountingRoots,files,maximum:Math.min(maximum,disk+OUTER_TERMINAL_BYTES),reserveBytes:0},action)
}
export async function withNativeOrdinaryBudget(root,receipt,action){
  assert.ok(Array.isArray(receipt.outputAccountingRoots)&&receipt.outputAccountingRoots.length<=32)
  const streams=receipt.streamBytes??{stdout:0,stderr:0}
  assert.ok(Number.isSafeInteger(streams.stdout)&&streams.stdout>=0&&Number.isSafeInteger(streams.stderr)&&streams.stderr>=0)
  const guardBytes=receipt.guard?.state==="retained"&&typeof receipt.guard.path==="string"&&fs.existsSync(receipt.guard.path)?fs.statSync(receipt.guard.path).size:0
  const maximum=Math.min(receipt.budget.outputBytes,receipt.budget.ordinaryOutputLimitBytes??receipt.budget.outputBytes)-streams.stdout-streams.stderr-guardBytes
  return withOutputBudget({projectRoot:root,roots:receipt.outputAccountingRoots,maximum,reserveBytes:65536},action)
}

export async function runNative({root,outputRoot,phase,executable,args,onHeartbeat=()=>{},abortReason=()=>null,cpuAccountingRoot=null,cpuMaximumBytes=null,executionPlan=null,priorReviewReceipt=null,priorReviewFailure=null}) {
  assert.equal(process.platform,"win32");if(phase==="training"){assert.ok(executionPlan,"training native timeout requires its immutable plan");assert.equal(executionPlan.outputRoot,outputRoot)}const budget=nativeBudget(phase,executionPlan?{root,plan:executionPlan}:undefined),started=Date.now(),deadline=started+budget.timeoutMs-1000
  if(cpuAccountingRoot!==null || cpuMaximumBytes!==null){assert.equal(phase,"cpu");assert.ok([".runtime/ai-painter/detail-weight-capture-bounded-repair-t-q4-51",".runtime/ai-painter/native-startup-recovery-t-q4-55/cpu",".runtime/ai-painter/post-reboot-current-source-t-q4-58/cpu",".runtime/ai-painter/corrected-source-verification-t-q4-59/cpu",".runtime/ai-painter/output-accounting-race-repair-t-q4-60/cpu",".runtime/ai-painter/progress-publication-current-source-t-q4-61/cpu",".runtime/ai-painter/progress-publication-binding-guard-t-q4-62/cpu",".runtime/ai-painter/seventy-minute-resource-successor-t-q4-64/cpu",".runtime/ai-painter/seventy-minute-config-binding-repair-t-q4-65/cpu"].includes(cpuAccountingRoot));assert.ok(Number.isInteger(cpuMaximumBytes)&&cpuMaximumBytes>65536&&cpuMaximumBytes<=7340032);budget.outputBytes=cpuMaximumBytes}
  let priorBudget=null
  if(priorReviewReceipt!==null){assert.equal(phase,"review");priorBudget=priorReviewBudget(root,outputRoot,priorReviewReceipt);budget.timeoutMs=priorBudget.remainingMs;budget.outputBytes-=priorBudget.priorStreamBytes}
  const guardRoot=inside(root,".runtime/ai-painter/owned-worker-guards"),guardPath=path.join(guardRoot,"active.json")
  fs.mkdirSync(guardRoot,{recursive:true});const id=crypto.randomUUID(),scope=`${outputRoot}/owned-${phase}-${id}`
  if(fs.existsSync(guardPath))throw Object.assign(new Error("existing unknown guard refused"),{code:"OWNED_GUARD_BUSY",ownedReceipt:{cleanupConfirmed:false,guard:{path:guardPath,state:"existing_guard_refused"}}})
  fs.mkdirSync(inside(root,scope),{recursive:true})
  // Reuse the existing guard store's per-call namespace, not a long Run path.
  // Legacy csc creates temporary resources next to its output executable.
  const nativeEvidenceRoot=nativeEvidenceNamespace(root,outputRoot,scope)
  const record={identity:id,runnerPid:process.pid,recordedAtUtc:new Date().toISOString(),executable,
    executableSha256:sha(fs.readFileSync(executable)),helperSha256:sha(fs.readFileSync(SELF)),nativeOwnerSource:nativeOwnerSourceIdentity(),
    commandSha256:sha(JSON.stringify(args)),startedEvidence:inside(root,nativeEvidenceRoot+`/${id}-started.json`)},guardBytes=JSON.stringify(record)
  const recoveryAccounting=priorBudget?reviewRecoveryAccounting(root,outputRoot,nativeEvidenceRoot,priorBudget,priorReviewFailure):null
  if(recoveryAccounting){
    budget.originalReviewCeilingBytes=16*1024**2
    budget.previousStreamBytes=priorBudget.priorStreamBytes
    budget.previousExternalEvidence={...priorReviewFailure,bytes:recoveryAccounting.externalEvidenceBytes}
    budget.auditWorkerStreamReserveBytes=65536
    budget.outputBytes-=recoveryAccounting.externalEvidenceBytes+budget.auditWorkerStreamReserveBytes
  }else assert.equal(priorReviewFailure,null)
  const accountingRoots=[...new Set(recoveryAccounting?.roots??nativeAccountingRoots(root,outputRoot,nativeEvidenceRoot,cpuAccountingRoot,phase))]
  // Review's known final-output root may not yet exist. Materialize the exact
  // phase accounting roots once; live scans never treat vanished roots as empty.
  for(const logical of accountingRoots)fs.mkdirSync(inside(root,logical),{recursive:true})
  const outputBytes=()=>accountingRoots.reduce((n,r)=>n+directoryBytes(inside(root,r)),0)+Buffer.byteLength(guardBytes)
  let command
  try{
    command=createNativeOwnerCommand(executable,args,root,Math.min(deadline,started+budget.timeoutMs-1000),1000,record,guardBytes)
    // Reserve worst-case serialized live receipts, native observation, and
    // bounded outer terminal records. This partitions, never enlarges, the
    // existing hard ceiling. JSON string escaping needs at most six bytes per
    // retained UTF-16 code unit. Native proof frames are independently bounded.
    const template={schema:"detail-weight-live-native-owner-receipt-v1",phase,budget,ownerIdentity:{pid:4294967295,identitySource:"retained_child_handle"},ownerClosed:false,proof:null,protocolError:null,ownerError:"",workerStderrTail:"",stopReason:null,streamBytes:{stdout:STREAM,stderr:STREAM},nativeBuild:command.nativeBuild,outputAccountingRoots:accountingRoots,guard:{path:guardPath,identity:id,state:"released_after_live_empty_job",nativeEvidenceRoot},cleanupConfirmed:false,elapsedMs:budget.timeoutMs}
    const maximumReceiptBytes=Buffer.byteLength(JSON.stringify(template)+"\n")+2*PROOF_BYTES+6*(8192+8192+2048+2048)+2048
    const startedBytes=Buffer.byteLength(JSON.stringify({...record,ownerPid:4294967295,commandBinding:command.bindingBase64})+"\n")
    budget.maximumReceiptBytes=maximumReceiptBytes
    budget.terminalReserveBytes=Math.ceil((2*maximumReceiptBytes+PROOF_BYTES+OUTER_TERMINAL_BYTES+startedBytes)/65536)*65536
    budget.ordinaryOutputLimitBytes=budget.outputBytes-budget.terminalReserveBytes
    assert.ok(budget.ordinaryOutputLimitBytes>65536,"native terminal reservation exceeds phase ceiling")
    assert.ok(outputBytes()+startedBytes<=budget.ordinaryOutputLimitBytes,"native finalization capacity unavailable before guard")
  }
  catch(error){
    const compilerFailure=nativeBuildFailureObservation(error)
    const compilerExited=Boolean(command)||Boolean(compilerFailure&&compilerFailure.runnerPid===process.pid&&compilerFailure.guardIdentity===id&&compilerFailure.guardSha256===sha(guardBytes))
    error.ownedReceipt={schema:"detail-weight-pre-spawn-failure-v1",phase,budget,outputAccountingRoots:accountingRoots,cleanupConfirmed:false,guard:{path:guardPath,identity:id,state:"not_acquired"},nativeOwnerSpawnAttempted:false,workerStarted:false,compilerExited,compilerFailure,nativeBuild:command?.nativeBuild??null,error:String(error)}
    try{
      const finalReceipt={...error.ownedReceipt,cleanupConfirmed:true,cleanupBasis:"same_live_call_no_guard_or_native_owner_created"}
      const serialized=Buffer.byteLength(JSON.stringify(error.ownedReceipt)+"\n")+(compilerExited?Buffer.byteLength(JSON.stringify(finalReceipt)+"\n"):0)
      assert.ok(outputBytes()+serialized<=budget.outputBytes-OUTER_TERMINAL_BYTES,"pre-spawn final receipts must fit with reserve")
      const persist=(logical,value)=>withOutputBudget({projectRoot:root,roots:accountingRoots,maximum:budget.outputBytes-OUTER_TERMINAL_BYTES,reserveBytes:0},()=>write(root,logical,value))
      persist(scope+"/original-receipt.json",error.ownedReceipt)
      if(compilerExited){
        error.receiptBinding=persist(scope+"/release-receipt.json",finalReceipt);error.ownedReceipt=finalReceipt
      }
    }catch(secondary){error.secondaryEvidenceError=String(secondary);error.ownedReceipt.cleanupConfirmed=false}
    throw error
  }
  // Compilation consumes only CPU and private UUID evidence. The GPU/worker
  // lease is acquired afterwards, atomically, and always before owner spawn.
  try{fs.writeFileSync(guardPath,guardBytes,{flag:"wx"})}
  catch(error){error.code="OWNED_GUARD_BUSY";error.ownedReceipt={phase,cleanupConfirmed:false,guard:{path:guardPath,state:"existing_guard_refused"},nativeOwnerSpawnAttempted:false};throw error}
  return new Promise((resolve,reject)=>{
    let child;try{child=spawn(command.executable,command.args,{cwd:root,env:{...process.env,DETAIL_WEIGHT_OUTPUT_ROOTS:JSON.stringify(accountingRoots),DETAIL_WEIGHT_BUDGET_PROJECT_ROOT:root,DETAIL_WEIGHT_OUTPUT_MAX:String(budget.ordinaryOutputLimitBytes),OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2",OPENBLAS_NUM_THREADS:"2",PYTHONDONTWRITEBYTECODE:"1"},windowsHide:true,shell:false,stdio:["pipe","pipe","pipe"]})}catch(error){error.ownedReceipt={phase,budget,outputAccountingRoots:accountingRoots,streamBytes:{stdout:0,stderr:0},cleanupConfirmed:false,error:String(error),guard:{path:guardPath,state:"retained"}};try{error.receiptBinding=withOutputBudget({projectRoot:root,roots:accountingRoots,maximum:budget.outputBytes-OUTER_TERMINAL_BYTES,reserveBytes:0},()=>write(root,scope+"/original-receipt.json",error.ownedReceipt))}catch(secondary){error.secondaryEvidenceError=String(secondary)}reject(error);return}
    let timer,force,final;let pending="",proof=null,protocolError=null,ownerError="",closed=false,stopReason=null,settled=false
    const buffers={stdout:[],stderr:[]},counts={stdout:0,stderr:0}
    const stop=reason=>{if(!stopReason){stopReason=String(reason).slice(0,2048);if(!child.stdin.destroyed){try{child.stdin.write(Buffer.from(stopReason).toString("base64")+"\n")}catch(error){protocolError??=String(error)}}}}
    const finish=()=>{
      if(settled)return;settled=true;clearInterval(timer);clearTimeout(force);clearTimeout(final);child.stdin.destroy();child.stdout.destroy();child.stderr.destroy()
      const confirmed=validateNativeReceipt({proof,ownerPid:child.pid,bindingBase64:command.bindingBase64,ownerClosed:closed,protocolError,stdoutBytes:counts.stdout,stderrBytes:counts.stderr})
      const receipt={schema:"detail-weight-live-native-owner-receipt-v1",phase,budget,ownerIdentity:{pid:child.pid,identitySource:"retained_child_handle"},ownerClosed:closed,
        proof,protocolError,ownerError,workerStderrTail:Buffer.concat(buffers.stderr).toString("utf8").slice(-8192),stopReason,streamBytes:counts,nativeBuild:command.nativeBuild,outputAccountingRoots:accountingRoots,guard:{path:guardPath,identity:id,state:"retained",nativeEvidenceRoot},cleanupConfirmed:false,elapsedMs:Date.now()-started}
      try{
        // Original compact live receipt is persisted before optional audits.
        const finalShape={...receipt,cleanupConfirmed:confirmed,guard:{...receipt.guard,state:confirmed?"released_after_live_empty_job":"retained"}}
        const originalBytes=Buffer.byteLength(JSON.stringify(receipt)+"\n"),finalBytes=Buffer.byteLength(JSON.stringify(finalShape)+"\n")
        assert.ok(originalBytes<=budget.maximumReceiptBytes&&finalBytes<=budget.maximumReceiptBytes,"live receipt envelope exceeded")
        assert.ok(outputBytes()+counts.stdout+counts.stderr+originalBytes+finalBytes<=budget.outputBytes-OUTER_TERMINAL_BYTES,"final live receipts must fit reserved capacity")
        const persist=(logical,value)=>withOutputBudget({projectRoot:root,roots:accountingRoots,maximum:budget.outputBytes-counts.stdout-counts.stderr-OUTER_TERMINAL_BYTES,reserveBytes:0},()=>write(root,logical,value))
        persist(scope+"/original-receipt.json",receipt)
        if(confirmed){assert.equal(fs.readFileSync(guardPath,"utf8"),guardBytes);fs.unlinkSync(guardPath);receipt.cleanupConfirmed=true;receipt.guard.state="released_after_live_empty_job"}
        persist(scope+"/release-receipt.json",receipt)
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
        try{if(line.startsWith("O:")||line.startsWith("E:")){const name=line[0]==="O"?"stdout":"stderr",raw=Buffer.from(line.slice(2),"base64");assert.equal(raw.toString("base64"),line.slice(2));counts[name]+=raw.length;if(counts.stdout+counts.stderr>STREAM)stop("stream_limit");else{buffers[name].push(raw);if(outputBytes()+counts.stdout+counts.stderr>budget.ordinaryOutputLimitBytes)stop("output_budget")}}
          else if(line.startsWith("R:")){assert.equal(proof,null);const raw=Buffer.from(line.slice(2),"base64");assert.equal(raw.toString("base64"),line.slice(2));assert.ok(raw.length<=PROOF_BYTES,"native proof envelope exceeded");proof=JSON.parse(raw.toString("utf8"))}else throw new Error("unknown native frame")
        }catch(error){protocolError=String(error).slice(0,2048);stop("native_protocol_error")}}
      if(pending.length>65536){protocolError="native_frame_overflow";pending="";stop(protocolError)}
    })
    child.stderr.on("data",raw=>{ownerError=(ownerError+raw.toString()).slice(0,8192)})
    child.stdin.on("error",error=>{protocolError??=String(error).slice(0,2048)})
    child.on("error",error=>{protocolError=String(error).slice(0,2048);stop(protocolError)})
    child.once("close",()=>{closed=true;if(pending.trim())protocolError??="incomplete_frame";finish()})
    timer=setInterval(()=>{try{onHeartbeat();const reason=abortReason();if(reason)stop(reason);if(Date.now()>=deadline)stop("wall_timeout");if(outputBytes()+counts.stdout+counts.stderr>budget.ordinaryOutputLimitBytes)stop("output_budget")}catch(error){stop(error)}},1000)
    force=setTimeout(()=>{stop("wall_timeout");try{child.kill("SIGKILL")}catch{}},Math.max(1,started+budget.timeoutMs-Date.now()-250))
    final=setTimeout(()=>{stop("cleanup_deadline");finish()},Math.max(1,started+budget.timeoutMs-Date.now()))
    try{write(root,nativeEvidenceRoot+`/${id}-started.json`,{...record,ownerPid:child.pid,commandBinding:command.bindingBase64})}catch(error){protocolError=String(error).slice(0,2048);stop(protocolError)}
  })
}

async function advance(context,ready,{activeExecution,evidence,state,activity,latestTrainingTerminal,capsuleLogical=null}) {
  const current=await readCurrentExecutionRegistry(ready.root);assert.equal(current.ok,true)
  const capsule=write(ready.root,capsuleLogical??`${ready.plan.outputRoot}/capsule-${crypto.randomUUID()}.json`,{schemaVersion:"ai-painter-local-task-capsule-v1",taskId:ready.plan.runId,
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
    outputRoot:ready.plan.outputRoot,resolution:[256,192],trainingPlan:{epochs:48,generatorOptimizerSteps:2304,discriminatorOptimizerSteps:2304,checkpointSelection:ready.plan.configuration.checkpointSelection},resourceBudget:effectiveExecutionCeiling(ready.root,ready.plan),resourcePolicy:ready.plan.resourcePolicy??null,
    observation:{progressPath:ready.plan.outputRoot+"/progress.json"},autonomousExecutionPackage:ready.packageBinding,observationOnly:true})
  const file=inside(ready.root,"ml/ai-painter/.venv/Scripts/python.exe")
  const result=await runNative({root:ready.root,outputRoot:ready.plan.outputRoot,phase:"cpu",executable:file,args:["-B",inside(ready.root,ready.plan.programBindings.worker.path),"--preflight","--package",ready.packageBinding.path,"--sha256",ready.packageBinding.sha256],onHeartbeat:context.heartbeat})
  assert.equal(JSON.parse(result.stdout).status,"own_managed_preflight_passed")
  return withNativeReceiptBudget(ready.root,result.ownedReceipt,async()=>({status:"passed",preflight:write(ready.root,ready.plan.outputRoot+"/preflight.json",{status:"passed",executionPackage:ready.packageBinding,ownedReceipt:result.receiptBinding})}))
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
    const trained=await runNative({root,outputRoot:plan.outputRoot,phase:"training",executionPlan:plan,executable,args:["-B",inside(root,plan.programBindings.worker.path),...base,"--gpu",gpu.path,"--gpu-sha256",gpu.sha256],onHeartbeat:()=>heartbeat(context,ready,identity)})
    lastReceipt=trained.ownedReceipt;const terminal=JSON.parse(trained.stdout),body=json(root,terminal);validateCompleted(body,packageBinding,plan)
    await withNativeReceiptBudget(root,trained.ownedReceipt,()=>advance(context,ready,{activeExecution:null,evidence:terminal,state:"completed",activity:"training_completed_review_pending",latestTrainingTerminal:{runId:plan.runId,...terminal,status:body.status}}))
    return {status:"passed",workerTerminal:terminal,ownedReceipt:trained.receiptBinding}
  }catch(error){
    let workerTerminal=null,body=null
    try{workerTerminal=bind(root,plan.outputRoot+"/worker-terminal.json");body=json(root,workerTerminal);assert.equal(body.runId,plan.runId);assert.equal(body.status,"failed_closed")}catch{workerTerminal=null;body=null}
    const persistFailure=async()=>{
      const failure=write(root,plan.outputRoot+"/execution-failure.json",{status:"failed_closed",executionState:"failed_closed",runId:plan.runId,capabilityVersion:CAPABILITY,packageId:plan.packageId,executionPackage:packageBinding,workerTerminal,optimizerStepsGenerator:body?.optimizerStepsGenerator??null,optimizerStepsDiscriminator:body?.optimizerStepsDiscriminator??null,completedEpochs:body?.completedEpochs??null,error:String(error),cleanupConfirmed:cleanupForCurrentCall(error,lastReceipt)})
      if(cleanupForCurrentCall(error,lastReceipt))await advance(context,ready,{activeExecution:null,evidence:failure,state:"failed_closed",activity:"failed_closed",...(workerTerminal?{latestTrainingTerminal:{runId:plan.runId,...workerTerminal,status:body.status}}:{})})
    }
    const budgetReceipt=error.ownedReceipt?.outputAccountingRoots?error.ownedReceipt:lastReceipt
    try{if(budgetReceipt?.outputAccountingRoots)await withNativeReceiptBudget(root,budgetReceipt,persistFailure);else await persistFailure()}catch(secondary){error.secondaryEvidenceError=String(secondary)}
    throw error // unknown cleanup retains active identity and guard; no replay
  }
}
export async function validate(context){const ready=loadContext(context),terminal=bind(ready.root,ready.plan.outputRoot+"/worker-terminal.json"),body=json(ready.root,terminal);validateCompleted(body,ready.packageBinding,ready.plan);for(const r of body.checkpoints)read(ready.root,r.checkpoint);return {status:"passed",workerTerminal:terminal}}
export async function review(context){
  const ready=loadContext(context),{root,plan}=ready,terminal=bind(root,plan.outputRoot+"/worker-terminal.json")
  let result=null
  try{
  result=await runNative({root,outputRoot:plan.outputRoot+"/dry-review-owned",phase:"review",executable:inside(root,"ml/ai-painter/.venv/Scripts/python.exe"),args:["-B",inside(root,plan.programBindings.cpuReview.path),"--package",ready.packageBinding.path,"--sha256",ready.packageBinding.sha256,"--terminal",terminal.path,"--terminal-sha256",terminal.sha256],onHeartbeat:context.heartbeat})
  return await auditReviewReport(ready,result)
  }catch(error){
    if(cleanupForCurrentCall(error,result?.ownedReceipt)){
      const owned=error.ownedReceipt??result.ownedReceipt
      const finalLogical=plan.outputRoot+"/review-failure-terminal.json",capsuleLogical=plan.outputRoot+"/review-failure-capsule.json"
      await withNativeReceiptBudget(root,owned,async()=>{
        const failure=write(root,plan.outputRoot+"/dry-review-owned/review-failure.json",{schema:"detail-weight-review-failure-v1",runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:ready.packageBinding,workerTerminal:terminal,status:"review_execution_failed_closed",executionState:"failed_closed",phase:"review",failureKind:"program",failureCode:"adapter_exception",error:String(error),workerStderrTail:owned.workerStderrTail??"",nativeOwnedReceipt:error.receiptBinding??result?.receiptBinding??null})
        const end=write(root,finalLogical,{schema:"detail-weight-managed-review-terminal-v1",status:"review_execution_failed_closed",executionState:"failed_closed",runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:ready.packageBinding,workerTerminal:terminal,reviewFailure:failure,formalStage4QualificationGranted:false,runtimePublicationGranted:false})
        await advance(context,ready,{activeExecution:null,evidence:end,state:"failed_closed",activity:"review_execution_failed_closed",capsuleLogical})
      },[finalLogical,capsuleLogical])
    }
    throw error
  }
}
export async function auditReviewReport(ready,result,{outputRoot=ready.plan.outputRoot+"/dry-review"}={}){
  const {root,plan}=ready
  return withNativeOrdinaryBudget(root,result.ownedReceipt,async()=>{
  const reportBinding=JSON.parse(result.stdout),report=json(root,reportBinding),candidate=json(root,plan.sourceCandidate),scope=json(root,candidate.frozenBindings.dryScope)
  assert.equal(report.subject.sampleId,candidate.scope.subjectSampleId);assert.equal(report.subject.split,"validation")
  for(const key of ["worldId","regionId","tick","factHash","conditionPack"])assert.deepEqual(report.subject[key],scope.preselectedSubject[key])
  const roles=decodeV17ResponsibilityArtifact({archiveBytes:read(root,report.responsibility.archive),evidence:report.responsibility.evidence,
    expectedIdentity:{worldId:report.subject.worldId,regionId:report.subject.regionId,tick:report.subject.tick,factHash:report.subject.factHash,
      visualFactManifestSha256:report.subject.visualFactManifestSha256,conditionPackSha256:report.subject.conditionPack.sha256,modelStateSha256:report.subject.modelStateSha256},
    schemaBytes:read(root,report.responsibility.interface),schemaSha256:report.responsibility.interface.sha256,candidatePackSchemaVersion:json(root,report.responsibility.interface).candidatePackSchemaVersion})
  const meta=await sharp(read(root,report.candidateRgb)).metadata();assert.deepEqual([meta.width,meta.height],[256,192])
  const projection=write(root,outputRoot+"/auditor-input-1024.png",await sharp(read(root,report.candidateRgb)).resize(1024,768,{kernel:"nearest"}).png().toBuffer())
  const thresholds=json(root,candidate.frozenBindings.numericReview),manifest=json(root,plan.datasetManifest),source=json(root,manifest.sourceIndex),row=source.samples.find(r=>r.sampleId===report.subject.sampleId)
  assert.equal(row.split,"validation");assert.deepEqual(row.image,report.subject.referenceRgb)
  const detail=await auditMvp256DetailSufficiency({candidatePath:inside(root,report.candidateRgb.path),referencePath:inside(root,row.image.path),contract:json(root,candidate.frozenBindings.detailReview)})
  const aesthetic=await auditProfessionalAestheticFromFrozenContract({imagePath:inside(root,report.candidateRgb.path),thresholdContract:thresholds,styleFingerprintPath:inside(root,thresholds.styleFingerprint.path),expectedStyleFingerprintSha256:thresholds.styleFingerprint.sha256})
  const alignment=await auditAiAssistedConditionAlignment({record:{recordId:plan.runId+"-dry-review",conditionBinding:{conditionPackPath:report.subject.conditionPack.path,worldId:report.subject.worldId,tick:report.subject.tick},classification:{monsoonSeason:row.monsoonSeason,regionalLandscapeType:null}},imagePath:inside(root,projection.path),referenceImagePath:inside(root,row.image.path)})
  const decision=decideMvp256DryReview({scope:scope.preselectedSubject,candidate:{sampleId:report.subject.sampleId,split:"validation",resolution:[256,192]},detail,aesthetic,alignment,responsibilityRoleCount:roles.roleOrder.length})
  assert.equal(typeof report.validationImprovedWithoutMeanRgbRegression,"boolean")
  if(!report.validationImprovedWithoutMeanRgbRegression){decision.status="dry_single_world_review_failed_closed";decision.issueCodes.push("validation_not_improved_without_mean_rgb_regression")}
  const audit=write(root,outputRoot+"/machine-audit.json",{...decision,runId:plan.runId,selectedCheckpoint:report.selectedCheckpoint,validationImprovedWithoutMeanRgbRegression:report.validationImprovedWithoutMeanRgbRegression,executionPackage:ready.packageBinding,input:reportBinding,nativeOwnedReceipt:result.receiptBinding,detail,aesthetic,alignment})
  return {status:"passed",reviewOutcome:decision.status==="dry_single_world_review_failed_closed"?"machine_reviews_failed":"machine_reviews_completed",audit}
  })
}
export async function adjudicate(context){const ready=loadContext(context),audit=bind(ready.root,ready.plan.outputRoot+"/dry-review/machine-audit.json"),body=json(ready.root,audit);assert.deepEqual(body.executionPackage,ready.packageBinding);assert.equal(body.formalStage4QualificationGranted,false);assert.equal(body.runtimePublicationGranted,false);return {status:"passed",audit,decision:body.status}}
export async function finalize(context){
  const ready=loadContext(context),auditBinding=bind(ready.root,ready.plan.outputRoot+"/dry-review/machine-audit.json"),audit=json(ready.root,auditBinding)
  const receipt=json(ready.root,audit.nativeOwnedReceipt)
  assert.equal(receipt.phase,"review");assert.ok(receipt.outputAccountingRoots.includes(ready.plan.outputRoot+"/dry-review-owned"));assert.ok(receipt.outputAccountingRoots.includes(ready.plan.outputRoot+"/dry-review"))
  const finalLogical=ready.plan.outputRoot+"/finalization.json",capsuleLogical=`${ready.plan.outputRoot}/capsule-${crypto.randomUUID()}.json`
  return withNativeReceiptBudget(ready.root,receipt,async()=>{
    const completed=audit.status==="dry_single_world_numeric_passed_visual_approval_pending"
    const finalization=write(ready.root,finalLogical,{schema:"detail-weight-managed-review-terminal-v1",status:audit.status,executionState:completed?"completed":"failed_closed",runId:ready.plan.runId,packageId:ready.plan.packageId,capabilityVersion:CAPABILITY,executionPackage:ready.packageBinding,workerTerminal:bind(ready.root,ready.plan.outputRoot+"/worker-terminal.json"),audit:auditBinding,reviewReport:audit.input,automaticRetries:0,formalStage4QualificationGranted:false,runtimePublicationGranted:false})
    await advance(context,ready,{activeExecution:null,evidence:finalization,state:completed?"completed":"failed_closed",activity:audit.status,capsuleLogical})
    return completed?{status:"passed",finalization}:{status:"failed",failureKind:"visual",failureCode:"dry_review_failed",summaryZh:"原审核器拒绝预选场景；不重训、不授予资格。",finalization}
  },[finalLogical,capsuleLogical])
}
