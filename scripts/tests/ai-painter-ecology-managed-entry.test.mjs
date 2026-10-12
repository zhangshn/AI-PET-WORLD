import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {createPhaseAdapters,verifyGpuOutcome} from '../run-ai-painter-ecology-regime-managed-training.mjs'
import {CAPABILITY,EXECUTION_PROFILE,write,bind,json,validateCompleted} from '../lib/ai-painter-ecology-managed-package-chain-v1.mjs'

// Transport and registry fixtures only: no native Job, tensor computation,
// original pixels, GPU admission or production registry writes in these tests.
function fixture(t){
 const base=path.resolve(process.env.ECOLOGY_TEST_EVIDENCE_ROOT??'.runtime/ai-painter/ecology-managed-entry-t-q4-73/phase-tests')
 fs.mkdirSync(base,{recursive:true});const root=fs.mkdtempSync(path.join(base,'fixture-'))
 const plan={runId:'ecology-fixture-run',packageId:'ecology-fixture-package',capabilityVersion:CAPABILITY,
  outputRoot:'.runtime/ai-painter/ecology-regime-managed-executions/ecology-fixture-run',
  programBindings:{worker:{path:'own-worker.py'},gpuQualifier:{path:'own-gpu.py'},reviewDriver:{path:'own-review.mjs'}}}
 const packageBinding=write(root,'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json',{fixture:true})
 const ready={root,plan,packageBinding,input:{fixture:true}},context={heartbeat(){},fixture:true}
 const events=[],calls=[];let registry={registryRevision:1,activeExecution:null}
 const receipt=(phase)=>{if(phase==='review')for(const name of ['dry-review-owned','dry-review'])fs.mkdirSync(path.join(root,plan.outputRoot,name),{recursive:true})
  return {phase,ownerClosed:true,cleanupConfirmed:true,proof:{assignedBeforeResume:true,exitCode:0,activeProcessesAfterCleanup:0},
  outputAccountingRoots:phase==='review'?[plan.outputRoot+'/dry-review-owned',plan.outputRoot+'/dry-review']:[plan.outputRoot],
  budget:{outputBytes:8*1024**2},streamBytes:{stdout:0,stderr:0}}}
 const terminal=()=>write(root,plan.outputRoot+'/worker-terminal.json',{
  runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:packageBinding,
  status:'training_completed_review_pending',executionState:'completed',optimizerStepsGenerator:2304,optimizerStepsDiscriminator:2304,completedEpochs:48,checkpoints:[]})
 const core=(status='dry_single_world_numeric_passed_visual_approval_pending')=>write(root,plan.outputRoot+'/dry-review/machine-audit-core.json',{
  schema:'ecology-regime-machine-audit-core-v1',runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,
  executionPackage:packageBinding,status,input:{path:'mock-review.json',sha256:'a'.repeat(64)},selectedCheckpoint:{epoch:48},
  formalStage4QualificationGranted:false,runtimePublicationGranted:false})
 const deps={loadContext:()=>ready,processIdentity:()=> 'fixture-process-identity',createPresentation:()=>({fixture:true,eligibility:false}),
  createActiveIdentity:(_input,value)=>value,verifyGpuOutcome:()=>true,validateCompleted:()=>true,
  readRegistry:async()=>({ok:true,registry,registrySha256:'b'.repeat(64)}),
  advanceRegistry:async options=>{const evidence=json(root,bind(root,options.terminalEvidencePath))
   assert.ok(['completed','failed_closed','blocked_policy_boundary'].includes(evidence.executionState),'registry evidence must be terminal')
   events.push(options);registry={...registry,registryRevision:registry.registryRevision+1,activeExecution:options.activeExecution};return {ok:true}},
  runNative:async options=>{calls.push(options);const ownedReceipt=receipt(options.phase)
   const receiptBinding=write(root,plan.outputRoot+'/fixture-'+options.phase+'-receipt.json',ownedReceipt)
   const output=options.phase==='cpu'?{status:'own_ecology_entry_preflight_passed_not_gpu_qualified',gpuInitialized:false}:
    options.phase==='qualification'?write(root,plan.outputRoot+'/gpu-gate.json',{fixture:true}):options.phase==='training'?terminal():core()
   return {stdout:JSON.stringify(output),ownedReceipt,receiptBinding}}}
 return {root,plan,ready,packageBinding,context,events,calls,receipt,terminal,core,deps,
  adapters:()=>createPhaseAdapters(deps),registry:()=>registry,setRegistry:value=>{registry=value}}
}

test('preflight is own CPU only, with immutable non-eligible presentation',async t=>{
 const f=fixture(t),result=await f.adapters().preflight(f.context)
 assert.equal(result.status,'passed');assert.equal(f.calls.length,1);assert.equal(f.calls[0].phase,'cpu')
 assert.ok(f.calls[0].args.includes('--preflight'));assert.equal(f.events.length,0)
 assert.equal(json(f.root,bind(f.root,f.plan.outputRoot+'/package.json')).eligibility,false)
})
test('execute uses own qualification then one training and clears current identity',async t=>{
 const f=fixture(t),result=await f.adapters().execute(f.context)
 assert.equal(result.status,'passed');assert.deepEqual(f.calls.map(x=>x.phase),['qualification','training'])
 assert.deepEqual(f.calls[1].executionPlan,f.plan);assert.ok(f.calls[1].args.includes('--gpu-sha256'))
 assert.equal(f.events[0].executionState,'executing');assert.equal(f.events[1].executionState,'completed')
 assert.equal(f.registry().activeExecution,null);assert.equal(f.events[1].latestTrainingTerminal.status,'training_completed_review_pending')
 const admission=json(f.root,bind(f.root,f.plan.outputRoot+'/gpu-acceptance.json'))
 assert.deepEqual(admission.executionPackage,f.packageBinding);assert.deepEqual(admission.programBindings,f.plan.programBindings)
})
test('qualification refusal never reaches training',async t=>{
 const f=fixture(t);f.deps.verifyGpuOutcome=()=>{throw new Error('qualification refused')}
 await assert.rejects(f.adapters().execute(f.context),/qualification refused/)
 assert.deepEqual(f.calls.map(x=>x.phase),['qualification']);assert.equal(f.events.at(-1).executionState,'failed_closed')
})
test('busy registry refuses dispatch and does not take an execution claim',async t=>{
 const f=fixture(t);f.setRegistry({registryRevision:1,activeExecution:{runId:'other'}})
 await assert.rejects(f.adapters().execute(f.context));assert.equal(f.calls.length,0);assert.equal(f.events.length,0)
 assert.equal(fs.existsSync(path.join(f.root,f.plan.outputRoot,'execution-consumed.json')),false)
})
test('unknown qualification cleanup retains registered active identity',async t=>{
 const f=fixture(t);f.deps.runNative=async()=>{throw Object.assign(new Error('unknown qualification'),{ownedReceipt:{cleanupConfirmed:false}})}
 await assert.rejects(f.adapters().execute(f.context),/unknown qualification/)
 assert.equal(f.events.length,1);assert.ok(f.registry().activeExecution)
})
test('clean training failure keeps partial update counts and terminal',async t=>{
 const f=fixture(t),native=f.deps.runNative
 f.deps.runNative=async options=>{if(options.phase!=='training')return native(options)
  write(f.root,f.plan.outputRoot+'/worker-terminal.json',{runId:f.plan.runId,packageId:f.plan.packageId,capabilityVersion:CAPABILITY,
   executionPackage:f.packageBinding,status:'failed_closed',executionState:'failed_closed',completedEpochs:2,optimizerStepsGenerator:97,optimizerStepsDiscriminator:98})
  throw Object.assign(new Error('training stopped'),{ownedReceipt:f.receipt('training')})}
 await assert.rejects(f.adapters().execute(f.context),/training stopped/)
 const failure=json(f.root,bind(f.root,f.plan.outputRoot+'/execution-failure.json'))
 assert.equal(failure.optimizerStepsGenerator,97);assert.equal(failure.optimizerStepsDiscriminator,98)
 assert.equal(f.events.at(-1).latestTrainingTerminal.status,'failed_closed');assert.equal(f.registry().activeExecution,null)
})
test('training unknown cleanup cannot borrow qualification release',async t=>{
 const f=fixture(t),native=f.deps.runNative
 f.deps.runNative=options=>{if(options.phase==='training')throw new Error('no current release');return native(options)}
 await assert.rejects(f.adapters().execute(f.context),/no current release/)
 assert.equal(f.events.length,1);assert.ok(f.registry().activeExecution)
 assert.equal(json(f.root,bind(f.root,f.plan.outputRoot+'/execution-failure.json')).cleanupConfirmed,false)
})
test('post-training publication failure preserves completed 2304 updates',async t=>{
 const f=fixture(t),advance=f.deps.advanceRegistry;let refused=false
 f.deps.advanceRegistry=options=>{if(options.executionState==='completed'&&!refused){refused=true;throw new Error('registry publication failed')}return advance(options)}
 await assert.rejects(f.adapters().execute(f.context),/registry publication failed/)
 const failure=json(f.root,bind(f.root,f.plan.outputRoot+'/execution-failure.json'))
 assert.equal(failure.completedEpochs,48);assert.equal(failure.optimizerStepsGenerator,2304)
 assert.equal(f.events.at(-1).latestTrainingTerminal.status,'training_completed_review_pending')
})
test('execution claim prevents a second native dispatch',async t=>{
 const f=fixture(t),adapter=f.adapters();await adapter.execute(f.context)
 await assert.rejects(adapter.execute(f.context),/EEXIST/);assert.equal(f.calls.length,2)
})
test('review uses one Node root with its Python child, not another training',async t=>{
 const f=fixture(t);f.terminal();const result=await f.adapters().review(f.context)
 assert.equal(result.status,'passed');assert.deepEqual(f.calls.map(x=>x.phase),['review'])
 assert.equal(f.calls[0].executable,process.execPath);assert.equal(f.calls[0].outputRoot,f.plan.outputRoot+'/dry-review-owned')
 assert.equal(json(f.root,result.audit).formalStage4QualificationGranted,false)
})
test('clean review failure writes accounted failure and registry capsule',async t=>{
 const f=fixture(t);f.terminal();f.deps.runNative=async()=>{throw Object.assign(new Error('review timeout'),{ownedReceipt:f.receipt('review')})}
 await assert.rejects(f.adapters().review(f.context),/review timeout/)
 assert.equal(f.events.length,1);assert.equal(f.events[0].executionState,'failed_closed')
 assert.ok(fs.existsSync(path.join(f.root,f.events[0].taskCapsulePath)))
 assert.equal(json(f.root,bind(f.root,f.plan.outputRoot+'/worker-terminal.json')).optimizerStepsGenerator,2304)
})
test('unknown review cleanup does not record a clean terminal',async t=>{
 const f=fixture(t);f.terminal();f.deps.runNative=async()=>{throw Object.assign(new Error('review tree unknown'),{ownedReceipt:{cleanupConfirmed:false}})}
 await assert.rejects(f.adapters().review(f.context),/review tree unknown/);assert.equal(f.events.length,0)
})
test('adjudication refuses wrapper/core status conflict',async t=>{
 const f=fixture(t);f.terminal();const outcome=await f.adapters().review(f.context),body=json(f.root,outcome.audit)
 fs.unlinkSync(path.join(f.root,outcome.audit.path));write(f.root,outcome.audit.path,{...body,status:'dry_single_world_review_failed_closed'})
 await assert.rejects(f.adapters().adjudicate(f.context))
})
test('numeric review finalization is accounted but grants no publication or Stage4',async t=>{
 const f=fixture(t);f.terminal();const adapter=f.adapters();await adapter.review(f.context)
 const result=await adapter.finalize(f.context),body=json(f.root,result.finalization)
 assert.equal(result.status,'passed');assert.equal(body.formalStage4QualificationGranted,false);assert.equal(body.runtimePublicationGranted,false)
 assert.equal(f.events[0].executionState,'completed');assert.ok(fs.existsSync(path.join(f.root,f.events[0].taskCapsulePath)))
})
test('visual refusal ends route with zero retry, not another train',async t=>{
 const f=fixture(t),native=f.deps.runNative;f.terminal()
 f.deps.runNative=async options=>{const result=await native(options);if(options.phase==='review'){
  fs.unlinkSync(path.join(f.root,f.plan.outputRoot,'dry-review/machine-audit-core.json'))
  result.stdout=JSON.stringify(f.core('dry_single_world_review_failed_closed'))}return result}
 const adapter=f.adapters();await adapter.review(f.context);const result=await adapter.finalize(f.context)
 assert.equal(result.status,'failed');assert.equal(result.failureKind,'visual');assert.equal(f.events[0].executionState,'failed_closed')
 assert.equal(json(f.root,result.finalization).automaticRetries,0);assert.equal(f.calls.length,1)
})
test('validation rehashes every checkpoint rather than trusting completion text',async t=>{
 const f=fixture(t);write(f.root,f.plan.outputRoot+'/worker-terminal.json',{checkpoints:[{checkpoint:{path:'missing.pt',sha256:'a'.repeat(64)}}]})
 await assert.rejects(f.adapters().validate(f.context),/ENOENT/)
})
test('GPU outcome requires original 48 order, own identity and unchanged state',t=>{
 const f=fixture(t),ids=Array.from({length:48},(_,i)=>'sample'+i);f.plan.trainSplit=write(f.root,'train.json',{sampleIds:ids})
 f.plan.modelBinding=write(f.root,'model.json',{initialState:{G:'g',D:'d'}})
 const gate={schema:'ecology-regime-all-train-gpu-gate-v1',status:'passed',capabilityVersion:CAPABILITY,executionProfile:EXECUTION_PROFILE,
  runId:f.plan.runId,packageId:f.plan.packageId,executionPackage:f.packageBinding,programBindings:f.plan.programBindings,
  actualCounts:{forwardAttempted:48,forwardCompleted:48,generatorAttempted:192,generatorCompleted:192,discriminatorAttempted:48,discriminatorCompleted:48},
  optimizerSteps:0,checkpointLoaded:false,checkpointWritten:false,cases:ids.map(sampleId=>({sampleId,passed:true})),
  initialState:{g:'same'},finalState:{g:'same'},initialCpuState:{G:'g',D:'d'}}
 const logical=f.plan.outputRoot+'/gpu-gate.json';let b=write(f.root,logical,gate);verifyGpuOutcome(f.ready,b)
 fs.unlinkSync(path.join(f.root,logical));b=write(f.root,logical,{...gate,cases:[...gate.cases].reverse()})
 assert.throws(()=>verifyGpuOutcome(f.ready,b))
})
test('completed terminal verifies checkpoint schedule, counts and deterministic winner',t=>{
 const f=fixture(t);f.plan.lifecycleCpuAcceptance={path:'cpu.json',sha256:'a'.repeat(64)}
 const checkpoints=[24,36,48].map(epoch=>({epoch,counts:{generator:epoch*48,discriminator:epoch*48},
  checkpoint:{path:f.plan.outputRoot+`/checkpoint-${epoch}.pt`,sha256:'c'.repeat(64)},
  selection:{worstApplicableObjectCorrelation:0.3,meanValidationRgbMae:0.1,rank:[0.3,-0.1,-epoch]}}))
 const body={schema:'ecology-regime-managed-worker-terminal-v1',executionProfile:EXECUTION_PROFILE,status:'training_completed_review_pending',executionState:'completed',
  capabilityVersion:CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId,executionPackage:f.packageBinding,completedEpochs:48,
  optimizerSteps:{generator:2304,discriminator:2304},optimizerStepsGenerator:2304,optimizerStepsDiscriminator:2304,checkpointReloadVerified:true,
  challengeContentRead:false,regressionContentRead:false,checkpointPromotable:false,formalStage4QualificationAllowed:false,runtimePublicationAllowed:false,
  executionAuthentication:{executionPackage:f.packageBinding,finalCpuAcceptance:f.plan.lifecycleCpuAcceptance,
   ownedGpuAcceptance:{path:f.plan.outputRoot+'/gpu-acceptance.json',sha256:'d'.repeat(64)}},checkpoints,selectedCheckpointRecord:checkpoints[0]}
 assert.equal(validateCompleted(body,f.packageBinding,f.plan).epoch,24)
 assert.throws(()=>validateCompleted({...body,selectedCheckpointRecord:checkpoints[2]},f.packageBinding,f.plan))
 assert.throws(()=>validateCompleted({...body,optimizerStepsGenerator:2303},f.packageBinding,f.plan))
})
