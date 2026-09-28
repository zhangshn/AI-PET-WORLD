import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {wholeFrameObjectiveValid, wholeFrameFidelityPolicy, heartbeatPublicationRule, exposureComparisonDiagnosticValid} from '../run-ai-painter-learning-capacity-experiment.mjs';

const bind = path => ({path, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex')});
function fixture() {
  const plan = {candidateId:'stage4_mvp_v21_whole_frame_fidelity_cpu_candidate_v1',
    program:bind('ml/ai-painter/src/ai_painter/complete_world/native_rgb_whole_frame_fidelity_candidate_cpu.py'),
    tests:bind('ml/ai-painter/tests/test_native_rgb_whole_frame_fidelity_candidate_cpu.py'),
    cpuEvidence:bind('.runtime/ai-painter/learning-capacity-experiments/v21-full-train-exposure-5464211239b5f3b53e0a2675c9fe5f7e208c21ab7bbb6ed6/controller-whole-frame-fidelity-cpu-candidate.json'),
    formula:'unchanged_v21_total_plus_full_rgb_l1_plus_signed_adjacent_edge_l1',
    rgbWeight:1, edgeWeight:.25, coefficientSelection:'fixed_inherited_v13_coefficients_no_search',
    targetSplit:'train', existingTermsPreserved:true, qualificationGranted:false,
    historicalComparisonPurpose:'changed_loss_comparison_not_numerical_reproduction'};
  const selectedRows=Array.from({length:48},(_,trainOrdinal)=>({sampleId:`train-${trainOrdinal}`,split:'train',trainOrdinal}));
  const pkg={policy:{path:wholeFrameFidelityPolicy},inputs:{objectivePlan:plan,heartbeatPublicationRule:structuredClone(heartbeatPublicationRule)},outputRoot:'fixture-output',selectedRows};
  const proof={passed:true,caseCount:48,optimizerCreated:false,optimizerSteps:{generator:0,discriminator:0},
    cases:selectedRows.map(row=>({objectiveId:plan.candidateId,case:row,passed:true,optimizerCreated:false,
      optimizerSteps:{generator:0,discriminator:0},initialStateSha256:{Model:'a'.repeat(64),Critic:'b'.repeat(64)},
      finalStateSha256:{Model:'a'.repeat(64),Critic:'b'.repeat(64)},
      objectiveTerms:{v21UnchangedTotal:.2,wholeFrameRgbMae:.1,wholeFrameSignedEdgeMae:.1,wholeFrameFidelity:.125}}))};
  const result={objectivePlan:plan,heartbeatPublicationRule:structuredClone(heartbeatPublicationRule),zeroUpdateGpuProbePassed:true,historicalComparisonPurpose:plan.historicalComparisonPurpose,
    artifacts:[{path:'fixture-output/zero-update-gpu-probe.json',sha256:'c'.repeat(64)}]};
  return {pkg,result,proof};
}
test('current objective identity plus complete zero-update GPU evidence are required',()=>{
  const {pkg,result,proof}=fixture();
  assert.equal(wholeFrameObjectiveValid(result,pkg,()=>proof),true);
  for(const mutate of [x=>{x.rgbWeight=.5;},x=>{x.edgeWeight=0;},x=>{x.targetSplit='validation';},
    x=>{x.program.sha256='a'.repeat(64);},x=>{x.existingTermsPreserved=false;}]){
    const changed=structuredClone(pkg);mutate(changed.inputs.objectivePlan);
    assert.equal(wholeFrameObjectiveValid(result,changed,()=>proof),false);
  }
  assert.equal(wholeFrameObjectiveValid({...result,artifacts:[]},pkg,()=>proof),false);
  assert.equal(wholeFrameObjectiveValid({...result,zeroUpdateGpuProbePassed:'true'},pkg,()=>proof),false);
  assert.equal(wholeFrameObjectiveValid(result,pkg,()=>{throw Error('SHA/source conflict');}),false);
});
test('partial, foreign, updated or nonfinite GPU reports cannot qualify completion',()=>{
  const {pkg,result,proof}=fixture();
  for(const mutate of [x=>{x.cases.pop();},x=>{x.optimizerCreated=true;},x=>{x.optimizerSteps.generator=1;},
    x=>{x.cases[1].case.sampleId='foreign';},x=>{x.cases[1].case.split='validation';},
    x=>{x.cases[1].finalStateSha256.Model='c'.repeat(64);},x=>{x.cases[1].passed=false;},
    x=>{x.cases[1].objectiveId='old_objective';},x=>{x.cases[1].objectiveTerms.wholeFrameFidelity=NaN;}]){
    const bad=structuredClone(proof);mutate(bad);
    assert.equal(wholeFrameObjectiveValid(result,pkg,()=>bad),false);
  }
});
test('changed-loss historical comparison keeps its original numerical distance, not a qualification gate',()=>{
  const rule={epoch:24,maximumAbsoluteMedianCorrelationDifferenceEachRole:.03,maximumRelativeMeanRgbMaeDifference:.05,
    all48CorrelationsRequiredEachRole:true,failureAction:'diagnostic_only_no_early_stop',invalidEvidenceAction:'fail_closed',formalAuditThreshold:false};
  const objects=Object.fromEntries(['object_footprints','object_tree','object_rock','object_vegetation']
    .map(role=>[role,{validCorrelationCount:48,medianCorrelation:.5}]));
  const report={passed:false,evidenceValid:true,rule,actual:{meanRgbMae:.12,objects},reference:{meanRgbMae:.1,objects:structuredClone(objects)},
    medianCorrelationAbsoluteDifferences:Object.fromEntries(Object.keys(objects).map(role=>[role,0])),meanRgbMaeRelativeDifference:Math.abs(.12-.1)/.1};
  const result={epoch24ReproductionEvidenceValid:true,epoch24ReproductionPassed:false,epoch24Reproduction:report};
  const pkg={policy:{path:wholeFrameFidelityPolicy},inputs:{reproductionRule:rule}};
  assert.equal(exposureComparisonDiagnosticValid(result,pkg),true);
  assert.equal(exposureComparisonDiagnosticValid({...result,epoch24ReproductionPassed:true},pkg),false);
});
test('v2 heartbeat binding is exact and cannot qualify old or unbound results',()=>{
  const {pkg,result,proof}=fixture();
  for (const target of ['package','result']) {
    for (const mutate of [r=>{r.maxWaitMilliseconds=2001;},r=>{r.automaticTrainingRetries=1;},
      r=>{r.preservePreviousHeartbeat=false;}]) {
      const badPkg=structuredClone(pkg),badResult=structuredClone(result);
      mutate(target==='package'?badPkg.inputs.heartbeatPublicationRule:badResult.heartbeatPublicationRule);
      assert.equal(wholeFrameObjectiveValid(badResult,badPkg,()=>proof),false);
    }
  }
  const old=structuredClone(pkg);old.policy.path=wholeFrameFidelityPolicy.replace('v2.json','v1.json');
  assert.equal(wholeFrameObjectiveValid(result,old,()=>proof),false);
});
test('consumed fidelity v1 dispatch is refused before preparing or spawning training',()=>{
  const result=spawnSync(process.execPath,['scripts/run-ai-painter-learning-capacity-experiment.mjs','run','--policy',
    wholeFrameFidelityPolicy.replace('v2.json','v1.json')],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(result.status,1);
  assert.match(result.stderr,/whole-frame fidelity v1 was consumed and failed closed/);
  assert.equal(result.stdout,'');
});
