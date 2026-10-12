import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {v24ObjectHeadCorePriorityPolicy,v24ObjectHeadCorePriorityValid} from "../run-ai-painter-learning-capacity-experiment.mjs";

const bind=path=>({path,sha256:createHash("sha256").update(fs.readFileSync(path)).digest("hex")});
const digest=value=>({path:value,sha256:"a".repeat(64)});

function fixture(){
  const rows=Array.from({length:48},(_,trainOrdinal)=>({sampleId:`train-${trainOrdinal}`,split:"train",trainOrdinal}));
  const modelPlan={baseChannels:48,patchChannels:32,seed:20260929,
    capabilityVersion:"stage4_mvp_native_rgb_complete_support_partition_v23_cpu_candidate",
    architectureId:"stage4_native_rgb_terrain_plus_complete_typed_support_partition_v23",
    freshInitializationOnly:true,historicalCheckpointLoaded:false};
  const representationPlan={ownershipRule:"complete_typed_support_partition_by_nearest_normalized_core_v1",
    program:bind("ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py"),
    formalSpecificationSnapshot:{...bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/frozen-formal-spec-1.24.md"),version:"AI-PAINTER-SPEC-1.24",historicalEvidenceOnly:true}};
  const precisionExecutionPlan={generatorForward:"native_fp32_no_autocast",
    generatorObjective:"native_fp32_frozen_critic_no_autocast",
    actualTotalGradient:"native_fp32_complete_model_independent_autograd_grad",
    auxiliaryGradients:"native_fp32_actual_four_heads_only_three_autograd_grad_calls",
    projection:"cpu_float64_fixed_v24_reference_then_fp32_return",
    discriminatorUpdate:"inherited_cuda_bfloat16_autocast_original_objective_and_order",
    observation:"native_fp32_no_autocast",oldStudyPrecisionDiffers:true,singleFactorCausalClaimAllowed:false};
  const updatePlan={candidateId:"stage4_mvp_v24_object_head_core_priority_training_candidate_v1",
    experimentType:"object_head_core_priority_train_only",
    program:bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24.py"),
    tests:bind("ml/ai-painter/tests/test_object_head_core_priority_update_v24.py"),
    cpuReference:bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24_cpu.py"),
    cpuReferenceTests:bind("ml/ai-painter/tests/test_object_head_core_priority_update_v24_cpu.py"),
    cpuReferenceEvidence:bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/result.json"),
    cpuReferenceAcceptance:bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/controller-acceptance.json"),
    cpuReferenceFormalSpecification:{...bind(".runtime/ai-painter/stage4-mvp-v24-object-head-core-priority-cpu/frozen-formal-spec-1.25.md"),version:"AI-PAINTER-SPEC-1.25",section:"9.6.9"},
    currentFormalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.26",section:"9.6.10"},
    formula:"per_actual_object_rgb_head_remove_only_negative_other_component",
    actualTotalIndependentFullModelGradient:true,auxiliaryGradientsActualHeadParametersOnly:true,
    objectHeadParameterTensorCount:16,objectHeadParameterElementCount:4876,nonHeadParameterTensorCount:90,
    lossAndCoefficientsChanged:false,historicalCheckpointLoaded:false,qualificationGranted:false};
  const integrationPlan={controller:bind("scripts/run-ai-painter-learning-capacity-experiment.mjs"),
    worker:bind("ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"),
    workerTests:bind("ml/ai-painter/tests/test_stage4_v24_object_head_core_priority_probe.py"),
    controllerTests:bind("scripts/tests/test-ai-painter-v24-core-priority-controller.mjs"),
    evidence:digest(".runtime/ai-painter/stage4-mvp-v24-core-priority-integration-cpu/result.json"),
    controllerAcceptance:digest(".runtime/ai-painter/stage4-mvp-v24-core-priority-integration-cpu/controller-acceptance.json"),
    formalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.26",section:"9.6.10"},
    gpuQualified:false,trainingAllowed:false};
  const qualityComparisonPlan={baselineRunId:"v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6",
    baselineResult:bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/result.json"),
    baselineEndpointCpuReview:bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/controller-endpoint-cpu-review.json"),
    baselineQualityReview:bind(".runtime/ai-painter/learning-capacity-experiments/v23-complete-support-partition-1d78df991e09deba43856ef25a4a61a15ef1c2d25b044ab6/controller-quality-review.json"),
    trainSelectionSha256:"5".repeat(64),selectedRowCount:48,measurementPrecision:"cpu_fp32",
    requiredStrictMeanDecreases:["fullRgbMae","object_footprintsCoreRgbMae","object_treeCoreRgbMae","object_rockCoreRgbMae","object_vegetationCoreRgbMae"],
    improvementOffsetAllowed:false,semanticReadabilityRequiredForQualification:true,
    missingTrustedSemanticCriterionResult:"unverified_not_qualified",singleFactorCausalClaimAllowed:false};
  const dataPlan={split:"train",selectedRowCount:48,trainSelectionSha256:"5".repeat(64),
    orderedRows:rows,epochs:48,visitsPerRow:48,generatorOptimizerSteps:2304,discriminatorOptimizerSteps:2304,
    holdoutUsed:false,historicalWeightsUsed:false,automaticRetries:0};
  const inputs={modelPlan,representationPlan,precisionExecutionPlan,updatePlan,integrationPlan,
    qualityComparisonPlan,dataPlan,trainSelectionSha256:"5".repeat(64)};
  const pkg={policy:{path:v24ObjectHeadCorePriorityPolicy},experimentType:"object_head_core_priority_train_only",
    outputRoot:"fixture-v24",selectedRows:rows,inputs,
    config:{modelPlan,representationPlan,precisionExecutionPlan,updatePlan,integrationPlan,qualityComparisonPlan,dataPlan}};
  const headDiagnostics=Object.fromEntries(["object_footprints","object_tree","object_rock","object_vegetation"]
    .map(key=>[key,{branch:"non_conflict_preserve_actual_total"}]));
  const ownershipFacts={supportUnionMismatchPixels:0,ownerOverlapPixels:0};
  const cases=rows.map(row=>({case:row,initialStateSha256:{Model:"b".repeat(64),Critic:"c".repeat(64)},
    finalStateSha256:{Model:"b".repeat(64),Critic:"c".repeat(64)},candidateId:updatePlan.candidateId,
    precisionExecutionPlan,generatorCandidate:{autogradGradCalls:4,actualTotalIndependentFullModelGradient:true,
      cpuReferenceExact:true,fullModelAuxiliaryGradientsCopiedToCpu:false,headDiagnostics,
      nonHeadActualTotalIdentityPreserved:true,nonConflictHeadActualTotalBytesPreserved:true,
      parameterIdentity:{objectHeadParameterTensorCount:16,objectHeadParameterElementCount:4876,uniqueParameterStorages:true},
      generatorGradientFacts:{nonzeroTensorCount:106,nonzeroElementCount:100}},
    discriminatorGradientFacts:{nonzeroTensorCount:10,nonzeroElementCount:100,allFinite:true},
    criticFrozenDuringGenerator:true,criticGradientLeakDuringGenerator:false,
    generatorGradientLeakDuringDiscriminator:false,targetAndConditionsDetached:true,sourceTensorsUnchanged:true,
    rngRestored:true,gradFieldsCleared:true,ownershipFacts,conditionTensorSha256:"d".repeat(64)}));
  const proof={passed:true,caseCount:48,cases,optimizerCreated:false,optimizerSteps:{generator:0,discriminator:0}};
  const result={experimentType:pkg.experimentType,modelPlan,representationPlan,precisionExecutionPlan,updatePlan,
    integrationPlan,qualityComparisonPlan,artifacts:[{path:"fixture-v24/zero-update-gpu-probe.json",sha256:"e".repeat(64)}]};
  return {pkg,result,proof};
}

test("V24 exact plans and 48 current zero-update cases validate",()=>{
  const {pkg,result,proof}=fixture();
  assert.equal(v24ObjectHeadCorePriorityValid(result,pkg,()=>proof),true);
});

test("old policy, training identity, precision, update binding, qualification, and proof gaps fail closed",()=>{
  for(const mutate of [
    ({pkg})=>{pkg.policy.path="data/ai-painter/system-governance/stage4-mvp-v23-complete-support-partition-policy-v1.json";},
    ({pkg})=>{pkg.inputs.modelPlan.historicalCheckpointLoaded=true;},
    ({pkg,result})=>{pkg.inputs.precisionExecutionPlan.generatorForward="bf16";pkg.config.precisionExecutionPlan=pkg.inputs.precisionExecutionPlan;result.precisionExecutionPlan=pkg.inputs.precisionExecutionPlan;},
    ({pkg,result})=>{pkg.inputs.updatePlan.program.sha256="0".repeat(64);pkg.config.updatePlan=pkg.inputs.updatePlan;result.updatePlan=pkg.inputs.updatePlan;},
    ({pkg,result})=>{pkg.inputs.integrationPlan.trainingAllowed=true;pkg.config.integrationPlan=pkg.inputs.integrationPlan;result.integrationPlan=pkg.inputs.integrationPlan;},
    ({proof})=>{proof.cases.pop();},
    ({proof})=>{proof.cases[0].generatorCandidate.autogradGradCalls=3;},
    ({proof})=>{proof.cases[0].generatorCandidate.fullModelAuxiliaryGradientsCopiedToCpu=true;},
    ({proof})=>{proof.cases[0].discriminatorGradientFacts.nonzeroTensorCount=0;},
    ({proof})=>{proof.cases[0].finalStateSha256.Model="0".repeat(64);},
  ]) {const value=fixture();mutate(value);assert.equal(v24ObjectHeadCorePriorityValid(value.result,value.pkg,()=>value.proof),false);}
});
