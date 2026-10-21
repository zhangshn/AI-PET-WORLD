import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {LOCAL_CONTROL_REGISTRATION as DEFAULT_V2, LOCAL_OBJECT_SUPPORT_PREPARE_REGISTRATION as V2,
  localPreparationRoute, localPreparationSelectionFromRequestPath, parseLocalPrepareArguments,
  verifyPreparationSources, projectLocalPreparationStopTarget, runLocalPreparationRequest,
  LOCAL_FINAL_RGB_PREPARE_REGISTRATION, LOCAL_DECODE1_ENTRY_WEIGHT_PREPARE_REGISTRATION, runFinalRgbPreparationForIsolatedTests}
  from '../lib/ai-painter-local-prepare-v1.mjs';
import {LOCAL_CONTROL_REGISTRATION as DEFAULT_V1, LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION as V1,
  validateLocalStartPackage, runLocalControlForIsolatedTests} from '../run-ai-painter-local-control-v1.mjs';
import {PHASES, CLOSED_LOOP_CONTRACT_PATH, CURRENT_ENTRYPOINT_REGISTRY_PATH, runAutonomousClosedLoop}
  from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
import {initializeOwnedStopControlEvidence} from '../lib/ai-painter-owned-stop-native-control-v1.mjs';
import {issueLocalOperatorSession} from '../../src/server/ai-console-control/operator-session.ts';

// Private metadata and synthetic adapters only; never start a native runner or model.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const selection = 'object-support-structure-quality-v1', route = localPreparationRoute(selection);
const put = (root, logical, value) => {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  const file = path.join(root, logical); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, bytes);
  return {path:logical, sha256:hash(bytes)};
};
test('decode1 entry preparation adds only its fixed selection, namespace and independent adapters',()=>{
 const selected=localPreparationRoute('decode1-entry-weight-quality-v1'),id=selected.prefix+randomUUID();
 assert.deepEqual(selected.registration,LOCAL_DECODE1_ENTRY_WEIGHT_PREPARE_REGISTRATION);
 assert.equal(selected.capability,'stage4_mvp256_dry_decode1_entry_weight_quality24_v1');
 assert.equal(selected.prefix,'decode1-entry-quality-v1-');assert.equal(selected.packagePrefix,'decode1-entry-quality-v1-package-');
 assert.equal(selected.outputRoot,'.runtime/ai-painter/decode1-entry-weight-quality-executions');
 assert.equal(selected.adapter,'scripts/run-ai-painter-decode1-entry-weight-quality-v1.mjs');
 for(const [key,suffix]of [['chain','package-chain'],['native','owned-native']])
  assert.equal(selected[key],'./ai-painter-decode1-entry-weight-quality-'+suffix+'-v1.mjs');
 assert.equal(localPreparationSelectionFromRequestPath(selected.outputRoot+'/'+id+'/local-prepare/request.json'),selected.registration.candidateSelection);
 assert.deepEqual(parseLocalPrepareArguments(['--protocol','ai-painter-local-control-v2','start','--candidate',selected.registration.candidateSelection]),
  {command:'start',candidateSelection:'decode1-entry-weight-quality-v1'});
 for(const command of ['status','stop'])assert.equal(parseLocalPrepareArguments(['--protocol','ai-painter-local-control-v2',command,'--request-id',id]).requestId,id);
 const tooMany=Object.fromEntries(Array.from({length:257},(_,i)=>['source-'+i,{path:'not-read-'+i,sha256:'1'.repeat(64)}]));
 assert.throws(()=>verifyPreparationSources(process.cwd(),tooMany,'decode1-entry-weight-quality-v1'),/local_prepare_source_count_limit/);
 const registry=JSON.parse(fs.readFileSync(CURRENT_ENTRYPOINT_REGISTRY_PATH));
 assert.deepEqual(registry.localControlEntrypoints.filter(row=>row.entryId===selected.registration.entryId),[selected.registration]);
});
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-compat-local-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const runId = route.prefix + randomUUID(), packageId = route.packagePrefix + randomUUID();
  const outputRoot = `${route.outputRoot}/${runId}`, programBindings = {};
  const required = [V1.entryFile, V1.adapterFile, 'scripts/lib/ai-painter-owned-stop-native-control-v1.mjs',
    'scripts/lib/ai-painter-owned-stop-request-v1.mjs', 'scripts/lib/ai-painter-owned-stop-handoff-v1.mjs',
    'scripts/lib/ai-painter-owned-stop-execution-bridge-v1.mjs', 'src/server/ai-console-control/operator-session.ts'];
  required.forEach((file, index) => { programBindings[`role${index}`] = put(root, file, '// inert source fixture'); });
  const plan = {schema:'object-support-structure-quality-plan-v1', capabilityVersion:route.capability,
    runId, packageId, outputRoot, programBindings};
  const spec = {schemaVersion:'ai-painter-autonomous-closed-loop-package-v1', packageIdentity:packageId,
    capabilityVersion:route.capability, outputRoot, ownerAuthorizationRequired:false, ownerInStateMachine:false,
    maxInfrastructureRecoveryAttempts:0, inputEvidence:[],
    programLineage:Object.fromEntries(Object.entries(programBindings).map(([key, b]) => [key, b.sha256])),
    phaseAdapters:Object.fromEntries(PHASES.map(phase => [phase, {kind:'project_module_export',
      path:V1.adapterFile, sha256:programBindings.role1.sha256, exportName:phase}]))};
  put(root, CLOSED_LOOP_CONTRACT_PATH, fs.readFileSync(CLOSED_LOOP_CONTRACT_PATH));
  const registry = {schemaVersion:'ai-painter-current-entrypoint-registry-v1', status:'active',
    currentEntrypoints:[], localControlEntrypoints:[V1, V2]};
  const save = () => {
    put(root, CURRENT_ENTRYPOINT_REGISTRY_PATH, registry);
    spec.inputEvidence = [put(root, `${outputRoot}/quality-plan.json`, plan)];
    const binding = put(root, `.runtime/ai-painter/autonomous-closed-loop-packages/${packageId}/package.json`, spec);
    return {command:'start', packagePath:binding.path, packageSha256:binding.sha256};
  };
  return {root, runId, packageId, outputRoot, plan, spec, registry, save};
}

test('explicit new selection matches both registered rows; defaults and all previous routes remain', () => {
  const registry = JSON.parse(fs.readFileSync(CURRENT_ENTRYPOINT_REGISTRY_PATH));
  for (const expected of [V1, V2]) assert.deepEqual(registry.localControlEntrypoints.filter(row => row.entryId === expected.entryId), [expected]);
  assert.equal(DEFAULT_V2.candidateSelection, 'ecology-quality-v1');
  assert.equal(DEFAULT_V1.capabilityVersion, 'stage4_mvp256_dry_factorized_ecology_quality_v1');
  assert.deepEqual(route.registration, V2);
  assert.equal(route.capability, 'stage4_mvp256_dry_object_support_structure_quality24_v1');
  assert.equal(route.prefix, 'object-support-quality-v1-');
  assert.equal(route.packagePrefix, 'object-support-quality-v1-package-');
  assert.equal(route.chain, './ai-painter-object-support-structure-quality-package-chain-v1.mjs');
  assert.equal(route.native, './ai-painter-object-support-structure-quality-owned-native-v1.mjs');
  assert.equal(route.adapter, 'scripts/run-ai-painter-object-support-structure-quality-v1.mjs');
  assert.equal(V2.candidateBinding.sha256, 'ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566');
  for (const candidate of ['ecology-quality-v1', 'ecology-decode1-quality-v1', 'ecology-terrain-detail-quality-v1', selection]) {
    const selected = localPreparationRoute(candidate), id = selected.prefix + randomUUID();
    assert.deepEqual(parseLocalPrepareArguments(['--protocol', V2.protocol, 'start', '--candidate', candidate]), {command:'start', candidateSelection:candidate});
    for (const command of ['status', 'stop']) assert.equal(parseLocalPrepareArguments(['--protocol', V2.protocol, command, '--request-id', id]).requestId, id);
    assert.equal(localPreparationSelectionFromRequestPath(`${selected.outputRoot}/${id}/local-prepare/request.json`), candidate);
  }
  assert.throws(() => parseLocalPrepareArguments(['--protocol', V2.protocol, 'start']));
  assert.throws(() => localPreparationRoute('object-support-structure-quality-v2'));
  assert.throws(() => localPreparationSelectionFromRequestPath(`${route.outputRoot}/quality-v2-${randomUUID()}/local-prepare/request.json`));
  assert.throws(() => localPreparationSelectionFromRequestPath(`${localPreparationRoute('ecology-quality-v1').outputRoot}/${route.prefix}${randomUUID()}/local-prepare/request.json`));
});

test('v1 validates only the exact new package, registration, plan, root and adapter', t => {
  const f = fixture(t), command = f.save();
  assert.equal(validateLocalStartPackage(f.root, command).plan.runId, f.runId);
  for (const rows of [[], [DEFAULT_V1], [V1, V1], [{...V1, extra:true}], [{...V1, adapterFile:DEFAULT_V1.adapterFile}]]) {
    f.registry.localControlEntrypoints = rows;
    assert.throws(() => validateLocalStartPackage(f.root, f.save()), /registered/);
  }
  f.registry.localControlEntrypoints = [V1, V2];
  for (const change of [
    () => { f.plan.schema = 'ecology-terrain-detail-weight-quality-plan-v1'; },
    () => { f.plan.capabilityVersion = DEFAULT_V1.capabilityVersion; },
    () => { f.spec.phaseAdapters.execute.path = DEFAULT_V1.adapterFile; },
    () => { f.plan.outputRoot = '.runtime/ai-painter/ecology-regime-quality-executions/' + f.runId; f.spec.outputRoot = f.plan.outputRoot; },
  ]) {
    const plan = structuredClone(f.plan), spec = structuredClone(f.spec); change();
    assert.throws(() => validateLocalStartPackage(f.root, f.save()));
    Object.assign(f.plan, plan); Object.assign(f.spec, spec);
  }
});

test('v2 source closure requires new chain/adapter and rehashes inert source bytes', t => {
  const f = fixture(t), files = [V2.entryFile, V2.adapterFile,
    'scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs',
    'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs',
    'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs', 'scripts/lib/' + route.chain.slice(2),
    route.adapter, 'src/server/ai-console-control/operator-session.ts'];
  const bindings = Object.fromEntries(files.map((file, index) => [`source${index}`, put(f.root, file, '// inert preparation source')]));
  assert.equal(verifyPreparationSources(f.root, bindings, selection).uniqueFiles, files.length);
  assert.throws(() => verifyPreparationSources(f.root, bindings), /source_not_registered/);
  const missing = {...bindings}; delete missing.source5;
  assert.throws(() => verifyPreparationSources(f.root, missing, selection), /source_not_registered/);
  put(f.root, files[6], '// changed bytes');
  assert.throws(() => verifyPreparationSources(f.root, bindings, selection), /source_drift/);
});

test('v2 rejects foreign request identity before consumption or native loading', async t => {
  const f = fixture(t), logical = `${f.outputRoot}/local-prepare/request.json`;
  const request = {schema:'ai-painter-local-prepare-request-v1', protocol:V2.protocol, requestId:f.runId,
    runId:f.runId, packageId:f.packageId, outputRoot:f.outputRoot, candidateSelection:selection,
    candidateBinding:V2.candidateBinding, capabilityVersion:route.capability, executionPackage:null, automaticRetries:0};
  for (const change of [v => { v.capabilityVersion = DEFAULT_V1.capabilityVersion; },
    v => { v.candidateSelection = DEFAULT_V2.candidateSelection; }, v => { v.packageId = 'quality-v2-package-' + randomUUID(); }]) {
    const value = structuredClone(request); change(value); const b = put(f.root, logical, value);
    await assert.rejects(runLocalPreparationRequest({root:f.root, relativePath:logical, sha256:b.sha256}), /identity_mismatch|capability_mismatch|package_id_invalid/);
  }
  assert.equal(fs.existsSync(path.join(f.root, f.outputRoot, 'local-prepare/consumed.json')), false);
});

test('new capability survives read-only v1 status and v2 exact stop projection', async t => {
  const f = fixture(t), command = f.save(), processId = 123, processStartIdentity = '134359011720230661';
  const current = {ok:true, status:'verified', registry:{capabilityVersion:route.capability, runId:f.runId,
    packageId:f.packageId, registryRevision:4, executionState:'executing', activeExecution:{runId:f.runId,
      packageId:f.packageId, executionState:'executing', processId, processStartIdentity}}};
  const status = await runLocalControlForIsolatedTests({command:'status'}, null, f.root, {
    reader:async () => current, launcher:async () => assert.fail('no background launch permitted')});
  assert.equal(status.current.registry.capabilityVersion, route.capability); assert.equal(status.readOnly, true);
  fs.mkdirSync(path.join(f.root, f.outputRoot, 'operator-stop-control/inbox'), {recursive:true});
  fs.mkdirSync(path.join(f.root, f.outputRoot, 'operator-stop-control/requests'));
  const request = {requestId:f.runId, runId:f.runId, packageId:f.packageId, outputRoot:f.outputRoot,
    candidateSelection:selection, capabilityVersion:route.capability};
  const state = {requestId:f.runId, runId:f.runId, plannedPackageId:f.packageId, stage:'quality_loop_running',
    executionPackage:{path:command.packagePath, sha256:command.packageSha256}};
  const target = projectLocalPreparationStopTarget(f.root, {request, state, current});
  assert.equal(target.available, true); assert.equal(target.input.runId, f.runId);
  assert.equal(target.retainedNativeHookVerified, false);
  for (const changed of [{...request, capabilityVersion:DEFAULT_V1.capabilityVersion}, {...request, candidateSelection:DEFAULT_V2.candidateSelection}])
    assert.equal(projectLocalPreparationStopTarget(f.root, {request:changed, state, current}).available, false);
  assert.equal(projectLocalPreparationStopTarget(f.root, {request, state, current, processTerminal:{}}).available, false);
});

test('v1 new capability submits only a private synthetic stop intent and never claims cleanup', async t => {
  const f = fixture(t), command = f.save(), previous = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = hash(randomUUID());
  try {
    initializeOwnedStopControlEvidence(path.join(f.root, f.outputRoot, 'operator-stop-control'));
    const session = issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session', {headers:{host:'localhost:3000'}}));
    assert.equal(session.ok, true);
    const credentials = {cookie:session.setCookie.split(';')[0], csrf:session.session.csrfToken};
    const input = {runId:f.runId, packageId:f.packageId, executionPackagePath:command.packagePath,
      executionPackageSha256:command.packageSha256, expectedRegistryRevision:4, supervisorProcessId:123,
      supervisorProcessStartIdentity:'134359011720230661', idempotencyKey:'synthetic_stop_intent_0001', reasonText:'synthetic compatibility check'};
    const registry = {capabilityVersion:route.capability, runId:f.runId, packageId:f.packageId, registryRevision:4,
      executionState:'executing', activeExecution:{runId:f.runId, packageId:f.packageId, executionState:'executing',
        processId:input.supervisorProcessId, processStartIdentity:input.supervisorProcessStartIdentity}};
    const deps = {reader:async () => ({ok:true, status:'verified', registry}),
      launcher:async () => assert.fail('no process may start')};
    const result = await runLocalControlForIsolatedTests({command:'stop'}, {credentials, input}, f.root, deps);
    assert.equal(result.status, 'intent_submitted');
    for (const flag of ['requestAccepted','executionStopped','cleanupConfirmed','checkpointSaved']) assert.equal(result[flag], false);
    assert.equal((await runLocalControlForIsolatedTests({command:'stop'}, {credentials, input}, f.root, deps)).replayed, true);
    registry.capabilityVersion = 'unregistered-capability';
    await assert.rejects(runLocalControlForIsolatedTests({command:'stop'}, {credentials, input}, f.root, deps), /unknown_capability/);
  } finally {
    if (previous === undefined) delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
    else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = previous;
  }
});

// The existing isolated preparation hook exercises the shared object/final-RGB/
// joint implementation. Its CPU and native trust boundary are explicit stubs;
// the lifecycle, adapter loading, SHA checks and terminal file IO are real.
async function cleanupPreparationFixture(t, nativePhase='training', candidateSelection=LOCAL_FINAL_RGB_PREPARE_REGISTRATION.candidateSelection) {
  const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'final-rgb-prepare-isolated-')));
  t.after(()=>{
    assert.equal(path.dirname(base),fs.realpathSync.native(os.tmpdir()));
    assert.match(path.basename(base),/^final-rgb-prepare-isolated-[A-Za-z0-9]+$/u);
    fs.rmSync(base,{recursive:true,force:true});
  });
  const selected=localPreparationRoute(candidateSelection);
  const runId=selected.prefix+randomUUID(),packageId=selected.packagePrefix+randomUUID(),outputRoot=selected.outputRoot+'/'+runId;
  const adapterSource='export const fixture={};\n'+PHASES.map(phase=>
    `export async function ${phase}(){if(fixture.phase==='${phase}'){fixture.before?.();throw fixture.error;}return {status:'passed'};}\n`).join('');
  const files=[LOCAL_FINAL_RGB_PREPARE_REGISTRATION.entryFile,LOCAL_FINAL_RGB_PREPARE_REGISTRATION.adapterFile,
    'scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs','scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs',
    'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','scripts/lib/'+selected.chain.slice(2),selected.adapter,
    'src/server/ai-console-control/operator-session.ts'];
  const programs=Object.fromEntries(files.map((file,i)=>['source'+i,put(base,file,file===selected.adapter?adapterSource:'// inert private source\n')]));
  const adapterBinding=Object.values(programs).find(b=>b.path===selected.adapter);
  const adapter=await import(pathToFileURL(path.join(base,selected.adapter)).href+'?sha256='+adapterBinding.sha256);
  put(base,V2.candidateBinding.path,fs.readFileSync(V2.candidateBinding.path));
  put(base,CLOSED_LOOP_CONTRACT_PATH,fs.readFileSync(CLOSED_LOOP_CONTRACT_PATH));
  put(base,CURRENT_ENTRYPOINT_REGISTRY_PATH,{schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',
    currentEntrypoints:[],localControlEntrypoints:[selected.registration]});
  fs.mkdirSync(path.join(base,'.runtime/ai-painter/owned-worker-guards'),{recursive:true});
  const runtimeIdentity={python:{absolutePath:path.join(base,'never-executed-python')}};
  const request={schema:'ai-painter-local-prepare-request-v1',protocol:V2.protocol,requestId:runId,runId,packageId,outputRoot,
    candidateSelection:selected.registration.candidateSelection,candidateBinding:selected.registration.candidateBinding,
    capabilityVersion:selected.capability,executionPackage:null,automaticRetries:0,programBindings:programs,runtimeIdentity};
  const rb=put(base,outputRoot+'/local-prepare/request.json',request),events=[],retained=new Map(),scopes=new WeakMap();
  const roles={cpuHarness:'synthetic/cpu.py',gpuQualifier:'synthetic/qualification.py',worker:'synthetic/training.py',reviewDriver:'synthetic/review.mjs'};
  const inside=(_root,file)=>path.join(base,file),bind=(_root,file)=>({path:file,sha256:hash(fs.readFileSync(inside(base,file)))});
  const error=Object.assign(Error('synthetic_native_primary_failure'),{code:'EIO'});
  const f={base,request,events,error,adapter:adapter.fixture,receipt:null,scope:null,packageBinding:null};
  const retainFailure=(cpuRequest,packageBinding)=>{
    const callIdentity=randomUUID(),scopeRoot=outputRoot+(nativePhase==='review'?'/dry-review-owned':'');
    let args;
    if(nativePhase==='cpu')args=['-B',inside(base,roles.cpuHarness),'--cpu-request',cpuRequest.path,'--sha256',cpuRequest.sha256];
    else {
      const common=['--package',packageBinding.path,'--sha256',packageBinding.sha256];
      if(nativePhase==='qualification')args=['-B',inside(base,roles.gpuQualifier),...common];
      else {
        const input=put(base,outputRoot+(nativePhase==='training'?'/gpu-acceptance.json':'/worker-terminal.json'),{synthetic:true});
        args=nativePhase==='training'?['-B',inside(base,roles.worker),...common,'--gpu',input.path,'--gpu-sha256',input.sha256]
          :[inside(base,roles.reviewDriver),...common,'--terminal',input.path,'--terminal-sha256',input.sha256];
      }
    }
    const receipt={schema:'detail-weight-live-native-owner-receipt-v1',phase:nativePhase,cleanupConfirmed:true,processCleanupConfirmed:true,
      proof:{bindingBase64:Buffer.from(JSON.stringify({scope:base,guard:{identity:callIdentity,commandSha256:hash(JSON.stringify(args))}})).toString('base64')},
      streamBytes:{stdout:10,stderr:20}};
    const binding=put(base,`${scopeRoot}/owned-${nativePhase}-${callIdentity}/release-receipt.json`,receipt);
    const scope={runId,packageId,capabilityVersion:selected.capability,outputRoot:scopeRoot,phase:nativePhase,callIdentity};
    retained.set(JSON.stringify(binding),{receipt,snapshot:JSON.stringify(receipt)});scopes.set(receipt,scope);
    Object.assign(error,{ownedReceipt:receipt,receiptBinding:binding});Object.assign(f,{receipt,scope});
    adapter.fixture.error=error;adapter.fixture.phase=nativePhase==='review'?'review':'execute';
  };
  let cpuRequest;
  const stubs={root:base,relativePath:rb.path,sha256:rb.sha256,
    readRegistry:async()=>({ok:true,status:'verified',registry:{activeExecution:null}}),
    chain:{ROLES:roles,inside,bind,finalProgramBindings:()=>programs,runtimeIdentity:()=>runtimeIdentity,
      prepareCpuRequest:options=>{events.push('cpu_request');
        assert.equal(options.capabilityVersion,selected.capability);
        assert.deepEqual(options.preparationRequestBinding,rb,'registered non-default route requires its exact preparation request');
        cpuRequest=put(base,outputRoot+'/cpu-request.json',{synthetic:true});return cpuRequest;},
      finalizeCpuAcceptance:async()=>put(base,outputRoot+'/cpu-acceptance.json',{synthetic:true}),
      preparePlan:()=>put(base,outputRoot+'/quality-plan.json',{synthetic:true}),makeInternalCandidate:()=>({synthetic:true})},
    native:{runNative:async()=>{events.push('cpu');if(nativePhase==='cpu'){retainFailure(cpuRequest,null);adapter.fixture.before?.();throw error;}
        return {ownedReceipt:{syntheticCpuOnly:true}};},withNativeOrdinaryBudget:async(_r,_receipt,action)=>action(),
      nativeAccountingRoots:()=>[outputRoot],
      requireLiveOwnedReceipt:(root,binding)=>{
        assert.equal(root,base);const entry=retained.get(JSON.stringify(binding));assert.ok(entry,'same retained native call required');
        assert.equal(hash(fs.readFileSync(inside(root,binding.path))),binding.sha256,'retained receipt SHA differs');
        assert.equal(JSON.stringify(entry.receipt),entry.snapshot,'retained receipt mutated');return entry.receipt;},
      currentNativeFailureScope:(root,receipt)=>{assert.equal(root,base);assert.ok(scopes.has(receipt));return scopes.get(receipt);}},
    materialize:()=>{
      events.push('package');const spec={schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:packageId,
        capabilityVersion:selected.capability,outputRoot,ownerAuthorizationRequired:false,ownerInStateMachine:false,
        maxInfrastructureRecoveryAttempts:0,inputEvidence:[bind(base,outputRoot+'/quality-plan.json')],
        programLineage:Object.fromEntries(Object.entries(programs).map(([key,b])=>[key,b.sha256])),
        phaseAdapters:Object.fromEntries(PHASES.map(phase=>[phase,{kind:'project_module_export',...adapterBinding,exportName:phase}]))};
      f.packageBinding=put(base,'.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json',spec);
      retainFailure(cpuRequest,f.packageBinding);return {packagePath:f.packageBinding.path,packageSha256:f.packageBinding.sha256};},
    loop:async options=>{events.push('loop');f.lifecycle=await runAutonomousClosedLoop(options);return f.lifecycle;}};
  f.stubs=stubs;f.terminal=()=>JSON.parse(fs.readFileSync(path.join(base,outputRoot,'local-prepare/terminal.json')));
  return f;
}

test('same-call route passes its exact preparation binding before native CPU startup',async t=>{
  const f=await cleanupPreparationFixture(t,'cpu','decode1-entry-weight-quality-same-call-v1');
  await assert.rejects(runFinalRgbPreparationForIsolatedTests(f.stubs),error=>error===f.error);
  assert.deepEqual(f.events,['cpu_request','cpu']);
  assert.equal(f.terminal().cleanupConfirmed,true);
  assert.equal(f.terminal().executionPackage,null);
});

test('preparation propagates verified same-call CPU, qualification, training and review cleanup while preserving failure',async t=>{
  for(const phase of ['cpu','qualification','training','review']){
    const f=await cleanupPreparationFixture(t,phase);
    await assert.rejects(runFinalRgbPreparationForIsolatedTests(f.stubs),error=>error===f.error);
    const terminal=f.terminal();assert.equal(terminal.status,'failed_closed');assert.equal(terminal.cleanupConfirmed,true);
    assert.equal(terminal.originalErrorCode,'EIO');assert.match(terminal.detail,/synthetic_native_primary_failure/);
    assert.deepEqual(terminal.nativeFailureEvidence,f.error.receiptBinding);assert.equal(terminal.checkpointSaved,false);
    assert.equal(terminal.automaticRetries,0);assert.equal(f.events.filter(e=>e==='cpu').length,1);
    if(phase==='cpu')assert.equal(f.events.includes('package'),false);
    else {assert.equal(f.lifecycle.state,'failed_closed');assert.equal(f.lifecycle.failureCode,'adapter_exception');}
  }
});

test('preparation refuses missing, forged, mutated, foreign and uncleaned receipts without replacing the primary error',async t=>{
  const cases={
    missing:f=>{delete f.error.receiptBinding;},
    booleanOnly:f=>{f.error.cleanupConfirmed=true;delete f.error.ownedReceipt;},
    copiedReceipt:f=>{f.error.ownedReceipt=structuredClone(f.receipt);},
    missingDiskReceipt:f=>{f.error.receiptBinding={...f.error.receiptBinding,path:f.error.receiptBinding.path+'.missing'};},
    receiptSha:f=>{f.error.receiptBinding={...f.error.receiptBinding,sha256:'f'.repeat(64)};},
    receiptBytes:f=>{fs.appendFileSync(path.join(f.base,f.error.receiptBinding.path),' ');},
    mutatedReceipt:f=>{f.receipt.cleanupConfirmed=false;},
    foreignRun:f=>{f.scope.runId+='-foreign';},
    foreignPackage:f=>{f.scope.packageId+='-foreign';},
    foreignCapability:f=>{f.scope.capabilityVersion+='-foreign';},
    foreignOutput:f=>{f.scope.outputRoot+='/foreign';},
    foreignCall:f=>{f.scope.callIdentity=randomUUID();},
    wrongPhase:f=>{f.scope.phase='cpu';},
    packageSha:f=>{fs.appendFileSync(path.join(f.base,f.packageBinding.path),' ');},
    inputSha:f=>{put(f.base,f.request.outputRoot+'/gpu-acceptance.json',{changed:true});},
    verifierFailure:f=>{f.stubs.native.currentNativeFailureScope=()=>{throw Error('synthetic verifier IO failure');};},
  };
  for(const [name,mutate] of Object.entries(cases)){
    const f=await cleanupPreparationFixture(t);f.adapter.before=()=>mutate(f);
    await assert.rejects(runFinalRgbPreparationForIsolatedTests(f.stubs),error=>error===f.error,name);
    assert.equal(f.terminal().cleanupConfirmed,false,name);assert.equal(f.terminal().status,'failed_closed',name);
    assert.equal(f.terminal().originalErrorCode,'EIO',name);assert.equal(f.terminal().automaticRetries,0,name);
  }
});

test('real native private receipt gate rejects synthetic disk proof and caller cleanup booleans',async t=>{
  const native=await import('../lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs');
  const f=await cleanupPreparationFixture(t);
  f.stubs.native.requireLiveOwnedReceipt=native.requireLiveOwnedReceipt;
  f.stubs.native.currentNativeFailureScope=native.currentNativeFailureScope;
  await assert.rejects(runFinalRgbPreparationForIsolatedTests(f.stubs),error=>error===f.error);
  assert.equal(f.receipt.cleanupConfirmed,true);assert.equal(f.terminal().cleanupConfirmed,false);
});

test('a returned failed lifecycle without a current native error cannot inherit prior CPU cleanup',async t=>{
  const f=await cleanupPreparationFixture(t);
  f.stubs.loop=async()=>({state:'failed_closed',cleanupConfirmed:true});
  await assert.rejects(runFinalRgbPreparationForIsolatedTests(f.stubs),/local_prepare_quality_loop_failed_closed/);
  assert.equal(f.terminal().cleanupConfirmed,false);assert.equal(f.terminal().nativeFailureEvidence,null);
});
