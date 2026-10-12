// Actual materializer/engine/registry integration; no success stubs or GPU.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {inside,read,json,bind,sha,write,withOutputBudget,directoryBytes,validatePlan,effectiveExecutionCeiling,RESOURCE_POLICY,validateCompleted,PHASE_EXPORTS,EXECUTION_PROFILE} from "../lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs"
import * as actual from "../run-ai-painter-mvp256-dry-detail-weight-capture-training.mjs"
import {runAutonomousClosedLoop,validateClosedLoopPackage,PHASES} from "../lib/ai-painter-autonomous-closed-loop-v1.mjs"

export async function runCases({projectRoot,isolated,plan,executionPackage,programBindings}){
 const fixture=name=>{const dir=inside(isolated,plan.outputRoot+"/accounting-"+name);fs.mkdirSync(dir,{recursive:false});return dir}
 const vanished=()=>Object.assign(new Error("fixture ENOENT"),{code:"ENOENT"})
 const cases=[
  ["resource successor binds both timeouts without changing frozen workload or safety",async()=>{
   const baseline=plan.configuration.executionCeiling,effective=effectiveExecutionCeiling(isolated,plan)
   assert.deepEqual(effective,{...baseline,maxWallSeconds:plan.resourcePolicy?4200:2700})
   assert.equal(actual.nativeBudget("training",{root:isolated,plan}).timeoutMs,effective.maxWallSeconds*1000)
   assert.equal(actual.nativeBudget("qualification",{root:isolated,plan}).timeoutMs,600000)
   assert.equal(actual.nativeBudget("cpu",{root:isolated,plan}).timeoutMs,120000)
   assert.equal(actual.nativeBudget("review",{root:isolated,plan}).timeoutMs,120000)
   assert.equal(actual.nativeBudget("training").timeoutMs,2700000)
   assert.equal(actual.nativeBudget("training",{root:isolated,plan}).outputBytes,128*1024**2)
   for(const resourcePolicy of[null,{...RESOURCE_POLICY,sha256:"0".repeat(64)},{...RESOURCE_POLICY,path:"data/unknown.json"}])assert.throws(()=>validatePlan(isolated,{...plan,resourcePolicy}))
   const changed=structuredClone(plan);changed.configuration.executionCeiling.epochs=49;assert.throws(()=>validatePlan(isolated,changed))
   if(plan.resourcePolicy){assert.deepEqual(plan.resourcePolicy,RESOURCE_POLICY);const body=json(isolated,executionPackage);assert.ok(body.inputEvidence.some(b=>b.path===RESOURCE_POLICY.path&&b.sha256===RESOURCE_POLICY.sha256))}
  }],
  ["atomic progress and heartbeat replacements are fully recounted",async()=>{
   for(const [name,suffix]of[["progress.json","0123456789abcdef"],["heartbeat.json","01234567-89ab-cdef-0123-456789abcdef"]]){
    const dir=fixture(name.slice(0,-5)),final=path.join(dir,name),staged=final+".staged-"+suffix
    fs.writeFileSync(final,Buffer.alloc(5),{flag:"wx"});fs.writeFileSync(staged,Buffer.alloc(37),{flag:"wx"});fs.writeFileSync(path.join(dir,"sentinel.json"),Buffer.alloc(11),{flag:"wx"})
    const original=fs.lstatSync;let renamed=0
    fs.lstatSync=function(file,...args){if(String(file)===staged&&renamed++===0)fs.renameSync(staged,final);return original.call(fs,file,...args)}
    try{assert.equal(directoryBytes(dir),48);assert.equal(renamed,1)}finally{fs.lstatSync=original}
   }
  }],
  ["output accounting rejects unknown disappearance missing replacement permission and junction",async()=>{
   const dir=fixture("rejections"),file=path.join(dir,"immutable.json");fs.writeFileSync(file,"immutable",{flag:"wx"})
   const original=fs.lstatSync
   for(const error of[vanished(),Object.assign(new Error("root permission denied"),{code:"EACCES"})]){
    fs.lstatSync=function(target,...args){if(String(target)===dir)throw error;return original.call(fs,target,...args)}
    try{assert.throws(()=>directoryBytes(dir),value=>value===error)}finally{fs.lstatSync=original}
   }
   fs.lstatSync=function(target,...args){return String(target)===dir?{isDirectory:()=>true,isSymbolicLink:()=>true}:original.call(fs,target,...args)}
   try{assert.throws(()=>directoryBytes(dir),/regular directory/u)}finally{fs.lstatSync=original}
   for(const error of[vanished(),Object.assign(new Error("permission denied"),{code:"EACCES"})]){
    fs.lstatSync=function(target,...args){if(String(target)===file)throw error;return original.call(fs,target,...args)}
    try{assert.throws(()=>directoryBytes(dir),value=>value===error)}finally{fs.lstatSync=original}
   }
   fs.lstatSync=function(target,...args){const value=original.call(fs,target,...args);return String(target)===file?{isSymbolicLink:()=>true}:value}
   try{assert.throws(()=>directoryBytes(dir),/junction prohibited/u)}finally{fs.lstatSync=original}
   const staged=path.join(dir,"progress.json.staged-0123456789abcdef");fs.writeFileSync(staged,"fixture",{flag:"wx"})
   fs.lstatSync=function(target,...args){if(String(target)===staged)throw vanished();return original.call(fs,target,...args)}
   try{assert.throws(()=>directoryBytes(dir),error=>error.code==="ENOENT")}finally{fs.lstatSync=original}
  }],
  ["atomic churn is limited to three metadata scans and never retries training",async()=>{
   const dir=fixture("churn"),name="progress.json.staged-0123456789abcdef";fs.writeFileSync(path.join(dir,"progress.json"),"current",{flag:"wx"})
   const readdir=fs.readdirSync,lstat=fs.lstatSync;let scans=0
   fs.readdirSync=function(target,...args){if(String(target)===dir){scans++;return [{name}]}return readdir.call(fs,target,...args)}
   fs.lstatSync=function(target,...args){if(String(target)===path.join(dir,name))throw vanished();return lstat.call(fs,target,...args)}
   try{assert.throws(()=>directoryBytes(dir),/three scans/u);assert.equal(scans,3)}finally{fs.readdirSync=readdir;fs.lstatSync=lstat}
   assert.equal(actual.nativeBudget("training").timeoutMs,2700000)
  }],
  ["recounted replacement bytes still enforce the original output reserve",async()=>{
   const logical=plan.outputRoot+"/accounting-budget",dir=fixture("budget"),final=path.join(dir,"progress.json"),staged=final+".staged-0123456789abcdef"
   fs.writeFileSync(final,Buffer.alloc(5),{flag:"wx"});fs.writeFileSync(staged,Buffer.alloc(50),{flag:"wx"});fs.writeFileSync(path.join(dir,"sentinel.json"),Buffer.alloc(5),{flag:"wx"})
   const original=fs.lstatSync;let renamed=false
   fs.lstatSync=function(file,...args){if(String(file)===staged&&!renamed){renamed=true;fs.renameSync(staged,final)}return original.call(fs,file,...args)}
   try{assert.throws(()=>withOutputBudget({projectRoot:isolated,roots:[logical],maximum:64,reserveBytes:1},()=>write(isolated,logical+"/blocked.json",Buffer.alloc(10))),/total output reserve/u)}finally{fs.lstatSync=original}
   assert.equal(directoryBytes(dir),55);assert.equal(fs.existsSync(path.join(dir,"blocked.json")),false)
  }],
  ["all six actual phase exports and immutable successor identity",async()=>{
   assert.deepEqual(Object.keys(PHASE_EXPORTS),PHASES)
   for(const phase of PHASES)assert.equal(typeof actual[phase],"function")
   validatePlan(isolated,plan)
   const spec=json(isolated,executionPackage);validateClosedLoopPackage(spec,{root:isolated,packageSha256:executionPackage.sha256})
   for(const phase of PHASES){assert.equal(spec.phaseAdapters[phase].path,programBindings.adapter.path);assert.equal(spec.phaseAdapters[phase].sha256,programBindings.adapter.sha256)}
   assert.equal(spec.maxInfrastructureRecoveryAttempts,0)
   const changed={...plan,executionProfile:"legacy"};assert.throws(()=>validatePlan(isolated,changed))
  }],
  ["registered engine rejects CPU bootstrap before native/GPU dispatch",async()=>{
   const spec=json(isolated,executionPackage)
   const adapters=Object.fromEntries(PHASES.map(phase=>[phase,actual[phase]]))
   const state=await runAutonomousClosedLoop({root:isolated,spec,packageSha256:executionPackage.sha256,adapters})
   assert.equal(state.state,"failed_closed");assert.equal(state.phase,"preflight");assert.equal(state.ownerResponseRequired,false)
   assert.equal(fs.existsSync(inside(isolated,".runtime/ai-painter/owned-worker-guards/active.json")),false)
   assert.equal(fs.existsSync(inside(isolated,plan.outputRoot+"/gpu-consumed.json")),false)
  }],
  ["legacy/source/path/tampered terminal guards cannot qualify",async()=>{
   assert.throws(()=>validatePlan(isolated,{...plan,schema:"detail-weight-managed-plan-v1"}))
   const b=programBindings.worker;assert.throws(()=>read(isolated,{...b,sha256:"0".repeat(64)}))
   for(const p of ["../outside","C:/outside","a//b","/outside"])assert.throws(()=>inside(isolated,p))
   assert.throws(()=>validateCompleted({schema:"detail-weight-managed-worker-terminal-v1",status:"training_completed_review_pending",executionProfile:"legacy"},executionPackage,plan))
   assert.equal(plan.executionProfile,EXECUTION_PROFILE)
  }],
  ["current native cleanup cannot borrow prior call and CPU partition stays bounded",async()=>{
   assert.equal(actual.cleanupForCurrentCall({ownedReceipt:{cleanupConfirmed:false}},{cleanupConfirmed:true}),false)
   assert.equal(actual.cleanupForCurrentCall({ownedReceipt:null},{cleanupConfirmed:true}),false)
   const v={proof:{ownerPid:19,rootPid:20,rootCreationDateUtc:"2026-10-08T00:00:00Z",bindingBase64:"bound",assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,stdoutBytes:3,stderrBytes:0},ownerPid:19,bindingBase64:"bound",ownerClosed:true,protocolError:null,stdoutBytes:3,stderrBytes:0}
   assert.equal(actual.validateNativeReceipt(v),true)
   for(const [key,value]of[["ownerPid",20],["assignedBeforeResume",false],["activeProcessesAfterCleanup",1],["stdoutBytes",4],["cleanupError","failure"]])assert.equal(actual.validateNativeReceipt({...v,proof:{...v.proof,[key]:value}}),false)
   assert.equal(actual.nativeBudget("training").outputBytes,128*1024**2)
   assert.equal(actual.nativeBudget("training").timeoutMs,2700000)
   assert.equal(actual.nativeBudget("qualification").timeoutMs,600000)
  }],
  ["actual isolated source bytes equal final production-source closure",async()=>{
   for(const b of Object.values(programBindings)){assert.equal(sha(read(isolated,b)),b.sha256);assert.equal(sha(read(projectRoot,b)),b.sha256)}
   const body=fs.readFileSync(inside(projectRoot,programBindings.worker.path),"utf8")
   assert.ok(body.includes("run_captured_boundary(context=context"))
   assert.ok(body.includes("enumerate(order_indices, 1)"))
  }],
 ]
 const items=[]
 for(const [name,run]of cases){try{await run();items.push({name,status:"passed",executionKind:"synthetic_structure"})}catch(error){items.push({name,status:"failed",error:String(error?.stack??error)})}}
 return items
}
