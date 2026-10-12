import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectRoot as configuredProjectRoot, physicalRuntimeRoot as configuredPhysicalRuntimeRoot } from './ai-pet-world-storage.mjs';
const storageEnvironmentAtImport = process.env.AI_PET_WORLD_DATA_ROOT;
import { verifyLocalOperatorMutation } from '../../src/server/ai-console-control/operator-session.ts';

// Isolated component, not wired to an API, runner, registry writer or native Job.
// The existing session validator is real. The synchronous registry/retained-call
// bridges still require production integration and independent live validation.
// No disk record, callback boolean or accepted request certifies live cleanup.
export const STOP_REQUEST_LIMITS = Object.freeze({
  sourceClosureContract: 'owned-stop-source-closure-v2',
  inputBytes: 4096, recordBytes: 8192, records: 64, evidenceBytes: 262144,
  failureReserveBytes: 65536, maximumAgeMs: 120000, sourceFiles: 256,
  sourceFileBytes: 1048576, sourceTotalBytes: 16777216, abortReasonBytes: 512,
});
const L = STOP_REQUEST_LIMITS;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const need = (ok, code) => { if (!ok) throw Error(code); };
const plain = x => x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
const hex = x => typeof x === 'string' && /^[a-f0-9]{64}$/u.test(x);
const safeId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(x);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stamp = s => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String).join(':');
const fields = ['runId', 'packageId', 'executionPackagePath', 'executionPackageSha256',
  'expectedRegistryRevision', 'supervisorProcessId', 'supervisorProcessStartIdentity',
  'idempotencyKey', 'reasonText'];

function boundedAbortReason(requestId, reasonText) {
  const reason = `operator_stop:${requestId}:${reasonText}`;
  need(Buffer.byteLength(reason, 'utf8') <= L.abortReasonBytes, 'stop_reason_utf8_limit');
  return reason;
}

function relative(value) {
  need(typeof value === 'string' && value.length > 0 && value.length <= 512 &&
    !path.isAbsolute(value) && !value.includes('\\') && !value.includes(':') &&
    value.split('/').every(p => p && p !== '.' && p !== '..') && !/[\u0000-\u001f\u007f]/u.test(value),
  'stop_path_invalid');
  return value;
}
function rootScope(root, allowConfiguredRuntime = false) {
  need(typeof root === 'string' && path.isAbsolute(root), 'stop_absolute_root_required');
  const logical = path.resolve(root), physical = fs.realpathSync(logical);
  const s = fs.statSync(logical, { bigint: true });
  need(s.isDirectory() && s.ino > 0n && s.dev > 0n, 'stop_root_identity_missing');
  const scope = { logical, physical, dev: String(s.dev), ino: String(s.ino) };
  // Only project scope may use the existing formal mapping. Evidence ledger
  // namespaces and arbitrary caller roots never gain redirect permission.
  if (allowConfiguredRuntime && path.relative(logical, configuredProjectRoot) === '') {
    need(process.env.AI_PET_WORLD_DATA_ROOT === storageEnvironmentAtImport, 'stop_storage_configuration_changed');
    const runtimeLogical = path.join(logical, '.runtime');
    const link = fs.lstatSync(runtimeLogical, { bigint: true }), target = fs.statSync(runtimeLogical, { bigint: true });
    const runtimePhysical = fs.realpathSync(runtimeLogical);
    need(target.isDirectory() && path.relative(runtimePhysical, configuredPhysicalRuntimeRoot) === '' &&
      !fs.lstatSync(configuredPhysicalRuntimeRoot).isSymbolicLink(), 'stop_runtime_target_mismatch');
    scope.runtime = { logical: runtimeLogical, physical: runtimePhysical,
      linkDev: String(link.dev), linkIno: String(link.ino), redirected: link.isSymbolicLink(),
      linkTarget: link.isSymbolicLink() ? fs.readlinkSync(runtimeLogical) : null,
      dev: String(target.dev), ino: String(target.ino) };
  }
  return scope;
}
function stableRoot(scope) {
  const s = fs.statSync(scope.logical, { bigint: true });
  need(String(s.dev) === scope.dev && String(s.ino) === scope.ino &&
    fs.realpathSync(scope.logical) === scope.physical, 'stop_root_changed');
  if (scope.runtime) {
    need(process.env.AI_PET_WORLD_DATA_ROOT === storageEnvironmentAtImport, 'stop_storage_configuration_changed');
    const pinned = scope.runtime, link = fs.lstatSync(pinned.logical, { bigint: true }), target = fs.statSync(pinned.logical, { bigint: true });
    need(String(link.dev) === pinned.linkDev && String(link.ino) === pinned.linkIno &&
      link.isSymbolicLink() === pinned.redirected && (!pinned.redirected || fs.readlinkSync(pinned.logical) === pinned.linkTarget) &&
      String(target.dev) === pinned.dev && String(target.ino) === pinned.ino &&
      fs.realpathSync(pinned.logical) === pinned.physical && !fs.lstatSync(configuredPhysicalRuntimeRoot).isSymbolicLink(),
    'stop_runtime_root_changed');
  }
}
function locate(scope, logicalPath) {
  stableRoot(scope);
  const pieces = relative(logicalPath).split('/');
  let file = scope.physical;
  for (let i = 0; i < pieces.length; i++) {
    if (i === 0 && pieces[i] === '.runtime' && scope.runtime) {
      // stableRoot above already verified this exact formal root and identity.
      file = scope.runtime.physical; continue;
    }
    file = path.join(file, pieces[i]);
    if (fs.existsSync(file)) {
      const s = fs.lstatSync(file);
      need(!s.isSymbolicLink() && (i === pieces.length - 1 || s.isDirectory()), 'stop_redirect_rejected');
    } else need(i === pieces.length - 1, 'stop_parent_missing');
  }
  return file;
}
function boundedRead(scope, logicalPath, maximum) {
  const file = locate(scope, logicalPath), before = fs.lstatSync(file, { bigint: true });
  need(before.isFile() && !before.isSymbolicLink() && before.nlink === 1n && before.size <= BigInt(maximum),
    'stop_file_size_or_type');
  const fd = fs.openSync(file, 'r');
  try {
    need(stamp(fs.fstatSync(fd, { bigint: true })) === stamp(before), 'stop_file_changed');
    const bytes = Buffer.alloc(Number(before.size));
    let count = 0;
    while (count < bytes.length) {
      const n = fs.readSync(fd, bytes, count, bytes.length - count, null);
      need(n > 0, 'stop_file_changed'); count += n;
    }
    need(stamp(fs.fstatSync(fd, { bigint: true })) === stamp(before) &&
      stamp(fs.lstatSync(file, { bigint: true })) === stamp(before), 'stop_file_changed');
    stableRoot(scope); return bytes;
  } finally { fs.closeSync(fd); }
}
function parseInput(raw) {
  let bytes;
  try { bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(typeof raw === 'string' ? raw : JSON.stringify(raw)); }
  catch { throw Error('stop_input_invalid'); }
  need(bytes.length <= L.inputBytes, 'stop_input_oversized');
  let value; try { value = JSON.parse(bytes.toString('utf8')); } catch { throw Error('stop_input_invalid_json'); }
  need(plain(value) && Object.keys(value).length === fields.length && fields.every(k => Object.hasOwn(value, k)),
    'stop_input_fields');
  need(safeId(value.runId) && safeId(value.packageId) && hex(value.executionPackageSha256), 'stop_target_invalid');
  relative(value.executionPackagePath);
  need(Number.isSafeInteger(value.expectedRegistryRevision) && value.expectedRegistryRevision > 0 &&
    Number.isSafeInteger(value.supervisorProcessId) && value.supervisorProcessId > 0, 'stop_identity_invalid');
  // Preserve creation identities as strings, never round FILETIME through Number.
  need(typeof value.supervisorProcessStartIdentity === 'string' &&
    /^[A-Za-z0-9_:.+-]{1,128}$/u.test(value.supervisorProcessStartIdentity), 'stop_creation_identity_invalid');
  need(typeof value.idempotencyKey === 'string' && /^[A-Za-z0-9_-]{16,128}$/u.test(value.idempotencyKey), 'stop_key_invalid');
  need(typeof value.reasonText === 'string' && value.reasonText.length >= 4 && value.reasonText.length <= 240 &&
    !/[\u0000-\u001f\u007f]/u.test(value.reasonText), 'stop_reason_invalid');
  // The derived identity always has 64 ASCII hex digits. Count the complete
  // native-owner message before accepting; reject oversize text without truncation.
  boundedAbortReason('0'.repeat(64), value.reasonText);
  return Object.fromEntries(fields.map(k => [k, value[k]]));
}

// Fixed local-control transport reuses the exact parser and formal mapping.
// These helpers confer no retained-call or cleanup authority.
export const validateOwnedStopInput = parseInput;
export function readOwnedStopProjectFile(projectRoot, relativePath, maximum = L.sourceFileBytes) {
  need(Number.isSafeInteger(maximum) && maximum > 0 && maximum <= L.sourceFileBytes, 'stop_read_bound_invalid');
  return boundedRead(rootScope(projectRoot, true), relativePath, maximum);
}
export function resolveOwnedStopProjectDirectory(projectRoot, relativePath) {
  const scope = rootScope(projectRoot, true), file = locate(scope, relativePath);
  need(fs.lstatSync(file).isDirectory() && !fs.lstatSync(file).isSymbolicLink(), 'stop_directory_invalid');
  stableRoot(scope); return file;
}

export function createOwnedStopRequestComponent({ projectRoot, evidenceRoot,
  readCurrentExecution = null, readRetainedNativeCall = null, now = Date.now } = {}) {
  const project = rootScope(projectRoot, true), evidence = rootScope(evidenceRoot);
  need(project.physical !== evidence.physical, 'stop_dedicated_evidence_root_required');
  const namespace = hash(JSON.stringify(evidence));
  const secretText = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim();
  const signingKey = secretText ? Buffer.from(secretText, 'utf8') : null;
  // No development fallback or caller-supplied signing key for durable requests.
  const keyReady = () => {
    need(signingKey?.length >= 32 && process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim() === secretText,
      'stop_signing_secret_unavailable_or_changed');
  };
  const mac = value => {
    keyReady();
    return crypto.createHmac('sha256', signingKey).update('ai-painter-owned-stop-request-v1\n').update(JSON.stringify(value)).digest('hex');
  };
  const fileName = (id, kind) => { need(hex(id), 'stop_request_id_invalid'); return `${id}.${kind}.json`; };
  function readRecord(id, kind) {
    const name = fileName(id, kind), bytes = boundedRead(evidence, name, L.recordBytes);
    let record; try { record = JSON.parse(bytes.toString('utf8')); } catch { throw Error('stop_record_invalid_json'); }
    need(plain(record) && hex(record.mac), 'stop_record_invalid');
    const { mac: signature, ...body } = record;
    need(body.namespace === namespace && body.requestId === id && body.kind === kind,
      'stop_record_scope_mismatch');
    need(crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(mac(body), 'hex')), 'stop_record_mac_invalid');
    return { body, binding: { path: path.join(evidence.logical, name), sha256: hash(bytes), bytes: bytes.length } };
  }
  function exists(id, kind) { return fs.existsSync(locate(evidence, fileName(id, kind))); }
  function writeRecord(id, kind, content) {
    const body = { schema: 'ai-painter-owned-stop-record-v1', namespace, requestId: id, kind, ...content };
    const bytes = Buffer.from(JSON.stringify({ ...body, mac: mac(body) }) + '\n');
    need(bytes.length <= L.recordBytes, 'stop_record_oversized');
    stableRoot(evidence);
    const entries = fs.readdirSync(evidence.physical, { withFileTypes: true });
    need(entries.length < L.records, 'stop_record_count_limit');
    let used = 0;
    for (const entry of entries) {
      need(/^[a-f0-9]{64}\.(request|consumed|acknowledged)\.json$/u.test(entry.name), 'stop_evidence_namespace_conflict');
      const s = fs.lstatSync(path.join(evidence.physical, entry.name));
      need(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= L.recordBytes, 'stop_evidence_type_invalid');
      used += s.size;
    }
    need(used + bytes.length + L.failureReserveBytes <= L.evidenceBytes, 'stop_evidence_budget');
    const file = locate(evidence, fileName(id, kind)), fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    // A failed/partial publication is retained, never removed or retried.
    return readRecord(id, kind);
  }
  function currentTarget(input) {
    need(typeof readCurrentExecution === 'function' && typeof readRetainedNativeCall === 'function',
      'stop_current_identity_bridge_not_connected');
    const current = readCurrentExecution();
    need(plain(current) && typeof current.registryPath === 'string' && hex(current.registrySha256),
      'stop_current_identity_unverified');
    const raw = boundedRead(project, current.registryPath, L.sourceFileBytes);
    need(hash(raw) === current.registrySha256, 'stop_registry_sha_mismatch');
    const registry = JSON.parse(raw.toString('utf8')), active = registry.activeExecution;
    need(plain(active) && registry.executionState === 'executing' && active.executionState === 'executing',
      'stop_no_active_execution');
    need(registry.runId === input.runId && registry.packageId === input.packageId &&
      registry.registryRevision === input.expectedRegistryRevision && active.runId === input.runId &&
      active.packageId === input.packageId && active.processId === input.supervisorProcessId &&
      active.processStartIdentity === input.supervisorProcessStartIdentity, 'stop_current_target_mismatch');
    const call = readRetainedNativeCall();
    need(plain(call) && safeId(call.callId) && call.supervisorProcessId === input.supervisorProcessId &&
      call.supervisorProcessStartIdentity === input.supervisorProcessStartIdentity && call.runId === input.runId &&
      call.packageId === input.packageId && call.executionPackageSha256 === input.executionPackageSha256,
      'stop_retained_call_identity_mismatch');
    const packageBytes = boundedRead(project, input.executionPackagePath, L.sourceFileBytes);
    need(hash(packageBytes) === input.executionPackageSha256, 'stop_package_sha_mismatch');
    const spec = JSON.parse(packageBytes.toString('utf8'));
    need(spec.packageIdentity === input.packageId && plain(active.programLineage) && plain(spec.programLineage),
      'stop_package_identity_mismatch');
    const bindings = Object.values(active.programLineage);
    need(bindings.length > 0 && bindings.length <= L.sourceFiles, 'stop_source_closure_missing');
    let sourceBytes = 0;
    for (const [name, binding] of Object.entries(active.programLineage)) {
      need(plain(binding) && hex(binding.sha256) && spec.programLineage[name] === binding.sha256,
        'stop_source_binding_mismatch');
      const bytes = boundedRead(project, binding.path, L.sourceFileBytes);
      sourceBytes += bytes.length; need(sourceBytes <= L.sourceTotalBytes, 'stop_source_budget');
      need(hash(bytes) === binding.sha256, 'stop_source_sha_mismatch');
    }
    need(Object.keys(spec.programLineage).length === bindings.length, 'stop_source_closure_mismatch');
    const fresh = readCurrentExecution(), freshCall = readRetainedNativeCall();
    need(plain(fresh) && fresh.registryPath === current.registryPath && fresh.registrySha256 === current.registrySha256 &&
      hash(boundedRead(project, current.registryPath, L.sourceFileBytes)) === current.registrySha256,
      'stop_registry_changed_during_validation');
    need(plain(freshCall) && freshCall.callId === call.callId && freshCall.runId === input.runId &&
      freshCall.packageId === input.packageId && freshCall.executionPackageSha256 === input.executionPackageSha256 &&
      freshCall.supervisorProcessId === input.supervisorProcessId &&
      freshCall.supervisorProcessStartIdentity === input.supervisorProcessStartIdentity,
      'stop_retained_call_changed_during_validation');
    return { registrySha256: hash(raw), callId: call.callId };
  }
  function acceptedResult(record, replayed) {
    return { status: 'requested', replayed, requestId: record.body.requestId, request: record.binding,
      executionStopped: false, cleanupConfirmed: false, productionEligible: false };
  }
  function submit({ input, operatorRequest } = {}) {
    const payload = parseInput(input);
    need(operatorRequest instanceof Request, 'stop_authenticated_operator_request_required');
    // This is the existing real HMAC/session/origin/CSRF verifier, not a supplied boolean.
    const authentication = verifyLocalOperatorMutation(operatorRequest);
    need(authentication.ok === true, authentication.errorCode ?? 'stop_operator_unverified');
    keyReady();
    const actorIdentity = authentication.session.actorIdentity;
    const requestId = hash(`${actorIdentity}\n${payload.idempotencyKey}`);
    if (exists(requestId, 'request')) {
      const record = readRecord(requestId, 'request');
      need(same(record.body.payload, payload) && record.body.actorIdentity === actorIdentity, 'stop_idempotency_conflict');
      return acceptedResult(record, true);
    }
    const identity = currentTarget(payload), createdAtMs = now();
    need(Number.isSafeInteger(createdAtMs), 'stop_clock_invalid');
    const expiresAtMs = Math.min(createdAtMs + L.maximumAgeMs, Date.parse(authentication.session.expiresAtUtc));
    need(expiresAtMs > createdAtMs, 'stop_operator_expired');
    const record = writeRecord(requestId, 'request', { payload, actorIdentity, createdAtMs, expiresAtMs,
      registrySha256: identity.registrySha256, callId: identity.callId,
      status: 'requested', executionStopped: false, cleanupConfirmed: false });
    return acceptedResult(record, false);
  }
  function createAbortReasonProvider({ requestId } = {}) {
    fileName(requestId, 'request');
    let consumed = null, acknowledged = null, lastError = null;
    const abortReason = () => {
      if (consumed) return null;
      try {
        const record = readRecord(requestId, 'request'), body = record.body;
        need(now() >= body.createdAtMs && now() < body.expiresAtMs, 'stop_request_expired');
        const identity = currentTarget(parseInput(body.payload));
        need(identity.registrySha256 === body.registrySha256, 'stop_registry_changed');
        need(identity.callId === body.callId, 'stop_native_call_changed');
        const reason = boundedAbortReason(requestId, body.payload.reasonText);
        if (exists(requestId, 'consumed')) { readRecord(requestId, 'consumed'); return null; }
        consumed = writeRecord(requestId, 'consumed', { request: record.binding,
          callId: identity.callId, status: 'consumed', consumedAtMs: now(), executionStopped: false,
          cleanupConfirmed: false, checkpointSaved: false });
        lastError = null;
        return reason;
      } catch (error) {
        // Invalid/missing/untrusted requests must not turn into runNative stop(error).
        lastError = String(error.message ?? error).slice(0,512); return null;
      }
    };
    const acknowledge = (...args) => {
      need(args.length === 0, 'stop_copied_cleanup_receipt_rejected');
      need(consumed !== null, 'stop_not_consumed_by_this_call');
      if (acknowledged) return acknowledged;
      // A component outside the retained native owner's closure has no live
      // cleanup authority. Even a signed disk receipt cannot confer it.
      acknowledged = writeRecord(requestId, 'acknowledged', { consumed: consumed.binding,
        callId: consumed.body.callId, status: 'acknowledged', acknowledgedAtMs: now(),
        cleanupStatus: 'cleanup_unknown', executionStopped: false, cleanupConfirmed: false,
        checkpointSaved: false, cleanupAuthority: 'retained_live_native_bridge_not_connected' });
      return acknowledged;
    };
    return Object.freeze({ abortReason, acknowledge,
      inspect: () => ({ status: acknowledged ? 'acknowledged' : consumed ? 'consumed' : 'requested',
        cleanupStatus: acknowledged ? 'cleanup_unknown' : 'not_observed',
        lastError, executionStopped: false, cleanupConfirmed: false, checkpointSaved: false }) });
  }
  return Object.freeze({ submit, createAbortReasonProvider,
    trustStatus: Object.freeze({ operator: 'existing_operator_session_validator',
      currentExecution: 'unverified_synchronous_retained_identity_adapter',
      liveCleanup: 'not_connected', productionEligible: false }) });
}
