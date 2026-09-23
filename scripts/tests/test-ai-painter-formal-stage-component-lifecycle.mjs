// Test-only lifecycle integration. No production adapter registration or GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {PHASES,runAutonomousClosedLoop} from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
import {runBoundCpuCheckpointWorker} from '../lib/ai-painter-cpu-checkpoint-worker.mjs';
import {persistAudit} from '../audit-ai-painter-stage4-split-release.mjs';

const root=process.cwd(), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bind=p=>({path:p,sha256:hash(fs.readFileSync(path.resolve(root,p)))});
const self='scripts/tests/test-ai-painter-formal-stage-component-lifecycle.mjs';
const pythonScript='ml/ai-painter/tests/test_stage4_formal_stage_execution.py';
const parent='data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json';
const contract=JSON.parse(fs.readFileSync(parent));
const sources=[...new Set([self,pythonScript,parent,
  'ml/ai-painter/scripts/stage4_formal_stage_execution.py',
  'ml/ai-painter/src/ai_painter/complete_world/split_release.py',
  'ml/ai-painter/src/ai_painter/complete_world/split_training.py',
  'ml/ai-painter/src/ai_painter/complete_world/split_formal_training.py',
  'ml/ai-painter/src/ai_painter/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/diffusion.py',
  'ml/ai-painter/src/ai_painter/training/__init__.py',
  'ml/ai-painter/src/ai_painter/training/torch_runtime.py',
  ...Object.values(contract.programBindings).map(b=>b.path),
  'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs',
  'scripts/lib/ai-painter-cpu-checkpoint-worker.mjs',
  'scripts/lib/ai-painter-owned-worker-v1.mjs',
  'scripts/lib/ai-painter-owned-worker-native-v1.mjs',
  'scripts/windows/ai-painter-owned-worker-owner.cs',
])].map(bind);
const current='.runtime/ai-painter/current-execution-registry/current.json';
const registryBefore=bind(current);
assert.equal(JSON.parse(fs.readFileSync(current)).activeExecution,null);
const results=[];
for(const mode of ['none','epoch','reload','v7'])test(`formal epoch CPU lifecycle: ${mode}`,{timeout:90000},async()=>{
  const identity='formal-cpu-'+crypto.randomUUID(),calls=[];
  const spec={schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:identity,
    capabilityVersion:'formal-cpu-test-not-qualified',ownerAuthorizationRequired:false,ownerInStateMachine:false,
    maxInfrastructureRecoveryAttempts:0,outputRoot:'.runtime/ai-painter/formal-stage-cpu-tests/'+identity,
    programLineage:Object.fromEntries(sources.map((b,i)=>['source'+i,b.sha256])),inputEvidence:sources,
    phaseAdapters:Object.fromEntries(PHASES.map(phase=>[phase,{kind:'project_module_export',...bind(self),exportName:phase}]))};
  const pass=extra=>({status:'passed',syntheticCpuOnly:true,trainingAllowed:false,...extra});
  let invocation;
  const adapters={
    preflight:async()=>{calls.push('preflight');for(const b of sources)assert.deepEqual(bind(b.path),b);return pass({});},
    execute:async()=>{
      calls.push('execute');const executable=path.resolve(root,'ml/ai-painter/.venv/Scripts/python.exe');
      invocation=await runBoundCpuCheckpointWorker({root,executable:{path:executable,sha256:hash(fs.readFileSync(executable))},
        script:bind(pythonScript),args:['--formal-worker',identity,mode],programBindings:sources,timeoutMs:60000});
      return invocation.value.status==='passed'?pass({result:invocation.value}):
        {status:'failed',failureKind:'program',failureCode:'formal_cpu_component_failed',detail:invocation.value.error};
    },
    validate:async()=>{
      calls.push('validate');const value=invocation.value;
      assert.equal(value.stepEvidence.optimizerSteps,mode==='v7'?1920:48);
      if(mode==='v7'){
        assert.equal(value.schedule.completedEpochs,40);
        assert.equal(value.selectedEpoch,1);
        assert.equal(value.checkpointFormat,'v7');
      }
      assert.equal(value.stepEvidence.nonTrainOptimizerSteps,0);
      assert.deepEqual(bind(value.checkpoint.path),value.checkpoint);
      assert.equal(value.writtenStateSha256,value.reload.denoiserStateSha256);
      assert.equal(value.stagePassed,false);assert.equal(value.realDataTrainingStarted,false);
      return pass({checkpoint:value.checkpoint});
    },
    review:async()=>{calls.push('review');return pass({semanticReviewPerformed:false});},
    adjudicate:async()=>{calls.push('adjudicate');return pass({decision:'component_test_only'});},
    finalize:async()=>{calls.push('finalize');return pass({productionAdapterRegistered:false});},
  };
  const run=()=>runAutonomousClosedLoop({root,spec,packageSha256:hash(JSON.stringify(spec,null,2)+'\n'),adapters});
  const success=mode==='none'||mode==='v7';
  const state=await run();assert.equal(state.state,success?'completed':'failed_closed');
  assert.deepEqual(calls,success?PHASES:['preflight','execute']);
  const before=[...calls];assert.equal((await run()).state,state.state);assert.deepEqual(calls,before);
  assert.equal(invocation.ownedReceipt.cleanupConfirmed,true);
  assert.equal(invocation.ownedReceipt.proof.activeProcessesAfterCleanup,0);
  const executionRoot=path.resolve(root,'.runtime/ai-painter/autonomous-closed-loop-executions',identity);
  const db=new DatabaseSync(path.join(executionRoot,'execution.sqlite'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT state FROM executions').get().state,state.state);}finally{db.close();}
  assert.deepEqual(bind(current),registryBefore);
  results.push({mode,identity,state:state.state,calls,invocation,executionRoot,repeatDidNotExecute:true});
});
test('persist formal component lifecycle evidence',()=>{
  assert.equal(results.length,4);
  for(const b of sources)assert.deepEqual(bind(b.path),b);
  const evidence=persistAudit(root,{schemaVersion:'formal-stage-component-lifecycle-tests-v1',checkedAtUtc:new Date().toISOString(),
    results,sourceBindings:sources,registryBefore,registryAfter:bind(current),
    scope:'test_callbacks_existing_lifecycle_synthetic_data_and_test_double_trainer',
    productionAdapterRegistered:false,semanticReviewPerformed:false,
    realDataTrainingStarted:false,gpuStarted:false,trainingAllowed:false});
  console.log(JSON.stringify({evidence,cases:results.length}));
});
