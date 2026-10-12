import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createOwnedStopRequestComponent, STOP_REQUEST_LIMITS as REQUEST_LIMITS } from './ai-painter-owned-stop-request-v1.mjs';
import { createOwnedStopExecutionBridge, createOwnedStopExecutionBridgeForIsolatedTests,
  STOP_EXECUTION_BRIDGE_LIMITS as BRIDGE_LIMITS } from './ai-painter-owned-stop-execution-bridge-v1.mjs';

// Component only: no native hook, API, background task or cleanup authority.
// The actual owner must supply a synchronous getter over its private descriptor.
// Arbitrary caller getters cannot be certified by this module.
const need = (ok, code) => { if (!ok) throw Error(code); };
const plain = x => x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const hex = x => typeof x === 'string' && /^[a-f0-9]{64}$/u.test(x);
const identityFields = ['callId', 'runId', 'packageId', 'executionPackageSha256',
  'supervisorProcessId', 'supervisorProcessStartIdentity', 'phase'];
const contextFields = [...identityFields.filter(k => k !== 'callId'), 'executionPackagePath'];
const stamp = s => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String).join(':');
const optionFields = ['projectRoot', 'evidenceRoot', 'expectedContext', 'readRetainedNativeCall', 'maximumAgeMs', 'maximumRefreshMs'];
const asyncFunctionPrototype = Object.getPrototypeOf(async () => {});

function core(options, makeBridge, wallNow, monotonicNow) {
  need(plain(options) && Object.keys(options).every(k => optionFields.includes(k)), 'handoff_option_not_allowed');
  const { projectRoot, evidenceRoot, expectedContext, readRetainedNativeCall,
    maximumAgeMs = BRIDGE_LIMITS.maximumAgeMs, maximumRefreshMs = BRIDGE_LIMITS.maximumRefreshMs } = options;
  // Bridge validates the complete fixed context and both bounds below.
  need(plain(expectedContext), 'handoff_context_invalid');
  const context = Object.freeze(Object.fromEntries(Object.entries(expectedContext)));
  let lastTime = null, lastBridgeCallTime = null;
  function time() {
    const value = { wall: wallNow(), mono: monotonicNow() };
    need(Number.isSafeInteger(value.wall) && Number.isFinite(value.mono), 'handoff_clock_invalid');
    need(lastTime === null || (value.wall >= lastTime.wall && value.mono >= lastTime.mono), 'handoff_clock_rollback');
    lastTime = value; return value;
  }
  function retained() {
    need(typeof readRetainedNativeCall === 'function', 'handoff_retained_getter_missing');
    need(Object.getPrototypeOf(readRetainedNativeCall) !== asyncFunctionPrototype, 'handoff_retained_getter_async');
    const value = readRetainedNativeCall();
    if (value instanceof Promise) {
      Promise.prototype.catch.call(value, () => {});
      throw Error('handoff_retained_getter_async');
    }
    need(plain(value), 'handoff_retained_call_invalid');
    const then = Object.getOwnPropertyDescriptor(value, 'then');
    need(then === undefined, 'handoff_retained_getter_async');
    // Only bounded own data fields; identity accessors cannot run arbitrary work.
    const identity = {};
    for (const key of identityFields) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      need(descriptor && Object.hasOwn(descriptor, 'value'), 'handoff_retained_field_invalid');
      identity[key] = descriptor.value;
      if (key === 'callId') need(typeof identity[key] === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(identity[key]), 'handoff_call_id_invalid');
      else need(identity[key] === context[key], 'handoff_retained_context_mismatch');
    }
    return { reference: value, identity: Object.freeze(identity) };
  }
  const sameCall = (a, b) => a.reference === b.reference && identityFields.every(k => a.identity[k] === b.identity[k]);
  const bridge = makeBridge({ projectRoot, expectedContext: context, maximumAgeMs, maximumRefreshMs,
    readRetainedNativeCall: () => {
      // This time is BEFORE the bridge's final successful snapshot mint. Using
      // it as the handoff anchor cannot extend the hidden bridge snapshot age.
      const observed = time(), call = retained(); lastBridgeCallTime = observed;
      return call.reference;
    } });
  const component = createOwnedStopRequestComponent({ projectRoot, evidenceRoot,
    readCurrentExecution: bridge.readCurrentExecution, readRetainedNativeCall: bridge.readRetainedNativeCall, now: wallNow });
  const ledger = { logical: path.resolve(evidenceRoot), physical: fs.realpathSync(evidenceRoot) };
  const ledgerStat = fs.statSync(evidenceRoot, { bigint: true });
  ledger.dev = ledgerStat.dev; ledger.ino = ledgerStat.ino;
  function stableLedger() {
    const s = fs.statSync(ledger.logical, { bigint: true });
    need(s.dev === ledger.dev && s.ino === ledger.ino && fs.realpathSync(ledger.logical) === ledger.physical, 'handoff_ledger_changed');
  }
  function requestRecord(requestId, binding = null) {
    need(hex(requestId), 'handoff_request_id_invalid'); stableLedger();
    const name = `${requestId}.request.json`, file = path.join(ledger.physical, name);
    if (binding !== null) need(plain(binding) && binding.path === path.join(ledger.logical, name) && hex(binding.sha256), 'handoff_request_binding_invalid');
    const before = fs.lstatSync(file, { bigint: true });
    need(before.isFile() && !before.isSymbolicLink() && before.nlink === 1n && before.size <= BigInt(REQUEST_LIMITS.recordBytes), 'handoff_request_file_bound');
    const fd = fs.openSync(file, 'r'); let bytes;
    try {
      need(stamp(fs.fstatSync(fd, { bigint: true })) === stamp(before), 'handoff_request_file_changed');
      bytes = Buffer.alloc(Number(before.size)); let n = 0;
      while (n < bytes.length) {
        const count = fs.readSync(fd, bytes, n, bytes.length - n, null);
        need(count > 0, 'handoff_request_file_changed'); n += count;
      }
      need(stamp(fs.fstatSync(fd, { bigint: true })) === stamp(before) && stamp(fs.lstatSync(file, { bigint: true })) === stamp(before), 'handoff_request_file_changed');
    } finally { fs.closeSync(fd); }
    stableLedger(); const sha256 = hash(bytes);
    if (binding !== null) need(sha256 === binding.sha256 && bytes.length === binding.bytes, 'handoff_request_sha_mismatch');
    const body = JSON.parse(bytes.toString('utf8'));
    need(plain(body) && body.requestId === requestId && body.kind === 'request' && plain(body.payload) &&
      Number.isSafeInteger(body.createdAtMs) && Number.isSafeInteger(body.expiresAtMs) &&
      body.expiresAtMs > body.createdAtMs && body.expiresAtMs - body.createdAtMs <= REQUEST_LIMITS.maximumAgeMs,
    'handoff_request_record_invalid');
    // Metadata is not authority: only the original provider validates its MAC,
    // exact current context and one-time consume before it can become ready.
    return { body, binding: { path: path.join(ledger.logical, name), sha256, bytes: bytes.length } };
  }
  let generation = 0, pending = false, ready = null, delivered = false, disposed = false, lastError = null, ownerCall = null;
  let requestAccepted = false, requestConsumed = false;
  const clear = code => { ready = null; lastError = String(code).slice(0, 256); };
  function valid(mine, anchor, expiresAtMs, initial) {
    need(!disposed && mine === generation && !delivered, 'handoff_invalidated');
    const current = time();
    need(current.wall >= anchor.wall && current.mono >= anchor.mono &&
      current.wall - anchor.wall < maximumAgeMs && current.mono - anchor.mono < maximumAgeMs,
    'handoff_expired');
    need(current.wall < expiresAtMs, 'handoff_request_expired');
    need(sameCall(initial, retained()), 'handoff_retained_call_changed');
    return current;
  }
  async function prepare(command = {}) {
    const mine = ++generation; clear('handoff_pending');
    // Reject overlap without starting another reader; invalidate the old result.
    if (pending) { bridge.invalidate(); clear('handoff_prepare_concurrency'); return unavailable(lastError); }
    if (disposed || delivered) { clear(disposed ? 'handoff_disposed' : 'handoff_already_delivered'); return unavailable(lastError); }
    requestAccepted = false; requestConsumed = false;
    pending = true;
    try {
      need(plain(command) && ((Object.keys(command).length === 2 && Object.hasOwn(command, 'input') && Object.hasOwn(command, 'operatorRequest')) ||
        (Object.keys(command).length === 1 && Object.hasOwn(command, 'requestId'))), 'handoff_command_fields');
      const entered = time(), initial = retained();
      if (ownerCall === null) ownerCall = initial;
      else need(sameCall(ownerCall, initial), 'handoff_owner_call_changed');
      const result = await bridge.refresh();
      need(!disposed && mine === generation, 'handoff_invalidated');
      need(result.ok === true, result.errorCode ?? 'handoff_bridge_unavailable');
      const anchor = lastBridgeCallTime;
      need(anchor !== null, 'handoff_snapshot_anchor_missing');
      valid(mine, anchor, Number.MAX_SAFE_INTEGER, initial);
      let accepted;
      if (Object.hasOwn(command, 'input')) { accepted = component.submit(command); requestAccepted = true; }
      else accepted = { requestId: command.requestId, request: null };
      const record = requestRecord(accepted.requestId, accepted.request);
      need(contextFields.every(k => k === 'phase' || record.body.payload[k] === context[k]) &&
        record.body.payload.expectedRegistryRevision === result.registryRevision && record.body.callId === initial.identity.callId,
      'handoff_request_context_mismatch');
      need(time().wall >= record.body.createdAtMs, 'handoff_request_not_yet_valid');
      valid(mine, anchor, record.body.expiresAtMs, initial);
      const provider = component.createAbortReasonProvider({ requestId: accepted.requestId });
      const reason = provider.abortReason();
      if (provider.inspect().status === 'consumed') { requestAccepted = true; requestConsumed = true; }
      need(typeof reason === 'string' && reason.length > 0 && Buffer.byteLength(reason, 'utf8') <= REQUEST_LIMITS.abortReasonBytes,
        provider.inspect().lastError ?? 'handoff_request_not_consumed');
      // Recheck exact request bytes and current bridge while still on slow path.
      requestRecord(accepted.requestId, record.binding);
      const current = bridge.readCurrentExecution(), call = bridge.readRetainedNativeCall();
      need(plain(current) && current.registrySha256 === record.body.registrySha256 && plain(call) &&
        identityFields.every(k => call[k] === initial.identity[k]), 'handoff_final_bridge_changed');
      const finished = valid(mine, anchor, record.body.expiresAtMs, initial);
      need(finished.wall - entered.wall < maximumRefreshMs && finished.mono - entered.mono < maximumRefreshMs, 'handoff_prepare_timeout');
      ready = Object.freeze({ mine, anchor, expiresAtMs: record.body.expiresAtMs, initial, reason,
        requestId: accepted.requestId, registryRevision: result.registryRevision, registrySha256: current.registrySha256 });
      lastError = null;
      return { ok: true, status: 'ready_for_same_call', requestId: ready.requestId, registryRevision: ready.registryRevision,
        maximumAgeMs, requestAccepted, requestConsumed, productionEligible: false, executionStopped: false, cleanupConfirmed: false, checkpointSaved: false };
    } catch (error) {
      const code = String(error.message ?? error).slice(0, 256);
      if (mine === generation) { clear(code); bridge.invalidate(); }
      return unavailable(code);
    } finally { pending = false; }
  }
  function unavailable(code) {
    return { ok: false, status: 'unavailable', errorCode: code, requestAccepted, requestConsumed, productionEligible: false,
      executionStopped: false, cleanupConfirmed: false, checkpointSaved: false };
  }
  function abortReason() {
    // Critical fast path: no bridge callback, filesystem, hash, async reader,
    // process probe, refresh or timer. Getter must be the owner's memory getter.
    if (pending || disposed || delivered || ready === null) return null;
    try {
      const current = ready;
      valid(current.mine, current.anchor, current.expiresAtMs, current.initial);
      const end = time();
      need(end.wall - current.anchor.wall < maximumAgeMs && end.mono - current.anchor.mono < maximumAgeMs &&
        end.wall < current.expiresAtMs && !pending && !disposed && current.mine === generation, 'handoff_expired');
      delivered = true; ready = null; lastError = null; return current.reason;
    } catch (error) { ++generation; clear(error.message ?? error); return null; }
  }
  function invalidate() { ++generation; clear('handoff_explicitly_invalidated'); bridge.invalidate(); }
  function dispose() { disposed = true; ++generation; clear('handoff_disposed'); bridge.invalidate(); }
  return Object.freeze({ prepare, abortReason, invalidate, dispose,
    inspect: () => ({ status: disposed ? 'disposed' : pending ? 'pending' : delivered ? 'reason_delivered_not_stop_proof' : ready ? 'ready_for_same_call' : 'unavailable',
      pending, lastError, maximumAgeMs, maximumRefreshMs, readerTrust: bridge.inspect().readerTrust,
      requestAccepted, requestConsumed,
      productionEligible: false, executionStopped: false, cleanupConfirmed: false, checkpointSaved: false,
      cleanupStatus: 'cleanup_unknown', nativeHookConnected: false }) });
}
export function createOwnedStopHandoff(options = {}) {
  return core(options, createOwnedStopExecutionBridge, Date.now, () => performance.now());
}
// Explicitly unverified test seam; never reachable via the production factory.
export function createOwnedStopHandoffForIsolatedTests(options, dependencies) {
  need(plain(dependencies) && Object.keys(dependencies).every(k => ['reader', 'wallNow', 'monotonicNow', 'readRuntimeMapping'].includes(k)) &&
    typeof dependencies.reader === 'function' && typeof dependencies.wallNow === 'function' && typeof dependencies.monotonicNow === 'function', 'handoff_test_dependencies_invalid');
  return core(options, bridgeOptions => createOwnedStopExecutionBridgeForIsolatedTests(bridgeOptions, dependencies), dependencies.wallNow, dependencies.monotonicNow);
}
