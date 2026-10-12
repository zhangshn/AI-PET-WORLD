import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createNativeOwnerCommand, nativeOwnerSourceIdentity } from '../lib/ai-painter-owned-worker-native-v1.mjs';
import { createOwnedStopNativeControl, initializeOwnedStopControlEvidence, submitOwnedStopIntent } from '../lib/ai-painter-owned-stop-native-control-v1.mjs';
import { issueLocalOperatorSession } from '../../src/server/ai-console-control/operator-session.ts';
import { initializeCurrentExecutionRegistry, advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from '../../src/server/ai-painter-current-execution-registry.mjs';

// Fixed CPU acceptance fixture, never a model/training package or dispatch API.
// The controller schedules this driver; merely possessing its argv is not a
// production launch/stop grant. All registry/guard writes stay in fresh fixtures.
export function nativeAcceptanceProcessIdentity(processId, creationDateUtc) {
  assert.ok(Number.isInteger(processId) && processId > 0);
  assert.ok(typeof creationDateUtc === 'string' && creationDateUtc === creationDateUtc.trim() && Number.isFinite(Date.parse(creationDateUtc)));
  // Match the official Windows probe exactly; keep its fractional precision.
  return `${processId}:${creationDateUtc}`;
}
export function parseNativeAcceptanceArguments(argv) {
  assert.deepEqual(argv.filter((_, i) => i % 2 === 0), ['--acceptance-root', '--credential-mode']); assert.equal(argv.length, 4);
  assert.ok(['existing_configuration', 'isolated_acceptance_only'].includes(argv[3]), 'explicit acceptance credential mode required');
  assert.ok(path.isAbsolute(argv[1]), 'absolute physical private acceptance root required');
  return { evidenceRoot: path.resolve(argv[1]), credentialMode: argv[3] };
}
export function validateNativeAcceptanceRoot(evidenceRoot) {
  assert.ok(path.isAbsolute(evidenceRoot)); assert.equal(fs.existsSync(evidenceRoot), false, 'new attempt only');
  const expectedParent = fs.realpathSync(path.resolve('.runtime/ai-painter/controller-parallel-20261011/migration-local-control'));
  assert.equal(path.dirname(evidenceRoot), expectedParent, 'only declared private acceptance parent');
  assert.match(path.basename(evidenceRoot), /^native-acceptance-[a-z0-9-]{8,80}$/u);
  for (let directory = expectedParent; path.dirname(directory) !== directory; directory = path.dirname(directory))
    assert.ok(!fs.lstatSync(directory).isSymbolicLink(), 'acceptance physical parent redirects forbidden');
  return evidenceRoot;
}
export async function withNativeAcceptanceCredentials({ evidenceRoot, credentialMode }, action) {
  assert.ok(['existing_configuration', 'isolated_acceptance_only'].includes(credentialMode));
  validateNativeAcceptanceRoot(evidenceRoot); assert.equal(typeof action, 'function');
  const previous = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
  if (credentialMode === 'isolated_acceptance_only') process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = crypto.randomBytes(48).toString('hex');
  else assert.ok(Buffer.byteLength(previous?.trim() ?? '') >= 32, 'existing stable operator secret required');
  try {
    return await action(Object.freeze({ credentialMode, isolatedTestKey: credentialMode === 'isolated_acceptance_only',
      keyPersistence: 'process_memory_and_child_environment_only', productionAuthenticationAvailable: false }));
  } finally {
    if (previous === undefined) delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
    else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET = previous;
  }
}
async function main(argv) {
if (argv[0] === '--fixture-worker') {
  assert.equal(argv.length, 2); assert.ok(['normal', 'failure', 'stop'].includes(argv[1]));
  if (argv[1] === 'normal') { process.stdout.write('local CPU normal fixture\n'); }
  else if (argv[1] === 'failure') { process.stderr.write('local CPU deliberate fixture failure\n'); process.exitCode = 7; }
  else { process.stdout.write('local CPU operator-stop fixture ready\n'); setInterval(() => {}, 100); }
} else if (argv.length === 1 && argv[0] === '--help') {
  process.stdout.write('Fixed owned local-control CPU native acceptance v1\nUsage (only after controller resource slot): node scripts/tests/ai-painter-local-control-native-cpu-v1.mjs --acceptance-root <fresh absolute physical directory> --credential-mode <existing_configuration|isolated_acceptance_only>\nRuns only normal/failure/operator-stop CPU fixtures with existing native Job owner and official current registry reader. One shared 120s deadline, CPU affinity 3/two logical processors, 8MiB combined disk/streams with 64KiB terminal reserve, one attempt, no GPU or production mutations. Isolated mode generates an ephemeral test key only after validating the declared fresh physical root; key exists only in this process memory and child environment, is never saved or printed, and does not establish production authentication. Preserves all evidence and unknown guards. This driver does not test production CLI start, initiator exit, or qualify model training.\n');
} else {
  const acceptance = parseNativeAcceptanceArguments(argv);
  assert.equal(process.platform, 'win32');
  const evidenceRoot = validateNativeAcceptanceRoot(acceptance.evidenceRoot);
  assert.equal(fs.existsSync(path.resolve('.runtime/ai-painter/owned-worker-guards/active.json')), false, 'no competing managed call');
  await withNativeAcceptanceCredentials(acceptance, async credentialEvidence => {
  fs.mkdirSync(evidenceRoot);
  const began = Date.now(), deadline = began + 120000, maximum = 8388608, reserve = 65536;
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const sourceIdentity = nativeOwnerSourceIdentity(), driverPath = path.resolve('scripts/tests/ai-painter-local-control-native-cpu-v1.mjs');
  const sourceFreeze = [driverPath, sourceIdentity.path, ...['native-control', 'handoff', 'request', 'execution-bridge'].map(n => path.resolve(`scripts/lib/ai-painter-owned-stop-${n}-v1.mjs`)),
    path.resolve('scripts/lib/ai-painter-owned-worker-native-v1.mjs'), path.resolve('scripts/lib/ai-pet-world-storage.mjs'), path.resolve('src/server/ai-console-control/operator-session.ts'), path.resolve('src/server/ai-painter-current-execution-registry.mjs')].map(file => ({ path: file, sha256: hash(fs.readFileSync(file)) }));
  const results = []; let streamDebit = 0, helperOutputDebit = 0;
  const size = directory => {
    let bytes = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name), s = fs.lstatSync(file);
      assert.ok(!s.isSymbolicLink(), 'acceptance links forbidden');
      if (s.isDirectory()) bytes += size(file); else { assert.ok(s.isFile() && s.nlink === 1); bytes += s.size; }
    }
    return bytes;
  };
  const budget = extra => { assert.ok(Date.now() < deadline, 'one shared native acceptance deadline'); assert.ok(size(evidenceRoot) + streamDebit + helperOutputDebit + extra + reserve <= maximum, 'combined acceptance output budget'); };
  function put(file, value) {
    const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value) + '\n'); budget(bytes.length);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes, { flag: 'wx' });
  }
  const identityText = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$p=Get-Process -Id ${process.pid};$p.ProcessorAffinity=[IntPtr]3;(Get-CimInstance Win32_Process -Filter "ProcessId = ${process.pid}").CreationDate.ToUniversalTime().ToString('o')`],
    { windowsHide: true, encoding: 'utf8', timeout: Math.min(10000, deadline - Date.now()) });
  helperOutputDebit += Buffer.byteLength(identityText); const supervisorIdentity = nativeAcceptanceProcessIdentity(process.pid, identityText.trim());
  const session = issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session', { headers: { host: 'localhost:3000' } })); assert.equal(session.ok, true);
  const credentials = { cookie: session.setCookie.split(';')[0], csrf: session.session.csrfToken };
  put(path.join(evidenceRoot, 'acceptance-binding.json'), { schema: 'local-control-native-cpu-acceptance-binding-v1', sourceFreeze, credentialEvidence, beganAtUtc: new Date(began).toISOString(), deadlineAtUtc: new Date(deadline).toISOString(), maximumBytes: maximum, reserveBytes: reserve, cpuAffinity: '3', attempts: 1, automaticRetries: 0, trainingPerformed: false, productionMutations: false });
  async function registry(root, mode, roles) {
    const rel = '.runtime/fixture', file = name => path.join(root, rel, name), binding = name => ({ path: `${rel}/${name}`, sha256: hash(fs.readFileSync(file(name))) });
    put(file('candidate.json'), { schemaVersion: 'stage4-post-decode-bounded-candidate-v1', status: 'cpu_inactive_candidate_planned_not_implemented' });
    put(file('planning-terminal.json'), { schemaVersion: 'stage4-post-decode-failure-bounded-planning-terminal-v1', executionState: 'completed', status: 'bounded_candidate_planning_completed', planningRunId: `private-${mode}-plan`, nextAction: 'private_cpu_acceptance', candidate: binding('candidate.json') });
    put(file('source-capsule.json'), { schemaVersion: 'ai-painter-local-task-capsule-v2', latestTerminal: binding('planning-terminal.json') });
    put(file('history/terminal.json'), { schemaVersion: 'stage4-post-decode-object-rgb-stage0-terminal-v1', executionState: 'completed', status: 'post_decode_object_rgb_stage0_real_visual_failure', runId: `synthetic-history-${mode}` });
    put(file('history/execution-state.json'), { status: 'completed', syntheticFixture: true });
    put(file('history/machine-review.json'), { syntheticFixture: true, previewCount: 0 });
    put(file('history/training-output/progress.json'), { syntheticFixture: true, epoch: 0 });
    const initialized = await initializeCurrentExecutionRegistry({ projectRoot: root, currentTaskCapsulePath: `${rel}/source-capsule.json`, currentTaskTerminalPath: `${rel}/planning-terminal.json`, currentCandidatePath: `${rel}/candidate.json`, latestTrainingTerminalPath: `${rel}/history/terminal.json`, archivedEvidenceNamespaces: [] }); assert.equal(initialized.ok, true);
    const context = { runId: `private-${mode}-run`, packageId: `private-${mode}-package`, executionPackagePath: `${rel}/stop-target.json`, executionPackageSha256: null,
      supervisorProcessId: process.pid, supervisorProcessStartIdentity: supervisorIdentity, phase: 'cpu' };
    put(file('stop-target.json'), { packageIdentity: context.packageId, programLineage: Object.fromEntries(Object.entries(roles).map(([k, b]) => [k, b.sha256])) }); context.executionPackageSha256 = hash(fs.readFileSync(file('stop-target.json')));
    const active = { schemaVersion: 'ai-painter-current-active-execution-v1', capabilityVersion: 'local-control-native-cpu-acceptance-v1', packageId: context.packageId, runId: context.runId,
      executionState: 'executing', processId: process.pid, processStartIdentity: supervisorIdentity, programLineage: roles,
      lock: null, heartbeat: { path: `${rel}/heartbeat.json`, ttlSeconds: 120 } };
    const lock = { schemaVersion: 'ai-painter-current-active-execution-lock-v1', capabilityVersion: active.capabilityVersion, packageId: context.packageId, runId: context.runId, processId: process.pid, processStartIdentity: supervisorIdentity };
    put(file('lock.json'), lock); active.lock = binding('lock.json');
    put(file('heartbeat.json'), { ...lock, schemaVersion: 'ai-painter-current-active-execution-heartbeat-v1', executionState: 'executing', heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120 });
    put(file('evidence.json'), { kind: 'fixed_native_cpu_acceptance_fixture_only' });
    put(file('capsule.json'), { schemaVersion: 'ai-painter-local-task-capsule-v1', integrity: { status: 'verified' }, evidence: [{ kind: 'cpu_fixture', ...binding('evidence.json'), sha256Verified: true }] });
    put(file('terminal-reference.json'), { schemaVersion: 'private-cpu-fixture-reference-v1', executionState: 'completed', status: 'fixture_reference_only' });
    const published = await advanceCurrentExecutionRegistry({ projectRoot: root, capabilityVersion: active.capabilityVersion, packageId: context.packageId, taskId: context.runId, taskKind: 'local_control_cpu_acceptance', runId: context.runId,
      lifecycleStage: 'isolated_implementation', executionState: 'executing', activity: 'cpu_fixture', queueStatus: 'running', nextMachineAction: null,
      taskCapsulePath: `${rel}/capsule.json`, terminalEvidencePath: `${rel}/terminal-reference.json`, activeExecution: active,
      expectedPreviousRegistryRevision: initialized.registry.registryRevision, expectedPreviousRegistrySha256: initialized.registrySha256 }); assert.equal(published.ok, true);
    assert.equal((await readCurrentExecutionRegistry(root)).ok, true); budget(0);
    return { context, revision: published.registry.registryRevision };
  }
  try {
    for (const mode of ['normal', 'failure', 'stop']) {
      budget(0); const root = path.join(evidenceRoot, mode); fs.mkdirSync(root);
      const roles = {};
      for (const [n, b] of sourceFreeze.entries()) { const rel = `sources/source-${n}.txt`; put(path.join(root, rel), fs.readFileSync(b.path).toString('utf8')); roles[`source${n}`] = { path: rel, sha256: b.sha256 }; }
      const { context, revision } = await registry(root, mode, roles), stopRoot = path.join(root, 'operator-stop-control'); initializeOwnedStopControlEvidence(stopRoot);
      const id = crypto.randomUUID(), nativeRoot = path.join(root, 'native'); fs.mkdirSync(nativeRoot);
      const guardPath = path.join(root, 'guard.json'), guard = { identity: id, startedEvidence: path.join(nativeRoot, 'started.json'), nativeOwnerSource: sourceIdentity };
      const guardBytes = JSON.stringify(guard); put(guardPath, guardBytes);
      const command = createNativeOwnerCommand(process.execPath, [driverPath, '--fixture-worker', mode], root, deadline - 1000, 1000, guard, guardBytes);
      helperOutputDebit += Buffer.byteLength(command.nativeBuild.output); budget(0);
      // Genuine private retained child. Descriptor is minted here, never on disk.
      const child = spawn(command.executable, command.args, { cwd: root, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, UV_THREADPOOL_SIZE: '1', OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2', OPENBLAS_NUM_THREADS: '2' } });
      const descriptor = Object.freeze({ callId: id, ...Object.fromEntries(Object.entries(context).filter(([k]) => k !== 'executionPackagePath')) });
      let closed = false, proof = null, protocolError = null, delivered = null, pending = '', ownerError = '', fastTimer, slowTimer, resourceReason = null;
      const counts = { stdout: 0, stderr: 0 }, frames = [], ownerErrors = [];
      const control = createOwnedStopNativeControl({ projectRoot: root, evidenceRoot: stopRoot, expectedContext: context, readRetainedNativeCall: () => closed ? null : descriptor });
      child.stdout.on('data', chunk => {
        streamDebit += chunk.length; if (streamDebit <= 1048576) frames.push(chunk); else resourceReason = 'acceptance_stream_limit';
        pending += chunk.toString('ascii'); let offset;
        while ((offset = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, offset).trimEnd(); pending = pending.slice(offset + 1);
          try {
            if (line.startsWith('R:')) { assert.equal(proof, null); const bytes = Buffer.from(line.slice(2), 'base64'); assert.equal(bytes.toString('base64'), line.slice(2)); assert.ok(bytes.length <= 65536); proof = JSON.parse(bytes.toString('utf8')); }
            else { assert.match(line, /^[OE]:/u); const bytes = Buffer.from(line.slice(2), 'base64'); assert.equal(bytes.toString('base64'), line.slice(2)); assert.ok(bytes.length <= 65536); counts[line[0] === 'O' ? 'stdout' : 'stderr'] += bytes.length; }
          } catch (error) { protocolError = String(error); }
        }
        if (pending.length > 65536) protocolError = 'frame_limit';
      });
      child.stderr.on('data', chunk => { streamDebit += chunk.length; if (streamDebit <= 1048576) ownerErrors.push(chunk); else resourceReason = 'acceptance_stream_limit'; ownerError = (ownerError + chunk.toString()).slice(-8192); });
      child.stdin.on('error', error => { protocolError = String(error); });
      const outcome = new Promise(resolve => { child.once('close', (code, signal) => { closed = true; clearInterval(fastTimer); clearInterval(slowTimer); resolve({ code, signal }); }); child.once('error', error => { protocolError = String(error); }); });
      fastTimer = setInterval(() => {
        const reason = resourceReason ?? control.abortReason();
        if (reason !== null && !delivered) { delivered = reason; child.stdin.write(Buffer.from(reason).toString('base64') + '\n'); }
      }, 100);
      slowTimer = setInterval(() => { try { budget(0); void control.preparePending(); } catch (error) { resourceReason = String(error.message); } }, 500);
      if (mode === 'stop') { const { phase, ...target } = context; submitOwnedStopIntent({ evidenceRoot: stopRoot, credentials,
        input: { ...target, expectedRegistryRevision: revision, idempotencyKey: 'private_native_acceptance_stop_01', reasonText: 'self-owned CPU acceptance stop' } }); }
      const exit = await outcome; control.dispose();
      put(path.join(root, 'native-owner-frames.txt'), Buffer.concat(frames).toString('ascii'));
      put(path.join(root, 'native-owner-stderr.txt'), Buffer.concat(ownerErrors).toString('utf8'));
      assert.equal(resourceReason, null, 'resource failure must retain failed acceptance');
      assert.equal(protocolError, null, ownerError); assert.equal(exit.code, 0, ownerError); assert.equal(pending.trim(), '');
      assert.ok(proof && proof.ownerPid === child.pid && proof.bindingBase64 === command.bindingBase64 && proof.assignedBeforeResume === true && proof.killOnJobClose === true && proof.activeProcessesAfterCleanup === 0 && proof.totalProcesses >= 1 && proof.cleanupError === null && proof.observationError === null);
      assert.ok(Number.isInteger(proof.rootPid) && proof.rootPid > 0 && Number.isFinite(Date.parse(proof.rootCreationDateUtc)));
      assert.equal(proof.stdoutBytes, counts.stdout); assert.equal(proof.stderrBytes, counts.stderr);
      if (mode === 'normal') { assert.equal(proof.exitCode, 0); assert.equal(delivered, null); }
      if (mode === 'failure') { assert.equal(proof.exitCode, 7); assert.equal(delivered, null); }
      if (mode === 'stop') { assert.match(delivered ?? '', /^operator_stop:[a-f0-9]{64}:self-owned CPU acceptance stop$/u); assert.equal(proof.stopReason, delivered); assert.notEqual(proof.exitCode, 0); }
      // Release only this driver's exact guard from its same still-retained call.
      assert.equal(fs.readFileSync(guardPath, 'utf8'), guardBytes); fs.unlinkSync(guardPath);
      const receipt = { mode, exit, proof, nativeBuild: command.nativeBuild, ownerClosed: closed, sameRetainedCall: true,
        processStopped: true, liveNativeCleanupConfirmed: true, privateGuardReleased: true, checkpointSaved: false,
        request: control.inspect(), formalReader: 'readCurrentExecutionRegistry', modelTrainingQualified: false };
      put(path.join(root, 'native-acceptance-receipt.json'), receipt); results.push(receipt); budget(0);
    }
    for (const b of sourceFreeze) assert.equal(hash(fs.readFileSync(b.path)), b.sha256, 'source changed during acceptance');
    const report = { status: 'native_cpu_normal_failure_operator_stop_passed', beganAtUtc: new Date(began).toISOString(), finishedAtUtc: new Date().toISOString(), elapsedMs: Date.now() - began,
      cpuAffinity: '3', maximumBytes: maximum, diskBytes: size(evidenceRoot), streamDebit, helperOutputDebit, terminalReserveBytes: reserve, results,
      productionStartTested: false, productionSecretConfiguredByDriver: false, codexRuntimeOrchestrationRequired: false,
      credentialEvidence, detachedInitiatorExitTested: false, modelTrainingQualified: false, gpuUsed: false, attempts: 1, automaticRetries: 0 };
    put(path.join(evidenceRoot, 'result.json'), report); process.stdout.write(JSON.stringify({ status: report.status, evidenceRoot, elapsedMs: report.elapsedMs }) + '\n');
  } catch (error) {
    try { put(path.join(evidenceRoot, 'failure.json'), { status: 'failed_closed', error: String(error.stack ?? error), results, elapsedMs: Date.now() - began, streamDebit, unknownGuardsRetained: true, automaticRetries: 0 }); } catch (secondary) { process.stderr.write(String(secondary.message) + '\n'); }
    process.stderr.write(String(error.stack ?? error) + '\n'); process.exitCode = 1;
  }
  });
}
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main(process.argv.slice(2));
