import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import childProcess from 'node:child_process';
import test from 'node:test';
import { buildConditionCompilerLineageCandidate, verifyConditionCompilerLineageCandidate } from '../lib/ai-painter-stage4-condition-compiler-lineage.mjs';

const PROJECT = fileURLToPath(new URL('../../', import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const baseline = buildConditionCompilerLineageCandidate(PROJECT);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage4-compiler-lineage-test-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('stage4-compiler-lineage-test-'));
    fs.rmSync(resolved, {recursive: true});
  });
  for (const b of [baseline.parentCapability, ...Object.values(baseline.effectiveProgramBindings), ...baseline.evaluatorBindings]) {
    const target = path.join(root, b.path);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.copyFileSync(path.join(PROJECT, b.path), target);
  }
  const save = candidate => {
    const bytes = Buffer.from(JSON.stringify(candidate));
    fs.writeFileSync(path.join(root, 'candidate.json'), bytes);
    return {path: 'candidate.json', sha256: sha(bytes)};
  };
  return {root, save};
}

test('successor identity binds compiler AND imported raster, preserving the other 17 programs', () => {
  const first = buildConditionCompilerLineageCandidate(PROJECT);
  assert.deepEqual(first, baseline);
  assert.equal(Object.keys(first.effectiveProgramBindings).length, 19);
  assert.equal(first.status, 'inactive_program_binding_candidate_not_execution_qualified');
  for (const allowed of Object.values(first.qualification)) assert.equal(allowed, false);
  assert.deepEqual(first.dependencyEdges, [{from: 'conditionCompiler', to: 'conditionRaster',
    importedSymbols: ['rasterizePolygons', 'rasterizeFootprints', 'fillBounds']}]);
  assert.notEqual(first.effectiveProgramBindings.conditionCompiler.sha256, first.replacedHistoricalBinding.sha256);
});

test('explicit candidate bytes reproduce, without current-registry or dataset access', t => {
  const f = fixture(t), binding = f.save(baseline);
  // This isolated root has neither datasets, checkpoints nor a current registry.
  assert.deepEqual(verifyConditionCompilerLineageCandidate(f.root, binding), baseline);
});

for (const [name, mutate] of [
  ['raster omitted', c => {delete c.effectiveProgramBindings.conditionRaster;}],
  ['dependency edge omitted', c => {c.dependencyEdges = [];}],
  ['invented candidate ID', c => {c.candidateId += '-forged';}],
  ['training grant', c => {c.qualification.trainingAllowed = true;}],
  ['GPU grant', c => {c.qualification.gpuAllowed = true;}],
  ['parent qualification inheritance', c => {c.qualification.inheritedParentQualification = true;}],
  ['dispatch entry injection', c => {c.entrypointId = 'run-training';}],
]) test(`rejects a self-consistent file hash with ${name}`, t => {
  const f = fixture(t), candidate = structuredClone(baseline);
  mutate(candidate);
  assert.throws(() => verifyConditionCompilerLineageCandidate(f.root, f.save(candidate)), /does not reproduce/);
});

for (const role of ['conditionCompiler', 'conditionRaster', 'trainer']) {
  test(`rejects actual ${role} byte changes rather than automatically rebinding`, t => {
    const f = fixture(t), target = path.join(f.root, baseline.effectiveProgramBindings[role].path);
    fs.appendFileSync(target, '\n// changed\n');
    assert.throws(() => buildConditionCompilerLineageCandidate(f.root), /SHA mismatch/);
    const forged = structuredClone(baseline);
    forged.effectiveProgramBindings[role].sha256 = sha(fs.readFileSync(target));
    assert.throws(() => verifyConditionCompilerLineageCandidate(f.root, f.save(forged)), /SHA mismatch/);
  });
}

test('explicit candidate file hash is checked', t => {
  const f = fixture(t), binding = f.save(baseline);
  fs.appendFileSync(path.join(f.root, binding.path), ' ');
  assert.throws(() => verifyConditionCompilerLineageCandidate(f.root, binding), /SHA mismatch/);
});

test('read-only builder and verifier never write or dispatch', t => {
  const f = fixture(t), binding = f.save(baseline), restore = [];
  for (const key of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'rmSync']) {
    const original = fs[key];
    fs[key] = () => {throw new Error(`forbidden write: ${key}`);};
    restore.push(() => {fs[key] = original;});
  }
  for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
    const original = childProcess[key];
    childProcess[key] = () => {throw new Error(`forbidden dispatch: ${key}`);};
    restore.push(() => {childProcess[key] = original;});
  }
  try {assert.deepEqual(verifyConditionCompilerLineageCandidate(f.root, binding), baseline);}
  finally {restore.reverse().forEach(f => f());}
});
