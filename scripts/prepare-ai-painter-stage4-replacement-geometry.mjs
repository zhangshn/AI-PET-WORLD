import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { createReader, sha256, semanticHistoryMatches } from "./lib/ai-painter-stage4-dataset-audit.mjs";
import { auditReplacementWindows, auditReplacementNeighborContext, auditConsumedSourceWindowIsolation } from "./audit-ai-painter-stage4-replacement-windows.mjs";
import { buildEarthGeospatialCompleteMapConditions } from "./build-earth-geospatial-complete-map-conditions.mjs";
import { buildRealEarthRegionSourcePackage, buildIndependentTrainingRegionConnectivity } from "./lib/real-earth-region-governance.mjs";
import { buildMeasurementDerivedCoarseHydrologyProfile } from "./lib/measurement-derived-coarse-hydrology.mjs";
import { buildCompleteMapSemanticTopologySignature } from "./lib/complete-map-semantic-topology-signature.mjs";
import { readHistoricalGeometry, extractHistoricalGeometry, compareHistoricalGeometry } from "./lib/ai-painter-stage4-historical-geometry.mjs";
import { persistAudit } from "./audit-ai-painter-stage4-split-release.mjs";
import { replayBoundHydrology, analyzeWindowHydrology, deriveWindowHydrologyGraph,
  pairMeasuredHydrologyPorts, traceMeasuredDownstream, replayBoundNaturalization,
  auditMeasuredSourceElevations } from "./lib/measurement-derived-hydrology-routing.mjs";
import { projectMeasuredSingleChannel, bindProjectedWaterConnectivity, finalizeMeasuredGeometryConnectivity, auditMeasuredGeometrySpatial,
  projectMeasuredNeighborChannelPair, auditJointWaterAgainstUpstreamGeometry, rebindJointWaterCompleteGeometry,
  bindMeasuredNeighborConnectivity, auditMeasuredPathSeam, resolveMeasuredNeighborPathPair } from "./lib/measurement-derived-hydrology-projection.mjs";
import { auditBoundHistoricalRgbWater } from "./lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs";
import { rasterizePolygons } from "./lib/current-world-condition-raster.mjs";

const REVISION = "measurement-derived-complete-world-proposal-v1";
const PROGRAMS = ["scripts/prepare-ai-painter-stage4-replacement-geometry.mjs",
  "scripts/build-earth-geospatial-complete-map-conditions.mjs", "scripts/lib/real-earth-region-governance.mjs",
  "scripts/lib/measurement-derived-coarse-hydrology.mjs", "scripts/lib/measurement-driven-anonymous-topology.mjs",
  "scripts/lib/anonymous-route-naturalness.mjs", "scripts/lib/anonymous-water-naturalness.mjs",
  "scripts/lib/measurement-derived-hydrology-routing.mjs", "scripts/lib/measurement-derived-hydrology-projection.mjs",
  "scripts/build-earth-geospatial-soil-hydrology.mjs",
  "scripts/lib/current-world-condition-raster.mjs", "scripts/compile-current-world-visual-conditions.mjs",
  "scripts/lib/complete-map-semantic-topology-signature.mjs", "scripts/lib/ai-painter-stage4-historical-geometry.mjs"];

export function assertReplacementCandidate(report, candidateId) {
  assert.equal(report.schemaVersion, "ai-painter-stage4-replacement-window-prereview-v1", "wrong prereview schema");
  assert.equal(report.status, "source_screened_structural_preflight_required", "prereview is not a source screen");
  assert(report.qualification?.trainingAllowed === false && report.qualification?.preRgbPassed === false,
    "source prereview must not grant training or RGB");
  const candidates = report.candidateProfiles.filter(c => c.candidateId === candidateId);
  assert.equal(candidates.length, 1, "measurement candidate must match exactly one screened identity");
  return candidates[0];
}

export function assertHistoricalTaskBinding(taskBytes, run, binding) {
  assert.equal(sha256(taskBytes), run.taskSha256, "task raw file identity mismatch");
  const task = JSON.parse(taskBytes.toString("utf8"));
  const payload = { ...task }; delete payload.taskSha256;
  assert.equal(task.taskSha256, binding.taskSha256, "task canonical identity mismatch");
  assert.equal(sha256(JSON.stringify(payload)), binding.taskSha256, "task canonical payload mismatch");
  return task;
}

export function extractReplacementDeclaredGeometry(proposal) {
  assert.equal(proposal.schemaVersion, "ai-painter-replacement-geometry-proposal-v1");
  assert.equal(proposal.status, "complete_geometry_proposed_not_pre_rgb_qualified");
  for (const key of ["conditionPackCreated", "imageGenerationStarted", "rgbCreated", "gpuTrainingStarted",
    "trainingAllowed", "runtimeFrameEligible", "canEnterWorld"]) assert.equal(proposal.outputBoundary?.[key], false);
  assert(proposal.worldId === proposal.worldFacts?.worldId && proposal.regionId === proposal.worldFacts?.regionId,
    "proposal WorldFacts identity mismatch");
  const canvas = proposal.geometry?.worldFrameContract?.frameCoverage;
  assert(canvas?.width === 1024 && canvas?.height === 768, "proposal must declare its actual native canvas");
  // In-memory shape projection solely reuses the existing geometry validator.
  // It neither creates a legacy blueprint nor grants task/WorldFacts authority.
  const extracted = extractHistoricalGeometry({ schemaVersion: "ai-assisted-training-world-fact-blueprint-v2",
    canvas, geometry: proposal.geometry });
  return { ...extracted, sourceSchema: proposal.schemaVersion,
    projectionBoundary: "declared_geometry_only_no_blueprint_task_or_worldfacts_qualification" };
}

export function compareReplacementDeclaredGeometry(candidate, historical) {
  return { declaredPolygonMatches: compareHistoricalGeometry(candidate, historical),
    semanticMatches: candidate.signature && historical.signature
      ? semanticHistoryMatches(candidate.signature, historical.signature) : [],
    semanticComparable: Boolean(candidate.signature && historical.signature),
    nearDuplicateQualified: false, allHistoryPassed: false, trainingAllowed: false };
}

export function reviewReplacementHydrology({ root, reportBinding, candidateId, projectWater = false, progress = () => {} }) {
  const reader = createReader(root);
  const baseline = reader.bound(reportBinding);
  const ids = candidateId === undefined ? baseline.candidateProfiles?.map(c => c.candidateId) : [candidateId];
  assert(Array.isArray(ids) && ids.length >= 1 && ids.length <= 2 && new Set(ids).size === ids.length,
    "hydrology review requires one or two explicitly screened candidates");
  for (const id of ids) assertReplacementCandidate(baseline, id);
  for (const file of ["scripts/prepare-ai-painter-stage4-replacement-geometry.mjs",
    "scripts/lib/measurement-derived-hydrology-routing.mjs", "scripts/build-earth-geospatial-soil-hydrology.mjs",
    "scripts/lib/measurement-derived-hydrology-projection.mjs", "scripts/lib/anonymous-water-naturalness.mjs",
    "scripts/build-earth-geospatial-complete-map-conditions.mjs",
    "scripts/tests/test-anonymous-water-flow-direction.mjs", "scripts/tests/test-measurement-derived-hydrology-projection.mjs",
    "scripts/tests/test-measurement-derived-hydrology-routing.mjs", "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
    "scripts/audit-ai-painter-stage4-split-release.mjs", "scripts/audit-ai-painter-stage4-replacement-windows.mjs"])
    reader.bytes(file);
  // Re-check the source selection rather than treating a historical prereview
  // as current data qualification. No images, condition tensors or GPU are used.
  const current = auditReplacementWindows({ root, manifestBinding: baseline.datasetManifest,
    candidateBinding: baseline.candidatePool, naturalizedRunBinding: baseline.naturalizedRun,
    historyBinding: baseline.historicalLibrarySnapshot, sampleId: baseline.targetSampleId, progress });
  for (const receipt of current.inputReceipts) reader.bytes(receipt.path, receipt.sha256);
  const pool = reader.bound(current.candidatePool);
  const currentSourceIndex = reader.bound(reader.bound(current.datasetManifest).sourceIndex);
  const source = replayBoundHydrology({ reader, naturalizedRunBinding: current.naturalizedRun });
  const naturalization = replayBoundNaturalization({ reader, naturalizedRunBinding: current.naturalizedRun });
  reader.bytes("scripts/build-earth-geospatial-naturalized-world-facts.mjs");
  let naturalnessProfile, naturalnessProfileBinding;
  if (projectWater) {
    const manifest = reader.bound(current.datasetManifest), index = reader.bound(manifest.sourceIndex);
    const target = index.samples.find(s => s.sampleId === current.targetSampleId);
    assert(target, "projection baseline sample is missing");
    const record = reader.bound(target.sourceRecord);
    const runPath = path.posix.normalize(path.posix.join(path.posix.dirname(record.conditionBinding.taskPackagePath),
      "..", "complete-map-condition-run.json"));
    const historicalRun = reader.json(runPath);
    assertHistoricalTaskBinding(reader.bytes(record.conditionBinding.taskPackagePath, historicalRun.taskSha256),
      historicalRun, record.conditionBinding);
    naturalnessProfileBinding = { path: historicalRun.waterNaturalnessProfilePath,
      sha256: historicalRun.waterNaturalnessProfileSha256 };
    naturalnessProfile = reader.bound(naturalnessProfileBinding);
  }
  progress("bound_hydrology_arrays_and_flow_conservation_verified");
  const candidates = ids.map(id => {
    assertReplacementCandidate(current, id);
    const matches = pool.candidates.filter(c => c.candidateId === id);
    assert.equal(matches.length, 1, "candidate pool identity is ambiguous");
    const result = analyzeWindowHydrology({ ...source, sourceWindow: matches[0].sourcePixelWindow });
    const sourceGraph = deriveWindowHydrologyGraph({ ...source, sourceWindow: matches[0].sourcePixelWindow });
    const neighborPairing = pairMeasuredHydrologyPorts({ candidateId: id, candidates: pool.candidates,
      graph: sourceGraph, routing: source.routing, sourceGrid: source.sourceGrid });
    const sourceContext = auditReplacementNeighborContext({ candidates: pool.candidates, rows: currentSourceIndex.samples,
      sampleId: current.targetSampleId, candidateId: id, neighborPairing });
    const downstreamTraces = sourceGraph.ports.filter(p => p.role === "outlet").map(p => {
      const trace = traceMeasuredDownstream({ ...source, candidates: pool.candidates, startCell: p.sourceCell });
      const localNaturalization = trace.cells.map(cell => {
        const x0 = cell.cell % source.routing.width * 4, y0 = Math.floor(cell.cell / source.routing.width) * 4;
        const categories = {}, before = {}, after = {};
        for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) {
          const i = y * source.sourceGrid.width + x;
          before[naturalization.raw[i]] = (before[naturalization.raw[i]] ?? 0) + 1;
          after[naturalization.reconstructed[i]] = (after[naturalization.reconstructed[i]] ?? 0) + 1;
          for (const [name, mask] of naturalization.masks) categories[name] = (categories[name] ?? 0) + Number(mask[i] > 0);
        }
        return { cell: cell.cell, categories, before, after };
      });
      return { sourcePortId: p.nodeId, ...trace, localNaturalization,
        naturalizationScope: "verified_land_cover_only_not_physical_hydrology_qualification",
        encounteredMaskCategoryCounts: Object.fromEntries([...naturalization.masks.keys()].map(name =>
          [name, localNaturalization.filter(c => c.categories[name] > 0).length])) };
    });
    let projection = null;
    if (projectWater) {
      try { projection = projectMeasuredSingleChannel({ sourceGraph, neighborPairing, candidateId: id,
        naturalnessProfile, naturalnessProfileBinding }); }
      catch (error) { projection = { status: "hydrology_projection_failed_closed", errorMessage: error.message,
        trainingAllowed: false, worldFactsQualified: false, rgbCreated: false }; }
    }
    progress(`source_boundary_crossings_verified:${id}`);
    return { candidateId: id, ...result, sourceGraph, neighborPairing, sourceContext, downstreamTraces, projection };
  });
  reader.verifyStable();
  const now = new Date();
  return { schemaVersion: "ai-painter-replacement-hydrology-source-review-v6",
    createdAtUtc: now.toISOString(), createdAtAsiaShanghai: now.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }) + " +08:00",
    status: "source_graph_and_neighbors_replayed_worldfacts_and_projection_pending", sourcePrereview: reportBinding,
    candidatePool: current.candidatePool, source: { ...source.evidence, naturalizationReplay: naturalization.evidence }, candidates, inputReceipts: reader.receipts(),
    remainingChecks: ["current_region_scoped_hydrology_contract", "naturalization_and_upstream_catchment_qualification",
      "real_neighbor_connectivity", "source_context_and_split_independence", "anonymous_game_topology_preserving_projection", "condition_rgb_and_all_history_qualification"],
    outputBoundary: { preRgbPassed: false, worldFactsQualified: false, conditionPackCreated: false,
      imageGenerationStarted: false, rgbCreated: false, gpuTrainingStarted: false, trainingAllowed: false,
      datasetModified: false, currentRegistryModified: false, canEnterWorld: false } };
}

export function reviewReplacementNeighborWater({ root, reportBinding, progress = () => {} }) {
  const reader = createReader(root), producer = reader.bound(reportBinding);
  assert.equal(producer.schemaVersion, "ai-painter-replacement-geometry-audit-v1");
  assert.equal(producer.status, "complete_geometry_proposed_pre_rgb_blocked");
  assert(producer.outputBoundary?.trainingAllowed === false && producer.outputBoundary.preRgbPassed === false);
  const baseline = reader.bound(producer.sourcePrereview);
  assertReplacementCandidate(baseline, producer.candidateId);
  const current = auditReplacementWindows({ root, manifestBinding: baseline.datasetManifest,
    candidateBinding: baseline.candidatePool, naturalizedRunBinding: baseline.naturalizedRun,
    historyBinding: baseline.historicalLibrarySnapshot, sampleId: baseline.targetSampleId, progress });
  for (const receipt of current.inputReceipts) reader.bytes(receipt.path, receipt.sha256);
  assertReplacementCandidate(current, producer.candidateId);
  for (const file of [...PROGRAMS, "scripts/audit-ai-painter-stage4-replacement-windows.mjs",
    "scripts/lib/ai-painter-stage4-dataset-audit.mjs", "scripts/audit-ai-painter-stage4-split-release.mjs",
    "scripts/tests/test-measurement-derived-hydrology-projection.mjs", "scripts/tests/test-ai-painter-stage4-replacement-geometry.mjs"])
    reader.bytes(file);
  const output = suffix => { const matches = producer.outputs.filter(o => o.path.endsWith(suffix));
    assert.equal(matches.length, 1, `producer requires one bound output:${suffix}`); return reader.bound(matches[0]); };
  const projection = output("/measured-water-projection.json"), geometry = output("/complete-geometry-proposal.json");
  assert.equal(projection.candidateId, producer.candidateId);
  assert.equal(geometry.regionId, `training-world:thailand-mvp:replacement-${producer.inputIdentity}`);
  const source = replayBoundHydrology({ reader, naturalizedRunBinding: current.naturalizedRun });
  const candidates = reader.bound(current.candidatePool).candidates;
  const rows = reader.bound(reader.bound(current.datasetManifest).sourceIndex).samples;
  const graphFor = id => {
    const matches = candidates.filter(c => c.candidateId === id); assert.equal(matches.length, 1);
    return deriveWindowHydrologyGraph({ ...source, sourceWindow: matches[0].sourcePixelWindow });
  };
  const sourceGraph = graphFor(producer.candidateId);
  const storedHydrology = output("/source-hydrology-graph.json");
  assertBoundHydrologyReplay(storedHydrology, sourceGraph, source.evidence);
  const neighborPairing = pairMeasuredHydrologyPorts({ ...source, candidates, candidateId: producer.candidateId, graph: sourceGraph });
  assert.equal(sha256(JSON.stringify(neighborPairing)), sha256(JSON.stringify(storedHydrology.neighborPairing)),
    "upstream measured neighbor pairing no longer reproduces");
  assert(neighborPairing.gaps.length === 0 && neighborPairing.pairs.length === 1, "upstream has no unique measured neighbor");
  const neighborId = neighborPairing.pairs[0].neighborCandidateId, neighborGraph = graphFor(neighborId);
  const nextPairing = pairMeasuredHydrologyPorts({ ...source, candidates, candidateId: neighborId, graph: neighborGraph });
  const context = [
    auditReplacementNeighborContext({ candidates, rows, sampleId: current.targetSampleId,
      candidateId: producer.candidateId, neighborPairing }),
    auditReplacementNeighborContext({ candidates, rows, sampleId: current.targetSampleId,
      candidateId: neighborId, neighborPairing: nextPairing })];
  progress("current_source_graph_and_both_neighbor_port_pairs_replayed");
  let joint = null, upstreamSpatial = null, failure = null;
  try {
    joint = projectMeasuredNeighborChannelPair({ upstreamProjection: projection, sourceGraph, neighborPairing, neighborGraph, nextPairing,
      naturalnessProfile: reader.bound(projection.naturalnessProfileBinding), naturalnessProfileBinding: projection.naturalnessProfileBinding });
    upstreamSpatial = auditJointWaterAgainstUpstreamGeometry(geometry, joint, projection);
  } catch (error) { failure = { code: "joint_neighbor_water_failed_closed", message: error.message }; }
  progress(failure ? failure.code : "native_joint_water_and_upstream_path_impact_checked");
  reader.verifyStable();
  return { schemaVersion: "ai-painter-replacement-neighbor-water-review-v1", createdAtUtc: new Date().toISOString(),
    status: failure || !upstreamSpatial?.passed ? "neighbor_water_review_failed_closed" : "local_water_pair_passed_full_region_and_data_qualification_pending",
    sourceReport: reportBinding, sourcePrereview: producer.sourcePrereview, source: source.evidence,
    candidateId: producer.candidateId, sourceGraph, neighborGraph, neighborPairing, nextPairing, context,
    joint, upstreamSpatial, failure, inputReceipts: reader.receipts(),
    remainingChecks: ["current_region_scoped_hydrology_contract", "naturalization_and_source_context_split_qualification",
      "rebind_complete_geometry_to_joint_surface", "full_neighbor_geometry_and_downstream_connectivity",
      "condition_package_and_all_history_semantic_novelty", "rgb_and_training_data_qualification"],
    outputBoundary: { sourceCoordinatesUsedAsGamePositions: false, datasetModified: false, currentRegistryModified: false,
      fullNeighborGeometryCreated: false, worldFactsQualified: false, preRgbPassed: false, conditionPackCreated: false,
      rgbCreated: false, gpuTrainingStarted: false, trainingAllowed: false, canEnterWorld: false } };
}

export function reviewJointWaterGeometryRebind({ root, reportBinding, progress = () => {} }) {
  const reader = createReader(root), sourceReport = reader.bound(reportBinding);
  const isRoundReport = sourceReport.schemaVersion === "ai-painter-stage4-cpu-progress-evidence-v2";
  const prior = isRoundReport ? sourceReport.neighborReview : sourceReport;
  assert.equal(prior?.schemaVersion, "ai-painter-replacement-neighbor-water-review-v1");
  assert.equal(prior.status, "local_water_pair_passed_full_region_and_data_qualification_pending");
  assert(prior.outputBoundary.trainingAllowed === false && prior.outputBoundary.preRgbPassed === false);
  // Replay current source bytes and algorithms; the saved passed flag above is
  // only a schema/state filter and cannot qualify the new revision.
  const current = reviewReplacementNeighborWater({ root, reportBinding: prior.sourceReport, progress });
  assert.equal(current.status, "local_water_pair_passed_full_region_and_data_qualification_pending");
  assert.equal(current.joint.projectionSha256, prior.joint.projectionSha256, "joint projection changed; require fresh paired evidence");
  for (const r of current.inputReceipts) reader.bytes(r.path, r.sha256);
  const programs = PROGRAMS.map(path => ({ path, sha256: sha256(reader.bytes(path)) }));
  const producer = reader.bound(prior.sourceReport);
  const output = suffix => { const matches = producer.outputs.filter(r => r.path.endsWith(suffix));
    assert.equal(matches.length, 1); return reader.bound(matches[0]); };
  const now = new Date(), rebound = rebindJointWaterCompleteGeometry({
    proposal: output("/complete-geometry-proposal.json"), connectivity: output("/regional-connectivity-proposal.json"),
    upstreamProjection: output("/measured-water-projection.json"), joint: current.joint,
    programBindings: programs, createdAtUtc: now.toISOString() });
  progress("complete_geometry_revision_identities_and_native_spatial_checks_passed");
  reader.verifyStable();
  return { schemaVersion: "ai-painter-joint-water-complete-geometry-rebind-review-v1",
    createdAtUtc: now.toISOString(), createdAtAsiaShanghai: now.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }) + " +08:00",
    status: "complete_geometry_rebound_local_checks_passed_neighbor_and_data_qualification_pending",
    sourceReport: reportBinding, sourceReportJsonPointer: isRoundReport ? "/neighborReview" : "",
    originalGeometryProducer: prior.sourceReport, candidateId: current.candidateId,
    sourceReplay: current.source, sourceContext: current.context,
    sourceJointProjectionSha256: current.joint.projectionSha256, rebound,
    inputReceipts: reader.receipts(), remainingChecks: ["full_neighbor_geometry_and_downstream_connectivity",
      "current_region_scoped_hydrology_contract", "naturalization_and_source_context_split_qualification",
      "current_condition_package_and_all_history_semantic_novelty", "rgb_and_current_candidate_training_qualification"],
    outputBoundary: { sameLogicalMapRevision: true, countsAsAdditionalSample: false, originalEvidenceModified: false,
      datasetModified: false, splitChanged: false, modelModified: false, conditionPackCreated: false, rgbCreated: false,
      gpuTrainingStarted: false, worldFactsQualified: false, preRgbPassed: false, trainingAllowed: false,
      currentRegistryModified: false, canEnterWorld: false } };
}

export function assertBoundHydrologyReplay(stored, sourceGraph, evidence) {
  assert(stored?.sourceGraph && stored?.evidence && stored?.neighborPairing, "bound source hydrology envelope is incomplete");
  assert.equal(sha256(JSON.stringify(sourceGraph)), sha256(JSON.stringify(stored.sourceGraph)), "upstream source graph no longer reproduces");
  assert.equal(sha256(JSON.stringify(evidence)), sha256(JSON.stringify(stored.evidence)), "source hydrology array replay differs");
}

export function reviewReplacementSourceBoundary({ root, reportBinding, progress = () => {} }) {
  const reader = createReader(root), prior = reader.bound(reportBinding);
  assert.equal(prior.schemaVersion, "ai-painter-stage4-cpu-neighbor-path-pair-progress-v1");
  const upstreamReport = reader.bound(prior.upstreamReport), neighborReport = reader.bound(prior.neighborReport);
  assert.deepEqual(neighborReport.sourceReport, prior.upstreamReport, "neighbor does not bind the selected upstream revision");
  const pair = resolveMeasuredNeighborPathPair({ upstream: upstreamReport.rebound, neighbor: neighborReport,
    programBindings: prior.pair.identityPayload.programBindings, createdAtUtc: prior.pair.upstream.proposal.createdAtUtc });
  assert.deepEqual(pair, prior.pair, "current complete path pair does not reproduce");
  const localPathAudit = auditMeasuredPathSeam(pair.upstream, pair.neighbor);
  progress("current_two_region_path_geometry_reproduced");
  const current = reviewReplacementNeighborWater({ root, reportBinding: upstreamReport.originalGeometryProducer, progress });
  assert.equal(current.joint?.projectionSha256, pair.identityPayload.jointWaterProjectionSha256);
  for (const r of current.inputReceipts) reader.bytes(r.path, r.sha256);
  const producer = reader.bound(upstreamReport.originalGeometryProducer), baseline = reader.bound(producer.sourcePrereview);
  const manifest = reader.bound(baseline.datasetManifest), sourceIndex = reader.bound(manifest.sourceIndex);
  const candidates = reader.bound(baseline.candidatePool).candidates;
  const source = replayBoundHydrology({ reader, naturalizedRunBinding: baseline.naturalizedRun });
  const naturalization = replayBoundNaturalization({ reader, naturalizedRunBinding: baseline.naturalizedRun });
  const ids = [current.joint.sourceCandidateId, current.joint.neighborCandidateId, current.joint.downstreamCandidateId];
  assert.equal(new Set(ids).size, 3, "source boundary review requires three distinct measured windows");
  const regions = ids.map(candidateId => {
    const candidate = candidates.find(c => c.candidateId === candidateId); assert(candidate);
    const graph = deriveWindowHydrologyGraph({ ...source, sourceWindow: candidate.sourcePixelWindow });
    return { candidateId, sourceWindow: candidate.sourcePixelWindow, graph,
      pairing: pairMeasuredHydrologyPorts({ ...source, candidates, candidateId, graph }),
      elevationSupport: auditMeasuredSourceElevations({ ...source, graph }) };
  });
  assert.equal(regions[0].elevationSupport.sourceGraphSha256, current.joint.sourceGraphIdentity);
  assert.equal(regions[1].elevationSupport.sourceGraphSha256, current.joint.neighborGraphIdentity);
  const boundaryElevations = [];
  for (let i = 0; i < 2; i++) {
    const a = regions[i], b = regions[i + 1];
    const pairing = a.pairing.pairs.find(p => p.neighborCandidateId === b.candidateId && p.sourceRole === "outlet");
    assert(pairing, "expected downstream pairing missing");
    const matching = b.graph.ports.filter(p => p.role === "inlet" && p.sourceCell === pairing.neighborSourceCell &&
      p.receiverCell === pairing.neighborReceiverCell && p.point.x === pairing.neighborIntersection.x && p.point.y === pairing.neighborIntersection.y);
    assert.equal(matching.length, 1, "downstream elevation port is ambiguous or missing");
    const outlet = a.elevationSupport.nodes.find(n => n.nodeId === pairing.sourcePortId);
    const inlet = b.elevationSupport.nodes.find(n => n.nodeId === matching[0].nodeId);
    assert.equal(outlet.elevationMetres, inlet.elevationMetres, "paired source boundary elevations differ");
    boundaryElevations.push({ upstreamCandidateId: a.candidateId, downstreamCandidateId: b.candidateId,
      outlet, inlet, matched: true, interpretation: "derived_source_elevation_support_not_game_height_field" });
  }
  const cellEvidence = cell => {
    assert(Number.isInteger(cell) && cell >= 0 && cell < source.routing.receiver.length);
    const left = cell % source.routing.width * 4, top = Math.floor(cell / source.routing.width) * 4;
    const before = {}, after = {}, maskPixels = Object.fromEntries([...naturalization.masks.keys()].map(k => [k, 0]));
    for (let y = top; y < top + 4; y++) for (let x = left; x < left + 4; x++) {
      const i = y * source.sourceGrid.width + x;
      before[naturalization.raw[i]] = (before[naturalization.raw[i]] ?? 0) + 1;
      after[naturalization.reconstructed[i]] = (after[naturalization.reconstructed[i]] ?? 0) + 1;
      for (const [k, mask] of naturalization.masks) maskPixels[k] += Number(mask[i] > 0);
    }
    return { cell, sourcePixelFootprint: { left, top, width: 4, height: 4 }, before, after, maskPixels,
      excludedFromCurrentSourceGraph: source.excludedCells[cell] > 0 };
  };
  const breaks = regions.flatMap(r => r.graph.gaps.filter(g => g.code === "supported_channel_ends_without_boundary_outlet")
    .map(g => ({ candidateId: r.candidateId, code: g.code, source: cellEvidence(g.sourceCell),
      receiver: g.receiverCell >= 0 ? cellEvidence(g.receiverCell) : null })));
  for (const [v, id, primary] of [[pair.upstream, ids[0], true], [pair.neighbor, ids[1], false]]) {
    const expected = candidates.find(c => c.candidateId === id).fingerprints.direct;
    assert.equal(v.proposal.geometry.geometryDerivation.measurementSupportFingerprint, expected);
    assert.equal((primary ? v.proposal.worldFacts.v7SlotBinding : v.proposal.worldFacts.neighborContextBinding).candidateId, id);
  }
  // These are material generator dependencies, not an audit's incidental
  // neighborhood discovery: the joint projection identity consumes both graphs
  // and nextPairing, and complete neighbor geometry consumes its own facts.
  const isolation = auditConsumedSourceWindowIsolation({ candidates, rows: sourceIndex.samples, sampleId: baseline.targetSampleId,
    uses: [{ candidateId: ids[0], purpose: "primary_region_geometry", inputSha256: current.joint.sourceGraphIdentity },
      { candidateId: ids[1], purpose: "neighbor_joint_geometry", inputSha256: current.joint.neighborGraphIdentity },
      { candidateId: ids[2], purpose: "boundary_flow_pairing", inputSha256: current.joint.nextPairingIdentity }] });
  assert.equal(sha256(JSON.stringify(regions[1].pairing)), current.joint.nextPairingIdentity);
  progress("downstream_graph_breaks_elevation_support_and_consumed_source_windows_checked");
  const blockers = [];
  for (const r of regions) if (!r.elevationSupport.sourceGraphComplete)
    blockers.push({ code: "downstream_source_graph_incomplete", candidateId: r.candidateId, details: r.graph.gaps });
  if (!isolation.sourceWindowIsolationPassed)
    blockers.push({ code: "cross_split_consumed_source_window", details: isolation.conflicts });
  if (breaks.some(b => b.receiver?.excludedFromCurrentSourceGraph))
    blockers.push({ code: "removed_cell_hydrology_reconstruction_not_established", details: breaks,
      landCoverReconstructionIsNotHydrologyReconstruction: true });
  const alternatives = baseline.candidateProfiles.filter(p => p.candidateId !== ids[0]).map(p => {
    assertReplacementCandidate(baseline, p.candidateId);
    const candidate = candidates.find(c => c.candidateId === p.candidateId); assert(candidate);
    const graph = deriveWindowHydrologyGraph({ ...source, sourceWindow: candidate.sourcePixelWindow });
    const pairing = pairMeasuredHydrologyPorts({ ...source, candidates, candidateId: p.candidateId, graph });
    return { candidateId: p.candidateId, graph, pairing,
      potentialContext: auditReplacementNeighborContext({ candidates, rows: sourceIndex.samples,
        sampleId: baseline.targetSampleId, candidateId: p.candidateId, neighborPairing: pairing }),
      interpretation: "existing_screened_alternative_preflight_only_not_new_generator_consumption",
      fallbackGenerationAttempted: false, sourceQualificationEstablished: false };
  });
  for (const path of [...PROGRAMS, "scripts/audit-ai-painter-stage4-replacement-windows.mjs",
    "scripts/tests/test-ai-painter-stage4-replacement-windows.mjs", "scripts/tests/test-measurement-derived-hydrology-routing.mjs",
    "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", "docs/game-world-generation/FLOWING_WATER_CONNECTIVITY_AND_NOVELTY_SPEC.md"])
    reader.bytes(path);
  reader.verifyStable();
  return { schemaVersion: "ai-painter-replacement-source-boundary-review-v1", createdAtUtc: new Date().toISOString(),
    status: blockers.length ? "replacement_source_qualification_blocked" : "source_boundary_checks_passed_remaining_qualification_pending",
    sourceReport: reportBinding, datasetManifest: baseline.datasetManifest, sourceIndex: manifest.sourceIndex,
    targetSampleId: baseline.targetSampleId, targetCandidateId: ids[0],
    jointProjectionSha256: current.joint.projectionSha256, pathPairRevisionIdentity: pair.pathPairRevisionIdentity,
    localPathAudit, sourceReplay: source.evidence, naturalizationReplay: naturalization.evidence,
    regions, boundaryElevations, breaks, sourceWindowIsolation: isolation, blockers, alternatives,
    nextAction: blockers.length ? "retain_cpu_geometry_as_diagnostic_do_not_compile_or_qualify_this_branch" : "remaining_source_and_condition_qualification",
    remainingChecks: ["naturalized_hydrology_reconstruction", "dependency_aware_source_split_isolation",
      "current_region_scoped_hydrology_contract", "condition_package_and_all_history_semantic_novelty", "foundation_and_current_candidate_training_qualification"],
    inputReceipts: reader.receipts(), outputBoundary: { sourceRegionExpanded: false, completeGeometryCreated: false,
      datasetModified: false, splitChanged: false, modelModified: false, currentRegistryModified: false,
      neighborRgbUsedByGenerator: false, optimizerExposureEstablished: false, conditionPackCreated: false,
      rgbCreated: false, gpuTrainingStarted: false, checkpointCreated: false, worldFactsQualified: false, trainingAllowed: false, canEnterWorld: false } };
}

export async function reviewReplacementNeighborGeometry({ root, reportBinding, progress = () => {} }) {
  const reader = createReader(root), rebind = reader.bound(reportBinding);
  assert.equal(rebind.schemaVersion, "ai-painter-joint-water-complete-geometry-rebind-review-v1");
  assert.equal(rebind.status, "complete_geometry_rebound_local_checks_passed_neighbor_and_data_qualification_pending");
  const upstream = rebind.rebound;
  assert(auditMeasuredGeometrySpatial(upstream.proposal, upstream.connectivity, upstream.waterProjection).localSpatialPassed);
  const current = reviewReplacementNeighborWater({ root, reportBinding: rebind.originalGeometryProducer, progress });
  assert.equal(current.joint?.projectionSha256, rebind.sourceJointProjectionSha256, "current source no longer reproduces joint surface");
  for (const r of current.inputReceipts) reader.bytes(r.path, r.sha256);
  const producer = reader.bound(rebind.originalGeometryProducer), baseline = reader.bound(producer.sourcePrereview);
  const output = suffix => { const matches = producer.outputs.filter(o => o.path.endsWith(suffix));
    assert.equal(matches.length, 1); return reader.bound(matches[0]); };
  const pool = reader.bound(baseline.candidatePool);
  const candidate = pool.candidates.find(c => c.candidateId === current.joint.neighborCandidateId);
  assert(candidate, "actual measured neighbor is absent from bound candidate pool");
  assert.deepEqual(candidate.sourcePixelWindow, current.neighborGraph.sourceWindow);
  const priorAssignment = output("/measurement-window-plan.json").assignments[0];
  const assignment = { ...candidate, slotId: priorAssignment.slotId, split: null,
    monsoonSeason: priorAssignment.monsoonSeason, regionalLandscapeType: priorAssignment.regionalLandscapeType,
    regionalLandscapeTypeStatus: "requested_neighbor_context_theme_not_qualified", requiredEntranceDirection: "west",
    coverageRole: "neighbor_geometry_context_not_capacity_sample", imageGenerationAuthorized: false, gpuTrainingAuthorized: false };
  const sourcePackage = output("/real-earth-region-source-package.json"), provenance = sourcePackage.sourceProvenance;
  const snapshots = Object.fromEntries(["worldProfile", "factualReference", "seasonSnapshot"].map(key => [key,
    reader.bound({ path: provenance[`${key}Path`], sha256: provenance[`${key}Sha256`] })]));
  const parentWorldFactRun = reader.bound(baseline.naturalizedRun);
  const parentWorldFacts = reader.bound({ path: parentWorldFactRun.worldFactsPath, sha256: parentWorldFactRun.worldFactsSha256 });
  const profiles = producer.inputReceipts.filter(r => r.path.endsWith("/route-naturalness-reference-profile.json"));
  assert.equal(profiles.length, 1, "bound route naturalness profile missing or ambiguous");
  const routeNaturalnessProfile = reader.bound(profiles[0]);
  const waterNaturalnessProfile = reader.bound(current.joint.naturalnessProfileBinding);
  const coarseHydrologyProfile = buildMeasurementDerivedCoarseHydrologyProfile({ root, assignment, naturalizedRunBinding: baseline.naturalizedRun });
  const programs = PROGRAMS.map(path => ({ path, sha256: sha256(reader.bytes(path)) }));
  const context = { schemaVersion: "measured-neighbor-geometry-context-v1", role: "neighbor_geometry_context_not_capacity_sample",
    parentSampleId: baseline.targetSampleId, candidateId: candidate.candidateId, candidatePool: baseline.candidatePool,
    sourcePixelWindow: candidate.sourcePixelWindow, measurementBounds: candidate.measurementBounds,
    measurementFingerprint: candidate.fingerprints.direct, upstreamGeometryReport: reportBinding,
    sourceContextSplitQualified: false, countsAsAdditionalSample: false, split: null };
  const inputIdentity = sha256(JSON.stringify({ context, jointProjectionSha256: current.joint.projectionSha256, programs }));
  let prepared = null, proposal = null, connectivity = null, spatial = null, failure = null;
  try {
    const base = buildIndependentTrainingRegionConnectivity({ slotId: assignment.slotId, assignment,
      worldProfileId: snapshots.worldProfile.worldProfileId, sourcePackage, width: 1024, height: 768, hasWater: true,
      anonymousCompositionArchitectureRevision: REVISION, regionIdentity: upstream.waterProjection.neighborId });
    prepared = bindMeasuredNeighborConnectivity({ connectivity: base, upstream, joint: current.joint });
    connectivity = prepared.connectivity;
    progress(`neighbor_complete_geometry_build_started:${candidate.candidateId}`);
    proposal = await buildEarthGeospatialCompleteMapConditions({ replacementGeometryInput: {
      schemaVersion: "ai-painter-replacement-geometry-input-v1", conditionId: `neighbor-context-${inputIdentity}`, seedHex: inputIdentity,
      regionId: upstream.waterProjection.neighborId, worldId: upstream.proposal.worldId,
      parentWorldFacts, parentWorldFactRun, connectivity, waterProjection: prepared.waterProjection,
      coarseHydrologyProfile, routeNaturalnessProfile, waterNaturalnessProfile, neighborContext: context,
      slotContext: { assignment, worldProfile: snapshots.worldProfile, factualReference: snapshots.factualReference,
        snapshot: snapshots.seasonSnapshot, snapshotPath: provenance.seasonSnapshotPath } } });
    ({ connectivity, proposal } = finalizeMeasuredGeometryConnectivity(connectivity, proposal));
    spatial = auditMeasuredGeometrySpatial(proposal, connectivity, prepared.waterProjection);
    assert(spatial.localSpatialPassed, `neighbor native spatial checks failed:${spatial.issues.join(",")}`);
    progress("neighbor_complete_geometry_native_spatial_checks_passed");
  } catch (error) {
    failure = { code: "measured_neighbor_complete_geometry_failed_closed", message: error.message, stack: error.stack };
    progress(`${failure.code}:${error.message.split(": {")[0].slice(0, 300)}`);
  }
  reader.verifyStable();
  return { schemaVersion: "ai-painter-replacement-neighbor-complete-geometry-review-v1", createdAtUtc: new Date().toISOString(),
    status: failure ? "neighbor_complete_geometry_failed_closed" : "neighbor_complete_geometry_local_spatial_passed_pair_binding_pending",
    sourceReport: reportBinding, inputIdentity, candidateId: candidate.candidateId, context,
    jointProjectionSha256: current.joint.projectionSha256, sourceReplay: current.source, sourceContext: current.context,
    proposal, connectivity, waterProjection: prepared?.waterProjection ?? null, nativeSpatialAudit: spatial, failure,
    inputReceipts: reader.receipts(),
    remainingChecks: ["actual_path_seam_and_bidirectional_upstream_stub_replacement", "downstream_neighbor_geometry",
      "current_region_scoped_hydrology_contract", "naturalization_and_source_context_split_qualification",
      "condition_package_and_all_history_semantic_novelty", "rgb_and_current_candidate_training_qualification"],
    outputBoundary: { fullNeighborGeometryCreated: proposal !== null, countsAsAdditionalSample: false,
      upstreamGeometryModified: false, originalEvidenceModified: false, datasetModified: false, splitChanged: false, modelModified: false,
      currentRegistryModified: false, worldGraphConnected: false, worldFactsQualified: false, preRgbPassed: false,
      conditionPackCreated: false, rgbCreated: false, gpuTrainingStarted: false, trainingAllowed: false, canEnterWorld: false } };
}

export function reviewReplacementGeometry({ root, reportBindings, progress = () => {} }) {
  assert(Array.isArray(reportBindings) && reportBindings.length >= 1 && reportBindings.length <= 2,
    "bounded review requires one or two explicit generated candidates");
  const reader = createReader(root), candidates = [], changedPrograms = [];
  let historyBinding;
  for (const binding of reportBindings) {
    const previous = reader.bound(binding);
    assert.equal(previous.schemaVersion, "ai-painter-replacement-geometry-audit-v1");
    assert.equal(previous.status, "complete_geometry_proposed_pre_rgb_blocked");
    assert(previous.outputBoundary?.preRgbPassed === false && previous.outputBoundary.trainingAllowed === false);
    for (const receipt of previous.inputReceipts) {
      if (receipt.path.startsWith("scripts/")) {
        const currentHash = sha256(reader.bytes(receipt.path));
        if (currentHash !== receipt.sha256) changedPrograms.push({ report: binding, path: receipt.path,
          producerSha256: receipt.sha256, reviewerSha256: currentHash });
      } else reader.bytes(receipt.path, receipt.sha256);
    }
    const prereview = reader.bound(previous.sourcePrereview);
    if (historyBinding) assert.deepEqual(prereview.historicalLibrarySnapshot, historyBinding);
    historyBinding = prereview.historicalLibrarySnapshot;
    const outputs = previous.outputs.filter(output => output.path.endsWith("/complete-geometry-proposal.json"));
    assert.equal(outputs.length, 1, "exactly one immutable generated geometry is required");
    const proposal = reader.bound(outputs[0]);
    assert.equal(proposal.regionId, `training-world:thailand-mvp:replacement-${previous.inputIdentity}`);
    const geometry = extractReplacementDeclaredGeometry(proposal);
    candidates.push({ candidateId: previous.candidateId, sourceReport: binding, proposal: outputs[0], geometry,
      matches: [], counts: { declaredPolygonCompared: 0, semanticCompared: 0 } });
  }
  assert.equal(new Set(candidates.map(c => c.candidateId)).size, candidates.length, "candidate identities must be distinct");
  const index = reader.bound(historyBinding);
  const rows = index.records.filter(r => r.categoryId === "complete-maps");
  assert.equal(rows.length, 280, "historical corpus changed; require a fresh source screen");
  assert.equal(new Set(rows.map(r => r.recordId)).size, rows.length);
  const gaps = [], polygonOnly = [];
  for (const row of rows) {
    let historical;
    try {
      const record = reader.json(row.recordPath);
      assert.equal(record.recordId, row.recordId, "historical index/record identity mismatch");
      historical = readHistoricalGeometry(reader, record);
    } catch (error) {
      gaps.push({ recordId: row.recordId, code: error.code ?? "historical_geometry_read_failed", detail: error.message });
      continue;
    }
    if (!historical.signature) polygonOnly.push({ recordId: row.recordId, sourceSchema: historical.sourceSchema,
      missingTopologyFields: historical.missingTopologyFields });
    for (const candidate of candidates) {
      const comparison = compareReplacementDeclaredGeometry(candidate.geometry, historical);
      candidate.counts.declaredPolygonCompared++;
      if (comparison.semanticComparable) candidate.counts.semanticCompared++;
      if (comparison.declaredPolygonMatches.length || comparison.semanticMatches.length)
        candidate.matches.push({ recordId: row.recordId, ...comparison });
    }
  }
  for (const file of [...PROGRAMS, "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
    "scripts/audit-ai-painter-stage4-split-release.mjs", "scripts/tests/test-ai-painter-stage4-replacement-geometry.mjs"])
    reader.bytes(file);
  reader.verifyStable();
  progress(`declared_geometry_history_review_finished:${rows.length - gaps.length}:${polygonOnly.length}:${gaps.length}`);
  const timestamp = new Date();
  return { schemaVersion: "ai-painter-replacement-declared-geometry-review-v1",
    createdAtUtc: timestamp.toISOString(), createdAtAsiaShanghai: timestamp.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }) + " +08:00",
    status: "declared_geometry_review_completed_pre_rgb_blocked", historicalLibrarySnapshot: historyBinding,
    candidates: candidates.map(({ geometry, ...candidate }) => ({ ...candidate,
      geometryCounts: geometry.counts, ecologicalZonesWithoutGeometry: geometry.ecologicalZonesWithoutGeometry })),
    pairwise: candidates.length === 2 ? { left: candidates[0].candidateId, right: candidates[1].candidateId,
      ...compareReplacementDeclaredGeometry(candidates[0].geometry, candidates[1].geometry) } : null,
    polygonOnly, gaps, changedPrograms,
    limitations: ["exact_polygon_vertex_and_mirror_rotate_180_comparison_is_not_translation_scale_or_near_duplicate_qualification",
      "missing_historical_topology_not_reconstructed_or_waived", "regional_connectivity_and_worldfacts_not_formally_qualified",
      "condition_pack_and_source_split_independence_not_yet_qualified", "no_rgb_or_training_permitted"],
    outputBoundary: { preRgbPassed: false, conditionPackCreated: false, rgbCreated: false, gpuTrainingStarted: false,
      trainingAllowed: false, datasetModified: false, currentRegistryModified: false }, inputReceipts: reader.receipts() };
}

export async function reviewReplacementHistoricalRgbWater({ root, reportBinding, progress = () => {} }) {
  const reader = createReader(root), previous = reader.bound(reportBinding);
  const revised = previous.schemaVersion === "ai-painter-joint-water-complete-geometry-rebind-review-v1";
  const producer = revised ? reader.bound(previous.originalGeometryProducer) : previous;
  assert.equal(producer.schemaVersion, "ai-painter-replacement-geometry-audit-v1");
  assert.equal(producer.status, "complete_geometry_proposed_pre_rgb_blocked");
  const output = suffix => {
    const matches = producer.outputs.filter(o => o.path.endsWith(`/${suffix}`));
    assert.equal(matches.length, 1, `missing unique output:${suffix}`); return reader.bound(matches[0]);
  };
  let proposal, connectivity, water;
  if (revised) {
    assert.equal(previous.status, "complete_geometry_rebound_local_checks_passed_neighbor_and_data_qualification_pending");
    assert(previous.outputBoundary.trainingAllowed === false && previous.outputBoundary.preRgbPassed === false &&
      previous.outputBoundary.countsAsAdditionalSample === false, "revised geometry cannot grant data qualification");
    assert.equal(previous.candidateId, producer.candidateId, "revised geometry candidate differs");
    assert.equal(previous.rebound?.schemaVersion, "measured-joint-water-complete-geometry-revision-v1");
    ({ proposal, connectivity, waterProjection: water } = previous.rebound);
    const base = output("complete-geometry-proposal.json"), payload = previous.rebound.revision.identityPayload;
    assert.equal(sha256(JSON.stringify(base)), payload.baseProposalSha256, "revised geometry parent differs");
    assert.equal(output("measured-water-projection.json").projectionSha256, payload.baseWaterProjectionSha256);
    assert.equal(output("regional-connectivity-proposal.json").connectivityInstanceSha256, payload.baseConnectivitySha256);
    assert.equal(proposal.worldId, base.worldId); assert.equal(proposal.regionId, base.regionId);
    assert.equal(previous.sourceJointProjectionSha256, water.jointProjectionSha256);
  } else {
    proposal = output("complete-geometry-proposal.json"); connectivity = output("regional-connectivity-proposal.json");
    water = output("measured-water-projection.json");
  }
  const spatial = auditMeasuredGeometrySpatial(proposal, connectivity, water);
  assert(spatial.localSpatialPassed, "current geometry does not pass local spatial replay");
  assert.equal(proposal.regionId, `training-world:thailand-mvp:replacement-${producer.inputIdentity}`);
  const prereview = reader.bound(producer.sourcePrereview), historyBinding = prereview.historicalLibrarySnapshot;
  const rows = reader.bound(historyBinding).records.filter(r => r.categoryId === "complete-maps");
  assert.equal(rows.length, 280, "historical corpus changed; require a fresh source screen");
  assert.equal(new Set(rows.map(r => r.recordId)).size, rows.length);
  const { width, height } = proposal.geometry.worldFrameContract.frameCoverage;
  const mask = rasterizePolygons(proposal.geometry.terrainRegions.filter(r => r.kind === "water"), width, height);
  const comparisons = [], gaps = [];
  for (const [i, row] of rows.entries()) {
    try {
      const record = reader.json(row.recordPath);
      assert.equal(record.recordId, row.recordId);
      assert(record.relativeDirectory && record.originalImage?.path && /^[a-f0-9]{64}$/.test(record.originalImage?.sha256), "missing RGB path/hash");
      const imagePath = path.posix.join(record.relativeDirectory.replaceAll("\\", "/"), record.originalImage.path.replaceAll("\\", "/"));
      const bytes = reader.bytes(imagePath, record.originalImage.sha256);
      const result = await auditBoundHistoricalRgbWater({ mask, width, height, historicalRgbBytes: bytes });
      comparisons.push({ recordId: record.recordId, image: { path: imagePath, sha256: record.originalImage.sha256 },
        historicalTaskBound: Boolean(record.conditionBinding?.taskPackagePath), ...result });
    } catch (error) { gaps.push({ recordId: row.recordId, code: "historical_rgb_water_replay_failed", detail: error.message }); }
    if ((i + 1) % 32 === 0 || i === rows.length - 1) progress(`historical_rgb_water_replayed:${i + 1}/${rows.length}`);
  }
  for (const file of [...PROGRAMS, "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs",
    "scripts/tests/test-measurement-derived-hydrology-projection.mjs"]) reader.bytes(file);
  reader.verifyStable();
  const matches = comparisons.filter(c => c.matched).map(c => ({ recordId: c.recordId, matches: c.comparisons.filter(v => v.matched) }));
  return { schemaVersion: "ai-painter-replacement-all-history-rgb-water-review-v1", createdAtUtc: new Date().toISOString(),
    status: "all_history_water_proxy_review_completed_pre_rgb_blocked", sourceReport: reportBinding,
    candidateId: producer.candidateId, geometryInput: { sourceSchema: previous.schemaVersion,
      geometryRevisionIdentity: proposal.geometryRevisionIdentity ?? null, waterProjectionSha256: water.projectionSha256,
      nativeWaterRasterSha256: sha256(mask), preservedLogicalRegionId: proposal.regionId },
    historicalLibrarySnapshot: historyBinding, comparisons, matches, gaps,
    coverage: { expected: rows.length, compared: comparisons.length,
      comparedWithoutHistoricalTask: comparisons.filter(c => !c.historicalTaskBound).length, excluded: 0 },
    outputBoundary: { historicalRgbUsedForAuditOnly: true, historicalRgbForwardedToGenerator: false,
      datasetModified: false, currentRegistryModified: false, preRgbPassed: false, allHistoryNoveltyQualified: false,
      conditionPackCreated: false, rgbCreated: false, gpuTrainingStarted: false, trainingAllowed: false }, inputReceipts: reader.receipts() };
}

export async function prepareReplacementGeometry({ root, reportBinding, candidateId, measuredWater = false, write = false, progress = () => {} }) {
  const reader = createReader(root);
  const baseline = reader.bound(reportBinding);
  assertReplacementCandidate(baseline, candidateId);
  // Re-execute the source screen under today's program bytes. The prior report
  // is a provenance input, not permission or a reusable qualification token.
  const current = auditReplacementWindows({ root, manifestBinding: baseline.datasetManifest,
    candidateBinding: baseline.candidatePool, naturalizedRunBinding: baseline.naturalizedRun,
    historyBinding: baseline.historicalLibrarySnapshot, sampleId: baseline.targetSampleId, progress });
  const selected = assertReplacementCandidate(current, candidateId);
  for (const receipt of current.inputReceipts) reader.bytes(receipt.path, receipt.sha256);
  const manifest = reader.bound(current.datasetManifest);
  const source = reader.bound(manifest.sourceIndex);
  const target = source.samples.find(r => r.sampleId === current.targetSampleId);
  const record = reader.bound(target.sourceRecord);
  const oldSource = reader.bound(target.regionSource);
  const pool = reader.bound(current.candidatePool);
  const candidate = pool.candidates.find(r => r.candidateId === candidateId);
  const assignment = { ...candidate, slotId: target.capacitySlotId, split: target.split,
    regionalLandscapeType: record.classification.regionalLandscapeType, monsoonSeason: target.monsoonSeason,
    regionalLandscapeTypeStatus: "derived_from_current_window_world_facts_and_ecology",
    imageGenerationAuthorized: false, gpuTrainingAuthorized: false };
  // New candidates derive their entrance from their own measured identity; the
  // replaced slot's historical direction is not imposed on the new region.
  const provenance = oldSource.sourceProvenance;
  const paths = { regionContractPath: provenance.regionContractPath, sourceRegistryPath: provenance.sourceRegistryPath,
    factualReferencePath: provenance.factualReferencePath, worldProfilePath: provenance.worldProfilePath,
    seasonSnapshotPath: provenance.seasonSnapshotPath };
  const snapshots = Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, reader.json(v)]));
  assert.equal(snapshots.seasonSnapshotPath.environment.season, assignment.monsoonSeason);
  const taskRoot = path.posix.dirname(record.conditionBinding.taskPackagePath);
  const conditionRunPath = path.posix.join(taskRoot, "..", "complete-map-condition-run.json");
  const normalizedRunPath = path.posix.normalize(conditionRunPath);
  const historicalConditionRun = reader.json(normalizedRunPath);
  assertHistoricalTaskBinding(reader.bytes(record.conditionBinding.taskPackagePath, historicalConditionRun.taskSha256),
    historicalConditionRun, record.conditionBinding);
  const routeNaturalnessProfile = reader.bound({ path: historicalConditionRun.routeNaturalnessProfilePath,
    sha256: historicalConditionRun.routeNaturalnessProfileSha256 });
  const waterNaturalnessProfile = reader.bound({ path: historicalConditionRun.waterNaturalnessProfilePath,
    sha256: historicalConditionRun.waterNaturalnessProfileSha256 });
  const parentWorldFactRun = reader.bound(current.naturalizedRun);
  const parentWorldFacts = reader.bound({ path: parentWorldFactRun.worldFactsPath, sha256: parentWorldFactRun.worldFactsSha256 });
  const measuredSource = measuredWater ? replayBoundHydrology({ reader, naturalizedRunBinding: current.naturalizedRun }) : null;
  for (const file of PROGRAMS) reader.bytes(file);
  reader.verifyStable();
  const inputIdentity = sha256(JSON.stringify({ schemaVersion: "ai-painter-replacement-geometry-attempt-v1",
    reportBinding, candidateId, revision: measuredWater ? "measurement-derived-complete-world-proposal-v2" : REVISION,
    inputReceipts: reader.receipts() }));
  const regionId = `training-world:thailand-mvp:replacement-${inputIdentity}`;
  if (!write) return { status: "replacement_geometry_inputs_verified_no_execution", inputIdentity,
    candidateId, inputReceipts: reader.receipts(), imageGenerationStarted: false, gpuTrainingStarted: false };
  assert.equal(fs.realpathSync(root), fs.realpathSync(process.cwd()), "geometry producer requires the declared project cwd");
  const runtime = fs.realpathSync(path.join(root, ".runtime"));
  const relativeRoot = `.runtime/ai-painter/earth-geospatial-complete-map-condition-runs/replacement-geometry-${inputIdentity}`;
  const parent = fs.realpathSync(path.join(root, path.posix.dirname(relativeRoot)));
  const relativeParent = path.relative(runtime, parent);
  assert(!relativeParent.startsWith("..") && !path.isAbsolute(relativeParent), "replacement output escapes runtime");
  const directory = path.join(parent, path.posix.basename(relativeRoot));
  fs.mkdirSync(directory); // Exclusive attempt: no overwrite, in-place repair or automatic retry.
  const outputs = [];
  function save(name, value) {
    assert(/^[a-z0-9-]+\.json$/.test(name));
    const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    fs.writeFileSync(path.join(directory, name), bytes, { flag: "wx" });
    const binding = { path: `${relativeRoot}/${name}`, sha256: sha256(bytes) };
    outputs.push(binding); return binding;
  }
  let outcome;
  try {
    const plan = { schemaVersion: "measurement-replacement-proposal-plan-v1", runId: inputIdentity,
      status: "unpublished_cpu_geometry_proposal", parentDataset: current.datasetManifest,
      replacesSampleId: target.sampleId, candidatePool: current.candidatePool,
      assignments: [assignment], imageGenerationStarted: false, gpuTrainingStarted: false };
    const planBinding = save("measurement-window-plan.json", plan);
    const sourcePackage = buildRealEarthRegionSourcePackage({ root, assignment, ...paths,
      measurementWindowPlanPath: planBinding.path });
    save("real-earth-region-source-package.json", sourcePackage);
    let connectivity = buildIndependentTrainingRegionConnectivity({ slotId: assignment.slotId, assignment,
      worldProfileId: snapshots.worldProfilePath.worldProfileId, sourcePackage, width: 1024, height: 768, hasWater: true,
      anonymousCompositionArchitectureRevision: REVISION, regionIdentity: regionId });
    let waterProjection;
    if (measuredWater) {
      const sourceGraph = deriveWindowHydrologyGraph({ ...measuredSource, sourceWindow: candidate.sourcePixelWindow });
      const neighborPairing = pairMeasuredHydrologyPorts({ candidateId, candidates: pool.candidates, graph: sourceGraph,
        routing: measuredSource.routing, sourceGrid: measuredSource.sourceGrid });
      save("source-hydrology-graph.json", { sourceGraph, neighborPairing, evidence: measuredSource.evidence });
      waterProjection = projectMeasuredSingleChannel({ sourceGraph, neighborPairing, candidateId, naturalnessProfile: waterNaturalnessProfile,
        naturalnessProfileBinding: { path: historicalConditionRun.waterNaturalnessProfilePath, sha256: historicalConditionRun.waterNaturalnessProfileSha256 } });
      save("measured-water-projection.json", waterProjection);
      connectivity = bindProjectedWaterConnectivity(connectivity, waterProjection);
    }
    save(measuredWater ? "regional-connectivity-input-proposal.json" : "regional-connectivity-proposal.json", connectivity);
    progress(`complete_geometry_build_started:${candidateId}`);
    let proposal = await buildEarthGeospatialCompleteMapConditions({ replacementGeometryInput: {
      schemaVersion: "ai-painter-replacement-geometry-input-v1", conditionId: `replacement-${inputIdentity}`,
      seedHex: inputIdentity, regionId, worldId: `training-world:replacement-${inputIdentity}`, parentWorldFacts, parentWorldFactRun,
      connectivity, waterProjection, coarseHydrologyProfile: selected.coarseHydrologyProfile, routeNaturalnessProfile, waterNaturalnessProfile,
      slotContext: { assignment, planRunId: inputIdentity, planPath: planBinding.path, planSha256: planBinding.sha256,
        worldProfile: snapshots.worldProfilePath, factualReference: snapshots.factualReferencePath,
        snapshot: snapshots.seasonSnapshotPath, snapshotPath: paths.seasonSnapshotPath },
    } });
    if (measuredWater) {
      ({ connectivity, proposal } = finalizeMeasuredGeometryConnectivity(connectivity, proposal));
      save("regional-connectivity-proposal.json", connectivity);
    }
    save("complete-geometry-proposal.json", proposal);
    if (measuredWater) {
      const spatialAudit = auditMeasuredGeometrySpatial(proposal, connectivity, waterProjection);
      save("native-spatial-audit.json", spatialAudit);
      assert(spatialAudit.localSpatialPassed, `local native spatial checks failed: ${spatialAudit.issues.join(",")}`);
      progress(`native_spatial_audit_passed:${candidateId}`);
    }
    progress(`complete_geometry_build_finished:${candidateId}`);
    const signature = buildCompleteMapSemanticTopologySignature(proposal.geometry);
    const historicalIndex = reader.bound(current.historicalLibrarySnapshot);
    const matches = [], gaps = [];
    let compared = 0;
    for (const row of historicalIndex.records.filter(r => r.categoryId === "complete-maps")) {
      try {
        const historical = readHistoricalGeometry(reader, reader.json(row.recordPath));
        if (!historical.signature) { gaps.push({ recordId: row.recordId, code: "historical_semantic_topology_missing" }); continue; }
        compared++;
        const reasons = semanticHistoryMatches(signature, historical.signature);
        if (reasons.length) matches.push({ recordId: row.recordId, reasons });
      } catch (error) { gaps.push({ recordId: row.recordId, code: error.code ?? "historical_geometry_read_failed", detail: error.message }); }
    }
    outcome = { status: "complete_geometry_proposed_pre_rgb_blocked", proposalSignature: signature,
      historyAudit: { compared, matches, gaps, allHistoryPassed: false },
      remainingChecks: ["source_flow_direction_and_neighbor_facts_not_yet_qualified", "complete_all_history_geometry_and_semantic_review",
        "current_condition_package_candidate_identity_adapter", "source_and_split_independence", "rgb_generation_not_permitted"] };
  } catch (error) {
    outcome = { status: "replacement_geometry_failed_closed", errorCode: "replacement_complete_geometry_generation_failed",
      errorMessage: error.message, stack: error.stack };
    save("failure.json", outcome);
    progress(`complete_geometry_failed_closed:${candidateId}:${error.message.split(": {")[0].slice(0, 400)}`);
  }
  reader.verifyStable();
  for (const output of outputs) reader.bytes(output.path, output.sha256);
  const report = { schemaVersion: "ai-painter-replacement-geometry-audit-v1", createdAtUtc: new Date().toISOString(),
    inputIdentity, candidateId, replacesSampleId: target.sampleId, sourcePrereview: reportBinding, ...outcome,
    outputs, inputReceipts: reader.receipts(), outputBoundary: { preRgbPassed: false, conditionPackCreated: false,
      imageGenerationStarted: false, rgbCreated: false, gpuTrainingStarted: false, checkpointCreated: false,
      trainingAllowed: false, datasetModified: false, currentRegistryModified: false, canEnterWorld: false } };
  const evidence = persistAudit(root, report);
  return { status: report.status, candidateId, evidence, outputs,
    errorMessage: report.errorMessage?.split(": {")[0].slice(0, 400),
    historyAudit: report.historyAudit && { compared: report.historyAudit.compared,
      matches: report.historyAudit.matches.length, gaps: report.historyAudit.gaps.length }, outputBoundary: report.outputBoundary };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { report: { type: "string" }, "report-sha256": { type: "string" },
      candidate: { type: "string" }, write: { type: "boolean", default: false },
      "review-hydrology": { type: "boolean", default: false },
      "review-neighbor-water": { type: "boolean", default: false },
      "review-neighbor-geometry": { type: "boolean", default: false },
      "review-source-boundary": { type: "boolean", default: false },
      "rebind-joint-water": { type: "boolean", default: false },
      "project-water": { type: "boolean", default: false },
      "measured-water": { type: "boolean", default: false },
      "review-rgb-water": { type: "boolean", default: false },
      "geometry-report": { type: "string", multiple: true }, "geometry-sha256": { type: "string", multiple: true } } });
    const progress = message => process.stderr.write(`${new Date().toISOString()} ${message}\n`);
    let result;
    assert(!values["review-source-boundary"] || (!["review-neighbor-geometry", "rebind-joint-water", "review-hydrology",
      "review-rgb-water", "review-neighbor-water", "measured-water", "project-water", "geometry-report", "geometry-sha256", "candidate"]
      .some(k => values[k]) && values.report && values["report-sha256"]),
      "source boundary review requires one explicit completed pair report/SHA and no other execution mode");
    assert(!values["review-neighbor-geometry"] || (!values["rebind-joint-water"] && !values["review-hydrology"] &&
      !values["review-rgb-water"] && !values["review-neighbor-water"] && !values["measured-water"] && !values["project-water"] &&
      !values["geometry-report"] && !values["geometry-sha256"] && !values.candidate && values.report && values["report-sha256"]),
      "neighbor geometry requires one explicit rebind report/SHA and no other mode");
    assert(!values["rebind-joint-water"] || (!values["review-hydrology"] && !values["review-rgb-water"] &&
      !values["review-neighbor-water"] && !values["measured-water"] && !values["project-water"] &&
      !values["geometry-report"] && !values["geometry-sha256"] && !values.candidate && values.report && values["report-sha256"]),
      "joint-water rebind requires one explicit report/SHA and no other execution mode");
    assert(!values["review-neighbor-water"] || (!values["review-hydrology"] && !values["review-rgb-water"] &&
      !values["measured-water"] && !values["project-water"] && values["geometry-report"]?.length === 1),
      "neighbor-water review requires exactly one geometry report and no other execution mode");
    assert(!values["review-rgb-water"] || (!values["review-hydrology"] && !values["measured-water"] &&
      values["geometry-report"]?.length === 1), "RGB-water review requires exactly one geometry report and no other execution mode");
    assert(!values["project-water"] || values["review-hydrology"], "water projection requires bound hydrology review");
    assert(!values["measured-water"] || (!values["review-hydrology"] && !values["geometry-report"] && !values["geometry-sha256"]),
      "measured complete geometry cannot be combined with review modes");
    if (values["review-source-boundary"]) {
      const review = reviewReplacementSourceBoundary({ root: process.cwd(),
        reportBinding: { path: values.report, sha256: values["report-sha256"] }, progress });
      result = { status: review.status, evidence: values.write ? persistAudit(process.cwd(), review) : null,
        targetCandidateId: review.targetCandidateId,
        blockers: review.blockers.map(b => ({ code: b.code, candidateId: b.candidateId })),
        boundaryElevations: review.boundaryElevations.map(e => ({ upstreamCandidateId: e.upstreamCandidateId,
          downstreamCandidateId: e.downstreamCandidateId, sourceSupportElevationMetres: e.outlet.elevationMetres, matched: e.matched })),
        sourceConflicts: review.sourceWindowIsolation.conflicts, nextAction: review.nextAction, outputBoundary: review.outputBoundary };
    } else if (values["review-neighbor-geometry"]) {
      const review = await reviewReplacementNeighborGeometry({ root: process.cwd(),
        reportBinding: { path: values.report, sha256: values["report-sha256"] }, progress });
      result = { status: review.status, evidence: values.write ? persistAudit(process.cwd(), review) : null,
        candidateId: review.candidateId, failure: review.failure && { code: review.failure.code,
          message: review.failure.message.split(": {")[0].slice(0, 400) },
        localSpatialPassed: review.nativeSpatialAudit?.localSpatialPassed ?? false,
        remainingChecks: review.remainingChecks, outputBoundary: review.outputBoundary };
    } else if (values["rebind-joint-water"]) {
      const review = reviewJointWaterGeometryRebind({ root: process.cwd(),
        reportBinding: { path: values.report, sha256: values["report-sha256"] }, progress });
      result = { status: review.status, evidence: values.write ? persistAudit(process.cwd(), review) : null,
        geometryRevisionIdentity: review.rebound.revision.geometryRevisionIdentity,
        localSpatialPassed: review.rebound.nativeSpatialAudit.localSpatialPassed,
        currentRouteChecks: review.rebound.proposal.geometry.routeWaterAvoidanceAudit.evaluatedAttemptCount,
        remainingChecks: review.remainingChecks, outputBoundary: review.outputBoundary };
    } else if (values["review-hydrology"]) {
      assert(!values["geometry-report"] && !values["geometry-sha256"], "hydrology and geometry review modes cannot be mixed");
      const review = reviewReplacementHydrology({ root: process.cwd(),
        reportBinding: { path: values.report, sha256: values["report-sha256"] }, candidateId: values.candidate,
        projectWater: values["project-water"], progress });
      result = { status: review.status, evidence: values.write ? persistAudit(process.cwd(), review) : null,
        sourceValidation: review.source.validation, candidates: review.candidates.map(c => ({ candidateId: c.candidateId,
          supportedBoundaryCounts: c.supportedBoundaryCounts, sourceGraphContinuous: c.sourceGraph.sourceGraphContinuous,
          sourceMaskIsolationVerified: c.sourceGraph.sourceMaskIsolationVerified,
          sourceGraphGaps: c.sourceGraph.gaps.map(g => g.code),
          pairedNeighbors: c.neighborPairing.pairs.map(p => p.neighborCandidateId),
          sourceContext: c.sourceContext,
          downstreamTraces: c.downstreamTraces.map(t => ({ sourcePortId: t.sourcePortId, cells: t.cells.length,
            regionVisits: t.regionVisits.map(v => v.candidateId), firstExposed: t.firstExposed,
            encounteredMaskCategoryCounts: t.encounteredMaskCategoryCounts })),
          neighborGaps: c.neighborPairing.gaps, projection: c.projection && { status: c.projection.status,
            sha256: c.projection.projectionSha256, errorMessage: c.projection.errorMessage } })), remainingChecks: review.remainingChecks,
        outputBoundary: review.outputBoundary };
    } else if (values["geometry-report"] || values["geometry-sha256"]) {
      assert(!values.report && !values["report-sha256"] && !values.candidate, "review cannot also generate geometry");
      assert([1, 2].includes(values["geometry-report"]?.length), "review requires one or two reports");
      assert.equal(values["geometry-sha256"]?.length, values["geometry-report"].length);
      const bindings = values["geometry-report"].map((file, i) => ({ path: file, sha256: values["geometry-sha256"][i] }));
      const review = values["review-neighbor-water"]
        ? reviewReplacementNeighborWater({ root: process.cwd(), progress, reportBinding: bindings[0] })
        : values["review-rgb-water"]
        ? await reviewReplacementHistoricalRgbWater({ root: process.cwd(), progress, reportBinding: bindings[0] })
        : reviewReplacementGeometry({ root: process.cwd(), progress, reportBindings: bindings });
      result = values["review-neighbor-water"] ? { status: review.status, evidence: values.write ? persistAudit(process.cwd(), review) : null,
        failure: review.failure, jointProjectionSha256: review.joint?.projectionSha256, seam: review.joint?.audit.seam,
        upstreamSpatial: review.upstreamSpatial, context: review.context, remainingChecks: review.remainingChecks, outputBoundary: review.outputBoundary }
        : values["review-rgb-water"] ? { status: review.status, evidence: values.write ? persistAudit(process.cwd(), review) : null,
        coverage: review.coverage, matches: review.matches, gaps: review.gaps, outputBoundary: review.outputBoundary }
        : { status: review.status, evidence: values.write ? persistAudit(process.cwd(), review) : null,
        candidates: review.candidates.map(c => ({ candidateId: c.candidateId, ...c.counts, matches: c.matches.length })),
        polygonOnly: review.polygonOnly.length, gaps: review.gaps.length, pairwise: review.pairwise, outputBoundary: review.outputBoundary };
    } else result = await prepareReplacementGeometry({ root: process.cwd(), reportBinding: { path: values.report,
      sha256: values["report-sha256"] }, candidateId: values.candidate, measuredWater: values["measured-water"], write: values.write,
      progress });
    console.log(JSON.stringify(result, null, 2));
    if (values["review-source-boundary"]) process.exitCode = 2; // Completed diagnostic, never a successful training preflight.
    else if (result.status.endsWith("failed_closed")) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
