import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Isolated CPU transport/lifecycle fixture. This file is also copied, with its
// distinct SHA, to the CLI's fixed adapter path inside the private project.
// It is never the production quality adapter and confers no model qualification.
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const bindingPath = '.runtime/fixture/acceptance.json';
const fixedCpu = {logicalProcessors: 2, affinity: '3', seconds: 120, bytes: 8388608, attempts: 1, automaticRetries: 0};
const sourceCli = 'scripts/run-ai-painter-local-control-v1.mjs';
const adapterPath = 'scripts/run-ai-painter-ecology-quality-v1.mjs';
const phases = ['preflight', 'execute', 'validate', 'review', 'adjudicate', 'finalize'];

export function parseInitiatorExitArguments(argv) {
  assert.equal(argv.length, 2); assert.equal(argv[0], '--acceptance-root'); assert.ok(path.isAbsolute(argv[1]));
  const parent = fs.realpathSync('.runtime/ai-painter/controller-parallel-20261011/migration-local-control');
  const root = path.resolve(argv[1]); assert.equal(path.dirname(root), parent);
  assert.match(path.basename(root), /^native-acceptance-initiator-exit-[a-z0-9-]{8,64}$/u);
  assert.equal(fs.existsSync(root), false, 'new acceptance source/attempt only');
  for (let current = parent; path.dirname(current) !== current; current = path.dirname(current)) assert.equal(fs.lstatSync(current).isSymbolicLink(), false);
  return root;
}
function directoryBytes(root) {
  return fs.readdirSync(root, {withFileTypes: true}).reduce((bytes, entry) => {
    const file = path.join(root, entry.name), stat = fs.lstatSync(file); assert.equal(stat.isSymbolicLink(), false);
    if (stat.isDirectory()) return bytes + directoryBytes(file);
    assert.ok(stat.isFile() && stat.nlink === 1); return bytes + stat.size;
  }, 0);
}
function put(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
}
function processProbe(pid, setAffinity = false) {
  assert.ok(Number.isInteger(pid) && pid > 0);
  const command = `$ErrorActionPreference='Stop';${setAffinity ? `$p=Get-Process -Id ${pid};$p.ProcessorAffinity=[IntPtr]3;` : ''}$p=Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}";if($null -eq $p){[ordered]@{status='absent'}|ConvertTo-Json -Compress}else{[ordered]@{status='active';pid=[int]$p.ProcessId;creationDate=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress}`;
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {encoding: 'utf8', windowsHide: true, timeout: 8000});
  const probe = JSON.parse(output.replace(/^\uFEFF/u, ''));
  if (probe.status === 'active') { assert.equal(probe.pid, pid); assert.ok(Number.isFinite(Date.parse(probe.creationDate))); probe.identity = `${pid}:${probe.creationDate}`; }
  return probe;
}
let privateDeadlineTimer;
function phaseContext(context) {
  const binding = readJson(path.join(context.projectRoot, bindingPath));
  assert.equal(binding.fixtureProjectRoot, context.projectRoot); assert.equal(binding.fixtureOnly, true);
  assert.equal(binding.modelTraining, false); assert.equal(binding.gpuAllowed, false);
  assert.ok(Date.now() < binding.deadlineMs); assert.ok(directoryBytes(binding.acceptanceRoot) + 65536 < fixedCpu.bytes);
  return binding;
}
function logPhase(context, phase, detail) {
  const binding = phaseContext(context), log = path.join(context.projectRoot, '.runtime/fixture/lifecycle.jsonl');
  fs.appendFileSync(log, JSON.stringify({phase, pid: process.pid, recordedAtUtc: new Date().toISOString(), fixtureOnly: true, ...detail}) + '\n');
  context.heartbeat(); return binding;
}
export async function preflight(context) {
  const binding = phaseContext(context), identity = processProbe(process.pid, true);
  privateDeadlineTimer = setTimeout(() => { fs.appendFileSync(path.join(context.projectRoot, '.runtime/fixture/lifecycle.jsonl'), JSON.stringify({phase: 'deadline', pid: process.pid, failed: true}) + '\n'); process.exit(124); }, Math.max(1, binding.deadlineMs - Date.now() - 1000));
  privateDeadlineTimer.unref();
  logPhase(context, 'preflight', {identity, affinity: '3', gpuInitialized: false, nativeJobStarted: false});
  return {status: 'passed', fixtureOnly: true, gpuInitialized: false, nativeJobStarted: false};
}
export async function execute(context) {
  const binding = phaseContext(context), initiator = readJson(path.join(context.projectRoot, '.runtime/fixture/initiator.json'));
  let observed;
  for (let attempt = 0; attempt < 40; attempt++) {
    observed = processProbe(initiator.pid);
    if (observed.status === 'absent' || observed.identity !== initiator.identity) break;
    logPhase(context, 'waiting_for_initiator_exit', {initiatorPid: initiator.pid}); await sleep(500);
  }
  assert.ok(observed.status === 'absent' || observed.identity !== initiator.identity, 'initiator original process still active');
  logPhase(context, 'initiator_exit_observed_by_background', {initiator, observed, observerOrCodexSignalRequired: false});
  // Leave a real observation window after the initiating process has exited.
  await sleep(2000); phaseContext(context);
  const values = Array.from({length: 128}, (_, n) => (n + 1) * (n + 1));
  const evaluation = {schema: 'private-cpu-evaluation-v1', count: values.length, sum: values.reduce((a, b) => a + b, 0), sha256: sha(JSON.stringify(values)), initiatorExitObserved: true, fixtureOnly: true};
  put(path.join(context.projectRoot, '.runtime/fixture/evaluation.json'), evaluation);
  logPhase(context, 'execute', {evaluation, deadlineMs: binding.deadlineMs}); return {status: 'passed', evaluation};
}
export async function validate(context) {
  const evaluation = readJson(path.join(context.projectRoot, '.runtime/fixture/evaluation.json'));
  assert.equal(evaluation.count, 128); assert.equal(evaluation.sum, 128 * 129 * 257 / 6);
  assert.equal(evaluation.sha256, sha(JSON.stringify(Array.from({length: 128}, (_, n) => (n + 1) ** 2))));
  assert.equal(evaluation.initiatorExitObserved, true); logPhase(context, 'validate', {arithmeticAndDigestVerified: true});
  return {status: 'passed', arithmeticAndDigestVerified: true, fixtureOnly: true};
}
export async function review(context) {
  const rows = fs.readFileSync(path.join(context.projectRoot, '.runtime/fixture/lifecycle.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(rows.some(row => row.phase === 'initiator_exit_observed_by_background'));
  assert.ok(rows.some(row => row.phase === 'validate' && row.arithmeticAndDigestVerified));
  logPhase(context, 'review', {fixtureAuditPassed: true, modelAuditPerformed: false});
  return {status: 'passed', fixtureAuditPassed: true, modelAuditPerformed: false};
}
export async function adjudicate(context) { logPhase(context, 'adjudicate', {fixtureDecision: 'completed', trainingQualified: false}); return {status: 'passed', fixtureDecision: 'completed', trainingQualified: false}; }
export async function finalize(context) { logPhase(context, 'finalize', {fixtureOnly: true, checkpointSaved: false}); clearTimeout(privateDeadlineTimer); return {status: 'passed', fixtureOnly: true, checkpointSaved: false}; }

async function initializePrivateRegistry(projectRoot, acceptanceRoot, putBound) {
  const {initializeCurrentExecutionRegistry, readCurrentExecutionRegistry} = await import('../../src/server/ai-painter-current-execution-registry.mjs');
  const relative = '.runtime/fixture/history/';
  const candidate = putBound(relative + 'candidate.json', {schemaVersion: 'stage4-post-decode-bounded-candidate-v1', status: 'cpu_inactive_candidate_planned_not_implemented'});
  const terminal = putBound(relative + 'planning-terminal.json', {schemaVersion: 'stage4-post-decode-failure-bounded-planning-terminal-v1', executionState: 'completed', status: 'bounded_candidate_planning_completed', planningRunId: 'private-initiator-exit-plan', nextAction: 'private_cpu_fixture', candidate});
  const capsule = putBound(relative + 'capsule.json', {schemaVersion: 'ai-painter-local-task-capsule-v2', latestTerminal: terminal});
  const history = putBound(relative + 'training/terminal.json', {schemaVersion: 'stage4-post-decode-object-rgb-stage0-terminal-v1', executionState: 'completed', status: 'post_decode_object_rgb_stage0_real_visual_failure', runId: 'synthetic-initiator-exit-history', syntheticFixture: true});
  putBound(relative + 'training/execution-state.json', {status: 'completed', syntheticFixture: true});
  putBound(relative + 'training/machine-review.json', {syntheticFixture: true, previewCount: 0});
  putBound(relative + 'training/training-output/progress.json', {syntheticFixture: true, epoch: 0});
  const initialized = await initializeCurrentExecutionRegistry({projectRoot, currentTaskCapsulePath: capsule.path, currentTaskTerminalPath: terminal.path, currentCandidatePath: candidate.path, latestTrainingTerminalPath: history.path, archivedEvidenceNamespaces: []});
  assert.equal(initialized.ok, true); const observed = await readCurrentExecutionRegistry(projectRoot); assert.equal(observed.ok, true); assert.equal(observed.registry.activeExecution, null);
  put(path.join(acceptanceRoot, 'private-registry-initialized.json'), {revision: observed.registry.registryRevision, sha256: observed.registrySha256, syntheticFixture: true});
}
async function initiate(acceptanceRoot) {
  const binding = readJson(path.join(acceptanceRoot, 'private-project', bindingPath));
  assert.equal(acceptanceRoot, binding.acceptanceRoot); assert.ok(Date.now() < binding.deadlineMs);
  const {runLocalControl} = await import('../run-ai-painter-local-control-v1.mjs');
  const {issueLocalOperatorSession} = await import('../../src/server/ai-console-control/operator-session.ts');
  put(path.join(binding.fixtureProjectRoot, '.runtime/fixture/initiator.json'), processProbe(process.pid, true));
  const session = issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session', {headers: {host: 'localhost:3000'}})); assert.equal(session.ok, true);
  // Real CLI implementation with its default official reader and real launcher;
  // only its existing explicit project-root argument selects the private scope.
  const result = await runLocalControl({command: 'start', packagePath: binding.packagePath, packageSha256: binding.packageSha256}, {credentials: {cookie: session.setCookie.split(';')[0], csrf: session.session.csrfToken}}, binding.fixtureProjectRoot);
  put(path.join(acceptanceRoot, 'initiator-launch-receipt.json'), result); process.stdout.write(JSON.stringify({status: result.receipt.status, backgroundPid: result.receipt.processId}) + '\n');
}
async function accept(argv) {
  const acceptanceRoot = parseInitiatorExitArguments(argv), beganMs = Date.now(), deadlineMs = beganMs + 120000;
  const {withNativeAcceptanceCredentials} = await import('./ai-painter-local-control-native-cpu-v1.mjs');
  const frozenReport = readJson('.runtime/ai-painter/controller-parallel-20261011/migration-local-control/revised-delivery-and-source-freeze-native02.json');
  const frozen = frozenReport.sourceFreeze.filter(row => row.path === sourceCli || row.path.startsWith('scripts/lib/'));
  for (const row of frozen) assert.equal(sha(fs.readFileSync(row.path)), row.sha256, 'frozen production source changed');
  await withNativeAcceptanceCredentials({evidenceRoot: acceptanceRoot, credentialMode: 'isolated_acceptance_only'}, async credentialEvidence => {
    fs.mkdirSync(acceptanceRoot); const projectRoot = path.join(acceptanceRoot, 'private-project'); fs.mkdirSync(projectRoot);
    const sourceBindings = {}, sourceCopies = [];
    const sourceFiles = [...frozen.map(row => row.path), 'src/server/ai-console-control/operator-session.ts', 'src/server/ai-painter-current-execution-registry.mjs', 'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs', 'scripts/lib/ai-painter-local-autonomy-governance-v3.mjs', 'scripts/run-ai-painter-autonomous-closed-loop-package.mjs', 'scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs', 'scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs', 'scripts/lib/ai-pet-world-storage.mjs'];
    const putBound = (relative, value) => { const file = path.join(projectRoot, relative); put(file, value); return {path: relative, sha256: sha(fs.readFileSync(file))}; };
    try {
      for (const file of new Set(sourceFiles)) { const bytes = fs.readFileSync(file); sourceBindings[`source${sourceCopies.length}`] = putBound(file, bytes); sourceCopies.push({path: file, sha256: sha(bytes), bytes: bytes.length}); }
      const driverPath = path.resolve('scripts/tests/ai-painter-local-control-initiator-exit-cpu-v1.mjs');
      const fixtureAdapter = putBound(adapterPath, fs.readFileSync(driverPath)); sourceBindings.fixtureAdapter = fixtureAdapter;
      putBound('data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json', fs.readFileSync('data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json'));
      const {LOCAL_CONTROL_REGISTRATION, LOCAL_CONTROL_CAPABILITY, LOCAL_CONTROL_PLAN_SCHEMA, LOCAL_CONTROL_OUTPUT_ROOT} = await import('../run-ai-painter-local-control-v1.mjs');
      putBound('data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json', {schemaVersion: 'ai-painter-current-entrypoint-registry-v1', status: 'active', currentEntrypoints: [], localControlEntrypoints: [LOCAL_CONTROL_REGISTRATION]});
      const runId = 'pe-cpu-run01', packageId = 'pe-cpu-pkg01', outputRoot = `${LOCAL_CONTROL_OUTPUT_ROOT}/${runId}`;
      const plan = putBound(outputRoot + '/quality-plan.json', {schema: LOCAL_CONTROL_PLAN_SCHEMA, runId, packageId, capabilityVersion: LOCAL_CONTROL_CAPABILITY, outputRoot, programBindings: sourceBindings, fixtureOnly: true, modelTraining: false, gpuAllowed: false});
      const spec = {schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: packageId, capabilityVersion: LOCAL_CONTROL_CAPABILITY, ownerAuthorizationRequired: false, ownerInStateMachine: false, maxInfrastructureRecoveryAttempts: 0, outputRoot, programLineage: Object.fromEntries(Object.entries(sourceBindings).map(([role, row]) => [role, row.sha256])), inputEvidence: [plan], phaseAdapters: Object.fromEntries(phases.map(phase => [phase, {kind: 'project_module_export', ...fixtureAdapter, exportName: phase}])), fixtureOnly: true, modelTraining: false, gpuAllowed: false};
      const packagePath = `.runtime/ai-painter/autonomous-closed-loop-packages/${packageId}/package.json`, packageBinding = putBound(packagePath, spec);
      for (const directory of ['autonomous-background-launches', 'autonomous-closed-loop-executions', 'owned-worker-guards']) fs.mkdirSync(path.join(projectRoot, '.runtime/ai-painter', directory));
      putBound(bindingPath, {schema: 'private-initiator-exit-cpu-binding-v1', acceptanceRoot, fixtureProjectRoot: projectRoot, deadlineMs, packagePath, packageSha256: packageBinding.sha256, sourceCopies, fixtureAdapter, frozenProductionSources: frozen, fixtureOnly: true, modelTraining: false, gpuAllowed: false});
      await initializePrivateRegistry(projectRoot, acceptanceRoot, putBound);
      assert.ok(directoryBytes(acceptanceRoot) + 65536 < fixedCpu.bytes); assert.ok(Date.now() < deadlineMs);
      const stdout = fs.openSync(path.join(acceptanceRoot, 'initiator-stdout.txt'), 'wx'), stderr = fs.openSync(path.join(acceptanceRoot, 'initiator-stderr.txt'), 'wx');
      const child = spawn(process.execPath, [driverPath, '--initiator', acceptanceRoot], {cwd: process.cwd(), windowsHide: true, shell: false, stdio: ['ignore', stdout, stderr], env: {...process.env, UV_THREADPOOL_SIZE: '1'}});
      fs.closeSync(stdout); fs.closeSync(stderr);
      const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({code, signal, observedAtUtc: new Date().toISOString()})); });
      assert.equal(exit.code, 0, fs.readFileSync(path.join(acceptanceRoot, 'initiator-stderr.txt'), 'utf8'));
      const launch = readJson(path.join(acceptanceRoot, 'initiator-launch-receipt.json')).receipt, afterExit = processProbe(launch.processId);
      assert.equal(afterExit.status, 'active', 'real background must remain alive after initiator exit'); assert.equal(afterExit.identity, launch.processStartIdentity);
      const executionRoot = path.join(projectRoot, '.runtime/ai-painter/autonomous-closed-loop-executions', packageId);
      let terminal;
      while (Date.now() < deadlineMs) {
        assert.ok(directoryBytes(acceptanceRoot) + 65536 < fixedCpu.bytes);
        if (fs.existsSync(path.join(executionRoot, 'phase-terminal.json'))) { terminal = readJson(path.join(executionRoot, 'phase-terminal.json')); break; }
        await sleep(500);
      }
      assert.ok(terminal, 'shared bounded deadline without final terminal'); assert.equal(terminal.status, 'completed');
      const state = readJson(path.join(executionRoot, 'execution-state.json')); assert.equal(state.state, 'completed');
      const rows = fs.readFileSync(path.join(projectRoot, '.runtime/fixture/lifecycle.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.deepEqual(rows.filter(row => phases.includes(row.phase)).map(row => row.phase), phases);
      assert.ok(rows.find(row => row.phase === 'validate').recordedAtUtc > exit.observedAtUtc);
      for (const row of frozen) assert.equal(sha(fs.readFileSync(row.path)), row.sha256);
      const result = {schema: 'private-cli-initiator-exit-cpu-receipt-v1', status: 'initiator_exit_private_cpu_lifecycle_passed', beganAtUtc: new Date(beganMs).toISOString(), finishedAtUtc: new Date().toISOString(), elapsedMs: Date.now() - beganMs, resources: fixedCpu, credentialEvidence, initiator: {pid: child.pid, exit}, background: {launch, observedAliveAfterInitiatorExit: afterExit}, terminal, lifecycleLog: rows, diskBytesBeforeResult: directoryBytes(acceptanceRoot), frozenProductionSourcesUnchanged: true, realCliApiUsed: true, injectedReaderOrLauncher: false, modelTraining: false, gpuInitialized: false, nativeJobStarted: false, formalRegistryOrGlobalGuardModified: false, productionAuthenticationVerified: false, productionQualityAdapterTested: false, cpuFixtureAdapterDistinctFromProduction: true, consoleLogsCapturedByWindowsLauncher: launch.consoleLogsCaptured, applicationLifecycleLogsPreserved: true, observerWroteContinuationSignal: false};
      put(path.join(acceptanceRoot, 'result.json'), result); assert.ok(directoryBytes(acceptanceRoot) + 65536 < fixedCpu.bytes);
      process.stdout.write(JSON.stringify({status: result.status, elapsedMs: result.elapsedMs, acceptanceRoot}) + '\n');
    } catch (error) { put(path.join(acceptanceRoot, 'failure.json'), {schema: 'private-cli-initiator-exit-cpu-failure-v1', status: 'failed_closed', error: String(error.stack ?? error), elapsedMs: Date.now() - beganMs, automaticRetries: 0, privateEvidenceRetained: true, unknownProcessesOrGuardsRetained: true}); throw error; }
  });
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv[2] === '--initiator') { assert.equal(process.argv.length, 4); await initiate(path.resolve(process.argv[3])); }
    else await accept(process.argv.slice(2));
  } catch (error) { process.stderr.write(String(error.stack ?? error) + '\n'); process.exitCode = 1; }
}
