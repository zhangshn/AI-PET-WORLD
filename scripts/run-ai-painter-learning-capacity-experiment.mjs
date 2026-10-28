// One bounded experiment controller using the existing current-registry writer.
// No capability publication, formal-stage advancement, restart or shutdown API.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readCurrentExecutionRegistry, advanceCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs";
import { observationContract, CONTROLLER_SCOPE } from "../src/server/ai-console/training-observation-contract.mjs";
import { twoMapCheckpointPolicy, twoMapCheckpointSuccessorPolicy, twoMapWorker, twoMapTests, twoMapExperimentSucceeded } from "./lib/ai-painter-two-map-experiment-v1.mjs";
import { consumedSingle149Policy, single149Policy, single149Worker, single149Tests, single149Succeeded } from "./lib/ai-painter-single149-terrain-ecology-fit-v1.mjs";
import { replayPolicies, replayWorker, replayTests, replaySucceeded } from "./lib/ai-painter-replay-retention-fit-v1.mjs";
import { roadAttributionPolicy, roadAttributionWorker, roadAttributionTests, roadAttributionSucceeded } from "./lib/ai-painter-road-attribution-probe-v1.mjs";

import { routingPolicies, routingWorker, routingTests, routingSucceeded, runTerrainRoutingComparison } from "./lib/ai-painter-terrain-routing-comparison-v1.mjs";
import { consumedBackgroundPolicy, backgroundPolicy, backgroundWorker, backgroundTests, backgroundSucceeded } from "./lib/ai-painter-rock-background-probe-v1.mjs";
import { rehearsalPolicy, supportWeight1Policy, stemPolicies, stemPairPolicies, stemDecoderPolicies, terrainEcologyPolicy, rehearsalWorker, rehearsalTests, rehearsalSucceeded } from "./lib/ai-painter-mixed-train-rehearsal-v1.mjs";
import { causalProbePolicy, target44CausalProbePolicy, causalProbeWorker, causalProbeTests, causalProbeSucceeded } from "./lib/ai-painter-support-weight1-causal-probe-v1.mjs";

const root = process.cwd();
const python = path.join(root, "ml/ai-painter/.venv/Scripts/python.exe");
const defaultWorker = "ml/ai-painter/scripts/painter_learning_capacity_experiment.py";
export const singleMapCheckpointPolicy = "data/ai-painter/system-governance/ai-painter-single-map-checkpoint-fit-policy-v1.json";
export const singleMapCheckpointSuccessorPolicy = "data/ai-painter/system-governance/ai-painter-single-map-checkpoint-fit-policy-v2.json";
const reconstructionPolicy = "data/ai-painter/system-governance/ai-painter-decoder-reconstruction-experiment-policy-v1.json";
const v11TrainOnlyPolicy = "data/ai-painter/system-governance/stage4-mvp-v11-train-only-capacity-probe-v1.json";
const consumedV21TrainOnlyPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-train-only-capacity-probe-v1.json";
const v21TrainOnlyPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-train-only-capacity-probe-v2.json";
export const v21AllTrainFitPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-all-train-fit-readonly-policy-v1.json";
const consumedV21FullTrainExposurePolicy = "data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v1.json";
const consumedV21FullTrainExposurePolicyV2 = "data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v2.json";
export const v21FullTrainExposurePolicy = "data/ai-painter/system-governance/stage4-mvp-v21-full-train-exposure-policy-v3.json";
const consumedWholeFrameFidelityPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-whole-frame-fidelity-policy-v1.json";
export const wholeFrameFidelityPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-whole-frame-fidelity-policy-v2.json";
export const objectCoreFidelityPolicy = "data/ai-painter/system-governance/stage4-mvp-v21-object-core-fidelity-policy-v1.json";
export const v23CompleteSupportPartitionPolicy = "data/ai-painter/system-governance/stage4-mvp-v23-complete-support-partition-policy-v1.json";
export const v24ObjectHeadCorePriorityPolicy = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v1.json";
export const v24IeeeObjectHeadCorePriorityPolicy = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v2.json";
export const v24CriticModeObjectHeadCorePriorityPolicy = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v3.json";
export const v24CheckerBoundObjectHeadCorePriorityPolicy = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v4.json";
export const v24ResourceBoundObjectHeadCorePriorityPolicy = "data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v5.json";
export function objectCoreObjectiveValid(result, pkg, readProof = binding => {
  assert.deepEqual(binding, bind(binding.path)); return read(binding.path);
}) {
  try {
    assert.equal(pkg?.policy?.path, objectCoreFidelityPolicy);
    const plan = pkg.inputs.objectivePlan;
    assert.deepEqual(plan, {
      candidateId: "stage4_mvp_v21_object_core_fidelity_cpu_candidate_v1",
      program: bind("ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_core_fidelity_candidate_cpu.py"),
      tests: bind("ml/ai-painter/tests/test_native_rgb_object_core_fidelity_candidate_cpu.py"),
      cpuEvidence: bind(".runtime/ai-painter/stage4-mvp-v21-object-core-fidelity-cpu-prototype/report.json"),
      inheritedObjectivePlan: plan.inheritedObjectivePlan,
      formula: "unchanged_whole_frame_fidelity_total_plus_equal_nonempty_role_core_rgb_l1",
      coreRgbWeight: 1, roles: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
      maskDilation: false, coefficientSelection: "fixed_one_no_search", targetSplit: "train",
      existingTermsPreserved: true, qualificationGranted: false,
      historicalComparisonPurpose: "changed_loss_comparison_not_numerical_reproduction",
    });
    assert.deepEqual(result.objectivePlan, plan);
    const proofs = result.artifacts.filter(item => item.path === `${pkg.outputRoot}/zero-update-gpu-probe.json`);
    assert.equal(proofs.length, 1);
    const proof = readProof(proofs[0]);
    assert.equal(proof.cases.length, 48);
    for (const entry of proof.cases) {
      assert.equal(entry.objectiveId, plan.candidateId);
      const terms = entry.objectiveTerms;
      for (const key of ["wholeFrameFidelityUnchangedTotal", "objectCoreRgbMae", "objectCoreRgbWeighted", "objectCoreApplicableRoleCount", "total"])
        assert(Number.isFinite(terms[key]));
      assert(Number.isInteger(terms.objectCoreApplicableRoleCount) && terms.objectCoreApplicableRoleCount >= 1 && terms.objectCoreApplicableRoleCount <= 4);
      assert(terms.objectCoreRgbMae >= 0 && terms.objectCoreRgbMae <= 1);
      assert.equal(terms.objectCoreRgbWeighted, terms.objectCoreRgbMae);
      const expected = terms.wholeFrameFidelityUnchangedTotal + terms.objectCoreRgbWeighted;
      assert(Math.abs(terms.total - expected) <= Math.max(1e-6, 1e-5 * Math.abs(expected)));
      const inherited = terms.v21UnchangedTotal + terms.wholeFrameFidelity;
      assert(Math.abs(terms.wholeFrameFidelityUnchangedTotal - inherited) <= Math.max(1e-6, 1e-5 * Math.abs(inherited)));
    }
    // Compose the unchanged inherited validator on in-memory projections only.
    // The actual frozen package, objective and proof bytes are never rewritten.
    return wholeFrameObjectiveValid(
      {...result, objectivePlan: plan.inheritedObjectivePlan},
      {...pkg, policy: {...pkg.policy, path: wholeFrameFidelityPolicy},
        inputs: {...pkg.inputs, objectivePlan: plan.inheritedObjectivePlan}},
      () => ({...proof, cases: proof.cases.map(entry => ({...entry, objectiveId: plan.inheritedObjectivePlan.candidateId}))}));
  } catch { return false; }
}
export function v23CompleteSupportPartitionValid(result, pkg, readProof = binding => {
  assert.deepEqual(binding, bind(binding.path)); return read(binding.path);
}) {
  try {
    assert.equal(pkg?.policy?.path, v23CompleteSupportPartitionPolicy);
    assert.equal(pkg?.experimentType, "complete_support_partition_train_only");
    assert.equal(result?.experimentType, pkg.experimentType);
    const modelPlan = { baseChannels: 48, patchChannels: 32, seed: 20260929,
      capabilityVersion: "stage4_mvp_native_rgb_complete_support_partition_v23_cpu_candidate",
      architectureId: "stage4_native_rgb_terrain_plus_complete_typed_support_partition_v23",
      freshInitializationOnly: true, historicalCheckpointLoaded: false };
    const representationPlan = {
      capabilityVersion: modelPlan.capabilityVersion, architectureId: modelPlan.architectureId,
      ownershipRule: "complete_typed_support_partition_by_nearest_normalized_core_v1",
      program: bind("ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py"),
      tests: bind("ml/ai-painter/tests/test_native_rgb_complete_support_partition_v23_cpu.py"),
      cpuEvidence: bind(".runtime/ai-painter/stage4-mvp-v23-complete-support-partition-cpu/report.json"),
      controllerAcceptance: bind(".runtime/ai-painter/stage4-mvp-v23-complete-support-partition-cpu/controller-acceptance.json"),
      formalSpecification: {...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),
        version: "AI-PAINTER-SPEC-1.24", section: "9.6.8"},
      typedRoles: ["object_tree", "object_rock", "object_vegetation"],
      tieOrder: ["object_tree", "object_rock", "object_vegetation"],
      supportRadiusPixels: { object_tree: 8, object_rock: 4, object_vegetation: 6 },
      distance: "exact_integer_chebyshev_distance_to_nearest_same_role_authoritative_core",
      comparison: "integer_cross_multiplication_strict_less_than",
      coreNeverYields: true, ownedUnionEqualsExistingTypedCoverageUnion: true,
      ownersPairwiseDisjoint: true, ownerSubsetOfOwnExistingCoverage: true,
      supportExpanded: false, freshInitializationSeed: 20260929, historicalCheckpointLoaded: false,
      inheritedComponents: { terrainPath: "unchanged_fresh_v21", critic: "unchanged_fresh_v21",
        objective: "unchanged_object_core_fidelity_v1", conditionChannels: "unchanged_23",
        instanceFeatureAssembly: "unchanged_v21", rgbHeads: "unchanged_v21",
        footprintResidual: "unchanged_v21", pointwiseComposition: "unchanged_v21" },
      qualificationGranted: false,
    };
    assert.deepEqual(pkg.inputs.modelPlan, modelPlan); assert.deepEqual(pkg.config.modelPlan, modelPlan);
    assert.deepEqual(result.modelPlan, modelPlan);
    assert.deepEqual(pkg.inputs.representationPlan, representationPlan);
    assert.deepEqual(pkg.config.representationPlan, representationPlan);
    assert.deepEqual(result.representationPlan, representationPlan);
    assert.deepEqual(result.objectivePlan, pkg.inputs.objectivePlan);
    const source = pkg.inputs.sourcePlan;
    assert.deepEqual(pkg.config.sourcePlan, source);
    assert.deepEqual(source, { datasetManifest: pkg.inputs.datasetManifest, sourceIndex: pkg.inputs.sourceIndex,
      trainSplit: pkg.inputs.trainSplit, conditionContract: pkg.inputs.conditionContract,
      sourceRgbUse: "original_train_rgb_targets_only", conditionUse: "original_bound_23_channels",
      externalRgbRead: false, worldFactsChanged: false, sourceBytesMutable: false,
      validationContentRead: false, challengeContentRead: false, regressionContentRead: false });
    const data = pkg.inputs.dataPlan;
    assert.deepEqual(pkg.config.dataPlan, data);
    assert.deepEqual(data, { split: "train", selectedRowCount: 48,
      trainSelectionSha256: pkg.inputs.trainSelectionSha256,
      orderedRows: pkg.selectedRows.map(row => ({sampleId: row.sampleId, split: row.split, trainOrdinal: row.trainOrdinal})),
      epochs: 48, visitsPerRow: 48, generatorOptimizerSteps: 2304, discriminatorOptimizerSteps: 2304,
      holdoutUsed: false, historicalWeightsUsed: false, automaticRetries: 0 });
    const proofs = result.artifacts.filter(item => item.path === `${pkg.outputRoot}/zero-update-gpu-probe.json`);
    assert.equal(proofs.length, 1);
    const proof = readProof(proofs[0]);
    assert.equal(proof.passed, true); assert.equal(proof.caseCount, 48); assert.equal(proof.cases.length, 48);
    assert.equal(proof.optimizerCreated, false); assert.deepEqual(proof.optimizerSteps, {generator: 0, discriminator: 0});
    for (const [index, entry] of proof.cases.entries()) {
      assert.equal(entry.capabilityVersion, modelPlan.capabilityVersion);
      assert.equal(entry.architectureId, modelPlan.architectureId);
      assert.equal(entry.representationId, representationPlan.ownershipRule);
      assert.equal(entry.case.sampleId, pkg.selectedRows[index].sampleId);
      assert.equal(entry.case.trainOrdinal, index); assert.equal(entry.case.split, "train");
      assert.deepEqual(entry.initialStateSha256, entry.finalStateSha256);
      assert.match(entry.conditionTensorSha256, /^[a-f0-9]{64}$/u);
      const facts = entry.ownershipFacts;
      assert.equal(facts.ownershipRule, representationPlan.ownershipRule);
      assert(Number.isSafeInteger(facts.typedSupportUnionPixels) && facts.typedSupportUnionPixels >= 0);
      assert.equal(facts.ownedUnionPixels, facts.typedSupportUnionPixels);
      assert.equal(facts.supportUnionMismatchPixels, 0); assert.equal(facts.ownerOverlapPixels, 0);
      let owned = 0;
      assert.deepEqual(Object.keys(facts.roles), representationPlan.typedRoles);
      for (const role of representationPlan.typedRoles) {
        const row = facts.roles[role];
        for (const key of ["corePixels", "coveragePixels", "ownedPixels"])
          assert(Number.isSafeInteger(row[key]) && row[key] >= 0);
        assert(row.corePixels <= row.ownedPixels && row.ownedPixels <= row.coveragePixels);
        assert.equal(row.coreOwnershipMissingPixels, 0); assert.equal(row.ownerOutsideCoveragePixels, 0);
        assert.match(row.ownerMaskSha256, /^[a-f0-9]{64}$/u); owned += row.ownedPixels;
      }
      assert.equal(owned, facts.ownedUnionPixels);
    }
    return objectCoreObjectiveValid(
      result,
      {...pkg, policy: {...pkg.policy, path: objectCoreFidelityPolicy}}, () => proof);
  } catch { return false; }
}
export function v24ObjectHeadCorePriorityValid(result, pkg, readProof = binding => {
  assert.deepEqual(binding, bind(binding.path)); return read(binding.path);
}) {
  try {
    assert.equal(pkg?.policy?.path, v24ObjectHeadCorePriorityPolicy);
    assert.equal(pkg?.experimentType, "object_head_core_priority_train_only");
    assert.equal(result?.experimentType, pkg.experimentType);
    const model = pkg.inputs.modelPlan, representation = pkg.inputs.representationPlan;
    assert.deepEqual(pkg.config.modelPlan, model); assert.deepEqual(result.modelPlan, model);
    assert.equal(model.capabilityVersion, "stage4_mvp_native_rgb_complete_support_partition_v23_cpu_candidate");
    assert.equal(model.architectureId, "stage4_native_rgb_terrain_plus_complete_typed_support_partition_v23");
    assert.equal(model.seed, 20260929); assert.equal(model.freshInitializationOnly, true);
    assert.equal(model.historicalCheckpointLoaded, false);
    assert.deepEqual(pkg.config.representationPlan, representation);
    assert.deepEqual(result.representationPlan, representation);
    assert.equal(representation.ownershipRule, "complete_typed_support_partition_by_nearest_normalized_core_v1");
    assert.deepEqual(representation.program, bind("ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py"));
    assert.deepEqual(representation.formalSpecificationSnapshot,
      {...bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/frozen-formal-spec-1.24.md"),
        version:"AI-PAINTER-SPEC-1.24",historicalEvidenceOnly:true});
    const precision = {generatorForward:"native_fp32_no_autocast",
      generatorObjective:"native_fp32_frozen_critic_no_autocast",
      actualTotalGradient:"native_fp32_complete_model_independent_autograd_grad",
      auxiliaryGradients:"native_fp32_actual_four_heads_only_three_autograd_grad_calls",
      projection:"cpu_float64_fixed_v24_reference_then_fp32_return",
      discriminatorUpdate:"inherited_cuda_bfloat16_autocast_original_objective_and_order",
      observation:"native_fp32_no_autocast",oldStudyPrecisionDiffers:true,singleFactorCausalClaimAllowed:false};
    assert.deepEqual(pkg.inputs.precisionExecutionPlan, precision);
    assert.deepEqual(pkg.config.precisionExecutionPlan, precision); assert.deepEqual(result.precisionExecutionPlan, precision);
    const update = pkg.inputs.updatePlan;
    assert.deepEqual(pkg.config.updatePlan, update); assert.deepEqual(result.updatePlan, update);
    assert.equal(update.candidateId, "stage4_mvp_v24_object_head_core_priority_training_candidate_v1");
    assert.equal(update.experimentType, pkg.experimentType);
    assert.deepEqual(update.program, bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24.py"));
    assert.deepEqual(update.tests, bind("ml/ai-painter/tests/test_object_head_core_priority_update_v24.py"));
    assert.deepEqual(update.cpuReference, bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24_cpu.py"));
    assert.deepEqual(update.cpuReferenceEvidence, bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/result.json"));
    assert.deepEqual(update.cpuReferenceAcceptance, bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/controller-acceptance.json"));
    assert.deepEqual(update.currentFormalSpecification,
      {...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.26",section:"9.6.10"});
    assert.equal(update.objectHeadParameterTensorCount,16); assert.equal(update.objectHeadParameterElementCount,4876);
    assert.equal(update.nonHeadParameterTensorCount,90); assert.equal(update.lossAndCoefficientsChanged,false);
    assert.equal(update.actualTotalIndependentFullModelGradient,true); assert.equal(update.historicalCheckpointLoaded,false);
    const integration = pkg.inputs.integrationPlan;
    assert.deepEqual(pkg.config.integrationPlan,integration); assert.deepEqual(result.integrationPlan,integration);
    assert.deepEqual(integration.controller,bind("scripts/run-ai-painter-learning-capacity-experiment.mjs"));
    assert.deepEqual(integration.worker,bind("ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"));
    assert.deepEqual(integration.workerTests,bind("ml/ai-painter/tests/test_stage4_v24_object_head_core_priority_probe.py"));
    assert.deepEqual(integration.controllerTests,bind("scripts/tests/test-ai-painter-v24-core-priority-controller.mjs"));
    assert.equal(integration.evidence.path,".runtime/ai-painter/stage4-mvp-v24-core-priority-integration-cpu/result.json");
    assert.equal(integration.controllerAcceptance.path,".runtime/ai-painter/stage4-mvp-v24-core-priority-integration-cpu/controller-acceptance.json");
    assert.match(integration.evidence.sha256,/^[a-f0-9]{64}$/u); assert.match(integration.controllerAcceptance.sha256,/^[a-f0-9]{64}$/u);
    assert.equal(integration.gpuQualified,false); assert.equal(integration.trainingAllowed,false);
    const quality=pkg.inputs.qualityComparisonPlan;
    assert.deepEqual(pkg.config.qualityComparisonPlan,quality); assert.deepEqual(result.qualityComparisonPlan,quality);
    assert.equal(quality.selectedRowCount,48); assert.equal(quality.trainSelectionSha256,pkg.inputs.trainSelectionSha256);
    assert.deepEqual(quality.requiredStrictMeanDecreases,["fullRgbMae","object_footprintsCoreRgbMae",
      "object_treeCoreRgbMae","object_rockCoreRgbMae","object_vegetationCoreRgbMae"]);
    assert.equal(quality.improvementOffsetAllowed,false); assert.equal(quality.semanticReadabilityRequiredForQualification,true);
    const data=pkg.inputs.dataPlan; assert.deepEqual(pkg.config.dataPlan,data);
    assert.equal(data.selectedRowCount,48); assert.equal(data.generatorOptimizerSteps,2304);
    assert.equal(data.discriminatorOptimizerSteps,2304); assert.equal(data.holdoutUsed,false);
    assert.equal(data.historicalWeightsUsed,false); assert.equal(data.automaticRetries,0);
    const proofs=result.artifacts.filter(item=>item.path===`${pkg.outputRoot}/zero-update-gpu-probe.json`);
    assert.equal(proofs.length,1); const proof=readProof(proofs[0]);
    assert.equal(proof.passed,true); assert.equal(proof.caseCount,48); assert.equal(proof.cases.length,48);
    assert.equal(proof.optimizerCreated,false); assert.deepEqual(proof.optimizerSteps,{generator:0,discriminator:0});
    for(const [index,entry] of proof.cases.entries()) {
      assert.equal(entry.case.sampleId,pkg.selectedRows[index].sampleId); assert.equal(entry.case.trainOrdinal,index);
      assert.equal(entry.case.split,"train"); assert.deepEqual(entry.initialStateSha256,entry.finalStateSha256);
      assert.equal(entry.candidateId,update.candidateId); assert.deepEqual(entry.precisionExecutionPlan,precision);
      assert.equal(entry.generatorCandidate.autogradGradCalls,4);
      assert.equal(entry.generatorCandidate.actualTotalIndependentFullModelGradient,true);
      assert.equal(entry.generatorCandidate.cpuReferenceExact,true);
      assert.equal(entry.generatorCandidate.fullModelAuxiliaryGradientsCopiedToCpu,false);
      assert.equal(entry.generatorCandidate.nonHeadActualTotalIdentityPreserved,true);
      assert.equal(entry.generatorCandidate.nonConflictHeadActualTotalBytesPreserved,true);
      assert.equal(entry.generatorCandidate.parameterIdentity.objectHeadParameterTensorCount,16);
      assert.equal(entry.generatorCandidate.parameterIdentity.objectHeadParameterElementCount,4876);
      assert.equal(entry.generatorCandidate.parameterIdentity.uniqueParameterStorages,true);
      assert(entry.generatorCandidate.generatorGradientFacts.nonzeroTensorCount>0);
      assert(entry.generatorCandidate.generatorGradientFacts.nonzeroElementCount>0);
      assert.deepEqual(Object.keys(entry.generatorCandidate.headDiagnostics),["object_footprints","object_tree","object_rock","object_vegetation"]);
      for(const facts of Object.values(entry.generatorCandidate.headDiagnostics))
        assert(["core_zero_preserve_actual_total","non_conflict_preserve_actual_total","conflict_projected"].includes(facts.branch));
      assert(entry.discriminatorGradientFacts.nonzeroTensorCount>0);
      assert(entry.discriminatorGradientFacts.nonzeroElementCount>0);
      assert.equal(entry.discriminatorGradientFacts.allFinite,true);
      assert.equal(entry.criticFrozenDuringGenerator,true);
      assert.equal(entry.criticGradientLeakDuringGenerator,false);
      assert.equal(entry.generatorGradientLeakDuringDiscriminator,false);
      assert.equal(entry.targetAndConditionsDetached,true); assert.equal(entry.sourceTensorsUnchanged,true);
      assert.equal(entry.rngRestored,true); assert.equal(entry.gradFieldsCleared,true);
      assert.equal(entry.ownershipFacts.supportUnionMismatchPixels,0); assert.equal(entry.ownershipFacts.ownerOverlapPixels,0);
      assert.match(entry.conditionTensorSha256,/^[a-f0-9]{64}$/u);
    }
    return true;
  } catch { return false; }
}
export function v24IeeeObjectHeadCorePriorityValid(result, pkg, readProof = binding => {
  assert.deepEqual(binding, bind(binding.path)); return read(binding.path);
}, bindExact = bind) {
  try {
    assert.equal(pkg?.policy?.path, v24IeeeObjectHeadCorePriorityPolicy);
    assert.equal(pkg?.experimentType, "object_head_core_priority_train_only");
    assert.equal(result?.experimentType, pkg.experimentType);
    assert.match(pkg.experimentIdentity, /^v24-ieee-core-priority-[a-f0-9]+$/u);
    const precision = {generatorForward:"explicit_ieee_fp32_matmul_and_convolution_no_autocast",
      generatorObjective:"explicit_ieee_fp32_matmul_and_convolution_frozen_critic_no_autocast",
      actualTotalGradient:"explicit_ieee_fp32_complete_model_independent_autograd_grad",
      auxiliaryGradients:"explicit_ieee_fp32_actual_four_heads_only_three_autograd_grad_calls",
      generatorPrecisionContext:"current_fp32_precision_api_scoped_and_restored_on_success_or_failure",
      projection:"cpu_float64_fixed_v24_reference_then_fp32_return",
      discriminatorUpdate:"inherited_cuda_bfloat16_autocast_original_objective_and_order",
      observation:"native_fp32_no_autocast",oldStudyPrecisionDiffers:true,singleFactorCausalClaimAllowed:false};
    assert.deepEqual(pkg.inputs.precisionExecutionPlan,precision);
    assert.deepEqual(pkg.config.precisionExecutionPlan,precision);
    assert.deepEqual(result.precisionExecutionPlan,precision);
    const update = pkg.inputs.updatePlan;
    assert.deepEqual(pkg.config.updatePlan,update); assert.deepEqual(result.updatePlan,update);
    assert.deepEqual(update,{
      candidateId:"stage4_mvp_v24_object_head_core_priority_training_candidate_v2",
      experimentType:"object_head_core_priority_train_only",
      program:bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24.py"),
      tests:bind("ml/ai-painter/tests/test_object_head_core_priority_update_v24.py"),
      cpuReference:bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24_cpu.py"),
      cpuReferenceTests:bind("ml/ai-painter/tests/test_object_head_core_priority_update_v24_cpu.py"),
      cpuReferenceEvidence:bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/result.json"),
      cpuReferenceAcceptance:bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/controller-acceptance.json"),
      cpuReferenceFormalSpecification:{...bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/frozen-formal-spec-1.25.md"),version:"AI-PAINTER-SPEC-1.25",section:"9.6.9"},
      numericDiagnosisTask:bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/task.json"),
      numericDiagnosisEvidence:bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/result.json"),
      numericRepairEvidence:bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/repair-result.json"),
      numericControllerAcceptance:bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/controller-acceptance.json"),
      numericFormalSpecificationSnapshot:{...bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/frozen-formal-spec-1.27.md"),version:"AI-PAINTER-SPEC-1.27",section:"9.6.11"},
      currentFormalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.28",section:"9.6.12"},
      formula:"per_actual_object_rgb_head_remove_only_negative_other_component",
      actualTotalIndependentFullModelGradient:true,auxiliaryGradientsActualHeadParametersOnly:true,
      objectHeadParameterTensorCount:16,objectHeadParameterElementCount:4876,
      nonHeadParameterTensorCount:90,lossAndCoefficientsChanged:false,
      historicalCheckpointLoaded:false,qualificationGranted:false});
    const integration = pkg.inputs.integrationPlan;
    assert.deepEqual(pkg.config.integrationPlan,integration); assert.deepEqual(result.integrationPlan,integration);
    const expectedIntegration={controller:bind("scripts/run-ai-painter-learning-capacity-experiment.mjs"),
      worker:bind("ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"),
      workerTests:bind("ml/ai-painter/tests/test_stage4_v24_object_head_core_priority_probe.py"),
      controllerTests:bind("scripts/tests/test-ai-painter-v24-ieee-core-priority-controller.mjs"),
      historicalControllerTests:bind("scripts/tests/test-ai-painter-v24-core-priority-controller.mjs"),
      diagnosticProgram:bind(".runtime/ai-painter/stage4-mvp-v24-ieee-integration-cpu/diagnose-v24-ieee-integration-cpu.py"),
      diagnosticTests:bind(".runtime/ai-painter/stage4-mvp-v24-ieee-integration-cpu/test-diagnose-v24-ieee-integration-cpu.py"),
      evidence:integration.evidence,controllerAcceptance:integration.controllerAcceptance,
      formalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.28",section:"9.6.12"},
      gpuQualified:false,trainingAllowed:false};
    assert.deepEqual(integration,expectedIntegration);
    assert.equal(integration.evidence.path,".runtime/ai-painter/stage4-mvp-v24-ieee-integration-cpu/result.json");
    assert.equal(integration.controllerAcceptance.path,".runtime/ai-painter/stage4-mvp-v24-ieee-integration-cpu/controller-acceptance.json");
    assert.deepEqual(integration.evidence,bindExact(integration.evidence.path));
    assert.deepEqual(integration.controllerAcceptance,bindExact(integration.controllerAcceptance.path));
    const proofs=result.artifacts.filter(item=>item.path===`${pkg.outputRoot}/zero-update-gpu-probe.json`);
    assert.equal(proofs.length,1); const proof=readProof(proofs[0]);
    assert.equal(proof.caseCount,48); assert.equal(proof.cases.length,48);
    for(const entry of proof.cases) {
      assert.equal(entry.candidateId,update.candidateId);
      assert.deepEqual(entry.precisionExecutionPlan,precision);
    }
    const oldPrecision={generatorForward:"native_fp32_no_autocast",
      generatorObjective:"native_fp32_frozen_critic_no_autocast",
      actualTotalGradient:"native_fp32_complete_model_independent_autograd_grad",
      auxiliaryGradients:"native_fp32_actual_four_heads_only_three_autograd_grad_calls",
      projection:"cpu_float64_fixed_v24_reference_then_fp32_return",
      discriminatorUpdate:"inherited_cuda_bfloat16_autocast_original_objective_and_order",
      observation:"native_fp32_no_autocast",oldStudyPrecisionDiffers:true,singleFactorCausalClaimAllowed:false};
    const oldUpdate={...update,candidateId:"stage4_mvp_v24_object_head_core_priority_training_candidate_v1",
      currentFormalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.26",section:"9.6.10"}};
    for(const key of ["numericDiagnosisTask","numericDiagnosisEvidence","numericRepairEvidence",
      "numericControllerAcceptance","numericFormalSpecificationSnapshot"]) delete oldUpdate[key];
    const oldIntegration={controller:integration.controller,worker:integration.worker,
      workerTests:integration.workerTests,
      controllerTests:integration.historicalControllerTests,
      evidence:{path:".runtime/ai-painter/stage4-mvp-v24-core-priority-integration-cpu/result.json",sha256:"a".repeat(64)},
      controllerAcceptance:{path:".runtime/ai-painter/stage4-mvp-v24-core-priority-integration-cpu/controller-acceptance.json",sha256:"b".repeat(64)},
      formalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.26",section:"9.6.10"},
      gpuQualified:false,trainingAllowed:false};
    const projectedPkg={...pkg,policy:{...pkg.policy,path:v24ObjectHeadCorePriorityPolicy},
      inputs:{...pkg.inputs,precisionExecutionPlan:oldPrecision,updatePlan:oldUpdate,integrationPlan:oldIntegration},
      config:{...pkg.config,precisionExecutionPlan:oldPrecision,updatePlan:oldUpdate,integrationPlan:oldIntegration}};
    const projectedResult={...result,precisionExecutionPlan:oldPrecision,updatePlan:oldUpdate,integrationPlan:oldIntegration};
    const projectedProof={...proof,cases:proof.cases.map(entry=>({...entry,
      candidateId:oldUpdate.candidateId,precisionExecutionPlan:oldPrecision}))};
    return v24ObjectHeadCorePriorityValid(projectedResult,projectedPkg,()=>projectedProof);
  } catch { return false; }
}
export function v24CriticModeObjectHeadCorePriorityValid(result, pkg, readProof = binding => {
  assert.deepEqual(binding, bind(binding.path)); return read(binding.path);
}, bindExact = bind, readJson = read) {
  try {
    assert.equal(pkg?.policy?.path, v24ResourceBoundObjectHeadCorePriorityPolicy);
    assert.equal(pkg?.experimentType, "object_head_core_priority_train_only");
    assert.equal(result?.experimentType, pkg.experimentType);
    assert.match(pkg.experimentIdentity, /^v24-resource-bound-core-priority-[a-f0-9]+$/u);
    assert.deepEqual(pkg.resources,{maxWallSeconds:2700,maxGpuMemoryFraction:.7,
      maximumTemperatureC:85,minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,
      maxOutputMiB:128,cpuThreads:2,automaticRetries:0});
    const precision = {generatorForward:"explicit_ieee_fp32_matmul_and_convolution_no_autocast",
      generatorObjective:"explicit_ieee_fp32_matmul_and_convolution_frozen_critic_no_autocast",
      actualTotalGradient:"explicit_ieee_fp32_complete_model_independent_autograd_grad",
      auxiliaryGradients:"explicit_ieee_fp32_actual_four_heads_only_three_autograd_grad_calls",
      generatorPrecisionContext:"current_fp32_precision_api_scoped_and_restored_on_success_or_failure",
      projection:"cpu_float64_fixed_v24_reference_then_fp32_return",
      discriminatorUpdate:"inherited_cuda_bfloat16_autocast_original_objective_and_order",
      observation:"native_fp32_no_autocast",oldStudyPrecisionDiffers:true,singleFactorCausalClaimAllowed:false};
    const criticStatePlan={pairEntryCapture:{submoduleTrainingFlags:"all_critic_modules_exact",
      parameterRequiresGradFlags:"all_critic_parameters_exact"},
      discriminatorPhase:{mode:"critic_train_all_submodules",parameters:"all_requires_grad_true",
        precision:"inherited_cuda_bfloat16_autocast_original_objective_and_order"},
      generatorPhase:{mode:"critic_eval_all_submodules",parameters:"all_requires_grad_false",
        scope:["generator_forward","frozen_critic_objective","four_autograd_grad_calls","generator_commit"],
        criticParametersBuffersGradients:"unchanged_from_post_discriminator_zero_grad"},
      restoration:{normal:true,discriminatorObjectiveFailure:true,discriminatorResourceFailure:true,
        discriminatorCommitFailure:true,generatorObjectiveFailure:true,generatorResourceFailure:true,
        generatorGradientFailure:true,generatorCommitFailure:true,completedOptimizerStepsPreserved:true,
        completedOptimizerStepsNotRolledBack:true}};
    for(const [key, expected] of [["precisionExecutionPlan",precision],["criticStatePlan",criticStatePlan]]) {
      assert.deepEqual(pkg.inputs[key],expected); assert.deepEqual(pkg.config[key],expected);
      assert.deepEqual(result[key],expected);
    }
    const model={baseChannels:48,patchChannels:32,seed:20260929,
      capabilityVersion:"stage4_mvp_native_rgb_complete_support_partition_v23_cpu_candidate",
      architectureId:"stage4_native_rgb_terrain_plus_complete_typed_support_partition_v23",
      freshInitializationOnly:true,historicalCheckpointLoaded:false};
    const representation={capabilityVersion:model.capabilityVersion,architectureId:model.architectureId,
      ownershipRule:"complete_typed_support_partition_by_nearest_normalized_core_v1",
      program:bind("ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py"),
      tests:bind("ml/ai-painter/tests/test_native_rgb_complete_support_partition_v23_cpu.py"),
      cpuEvidence:bind(".runtime/ai-painter/stage4-mvp-v23-complete-support-partition-cpu/report.json"),
      controllerAcceptance:bind(".runtime/ai-painter/stage4-mvp-v23-complete-support-partition-cpu/controller-acceptance.json"),
      formalSpecification:{path:"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
        sha256:"2940cb51701ad75dc180ca7c73f1497b096f3abefe1b6e6f5b6706ac6c4c559b",
        version:"AI-PAINTER-SPEC-1.24",section:"9.6.8"},
      formalSpecificationSnapshot:{...bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/frozen-formal-spec-1.24.md"),version:"AI-PAINTER-SPEC-1.24",historicalEvidenceOnly:true},
      typedRoles:["object_tree","object_rock","object_vegetation"],
      tieOrder:["object_tree","object_rock","object_vegetation"],
      supportRadiusPixels:{object_tree:8,object_rock:4,object_vegetation:6},
      distance:"exact_integer_chebyshev_distance_to_nearest_same_role_authoritative_core",
      comparison:"integer_cross_multiplication_strict_less_than",coreNeverYields:true,
      ownedUnionEqualsExistingTypedCoverageUnion:true,ownersPairwiseDisjoint:true,
      ownerSubsetOfOwnExistingCoverage:true,supportExpanded:false,freshInitializationSeed:20260929,
      historicalCheckpointLoaded:false,
      inheritedComponents:{terrainPath:"unchanged_fresh_v21",critic:"unchanged_fresh_v21",
        objective:"unchanged_object_core_fidelity_v1",conditionChannels:"unchanged_23",
        instanceFeatureAssembly:"unchanged_v21",rgbHeads:"unchanged_v21",
        footprintResidual:"unchanged_v21",pointwiseComposition:"unchanged_v21"},
      qualificationGranted:false};
    assert.deepEqual(pkg.inputs.modelPlan,model); assert.deepEqual(pkg.config.modelPlan,model);
    assert.deepEqual(result.modelPlan,model);
    assert.deepEqual(pkg.inputs.representationPlan,representation);
    assert.deepEqual(pkg.config.representationPlan,representation);
    assert.deepEqual(result.representationPlan,representation);
    const source={datasetManifest:pkg.inputs.datasetManifest,sourceIndex:pkg.inputs.sourceIndex,
      trainSplit:pkg.inputs.trainSplit,conditionContract:pkg.inputs.conditionContract,
      sourceRgbUse:"original_train_rgb_targets_only",conditionUse:"original_bound_23_channels",
      externalRgbRead:false,worldFactsChanged:false,sourceBytesMutable:false,
      validationContentRead:false,challengeContentRead:false,regressionContentRead:false};
    assert.deepEqual(pkg.inputs.sourcePlan,source); assert.deepEqual(pkg.config.sourcePlan,source);
    const data={split:"train",selectedRowCount:48,trainSelectionSha256:pkg.inputs.trainSelectionSha256,
      orderedRows:pkg.selectedRows.map(row=>({sampleId:row.sampleId,split:row.split,trainOrdinal:row.trainOrdinal})),
      epochs:48,visitsPerRow:48,generatorOptimizerSteps:2304,discriminatorOptimizerSteps:2304,
      holdoutUsed:false,historicalWeightsUsed:false,automaticRetries:0};
    assert.deepEqual(pkg.inputs.dataPlan,data); assert.deepEqual(pkg.config.dataPlan,data);
    const quality={baselineRunId:"v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6",
      baselineResult:bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/result.json"),
      baselineEndpointCpuReview:bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/controller-endpoint-cpu-review.json"),
      baselineQualityReview:bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/controller-quality-review.json"),
      trainSelectionSha256:pkg.inputs.trainSelectionSha256,selectedRowCount:48,measurementPrecision:"cpu_fp32",
      requiredStrictMeanDecreases:["fullRgbMae","object_footprintsCoreRgbMae","object_treeCoreRgbMae","object_rockCoreRgbMae","object_vegetationCoreRgbMae"],
      improvementOffsetAllowed:false,semanticReadabilityRequiredForQualification:true,
      missingTrustedSemanticCriterionResult:"unverified_not_qualified",singleFactorCausalClaimAllowed:false};
    assert.deepEqual(pkg.inputs.qualityComparisonPlan,quality);
    assert.deepEqual(pkg.config.qualityComparisonPlan,quality);
    assert.deepEqual(result.qualityComparisonPlan,quality);
    assert.deepEqual(pkg.config.objectivePlan,pkg.inputs.objectivePlan);
    assert.deepEqual(result.objectivePlan,pkg.inputs.objectivePlan);
    const update=pkg.inputs.updatePlan;
    assert.deepEqual(pkg.config.updatePlan,update); assert.deepEqual(result.updatePlan,update);
    assert.deepEqual(update,{
      candidateId:"stage4_mvp_v24_object_head_core_priority_training_candidate_v3",
      experimentType:"object_head_core_priority_train_only",
      program:bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24.py"),
      tests:bind("ml/ai-painter/tests/test_object_head_core_priority_update_v24.py"),
      cpuReference:bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24_cpu.py"),
      cpuReferenceTests:bind("ml/ai-painter/tests/test_object_head_core_priority_update_v24_cpu.py"),
      cpuReferenceEvidence:bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/result.json"),
      cpuReferenceAcceptance:bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/controller-acceptance.json"),
      cpuReferenceFormalSpecification:{...bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/frozen-formal-spec-1.25.md"),version:"AI-PAINTER-SPEC-1.25",section:"9.6.9"},
      numericDiagnosisTask:bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/task.json"),
      numericDiagnosisEvidence:bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/result.json"),
      numericRepairEvidence:bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/repair-result.json"),
      numericControllerAcceptance:bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/controller-acceptance.json"),
      numericFormalSpecificationSnapshot:{...bind(".runtime/ai-painter/stage4-mvp-v24-gpu-numeric-diagnosis/frozen-formal-spec-1.27.md"),version:"AI-PAINTER-SPEC-1.27",section:"9.6.11"},
      currentFormalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.31",section:"9.6.15"},
      formula:"per_actual_object_rgb_head_remove_only_negative_other_component",
      actualTotalIndependentFullModelGradient:true,auxiliaryGradientsActualHeadParametersOnly:true,
      objectHeadParameterTensorCount:16,objectHeadParameterElementCount:4876,
      nonHeadParameterTensorCount:90,lossAndCoefficientsChanged:false,
      historicalCheckpointLoaded:false,qualificationGranted:false});
    const integration=pkg.inputs.integrationPlan;
    assert.deepEqual(pkg.config.integrationPlan,integration); assert.deepEqual(result.integrationPlan,integration);
    assert.deepEqual(integration,{controller:bind("scripts/run-ai-painter-learning-capacity-experiment.mjs"),
      worker:bind("ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"),
      workerTests:bind("ml/ai-painter/tests/test_stage4_v24_object_head_core_priority_probe.py"),
      exposureWorker:bind("ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py"),
      controllerTests:bind("scripts/tests/test-ai-painter-v24-critic-mode-controller.mjs"),
      historicalControllerTests:bind("scripts/tests/test-ai-painter-v24-core-priority-controller.mjs"),
      diagnosticProgram:bind(".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu/diagnose-v24-critic-mode-integration-cpu.py"),
      diagnosticTests:bind(".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu/test-diagnose-v24-critic-mode-integration-cpu.py"),
      originalEvidence:bind(".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu/result.json"),
      originalControllerAcceptance:bind(".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu/controller-acceptance.json"),
      predecessorCheckerResult:bind(".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu/checker-binding-result.json"),
      predecessorCheckerControllerAcceptance:bind(".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu/checker-binding-acceptance.json"),
      checkerProgram:bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/rebind-v24-resource-evidence.py"),
      checkerTests:bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/test-rebind-v24-resource-evidence.py"),
      checkerResult:integration.checkerResult,
      checkerControllerAcceptance:integration.checkerControllerAcceptance,
      frozenSourceSnapshots:{formalSpecification:bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/frozen-formal-spec-1.30.md"),
        controller:bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/frozen-controller-1.30.mjs"),
        controllerTests:bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/frozen-controller-tests-1.30.mjs"),
        worker:bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/frozen-profile-1.30.py"),
        workerTests:bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/frozen-profile-tests-1.30.py"),
        exposureWorker:bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/frozen-exposure-worker-1.30.py")},
      formalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.31",section:"9.6.15"},
      historicalFormalSpecificationSnapshot:{...bind(".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu/frozen-formal-spec-1.30.md"),version:"AI-PAINTER-SPEC-1.30",section:"9.6.14",historicalEvidenceOnly:true},
      predecessorFormalSpecificationSnapshot:{...bind(".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu/frozen-formal-spec-1.28.md"),version:"AI-PAINTER-SPEC-1.28",section:"9.6.12",historicalEvidenceOnly:true},
      criticStatePlan,resourceRevisionPlan:{predecessorMaxWallSeconds:1800,maxWallSeconds:2700,
        onlyChangedResourceField:"maxWallSeconds",predecessorRunStatus:"experiment_failed_closed",
        predecessorFailureCode:"ValueError('free VRAM below floor')",
        predecessorOptimizerSteps:{generator:1945,discriminator:1946},oldWeightsReusable:false},
      gpuQualified:false,trainingAllowed:false});
    assert.deepEqual(integration.checkerResult,bindExact(integration.checkerResult.path));
    assert.deepEqual(integration.checkerControllerAcceptance,bindExact(integration.checkerControllerAcceptance.path));
    const predecessorChecker=readJson(integration.predecessorCheckerResult.path);
    const predecessorAcceptance=readJson(integration.predecessorCheckerControllerAcceptance.path);
    assert.equal(predecessorChecker.status,"v24_checker_binding_recomputed_no_model_execution");
    assert.equal(predecessorChecker.candidateId,update.candidateId);
    assert.equal(predecessorChecker.actualExecutionCounts.trainingRuns,0);
    assert.equal(predecessorAcceptance.status,
      "v24_checker_binding_independently_verified_not_gpu_or_training_qualified");
    assert.deepEqual(predecessorAcceptance.sourceResult,integration.predecessorCheckerResult);
    assert.deepEqual(predecessorAcceptance.qualification,
      {gpu:false,training:false,visual:false,stage4Advanced:false});
    const checker=readJson(integration.checkerResult.path);
    const checkerAcceptance=readJson(integration.checkerControllerAcceptance.path);
    const currentProgramBindings=[integration.controller,integration.worker,integration.workerTests,
      integration.controllerTests,integration.exposureWorker,integration.checkerProgram,
      integration.checkerTests,integration.formalSpecification]
      .map(({path,sha256})=>({path,sha256}));
    assert.equal(checker.schemaVersion,"ai-painter-v24-resource-binding-result-v1");
    assert.equal(checker.status,"v24_resource_binding_recomputed_no_model_execution");
    assert.equal(checker.candidateId,update.candidateId);
    assert.deepEqual(checker.currentProgramBindings,currentProgramBindings);
    assert.deepEqual(checker.historicalSnapshots,integration.frozenSourceSnapshots);
    assert.deepEqual(checker.predecessorCheckerResult,integration.predecessorCheckerResult);
    assert.deepEqual(checker.predecessorCheckerAcceptance,
      integration.predecessorCheckerControllerAcceptance);
    assert.deepEqual(checker.resourceRevisionPlan,integration.resourceRevisionPlan);
    assert.deepEqual(checker.protectedFacts,{trainingAlgorithmAstIdentical:true,
      updateSourceSha256:"b8c0e84732d4911a667c41c27bf927b65bff4ae1a78f7a5644e599c193dacab0",
      changedExposureWorkerChecks:3});
    assert.deepEqual(checker.actualExecutionCounts,{modelForwards:0,autogradGradCalls:0,
      backwardCalls:0,optimizerSteps:0,decodes:0,gpuQueries:0,checkpointReads:0,
      checkpointWrites:0,pngWrites:0,trainingRuns:0});
    assert.deepEqual(checker.boundary,{modelImported:false,modelExecuted:false,gpuQueried:false,
      trainingStarted:false,registryWritten:false,policyWritten:false,packagePrepared:false});
    assert.equal(checkerAcceptance.schemaVersion,
      "ai-painter-v24-resource-binding-controller-acceptance-v1");
    assert.equal(checkerAcceptance.status,
      "v24_resource_binding_independently_verified_not_gpu_or_training_qualified");
    assert.equal(checkerAcceptance.candidateId,update.candidateId);
    assert.deepEqual(checkerAcceptance.sourceResult,integration.checkerResult);
    assert.deepEqual(checkerAcceptance.verifiedCurrentProgramBindings,currentProgramBindings);
    assert.deepEqual(checkerAcceptance.verifiedHistoricalSnapshots,integration.frozenSourceSnapshots);
    assert.deepEqual(checkerAcceptance.verifiedResourceRevisionPlan,
      integration.resourceRevisionPlan);
    assert.deepEqual(checkerAcceptance.qualification,
      {gpu:false,training:false,visual:false,stage4Advanced:false});
    assert.equal(pkg.inputs.modelPlan.historicalCheckpointLoaded,false);
    assert.equal(pkg.inputs.dataPlan.selectedRowCount,48);
    assert.equal(pkg.inputs.dataPlan.generatorOptimizerSteps,2304);
    assert.equal(pkg.inputs.dataPlan.discriminatorOptimizerSteps,2304);
    assert.equal(pkg.inputs.dataPlan.holdoutUsed,false);
    assert.equal(pkg.inputs.dataPlan.automaticRetries,0);
    const proofs=result.artifacts.filter(item=>item.path===`${pkg.outputRoot}/zero-update-gpu-probe.json`);
    assert.equal(proofs.length,1); const proof=readProof(proofs[0]);
    assert.equal(proof.passed,true); assert.equal(proof.caseCount,48); assert.equal(proof.cases.length,48);
    assert.equal(proof.optimizerCreated,false); assert.deepEqual(proof.optimizerSteps,{generator:0,discriminator:0});
    for(const [index,entry] of proof.cases.entries()) {
      assert.equal(entry.case.sampleId,pkg.selectedRows[index].sampleId);
      assert.equal(entry.case.trainOrdinal,index); assert.equal(entry.case.split,"train");
      assert.deepEqual(entry.initialStateSha256,entry.finalStateSha256);
      assert.equal(entry.candidateId,update.candidateId);
      assert.deepEqual(entry.precisionExecutionPlan,precision);
      assert.deepEqual(entry.criticStatePlan,criticStatePlan);
      const generator=entry.generatorCandidate;
      assert.equal(generator.autogradGradCalls,4);
      assert.equal(generator.actualTotalIndependentFullModelGradient,true);
      assert.equal(generator.cpuReferenceExact,true);
      assert.equal(generator.fullModelAuxiliaryGradientsCopiedToCpu,false);
      assert.equal(generator.nonHeadActualTotalIdentityPreserved,true);
      assert.equal(generator.nonConflictHeadActualTotalBytesPreserved,true);
      assert.equal(generator.parameterIdentity.modelParameterTensorCount,106);
      assert.equal(generator.parameterIdentity.modelParameterElementCount,2239519);
      assert.equal(generator.parameterIdentity.objectHeadParameterTensorCount,16);
      assert.equal(generator.parameterIdentity.objectHeadParameterElementCount,4876);
      assert.equal(generator.parameterIdentity.uniqueParameterIdentities,true);
      assert.equal(generator.parameterIdentity.uniqueParameterStorages,true);
      assert(generator.generatorGradientFacts.nonzeroTensorCount>0);
      assert(generator.generatorGradientFacts.nonzeroElementCount>0);
      assert.equal(generator.generatorGradientFacts.allFinite,true);
      assert.deepEqual(Object.keys(generator.headDiagnostics),["object_footprints","object_tree","object_rock","object_vegetation"]);
      for(const facts of Object.values(generator.headDiagnostics))
        assert(["core_zero_preserve_actual_total","non_conflict_preserve_actual_total","conflict_projected"].includes(facts.branch));
      assert(entry.discriminatorGradientFacts.nonzeroTensorCount>0);
      assert(entry.discriminatorGradientFacts.nonzeroElementCount>0);
      assert.equal(entry.discriminatorGradientFacts.allFinite,true);
      assert.equal(entry.criticFrozenDuringGenerator,true);
      assert.equal(entry.criticGradientLeakDuringGenerator,false);
      assert.equal(entry.generatorGradientLeakDuringDiscriminator,false);
      assert.equal(entry.targetAndConditionsDetached,true);
      assert.equal(entry.sourceTensorsUnchanged,true);
      assert.equal(entry.rngRestored,true); assert.equal(entry.gradFieldsCleared,true);
      assert.match(entry.conditionTensorSha256,/^[a-f0-9]{64}$/u);
      assert.equal(entry.objectiveId,pkg.inputs.objectivePlan.candidateId);
      const terms=entry.objectiveTerms;
      for(const key of ["v21UnchangedTotal","wholeFrameFidelity","objectCoreRgbWeighted","total"])
        assert(Number.isFinite(terms[key]));
      const expectedTotal=terms.v21UnchangedTotal+terms.wholeFrameFidelity+terms.objectCoreRgbWeighted;
      assert(Math.abs(terms.total-expectedTotal)<=Math.max(1e-6,1e-5*Math.abs(expectedTotal)));
      const ownership=entry.ownershipFacts;
      assert.equal(ownership.ownershipRule,representation.ownershipRule);
      assert.equal(ownership.supportUnionMismatchPixels,0); assert.equal(ownership.ownerOverlapPixels,0);
      assert.equal(ownership.ownedUnionPixels,ownership.typedSupportUnionPixels);
      assert.deepEqual(Object.keys(ownership.roles),representation.typedRoles);
      let owned=0;
      for(const role of representation.typedRoles) {
        const row=ownership.roles[role];
        assert(Number.isSafeInteger(row.corePixels)&&row.corePixels>=0);
        assert(Number.isSafeInteger(row.coveragePixels)&&row.coveragePixels>=0);
        assert(Number.isSafeInteger(row.ownedPixels)&&row.ownedPixels>=0);
        assert(row.corePixels<=row.ownedPixels&&row.ownedPixels<=row.coveragePixels);
        assert.equal(row.coreOwnershipMissingPixels,0); assert.equal(row.ownerOutsideCoveragePixels,0);
        assert.match(row.ownerMaskSha256,/^[a-f0-9]{64}$/u); owned+=row.ownedPixels;
      }
      assert.equal(owned,ownership.ownedUnionPixels);
    }
    return true;
  } catch { return false; }
}
export function wholeFrameObjectiveValid(result, pkg, readProof = binding => {
  assert.deepEqual(binding, bind(binding.path)); return read(binding.path);
}) {
  try {
    const plan = pkg?.inputs?.objectivePlan;
    assert.equal(pkg?.policy?.path, wholeFrameFidelityPolicy);
    assert.deepEqual(pkg.inputs.heartbeatPublicationRule, heartbeatPublicationRule);
    assert.deepEqual(result.heartbeatPublicationRule, heartbeatPublicationRule);
    assert.equal(plan?.candidateId, "stage4_mvp_v21_whole_frame_fidelity_cpu_candidate_v1");
    assert.equal(plan.rgbWeight, 1); assert.equal(plan.edgeWeight, .25);
    assert.equal(plan.formula, "unchanged_v21_total_plus_full_rgb_l1_plus_signed_adjacent_edge_l1");
    assert.equal(plan.coefficientSelection, "fixed_inherited_v13_coefficients_no_search");
    assert.equal(plan.targetSplit, "train"); assert.equal(plan.existingTermsPreserved, true);
    assert.equal(plan.qualificationGranted, false);
    assert.deepEqual(plan.program, bind("ml/ai-painter/src/ai_painter/complete_world/native_rgb_whole_frame_fidelity_candidate_cpu.py"));
    assert.deepEqual(plan.tests, bind("ml/ai-painter/tests/test_native_rgb_whole_frame_fidelity_candidate_cpu.py"));
    assert.equal(plan.cpuEvidence.path, ".runtime/ai-painter/learning-capacity-experiments/v21-full-train-exposure-5464211239b5f3b53e0a2675c9fe5f7e208c21ab7bbb6ed6/controller-whole-frame-fidelity-cpu-candidate.json");
    assert.deepEqual(plan.cpuEvidence, bind(plan.cpuEvidence.path));
    assert.deepEqual(result.objectivePlan, plan);
    assert.equal(result.historicalComparisonPurpose, "changed_loss_comparison_not_numerical_reproduction");
    assert.equal(plan.historicalComparisonPurpose, result.historicalComparisonPurpose);
    assert.equal(result.zeroUpdateGpuProbePassed, true);
    const proofPath = `${pkg.outputRoot}/zero-update-gpu-probe.json`;
    const proofs = result.artifacts.filter(item => item.path === proofPath);
    assert.equal(proofs.length, 1);
    const proof = readProof(proofs[0]);
    assert.equal(proof.passed, true); assert.equal(proof.caseCount, 48);
    assert.equal(proof.optimizerCreated, false);
    assert.deepEqual(proof.optimizerSteps, { generator: 0, discriminator: 0 });
    assert.equal(proof.cases.length, 48);
    for (const [index, entry] of proof.cases.entries()) {
      assert.equal(entry.objectiveId, plan.candidateId);
      assert.equal(entry.passed, true); assert.equal(entry.optimizerCreated, false);
      assert.deepEqual(entry.optimizerSteps, proof.optimizerSteps);
      assert.deepEqual(entry.initialStateSha256, entry.finalStateSha256);
      for (const key of ["Model", "Critic"]) assert.match(entry.initialStateSha256[key], /^[a-f0-9]{64}$/u);
      assert.equal(entry.case.sampleId, pkg.selectedRows[index].sampleId);
      assert.equal(entry.case.trainOrdinal, index); assert.equal(entry.case.split, "train");
      for (const key of ["v21UnchangedTotal", "wholeFrameRgbMae", "wholeFrameSignedEdgeMae", "wholeFrameFidelity"])
        assert(Number.isFinite(entry.objectiveTerms[key]));
    }
    return true;
  } catch { return false; }
}
export const progressPublicationRule = Object.freeze({ schemaVersion: "bounded_windows_progress_publication_v1",
  maxReplaceAttempts: 6, retryDelaySeconds: .05, retryableWindowsErrors: [5, 32, 33],
  sameStagedBytesOnly: true, persistentFailureAction: "fail_closed" });
export function exposureProgressPublicationValid(pkg) {
  try { assert.deepEqual(pkg?.inputs?.progressPublicationRule, progressPublicationRule); return true; }
  catch { return false; }
}
const env = { ...process.env, PYTHONPATH: [path.join(root, "ml/ai-painter/src"), path.join(root, "ml/ai-painter/scripts")].join(path.delimiter), PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1", CUBLAS_WORKSPACE_CONFIG: ":4096:8" };
const sha = data => createHash("sha256").update(data).digest("hex");
const bind = logical => ({ path: logical, sha256: sha(fs.readFileSync(path.join(root, logical))) });
const read = logical => JSON.parse(fs.readFileSync(path.join(root, logical), "utf8"));
export function readonlyTrainFitSucceeded(result, pkg, exitCode, timedOut = false) {
  if (exitCode !== 0 || timedOut || !result || !pkg) return false;
  if (result.status !== "readonly_train_fit_diagnostic_completed_no_qualification"
    || result.trainingStarted !== false || result.optimizerCreated !== false
    || result.optimizerSteps?.generator !== 0 || result.optimizerSteps?.discriminator !== 0
    || result.forwardCalls !== 48 || result.checkpointWritten !== false
    || result.modelStateUnchanged !== true || result.sourceBytesUnchanged !== true
    || result.experimentIdentity !== pkg.experimentIdentity
    || !Array.isArray(result.artifacts)
    || !Array.isArray(result.samples) || result.samples.length !== 48
    || !Array.isArray(pkg.selectedRows) || pkg.selectedRows.length !== 48) return false;
  const ids = new Set();
  return result.samples.every((row, ordinal) => {
    const expected = pkg.selectedRows[ordinal];
    if (!row || !expected || typeof expected.sampleId !== "string" || ids.has(expected.sampleId)) return false;
    ids.add(expected.sampleId);
    return expected.split === "train" && expected.trainOrdinal === ordinal
      && row.sampleId === expected.sampleId && row.split === "train" && row.trainOrdinal === ordinal;
  });
}
export function exposureTelemetryFromProgress(progress, runId, normalize, lastStep = 0) {
  assert.equal(progress?.experimentIdentity, runId, "exposure_progress_run_mismatch");
  if (progress.trainingStarted !== true || progress.trainingProgress == null) return null;
  const generator = progress.optimizerSteps?.generator;
  const discriminator = progress.optimizerSteps?.discriminator;
  assert(Number.isSafeInteger(generator) && generator >= lastStep && generator <= 2304
    && Number.isSafeInteger(discriminator) && discriminator >= generator && discriminator <= generator + 1 && discriminator <= 2304,
  "exposure_progress_update_count_invalid");
  const normalized = normalize(progress.trainingProgress);
  assert(normalized.epoch >= 1 && normalized.epoch <= 48 && normalized.batchCount === 48
    && normalized.optimizationStep === generator, "exposure_progress_training_fields_invalid");
  return normalized;
}
export function exposureComparisonDiagnosticValid(result, pkg) {
  const report = result?.epoch24Reproduction;
  const rule = pkg?.inputs?.reproductionRule;
  if (![v21FullTrainExposurePolicy, wholeFrameFidelityPolicy, objectCoreFidelityPolicy, v23CompleteSupportPartitionPolicy, v24ObjectHeadCorePriorityPolicy, v24IeeeObjectHeadCorePriorityPolicy, v24ResourceBoundObjectHeadCorePriorityPolicy].includes(pkg?.policy?.path) || !report || !rule
    || result.epoch24ReproductionEvidenceValid !== true || report.evidenceValid !== true
    || typeof result.epoch24ReproductionPassed !== "boolean" || report.passed !== result.epoch24ReproductionPassed
    || rule.epoch !== 24 || rule.maximumAbsoluteMedianCorrelationDifferenceEachRole !== .03
    || rule.maximumRelativeMeanRgbMaeDifference !== .05 || rule.all48CorrelationsRequiredEachRole !== true
    || rule.failureAction !== "diagnostic_only_no_early_stop" || rule.invalidEvidenceAction !== "fail_closed"
    || rule.formalAuditThreshold !== false || !report.rule
    || Object.keys(rule).length !== Object.keys(report.rule).length
    || !Object.keys(rule).every(key => rule[key] === report.rule[key])) return false;
  let insideTolerance = true;
  for (const role of ["object_footprints", "object_tree", "object_rock", "object_vegetation"]) {
    const left = report.actual?.objects?.[role], right = report.reference?.objects?.[role];
    const difference = report.medianCorrelationAbsoluteDifferences?.[role];
    if (left?.validCorrelationCount !== 48 || right?.validCorrelationCount !== 48
      || !Number.isFinite(left.medianCorrelation) || !Number.isFinite(right.medianCorrelation)
      || Math.abs(left.medianCorrelation) > 1 || Math.abs(right.medianCorrelation) > 1
      || !Number.isFinite(difference) || difference < 0
      || Math.abs(difference - Math.abs(left.medianCorrelation - right.medianCorrelation)) > 1e-12) return false;
    insideTolerance &&= difference <= .03;
  }
  const actual = report.actual?.meanRgbMae, reference = report.reference?.meanRgbMae;
  if (!Number.isFinite(actual) || !Number.isFinite(reference) || actual < 0 || reference < 0) return false;
  const relative = reference > 0 ? Math.abs(actual - reference) / reference : actual === 0 ? 0 : null;
  if (relative === null || !Number.isFinite(report.meanRgbMaeRelativeDifference)
    || Math.abs(report.meanRgbMaeRelativeDifference - relative) > 1e-12) return false;
  return report.passed === (insideTolerance && relative <= .05);
}
export function fullTrainExposureSucceeded(result, pkg, exitCode, timedOut = false) {
  if (exitCode !== 0 || timedOut || !result || !pkg
    || result.schemaVersion !== "ai-painter-learning-capacity-experiment-result-v1"
    || pkg.schemaVersion !== "ai-painter-learning-capacity-experiment-package-v1"
    || result.evidenceContractVersion !== 1 || pkg.evidenceContractVersion !== 1
    || !["all_train_exposure_only", "whole_frame_fidelity_train_only", "object_core_fidelity_train_only", "complete_support_partition_train_only", "object_head_core_priority_train_only"].includes(result.experimentType) || pkg.experimentType !== result.experimentType
    || result.status !== "experiment_executed_not_visual_qualified" || result.experimentIdentity !== pkg.experimentIdentity
    || result.trainingStarted !== true || result.completedEpochs !== 48 || result.sourceBytesUnchanged !== true
    || result.optimizerSteps?.generator !== 2304 || result.optimizerSteps?.discriminator !== 2304
    || result.checkpointReloadExact !== true || !Array.isArray(result.artifacts)
    || !Array.isArray(pkg.selectedRows) || pkg.selectedRows.length !== 48
    || !Array.isArray(pkg.observationPlan) || pkg.observationPlan.length !== 3
    || !Array.isArray(result.trainOnlyObservations) || result.trainOnlyObservations.length !== 144
    || !Array.isArray(pkg.imagePlan) || pkg.imagePlan.length !== 4
    || !Array.isArray(result.imageArtifacts) || result.imageArtifacts.length !== 4
    || !exposureComparisonDiagnosticValid(result, pkg) || !exposureProgressPublicationValid(pkg)) return false;
  if (result.experimentType === "object_head_core_priority_train_only"
      ? !(pkg.policy.path === v24ResourceBoundObjectHeadCorePriorityPolicy
        ? v24CriticModeObjectHeadCorePriorityValid(result,pkg)
        : pkg.policy.path === v24IeeeObjectHeadCorePriorityPolicy
          ? v24IeeeObjectHeadCorePriorityValid(result,pkg) : v24ObjectHeadCorePriorityValid(result,pkg))
    : result.experimentType === "complete_support_partition_train_only" ? !v23CompleteSupportPartitionValid(result, pkg)
    : result.experimentType === "object_core_fidelity_train_only" ? !objectCoreObjectiveValid(result, pkg)
    : result.experimentType === "whole_frame_fidelity_train_only" ? !wholeFrameObjectiveValid(result, pkg)
    : pkg.policy.path !== v21FullTrainExposurePolicy) return false;
  for (const key of ["stage4QualificationGranted", "checkpointPromotable", "validationContentRead", "challengeContentRead", "regressionContentRead"])
    if (result[key] !== false) return false;
  const expectedPoints = [[0, 0], [24, 1152], [48, 2304]];
  if (!pkg.observationPlan.every((p, i) => p?.epoch === expectedPoints[i][0] && p.optimizerStep === expectedPoints[i][1])) return false;
  const selected = new Map();
  for (const [ordinal, row] of pkg.selectedRows.entries()) {
    if (!row || typeof row.sampleId !== "string" || row.split !== "train" || row.trainOrdinal !== ordinal || selected.has(row.sampleId)) return false;
    selected.set(row.sampleId, row);
  }
  const seen = new Set();
  for (const row of result.trainOnlyObservations) {
    if (!row || !selected.has(row.sampleId) || row.split !== "train"
      || !expectedPoints.some(([epoch, step]) => row.epoch === epoch && row.optimizerStep === step)
      || !row.measurements || typeof row.measurements !== "object" || Array.isArray(row.measurements)) return false;
    const key = `${row.epoch}:${row.optimizerStep}:${row.sampleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  const expectedImages = new Set([0, 43].flatMap(ordinal => ["prediction", "target_final_comparison"].map(purpose => `${pkg.selectedRows[ordinal].sampleId}:${purpose}`)));
  const imageKey = row => row?.split === "train" && row.epoch === 48 && row.optimizerStep === 2304 ? `${row.sampleId}:${row.purpose}` : null;
  const planned = pkg.imagePlan.map(imageKey), actual = result.imageArtifacts.map(imageKey);
  const artifacts = new Map();
  for (const item of result.artifacts) {
    if (typeof item?.path !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || artifacts.has(item.path)) return false;
    artifacts.set(item.path, item.sha256);
  }
  if (!result.checkpoint || artifacts.get(result.checkpoint.path) !== result.checkpoint.sha256) return false;
  if (!result.imageArtifacts.every(image => typeof image?.path === "string"
    && /\.(png|jpe?g)$/iu.test(image.path) && artifacts.get(image.path) === image.sha256
    && typeof image.sourceLabel === "string" && image.sourceLabel.trim().length > 0)) return false;
  return planned.every(key => expectedImages.has(key)) && new Set(planned).size === 4
    && actual.every(key => expectedImages.has(key)) && new Set(actual).size === 4;
}
export async function drainExperimentTelemetry(task, timeoutMs = 15000) {
  let timer;
  try {
    return await Promise.race([Promise.resolve(task).then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); })]);
  } finally { clearTimeout(timer); }
}
export function experimentWorkerTimeoutMs(resources, fullTrainExposure = false) {
  assert(Number.isSafeInteger(resources?.maxWallSeconds) && resources.maxWallSeconds > 0);
  return (resources.maxWallSeconds + (fullTrainExposure ? 0 : 30)) * 1000;
}
export function roadAttributionRemainingMs(startedAtMs, requestedMs, nowMs = performance.now()) {
  assert(Number.isFinite(startedAtMs) && Number.isFinite(nowMs) && nowMs >= startedAtMs, "invalid diagnostic clock");
  assert(Number.isSafeInteger(requestedMs) && requestedMs > 0, "invalid diagnostic timeout");
  const remaining = Math.floor(900000 - (nowMs - startedAtMs));
  assert(remaining > 0, "road attribution controller overall budget exhausted");
  return Math.min(requestedMs, remaining);
}
export function experimentMayUpdateTrainingTerminal(policy, readonlyTrainFit, trainingStarted) {
  return policy !== roadAttributionPolicy && !readonlyTrainFit && trainingStarted === true;
}
export function observedExperimentTermination(result, progress, runId) {
  if (result) {
    assert.equal(result.experimentIdentity, runId, "terminal_result_run_mismatch");
    return { gpuStarted: result.gpuStarted ?? null, trainingStarted: result.trainingStarted ?? null,
      lastConfirmedOptimizerSteps: result.optimizerSteps ?? null, actualFinalOptimizerSteps: result.optimizerSteps ?? null };
  }
  if (progress) assert.equal(progress.experimentIdentity, runId, "terminal_progress_run_mismatch");
  return { gpuStarted: progress?.gpuStarted ?? null, trainingStarted: progress?.trainingStarted ?? null,
    lastConfirmedOptimizerSteps: progress?.optimizerSteps ?? null, actualFinalOptimizerSteps: null };
}
export const heartbeatPublicationRule = Object.freeze({
  maxReplaceAttempts: 21, retryDelayMilliseconds: 100, maxWaitMilliseconds: 2000,
  sameStagedBytesOnly: true, preservePreviousHeartbeat: true, automaticTrainingRetries: 0,
});
export function replaceHeartbeatFile(temporary, target, {
  rename = fs.renameSync,
  pause = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds),
  now = () => performance.now(),
} = {}) {
  // Retry only publication of these exact staged bytes. A bounded sharing
  // violation is not a model retry; permanent errors still fail closed. Keep
  // the old heartbeat readable, and never delete it to force replacement.
  const started = now();
  let lastError;
  let attempts = 0;
  const elapsed = () => Math.max(0, now() - started);
  const fail = error => {
    error.heartbeatPublication = { ...heartbeatPublicationRule, attempts, elapsedMilliseconds: elapsed(),
      temporary, target, errorCode: error.code ?? null };
    throw error;
  };
  while (attempts < heartbeatPublicationRule.maxReplaceAttempts) {
    if (lastError && elapsed() >= heartbeatPublicationRule.maxWaitMilliseconds) fail(lastError);
    attempts += 1;
    try {
      rename(temporary, target);
      return { attempts, elapsedMilliseconds: elapsed(), recovered: attempts > 1 };
    } catch (error) {
      lastError = error;
      const remaining = heartbeatPublicationRule.maxWaitMilliseconds - elapsed();
      if (!["EPERM", "EACCES", "EBUSY"].includes(error.code)
        || attempts >= heartbeatPublicationRule.maxReplaceAttempts || remaining <= 0) fail(error);
      pause(Math.min(heartbeatPublicationRule.retryDelayMilliseconds, remaining));
    }
  }
}
export function guardedHeartbeat(heartbeat, onFailure) {
  try { heartbeat(); return true; }
  catch (error) { onFailure(error); return false; }
}
function write(logical, value, mutable = false) {
  const target = path.join(root, logical);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = mutable ? target + ".tmp" : target;
  const fd = fs.openSync(temporary, mutable ? "w" : "wx");
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  if (mutable) {
    const publication = replaceHeartbeatFile(temporary, target);
    if (publication.recovered) console.warn(JSON.stringify({ event: "heartbeat_publication_recovered",
      path: logical, ...publication, recordedAtUtc: new Date().toISOString() }));
  }
}
function runCpu(args, timeout = 120000) {
  const result = spawnSync(python, args, { cwd: root, env, encoding: "utf8", windowsHide: true, timeout, maxBuffer: 2 ** 22 });
  if (result.error || result.status !== 0) throw new Error(`CPU operation failed: ${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`);
  return result;
}
function processIdentity() {
  const script = `$p=Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${process.pid}'; [pscustomobject]@{ processId=[int]$p.ProcessId; creationDate=$p.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  assert.equal(result.status, 0, "controller process identity unavailable");
  const value = JSON.parse(result.stdout.replace(/^\uFEFF/u, ""));
  return `${process.pid}:${value.creationDate}`;
}
export function ownedWorkerIsRunning(child) {
  return Boolean(child && child.exitCode === null && child.signalCode === null && Number.isInteger(child.pid) && child.pid > 0);
}
function stopOwnedWorker(child) {
  if (!ownedWorkerIsRunning(child)) return;
  if (process.platform === "win32") {
    // The venv redirector owns the real interpreter. Stop only this spawned tree.
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 10000, encoding: "utf8" });
  } else child.kill("SIGTERM");
}

async function main() {
  const mode = process.argv[2];
  if (mode === "run-replay-retention-comparison") {
    assert.equal(process.argv.length, 3);
    const { runReplayRetentionComparison } = await import("./lib/ai-painter-replay-retention-sequence-v1.mjs");
    await runReplayRetentionComparison(root);
    return;
  }
  if (mode === "review-completed") {
    assert.equal(process.argv.length, 3, "review-completed accepts only the registered exact post-review policy");
    const { runTwoMapPostReview } = await import("./lib/ai-painter-two-map-post-review-v1.mjs");
    const { deliverPostReviewRecords, reviewThenDeliver } = await import("./lib/ai-painter-post-review-delivery-v1.mjs");
    await reviewThenDeliver(() => runTwoMapPostReview({ projectRoot: root }),
      () => deliverPostReviewRecords({ projectRoot: root }),
      delivery => console.log(JSON.stringify({ postReviewWorkDelivery: delivery })));
    return;
  }
  if (mode === "run-stem-decoder-comparison") { assert.equal(process.argv.length,3); const {runStemDecoderComparison}=await import("./lib/ai-painter-stem-pair-comparison-v1.mjs"); await runStemDecoderComparison(root); return; }
  if (mode === "run-stem-pair-comparison") { assert.equal(process.argv.length,3); const {runStemPairComparison}=await import("./lib/ai-painter-stem-pair-comparison-v1.mjs"); await runStemPairComparison(root); return; }
  if (mode === "run-routing-comparison") { await runTerrainRoutingComparison(root); return; }
  assert(["prepare", "run"].includes(mode), "usage: node scripts/run-ai-painter-learning-capacity-experiment.mjs prepare|run [--policy path]");
  const policy = process.argv[3] === "--policy" && process.argv.length === 5 ? process.argv[4] : null;
  assert(process.argv.length === 3 || policy !== null, "invalid experiment arguments");
  assert(policy !== consumedV21TrainOnlyPolicy, "V21 train-only v1 identity failed closed; use only the bound v2 replacement policy");
  assert(![consumedV21FullTrainExposurePolicy, consumedV21FullTrainExposurePolicyV2].includes(policy), "full exposure v1/v2 were consumed and failed closed; use only the independently bound v3 policy");
  assert(policy !== consumedWholeFrameFidelityPolicy, "whole-frame fidelity v1 was consumed and failed closed; use only the independently bound v2 policy");
  assert(policy !== v24ObjectHeadCorePriorityPolicy, "V24 core-priority v1 was consumed and failed closed; use only the bound IEEE FP32 v2 policy");
  assert(policy !== v24IeeeObjectHeadCorePriorityPolicy, "V24 IEEE FP32 v2 was consumed and failed closed; use only the bound critic-mode v3 policy");
  assert(policy !== v24CriticModeObjectHeadCorePriorityPolicy, "V24 critic-mode v3 checker binding failed closed; use only a future independently accepted v4 policy");
  assert(policy !== v24CheckerBoundObjectHeadCorePriorityPolicy, "V24 checker-bound v4 was consumed and failed closed; use only the resource-bound v5 policy");
  const policyArgs = policy === null ? [] : ["--policy", policy];
  assert(policy !== consumedBackgroundPolicy, "background v1 failed closed before optimization; use independently bound v2");
  assert(policy !== twoMapCheckpointPolicy, "two-map v1 already failed closed; use independently bound v2 after resource clearing");
  const reconstruction = policy === reconstructionPolicy;
  const replay = Object.values(replayPolicies).includes(policy);
  const roadAttribution = policy === roadAttributionPolicy;
  const diagnosticStartedAtUtc = roadAttribution ? new Date().toISOString() : null;
  const diagnosticStartedMono = roadAttribution ? process.hrtime.bigint() : null;
  const diagnosticWindowStartMs = roadAttribution ? performance.now() : null;
  const boundedTimeout = requestedMs => roadAttribution
    ? roadAttributionRemainingMs(diagnosticWindowStartMs, requestedMs) : requestedMs;
  const single149 = policy === single149Policy;
  assert(policy !== consumedSingle149Policy, "single149 v1 failed closed before updates; use only independently bound source-closure v2");
  const singleMap = single149 || policy === singleMapCheckpointPolicy || policy === singleMapCheckpointSuccessorPolicy;
  const twoMap = policy === twoMapCheckpointSuccessorPolicy;
  const routing = routingPolicies.includes(policy);
  const background = policy === backgroundPolicy;
  assert(![rehearsalPolicy,supportWeight1Policy,...Object.values(stemPolicies),...Object.values(stemPairPolicies),...Object.values(stemDecoderPolicies)].includes(policy), "old mixed arms consumed; independently bound terrain ecology candidate required");
  const rehearsal = policy === terrainEcologyPolicy;
  assert(policy!==causalProbePolicy,"consumed target0 diagnostic is evidence only");
  const causalProbe = policy === target44CausalProbePolicy;
  const v11TrainOnly = policy === v11TrainOnlyPolicy;
  const v21TrainOnly = policy === v21TrainOnlyPolicy;
  const readonlyTrainFit = policy === v21AllTrainFitPolicy;
  const wholeFrameFidelity = policy === wholeFrameFidelityPolicy;
  const objectCoreFidelity = policy === objectCoreFidelityPolicy;
  const v23CompleteSupportPartition = policy === v23CompleteSupportPartitionPolicy;
  const v24ObjectHeadCorePriority = policy === v24ObjectHeadCorePriorityPolicy;
  const v24IeeeObjectHeadCorePriority = policy === v24IeeeObjectHeadCorePriorityPolicy;
  const v24CriticModeObjectHeadCorePriority = policy === v24ResourceBoundObjectHeadCorePriorityPolicy;
  const fullTrainExposure = policy === v21FullTrainExposurePolicy || wholeFrameFidelity || objectCoreFidelity || v23CompleteSupportPartition || v24ObjectHeadCorePriority || v24IeeeObjectHeadCorePriority || v24CriticModeObjectHeadCorePriority;
  const taskKind = (roadAttribution || causalProbe) ? "readonly_zero_update_causal_diagnostic" : readonlyTrainFit ? "readonly_train_fit_diagnostic" : "bounded_train_only_learning_capacity_experiment";
  const taskGoal = readonlyTrainFit ? "48 train originals, frozen epoch-24 forward only; no weight updates or qualification"
    : roadAttribution ? "Eight fixed parent/D train cases, zero-update road attribution; no training or qualification"
    : causalProbe ? "One new zero-update GPU call on train157; parameter44 local evidence; no training or qualification"
    : replay ? "Same completed parent: fixed replay or short single149 arm, then 56-image retention review; no formal release"
    : rehearsal ? "Original 48 train maps plus declared anchor rehearsal;448 pairs; no formal release"
    : background ? "Two verified train rocks: explicit auxiliary background hypothesis;100 pairs; no formal release"
    : routing ? "Equal-budget object-support terrain-gradient comparison arm;100 pairs; no formal release"
    : twoMap ? "Two train maps149/164; one shared completed-model continuation;200 total pairs,100 per map; no formal release"
    : single149 ? "One train map149; completed ecology model continuation; own zero-update gate,200 pairs and automatic ten-image review; no formal release"
    : singleMap ? "One train map164; exact policy-bound completed G/D weights with fresh original AdamW; at most200 pairs; no formal release"
    : v24CriticModeObjectHeadCorePriority ? "48 train originals, fresh V23 renderer with V24 resource-bound critic-mode object-head core-priority v5 policy, maximum 48 epochs; no formal release"
    : v24IeeeObjectHeadCorePriority ? "48 train originals, fresh V23 renderer with V24 IEEE-FP32 object-head core-priority v2 update, maximum 48 epochs; no formal release"
    : v24ObjectHeadCorePriority ? "48 train originals, fresh V23 renderer with V24 object-head core-priority update, maximum 48 epochs; no formal release"
    : v23CompleteSupportPartition ? "48 train originals, fresh V23 complete typed-support partition with unchanged object-core objective, maximum 48 epochs; no formal release"
    : objectCoreFidelity ? "48 train originals, fresh V21 with whole-frame plus object-core fidelity, maximum 48 epochs; no formal release"
    : wholeFrameFidelity ? "48 train originals, fresh V21 with isolated whole-frame fidelity, maximum 48 epochs; no formal release"
    : fullTrainExposure ? "48 train originals, fresh V21, maximum 48 epochs; no generalization or formal release"
    : reconstruction ? "256x192 decoder-only train reconstruction; encoder frozen; no Denoiser or formal qualification"
    : "256x192 real training and checkpoint reload experiment; no formal qualification or publication";
  const worker = roadAttribution ? roadAttributionWorker : replay ? replayWorker : causalProbe ? causalProbeWorker : rehearsal ? rehearsalWorker : background ? backgroundWorker : routing ? routingWorker : twoMap ? twoMapWorker : single149 ? single149Worker : singleMap ? "ml/ai-painter/scripts/painter_single_map_checkpoint_fit_v1.py"
    : readonlyTrainFit ? "ml/ai-painter/scripts/diagnose_stage4_mvp_v21_all_train_fit_readonly.py"
    : (v24ObjectHeadCorePriority || v24IeeeObjectHeadCorePriority || v24CriticModeObjectHeadCorePriority) ? "ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"
    : v23CompleteSupportPartition ? "ml/ai-painter/scripts/painter_stage4_v23_complete_support_partition_probe.py"
    : objectCoreFidelity ? "ml/ai-painter/scripts/painter_stage4_v21_object_core_fidelity_probe.py"
    : wholeFrameFidelity ? "ml/ai-painter/scripts/painter_stage4_v21_whole_frame_fidelity_probe.py"
    : fullTrainExposure ? "ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py"
    : v21TrainOnly ? "ml/ai-painter/scripts/painter_stage4_v21_train_only_capacity_probe.py"
    : v11TrainOnly ? "ml/ai-painter/scripts/painter_stage4_v11_train_only_capacity_probe.py"
    : reconstruction ? "ml/ai-painter/scripts/painter_decoder_reconstruction_experiment.py" : defaultWorker;
  const testPattern = roadAttribution ? roadAttributionTests : replay ? replayTests : causalProbe ? causalProbeTests : rehearsal ? rehearsalTests : background ? backgroundTests : routing ? routingTests : twoMap ? twoMapTests : single149 ? single149Tests : singleMap ? "test_single_map_checkpoint_fit_v1.py"
    : readonlyTrainFit ? "test_diagnose_stage4_mvp_v21_all_train_fit_readonly.py"
    : (v24ObjectHeadCorePriority || v24IeeeObjectHeadCorePriority || v24CriticModeObjectHeadCorePriority) ? "test_stage4_v24_object_head_core_priority_probe.py"
    : v23CompleteSupportPartition ? "test_stage4_v23_complete_support_partition_probe.py"
    : objectCoreFidelity ? "test_stage4_v21_object_core_fidelity_probe.py"
    : wholeFrameFidelity ? "test_stage4_v21_whole_frame_fidelity_probe.py"
    : fullTrainExposure ? "test_stage4_v21_full_train_exposure_probe.py"
    : v21TrainOnly ? "test_stage4_v21_train_only_capacity_probe.py"
    : v11TrainOnly ? "test_stage4_v11_train_only_capacity_probe.py"
    : reconstruction ? "test_decoder_reconstruction_experiment.py" : "test_learning_capacity_experiment.py";
  const entry = read("data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json");
  assert(entry.currentEntrypoints.some(e => e.entryFile === "scripts/run-ai-painter-learning-capacity-experiment.mjs"), "experiment controller is not registered");
  const previous = await readCurrentExecutionRegistry(root);
  assert(previous.ok && previous.registry.activeExecution === null, "current registry is invalid or an execution is active");
  const controllerTests = spawnSync(process.execPath, ["--test", "scripts/tests/test-ai-painter-experiment-heartbeat.mjs",
    ...((objectCoreFidelity || v23CompleteSupportPartition || v24ObjectHeadCorePriority || v24IeeeObjectHeadCorePriority || v24CriticModeObjectHeadCorePriority) ? ["scripts/tests/test-ai-painter-object-core-fidelity-controller.mjs"] : []),
    ...((v23CompleteSupportPartition || v24ObjectHeadCorePriority || v24IeeeObjectHeadCorePriority || v24CriticModeObjectHeadCorePriority) ? ["scripts/tests/test-ai-painter-whole-frame-fidelity-controller.mjs",
      "scripts/tests/test-ai-painter-v23-support-partition-controller.mjs"] : []),
    ...((v24ObjectHeadCorePriority || v24IeeeObjectHeadCorePriority || v24CriticModeObjectHeadCorePriority) ? ["scripts/tests/test-ai-painter-v24-core-priority-controller.mjs"] : []),
    ...((v24IeeeObjectHeadCorePriority || v24CriticModeObjectHeadCorePriority) ? ["scripts/tests/test-ai-painter-v24-ieee-core-priority-controller.mjs"] : []),
    ...(v24CriticModeObjectHeadCorePriority ? ["scripts/tests/test-ai-painter-v24-critic-mode-controller.mjs"] : []),
    ...(wholeFrameFidelity ? ["scripts/tests/test-ai-painter-whole-frame-fidelity-controller.mjs"] : []),
    ...((singleMap || twoMap || routing || background || rehearsal || replay) ? ["scripts/tests/test-training-observation-contract.mjs"] : []),
    ...(replay ? ["scripts/tests/test-ai-painter-replay-retention-fit.mjs", "scripts/tests/test-ai-painter-replay-retention-review.mjs", "scripts/tests/test-ai-painter-replay-retention-sequence.mjs"] : []),
    ...(twoMap ? ["scripts/tests/test-ai-painter-two-map-experiment.mjs"] : []),
    ...(single149 ? ["scripts/tests/test-ai-painter-single149-terrain-ecology-fit.mjs","scripts/tests/test-ai-painter-two-map-post-review.mjs"] : []),
    ...(routing ? ["scripts/tests/test-ai-painter-terrain-routing-comparison.mjs"] : []),
    ...(background ? ["scripts/tests/test-ai-painter-rock-background-probe.mjs"] : []),
    ...(rehearsal ? ["scripts/tests/test-ai-painter-mixed-train-rehearsal.mjs","scripts/tests/test-ai-painter-stem-pair-comparison.mjs"] : []),
    ...(roadAttribution ? ["scripts/tests/test-ai-painter-road-attribution-probe.mjs"] : []),
    ...(causalProbe ? ["scripts/tests/test-ai-painter-support-weight1-causal-probe.mjs"] : [])], {
    cwd: root, env, encoding: "utf8", windowsHide: true, timeout: boundedTimeout(20000), maxBuffer: 2 ** 20,
  });
  assert(!controllerTests.error && controllerTests.status === 0, `controller behavior tests failed: ${controllerTests.error?.message ?? ""}\n${controllerTests.stdout}\n${controllerTests.stderr}`);
  const cpu = runCpu(["-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", testPattern, "-v"], boundedTimeout(120000));
  if (replay && policy === replayPolicies["balanced-boundary"]) {
    const boundaryCpu = runCpu(["-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", "test_rock_background_boundary_v1.py", "-v"], boundedTimeout(120000));
    cpu.stdout += boundaryCpu.stdout; cpu.stderr += boundaryCpu.stderr;
  }
  if (routing) {
    const candidateCpu = runCpu(["-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", "test_object_support_terrain_gradient_device_v1.py", "-v"]);
    cpu.stdout += candidateCpu.stdout; cpu.stderr += candidateCpu.stderr;
  }
  if (background || rehearsal) {
    const candidateCpu = runCpu(["-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", "test_isolated_rock_background_proxy_v1.py", "-v"]);
    cpu.stdout += candidateCpu.stdout; cpu.stderr += candidateCpu.stderr;
  }
  if (rehearsal) {
    for (const test of ["test_stem_weight_reduction_precision_v1.py","test_stem_model_identity_v1.py","test_stem_inner_weight_reduction_precision_v1.py","test_stem_pair_model_identity_v1.py","test_decode2_inner_weight_reduction_precision_v1.py","test_stem_decoder_model_identity_v1.py"]) {
      const candidateCpu = runCpu(["-m", "unittest", "discover", "-s", "ml/ai-painter/tests", "-p", test, "-v"]);
      cpu.stdout += candidateCpu.stdout; cpu.stderr += candidateCpu.stderr;
    }
  }
  const packageBinding = JSON.parse(runCpu([worker, "prepare", ...policyArgs], boundedTimeout(rehearsal || causalProbe || replay || roadAttribution ? 300000 : 120000)).stdout.trim());
  const pkg = read(packageBinding.path);
  assert.equal(bind(packageBinding.path).sha256, packageBinding.sha256);
  if (roadAttribution) {
    assert.equal(pkg.schemaVersion, "road-attribution-zero-update-package-v1");
    assert.equal(pkg.resources.maxWallSeconds, 600);
    assert.deepEqual(pkg.resources, read(roadAttributionPolicy).resources);
    assert.equal(pkg.policy.path, roadAttributionPolicy);
    assert.equal(pkg.policy.sha256, bind(roadAttributionPolicy).sha256);
  }
  if (pkg.interfaceContract) observationContract(pkg,pkg.experimentIdentity);
  if (fullTrainExposure) assert(exposureProgressPublicationValid(pkg), "frozen progress publication rule differs");
  if (wholeFrameFidelity || objectCoreFidelity || v23CompleteSupportPartition || v24ObjectHeadCorePriority || v24IeeeObjectHeadCorePriority || v24CriticModeObjectHeadCorePriority) assert.deepEqual(pkg.inputs.heartbeatPublicationRule, heartbeatPublicationRule,
    "frozen heartbeat publication rule differs");
  const directory = path.posix.dirname(packageBinding.path);
  const cpuPath = `${directory}/cpu-tests.json`;
  if (!fs.existsSync(path.join(root, cpuPath))) write(cpuPath, { status: "experiment_cpu_behavior_tests_passed", executionState: "completed", recordedAtUtc: new Date().toISOString(), stdout: cpu.stdout, stderr: cpu.stderr, package: packageBinding,
    controllerBehaviorTests: { program: bind("scripts/tests/test-ai-painter-experiment-heartbeat.mjs"), exitCode: controllerTests.status, stdout: controllerTests.stdout, stderr: controllerTests.stderr } });
  console.log(JSON.stringify({ status: "experiment_prepared_not_gpu_started", package: packageBinding, cpu: bind(cpuPath) }));
  if (roadAttribution) boundedTimeout(1);
  if (mode === "prepare") return;
  assert(!fs.existsSync(path.join(root, directory, "controller-started.json")), "experiment already consumed; no automatic restart");
  const controllerStartedAtUtc = diagnosticStartedAtUtc ?? new Date().toISOString(), controllerStartedMono = diagnosticStartedMono ?? process.hrtime.bigint();
  const controllerTiming = state => ({scope:roadAttribution ? "road_attribution_before_cpu_checks_before_terminal_registration" : CONTROLLER_SCOPE,
    status:state, startedAtUtc:controllerStartedAtUtc, endedAtUtc:new Date().toISOString(),
    elapsedSeconds:Number(process.hrtime.bigint()-controllerStartedMono)/1e9});
  write(`${directory}/controller-started.json`, { recordedAtUtc: controllerStartedAtUtc, previousRegistry: { revision: previous.registry.registryRevision, sha256: previous.registrySha256 }, package: packageBinding });
  const runId = pkg.experimentIdentity;
  const identity = { capabilityVersion: runId, packageId: runId, runId, processId: process.pid, processStartIdentity: processIdentity() };
  const lockPath = `${directory}/execution-lock.json`;
  const heartbeatPath = `${directory}/heartbeat.json`;
  write(lockPath, { schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity });
  const heartbeat = () => write(heartbeatPath, { schemaVersion: "ai-painter-current-active-execution-heartbeat-v1", ...identity, executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120 }, true);
  heartbeat();
  let registered = false;
  let postReviewEligible = false;
  let child = null;
  let heartbeatFailure = null;
  let telemetryTimer = null;
  let telemetryClosed = false;
  let telemetryTask = Promise.resolve();
  let telemetryFailed = false;
  let telemetryLastStep = 0;
  const timer = setInterval(() => guardedHeartbeat(heartbeat, error => {
    heartbeatFailure ??= error;
    clearInterval(timer);
    stopOwnedWorker(child);
  }), 10000);
  const active = { schemaVersion: "ai-painter-current-active-execution-v1", ...identity, executionState: "executing", programLineage: { controller: bind("scripts/run-ai-painter-learning-capacity-experiment.mjs"), worker: bind(worker) }, lock: bind(lockPath), heartbeat: { path: heartbeatPath, ttlSeconds: 120 } };
  const capsule = (logical, evidence) => write(logical, { schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId, integrity: { status: "verified" }, evidence: evidence.map((b, i) => ({ ...b, kind: `experiment_${i}`, sha256Verified: true })) });
  const cpuCapsule = `${directory}/cpu-capsule.json`;
  capsule(cpuCapsule, [packageBinding, bind(cpuPath)]);
  try {
    const activeResult = await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId, taskId: runId,
      taskKind, taskGoal, queueStatus: "running", nextMachineAction: null,
      runId, lifecycleStage: "isolated_implementation", executionState: "executing", activity: roadAttribution ? "readonly_road_attribution_running" : readonlyTrainFit ? "readonly_train_fit_running" : "experiment_running_not_formal_stage4", taskCapsulePath: cpuCapsule, terminalEvidencePath: cpuPath,
      activeExecution: active, expectedPreviousRegistryRevision: previous.registry.registryRevision, expectedPreviousRegistrySha256: previous.registrySha256 });
    assert(activeResult.ok, "experiment active registry commit failed");
    registered = true;
    if (heartbeatFailure) throw heartbeatFailure;
    if (fullTrainExposure) {
      const { createActiveTrainingTelemetryReporter, normalizeActiveTrainingProgress } =
        await import("./lib/ai-painter-active-training-telemetry-v1.mjs");
      const reporter = createActiveTrainingTelemetryReporter({ projectRoot: root, runId, packageId: runId });
      const poll = async () => {
        if (telemetryClosed || telemetryFailed) return;
        const progressPath = `${directory}/progress.json`;
        if (!fs.existsSync(path.join(root, progressPath))) return;
        const progress = exposureTelemetryFromProgress(read(progressPath), runId,
          normalizeActiveTrainingProgress, telemetryLastStep);
        if (!progress || telemetryClosed) return;
        await reporter(progress);
        telemetryLastStep = progress.optimizationStep;
      };
      telemetryTimer = setInterval(() => {
        if (telemetryClosed || telemetryFailed) return;
        telemetryTask = telemetryTask.then(poll).catch(error => {
          telemetryFailed = true;
          write(`${directory}/telemetry-store-failure.json`, {
            status: "telemetry_projection_failed_training_state_unaffected", runId,
            lastConfirmedOptimizationStep: telemetryLastStep, error: String(error.stack ?? error),
            recordedAtUtc: new Date().toISOString(),
          });
        });
      }, 2000);
    }
    let timedOut = false;
    const workerTimeoutMs = roadAttribution ? boundedTimeout(600000) : experimentWorkerTimeoutMs(pkg.resources, fullTrainExposure);
    const code = await new Promise((resolve, reject) => {
      child = spawn(python, [worker, "run", "--package", packageBinding.path, "--sha256", packageBinding.sha256], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      write(`${directory}/controller-lease.json`, { experimentIdentity: runId, workerParentPid: process.pid, workerLauncherPid: child.pid,
        registryRevision: activeResult.registry.registryRevision, registrySha256: activeResult.registrySha256 });
      const log = fs.createWriteStream(path.join(root, directory, "worker.log"), { flags: "wx" });
      child.stdout.on("data", data => { log.write(data); process.stdout.write(data); });
      child.stderr.on("data", data => { log.write(data); process.stderr.write(data); });
      const timeout = setTimeout(() => { timedOut = true; stopOwnedWorker(child); }, workerTimeoutMs);
      child.once("error", error => { clearTimeout(timeout); log.end(); reject(error); });
      child.once("close", exitCode => { clearTimeout(timeout); log.end(); resolve(exitCode); });
    });
    clearInterval(timer);
    telemetryClosed = true;
    if (telemetryTimer) clearInterval(telemetryTimer);
    assert(await drainExperimentTelemetry(telemetryTask), "experiment telemetry did not drain before terminal");
    if (heartbeatFailure) throw heartbeatFailure;
    const resultPath = `${directory}/result.json`;
    const result = fs.existsSync(path.join(root, resultPath)) ? read(resultPath) : null;
    const stoppedProgressPath = `${directory}/progress.json`;
    const observedTermination = observedExperimentTermination(result,
      !result && fs.existsSync(path.join(root, stoppedProgressPath)) ? read(stoppedProgressPath) : null, runId);
    const success = roadAttribution ? roadAttributionSucceeded(result, pkg, code, timedOut || performance.now() - diagnosticWindowStartMs >= 900000)
      : readonlyTrainFit ? readonlyTrainFitSucceeded(result, pkg, code, timedOut)
      : causalProbe ? causalProbeSucceeded(result, pkg, code, timedOut)
      : replay ? replaySucceeded(result, pkg, code, timedOut)
      : single149 ? single149Succeeded(result, pkg, code, timedOut)
      : rehearsal ? rehearsalSucceeded(result, pkg, code, timedOut)
      : background ? backgroundSucceeded(result, pkg, code, timedOut)
      : routing ? routingSucceeded(result, pkg, code, timedOut)
      : twoMap ? twoMapExperimentSucceeded(result, pkg, code, timedOut)
      : fullTrainExposure ? fullTrainExposureSucceeded(result, pkg, code, timedOut)
      : code === 0 && !timedOut && result?.status === "experiment_executed_not_visual_qualified" && result?.checkpointReloadExact === true;
    if (success) for (const artifact of result.artifacts) {
      if (roadAttribution) boundedTimeout(1);
      assert.equal(bind(artifact.path).sha256, artifact.sha256, "experiment output hash changed");
      if (roadAttribution) boundedTimeout(1);
    }
    if (roadAttribution) boundedTimeout(1);
    const terminalPath = `${directory}/terminal.json`;
    write(terminalPath, { schemaVersion: "ai-painter-learning-capacity-experiment-terminal-v1", status: success ? roadAttribution ? "readonly_road_attribution_completed_no_qualification" : readonlyTrainFit ? "readonly_train_fit_diagnostic_completed_no_qualification" : "experiment_completed_not_formal_qualified" : "experiment_failed_closed",
      executionState: success ? "completed" : "failed_closed", experimentIdentity: runId, runId, recordedAtUtc: new Date().toISOString(), exitCode: code, timedOut,
      result: result ? bind(resultPath) : null, ...observedTermination,
      executionPackage:packageBinding, packageId:runId, capabilityVersion:runId, trainingObservation:result?.trainingObservation ?? null,
      lastWorkerProgress:!result&&fs.existsSync(path.join(root,stoppedProgressPath))?bind(stoppedProgressPath):null,
      observationSecondaryErrors:result?.observationSecondaryErrors ?? [],
      controllerExecutionTiming:controllerTiming(success ? "completed" : "failed_closed"),
      completedEpochs: fullTrainExposure && Number.isSafeInteger(result?.completedEpochs) && result.completedEpochs >= 0 ? result.completedEpochs : null,
      errorCode: typeof result?.error === "string" ? result.error : null,
      formalTrainingQualified: false, formalStageAdvanced: false, checkpointPromotable: false, worldEntryAllowed: false });
    const terminalCapsule = `${directory}/terminal-capsule.json`;
    capsule(terminalCapsule, [packageBinding, bind(cpuPath), bind(terminalPath), ...(result ? [bind(resultPath)] : [])]);
    const current = await readCurrentExecutionRegistry(root);
    assert(current.ok && current.registry.runId === runId, "current execution changed during experiment");
    if (roadAttribution) boundedTimeout(1);
    const done = await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId, taskId: runId,
      taskKind, taskGoal: roadAttribution ? "Inspect eight zero-update road attribution cases; no training or qualification" : readonlyTrainFit ? "Inspect all-48 train fit evidence; not training, generalization or formal release" : "Inspect the saved 256x192 experimental evidence; no formal release", queueStatus: success ? "completed" : "failed_closed", nextMachineAction: null,
      runId, lifecycleStage: "isolated_implementation", executionState: success ? "completed" : "failed_closed", activity: roadAttribution ? success ? "readonly_road_attribution_completed" : "readonly_road_attribution_failed_closed" : success ? readonlyTrainFit ? "readonly_train_fit_completed" : "experiment_completed" : "experiment_failed_closed",
      taskCapsulePath: terminalCapsule, terminalEvidencePath: terminalPath, activeExecution: null,
      latestTrainingTerminal: experimentMayUpdateTrainingTerminal(policy, readonlyTrainFit, observedTermination.trainingStarted) ? { runId, ...bind(terminalPath), status: read(terminalPath).status, evidence: { manifest: bind(result ? resultPath : terminalPath) } } : null,
      expectedPreviousRegistryRevision: current.registry.registryRevision, expectedPreviousRegistrySha256: current.registrySha256 });
    assert(done.ok, `experiment terminal registry commit failed: ${done.errorCode ?? "unknown"}`);
    console.log(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), registryRevision: done.registry.registryRevision }));
    postReviewEligible = (twoMap || rehearsal || single149 || replay) && success;
    if (!success) process.exitCode = 1;
  } catch (error) {
    if (ownedWorkerIsRunning(child)) {
      await new Promise(resolve => { child.once("close", resolve); stopOwnedWorker(child); setTimeout(resolve, 10000); });
    }
    telemetryClosed = true;
    if (telemetryTimer) clearInterval(telemetryTimer);
    if (!await drainExperimentTelemetry(telemetryTask)) {
      // Preserve the live registry for recovery; never permit a late write to
      // masquerade as an active reporter after the registry terminal is closed.
      const pendingPath = `${directory}/telemetry-drain-timeout.json`;
      if (!fs.existsSync(path.join(root, pendingPath))) write(pendingPath, {
        status: "telemetry_drain_timeout_recovery_required", runId, error: String(error.stack ?? error),
        recordedAtUtc: new Date().toISOString(),
      });
      throw new Error("telemetry drain timed out; active registry requires recovery", { cause: error });
    }
    const errorPath = `${directory}/controller-failure.json`;
    let interruptedProgress = null;
    let interruptedProgressBinding = null;
    let progressReadError = null;
    try {
      const progressPath = `${directory}/progress.json`;
      if (fs.existsSync(path.join(root, progressPath))) {
        const value = read(progressPath);
        assert.equal(value.experimentIdentity, runId, "interrupted progress identity mismatch");
        interruptedProgress = value;
        interruptedProgressBinding = bind(progressPath);
      }
    } catch (progressError) { progressReadError = progressError.message; }
    const commonObservation = pkg.interfaceContract?.schemaVersion === "ai-painter-training-interface-contract-v2";
    if (!fs.existsSync(path.join(root, errorPath))) write(errorPath, { status: commonObservation ? "experiment_failed_closed" : "experiment_controller_failed_closed", executionState: "failed_closed", registered,
      ...(commonObservation ? {schemaVersion:"ai-painter-learning-capacity-experiment-terminal-v1",
        formalTrainingQualified:false,formalStageAdvanced:false,checkpointPromotable:false,worldEntryAllowed:false} : {}),
      experimentIdentity: runId, runId, packageId:runId, capabilityVersion:runId, executionPackage:packageBinding,
      controllerExecutionTiming:controllerTiming("failed_closed"),
      lastWorkerProgress:interruptedProgressBinding,
      gpuStarted: interruptedProgress?.gpuStarted ?? null,
      trainingStarted: interruptedProgress?.trainingStarted ?? null,
      lastConfirmedOptimizerSteps: interruptedProgress?.optimizerSteps ?? null, actualFinalOptimizerSteps: null,
      progressReadError, error: error.stack, heartbeatPublication: error.heartbeatPublication ?? null,
      recordedAtUtc: new Date().toISOString() });
    if (registered) {
      const current = await readCurrentExecutionRegistry(root);
      if (current.ok && current.registry.runId === runId && current.registry.activeExecution !== null) {
        const failureCapsule = `${directory}/controller-failure-capsule.json`;
        capsule(failureCapsule, [packageBinding, bind(errorPath)]);
        await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: runId, packageId: runId,
          taskId: runId, taskKind, queueStatus: "failed_closed", nextMachineAction: null,
          runId, lifecycleStage: "isolated_implementation", executionState: "failed_closed", activity: "experiment_controller_failed_closed",
          taskCapsulePath: failureCapsule, terminalEvidencePath: errorPath, activeExecution: null,
          latestTrainingTerminal: experimentMayUpdateTrainingTerminal(policy, readonlyTrainFit, interruptedProgress?.trainingStarted)
            ? { runId, ...bind(errorPath), status: read(errorPath).status, evidence: { manifest: bind(errorPath) } } : null,
          expectedPreviousRegistryRevision: current.registry.registryRevision, expectedPreviousRegistrySha256: current.registrySha256 });
      }
    }
    throw error;
  } finally { clearInterval(timer); telemetryClosed = true; if (telemetryTimer) clearInterval(telemetryTimer); }
  // A distinct read-only execution follows a successful training terminal.
  // Its failure must never rewrite the already committed training result.
  if (postReviewEligible) {
    const runReview = replay
      ? (await import("./lib/ai-painter-replay-retention-review-v1.mjs")).runReplayRetentionReview
      : (await import("./lib/ai-painter-two-map-post-review-v1.mjs")).runTwoMapPostReview;
    const { deliverPostReviewRecords, reviewThenDeliver } = await import("./lib/ai-painter-post-review-delivery-v1.mjs");
    await reviewThenDeliver(() => runReview({ projectRoot: root }),
      () => deliverPostReviewRecords({ projectRoot: root }),
      delivery => console.log(JSON.stringify({ postReviewWorkDelivery: delivery })));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
