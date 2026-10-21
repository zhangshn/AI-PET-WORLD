// One synthetic-component CPU attempt; the existing managed owner handles cleanup.
// Versioned adaptation of the frozen v4 host path/deadline/accounting mechanisms.
// No saved archive, old Run, GPU or production training is executed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolveOwnedStopProjectDirectory} from './lib/ai-painter-owned-stop-request-v1.mjs';

export const HOST_P90_INTEGRATION = Object.freeze({
  policy: 'data/ai-painter/system-governance/ai-painter-parameter90-training-same-call-integration-cpu-policy-v2.json',
  schema: 'ai-painter-parameter90-training-same-call-integration-cpu-policy-v2',
  host: 'scripts/check-ai-painter-parameter90-training-same-call-integration-cpu-v2.mjs',
  driver: 'ml/ai-painter/scripts/check_parameter90_training_same_call_integration_cpu_v2.py',
  tests: 'ml/ai-painter/tests/test_parameter90_training_same_call_integration_cpu_v1.py',
  audit: '.runtime/ai-painter/controller-repair-reviews/parameter90-review-20261019/same-call-integration-cpu-v2',
  guard: '.runtime/ai-painter/owned-worker-guards',
  maximum: 8 * 1024 ** 2, reserve: 65536, jsonMaximum: 2 * 1024 ** 2, wallMs: 120000,
  hostTransportDebit: 16384, cliStreamMaximum: 8192,
});
const OUTPUT = HOST_P90_INTEGRATION.audit + '/attempt-001';
const EVIDENCE = HOST_P90_INTEGRATION.audit + '/host-attempt-001';
const RESULT = OUTPUT + '/same-call-integration-cpu-result-v2.json';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const need = (value, code) => { if (!value) throw Error(code); };
const identity = stat => [stat.dev, stat.ino].map(String).join(':');
const stamp = stat => [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(':');
function relative(value) {
  need(typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) &&
    !/[\\:\x00-\x1f\x7f]/u.test(value) && value.split('/').every(p => p && p !== '.' && p !== '..'), 'host_p90_integration_path_invalid');
  return value;
}
const exists = file => { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

// The existing trusted resolver alone grants the configured .runtime exception.
// Pins extend its ancestor checks across this whole invocation and every write.
export function createHostPaths(root) {
  need(path.isAbsolute(root), 'host_p90_integration_absolute_root_required');
  const pinned = new Map();
  const rootPin = identity(fs.statSync(root, {bigint:true})) + '|' + fs.realpathSync.native(root);
  function directory(logical) {
    need(rootPin === identity(fs.statSync(root, {bigint:true})) + '|' + fs.realpathSync.native(root), 'host_p90_integration_project_root_changed');
    const parts = relative(logical).split('/');
    let physical;
    for (let i = 0; i < parts.length; i++) {
      const name = parts.slice(0, i + 1).join('/');
      physical = resolveOwnedStopProjectDirectory(root, name);
      const stat = fs.lstatSync(physical, {bigint:true});
      const record = [physical, identity(stat), fs.realpathSync.native(physical),
        identity(fs.lstatSync(path.resolve(root, name), {bigint:true}))].join('|');
      if (pinned.has(name)) need(pinned.get(name) === record, 'host_p90_integration_directory_changed');
      else pinned.set(name, record);
    }
    return physical;
  }
  function file(logical) {
    relative(logical);
    const parent = path.posix.dirname(logical);
    need(parent !== '.', 'host_p90_integration_scoped_file_required');
    const location = path.join(directory(parent), path.posix.basename(logical));
    if (exists(location)) {
      const stat = fs.lstatSync(location, {bigint:true});
      need(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n, 'host_p90_integration_regular_file_required');
    }
    return location;
  }
  function read(logical, maximum = HOST_P90_INTEGRATION.jsonMaximum) {
    const location = file(logical), before = fs.lstatSync(location, {bigint:true});
    need(before.size <= BigInt(maximum), 'host_p90_integration_input_size');
    const fd = fs.openSync(location, 'r');
    try {
      need(stamp(fs.fstatSync(fd, {bigint:true})) === stamp(before), 'host_p90_integration_input_changed');
      const raw = Buffer.alloc(Number(before.size));
      let offset = 0;
      while (offset < raw.length) { const n = fs.readSync(fd, raw, offset, raw.length - offset, null); need(n > 0, 'host_p90_integration_input_changed'); offset += n; }
      need(stamp(fs.fstatSync(fd, {bigint:true})) === stamp(before) &&
        file(logical) === location && stamp(fs.lstatSync(location, {bigint:true})) === stamp(before), 'host_p90_integration_input_changed');
      return raw;
    } finally { fs.closeSync(fd); }
  }
  return {root, directory, file, read,
    bound(binding, maximum) { const raw = read(binding.path, maximum); need(hash(raw) === binding.sha256, 'host_p90_integration_binding_sha:' + binding.path); return raw; },
    mkdir(logical) { relative(logical); const target = path.join(directory(path.posix.dirname(logical)), path.posix.basename(logical)); fs.mkdirSync(target); return directory(logical); },
    absent(logical) { return !exists(path.join(directory(path.posix.dirname(logical)), path.posix.basename(logical))); },
  };
}

export function createHostDeadline({now = Date.now, started = now()} = {}) {
  const deadline = started + HOST_P90_INTEGRATION.wallMs;
  return {started, deadline, elapsed: () => now() - started,
    check() { need(now() <= deadline, 'host_p90_integration_total_deadline_exceeded'); },
    remaining() { const left = deadline - now(); need(left > 0, 'host_p90_integration_total_deadline_exceeded'); return Math.floor(left); }};
}

// These bytes are observations of this invocation, never cleanup authority.
// No guard-directory enumeration is used to choose a native call.
export function captureHostNativeCall(paths, expected, expectedIdentity = null) {
  const raw = paths.read(HOST_P90_INTEGRATION.guard + '/active.json', 65536), guard = JSON.parse(raw);
  need(guard.runnerPid === process.pid && /^[a-f0-9-]{36}$/u.test(guard.identity ?? '') &&
    (!expectedIdentity || guard.identity === expectedIdentity) &&
    path.resolve(guard.executable) === path.resolve(expected.executable) && guard.executableSha256 === expected.executableSha256 &&
    guard.helperSha256 === expected.helperSha256 && guard.commandSha256 === expected.commandSha256 &&
    guard.nativeOwnerSource?.sha256 === expected.ownerSha256, 'host_p90_integration_foreign_native_call');
  const started = HOST_P90_INTEGRATION.guard + '/' + guard.identity + '-started.json';
  need(path.relative(path.resolve(paths.root, started), path.resolve(guard.startedEvidence)) === '', 'host_p90_integration_foreign_native_path');
  return Object.freeze({identity:guard.identity, guardSha:hash(raw), started,
    terminal:HOST_P90_INTEGRATION.guard + '/' + guard.identity + '-terminal.json',
    build:HOST_P90_INTEGRATION.guard + '/' + guard.identity + '-native', expected});
}


// This is accounting of deliberately hostile test data, never an input reader.
// Only the fixture root is trusted/pinned. Observed links are not recursed.
// This detects checked namespace changes; it is not an atomic OS nofollow/ABA proof.
export function measurePrivateFixtures(paths, logical) {
  const root = paths.directory(logical);
  let entries = 0;
  const missing = error => error.code === 'ENOENT';
  function walk(folder, depth, ancestors = []) {
    need(depth <= 32, 'host_p90_integration_fixture_depth');
    let before;
    try { before = fs.lstatSync(folder, {bigint:true}); } catch (error) { if (missing(error)) return 0; throw error; }
    if (before.isSymbolicLink()) return Number(before.size);
    need(before.isDirectory(), 'host_p90_integration_fixture_directory');
    const chain = [...ancestors, {folder, identity:identity(before)}];
    const verifyOpenedPath = () => {
      for (const anchor of chain) {
        const stat = fs.lstatSync(anchor.folder, {bigint:true});
        need(!stat.isSymbolicLink() && stat.isDirectory() && identity(stat) === anchor.identity,
          'host_p90_integration_fixture_directory_changed');
      }
    };
    try { verifyOpenedPath(); } catch (error) { if (missing(error)) return 0; throw error; }
    let handle;
    try { handle = fs.opendirSync(folder, {bufferSize:1}); } catch (error) { if (missing(error)) return 0; throw error; }
    let total = 0;
    try {
    verifyOpenedPath(); // Recheck after opening; opendir itself is not atomic nofollow.
    let entry;
    while ((entry = handle.readSync()) !== null) {
      verifyOpenedPath();
      const name = entry.name;
      need(++entries <= 4096, 'host_p90_integration_fixture_entry_limit');
      const child = path.join(folder, name);
      let stat;
      try { stat = fs.lstatSync(child, {bigint:true}); } catch (error) { if (missing(error)) continue; throw error; }
      if (stat.isSymbolicLink()) total += Number(stat.size);
      else if (stat.isDirectory()) { verifyOpenedPath(); total += walk(child, depth + 1, chain); }
      else { need(stat.isFile(), 'host_p90_integration_fixture_special_file'); total += Number(stat.size); }
      need(Number.isSafeInteger(total) && total <= HOST_P90_INTEGRATION.maximum, 'host_p90_integration_total_output_budget_exceeded');
    }
    verifyOpenedPath();
    } catch (error) { if (!missing(error)) throw error; /* vanished private fixture: retain already counted bytes */ }
    finally { handle.closeSync(); }
    let after;
    try { after = fs.lstatSync(folder, {bigint:true}); } catch (error) { if (missing(error)) return total; throw error; }
    need(!after.isSymbolicLink() && identity(after) === identity(before), 'host_p90_integration_fixture_directory_changed');
    return total;
  }
  const total = walk(root, 0);
  need(paths.directory(logical) === root, 'host_p90_integration_fixture_root_changed');
  return total;
}

export function createHostBudget(paths) {
  let call = null, workerStreams = 0, compilerStreams = 0, failurePrepaid = false;
  function scan(logical) {
    if (paths.absent(logical)) return 0;
    if (logical === OUTPUT + '/private-fixtures') return measurePrivateFixtures(paths, logical);
    const directory = paths.directory(logical);
    let total = 0;
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const child = logical + '/' + entry.name;
      if (entry.isDirectory() && !entry.isSymbolicLink()) total += scan(child);
      else {
        const file = paths.file(child), stat = fs.lstatSync(file);
        need(stat.isFile() && !stat.isSymbolicLink(), 'host_p90_integration_accounting_redirect'); total += stat.size;
      }
    }
    return total;
  }
  function measure() {
    let diskBytes = scan(OUTPUT) + scan(EVIDENCE);
    if (call) {
      diskBytes += scan(call.build);
      for (const logical of [call.started, call.terminal]) if (!paths.absent(logical)) diskBytes += fs.lstatSync(paths.file(logical)).size;
      const active = HOST_P90_INTEGRATION.guard + '/active.json';
      if (!paths.absent(active)) {
        const raw = paths.read(active, 65536);
        // A later foreign call never becomes part of this ledger.
        if (JSON.parse(raw).identity === call.identity) {
          need(hash(raw) === call.guardSha, 'host_p90_integration_native_guard_changed'); diskBytes += raw.length;
        }
      }
    }
    return {diskBytes, workerStreamBytes:workerStreams, compilerStreamBytes:compilerStreams,
      hostTransportDebitBytes:HOST_P90_INTEGRATION.hostTransportDebit, hostTransportDebitIsConservative:true,
      totalBytes:diskBytes + workerStreams + compilerStreams + HOST_P90_INTEGRATION.hostTransportDebit,
      maximumBytes:HOST_P90_INTEGRATION.maximum, failureReserveBytes:HOST_P90_INTEGRATION.reserve,
      nativeCallIdentity:call?.identity ?? null, streamAccounting:'actual_settled_call_counts_not_a_live_combined_stream_cap'};
  }
  return {measure,
    prepayFailureReserve() { need(!failurePrepaid, 'host_p90_integration_failure_reserve_already_allocated'); failurePrepaid = true; },
    adopt(value) { need(call === null, 'host_p90_integration_native_call_already_bound'); call = value; },
    settle(receipt, stdout, stderr) {
      need(call && receipt?.guard?.identity === call.identity, 'host_p90_integration_receipt_call_differs');
      need(path.relative(path.resolve(paths.root, call.started), path.resolve(receipt.guard.startedEvidence)) === '', 'host_p90_integration_receipt_path_differs');
      const streams = receipt.streamBytes;
      need(streams && ['stdout','stderr'].every(k => Number.isSafeInteger(streams[k]) && streams[k] >= 0), 'host_p90_integration_stream_counts_missing');
      workerStreams = streams.stdout + streams.stderr;
      if (receipt.proof) {
        for (const key of ['stdout','stderr']) {
          const value = receipt.proof[key + 'Bytes']; need(Number.isSafeInteger(value) && value >= 0, 'host_p90_integration_proof_stream_counts_missing');
          workerStreams += Math.max(0, value - streams[key]);
        }
      }
      need(Number.isSafeInteger(workerStreams), 'host_p90_integration_stream_counts_invalid');
      need(Buffer.byteLength(stdout ?? '') <= streams.stdout && Buffer.byteLength(stderr ?? '') <= streams.stderr, 'host_p90_integration_stream_counts_underreported');
      const build = receipt.nativeBuild;
      if (build) {
        need(path.relative(path.resolve(paths.root, call.build, 'owner.exe'), path.resolve(build.binary)) === '' &&
          path.relative(path.resolve(paths.root, call.build, 'owner.cs'), path.resolve(build.snapshot)) === '' &&
          path.relative(path.resolve(paths.root, call.build, 'cleanup-observation.json'), path.resolve(receipt.observationPath)) === '', 'host_p90_integration_receipt_native_path_differs');
        compilerStreams = Buffer.byteLength(build.output ?? '');
      }
    },
    check(extraBytes = 0, failure = false) {
      const value = measure();
      need(Number.isSafeInteger(extraBytes) && extraBytes >= 0 &&
        value.totalBytes + extraBytes + (failure || failurePrepaid ? 0 : HOST_P90_INTEGRATION.reserve) <= HOST_P90_INTEGRATION.maximum, 'host_p90_integration_total_output_budget_exceeded');
      return value;
    }};
}

export function validatePolicy(paths, policySha) {
  need(/^[a-f0-9]{64}$/u.test(policySha ?? ''), 'host_p90_integration_policy_sha_required');
  const policyBinding = {path:HOST_P90_INTEGRATION.policy, sha256:policySha};
  const policy = JSON.parse(paths.bound(policyBinding));
  need(policy.schemaVersion === HOST_P90_INTEGRATION.schema &&
    policy.status === 'registered_cpu_integration_validation_only' &&
    policy.scope === 'training_same_call_integration_synthetic_cpu_only', 'host_p90_integration_policy_identity');
  assert.deepEqual(policy.target, {parameterIndex:90, parameterName:'core.core.final_rgb_decoder.base.layers.4.weight',
    weightShape:[3,48,1,1], coordinate:[0,1,0,0], inputChannel:1, outputChannel:0});
  need(policy.comparison?.atol === 1e-6 && policy.comparison?.rtol === 1e-5, 'host_p90_integration_policy_comparison');
  const required = {cpuThreads:2, cpuAffinityMaximum:2, maxWallSecondsIncludingStartup:120, maxRssMiB:1536,
    maxOutputMiB:8, maxSingleJsonMiB:2, failureReserveBytes:65536, attempts:1, automaticRetries:0};
  for (const [key,value] of Object.entries(required)) need(policy.resources?.[key] === value, 'host_p90_integration_policy_resource:' + key);
  assert.deepEqual(policy.captureBudget, {targetSidecarMaximumBytes:2097152, aggregateFailureMaximumBytes:67108864,
    executionMaximumBytes:134217728});
  need(policy.outputRoot === OUTPUT && policy.formalSpecification?.version === 'AI-PAINTER-SPEC-1.104' &&
    policy.executionHost?.path === HOST_P90_INTEGRATION.host, 'host_p90_integration_policy_program_identity');
  need(policy.executionBoundary?.syntheticCpuOnly === true && policy.executionBoundary.gpu === false &&
    policy.executionBoundary.training === false && policy.executionBoundary.productionIntegrated === false,
    'host_p90_integration_policy_boundary');
  need(Array.isArray(policy.programBindings) && policy.programBindings.length > 0 && policy.programBindings.length <= 256 &&
    new Set(policy.programBindings.map(b=>b.path)).size === policy.programBindings.length, 'host_p90_integration_source_count');
  need(policy.programBindings.every(b=>typeof b.path === 'string' && b.path.startsWith('ml/ai-painter/') && b.path.endsWith('.py')),
    'host_p90_integration_python_source_scope');
  for (const source of [HOST_P90_INTEGRATION.driver, HOST_P90_INTEGRATION.tests,
    'ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_capture_v1.py'])
    need(policy.programBindings.some(b=>b.path===source), 'host_p90_integration_required_source:' + source);
  const bindings = [policy.formalSpecification, policy.designBinding, policy.executionHost, policy.executionHostTests,
    ...policy.programBindings, ...Object.values(policy.containmentProgramBindings)];
  let total=0;
  for (const binding of bindings) {const raw=paths.bound(binding,1048576);total+=raw.length;}
  need(total<=16777216, 'host_p90_integration_source_total');
  need(path.relative(path.resolve(paths.root, 'ml/ai-painter/.venv/Scripts/python.exe'),
    path.resolve(policy.interpreter.absolutePath)) === '', 'host_p90_integration_interpreter_path');
  paths.bound({path:'ml/ai-painter/.venv/Scripts/python.exe', sha256:policy.interpreter.sha256},16*1024**2);
  return {policy, policyBinding, bindings};
}

async function executeHost({root, policySha, worker, now = Date.now, started = now(), afterWrite = () => {}}) {
  const paths = createHostPaths(root), clock = createHostDeadline({now, started});
  const {policy, policyBinding, bindings} = validatePolicy(paths, policySha);
  const registryPath = '.runtime/ai-painter/current-execution-registry/current.json';
  const registryBefore = paths.read(registryPath);
  need(JSON.parse(registryBefore).activeExecution === null, 'host_p90_integration_active_execution');
  need(paths.absent(HOST_P90_INTEGRATION.guard + '/active.json'), 'host_p90_integration_existing_guard');
  need(paths.absent(OUTPUT) && paths.absent(EVIDENCE), 'host_p90_integration_attempt_consumed');
  clock.check(); paths.mkdir(EVIDENCE);
  const budget = createHostBudget(paths);
  const put = (name, value, failure = false) => {
    const raw = Buffer.from(JSON.stringify(value, null, 2) + '\n');
    need(raw.length <= (failure ? HOST_P90_INTEGRATION.reserve : HOST_P90_INTEGRATION.jsonMaximum), 'host_p90_integration_json_budget');
    if (!failure) clock.check(); budget.check(raw.length, failure);
    const logical = EVIDENCE + '/' + name, target = paths.file(logical), fd = fs.openSync(target, 'wx');
    try { fs.writeFileSync(fd, raw); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    need(paths.file(logical) === target, 'host_p90_integration_written_path_changed');
    afterWrite(name); budget.check(0, failure);
    if (!failure) clock.check();
    return {path:logical, sha256:hash(raw), bytes:raw.length};
  };
  let result = null, call = null, accountingSettled = false, monitorFailure = null, failureSlot = null, pendingFailure = null;
  const args = ['-B', path.resolve(root, HOST_P90_INTEGRATION.driver), '--project', root, '--policy', HOST_P90_INTEGRATION.policy,
    '--policy-sha256', policySha, '--output', path.resolve(root, OUTPUT), '--deadline-unix-ms', String(clock.deadline)];
  const expected = {executable:policy.interpreter.absolutePath, executableSha256:policy.interpreter.sha256,
    commandSha256:hash(JSON.stringify(args)), helperSha256:policy.containmentProgramBindings.owner.sha256,
    ownerSha256:policy.containmentProgramBindings.nativeOwnerSource.sha256};
  try {
    budget.check(HOST_P90_INTEGRATION.reserve, true);
    const logical = EVIDENCE + '/failure-reserve.bin', target = paths.file(logical);
    const fd = fs.openSync(target, 'wx');
    failureSlot = {logical, target, fd, identity:identity(fs.fstatSync(fd, {bigint:true}))};
    fs.writeFileSync(fd, Buffer.alloc(HOST_P90_INTEGRATION.reserve)); fs.fsyncSync(fd);
    budget.prepayFailureReserve(); budget.check(); clock.check();
    put('claim.json', {policy:policyBinding, deadlineUnixMs:clock.deadline, registrySha256:hash(registryBefore),
      recordedAtUtc:new Date(now()).toISOString(), attempts:1, automaticRetries:0});
    const abortReason = () => {
      try { clock.check(); budget.check(); return null; }
      catch (error) { monitorFailure ??= error; return error.message; }
    };
    let pending;
    try {
      pending = worker(policy.interpreter.absolutePath, args, {cwd:root, timeout:clock.remaining(), maxBuffer:HOST_P90_INTEGRATION.maximum,
        abortReason, env:{...process.env, CUDA_VISIBLE_DEVICES:'', OMP_NUM_THREADS:'2', MKL_NUM_THREADS:'2', OPENBLAS_NUM_THREADS:'2',
          PYTHONDONTWRITEBYTECODE:'1', PYTHONNOUSERSITE:'1', PYTHONPATH:''}});
      // runOwnedWorker creates its own guard synchronously, before returning.
      call = captureHostNativeCall(paths, expected); budget.adopt(call);
    } catch (error) {
      if (pending) { try { result = await pending; } catch (secondary) { pendingFailure = secondary; } }
      if (!call && error.ownedReceipt?.guard?.identity) {
        call = captureHostNativeCall(paths, expected, error.ownedReceipt.guard.identity); budget.adopt(call);
      }
      throw error;
    }
    result = await pending;
    budget.settle(result.ownedReceipt, result.stdout, result.stderr); accountingSettled = true;
    if (monitorFailure) throw monitorFailure;
    budget.check(); clock.check();
    for (const key of ['cleanupConfirmed','guardReleaseConfirmed','ownerClosed']) need(result.ownedReceipt[key] === true, 'host_p90_integration_cleanup_unconfirmed');
    need(Buffer.byteLength(result.stdout) <= 65536 && Buffer.byteLength(result.stderr) <= 65536, 'host_p90_integration_summary_limit');
    const summary = JSON.parse(result.stdout), physicalResult = paths.file(RESULT);
    need(path.isAbsolute(summary.result) && path.relative(physicalResult, path.resolve(summary.result)) === '', 'host_p90_integration_result_location');
    const resultBinding = {path:RESULT, sha256:summary.sha256};
    const report = JSON.parse(paths.bound(resultBinding));
    need(report.status === 'parameter90_same_call_integration_cpu_validation_completed' &&
      report.realModelForwards === 0 && report.realModelAutogradCalls === 0 && report.optimizerSteps === 0 &&
      report.cudaInitialized === false && report.modelStatesInstalled === false && report.qualificationGranted === false &&
      report.rootCauseProven === false && report.productionIntegrated === false, 'host_p90_integration_report_boundary');
    need(Number.isSafeInteger(report.tests?.run) && report.tests.run > 0 &&
      report.tests.failures === 0 && report.tests.errors === 0 && report.tests.skipped === 0,
      'host_p90_integration_component_tests_failed');
    assert.deepEqual(report.policy, policyBinding); assert.deepEqual(report.programBindings, policy.programBindings);
    need(report.resourceObservation.sampledPeakRssBytes <= 1536 * 1024 ** 2 &&
      report.resourceObservation.cpuAffinity.length > 0 && report.resourceObservation.cpuAffinity.length <= 2 &&
      report.resourceObservation.torchThreads <= 2, 'host_p90_integration_report_resources');
    paths.bound(policyBinding); for (const binding of bindings) paths.bound(binding);
    need(hash(paths.read(registryPath)) === hash(registryBefore), 'host_p90_integration_registry_changed');
    put('owned-receipt.json', result.ownedReceipt);
    const acceptance = put('report.pending.json', {status:'cpu_integration_validated_not_production_or_training_qualification',
      policy:policyBinding, result:resultBinding, elapsedMsIncludingPreparation:clock.elapsed(), outputAccounting:budget.check(),
      outputAccountingSnapshot:'before_this_report_file_write',
      componentTestSummary:report.tests, productionIntegrated:false, productionRegistryUnchanged:true,
      rootCauseProven:false, gpuAllowed:false, trainingAllowed:false, automaticRetries:0});
    clock.check();
    fs.renameSync(paths.file(acceptance.path), paths.file(EVIDENCE + '/report.json'));
    acceptance.path = EVIDENCE + '/report.json';
    const outputAccounting = budget.check();
    const completed = {status:'cpu_integration_validated_not_production_or_training_qualification', ...summary, acceptance,
      outputAccounting, outputAccountingSnapshot:'after_final_report_rename_including_report_bytes', elapsedMsIncludingPreparation:clock.elapsed()};
    need(Buffer.byteLength(JSON.stringify(completed) + '\n') <= HOST_P90_INTEGRATION.cliStreamMaximum, 'host_p90_integration_cli_output_budget');
    clock.check(); // Includes all validation, fsync, final rename, accounting and serialization.
    return completed;
  } catch (error) {
    const original = monitorFailure ?? error;
    if (call && !accountingSettled && (error.ownedReceipt ?? result?.ownedReceipt)) {
      try { budget.settle(error.ownedReceipt ?? result.ownedReceipt, error.stdout ?? result?.stdout, error.stderr ?? result?.stderr); accountingSettled = true; }
      catch (secondary) { original.accountingFailure = secondary.message; }
    }
    // Preserve late success-shaped bytes, but never leave an accepted report.
    try {
      const accepted = EVIDENCE + '/report.json';
      if (!paths.absent(accepted)) fs.renameSync(paths.file(accepted), paths.file(EVIDENCE + '/report.not-accepted.json'));
    } catch (secondary) { original.finalizationFailure = secondary.message; }
    let failure = null;
    try {
      let accounting = null, accountingError = null;
      try { accounting = budget.measure(); } catch (secondary) { accountingError = String(secondary.message).slice(0,2048); }
      const liveReceipt = error.ownedReceipt ?? pendingFailure?.ownedReceipt ?? result?.ownedReceipt ?? null;
      const boundedText = (value, bytes) => {
        let text = String(value ?? '');
        while (Buffer.byteLength(JSON.stringify(text)) > bytes) text = text.slice(0,Math.floor(text.length*0.75));
        return text;
      };
      const receiptBytes = liveReceipt ? Buffer.from(JSON.stringify(liveReceipt)) : null;
      const fullReceiptFits = !receiptBytes || receiptBytes.length <= 40960;
      const retainedReceipt = fullReceiptFits ? liveReceipt : null;
      const receiptRetention = {fullReceiptSaved:liveReceipt !== null && fullReceiptFits, originalBytes:receiptBytes?.length ?? 0,
        originalSha256:receiptBytes ? hash(receiptBytes) : null,
        omissionReason:fullReceiptFits ? null : 'original_receipt_exceeds_40KiB_failure_partition_no_cleanup_certification'};
      const receiptMatchesCall = call !== null && accountingSettled && liveReceipt?.guard?.identity === call.identity;
      const failureValue = {status:'failed_closed', policy:policyBinding, recordedAtUtc:new Date(now()).toISOString(),
        error:boundedText(original.stack ?? original,8192), originalError:boundedText(error,2048),
        accountingFailure:boundedText(original.accountingFailure,1024), finalizationFailure:boundedText(original.finalizationFailure,1024),
        nativeCallIdentity:call?.identity ?? null, nativeStreamsSettled:accountingSettled,
        ownedReceipt:retainedReceipt, receiptRetention, receiptMatchesCall,
        cleanupConfirmed:fullReceiptFits && receiptMatchesCall && liveReceipt?.cleanupConfirmed === true,
        outputAccounting:accounting, accountingError:boundedText(accountingError,1024), failureReservePreallocated:true,
        automaticRetries:0, gpuAllowed:false, trainingAllowed:false};
      const raw = Buffer.from(JSON.stringify(failureValue)+'\n'); // Partition by encoded bytes, no pretty-print expansion.
      need(failureSlot && raw.length <= HOST_P90_INTEGRATION.reserve, 'host_p90_integration_failure_reserve_required');
      need(paths.file(failureSlot.logical) === failureSlot.target &&
        identity(fs.lstatSync(failureSlot.target,{bigint:true})) === failureSlot.identity &&
        identity(fs.fstatSync(failureSlot.fd,{bigint:true})) === failureSlot.identity, 'host_p90_integration_failure_reserve_changed');
      fs.writeSync(failureSlot.fd, raw, 0, raw.length, 0); fs.ftruncateSync(failureSlot.fd, raw.length); fs.fsyncSync(failureSlot.fd);
      fs.closeSync(failureSlot.fd); failureSlot.fd = null;
      const logical = EVIDENCE + '/failure.json'; fs.renameSync(failureSlot.target, paths.file(logical));
      need(hash(paths.read(logical,HOST_P90_INTEGRATION.reserve)) === hash(raw), 'host_p90_integration_failure_write_changed');
      failure = {path:logical,sha256:hash(raw),bytes:raw.length};
    } catch (secondary) { original.failureEvidenceError = secondary.message; }
    Object.assign(original, {failure, nativeCallIdentity:call?.identity ?? null}); throw original;
  } finally {
    if (failureSlot?.fd !== null && failureSlot?.fd !== undefined) fs.closeSync(failureSlot.fd);
  }
}

// Only a fresh OS-temp fixture may substitute a worker or clock. Never a CLI Run.
export async function runHostAuditForIsolatedTests(options) {
  const root = fs.realpathSync.native(options.root);
  need(path.dirname(root) === fs.realpathSync.native(os.tmpdir()) &&
    /^parameter90-same-call-integration-host-v2-[A-Za-z0-9]+$/u.test(path.basename(root)) &&
    !fs.lstatSync(options.root).isSymbolicLink() && typeof options.worker === 'function', 'host_p90_integration_private_fixture_required');
  return executeHost({...options, root});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    need(process.argv.length === 3, 'provide the reviewed same-call CPU policy SHA only');
    const root = 'F:/ai-pet-world';
    const {runOwnedWorker} = await import(pathToFileURL(path.resolve(root, 'scripts/lib/ai-painter-owned-worker-v1.mjs')));
    const result = await executeHost({root, policySha:process.argv[2], worker:runOwnedWorker, started:Math.floor(performance.timeOrigin)});
    fs.writeSync(1, JSON.stringify(result) + '\n');
  } catch (error) {
    const message = JSON.stringify({status:'failed_closed', error:String(error.message).slice(0,2048),
      failure:error.failure ?? null, failureEvidenceError:String(error.failureEvidenceError ?? '').slice(0,2048), automaticRetries:0}) + '\n';
    need(Buffer.byteLength(message) <= HOST_P90_INTEGRATION.cliStreamMaximum, 'host_p90_integration_cli_error_budget');
    fs.writeSync(2, message);
    process.exitCode = 1;
  }
}



