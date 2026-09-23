import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {verifyCheckpointReloadEvidence} from '../lib/ai-painter-checkpoint-reload-evidence.mjs';
import {PHASES, runAutonomousClosedLoop} from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
import {runBoundCpuCheckpointWorker} from '../lib/ai-painter-cpu-checkpoint-worker.mjs';

const workspace=process.cwd();
const parent=path.resolve('.runtime/ai-painter/checkpoint-reload-cpu-tests');
fs.mkdirSync(parent,{recursive:true});
assert.equal(fs.realpathSync(parent),path.join(fs.realpathSync('.runtime'),'ai-painter','checkpoint-reload-cpu-tests'));
const evidenceRoot=fs.mkdtempSync(path.join(parent,'run-'));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=b=>Buffer.from(JSON.stringify(b,null,2)+'\n');
const workerPath='scripts/fixtures/ai-painter-checkpoint-reload-cpu.mjs';
const sourceBindings=[workerPath,'scripts/lib/ai-painter-checkpoint-reload-evidence.mjs',
 'scripts/lib/ai-painter-stage4-dataset-audit.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs',
 'scripts/tests/test-ai-painter-checkpoint-reload-lifecycle.mjs',
 'scripts/lib/ai-painter-cpu-checkpoint-worker.mjs',
 'scripts/lib/ai-painter-owned-worker-v1.mjs',
 'scripts/lib/ai-painter-owned-worker-native-v1.mjs',
 'scripts/windows/ai-painter-owned-worker-owner.cs',
 'ml/ai-painter/tests/test_stage4_split_smoke_checkpoint.py',
 'ml/ai-painter/scripts/stage4_split_smoke_checkpoint.py',
 'ml/ai-painter/scripts/stage4_split_isolated_smoke.py',
 'ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py',
 'ml/ai-painter/src/ai_painter/complete_world/model.py',
 'ml/ai-painter/src/ai_painter/complete_world/stage4_semantic_transport_v2.py',
 'ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py',
 'ml/ai-painter/tests/test_stage4_split_smoke.py',
 'ml/ai-painter/tests/test_stage4_semantic_transport_v2_trainer_support.py',
 'ml/ai-painter/src/ai_painter/complete_world/split_release.py',
 'ml/ai-painter/src/ai_painter/complete_world/split_training.py'
 ].map(p=>({path:p,sha256:digest(fs.readFileSync(p))}));
const results=[];
function fixture(name){
  const root=fs.mkdtempSync(path.join(evidenceRoot,name+'-'));
  const put=(p,v)=>{const target=path.join(root,p);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,Buffer.isBuffer(v)?v:json(v));return bind(p);};
  const bind=p=>({path:p,sha256:digest(fs.readFileSync(path.join(root,p)))});
  const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
  const worker=put(workerPath,fs.readFileSync(workerPath));
  const data=put('data.fixture.json',[{id:'fixture-train-a',x:1,y:2},{id:'fixture-train-b',x:2,y:4}]);
  const request={schemaVersion:'ai-painter-checkpoint-reload-request-v1',runId:'cpu-fixture-'+name,
    capabilityVersion:'cpu-fixture-not-painter',evidenceScope:'cpu_fixture_only',
    sampleIds:['fixture-train-a','fixture-train-b'],optimizerSteps:1,comparison:'exact_fixed_probe_outputs',
    data,trainerProgram:worker,reloadProgram:worker};
  const requestBinding=put('request.json',request);
  const invoke=mode=>execFileSync(process.execPath,[path.join(root,workerPath),mode,root,requestBinding.path,requestBinding.sha256],
    {cwd:root,windowsHide:true,shell:false,timeout:5000,maxBuffer:65536});
  const verify=()=>verifyCheckpointReloadEvidence({root,requestBinding,trainingBinding:bind('training.json'),reloadBinding:bind('reload.json')});
  return {root,put,bind,read,worker,request,requestBinding,invoke,verify};
}
async function check(name,fn){
  try{await fn();results.push({name,status:'passed'});}
  catch(e){results.push({name,status:'failed',error:String(e.stack)});throw e;}
}

test('real CPU fixture checkpoint reload in a separate process',()=>check('fresh-process-reload',()=>{
  const f=fixture('positive');f.invoke('train');f.invoke('reload');
  const result=f.verify();assert.equal(result.status,'checkpoint_reload_consistent_not_qualified');
  assert.notEqual(f.read('training.json').pid,f.read('reload.json').pid);
  assert.deepEqual(f.read('reload.json').outputs,[1,2]);
  for(const key of ['producerProcessIdentityVerified','modelSemanticsVerified','trainingAllowed','releaseAllowed','dataQualified','gpuQualified']) assert.equal(result[key],false);
  f.put('verification.json',result);
}));

for(const [name,file,mutate,error] of [
 ['cross-run','reload.json',r=>r.runId='other',/runId_mismatch/],
 ['cross-capability','reload.json',r=>r.capabilityVersion='other',/capabilityVersion_mismatch/],
 ['scope-promotion','reload.json',r=>r.evidenceScope='candidate_evidence_only',/evidenceScope_mismatch/],
 ['same-process','reload.json',(r,f)=>r.pid=f.read('training.json').pid,/distinct_recorded/],
 ['probe-drift','reload.json',r=>r.outputs[0]+=1,/reproduction_mismatch/],
 ['sample-substitution','reload.json',r=>r.sampleIds[0]='holdout',/sample_identity/],
 ['optimizer-during-reload','reload.json',r=>r.optimizerSteps=1,/reload_must_not/],
 ['nontrain-update','training.json',r=>r.nonTrainOptimizerSteps=1,/nontrain_update/],
 ['wrong-steps','training.json',r=>r.optimizerSteps=2,/optimizer_step_mismatch/],
 ['wrong-checkpoint','reload.json',r=>r.loadedCheckpoint.sha256='a'.repeat(64),/loaded_checkpoint/],
 ['wrong-program','reload.json',r=>r.program.sha256='a'.repeat(64),/reload_program/],
 ['gpu-report','reload.json',r=>r.device='cuda',/cpu_evidence_required/],
])test(name,()=>check(name,()=>{
  const f=fixture(name);f.invoke('train');f.invoke('reload');
  const record=f.read(file);mutate(record,f);f.put(file,record);
  assert.throws(f.verify,error);
}));

test('checkpoint tamper despite caller pass flag',()=>check('tamper-despite-pass',()=>{
  const f=fixture('tamper');f.invoke('train');f.invoke('reload');
  f.put('checkpoint.fixture.json',{fixtureOnly:true,weight:99});
  const record=f.read('reload.json');record.passed=true;record.trainingAllowed=true;f.put('reload.json',record);
  assert.throws(f.verify,/SHA mismatch/);
}));

test('missing checkpoint rejects',()=>check('missing-checkpoint',()=>{
  const f=fixture('missing');f.invoke('train');f.invoke('reload');
  const r=f.read('training.json');r.checkpoint.path='not-created.fixture';f.put('training.json',r);
  assert.throws(f.verify,/ENOENT/);
}));

function coreFixture(name){
  const f=fixture(name);
  for(const p of ['data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json',
    'data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json'])f.put(p,fs.readFileSync(p));
  const spec={schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:'cpu-fixture-'+name,
    capabilityVersion:f.request.capabilityVersion,ownerAuthorizationRequired:false,ownerInStateMachine:false,
    maxInfrastructureRecoveryAttempts:0,outputRoot:'.runtime/ai-painter/fixture-output/'+name,
    programLineage:{fixture:f.worker.sha256},inputEvidence:[f.requestBinding,f.worker],
    phaseAdapters:Object.fromEntries(PHASES.map(phase=>[phase,{kind:'project_module_export',...f.worker,exportName:phase}]))};
  const packageSha256=digest(json(spec)),calls=[];
  let validation;
  const adapters={
    preflight:async()=>{calls.push('preflight');assert.equal(f.request.evidenceScope,'cpu_fixture_only');return {status:'passed',fixtureOnly:true};},
    execute:async()=>{calls.push('execute');f.invoke('train');return {status:'passed',fixtureOnly:true,training:f.bind('training.json')};},
    validate:async()=>{calls.push('validate');f.invoke('reload');validation=f.verify();return {status:'passed',fixtureOnly:true,validation};},
    review:async()=>{calls.push('review');assert.equal(validation.trainingAllowed,false);assert.deepEqual(f.read('reload.json').outputs,[1,2]);return {status:'passed',fixtureOnly:true,notVisualJudge:true};},
    adjudicate:async()=>{calls.push('adjudicate');return {status:'passed',fixtureOnly:true,trainingAllowed:false,releaseAllowed:false};},
    finalize:async()=>{calls.push('finalize');return {status:'passed',fixtureOnly:true,checkpoint:f.bind('checkpoint.fixture.json'),trainingAllowed:false};},
  };
  const run=()=>runAutonomousClosedLoop({root:f.root,spec,packageSha256,adapters});
  return {...f,spec,adapters,calls,run,executionRoot:path.join(f.root,'.runtime/ai-painter/autonomous-closed-loop-executions',spec.packageIdentity)};
}

test('existing lifecycle completes six phases and repeat does not retrain',()=>check('six-phase-success-no-replay',async()=>{
  const f=coreFixture('six-phase');assert.equal((await f.run()).state,'completed');
  assert.deepEqual(f.calls,PHASES);const cp=f.bind('checkpoint.fixture.json');
  assert.equal((await f.run()).state,'completed');assert.deepEqual(f.calls,PHASES);assert.deepEqual(f.bind('checkpoint.fixture.json'),cp);
  const db=new DatabaseSync(path.join(f.executionRoot,'execution.sqlite'),{readOnly:true});
  try {assert.equal(db.prepare('SELECT COUNT(*) AS n FROM artifacts').get().n,6);
    assert.equal(db.prepare('SELECT state FROM executions').get().state,'completed');}finally{db.close();}
  f.put('case-result.json',{state:'completed',fixtureOnly:true,calls:f.calls,checkpoint:cp});
}));

for(const phase of PHASES)test(`failure at ${phase} blocks successor`,()=>check('failure-'+phase,async()=>{
  const f=coreFixture('failure-'+phase),index=PHASES.indexOf(phase);
  f.adapters[phase]=async()=>{f.calls.push(phase);return {status:'failed',failureKind:'program',failureCode:'fixture_injected_'+phase};};
  const first=await f.run();assert.equal(first.state,'failed_closed');assert.equal(first.phase,phase);
  assert.deepEqual(f.calls,PHASES.slice(0,index+1));const terminal=f.bind(path.relative(f.root,path.join(f.executionRoot,'phase-terminal.json')).replaceAll('\\','/'));
  assert.equal((await f.run()).state,'failed_closed');assert.deepEqual(f.calls,PHASES.slice(0,index+1));
  assert.deepEqual(f.bind(terminal.path),terminal);
}));

test('real V2 Trainer and separate reload complete existing lifecycle without replay', {timeout:120000},
 ()=>check('real-v2-six-phase-no-replay',async()=>{
  const python=path.join(workspace,'ml/ai-painter/.venv/Scripts/python.exe');
  assert.ok(fs.existsSync(python),'project Python runtime required; never silently skip');
  const pythonTest='ml/ai-painter/tests/test_stage4_split_smoke_checkpoint.py';
  const inputEvidence=sourceBindings.map(b=>({...b}));
  const identity='cpu-v2-reload-'+crypto.randomUUID();
  const spec={schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:identity,
    capabilityVersion:'cpu-real-v2-component-test',ownerAuthorizationRequired:false,ownerInStateMachine:false,
    maxInfrastructureRecoveryAttempts:0,outputRoot:'.runtime/ai-painter/checkpoint-reload-cpu-tests/'+identity,
    programLineage:Object.fromEntries(inputEvidence.map((b,i)=>['source'+i,b.sha256])),inputEvidence,
    phaseAdapters:Object.fromEntries(PHASES.map(phase=>[phase,{kind:'project_module_export',
      ...sourceBindings.find(b=>b.path==='scripts/tests/test-ai-painter-checkpoint-reload-lifecycle.mjs'),exportName:phase}]))};
  const registryPath=path.join(workspace,'.runtime/ai-painter/current-execution-registry/current.json');
  const registryBefore=digest(fs.readFileSync(registryPath)), calls=[];
  const ownedInvocations=[];
  const invoke=async(...args)=>{
    const result=await runBoundCpuCheckpointWorker({root:workspace,
      executable:{path:python,sha256:digest(fs.readFileSync(python))},
      script:sourceBindings.find(b=>b.path===pythonTest),args,programBindings:inputEvidence,timeoutMs:60000});
    assert.equal(result.qualificationGranted,false);ownedInvocations.push(result);return result.value;
  };
  let worker,training,reloaded;
  const pass=extra=>({status:'passed',syntheticCpuOnly:true,notVisualJudge:true,trainingAllowed:false,...extra});
  const adapters={
    preflight:async()=>{calls.push('preflight');for(const b of inputEvidence)assert.equal(digest(fs.readFileSync(b.path)),b.sha256);return pass({});},
    execute:async()=>{calls.push('execute');worker=await invoke('--train-checkpoint',identity);training=JSON.parse(fs.readFileSync(worker.receiptPath));
      assert.equal(training.identity.runId,identity);
      assert.equal(training.identity.capabilityVersion,spec.capabilityVersion);
      assert.equal(training.epochEvidence.stepEvidence.optimizerSteps,1);
      assert.equal(training.epochEvidence.stepEvidence.nonTrainOptimizerSteps,0);return pass({checkpoint:worker.checkpoint});},
    validate:async()=>{calls.push('validate');reloaded=await invoke('--reload-probe',worker.receiptPath);
      assert.notEqual(training.pid,reloaded.pid);assert.equal(reloaded.optimizerSteps,0);
      assert.equal(training.denoiserStateSha256,reloaded.denoiserStateSha256);
      assert.deepEqual(training.probe,reloaded.probe);
      assert.equal(digest(fs.readFileSync(path.join(workspace,worker.checkpoint.path))),worker.checkpoint.sha256);
      return pass({reloaded});},
    review:async()=>{calls.push('review');assert.deepEqual(reloaded.probe.rgbShape,[1,3,16,16]);return pass({semanticReviewPerformed:false});},
    adjudicate:async()=>{calls.push('adjudicate');return pass({decision:'cpu_integration_only_no_qualification'});},
    finalize:async()=>{calls.push('finalize');return pass({checkpoint:worker.checkpoint,releaseAllowed:false});}
  };
  const run=()=>runAutonomousClosedLoop({root:workspace,spec,packageSha256:digest(json(spec)),adapters});
  assert.equal((await run()).state,'completed');assert.deepEqual(calls,PHASES);
  assert.equal((await run()).state,'completed');assert.deepEqual(calls,PHASES);
  const executionRoot=path.join(workspace,'.runtime/ai-painter/autonomous-closed-loop-executions',identity);
  const db=new DatabaseSync(path.join(executionRoot,'execution.sqlite'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT COUNT(*) AS n FROM artifacts').get().n,6);
    assert.equal(db.prepare('SELECT state FROM executions').get().state,'completed');}finally{db.close();}
  const registryAfter=digest(fs.readFileSync(registryPath));assert.equal(registryAfter,registryBefore);
  assert.equal(ownedInvocations.length,2);
  for(const invocation of ownedInvocations)assert.equal(invocation.ownedReceipt.proof.activeProcessesAfterCleanup,0);
  fs.writeFileSync(path.join(evidenceRoot,'real-v2-lifecycle.json'),json({identity,calls,worker,training,reloaded,ownedInvocations,
    executionRoot,registryBefore,registryAfter,productionAdapterRegistered:false,gpuStarted:false}),{flag:'wx'});
 }));

for(const [name,change,error] of [
  ['worker-stale-program',o=>o.programBindings[0].sha256='0'.repeat(64),/SHA mismatch/],
  ['worker-stale-executable',o=>o.executable.sha256='0'.repeat(64),/executable changed/],
  ['worker-unbound-entry',o=>o.script.sha256='0'.repeat(64),/script not bound/],
  ['worker-resource-overrun',o=>o.timeoutMs=60001,/wall limit/],
])test(name,()=>check(name,async()=>{
  const f=fixture(name), options={root:f.root,
    executable:{path:process.execPath,sha256:digest(fs.readFileSync(process.execPath))},
    script:{...f.worker},args:['train',f.root,f.requestBinding.path,f.requestBinding.sha256],
    programBindings:[{...f.worker}],timeoutMs:6000};
  change(options);await assert.rejects(()=>runBoundCpuCheckpointWorker(options),error);
  assert.equal(fs.existsSync(path.join(f.root,'.runtime/ai-painter/owned-worker-guards')),false);
  assert.equal(fs.existsSync(path.join(f.root,'training.json')),false);
}));

test('owned worker invalid JSON preserves confirmed cleanup receipt',()=>check('worker-invalid-json',async()=>{
  const f=fixture('worker-invalid-json');
  const python=path.join(workspace,'ml/ai-painter/.venv/Scripts/python.exe');
  const badJsonWorker=f.put('bad-json-fixture.py',Buffer.from("print('not-json')\n"));
  await assert.rejects(()=>runBoundCpuCheckpointWorker({root:f.root,
    executable:{path:python,sha256:digest(fs.readFileSync(python))},
    script:badJsonWorker,args:[],programBindings:[badJsonWorker],timeoutMs:6000}),error=>{
    assert.ok(error instanceof SyntaxError);assert.equal(error.ownedReceipt.cleanupConfirmed,true);
    assert.equal(error.ownedReceipt.guardReleaseConfirmed,true);
    f.put('failure-receipt.json',{error:String(error),ownedReceipt:error.ownedReceipt});return true;
  });
}));

test('write bounded CPU evidence summary',()=>{
  for(const b of sourceBindings)assert.equal(digest(fs.readFileSync(b.path)),b.sha256);
  const report={schemaVersion:'checkpoint-reload-cpu-lifecycle-tests-v1',recordedAtUtc:new Date().toISOString(),
    results,sourceBindings,evidenceRoot,passed:results.filter(r=>r.status==='passed').length,
    failed:results.filter(r=>r.status==='failed').length,
    limits:['Scalar fixtures plus one real V2 network/Trainer integration using synthetic 16x16 CPU inputs, not real dataset qualification.',
      'Lifecycle adapters are test callbacks, not a registered production adapter.',
      'This suite does not establish background client-exit continuity, timeout containment or unknown-lock recovery.'],
    productionRegistryWritten:false,gpuStarted:false,formalTrainingStarted:false};
  fs.writeFileSync(path.join(evidenceRoot,'report.json'),json(report),{flag:'wx'});
  console.log(JSON.stringify({evidence:path.join(evidenceRoot,'report.json'),passed:report.passed,failed:report.failed}));
  assert.equal(report.failed,0);
});
