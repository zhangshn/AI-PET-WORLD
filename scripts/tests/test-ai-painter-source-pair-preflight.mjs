import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CHANNEL_IDS, checkSourcePairPreflight, inspectSyntheticSourcePair } from '../lib/ai-painter-source-pair-preflight-v1.mjs';

// Persist fixtures as failure evidence. Opaque bytes exercise identities, not RGB semantics.
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(workspace, '.runtime/t-q9-01');
fs.mkdirSync(evidence, { recursive: true });
const suiteRoot = fs.mkdtempSync(path.join(evidence, 'synthetic-tests-'));
const hash = x => createHash('sha256').update(x).digest('hex');
let sequence = 0;
function fixture(options = {}) {
  const root = path.join(suiteRoot, String(++sequence));
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'SYNTHETIC-NOT-AN-ASSET'), 'source-pair-preflight synthetic fixture\n');
  function write(relative, value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, bytes);
    return { path: relative, sha256: hash(bytes) };
  }
  const slot = { slotId: 'synthetic-146', split: 'train', regionalLandscapeType: 'synthetic', monsoonSeason: 'synthetic', candidateId: 'synthetic', measurementFingerprint: 'synthetic' };
  const world = write('data/world.json', { worldFactSetId: 'synthetic-world', v7SlotBinding: { ...slot, ...options.worldSlot } });
  const geometry = { terrainRegions: [], walkableRegions: [], collisionRegions: [], objectFootprints: [] };
  const vfmPayload = { schemaVersion: 'synthetic-vfm' };
  const vfm = write('data/vfm.json', { ...vfmPayload, manifestSha256: hash(JSON.stringify(vfmPayload)) });
  const taskPayload = { taskId: 'synthetic-task', v7SlotBinding: slot, earthParameterSnapshotId: 'synthetic-world', spatialLayers: geometry,
    sourceBindings: { naturalizedWorldFactsPath: world.path, naturalizedWorldFactsSha256: world.sha256, visualFactManifestPath: vfm.path } };
  const taskHash = hash(JSON.stringify(taskPayload));
  const task = write('data/task.json', { ...taskPayload, taskSha256: taskHash });
  const conditionBytes = Buffer.from('SYNTHETIC OPAQUE CONDITION BYTES - NOT AN IMAGE');
  const channels = CHANNEL_IDS.map(id => ({ id, ...write(`data/channels/${id}.png`, conditionBytes) }));
  const packPayload = { conditionPackId: 'synthetic-pack', taskSha256: taskHash,
    visualFactManifestSha256: hash(JSON.stringify(vfmPayload)), sourceBindings: { taskPackagePath: task.path, visualFactManifestPath: vfm.path }, channels };
  const packHash = hash(JSON.stringify(packPayload));
  const pack = write('data/pack.json', { ...packPayload, conditionPackSha256: packHash });
  const blueprint = write('data/blueprint.json', { earthParameterSnapshotId: 'synthetic-world', earthParameterSnapshotPath: world.path, geometry });
  const guide = write('data/guide.png', Buffer.from('SYNTHETIC OPAQUE GUIDE'));
  const prompt = write('data/prompt.json', { sourceConditionBlueprintPath: blueprint.path, sourceConditionBlueprintSha256: blueprint.sha256,
    taskPackageId: 'synthetic-task', conditionPackId: 'synthetic-pack', conditionGuidePath: guide.path, conditionGuideSha256: guide.sha256 });
  const raw = write('data/raw.png', Buffer.from('SYNTHETIC OPAQUE SOURCE - NOT RGB'));
  const image = write('data/image.png', Buffer.from('SYNTHETIC OPAQUE DERIVATIVE - NOT RGB'));
  const binding = { taskId: 'synthetic-task', taskSha256: taskHash, taskPackagePath: task.path,
    conditionPackId: 'synthetic-pack', conditionPackPath: pack.path, conditionPackSha256: options.wrongCondition ? 'f'.repeat(64) : packHash,
    guidePath: guide.path, guideSha256: guide.sha256 };
  const norm = write('data/norm.json', { rawGeneratedImagePath: raw.path, rawGeneratedImageSha256: raw.sha256,
    normalizedImagePath: image.path, normalizedImageSha256: image.sha256, conditionBinding: binding });
  const review = write('data/review.json', { passed: !options.rejectedReview, semanticConditionAudit: { method: 'synthetic-historical-coarse', channelAudits: [{ channelId: 'terrain_path_ground', passed: !options.rejectedReview }] } });
  const contribution = write('data/contribution.json', { recordId: 'synthetic-pair', taskPackagePath: task.path, taskPackageSha256: task.sha256,
    conditionPackFileSha256: pack.sha256, imageSha256: image.sha256, machineReviewPath: review.path, machineReviewSha256: review.sha256 });
  const record = write('data/record.json', { recordId: options.mixedIdentity ? 'other-pair' : 'synthetic-pair', relativeDirectory: 'data',
    originalImage: { path: 'image.png', sha256: image.sha256 }, conditionBinding: binding,
    source: { normalizationManifestPath: norm.path, rawGeneratedImagePath: raw.path, rawGeneratedImageSha256: raw.sha256 },
    aiAssistedColdStart: { promptEvidencePath: prompt.path, promptEvidenceSha256: prompt.sha256, trainingDerivativePath: image.path, trainingDerivativeSha256: image.sha256 },
    copiedArtifacts: { conditions: [{ ...vfm, originalPath: vfm.path }], rights: [{ ...norm, originalPath: norm.path }] } });
  const pair = { sampleId: 'synthetic-pair', split: options.split ?? 'train', sourceRecord: record, contribution, conditionPack: pack, image };
  return { root, pair, write, check: extra => inspectSyntheticSourcePair({ projectRoot: root, pair, ...extra }) };
}
function blocked(result, decision, code) {
  assert.equal(result.decision, decision);
  assert.equal(result.blockUse, true);
  assert.equal(result.trainingEligible, false);
  assert.equal(result.formalQualification, false);
  if (code) assert.equal(result.issues[0].code, code);
}
test('consistent synthetic bindings never become real asset qualification', () => {
  const f = fixture(); const r = f.check();
  blocked(r, 'unresolved', 'ROAD_ALIGNMENT_UNRESOLVED');
  assert.equal(r.identityStatus, 'byte_bindings_and_pair_identity_verified');
  assert.equal(r.synthetic, true);
  assert.equal(r.scope.semanticAlignmentRecomputed, false);
});
test('same path source replacement is detected from bytes on the next call', () => {
  const f = fixture(); blocked(f.check(), 'unresolved');
  f.write('data/raw.png', Buffer.from('REPLACEMENT'));
  blocked(f.check(), 'rejected', 'BYTE_BINDING_MISMATCH');
});
test('wrong condition identity is rejected despite consistent outer file hashes', () => blocked(fixture({ wrongCondition: true }).check(), 'rejected', 'IDENTITY_MISMATCH'));
test('mixed record identity is rejected', () => blocked(fixture({ mixedIdentity: true }).check(), 'rejected', 'IDENTITY_MISMATCH'));
test('WorldFacts slot mismatch is rejected', () => blocked(fixture({ worldSlot: { slotId: 'other-slot' } }).check(), 'rejected', 'IDENTITY_MISMATCH'));
test('missing source evidence remains unresolved', () => {
  const f = fixture(); fs.renameSync(path.join(f.root, 'data/raw.png'), path.join(f.root, 'data/raw.png.missing-evidence'));
  blocked(f.check(), 'unresolved', 'ENOENT');
});
test('historical explicit negative is never released', () => blocked(fixture({ rejectedReview: true }).check(), 'rejected', 'EXISTING_REVIEW_REJECTED'));
test('caller passed, report hash and semantic flags cannot grant qualification', () => {
  const f = fixture(); blocked(f.check({ passed: true, reportSha256: 'a'.repeat(64), roadAlignmentPassed: true }), 'unresolved');
});
test('nontrain split rejected before any evidence reads', () => {
  const r = fixture({ split: 'validation' }).check(); blocked(r, 'rejected', 'SPLIT_OUT_OF_SCOPE'); assert.equal(r.bindings.length, 0);
});
test('missing production manifest rejected without touching root', () => {
  const r = checkSourcePairPreflight({ projectRoot: 'DOES-NOT-EXIST', passed: true }); blocked(r, 'rejected', 'MANIFEST_BINDING_REQUIRED'); assert.equal(r.rows.length, 0);
});
test('path escape cannot reach external bytes', () => {
  const f = fixture(); f.pair.sourceRecord.path = '../outside.json'; blocked(f.check(), 'rejected', 'PATH_OUT_OF_SCOPE');
});
test('synthetic marker is required', () => {
  const f = fixture(); fs.writeFileSync(path.join(f.root, 'SYNTHETIC-NOT-AN-ASSET'), 'wrong marker'); blocked(f.check(), 'rejected', 'SYNTHETIC_MARKER_MISSING');
});
test('manifest duplicate, oversized selection and nontrain scopes are rejected before source reads', () => {
  const f = fixture();
  for (const samples of [[f.pair, f.pair], [f.pair, f.pair, f.pair], [{ ...f.pair, split: 'test' }]]) {
    const manifest = f.write('data/manifest.json', { schemaVersion: 'ai-painter-source-pair-input-v1', purpose: 'source_pair_preflight', samples });
    const r = checkSourcePairPreflight({ projectRoot: 'DOES-NOT-EXIST', manifestPath: path.join(f.root, manifest.path), manifestSha256: manifest.sha256 });
    blocked(r, 'rejected', 'MANIFEST_SCOPE_REJECTED'); assert.equal(r.rows.length, 0);
  }
});
test('same path manifest replacement cannot reuse the prior hash', () => {
  const f = fixture(); const m = f.write('data/manifest.json', { schemaVersion: 'ai-painter-source-pair-input-v1', purpose: 'source_pair_preflight', samples: [f.pair] });
  f.write('data/manifest.json', { passed: true });
  const r = checkSourcePairPreflight({ projectRoot: f.root, manifestPath: path.join(f.root, m.path), manifestSha256: m.sha256 });
  blocked(r, 'rejected', 'IDENTITY_MISMATCH'); assert.equal(r.rows.length, 0);
});
test('byte-consistent synthetic manifest and claimed pass still cannot qualify an asset', () => {
  const f = fixture(); const m = f.write('data/manifest.json', { schemaVersion: 'ai-painter-source-pair-input-v1', purpose: 'source_pair_preflight', passed: true, samples: [{ ...f.pair, passed: true }] });
  const r = checkSourcePairPreflight({ projectRoot: f.root, manifestPath: path.join(f.root, m.path), manifestSha256: m.sha256, passed: true });
  blocked(r, 'unresolved'); blocked(r.rows[0], 'unresolved', 'ROAD_ALIGNMENT_UNRESOLVED');
});
test('CLI does not overwrite prior evidence or accept passed flags', () => {
  const f = fixture(); const target = path.join(f.root, 'prior.json'); fs.writeFileSync(target, 'retained');
  const cli = path.join(workspace, 'scripts/check-ai-painter-source-pair-preflight.mjs');
  const manifest = f.write('data/manifest.json', { schemaVersion: 'ai-painter-source-pair-input-v1', purpose: 'source_pair_preflight', samples: [f.pair] });
  const collision = spawnSync(process.execPath, [cli, '--project-root', f.root, '--manifest', path.join(f.root, manifest.path), '--manifest-sha256', manifest.sha256, '--output', target], { encoding: 'utf8', timeout: 180000 });
  assert.equal(collision.status, 1); assert.match(collision.stderr, /EEXIST/); assert.equal(fs.readFileSync(target, 'utf8'), 'retained');
  const forged = spawnSync(process.execPath, [cli, '--project-root', f.root, '--passed', 'true'], { encoding: 'utf8', timeout: 180000 });
  assert.equal(forged.status, 1); assert.match(forged.stderr, /Usage/);
});
test('exact real originals remain unresolved with byte identities verified', { skip: !process.env.SOURCE_PAIR_PREFLIGHT_REAL_ROOT, timeout: 180000 }, () => {
  const report = checkSourcePairPreflight({ projectRoot: process.env.SOURCE_PAIR_PREFLIGHT_REAL_ROOT,
    manifestPath: process.env.SOURCE_PAIR_PREFLIGHT_MANIFEST, manifestSha256: process.env.SOURCE_PAIR_PREFLIGHT_MANIFEST_SHA256, passed: true });
  blocked(report, 'unresolved'); assert.equal(report.rows.length, 2);
  for (const r of report.rows) {
    blocked(r, 'unresolved', 'ROAD_ALIGNMENT_UNRESOLVED'); assert.equal(r.identityStatus, 'byte_bindings_and_pair_identity_verified'); assert.equal(r.synthetic, false);
  }
});
