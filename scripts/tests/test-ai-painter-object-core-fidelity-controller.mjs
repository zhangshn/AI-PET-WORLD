import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {objectCoreObjectiveValid, objectCoreFidelityPolicy, heartbeatPublicationRule,
  wholeFrameFidelityPolicy} from '../run-ai-painter-learning-capacity-experiment.mjs';

const bind = path => ({path, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex')});
function fixture() {
  const inheritedObjectivePlan = JSON.parse(fs.readFileSync(wholeFrameFidelityPolicy, 'utf8')).inputs.objectivePlan;
  const plan = {candidateId:'stage4_mvp_v21_object_core_fidelity_cpu_candidate_v1',
    program:bind('ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_core_fidelity_candidate_cpu.py'),
    tests:bind('ml/ai-painter/tests/test_native_rgb_object_core_fidelity_candidate_cpu.py'),
    cpuEvidence:bind('.runtime/ai-painter/stage4-mvp-v21-object-core-fidelity-cpu-prototype/report.json'),
    inheritedObjectivePlan, formula:'unchanged_whole_frame_fidelity_total_plus_equal_nonempty_role_core_rgb_l1',
    coreRgbWeight:1, roles:['object_footprints','object_tree','object_rock','object_vegetation'], maskDilation:false,
    coefficientSelection:'fixed_one_no_search', targetSplit:'train', existingTermsPreserved:true, qualificationGranted:false,
    historicalComparisonPurpose:'changed_loss_comparison_not_numerical_reproduction'};
  const selectedRows=Array.from({length:48},(_,trainOrdinal)=>({sampleId:`train-${trainOrdinal}`,split:'train',trainOrdinal}));
  const pkg={policy:{path:objectCoreFidelityPolicy},inputs:{objectivePlan:plan,heartbeatPublicationRule:structuredClone(heartbeatPublicationRule)},outputRoot:'fixture-output',selectedRows};
  const proof={passed:true,caseCount:48,optimizerCreated:false,optimizerSteps:{generator:0,discriminator:0},
    cases:selectedRows.map(row=>({objectiveId:plan.candidateId,case:row,passed:true,optimizerCreated:false,
      optimizerSteps:{generator:0,discriminator:0},initialStateSha256:{Model:'a'.repeat(64),Critic:'b'.repeat(64)},
      finalStateSha256:{Model:'a'.repeat(64),Critic:'b'.repeat(64)},
      objectiveTerms:{v21UnchangedTotal:.2,wholeFrameRgbMae:.1,wholeFrameSignedEdgeMae:.1,wholeFrameFidelity:.125,
        wholeFrameFidelityUnchangedTotal:.325,objectCoreRgbMae:.1,objectCoreRgbWeighted:.1,objectCoreApplicableRoleCount:4,total:.425}}))};
  const result={objectivePlan:plan,heartbeatPublicationRule:structuredClone(heartbeatPublicationRule),zeroUpdateGpuProbePassed:true,
    historicalComparisonPurpose:plan.historicalComparisonPurpose,
    artifacts:[{path:'fixture-output/zero-update-gpu-probe.json',sha256:'c'.repeat(64)}]};
  return {pkg,result,proof};
}

test('current core objective and all 48 fresh no-update cases validate without mutating evidence',()=>{
  const {pkg,result,proof}=fixture();
  const before=JSON.stringify({pkg,result,proof});
  assert.equal(objectCoreObjectiveValid(result,pkg,()=>proof),true);
  assert.equal(JSON.stringify({pkg,result,proof}),before);
});
test('new formula, masks, program, inherited objective and policy must be exact',()=>{
  const {pkg,result,proof}=fixture();
  for(const mutate of [x=>{x.coreRgbWeight=.5;},x=>{x.maskDilation=true;},x=>{x.roles.pop();},
    x=>{x.program.sha256='a'.repeat(64);},x=>{x.targetSplit='validation';},x=>{x.qualificationGranted=true;},
    x=>{x.inheritedObjectivePlan.edgeWeight=0;},x=>{x.cpuEvidence.sha256='b'.repeat(64);}]) {
    const bad=structuredClone(pkg); mutate(bad.inputs.objectivePlan);
    const badResult={...result,objectivePlan:bad.inputs.objectivePlan};
    assert.equal(objectCoreObjectiveValid(badResult,bad,()=>proof),false);
  }
  assert.equal(objectCoreObjectiveValid(result,{...pkg,policy:{path:wholeFrameFidelityPolicy}},()=>proof),false);
});
test('partial, stale, updated or skipped-core GPU evidence fails closed',()=>{
  const {pkg,result,proof}=fixture();
  for(const mutate of [x=>{x.cases.pop();},x=>{x.optimizerCreated=true;},x=>{x.optimizerSteps.generator=1;},
    x=>{x.cases[1].objectiveId='old';},x=>{x.cases[1].case.sampleId='foreign';},
    x=>{x.cases[1].finalStateSha256.Model='c'.repeat(64);},x=>{x.cases[1].objectiveTerms.objectCoreRgbMae=NaN;},
    x=>{x.cases[1].objectiveTerms.objectCoreRgbWeighted=0;},x=>{x.cases[1].objectiveTerms.total=.325;},
    x=>{x.cases[1].objectiveTerms.objectCoreApplicableRoleCount=0;},x=>{x.cases[1].objectiveTerms.objectCoreApplicableRoleCount=1.5;},
    x=>{x.cases[1].objectiveTerms.wholeFrameFidelityUnchangedTotal=.2;},x=>{x.cases[1].case.split='validation';}]) {
    const bad=structuredClone(proof);mutate(bad);
    assert.equal(objectCoreObjectiveValid(result,pkg,()=>bad),false);
  }
});
test('caller flags do not replace source proof or unchanged resource publication rules',()=>{
  const {pkg,result,proof}=fixture();
  assert.equal(objectCoreObjectiveValid({...result,artifacts:[]},pkg,()=>proof),false);
  assert.equal(objectCoreObjectiveValid({...result,zeroUpdateGpuProbePassed:'true'},pkg,()=>proof),false);
  assert.equal(objectCoreObjectiveValid(result,pkg,()=>{throw Error('proof binding conflict');}),false);
  const bad=structuredClone(pkg);bad.inputs.heartbeatPublicationRule.automaticTrainingRetries=1;
  assert.equal(objectCoreObjectiveValid(result,bad,()=>proof),false);
});
