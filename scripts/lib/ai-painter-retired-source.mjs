import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {coldRunsRoot} from './ai-pet-world-storage.mjs';

const registryPath = 'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json';
const indexPath = 'data/ai-painter/system-governance/ai-painter-retired-entrypoint-index-v1.json';
export const retiredSourceManifestPath = 'data/ai-painter/system-governance/ai-painter-retired-source-archive-v1.json';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const maxBytes = 2 * 1024 * 1024;

function regularBytes(file, boundary) {
  const relative = path.relative(fs.realpathSync(boundary), fs.realpathSync(file));
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'historical source escapes storage boundary');
  const stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maxBytes, 'historical source must be a bounded regular file');
  return fs.readFileSync(file);
}

export function readRetiredSourceIndex(root) {
  const registry = JSON.parse(regularBytes(path.join(root, registryPath), root));
  assert.equal(registry.retiredEntrypointIndex?.path, indexPath);
  assert.equal(registry.retiredEntrypointIndex.dispatchable, false);
  const bytes = regularBytes(path.join(root, indexPath), root);
  assert.equal(digest(bytes), registry.retiredEntrypointIndex.sha256, 'retired index SHA mismatch');
  const index = JSON.parse(bytes);
  assert.equal(index.schemaVersion, 'ai-painter-retired-entrypoint-index-v1');
  assert.equal(index.dispatchable, false);
  assert.equal(index.resolverMaySchedule, false);
  const seen = new Set();
  for (const entry of index.retiredEntrypoints) {
    assert.match(entry.entryFile, /^scripts\/[a-z0-9-]+\.mjs$/u);
    assert.match(entry.sourceSha256, /^[a-f0-9]{64}$/u);
    assert.equal(entry.retirementDisposition, 'read_only_audit_not_dispatchable');
    assert(!seen.has(entry.entryFile), 'duplicate retired source');
    seen.add(entry.entryFile);
  }
  return {index, sha256: digest(bytes)};
}

export function retiredSourceStub(entry) {
  return `// Retired entrypoint. Original bytes are available only to SHA-verified historical audit.\nthrow Object.assign(new Error(${JSON.stringify('Retired entrypoint; execution denied: ' + entry.packageScript)}), {code: 'ERR_RETIRED_ENTRYPOINT'});\n`;
}

function localGit(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], {
    windowsHide: true, timeout: 10000, maxBuffer: maxBytes,
    env: {...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0'},
  });
  assert(!result.error && result.status === 0, 'historical source unavailable in local Git; no network recovery is attempted');
  return result.stdout;
}

// Returns bytes only; never imports, evaluates, restores or schedules historical code.
export function readRetiredSource(root, entryFile, {coldRoot = coldRunsRoot} = {}) {
  const {index, sha256: indexSha256} = readRetiredSourceIndex(root);
  const entry = index.retiredEntrypoints.find(item => item.entryFile === entryFile);
  assert(entry, 'source is not registered as retired');
  const workingBytes = regularBytes(path.join(root, entryFile), root);
  if (digest(workingBytes) === entry.sourceSha256) {
    return {bytes: workingBytes, sha256: entry.sourceSha256, origin: 'original_worktree', physicallyArchived: false};
  }
  assert.equal(workingBytes.toString('utf8'), retiredSourceStub(entry), 'retired source is neither original nor exact retirement stub');
  const manifest = JSON.parse(regularBytes(path.join(root, retiredSourceManifestPath), root));
  assert.equal(manifest.schemaVersion, 'ai-painter-retired-source-archive-v1');
  assert.equal(manifest.retiredIndexSha256, indexSha256);
  assert.equal(manifest.dispatchable, false);
  assert.equal(manifest.entries.length, index.retiredEntrypoints.length);
  const manifestPaths = new Set();
  for (const item of manifest.entries) {
    assert(!manifestPaths.has(item.entryFile), 'duplicate archived source');
    manifestPaths.add(item.entryFile);
    const expected = index.retiredEntrypoints.find(row => row.entryFile === item.entryFile);
    assert(expected && expected.sourceSha256 === item.sourceSha256, 'archive identity differs from frozen index');
    assert.match(item.gitCommit, /^[a-f0-9]{40}$/u);
    assert.match(item.gitBlob, /^[a-f0-9]{40}$/u);
  }
  const record = manifest.entries.find(item => item.entryFile === entryFile);
  const archive = path.join(coldRoot, 'retired-entrypoints-' + indexSha256, entryFile);
  // Existing but corrupt archives must fail, not be hidden by another fallback.
  let archivePresent;
  try {
    fs.lstatSync(archive);
    archivePresent = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    archivePresent = false;
  }
  if (archivePresent) {
    const bytes = regularBytes(archive, coldRoot);
    assert.equal(digest(bytes), entry.sourceSha256, 'archived source SHA mismatch');
    return {bytes, sha256: entry.sourceSha256, origin: 'cold_archive', physicallyArchived: true};
  }
  assert.equal(localGit(root, ['rev-parse', '--verify', `${record.gitCommit}:${entryFile}`]).toString('utf8').trim(), record.gitBlob, 'historical Git commit/blob mismatch');
  const bytes = localGit(root, ['cat-file', 'blob', record.gitBlob]);
  assert.equal(digest(bytes), entry.sourceSha256, 'historical Git source SHA mismatch');
  return {bytes, sha256: entry.sourceSha256, origin: 'local_git', physicallyArchived: null};
}

export function readAuditableSource(root, relative) {
  const {index} = readRetiredSourceIndex(root);
  return index.retiredEntrypoints.some(entry => entry.entryFile === relative)
    ? readRetiredSource(root, relative).bytes.toString('utf8')
    : regularBytes(path.resolve(root, relative), root).toString('utf8');
}
