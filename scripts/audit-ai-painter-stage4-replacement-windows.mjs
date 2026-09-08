import assert from "node:assert/strict";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { createReader, validateMembership, sha256 } from "./lib/ai-painter-stage4-dataset-audit.mjs";
import { deriveThailandMvpLandscapeFromWindowFacts } from "./lib/real-earth-region-governance.mjs";
import { buildMeasurementDerivedCoarseHydrologyProfile } from "./lib/measurement-derived-coarse-hydrology.mjs";
import { buildMeasurementDrivenAnonymousLayoutProfile } from "./lib/measurement-driven-anonymous-topology.mjs";
import { persistAudit } from "./audit-ai-painter-stage4-split-release.mjs";

function validBounds(value) {
  assert(value && ["west", "east", "south", "north"].every(k => Number.isFinite(value[k])), "measurement bounds missing");
  assert(value.west < value.east && value.south < value.north, "measurement bounds invalid");
}

export function windowsOverlap(a, b) {
  validBounds(a); validBounds(b);
  // Shared borders are not shared area. Do not round away small overlaps.
  return Math.min(a.east, b.east) > Math.max(a.west, b.west)
    && Math.min(a.north, b.north) > Math.max(a.south, b.south);
}

// This reports source-window context, not optimizer exposure. Neighbor source
// metadata is not the neighbor sample's RGB/condition content, and an empty
// overlap list does not prove catchment-wide or holdout independence.
export function auditReplacementNeighborContext({ candidates, rows, sampleId, candidateId, neighborPairing }) {
  assert(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 4096 &&
    candidates.every(c => typeof c.candidateId === "string" && c.candidateId.length > 0) &&
    new Set(candidates.map(c => c.candidateId)).size === candidates.length, "invalid context candidate pool");
  assert(Array.isArray(rows) && rows.length > 1 && rows.length <= 4096 &&
    rows.every(r => typeof r.sampleId === "string" && r.sampleId.length > 0 &&
      ["train", "validation", "challenge", "regression"].includes(r.split)) &&
    new Set(rows.map(r => r.sampleId)).size === rows.length, "invalid context dataset membership");
  const target = rows.find(r => r.sampleId === sampleId), current = candidates.find(c => c.candidateId === candidateId);
  assert(target && current, "context target or candidate missing");
  for (const r of rows) validBounds(r.grouping?.sourceWindow);
  assert(Array.isArray(neighborPairing?.pairs) && Array.isArray(neighborPairing?.gaps), "context neighbor evidence missing");
  const ids = [candidateId];
  for (const pair of neighborPairing.pairs) {
    const neighbor = candidates.find(c => c.candidateId === pair.neighborCandidateId);
    assert(pair.sourceCandidateId === candidateId && neighbor && neighbor.candidateId !== candidateId,
      "context neighbor identity mismatch");
    assert.deepEqual(pair.neighborSourceWindow, neighbor.sourcePixelWindow, "context neighbor window mismatch");
    if (!ids.includes(neighbor.candidateId)) ids.push(neighbor.candidateId);
  }
  const windows = ids.map(id => {
    const candidate = candidates.find(c => c.candidateId === id);
    validBounds(candidate.measurementBounds);
    const overlaps = rows.filter(r => windowsOverlap(candidate.measurementBounds, r.grouping.sourceWindow))
      .map(r => ({ sampleId: r.sampleId, split: r.split, differsFromTargetSplit: r.split !== target.split }));
    return { candidateId: id, role: id === candidateId ? "current_region" : "paired_neighbor_source_context",
      measurementBounds: structuredClone(candidate.measurementBounds), currentReleaseOverlaps: overlaps };
  });
  return { schemaVersion: "replacement-neighbor-source-context-audit-v1", targetSampleId: sampleId, targetSplit: target.split,
    candidateId, windows, pairingGaps: structuredClone(neighborPairing.gaps),
    crossSplitContextObserved: windows.some(w => w.role !== "current_region" &&
      w.currentReleaseOverlaps.some(r => r.differsFromTargetSplit)),
    interpretation: "window_metadata_overlap_not_optimizer_or_sample_rgb_exposure",
    limitations: ["not_a_full_source_raster_or_upstream_dependency_analysis",
      "neighbor_rgb_and_conditions_are_not_inputs_to_this_audit", "does_not_decide_source_context_grouping_policy"],
    qualification: { sourceContextIsolationQualified: false, optimizerExposureEstablished: false,
      holdoutQualified: false, trainingAllowed: false, datasetModified: false } };
}

// The caller must derive these uses from byte-bound, reproduced generator
// inputs. Merely discovering a neighboring window is not a generation use.
// This is a blocking screen under data policy section 8, never a release gate.
export function auditConsumedSourceWindowIsolation({ candidates, rows, sampleId, uses }) {
  assert(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 4096 &&
    candidates.every(c => typeof c.candidateId === "string" && c.candidateId.length > 0) &&
    new Set(candidates.map(c => c.candidateId)).size === candidates.length, "invalid consumed source candidate pool");
  assert(Array.isArray(rows) && rows.length > 1 && rows.length <= 4096 &&
    new Set(rows.map(r => r.sampleId)).size === rows.length &&
    rows.every(r => typeof r.sampleId === "string" && r.sampleId.length > 0 &&
      ["train", "validation", "challenge", "regression"].includes(r.split)), "invalid consumed source dataset membership");
  const target = rows.find(r => r.sampleId === sampleId); assert(target, "consumed source target missing");
  for (const c of candidates) validBounds(c.measurementBounds);
  for (const r of rows) validBounds(r.grouping?.sourceWindow);
  const purposes = ["primary_region_geometry", "neighbor_joint_geometry", "boundary_flow_pairing"];
  assert(Array.isArray(uses) && uses.length > 0 && uses.length <= 32 &&
    new Set(uses.map(u => `${u.candidateId}:${u.purpose}`)).size === uses.length, "invalid or duplicate consumed source uses");
  const windows = uses.map(use => {
    const c = candidates.find(c => c.candidateId === use.candidateId);
    assert(c && purposes.includes(use.purpose) && /^[a-f0-9]{64}$/.test(use.inputSha256 ?? ""), "unbound consumed source use");
    return { ...structuredClone(use), measurementBounds: structuredClone(c.measurementBounds),
      overlaps: rows.filter(r => windowsOverlap(c.measurementBounds, r.grouping.sourceWindow))
        .map(r => ({ sampleId: r.sampleId, split: r.split, crossSplit: r.split !== target.split })) };
  });
  const conflicts = windows.flatMap(w => w.overlaps.filter(r => r.crossSplit).map(r => ({
    candidateId: w.candidateId, purpose: w.purpose, inputSha256: w.inputSha256, ...r })));
  return { schemaVersion: "consumed-source-window-isolation-screen-v1", targetSampleId: sampleId, targetSplit: target.split,
    policy: "TRAINING_DATA_AND_SOURCE_POLICY.md#8", status: conflicts.length ? "blocked_cross_split_consumed_source_window" : "no_cross_split_window_overlap_in_declared_uses",
    windows, conflicts, sourceWindowIsolationPassed: conflicts.length === 0,
    interpretation: "generation_source_window_conflict_not_evidence_of_optimizer_or_neighbor_rgb_consumption",
    limitations: ["declared_reproduced_uses_only_not_complete_upstream_catchment_or_naturalization_donor_coverage",
      "boundary_pairing_identifies_the_neighbor_window_not_full_window_geometry_consumption",
      "same_split_or_nonoverlap_does_not_prove_all_history_novelty_or_holdout_qualification"],
    optimizerExposureEstablished: false, holdoutQualified: false, trainingAllowed: false, datasetModified: false };
}

function validateMetrics(c) {
  const m = c.metrics;
  assert(m && [m.relativeElevation, m.relativeRelief, m.normalizedSlope?.mean,
    m.drainageLikelihoodRatio, m.humanRemovalRatio, ...["treeCover", "shrubland", "grassland", "bareOrSparse"]
      .map(k => m.reconstructedLandCoverRatio?.[k])].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1),
  "candidate measurement metrics missing or invalid");
  assert(Number.isFinite(m.elevationMetres?.mean), "candidate elevation missing");
  const w = c.sourcePixelWindow;
  assert(w && [w.left, w.top, w.width, w.height].every(Number.isInteger) && w.left >= 0 && w.top >= 0
    && w.width > 0 && w.height > 0 && w.left + w.width <= 1024 && w.top + w.height <= 768,
  "candidate source pixel window invalid");
  assert(/^[a-f0-9]{64}$/.test(c.fingerprints?.direct ?? ""), "candidate measurement fingerprint missing");
}

// This is an eligibility screen, not a source, novelty, holdout or RGB grant.
// In particular, old plan.assignments and slot-number ordering are not inputs.
export function screenReplacementWindows({ candidates, rows, sampleId }) {
  assert(Array.isArray(candidates) && candidates.length > 0 && candidates.length <= 4096, "candidate pool invalid");
  assert(Array.isArray(rows) && rows.length > 1 && new Set(rows.map(r => r.sampleId)).size === rows.length,
    "dataset membership invalid");
  const target = rows.find(r => r.sampleId === sampleId);
  assert(target && target.split === "validation", "replacement target must be an explicitly selected validation sample");
  assert(typeof target.regionalLandscapeType === "string" && typeof target.monsoonSeason === "string", "target ecology missing");
  assert(target.regionalLandscapeType === "wet-season-drainage-hollow" && target.monsoonSeason === "wet_season",
    "this pre-review supports only wet-season drainage-hollow replacement, not other ecologies");
  const seen = new Set();
  for (const row of rows) validBounds(row.grouping?.sourceWindow);
  return candidates.map(candidate => {
    assert(typeof candidate.candidateId === "string" && candidate.candidateId.length > 0
      && !seen.has(candidate.candidateId), "duplicate or missing measurement candidate identity");
    seen.add(candidate.candidateId);
    validBounds(candidate.measurementBounds); validateMetrics(candidate);
    const derived = deriveThailandMvpLandscapeFromWindowFacts({
      assignment: { ...candidate, monsoonSeason: target.monsoonSeason },
    });
    const overlaps = rows.filter(r => windowsOverlap(candidate.measurementBounds, r.grouping.sourceWindow))
      .map(r => ({ sampleId: r.sampleId, split: r.split }));
    const failures = [];
    if (overlaps.length) failures.push("measurement_window_overlaps_current_release");
    if (derived.regionalLandscapeType !== target.regionalLandscapeType) failures.push("measurement_derived_ecology_mismatch");
    return { candidateId: candidate.candidateId, measurementBounds: candidate.measurementBounds,
      derivedLandscapeType: derived.regionalLandscapeType, derivationRule: derived.landscapeDerivation.ruleId,
      currentReleaseOverlaps: overlaps, failures, eligibleForStructuralPreflight: failures.length === 0 };
  });
}

export function auditReplacementWindows({ root, manifestBinding, candidateBinding, naturalizedRunBinding,
  historyBinding, sampleId, progress = () => {} }) {
  const reader = createReader(root);
  const manifest = reader.bound(manifestBinding);
  const source = reader.bound(manifest.sourceIndex);
  const splits = Object.fromEntries(Object.entries(manifest.splits).map(([k, v]) => [k, reader.bound(v)]));
  validateMembership(manifest, source, splits);
  const target = source.samples.find(r => r.sampleId === sampleId);
  assert(target, "target sample not in bound dataset");
  const targetRecord = reader.bound(target.sourceRecord);
  assert.equal(targetRecord.recordId, sampleId, "target record identity mismatch");
  const targetSource = reader.bound(target.regionSource);
  const sourcePlan = reader.bound({ path: targetSource.sourceProvenance.measurementWindowPlanPath,
    sha256: targetSource.sourceProvenance.measurementWindowPlanSha256 });
  assert.equal(candidateBinding.path, sourcePlan.candidateWindowsPath, "candidate pool is not bound by target provenance");
  assert.equal(candidateBinding.sha256, sourcePlan.candidateWindowsSha256, "candidate pool provenance hash mismatch");
  const pool = reader.bound(candidateBinding);
  assert.equal(pool.schemaVersion, "earth-geospatial-v7-mvp-candidate-windows-v1", "unsupported candidate pool");
  assert(pool.grid?.columns === 11 && pool.grid?.rows === 11 && pool.candidates?.length === 121,
    "this pre-review is bounded to the existing Thailand 11x11 measurement pool");
  const rows = source.samples.map(r => {
    const region = reader.bound(r.regionSource);
    assert.deepEqual(region.identity.spatialBounds, r.grouping.sourceWindow, "published source window differs from actual region source");
    const record = reader.bound(r.sourceRecord);
    assert.equal(record.recordId, r.sampleId, "published source record identity mismatch");
    return { ...r, regionalLandscapeType: record.classification.regionalLandscapeType };
  });
  const screen = screenReplacementWindows({ candidates: pool.candidates, rows, sampleId });
  const candidates = pool.candidates.filter(c => screen.find(r => r.candidateId === c.candidateId).eligibleForStructuralPreflight);
  progress(`source_screen_complete:${pool.candidates.length}:${candidates.length}`);

  const run = reader.bound(naturalizedRunBinding);
  const lineage = reader.bound({ path: run.lineagePath, sha256: run.lineageSha256 });
  for (const entry of lineage.sourceArtifacts) reader.bound(entry);
  const hydrologyBinding = lineage.sourceArtifacts.find(r => r.role === "soil_and_natural_hydrology");
  const hydrology = reader.bound(hydrologyBinding).naturalHydrology;
  for (const name of ["elevation", "slope", "accumulation", "drainageLikelihood"])
    reader.bytes(hydrology[`${name}Path`], hydrology[`${name}Sha256`]);
  reader.bytes(run.combinedHumanRemovalMaskPath, run.combinedHumanRemovalMaskSha256);
  const task = reader.json(targetRecord.conditionBinding.taskPackagePath);
  const { taskSha256, ...taskPayload } = task;
  assert.equal(sha256(JSON.stringify(taskPayload)), taskSha256, "target task content hash mismatch");
  assert.equal(taskSha256, targetRecord.conditionBinding.taskSha256, "target task binding mismatch");
  assert.equal(task.worldId, target.grouping.worldId, "target task world identity mismatch");
  const facts = reader.bound({ path: task.sourceBindings.naturalizedWorldFactsPath,
    sha256: task.sourceBindings.naturalizedWorldFactsSha256 });
  assert.equal(run.worldFactsPath, facts.parentWorldFacts.path, "naturalized run is not the target's measured source");
  assert.equal(run.worldFactsSha256, facts.parentWorldFacts.sha256, "naturalized source WorldFacts binding mismatch");
  reader.bytes(run.worldFactsPath, run.worldFactsSha256);

  const historicalIndex = reader.bound(historyBinding);
  assert.equal(historicalIndex.schemaVersion, "original-image-library-index-v1");
  const historicalRows = historicalIndex.records.filter(r => r.categoryId === "complete-maps");
  assert.equal(new Set(historicalRows.map(r => r.recordId)).size, historicalRows.length, "duplicate history records");
  const history = [], missing = [];
  for (const row of historicalRows) {
    const record = reader.json(row.recordPath);
    assert.equal(record.recordId, row.recordId, "history record identity mismatch");
    const binding = record.conditionBinding;
    if (!binding?.realEarthRegionSourcePackagePath) { missing.push(row.recordId); continue; }
    // Old records bind a canonical content hash, not the raw artifact hash.
    const region = reader.json(binding.realEarthRegionSourcePackagePath);
    const { packageSha256, ...payload } = region;
    assert.equal(sha256(JSON.stringify(sortKeys(payload))), packageSha256, "historical region content hash mismatch");
    assert.equal(packageSha256, binding.realEarthRegionSourcePackageSha256, "historical region binding mismatch");
    validBounds(region.identity.spatialBounds);
    history.push({ recordId: row.recordId, status: record.status, sourceWindow: region.identity.spatialBounds });
  }
  progress(`historical_region_metadata_complete:${history.length}:${missing.length}`);
  const profiles = candidates.map(candidate => {
    const assignment = { ...candidate, slotId: target.capacitySlotId, monsoonSeason: target.monsoonSeason,
      regionalLandscapeType: rows.find(r => r.sampleId === sampleId).regionalLandscapeType };
    const coarse = buildMeasurementDerivedCoarseHydrologyProfile({ root, assignment, naturalizedRunBinding });
    const layout = buildMeasurementDrivenAnonymousLayoutProfile({ assignment, hasWater: true, coarseHydrologyProfile: coarse });
    return { candidateId: candidate.candidateId, coarseHydrologyProfile: coarse, layoutProfile: layout,
      historicalSourceWindowMatches: history.filter(r => windowsOverlap(candidate.measurementBounds, r.sourceWindow)),
      historicalSourceWindowMatchIsSemanticDuplicateVerdict: false,
      optimizerExposureEstablishedByThisAudit: false, completeGeometryCreated: false };
  });
  for (const file of ["scripts/audit-ai-painter-stage4-replacement-windows.mjs", "scripts/lib/measurement-derived-coarse-hydrology.mjs",
    "scripts/lib/measurement-driven-anonymous-topology.mjs", "scripts/lib/real-earth-region-governance.mjs",
    "scripts/lib/anonymous-water-naturalness.mjs", "scripts/lib/ai-painter-stage4-dataset-audit.mjs"]) reader.bytes(file);
  reader.verifyStable();
  return { schemaVersion: "ai-painter-stage4-replacement-window-prereview-v1",
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short",
      timeStyle: "medium" }).format(new Date()).replace(" ", "T") + "+08:00",
    status: "source_screened_structural_preflight_required",
    datasetManifest: manifestBinding, targetSampleId: sampleId, candidatePool: candidateBinding,
    naturalizedRun: naturalizedRunBinding, historicalLibrarySnapshot: historyBinding,
    selectionBasis: "bound_dataset_rows_and_actual_region_sources_not_historical_plan_assignments",
    counts: { measurementWindows: pool.candidates.length, currentSamples: rows.length,
      windowsNotOverlappingCurrentRelease: screen.filter(c => c.currentReleaseOverlaps.length === 0).length,
      sourceScreenCandidates: candidates.length, historicalCompleteMaps: historicalRows.length,
      historicalRecordsWithRegionBounds: history.length, historicalRecordsWithoutRegionBounds: missing.length },
    screen, candidateProfiles: profiles, historicalRecordsWithoutRegionBounds: missing,
    qualification: { sourceLicensedForNewRelease: false, historicalUseQualified: false, semanticNoveltyQualified: false,
      holdoutQualified: false, preRgbPassed: false, dataQualified: false, trainingAllowed: false },
    remainingChecks: ["candidate_specific_complete_geometry_and_connectivity", "all_history_semantic_and_shape_comparison",
      "historical_use_and_split_independence", "source_license_derivation_and_new_release_review",
      "pre_rgb_gates_then_rgb_generation_and_intake"],
    outputBoundary: { imageGenerationStarted: false, rgbCreated: false, gpuTrainingStarted: false,
      checkpointCreated: false, currentRegistryModified: false, datasetModified: false }, inputReceipts: reader.receipts() };
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, sortKeys(value[k])]));
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: {
      manifest: { type: "string" }, "manifest-sha256": { type: "string" }, sample: { type: "string" },
      candidates: { type: "string" }, "candidates-sha256": { type: "string" },
      "naturalized-run": { type: "string" }, "naturalized-run-sha256": { type: "string" },
      history: { type: "string" }, "history-sha256": { type: "string" }, write: { type: "boolean", default: false },
    } });
    const binding = name => ({ path: values[name], sha256: values[`${name}-sha256`] });
    const report = auditReplacementWindows({ root: process.cwd(), manifestBinding: binding("manifest"),
      candidateBinding: binding("candidates"), naturalizedRunBinding: binding("naturalized-run"),
      historyBinding: binding("history"), sampleId: values.sample,
      progress: message => process.stderr.write(`${new Date().toISOString()} ${message}\n`) });
    const evidence = values.write ? persistAudit(process.cwd(), report) : null;
    process.stdout.write(`${JSON.stringify({ status: report.status, counts: report.counts,
      candidates: report.candidateProfiles.map(p => ({ candidateId: p.candidateId,
        networkMode: p.layoutProfile.internalHydrologyProfile.internalNetworkConnectionMode,
        historicalSourceWindowMatches: p.historicalSourceWindowMatches.map(h => h.recordId) })),
      qualification: report.qualification, evidence }, null, 2)}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
