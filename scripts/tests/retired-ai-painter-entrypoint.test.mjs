import test from 'node:test';
import {readRetiredSource} from '../lib/ai-painter-retired-source.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {readRetiredEntrypointNotice} from '../retired-ai-painter-entrypoint.mjs';
import {retiredEntrypointCommand, verifyRetiredCommandExposure} from '../lib/ai-painter-current-entrypoint-command.mjs';
import {verifyStage4CoreRetiredBoundary} from '../check-ai-painter-stage4-core.mjs';

const registryPath = 'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

test('Stage4 nested check inventory cannot dispatch retired entrypoints', () => {
  assert.equal(verifyStage4CoreRetiredBoundary(process.cwd()), true);
  const registry = read(registryPath), entries = read(registry.retiredEntrypointIndex.path).retiredEntrypoints;
  for (const entry of entries) assert.throws(() => verifyStage4CoreRetiredBoundary(process.cwd(), [
    ['private-retired-regression', process.execPath, [entry.entryFile]],
  ]), /undeclared retired source reference/u);
});

test('new aliases cannot bypass retirement through literal source references', () => {
  const registry = read(registryPath), entries = read(registry.retiredEntrypointIndex.path).retiredEntrypoints;
  const scripts = read('package.json').scripts;
  assert.equal(verifyRetiredCommandExposure(scripts, entries).length, 0);
  const target = entries.find(entry => entry.entryFile.includes('controlled-smoke')).entryFile;
  for (const command of [
    `node ${target}`, `node "${target}"`, `node '${target}'`,
    `node ${target.replaceAll('/', '\\')}`, `node ${target.toUpperCase()}`,
    `node ${target} --force`, `echo ready && node ${target}`,
    `cd scripts && node ${target.split('/').at(-1)}`, `node F:\\ai-pet-world\\${target.replaceAll('/', '\\')}`,
    `node -e "import('./${target}')"`,
  ]) {
    assert.throws(() => verifyRetiredCommandExposure({...scripts, 'run:accidental-old-alias': command}, entries), /undeclared retired source reference/u);
  }
  const gate = 'check:ai-painter-contract-semantic-alignment';
  const historical = 'node scripts/check-ai-painter-stage4-bounded-candidate-planner.mjs';
  for (const replacement of [historical, historical + ' --force', historical + ' ; node other.mjs', historical + ' && ' + historical]) {
    assert.throws(() => verifyRetiredCommandExposure({...scripts, [gate]: scripts[gate] + ' && ' + replacement}, entries), /undeclared retired source reference/u);
  }
  assert.equal(scripts[gate].split(' && ').filter(command => command === 'node --test scripts/tests/stage4-historical-contracts.test.mjs').length, 1, 'historical CPU coverage must remain in the composite gate');
});

test('all 42 retired npm commands deny execution while retaining original source hashes', () => {
  const registry = read(registryPath), index = read(registry.retiredEntrypointIndex.path), pkg = read('package.json');
  assert.equal(index.retiredEntrypoints.length, 42);
  for (const entry of index.retiredEntrypoints) {
    assert.equal(pkg.scripts[entry.packageScript], retiredEntrypointCommand(entry.packageScript));
    assert.equal(Object.hasOwn(pkg.scripts, 'pre' + entry.packageScript), false);
    assert.equal(Object.hasOwn(pkg.scripts, 'post' + entry.packageScript), false);
    assert.equal(readRetiredSource(process.cwd(), entry.entryFile).sha256, entry.sourceSha256);
    const result = spawnSync(process.execPath, ['scripts/retired-ai-painter-entrypoint.mjs', entry.packageScript], {
      cwd: process.cwd(), windowsHide: true, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 2, entry.packageScript + result.stderr);
    assert.equal(result.stdout, '');
    const notice = JSON.parse(result.stderr);
    assert.equal(notice.status, 'retired_command_disabled');
    assert.equal(notice.executionStarted, false);
    assert.equal(notice.passed, false);
    assert.equal(notice.historicalSource.archiveVerification, 'not_performed_by_metadata_notice');
    assert.equal(notice.historicalSource.sha256, entry.sourceSha256);
  }
});

test('retirement lookup rejects tampering, active entries and invalid index permissions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retired-entry-notice-'));
  const originalRegistry = read(registryPath), originalIndex = read(originalRegistry.retiredEntrypointIndex.path);
  const key = originalIndex.retiredEntrypoints[0].packageScript;
  function fixture(alterRegistry = () => {}, alterIndex = () => {}) {
    const registry = structuredClone(originalRegistry), index = structuredClone(originalIndex);
    alterIndex(index);
    const bytes = Buffer.from(JSON.stringify(index));
    registry.retiredEntrypointIndex.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    alterRegistry(registry);
    fs.mkdirSync(path.dirname(path.join(root, registryPath)), {recursive: true});
    fs.writeFileSync(path.join(root, originalRegistry.retiredEntrypointIndex.path), bytes);
    fs.writeFileSync(path.join(root, registryPath), JSON.stringify(registry));
  }
  try {
    fixture();
    // No historical source exists in this fixture: notice generation must not load it.
    assert.equal(readRetiredEntrypointNotice(root, key).executionStarted, false);
    assert.throws(() => readRetiredEntrypointNotice(root, 'run:unregistered'), /missing or duplicated/u);
    fixture(r => { r.retiredEntrypointIndex.sha256 = '0'.repeat(64); });
    assert.throws(() => readRetiredEntrypointNotice(root, key), /SHA mismatch/u);
    fixture(r => { r.currentEntrypoints.push({packageScript: key}); });
    assert.throws(() => readRetiredEntrypointNotice(root, key), /remains current/u);
    fixture(() => {}, i => { i.resolverMaySchedule = true; });
    assert.throws(() => readRetiredEntrypointNotice(root, key));
    fixture(() => {}, i => { i.retiredEntrypoints.push(i.retiredEntrypoints[0]); });
    assert.throws(() => readRetiredEntrypointNotice(root, key), /missing or duplicated/u);
    fixture(r => { r.retiredEntrypointIndex.path = '../../outside.json'; });
    assert.throws(() => readRetiredEntrypointNotice(root, key));
  } finally {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, {recursive: true});
  }
});

test('retired command rejects extra arguments and shell-like identifiers without fallback execution', () => {
  assert.throws(() => retiredEntrypointCommand('run:old && node other.mjs'));
  const result = spawnSync(process.execPath, ['scripts/retired-ai-painter-entrypoint.mjs', 'run:old', '--force'], {
    cwd: process.cwd(), windowsHide: true, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  const notice = JSON.parse(result.stderr);
  assert.equal(notice.status, 'retired_command_metadata_rejected');
  assert.equal(notice.executionStarted, false);
});
