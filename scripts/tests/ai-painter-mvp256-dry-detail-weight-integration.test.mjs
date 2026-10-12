import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { inside,write,read,bind,sha,CAPABILITY,PHASE_EXPORTS } from "../lib/ai-painter-mvp256-dry-detail-weight-package-chain-v1.mjs"
import { cleanupForCurrentCall,validateNativeReceipt,nativeBudget } from "../run-ai-painter-mvp256-dry-detail-weight-training.mjs"
import { materializeAutonomousClosedLoopPackage } from "../lib/ai-painter-autonomous-package-materializer-v1.mjs"
import { runAutonomousClosedLoop,PHASES,CLOSED_LOOP_CONTRACT_PATH } from "../lib/ai-painter-autonomous-closed-loop-v1.mjs"
const cases=[
 ["current unknown cleanup cannot borrow a previous successful receipt",async()=>{
   assert.equal(cleanupForCurrentCall({ownedReceipt:{cleanupConfirmed:false}},{cleanupConfirmed:true}),false)
   assert.equal(cleanupForCurrentCall({ownedReceipt:null},{cleanupConfirmed:true}),false)
   assert.equal(cleanupForCurrentCall({ownedReceipt:{cleanupConfirmed:true}},null),true)
 }],
 ["native receipt binds retained PID, command, assignment, cleanup and exact streams",async()=>{
   const v={proof:{ownerPid:19,rootPid:20,rootCreationDateUtc:"2026-10-08T00:00:00Z",bindingBase64:"bound",assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,stdoutBytes:3,stderrBytes:0},ownerPid:19,bindingBase64:"bound",ownerClosed:true,protocolError:null,stdoutBytes:3,stderrBytes:0}
   assert.equal(validateNativeReceipt(v),true)
   for(const [key,value] of [["ownerPid",20],["assignedBeforeResume",false],["activeProcessesAfterCleanup",1],["stdoutBytes",4],["cleanupError","failed"],["observationError","failed"]])assert.equal(validateNativeReceipt({...v,proof:{...v.proof,[key]:value}}),false)
   assert.equal(validateNativeReceipt({...v,ownerClosed:false}),false);assert.equal(validateNativeReceipt({...v,proof:null,ownerPid:undefined}),false)
 }],
 ["explicit budgets preserve training2700 and admission600",async()=>{
   assert.equal(nativeBudget("training").timeoutMs,2700000);assert.equal(nativeBudget("qualification").timeoutMs,600000)
   assert.equal(nativeBudget("cpu").outputBytes,8388608);assert.throws(()=>nativeBudget("unknown"))
 }],
 ["immutable reads reject modified bytes and escaping nonexistent paths",async({fixture})=>{
   const root=fixture("paths"),b=write(root,".runtime/synthetic/file.json",{synthetic:true});assert.equal(JSON.parse(read(root,b)).synthetic,true)
   fs.appendFileSync(inside(root,b.path),"changed");assert.throws(()=>read(root,b))
   for(const logical of ["../escape","C:/escape","a//b","/escape"])assert.throws(()=>inside(root,logical))
   const other=fixture("outside"),junction=path.join(root,"out-junction")
   fs.symlinkSync(other,junction,process.platform==="win32"?"junction":"dir")
   try{assert.throws(()=>inside(root,"out-junction/nonexistent/nested/result.json"),/escaped registered roots/u)}finally{assert.equal(fs.lstatSync(junction).isSymbolicLink(),true);assert.equal(fs.realpathSync(junction),fs.realpathSync(other));fs.unlinkSync(junction)}
   write(root,".runtime/synthetic/junction-observation.json",{junction,target:other,rejected:true,junctionUnlinked:true})
 }],
 ["registered materializer and engine execute six synthetic phases with zero retry",async({fixture,projectRoot})=>{
   const root=fixture("engine");write(root,CLOSED_LOOP_CONTRACT_PATH,fs.readFileSync(inside(projectRoot,CLOSED_LOOP_CONTRACT_PATH)))
   const adapter="scripts/synthetic-adapter.mjs";write(root,adapter,Buffer.from(PHASES.map(p=>`export async function ${p}(){return {status:"passed",synthetic:true,optimizerSteps:0}}`).join("\n")))
   write(root,".runtime/input.json",{synthetic:true})
   const materialized=materializeAutonomousClosedLoopPackage({schemaVersion:"ai-painter-autonomous-closed-loop-candidate-v1",packageIdentity:"detail-synthetic-engine",capabilityVersion:CAPABILITY,ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:".runtime/ai-painter/detail-weight-synthetic-output",programFiles:{adapter},inputEvidencePaths:[".runtime/input.json"],phaseAdapters:Object.fromEntries(PHASES.map(p=>[p,{path:adapter,exportName:PHASE_EXPORTS[p]}]))},{root})
   const spec=JSON.parse(fs.readFileSync(inside(root,materialized.packagePath))),state=await runAutonomousClosedLoop({root,spec,packageSha256:materialized.packageSha256})
   assert.equal(state.state,"completed");assert.equal(spec.maxInfrastructureRecoveryAttempts,0)
   assert.deepEqual(Object.keys(spec.phaseAdapters),PHASES)
 }],
]
export async function runCases({projectRoot,fixture}){const items=[];for(const [name,run]of cases){try{await run({projectRoot,fixture});items.push({name,status:"passed",executionKind:"synthetic_structure"})}catch(error){items.push({name,status:"failed",error:String(error)})}}return items}
if(process.env.DETAIL_WEIGHT_INTERNAL_BATCH!=="1"){
 const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../.."),base=".runtime/ai-painter/detail-weight-lifecycle-test-fixtures/"+Date.now()
 for(const [name,run]of cases)test(name,async()=>{const fixture=suffix=>{const root=inside(projectRoot,base+"/"+suffix);fs.mkdirSync(root,{recursive:true});return root};await run({projectRoot,fixture})})
}
