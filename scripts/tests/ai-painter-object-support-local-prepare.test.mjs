import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {LOCAL_CONTROL_REGISTRATION as DEFAULT_V2, LOCAL_OBJECT_SUPPORT_PREPARE_REGISTRATION as V2,
  localPreparationRoute, localPreparationSelectionFromRequestPath, parseLocalPrepareArguments,
  verifyPreparationSources, projectLocalPreparationStopTarget, runLocalPreparationRequest}
  from '../lib/ai-painter-local-prepare-v1.mjs';
import {LOCAL_CONTROL_REGISTRATION as DEFAULT_V1, LOCAL_OBJECT_SUPPORT_CONTROL_REGISTRATION as V1,
  validateLocalStartPackage, runLocalControlForIsolatedTests} from '../run-ai-painter-local-control-v1.mjs';
import {PHASES, CLOSED_LOOP_CONTRACT_PATH, CURRENT_ENTRYPOINT_REGISTRY_PATH}
  from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
import {initializeOwnedStopControlEvidence} from '../lib/ai-painter-owned-stop-native-control-v1.mjs';
import {issueLocalOperatorSession} from '../../src/server/ai-console-control/operator-session.ts';

// Inert source and metadata only. Never import the candidate chain/native or start a runner.
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const selection = 'object-support-structure-quality-v1', route = localPreparationRoute(selection);
const put = (root, logical, value) => {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  const file = path.join(root, logical); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, bytes);
  return {path:logical, sha256:hash(bytes)};
};
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
