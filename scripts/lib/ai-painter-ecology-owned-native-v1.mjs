// Versioned ecology binding of the existing private Windows Job transport.
// The receipt schema identifies the Job protocol, never model qualification.
// IO and AsyncLocalStorage accounting are shared with the existing store.
// No legacy plan admission, retry, review recovery or resource successor.
// Extracted from frozen detail-weight capture transport SHA-256
// 9b1d4516045fd80d53b2812ce2c3864b31a6c887b653e22c61b7011fccfa5e1e.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createNativeOwnerCommand, nativeOwnerSourceIdentity, nativeBuildFailureObservation } from "./ai-painter-owned-worker-native-v1.mjs"
import { inside, read, json, bind, write, sha, withOutputBudget, directoryBytes } from "./ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs"
import { validatePlan } from "./ai-painter-ecology-managed-package-chain-v1.mjs"
const SELF=fileURLToPath(import.meta.url),STREAM=8*1024*1024
const PROOF_BYTES=65536,OUTER_TERMINAL_BYTES=65536
const CAPABILITY="stage4_mvp256_dry_factorized_ecology_v1"
const PROFILE="factorized_ecology_execution_v1"

// Identity checks here remain independent even if the shape validator changes.
// A valid budget is not GPU, production, checkpoint or release admission.
export function nativeBudget(phase,{root,plan}={}) {
  assert.ok(["cpu","qualification","training","review"].includes(phase),"unknown native phase")
  if(phase==="training") assert.ok(plan,"training native budget requires its own immutable ecology plan")
  if(plan) {
    assert.equal(plan.schema,"ecology-regime-managed-plan-v1")
    assert.equal(plan.capabilityVersion,CAPABILITY)
    assert.equal(plan.executionProfile,PROFILE)
    assert.ok(["managed-training","synthetic-cpu-bootstrap"].includes(plan.executionMode))
    if(phase==="training") assert.equal(plan.executionMode,"managed-training","bootstrap is not training admission")
    for(const key of ["runId","packageId"]) assert.match(plan[key],/^[a-z0-9][a-z0-9-]{7,127}$/u)
    assert.notEqual(plan.runId,plan.packageId)
    assert.equal(plan.outputRoot,".runtime/ai-painter/ecology-regime-managed-executions/"+plan.runId)
    assert.equal(plan.historicalCheckpointMayInitialize,false)
    assert.equal(plan.trainingRestartAllowed,false)
    assert.equal(Object.hasOwn(plan,"resourcePolicy"),false,"resource successor is not ecology budget authority")
    assert.equal(Object.hasOwn(plan,"effectiveExecutionCeiling"),false,"caller ceiling override prohibited")
    const config=plan.configuration
    assert.equal(config?.capabilityVersion,CAPABILITY)
    for(const [key,value] of Object.entries({maxWallSeconds:2700,maxOutputMiB:128,cpuThreads:2,trainingAttempts:1,automaticRetries:0}))
      assert.equal(config.executionCeiling?.[key],value,"own ecology ceiling differs: "+key)
    assert.equal(config.gpuAdmissionSeconds,600)
    // Source/configuration/program byte verification is the owner's new plan
    // validator. It provides budget shape and integrity, never qualification.
    validatePlan(root,plan)
  }
  return {timeoutMs:phase==="training"?2700000:phase==="qualification"?600000:120000,streamBytes:STREAM,outputBytes:phase==="training"?128*1024**2:phase==="cpu"?8*1024**2:16*1024**2}
}

export function validateNativeReceipt({proof,ownerPid,bindingBase64,ownerClosed,protocolError,stdoutBytes,stderrBytes}) {
  return ownerClosed===true && !protocolError && proof!==null && typeof proof==="object" && Number.isInteger(ownerPid) && ownerPid>0 && proof.ownerPid===ownerPid && Number.isInteger(proof.rootPid) && proof.rootPid>0 && typeof proof.rootCreationDateUtc==="string" && proof.rootCreationDateUtc.length>0 && proof.bindingBase64===bindingBase64
    && proof.assignedBeforeResume===true && proof.killOnJobClose===true && proof.activeProcessesAfterCleanup===0
    && !proof.observationError && !proof.cleanupError && proof.stdoutBytes===stdoutBytes && proof.stderrBytes===stderrBytes
}
export function cleanupForCurrentCall(error,lastReceipt){return Object.hasOwn(error,"ownedReceipt")?error.ownedReceipt?.cleanupConfirmed===true:lastReceipt?.cleanupConfirmed===true}

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

export async function runNative(options) {
  assert.ok(options && typeof options === "object")
  const supported = ["root","outputRoot","phase","executable","args","onHeartbeat","abortReason","executionPlan"]
  for (const key of Object.keys(options)) assert.ok(supported.includes(key), "unsupported native option: "+key)
  const {root,outputRoot,phase,executable,args,onHeartbeat=()=>{},abortReason=()=>null,executionPlan=null}=options
  assert.equal(process.platform,"win32")
  assert.equal(typeof root,"string");assert.ok(path.isAbsolute(root))
  assert.equal(typeof executable,"string");assert.ok(path.isAbsolute(executable))
  assert.ok(Array.isArray(args)&&args.every(arg=>typeof arg==="string"&&!arg.includes("\0")))
  assert.equal(typeof onHeartbeat,"function");assert.equal(typeof abortReason,"function")
  assert.match(outputRoot,/^\.runtime\/ai-painter\/ecology-regime-managed-executions\/[a-z0-9][a-z0-9-]{7,127}(?:\/dry-review-owned)?$/u)
  assert.equal(outputRoot.endsWith("/dry-review-owned"),phase==="review")
  if(executionPlan) assert.equal(outputRoot,executionPlan.outputRoot+(phase==="review"?"/dry-review-owned":""))
  const budget=nativeBudget(phase,executionPlan?{root,plan:executionPlan}:undefined)
  const started=Date.now(),deadline=started+budget.timeoutMs-1000
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
  const accountingRoots=[...new Set(nativeAccountingRoots(root,outputRoot,nativeEvidenceRoot,null,phase))]
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
    let timer,force,final;let pending="",proof=null,protocolError=null,ownerError="",closed=false,stopReason=null,settled=false,primaryError=null
    const buffers={stdout:[],stderr:[]},counts={stdout:0,stderr:0}
    const stop=reason=>{if(reason instanceof Error)primaryError??=reason;if(!stopReason){stopReason=String(reason).slice(0,2048);if(!child.stdin.destroyed){try{child.stdin.write(Buffer.from(stopReason).toString("base64")+"\n")}catch(error){protocolError??=String(error)}}}}
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
      }catch(error){receipt.cleanupConfirmed=false;receipt.persistenceError=String(error);receipt.secondaryEvidenceError=String(error)}
      let receiptBinding=null
      try{receiptBinding=bind(root,scope+"/release-receipt.json")}catch(error){receipt.persistenceError??=String(error);receipt.secondaryBindingError=String(error)}
      const value={stdout:Buffer.concat(buffers.stdout).toString("utf8"),stderr:Buffer.concat(buffers.stderr).toString("utf8"),ownedReceipt:receipt,receiptBinding}
      if(receipt.persistenceError || !receiptBinding || !receipt.cleanupConfirmed || protocolError || stopReason || proof?.exitCode!==0 || counts.stdout>STREAM || counts.stderr>STREAM){const error=primaryError??new Error(stopReason??protocolError??(proof?.exitCode ? `worker_exit_${proof.exitCode}` : receipt.persistenceError)??"native worker failed or cleanup unknown");Object.assign(error,value);if(receipt.persistenceError)error.secondaryEvidenceError=receipt.persistenceError;if(receipt.secondaryBindingError)error.secondaryBindingError=receipt.secondaryBindingError;reject(error)}else resolve(value)
    }
    child.stdout.on("data",chunk=>{
      pending+=chunk.toString("ascii");let index
      while((index=pending.indexOf("\n"))>=0){const line=pending.slice(0,index).trimEnd();pending=pending.slice(index+1)
        try{if(line.startsWith("O:")||line.startsWith("E:")){const name=line[0]==="O"?"stdout":"stderr",raw=Buffer.from(line.slice(2),"base64");assert.equal(raw.toString("base64"),line.slice(2));counts[name]+=raw.length;if(counts.stdout+counts.stderr>STREAM)stop("stream_limit");else{buffers[name].push(raw);if(outputBytes()+counts.stdout+counts.stderr>budget.ordinaryOutputLimitBytes)stop("output_budget")}}
          else if(line.startsWith("R:")){assert.equal(proof,null);const raw=Buffer.from(line.slice(2),"base64");assert.equal(raw.toString("base64"),line.slice(2));assert.ok(raw.length<=PROOF_BYTES,"native proof envelope exceeded");proof=JSON.parse(raw.toString("utf8"))}else throw new Error("unknown native frame")
        }catch(error){primaryError??=error;protocolError=String(error).slice(0,2048);stop("native_protocol_error")}}
      if(pending.length>65536){protocolError="native_frame_overflow";pending="";stop(protocolError)}
    })
    child.stderr.on("data",raw=>{ownerError=(ownerError+raw.toString()).slice(0,8192)})
    child.stdin.on("error",error=>{primaryError??=error;protocolError??=String(error).slice(0,2048)})
    child.on("error",error=>{primaryError??=error;protocolError=String(error).slice(0,2048);stop(error)})
    child.once("close",()=>{closed=true;if(pending.trim())protocolError??="incomplete_frame";finish()})
    timer=setInterval(()=>{try{onHeartbeat();const reason=abortReason();if(reason)stop(reason);if(Date.now()>=deadline)stop("wall_timeout");if(outputBytes()+counts.stdout+counts.stderr>budget.ordinaryOutputLimitBytes)stop("output_budget")}catch(error){stop(error)}},1000)
    force=setTimeout(()=>{stop("wall_timeout");try{child.kill("SIGKILL")}catch{}},Math.max(1,started+budget.timeoutMs-Date.now()-250))
    final=setTimeout(()=>{stop("cleanup_deadline");finish()},Math.max(1,started+budget.timeoutMs-Date.now()))
    try{write(root,nativeEvidenceRoot+`/${id}-started.json`,{...record,ownerPid:child.pid,commandBinding:command.bindingBase64})}catch(error){primaryError??=error;protocolError=String(error).slice(0,2048);stop(error)}
  })
}
