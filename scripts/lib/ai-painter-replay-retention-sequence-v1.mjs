import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs';
import {replayPolicies,replaySucceeded} from './ai-painter-replay-retention-fit-v1.mjs';

const ROOT='.runtime/ai-painter/controller-repair-reviews/replay-retention-091-20261027';
const ENTRY='scripts/run-ai-painter-learning-capacity-experiment.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function verifyReplaySequenceArm({arm,policy,terminal,pkg,result,review}){
  assert.equal(terminal.executionState,'completed');
  assert.equal(pkg.arm,arm);assert.equal(pkg.policy.path,policy);
  assert.equal(terminal.runId,pkg.experimentIdentity,'training terminal belongs to different package');
  assert.equal(terminal.executionPackage?.path,pkg.outputRoot+'/package.json','training package path differs');
  assert.ok(replaySucceeded(result,pkg,terminal.exitCode,terminal.timedOut),'incomplete training');
  assert.equal(review.executionState,'completed','review execution failure stops comparison');
  assert.equal(review.sourceRunId,terminal.runId,'review belongs to different training');
  assert.equal(review.optimizerUpdates,0);assert.equal(review.gpuInitialized,false);
  assert.equal(review.formalQualificationGranted,false);
  assert.ok(review.report?.path&&review.report?.sha256,'no bound review report');
  // A completed diagnostic may report quality failure. The other predeclared
  // arm is still needed to distinguish replay from fewer target updates.
  assert.ok(['failed','component_checks_passed_not_qualified'].includes(review.visualOutcome));
  return {arm,policy,runId:terminal.runId,visualOutcome:review.visualOutcome,report:review.report};
}

async function runChild(root,policy,logPath){
  const fd=fs.openSync(logPath,'wx');let size=0,overflow=false;
  try{return await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[ENTRY,'run','--policy',policy],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const consume=bytes=>{const left=8*1024**2-size;if(bytes.length>left)overflow=true;if(left>0){const part=bytes.subarray(0,left);fs.writeSync(fd,part);size+=part.length;process.stdout.write(part)}};
    child.stdout.on('data',consume);child.stderr.on('data',consume);
    child.once('error',reject);
    child.once('close',code=>{if(overflow)reject(Error('comparison stream budget exceeded; child has closed'));else resolve(code)});
  })}finally{fs.closeSync(fd)}
}

export async function runReplayRetentionComparison(projectRoot=process.cwd()){
  const root=path.resolve(projectRoot);
  const absolute=p=>{assert.equal(typeof p,'string');assert.ok(!path.isAbsolute(p)&&!p.includes('\\')&&!p.includes(':')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'));return path.join(root,p)};
  const bind=p=>({path:p,sha256:hash(fs.readFileSync(absolute(p)))});
  const read=b=>{const bytes=fs.readFileSync(absolute(b.path));assert.equal(hash(bytes),b.sha256,b.path);return JSON.parse(bytes)};
  const put=(p,value)=>{fs.mkdirSync(path.dirname(absolute(p)),{recursive:true});fs.writeFileSync(absolute(p),JSON.stringify(value,null,2)+'\n',{flag:'wx'});return bind(p)};
  const initial=await readCurrentExecutionRegistry(root);assert.ok(initial.ok&&initial.registry.activeExecution===null,'active execution or invalid registry');
  const policies=Object.entries(replayPolicies).map(([arm,p])=>({arm,binding:bind(p),value:read(bind(p))}));
  assert.deepEqual(policies.map(x=>x.arm),['mixed','short']);
  assert.deepEqual(policies[0].value.parentExperiment,policies[1].value.parentExperiment);
  const frozen=[...policies.map(p=>p.binding),bind(ENTRY),bind('scripts/lib/ai-painter-replay-retention-sequence-v1.mjs'),bind('data/ai-painter/system-governance/ai-painter-replay-retention-review-policy-v1.json'),bind('docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md')];
  const results=[];let sharedPrograms=null;
  put(ROOT+'/sequence-started.json',{taskId:'REPLAY-RETENTION-091',startedAtUtc:new Date().toISOString(),sourceCategory:'local_program',frozen,initialRegistry:{revision:initial.registry.registryRevision,sha256:initial.registrySha256},trainingPairsCeiling:300,automaticRetries:0,executionFailureStopsSequence:true,qualityFailureDoesNotAuthorizeRelease:true,formalQualificationGranted:false});
  try{
    for(const item of policies){
      for(const b of frozen)assert.deepEqual(bind(b.path),b);
      if(sharedPrograms)for(const b of sharedPrograms)assert.deepEqual(bind(b.path),b,'source changed between comparison arms');
      const code=await runChild(root,item.binding.path,absolute(ROOT+'/'+item.arm+'-sequence.log'));
      assert.equal(code,0,'training or post-review execution failed');
      const current=await readCurrentExecutionRegistry(root);assert.ok(current.ok&&current.registry.activeExecution===null,'child did not close registry');
      const t=current.registry.latestTrainingTerminal;assert.ok(t?.path&&t?.sha256);
      const terminal=read(t),pkg=read(terminal.executionPackage),result=read(terminal.result);
      assert.equal(current.registry.taskKind,'readonly_post_training_visual_review');
      const reviewBinding=current.registry.terminalEvidence,review=read(reviewBinding);
      const summary=verifyReplaySequenceArm({arm:item.arm,policy:item.binding.path,terminal,pkg,result,review});
      read(review.report);
      for(const b of pkg.programs)assert.deepEqual(bind(b.path),b,'training source changed');
      const programs=[...pkg.programs].sort((a,b)=>a.path.localeCompare(b.path));
      if(sharedPrograms)assert.deepEqual(programs,sharedPrograms,'arms bind different source programs');
      else sharedPrograms=programs;
      results.push({...summary,package:terminal.executionPackage,terminal:{path:t.path,sha256:t.sha256},checkpoint:result.artifacts.find(b=>b.path===pkg.outputRoot+'/checkpoint-final.pt'),reviewTerminal:{path:reviewBinding.path,sha256:reviewBinding.sha256}});
      put(ROOT+'/sequence-completed-'+item.arm+'.json',results.at(-1));
    }
    const out=put(ROOT+'/sequence-result.json',{taskId:'REPLAY-RETENTION-091',sourceCategory:'local_program',status:'comparison_execution_completed_not_qualified',finishedAtUtc:new Date().toISOString(),results,comparisons:{A_B:'equal_total_pairs_different_sampling',B_C:'equal_target_exposure_unequal_compute',each_parent:'same_parent_48_train_8_development_validation'},automaticNextTraining:false,formalQualificationGranted:false});
    console.log(JSON.stringify({comparisonResult:out}));return out;
  }catch(error){put(ROOT+'/sequence-failure.json',{taskId:'REPLAY-RETENTION-091',sourceCategory:'local_program',status:'failed_closed',recordedAtUtc:new Date().toISOString(),error:String(error.stack??error),results,automaticRetries:0,formalQualificationGranted:false});throw error}
}
