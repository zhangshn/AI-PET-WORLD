import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readRetiredSource, readRetiredSourceIndex, retiredSourceManifestPath, retiredSourceStub} from '../lib/ai-painter-retired-source.mjs';

const root = process.cwd();
const registryPath = 'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json';
const indexPath = 'data/ai-painter/system-governance/ai-painter-retired-entrypoint-index-v1.json';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'retired-source-audit-'));
  const {index, sha256} = readRetiredSourceIndex(root);
  for (const relative of [registryPath, indexPath, retiredSourceManifestPath, ...index.retiredEntrypoints.map(entry => entry.entryFile)]) {
    const destination = path.join(temporary, relative);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(path.join(root, relative), destination);
  }
  const coldRoot = path.join(temporary, 'cold');
  fs.mkdirSync(coldRoot);
  return {temporary, index, sha256, coldRoot};
}
function cleanup(temporary) {
  assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(os.tmpdir()));
  assert.match(path.basename(temporary), /^retired-source-audit-/u);
  fs.rmSync(temporary, {recursive: true});
}

test('all retired originals remain SHA-verifiable and direct entrypoints refuse execution', () => {
  const {index} = readRetiredSourceIndex(root);
  for (const entry of index.retiredEntrypoints) {
    const source = readRetiredSource(root, entry.entryFile);
    assert.equal(sha(source.bytes), entry.sourceSha256);
    assert.notEqual(source.origin, 'original_worktree');
    assert.equal(fs.readFileSync(entry.entryFile, 'utf8'), retiredSourceStub(entry));
    const result = spawnSync(process.execPath, [entry.entryFile], {cwd: root, windowsHide: true, encoding: 'utf8', timeout: 10000});
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ERR_RETIRED_ENTRYPOINT/u);
    assert.equal(result.stdout, '');
  }
});

test('modified working source, damaged archive and forged manifest fail closed', () => {
  const value = fixture(), {temporary, index, sha256, coldRoot} = value;
  const entry = index.retiredEntrypoints[0], working = path.join(temporary, entry.entryFile);
  const archive = path.join(coldRoot, 'retired-entrypoints-' + sha256, entry.entryFile);
  const original = readRetiredSource(root, entry.entryFile).bytes;
  const read = () => readRetiredSource(temporary, entry.entryFile, {coldRoot});
  try {
    fs.mkdirSync(path.dirname(archive), {recursive: true});
    fs.writeFileSync(archive, original);
    assert.equal(read().origin, 'cold_archive');
    fs.appendFileSync(working, '\n// unexpected change');
    assert.throws(read, /neither original nor exact/u);
    fs.writeFileSync(working, retiredSourceStub(entry));
    fs.writeFileSync(archive, 'corrupt');
    assert.throws(read, /archived source SHA mismatch/u);
    fs.writeFileSync(archive, original);
    const manifestFile = path.join(temporary, retiredSourceManifestPath);
    const originalManifest = fs.readFileSync(manifestFile);
    for (const alter of [
      m => { m.entries[0].entryFile = '../outside.mjs'; },
      m => { m.entries[0].sourceSha256 = '0'.repeat(64); },
      m => { m.entries[0].gitBlob = '--help'; },
      m => { m.entries[1] = m.entries[0]; },
      m => { m.dispatchable = true; },
    ]) {
      const manifest = JSON.parse(originalManifest);
      alter(manifest); fs.writeFileSync(manifestFile, JSON.stringify(manifest));
      assert.throws(read);
    }
    fs.writeFileSync(manifestFile, originalManifest);
    fs.unlinkSync(archive);
    assert.throws(read, /unavailable in local Git/u);
  } finally { cleanup(temporary); }
});

test('clean local Git checkout recovers every original without cold storage or executing source', () => {
  const {temporary, index, coldRoot} = fixture();
  try {
    // Copy only Git metadata/objects into the isolated fixture, without checkout or networking.
    const gitDirectory = path.join(temporary, 'offline-git');
    const clone = spawnSync('git', ['clone', '--bare', '--shared', '--no-hardlinks', root, gitDirectory], {
      windowsHide: true, encoding: 'utf8', timeout: 30000,
      env: {...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0'},
    });
    assert.equal(clone.status, 0, clone.stderr);
    fs.writeFileSync(path.join(temporary, '.git'), `gitdir: ${gitDirectory.replaceAll('\\', '/')}\n`);
    for (const entry of index.retiredEntrypoints) {
      const result = readRetiredSource(temporary, entry.entryFile, {coldRoot});
      assert.equal(result.origin, 'local_git');
      assert.equal(result.physicallyArchived, null);
      assert.equal(sha(result.bytes), entry.sourceSha256);
    }
  } finally { cleanup(temporary); }
});
