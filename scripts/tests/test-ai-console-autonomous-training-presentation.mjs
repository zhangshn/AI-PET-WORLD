import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readBoundTrainingPresentation} from '../../src/server/ai-console/bound-training-presentation.mjs';
import {readCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs';

const now = Date.parse('2026-10-09T09:00:00Z');
const stamp = age => new Date(now - age).toISOString();
const hash = b => createHash('sha256').update(b).digest('hex');
async function fixture(t, failureCapture = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aic-autonomous-summary-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  const outputRoot = '.runtime/ai-painter/unrelated-model-run';
  const id = {runId:'run-generic', packageId:'package-generic', capabilityVersion:'independent-family'};
  const ceiling = {epochs:9, generatorOptimizerSteps:300, discriminatorOptimizerSteps:400, cpuThreads:2};
  const plan = {...id, schema:failureCapture ? 'ecology-regime-failure-capture-plan-v1' : 'ecology-regime-managed-plan-v1',
    executionMode:failureCapture ? 'bounded-failure-capture' : 'managed-training', outputRoot,
    configuration:{schema:failureCapture ? 'ecology-regime-failure-capture-configuration-v1' : 'ecology-regime-managed-configuration-v1',capabilityVersion:id.capabilityVersion,
      scope:{resolution:[128,96]}, executionCeiling:ceiling, checkpointSelection:{eligibleEpochs:[9]}}};
  const envelope = {schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',
    packageIdentity:id.packageId, capabilityVersion:id.capabilityVersion, outputRoot, inputEvidence:[]};
  const observation = {...id, schemaVersion:'ai-painter-current-training-package-v1', outputRoot, resolution:[128,96],
    trainingPlan:{epochs:9,generatorOptimizerSteps:300,discriminatorOptimizerSteps:400,checkpointSelection:{eligibleEpochs:[9]}},
    resourceBudget:{...ceiling}, observation:{progressPath:`${outputRoot}/progress.json`}};
  const lock = {...id,schemaVersion:'ai-painter-current-active-execution-lock-v1',processId:123,processStartIdentity:'123:born'};
  const heartbeat = {...lock,schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',executionState:'executing',heartbeatAtUtc:stamp(1000)};
  const progress = {...id,schemaVersion:'ai-painter-current-training-progress-v1',executionState:'executing',
    actualEpoch:4,completedEpochs:3,optimizerStepsGenerator:100,optimizerStepsDiscriminator:101,updatedAtUtc:stamp(3000)};
  const registry = {...id,activeExecution:{...lock,executionState:'executing',heartbeat:{path:`${outputRoot}/heartbeat.json`,ttlSeconds:120}}};
  const capsule = {evidence:[]}, terminal = {...id};
  const paths = new Set();
  async function put(logical,value) {
    await fs.mkdir(path.dirname(path.join(root,logical)),{recursive:true});
    const bytes=Buffer.from(JSON.stringify(value)); await fs.writeFile(path.join(root,logical),bytes); paths.add(logical);
    return {path:logical,sha256:hash(bytes)};
  }
  const f = {root,outputRoot,id,plan,envelope,observation,lock,heartbeat,progress,registry,capsule,terminal,put,paths,
    planFilename:failureCapture ? 'failure-capture-plan.json' : 'ecology-plan.json', additionalBindings:[],
    async sync() {
      this.planBinding=await put(`${outputRoot}/${this.planFilename}`,plan);
      envelope.inputEvidence=[this.planBinding,...this.additionalBindings,{path:'data/unrelated-input.json',sha256:'1'.repeat(64)}];
      this.envelopeBinding=await put('.runtime/ai-painter/autonomous-closed-loop-packages/generic/package.json',envelope);
      observation.autonomousExecutionPackage={...this.envelopeBinding};
      this.observationBinding=await put(`${outputRoot}/package.json`,observation);
      if(registry.activeExecution) registry.activeExecution.lock=await put(`${outputRoot}/execution-lock.json`,lock);
      await put(`${outputRoot}/heartbeat.json`,heartbeat); await put(`${outputRoot}/progress.json`,progress);
      capsule.evidence=[this.envelopeBinding]; terminal.executionPackage=this.envelopeBinding;
      registry.terminalEvidence=await put(`${outputRoot}/registered-terminal.json`,terminal);
      registry.packageSha256=registry.terminalEvidence.sha256;
    },
    read:()=>readBoundTrainingPresentation(root,registry,capsule,terminal,{observedNow:now}),
    async refreshEnvelope() {
      this.envelopeBinding=await put(this.envelopeBinding.path,envelope);
      capsule.evidence=[this.envelopeBinding];
      terminal.executionPackage=this.envelopeBinding;
      observation.autonomousExecutionPackage={...this.envelopeBinding}; await put(this.observationBinding.path,observation);
    },
  };
  await f.sync(); return f;
}

async function qualityFixture(t, decode1 = false) {
  const f=await fixture(t);
  f.planFilename='quality-plan.json';
  f.plan.schema=decode1 ? 'ecology-decode1-weight-quality-plan-v1' : 'ecology-regime-quality-plan-v1';
  f.plan.executionMode='bounded-quality-training';
  f.plan.configuration.schema=decode1 ? 'ecology-decode1-weight-quality-configuration-v1' : 'ecology-regime-quality-configuration-v1';
  f.plan.configuration.scope.resolution=[256,192];
  Object.assign(f.plan.configuration.executionCeiling,{epochs:12,generatorOptimizerSteps:576,discriminatorOptimizerSteps:576});
  f.plan.configuration.checkpointSelection={eligibleEpochs:[12]};
  f.observation.resolution=[256,192];
  f.observation.trainingPlan={epochs:12,generatorOptimizerSteps:576,discriminatorOptimizerSteps:576,
    checkpointSelection:{eligibleEpochs:[12]}};
  f.observation.resourceBudget={...f.plan.configuration.executionCeiling};
  await f.sync();return f;
}

test('decode1 protocol projects bounded counters and refreshes without changing old protocol',async t=>{
  const current=await qualityFixture(t,true), old=await qualityFixture(t);
  const first=await current.read(), legacy=await old.read();
  for(const value of [first,legacy]){
    assert.equal(value.availability,'available');assert.equal(value.targetEpochs,12);
    assert.equal(value.targetOptimizerSteps,576);assert.deepEqual(value.resolution,{width:256,height:192});
  }
  current.progress.optimizerStepsGenerator=140;current.progress.optimizerStepsDiscriminator=141;
  await current.sync();const second=await current.read();
  assert.equal(second.currentMetrics.optimizationStep,140);
  assert.equal(second.currentMetrics.discriminatorOptimizerSteps,141);
  assert.notEqual(second.currentMetrics.sourceSha256,first.currentMetrics.sourceSha256);
  assert.equal((await old.read()).currentMetrics.optimizationStep,100);
});

test('decode1 plan cannot borrow predecessor configuration schema',async t=>{
  const f=await qualityFixture(t,true);f.plan.configuration.schema='ecology-regime-quality-configuration-v1';
  await f.sync();const result=await f.read();
  assert.equal(result.availability,'unavailable');
  assert.equal(result.reasonCode,'training_autonomous_configuration_schema_unsupported');
});

test('unknown decode1 protocol does not fall back to the predecessor',async t=>{
  const f=await qualityFixture(t,true);f.plan.schema='ecology-decode1-weight-quality-plan-v2';
  await f.sync();const result=await f.read();
  assert.equal(result.availability,'unavailable');
  assert.equal(result.reasonCode,'training_autonomous_plan_schema_unsupported');
});

test('quality protocol uses signed 12/576 bounds with coexisting metadata and real mutable counters',async t=>{
  const f=await qualityFixture(t);
  for(const name of ['model-identity.json','cpu-acceptance.json','data-closure.json'])
    f.additionalBindings.push(await f.put(`${f.outputRoot}/${name}`,{kind:name}));
  await f.sync();const first=await f.read();
  assert.equal(first.availability,'available');assert.deepEqual(first.resolution,{width:256,height:192});
  assert.equal(first.targetEpochs,12);assert.equal(first.targetOptimizerSteps,576);
  assert.equal(first.targetDiscriminatorOptimizerSteps,576);assert.equal(first.currentMetrics.optimizationStep,100);
  f.progress.optimizerStepsGenerator=102;f.progress.optimizerStepsDiscriminator=103;
  await f.put(`${f.outputRoot}/progress.json`,f.progress);const next=await f.read();
  assert.equal(next.currentMetrics.optimizationStep,102);assert.equal(next.currentMetrics.discriminatorOptimizerSteps,103);
  assert.notEqual(next.currentMetrics.sourceSha256,first.currentMetrics.sourceSha256);
  assert.equal(next.currentMetrics.loss,null);assert.equal(next.currentMetrics.estimatedCompletionAtUtc,null);
});
for(const [name,change,reason] of [
  ['wrong schema',f=>f.plan.schema='ecology-regime-managed-plan-v1','training_autonomous_plan_schema_unsupported'],
  ['wrong mode',f=>f.plan.executionMode='managed-training','training_autonomous_plan_schema_unsupported'],
  ['wrong configuration',f=>f.plan.configuration.schema='ecology-regime-managed-configuration-v1','training_autonomous_configuration_schema_unsupported'],
  ['foreign Run',f=>f.plan.runId='foreign','training_autonomous_plan_identity_conflict'],
  ['foreign package',f=>f.plan.packageId='foreign','training_autonomous_plan_identity_conflict'],
  ['foreign capability',f=>f.plan.capabilityVersion='foreign','training_autonomous_plan_identity_conflict'],
  ['old observation bounds',f=>f.observation.trainingPlan.epochs=48,'training_observation_plan_conflict'],
  ['old selection schedule',f=>f.observation.trainingPlan.checkpointSelection.eligibleEpochs=[24,36,48],'training_observation_plan_conflict'],
]) test(`quality protocol rejects ${name}`,async t=>{
  const f=await qualityFixture(t);change(f);await f.sync();assert.equal((await f.read()).reasonCode,reason);
});
test('quality protocol never falls back to old files on missing, duplicate, dual or changed plan bindings',async t=>{
  const f=await qualityFixture(t);
  for(const list of [[],[f.planBinding,f.planBinding],[f.planBinding,{...f.planBinding,path:`${f.outputRoot}/ecology-plan.json`}]]) {
    f.envelope.inputEvidence=list;await f.refreshEnvelope();
    assert.equal((await f.read()).reasonCode,'training_autonomous_plan_binding_unavailable');
  }
  await f.sync();await fs.appendFile(path.join(f.root,f.planBinding.path),' ');
  assert.equal((await f.read()).reasonCode,'training_package_sha256_mismatch');
});
test('quality protocol terminal preserves partial D count and never presents old progress as active',async t=>{
  const f=await qualityFixture(t);f.registry.activeExecution=null;
  f.terminal.workerTerminal=await f.put(`${f.outputRoot}/worker-terminal.json`,{...f.id,
    completedEpochs:10,optimizerStepsGenerator:505,optimizerStepsDiscriminator:506});
  const ended=await f.read();assert.equal(ended.currentMetrics.reasonCode,'active_execution_not_registered');
  assert.deepEqual(ended.actualOptimizerSteps,{generator:505,critic:506});assert.equal(ended.completedEpochs,10);
});
for(const [label,change,reason] of [
  ['expired heartbeat',f=>f.heartbeat.heartbeatAtUtc=stamp(15001),'training_progress_heartbeat_stale_or_future'],
  ['expired progress',f=>f.progress.updatedAtUtc=stamp(120001),'training_progress_stale_or_future'],
  ['over-budget G',f=>f.progress.optimizerStepsGenerator=577,'training_progress_plan_limit_conflict'],
  ['over-budget D',f=>f.progress.optimizerStepsDiscriminator=577,'training_progress_plan_limit_conflict'],
]) test(`quality protocol refuses active counters with ${label}`,async t=>{
  const f=await qualityFixture(t);change(f);await f.sync();const result=await f.read();
  assert.equal(result.availability,'available');assert.equal(result.currentMetrics.reasonCode,reason);
  assert.equal(result.currentMetrics.optimizationStep,null);
});

test('standard envelope follows its SHA-bound generic plan and verified observation backlink',async t=>{
  const f=await fixture(t),p=await f.read();
  assert.equal(p.availability,'available'); assert.deepEqual(p.resolution,{width:128,height:96});
  assert.equal(p.targetEpochs,9); assert.equal(p.targetOptimizerSteps,300); assert.equal(p.targetDiscriminatorOptimizerSteps,400);
  assert.equal(p.packagePath,f.envelopeBinding.path); assert.equal(p.packageSha256,f.envelopeBinding.sha256);
  assert.notEqual(f.registry.packageSha256,f.envelopeBinding.sha256);
  assert.equal(p.currentMetrics.availability,'available'); assert.equal(p.currentMetrics.epoch,4);
  assert.equal(p.currentMetrics.optimizationStep,100); assert.equal(p.currentMetrics.discriminatorOptimizerSteps,101);
  assert.equal(p.currentMetrics.loss,null); assert.equal(p.currentMetrics.estimatedCompletionAtUtc,null);
  assert.equal(p.completedEpochs,null); assert.equal(p.actualOptimizerSteps,null);
});
test('another plan and resolution work without a capability-name or fixed-count branch',async t=>{
  const f=await fixture(t);f.id.capabilityVersion='never-seen-name';
  for(const v of [f.registry,f.registry.activeExecution,f.plan,f.observation,f.lock,f.heartbeat,f.progress]) v.capabilityVersion=f.id.capabilityVersion;
  f.envelope.capabilityVersion=f.id.capabilityVersion;
  f.plan.configuration.capabilityVersion=f.id.capabilityVersion;
  f.plan.configuration.scope.resolution=[256,192];f.observation.resolution=[256,192];
  f.plan.configuration.executionCeiling.epochs=48;f.observation.trainingPlan.epochs=48;f.observation.resourceBudget.epochs=48;
  await f.sync();const p=await f.read();assert.equal(p.targetEpochs,48);assert.equal(p.resolution.width,256);
  assert.equal(p.currentMetrics.availability,'available');
});
for (const failureCapture of [false,true]) test(`${failureCapture?'failure-capture':'managed'} plan coexists with three same-root metadata bindings`,async t=>{
  const f=await fixture(t,failureCapture);
  for (const name of ['model-identity.json','cpu-acceptance.json','data-closure.json'])
    f.additionalBindings.push(await f.put(`${f.outputRoot}/${name}`,{schema:'metadata-v1',kind:name}));
  if (failureCapture) {
    Object.assign(f.plan.configuration.executionCeiling,{epochs:13,generatorOptimizerSteps:600,discriminatorOptimizerSteps:600});
    Object.assign(f.observation.trainingPlan,{epochs:13,generatorOptimizerSteps:600,discriminatorOptimizerSteps:600,
      checkpointSelection:{eligibleEpochs:[],executed:false}});
    f.plan.configuration.checkpointSelection={eligibleEpochs:[],executed:false};
    f.observation.resourceBudget={...f.plan.configuration.executionCeiling};
  }
  await f.sync();assert.equal(f.envelope.inputEvidence.filter(b=>path.posix.dirname(b.path)===f.outputRoot).length,4);
  const p=await f.read();assert.equal(p.availability,'available');assert.equal(p.currentMetrics.availability,'available');
  assert.equal(p.targetEpochs,failureCapture?13:9);assert.equal(p.targetOptimizerSteps,failureCapture?600:300);
  assert.equal(p.targetDiscriminatorOptimizerSteps,failureCapture?600:400);
  assert.equal(p.currentMetrics.optimizationStep,100);assert.equal(p.currentMetrics.discriminatorOptimizerSteps,101);
  // Metadata is not reclassified or opened as a plan; the registry owns its authentication.
  await fs.unlink(path.join(f.root,f.additionalBindings[0].path));
  assert.equal((await f.read()).availability,'available');
});
for (const [name,change,reason] of [
  ['wrong schema',f=>{f.plan.schema='ecology-regime-managed-plan-v1'},'training_autonomous_plan_schema_unsupported'],
  ['wrong mode',f=>{f.plan.executionMode='managed-training'},'training_autonomous_plan_schema_unsupported'],
  ['wrong configuration',f=>{f.plan.configuration.schema='ecology-regime-managed-configuration-v1'},'training_autonomous_configuration_schema_unsupported'],
  ['foreign Run',f=>{f.plan.runId='foreign'},'training_autonomous_plan_identity_conflict'],
  ['foreign package',f=>{f.plan.packageId='foreign'},'training_autonomous_plan_identity_conflict'],
  ['foreign capability',f=>{f.plan.configuration.capabilityVersion='foreign'},'training_autonomous_plan_identity_conflict'],
  ['budget drift',f=>{f.observation.resourceBudget.cpuThreads=3},'training_observation_plan_conflict'],
]) test(`failure-capture ${name} is rejected`,async t=>{
  const f=await fixture(t,true);change(f);await f.sync();assert.equal((await f.read()).reasonCode,reason);
});
for (const failureCapture of [false,true]) test(`${failureCapture?'failure-capture':'managed'} registered plan rejects missing, wrong-path, duplicate and dual bindings`,async t=>{
  const f=await fixture(t,failureCapture),otherName=failureCapture?'ecology-plan.json':'failure-capture-plan.json';
  const other=await f.put(`${f.outputRoot}/${otherName}`,f.plan);
  f.envelope.inputEvidence=[f.planBinding,other];await f.refreshEnvelope();
  assert.equal((await f.read()).reasonCode,'training_autonomous_plan_binding_unavailable');
  f.envelope.inputEvidence=[f.planBinding,f.planBinding];await f.refreshEnvelope();
  assert.equal((await f.read()).reasonCode,'training_autonomous_plan_binding_unavailable');
  for (const logical of [`${f.outputRoot}/generic-plan.json`,`${f.outputRoot}/../${f.planFilename}`,
    `${f.outputRoot}/nested/${f.planFilename}`]) {
    f.envelope.inputEvidence=[{...f.planBinding,path:logical}];await f.refreshEnvelope();
    assert.equal((await f.read()).reasonCode,'training_autonomous_plan_binding_unavailable');
  }
  f.envelope.inputEvidence=[];await f.refreshEnvelope();
  assert.equal((await f.read()).reasonCode,'training_autonomous_plan_binding_unavailable');
});
test('failure-capture plan SHA mismatch never falls back to the older managed plan',async t=>{
  const f=await fixture(t,true);await fs.appendFile(path.join(f.root,f.planBinding.path),' ');
  assert.equal((await f.read()).reasonCode,'training_package_sha256_mismatch');
});
test('failure-capture progress increments, failed phase and inactive terminal retain separate truths',async t=>{
  const f=await fixture(t,true);await f.sync();const first=await f.read();
  f.progress.optimizerStepsGenerator=110;f.progress.optimizerStepsDiscriminator=111;
  await f.put(`${f.outputRoot}/progress.json`,f.progress);const next=await f.read();
  assert.equal(next.currentMetrics.optimizationStep,110);assert.equal(next.currentMetrics.discriminatorOptimizerSteps,111);
  assert.notEqual(next.currentMetrics.sourceSha256,first.currentMetrics.sourceSha256);
  f.progress.executionState='failed_closed';await f.put(`${f.outputRoot}/progress.json`,f.progress);
  assert.equal((await f.read()).currentMetrics.phase,'failed_closed');
  f.registry.activeExecution=null;
  f.terminal.workerTerminal=await f.put(`${f.outputRoot}/worker-terminal.json`,{...f.id,completedEpochs:3,
    optimizerStepsGenerator:110,optimizerStepsDiscriminator:111});
  const ended=await f.read();assert.equal(ended.currentMetrics.reasonCode,'active_execution_not_registered');
  assert.deepEqual(ended.actualOptimizerSteps,{generator:110,critic:111});
});
for (const [field,value,reason] of [
  ['heartbeatAtUtc',stamp(15001),'training_progress_heartbeat_stale_or_future'],
  ['updatedAtUtc',stamp(120001),'training_progress_stale_or_future'],
]) test(`failure-capture stale ${field} retains plan but refuses active counters`,async t=>{
  const f=await fixture(t,true);(field==='heartbeatAtUtc'?f.heartbeat:f.progress)[field]=value;
  await f.sync();const p=await f.read();assert.equal(p.availability,'available');
  assert.equal(p.currentMetrics.reasonCode,reason);assert.equal(p.currentMetrics.optimizationStep,null);
});
for(const [name,change,reason] of [
  ['envelope package',f=>f.envelope.packageIdentity='foreign','training_autonomous_package_identity_conflict'],
  ['envelope capability',f=>f.envelope.capabilityVersion='foreign','training_autonomous_package_identity_conflict'],
  ['plan Run',f=>f.plan.runId='foreign','training_autonomous_plan_identity_conflict'],
  ['plan package',f=>f.plan.packageId='foreign','training_autonomous_plan_identity_conflict'],
  ['plan capability',f=>f.plan.capabilityVersion='foreign','training_autonomous_plan_identity_conflict'],
  ['plan schema',f=>f.plan.schema='generic-family-managed-plan-v9','training_autonomous_plan_schema_unsupported'],
  ['unregistered v1 suffix',f=>f.plan.schema='unknown-managed-plan-v1','training_autonomous_plan_schema_unsupported'],
  ['configuration schema',f=>f.plan.configuration.schema='unknown','training_autonomous_configuration_schema_unsupported'],
  ['configuration capability',f=>f.plan.configuration.capabilityVersion='foreign','training_autonomous_plan_identity_conflict'],
  ['plan mode',f=>f.plan.executionMode='unknown','training_autonomous_plan_schema_unsupported'],
  ['plan root',f=>f.plan.outputRoot='.runtime/ai-painter/foreign','training_package_output_root_conflict'],
  ['envelope escape',f=>f.envelope.outputRoot='.runtime/ai-painter/../foreign','training_package_output_root_conflict'],
  ['envelope backslash',f=>f.envelope.outputRoot='.runtime/ai-painter/foreign\\root','training_package_output_root_conflict'],
  ['observation schema',f=>f.observation.schemaVersion='future-v2','training_observation_package_schema_unsupported'],
  ['observation Run',f=>f.observation.runId='foreign','training_observation_package_identity_conflict'],
  ['observation package',f=>f.observation.packageId='foreign','training_observation_package_identity_conflict'],
  ['observation capability',f=>f.observation.capabilityVersion='foreign','training_observation_package_identity_conflict'],
  ['observation root',f=>f.observation.outputRoot='.runtime/ai-painter/foreign','training_package_output_root_conflict'],
  ['resolution drift',f=>f.observation.resolution=[256,192],'training_observation_resolution_conflict'],
  ['target drift',f=>f.observation.trainingPlan.generatorOptimizerSteps=299,'training_observation_plan_conflict'],
  ['budget drift',f=>f.observation.resourceBudget.cpuThreads=3,'training_observation_plan_conflict'],
  ['checkpoint selection drift',f=>f.observation.trainingPlan.checkpointSelection.eligibleEpochs=[8],'training_observation_plan_conflict'],
  ['progress path escape',f=>f.observation.observation.progressPath='.runtime/ai-painter/foreign/progress.json','training_progress_path_conflict'],
]) test(`${name} is rejected before projection`,async t=>{
  const f=await fixture(t);change(f);await f.sync();const p=await f.read();
  assert.equal(p.availability,'unavailable');assert.equal(p.reasonCode,reason);assert.equal(p.currentMetrics,null);
});
for(const [name,change,reason] of [
  ['progress Run',f=>f.progress.runId='foreign','training_progress_identity_conflict'],
  ['progress package',f=>f.progress.packageId='foreign','training_progress_identity_conflict'],
  ['progress capability',f=>f.progress.capabilityVersion='foreign','training_progress_identity_conflict'],
  ['stale heartbeat',f=>f.heartbeat.heartbeatAtUtc=stamp(15001),'training_progress_heartbeat_stale_or_future'],
  ['stale progress',f=>f.progress.updatedAtUtc=stamp(120001),'training_progress_stale_or_future'],
  ['wrong lock birth',f=>f.lock.processStartIdentity='123:reused','training_progress_lock_process_conflict'],
  ['unknown progress',f=>f.progress.schemaVersion='unknown','training_progress_schema_unsupported'],
]) test(`${name} retains plan but cannot claim training`,async t=>{
  const f=await fixture(t);change(f);await f.sync();const p=await f.read();
  assert.equal(p.availability,'available');assert.equal(p.currentMetrics.availability,'unavailable');assert.equal(p.currentMetrics.reasonCode,reason);
});
for(const phase of ['validating','completed','failed_closed','checkpoint_selected_review_pending'])
  test(`${phase} progress does not become executing`,async t=>{
    const f=await fixture(t);f.progress.executionState=phase;await f.sync();
    const p=await f.read();assert.equal(p.currentMetrics.phase,phase==='checkpoint_selected_review_pending'?'completed':phase);
  });
test('failed/completed terminal uses immutable worker counts; inactive ignores old executing progress',async t=>{
  const f=await fixture(t);f.registry.activeExecution=null;
  f.terminal.workerTerminal=await f.put(`${f.outputRoot}/worker-terminal.json`,{...f.id,completedEpochs:3,optimizerStepsGenerator:100,optimizerStepsDiscriminator:101});
  f.terminal.errorCode='failed_original';const p=await f.read();
  assert.equal(p.completedEpochs,3);assert.deepEqual(p.actualOptimizerSteps,{generator:100,critic:101});
  assert.equal(p.errorCode,'failed_original');assert.equal(p.currentMetrics.reasonCode,'active_execution_not_registered');
});
test('envelope, plan, registry and observation backlink SHA are not bypassed',async t=>{
  const f=await fixture(t);await fs.appendFile(path.join(f.root,f.envelopeBinding.path),' ');
  assert.equal((await f.read()).reasonCode,'training_package_sha256_mismatch');
  await f.sync();await fs.appendFile(path.join(f.root,f.planBinding.path),' ');
  assert.equal((await f.read()).reasonCode,'training_package_sha256_mismatch');
  await f.sync();f.registry.packageSha256='0'.repeat(64);
  assert.equal((await f.read()).reasonCode,'training_registry_terminal_sha256_conflict');
  await f.sync();f.observation.autonomousExecutionPackage.sha256='0'.repeat(64);await f.put(f.observationBinding.path,f.observation);
  assert.equal((await f.read()).reasonCode,'training_observation_package_backlink_conflict');
  f.observation.autonomousExecutionPackage={...f.envelopeBinding,path:'.runtime/ai-painter/foreign/package.json'};await f.put(f.observationBinding.path,f.observation);
  assert.equal((await f.read()).reasonCode,'training_observation_package_backlink_conflict');
});
test('unknown envelope, absent or ambiguous explicit plan never scans for a fallback',async t=>{
  const f=await fixture(t);f.envelope.schemaVersion='future-package-v2';await f.refreshEnvelope();
  assert.equal((await f.read()).reasonCode,'training_package_schema_unsupported');
  f.envelope.schemaVersion='ai-painter-autonomous-closed-loop-package-v1';f.envelope.inputEvidence=[];await f.refreshEnvelope();
  assert.equal((await f.read()).reasonCode,'training_autonomous_plan_binding_unavailable');
  f.envelope.inputEvidence=[f.planBinding,f.planBinding];await f.refreshEnvelope();
  assert.equal((await f.read()).reasonCode,'training_autonomous_plan_binding_unavailable');
});
test('missing observation surface cannot be used',async t=>{
  const f=await fixture(t),p=path.join(f.root,f.observationBinding.path);await fs.unlink(p);
  assert.equal((await f.read()).availability,'unavailable');
});
test('oversized observation surface cannot be used',async t=>{
  const f=await fixture(t),p=path.join(f.root,f.observationBinding.path);
  await fs.writeFile(p,' '.repeat(2*1024*1024+1));assert.equal((await f.read()).availability,'unavailable');
});
test('file-symlink escaped observation surface cannot be used',async t=>{
  const f=await fixture(t),p=path.join(f.root,f.observationBinding.path);
  await fs.unlink(p);const outside=await fs.mkdtemp(path.join(os.tmpdir(),'aic-unbound-'));
  t.after(()=>fs.rm(outside,{recursive:true,force:true}));const file=path.join(outside,'package.json');await fs.writeFile(file,JSON.stringify(f.observation));
  await fs.symlink(file,p,'file');assert.equal((await f.read()).availability,'unavailable');
});
test('reads preserve all fixture bytes and refresh real progress without caching or eligibility promotion',async t=>{
  const f=await fixture(t);f.observation.trainingAllowed=true;await f.put(f.observationBinding.path,f.observation);
  const before=await Promise.all([...f.paths].map(async p=>[p,hash(await fs.readFile(path.join(f.root,p)))]));
  const a=await f.read();assert.equal(a.availability,'available');assert.equal(a.trainingAllowed,undefined);
  assert.deepEqual(await Promise.all([...f.paths].map(async p=>[p,hash(await fs.readFile(path.join(f.root,p)))])),before);
  f.progress.optimizerStepsGenerator=102;await f.put(`${f.outputRoot}/progress.json`,f.progress);const b=await f.read();
  assert.equal(b.currentMetrics.optimizationStep,102);assert.notEqual(b.currentMetrics.sourceSha256,a.currentMetrics.sourceSha256);
});
test('verified production registry and capsule keep terminal and container SHA identities separate',async()=>{
  const root=process.cwd(),verified=await readCurrentExecutionRegistry(root);
  assert.equal(verified.ok,true);
  const registry=verified.registry,capsule=verified.taskCapsule,terminal=verified.currentTaskTerminal;
  const container=capsule.evidence.find(b=>b.kind==='execution_package');assert.ok(container);
  assert.equal(registry.packageSha256,registry.terminalEvidence.sha256);
  assert.notEqual(registry.packageSha256,container.sha256);
  const p=await readBoundTrainingPresentation(root,registry,capsule,terminal);
  assert.equal(p.availability,'available');assert.equal(p.packageSha256,container.sha256);
  const envelope=JSON.parse(await fs.readFile(path.join(root,container.path),'utf8'));
  const plans=envelope.inputEvidence.filter(b=>['ecology-plan.json','failure-capture-plan.json','quality-plan.json']
    .some(name=>b.path===`${envelope.outputRoot}/${name}`));assert.equal(plans.length,1);
  const plan=JSON.parse(await fs.readFile(path.join(root,plans[0].path),'utf8')),ceiling=plan.configuration.executionCeiling;
  assert.equal(p.runId,registry.runId);assert.equal(p.targetEpochs,ceiling.epochs);
  assert.equal(p.targetOptimizerSteps,ceiling.generatorOptimizerSteps);
  assert.equal(p.targetDiscriminatorOptimizerSteps,ceiling.discriminatorOptimizerSteps);
  assert.deepEqual(p.resolution,{width:plan.configuration.scope.resolution[0],height:plan.configuration.scope.resolution[1]});
  if (registry.activeExecution) {
    assert.equal(p.completedEpochs,null);assert.equal(p.actualOptimizerSteps,null);
    assert.equal(p.currentMetrics.availability,'available');assert.equal(p.currentMetrics.processId,registry.activeExecution.processId);
    assert.equal(p.currentMetrics.runId,registry.runId);assert.ok(p.currentMetrics.optimizationStep<=ceiling.generatorOptimizerSteps);
    assert.ok(p.currentMetrics.discriminatorOptimizerSteps<=ceiling.discriminatorOptimizerSteps);
  } else {
    assert.equal(p.currentMetrics.reasonCode,'active_execution_not_registered');
    const worker=terminal.workerTerminal?JSON.parse(await fs.readFile(path.join(root,terminal.workerTerminal.path),'utf8')):terminal;
    assert.equal(p.completedEpochs,worker.completedEpochs??null);
    assert.deepEqual(p.actualOptimizerSteps,{generator:worker.optimizerStepsGenerator,critic:worker.optimizerStepsDiscriminator});
  }
});
