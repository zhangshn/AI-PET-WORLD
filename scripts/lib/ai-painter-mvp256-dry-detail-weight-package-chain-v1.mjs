// Internal immutable plan/package checks. No qualification by caller flags.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
export const CAPABILITY = "stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1"
export const PLAN_SCHEMA = "detail-weight-managed-plan-v1"
export const PHASE_EXPORTS = { preflight: "preflight", execute: "execute", validate: "validate", review: "review", adjudicate: "adjudicate", finalize: "finalize" }
export const ADAPTER = "scripts/run-ai-painter-mvp256-dry-detail-weight-training.mjs"
export const sha = value => crypto.createHash("sha256").update(value).digest("hex")
export function inside(root, logical) {
  assert.equal(typeof logical,"string")
  assert.ok(logical && !path.isAbsolute(logical) && !/[\\:]/u.test(logical) && logical.split("/").every(v=>v && v!=="." && v!==".."))
  const target=path.resolve(root,logical), realRoot=fs.realpathSync(root)
  assert.ok(target.startsWith(path.resolve(root)+path.sep))
  // Validate the closest existing ancestor before mkdir can follow a junction.
  let ancestor=target
  while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);assert.notEqual(parent,ancestor);ancestor=parent}
  const physical=fs.realpathSync(ancestor), runtime=path.join(root,".runtime")
  const beneath=(value,base)=>value===base || value.startsWith(base+path.sep)
  assert.ok(beneath(physical,realRoot) || (logical.startsWith(".runtime/") && fs.existsSync(runtime) && beneath(physical,fs.realpathSync(runtime))),"source escaped registered roots")
  return target
}
export function exactBinding(value) { assert.deepEqual(Object.keys(value??{}).sort(),["path","sha256"]);assert.match(value.sha256,/^[a-f0-9]{64}$/u);return value }
export function read(root,binding) { exactBinding(binding);const data=fs.readFileSync(inside(root,binding.path));assert.equal(sha(data),binding.sha256,"immutable source changed: "+binding.path);return data }
export const json=(root,binding)=>JSON.parse(read(root,binding))
export const bind=(root,logical)=>({path:logical,sha256:sha(fs.readFileSync(inside(root,logical)))})
export function write(root,logical,value) { const file=inside(root,logical),data=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+"\n");
  if(!Buffer.isBuffer(value))assert.ok(data.length<=2097152,"single JSON budget")
  if(process.env.DETAIL_WEIGHT_OUTPUT_ROOTS){const roots=JSON.parse(process.env.DETAIL_WEIGHT_OUTPUT_ROOTS),maximum=Number(process.env.DETAIL_WEIGHT_OUTPUT_MAX),bytes=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,e)=>{const item=path.join(dir,e.name);assert.equal(fs.lstatSync(item).isSymbolicLink(),false,"output junction prohibited");return sum+(e.isDirectory()?bytes(item):e.isFile()?fs.statSync(item).size:0)},0):0;assert.ok(roots.reduce((n,r)=>n+bytes(inside(process.env.DETAIL_WEIGHT_BUDGET_PROJECT_ROOT??root,r)),0)+data.length<=maximum-65536,"total output reserve")}
  fs.mkdirSync(path.dirname(file),{recursive:true});const fd=fs.openSync(file,"wx");try{fs.writeFileSync(fd,data);fs.fsyncSync(fd)}finally{fs.closeSync(fd)};return {path:logical,sha256:sha(data)} }
export function validatePlan(root,plan) {
  assert.equal(plan.schema,PLAN_SCHEMA);assert.equal(plan.capabilityVersion,CAPABILITY)
  for(const name of ["runId","packageId"])assert.match(plan[name],/^[a-z0-9][a-z0-9-]{7,127}$/u)
  assert.notEqual(plan.runId,plan.packageId);assert.equal(plan.historicalCheckpointMayInitialize,false);assert.equal(plan.trainingRestartAllowed,false)
  assert.ok(plan.outputRoot.startsWith(".runtime/ai-painter/detail-weight-managed-executions/"));inside(root,plan.outputRoot)
  const candidate=json(root,plan.sourceCandidate),configuration=plan.configuration
  assert.equal(plan.sourceCandidate.path,"data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")
  assert.deepEqual(plan.formalSpecification,{path:"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",sha256:"b7a15e6bab4733fc7b9311d3625d047c5a222ae69e3c2024745ef23b41367600"})
  assert.ok(read(root,plan.formalSpecification).includes(Buffer.from("9.6.35")))
  assert.equal(configuration.capabilityVersion,CAPABILITY);assert.deepEqual(configuration.sourceCandidate,plan.sourceCandidate);assert.deepEqual(configuration.formalSpecification,plan.formalSpecification)
  assert.deepEqual(configuration.executionCeiling,candidate.executionCeiling);assert.deepEqual(configuration.checkpointSelection,candidate.checkpointSelection)
  assert.deepEqual(configuration.dataUse,candidate.dataUse);assert.deepEqual(configuration.scope,candidate.scope)
  assert.equal(configuration.seed,20260929);assert.equal(configuration.gpuAdmissionSeconds,600)
  assert.deepEqual(configuration.checkpointSelection.eligibleEpochs,[24,36,48]);assert.equal(configuration.executionCeiling.maxWallSeconds,2700)
  for(const split of ["datasetManifest","trainSplit","validationSplit"])assert.deepEqual(plan[split],candidate.frozenBindings[split])
  assert.equal(plan.programBindings.worker.path,"ml/ai-painter/scripts/painter_stage4_detail_weight_managed_worker.py")
  assert.equal(plan.programBindings.adapter.path,ADAPTER)
  for(const b of Object.values(plan.programBindings))read(root,b)
  return plan
}
export function makeInternalCandidate(root,planBinding) {
  const plan=validatePlan(root,json(root,planBinding))
  return {schemaVersion:"ai-painter-autonomous-closed-loop-candidate-v1",packageIdentity:plan.packageId,capabilityVersion:CAPABILITY,
    ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:plan.outputRoot,
    programFiles:Object.fromEntries(Object.entries(plan.programBindings).map(([role,b])=>[role,b.path])),
    inputEvidencePaths:[planBinding.path,...[plan.sourceCandidate,plan.formalSpecification,plan.modelCpuReport,plan.modelCpuReceipt,plan.lifecycleCpuAcceptance].map(b=>b.path)],
    phaseAdapters:Object.fromEntries(Object.entries(PHASE_EXPORTS).map(([phase,exportName])=>[phase,{path:ADAPTER,exportName}]))}
}
export function loadContext(context) {
  const root=context.projectRoot,plans=context.inputEvidence.filter(b=>b.path.endsWith("/detail-weight-plan.json"));assert.equal(plans.length,1)
  const plan=validatePlan(root,json(root,plans[0]));assert.equal(context.capabilityVersion,CAPABILITY);assert.equal(context.packageIdentity,plan.packageId);assert.equal(context.outputRoot,plan.outputRoot)
  const packageBinding=bind(root,`.runtime/ai-painter/autonomous-closed-loop-packages/${context.packageIdentity}/package.json`)
  const spec=json(root,packageBinding);assert.deepEqual(spec.inputEvidence,context.inputEvidence)
  for(const [role,b] of Object.entries(plan.programBindings))assert.equal(spec.programLineage[role],b.sha256)
  return {root,plan,packageBinding,spec}
}
export function validateCompleted(value,packageBinding,plan) {
  assert.equal(value.schema,"detail-weight-managed-worker-terminal-v1");assert.equal(value.status,"training_completed_review_pending")
  assert.equal(value.capabilityVersion,CAPABILITY);assert.equal(value.runId,plan.runId);assert.equal(value.packageId,plan.packageId)
  assert.deepEqual(value.executionPackage,packageBinding);assert.equal(value.completedEpochs,48);assert.deepEqual(value.optimizerSteps,{generator:2304,discriminator:2304})
  assert.deepEqual(value.checkpoints.map(r=>r.epoch),[24,36,48]);assert.equal(value.checkpointReloadVerified,true)
  for(const key of ["challengeContentRead","regressionContentRead","checkpointPromotable","formalStage4QualificationAllowed","runtimePublicationAllowed"])assert.equal(value[key],false)
  for(const r of value.checkpoints){assert.deepEqual(r.counts,{generator:r.epoch*48,discriminator:r.epoch*48});assert.deepEqual(r.selection.rank,[r.selection.worstApplicableObjectCorrelation,-r.selection.meanValidationRgbMae,-r.epoch])}
  const winner=[...value.checkpoints].sort((a,b)=>{for(let i=0;i<3;i++){const d=b.selection.rank[i]-a.selection.rank[i];if(d)return d}return 0})[0]
  assert.deepEqual(winner,value.selectedCheckpointRecord);return winner
}

// Controller supplies frozen source identities, never qualification booleans.
export function finalProgramBindings(root,frozen){
  const result=Object.fromEntries(frozen.map((b,i)=>{read(root,b);return ["frozen-"+String(i).padStart(4,"0"),b]}))
  const roles={adapter:ADAPTER,worker:"ml/ai-painter/scripts/painter_stage4_detail_weight_managed_worker.py",gpuQualifier:"ml/ai-painter/scripts/qualify_stage4_detail_weight_gpu.py",cpuReview:"ml/ai-painter/scripts/review_stage4_detail_weight_cpu.py",managedCheckpoint:"ml/ai-painter/src/ai_painter/complete_world/detail_weight_managed_checkpoint.py",checkpointTests:"ml/ai-painter/tests/test_detail_weight_managed_checkpoint.py",workerTests:"ml/ai-painter/tests/test_painter_stage4_detail_weight_managed_worker.py",gpuTests:"ml/ai-painter/tests/test_qualify_stage4_detail_weight_gpu.py",reviewTests:"ml/ai-painter/tests/test_review_stage4_detail_weight_cpu.py",packageChain:"scripts/lib/ai-painter-mvp256-dry-detail-weight-package-chain-v1.mjs",cpuAcceptance:"scripts/run-ai-painter-mvp256-dry-detail-weight-cpu-acceptance.mjs",integrationTests:"scripts/tests/ai-painter-mvp256-dry-detail-weight-integration.test.mjs"}
  for(const [role,file]of Object.entries(roles))result[role]=bind(root,file)
  return result
}
export function prepareManagedPlan({root,runId,packageId,outputRoot,lifecycleCpuAcceptance,modelCpuReport,modelCpuReceipt}){
  const acceptance=json(root,lifecycleCpuAcceptance);assert.equal(acceptance.schema,"detail-weight-lifecycle-cpu-acceptance-v1");assert.equal(acceptance.status,"passed")
  const raw=json(root,acceptance.testResult),owned=json(root,acceptance.ownedReceipt),registry=json(root,acceptance.isolatedRegistryProof)
  assert.ok(raw.passed>0&&raw.failed===0&&raw.errors===0&&raw.skipped===0&&raw.items.length===raw.passed&&raw.items.every(x=>x.status==="passed"));assert.equal(owned.cleanupConfirmed,true);assert.equal(owned.proof.assignedBeforeResume,true);assert.equal(owned.proof.activeProcessesAfterCleanup,0)
  assert.equal(registry.status,"isolated_registry_roundtrip_verified");assert.equal(registry.productionRegistryChanged,false);assert.deepEqual(registry.programBindings,acceptance.programBindings)
  const configuration=raw.configuration,sourceCandidate=configuration.sourceCandidate,formalSpecification=configuration.formalSpecification,candidate=json(root,sourceCandidate)
  const plan={schema:PLAN_SCHEMA,capabilityVersion:CAPABILITY,runId,packageId,outputRoot,configuration,sourceCandidate,formalSpecification,programBindings:acceptance.programBindings,lifecycleCpuAcceptance,modelCpuReport,modelCpuReceipt,historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,...Object.fromEntries(["datasetManifest","trainSplit","validationSplit"].map(k=>[k,candidate.frozenBindings[k]]))}
  validatePlan(root,plan);read(root,modelCpuReport);read(root,modelCpuReceipt)
  return write(root,outputRoot+"/detail-weight-plan.json",plan)
}
