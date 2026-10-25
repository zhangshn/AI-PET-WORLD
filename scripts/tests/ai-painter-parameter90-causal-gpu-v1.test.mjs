import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import test from "node:test";
import {POLICY,bindPolicy,byteBinding,validateGpuPolicy,validateWorkerTerminal,requireDeadline,directoryBytes,currentCpuAcceptance,makeOutput,proofPassed,collectPythonClosure,runCpuPreflight} from "../diagnose-ai-painter-parameter90-causal-gpu-v1.mjs";
import {requireRegistryDeadline} from "../../src/server/ai-painter-current-execution-registry.mjs";
import {frozenInactiveFunctions} from "../diagnose-ai-painter-parameter90-causal-gpu-v1.mjs";
import {validateCoordinateNarrative} from "../diagnose-ai-painter-parameter90-causal-gpu-v1.mjs";
const policy={
  "schemaVersion": "ai-painter-parameter90-causal-gpu-policy-v1",
  "status": "registered_one_shot_zero_update_diagnostic_not_training",
  "formalSpecification": {
    "path": "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    "version": "AI-PAINTER-SPEC-1.101",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "scope": {
    "resolution": [
      256,
      192
    ],
    "failureRunId": "decode1-entry-completion-v2-079d72e9-1a7e-4c2c-84a3-767836b72fe1",
    "failureSampleId": "ai-cold-start-v7-v7-capacity-slot-174-forested-low-mountain-v2",
    "sampleSplit": "train",
    "sampleCount": 1,
    "originalDataSplits": "48/8/4/4 unchanged",
    "sourceStateTiming": "after_exception",
    "sourceReplayAllowedRemainsFalse": true,
    "waterBuildingPersonalityOrOtherResolutionWork": false
  },
  "sourceStateUse": {
    "purpose": "failure_evidence_zero_update_gpu_diagnostic_only",
    "trainingInitializationAllowed": false,
    "historicalReplayAllowed": false,
    "originalFailureUnchanged": true,
    "archivedGradientsInstalled": false,
    "archivedRngRestored": false,
    "requiresGradHistoricalClaim": false
  },
  "target": {
    "parameterIndex": 90,
    "parameterName": "core.core.final_rgb_decoder.base.layers.4.weight",
    "modulePath": "core.core.final_rgb_decoder.base.layers.4",
    "weightShape": [
      3,
      48,
      1,
      1
    ],
    "elements": 144,
    "dtype": "torch.float32",
    "identityRule": "jointly verify index/name/parameter graph/module type/source SHA/weight bytes and before-after versions; shape alone is insufficient",
    "historicalVersionRule": "Record actual fresh-instance versions; do not fabricate them to match archived counters",
    "convolutionConfiguration": "Bind the exact PrecisionFinalRGBConv and rgb_bias_reduction_precision implementation: batch1,input[1,48,192,256],output[1,3,192,256],kernel1x1/stride1/pad0/dilation1/groups1/zeros; retain only selected input1/output0 planes. Weight VJP remains native FP32; the unchanged bias-only FP64 rule is not a new repair.",
    "coordinates": [
      [
        0,
        1,
        0,
        0
      ]
    ],
    "captureInputChannel": 1,
    "captureOutputChannel": 0
  },
  "comparison": {
    "atol": 0.000001,
    "rtol": 0.00001,
    "originalGateKept": true,
    "originalGradientValuesKept": true,
    "evidenceOnly": true,
    "definitions": {
      "A": "The selected coordinate of observed native actualTotal target gradient, cast to FP64 only for arithmetic",
      "Bi": "The selected coordinate of each of four native component target gradients cast to FP64",
      "E": "The selected coordinate of the original ordered FP32 sum of four native component gradients, then cast to FP64",
      "T": "CPU FP64 products with stable summation for the selected coordinate using input1 plane and actualTotal output0-adjoint plane",
      "Si": "Four CPU FP64 selected-coordinate references using the respective component adjoint planes",
      "S": "FP64 stable sum of the four Si",
      "B": "FP64 stable sum of the four saved native FP32 component values at this selected coordinate"
    },
    "decomposition": "A-E=(T-S)+(A-T)-(B-S)+(B-E)",
    "interpretation": "Only the one selected coordinate in this new observation is covered. T-S observes selected upstream contribution; A-T and B-S compare native gradients to finite-precision local references; B-E is final component-sum rounding. The observational decomposition is not a proof of implementation error, necessary FP64 repair, complete-model cause or historical replay. Hooks and synchronization may perturb timing. No threshold changes.",
    "upstreamRule": "Retain exact original FP32 input1 and output0-adjoint planes, check identity/finiteness and count; record plane hashes and signed contractions. Other channels and coordinates are outside this diagnosis."
  },
  "metadataCanonicalProgram": {
    "path": "scripts/lib/real-earth-region-governance.mjs",
    "sha256": "c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1"
  },
  "nodeInterpreter": {
    "path": "C:\\Program Files\\nodejs\\node.exe",
    "sha256": "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088"
  },
  "captureRestrictions": {
    "persistFullFp64UpstreamAdjointDifference": false,
    "persistSecondFullModelOrGlobalGradientSnapshot": false,
    "originalArchiveCopiedToOutput": false,
    "actualSerializedBytesMustFit": true,
    "upstreamDifference": "Only channel1 input and channel0 output-adjoint planes for bound [0,1,0,0]; no second full activation or global-gradient capture."
  },
  "counts": {
    "fullGeneratorForward": 1,
    "fullGeneratorAutograd": 5,
    "discriminatorAutograd": 0,
    "optimizerConstruction": 0,
    "optimizerUpdates": 0,
    "localFp64WeightVjp": 5,
    "extraNativeBackwardReplay": 0,
    "extraModelAutograd": 0
  },
  "resources": {
    "maxWallSeconds": 180,
    "threads": 2,
    "maxGpuMemoryFraction": 0.7,
    "maximumTemperatureC": 85,
    "minimumFreeVramMiB": 2048,
    "minimumFreeDiskMiB": 2048,
    "maxOutputBytes": 134217728,
    "maxTargetCaptureBytes": 67108864,
    "attempts": 1,
    "automaticRetries": 0,
    "maxStreamBytes": 8388608,
    "cleanupReserveMs": 1000,
    "failureEvidenceReserveBytes": 65536,
    "temperaturePollMs": 1000,
    "cpuPreflightMaxWallSeconds": 120,
    "cpuPreflightMaxOutputBytes": 8388608,
    "finalizationReserveMs": 8000
  },
  "cleanup": {
    "transport": "bounded-stream-capture-v2",
    "privateJob": true,
    "assignedBeforeResume": true,
    "killOnJobClose": true,
    "requiredLiveProof": [
      "ownerPid",
      "bindingBase64",
      "assignedBeforeResume",
      "killOnJobClose",
      "emptyJob",
      "activeProcessesAfterCleanup=0",
      "stdoutClosed",
      "stderrClosed",
      "transportCompleted",
      "streamClosureVersion=bounded-stream-capture-v2",
      "streamCaptureError=null",
      "streamTransportError=null",
      "observationError=null"
    ],
    "unknownCleanup": "retain_unique_guard_and_fail_closed_without_auto_recovery",
    "historicalObservationIsAuthority": false
  },
  "registry": {
    "path": ".runtime/ai-painter/current-execution-registry/current.json",
    "sameWriterAndGuard": true,
    "latestTrainingTerminalUnchanged": true,
    "diagnosisIsTraining": false,
    "activeProcessRole": "parameter90_zero_update_diagnostic_v1_supervisor_not_training_worker"
  },
  "qualification": {
    "gpuExecutionAllowed": false,
    "trainingAllowed": false,
    "modelModificationAllowed": false,
    "checkpointWritten": false,
    "rootCauseProven": false,
    "stage4Qualified": false,
    "capabilityReleased": false,
    "runtimeFrameAllowed": false
  },
  "outputRoot": ".runtime/ai-painter/parameter90-causal-gpu-diagnostics-v1",
  "attemptClaimPath": ".runtime/ai-painter/parameter90-causal-gpu-diagnostics-v1/attempt-v1.json",
  "gradientLabels": [
    "actualTotal",
    "structuredObjective",
    "wholeFrameFidelity",
    "objectCoreRgb",
    "objectSupportStructure"
  ],
  "cpuPreparation": {
    "maxWallSeconds": 120,
    "threads": 2,
    "maxOutputBytes": 8388608,
    "attempts": 1,
    "automaticRetries": 0,
    "fullModelForwards": 0,
    "fullModelAutogradCalls": 0,
    "optimizerConstruction": 0,
    "optimizerUpdates": 0,
    "cudaCalls": 0,
    "scope": "bound archive/state/sample identity, synthetic observer and exact request ABI; no real forward"
  }
};
const copy=v=>JSON.parse(JSON.stringify(v));
test("exact new policy has one train failure and no training qualification",()=>assert.equal(validateGpuPolicy(policy),true));
test("inactive nested legacy routes are excluded only for their exact frozen bytes",()=>{
 const logical="ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_detail_weight_precision.py";
 const bytes=fs.readFileSync(logical),binding={sha256:crypto.createHash("sha256").update(bytes).digest("hex")};
 assert.deepEqual(frozenInactiveFunctions(logical,bytes,binding),["authenticate_diagnostic_capture","_install_diagnostic_capture"]);
 assert.throws(()=>frozenInactiveFunctions(logical,Buffer.concat([bytes,Buffer.from("\n")]),binding),/changed/);
 assert.throws(()=>frozenInactiveFunctions(logical,bytes,{sha256:"0".repeat(64)}),/binding/);
 assert.deepEqual(frozenInactiveFunctions("another.py",bytes,binding),[]);
});
test("old policy schema or claim cannot activate parameter90",()=>{
 const old=copy(policy);old.schemaVersion="ai-painter-parameter90-causal-gpu-policy-v3";assert.throws(()=>validateGpuPolicy(old));
 const bad=copy(policy);bad.attemptClaimPath=bad.outputRoot+"/attempt-v3.json";assert.throws(()=>validateGpuPolicy(bad));
});
bindPolicy({path:"data/ai-painter/system-governance/ai-painter-parameter90-causal-gpu-policy-v1.json",sha256:"a".repeat(64)});
test("byte reader request strips summary bytes without replacing path or digest",()=>{
 assert.deepEqual(byteBinding({path:"private/report.json",sha256:"a".repeat(64),bytes:42}),{path:"private/report.json",sha256:"a".repeat(64)});
 assert.throws(()=>byteBinding({path:"private/report.json",sha256:"fake",bytes:42}));});
for(const [name,change] of [
  ["other parameter",p=>p.target.parameterName="other"],
  ["wrong canonical program",p=>p.metadataCanonicalProgram.sha256="0".repeat(64)],
  ["other target index",p=>p.target.parameterIndex=88],
  ["other coordinates",p=>p.target.coordinates[0][0]=11],
  ["other captured channel",p=>p.target.captureInputChannel=80],
  ["other failure Run",p=>p.scope.failureRunId="old-run"],
  ["altered gradient values",p=>p.comparison.originalGradientValuesKept=false],
  ["archived RNG installation",p=>p.sourceStateUse.archivedRngRestored=true],
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
function privateRoot(){return fs.mkdtempSync(path.join(os.tmpdir(),"cp90-private-"));}
function removePrivate(root){assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
 assert(path.basename(root).startsWith("cp90-private-"));fs.rmSync(root,{recursive:true});}
test("terminal write checks complete quota before IO, including the CPU ceiling",()=>{
 const root=privateRoot();try{fs.mkdirSync(path.join(root,".runtime"));const context=makeOutput(root,"fixture",policy);
 context.setAccounting({maximum:8388608,measure:()=>({totalBytes:8388608-65536})});
 assert.throws(()=>context.put("terminal.json",{status:"completed"}));
 assert.equal(fs.existsSync(path.join(context.absolute,"terminal.json")),false);
 context.put("failure.json",{status:"failed_closed"},{failure:true});
 assert(fs.existsSync(path.join(context.absolute,"failure.json")));}finally{removePrivate(root);}});
test("CPU admission rejects cross-run and missing request before GPU",()=>{
 const root=privateRoot();try{const output=path.join(root,policy.outputRoot);fs.mkdirSync(output,{recursive:true});
 const runId="parameter90-cpu-current-fixture",pointer={path:policy.outputRoot+"/"+runId+"/cpu-acceptance.json",sha256:"a".repeat(64)};
 fs.writeFileSync(path.join(output,"current-cpu-acceptance.json"),JSON.stringify(pointer));
 const bound={policy,reader:{bound:()=>null},lineage:[],interpreter:{path:"fixture",sha256:"b".repeat(64)}};
 for(const wrong of ["other-run",runId]){
 const value={status:"current_cpu_accepted_not_gpu_result",runId,worker:{...terminal(true),runId:wrong},policy:copy(POLICY),programBindings:[],interpreter:bound.interpreter};
 bound.reader.bound=b=>b===pointer?value:(b?.path===pointer.path?value:null);
 assert.throws(()=>currentCpuAcceptance(root,bound));}
 }finally{removePrivate(root);}});
test("only private output is counted including nested files",()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),"cp90-private-"));
 try{fs.mkdirSync(path.join(root,"nested"));fs.writeFileSync(path.join(root,"a"),"abc");fs.writeFileSync(path.join(root,"nested/b"),"de");
 assert.equal(directoryBytes(root),5);}finally{
 assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith("cp90-private-"));
 fs.rmSync(root,{recursive:true});}});

test("actual AST closure handles package submodule imports and ignores unused old roles",()=>{
 const root=process.cwd(),profile="ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py";
 const dependency="ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_cpu_v1.py";
 const code=new Map([[profile,"import painter_stage4_object_support_structure_training_profile_cpu_v1\n"],
  ["ml/ai-painter/scripts/diagnose_parameter90_causal_gpu_v1.py","from ai_painter.complete_world import parameter90_causal_observation_v1\n"]]);
 const hash=s=>crypto.createHash("sha256").update(s).digest("hex"),read=[];
 const original={profile:{path:profile,sha256:hash(code.get(profile))},dependency:{path:dependency,sha256:hash("")},
  unusedJs:{path:"src/server/ai-console/training-history-detail-adapters.mjs",sha256:"0".repeat(64)},
  unusedPython:{path:"ml/ai-painter/scripts/analyze_stage4_appearance_regime_gradient_failure_snapshot_cpu.py",sha256:"0".repeat(64)}};
 const reader={bytes(logical,expected){read.push(logical);assert(!logical.includes("training-history")&&!logical.includes("analyze_stage4"));
   const raw=Buffer.from(code.get(logical)??"");if(expected)assert.equal(hash(raw),expected,"fixture immutable source mismatch");return raw;}};
 const bindings=collectPythonClosure(root,reader,original,[],Date.now()+120000);
 assert(bindings.some(b=>b.path===dependency));
 assert(bindings.some(b=>b.path.endsWith("/parameter90_causal_observation_v1.py")));
 assert(bindings.some(b=>b.path==="ml/ai-painter/src/ai_painter/__init__.py"));
 assert(read.length<20);assert(!read.some(p=>p.endsWith(".pt")));
 const stale={...original,profile:{path:profile,sha256:"0".repeat(64)}};
 assert.throws(()=>collectPythonClosure(root,reader,stale,[],Date.now()+120000),/fixture immutable/);
});

test("current decode2 failure uses a distinct bound route, coordinate and weight without changing resources",()=>{
 const next=structuredClone(policy);
 next.schemaVersion="ai-painter-parameter90-causal-gpu-policy-v2";
 next.capabilityVersion="parameter90_causal_zero_update_v2";
 next.formalSpecification.version="AI-PAINTER-SPEC-1.118";
 next.modelCapabilityVersion="stage4_mvp256_dry_factorized_ecology_decode2_entry_weight_precision_v1";
 next.objectSupportStructureWeight=1;
 next.scope.failureRunId="d2-ss1-v1-a43899c0-e05e-4ec6-b0fd-b99457b0fb64";
 next.scope.failureSampleId="ai-cold-start-v7-v7-capacity-slot-173-grassland-forest-transition-v2";
 next.target.coordinates=[[1,7,0,0]];next.target.captureInputChannel=7;next.target.captureOutputChannel=1;
 next.outputRoot=".runtime/ai-painter/parameter90-causal-gpu-diagnostics-v2";
 next.attemptClaimPath=next.outputRoot+"/attempt-v1.json";
 validateGpuPolicy(next);assert.deepEqual(next.resources,policy.resources);
 for(const change of [p=>{p.target.coordinates=[[0,1,0,0]]},p=>{p.objectSupportStructureWeight=.1},
   p=>{p.modelCapabilityVersion="old-model"},p=>{p.outputRoot=policy.outputRoot},p=>{p.comparison.atol=1e-5}]){
   const bad=structuredClone(next);change(bad);assert.throws(()=>validateGpuPolicy(bad));
 }
});

test("the exact greater-than256 capture-only branch stays inactive in the bounded diagnostic",()=>{
 const logical="ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py";
 const bytes=fs.readFileSync(logical),binding={path:logical,sha256:"6363c4065b9dbec4376594d56664d6c0ecfdb395df61879f9045b2e75cb9e153"};
 assert.deepEqual(frozenInactiveFunctions(logical,bytes,binding),["_joint_program_limit"]);
 assert.throws(()=>frozenInactiveFunctions(logical,Buffer.concat([bytes,Buffer.from("\n")]),binding),/changed/);
 assert.throws(()=>frozenInactiveFunctions(logical,bytes,{...binding,sha256:"0".repeat(64)}),/binding/);
});

test("single-row diagnosis does not activate the exact unused package loader",()=>{
 const logical="ml/ai-painter/src/ai_painter/complete_world/split_release.py";
 const bytes=fs.readFileSync(logical),binding={path:logical,sha256:"d6e05cf98a7902592d1b6518968eedb72961a57872d67a6e0695a4572101d7ea"};
 assert.deepEqual(frozenInactiveFunctions(logical,bytes,binding),["load_package"]);
 assert.throws(()=>frozenInactiveFunctions(logical,Buffer.concat([bytes,Buffer.from("\n")]),binding),/changed/);
 assert.throws(()=>frozenInactiveFunctions(logical,bytes,{...binding,sha256:"0".repeat(64)}),/binding/);
});

test("coordinate and channel prose must agree with the actual bound target",()=>{
 const p={target:{coordinates:[[1,7,0,0]],captureInputChannel:7,captureOutputChannel:1},
  gateFailureContinuation:{localContrastPermittedOnlyIf:['a','b','The bound [1,7,0,0] coordinate exceeds the unchanged original absolute/relative tolerance']},
  captureRestrictions:{upstreamDifference:'Only channel7 input and channel1 output-adjoint planes for bound [1,7,0,0]; no second full activation or global-gradient capture.'}};
 validateCoordinateNarrative(p);
 const oldCoordinate=structuredClone(p);oldCoordinate.gateFailureContinuation.localContrastPermittedOnlyIf[2]=oldCoordinate.gateFailureContinuation.localContrastPermittedOnlyIf[2].replace('[1,7,0,0]','[0,1,0,0]');
 assert.throws(()=>validateCoordinateNarrative(oldCoordinate),/coordinate narrative/);
 const oldChannels=structuredClone(p);oldChannels.captureRestrictions.upstreamDifference=oldChannels.captureRestrictions.upstreamDifference.replace('channel7 input and channel1','channel1 input and channel0');
 assert.throws(()=>validateCoordinateNarrative(oldChannels),/channel narrative/);
});

test("consumed CPU preparation fails before source or original archive access",async()=>{
 const root=privateRoot();try{
  const file=path.join(root,policy.outputRoot,"cpu-preparation-attempt-v1.json");fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,"{}",{flag:"wx"});
  await assert.rejects(runCpuPreflight(root,POLICY),/already consumed/);
 }finally{removePrivate(root);}
});
