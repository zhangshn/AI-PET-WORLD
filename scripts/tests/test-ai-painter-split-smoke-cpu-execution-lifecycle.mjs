// Integration regression, NOT production registration or semantic visual review.
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
const componentPath='data/ai-painter/system-governance/stage4-split-isolated-smoke-v2-5e5401aeb2a031342607dc404eb6547cfb3097871927964f0b169553a3021a0a.json';
const component=JSON.parse(fs.readFileSync(componentPath));
const pythonScript='ml/ai-painter/tests/test_stage4_split_smoke_cpu_execution.py';
const self='scripts/tests/test-ai-painter-split-smoke-cpu-execution-lifecycle.mjs';
const sources=[...new Set([componentPath,self,pythonScript,
  'ml/ai-painter/scripts/stage4_split_smoke_cpu_execution.py',
  'ml/ai-painter/scripts/stage4_split_smoke_checkpoint.py',
  'ml/ai-painter/tests/test_stage4_split_smoke.py',
  'ml/ai-painter/tests/test_stage4_semantic_transport_v2_trainer_support.py',
  'ml/ai-painter/src/ai_painter/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/diffusion.py',
  'ml/ai-painter/src/ai_painter/training/__init__.py',
  'ml/ai-painter/src/ai_painter/training/torch_runtime.py',
  ...Object.values(component.frozenProgramBindings).map(b=>b.path),...component.programBindings.map(b=>b.path),
  'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs',
  'scripts/lib/ai-painter-cpu-checkpoint-worker.mjs','scripts/lib/ai-painter-owned-worker-v1.mjs',
  'scripts/lib/ai-painter-owned-worker-native-v1.mjs','scripts/windows/ai-painter-owned-worker-owner.cs',
])].map(bind);
const registryBefore=bind('.runtime/ai-painter/current-execution-registry/current.json');
assert.equal(JSON.parse(fs.readFileSync(registryBefore.path)).activeExecution,null);
const results=[];
for(const mode of ['none','epoch','reload'])test(`assembled CPU lifecycle: ${mode}`,{timeout:90000},async()=>{
  const identity='cpu-assembly-'+crypto.randomUUID(), calls=[];
  const spec={schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:identity,
    capabilityVersion:'cpu-synthetic-assembly-not-qualified',ownerAuthorizationRequired:false,ownerInStateMachine:false,
    maxInfrastructureRecoveryAttempts:0,outputRoot:'.runtime/ai-painter/split-smoke-cpu-execution-tests/'+identity,
    programLineage:Object.fromEntries(sources.map((b,i)=>['source'+i,b.sha256])),inputEvidence:sources,
    phaseAdapters:Object.fromEntries(PHASES.map(phase=>[phase,{kind:'project_module_export',...bind(self),exportName:phase}]))};
  const pass=extra=>({status:'passed',syntheticCpuOnly:true,trainingAllowed:false,...extra});
  let invocation;
  const adapters={
    preflight:async()=>{calls.push('preflight');for(const b of sources)assert.deepEqual(bind(b.path),b);return pass({});},
    execute:async()=>{
      calls.push('execute');const executable=path.resolve(root,'ml/ai-painter/.venv/Scripts/python.exe');
      invocation=await runBoundCpuCheckpointWorker({root,executable:{path:executable,sha256:hash(fs.readFileSync(executable))},
        script:bind(pythonScript),args:['--assembly-worker',identity,mode],programBindings:sources,timeoutMs:60000});
      if(invocation.value.status!=='passed')return {status:'failed',failureKind:'program',failureCode:'cpu_assembly_failed',
        detail:invocation.value.error,trainingAllowed:false};
      return pass({assembly:invocation.value.assembly});
    },
    validate:async()=>{
      calls.push('validate');const a=invocation.value.assembly;
      assert.equal(a.training.epochEvidence.stepEvidence.optimizerSteps,1);
      assert.equal(a.training.epochEvidence.stepEvidence.nonTrainOptimizerSteps,0);
      assert.equal(a.training.denoiserStateSha256,a.reload.denoiserStateSha256);
      assert.deepEqual(bind(a.training.checkpoint.path),a.training.checkpoint);
      assert.equal(a.initialization.historicalDenoiserLoaded,false);
      assert.equal(a.initialization.foundationCheckpointAuthenticated,false);
      return pass({checkpoint:a.training.checkpoint});
    },
    review:async()=>{calls.push('review');return pass({semanticReviewPerformed:false,scope:'component_evidence_consistency_only'});},
    adjudicate:async()=>{calls.push('adjudicate');return pass({decision:'cpu_integration_only_no_qualification'});},
    finalize:async()=>{calls.push('finalize');return pass({releaseAllowed:false,productionAdapterRegistered:false});},
  };
  const run=()=>runAutonomousClosedLoop({root,spec,packageSha256:hash(JSON.stringify(spec,null,2)+'\n'),adapters});
  const state=await run();assert.equal(state.state,mode==='none'?'completed':'failed_closed');
  assert.deepEqual(calls,mode==='none'?PHASES:['preflight','execute']);
  const before=[...calls];assert.equal((await run()).state,state.state);assert.deepEqual(calls,before);
  assert.equal(invocation.ownedReceipt.cleanupConfirmed,true);
  assert.equal(invocation.ownedReceipt.proof.activeProcessesAfterCleanup,0);
  if(mode!=='none')assert.equal(invocation.value.checkpointReserved,true);
  const executionRoot=path.resolve(root,'.runtime/ai-painter/autonomous-closed-loop-executions',identity);
  const db=new DatabaseSync(path.join(executionRoot,'execution.sqlite'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT state FROM executions').get().state,state.state);}finally{db.close();}
  assert.deepEqual(bind(registryBefore.path),registryBefore);
  results.push({mode,identity,state:state.state,calls,invocation,executionRoot,repeatDidNotExecute:true});
});
test('save CPU assembly lifecycle evidence',()=>{
  for(const b of sources)assert.deepEqual(bind(b.path),b);
  const evidence=persistAudit(root,{schemaVersion:'cpu-assembly-lifecycle-integration-tests-v1',checkedAtUtc:new Date().toISOString(),
    results,sourceBindings:sources,registryBefore,registryAfter:bind(registryBefore.path),
    complete:results.length===3,productionAdapterRegistered:false,
    scope:'test_callbacks_existing_lifecycle_synthetic_foundation_and_data',
    semanticReviewPerformed:false,realDataTrainingStarted:false,gpuStarted:false,trainingAllowed:false});
  console.log(JSON.stringify({evidence,cases:results.length}));assert.equal(results.length,3);
});
