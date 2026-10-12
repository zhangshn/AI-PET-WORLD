// syntheticCPU protocol fixtures only: no pixels, tensors, optimizer, GPU,
// training, production registration, qualification or background dispatch.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {CAPABILITY, ARCHITECTURE, NUMERIC_RULE, PLAN_SCHEMA, EXECUTION_PROFILE,
  COMPONENT_CPU_ACCEPTANCE, validate, verifyBindings, createPresentation, createActiveIdentity}
  from '../lib/ai-painter-ecology-execution-registration-v1.mjs';
import {CURRENT_EXECUTION_REGISTRY_ROOT as REGISTRY_ROOT,
  CURRENT_EXECUTION_REGISTRY_PATH as CURRENT_PATH, initializeCurrentExecutionRegistry,
  advanceCurrentExecutionRegistry, readCurrentExecutionRegistry}
  from '../../src/server/ai-painter-current-execution-registry.mjs';
import {readBoundTrainingPresentation} from '../../src/server/ai-console/bound-training-presentation.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceRoot = path.join(projectRoot, '.runtime/ai-painter/ecology-execution-auth-t-q4-71/registration');
const MAX = 8 * 1024 ** 2, started = Date.now();
const sha = raw => createHash('sha256').update(raw).digest('hex');
const clone = value => structuredClone(value);
const rawJson = value => Buffer.from(JSON.stringify(value) + '\n');
fs.mkdirSync(evidenceRoot, {recursive:true});
const root = fs.mkdtempSync(path.join(evidenceRoot, 'syntheticCPU-'));
const results = [];
function totalBytes(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).reduce((n, entry) => {
    const target = path.join(directory, entry.name), stat = fs.lstatSync(target);
    assert.equal(stat.isSymbolicLink(), false);
    return n + (stat.isDirectory() ? totalBytes(target) : stat.size);
  }, 0);
}
function write(logical, value) {
  assert.ok(Date.now() - started < 115000, 'test wall clock budget');
  assert.ok(!path.isAbsolute(logical) && !/[\\:]/u.test(logical)
    && logical.split('/').every(p => p && p !== '.' && p !== '..'));
  const raw = Buffer.isBuffer(value) ? value : rawJson(value);
  assert.ok(raw.length <= 2 * 1024 ** 2);
  assert.ok(totalBytes(root) + raw.length <= MAX - 65536, 'test output reserve');
  const target = path.join(root, logical);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, raw, {flag:'wx'});
  return {path:logical, sha256:sha(raw)};
}
function load(logical) { return JSON.parse(fs.readFileSync(path.join(root, logical))); }
function processIdentity() {
  const command = `$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter "ProcessId = ${process.pid}"; $p.CreationDate.ToUniversalTime().ToString('o')`;
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
      {encoding:'utf8', windowsHide:true, timeout:10000})
    : spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], {encoding:'utf8', timeout:10000});
  assert.equal(result.status, 0, result.stderr);
  return `${process.pid}:${result.stdout.replace(/^\uFEFF/u, '').trim()}`;
}
function fixture() {
  const componentRaw=fs.readFileSync(path.join(projectRoot,COMPONENT_CPU_ACCEPTANCE.path));
  assert.equal(sha(componentRaw),COMPONENT_CPU_ACCEPTANCE.sha256);
  write(COMPONENT_CPU_ACCEPTANCE.path,componentRaw);
  // These invented names/state hashes are deliberately not a real model graph
  // or a model CPU report. Only protocol metadata completeness is under test.
  const graph = [
    {name:'core.core.appearance.base.layers.0.ecology_branch.weight', shape:[32,7,3,3], elements:2016},
    {name:'core.core.appearance.base.layers.0.season_branch.weight', shape:[32,4,3,3], elements:1152},
    ...Array.from({length:16}, (_, i) => ({name:`object_rgb_heads.synthetic_${i}`, shape:[1], elements:1})),
    ...Array.from({length:89}, (_, i) => ({name:`synthetic_cpu.parameter_${i}`, shape:[1], elements:1})),
    {name:'synthetic_cpu.remaining_elements', shape:[2242687 - 2016 - 1152 - 16 - 89], elements:2242687 - 2016 - 1152 - 16 - 89},
  ];
  const modelIdentity = {syntheticCPU:true, capabilityVersion:CAPABILITY, architecture:ARCHITECTURE,
    numericRule:NUMERIC_RULE, graph, initialState:{generator:sha('synthetic generator'), discriminator:sha('synthetic discriminator')}};
  const modelBinding = write('fixture/model-identity.json', modelIdentity);
  const programBindings = {sidecar:write('fixture/program.mjs', Buffer.from('// syntheticCPU protocol program; never executed\n'))};
  const plan = {schema:PLAN_SCHEMA, executionProfile:EXECUTION_PROFILE, capabilityVersion:CAPABILITY,
    executionMode:'managed-training', componentCpuAcceptance:{...COMPONENT_CPU_ACCEPTANCE},
    historicalCheckpointMayInitialize:false, trainingRestartAllowed:false,
    runId:'synthetic-ecology-run-71', packageId:'synthetic-ecology-package-71',
    outputRoot:'.runtime/ai-painter/ecology-regime-managed-executions/synthetic-ecology-run-71',
    modelBinding, programBindings, configuration:{capabilityVersion:CAPABILITY,
      scope:{resolution:[256,192]}, executionCeiling:{epochs:48, generatorOptimizerSteps:2304,
        discriminatorOptimizerSteps:2304, cpuThreads:2, trainingAttempts:1, automaticRetries:0,
        maxWallSeconds:2700, maxGpuMemoryFraction:0.7, maximumTemperatureC:85,
        minimumFreeVramMiB:2048, minimumFreeDiskMiB:2048, maxOutputMiB:128},
      checkpointSelection:{eligibleEpochs:[24,36,48]}, historicalCheckpointMayInitialize:false,
      automaticResumeAllowed:false, freshInitializationOnly:true}};
  const planBinding = write(`${plan.outputRoot}/ecology-plan.json`, plan);
  const packageBinding = write(`.runtime/ai-painter/autonomous-closed-loop-packages/${plan.packageId}/package.json`,
    {schemaVersion:'ai-painter-autonomous-closed-loop-package-v1', syntheticCPU:true,
      packageIdentity:plan.packageId, runId:plan.runId, capabilityVersion:CAPABILITY,
      outputRoot:plan.outputRoot, inputEvidence:[planBinding, modelBinding, COMPONENT_CPU_ACCEPTANCE],
      programLineage:Object.fromEntries(Object.entries(programBindings).map(([role,b]) => [role,b.sha256]))});
  return {plan, planBinding, packageBinding, modelBinding, modelIdentity};
}
async function initialize() {
  const now = new Date().toISOString();
  const candidate = write('fixture/bootstrap/candidate.json', {schemaVersion:'stage4-post-decode-bounded-candidate-v1',
    syntheticCPU:true, status:'cpu_inactive_candidate_planned_not_implemented'});
  const terminal = write('fixture/bootstrap/terminal.json', {schemaVersion:'stage4-post-decode-failure-bounded-planning-terminal-v1',
    syntheticCPU:true, executionState:'completed', status:'bounded_candidate_planning_completed',
    planningRunId:'synthetic-bootstrap', nextAction:'synthetic-cpu-protocol-check', candidate, recordedAtUtc:now});
  const capsule = write('fixture/bootstrap/capsule.json', {schemaVersion:'ai-painter-local-task-capsule-v2',
    syntheticCPU:true, latestTerminal:terminal, recordedAtUtc:now});
  const historical = write('fixture/history/terminal.json', {schemaVersion:'stage4-post-decode-object-rgb-stage0-terminal-v1',
    syntheticCPU:true, executionState:'failed_closed', status:'post_decode_object_rgb_stage0_real_visual_failure',
    runId:'synthetic-history-only', recordedAtUtc:now});
  for (const name of ['execution-state.json','machine-review.json','training-output/progress.json'])
    write(`fixture/history/${name}`, {syntheticCPU:true, updatedAtUtc:now});
  const result = await initializeCurrentExecutionRegistry({projectRoot:root, currentTaskCapsulePath:capsule.path,
    currentTaskTerminalPath:terminal.path, currentCandidatePath:candidate.path,
    latestTrainingTerminalPath:historical.path, archivedEvidenceNamespaces:[]});
  assert.equal(result.ok, true, result.errorCode);
  return result;
}

test('T-Q4-71 syntheticCPU ecology registration protocol (retained isolated evidence)', {timeout:115000}, async t => {
  const productionCurrent = path.join(projectRoot, CURRENT_PATH);
  const productionBefore = sha(fs.readFileSync(productionCurrent));
  const workOrderRaw=fs.readFileSync(path.join(evidenceRoot,'work-order.json'));
  const workOrder=write('work-order.json',workOrderRaw);
  const input = fixture(), now = new Date().toISOString(), identity = processIdentity();
  const lock = write(`${input.plan.outputRoot}/execution-lock.json`, {
    schemaVersion:'ai-painter-current-active-execution-lock-v1', capabilityVersion:CAPABILITY,
    packageId:input.plan.packageId, runId:input.plan.runId, processId:process.pid, processStartIdentity:identity});
  write(`${input.plan.outputRoot}/heartbeat.json`, {schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',
    capabilityVersion:CAPABILITY, packageId:input.plan.packageId, runId:input.plan.runId,
    processId:process.pid, processStartIdentity:identity, executionState:'preflight', heartbeatAtUtc:now, ttlSeconds:120});
  const execution = {...input.plan, programBindings:input.plan.programBindings, processId:process.pid,
    processStartIdentity:identity, executionState:'preflight', lock,
    heartbeat:{path:`${input.plan.outputRoot}/heartbeat.json`, ttlSeconds:120}};
  const runCase = async (name, action) => t.test(name, async () => {
    try { await action(); results.push({name, status:'pass', syntheticCPU:true}); }
    catch (error) { results.push({name, status:'fail', error:String(error.stack)}); throw error; }
  });
  t.after(() => {
    const productionAfter = sha(fs.readFileSync(productionCurrent));
    const summary = {schemaVersion:'ecology-registration-sidecar-test-evidence-v1', syntheticCPU:true,
      startedAtUtc:new Date(started).toISOString(), completedAtUtc:new Date().toISOString(),
      elapsedMs:Date.now()-started, cpuThreads:2, outputLimitBytes:MAX, evidenceBytesBeforeSummary:totalBytes(root),
      productionCurrentBefore:productionBefore, productionCurrentAfter:productionAfter,
      productionCurrentUnchanged:productionAfter === productionBefore, cases:results,
      workOrder, workOrderSourcePath:path.join(evidenceRoot,'work-order.json'),
      command:'node --test --test-concurrency=1 scripts/tests/ai-painter-ecology-execution-registration.test.mjs',
      sourceBindings:['scripts/lib/ai-painter-ecology-execution-registration-v1.mjs',
        'scripts/tests/ai-painter-ecology-execution-registration.test.mjs',
        'src/server/ai-painter-current-execution-registry.mjs'].map(logical=>({path:logical,
        sha256:sha(fs.readFileSync(path.join(projectRoot,logical)))})),
      qualificationGranted:0, gpuCalls:0, imageContentReads:0, optimizerUpdates:0,
      productionRegistered:false, protocolTestsOnly:true};
    write('summary.json', summary);
    console.log(`Retained syntheticCPU registry evidence: ${root}`);
    assert.equal(summary.productionCurrentUnchanged, true);
    assert.ok(totalBytes(root) <= MAX);
  });
  await runCase('pure constructors are detached and bound files verify', () => {
    assert.deepEqual(verifyBindings(root,input), input);
    const verified = validate(input); verified.plan.configuration.scope.resolution[0] = 999;
    assert.deepEqual(input.plan.configuration.scope.resolution, [256,192]);
    const active = createActiveIdentity(input, execution);
    assert.equal(active.schemaVersion, 'ai-painter-current-active-execution-v1');
    assert.deepEqual(active.programLineage,input.plan.programBindings);
    const presentation = createPresentation(input);
    presentation.trainingPlan.checkpointSelection.eligibleEpochs[0] = 1;
    assert.deepEqual(input.plan.configuration.checkpointSelection.eligibleEpochs,[24,36,48]);
  });
  await runCase('wrong capability, legacy model, incomplete graph and wrong roots fail', () => {
    const mutations = [
      v => {v.plan.capabilityVersion='old-cap';},
      v => {v.plan.executionMode='synthetic-cpu-bootstrap';},
      v => {v.plan.componentCpuAcceptance.sha256='0'.repeat(64);},
      v => {v.plan.configuration.executionCeiling.maxWallSeconds=4200;},
      v => {v.plan.resourcePolicy={};},
      v => {v.modelIdentity.capabilityVersion='stage4_mvp256_dry_appearance_regime_detail_weight_precision_v1';},
      v => {v.modelIdentity.architecture='cpu_prototype';},
      v => {v.modelIdentity.numericRule='old-rule';},
      v => {v.modelIdentity.graph.pop();},
      v => {v.modelIdentity.graph[0].name='wrong-ecology';},
      v => {v.modelIdentity.graph[0].shape=[32,4,3,3];},
      v => {v.modelIdentity.graph[2].name=v.modelIdentity.graph[3].name;},
      v => {v.modelIdentity.initialState.generator=true;},
      v => {v.plan.runId=v.plan.packageId;},
      v => {v.plan.outputRoot+='/nested';},
      v => {v.plan.outputRoot=v.plan.outputRoot.replace('ecology-regime','detail-weight');},
      v => {v.plan.runId='wrong-run-71';},
      v => {v.plan.packageId='wrong-package-71';},
      v => {v.packageBinding.path='../escape/package.json';},
      v => {v.packageBinding.path='C:/escape/package.json';},
      v => {v.packageBinding.path='.runtime//package.json';},
      v => {v.modelBinding={...v.modelBinding,sha256:'a'.repeat(64)};},
      v => {v.plan.programBindings.constructor=clone(v.plan.programBindings.sidecar);},
    ];
    for (const mutate of mutations) {const value=clone(input); mutate(value); assert.throws(()=>validate(value),undefined,String(mutate));}
  });
  await runCase('numeric strings, booleans, NaN and unsafe integers cannot bind workload or graph', () => {
    for (const value of ['48', true, false, NaN, Infinity, 48.1, Number.MAX_SAFE_INTEGER+1]) {
      const v=clone(input); v.plan.configuration.executionCeiling.epochs=value;
      assert.throws(()=>validate(v), /ceiling_epochs_invalid/u);
    }
    for (const key of ['generatorOptimizerSteps','discriminatorOptimizerSteps','cpuThreads','trainingAttempts','automaticRetries']) {
      const v=clone(input); v.plan.configuration.executionCeiling[key]=String(v.plan.configuration.executionCeiling[key]);
      assert.throws(()=>validate(v));
    }
    for (const mutate of [v=>{v.plan.configuration.scope.resolution[0]='256';},
      v=>{v.plan.configuration.checkpointSelection.eligibleEpochs[0]='24';},
      v=>{v.modelIdentity.graph[0].elements='2016';}, v=>{v.modelIdentity.graph[0].shape[0]=true;}]) {
      const v=clone(input); mutate(v); assert.throws(()=>validate(v));
    }
  });
  await runCase('active run/package/cap/lineage/PID/root/TTL defects reject; alive cannot infer state', () => {
    for (const mutate of [v=>{v.runId='wrong-run-71';},v=>{v.packageId='wrong-package-71';},
      v=>{v.capabilityVersion='old-cap';},v=>{v.programBindings.sidecar.sha256='a'.repeat(64);},
      v=>{v.processId=String(process.pid);},v=>{v.processId=true;},v=>{v.processStartIdentity=' ';},
      v=>{v.lock.path='other/execution-lock.json';},v=>{v.heartbeat.ttlSeconds='120';},
      v=>{v.heartbeat.ttlSeconds=121;},v=>{v.heartbeat.path='other/heartbeat.json';},
      v=>{delete v.executionState;v.alive=true;},v=>{v.executionState='training_completed';}]) {
      const v=clone(execution);mutate(v);assert.throws(()=>createActiveIdentity(input,v));
    }
  });
  await runCase('observation schema grants zero qualification even with caller booleans', () => {
    const untrusted = {...clone(input), cpuQualified:true, gpuQualified:true, trainingAllowed:true, alive:true};
    const presentation=createPresentation(untrusted);
    assert.equal(presentation.schemaVersion,'ai-painter-current-training-package-v1');
    for (const key of ['cpuQualified','gpuQualified','trainingAllowed','checkpointPromotable',
      'formalStage4QualificationAllowed','runtimePublicationAllowed','productionExecutionAuthenticated']) assert.equal(presentation[key],false);
    assert.equal(presentation.observationOnly,true);
    assert.deepEqual(presentation.trainingPlan.checkpointSelection.eligibleEpochs,[24,36,48]);
  });

  let current, advance, observationBinding;
  await runCase('existing registry commits actual isolated SQLite/events/current transaction', async () => {
    current = await initialize();
    observationBinding=write(`${input.plan.outputRoot}/package.json`,createPresentation(input));
    const evidence=write(`${input.plan.outputRoot}/dispatch-observation.json`,{syntheticCPU:true,
      runId:input.plan.runId, executionState:'completed', status:'synthetic_identity_preflight_only',
      executionPackage:input.packageBinding, trainingStarted:false, qualificationGranted:0});
    const capsule=write(`${input.plan.outputRoot}/capsule.json`,{schemaVersion:'ai-painter-local-task-capsule-v1',
      syntheticCPU:true, integrity:{status:'verified'}, evidence:[observationBinding,evidence].map(b=>({...b,sha256Verified:true}))});
    advance={projectRoot:root,capabilityVersion:CAPABILITY,packageId:input.plan.packageId,
      taskId:'synthetic-ecology-identity',taskKind:'synthetic_cpu_protocol_check',
      runId:input.plan.runId,lifecycleStage:'isolated_implementation',executionState:'preflight',
      activity:'synthetic_cpu_identity_only',queueStatus:'running',nextMachineAction:null,
      activeExecution:createActiveIdentity(input,execution),taskCapsulePath:capsule.path,terminalEvidencePath:evidence.path,
      expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256};
    const result=await advanceCurrentExecutionRegistry(advance);
    assert.equal(result.ok,true,result.errorCode);
    current=await readCurrentExecutionRegistry(root);
    assert.equal(current.ok,true,current.errorCode);
    assert.equal(current.registry.registryRevision,2);assert.equal(current.registry.eventSequence,2);
    assert.deepEqual(current.registry.activeExecution,advance.activeExecution);
    assert.equal(current.registry.latestTrainingTerminal.runId,'synthetic-history-only');
    const transaction=load(`${REGISTRY_ROOT}/transactions/${current.registry.transactionId}/transaction.json`);
    const events=fs.readFileSync(path.join(root,`${REGISTRY_ROOT}/events.jsonl`),'utf8').trim().split('\n').map(JSON.parse);
    const db=new DatabaseSync(path.join(root,REGISTRY_ROOT,'registry.sqlite'),{readOnly:true});
    try {
      const row=db.prepare('SELECT * FROM registry_revisions WHERE registry_revision = 2').get();
      const commit=db.prepare('SELECT * FROM registry_transactions WHERE transaction_id = ?').get(current.registry.transactionId);
      assert.equal(row.transaction_id,current.registry.transactionId);assert.equal(row.event_sequence,2);
      assert.equal(row.current_sha256,current.registrySha256);assert.equal(commit.status,'committed');
      assert.equal(commit.current_sha256,current.registrySha256);
    } finally {db.close();}
    assert.equal(transaction.status,'committed');assert.equal(transaction.currentSha256,current.registrySha256);
    assert.equal(events.length,2);assert.equal(events[1].transactionId,current.registry.transactionId);
    assert.equal(events[1].currentSha256,current.registrySha256);
    write('roundtrip.json',{syntheticCPU:true,currentPath:CURRENT_PATH,registrySha256:current.registrySha256,
      workOrder,
      registryRevision:2,eventSequence:2,transactionId:current.registry.transactionId,
      sqlitePath:`${REGISTRY_ROOT}/registry.sqlite`,eventsPath:`${REGISTRY_ROOT}/events.jsonl`,
      observationBinding,productionRegistered:false,qualificationGranted:0});
    write('machine-current-read.json',{syntheticCPU:true,...current});
  });
  await runCase('real registry rejects cross run/package/cap/lineage without publication', async () => {
    assert.ok(current);
    for (const [key,value] of [['runId','wrong-run-71'],['packageId','wrong-package-71'],['capabilityVersion','old-cap']]) {
      const bad=clone(advance);bad.activeExecution[key]=value;
      bad.expectedPreviousRegistryRevision=2;bad.expectedPreviousRegistrySha256=current.registrySha256;
      await assert.rejects(advanceCurrentExecutionRegistry(bad),new RegExp(`registry_active_execution_${key==='capabilityVersion'?'capability':key==='packageId'?'package':'run'}_mismatch`));
    }
    const bad=clone(advance);bad.expectedPreviousRegistryRevision=2;bad.expectedPreviousRegistrySha256=current.registrySha256;
    bad.activeExecution.programLineage.sidecar.sha256='0'.repeat(64);
    await assert.rejects(advanceCurrentExecutionRegistry(bad),/program_sidecar_hash_mismatch/u);
    const after=await readCurrentExecutionRegistry(root);assert.equal(after.ok,true,after.errorCode);
    assert.equal(after.registrySha256,current.registrySha256);
  });
  await runCase('existing console reader consumes observation; live preflight proves no training progress', async () => {
    const presentation=await readBoundTrainingPresentation(root,current.registry,current.taskCapsule,current.currentTaskTerminal);
    assert.equal(presentation.availability,'available',presentation.reasonCode);
    assert.deepEqual(presentation.resolution,{width:256,height:192});
    assert.equal(presentation.targetEpochs,48);assert.equal(presentation.targetOptimizerSteps,2304);
    assert.equal(presentation.targetDiscriminatorOptimizerSteps,2304);
    assert.equal(presentation.completedEpochs,null);assert.equal(presentation.actualOptimizerSteps,null);
    assert.equal(presentation.currentMetrics.availability,'unavailable');
    assert.equal(presentation.currentMetrics.reasonCode,'training_progress_active_phase_not_training');
    write('console-presentation.json',{syntheticCPU:true,...presentation});
  });
  await runCase('self-consistent package SHA cannot hide wrong bound package or lineage', () => {
    const original=load(input.packageBinding.path);
    for (const [name,mutate] of [['run',v=>{v.runId='wrong-run-71';}],
      ['package',v=>{v.packageIdentity='wrong-package-71';}],['cap',v=>{v.capabilityVersion='old-cap';}],
      ['lineage',v=>{v.programLineage.sidecar='0'.repeat(64);}],['inputs',v=>{v.inputEvidence=[];}],
      ['root',v=>{v.outputRoot+='-wrong';}]]) {
      const value=clone(original);mutate(value);
      // Same standard relative path, different isolated root; retain each rejected fixture.
      const other=path.join(root,`rejected-${name}`);fs.mkdirSync(other);
      for (const b of [input.modelBinding,input.planBinding,COMPONENT_CPU_ACCEPTANCE,...Object.values(input.plan.programBindings)]) {
        const target=path.join(other,b.path);fs.mkdirSync(path.dirname(target),{recursive:true});
        fs.copyFileSync(path.join(root,b.path),target,fs.constants.COPYFILE_EXCL);
      }
      const target=path.join(other,input.packageBinding.path);fs.mkdirSync(path.dirname(target),{recursive:true});
      const raw=rawJson(value);fs.writeFileSync(target,raw,{flag:'wx'});
      assert.throws(()=>verifyBindings(other,{...input,packageBinding:{path:input.packageBinding.path,sha256:sha(raw)}}));
    }
  });
  await runCase('protocol-only terminal closes active registry without inventing training completion', async () => {
    const terminal=write(`${input.plan.outputRoot}/protocol-terminal.json`,{syntheticCPU:true,
      runId:input.plan.runId,executionState:'completed',status:'synthetic_cpu_protocol_completed_no_training',
      trainingStarted:false,qualificationGranted:0,recordedAtUtc:new Date().toISOString()});
    const result=await advanceCurrentExecutionRegistry({...advance,activeExecution:null,
      executionState:'completed',activity:'synthetic_cpu_protocol_completed',queueStatus:'completed',
      terminalEvidencePath:terminal.path,expectedPreviousRegistryRevision:2,
      expectedPreviousRegistrySha256:current.registrySha256});
    assert.equal(result.ok,true,result.errorCode);
    assert.equal(result.registry.registryRevision,3);
    assert.equal(result.registry.activeExecution,null);
    assert.equal(result.registry.latestTrainingTerminal.runId,'synthetic-history-only');
    const read=await readCurrentExecutionRegistry(root);assert.equal(read.ok,true,read.errorCode);
    const presentation=await readBoundTrainingPresentation(root,read.registry,read.taskCapsule,read.currentTaskTerminal);
    assert.equal(presentation.completedEpochs,null);assert.equal(presentation.actualOptimizerSteps,null);
    assert.equal(presentation.currentMetrics.reasonCode,'active_execution_not_registered');
    write('machine-current-terminal-read.json',{syntheticCPU:true,...read});
  });
  await runCase('tampered real source rejects fresh binding verification and registry read', async () => {
    const other=path.join(root,'rejected-registry-source');fs.mkdirSync(other);
    for (const logical of ['fixture','.runtime']) {
      fs.cpSync(path.join(root,logical),path.join(other,logical),{recursive:true,errorOnExist:true,force:false});
    }
    // Restore the captured active revision in the separate negative fixture,
    // along with its actual committed SQLite/events. No production record is touched.
    const transactionRoot=`${REGISTRY_ROOT}/transactions/${current.registry.transactionId}`;
    fs.copyFileSync(path.join(root,transactionRoot,'current.staged.json'),path.join(other,CURRENT_PATH));
    fs.appendFileSync(path.join(other,input.plan.programBindings.sidecar.path),'// retained deliberate tampering\n');
    assert.throws(()=>verifyBindings(other,input),/file_sha256_mismatch/u);
    const rejected=await readCurrentExecutionRegistry(other);
    assert.equal(rejected.ok,false);assert.equal(rejected.status,'unknown_or_stale');
    assert.match(rejected.errorCode,/program_sidecar_hash_mismatch/u);
    write('tamper-rejection.json',{syntheticCPU:true,errorCode:rejected.errorCode,
      rejectedAtUtc:new Date().toISOString(),originalCurrentSha256:current.registrySha256});
  });
});
