import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {heartbeatPublicationRule, objectCoreFidelityPolicy,
  v23CompleteSupportPartitionPolicy, v23CompleteSupportPartitionValid} from "../run-ai-painter-learning-capacity-experiment.mjs";

const bind = path => ({path, sha256:createHash("sha256").update(fs.readFileSync(path)).digest("hex")});
function fixture() {
  const objectivePlan=JSON.parse(fs.readFileSync(objectCoreFidelityPolicy,"utf8")).inputs.objectivePlan;
  const selectedRows=Array.from({length:48},(_,trainOrdinal)=>({sampleId:`train-${trainOrdinal}`,split:"train",trainOrdinal}));
  const modelPlan={baseChannels:48,patchChannels:32,seed:20260929,
    capabilityVersion:"stage4_mvp_native_rgb_complete_support_partition_v23_cpu_candidate",
    architectureId:"stage4_native_rgb_terrain_plus_complete_typed_support_partition_v23",
    freshInitializationOnly:true,historicalCheckpointLoaded:false};
  const representationPlan={capabilityVersion:modelPlan.capabilityVersion,architectureId:modelPlan.architectureId,
    ownershipRule:"complete_typed_support_partition_by_nearest_normalized_core_v1",
    program:bind("ml/ai-painter/src/ai_painter/complete_world/native_rgb_complete_support_partition_v23_cpu.py"),
    tests:bind("ml/ai-painter/tests/test_native_rgb_complete_support_partition_v23_cpu.py"),
    cpuEvidence:bind(".runtime/ai-painter/stage4-mvp-v23-complete-support-partition-cpu/report.json"),
    controllerAcceptance:bind(".runtime/ai-painter/stage4-mvp-v23-complete-support-partition-cpu/controller-acceptance.json"),
    formalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.24",section:"9.6.8"},
    typedRoles:["object_tree","object_rock","object_vegetation"],tieOrder:["object_tree","object_rock","object_vegetation"],
    supportRadiusPixels:{object_tree:8,object_rock:4,object_vegetation:6},
    distance:"exact_integer_chebyshev_distance_to_nearest_same_role_authoritative_core",
    comparison:"integer_cross_multiplication_strict_less_than",coreNeverYields:true,
    ownedUnionEqualsExistingTypedCoverageUnion:true,ownersPairwiseDisjoint:true,
    ownerSubsetOfOwnExistingCoverage:true,supportExpanded:false,freshInitializationSeed:20260929,
    historicalCheckpointLoaded:false,inheritedComponents:{terrainPath:"unchanged_fresh_v21",critic:"unchanged_fresh_v21",
      objective:"unchanged_object_core_fidelity_v1",conditionChannels:"unchanged_23",instanceFeatureAssembly:"unchanged_v21",
      rgbHeads:"unchanged_v21",footprintResidual:"unchanged_v21",pointwiseComposition:"unchanged_v21"},qualificationGranted:false};
  const inputs={objectivePlan,heartbeatPublicationRule:structuredClone(heartbeatPublicationRule),modelPlan,representationPlan,
    datasetManifest:{path:"manifest",sha256:"1".repeat(64)},sourceIndex:{path:"source",sha256:"2".repeat(64)},
    trainSplit:{path:"train",sha256:"3".repeat(64)},conditionContract:{path:"conditions",sha256:"4".repeat(64)},
    trainSelectionSha256:"5".repeat(64),selectedRows};
  inputs.sourcePlan={datasetManifest:inputs.datasetManifest,sourceIndex:inputs.sourceIndex,trainSplit:inputs.trainSplit,
    conditionContract:inputs.conditionContract,sourceRgbUse:"original_train_rgb_targets_only",conditionUse:"original_bound_23_channels",
    externalRgbRead:false,worldFactsChanged:false,sourceBytesMutable:false,validationContentRead:false,challengeContentRead:false,regressionContentRead:false};
  inputs.dataPlan={split:"train",selectedRowCount:48,trainSelectionSha256:inputs.trainSelectionSha256,
    orderedRows:selectedRows.map(({sampleId,split,trainOrdinal})=>({sampleId,split,trainOrdinal})),epochs:48,visitsPerRow:48,
    generatorOptimizerSteps:2304,discriminatorOptimizerSteps:2304,holdoutUsed:false,historicalWeightsUsed:false,automaticRetries:0};
  const pkg={policy:{path:v23CompleteSupportPartitionPolicy},experimentType:"complete_support_partition_train_only",
    inputs,config:{modelPlan,representationPlan,sourcePlan:inputs.sourcePlan,dataPlan:inputs.dataPlan},
    outputRoot:"fixture-v23",selectedRows};
  const facts={ownershipRule:representationPlan.ownershipRule,typedSupportUnionPixels:18,ownedUnionPixels:18,
    supportUnionMismatchPixels:0,ownerOverlapPixels:0,roles:{
      object_tree:{corePixels:2,coveragePixels:10,ownedPixels:8,coreOwnershipMissingPixels:0,ownerOutsideCoveragePixels:0,ownerMaskSha256:"a".repeat(64)},
      object_rock:{corePixels:1,coveragePixels:7,ownedPixels:5,coreOwnershipMissingPixels:0,ownerOutsideCoveragePixels:0,ownerMaskSha256:"b".repeat(64)},
      object_vegetation:{corePixels:1,coveragePixels:8,ownedPixels:5,coreOwnershipMissingPixels:0,ownerOutsideCoveragePixels:0,ownerMaskSha256:"c".repeat(64)}}};
  const cases=selectedRows.map(caseRow=>({case:caseRow,passed:true,optimizerCreated:false,optimizerSteps:{generator:0,discriminator:0},
    initialStateSha256:{Model:"d".repeat(64),Critic:"e".repeat(64)},finalStateSha256:{Model:"d".repeat(64),Critic:"e".repeat(64)},
    capabilityVersion:modelPlan.capabilityVersion,architectureId:modelPlan.architectureId,representationId:representationPlan.ownershipRule,
    conditionTensorSha256:"f".repeat(64),ownershipFacts:structuredClone(facts),objectiveId:objectivePlan.candidateId,
    objectiveTerms:{v21UnchangedTotal:.2,wholeFrameRgbMae:.1,wholeFrameSignedEdgeMae:.1,wholeFrameFidelity:.125,
      wholeFrameFidelityUnchangedTotal:.325,objectCoreRgbMae:.1,objectCoreRgbWeighted:.1,objectCoreApplicableRoleCount:4,total:.425}}));
  const proof={passed:true,caseCount:48,cases,optimizerCreated:false,optimizerSteps:{generator:0,discriminator:0}};
  const result={experimentType:pkg.experimentType,modelPlan,representationPlan,objectivePlan,
    heartbeatPublicationRule:structuredClone(heartbeatPublicationRule),zeroUpdateGpuProbePassed:true,
    historicalComparisonPurpose:objectivePlan.historicalComparisonPurpose,
    artifacts:[{path:"fixture-v23/zero-update-gpu-probe.json",sha256:"0".repeat(64)}]};
  return {pkg,result,proof};
}

test("V23 current plans and all 48 actual ownership summaries validate",()=>{
  const {pkg,result,proof}=fixture();
  assert.equal(v23CompleteSupportPartitionValid(result,pkg,()=>proof),true);
});

test("old model, role, rule, source, data, CPU report, and policy identities fail closed",()=>{
  for(const mutate of [
    ({pkg})=>{pkg.inputs.modelPlan.architectureId="old-v21";pkg.config.modelPlan=pkg.inputs.modelPlan;},
    ({pkg,result})=>{pkg.inputs.representationPlan.typedRoles.pop();pkg.config.representationPlan=pkg.inputs.representationPlan;result.representationPlan=pkg.inputs.representationPlan;},
    ({pkg,result})=>{pkg.inputs.representationPlan.ownershipRule="caller";pkg.config.representationPlan=pkg.inputs.representationPlan;result.representationPlan=pkg.inputs.representationPlan;},
    ({pkg,result})=>{pkg.inputs.representationPlan.cpuEvidence.sha256="0".repeat(64);pkg.config.representationPlan=pkg.inputs.representationPlan;result.representationPlan=pkg.inputs.representationPlan;},
    ({pkg})=>{pkg.inputs.sourcePlan.worldFactsChanged=true;pkg.config.sourcePlan=pkg.inputs.sourcePlan;},
    ({pkg})=>{pkg.inputs.dataPlan.holdoutUsed=true;pkg.config.dataPlan=pkg.inputs.dataPlan;},
    ({pkg})=>{pkg.policy.path=objectCoreFidelityPolicy;},
  ]) { const value=fixture();mutate(value);assert.equal(v23CompleteSupportPartitionValid(value.result,value.pkg,()=>value.proof),false); }
});

test("missing or tampered actual result objective plan cannot be replaced by the package plan",()=>{
  for(const mutate of [
    ({result})=>{delete result.objectivePlan;},
    ({result})=>{result.objectivePlan={...result.objectivePlan,coreRgbWeight:.5};},
  ]) {
    const value=fixture();mutate(value);
    assert.equal(v23CompleteSupportPartitionValid(value.result,value.pkg,()=>value.proof),false);
  }
});

test("ownership proof is recomputed from counts and zero violation fields",()=>{
  for(const mutate of [x=>{x.cases.pop();},x=>{x.cases[0].representationId="old";},
    x=>{x.cases[0].ownershipFacts.supportUnionMismatchPixels=1;},x=>{x.cases[0].ownershipFacts.ownerOverlapPixels=1;},
    x=>{x.cases[0].ownershipFacts.roles.object_tree.coreOwnershipMissingPixels=1;},
    x=>{x.cases[0].ownershipFacts.roles.object_tree.ownerOutsideCoveragePixels=1;},
    x=>{x.cases[0].ownershipFacts.roles.object_tree.ownedPixels=20;},
    x=>{x.cases[0].ownershipFacts.ownedUnionPixels=17;},x=>{x.cases[0].conditionTensorSha256="true";},
    x=>{x.cases[0].finalStateSha256.Model="1".repeat(64);},x=>{x.optimizerCreated=true;}]) {
    const {pkg,result,proof}=fixture();mutate(proof);
    assert.equal(v23CompleteSupportPartitionValid(result,pkg,()=>proof),false);
  }
});
