// 005 closes observation regressions using archived 004 bytes. No process launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {observeAffinity, readLifecycleTerminal, measure, SQLITE_SIDECAR_RESERVE} from './helpers/local-control-full-v2-004-observer.mjs';
import {OLD_ROOT, openArchive, sha, verifyBoundBytes, verifyCase, requireSameSources, verifyWireReceipt} from './helpers/local-control-full-v2-004-evidence.mjs';

function fakeIo(entries, options = {}) {
  return {
    readdirSync: () => entries.filter(([name]) => !options.unlisted?.includes(name)).map(([name]) => ({name})),
    lstatSync(file) {
      const name = path.basename(file), found = entries.find(([n]) => n === name);
      const code = options.errors?.[name] ?? (!found ? 'ENOENT' : null);
      if (code) throw Object.assign(Error(name + ': ' + code), {code});
      const [, size, properties = {}] = found;
      return {size, nlink: properties.nlink ?? 1, isFile: () => properties.kind !== 'directory', isDirectory: () => properties.kind === 'directory', isSymbolicLink: () => properties.symlink ?? false};
    }
  };
}
const proof = {ownerPid: 1234, bindingBase64: 'binding'};
test('affinity belongs to the bound observation; missing R-frame affinity is valid', () => {
  assert(!('ownerAffinityMask' in proof));
  assert.equal(observeAffinity(proof, {...proof, ownerAffinityMask: '3'}), '3');
});
test('R affinity cannot substitute for missing or wrong observation affinity or identity', () => {
  for (const observation of [{...proof}, {...proof, ownerAffinityMask: '1'}, {...proof, ownerAffinityMask: '3', ownerPid: 9999}, {...proof, ownerAffinityMask: '3', bindingBase64: 'other'}]) {
    assert.throws(() => observeAffinity({...proof, ownerAffinityMask: '3'}, observation));
  }
});
test('lifecycle reads only phase-terminal.json even when a misleading terminal.json exists', () => {
  const accessed = [];
  const result = readLifecycleTerminal('lifecycle', {readFileSync: file => {
    accessed.push(file); assert.equal(file, path.join('lifecycle', 'phase-terminal.json'));
    return Buffer.from('{"status":"failed_closed"}');
  }});
  assert.equal(result.status, 'failed_closed'); assert.equal(accessed.length, 1);
});
test('legacy terminal.json alone cannot satisfy lifecycle evidence', () => {
  assert.throws(() => readLifecycleTerminal('lifecycle', {readFileSync: file => {
    if (path.basename(file) === 'terminal.json') return Buffer.from('{"status":"completed"}');
    throw Object.assign(Error('phase terminal missing'), {code: 'ENOENT'});
  }}), {code: 'ENOENT'});
  assert.throws(() => readLifecycleTerminal('lifecycle', {readFileSync: () => Buffer.from('{')}), SyntaxError);
});
test('SQLite reserve is fixed conservative accounting for present or absent sidecars', () => {
  assert.equal(SQLITE_SIDECAR_RESERVE, 557056);
  for (const name of ['registry', 'execution']) {
    const core = [[name + '.sqlite', 4096]];
    assert.equal(measure('fixture', fakeIo(core)), 4096 + 557056);
    assert.equal(measure('fixture', fakeIo([...core, [name + '.sqlite-wal', 100], [name + '.sqlite-shm', 50]])), 4096 + 557056);
  }
});
test('exact SQLite sidecar deletion after enumeration retains the entire reserve', () => {
  for (const name of ['registry', 'execution']) for (const suffix of ['wal', 'shm']) {
    const entries = [[name + '.sqlite', 4096], [name + '.sqlite-' + suffix, 100]];
    assert.equal(measure('fixture', fakeIo(entries, {errors: {[name + '.sqlite-' + suffix]: 'ENOENT'}})), 4096 + 557056);
  }
});
test('ordinary disappearance and a similarly named non-core sidecar remain failures', () => {
  for (const name of ['report.json', 'other.sqlite-wal', 'registry.sqlite-journal']) {
    assert.throws(() => measure('fixture', fakeIo([['registry.sqlite', 4096], [name, 100]], {errors: {[name]: 'ENOENT'}})), {code: 'ENOENT'});
  }
});
test('missing core, denied sidecar, oversized sidecar, symlink and hardlink fail closed', () => {
  assert.throws(() => measure('fixture', fakeIo([['execution.sqlite-wal', 1]])), {code: 'ENOENT'});
  for (const suffix of ['wal', 'shm']) {
    const name = 'execution.sqlite-' + suffix;
    assert.throws(() => measure('fixture', fakeIo([['execution.sqlite', 1], [name, 1]], {errors: {[name]: 'EACCES'}})), {code: 'EACCES'});
    assert.throws(() => measure('fixture', fakeIo([['execution.sqlite', 1], [name, suffix === 'wal' ? 524289 : 32769]])));
    for (const properties of [{symlink: true}, {nlink: 2}, {kind: 'directory'}]) assert.throws(() => measure('fixture', fakeIo([['execution.sqlite', 1], [name, 1, properties]])));
  }
  for (const properties of [{symlink: true}, {nlink: 2}, {kind: 'directory'}]) {
    assert.throws(() => measure('fixture', fakeIo([['execution.sqlite', 1, properties], ['execution.sqlite-wal', 1]])));
  }
});
test('conservative reservation cannot turn an 8MiB boundary into a pass', () => {
  const bytes = measure('fixture', fakeIo([['registry.sqlite', 8388608 - SQLITE_SIDECAR_RESERVE]]));
  assert.equal(bytes, 8388608); assert.equal(bytes < 8388608, false);
});
test('evidence bytes reject both SHA and length changes', () => {
  const bytes = Buffer.from('original'), binding = {path: 'fixture', sha256: sha(bytes), bytes: bytes.length};
  assert.equal(verifyBoundBytes(bytes, binding), bytes);
  assert.throws(() => verifyBoundBytes(Buffer.from('changed!'), binding));
  assert.throws(() => verifyBoundBytes(bytes, {...binding, bytes: bytes.length + 1}));
});

const output = process.env.AI_PAINTER_FULL_V2_004_CLOSURE_EVIDENCE;
let archive, results = [], snapshots;
test('004 immutable delivery binds all old failure reports and all 483 archived files', () => {
  assert(output && path.isAbsolute(output)); assert(fs.statSync(output).isDirectory());
  snapshots = path.join(output, 'sqlite-snapshots'); assert(!fs.existsSync(snapshots));
  archive = openArchive();
  assert.equal(archive.manifest.archives.reduce((n, a) => n + a.files.length, 0), 483);
  assert.equal(archive.delivery.originalNodeSuiteStatus, 'failed_preserved');
  for (const sub of ['', 'attempt-2/', 'attempt-3/']) {
    const old = JSON.parse(fs.readFileSync(path.join(OLD_ROOT, sub, 'suite-result.json')));
    assert.notEqual(old.exitCode, 0);
  }
});
for (let index = 0; index < 4; index++) test('read-only archived business case ' + (index + 1), () => {
  assert(archive, 'archive verification must precede case reading');
  const expected = archive.delivery.cases[index], reader = archive.readers.get(expected.root);
  const prior = JSON.parse(fs.readFileSync(path.join(OLD_ROOT, 'business-evidence-readonly-verification.json'))).results.find(r => r.runId === expected.runId);
  assert(prior); results.push(verifyCase(reader, expected, prior, snapshots));
});
test('eight archived R frames still reject forged cleanup and truncated/duplicated streams', () => {
  assert.equal(results.length, 4);
  for (const result of results) {
    const expected = archive.delivery.cases.find(c => c.runId === result.runId), reader = archive.readers.get(expected.root);
    for (const row of result.receipts) {
      const receipt = reader.json(row.binding.path), wire = reader.read(row.frames.path).toString('ascii'), observation = reader.json(row.observation.path);
      assert.throws(() => verifyWireReceipt({...receipt, proof: {...receipt.proof, activeProcessesAfterCleanup: 1}}, wire, observation, result.mode));
      assert.throws(() => verifyWireReceipt({...receipt, ownerClosed: false}, wire, observation, result.mode));
      assert.throws(() => verifyWireReceipt(receipt, wire.split('\n').filter(s => !s.startsWith('R:')).join('\n'), observation, result.mode));
      assert.throws(() => verifyWireReceipt(receipt, wire + wire, observation, result.mode));
    }
  }
});
test('two source groups stay distinct; unchanged later normal/failure/stop share 28 bindings', () => {
  assert.equal(results.length, 4);
  assert.throws(() => requireSameSources(results[0].source, results[1].source));
  for (const result of results.slice(2)) requireSameSources(results[1].source, result.source);
  assert.deepEqual(results.slice(1).map(r => r.mode), ['normal', 'failure', 'stop']);
  assert.equal(new Set(results.map(r => r.sourceGroupSha256)).size, 2);
  assert.equal(new Set(results.map(r => r.runId)).size, 4);
  assert.equal(Object.keys(results[1].source).length, 28);
  const differences = Object.keys(results[0].source).filter(k => JSON.stringify(results[0].source[k]) !== JSON.stringify(results[1].source[k]));
  assert.equal(differences.length, 1);
  assert.equal(results[0].source[differences[0]].path, 'scripts/lib/ai-painter-decode1-entry-weight-quality-registration-v1.mjs');
});
test('all original reports and archive bytes remain unchanged after snapshot-only SQLite reads', () => {
  assert.equal(results.length, 4); archive.verifyAllUnchanged();
  const report = {taskId: 'MIGRATION-EVIDENCE-CLOSURE-005',recordedAtUtc: new Date().toISOString(), status: 'readonly_evidence_regression_passed', cases: results, archiveFiles: 483, archiveBytes: archive.manifest.archives.reduce((n,a) => n + a.archivedBytes, 0), nativeCallsReplayed: 0, originalDatabasesOpened: 0, sqliteInputPolicy: 'SHA-verified core and available WAL/SHM copied to fresh task snapshots; query-only read-only connection; no historical checkpoint', sourceGroups: 2, originalNodeSuites: 'failed_preserved', scope: {privateCpuControlChainOnly: true, productionAuthentication: false, physicalOffline: false, actualCodexClosure: false, fullNativeProductionTerminal: false, gpu: false, checkpoint: false, modelQualification: false}};
  fs.writeFileSync(path.join(output, 'readonly-regression.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
});
