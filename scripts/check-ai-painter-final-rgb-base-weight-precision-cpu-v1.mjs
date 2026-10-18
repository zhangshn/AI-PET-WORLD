// One independent CPU candidate verification; never a training/GPU admission.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createReader} from "./lib/ai-painter-stage4-dataset-audit.mjs";
import {runParameter60OwnedWorker} from "./lib/ai-painter-parameter60-owned-worker-v1.mjs";
import {createOwnedAccounting,proofPassed} from "./diagnose-ai-painter-parameter88-causal-gpu-v1.mjs";
import {readCurrentExecutionRegistry,prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance} from "../src/server/ai-painter-current-execution-registry.mjs";

const SELF=fileURLToPath(import.meta.url),ROOT=path.resolve(path.dirname(SELF),"..");
export const POLICY=Object.freeze({path:"data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-precision-cpu-policy-v2.json",sha256:"71e895f3dc744c76880c0f405cf42d9349a6dfdc4c233ec751ac73809d5ff438"});
export const CANDIDATE="stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1";
export const LIMITS=Object.freeze({fullBaselineForwards:1,fullCandidateForwards:1,fullGeneratorAutogradCalls:5,
 operatorFixtureForwards:1,operatorFixtureAutogradCalls:5,discriminatorAutogradCalls:0,optimizerConstruction:0,optimizerUpdates:0,cudaCalls:0});
export const PREDECESSOR=Object.freeze({
 policy:Object.freeze({path:"data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-precision-cpu-policy-v1.json",sha256:"fc2bd9e7e2e2a2c1698c3d1801accad8906c8bf24bad86eb142bd8f1f9fccd02"}),
 claim:Object.freeze({path:".runtime/ai-painter/final-rgb-base-weight-precision-cpu-checks/attempt-v1.json",sha256:"6f0d6c82e594b3f8c051c0d18f0a834b15bb110e56917ae6e3a934dbc1c523d5"}),
 failure:Object.freeze({path:".runtime/ai-painter/final-rgb-base-weight-precision-cpu-checks/final-rgb-base-cpu-447b84a5-26e4-43f2-8cf2-7b13d04ed7da/failure.json",sha256:"39dbeeb34182395dae690512cb86800ce79ba4910bbbc79037b473c9e1958189"}),
 repairReview:Object.freeze({path:".runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/coordination-20261016/finalrgb88-candidate-and-checker-acceptance-v1.json",sha256:"e9ec3e744a9111ffd88b85a9353712157231ec2a5ddf006600fc75855d68d500"}),
 reason:"checker_source_binding_omission_before_complete_forward"});
const PREVIOUS_COUNTS=Object.freeze({...LIMITS,fullBaselineForwards:0,fullCandidateForwards:0,fullGeneratorAutogradCalls:0});
const digest=b=>crypto.createHash("sha256").update(b).digest("hex");
const OWN=["scripts/check-ai-painter-final-rgb-base-weight-precision-cpu-v1.mjs",
 "scripts/diagnose-ai-painter-parameter88-causal-gpu-v1.mjs","scripts/lib/ai-painter-parameter60-owned-worker-v1.mjs",
 "scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs","scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs",
 "scripts/lib/ai-painter-stage4-dataset-audit.mjs","src/server/ai-painter-current-execution-registry.mjs",
 "ml/ai-painter/scripts/check_final_rgb_base_weight_precision_cpu_v1.py",
 "ml/ai-painter/src/ai_painter/complete_world/final_rgb_base_weight_reduction_precision_v1.py",
 "ml/ai-painter/src/ai_painter/complete_world/object_ecology_final_rgb_base_weight_precision_v1.py",
 "ml/ai-painter/src/ai_painter/complete_world/object_support_final_rgb_weight_priority_update_v1.py",
 "ml/ai-painter/tests/test_final_rgb_base_weight_precision_cpu_v1.py",
 "scripts/tests/ai-painter-final-rgb-base-weight-precision-cpu-v1.test.mjs",
 // bound_regime invokes this exact source via Node; Python AST cannot see
 // that string dispatch. Its only imports are node:crypto/node:fs/node:path.
 "scripts/lib/real-earth-region-governance.mjs"];

export function validatePolicy(p){
 assert.equal(p.schemaVersion,"ai-painter-final-rgb-base-weight-precision-cpu-policy-v1");
 assert.equal(p.status,"registered_cpu_candidate_verification_only");
 assert.deepEqual(p.formalSpecification,{path:"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",version:"AI-PAINTER-SPEC-1.76",sha256:"59b3ba516d3b7749cd602f7937401d124cdc33f63021539ee8d488eb21764880"});
 assert.equal(p.verificationRevision,2);assert.deepEqual(p.predecessorVerification,PREDECESSOR);
 assert.equal(p.attemptClaimPath,".runtime/ai-painter/final-rgb-base-weight-precision-cpu-checks/attempt-v2.json");
 assert.equal(p.candidate,CANDIDATE);
 assert.deepEqual(p.target,{parameterIndex:88,parameterName:"core.core.final_rgb_decoder.base.layers.2.weight",weightShape:[48,48,3,3]});
 assert.deepEqual(p.scope,{resolution:[256,192],sampleId:"ai-cold-start-v7-v7-capacity-slot-169-forested-low-mountain-v2",split:"train",sampleCount:1,
  originalDataSplits:"48/8/4/4 unchanged",initializationSeed:20260929,parameterCount:108,parameterElements:2242687,failureStateInitializationAllowed:false});
 assert.deepEqual(p.resources,{maxWallSeconds:120,threads:2,maxOutputBytes:8388608,maxStreamBytes:8388608,failureReserveBytes:65536,cleanupReserveMs:1000,finalizationReserveMs:8000,attempts:1,automaticRetries:0});
 assert.deepEqual(p.limits,LIMITS);
 assert.deepEqual(p.comparison,{atol:1e-6,rtol:1e-5,originalGateKept:true,nativeForwardBytesIdentical:true,onlyTargetWeightGradientChanged:true});
 assert.deepEqual(p.qualification,{gpuExecutionAllowed:false,trainingAllowed:false,checkpointWritten:false,stage4Qualified:false,capabilityReleased:false,runtimeFrameAllowed:false});
 assert.deepEqual(p.sourceClosure,{maxFiles:256,maxFileBytes:1048576,maxTotalBytes:16777216,
  scope:"Actual loaded candidate and validation source closure only; include immutable parent dependencies and own code/tests. Historical source receipts are provenance, not current execution permission.",loadedModulesMustBeVerified:true,unrelatedHistoricalRoleRehashRequired:false});
 assert.equal(p.entrypointPath,OWN[0]);assert.equal(p.workerPath,OWN[7]);assert.equal(p.testPath,OWN[11]);
 assert.equal(p.outputRoot,".runtime/ai-painter/final-rgb-base-weight-precision-cpu-checks");
 assert.deepEqual(p.candidateImplementation,{operator:OWN[8],model:OWN[9],bridge:OWN[10]});
 assert.deepEqual(p.sourceAlgorithmBindings.map(v=>v.role),["parentRenderer","nativeWeightReduction","supportGradientGate","supportLoss"]);
 return true;
}

export function validateResult(v,p){
 assert.equal(v.schemaVersion,"final-rgb-base-precision-cpu-worker-result-v1");
 assert.equal(v.status,"cpu_candidate_verified_inactive");assert.equal(v.executionState,"completed");
 assert.deepEqual(v.policy,POLICY);assert.equal(v.candidate,p.candidate);assert.deepEqual(v.counts,LIMITS);
 assert.equal(v.verificationRevision,2);assert.deepEqual(v.predecessorVerification,PREDECESSOR);
 for(const key of ["cudaInitialized","trainingAllowed","stage4Qualified","checkpointWritten","failedStateOrCheckpointLoaded","pngOrCheckpointWritten"])assert.equal(v[key],false);
 for(const key of ["nativeFull256ForwardBytesEqual","fullOriginalLossGradientGatePassed","beforeAfterStateBytesEqual"])assert.equal(v[key],true);
 assert.equal(v.capturedFixtureOutsideToleranceElements,0);
 assert.equal(v.fullForwardHashes.baseline,v.fullForwardHashes.candidate);assert(/^[a-f0-9]{64}$/.test(v.fullForwardHashes.baseline));
 const labels=["actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb","objectSupportStructure"];
 assert.deepEqual(v.fixtureGradientHashes.map(r=>r.label),labels);
 for(const row of v.fixtureGradientHashes)assert(/^[a-f0-9]{64}$/.test(row.sha256));
 assert.deepEqual(v.fixtureDecodedTensorKeys,["input",...labels.map(l=>"adjoint."+l)]);
 const f=v.gradientFacts;
 assert.equal(f.modelCapabilityVersion,CANDIDATE);assert.equal(f.actualTotalProvenanceVerified,true);
 assert.equal(f.actualTotalIndependentFullModelGradient,true);
 assert.equal(f.autogradGradCalls,5);assert.deepEqual(f.independentFullParameterGradientTensorCounts,[108,108,108,108,108]);
 assert.equal(f.originalGateAndProjectionUnchanged,true);assert.equal(f.carrierAllParameterNamesShapesBytesVerified,true);
 assert.equal(f.carrierQualificationInherited,false);
 assert.equal(f.arithmeticCarrierCapabilityVersion,"stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1");
 assert.equal(f.gradientIdentityAtol,1e-6);assert.equal(f.gradientIdentityRtol,1e-5);
 assert.equal(f.nonHeadActualTotalIdentityPreserved,true);
 assert.equal(f.nonConflictHeadActualTotalBytesPreserved,true);
 assert.equal(f.generatorGradientFacts.tensorCount,108);assert.equal(f.generatorGradientFacts.allFinite,true);
 return true;
}

export function keepPrimaryError(first,secondary,field){
 if(first){first[field]=String(secondary.stack??secondary);return first;}
 return secondary;
}

export function validatePredecessorDocuments(p,oldPolicy,claim,failure){
 assert.equal(oldPolicy.schemaVersion,"ai-painter-final-rgb-base-weight-precision-cpu-policy-v1");
 for(const key of ["candidate","target","scope","resources","limits","comparison","qualification"])
  assert.deepEqual(oldPolicy[key],p[key],"predecessor scope/budget differs: "+key);
 assert.deepEqual(claim.policy,PREDECESSOR.policy);assert.equal(claim.automaticRetries,0);
 assert.equal(failure.schemaVersion,"final-rgb-base-precision-cpu-terminal-v1");
 assert.equal(failure.status,"cpu_candidate_failed_closed");assert.equal(failure.executionState,"failed_closed");
 assert.equal(failure.runId,claim.runId);
 const worker=JSON.parse(failure.stdout);
 assert.equal(worker.runId,claim.runId);assert.deepEqual(worker.policy,PREDECESSOR.policy);
 assert.equal(worker.status,"cpu_candidate_failed_closed");assert.equal(worker.executionState,"failed_closed");
 assert.deepEqual(worker.counts,PREVIOUS_COUNTS);
 assert.deepEqual(worker.error,{type:"ValueError",message:"undeclared source snapshot"});
 assert.equal(worker.trainingAllowed,false);assert.equal(worker.stage4Qualified,false);
 assert.equal(failure.ownedReceipt.cleanupConfirmed,true);assert.equal(failure.ownedReceipt.guardReleaseConfirmed,true);
 assert.equal(failure.ownedReceipt.emptyJob,true);assert.equal(failure.ownedReceipt.liveOwnerCleanupConfirmed,true);
 assert.equal(failure.ownedReceipt.ownerExitCode,0);
 return true;
}

export function verifyPredecessor(reader,p){
 assert.deepEqual(p.predecessorVerification,PREDECESSOR);
 const oldPolicy=reader.bound(PREDECESSOR.policy),claim=reader.bound(PREDECESSOR.claim),failure=reader.bound(PREDECESSOR.failure);
 reader.bound(PREDECESSOR.repairReview);
 validatePredecessorDocuments(p,oldPolicy,claim,failure);
 return PREDECESSOR;
}

export function consumeRevision2Attempt(outputRoot,runId){
 const claim=path.join(outputRoot,"attempt-v2.json");
 fs.writeFileSync(claim,JSON.stringify({runId,policy:POLICY,verificationRevision:2,predecessorVerification:PREDECESSOR,
  recordedAtUtc:new Date().toISOString(),automaticRetries:0})+"\n",{flag:"wx"});
 return claim;
}

export function collectSourceClosure(root,reader,p,deadline){
 const python=path.join(root,"ml/ai-painter/.venv/Scripts/python.exe");
 // Parse actual static imports without importing any model or mutable support
 // profile. One bounded parser process covers the current dependency closure.
 const script=`import ast,hashlib,json,pathlib,sys
r=json.load(sys.stdin); root=pathlib.Path(r['root']); pending=list(r['roots']); seen={}; total=0
def resolve(importer,spec):
 dots=len(spec)-len(spec.lstrip('.')); parts=spec.lstrip('.').split('.')
 if dots:
  base=pathlib.PurePosixPath(importer).parent
  for _ in range(1,dots): base=base.parent
  bases=[str(base.joinpath(*parts))]
 else: bases=['ml/ai-painter/scripts/'+'/'.join(parts),'ml/ai-painter/src/'+'/'.join(parts)]
 for base in bases:
  for name in (base+'.py',base+'/__init__.py'):
   if (root/name).is_file(): return name
while pending:
 name=pending.pop(0)
 if name in seen: continue
 assert name.startswith(('ml/ai-painter/src/','ml/ai-painter/scripts/','ml/ai-painter/tests/')) and '..' not in name.split('/')
 file=root/name; assert file.resolve().is_relative_to(root.resolve()); raw=file.read_bytes(); total+=len(raw)
 assert len(raw)<=1048576 and total<=16777216 and len(seen)<256
 seen[name]={'path':name,'sha256':hashlib.sha256(raw).hexdigest()}; tree=ast.parse(raw,filename=name)
 specs=[]
 for n in ast.walk(tree):
  if isinstance(n,ast.Import): specs.extend(a.name for a in n.names)
  elif isinstance(n,ast.ImportFrom):
   base='.'*n.level+(n.module or '')
   if n.module: specs.append(base)
   specs.extend(base+('.' if n.module else '')+a.name for a in n.names if a.name!='*')
 for spec in specs:
  target=resolve(name,spec)
  if not target: continue
  pending.append(target); folder=pathlib.PurePosixPath(target).parent
  while str(folder).startswith('ml/ai-painter/src/'):
   init=str(folder/'__init__.py')
   if (root/init).is_file(): pending.append(init)
   folder=folder.parent
json.dump(list(seen.values()),sys.stdout)`;
 const values=JSON.parse(execFileSync(python,["-B","-c",script],{input:JSON.stringify({root,roots:[p.workerPath,p.testPath]}),encoding:"utf8",windowsHide:true,
  timeout:Math.max(1,Math.min(15000,deadline-Date.now())),maxBuffer:1048576,
  env:{...process.env,PYTHONDONTWRITEBYTECODE:"1",PYTHONNOUSERSITE:"1",PYTHONUTF8:"1",OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2"}}));
 assert(Array.isArray(values)&&values.length>0&&values.length<=256);
 const lineage=new Map();let total=0;
 for(const b of values){const bytes=reader.bytes(b.path,b.sha256);assert(bytes.length<=1048576);total+=bytes.length;assert(total<=16777216);lineage.set(b.path,b);}
 for(const logical of OWN){const bytes=reader.bytes(logical);assert(bytes.length<=1048576);lineage.set(logical,{path:logical,sha256:digest(bytes)});}
 assert(lineage.size<=256);assert([...lineage.keys()].every(name=>!name.endsWith("painter_stage4_object_support_structure_training_profile_v1.py")&&!name.endsWith("painter_stage4_object_support_structure_quality_worker_v1.py")),"mutable preview profile/worker dependency refused");
 assert([...lineage.values()].reduce((n,b)=>n+reader.bytes(b.path,b.sha256).length,0)<=16777216);
 assert(Date.now()<deadline);return [...lineage.values()];
}

export async function runCpu(root=ROOT){
 const began=Date.now(),deadline=began+120000,reader=createReader(root);
 const p=reader.bound(POLICY);validatePolicy(p);reader.bytes(p.formalSpecification.path,p.formalSpecification.sha256);
 const registry=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(registry.ok&&registry.registry.activeExecution===null);
 assert(!fs.existsSync(path.join(root,".runtime/ai-painter/owned-worker-guards/active.json")),"existing guard refused");
 const outputRoot=path.join(root,p.outputRoot);fs.mkdirSync(outputRoot,{recursive:true});
 const claim=path.join(root,p.attemptClaimPath);assert(!fs.existsSync(claim),"CPU revision2 attempt consumed; zero automatic retries");
 verifyPredecessor(reader,p);
 const runId="final-rgb-base-cpu-v2-"+crypto.randomUUID(),logical=p.outputRoot+"/"+runId,absolute=path.join(root,logical);
 fs.mkdirSync(absolute);assert.equal(fs.realpathSync(absolute),path.join(fs.realpathSync(path.join(root,".runtime")),"ai-painter","final-rgb-base-weight-precision-cpu-checks",runId));
 const accounting=createOwnedAccounting(root,absolute,p);
 const put=(name,value,failure=false)=>{
  const bytes=Buffer.from(JSON.stringify(value,null,2)+"\n"),current=accounting.measure().totalBytes;
  assert(current+bytes.length<=p.resources.maxOutputBytes-(failure?0:65536),"output ceiling");
  fs.writeFileSync(path.join(absolute,name),bytes,{flag:"wx"});return {path:logical+"/"+name,sha256:digest(bytes),bytes:bytes.length};
 };
 assert.equal(consumeRevision2Attempt(outputRoot,runId),claim);
 let request=null,result,terminal,error=null;
 try{
  const programBindings=collectSourceClosure(root,reader,p,deadline-8000);
  for(const item of p.sourceAlgorithmBindings)reader.bytes(item.binding.path,item.binding.sha256);
  reader.bound(p.dataLocator);
  for(const b of Object.values(p.operatorFixture))assert.equal(reader.bytes(b.path,b.sha256).length,b.bytes);
  for(const b of Object.values(p.independentDiagnostic))reader.bytes(b.path,b.sha256);
  const python=path.join(root,"ml/ai-painter/.venv/Scripts/python.exe"),interpreter={path:python,sha256:digest(fs.readFileSync(python))};
  request=put("request.json",{schemaVersion:"final-rgb-base-precision-cpu-request-v1",runId,policy:POLICY,verificationRevision:2,
   predecessorVerification:PREDECESSOR,interpreter,programBindings,deadlineUnixMs:deadline-8000});
  result=await runParameter60OwnedWorker(python,["-B",path.join(root,p.workerPath),"--request",request.path,"--request-sha256",request.sha256],{
   cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:"",PYTHONDONTWRITEBYTECODE:"1",PYTHONNOUSERSITE:"1",PYTHONUTF8:"1",
    PYTHONPATH:[path.join(root,"ml/ai-painter/src"),path.join(root,"ml/ai-painter/scripts")].join(path.delimiter),OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2",OPENBLAS_NUM_THREADS:"2"},
   timeout:Math.max(1,deadline-Date.now()-8000),maxBuffer:p.resources.maxStreamBytes,onSpawn:accounting.observe,
   abortReason:()=>{accounting.requireBudget();return Date.now()>=deadline-8000?"CPU deadline":null;}});
  const value=JSON.parse(result.stdout);assert.equal(value.runId,runId);validateResult(value,p);proofPassed(result.ownedReceipt);reader.verifyStable();
  const current=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(current.ok&&current.registrySha256===registry.registrySha256);
  terminal=put("terminal.json",{schemaVersion:"final-rgb-base-precision-cpu-terminal-v1",runId,executionState:"completed",status:value.status,
   request,verificationRevision:2,predecessorVerification:PREDECESSOR,worker:value,ownedReceipt:result.ownedReceipt,recordedAtUtc:new Date().toISOString(),elapsedMs:Date.now()-began,
   outputAccounting:accounting.requireBudget(),qualification:p.qualification,registryBeforeSha256:registry.registrySha256});
 }catch(first){
  error=first;accounting.beginFailureClosure();
  try{terminal=put("failure.json",{schemaVersion:"final-rgb-base-precision-cpu-terminal-v1",runId,executionState:"failed_closed",status:"cpu_candidate_failed_closed",
   request,verificationRevision:2,predecessorVerification:PREDECESSOR,error:String(first.stack??first),stdout:String(first.stdout??result?.stdout??"").slice(0,16384),stderr:String(first.stderr??result?.stderr??"").slice(0,16384),
   ownedReceipt:first.ownedReceipt??result?.ownedReceipt??null,qualification:p.qualification},true);}
  catch(secondary){error=keepPrimaryError(error,secondary,"secondaryEvidenceError");}
  error.evidence=terminal??null;
 }
 try{
  assert(terminal,"CPU terminal missing");
  const current=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(current.ok&&current.registrySha256===registry.registrySha256);
  const capsule=put("task-capsule.json",{schemaVersion:"ai-painter-local-task-capsule-v1",taskId:runId,runId,integrity:{status:"verified"},evidence:[{...terminal,sha256Verified:true}]},error!==null);
  const options={projectRoot:root,capabilityVersion:p.candidate,packageId:runId+"-package",taskId:runId,taskKind:"candidate_cpu_verification",
   taskGoal:"Verify target88 precision candidate on fresh weights with original five-gradient gate; zero updates.",runId,lifecycleStage:"candidate_cpu_support",priority:1,
   executionState:error?"failed_closed":"completed",queueStatus:error?"failed_closed":"completed",activity:"candidate_cpu_terminal_not_training",activeExecution:null,
   taskCapsulePath:capsule.path,terminalEvidencePath:terminal.path,expectedPreviousRegistrySha256:registry.registrySha256,nextMachineAction:null,deadlineUnixMs:deadline};
  const prepared=await prepareCurrentExecutionRegistryAdvance(options);accounting.observeRegistryTransaction(prepared.transactionRoot);
  await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:root,transactionId:prepared.transactionId,deadlineUnixMs:deadline,beforeAtomicWrite:accounting.beforeAtomicWrite});
  accounting.requireBudget();assert(Date.now()<deadline);
  const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(after.ok&&after.registry.activeExecution===null);
  assert.deepEqual(after.registry.latestTrainingTerminal,registry.registry.latestTrainingTerminal);
 }catch(secondary){error=keepPrimaryError(error,secondary,"secondaryFinalizationError");error.evidence??=terminal??null;}
 if(error)throw error;return terminal;
}

if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
 assert.equal(process.argv.length,2,"fixed CPU scope; no overrides");
 runCpu().then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(JSON.stringify({status:"failed_closed",error:e.message,evidence:e.evidence??null}));process.exitCode=1;});
}
