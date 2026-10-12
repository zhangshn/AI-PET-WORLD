import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { STOP_REQUEST_LIMITS as SOURCE_LIMITS } from './ai-painter-owned-stop-request-v1.mjs';
import { projectRoot as configuredProjectRoot, physicalRuntimeRoot as configuredPhysicalRuntimeRoot } from './ai-pet-world-storage.mjs';
const storageEnvironmentAtImport = process.env.AI_PET_WORLD_DATA_ROOT;
import { readCurrentExecutionRegistry, CURRENT_EXECUTION_REGISTRY_PATH } from '../../src/server/ai-painter-current-execution-registry.mjs';

// Isolated integration seam. No timer, writer, dispatch, owner or cleanup authority.
// The getter must close over the actual retained native call and return its stable
// in-memory descriptor. This module cannot certify an arbitrary caller's getter.
export const STOP_EXECUTION_BRIDGE_LIMITS = Object.freeze({ maximumAgeMs: 1000, maximumRefreshMs: 15000, fileBytes: SOURCE_LIMITS.sourceFileBytes, concurrentRefreshes: 2 });
const L = STOP_EXECUTION_BRIDGE_LIMITS;
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const need = (ok, code) => { if (!ok) throw Error(code); };
const plain = x => x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
const hex = x => typeof x === 'string' && /^[a-f0-9]{64}$/u.test(x);
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(x);
const fields = ['runId', 'packageId', 'executionPackagePath', 'executionPackageSha256', 'supervisorProcessId', 'supervisorProcessStartIdentity', 'phase'];
const callFields = ['callId', ...fields.filter(k => k !== 'executionPackagePath')];
const stamp = s => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String).join(':');
function relative(x) {
  need(typeof x === 'string' && x.length > 0 && x.length <= 512 && !path.isAbsolute(x) &&
    !/[\\:\u0000-\u001f\u007f]/u.test(x) && x.split('/').every(s => s && s !== '.' && s !== '..'), 'bridge_path_invalid');
  return x;
}
function core(options, reader, wallNow, monotonicNow, readerTrust, readRuntimeMapping) {
  const { projectRoot, expectedContext, readRetainedNativeCall, maximumAgeMs = L.maximumAgeMs, maximumRefreshMs = L.maximumRefreshMs } = options;
  need(typeof projectRoot === 'string' && path.isAbsolute(projectRoot), 'bridge_absolute_root_required');
  need(Number.isSafeInteger(maximumAgeMs) && maximumAgeMs > 0 && maximumAgeMs <= L.maximumAgeMs, 'bridge_age_bound_invalid');
  need(Number.isSafeInteger(maximumRefreshMs) && maximumRefreshMs > 0 && maximumRefreshMs <= L.maximumRefreshMs, 'bridge_refresh_bound_invalid');
  need(plain(expectedContext) && Object.keys(expectedContext).length === fields.length && fields.every(k => Object.hasOwn(expectedContext, k)), 'bridge_context_fields_invalid');
  const context = Object.freeze(Object.fromEntries(fields.map(k => [k, expectedContext[k]])));
  need(id(context.runId) && id(context.packageId) && id(context.phase) && hex(context.executionPackageSha256), 'bridge_context_identity_invalid');
  relative(context.executionPackagePath);
  need(Number.isSafeInteger(context.supervisorProcessId) && context.supervisorProcessId > 0 && typeof context.supervisorProcessStartIdentity === 'string' && /^[A-Za-z0-9_:.+-]{1,128}$/u.test(context.supervisorProcessStartIdentity), 'bridge_process_identity_invalid');
  const root = path.resolve(projectRoot), physical = fs.realpathSync(root), rootStamp = fs.statSync(root, { bigint: true });
  need(rootStamp.isDirectory(), 'bridge_root_invalid');
  const equalPath = (a, b) => path.relative(path.resolve(a), path.resolve(b)) === '';
  const runtimeLogical = path.join(root, '.runtime');
  function mapping() {
    const value = readRuntimeMapping(root);
    need(value === null || (plain(value) && typeof value.projectRoot === 'string' && typeof value.physicalRuntimeRoot === 'string' &&
      path.isAbsolute(value.physicalRuntimeRoot) && equalPath(value.projectRoot, root)), 'bridge_runtime_mapping_invalid');
    return value === null ? null : { projectRoot: path.resolve(value.projectRoot), physicalRuntimeRoot: path.resolve(value.physicalRuntimeRoot) };
  }
  const pinnedMapping = mapping(), runtimeLstat = fs.lstatSync(runtimeLogical, { bigint: true });
  const runtimePhysical = fs.realpathSync(runtimeLogical), runtimeStat = fs.statSync(runtimeLogical, { bigint: true });
  const runtimeLinkTarget = runtimeLstat.isSymbolicLink() ? fs.readlinkSync(runtimeLogical) : null;
  need(runtimeStat.isDirectory(), 'bridge_runtime_root_invalid');
  if (pinnedMapping !== null) {
    need(equalPath(runtimePhysical, pinnedMapping.physicalRuntimeRoot) && !fs.lstatSync(pinnedMapping.physicalRuntimeRoot).isSymbolicLink(), 'bridge_runtime_target_mismatch');
  } else need(!runtimeLstat.isSymbolicLink(), 'bridge_runtime_mapping_required');
  function stableRoots() {
    const current = fs.statSync(root, { bigint: true });
    need(current.dev === rootStamp.dev && current.ino === rootStamp.ino && fs.realpathSync(root) === physical, 'bridge_root_changed');
    const nextMapping = mapping();
    need((pinnedMapping === null && nextMapping === null) || (pinnedMapping !== null && nextMapping !== null &&
      equalPath(pinnedMapping.projectRoot, nextMapping.projectRoot) && equalPath(pinnedMapping.physicalRuntimeRoot, nextMapping.physicalRuntimeRoot)), 'bridge_runtime_mapping_changed');
    const link = fs.lstatSync(runtimeLogical, { bigint: true }), target = fs.statSync(runtimeLogical, { bigint: true });
    need(link.dev === runtimeLstat.dev && link.ino === runtimeLstat.ino && link.isSymbolicLink() === runtimeLstat.isSymbolicLink() &&
      (!link.isSymbolicLink() || fs.readlinkSync(runtimeLogical) === runtimeLinkTarget) &&
      target.dev === runtimeStat.dev && target.ino === runtimeStat.ino && equalPath(fs.realpathSync(runtimeLogical), runtimePhysical), 'bridge_runtime_root_changed');
    if (pinnedMapping !== null) need(!fs.lstatSync(pinnedMapping.physicalRuntimeRoot).isSymbolicLink(), 'bridge_runtime_target_mismatch');
  }
  function bytes(rel) {
    stableRoots();
    const pieces = relative(rel).split('/');
    let file = physical, first = 0;
    // Only the pinned, configured .runtime root can redirect; children cannot.
    if (pieces[0] === '.runtime') { file = runtimePhysical; first = 1; }
    for (const piece of pieces.slice(first)) {
      file = path.join(file, piece);
      need(!fs.lstatSync(file).isSymbolicLink(), 'bridge_redirect_rejected');
    }
    const before = fs.lstatSync(file, { bigint: true });
    need(before.isFile() && before.nlink === 1n && before.size <= BigInt(L.fileBytes), 'bridge_file_bound_invalid');
    const fd = fs.openSync(file, 'r');
    try {
      need(stamp(fs.fstatSync(fd, { bigint: true })) === stamp(before), 'bridge_file_changed');
      const data = Buffer.alloc(Number(before.size));
      let n = 0;
      while (n < data.length) { const count = fs.readSync(fd, data, n, data.length - n, null); need(count > 0, 'bridge_file_changed'); n += count; }
      need(stamp(fs.fstatSync(fd, { bigint: true })) === stamp(before) && stamp(fs.lstatSync(file, { bigint: true })) === stamp(before), 'bridge_file_changed');
      stableRoots();
      return data;
    } finally { fs.closeSync(fd); }
  }
  function call() {
    need(typeof readRetainedNativeCall === 'function', 'bridge_retained_getter_missing');
    const value = readRetainedNativeCall();
    if (value && typeof value.then === 'function') {
      // Reject asynchronous getters without leaking a rejected Promise.
      if (value instanceof Promise) value.catch(() => {});
      throw Error('bridge_retained_getter_async');
    }
    need(plain(value) && id(value.callId), 'bridge_retained_call_invalid');
    for (const k of callFields.filter(k => k !== 'callId')) need(value[k] === context[k], 'bridge_retained_context_mismatch');
    return { reference: value, identity: Object.fromEntries(callFields.map(k => [k, value[k]])) };
  }
  const sameCall = (a, b) => a.reference === b.reference && callFields.every(k => a.identity[k] === b.identity[k]);
  let generation = 0, snapshot = null, pending = 0, lastError = null;
  function clear(code) { snapshot = null; lastError = String(code).slice(0, 256); }
  function time() {
    const wall = wallNow(), mono = monotonicNow();
    need(Number.isSafeInteger(wall) && Number.isFinite(mono), 'bridge_clock_invalid');
    return { wall, mono };
  }
  function fresh(start, bound = maximumAgeMs, code = 'bridge_snapshot_expired') {
    const t = time();
    need(t.wall >= start.wall && t.mono >= start.mono && t.wall - start.wall < bound && t.mono - start.mono < bound, code);
    return t;
  }
  function verifyFiles(binding) {
    need(hash(bytes(CURRENT_EXECUTION_REGISTRY_PATH)) === binding.registrySha256, 'bridge_registry_changed');
    need(hash(bytes(context.executionPackagePath)) === context.executionPackageSha256, 'bridge_package_changed');
    need(hash(bytes(binding.lock.path)) === binding.lock.sha256, 'bridge_lock_changed');
    const hb = JSON.parse(bytes(binding.heartbeat.path).toString('utf8'));
    need(plain(hb) && hb.runId === context.runId && hb.packageId === context.packageId && hb.processId === context.supervisorProcessId && hb.processStartIdentity === context.supervisorProcessStartIdentity && hb.executionState === 'executing' && hb.ttlSeconds === binding.heartbeat.ttlSeconds && hb.capabilityVersion === binding.capabilityVersion && hb.schemaVersion === 'ai-painter-current-active-execution-heartbeat-v1', 'bridge_heartbeat_identity_mismatch');
    const heartbeatAt = Date.parse(hb.heartbeatAtUtc), t = time();
    need(Number.isFinite(heartbeatAt) && heartbeatAt <= t.wall && t.wall < heartbeatAt + hb.ttlSeconds * 1000, 'bridge_heartbeat_expired');
  }
  async function refresh() {
    const mine = ++generation;
    clear('bridge_refresh_pending');
    if (pending >= L.concurrentRefreshes) { clear('bridge_refresh_concurrency_bound'); return { ok: false, status: 'unavailable', errorCode: lastError }; }
    pending++;
    let timeout, readerTracked = false;
    try {
      const start = time(), retained = call();
      const entered = fresh(start, maximumRefreshMs, 'bridge_refresh_timeout');
      const remaining = maximumRefreshMs - Math.max(entered.wall - start.wall, entered.mono - start.mono);
      // Start deadline before entering the reader, including its synchronous probes.
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Error('bridge_refresh_timeout')), remaining);
      });
      const reading = Promise.resolve(reader(root)); // ONLY explicit refresh enters the slow official reader.
      readerTracked = true;
      // A timed-out underlying reader remains counted until it actually settles.
      reading.then(() => { pending--; }, () => { pending--; });
      const result = await Promise.race([reading, deadline]);
      need(mine === generation, 'bridge_refresh_superseded');
      fresh(start, maximumRefreshMs, 'bridge_refresh_timeout');
      need(result?.ok === true && result.status === 'verified' && plain(result.registry) && hex(result.registrySha256), 'bridge_registry_unverified');
      const registry = result.registry, active = registry.activeExecution;
      need(plain(active) && registry.executionState === 'executing' && active.executionState === 'executing', 'bridge_no_executing_target');
      need(Number.isSafeInteger(registry.registryRevision) && registry.registryRevision > 0 && registry.runId === context.runId && registry.packageId === context.packageId && active.runId === context.runId && active.packageId === context.packageId && active.processId === context.supervisorProcessId && active.processStartIdentity === context.supervisorProcessStartIdentity, 'bridge_registry_context_mismatch');
      need(plain(active.lock) && hex(active.lock.sha256) && plain(active.heartbeat) && Number.isSafeInteger(active.heartbeat.ttlSeconds) && active.heartbeat.ttlSeconds > 0, 'bridge_active_binding_invalid');
      const spec = JSON.parse(bytes(context.executionPackagePath).toString('utf8'));
      need(spec.packageIdentity === context.packageId && plain(spec.programLineage) && plain(active.programLineage), 'bridge_package_context_mismatch');
      const roles = Object.keys(active.programLineage);
      need(roles.length > 0 && roles.length <= SOURCE_LIMITS.sourceFiles && Object.keys(spec.programLineage).length === roles.length &&
        roles.every(k => plain(active.programLineage[k]) && hex(active.programLineage[k].sha256) && spec.programLineage[k] === active.programLineage[k].sha256), 'bridge_package_lineage_mismatch');
      // owned-stop-source-closure-v2 is shared with the request component.
      // Every role is verified and charged, including roles sharing one path.
      // This full closure read stays in explicit refresh, outside sync polling.
      let sourceBytes = 0;
      for (const role of roles) {
        const source = active.programLineage[role], data = bytes(source.path);
        sourceBytes += data.length;
        need(sourceBytes <= SOURCE_LIMITS.sourceTotalBytes, 'bridge_source_budget');
        need(hash(data) === source.sha256, 'bridge_source_sha_mismatch');
        fresh(start, maximumRefreshMs, 'bridge_refresh_timeout');
      }
      const binding = { registrySha256: result.registrySha256, registryRevision: registry.registryRevision, capabilityVersion: active.capabilityVersion, lock: { ...active.lock }, heartbeat: { ...active.heartbeat } };
      verifyFiles(binding);
      need(sameCall(retained, call()), 'bridge_retained_call_changed');
      fresh(start, maximumRefreshMs, 'bridge_refresh_timeout');
      // Mint snapshot age only after final actual files, root and retained-call checks.
      const validatedAt = time();
      snapshot = { start: validatedAt, retained, binding };
      lastError = null;
      return { ok: true, status: 'fresh', registryRevision: binding.registryRevision, maximumAgeMs, productionEligible: false };
    } catch (error) {
      const code = String(error.message ?? error).slice(0, 256);
      // An old result must neither resurrect stale state nor erase a newer snapshot.
      if (mine === generation) clear(code);
      return { ok: false, status: 'unavailable', errorCode: code, productionEligible: false };
    } finally { clearTimeout(timeout); if (!readerTracked) pending--; }
  }
  function current() {
    // A sync poll during refresh denies but does not cancel that refresh.
    if (snapshot === null) return null;
    try {
      fresh(snapshot.start);
      need(sameCall(snapshot.retained, call()), 'bridge_retained_call_changed');
      // Bounded exact files only; no directory scan, process probe or async reader.
      verifyFiles(snapshot.binding);
      fresh(snapshot.start);
      return snapshot;
    } catch (error) { ++generation; clear(error.message ?? error); return null; }
  }
  return Object.freeze({ refresh,
    readCurrentExecution: () => { const s = current(); return s ? { registryPath: CURRENT_EXECUTION_REGISTRY_PATH, registrySha256: s.binding.registrySha256 } : null; },
    readRetainedNativeCall: () => { const s = current(); return s ? { ...s.retained.identity } : null; },
    invalidate: () => { ++generation; clear('bridge_explicitly_invalidated'); },
    inspect: () => ({ status: snapshot ? 'snapshot_cached_not_live_proof' : 'unavailable', pendingRefreshes: pending, lastError, maximumAgeMs, maximumRefreshMs, readerTrust, productionEligible: false, cleanupConfirmed: false, executionStopped: false, checkpointSaved: false }),
  });
}
export function createOwnedStopExecutionBridge(options = {}) {
  need(Object.keys(options).every(k => ['projectRoot', 'expectedContext', 'readRetainedNativeCall', 'maximumAgeMs', 'maximumRefreshMs'].includes(k)), 'bridge_option_not_allowed');
  const readConfiguredMapping = root => {
    if (path.relative(path.resolve(root), configuredProjectRoot) !== '') return null;
    need(process.env.AI_PET_WORLD_DATA_ROOT === storageEnvironmentAtImport, 'bridge_storage_configuration_changed');
    return { projectRoot: configuredProjectRoot, physicalRuntimeRoot: configuredPhysicalRuntimeRoot };
  };
  return core(options, readCurrentExecutionRegistry, Date.now, () => performance.now(), 'official_reader', readConfiguredMapping);
}
// Explicit unverified fixture seam; never describe injected results as official.
export function createOwnedStopExecutionBridgeForIsolatedTests(options, { reader, wallNow, monotonicNow, readRuntimeMapping = () => null }) {
  need(typeof reader === 'function' && typeof wallNow === 'function' && typeof monotonicNow === 'function', 'bridge_test_dependencies_invalid');
  need(typeof readRuntimeMapping === 'function', 'bridge_test_mapping_invalid');
  return core(options, reader, wallNow, monotonicNow, 'unverified_isolated_test_reader', readRuntimeMapping);
}
