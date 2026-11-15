// Test-only historical input tree. Restored source bytes are never imported or executed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {catalogPath} from '../../lib/ai-pet-world-storage.mjs';
import {PREDECESSOR_MANIFEST, PREDECESSOR_V2_MANIFEST, PREDECESSOR_V2_CLAIM,
  HISTORICAL_REGISTRY_OBSERVATION} from '../../run-ai-painter-mvp256-dry-v27-training.mjs';

const PINNED_REVISION = '6131acbb46574f67cfc688ecfd9b5c5fcf106ba7';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const MAX_BYTES = 64 * 1024 * 1024;


export function historicalV27PolicyFixture(t, sourceRoot) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v27-policy-history-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('v27-policy-history-'));
    fs.rmSync(root, {recursive: true});
  });
  const catalog = new DatabaseSync(catalogPath, {readOnly: true});
  t.after(() => catalog.close());
  const copied = new Map();
  let totalBytes = 0;
  function copyBound(binding) {
    const logical = binding.path;
    assert.equal(typeof logical, 'string');
    assert(!path.isAbsolute(logical) && !logical.includes('\\') && !logical.includes(':'));
    assert(logical.split('/').every(part => part && part !== '.' && part !== '..'));
    assert.match(binding.sha256, /^[a-f0-9]{64}$/u);
    const target = path.resolve(root, logical);
    assert(target.startsWith(root + path.sep));
    if (copied.has(logical)) {
      assert.equal(copied.get(logical).sha256, binding.sha256, 'conflicting historical bytes: ' + logical);
      return fs.readFileSync(target);
    }
    const original = path.resolve(sourceRoot, logical);
    let bytes, origin = 'working_source';
    if (fs.existsSync(original)) {
      assert(fs.statSync(original).size <= MAX_BYTES, 'oversized fixture input');
      bytes = fs.readFileSync(original);
    }
    if (!bytes || digest(bytes) !== binding.sha256) {
      // Never guess another runtime event or fetch missing history from the network.
      assert(/^(?:scripts|src|ml|data|docs)\//u.test(logical), 'historical runtime bytes unavailable: ' + logical);
      const archived = catalog.prepare("SELECT physical_uri FROM artifacts WHERE sha256 = ? AND storage_layer = 'cold' ORDER BY logical_path LIMIT 1").get(binding.sha256);
      if (archived) {
        const archivePath = fs.realpathSync(archived.physical_uri);
        assert(fs.statSync(archivePath).isFile(), 'archive must be a regular file');
        assert(fs.statSync(archivePath).size <= MAX_BYTES, 'oversized archived input');
        bytes = fs.readFileSync(archivePath);
        origin = 'verified_cold_archive';
      } else {
      bytes = execFileSync('git', ['show', `${PINNED_REVISION}:${logical}`], {
        cwd: sourceRoot, windowsHide: true, timeout: 10000, maxBuffer: MAX_BYTES,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0'},
      });
      origin = 'pinned_local_git';
      }
    }
    assert.equal(digest(bytes), binding.sha256, 'historical fixture SHA mismatch: ' + logical);
    totalBytes += bytes.length;
    assert(totalBytes <= MAX_BYTES, 'historical fixture total size exceeded');
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes, {flag: 'wx'});
    copied.set(logical, {path: logical, sha256: binding.sha256, bytes: bytes.length, origin});
    return bytes;
  }
  const load = binding => JSON.parse(copyBound(binding));
  function copyReferences(value, remap) {
    if (Array.isArray(value)) return value.forEach(item => copyReferences(item, remap));
    if (!value || typeof value !== 'object') return;
    if (typeof value.path === 'string' && typeof value.sha256 === 'string') {
      const observation = HISTORICAL_REGISTRY_OBSERVATION;
      if (value.path === observation.observed.path && value.sha256 === observation.observed.sha256) {
        for (const key of ['transaction', 'snapshot', 'event']) copyBound(observation[key]);
        return;
      }
      const binding = remap.get(value.path) ?? {path: value.path, sha256: value.sha256};
      assert.equal(binding.sha256, value.sha256, 'historical remapping must preserve SHA');
      copyBound(binding);
    }
    Object.values(value).forEach(item => copyReferences(item, remap));
  }
  for (const manifestBinding of [PREDECESSOR_MANIFEST, PREDECESSOR_V2_MANIFEST]) {
    const manifest = load(manifestBinding), remap = new Map();
    for (const row of manifest.sources) {
      copyBound(row.snapshot);
      assert(!remap.has(row.originalPath));
      remap.set(row.originalPath, row.snapshot);
    }
    const policy = load(manifest.predecessorPolicy), cpu = load(manifest.predecessorCpuAcceptance);
    const failure = load(manifest.predecessorFailure);
    const records = [policy, cpu, failure];
    if (manifestBinding === PREDECESSOR_MANIFEST) {
      records.push(load(manifest.predecessorClaim), load(manifest.predecessorExecutionPackage));
    } else records.push(load(cpu.claim), load(PREDECESSOR_V2_CLAIM), load(failure.executionPackage));
    records.forEach(record => copyReferences(record, remap));
  }
  const numericRoot = '.runtime/ai-painter/stage4-mvp256-dry-v27-v3-cpu/';
  const acceptance = load({path: numericRoot + 'controller-acceptance.json',
    sha256: '8de54d9a2b4c3b2b053ddfe3511642de70b79b0cfb6db690484df706b272415e'});
  const records = [acceptance, load(acceptance.report), load(acceptance.contract), load(acceptance.claim)];
  const remap = new Map([
    ['docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md', acceptance.checkedFormalSpecificationSnapshot],
    ['docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md', acceptance.checkedExecutionGuideSnapshot],
  ]);
  records.forEach(record => copyReferences(record, remap));
  for (const logical of ['data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json',
    'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',
    'docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md']) {
    copyBound({path: logical, sha256: digest(fs.readFileSync(path.join(sourceRoot, logical)))});
  }
  return {root, bindings: [...copied.values()], totalBytes, pinnedRevision: PINNED_REVISION};
}
