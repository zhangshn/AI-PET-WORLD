import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {POLICY,PREDECESSOR,verifyClosedPredecessor,byteBinding,validateGpuPolicy,validateWorkerTerminal,requireDeadline,directoryBytes,currentCpuAcceptance,makeOutput,proofPassed} from "../diagnose-ai-painter-parameter60-causal-gpu.mjs";
import {requireRegistryDeadline} from "../../src/server/ai-painter-current-execution-registry.mjs";
const policy=JSON.parse(fs.readFileSync(new URL("../../data/ai-painter/system-governance/ai-painter-parameter60-causal-gpu-policy-v3.json",import.meta.url),"utf8"));
const copy=v=>JSON.parse(JSON.stringify(v));
test("exact new policy has one train failure and no training qualification",()=>assert.equal(validateGpuPolicy(policy),true));
test("successor cannot reset the consumed predecessor or expand its scope",()=>{
 const old=JSON.parse(fs.readFileSync(new URL("../../data/ai-painter/system-governance/ai-painter-parameter60-causal-gpu-policy-v2.json",import.meta.url),"utf8"));
 const claim={runId:"parameter60-gpu-4f7de93f-b3aa-4a65-89f3-969b03a75b67",policy:copy(PREDECESSOR.policy),automaticRetries:0};
 const worker={runId:claim.runId,policy:claim.policy,error:{message:"can't convert cuda:0 device type tensor to numpy. Use Tensor.cpu() to copy the tensor to host memory first."},counts:{cudaCalls:2,generatorForwards:0,optimizerUpdates:0}};
 const terminal={runId:claim.runId,status:"diagnostic_failed_closed",executionState:"failed_closed",workerOutput:{text:JSON.stringify(worker)}};
 const reader={bound:b=>b.path===PREDECESSOR.policy.path?old:(b.path===PREDECESSOR.attempt.path?claim:terminal),bytes:()=>Buffer.from("fixture")};
 assert.equal(verifyClosedPredecessor(reader,policy),true);
 const expanded=copy(policy);expanded.allowedActions.push("training");assert.throws(()=>verifyClosedPredecessor(reader,expanded));
 worker.counts.cudaCalls=3;terminal.workerOutput.text=JSON.stringify(worker);assert.throws(()=>verifyClosedPredecessor(reader,policy));
});
test("old policy and attempt namespace cannot activate the successor",()=>{
 for(const version of ["v1","v2"]){
  const old=JSON.parse(fs.readFileSync(new URL("../../data/ai-painter/system-governance/ai-painter-parameter60-causal-gpu-policy-"+version+".json",import.meta.url),"utf8"));
  assert.throws(()=>validateGpuPolicy(old));
  const broken=copy(policy);broken.attemptClaimPath=broken.outputRoot+"/attempt-"+version+".json";assert.throws(()=>validateGpuPolicy(broken));
 }
});
test("byte reader request strips summary bytes without replacing path or digest",()=>{
 assert.deepEqual(byteBinding({path:"private/report.json",sha256:"a".repeat(64),bytes:42}),{path:"private/report.json",sha256:"a".repeat(64)});
 assert.throws(()=>byteBinding({path:"private/report.json",sha256:"fake",bytes:42}));});
for(const [name,change] of [
  ["other parameter",p=>p.target.parameterName="other"],
  ["sample split",p=>p.scope.sampleSplit="validation"],
  ["GPU budget expansion",p=>p.resources.maxWallSeconds=181],
  ["retries",p=>p.resources.automaticRetries=1],
  ["original gate lowering",p=>p.comparison.atol=1e-4],
  ["old GPU qualification",p=>p.qualification.gpuExecutionAllowed=true],
  ["state replay",p=>p.sourceStateUse.historicalReplayAllowed=true],
  ["other graph",p=>p.scope.originalGeneratorParameterCount=107],
])test("reject "+name,()=>{const p=copy(policy);change(p);assert.throws(()=>validateGpuPolicy(p));});
function terminal(cpu=false){return {runId:"fixture",status:cpu?"cpu_preflight_passed_not_gpu_or_root_cause":"diagnostic_not_reproduced",
 trainingAllowed:false,stage4Qualified:false,historicalReplayAllowed:false,
 counts:{optimizerConstruction:0,optimizerUpdates:0,discriminatorAutograd:0,generatorForwards:cpu?0:1,
 generatorAutogradAttempts:cpu?0:4,generatorAutogradCompleted:cpu?0:4,cudaCalls:0,localFp64WeightVjp:0}};}
test("non-reproduced result is evidence only",()=>validateWorkerTerminal(terminal(),false));
test("non-reproduction cannot run local VJPs",()=>{const v=terminal();v.counts.localFp64WeightVjp=1;assert.throws(()=>validateWorkerTerminal(v,false));});
test("CPU cannot report CUDA or full model",()=>{const v=terminal(true);v.counts.cudaCalls=1;assert.throws(()=>validateWorkerTerminal(v,true));});
test("optimizer and D autograd are forbidden",()=>{for(const k of ["optimizerConstruction","optimizerUpdates","discriminatorAutograd"]){
 const v=terminal();v.counts[k]=1;assert.throws(()=>validateWorkerTerminal(v,false));}});
test("unknown/unfinished status cannot be accepted",()=>{const v=terminal();v.status="diagnostic_target_gate_observed";assert.throws(()=>validateWorkerTerminal(v,false));});
test("expired wall budget rejects even saved evidence",()=>{assert.throws(()=>requireDeadline(10,10));requireDeadline(10,9);});
test("counts cannot be negative, fractional or complete more than attempted",()=>{
 for(const change of [v=>v.counts.generatorForwards=-1,v=>v.counts.generatorAutogradAttempts=0.5,
 v=>v.counts.generatorAutogradCompleted=5,v=>v.counts.localFp64WeightVjp=-1]){
 const v=terminal();change(v);assert.throws(()=>validateWorkerTerminal(v,false));}});
test("cleanup booleans without actual native proof cannot grant admission",()=>{
 assert.throws(()=>proofPassed({cleanupConfirmed:true,guardReleaseConfirmed:true,ownerClosed:true,emptyJob:true}));});
test("registry process probes consume remaining deadline, old default unchanged",()=>{
 assert.equal(requireRegistryDeadline(),10000);assert.throws(()=>requireRegistryDeadline(Date.now()-1));
 assert(requireRegistryDeadline(Date.now()+100)<=100);assert.throws(()=>requireRegistryDeadline(1.1));});
function privateRoot(){return fs.mkdtempSync(path.join(os.tmpdir(),"cp60-private-"));}
function removePrivate(root){assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
 assert(path.basename(root).startsWith("cp60-private-"));fs.rmSync(root,{recursive:true});}
test("terminal write checks complete quota before IO, including the CPU ceiling",()=>{
 const root=privateRoot();try{fs.mkdirSync(path.join(root,".runtime"));const context=makeOutput(root,"fixture",policy);
 context.setAccounting({maximum:8388608,measure:()=>({totalBytes:8388608-65536})});
 assert.throws(()=>context.put("terminal.json",{status:"completed"}));
 assert.equal(fs.existsSync(path.join(context.absolute,"terminal.json")),false);
 context.put("failure.json",{status:"failed_closed"},{failure:true});
 assert(fs.existsSync(path.join(context.absolute,"failure.json")));}finally{removePrivate(root);}});
test("CPU admission rejects cross-run and missing request before GPU",()=>{
 const root=privateRoot();try{const output=path.join(root,policy.outputRoot);fs.mkdirSync(output,{recursive:true});
 const runId="parameter60-cpu-current-fixture",pointer={path:policy.outputRoot+"/"+runId+"/cpu-acceptance.json",sha256:"a".repeat(64)};
 fs.writeFileSync(path.join(output,"current-cpu-acceptance.json"),JSON.stringify(pointer));
 const bound={policy,reader:{bound:()=>null},lineage:[],interpreter:{path:"fixture",sha256:"b".repeat(64)}};
 for(const wrong of ["other-run",runId]){
 const value={status:"current_cpu_accepted_not_gpu_result",runId,worker:{...terminal(true),runId:wrong},policy:copy(POLICY),programBindings:[],interpreter:bound.interpreter};
 bound.reader.bound=b=>b===pointer?value:(b?.path===pointer.path?value:null);
 assert.throws(()=>currentCpuAcceptance(root,bound));}
 }finally{removePrivate(root);}});
test("only private output is counted including nested files",()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),"cp60-private-"));
 try{fs.mkdirSync(path.join(root,"nested"));fs.writeFileSync(path.join(root,"a"),"abc");fs.writeFileSync(path.join(root,"nested/b"),"de");
 assert.equal(directoryBytes(root),5);}finally{
 assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith("cp60-private-"));
 fs.rmSync(root,{recursive:true});}});

