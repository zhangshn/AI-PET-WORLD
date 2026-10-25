// Archived 004 evidence reader. It never opens the original fixture databases.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {observeAffinity, readLifecycleTerminal} from './local-control-full-v2-004-observer.mjs';

export const OLD_ROOT = '.runtime/ai-painter/controller-repair-reviews/local-full-v2-cpu-004-20261022/m-055535';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const OLD_DELIVERY_SHA = 'edcc5bad9c026b6b3036b709c25db06b533b184b637095b21ec7b4bdf7a12ccf';
export function verifyBoundBytes(bytes, binding) {
  assert.equal(bytes.length, binding.bytes ?? bytes.length);
  assert.equal(sha(bytes), binding.sha256, 'evidence SHA mismatch: ' + binding.path);
  return bytes;
}
export function requireSameSources(left, right) { assert.deepEqual(left, right); }

export function verifyWireReceipt(receipt, wire, observation, mode) {
  assert(['cpu', 'execute'].includes(receipt.phase));
  assert(['normal', 'failure', 'stop'].includes(mode));
  const lines = wire.trimEnd().split('\n').map(line => line.trimEnd());
  const decoded = lines.map(line => {
    assert.match(line, /^[OER]:/);
    const bytes = Buffer.from(line.slice(2), 'base64');
    assert.equal(bytes.toString('base64'), line.slice(2));
    return {type: line[0], bytes};
  });
  const frames = decoded.filter(frame => frame.type === 'R');
  assert.equal(frames.length, 1);
  const proof = JSON.parse(frames[0].bytes);
  assert.deepEqual(proof, receipt.proof);
  assert.equal(proof.assignedBeforeResume, true);
  assert.equal(proof.killOnJobClose, true);
  assert.equal(proof.activeProcessesAfterCleanup, 0);
  assert.equal(proof.cleanupError, null);
  assert.equal(proof.observationError, null);
  assert.equal(receipt.ownerClosed, true);
  assert.equal(receipt.privateGuardReleased, true);
  assert.equal(observeAffinity(proof, observation), receipt.observationAffinityMask);
  for (const [tag, field] of [['O', 'stdoutBytes'], ['E', 'stderrBytes']]) {
    assert.equal(decoded.filter(f => f.type === tag).reduce((n, f) => n + f.bytes.length, 0), proof[field]);
  }
  const expectedExit = receipt.phase === 'cpu' || mode === 'normal' ? 0 : mode === 'failure' ? 7 : 1;
  assert.equal(proof.exitCode, expectedExit);
  if (receipt.phase === 'execute' && mode === 'stop') {
    assert.match(receipt.reasonDelivered, /^operator_stop:[a-f0-9]{64}:full-v2 own CPU acceptance stop$/);
    assert.equal(proof.stopReason, receipt.reasonDelivered);
  } else {
    assert.equal(proof.stopReason, null);
    assert.equal(receipt.reasonDelivered, null);
  }
  assert(receipt.budget.diskBytes + receipt.allWireStreamBytes + receipt.helperOutputBytes + receipt.budget.terminalReserveBytes < 8388608);
  return proof;
}

export function openArchive() {
  const deliveryBytes = fs.readFileSync(path.join(OLD_ROOT, 'delivery.json'));
  assert.equal(sha(deliveryBytes), OLD_DELIVERY_SHA);
  const delivery = JSON.parse(deliveryBytes), priorBindings = new Map();
  for (const binding of delivery.evidence) {
    verifyBoundBytes(fs.readFileSync(binding.path), binding);
    priorBindings.set(binding.path, binding);
  }
  const manifestPath = path.join(OLD_ROOT, 'private-evidence-manifest.json').replaceAll('\\', '/');
  assert(priorBindings.has(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const readers = new Map();
  for (const archive of manifest.archives) {
    const bindings = new Map();
    for (const binding of archive.files) {
      assert(!bindings.has(binding.path));
      const resolved = path.resolve(binding.archive), permitted = path.resolve(OLD_ROOT, 'private-evidence', path.win32.basename(archive.root));
      assert(resolved.startsWith(permitted + path.sep));
      verifyBoundBytes(fs.readFileSync(resolved), binding);
      bindings.set(binding.path, binding);
    }
    const read = logical => {
      const binding = bindings.get(logical.replaceAll('\\', '/'));
      assert(binding, 'unmanifested archived evidence: ' + logical);
      return verifyBoundBytes(fs.readFileSync(binding.archive), binding);
    };
    readers.set(archive.root, {archive, bindings, read, json: p => JSON.parse(read(p))});
  }
  return {delivery, manifest, readers, verifyAllUnchanged() {
    for (const binding of delivery.evidence) verifyBoundBytes(fs.readFileSync(binding.path), binding);
    for (const reader of readers.values()) for (const binding of reader.bindings.values()) verifyBoundBytes(fs.readFileSync(binding.archive), binding);
    assert.equal(sha(fs.readFileSync(path.join(OLD_ROOT, 'delivery.json'))), OLD_DELIVERY_SHA);
  }};
}

function snapshotQuery(reader, logical, snapshotRoot, query, identity) {
  // All inputs are hash-checked copies. SQLite may modify only the new snapshot.
  // SQLite's Windows build cannot open the long original package directory.
  // Use a deterministic short snapshot name; retain original bindings below.
  const destination = path.join(snapshotRoot, 's-' + sha(Buffer.from(reader.archive.root + '\n' + logical + '\n' + identity)).slice(0, 12), path.basename(logical));
  assert(!fs.existsSync(destination), 'fresh snapshot required');
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  const inputs = [];
  for (const suffix of ['', '-wal', '-shm']) {
    const binding = reader.bindings.get(logical + suffix);
    if (!binding) { assert(suffix, 'SQLite core missing'); continue; }
    const bytes = reader.read(logical + suffix);
    fs.writeFileSync(destination + suffix, bytes, {flag: 'wx'});
    verifyBoundBytes(fs.readFileSync(destination + suffix), binding);
    inputs.push(binding);
  }
  const db = new DatabaseSync(destination, {readOnly: true});
  try {
    db.exec('PRAGMA query_only=ON');
    assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    return {row: {...db.prepare(query).get(identity)}, inputs};
  } finally { db.close(); }
}

export function verifyCase(reader, expected, priorCase, snapshotRoot) {
  const json = reader.json, read = reader.read, runId = expected.runId;
  const root = '.runtime/ai-painter/ecology-regime-quality-executions/' + runId, local = root + '/local-prepare';
  const label = priorCase.label, initial = json('.runtime/fixture/' + label + '-initiator-result.json');
  const launch = JSON.parse(initial.stdout), request = json(local + '/request.json'), terminal = json(local + '/terminal.json');
  const stateExpected = expected.mode === 'normal' ? 'completed' : 'failed_closed';
  assert.equal(initial.exit.code, 0); assert.equal(launch.requestId, runId);
  assert.equal(launch.executionPackage, null); assert.equal(launch.trainingQualified, false);
  assert.equal(request.executionPackage, null); assert.equal(request.automaticRetries, 0);
  assert.equal(request.runId, runId); assert.equal(request.packageId, priorCase.packageId);
  const observed = json(root + '/initiator-exit-observed.json'), cpu = json(root + '/cpu-acceptance.json');
  assert.equal(cpu.status, 'passed'); assert.equal(cpu.trainingQualified, false);
  assert.equal(observed.initiatorExitObserved, true); assert.equal(observed.observerSignalRequired, false);
  assert.equal(observed.initiator.identity, initial.identity);
  assert(observed.atUnixMs >= Date.parse(initial.exit.observedAtUtc));
  const stages = [...reader.bindings.keys()].filter(p => p.startsWith(local + '/events/')).sort().map(json);
  const before = stages.filter(s => Date.parse(s.updatedAtUtc) <= Date.parse(initial.exit.observedAtUtc)).at(-1);
  assert(before && ['prepared_request_not_cpu_qualified', 'cpu_request_prepared', 'cpu_running'].includes(before.stage));
  assert.equal(before.executionPackage, null);
  const accepted = stages.find(s => s.stage === 'cpu_accepted');
  assert(accepted && Date.parse(accepted.updatedAtUtc) > Date.parse(initial.exit.observedAtUtc));
  const life = '.runtime/ai-painter/autonomous-closed-loop-executions/' + request.packageId;
  const lifecycle = readLifecycleTerminal(life, {readFileSync: read});
  assert.equal(lifecycle.status, stateExpected); assert.equal(terminal.status, stateExpected);
  assert.equal(terminal.automaticRetries, 0); assert.equal(json(life + '/execution-state.json').state, stateExpected);
  const processTerminal = json(local + '/background-launches/' + runId + '/background-process-terminal.json');
  assert.equal(processTerminal.processId, launch.launch.processId);
  assert.equal(processTerminal.processStartIdentity, launch.launch.processStartIdentity);
  assert.equal(processTerminal.exitCode, expected.mode === 'normal' ? 0 : 1);
  const source = json('.runtime/fixture/source-bindings.json');
  for (const binding of Object.values(source)) verifyBoundBytes(read(binding.path), binding);
  requireSameSources(json(root + '/quality-plan.json').programBindings, source);
  assert.equal(sha(Buffer.from(JSON.stringify(source))), expected.sourceGroupSha256);
  const pkg = JSON.parse(verifyBoundBytes(read(terminal.executionPackage.path), terminal.executionPackage));
  assert.equal(pkg.packageIdentity, request.packageId); assert.equal(pkg.ownerInStateMachine, false);
  assert.equal(pkg.materializedBy, 'local_ai_painter_autonomous_package_materializer');
  assert.equal(pkg.maxInfrastructureRecoveryAttempts, 0);
  const phases = read(root + '/fixture-lifecycle.jsonl').toString().trim().split('\n').map(JSON.parse).map(r => r.phase);
  assert.deepEqual(phases, expected.mode === 'normal' ? ['preflight','execute','execute_native_terminal','validate','review','adjudicate','finalize'] : ['preflight','execute','execute_native_terminal']);
  const execution = snapshotQuery(reader, life + '/execution.sqlite', snapshotRoot, 'SELECT state, owner_response_required FROM executions WHERE package_identity=?', request.packageId);
  assert.equal(execution.row.state, stateExpected); assert.equal(execution.row.owner_response_required, 0);
  const receipts = [cpu.nativeReceipt, json(root + '/cpu-task-terminal.json').nativeReceipt].map(binding => {
    const receipt = JSON.parse(verifyBoundBytes(read(binding.path), binding));
    const folder = path.posix.dirname(binding.path), proof = receipt.proof;
    const observationPath = folder + '/' + receipt.callIdentity + '-native/cleanup-observation.json';
    verifyWireReceipt(receipt, read(folder + '/owner-frames.log').toString('ascii'), json(observationPath), expected.mode);
    assert(!reader.bindings.has(folder + '/guard.json'));
    const command = JSON.parse(Buffer.from(proof.bindingBase64, 'base64'));
    assert.equal(command.scope, path.resolve(expected.root));
    assert.equal(command.guardSha256, sha(Buffer.from(JSON.stringify(command.guard))));
    const originalRelative = absolute => {
      const relative = path.relative(expected.root, absolute).replaceAll('\\', '/');
      assert(!relative.startsWith('..') && !path.isAbsolute(relative)); return relative;
    };
    assert.equal(sha(read(originalRelative(command.nativeBuild.binary))), command.nativeBuild.binarySha256);
    assert.equal(sha(read(originalRelative(command.nativeBuild.source.path))), command.nativeBuild.source.sha256);
    return {binding, phase: receipt.phase, observation: reader.bindings.get(observationPath), frames: reader.bindings.get(folder + '/owner-frames.log'), exitCode: proof.exitCode, emptyJob: 0, ownerClosed: true, privateGuardReleased: true, affinity: '3', reasonDelivered: receipt.reasonDelivered};
  });
  assert.deepEqual(receipts.map(r => r.phase), ['cpu', 'execute']);
  assert.deepEqual(receipts.map(r => r.exitCode), expected.nativeExits);
  const registryLogical = '.runtime/ai-painter/current-execution-registry/registry.sqlite';
  // Separate copy per case, because three cases share the same archived registry.
  const registry = snapshotQuery(reader, registryLogical, snapshotRoot, 'SELECT * FROM registry_revisions WHERE run_id=? ORDER BY registry_revision DESC LIMIT 1', runId);
  assert.equal(registry.row.registry_revision, expected.privateRegistryClosedRevision);
  const closedBytes = read('.runtime/ai-painter/current-execution-registry/transactions/' + registry.row.transaction_id + '/current.staged.json');
  assert.equal(sha(closedBytes), registry.row.current_sha256);
  const closed = JSON.parse(closedBytes); assert.equal(closed.activeExecution, null); assert.equal(closed.executionState, stateExpected);
  return {runId, mode: expected.mode, sourceGroupSha256: expected.sourceGroupSha256, source, phaseTerminal: reader.bindings.get(life + '/phase-terminal.json'), receipts, execution, registry, priorObserverSuiteStatus: 'failed_preserved', status: 'archived_business_evidence_verified'};
}
