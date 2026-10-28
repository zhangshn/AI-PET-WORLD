import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyReplaySequenceArm} from '../lib/ai-painter-replay-retention-sequence-v1.mjs';
import {replayPolicies} from '../lib/ai-painter-replay-retention-fit-v1.mjs';
function fixture(){
  const policy=replayPolicies.short,p=JSON.parse(fs.readFileSync(policy,'utf8')),id='replay-retention-short-fixture',outputRoot='.runtime/ai-painter/learning-capacity-experiments/'+id;
  const visits={[p.sampleId]:100};
  const pkg={schemaVersion:'replay-retention-fit-package-v1',arm:'short',policy:{path:policy,sha256:'a'.repeat(64)},modelCapability:p.modelCapability,checkpoint:p.parentExperiment.checkpoint,parentExperiment:p.parentExperiment,training:p.training,selectedSampleIds:[p.sampleId],schedule:Array(100).fill(p.sampleId),plannedSampleVisits:visits,experimentIdentity:id,outputRoot};
  const result={experimentIdentity:id,arm:'short',modelCapability:p.modelCapability,status:'experiment_executed_not_visual_qualified',optimizerSteps:{generator:100,discriminator:100},plannedSampleVisits:visits,sampleVisits:visits,targetUpdates:100,replayUpdates:0,checkpointReloadExact:true,sameParentStartVerified:true,zeroUpdateAdmission:{selectedSampleCount:1,completedSampleCount:1,passed:true},formalQualificationGranted:false,artifacts:['checkpoint-final.pt','zero-update-gpu-probes.json','parent-output-continuity.json'].map(n=>({path:outputRoot+'/'+n,sha256:'b'.repeat(64)}))};
  const terminal={executionState:'completed',runId:id,executionPackage:{path:outputRoot+'/package.json',sha256:'a'.repeat(64)},exitCode:0,timedOut:false};
  const review={executionState:'completed',sourceRunId:id,optimizerUpdates:0,gpuInitialized:false,formalQualificationGranted:false,visualOutcome:'failed',report:{path:'.runtime/review/report.json',sha256:'c'.repeat(64)}};
  return {arm:'short',policy,terminal,pkg,result,review};
}
test('completed negative quality review permits only completion of the predeclared comparison',()=>{
  const f=fixture(),r=verifyReplaySequenceArm(f);assert.equal(r.visualOutcome,'failed');assert.equal(r.runId,f.terminal.runId);
});
test('incomplete training, failed review execution and foreign review cannot advance sequence',()=>{
  for(const mutate of [f=>f.result.optimizerSteps.generator--,f=>f.review.executionState='failed_closed',f=>f.review.sourceRunId='foreign-run',f=>f.terminal.timedOut=true]){
    const f=fixture();mutate(f);assert.throws(()=>verifyReplaySequenceArm(f));
  }
});
test('unknown visual outcome, absent report or training during review is not a completed comparison',()=>{
  for(const mutate of [f=>f.review.visualOutcome='unknown',f=>f.review.report=null,f=>f.review.optimizerUpdates=1,f=>f.review.gpuInitialized=true,f=>f.review.formalQualificationGranted=true]){
    const f=fixture();mutate(f);assert.throws(()=>verifyReplaySequenceArm(f));
  }
});
test('matching foreign terminal and review cannot substitute a different training package',()=>{
  const f=fixture();f.terminal.runId=f.review.sourceRunId='foreign-training-run';
  assert.throws(()=>verifyReplaySequenceArm(f),/different package/);
  const other=fixture();other.terminal.executionPackage.path='.runtime/ai-painter/foreign/package.json';
  assert.throws(()=>verifyReplaySequenceArm(other),/package path differs/);
});
