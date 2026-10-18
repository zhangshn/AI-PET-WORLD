import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {validatePolicy,validateResult,keepPrimaryError,collectSourceClosure,verifyPredecessor,validatePredecessorDocuments,
 consumeRevision2Attempt,POLICY,PREDECESSOR,CANDIDATE,LIMITS} from "../check-ai-painter-final-rgb-base-weight-precision-cpu-v1.mjs";
import {createReader} from "../lib/ai-painter-stage4-dataset-audit.mjs";
import {proofPassed} from "../diagnose-ai-painter-parameter88-causal-gpu-v1.mjs";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const policy=JSON.parse(fs.readFileSync(path.join(ROOT,POLICY.path))),copy=v=>JSON.parse(JSON.stringify(v));
const labels=["actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb","objectSupportStructure"];
test("registered 1.76 revision2 CPU policy preserves scope and remains inactive",()=>assert.equal(validatePolicy(policy),true));
test("current entry and results reject original v1 policy identity",()=>{
 const old=JSON.parse(fs.readFileSync(path.join(ROOT,PREDECESSOR.policy.path)));
 assert.throws(()=>validatePolicy(old));
 const value=result();value.policy=copy(PREDECESSOR.policy);assert.throws(()=>validateResult(value,policy));
});
for(const key of ["policy","claim","failure","repairReview"])
 test("revision2 rejects changed predecessor "+key,()=>{
  const p=copy(policy);p.predecessorVerification[key].sha256="0".repeat(64);
  assert.throws(()=>validatePolicy(p));assert.throws(()=>verifyPredecessor(createReader(ROOT),p));
 });
test("revision and predecessor reason cannot turn into a generic retry",()=>{
 for(const change of [p=>p.verificationRevision=1,p=>p.predecessorVerification.reason="retry",
  p=>p.attemptClaimPath=PREDECESSOR.claim.path]){const p=copy(policy);change(p);assert.throws(()=>validatePolicy(p));}
});
test("real immutable predecessor bytes prove fixture-only failure and prior cleanup without changing records",()=>{
 const bindings=Object.values(PREDECESSOR).filter(v=>typeof v==="object");
 const before=bindings.map(b=>fs.readFileSync(path.join(ROOT,b.path)));
 assert.deepEqual(verifyPredecessor(createReader(ROOT),policy),PREDECESSOR);
 bindings.forEach((b,i)=>assert.deepEqual(fs.readFileSync(path.join(ROOT,b.path)),before[i]));
});
test("predecessor forward/gradient counts, primary error and cleanup must match actual closed phase",()=>{
 const old=JSON.parse(fs.readFileSync(path.join(ROOT,PREDECESSOR.policy.path)));
 const claim=JSON.parse(fs.readFileSync(path.join(ROOT,PREDECESSOR.claim.path)));
 const original=JSON.parse(fs.readFileSync(path.join(ROOT,PREDECESSOR.failure.path)));
 for(const mutate of [
  f=>{const w=JSON.parse(f.stdout);w.counts.fullBaselineForwards=1;f.stdout=JSON.stringify(w);},
  f=>{const w=JSON.parse(f.stdout);w.counts.fullGeneratorAutogradCalls=1;f.stdout=JSON.stringify(w);},
  f=>{const w=JSON.parse(f.stdout);w.counts.operatorFixtureAutogradCalls=4;f.stdout=JSON.stringify(w);},
  f=>{const w=JSON.parse(f.stdout);w.error.message="different failure";f.stdout=JSON.stringify(w);},
  f=>f.ownedReceipt.cleanupConfirmed=false,f=>f.ownedReceipt.guardReleaseConfirmed=false,
  f=>f.runId="another-run"]){const f=copy(original);mutate(f);assert.throws(()=>validatePredecessorDocuments(policy,old,claim,f));}
});
test("exclusive attempt-v2 consumption cannot overwrite original records or be consumed twice",()=>{
 // Synthetic temp namespace only, never the registered actual attempt root.
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"finalrgb88-synthetic-v2-claim-"));
 const oldClaim=path.join(temp,"attempt-v1.json"),oldFailure=path.join(temp,"failure.json");
 fs.writeFileSync(oldClaim,"synthetic old claim\n",{flag:"wx"});fs.writeFileSync(oldFailure,"synthetic old failure\n",{flag:"wx"});
 const before=[fs.readFileSync(oldClaim),fs.readFileSync(oldFailure)];
 const claim=consumeRevision2Attempt(temp,"synthetic-test-only");
 assert.equal(path.basename(claim),"attempt-v2.json");
 const value=JSON.parse(fs.readFileSync(claim));assert.equal(value.verificationRevision,2);
 assert.deepEqual(value.policy,POLICY);assert.deepEqual(value.predecessorVerification,PREDECESSOR);
 const saved=fs.readFileSync(claim);assert.throws(()=>consumeRevision2Attempt(temp,"synthetic-repeat"),/EEXIST/);
 assert.deepEqual(fs.readFileSync(claim),saved);assert.deepEqual(fs.readFileSync(oldClaim),before[0]);assert.deepEqual(fs.readFileSync(oldFailure),before[1]);
});
for(const [name,change] of [
 ["GPU",p=>p.qualification.gpuExecutionAllowed=true],["training",p=>p.qualification.trainingAllowed=true],
 ["target",p=>p.target.parameterIndex=60],["seed",p=>p.scope.initializationSeed++],
 ["validation",p=>p.scope.split="validation"],["failed weights",p=>p.scope.failureStateInitializationAllowed=true],
 ["four gradients",p=>p.limits.fullGeneratorAutogradCalls=4],["D gradients",p=>p.limits.discriminatorAutogradCalls=1],
 ["time expansion",p=>p.resources.maxWallSeconds=121],["retry",p=>p.resources.automaticRetries=1],
 ["tolerance",p=>p.comparison.atol=1e-5],["old contract",p=>p.formalSpecification.version="AI-PAINTER-SPEC-1.74"],
 ["historical all-role rehash",p=>p.sourceClosure.unrelatedHistoricalRoleRehashRequired=true],
])test("policy rejects "+name,()=>{const p=copy(policy);change(p);assert.throws(()=>validatePolicy(p));});
function result(){return {schemaVersion:"final-rgb-base-precision-cpu-worker-result-v1",status:"cpu_candidate_verified_inactive",executionState:"completed",
 policy:copy(POLICY),verificationRevision:2,predecessorVerification:copy(PREDECESSOR),candidate:CANDIDATE,counts:copy(LIMITS),cudaInitialized:false,trainingAllowed:false,stage4Qualified:false,checkpointWritten:false,
 failedStateOrCheckpointLoaded:false,pngOrCheckpointWritten:false,nativeFull256ForwardBytesEqual:true,fullOriginalLossGradientGatePassed:true,
 beforeAfterStateBytesEqual:true,capturedFixtureOutsideToleranceElements:0,fullForwardHashes:{baseline:"a".repeat(64),candidate:"a".repeat(64)},
 fixtureGradientHashes:labels.map(label=>({label,sha256:"b".repeat(64)})),fixtureDecodedTensorKeys:["input",...labels.map(l=>"adjoint."+l)],
 gradientFacts:{modelCapabilityVersion:CANDIDATE,actualTotalProvenanceVerified:true,actualTotalIndependentFullModelGradient:true,
  autogradGradCalls:5,independentFullParameterGradientTensorCounts:[108,108,108,108,108],
  originalGateAndProjectionUnchanged:true,carrierAllParameterNamesShapesBytesVerified:true,carrierQualificationInherited:false,
  arithmeticCarrierCapabilityVersion:"stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1",gradientIdentityAtol:1e-6,gradientIdentityRtol:1e-5,
  nonHeadActualTotalIdentityPreserved:true,nonConflictHeadActualTotalBytesPreserved:true,generatorGradientFacts:{tensorCount:108,allFinite:true}}};}
test("complete CPU result is verification only",()=>assert.equal(validateResult(result(),policy),true));
for(const key of ["cudaInitialized","trainingAllowed","stage4Qualified","checkpointWritten","failedStateOrCheckpointLoaded","pngOrCheckpointWritten"])
 test("result rejects "+key,()=>{const r=result();r[key]=true;assert.throws(()=>validateResult(r,policy));});
test("fixture and full model checks cannot substitute for one another",()=>{
 for(const key of ["fullGeneratorAutogradCalls","operatorFixtureAutogradCalls","fullBaselineForwards","fullCandidateForwards"]){const r=result();r.counts[key]--;assert.throws(()=>validateResult(r,policy));}
 for(const key of ["nativeFull256ForwardBytesEqual","fullOriginalLossGradientGatePassed","beforeAfterStateBytesEqual"]){const r=result();r[key]=false;assert.throws(()=>validateResult(r,policy));}
 const r=result();r.capturedFixtureOutsideToleranceElements=1;assert.throws(()=>validateResult(r,policy));
});
test("forward bytes, exact fixture decoder keys and every five-gradient tensor count are required",()=>{
 const r=result();r.fullForwardHashes.candidate="c".repeat(64);assert.throws(()=>validateResult(r,policy));
 const b=result();b.fixtureDecodedTensorKeys.push("gradient.actualTotal");assert.throws(()=>validateResult(b,policy));
 const c=result();c.gradientFacts.independentFullParameterGradientTensorCounts[4]=107;assert.throws(()=>validateResult(c,policy));
});
test("carrier cannot impersonate candidate or inherit qualification",()=>{
 for(const change of [r=>r.gradientFacts.carrierQualificationInherited=true,r=>r.gradientFacts.carrierAllParameterNamesShapesBytesVerified=false,
  r=>r.gradientFacts.arithmeticCarrierCapabilityVersion=CANDIDATE,r=>r.gradientFacts.actualTotalProvenanceVerified=false]){
  const r=result();change(r);assert.throws(()=>validateResult(r,policy));
 }
});
test("primary error survives evidence and finalization failure",()=>{
 const first=new Error("original gate"),second=new Error("evidence quota");
 assert.equal(keepPrimaryError(first,second,"secondaryEvidenceError"),first);assert.equal(first.message,"original gate");
 assert.match(first.secondaryEvidenceError,/evidence quota/);assert.equal(keepPrimaryError(null,second,"secondaryFinalizationError"),second);
});
test("cleanup self-report without current native proof is refused",()=>{
 assert.throws(()=>proofPassed({cleanupConfirmed:true,emptyJob:true,guardReleaseConfirmed:true}));
});
test("no CLI mode or scope override can launch real CPU work",()=>{
 const before=fs.existsSync(path.join(ROOT,policy.attemptClaimPath));
 const r=spawnSync(process.execPath,[path.join(ROOT,policy.entrypointPath),"--run"],{cwd:ROOT,encoding:"utf8",windowsHide:true,timeout:10000});
 assert.notEqual(r.status,0);assert.match(r.stderr,/fixed CPU scope/);
 assert.equal(fs.existsSync(path.join(ROOT,policy.attemptClaimPath)),before);
});
test("actual source closure parses without importing model, original snapshot, or mutable preview files",()=>{
 const reader=createReader(ROOT),rows=collectSourceClosure(ROOT,reader,policy,Date.now()+30000);
 assert(rows.length>20&&rows.length<=256);
 const names=rows.map(r=>r.path);
 const canonical="scripts/lib/real-earth-region-governance.mjs";
 const canonicalSha256=crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,canonical))).digest("hex");
 assert.deepEqual(rows.find(r=>r.path===canonical),{path:canonical,sha256:canonicalSha256});
 assert.equal(rows.filter(r=>r.path===canonical).length,1);
 for(const required of Object.values(policy.candidateImplementation))assert(names.includes(required));
 for(const mutable of ["painter_stage4_object_support_structure_training_profile_v1.py","painter_stage4_object_support_structure_quality_worker_v1.py"])
  assert(!names.some(n=>n.endsWith(mutable)));
 assert(!reader.receipts().some(r=>r.path.endsWith(".pt")));
 for(const r of reader.receipts())assert(r.path.endsWith(".py")||r.path.endsWith(".mjs")||r.path.endsWith(".cs"));
});
