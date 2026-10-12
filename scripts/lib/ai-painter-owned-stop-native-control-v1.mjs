import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyLocalOperatorMutation } from '../../src/server/ai-console-control/operator-session.ts';
import { createOwnedStopHandoff, createOwnedStopHandoffForIsolatedTests } from './ai-painter-owned-stop-handoff-v1.mjs';
import { validateOwnedStopInput, STOP_REQUEST_LIMITS } from './ai-painter-owned-stop-request-v1.mjs';

// Local file transport only. The actual native owner retains its child handle
// and supplies a stable memory getter. No JSON can recreate that private call.
export const LOCAL_STOP_URL = 'http://localhost:3000/api/ai-console/control/local-v1';
export const NATIVE_STOP_CONTROL_LIMITS = Object.freeze({
  protocol: 'ai-painter-local-control-v1', recordBytes: 8192,
  records: STOP_REQUEST_LIMITS.records, bytes: STOP_REQUEST_LIMITS.evidenceBytes,
  reserveBytes: STOP_REQUEST_LIMITS.failureReserveBytes,
  maximumAgeMs: STOP_REQUEST_LIMITS.maximumAgeMs,
});
const L = NATIVE_STOP_CONTROL_LIMITS;
const need = (v, c) => { if (!v) throw Error(c); };
const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
const stamp = s => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String).join(':');
const namePattern = /^[a-f0-9]{64}\.(intent|result|delivered|request|consumed|acknowledged)\.json$/u;

export function localOperatorRequest(credentials) {
  need(plain(credentials) && Object.keys(credentials).length === 2 &&
    typeof credentials.cookie === 'string' && typeof credentials.csrf === 'string' &&
    !/[\u0000-\u001f\u007f]/u.test(credentials.cookie + credentials.csrf) &&
    Buffer.byteLength(JSON.stringify(credentials)) <= 4096, 'local_operator_credentials_invalid');
  const request = new Request(LOCAL_STOP_URL, { method: 'POST', headers: {
    host: 'localhost:3000', origin: 'http://localhost:3000',
    cookie: credentials.cookie, 'x-ai-console-csrf': credentials.csrf,
  } });
  const auth = verifyLocalOperatorMutation(request);
  need(auth.ok === true, auth.errorCode ?? 'local_operator_unverified');
  // Detached processes must share a stable key; never accept development fallback.
  need(Buffer.byteLength(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim() ?? '') >= 32,
    'local_operator_stable_secret_required');
  return { request, session: auth.session };
}

function ledger(root) {
  need(typeof root === 'string' && path.isAbsolute(root), 'control_absolute_evidence_root_required');
  const logical = path.resolve(root), physical = fs.realpathSync(logical);
  const identity = fs.lstatSync(logical, { bigint: true });
  need(identity.isDirectory() && !identity.isSymbolicLink() && physical === logical,
    'control_evidence_redirect_rejected');
  // Reject redirects in ancestors as well. Caller uses the already resolved
  // formal runtime mapping, never a logical junction for this private ledger.
  for (let p = logical; path.dirname(p) !== p; p = path.dirname(p))
    need(!fs.lstatSync(p).isSymbolicLink(), 'control_evidence_parent_redirect_rejected');
  const secret = process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim();
  need(Buffer.byteLength(secret ?? '') >= 32, 'control_stable_secret_required');
  const namespace = hash(JSON.stringify([physical, String(identity.dev), String(identity.ino)]));
  const key = crypto.createHmac('sha256', secret).update(`local-stop-encryption-v1\n${namespace}`).digest();
  const directories = Object.fromEntries(['inbox', 'requests'].map(kind => {
    const file = path.join(physical, kind), s = fs.lstatSync(file, { bigint: true });
    need(s.isDirectory() && !s.isSymbolicLink(), 'control_namespace_redirect_rejected');
    return [kind, { file, dev: s.dev, ino: s.ino }];
  }));
  const lockPath = path.join(physical, '.write-lock');
  let ownLock = null;
  function stable() {
    const s = fs.lstatSync(logical, { bigint: true });
    need(s.isDirectory() && !s.isSymbolicLink() && s.dev === identity.dev && s.ino === identity.ino &&
      fs.realpathSync(logical) === physical, 'control_evidence_root_changed');
    need(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim() === secret, 'control_secret_changed');
    for (let p = logical; path.dirname(p) !== p; p = path.dirname(p))
      need(!fs.lstatSync(p).isSymbolicLink(), 'control_evidence_parent_changed');
  }
  function directory(kind) {
    need(['inbox', 'requests'].includes(kind), 'control_namespace_invalid'); stable();
    const pinned = directories[kind], s = fs.lstatSync(pinned.file, { bigint: true });
    need(s.isDirectory() && !s.isSymbolicLink() && s.dev === pinned.dev && s.ino === pinned.ino,
      'control_namespace_redirect_or_replaced'); return pinned.file;
  }
  function scan() {
    stable(); let bytes = 0, records = 0;
    const entries = fs.readdirSync(physical).sort();
    if (ownLock) {
      const s = fs.lstatSync(lockPath, { bigint: true });
      need(s.isDirectory() && !s.isSymbolicLink() && s.dev === ownLock.dev && s.ino === ownLock.ino,
        'control_write_lock_changed');
      need(entries.join(',') === '.write-lock,inbox,requests', 'control_namespace_conflict');
    } else need(entries.join(',') === 'inbox,requests', 'control_namespace_conflict_or_busy');
    for (const kind of ['inbox', 'requests']) for (const n of fs.readdirSync(directory(kind))) {
      need(namePattern.test(n), 'control_record_name_invalid');
      const s = fs.lstatSync(path.join(directory(kind), n));
      need(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= L.recordBytes, 'control_record_bound_invalid');
      bytes += s.size; records++;
    }
    need(records <= L.records && bytes + L.reserveBytes <= L.bytes, 'control_ledger_budget');
    return { bytes, records };
  }
  function read(n) {
    need(namePattern.test(n), 'control_record_name_invalid'); scan();
    const file = path.join(directory('inbox'), n), before = fs.lstatSync(file, { bigint: true });
    const fd = fs.openSync(file, 'r'); let data;
    try {
      need(stamp(fs.fstatSync(fd, { bigint: true })) === stamp(before), 'control_record_changed');
      data = Buffer.alloc(Number(before.size)); let offset = 0;
      while (offset < data.length) { const got = fs.readSync(fd, data, offset, data.length - offset, null); need(got > 0, 'control_record_changed'); offset += got; }
      need(stamp(fs.fstatSync(fd, { bigint: true })) === stamp(before) && stamp(fs.lstatSync(file, { bigint: true })) === stamp(before), 'control_record_changed');
    } finally { fs.closeSync(fd); }
    stable(); return JSON.parse(data.toString('utf8'));
  }
  function write(n, value, reservedRecords = 0) {
    if (!ownLock) return exclusive(() => write(n, value, reservedRecords));
    need(namePattern.test(n), 'control_record_name_invalid');
    const bytes = Buffer.from(JSON.stringify(value) + '\n'), used = scan();
    need(bytes.length <= L.recordBytes && used.records + 1 + reservedRecords <= L.records &&
      used.bytes + bytes.length + reservedRecords * L.recordBytes + L.reserveBytes <= L.bytes, 'control_ledger_budget');
    const file = path.join(directory('inbox'), n), fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return { path: file, sha256: hash(bytes), bytes: bytes.length };
  }
  function acquire() {
    stable(); need(ownLock === null, 'control_write_overlap');
    fs.mkdirSync(lockPath); ownLock = fs.lstatSync(lockPath, { bigint: true }); scan();
  }
  function release() {
    stable(); const s = fs.lstatSync(lockPath, { bigint: true });
    need(ownLock && s.isDirectory() && !s.isSymbolicLink() && s.dev === ownLock.dev && s.ino === ownLock.ino,
      'control_write_lock_changed');
    fs.rmdirSync(lockPath); ownLock = null;
  }
  function exclusive(action) { acquire(); try { return action(); } finally { release(); } }
  async function exclusiveAsync(action) { acquire(); try { return await action(); } finally { release(); } }
  const mac = body => crypto.createHmac('sha256', key).update('local-stop-intent-v1\n').update(JSON.stringify(body)).digest('hex');
  function sign(body) { return { ...body, mac: mac(body) }; }
  function verify(record) {
    need(plain(record) && typeof record.mac === 'string' && /^[a-f0-9]{64}$/u.test(record.mac), 'control_mac_invalid');
    const { mac: signature, ...body } = record;
    need(body.namespace === namespace && crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(mac(body), 'hex')), 'control_mac_invalid');
    return body;
  }
  function encrypt(value, intentId) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`${namespace}:${intentId}`));
    return { iv: iv.toString('base64'), data: Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]).toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  }
  function decrypt(value, intentId) {
    need(plain(value) && Object.keys(value).sort().join(',') === 'data,iv,tag', 'control_cipher_invalid');
    for (const k of ['iv', 'data', 'tag']) need(typeof value[k] === 'string' && Buffer.from(value[k], 'base64').toString('base64') === value[k], 'control_cipher_invalid');
    need(Buffer.from(value.iv, 'base64').length === 12 && Buffer.from(value.tag, 'base64').length === 16, 'control_cipher_invalid');
    const cipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
    cipher.setAAD(Buffer.from(`${namespace}:${intentId}`)); cipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data, 'base64')), cipher.final()]).toString('utf8'));
  }
  scan();
  return { namespace, scan, read, write, sign, verify, encrypt, decrypt, exclusive, exclusiveAsync,
    exists: n => { stable(); return fs.existsSync(path.join(directory('inbox'), n)); },
    pending: () => { scan(); return fs.readdirSync(directory('inbox')).filter(n => n.endsWith('.intent.json')).sort(); },
    requestsRoot: directory('requests') };
}

export function initializeOwnedStopControlEvidence(evidenceRoot) {
  need(path.isAbsolute(evidenceRoot), 'control_absolute_evidence_root_required');
  need(!fs.existsSync(evidenceRoot), 'control_evidence_exists');
  // No recursive directory creation or deletion. Parent belongs to this run.
  need(!fs.lstatSync(path.dirname(evidenceRoot)).isSymbolicLink(), 'control_evidence_parent_redirect_rejected');
  fs.mkdirSync(evidenceRoot, { mode: 0o700 });
  for (const n of ['inbox', 'requests']) fs.mkdirSync(path.join(evidenceRoot, n), { mode: 0o700 });
  // Directory preparation is not operator authentication. An absent secret
  // must leave autonomous training available while mutations fail closed.
  if (Buffer.byteLength(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim() ?? '') >= 32) ledger(evidenceRoot);
  return evidenceRoot;
}

export function submitOwnedStopIntent({ evidenceRoot, input, credentials }) {
  const payload = validateOwnedStopInput(input), auth = localOperatorRequest(credentials), store = ledger(evidenceRoot);
  return store.exclusive(() => {
  const intentId = hash(`${auth.session.actorIdentity}\n${payload.idempotencyKey}`), name = `${intentId}.intent.json`;
  if (store.exists(name)) {
    const previous = store.verify(store.read(name));
    need(previous.intentId === intentId && JSON.stringify(previous.payload) === JSON.stringify(payload), 'control_idempotency_conflict');
    return { protocol: L.protocol, status: 'intent_submitted', intentId, replayed: true,
      requestAccepted: false, executionStopped: false, cleanupConfirmed: false, checkpointSaved: false };
  }
  const createdAtMs = Date.now(), expiresAtMs = Math.min(createdAtMs + L.maximumAgeMs, Date.parse(auth.session.expiresAtUtc));
  need(expiresAtMs > createdAtMs, 'control_session_expired');
  const body = { schema: 'owned-stop-local-intent-v1', namespace: store.namespace, intentId,
    payload, createdAtMs, expiresAtMs, credentials: store.encrypt(credentials, intentId) };
  // Reserve the existing request + consume records and result + delivered record.
  const binding = store.write(name, store.sign(body), 4);
  return { protocol: L.protocol, status: 'intent_submitted', intentId, binding, replayed: false,
    requestAccepted: false, executionStopped: false, cleanupConfirmed: false, checkpointSaved: false };
  });
}

function control(options, makeHandoff) {
  need(plain(options) && Object.keys(options).sort().join(',') === 'evidenceRoot,expectedContext,projectRoot,readRetainedNativeCall', 'control_options_invalid');
  const store = ledger(options.evidenceRoot);
  const handoff = makeHandoff({ ...options, evidenceRoot: store.requestsRoot });
  let pending = false, disposed = false, preparedId = null, deliveredId = null, lastError = null;
  function flushEvidence() {
    if (deliveredId !== null && !store.exists(`${deliveredId}.delivered.json`))
      store.write(`${deliveredId}.delivered.json`, store.sign({ schema: 'owned-stop-local-delivered-v1', namespace: store.namespace,
        intentId: deliveredId, reasonDeliveredAtUtc: new Date().toISOString(), requestAccepted: true,
        requestConsumed: true, reasonDelivered: true, executionStopped: false, cleanupConfirmed: false, checkpointSaved: false }));
  }
  async function preparePending() {
    if (pending || disposed) return { ok: false, status: disposed ? 'disposed' : 'busy' };
    pending = true;
    try {
      flushEvidence();
      if (deliveredId) return { ok: true, status: 'reason_delivered_not_stop_proof' };
      // Avoid superseding a reason already prepared for the next fast poll.
      if (handoff.inspect().status === 'ready_for_same_call') return { ok: true, status: 'ready_for_same_call' };
      for (const name of store.pending()) {
        const intentId = name.slice(0, 64);
        if (store.exists(`${intentId}.result.json`)) continue;
        let outcome;
        try {
          const body = store.verify(store.read(name));
          need(body.schema === 'owned-stop-local-intent-v1' && body.intentId === intentId, 'control_intent_identity_invalid');
          need(Number.isSafeInteger(body.createdAtMs) && Number.isSafeInteger(body.expiresAtMs) &&
            body.expiresAtMs > body.createdAtMs && body.expiresAtMs - body.createdAtMs <= L.maximumAgeMs &&
            Date.now() >= body.createdAtMs && Date.now() < body.expiresAtMs, 'control_intent_expired');
          const auth = localOperatorRequest(store.decrypt(body.credentials, intentId));
          const used = store.scan();
          need(used.records + 4 <= L.records && used.bytes + 4 * L.recordBytes + L.reserveBytes <= L.bytes, 'control_ledger_budget');
          outcome = await store.exclusiveAsync(() => handoff.prepare({ input: validateOwnedStopInput(body.payload), operatorRequest: auth.request }));
          if (outcome.ok) preparedId = intentId;
        } catch (error) { outcome = { ok: false, status: 'rejected', errorCode: String(error.message ?? error).slice(0, 256) }; }
        store.write(`${intentId}.result.json`, store.sign({ schema: 'owned-stop-local-result-v1', namespace: store.namespace,
          intentId, recordedAtUtc: new Date().toISOString(), outcome,
          requestAccepted: outcome.requestAccepted === true, requestConsumed: outcome.requestConsumed === true,
          reasonDelivered: false, executionStopped: false, cleanupConfirmed: false, checkpointSaved: false }));
        lastError = outcome.errorCode ?? null;
        return outcome;
      }
      return { ok: true, status: 'no_pending_intent' };
    } catch (error) {
      lastError = String(error.message ?? error).slice(0, 256); handoff.invalidate();
      return { ok: false, status: 'unavailable', errorCode: lastError };
    } finally { pending = false; }
  }
  return Object.freeze({ preparePending, flushEvidence,
    abortReason: () => {
      if (disposed || pending) return null;
      const reason = handoff.abortReason();
      if (reason !== null) deliveredId = preparedId;
      return reason;
    },
    dispose: () => { disposed = true; handoff.dispose(); flushEvidence(); },
    inspect: () => ({ protocol: L.protocol, pending, disposed, preparedId, deliveredId, lastError,
      handoff: handoff.inspect(), nativeCleanupAuthority: 'actual_owner_only',
      executionStopped: false, cleanupConfirmed: false, checkpointSaved: false }) });
}
export function createOwnedStopNativeControl(options) {
  if (Buffer.byteLength(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim() ?? '') < 32) {
    let disposed = false;
    const unavailable = () => ({ protocol: L.protocol, status: disposed ? 'disposed' : 'operator_secret_unavailable',
      errorCode: 'control_stable_secret_required', nativeHookConnected: false,
      requestAccepted: false, requestConsumed: false, reasonDelivered: false,
      executionStopped: false, cleanupConfirmed: false, checkpointSaved: false });
    // Inert stop capability, no input accepted and no later automatic activation.
    return Object.freeze({ preparePending: async () => ({ ok: false, ...unavailable() }),
      abortReason: () => null, flushEvidence: () => {}, dispose: () => { disposed = true; }, inspect: unavailable });
  }
  return control(options, createOwnedStopHandoff);
}
export function createOwnedStopNativeControlForIsolatedTests(options, dependencies) {
  return control(options, value => createOwnedStopHandoffForIsolatedTests(value, dependencies));
}
