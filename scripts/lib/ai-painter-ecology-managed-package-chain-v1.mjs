// Versioned model adapter for the existing package materializer and phase engine.
// Immutable configuration references are not admission or publication evidence.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,COMPONENT_CPU_ACCEPTANCE,
 validate,verifyBindings} from './ai-painter-ecology-execution-registration-v1.mjs'
import {inside,read,json,bind,write,sha,directoryBytes,withOutputBudget}
 from './ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs'
export {CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,inside,read,json,bind,write,sha,directoryBytes,withOutputBudget}
export const ADAPTER='scripts/run-ai-painter-ecology-regime-managed-training.mjs'
export const ROLES={adapter:ADAPTER,packageChain:'scripts/lib/ai-painter-ecology-managed-package-chain-v1.mjs',
 worker:'ml/ai-painter/scripts/painter_stage4_ecology_regime_execution_worker.py',
 gpuQualifier:'ml/ai-painter/scripts/qualify_stage4_ecology_regime_execution_gpu.py',
 reviewWorker:'ml/ai-painter/scripts/review_stage4_ecology_regime_execution_cpu.py',
 reviewDriver:'scripts/run-ai-painter-ecology-regime-cpu-review.mjs',
 nativeRunner:'scripts/lib/ai-painter-ecology-owned-native-v1.mjs',
 executionAuth:'ml/ai-painter/scripts/ecology_regime_execution_auth.py',
 managedCheckpoint:'ml/ai-painter/src/ai_painter/complete_world/ecology_regime_managed_checkpoint.py',
 trainingLifecycle:'ml/ai-painter/scripts/painter_stage4_ecology_regime_lifecycle.py',
 trainingProfile:'ml/ai-painter/scripts/painter_stage4_ecology_regime_training_profile.py',
 registration:'scripts/lib/ai-painter-ecology-execution-registration-v1.mjs'}
export const SPECIFICATION={path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',
 sha256:'ba943699ca0eee8ad449e3ae1ffa3a0aad171cbe2d032517945227da0d4d5735'}
export const SOURCE_CANDIDATE={path:'data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json',
 sha256:'ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566'}
export const CONFIGURATION_REPORT={path:'.runtime/ai-painter/ecology-entry-adapters-t-q4-72/cpu/report.json',
 sha256:'18eab0d76858ba32b1d12cbcb8f02419f1e4963b08bf5a43f6430f683b9b0472'}
const phases=['preflight','execute','validate','review','adjudicate','finalize']

export function validatePlan(root,plan){
 assert.equal(plan.schema,PLAN_SCHEMA);assert.equal(plan.capabilityVersion,CAPABILITY)
 assert.equal(plan.executionProfile,EXECUTION_PROFILE);assert.equal(plan.executionMode,'managed-training')
 assert.deepEqual(plan.sourceCandidate,SOURCE_CANDIDATE);assert.deepEqual(plan.formalSpecification,SPECIFICATION)
 assert.deepEqual(plan.componentCpuAcceptance,COMPONENT_CPU_ACCEPTANCE)
 const original=json(root,SOURCE_CANDIDATE),reference=json(root,CONFIGURATION_REPORT)
 assert.deepEqual(plan.configuration,reference.configuration,'frozen own numerical configuration differs')
 for(const key of ['datasetManifest','trainSplit','validationSplit'])assert.deepEqual(plan[key],original.frozenBindings[key])
 const modelIdentity=json(root,plan.modelBinding)
 const input={plan,planBinding:{path:plan.outputRoot+'/ecology-plan.json',sha256:sha(JSON.stringify(plan))},
  packageBinding:{path:'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json',sha256:sha('shape-only-not-a-package')},
  modelBinding:plan.modelBinding,modelIdentity}
 validate(input) // Shape only; not a fabricated package or execution permission.
 for(const [role,logical] of Object.entries(ROLES))assert.equal(plan.programBindings[role]?.path,logical,'own adapter role '+role)
 for(const b of Object.values(plan.programBindings))read(root,b)
 read(root,SPECIFICATION);read(root,COMPONENT_CPU_ACCEPTANCE)
 return plan
}

export function verifyFinalAcceptance(root,plan){
 const acceptance=json(root,plan.lifecycleCpuAcceptance)
 assert.equal(acceptance.schema,'ecology-regime-final-entry-cpu-acceptance-v1');assert.equal(acceptance.status,'passed')
 assert.deepEqual(acceptance.programBindings,plan.programBindings)
 const raw=json(root,acceptance.testResult),request=json(root,raw.request),receipt=json(root,acceptance.ownedReceipt)
 assert.equal(raw.schema,'ecology-regime-final-entry-cpu-report-v1')
 assert.ok(Number.isSafeInteger(raw.passed)&&raw.passed>0);assert.equal(raw.failed,0);assert.equal(raw.errors,0);assert.equal(raw.skipped,0)
 assert.equal(raw.items.length,raw.passed);assert.ok(raw.items.every(item=>item.status==='passed'))
 assert.equal(raw.synthetic,true);assert.equal(raw.gpuInitialized,false)
 assert.deepEqual(raw.actualCalls,Object.fromEntries(['cudaInitializationAttempts','moduleForwardCalls','autogradCalls','optimizerConstructionAttempts','optimizerUpdates'].map(k=>[k,0])))
 assert.deepEqual(raw.configuration,plan.configuration);assert.deepEqual(raw.programBindings,plan.programBindings)
 assert.deepEqual(request.programBindings,plan.programBindings)
 assert.equal(receipt.phase,'cpu');assert.equal(receipt.ownerClosed,true);assert.equal(receipt.cleanupConfirmed,true)
 assert.equal(receipt.proof.assignedBeforeResume,true);assert.equal(receipt.proof.exitCode,0);assert.equal(receipt.proof.activeProcessesAfterCleanup,0)
 const registry=json(root,acceptance.isolatedRegistryProof)
 assert.equal(registry.status,'isolated_registry_roundtrip_verified');assert.equal(registry.productionRegistryChanged,false)
 assert.ok(Number.isSafeInteger(registry.registryRevisionBefore));assert.equal(registry.registryRevisionAfter,registry.registryRevisionBefore+1)
 assert.deepEqual(registry.programBindings,plan.programBindings)
 return acceptance // Worker independently verifies the actual native command too.
}

export function makeInternalCandidate(root,planBinding){
 const plan=validatePlan(root,json(root,planBinding));verifyFinalAcceptance(root,plan)
 return {schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',packageIdentity:plan.packageId,capabilityVersion:CAPABILITY,
  ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:plan.outputRoot,
  programFiles:Object.fromEntries(Object.entries(plan.programBindings).map(([role,b])=>[role,b.path])),
  inputEvidencePaths:[planBinding.path,...[plan.sourceCandidate,plan.formalSpecification,plan.componentCpuAcceptance,
   plan.datasetManifest,plan.trainSplit,plan.validationSplit,plan.modelBinding,plan.lifecycleCpuAcceptance,CONFIGURATION_REPORT].map(b=>b.path)],
  phaseAdapters:Object.fromEntries(phases.map(exportName=>[exportName,{path:ADAPTER,exportName}]))}
}

export function loadContext(context){
 const root=context.projectRoot,plans=context.inputEvidence.filter(b=>b.path.endsWith('/ecology-plan.json'))
 assert.equal(plans.length,1)
 const plan=validatePlan(root,json(root,plans[0]));verifyFinalAcceptance(root,plan)
 assert.equal(context.capabilityVersion,CAPABILITY);assert.equal(context.packageIdentity,plan.packageId)
 assert.equal(context.outputRoot,plan.outputRoot)
 const packageBinding=bind(root,`.runtime/ai-painter/autonomous-closed-loop-packages/${plan.packageId}/package.json`),spec=json(root,packageBinding)
 assert.equal(spec.schemaVersion,'ai-painter-autonomous-closed-loop-package-v1');assert.equal(spec.ownerAuthorizationRequired,false)
 assert.equal(spec.maxInfrastructureRecoveryAttempts,0);assert.deepEqual(spec.inputEvidence,context.inputEvidence)
 assert.deepEqual(Object.keys(spec.programLineage).sort(),Object.keys(plan.programBindings).sort())
 assert.deepEqual(Object.keys(spec.phaseAdapters).sort(),[...phases].sort())
 for(const [role,b] of Object.entries(plan.programBindings))assert.equal(spec.programLineage[role],b.sha256)
 for(const name of phases)assert.deepEqual(spec.phaseAdapters[name],{kind:'project_module_export',path:ADAPTER,
  sha256:plan.programBindings.adapter.sha256,exportName:name})
 const input={plan,planBinding:plans[0],packageBinding,modelBinding:plan.modelBinding,modelIdentity:json(root,plan.modelBinding)}
 verifyBindings(root,input)
 return {root,plan,planBinding:plans[0],packageBinding,spec,input}
}

export function validateCompleted(value,packageBinding,plan){
 assert.equal(value.schema,'ecology-regime-managed-worker-terminal-v1');assert.equal(value.executionProfile,EXECUTION_PROFILE)
 assert.equal(value.status,'training_completed_review_pending');assert.equal(value.executionState,'completed')
 assert.equal(value.capabilityVersion,CAPABILITY);assert.equal(value.runId,plan.runId);assert.equal(value.packageId,plan.packageId)
 assert.deepEqual(value.executionPackage,packageBinding);assert.equal(value.completedEpochs,48)
 assert.deepEqual(value.optimizerSteps,{generator:2304,discriminator:2304})
 assert.equal(value.optimizerStepsGenerator,2304);assert.equal(value.optimizerStepsDiscriminator,2304)
 assert.equal(value.checkpointReloadVerified,true)
 for(const key of ['challengeContentRead','regressionContentRead','checkpointPromotable','formalStage4QualificationAllowed','runtimePublicationAllowed'])assert.equal(value[key],false)
 assert.deepEqual(value.executionAuthentication,{executionPackage:packageBinding,finalCpuAcceptance:plan.lifecycleCpuAcceptance,
  ownedGpuAcceptance:value.executionAuthentication?.ownedGpuAcceptance})
 const admission=value.executionAuthentication.ownedGpuAcceptance
 assert.equal(admission.path,plan.outputRoot+'/gpu-acceptance.json');assert.match(admission.sha256,/^[a-f0-9]{64}$/u)
 assert.deepEqual(value.checkpoints.map(r=>r.epoch),[24,36,48])
 for(const r of value.checkpoints){
  assert.deepEqual(r.counts,{generator:r.epoch*48,discriminator:r.epoch*48})
  assert.deepEqual(r.selection.rank,[r.selection.worstApplicableObjectCorrelation,-r.selection.meanValidationRgbMae,-r.epoch])
  assert.ok(r.selection.rank.every(Number.isFinite));assert.equal(r.checkpoint.path,plan.outputRoot+`/checkpoint-${String(r.epoch).padStart(2,'0')}.pt`)
  assert.match(r.checkpoint.sha256,/^[a-f0-9]{64}$/u)
 }
 const winner=[...value.checkpoints].sort((a,b)=>{for(let i=0;i<3;i++){const d=b.selection.rank[i]-a.selection.rank[i];if(d)return d}return 0})[0]
 assert.deepEqual(winner,value.selectedCheckpointRecord)
 return winner
}
