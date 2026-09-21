import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';


export const CHANNEL_IDS = Object.freeze(('terrain_grass terrain_water terrain_path_ground terrain_shoreline '
  + 'terrain_natural_boundary terrain_mud_patch terrain_tall_grass walkable collision object_footprints '
  + 'object_tree object_rock object_vegetation focal_area object_instance coordinate_x coordinate_y '
  + 'signed_distance_path signed_distance_water signed_distance_shoreline signed_distance_object_ground '
  + 'signed_distance_boundary moisture_proximity').split(' '));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = (value, field) => {
  const copy = structuredClone(value);
  delete copy[field];
  if (field === 'conditionPackSha256' && copy.identityBindings) delete copy.identityBindings.conditionPackageSha256;
  return sha(JSON.stringify(copy));
};
class PreflightError extends Error {
  constructor(code, message, unresolved = false) { super(message); this.code = code; this.unresolved = unresolved; }
}
function requireThat(ok, code, message) { if (!ok) throw new PreflightError(code, message); }
function equal(a, b, label) {
  requireThat(a !== undefined && b !== undefined && isDeepStrictEqual(a, b), 'IDENTITY_MISMATCH', label);
}
function within(root, file) {
  const relative = path.relative(root, file);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

// No directory scanning, subprocess, image synthesis, network, model load or registration.
// Each read is bounded and rehashed again before returning. Production pins are private.
function reader(projectRoot, bindings) {
  const root = fs.realpathSync(projectRoot);
  const roots = new Map();
  let consumed = 0;
  function locate(relative) {
    requireThat(typeof relative === 'string' && !relative.includes('\\') && !relative.includes(':')
      && !relative.split('/').some(p => p === '..' || p === '' || p === '.')
      && /^(data|\.runtime)\//.test(relative) && /\.(json|png)$/.test(relative), 'PATH_OUT_OF_SCOPE', String(relative));
    requireThat(!/(^|\/)(test|validation|holdout|nontrain)(\/|$)/i.test(relative), 'SPLIT_OUT_OF_SCOPE', relative);
    const prefix = relative.split('/')[0];
    if (!roots.has(prefix)) roots.set(prefix, fs.realpathSync(path.join(root, prefix)));
    const actual = fs.realpathSync(path.join(root, relative));
    requireThat(within(roots.get(prefix), actual), 'PATH_OUT_OF_SCOPE', relative);
    return actual;
  }
  function read(relative, expected, canonicalField) {
    requireThat(typeof expected === 'string' && /^[a-f0-9]{64}$/.test(expected), 'MISSING_BINDING', String(relative));
    const actual = locate(relative);
    const size = fs.statSync(actual).size;
    requireThat(size <= 16 * 1024 * 1024 && consumed + size <= 128 * 1024 * 1024
      && bindings.length < 128, 'READ_BUDGET_EXCEEDED', relative);
    consumed += size;
    const bytes = fs.readFileSync(actual);
    const actualSha256 = sha(bytes);
    const boundSha256 = canonicalField ? canonical(JSON.parse(bytes), canonicalField) : actualSha256;
    bindings.push({ path: relative, resolvedPath: actual, sha256: actualSha256, expectedSha256: expected,
      bindingAlgorithm: canonicalField ? `json_without_${canonicalField}` : 'file_sha256', bytes: bytes.length });
    requireThat(boundSha256 === expected, 'BYTE_BINDING_MISMATCH', relative);
    return bytes;
  }
  return {
    read,
    json: (relative, expected, canonicalField) => JSON.parse(read(relative, expected, canonicalField)),
    verifyStable: () => {
      for (const b of bindings) {
        const actual = locate(b.path);
        requireThat(actual === b.resolvedPath && fs.statSync(actual).size === b.bytes
          && sha(fs.readFileSync(actual)) === b.sha256, 'INPUT_CHANGED_DURING_CHECK', b.path);
      }
    },
  };
}

function repairCandidate(pair, bindings) {
  return {
    kind: 'source_pair_repair_candidate_only', executableNow: false,
    sampleId: pair?.sampleId ?? null,
    action: 'Prepare a separately identified source candidate bound to the unchanged WorldFacts, task, guide and conditions, with actual generation transport evidence and a validated semantic verifier.',
    preserve: 'Keep the rejected or unresolved original, all prior evidence and the existing dataset release unchanged.',
    inputs: bindings.map(({ path: p, sha256 }) => ({ path: p, sha256 })),
    missing: [
      { code: 'GENERATION_TRANSPORT_RECEIPT_MISSING', action: 'Recover the original immutable tool request/response bytes, or retain them for a future replacement, proving the actual guide attachment and returned source SHA; prompt declarations alone are insufficient.' },
      { code: 'ROAD_ALIGNMENT_VERIFIER_UNAVAILABLE', action: 'Implement and validate a local RGB road-geometry verifier against independent labeled evidence, with thresholds from the effective review contract; recompute from actual candidate RGB and native condition bytes.' },
      { code: 'REPLACEMENT_SOURCE_NOT_AVAILABLE', action: 'Produce and intake a new immutable candidate through the existing source pipeline with its own complete generation evidence; recovery of the old receipt is not a prerequisite. Rerun source, rights and semantic review before dataset selection.' },
    ],
    nextInterface: {
      consumer: 'existing source intake / source review / dataset selection',
      requiredBindings: ['raw RGB bytes', 'guide attachment and response receipt', 'WorldFacts bytes', 'task canonical identity', '23 condition channel bytes', 'normalization implementation and output bytes', 'review implementation, effective thresholds and recomputed semantic evidence'],
      currentCallerAction: 'Block this pair before GPU work. This report is diagnostic evidence, never a qualification token.',
    },
  };
}

/** Caller manifest binds a bounded run, never authority or asset qualification. */
export function checkSourcePairPreflight({ projectRoot, manifestPath, manifestSha256 } = {}) {
  const report = { schemaVersion: 'ai-painter-source-pair-preflight-run-v1',
    decision: 'unresolved', blockUse: true, trainingEligible: false, formalQualification: false, rows: [], issues: [] };
  try {
    requireThat(typeof manifestPath === 'string' && typeof manifestSha256 === 'string'
      && /^[a-f0-9]{64}$/.test(manifestSha256), 'MANIFEST_BINDING_REQUIRED', 'Explicit manifest path and SHA256 are required.');
    requireThat(fs.statSync(manifestPath).size <= 64 * 1024, 'MANIFEST_SIZE_LIMIT', manifestPath);
    const bytes = fs.readFileSync(manifestPath);
    equal(sha(bytes), manifestSha256, 'input manifest bytes');
    const manifest = JSON.parse(bytes);
    requireThat(manifest.schemaVersion === 'ai-painter-source-pair-input-v1'
      && manifest.purpose === 'source_pair_preflight' && Array.isArray(manifest.samples)
      && manifest.samples.length >= 1 && manifest.samples.length <= 2, 'MANIFEST_SCOPE_REJECTED', 'Expected one or two explicit train pairs.');
    const ids = new Set();
    for (const pair of manifest.samples) {
      requireThat(typeof pair.sampleId === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(pair.sampleId)
        && !ids.has(pair.sampleId) && pair.split === 'train', 'MANIFEST_SCOPE_REJECTED', 'Unique train sample IDs required.');
      ids.add(pair.sampleId);
      for (const key of ['sourceRecord', 'contribution', 'conditionPack', 'image']) {
        requireThat(typeof pair[key]?.path === 'string' && /^[a-f0-9]{64}$/.test(pair[key]?.sha256 ?? ''), 'MANIFEST_BINDING_REQUIRED', key);
      }
    }
    report.manifest = { path: path.resolve(manifestPath), sha256: manifestSha256 };
    report.rows = manifest.samples.map(pair => inspectPair(projectRoot, pair, false));
    requireThat(fs.statSync(manifestPath).size === bytes.length && fs.readFileSync(manifestPath).equals(bytes), 'INPUT_CHANGED_DURING_CHECK', manifestPath);
    if (report.rows.some(row => row.decision === 'rejected')) report.decision = 'rejected';
  } catch (error) {
    report.decision = ['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code) ? 'unresolved' : 'rejected';
    report.issues.push({ code: error.code ?? 'INVALID_MANIFEST', message: error.message });
  }
  return report;
}
function blockedResult(sampleId, code, message) {
  return { schemaVersion: 'ai-painter-source-pair-preflight-v1', sampleId: sampleId ?? null,
    decision: 'rejected', identityStatus: 'not_verified', blockUse: true, trainingEligible: false,
    formalQualification: false, issues: [{ code, message }], bindings: [] };
}

// Explicit test seam: marker required, always synthetic, never emits qualification.
export function inspectSyntheticSourcePair({ projectRoot, pair } = {}) {
  const marker = path.join(projectRoot, 'SYNTHETIC-NOT-AN-ASSET');
  if (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8') !== 'source-pair-preflight synthetic fixture\n') {
    return blockedResult(pair?.sampleId, 'SYNTHETIC_MARKER_MISSING', 'Synthetic fixture root required.');
  }
  return inspectPair(projectRoot, pair, true);
}

function inspectPair(projectRoot, pair, synthetic) {
  const result = { schemaVersion: 'ai-painter-source-pair-preflight-v1', sampleId: pair?.sampleId ?? null,
    decision: 'unresolved', identityStatus: 'not_verified', blockUse: true, trainingEligible: false,
    formalQualification: false, synthetic, issues: [], bindings: [],
    scope: { gpuWork: false, modelLoads: 0, imageWrites: 0, registrationWrites: 0,
      pixelNormalizationRecomputed: false, semanticAlignmentRecomputed: false } };
  try {
    requireThat(pair?.split === 'train', 'SPLIT_OUT_OF_SCOPE', 'Only train pairs may be read.');
    const io = reader(projectRoot, result.bindings);
    const r = io.json(pair.sourceRecord.path, pair.sourceRecord.sha256);
    const c = io.json(pair.contribution.path, pair.contribution.sha256);
    equal(r.recordId, pair.sampleId, 'record/sample');
    equal(c.recordId, pair.sampleId, 'contribution/sample');
    const pack = io.json(pair.conditionPack.path, pair.conditionPack.sha256);
    equal(c.conditionPackFileSha256, pair.conditionPack.sha256, 'contribution/condition file');
    equal(canonical(pack, 'conditionPackSha256'), pack.conditionPackSha256, 'condition canonical');
    equal(r.conditionBinding.conditionPackPath, pair.conditionPack.path, 'record/condition path');
    equal(r.conditionBinding.conditionPackSha256, pack.conditionPackSha256, 'record/condition identity');
    equal(r.conditionBinding.conditionPackId, pack.conditionPackId, 'record/condition ID');
    const task = io.json(c.taskPackagePath, c.taskPackageSha256);
    equal(canonical(task, 'taskSha256'), task.taskSha256, 'task canonical');
    equal(task.taskSha256, pack.taskSha256, 'task/condition');
    equal(r.conditionBinding.taskSha256, task.taskSha256, 'record/task identity');
    equal(r.conditionBinding.taskId, task.taskId, 'record/task ID');
    equal(r.conditionBinding.taskPackagePath, c.taskPackagePath, 'record/task path');
    equal(pack.sourceBindings.taskPackagePath, c.taskPackagePath, 'condition/task path');
    equal(task.v7SlotBinding.split, 'train', 'task split');
    equal(pack.sourceBindings.visualFactManifestPath, task.sourceBindings.visualFactManifestPath, 'condition/VFM path');
    const vfm = io.json(task.sourceBindings.visualFactManifestPath, pack.visualFactManifestSha256, 'manifestSha256');
    equal(canonical(vfm, 'manifestSha256'), pack.visualFactManifestSha256, 'VFM canonical/condition');
    equal(vfm.manifestSha256, pack.visualFactManifestSha256, 'VFM self identity');
    const world = io.json(task.sourceBindings.naturalizedWorldFactsPath, task.sourceBindings.naturalizedWorldFactsSha256);
    equal(world.worldFactSetId, task.earthParameterSnapshotId, 'WorldFacts/task');
    for (const key of ['slotId', 'split', 'regionalLandscapeType', 'monsoonSeason', 'candidateId', 'measurementFingerprint']) {
      equal(world.v7SlotBinding[key], task.v7SlotBinding[key], `WorldFacts slot ${key}`);
    }
    const prompt = io.json(r.aiAssistedColdStart.promptEvidencePath, r.aiAssistedColdStart.promptEvidenceSha256);
    const blueprint = io.json(prompt.sourceConditionBlueprintPath, prompt.sourceConditionBlueprintSha256);
    equal(blueprint.earthParameterSnapshotId, world.worldFactSetId, 'blueprint/WorldFacts');
    equal(blueprint.earthParameterSnapshotPath, task.sourceBindings.naturalizedWorldFactsPath, 'blueprint/WorldFacts path');
    for (const key of ['terrainRegions', 'walkableRegions', 'collisionRegions', 'objectFootprints']) {
      equal(blueprint.geometry[key], task.spatialLayers[key], `blueprint/task geometry ${key}`);
    }
    equal(prompt.taskPackageId, task.taskId, 'prompt/task');
    equal(prompt.conditionPackId, pack.conditionPackId, 'prompt/condition');
    equal(r.conditionBinding.guideSha256, prompt.conditionGuideSha256, 'record/guide');
    equal(r.conditionBinding.guidePath, prompt.conditionGuidePath, 'record/guide path');
    io.read(prompt.conditionGuidePath, prompt.conditionGuideSha256);
    equal(pack.channels?.map(ch => ch.id), CHANNEL_IDS, 'required ordered 23 conditions');
    for (const channel of pack.channels) io.read(channel.path, channel.sha256);
    const normalizationBinding = r.copiedArtifacts.rights.find(b => b.originalPath === r.source.normalizationManifestPath);
    if (!normalizationBinding) throw new PreflightError('NORMALIZATION_EVIDENCE_MISSING', r.source.normalizationManifestPath, true);
    const norm = io.json(r.source.normalizationManifestPath, normalizationBinding.sha256);
    equal(norm.rawGeneratedImagePath, r.source.rawGeneratedImagePath, 'raw source path');
    equal(norm.rawGeneratedImageSha256, r.source.rawGeneratedImageSha256, 'raw source identity');
    equal(norm.normalizedImagePath, r.aiAssistedColdStart.trainingDerivativePath, 'record/derivative path');
    equal(norm.normalizedImageSha256, r.aiAssistedColdStart.trainingDerivativeSha256, 'record/derivative identity');
    equal(norm.conditionBinding.taskId, task.taskId, 'normalization/task');
    equal(norm.conditionBinding.conditionPackId, pack.conditionPackId, 'normalization/condition');
    equal(norm.conditionBinding.guideSha256, prompt.conditionGuideSha256, 'normalization/guide');
    io.read(norm.rawGeneratedImagePath, norm.rawGeneratedImageSha256);
    const derivative = io.read(norm.normalizedImagePath, norm.normalizedImageSha256);
    equal(sha(derivative), pair.image.sha256, 'selected RGB/normalized source');
    equal(c.imageSha256, pair.image.sha256, 'contribution/RGB');
    equal(r.originalImage.sha256, pair.image.sha256, 'record/RGB');
    io.read(path.posix.join(r.relativeDirectory, r.originalImage.path), r.originalImage.sha256);
    io.read(pair.image.path, pair.image.sha256);
    const review = io.json(c.machineReviewPath, c.machineReviewSha256);
    result.historicalReview = { method: review.semanticConditionAudit?.method ?? null,
      acceptedAsQualification: false, reason: 'Historical coarse spatial distribution cannot establish exact RGB road alignment.' };
    const road = review.semanticConditionAudit?.channelAudits?.find(ch => ch.channelId === 'terrain_path_ground');
    if (!road) throw new PreflightError('ROAD_REVIEW_EVIDENCE_MISSING', c.machineReviewPath, true);
    if (road.passed === false || review.passed === false || review.semanticConditionAudit.passed === false) throw new PreflightError('EXISTING_REVIEW_REJECTED', c.machineReviewPath);
    io.verifyStable();
    result.identityStatus = 'byte_bindings_and_pair_identity_verified';
    result.issues.push({ code: 'ROAD_ALIGNMENT_UNRESOLVED', message: 'Actual pair bytes are bound. No validated exact road-alignment verifier is available in this preflight; historical passed fields and report hashes do not release this pair.' });
  } catch (error) {
    const missing = error.unresolved || ['ENOENT', 'ENOTDIR', 'EACCES', 'MISSING_BINDING'].includes(error.code);
    result.decision = missing ? 'unresolved' : 'rejected';
    result.issues.push({ code: error.code ?? 'INVALID_EVIDENCE', message: error.message });
  }
  result.repairCandidate = repairCandidate(pair, result.bindings);
  return result;
}
