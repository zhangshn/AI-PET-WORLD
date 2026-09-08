import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { buildCompleteMapSemanticTopologySignature } from "./complete-map-semantic-topology-signature.mjs";
import { auditHistoricalExposure, discoverExposureInventory } from "./ai-painter-stage4-historical-exposure.mjs";
import { catalogPath } from "./ai-pet-world-storage.mjs";
import { readHistoricalGeometry, compareHistoricalGeometry } from "./ai-painter-stage4-historical-geometry.mjs";

export const SPLIT_COUNTS = { train: 48, validation: 8, challenge: 4, regression: 4 };
const CAPABILITY = {
  path: "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json",
  sha256: "9e4eb98a1bdcc4afe03aa7fcecfb8350ddaff8030a62e143c289461d7041eef3",
};
const LIBRARY = "data/world-samples/original-image-library/natural-home-v1/index.json";
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };

export function explicitFile(root, logical) {
  requireValue(typeof logical === "string" && logical.length > 0
    && !logical.includes("\\") && !logical.includes(":") && !logical.startsWith("/")
    && logical.split("/").every((part) => !["", ".", "..", "latest", "latest.json"].includes(part)),
  "invalid explicit audit path");
  const base = fs.realpathSync(root);
  const allowed = logical.startsWith(".runtime/") ? fs.realpathSync(path.join(base, ".runtime")) : base;
  const target = fs.realpathSync(path.join(base, logical));
  const relative = path.relative(allowed, target);
  requireValue(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    "audit path escapes declared storage");
  return target;
}

export function createReader(root) {
  const receipts = new Map();
  function bytes(logical, expected) {
    if (expected !== undefined) requireValue(/^[a-f0-9]{64}$/.test(expected), "invalid SHA binding");
    const target = explicitFile(root, logical);
    requireValue(fs.statSync(target).size <= 64 * 1024 * 1024, "audit input exceeds 64 MiB bound");
    const data = fs.readFileSync(target);
    const actual = sha256(data);
    requireValue(expected === undefined || actual === expected, `SHA mismatch: ${logical}`);
    requireValue(!receipts.has(logical) || receipts.get(logical).sha256 === actual,
      `audit input changed: ${logical}`);
    receipts.set(logical, { path: logical, sha256: actual, bytes: data.length });
    return data;
  }
  return {
    bytes,
    json: (logical, expected) => JSON.parse(bytes(logical, expected).toString("utf8")),
    bound: (binding) => {
      requireValue(binding && /^[a-f0-9]{64}$/.test(binding.sha256), "missing SHA binding");
      return JSON.parse(bytes(binding.path, binding.sha256).toString("utf8"));
    },
    receipts: () => [...receipts.values()].sort((a, b) => a.path.localeCompare(b.path)),
    verifyStable: () => { for (const receipt of [...receipts.values()]) bytes(receipt.path, receipt.sha256); },
  };
}

export function validateMembership(manifest, source, memberships) {
  requireValue(manifest.schemaVersion === "ai-painter-stage4-v2-independent-split-package-v1",
    "unsupported split manifest");
  requireValue(manifest.sampleCount === 64 && source.sampleCount === 64 && source.samples?.length === 64,
    "audit requires exact 64-row release");
  const ids = new Set(source.samples.map((row) => row.sampleId));
  requireValue(ids.size === 64 && [...ids].every((id) => typeof id === "string" && id.length),
    "duplicate or missing sample identity");
  for (const [split, count] of Object.entries(SPLIT_COUNTS)) {
    const expected = source.samples.filter((row) => row.split === split).map((row) => row.sampleId);
    requireValue(manifest.splitCounts?.[split] === count && expected.length === count
      && memberships[split]?.split === split
      && JSON.stringify(memberships[split].sampleIds) === JSON.stringify(expected),
    `split membership mismatch: ${split}`);
  }
}

export function semanticDuplicateGroups(records) {
  const groups = [];
  for (const kind of ["routeSemanticIdentity", "completeSkeletonSemanticIdentity", "waterNetworkMode"]) {
    const map = new Map();
    for (const record of records) {
      const signature = record.signature;
      const key = kind === "waterNetworkMode"
        ? (signature.waterAndShoreline.present ? signature.waterAndShoreline.networkConnectionMode : null)
        : signature.identities[kind];
      if (key === null) continue; // Multiple genuinely dry maps are not duplicate water networks.
      requireValue(typeof key === "string" && key.length > 0, "missing semantic identity");
      map.set(key, [...(map.get(key) ?? []), { sampleId: record.sampleId, split: record.split }]);
    }
    for (const [identity, samples] of map) if (samples.length > 1) {
      groups.push({ kind, identity, crossSplit: new Set(samples.map((r) => r.split)).size > 1, samples });
    }
  }
  return groups;
}

// Four shape-preserving transforms required by the existing natural-map contract.
// Native decoded RGB detects re-encoding as well as exact mirror/180-degree copies.
// Thumbnail distance is a ranking only: it never grants semantic uniqueness.
export async function imageFingerprint(bytes) {
  const decoded = await sharp(bytes, { limitInputPixels: 16_777_216 }).removeAlpha().toColourspace("srgb")
    .raw().toBuffer({ resolveWithObject: true });
  requireValue(decoded.info.channels === 3, "expected decoded RGB");
  const { width, height } = decoded.info;
  const variants = [];
  for (const transform of ["identity", "horizontal_mirror", "vertical_mirror", "rotate_180"]) {
    const pixels = Buffer.alloc(decoded.data.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const xx = ["horizontal_mirror", "rotate_180"].includes(transform) ? width - 1 - x : x;
      const yy = ["vertical_mirror", "rotate_180"].includes(transform) ? height - 1 - y : y;
      const src = (yy * width + xx) * 3;
      const dst = (y * width + x) * 3;
      pixels[dst] = decoded.data[src]; pixels[dst + 1] = decoded.data[src + 1]; pixels[dst + 2] = decoded.data[src + 2];
    }
    const thumbnail = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .resize(32, 24, { fit: "fill" }).raw().toBuffer();
    variants.push({ transform, pixelSha256: sha256(Buffer.concat([Buffer.from(`${width}x${height}:RGB:`), pixels])), thumbnail });
  }
  return { width, height, variants };
}

export function compareImages(left, right) {
  let nearest = { transform: null, rgbThumbnailMae: Infinity };
  const exactTransforms = [];
  const a = left.variants[0];
  for (const b of right.variants) {
    if (a.pixelSha256 === b.pixelSha256) exactTransforms.push(b.transform);
    let total = 0;
    for (let i = 0; i < a.thumbnail.length; i++) total += Math.abs(a.thumbnail[i] - b.thumbnail[i]);
    const mae = total / a.thumbnail.length;
    if (mae < nearest.rgbThumbnailMae) nearest = { transform: b.transform, rgbThumbnailMae: mae };
  }
  return { exactTransforms, ...nearest };
}

export function evaluationExposure(records, rows) {
  const byId = new Map(rows.map((row) => [row.sampleId, row]));
  const observed = [], reservations = [];
  for (const record of records) {
    if (!record.sampleId) { reservations.push(record); continue; }
    const row = byId.get(record.sampleId);
    if (!row) continue;
    requireValue(record.split === row.split && record.conditionPackPath === row.conditionPack.path,
      "historical evaluation sample binding conflict");
    const measured = ["velocityPredictionLoss", "decodedRgbMae", "compositeConditionQualityScore"]
      .some((key) => typeof record[key] === "number" && Number.isFinite(record[key]));
    if (measured) observed.push({ sampleId: row.sampleId, split: row.split,
      usage: "historical_evaluation_observed", optimizerUpdateProven: false });
  }
  return { observed, reservations, reservationIsProofOfNeverObserved: false };
}

export function foundationExposure(reader, contract, rows, progress = () => {}) {
  const chain = [], overlaps = [], gaps = [], seen = new Set();
  let checkpoint = contract.checkpoint;
  let manifestBinding = contract.sourceManifest;
  for (let depth = 0; checkpoint; depth++) {
    requireValue(depth < 16 && !seen.has(checkpoint.path), "foundation ancestry cycle or depth limit");
    seen.add(checkpoint.path);
    reader.bytes(checkpoint.path, checkpoint.sha256); // Raw hash only; never deserialize weights.
    const manifestPath = manifestBinding?.path ?? `${path.posix.dirname(checkpoint.path)}/manifest.json`;
    const manifest = reader.json(manifestPath, manifestBinding?.sha256);
    requireValue(manifest.checkpointPath === checkpoint.path && manifest.checkpointSha256 === checkpoint.sha256,
      "foundation checkpoint/manifest mismatch");
    if (!manifestBinding) gaps.push({ code: "ancestor_manifest_not_hash_bound_by_child", path: manifestPath });
    const dataset = reader.bound({ path: manifest.datasetManifestPath, sha256: manifest.datasetManifestSha256 });
    requireValue(dataset.packageId === manifest.datasetPackageId, "foundation dataset identity mismatch");
    const source = reader.json(dataset.sourceIndexPath, dataset.sourceIndexSha256 ?? undefined);
    if (!dataset.sourceIndexSha256) gaps.push({ code: "historical_source_index_not_hash_bound", path: dataset.sourceIndexPath });
    requireValue(Array.isArray(source.samples), "foundation source samples missing");
    for (const sample of source.samples) {
      reader.bytes(sample.imagePath, sample.imageSha256);
      for (const row of rows) if (row.image.sha256 === sample.imageSha256 || row.sampleId === sample.sampleId) {
        overlaps.push({ sampleId: row.sampleId, currentSplit: row.split, historicalSampleId: sample.sampleId,
          historicalSplit: sample.split, manifestPath, imageBytesMatch: row.image.sha256 === sample.imageSha256,
          usage: "historical_dataset_membership_not_per_sample_optimizer_proof" });
      }
    }
    chain.push({ manifestPath, checkpoint: { path: checkpoint.path, sha256: checkpoint.sha256 },
      trainingStage: manifest.trainingStage, initialization: manifest.initialization,
      datasetManifestPath: manifest.datasetManifestPath, sourceIndexPath: dataset.sourceIndexPath,
      indexedSamples: source.samples.length, splitMetrics: manifest.splitMetrics });
    progress(`foundation_ancestor_${depth + 1}`);
    if (!manifest.parentCheckpointPath) {
      if (manifest.initialization === "project_checkpoint_resume") gaps.push({ code: "resumed_foundation_parent_missing", path: manifestPath });
      checkpoint = null;
    } else checkpoint = { path: manifest.parentCheckpointPath, sha256: manifest.parentCheckpointSha256 };
    manifestBinding = null;
  }
  return { chain, exactIdentityOverlaps: overlaps, gaps, unseenHoldoutQualified: false };
}

export function semanticHistoryMatches(current, historical) {
  const reasons = [];
  for (const key of ["routeSemanticIdentity", "completeSkeletonSemanticIdentity"]) {
    requireValue(typeof current.identities[key] === "string" && typeof historical.identities[key] === "string",
      "historical semantic identity missing");
    if (current.identities[key] === historical.identities[key]) reasons.push(key);
  }
  if (current.waterAndShoreline.present && historical.waterAndShoreline.present
    && current.identities.waterSemanticIdentity === historical.identities.waterSemanticIdentity) {
    reasons.push("waterSemanticIdentity");
  }
  return reasons;
}

export function historicalMatchContext(current, historical, review) {
  requireValue(review.recordId === historical.recordId
    && review.imageSha256 === historical.originalImage?.sha256, "historical rejection review binding mismatch");
  const sameTask = Boolean(current.conditionBinding?.taskPackagePath)
    && current.conditionBinding.taskPackagePath === historical.conditionBinding?.taskPackagePath;
  const sameCondition = Boolean(current.conditionBinding?.conditionPackPath)
    && current.conditionBinding.conditionPackPath === historical.conditionBinding?.conditionPackPath;
  const reasonCodes = (review.issues ?? []).map((issue) => issue.code);
  const compositionRejected = reasonCodes.some((code) => [
    "historical_rejected_composition_duplicate", "complete_map_composition_diversity_failed",
  ].includes(code));
  const before = Date.parse(historical.createdAtUtc), after = Date.parse(current.createdAtUtc);
  return { sameTask, sameCondition, oldCreatedAtUtc: historical.createdAtUtc, currentCreatedAtUtc: current.createdAtUtc,
    historicalPrecedesCurrent: Number.isFinite(before) && Number.isFinite(after) ? before < after : null,
    historicalReviewStatus: review.status, historicalReasonCodes: reasonCodes,
    reviewPath: historical.reviews.machineReviewPath,
    interpretation: compositionRejected ? "historical_composition_rejection_requires_fresh_novelty_evidence"
      : sameTask && sameCondition ? "same_condition_rgb_retry_not_automatically_a_capacity_duplicate"
        : "cross_condition_semantic_match_requires_adjudication",
    currentSampleQualifiedByThisContext: false };
}

export function auditHistoricalGeometry({ reader, history, selected, progress = () => {} }) {
  requireValue(Array.isArray(history) && new Set(history.map((r) => r.recordId)).size === history.length,
    "historical geometry inventory invalid");
  requireValue(Array.isArray(selected) && new Set(selected.map((r) => r.sampleId)).size === selected.length
    && new Set(selected.map((r) => r.recordId)).size === selected.length, "historical geometry selection invalid");
  const records = [], gaps = [];
  for (const record of history) {
    try { records.push(readHistoricalGeometry(reader, record)); }
    catch (error) { gaps.push({ recordId: record.recordId, code: error.code ?? "historical_geometry_evidence_unreadable",
      field: error.field ?? null, reason: error.message }); }
    if ((records.length + gaps.length) % 32 === 0) progress(`historical_geometry_${records.length + gaps.length}_of_${history.length}`);
  }
  const byRecord = new Map(records.map((r) => [r.recordId, r]));
  const matches = [];
  let comparisons = 0;
  for (const row of selected) {
    const left = byRecord.get(row.recordId);
    requireValue(left, `selected geometry unavailable: ${row.sampleId}`);
    for (const right of records) {
      if (row.recordId === right.recordId) continue;
      comparisons++;
      const variants = compareHistoricalGeometry(left, right);
      if (variants.length) matches.push({ sampleId: row.sampleId, split: row.split,
        historicalRecordId: right.recordId, blueprintPath: right.blueprintPath, variants });
    }
  }
  const topologyGaps = records.filter((r) => !r.signature).map((r) => ({ recordId: r.recordId,
    blueprintPath: r.blueprintPath, code: "historical_topology_fields_not_recorded",
    missingFields: r.missingTopologyFields, polygonAuditAvailable: true }));
  return { summary: { historicalRecords: history.length, declaredGeometryChecked: records.length,
    geometryEvidenceGaps: gaps.length, polygonOnlyRecords: topologyGaps.length,
    centerlineSignatureRecords: records.length - topologyGaps.length,
    recordsWithNonSpatialEcologyLabels: records.filter((r) => r.ecologicalZonesWithoutGeometry > 0).length,
    geometryPairComparisons: comparisons, declaredGeometryMatchPairs: matches.length },
  records, gaps, topologyGaps, matches, qualification: { trainingAllowed: false, fullSemanticUniquenessQualified: false,
    nonExactTransformReviewCompleted: false } };
}

// Reuse a byte-bound risk report's exact inventory. No RGB, exposure or foundation
// rerun; unchanged data receipts are checked, while new program lineage is bound.
export function replayHistoricalGeometry({ root, baselineBinding, progress = () => {} }) {
  const reader = createReader(root), baseline = reader.bound(baselineBinding);
  requireValue(baseline.schemaVersion === "ai-painter-stage4-split-risk-audit-v1"
    && Array.isArray(baseline.inputReceipts), "unsupported geometry audit baseline");
  const oldReceipts = new Map(baseline.inputReceipts.map((r) => [r.path, r]));
  requireValue(oldReceipts.size === baseline.inputReceipts.length && oldReceipts.has(LIBRARY), "baseline inventory binding missing");
  const library = reader.json(LIBRARY, oldReceipts.get(LIBRARY).sha256);
  const history = library.records.filter((r) => r.categoryId === "complete-maps");
  requireValue(history.length === baseline.summary.historicalLibraryRecords, "baseline historical inventory changed");
  const rows = baseline.semanticAudit.records;
  const selected = baseline.imageAudit.selfReferences.map((r) => {
    const row = rows.find((s) => s.sampleId === r.sampleId);
    requireValue(row && Object.hasOwn(SPLIT_COUNTS, row.split), "baseline selected binding missing");
    return { sampleId: r.sampleId, recordId: r.recordId, split: row.split };
  });
  requireValue(rows.length === 64 && selected.length === 64, "baseline selected capacity mismatch");
  const geometryAudit = auditHistoricalGeometry({ reader, history, selected, progress });
  const newGeometry = new Map(geometryAudit.records.map((r) => [r.recordId, r]));
  for (const old of baseline.semanticAudit.historicalRecords) {
    requireValue(JSON.stringify(newGeometry.get(old.recordId)?.signature) === JSON.stringify(old.signature),
      `baseline centerline signature changed: ${old.recordId}`);
  }
  for (const receipt of reader.receipts()) {
    if (receipt.path === baselineBinding.path) continue;
    requireValue(oldReceipts.get(receipt.path)?.sha256 === receipt.sha256,
      `geometry input differs from baseline: ${receipt.path}`);
  }
  for (const p of ["scripts/lib/ai-painter-stage4-dataset-audit.mjs", "scripts/lib/ai-painter-stage4-historical-geometry.mjs",
    "scripts/lib/complete-map-semantic-topology-signature.mjs", "scripts/tests/test-ai-painter-stage4-dataset-audit.mjs",
    "scripts/audit-ai-painter-stage4-split-release.mjs"]) reader.bytes(p);
  reader.verifyStable();
  return { schemaVersion: "ai-painter-stage4-historical-geometry-replay-v1",
    status: "bounded_geometry_replay_completed_training_unqualified", recordedAtUtc: new Date().toISOString(),
    baseline: baselineBinding, baselineSummary: baseline.summary, summary: geometryAudit.summary, geometryAudit,
    baselineCenterlineSignaturesUnchanged: baseline.semanticAudit.historicalRecords.length,
    qualification: geometryAudit.qualification, remainingCoverage: ["missing_task_or_blueprint_references",
      "legacy_unrecorded_centerline_and_ecological_topology", "all_history_non_exact_transform_and_semantic_neighbour_review"],
    reusedEvidenceScope: "baseline_inventory_and_prior_findings_only_no_rgb_exposure_or_foundation_revalidation",
    requirements: ["AP-TRAIN-002", "AP-CHANGE-004"], gpuStarted: false, trainingStarted: false,
    currentRegistryModified: false, historicalFilesModified: false, inputReceipts: reader.receipts() };
}

export function auditSplitReleaseExposure({ root, manifestBinding, progress = () => {} }) {
  const reader = createReader(root), manifest = reader.bound(manifestBinding);
  const source = reader.bound(manifest.sourceIndex);
  const memberships = Object.fromEntries(Object.entries(manifest.splits).map(([split, binding]) => [split, reader.bound(binding)]));
  validateMembership(manifest, source, memberships);
  const registry = reader.json(".runtime/ai-painter/current-execution-registry/current.json");
  requireValue(registry.activeExecution === null, "historical audit cannot overlap registered active training");
  for (const logical of ["scripts/lib/ai-painter-stage4-historical-exposure.mjs",
    "scripts/tests/test-ai-painter-stage4-historical-exposure.mjs", "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
    "scripts/audit-ai-painter-stage4-split-release.mjs"]) reader.bytes(logical);
  const inventory = discoverExposureInventory(root, catalogPath);
  const report = auditHistoricalExposure({ root, reader, rows: source.samples, inventory, progress });
  requireValue(JSON.stringify(discoverExposureInventory(root, catalogPath).entries) === JSON.stringify(inventory.entries),
    "historical exposure inventory changed during audit");
  reader.verifyStable();
  return { ...report, datasetManifest: manifestBinding, inputReceipts: reader.receipts(),
    requirements: ["AP-TRAIN-002", "AP-CHANGE-004"], registryRevision: registry.registryRevision,
    qualification: { trainingAllowed: false, unseenHoldoutQualified: false, allHistoryUseQualified: false },
    currentRegistryModified: false, historicalFilesModified: false };
}

export async function auditSplitRelease({ root, manifestBinding, progress = () => {} }) {
  const reader = createReader(root);
  const manifest = reader.bound(manifestBinding);
  const source = reader.bound(manifest.sourceIndex);
  const memberships = Object.fromEntries(Object.keys(SPLIT_COUNTS).map((split) => [split, reader.bound(manifest.splits[split])]));
  validateMembership(manifest, source, memberships);
  const parent = reader.bound(manifest.identityPayload.parentRelease);
  requireValue(source.samples.every((row, index) => parent.samples[index]?.sampleId === row.sampleId
    && parent.samples[index]?.split === row.split && parent.samples[index]?.image.sha256 === row.image.sha256
    && parent.samples[index]?.image.path === row.image.path
    && parent.samples[index]?.conditionPack.path === row.conditionPack.path
    && parent.samples[index]?.conditionPack.sha256 === row.conditionPack.sha256
    && parent.samples[index]?.ordinal === row.ordinal), "audit selection differs from frozen parent");
  const semantic = [], images = new Map();
  async function fingerprint(binding) {
    const bytes = reader.bytes(binding.path, binding.sha256);
    const hash = sha256(bytes);
    if (!images.has(hash)) images.set(hash, await imageFingerprint(bytes));
    return images.get(hash);
  }
  const selected = [];
  for (const row of source.samples) {
    const record = reader.bound(row.sourceRecord);
    const pack = reader.bound(row.conditionPack);
    const task = reader.json(pack.sourceBindings.taskPackagePath);
    requireValue(task.taskId === pack.taskId && task.worldId === row.grouping.worldId
      && record.conditionBinding.taskId === task.taskId, "semantic task identity mismatch");
    const blueprintPath = task.sourceBindings.trainingBlueprintPath;
    const blueprint = reader.json(blueprintPath);
    requireValue(blueprint.geometry && blueprint.structuralIdentities?.themeArchitectureIdentity === row.grouping.theme
      && blueprint.structuralIdentities?.instanceDetailIdentity === row.grouping.instance,
    "semantic blueprint identity missing or mismatched");
    semantic.push({ sampleId: row.sampleId, split: row.split, blueprintPath,
      signature: buildCompleteMapSemanticTopologySignature(blueprint) });
    selected.push({ ...row, recordId: record.recordId, fingerprint: await fingerprint(row.image) });
    if (selected.length % 16 === 0) progress(`selected_images_${selected.length}_of_64`);
  }
  const library = reader.json(LIBRARY);
  requireValue(Array.isArray(library.records), "historical library records missing");
  const history = library.records.filter((record) => record.categoryId === "complete-maps");
  const historyIds = history.map((r) => r.recordId);
  requireValue(new Set(historyIds).size === history.length, "duplicate historical record ID");
  const historicalGeometryAudit = auditHistoricalGeometry({ reader, history, selected, progress });
  const geometryByRecord = new Map(historicalGeometryAudit.records.map((r) => [r.recordId, r]));
  const historyGaps = [], comparisons = [], exactPairs = [], selfReferences = [];
  const historicalSemanticRecords = [], historicalSemanticGaps = [], historicalSemanticMatches = [];
  for (let index = 0; index < history.length; index++) {
    const record = history[index];
    try {
      const evidence = geometryByRecord.get(record.recordId);
      const gap = historicalGeometryAudit.gaps.find((g) => g.recordId === record.recordId);
      requireValue(evidence, gap?.reason ?? "historical geometry unavailable");
      requireValue(evidence.signature, `historical topology fields not recorded: ${evidence.missingTopologyFields.join(",")}; declared polygon audit available`);
      const { blueprintPath, signature } = evidence;
      historicalSemanticRecords.push({ recordId: record.recordId, blueprintPath, signature });
      for (const left of semantic) {
        if (selected.find((r) => r.sampleId === left.sampleId)?.recordId === record.recordId) continue;
        const reasons = semanticHistoryMatches(left.signature, signature);
        if (reasons.length) {
          let context;
          try {
            const currentRow = selected.find((r) => r.sampleId === left.sampleId);
            const currentRecord = reader.bound(currentRow.sourceRecord);
            const review = reader.json(record.reviews.machineReviewPath);
            context = historicalMatchContext(currentRecord, record, review);
          } catch (error) { context = { interpretation: "historical_match_context_unverified", reason: error.message }; }
          historicalSemanticMatches.push({ sampleId: left.sampleId, split: left.split,
            historicalRecordId: record.recordId, historicalStatus: record.status, blueprintPath, reasons, context });
        }
      }
    } catch (error) {
      historicalSemanticGaps.push({ recordId: record.recordId, code: "historical_semantics_not_verified", reason: error.message });
    }
    try {
      requireValue(record.relativeDirectory && record.originalImage?.path && record.originalImage?.sha256,
        "historical image binding missing");
      // Concatenate before validation: path.normalize must not hide traversal.
      const imagePath = `${record.relativeDirectory}/${record.originalImage.path}`;
      const right = await fingerprint({ path: imagePath, sha256: record.originalImage.sha256 });
      for (const left of selected) {
        if (left.recordId === record.recordId) {
          requireValue(left.image.sha256 === record.originalImage.sha256, "historical self-reference image mismatch");
          selfReferences.push({ sampleId: left.sampleId, recordId: record.recordId });
          continue;
        }
        const comparison = { sampleId: left.sampleId, split: left.split,
          historicalRecordId: record.recordId, historicalStatus: record.status, historicalImagePath: imagePath,
          otherCurrentSplit: selected.find((r) => r.recordId === record.recordId)?.split ?? null,
          ...compareImages(left.fingerprint, right) };
        comparisons.push(comparison);
        if (comparison.exactTransforms.length) exactPairs.push(comparison);
      }
    } catch (error) {
      historyGaps.push({ recordId: record.recordId, code: "historical_image_not_verified", reason: error.message });
    }
    if ((index + 1) % 32 === 0) progress(`historical_images_${index + 1}_of_${history.length}`);
  }
  requireValue(selfReferences.length === 64, "not all released source records are bound in historical library");
  const capability = reader.bound(CAPABILITY);
  requireValue(capability.datasetBinding.sha256 === manifest.identityPayload.parentRelease.sha256,
    "audit capability parent dataset mismatch");
  const foundation = reader.bound(capability.foundationAssetBinding);
  let foundationAudit;
  try { foundationAudit = foundationExposure(reader, foundation, source.samples, progress); }
  catch (error) { foundationAudit = { gaps: [{ code: "foundation_ancestry_audit_incomplete", reason: error.message }], unseenHoldoutQualified: false }; }
  const registry = reader.json(".runtime/ai-painter/current-execution-registry/current.json");
  let exposure;
  try {
    const recoveredBinding = registry.latestTrainingTerminal.evidence.recoveredTrainingEvidence;
    const recovered = reader.bound(recoveredBinding);
    const evidencePath = `${path.posix.dirname(recovered.checkpointPath)}/condition-evidence.json`;
    const evidence = reader.json(evidencePath);
    exposure = { sourceRunId: registry.latestTrainingTerminal.runId, recoveredBinding, evidencePath,
      recoveredTrainingStatus: recovered.status,
      ...evaluationExposure(evidence.records, source.samples),
      scope: "latest_registered_historical_training_terminal_only_not_all_runs" };
  } catch (error) { exposure = { gaps: [{ code: "registered_history_exposure_unavailable", reason: error.message }] }; }
  const groups = semanticDuplicateGroups(semantic);
  const programPaths = ["scripts/lib/ai-painter-stage4-dataset-audit.mjs",
    "scripts/lib/ai-painter-stage4-historical-geometry.mjs",
    "scripts/lib/complete-map-semantic-topology-signature.mjs", "scripts/audit-ai-painter-stage4-split-release.mjs"];
  for (const logical of programPaths) reader.bytes(logical);
  reader.bytes("data/ai-painter/system-governance/complete-map-semantic-topology-diversity-contract-v1.json");
  reader.verifyStable();
  progress("input_hashes_rechecked");
  return {
    schemaVersion: "ai-painter-stage4-split-risk-audit-v1",
    status: "bounded_data_audit_completed_training_unqualified",
    recordedAtUtc: new Date().toISOString(), datasetManifest: manifestBinding,
    requirements: ["AP-TRAIN-001", "AP-TRAIN-002", "AP-CHANGE-004"],
    summary: { selectedSamples: 64, historicalLibraryRecords: history.length,
      verifiedHistoricalImages: history.length - historyGaps.length, historicalImageGaps: historyGaps.length,
      selfReferencesExcluded: selfReferences.length, imagePairComparisons: comparisons.length,
      exactPixelOrTransformPairs: exactPairs.length, currentSemanticDuplicateGroups: groups.length,
      historicalSemanticRecordsChecked: historicalSemanticRecords.length,
      historicalSemanticGaps: historicalSemanticGaps.length,
      historicalDeclaredGeometryChecked: historicalGeometryAudit.summary.declaredGeometryChecked,
      historicalGeometryEvidenceGaps: historicalGeometryAudit.summary.geometryEvidenceGaps,
      historicalSemanticSignatureMatches: historicalSemanticMatches.length,
      historicalCompositionRejectionMatches: historicalSemanticMatches.filter((entry) =>
        entry.context.interpretation === "historical_composition_rejection_requires_fresh_novelty_evidence").length,
      observedEvaluationSamples: exposure.observed?.length ?? null,
      foundationAncestors: foundationAudit.chain?.length ?? null,
      foundationExactOverlaps: foundationAudit.exactIdentityOverlaps?.length ?? null },
    imageAudit: { transforms: ["identity", "horizontal_mirror", "vertical_mirror", "rotate_180"],
      exactPairs, gaps: historyGaps, selfReferences,
      rankingMethod: "32x24 native RGB thumbnail MAE; diagnostic ranking only, no acceptance threshold",
      nearestPairs: comparisons.sort((a, b) => a.rgbThumbnailMae - b.rgbThumbnailMae
        || a.sampleId.localeCompare(b.sampleId) || a.historicalRecordId.localeCompare(b.historicalRecordId)).slice(0, 32) },
    semanticAudit: { scope: "current_64_and_explicitly_linked_readable_historical_blueprints",
      duplicateGroups: groups, records: semantic, historicalRecords: historicalSemanticRecords,
      historicalMatches: historicalSemanticMatches, historicalGaps: historicalSemanticGaps },
    historicalGeometryAudit, foundationAudit, historicalEvaluationExposure: exposure,
    qualification: { trainingAllowed: false, modelQualified: false, historicalExposureAudited: false,
      transformedOrSemanticNearDuplicateQualified: false, capabilityBindingRequired: true },
    remainingCoverage: ["all_training_runs_and_checkpoint_selection_exposure",
      "all_history_semantic_topology_and_non_exact_transform_review",
      "unindexed_generation_or_rejected_history_inventory", "foundation_ancestry_binding_gaps_if_any"],
    gpuStarted: false, trainingStarted: false, checkpointWeightsDeserialized: false,
    currentRegistryModified: false, historicalFilesModified: false,
    environment: { node: process.version, sharp: sharp.versions },
    inputReceipts: reader.receipts(),
  };
}
