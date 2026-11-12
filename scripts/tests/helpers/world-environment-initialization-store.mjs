// CPU-only synthetic Store fixture and independent-process readback. Historical actual-run tooling remains unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
export const ROOT = fs.realpathSync(process.cwd());
export const BASE = '.runtime/ai-painter/controller-repair-reviews/world-environment-initialization-tests';
export const SELF = 'scripts/tests/helpers/world-environment-initialization-store.mjs';
const IDS = ['ownerId', 'playerId', 'worldId', 'worldSeed', 'worldProfileId', 'regionId'];
const FIELDS = ['PRECTOTCORR', 'RH2M', 'T2M', 'WS2M'], UNITS = ['mm/day', '%', 'C', 'm/s'];
const sha = b => createHash('sha256').update(b).digest('hex');
export const canonical = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
export const digest = v => sha(canonical(v));
const equal = (a, b) => canonical(a) === canonical(b), need = (ok, why) => { if (!ok)
    throw Error('initialization_store_' + why); };
const encoded = v => Buffer.from(JSON.stringify(v, null, 2) + '\n');
export const idOf = r => Object.fromEntries(IDS.map(k => [k, r[k]]));
function safe(logical) { need(typeof logical === 'string' && !/[\\:\0]/.test(logical) && logical.split('/').every(p => p && p !== '.' && p !== '..'), 'path'); let cursor = logical.startsWith('.runtime/') ? fs.realpathSync(path.join(ROOT, '.runtime')) : ROOT; for (const p of (logical.startsWith('.runtime/') ? logical.slice(9) : logical).split('/')) {
    cursor = path.join(cursor, p);
    if (fs.existsSync(cursor))
        need(!fs.lstatSync(cursor).isSymbolicLink() && path.resolve(fs.realpathSync(cursor)).toLowerCase() === path.resolve(cursor).toLowerCase(), 'link');
} return cursor; }
export function read(logical, max = 4 * 1024 * 1024) { const file = safe(logical), fd = fs.openSync(file, 'r'); try {
    const a = fs.fstatSync(fd);
    need(a.isFile() && a.nlink === 1 && a.size > 0 && a.size <= max, 'file');
    const bytes = fs.readFileSync(fd), b = fs.fstatSync(fd);
    need(a.size === b.size && a.mtimeMs === b.mtimeMs && a.ino === b.ino && bytes.length === a.size, 'changed');
    return bytes;
}
finally {
    fs.closeSync(fd);
} }
export const binding = p => { const b = read(p); return { path: p, sha256: sha(b), bytes: b.length }; };
export const bound = r => { const b = read(r.path); need(sha(b) === r.sha256 && (r.bytes === undefined || r.bytes === b.length), 'source_binding'); return b; };
export function write(run, name, value) { need(/^[a-z][a-z0-9.-]*\.json$/.test(name), 'name'); const logical = run + '/' + name, b = encoded(value), fd = fs.openSync(safe(logical), 'wx'); try {
    fs.writeFileSync(fd, b);
    fs.fsyncSync(fd);
}
finally {
    fs.closeSync(fd);
} return binding(logical); }
export function privateRun(run) { need(new RegExp('^' + BASE.replaceAll('.', '\\.') + '/integration/test-[a-f0-9]{32}$').test(run), 'private_run'); return safe(run); }
export function unchangedDomain(r) { const environment = structuredClone(r.worldState.payload.environment); delete environment.evolution; return { facts: r.worldFacts.payload, environment, objects: r.worldState.payload.objects, resources: r.worldState.payload.resources, randomState: r.randomState, ruleVersion: r.ruleVersion, sourceBindings: r.sourceBindings }; }
export function cloneRecord(original, token) {
    need(/^[a-f0-9]{32}$/.test(token) && original.tick === 0 && original.stateVersion === 0 && original.eventCursor === 0 && !Object.hasOwn(original.worldState.payload.environment, 'evolution'), 'already_initialized');
    const record = structuredClone(original), identity = Object.fromEntries(IDS.map(k => [k, 'initialization163-' + k.toLowerCase() + '-' + token]));
    Object.assign(record, identity);
    for (const key of ['worldFactsPayloadSha256', 'statePayloadSha256', 'recordContentSha256'])
        delete record[key];
    for (const key of ['worldFacts', 'worldState']) {
        record[key].worldId = identity.worldId;
        record[key].regionId = identity.regionId;
    }
    record.savedAt = new Date().toISOString();
    need(equal(unchangedDomain(record), unchangedDomain(original)), 'clone_domain');
    return record;
}
export async function runtime() { return (await import(pathToFileURL(path.join(ROOT, 'scripts/lib/world-evolution-runtime-loader.mjs')).href)).loadLoopRuntime(ROOT); }
/** Normalized fields come only from the bound preparation; tests provide explicitly synthetic data. */
export function candidate(before, prepared, preparationRef, transaction, validationRef) {
    const old = before.record;
    need(old.tick === 0 && old.stateVersion === 0 && old.eventCursor === 0 && !Object.hasOwn(old.worldState.payload.environment, 'evolution'), 'already_initialized');
    need(IDS.every(k => old[k].startsWith('initialization163-')) && equal(prepared.fieldOrder, FIELDS) && equal(prepared.units, UNITS) && prepared.values.length === 4 && prepared.values.every(Number.isFinite), 'candidate_values');
    need(prepared.logicalEndUtc === '2020-01-08T00:00:00.000Z' && prepared.period.logicalStartUtc === '2020-01-07T00:00:00.000Z' && prepared.period.logicalEndUtc === prepared.logicalEndUtc && prepared.period.durationSeconds === 86400, 'historical_period');
    need(Array.isArray(prepared.externalInputRefs) && prepared.externalInputRefs.length > 0 && prepared.externalInputRefs.every(r => typeof r.id === 'string' && typeof r.version === 'string' && /^[a-f0-9]{64}$/.test(r.sha256)), 'external_input_refs');
    const next = structuredClone(old);
    for (const key of ['worldFactsPayloadSha256', 'statePayloadSha256', 'recordContentSha256'])
        delete next[key];
    next.stateVersion = 1;
    next.eventCursor = 1;
    next.savedAt = new Date().toISOString();
    need(prepared.environmentEvolution.logicalEndUtc === prepared.logicalEndUtc && equal(prepared.environmentEvolution.weather.values, prepared.values) && equal(prepared.environmentEvolution.weather.fieldOrder, FIELDS) && equal(prepared.environmentEvolution.weather.units, UNITS) && equal(prepared.environmentEvolution.weather.period, prepared.period) && prepared.environmentEvolution.weather.origin === 'simulated_archival_seed' && !Object.hasOwn(prepared.environmentEvolution, 'commit'), 'preparation_candidate');
    next.worldState.payload.environment.evolution = structuredClone(prepared.environmentEvolution);
    next.worldState.payload.environment.evolution.initialization.privateClone = { kind: 'private_clone_not_world_creation', preparationRef, sourceIdentity: prepared.sourceIdentity, externalContextDays: 7, worldLivedEvolutionEvents: 0, modelForwards: 0, modelExecuted: false, targetModelMeaning: 'Bound future target only; not consumed or published by this maintenance', productionReady: false, coldStartQualified: false };
    need(equal(unchangedDomain(old), unchangedDomain(next)), 'maintenance_domain');
    need(validationRef && typeof validationRef.path === 'string' && /^[a-f0-9]{64}$/.test(validationRef.sha256), 'validation_ref');
    const ref = (id, hash = preparationRef.sha256) => ({ id, version: 'private-component163-v1', sha256: hash }), identity = idOf(old), policyRef = ref('diagnostic-initialization-not-production-policy'), reason = preparationRef.sha256;
    const event = { schemaVersion: 'world-evolution-event-v1', identity, eventId: 'initialization163-maintenance', businessKey: '0'.repeat(64), cursor: 1, eventKind: 'maintenance', fromTick: 0, toTick: 0, fromStateVersion: 0, toStateVersion: 1, before: { expectedTick: 0, expectedStateVersion: 0, expectedFileSha256: before.fileSha256, worldFactsPayloadSha256: old.worldFactsPayloadSha256, statePayloadSha256: old.statePayloadSha256, recordContentSha256: old.recordContentSha256 }, interval: { logicalStartUtc: prepared.logicalEndUtc, logicalEndUtc: prepared.logicalEndUtc, durationSeconds: 0 }, policyRef, externalInputRefs: prepared.externalInputRefs, historyInputRef: ref('explicit-no-world-lived-evolution-history'), evidence: { kind: 'maintenance', maintenanceContext: { targetPolicyRef: policyRef, targetRuleVersion: old.ruleVersion, targetModelRef: prepared.targetModelRef, migrationEvidenceRef: ref(preparationRef.path), executorId: 'private-original-store-initialization163' }, migrationArtifactRef: ref(preparationRef.path), validationRef: ref(validationRef.path, validationRef.sha256) }, changes: [...FIELDS.map((field, i) => ({ fieldId: 'environment.' + field, operation: 'set', beforeValueSha256: digest({ status: 'unavailable', reason: 'environment_evolution_not_initialized' }), newValue: prepared.values[i], reasonRefs: [reason] })), { fieldId: 'environment.logicalEndUtc', operation: 'set', beforeValueSha256: digest({ status: 'unavailable', reason: 'logical_anchor_not_initialized' }), newValue: prepared.logicalEndUtc, reasonRefs: [reason] }], reasonRefs: [reason], previousEventSha256: null, domainAfterSha256: transaction.computeWorldEvolutionDomainSha(next) };
    event.businessKey = transaction.computeWorldEvolutionBusinessKey(event);
    const sealed = transaction.sealWorldEvolutionEvent(event);
    next.worldState.payload.environment.evolution.commit = { businessKey: sealed.businessKey, eventId: sealed.eventId, eventSha256: sealed.eventSha256, historyHead: { cursor: 1, eventSha256: sealed.eventSha256 } };
    return { record: next, event: sealed, expectedTick: 0, expectedStateVersion: 0, expectedFileSha256: before.fileSha256 };
}
export function checkBindings(manifest) { for (const ref of manifest.bindings)
    bound(ref); }
function budget(run) { let bytes = 0, count = 0; const visit = p => { for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const file = path.join(p, entry.name), s = fs.lstatSync(file);
    need(!s.isSymbolicLink(), 'artifact_link');
    if (s.isDirectory())
        visit(file);
    else {
        need(s.isFile() && s.nlink === 1 && ++count <= 100, 'artifact_files');
        bytes += s.size;
        need(bytes <= 16 * 1024 * 1024, 'artifact_bytes');
    }
} }; visit(privateRun(run)); return { bytes, files: count }; }
export async function independentReadback(run, manifestSha) {
    privateRun(run);
    const raw = read(run + '/manifest.json');
    need(sha(raw) === manifestSha, 'manifest');
    const manifest = JSON.parse(raw);
    need(manifest.run === run, 'manifest_run');
    checkBindings(manifest);
    const r = await runtime(), store = r.store.createProductionWorldRuntimeStore(path.join(privateRun(run), 'store')), record = await store.readNatural({ ownerId: manifest.identity.ownerId, worldId: manifest.identity.worldId, expectedPlayerId: manifest.identity.playerId }), input = JSON.parse(bound(manifest.candidateRef));
    need(record.status === 'found' && record.record.tick === 0 && record.record.stateVersion === 1 && record.record.eventCursor === 1 && equal(idOf(record.record), manifest.identity), 'readback_state');
    const original = JSON.parse(bound(manifest.originalRef));
    need(equal(unchangedDomain(record.record), unchangedDomain(original)), 'readback_domain');
    const event = await store.readNaturalTransition({ identity: manifest.identity, businessKey: input.event.businessKey });
    need(event.status === 'found' && equal(event.event, input.event) && event.receipt.fileSha256 === record.fileSha256, 'readback_event');
    need(equal(record.record.worldState.payload.environment.evolution.weather, input.record.worldState.payload.environment.evolution.weather), 'readback_weather');
    checkBindings(manifest);
    return { pid: process.pid, status: 'independent_original_store_readback_verified', identity: manifest.identity, tick: 0, stateVersion: 1, eventCursor: 1, fileSha256: record.fileSha256, eventSha256: event.event.eventSha256, receipt: event.receipt, weather: record.record.worldState.payload.environment.evolution.weather, unchangedDomainSha256: digest(unchangedDomain(record.record)), modelForwards: 0, formalWorldWrites: 0, productionReady: false };
}
export async function exercise({ run, original, prepared, preparation, bindings, actual = false }) {
    privateRun(run);
    need(actual === false, 'actual_scope');
    const began = performance.now(), token = randomUUID().replaceAll('-', ''), r = await runtime();
    fs.mkdirSync(privateRun(run));
    let manifest;
    try {
        need(equal(prepared.sourceIdentity, idOf(original)), 'source_world_identity');
        const preparationRef = write(run, 'preparation.json', preparation), originalRef = write(run, 'original.json', original), normalizedRef = write(run, 'normalized-candidate.json', prepared), initial = cloneRecord(original, token), identity = idOf(initial), store = r.store.createProductionWorldRuntimeStore(path.join(privateRun(run), 'store'));
        const fixedBindings = [...bindings, binding(SELF), preparationRef, originalRef, normalizedRef];
        manifest = { run, actual, identity, fixtureMeaning: 'Clone of fixed baseline, not world creation; maintenance initialization, not model evolution', bindings: fixedBindings, preparationRef, originalRef, normalizedRef };
        write(run, 'precommit-bindings.json', manifest);
        checkBindings(manifest);
        need(performance.now() - began < 180000, 'deadline');
        const first = await store.writeNatural({ record: initial, expectedTick: -1, expectedStateVersion: -1, expectedFileSha256: null });
        need(first.ok, 'private_clone');
        const before = await store.readNatural({ ownerId: identity.ownerId, worldId: identity.worldId, expectedPlayerId: identity.playerId });
        need(before.status === 'found', 'before_read');
        const validationRef = write(run, 'preparation-validation.json', { status: 'private_preparation_binding_and_uninitialized_clone_verified', preparationRef, originalRef, normalizedRef, sourceIdentityMatches: true, allBindingsRechecked: true, cloneNotCreation: true, tick: 0, stateVersion: 0, eventCursor: 0, modelExecuted: false, productionReady: false });
        fixedBindings.push(validationRef);
        const input = candidate(before, prepared, preparationRef, r.transaction, validationRef);
        manifest.candidateRef = write(run, 'candidate.json', input);
        const manifestRef = write(run, 'manifest.json', manifest);
        checkBindings(manifest);
        budget(run);
        need(performance.now() - began < 180000, 'deadline');
        const commit = await store.writeNaturalTransition(input);
        need(commit.ok && commit.receipt.tick === 0 && commit.receipt.stateVersion === 1 && commit.receipt.eventCursor === 1, 'maintenance_commit');
        write(run, 'commit.json', commit);
        const replay = await store.writeNaturalTransition(input);
        need(replay.ok && replay.replayed && equal(replay.receipt, commit.receipt), 'same_key_replay');
        write(run, 'replay.json', replay);
        const timeout = Math.min(60000, 180000 - (performance.now() - began));
        need(timeout > 0, 'deadline');
        const childStart = new Date().toISOString(), childBegan = performance.now(), child = spawnSync(process.execPath, [path.join(ROOT, SELF), '--readback', run, manifestRef.sha256], { cwd: ROOT, windowsHide: true, encoding: 'utf8', timeout, maxBuffer: 65536, env: { ...process.env, OMP_NUM_THREADS: '2', UV_THREADPOOL_SIZE: '2' } });
        write(run, 'readback-process.json', { pid: child.pid, exitCode: child.status, signal: child.signal, error: child.error?.message ?? null, startedAtUtc: childStart, finishedAtUtc: new Date().toISOString(), elapsedMs: performance.now() - childBegan, timeoutMs: timeout, stdout: child.stdout, stderr: child.stderr });
        need(child.status === 0 && !child.error && !child.signal, 'readback_process');
        const restored = JSON.parse(child.stdout);
        need(restored.pid === child.pid && restored.pid !== process.pid && restored.fileSha256 === commit.receipt.fileSha256, 'independent_pid');
        write(run, 'readback.json', restored);
        checkBindings(manifest);
        need(performance.now() - began < 180000, 'deadline');
        const artifact = budget(run);
        const result = { status: 'private_initialization_maintenance_verified', actual, pid: process.pid, run, identity, manifestRef, commit, replay, readback: restored, maintenanceEventCount: 1, evolutionEventCount: 0, externalContextDays: 7, externalContextOrigin: 'external_archival_context', modelForwards: 0, formalWorldWrites: 0, registryWrites: 0, productionReady: false, coldStartQualified: false, resourceUsage: process.resourceUsage(), elapsedMs: performance.now() - began, artifact };
        write(run, 'result.json', result);
        return { result, before, input, store, runtime: r, manifest };
    }
    catch (error) {
        write(run, 'failure.json', { status: 'failed_closed', error: error.message, atUtc: new Date().toISOString(), elapsedMs: performance.now() - began, modelForwards: 0, formalWorldWrites: 0 });
        throw error;
    }
}
export function prepareFixtureRoot() { fs.mkdirSync(path.join(ROOT, '.runtime'), { recursive: true }); fs.mkdirSync(safe(BASE + '/integration'), { recursive: true }); }
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    try {
        if (process.argv[2] === '--readback' && process.argv.length === 5)
            console.log(JSON.stringify(await independentReadback(process.argv[3], process.argv[4])));
        else
            throw Error('test_helper_readback_only');
    }
    catch (e) {
        console.error(JSON.stringify({ status: 'failed_closed', error: e.message, pid: process.pid }));
        process.exitCode = 1;
    }
}
