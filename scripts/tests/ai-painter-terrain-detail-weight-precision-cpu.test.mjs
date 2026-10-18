import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {validatePolicy,validateResult,keepPrimaryError,POLICY} from "../check-ai-painter-terrain-detail-weight-precision-cpu.mjs";
const policy=JSON.parse(fs.readFileSync(new URL("../../data/ai-painter/system-governance/ai-painter-terrain-detail-weight-precision-cpu-policy-v1.json",import.meta.url)));
const copy=value=>JSON.parse(JSON.stringify(value));
test("evidence/finalization errors never replace the primary CPU failure",()=>{
 const first=new Error("original CPU calculation failed"),second=new Error("evidence write failed");
 assert.equal(keepPrimaryError(first,second,"secondaryEvidenceError"),first);
 assert.equal(first.message,"original CPU calculation failed");assert(first.secondaryEvidenceError.includes(second.message));
 assert.equal(keepPrimaryError(first,new Error("finalization failed"),"secondaryFinalizationError"),first);
});
test("a first finalization failure is retained when execution had no primary error",()=>{
 const first=new Error("finalization failed");assert.equal(keepPrimaryError(null,first,"secondaryFinalizationError"),first);
});
test("registered candidate CPU scope preserves the original gate and limits",()=>validatePolicy(policy));
for(const [name,change] of [
 ["GPU",p=>p.qualification.gpuExecutionAllowed=true],
 ["training",p=>p.qualification.trainingAllowed=true],
 ["other target",p=>p.target.parameterIndex=52],
 ["validation",p=>p.scope.split="validation"],
 ["failure state",p=>p.scope.failureStateInitializationAllowed=true],
 ["wall expansion",p=>p.resources.maxWallSeconds=121],
 ["retry",p=>p.resources.automaticRetries=1],
 ["gate lowering",p=>p.comparison.atol=1e-5],
])test("reject "+name,()=>{const p=copy(policy);change(p);assert.throws(()=>validatePolicy(p));});
function result(){return {status:"cpu_candidate_verified_inactive",executionState:"completed",policy:copy(POLICY),candidate:policy.candidate,
 counts:copy(policy.limits),cudaInitialized:false,trainingAllowed:false,stage4Qualified:false,
 failedStateOrCheckpointLoaded:false,pngOrCheckpointWritten:false,nativeFull256ForwardBytesEqual:true,
 fullOriginalLossGradientGatePassed:true,beforeAfterStateBytesEqual:true,capturedFixtureOutsideToleranceElements:0,
 componentTests:{passed:8,skipped:0}};}
test("complete CPU result remains inactive and not GPU/training qualification",()=>validateResult(result(),policy));
for(const key of ["cudaInitialized","trainingAllowed","stage4Qualified","failedStateOrCheckpointLoaded","pngOrCheckpointWritten"])
 test("reject observed forbidden "+key,()=>{const v=result();v[key]=true;assert.throws(()=>validateResult(v,policy));});
test("incomplete actual full-model or fixture counts cannot pass",()=>{
 for(const key of ["fullBaselineForwards","fullCandidateForwards","fullGeneratorAutogradCalls","operatorFixtureAutogradCalls"]){
  const v=result();v.counts[key]=0;assert.throws(()=>validateResult(v,policy));}
 const v=result();v.nativeFull256ForwardBytesEqual=false;assert.throws(()=>validateResult(v,policy));
});
test("component-only or skipped checks cannot substitute for full validation",()=>{
 const v=result();v.fullOriginalLossGradientGatePassed=false;assert.throws(()=>validateResult(v,policy));
 const skipped=result();skipped.componentTests.skipped=1;assert.throws(()=>validateResult(skipped,policy));
});
