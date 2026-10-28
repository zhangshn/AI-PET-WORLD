// One explicitly bound CPU review recovery; never invokes training or the091sequence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {runReplayRetentionReviewRecovery} from './lib/ai-painter-replay-retention-review-recovery-v1.mjs';
import {reviewThenDeliver,deliverPostReviewRecords} from './lib/ai-painter-post-review-delivery-v1.mjs';

const SELF='scripts/run-ai-painter-replay-retention-review-recovery-v1.mjs';
const OUT='.runtime/ai-painter/controller-repair-reviews/review-recovery-092-20261027';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function validateRecoveryEntry(registry,packageJson){
  assert(registry.currentEntrypoints.some(e=>e.entryFile===SELF
    &&e.packageScript==='run:ai-painter-replay-retention-review-recovery'
    &&e.role==='exact_failed_zero_forward_review_recovery_cpu_only_no_training_or_qualification'));
  assert.equal(packageJson.scripts['run:ai-painter-replay-retention-review-recovery'],'node '+SELF);
}
async function main(){
  assert.equal(process.argv.length,2,'no arbitrary source, policy, retry, or training arguments');
  const root=process.cwd();
  validateRecoveryEntry(JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json')),JSON.parse(fs.readFileSync('package.json')));
  const results=[];
  for(const [name,exe,args]of [
    ['node',process.execPath,['--test','scripts/tests/test-ai-painter-replay-retention-review-recovery.mjs']],
    ['python',path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-B','-m','unittest','discover','-s','ml/ai-painter/tests','-p','test_replay_retention_review_recovery_v1.py']]
  ]){
    const startedAtUtc=new Date().toISOString();
    const p=spawnSync(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:2*1024**2,
      env:{...process.env,CUDA_VISIBLE_DEVICES:'-1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',PYTHONDONTWRITEBYTECODE:'1'}});
    results.push({name,command:[exe,...args],startedAtUtc,finishedAtUtc:new Date().toISOString(),exitCode:p.status,error:p.error?.message??null,stdout:p.stdout,stderr:p.stderr});
    if(p.status!==0)break;
  }
  fs.mkdirSync(OUT,{recursive:true});
  const testsPath=OUT+'/entry-tests-'+Date.now()+'.json';
  fs.writeFileSync(testsPath,JSON.stringify({taskId:'REVIEW-RECOVERY-092',sourceCategory:'local_program',scope:'synthetic_CPU_tests_no_model',results},null,2)+'\n',{flag:'wx'});
  assert.equal(results.length,2);assert(results.every(r=>r.exitCode===0),'CPU recovery tests failed');
  const result=await reviewThenDeliver(()=>runReplayRetentionReviewRecovery({projectRoot:root}),
    ()=>deliverPostReviewRecords({projectRoot:root}),delivery=>console.log(JSON.stringify({postReviewWorkDelivery:delivery})));
  const file=OUT+'/execution-result.json';
  const value={taskId:'REVIEW-RECOVERY-092',sourceCategory:'local_program',recordedAtUtc:new Date().toISOString(),status:'readonly_review_recovery_execution_completed_not_qualified',tests:{path:testsPath,sha256:sha(fs.readFileSync(testsPath))},result,trainingUpdates:0,formalQualificationGranted:false};
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({executionResult:{path:file,sha256:sha(fs.readFileSync(file))}}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  main().catch(error=>{console.error(error);process.exitCode=1;});
}
