// Joint-route authority only. Execution and evidence IO stay in the shared chain.
import assert from 'node:assert/strict';
import {JOINT_PROFILE as route,JOINT_LEARNING_RULE,JOINT_PROGRESS_PUBLICATION_POLICY,CANDIDATE,LOSS,GRADIENT,INTEGRATION_POLICY,
 deriveConfiguration} from './ai-painter-object-support-structure-quality-registration-v1.mjs';

export const JOINT_COMPONENTS=Object.freeze({
 deviceBridge:'ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_device_v1.py',
 trainingProfile:'ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_v1.py',
 checkpoint:'ml/ai-painter/src/ai_painter/complete_world/joint_object_priority_quality_checkpoint_v1.py',
 tests:'ml/ai-painter/tests/test_joint_object_priority_quality_adapters_cpu_v1.py',
 nodeChain:'scripts/lib/ai-painter-joint-object-priority-quality-package-chain-v1.mjs',
 nodeTests:'scripts/tests/ai-painter-joint-object-priority-quality-integration.test.mjs',
 progressPublication:'ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v1.py'});

export function verifyJointPolicy(policy,configuration){
 assert.equal(policy.schemaVersion,'ai-painter-joint-object-priority-quality-execution-policy-v3');
 assert.equal(policy.status,'registered_bounded_candidate_route_not_qualified');
 assert.equal(policy.candidate,route.CAPABILITY);assert.equal(policy.modelCapability,route.MODEL_CAPABILITY);
 assert.equal(policy.executionProfile,route.EXECUTION_PROFILE);assert.equal(policy.outputRoot,route.OUTPUT_ROOT);
 assert.equal(policy.entrypointPath,'scripts/run-ai-painter-object-support-structure-quality-v1.mjs');
 assert.deepEqual({path:policy.formalSpecification.path,sha256:policy.formalSpecification.sha256},route.SPECIFICATION);
 assert.equal(policy.formalSpecification.version,'AI-PAINTER-SPEC-1.86');
 assert.deepEqual(policy.jointLearningRule,JOINT_LEARNING_RULE);assert.deepEqual(configuration.jointLearningRule,JOINT_LEARNING_RULE);
 assert.deepEqual(configuration.progressPublicationPolicy,JOINT_PROGRESS_PUBLICATION_POLICY);
 assert.deepEqual(policy.progressPublication,{componentPolicy:JOINT_PROGRESS_PUBLICATION_POLICY,
  componentPath:JOINT_COMPONENTS.progressPublication,freshnessSeconds:120,maximumPendingFiles:1,originalDeadlineRequired:true});
 for(const [key,value] of Object.entries({lossDefinition:LOSS,gradientDefinition:GRADIENT,integrationPolicy:INTEGRATION_POLICY})){
  assert.deepEqual(policy[key],value);assert.deepEqual(configuration[key],value);
 }
 assert.deepEqual(policy.componentPaths,{deviceBridge:JOINT_COMPONENTS.deviceBridge,trainingProfile:JOINT_COMPONENTS.trainingProfile,checkpoint:JOINT_COMPONENTS.checkpoint});
 assert.deepEqual(policy.checkpointIdentity,{schema:'joint-object-priority-quality-checkpoint-v1',configurationSchema:'object-support-structure-quality-configuration-v1',implementation:JOINT_COMPONENTS.checkpoint,historicalMetadataRenamingAllowed:false});
 assert.equal(policy.wireProtocols.checkpoint,'joint-object-priority-quality-checkpoint-v1');
 for(const key of ['executionCeiling','dataUse','optimizer'])assert.deepEqual(policy[key],configuration[key]);
 assert.deepEqual(policy.phaseResources,{cpuPreparationSeconds:240,gpuAdmissionSeconds:720,reviewSeconds:120,maxStreamBytes:8388608,cpuOutputBytes:8388608,qualificationAndReviewOutputBytes:16777216,captureMiB:64,captureMetadataReserveBytes:1048576,terminalReserveBytes:65536,programFileCountMaximum:260,programFileBytesMaximum:1048576,totalProgramBytesMaximum:16777216});
 assert.equal(policy.sourceClosure.maximumEntries,260);
 assert.equal(policy.sourceClosure.maximumFileBytes,1048576);assert.equal(policy.sourceClosure.maximumTotalBytes,16777216);
 assert.deepEqual(policy.gpuAdmission,{sampleSplit:'train',sampleCount:48,optimizerConstruction:0,optimizerUpdates:0,samePackageRequired:true,stateBytesMustRemainUnchanged:true,originalGradientGateKept:true,oldCandidateQualificationReusable:false,generatorForwardsPerSample:1,generatorAutogradPerSample:5,discriminatorAutogradPerSample:1,totalGeneratorAutograd:240,totalDiscriminatorAutograd:48});
 assert.equal(policy.modelBoundary.learningRuleChangedOnlyInFourObjectRgbHeads,true);
 assert.deepEqual(policy.modelBoundary.jointCpuRule,{path:'ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_cpu_v1.py',sha256:'99c437fe1cdf31229257c25716736e3c2f580a58f99fde8297c5e06611920324'});
 assert.equal(policy.priorCpuEvidence.oldAttemptReplayAllowed,false);assert.equal(policy.priorCpuEvidence.grantsGpuOrTrainingQualification,false);
 assert.equal(policy.priorCpuEvidence.normativeVersion,'AI-PAINTER-SPEC-1.82');
 assert.ok(Object.values(policy.qualification).every(value=>value===false));
 return policy;
}

export function jointHistoryBindings(policy){
 return [policy.jointLearningRule,policy.modelBoundary.jointCpuRule,...policy.modelBoundary.frozenCpuSources,
  ...['acceptance','terminal','policy','originalNormativeBytes'].map(key=>policy.priorCpuEvidence[key]),policy.previousExecutionPolicy,
  policy.progressPublication.componentPolicy,policy.progressPublicationCpuEvidence,
  {path:'ml/ai-painter/scripts/painter_stage4_detail_weight_capture_execution_worker.py',
   sha256:'2880bbf9f78efe8273134b89ceb5f95027e846f2aa177e5ae4c59bcdf0eade79'}];
}
export function jointProvenance(policy){
 return {schemaVersion:'ai-painter-execution-provenance-refs-v1',priorCpuAcceptance:{...policy.priorCpuEvidence.acceptance},
  priorCpuTerminal:{...policy.priorCpuEvidence.terminal},role:'immutable_historical_source_references_not_execution_permission'};
}

export function verifyJointAuthority(root,{read,json,bind}){
 const policy=json(root,route.EXECUTION_POLICY);
 assert.ok(read(root,route.SPECIFICATION).includes(Buffer.from('AI-PAINTER-SPEC-1.86')));
 const previewBinding=bind(root,route.previewPath),preview=json(root,previewBinding),candidate=json(root,CANDIDATE);
 const configuration=deriveConfiguration(candidate,{capabilityVersion:route.CAPABILITY,trainingPreviewPolicy:previewBinding});
 verifyJointPolicy(policy,configuration);
 assert.equal(preview.schemaVersion,'ai-painter-training-preview-observation-policy-v5');
 assert.equal(preview.scope.capabilityVersion,route.CAPABILITY);assert.equal(preview.scope.modelCapabilityVersion,route.MODEL_CAPABILITY);
 assert.equal(preview.scope.outputRootPrefix,route.OUTPUT_ROOT+'/');
 for(const key of ['component','tests','storage','storageTests'])read(root,preview.programBindings[key]);
 for(const binding of jointHistoryBindings(policy))read(root,binding);
 const progress=json(root,policy.progressPublication.componentPolicy),cpu=json(root,policy.progressPublicationCpuEvidence);
 assert.equal(progress.status,'registered_inactive_cpu_candidate');
 assert.equal(progress.implementation.component,JOINT_COMPONENTS.progressPublication);
 assert.equal(progress.publication.freshnessSeconds,120);assert.equal(progress.publication.maximumPendingFiles,1);
 assert.equal(progress.publication.originalDeadlineImmutable,true);
 assert.equal(cpu.status,'cpu_component_scope_closed_not_production_adopted');
 assert.equal(cpu.verification.candidateCpu.passed,24);assert.equal(cpu.verification.candidateCpu.failures,0);
 assert.equal(cpu.verification.candidateCpu.errors,0);assert.equal(cpu.verification.candidateCpu.skipped,0);
 const componentProof=cpu.implementation.component;
 assert.equal(componentProof.path,JOINT_COMPONENTS.progressPublication);read(root,componentProof);
 const prior=json(root,policy.priorCpuEvidence.acceptance),terminal=json(root,policy.priorCpuEvidence.terminal);
 assert.equal(prior.status,'cpu_affinity_startup_repair_closed_real_cpu_verified_inactive');
 assert.equal(terminal.status,'real_cpu_verified_inactive');assert.equal(terminal.executionState,'completed');
 assert.equal(terminal.candidateId,'stage4_mvp256_dry_joint_object_priority_real_cpu_v2');
 assert.equal(terminal.ownedReceipt.cleanupConfirmed,true);assert.equal(terminal.ownedReceipt.guardReleaseConfirmed,true);
 assert.equal(terminal.ownedReceipt.emptyJob,true);assert.equal(terminal.registryBeforeSha256,terminal.registryAfterSha256);
 assert.ok(Object.values(terminal.qualification).every(value=>value===false));
 return {policy,previewBinding};
}
