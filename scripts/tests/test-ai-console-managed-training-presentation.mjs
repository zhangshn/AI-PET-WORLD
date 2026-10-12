import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readBoundTrainingPresentation} from '../../src/server/ai-console/bound-training-presentation.mjs';

const now = Date.parse('2026-10-03T07:20:00Z');
const stamp = age => new Date(now - age).toISOString();
async function fixture(t, universal = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aic-managed-training-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  const outputRoot = '.runtime/ai-painter/owned';
  const identity = {runId:'owned', packageId:'package-owned', capabilityVersion:'model-owned'};
  async function put(logical, value) {
    await fs.mkdir(path.dirname(path.join(root, logical)), {recursive:true});
    const bytes = JSON.stringify(value); await fs.writeFile(path.join(root, logical), bytes);
    return {path:logical, sha256:createHash('sha256').update(bytes).digest('hex')};
  }
  const candidate = {schemaVersion:'stage4-mvp256-dry-v24-closed-loop-candidate-v1', scope:{resolution:[256,192]}};
  const candidateBinding = await put('data/ai-painter/candidate.json', candidate);
  const pkg = {...identity, schemaVersion:universal ? 'ai-painter-current-training-package-v1'
    : 'ai-painter-stage4-mvp256-dry-v99-v2-execution-package-v1', outputRoot,
    sourceDataCandidate:candidateBinding, trainingPlan:{epochs:48,generatorOptimizerSteps:2304,discriminatorOptimizerSteps:2304},
    resourceBudget:{epochs:48,generatorOptimizerSteps:2304,discriminatorOptimizerSteps:2304},
    ...(universal ? {resolution:[128,96],observation:{progressPath:`${outputRoot}/progress.json`}} : {})};
  let pkgBinding = await put(`${outputRoot}/execution-package.json`, pkg);
  const terminal = {...identity, executionPackage:pkgBinding, trainingStarted:false};
  const dispatch = await put(`${outputRoot}/training-dispatched.json`, terminal);
  const lock = {...identity, schemaVersion:'ai-painter-current-active-execution-lock-v1',processId:123,processStartIdentity:'123:owned-start'};
  const lockBinding = await put(`${outputRoot}/execution-lock.json`,lock);
  const heartbeat = {...lock,schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',executionState:'executing',heartbeatAtUtc:stamp(1000)};
  const progress = {...identity,schemaVersion:universal ? 'ai-painter-current-training-progress-v1'
    : pkg.schemaVersion.replace('-execution-package-', '-progress-'),executionState:'executing',
    actualEpoch:4,completedEpochs:4,optimizerStepsGenerator:192,optimizerStepsDiscriminator:192,updatedAtUtc:stamp(35000)};
  const registry = {...identity,activeExecution:{...lock,executionState:'executing',lock:lockBinding,heartbeat:{path:`${outputRoot}/heartbeat.json`,ttlSeconds:120}}};
  const capsule = {evidence:[dispatch]};
  const f = {root,outputRoot,pkg,terminal,registry,capsule,lock,heartbeat,progress,put,
    async sync() {
      pkgBinding = await put(`${outputRoot}/execution-package.json`,pkg);
      terminal.executionPackage=pkgBinding;
      if (registry.activeExecution) registry.activeExecution.lock=await put(`${outputRoot}/execution-lock.json`,lock);
      await put(`${outputRoot}/heartbeat.json`,heartbeat);
      await put(`${outputRoot}/progress.json`,progress);
    },
    read:()=>readBoundTrainingPresentation(root,registry,capsule,terminal,{observedNow:now})};
  await f.sync(); return f;
}

test('current dispatch resolves a verified package, plan and inter-epoch progress without history',async t=>{
  const f=await fixture(t),p=await f.read();
  assert.equal(p.availability,'available');assert.equal(p.targetEpochs,48);
  assert.deepEqual(p.resolution,{width:256,height:192});assert.equal(p.actualOptimizerSteps,null);
  assert.equal(p.targetDiscriminatorOptimizerSteps,2304);
  assert.equal(p.currentMetrics.availability,'available');assert.equal(p.currentMetrics.epoch,4);
  assert.equal(p.currentMetrics.optimizationStep,192);assert.equal(p.currentMetrics.discriminatorOptimizerSteps,192);
  assert.equal(p.currentMetrics.loss,null);assert.equal(p.currentMetrics.estimatedCompletionAtUtc,null);
  assert.equal(p.currentMetrics.processStartIdentity,'123:owned-start');
});
test('stable observation contract supports another model, resolution and plan without version-specific UI',async t=>{
  const f=await fixture(t,true);f.pkg.trainingPlan={epochs:9,generatorOptimizerSteps:300,discriminatorOptimizerSteps:400};
  f.pkg.resourceBudget={...f.pkg.trainingPlan};await f.sync();const p=await f.read();
  assert.deepEqual(p.resolution,{width:128,height:96});assert.equal(p.targetEpochs,9);
  assert.equal(p.targetDiscriminatorOptimizerSteps,400);assert.equal(p.currentMetrics.availability,'available');
});
for(const [name,mutation,reason] of [
  ['foreign progress Run',f=>f.progress.runId='foreign','training_progress_identity_conflict'],
  ['foreign progress package',f=>f.progress.packageId='foreign','training_progress_identity_conflict'],
  ['foreign progress model',f=>f.progress.capabilityVersion='foreign','training_progress_identity_conflict'],
  ['foreign heartbeat PID',f=>f.heartbeat.processId=124,'training_progress_heartbeat_process_conflict'],
  ['reused heartbeat PID',f=>f.heartbeat.processStartIdentity='123:reused','training_progress_heartbeat_process_conflict'],
  ['foreign lock process',f=>f.lock.processId=124,'training_progress_lock_process_conflict'],
  ['unsupported lock schema',f=>f.lock.schemaVersion='untrusted','training_progress_lock_process_conflict'],
  ['foreign active identity',f=>f.registry.activeExecution.runId='foreign','training_progress_active_identity_conflict'],
  ['progress schema unsupported',f=>f.progress.schemaVersion='unsupported','training_progress_schema_unsupported'],
  ['progress phase unsupported',f=>f.progress.executionState='invented','training_progress_phase_unsupported'],
  ['stale progress',f=>f.progress.updatedAtUtc=stamp(120001),'training_progress_stale_or_future'],
  ['future progress',f=>f.progress.updatedAtUtc=stamp(-1),'training_progress_stale_or_future'],
  ['stale heartbeat',f=>f.heartbeat.heartbeatAtUtc=stamp(15001),'training_progress_heartbeat_stale_or_future'],
  ['future heartbeat',f=>f.heartbeat.heartbeatAtUtc=stamp(-1),'training_progress_heartbeat_stale_or_future'],
  ['negative epoch',f=>f.progress.actualEpoch=-1,'training_progress_plan_limit_conflict'],
  ['epoch above bound',f=>f.progress.actualEpoch=49,'training_progress_plan_limit_conflict'],
  ['completed beyond actual',f=>f.progress.completedEpochs=5,'training_progress_plan_limit_conflict'],
  ['G above bound',f=>f.progress.optimizerStepsGenerator=2305,'training_progress_plan_limit_conflict'],
  ['D above bound',f=>f.progress.optimizerStepsDiscriminator=2305,'training_progress_plan_limit_conflict'],
  ['noninteger count',f=>f.progress.optimizerStepsGenerator=1.5,'training_progress_plan_limit_conflict'],
  ['foreign heartbeat path',f=>f.registry.activeExecution.heartbeat.path='.runtime/ai-painter/foreign/heartbeat.json','training_progress_active_binding_conflict'],
]) test(`${name} rejects metrics without losing verified plan`,async t=>{
  const f=await fixture(t);mutation(f);await f.sync();const p=await f.read();
  assert.equal(p.availability,'available');assert.equal(p.targetEpochs,48);
  assert.equal(p.currentMetrics.availability,'unavailable');assert.equal(p.currentMetrics.reasonCode,reason);
  assert.equal(p.currentMetrics.epoch,null);
});
test('checkpoint/review phase is not training and no synthetic live loss or ETA',async t=>{
  const f=await fixture(t);f.progress.executionState='checkpoint_selected_review_pending';await f.sync();
  const p=await f.read();assert.equal(p.currentMetrics.phase,'completed');assert.equal(p.currentMetrics.loss,null);
});
test('immutable package, source and lock bytes are rehashed on every request',async t=>{
  const f=await fixture(t);await fs.appendFile(path.join(f.root,f.registry.activeExecution.lock.path),' ');
  assert.equal((await f.read()).currentMetrics.reasonCode,'training_package_sha256_mismatch');
  await f.sync();await fs.appendFile(path.join(f.root,f.pkg.sourceDataCandidate.path),' ');
  assert.equal((await f.read()).reasonCode,'training_package_sha256_mismatch');
});
test('plan-budget conflict, unsafe output root and unbound package do not substitute history',async t=>{
  const f=await fixture(t);f.pkg.resourceBudget.epochs=49;await f.sync();
  assert.equal((await f.read()).reasonCode,'training_plan_budget_conflict');
  f.pkg.resourceBudget.epochs=48;f.pkg.outputRoot='.runtime/ai-painter/foreign';await f.sync();
  assert.equal((await f.read()).reasonCode,'training_package_output_root_conflict');
  delete f.terminal.executionPackage;assert.equal((await f.read()).reasonCode,'training_package_binding_unavailable');
});
test('oversized progress is refused; absent active execution never reuses mutable counters',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.root,f.outputRoot,'progress.json'),' '.repeat(65537));
  assert.equal((await f.read()).currentMetrics.availability,'unavailable');
  f.registry.activeExecution=null;const p=await f.read();assert.equal(p.currentMetrics.reasonCode,'active_execution_not_registered');
  assert.equal(p.completedEpochs,null);assert.equal(p.actualOptimizerSteps,null);
});
test('completed and partial failure use verified immutable worker terminal, not old progress',async t=>{
  const f=await fixture(t);f.registry.activeExecution=null;
  f.terminal.workerTerminal=await f.put(`${f.outputRoot}/phase-terminal.json`,{...f.registry,activeExecution:undefined,
    completedEpochs:48,optimizerStepsGenerator:2304,optimizerStepsDiscriminator:2304});
  let p=await f.read();assert.equal(p.completedEpochs,48);assert.deepEqual(p.actualOptimizerSteps,{generator:2304,critic:2304});
  f.terminal.errorCode='worker_failed';f.terminal.workerTerminal=await f.put(`${f.outputRoot}/phase-terminal.json`,{...f.registry,
    completedEpochs:7,optimizerStepsGenerator:336,optimizerStepsDiscriminator:335});
  p=await f.read();assert.equal(p.completedEpochs,7);assert.equal(p.errorCode,'worker_failed');
  assert.equal(p.actualOptimizerSteps.critic,335);
});
test('review follows only explicit training terminal binding; terminal overflow and foreign worker rejected',async t=>{
  const f=await fixture(t);f.registry.activeExecution=null;
  f.terminal.workerTerminal=await f.put(`${f.outputRoot}/phase-terminal.json`,{...f.registry,
    completedEpochs:48,optimizerStepsGenerator:2304,optimizerStepsDiscriminator:2304});
  const trainingTerminal=await f.put(`${f.outputRoot}/training-finalize.json`,f.terminal);
  const review={runId:f.registry.runId,trainingTerminal};
  assert.equal((await readBoundTrainingPresentation(f.root,f.registry,f.capsule,review,{observedNow:now})).completedEpochs,48);
  f.terminal.workerTerminal=await f.put(`${f.outputRoot}/phase-terminal.json`,{...f.registry,
    completedEpochs:49,optimizerStepsGenerator:2304,optimizerStepsDiscriminator:2304});
  assert.equal((await f.read()).reasonCode,'training_terminal_epoch_limit_conflict');
  f.terminal.workerTerminal=await f.put(`${f.outputRoot}/phase-terminal.json`,{...f.registry,runId:'foreign'});
  assert.equal((await f.read()).reasonCode,'training_worker_terminal_identity_conflict');
});
test('a foreign linked training terminal is rejected, never projected as the registered Run',async t=>{
  const f=await fixture(t);f.registry.activeExecution=null;
  const trainingTerminal=await f.put(`${f.outputRoot}/foreign-finalize.json`,{...f.terminal,runId:'foreign'});
  const review={runId:f.registry.runId,trainingTerminal};
  assert.equal((await readBoundTrainingPresentation(f.root,f.registry,f.capsule,review,{observedNow:now})).reasonCode,
    'training_package_run_mismatch');
});
test('GET-like read is byte-preserving and refreshes changed mutable progress without cache substitution',async t=>{
  const f=await fixture(t);const before=await fs.readFile(path.join(f.root,f.outputRoot,'progress.json'));
  const a=await f.read();assert.deepEqual(await fs.readFile(path.join(f.root,f.outputRoot,'progress.json')),before);
  f.progress.actualEpoch=5;f.progress.completedEpochs=5;f.progress.optimizerStepsGenerator=240;
  await f.sync();const b=await f.read();assert.equal(b.currentMetrics.epoch,5);
  assert.notEqual(b.currentMetrics.sourceSha256,a.currentMetrics.sourceSha256);
});
