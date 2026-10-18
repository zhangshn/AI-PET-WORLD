import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import test from "node:test";
import {POLICY,bindPolicy,byteBinding,validateGpuPolicy,validateWorkerTerminal,requireDeadline,directoryBytes,currentCpuAcceptance,makeOutput,proofPassed,collectPythonClosure,runCpuPreflight} from "../diagnose-ai-painter-parameter88-causal-gpu-v1.mjs";
import {requireRegistryDeadline} from "../../src/server/ai-painter-current-execution-registry.mjs";
const policy=JSON.parse(fs.readFileSync(new URL("../../data/ai-painter/system-governance/ai-painter-parameter88-causal-gpu-policy-v1.json",import.meta.url),"utf8"));
const copy=v=>JSON.parse(JSON.stringify(v));
test("exact new policy has one train failure and no training qualification",()=>assert.equal(validateGpuPolicy(policy),true));
test("old policy schema or claim cannot activate parameter88",()=>{
 const old=copy(policy);old.schemaVersion="ai-painter-parameter88-causal-gpu-policy-v3";assert.throws(()=>validateGpuPolicy(old));
 const bad=copy(policy);bad.attemptClaimPath=bad.outputRoot+"/attempt-v3.json";assert.throws(()=>validateGpuPolicy(bad));
});
bindPolicy({path:"data/ai-painter/system-governance/ai-painter-parameter88-causal-gpu-policy-v1.json",sha256:"cd8da08f8eeeeb6ad486db958f1ef50f5e887969bf6423db6cf446d8de79d647"});
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
  ["missing fifth gradient",p=>p.gradientLabels.pop()],
])test("reject "+name,()=>{const p=copy(policy);change(p);assert.throws(()=>validateGpuPolicy(p));});
function terminal(cpu=false){return {runId:"fixture",status:cpu?"cpu_preflight_passed_not_gpu_or_root_cause":"diagnostic_not_reproduced",
 trainingAllowed:false,stage4Qualified:false,historicalReplayAllowed:false,
 counts:{optimizerConstruction:0,optimizerUpdates:0,discriminatorAutograd:0,generatorForwards:cpu?0:1,
 generatorAutogradAttempts:cpu?0:5,generatorAutogradCompleted:cpu?0:5,cudaCalls:0,localFp64WeightVjp:0}};}
test("non-reproduced result is evidence only",()=>validateWorkerTerminal(terminal(),false));
test("non-reproduction cannot run local VJPs",()=>{const v=terminal();v.counts.localFp64WeightVjp=1;assert.throws(()=>validateWorkerTerminal(v,false));});
test("CPU cannot report CUDA or full model",()=>{const v=terminal(true);v.counts.cudaCalls=1;assert.throws(()=>validateWorkerTerminal(v,true));});
test("optimizer and D autograd are forbidden",()=>{for(const k of ["optimizerConstruction","optimizerUpdates","discriminatorAutograd"]){
 const v=terminal();v.counts[k]=1;assert.throws(()=>validateWorkerTerminal(v,false));}});
test("unknown/unfinished status cannot be accepted",()=>{const v=terminal();v.status="diagnostic_target_gate_observed";assert.throws(()=>validateWorkerTerminal(v,false));});
test("expired wall budget rejects even saved evidence",()=>{assert.throws(()=>requireDeadline(10,10));requireDeadline(10,9);});
test("counts cannot be negative, fractional or complete more than attempted",()=>{
 for(const change of [v=>v.counts.generatorForwards=-1,v=>v.counts.generatorAutogradAttempts=0.5,
 v=>v.counts.generatorAutogradCompleted=6,v=>v.counts.localFp64WeightVjp=-1]){
 const v=terminal();change(v);assert.throws(()=>validateWorkerTerminal(v,false));}});
test("cleanup booleans without actual native proof cannot grant admission",()=>{
 assert.throws(()=>proofPassed({cleanupConfirmed:true,guardReleaseConfirmed:true,ownerClosed:true,emptyJob:true}));});
test("registry process probes consume remaining deadline, old default unchanged",()=>{
 assert.equal(requireRegistryDeadline(),10000);assert.throws(()=>requireRegistryDeadline(Date.now()-1));
 assert(requireRegistryDeadline(Date.now()+100)<=100);assert.throws(()=>requireRegistryDeadline(1.1));});
function privateRoot(){return fs.mkdtempSync(path.join(os.tmpdir(),"cp88-private-"));}
function removePrivate(root){assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
 assert(path.basename(root).startsWith("cp88-private-"));fs.rmSync(root,{recursive:true});}
test("terminal write checks complete quota before IO, including the CPU ceiling",()=>{
 const root=privateRoot();try{fs.mkdirSync(path.join(root,".runtime"));const context=makeOutput(root,"fixture",policy);
 context.setAccounting({maximum:8388608,measure:()=>({totalBytes:8388608-65536})});
 assert.throws(()=>context.put("terminal.json",{status:"completed"}));
 assert.equal(fs.existsSync(path.join(context.absolute,"terminal.json")),false);
 context.put("failure.json",{status:"failed_closed"},{failure:true});
 assert(fs.existsSync(path.join(context.absolute,"failure.json")));}finally{removePrivate(root);}});
test("CPU admission rejects cross-run and missing request before GPU",()=>{
 const root=privateRoot();try{const output=path.join(root,policy.outputRoot);fs.mkdirSync(output,{recursive:true});
 const runId="parameter88-cpu-current-fixture",pointer={path:policy.outputRoot+"/"+runId+"/cpu-acceptance.json",sha256:"a".repeat(64)};
 fs.writeFileSync(path.join(output,"current-cpu-acceptance.json"),JSON.stringify(pointer));
 const bound={policy,reader:{bound:()=>null},lineage:[],interpreter:{path:"fixture",sha256:"b".repeat(64)}};
 for(const wrong of ["other-run",runId]){
 const value={status:"current_cpu_accepted_not_gpu_result",runId,worker:{...terminal(true),runId:wrong},policy:copy(POLICY),programBindings:[],interpreter:bound.interpreter};
 bound.reader.bound=b=>b===pointer?value:(b?.path===pointer.path?value:null);
 assert.throws(()=>currentCpuAcceptance(root,bound));}
 }finally{removePrivate(root);}});
test("only private output is counted including nested files",()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),"cp88-private-"));
 try{fs.mkdirSync(path.join(root,"nested"));fs.writeFileSync(path.join(root,"a"),"abc");fs.writeFileSync(path.join(root,"nested/b"),"de");
 assert.equal(directoryBytes(root),5);}finally{
 assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith("cp88-private-"));
 fs.rmSync(root,{recursive:true});}});

test("actual AST closure handles package submodule imports and ignores unused old roles",()=>{
 const root=process.cwd(),profile="ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_v1.py";
 const dependency="ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_cpu_v1.py";
 const code=new Map([[profile,"import painter_stage4_object_support_structure_training_profile_cpu_v1\n"],
  ["ml/ai-painter/scripts/diagnose_parameter88_causal_gpu_v1.py","from ai_painter.complete_world import parameter88_causal_observation_v1\n"]]);
 const hash=s=>crypto.createHash("sha256").update(s).digest("hex"),read=[];
 const original={profile:{path:profile,sha256:hash(code.get(profile))},dependency:{path:dependency,sha256:hash("")},
  unusedJs:{path:"src/server/ai-console/training-history-detail-adapters.mjs",sha256:"0".repeat(64)},
  unusedPython:{path:"ml/ai-painter/scripts/analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py",sha256:"0".repeat(64)}};
 const reader={bytes(logical,expected){read.push(logical);assert(!logical.includes("training-history")&&!logical.includes("analyze_stage4"));
   const raw=Buffer.from(code.get(logical)??"");if(expected)assert.equal(hash(raw),expected,"fixture immutable source mismatch");return raw;}};
 const bindings=collectPythonClosure(root,reader,original,[],Date.now()+120000);
 assert(bindings.some(b=>b.path===dependency));
 assert(bindings.some(b=>b.path.endsWith("/parameter88_causal_observation_v1.py")));
 assert(bindings.some(b=>b.path==="ml/ai-painter/src/ai_painter/__init__.py"));
 assert(read.length<20);assert(!read.some(p=>p.endsWith(".pt")));
 const stale={...original,profile:{path:profile,sha256:"0".repeat(64)}};
 assert.throws(()=>collectPythonClosure(root,reader,stale,[],Date.now()+120000),/fixture immutable/);
});

test("consumed CPU preparation fails before source or original archive access",async()=>{
 const root=privateRoot();try{
  const file=path.join(root,policy.outputRoot,"cpu-preparation-attempt-v1.json");fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,"{}",{flag:"wx"});
  await assert.rejects(runCpuPreflight(root,POLICY),/already consumed/);
 }finally{removePrivate(root);}
});


