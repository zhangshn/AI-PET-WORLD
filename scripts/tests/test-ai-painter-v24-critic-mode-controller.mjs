import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {v24ResourceBoundObjectHeadCorePriorityPolicy,
  v24CriticModeObjectHeadCorePriorityValid} from "../run-ai-painter-learning-capacity-experiment.mjs";

const bind=path=>({path,sha256:createHash("sha256").update(fs.readFileSync(path)).digest("hex")});
const digest=path=>({path,sha256:"a".repeat(64)});
const clone=value=>structuredClone(value);
const historicalRoot=".runtime/ai-painter/learning-capacity-experiments/v24-ieee-core-priority-7cb1b32487a3c52a595d221107a3c15826866df136d2b5eb";
const historicalPackage=JSON.parse(fs.readFileSync(`${historicalRoot}/package.json`,"utf8"));
const historicalResult=JSON.parse(fs.readFileSync(`${historicalRoot}/result.json`,"utf8"));
const historicalProof=JSON.parse(fs.readFileSync(`${historicalRoot}/zero-update-gpu-probe.json`,"utf8"));
const preparedRoot=".runtime/ai-painter/learning-capacity-experiments/v24-critic-mode-core-priority-823eac6f1dd521a943e105c1601a5a59014d651427d1fffb";
const preparedPackage=JSON.parse(fs.readFileSync(`${preparedRoot}/package.json`,"utf8"));
const predecessorRoot=".runtime/ai-painter/stage4-mvp-v24-critic-mode-integration-cpu";
const root=".runtime/ai-painter/stage4-mvp-v24-resource-binding-cpu";

function fixture(){
  const pkg=clone(historicalPackage),result=clone(historicalResult),proof=clone(historicalProof);
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
  const representationPlan=clone(preparedPackage.inputs.representationPlan);
  const updatePlan={...clone(preparedPackage.inputs.updatePlan),
    program:bind("ml/ai-painter/src/ai_painter/complete_world/object_head_core_priority_update_v24.py"),
    tests:bind("ml/ai-painter/tests/test_object_head_core_priority_update_v24.py"),
    currentFormalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),
      version:"AI-PAINTER-SPEC-1.31",section:"9.6.15"}};
  const frozenSourceSnapshots={formalSpecification:bind(`${root}/frozen-formal-spec-1.30.md`),
    controller:bind(`${root}/frozen-controller-1.30.mjs`),
    controllerTests:bind(`${root}/frozen-controller-tests-1.30.mjs`),
    worker:bind(`${root}/frozen-profile-1.30.py`),
    workerTests:bind(`${root}/frozen-profile-tests-1.30.py`),
    exposureWorker:bind(`${root}/frozen-exposure-worker-1.30.py`)};
  const resourceRevisionPlan={predecessorMaxWallSeconds:1800,maxWallSeconds:2700,
    onlyChangedResourceField:"maxWallSeconds",predecessorRunStatus:"experiment_failed_closed",
    predecessorFailureCode:"ValueError('free VRAM below floor')",
    predecessorOptimizerSteps:{generator:1945,discriminator:1946},oldWeightsReusable:false};
  const integrationPlan={controller:bind("scripts/run-ai-painter-learning-capacity-experiment.mjs"),
    worker:bind("ml/ai-painter/scripts/painter_stage4_v24_object_head_core_priority_probe.py"),
    workerTests:bind("ml/ai-painter/tests/test_stage4_v24_object_head_core_priority_probe.py"),
    exposureWorker:bind("ml/ai-painter/scripts/painter_stage4_v21_full_train_exposure_probe.py"),
    controllerTests:bind("scripts/tests/test-ai-painter-v24-critic-mode-controller.mjs"),
    historicalControllerTests:bind("scripts/tests/test-ai-painter-v24-core-priority-controller.mjs"),
    diagnosticProgram:bind(`${predecessorRoot}/diagnose-v24-critic-mode-integration-cpu.py`),
    diagnosticTests:bind(`${predecessorRoot}/test-diagnose-v24-critic-mode-integration-cpu.py`),
    originalEvidence:bind(`${predecessorRoot}/result.json`),
    originalControllerAcceptance:bind(`${predecessorRoot}/controller-acceptance.json`),
    predecessorCheckerResult:bind(`${predecessorRoot}/checker-binding-result.json`),
    predecessorCheckerControllerAcceptance:bind(`${predecessorRoot}/checker-binding-acceptance.json`),
    checkerProgram:bind(`${root}/rebind-v24-resource-evidence.py`),
    checkerTests:bind(`${root}/test-rebind-v24-resource-evidence.py`),
    checkerResult:digest(`${root}/resource-binding-result.json`),
    checkerControllerAcceptance:digest(`${root}/resource-binding-acceptance.json`),
    frozenSourceSnapshots,
    formalSpecification:{...bind("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),version:"AI-PAINTER-SPEC-1.31",section:"9.6.15"},
    historicalFormalSpecificationSnapshot:{...frozenSourceSnapshots.formalSpecification,version:"AI-PAINTER-SPEC-1.30",section:"9.6.14",historicalEvidenceOnly:true},
    predecessorFormalSpecificationSnapshot:{...bind(`${predecessorRoot}/frozen-formal-spec-1.28.md`),version:"AI-PAINTER-SPEC-1.28",section:"9.6.12",historicalEvidenceOnly:true},
    criticStatePlan,resourceRevisionPlan,gpuQualified:false,trainingAllowed:false};
  const currentProgramBindings=[integrationPlan.controller,integrationPlan.worker,integrationPlan.workerTests,
    integrationPlan.controllerTests,integrationPlan.exposureWorker,integrationPlan.checkerProgram,
    integrationPlan.checkerTests,integrationPlan.formalSpecification].map(({path,sha256})=>({path,sha256}));
  const checker={schemaVersion:"ai-painter-v24-resource-binding-result-v1",
    status:"v24_resource_binding_recomputed_no_model_execution",candidateId:updatePlan.candidateId,
    currentProgramBindings,historicalSnapshots:frozenSourceSnapshots,
    predecessorCheckerResult:integrationPlan.predecessorCheckerResult,
    predecessorCheckerAcceptance:integrationPlan.predecessorCheckerControllerAcceptance,
    resourceRevisionPlan,protectedFacts:{trainingAlgorithmAstIdentical:true,
      updateSourceSha256:"b8c0e84732d4911a667c41c27bf927b65bff4ae1a78f7a5644e599c193dacab0",
      changedExposureWorkerChecks:3},
    actualExecutionCounts:{modelForwards:0,autogradGradCalls:0,backwardCalls:0,optimizerSteps:0,
      decodes:0,gpuQueries:0,checkpointReads:0,checkpointWrites:0,pngWrites:0,trainingRuns:0},
    boundary:{modelImported:false,modelExecuted:false,gpuQueried:false,trainingStarted:false,
      registryWritten:false,policyWritten:false,packagePrepared:false}};
  const acceptance={schemaVersion:"ai-painter-v24-resource-binding-controller-acceptance-v1",
    status:"v24_resource_binding_independently_verified_not_gpu_or_training_qualified",
    candidateId:updatePlan.candidateId,sourceResult:integrationPlan.checkerResult,
    verifiedCurrentProgramBindings:currentProgramBindings,verifiedHistoricalSnapshots:frozenSourceSnapshots,
    verifiedResourceRevisionPlan:resourceRevisionPlan,
    qualification:{gpu:false,training:false,visual:false,stage4Advanced:false}};
  const predecessorChecker=JSON.parse(fs.readFileSync(integrationPlan.predecessorCheckerResult.path,"utf8"));
  const predecessorAcceptance=JSON.parse(fs.readFileSync(integrationPlan.predecessorCheckerControllerAcceptance.path,"utf8"));
  pkg.policy={path:v24ResourceBoundObjectHeadCorePriorityPolicy,sha256:"f".repeat(64)};
  pkg.experimentIdentity="v24-resource-bound-core-priority-"+"1".repeat(40);
  pkg.outputRoot="fixture-v24-resource-bound";
  pkg.resources={...pkg.resources,maxWallSeconds:2700};
  Object.assign(pkg.inputs,{representationPlan,updatePlan,criticStatePlan,integrationPlan});
  Object.assign(pkg.config,{representationPlan,updatePlan,criticStatePlan,integrationPlan});
  Object.assign(result,{representationPlan,updatePlan,criticStatePlan,integrationPlan});
  proof.cases=proof.cases.map(entry=>({...entry,candidateId:updatePlan.candidateId,criticStatePlan}));
  result.artifacts=result.artifacts.filter(item=>!item.path.endsWith("/zero-update-gpu-probe.json"));
  result.artifacts.push({path:`${pkg.outputRoot}/zero-update-gpu-probe.json`,sha256:"e".repeat(64)});
  const readJson=path=>path===integrationPlan.checkerResult.path?checker:
    path===integrationPlan.checkerControllerAcceptance.path?acceptance:
    path===integrationPlan.predecessorCheckerResult.path?predecessorChecker:predecessorAcceptance;
  return {pkg,result,proof,checker,acceptance,predecessorChecker,
    predecessorAcceptance,readJson};
}

const bindExact=path=>path.includes("resource-binding-")?digest(path):bind(path);

test("V24 resource-bound V5 preserves inherited gates and verifies resource records",()=>{
  const value=fixture();
  assert.equal(value.pkg.resources.maxWallSeconds,2700);
  assert.equal(v24CriticModeObjectHeadCorePriorityValid(
    value.result,value.pkg,()=>value.proof,bindExact,value.readJson),true);
});

test("V24 resource-bound V5 rejects resource, inherited, checker, and acceptance weakening",()=>{
  const mutations=[
    v=>{v.pkg.policy.path="data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v4.json";},
    v=>{v.pkg.resources.maxWallSeconds=1800;},
    v=>{v.pkg.resources.maxWallSeconds=3600;},
    v=>{v.pkg.resources.maxGpuMemoryFraction=.8;},
    v=>{const p=v.pkg.inputs.integrationPlan;p.originalEvidence.sha256="0".repeat(64);v.pkg.config.integrationPlan=p;v.result.integrationPlan=p;},
    v=>{const p=v.pkg.inputs.integrationPlan;p.controller=p.frozenSourceSnapshots.controller;v.pkg.config.integrationPlan=p;v.result.integrationPlan=p;},
    v=>{v.proof.cases[0].conditionTensorSha256="missing";},
    v=>{v.proof.cases[0].generatorCandidate.nonHeadActualTotalIdentityPreserved=false;},
    v=>{v.proof.cases[0].discriminatorGradientFacts.allFinite=false;},
    v=>{v.proof.cases[0].criticStatePlan.restoration.generatorCommitFailure=false;},
    v=>{v.checker.actualExecutionCounts.modelForwards=1;},
    v=>{v.checker.protectedFacts.trainingAlgorithmAstIdentical=false;},
    v=>{v.checker.resourceRevisionPlan.maxWallSeconds=3600;},
    v=>{v.checker.predecessorCheckerResult.sha256="0".repeat(64);},
    v=>{v.predecessorChecker.actualExecutionCounts.trainingRuns=1;},
    v=>{v.predecessorAcceptance.qualification.gpu=true;},
    v=>{v.acceptance.sourceResult.sha256="0".repeat(64);},
    v=>{v.acceptance.qualification.gpu=true;},
    v=>{v.readJson=path=>{if(path.endsWith("resource-binding-acceptance.json"))throw new Error("missing");return v.checker;};},
  ];
  for(const mutate of mutations){
    const value=fixture();mutate(value);
    assert.equal(v24CriticModeObjectHeadCorePriorityValid(
      value.result,value.pkg,()=>value.proof,bindExact,value.readJson),false);
  }
});

test("consumed V1 through V4 policies fail before preparation",()=>{
  for(const version of [1,2,3,4]){
    const policy=`data/ai-painter/system-governance/stage4-mvp-v24-object-head-core-priority-policy-v${version}.json`;
    const result=spawnSync(process.execPath,["scripts/run-ai-painter-learning-capacity-experiment.mjs",
      "prepare","--policy",policy],{encoding:"utf8",windowsHide:true,timeout:10000});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/failed closed/u);
    assert.doesNotMatch(result.stdout,/experiment_prepared_not_gpu_started/u);
  }
});
