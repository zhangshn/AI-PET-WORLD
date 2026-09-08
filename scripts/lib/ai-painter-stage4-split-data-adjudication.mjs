// Current, read-only data gate. Legacy reports are evidence inputs, never permits.
// No release-granting schema is implemented here: bounded diagnostics cannot
// establish full-history novelty or independent holdout qualification.
import assert from "node:assert/strict";
import {
  createReader, sha256, validateMembership, auditHistoricalGeometry, foundationExposure,
} from "./ai-painter-stage4-dataset-audit.mjs";
import { auditHistoricalExposure } from "./ai-painter-stage4-historical-exposure.mjs";

export const DATA_ADJUDICATION_SCHEMA = "ai-painter-stage4-split-data-adjudication-v1";
const LIBRARY = "data/world-samples/original-image-library/natural-home-v1/index.json";
const CAPABILITY = "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json";
const PROGRAMS = [
  "scripts/lib/ai-painter-stage4-split-data-adjudication.mjs",
  "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
  "scripts/lib/ai-painter-stage4-historical-exposure.mjs",
  "scripts/lib/ai-painter-stage4-historical-geometry.mjs",
  "scripts/lib/complete-map-semantic-topology-signature.mjs",
];
const canonical = (v) => JSON.stringify(sort(v));
function sort(v) {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]));
  return v;
}
function equal(a, b, message) { assert.ok(canonical(a) === canonical(b), message); }
function bindingEqual(a, b, message) {
  assert.ok(a && b, message);
  assert.equal(a.path, b.path, message); assert.equal(a.sha256, b.sha256, message);
}
function uniqueFindings(values) {
  return [...new Map(values.map((v) => [canonical(v), v])).values()];
}

// The registry supplies an explicit immutable root, not permission and not a
// guessed sibling manifest. Recovery semantics and source bytes are rechecked
// by the historical reader; unrelated terminal formats cannot fill a gap.
function recoveryRootsFromRegistry(reader, registry) {
  const latest = registry.latestTrainingTerminal;
  if (latest == null) return [];
  const binding = { path: latest.path, sha256: latest.sha256 };
  const projection = reader.bound(binding);
  if (projection.schemaVersion !== "ai-painter-joint-full-data-screen-post-checkpoint-recovery-registry-terminal-v1") {
    assert.ok(!latest.evidence?.recoveryTerminal, "registry_recovery_projection_schema_conflict");
    return [];
  }
  assert.equal(latest.runId, projection.runId, "registry_recovery_run_identity_conflict");
  assert.equal(latest.status, projection.status, "registry_recovery_status_conflict");
  bindingEqual(latest.evidence?.recoveryTerminal, projection.recoveryTerminal, "registry_recovery_terminal_binding_conflict");
  const terminal = reader.bound(projection.recoveryTerminal);
  for (const field of ["manifest", "recoveredTrainingEvidence"])
    bindingEqual(latest.evidence?.[field], terminal[field], `registry_recovery_${field}_binding_conflict`);
  return [binding];
}

// Current file identity, declared asset role and historical data isolation are
// different claims. Today's receipt cannot repair a missing historical binding,
// and that missing binding alone cannot establish a need to replace weights.
function assessFoundationEvidence(reader, capability, contract, audit) {
  assert.equal(contract.schemaVersion, "ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1",
    "foundation_contract_schema_conflict");
  assert.ok(typeof contract.assetIdentity === "string" && contract.assetIdentity.length > 0, "foundation_asset_identity_missing");
  assert.equal(contract.assetIdentity, capability.foundationAssetBinding.identity, "foundation_asset_identity_conflict");
  assert.equal(contract.assetRole, "project_owned_cross_candidate_frozen_foundation_capability", "foundation_asset_role_conflict");
  assert.equal(contract.assetRole, capability.foundationAssetBinding.role, "foundation_asset_role_conflict");
  assert.equal(contract.consumerBoundary?.allowedRole, "frozen_autoencoder_foundation_dependency_only",
    "foundation_consumer_role_conflict");
  const lineage = contract.lineageInterpretation;
  assert.equal(lineage?.projectOwned, true, "foundation_lineage_role_conflict");
  assert.equal(lineage.crossCandidateFoundation, true, "foundation_lineage_role_conflict");
  for (const key of ["failedDenoiserCheckpoint", "denoiserWeightsMayBeLoaded", "parentCheckpointMayBeLoaded",
    "sourceManifestRemainingBlockersInherited", "sourceManifestGovernanceFieldsInherited"])
    assert.equal(lineage[key], false, "foundation_lineage_role_conflict");
  assert.equal(lineage.sourceManifestRole, "immutable_asset_provenance_only", "foundation_lineage_role_conflict");
  const bytes = reader.bytes(contract.checkpoint.path, contract.checkpoint.sha256);
  assert.equal(bytes.length, contract.checkpoint.bytes, "foundation_checkpoint_size_conflict");
  const manifest = reader.bound(contract.sourceManifest);
  assert.equal(manifest.checkpointPath, contract.checkpoint.path, "foundation_checkpoint_manifest_conflict");
  assert.equal(manifest.checkpointSha256, contract.checkpoint.sha256, "foundation_checkpoint_manifest_conflict");
  const receipts = new Map(reader.receipts().map(r => [r.path, r]));
  const gaps = uniqueFindings(audit.gaps).map(gap => {
    const currentReceipt = receipts.get(gap.path);
    assert.ok(currentReceipt, "foundation_gap_current_receipt_missing");
    return { ...gap, filePresentNow: true, currentReceipt,
      currentReceiptEstablishesHistoricalBinding: false };
  });
  return {
    assetIdentity: contract.assetIdentity, assetRole: contract.assetRole,
    checkpoint: receipts.get(contract.checkpoint.path), sourceManifest: receipts.get(contract.sourceManifest.path),
    currentAssetIntegrity: "bound_checkpoint_and_source_manifest_bytes_verified",
    declaredReuseRole: contract.consumerBoundary.allowedRole,
    historicalIsolation: "not_qualified", historicalBindingGaps: gaps,
    exactCurrentSampleOverlapCount: audit.exactIdentityOverlaps.length,
    zeroExactOverlapProvesIndependentHoldout: false,
    retrainingDecision: "not_established_by_this_evidence",
    checkpointDeserialized: false, runtimeLoadProven: false,
    runtimeFreezeProven: false, optimizerExclusionProven: false,
    assetReplacementSelected: false, trainingAllowed: false,
  };
}

export function adjudicateStage4SplitData({ root, manifestBinding, baselineBinding,
  geometryBinding, exposureBinding, progress = () => {} }) {
  const reader = createReader(root), blockers = [], historicalProgramBindings = [];
  const sourceEvidence = { baseline: baselineBinding, geometry: geometryBinding, exposure: exposureBinding };
  let datasetReleaseIdentity = null;
  let findings = null;
  const add = (code, scope, details) => blockers.push({ code, scope, details });
  try {
    // Bind this evaluator before reading evidence; mid-read edits fail below.
    for (const logical of PROGRAMS) reader.bytes(logical);
    const manifest = reader.bound(manifestBinding);
    const source = reader.bound(manifest.sourceIndex);
    const memberships = Object.fromEntries(Object.entries(manifest.splits).map(([k, b]) => [k, reader.bound(b)]));
    validateMembership(manifest, source, memberships);
    datasetReleaseIdentity = manifest.datasetReleaseIdentity;
    assert.equal(datasetReleaseIdentity, `stage4-v2-split64-${sha256(Buffer.from(canonical(manifest.identityPayload)))}`,
      "dataset_release_identity_not_reproduced");
    assert.equal(manifest.identityPayload.selectionReproductionSha256, sha256(Buffer.from(canonical(source.samples))),
      "dataset_selected_rows_not_reproduced");
    for (const [name, binding] of [["source-index.json", manifest.sourceIndex],
      ...Object.entries(manifest.splits).map(([k, b]) => [`splits/${k}.json`, b])]) {
      assert.equal(manifest.identityPayload.artifactHashes[name], binding.sha256, "dataset_artifact_identity_conflict");
    }
    const parent = reader.bound(manifest.identityPayload.parentRelease);
    assert.equal(parent.samples?.length, 64, "dataset_parent_capacity_conflict");
    for (const [i, row] of source.samples.entries()) {
      for (const field of ["sampleId", "split", "ordinal", "image", "conditionPack"])
        equal(row[field], parent.samples[i][field], "dataset_parent_selection_conflict");
    }

    const baseline = reader.bound(baselineBinding), geometry = reader.bound(geometryBinding), exposure = reader.bound(exposureBinding);
    assert.equal(baseline.schemaVersion, "ai-painter-stage4-split-risk-audit-v1", "unsupported_baseline_schema");
    assert.equal(baseline.status, "bounded_data_audit_completed_training_unqualified", "baseline_status_conflict");
    assert.equal(geometry.schemaVersion, "ai-painter-stage4-historical-geometry-replay-v1", "unsupported_geometry_schema");
    assert.equal(geometry.status, "bounded_geometry_replay_completed_training_unqualified", "geometry_status_conflict");
    assert.equal(exposure.schemaVersion, "ai-painter-stage4-historical-exposure-audit-v1", "unsupported_exposure_schema");
    assert.equal(exposure.status, "bounded_historical_use_audited_not_qualified", "exposure_status_conflict");
    bindingEqual(baseline.datasetManifest, manifestBinding, "baseline_dataset_binding_conflict");
    bindingEqual(exposure.datasetManifest, manifestBinding, "exposure_dataset_binding_conflict");
    bindingEqual(geometry.baseline, baselineBinding, "geometry_baseline_binding_conflict");
    for (const report of [baseline, geometry, exposure]) {
      assert.equal(report.qualification?.trainingAllowed, false, "diagnostic_report_cannot_grant_training");
      assert.ok(Array.isArray(report.inputReceipts) && report.inputReceipts.length > 0, "audit_input_receipts_missing");
      const seen = new Set();
      for (const receipt of report.inputReceipts) {
        assert.ok(!seen.has(receipt.path), "duplicate_audit_input_receipt"); seen.add(receipt.path);
        assert.match(receipt.sha256 ?? "", /^[a-f0-9]{64}$/u, "audit_input_sha_missing");
        assert.ok(Number.isSafeInteger(receipt.bytes) && receipt.bytes >= 0, "audit_input_size_invalid");
        const program = /^(scripts|ml)\/.*\.(?:mjs|js|ts|tsx|py)$/u.test(receipt.path);
        const bytes = reader.bytes(receipt.path, program ? undefined : receipt.sha256);
        if (program) historicalProgramBindings.push({ ...receipt, actualSha256: sha256(bytes),
          matchesCurrentBytes: receipt.sha256 === sha256(bytes), currentQualificationGranted: false });
        else assert.equal(bytes.length, receipt.bytes, "audit_input_size_conflict");
      }
    }
    progress("historical_report_data_receipts_rehashed");

    const baselineReceipts = new Map(baseline.inputReceipts.map((v) => [v.path, v]));
    assert.ok(baselineReceipts.has(LIBRARY) && baselineReceipts.has(CAPABILITY), "audit_authority_receipts_missing");
    const library = reader.json(LIBRARY, baselineReceipts.get(LIBRARY).sha256);
    const history = library.records.filter((r) => r.categoryId === "complete-maps");
    assert.equal(history.length, baseline.summary.historicalLibraryRecords, "historical_inventory_count_conflict");
    assert.equal(new Set(history.map((r) => r.recordId)).size, history.length, "historical_inventory_identity_conflict");
    const selected = source.samples.map((row) => {
      const record = reader.bound(row.sourceRecord);
      assert.ok(history.some((r) => r.recordId === record.recordId), "selected_record_not_in_history");
      return { ...row, recordId: record.recordId };
    });
    assert.equal(new Set(selected.map((r) => r.recordId)).size, 64, "selected_record_duplicate");
    const selectedReferences = selected.map((r) => ({ sampleId: r.sampleId, recordId: r.recordId }));
    const orderedReferences = (rows) => [...rows].sort((a, b) => a.sampleId.localeCompare(b.sampleId));
    equal(orderedReferences(baseline.imageAudit.selfReferences), orderedReferences(selectedReferences),
      "baseline_selected_records_conflict");
    // The historical library enumeration is not the Dataset's optimizer order.
    // Retain its audit enumeration solely to reproduce the old comparison list.
    const bySample = new Map(selected.map((r) => [r.sampleId, r]));
    const auditOrder = baseline.imageAudit.selfReferences.map((r) => bySample.get(r.sampleId));
    const currentGeometry = auditHistoricalGeometry({ reader, history, selected: auditOrder, progress });
    equal(currentGeometry, geometry.geometryAudit, "geometry_evidence_does_not_reproduce");
    const legacyExposure = auditHistoricalExposure({ root, reader, rows: source.samples, inventory: exposure.inventory,
      semanticsVersion: 1, progress });
    for (const field of ["summary", "perSample", "observations", "gaps", "files", "reservations"])
      equal(legacyExposure[field], exposure[field], `exposure_evidence_does_not_reproduce:${field}`);
    // Reproduce the immutable historical report under its original semantics,
    // then assess the same bytes with the corrected reader. Never rewrite old
    // evidence or silently treat its old gap count as today's verdict.
    const registry = reader.json(".runtime/ai-painter/current-execution-registry/current.json");
    assert.equal(registry.activeExecution, null, "data_adjudication_overlaps_active_execution");
    const recoveryRoots = recoveryRootsFromRegistry(reader, registry);
    const currentExposure = auditHistoricalExposure({ root, reader, rows: source.samples, inventory: exposure.inventory,
      semanticsVersion: 3, recoveryRoots, progress });
    assert.equal(currentExposure.schemaVersion, "ai-painter-stage4-historical-exposure-audit-v3", "current_exposure_schema_conflict");
    assert.equal(currentExposure.trainingAllowed, false, "current_exposure_cannot_grant_training");
    assert.equal(currentExposure.unseenHoldoutQualified, false, "current_exposure_cannot_qualify_holdout");
    const capability = reader.json(CAPABILITY, baselineReceipts.get(CAPABILITY).sha256);
    bindingEqual(capability.datasetBinding, manifest.identityPayload.parentRelease, "foundation_capability_dataset_conflict");
    const foundation = reader.bound(capability.foundationAssetBinding);
    const currentFoundation = foundationExposure(reader, foundation, source.samples, progress);
    equal(currentFoundation, baseline.foundationAudit, "foundation_evidence_does_not_reproduce");
    const foundationAssessment = assessFoundationEvidence(reader, capability, foundation, currentFoundation);

    const optimizerExposure = currentExposure.perSample.filter((r) => r.split !== "train"
      && (r.recordedOptimizerRuns > 0 || r.recordedReplaySteps > 0));
    if (optimizerExposure.length) add("non_train_historical_optimizer_exposure_requires_resolution", "historical_use",
      optimizerExposure.map(({ sampleId, split, recordedOptimizerRuns, recordedOptimizerSteps, recordedReplayRuns, recordedReplaySteps }) =>
        ({ sampleId, split, recordedOptimizerRuns, recordedOptimizerSteps, recordedReplayRuns, recordedReplaySteps,
          countScope: "primary_paired_events_and_separately_bound_completed_replay_events_lower_bound" })));
    if (currentExposure.gaps.length) add("historical_use_evidence_incomplete", "historical_use", {
      items: currentExposure.gaps.length, legacyDiagnosticItems: legacyExposure.gaps.length,
      interpretation: "coverage_findings_not_distinct_defects",
    });
    add("all_run_and_checkpoint_selection_coverage_unqualified", "historical_use", currentExposure.limitations);
    if (currentGeometry.gaps.length) add("historical_structural_references_missing", "geometry", currentGeometry.gaps);
    if (currentGeometry.topologyGaps.length) add("historical_topology_not_recorded", "geometry",
      { records: currentGeometry.topologyGaps.length, recordIds: currentGeometry.topologyGaps.map((r) => r.recordId) });
    add("full_history_non_exact_novelty_qualification_missing", "novelty", {
      exactDeclaredGeometryMatches: currentGeometry.matches.length,
      exactMatchIsNotAutomaticRejection: true, thumbnailRankingIsNotSemanticQualification: true,
    });
    const foundationGaps = uniqueFindings(currentFoundation.gaps);
    if (foundationGaps.length) add("foundation_historical_binding_incomplete", "independent_evaluation", {
      gaps: foundationAssessment.historicalBindingGaps,
      affectedClaim: "foundation_training_history_and_holdout_isolation",
      currentAssetIntegrity: foundationAssessment.currentAssetIntegrity,
      retrainingDecision: foundationAssessment.retrainingDecision,
    });
    if (currentFoundation.exactIdentityOverlaps.length) add("foundation_current_sample_overlap_requires_resolution", "foundation",
      currentFoundation.exactIdentityOverlaps);
    add("independent_holdout_qualification_missing", "independent_evaluation", {
      // Keep the aggregate for existing readers, but never interpret ordinary
      // validation/regression evaluation as proof of a forbidden use.
      evaluationObservedSampleIds: currentExposure.perSample.filter((r) => r.evaluationRuns > 0).map((r) => r.sampleId),
      aggregateScope: "evaluation_observation_only_not_violation_or_current_candidate_inheritance",
      splitAssessment: [
        ["train", "optimizer_training_not_independent_evaluation"],
        ["validation", "metrics_and_checkpoint_selection_without_optimizer_updates"],
        ["challenge", "unseen_final_evaluation_no_training_tuning_or_checkpoint_selection"],
        ["regression", "failure_regression_evaluation_no_optimizer_or_checkpoint_selection"],
      ].map(([split, intendedRole]) => ({ split, intendedRole,
        observedEvaluationSampleIds: currentExposure.perSample.filter(r => r.split === split && r.evaluationRuns > 0)
          .map(r => r.sampleId),
        observedOptimizerSampleIds: currentExposure.perSample.filter(r => r.split === split
          && (r.recordedOptimizerRuns > 0 || r.recordedReplaySteps > 0)).map(r => r.sampleId),
        evaluationObservationAloneProvesViolation: false, selectionPathVerified: false,
      })),
      missingClaim: "challenge_unseen_and_per_split_selection_path_qualification",
      absenceOfRecordedUseIsNotProofOfUnseen: true,
    });
    findings = { historicalUse: currentExposure.summary, legacyHistoricalUse: legacyExposure.summary,
      historicalUseAssessment: { schemaVersion: currentExposure.schemaVersion,
        runLevelOptimizerObservations: currentExposure.runLevelOptimizerObservations,
        evaluationRoleDifferences: currentExposure.evaluationRoleDifferences,
        replayOptimizerObservations: currentExposure.replayOptimizerObservations,
        replayAccounting: currentExposure.replayAccounting,
        recoveredEvaluationSources: currentExposure.recoveredEvaluationSources,
        gaps: currentExposure.gaps, limitations: currentExposure.limitations,
        currentCandidateWeightInheritanceProven: false, trainingAllowed: false },
      historicalGeometry: currentGeometry.summary,
      nonTrainOptimizerExposure: optimizerExposure, foundationAncestors: currentFoundation.chain.length,
      foundationGapOccurrences: currentFoundation.gaps.length, uniqueFoundationBindingGaps: foundationGaps.length,
      foundationAssessment, registryRevision: registry.registryRevision };
    progress("data_adjudication_before_final_input_recheck");
    reader.verifyStable();
  } catch (error) {
    findings = null; // Do not project verified findings from an unstable read.
    add("data_evidence_invalid_or_stale", "evidence_integrity", { reason: error.message.split("\n")[0].slice(0, 1000) });
  }
  const stale = blockers.some((b) => b.code === "data_evidence_invalid_or_stale");
  return { schemaVersion: DATA_ADJUDICATION_SCHEMA, recordedAtUtc: new Date().toISOString(),
    status: stale ? "unknown_or_stale" : "blocked_data_qualification",
    datasetManifest: manifestBinding, datasetReleaseIdentity, sourceEvidence, blockers, findings,
    historicalProgramBindings: uniqueFindings(historicalProgramBindings),
    evidenceScope: "historical_rgb_input_bytes_verified_geometry_use_and_foundation_replayed_no_new_rgb_semantic_review",
    requirements: ["AP-TRAIN-002", "AP-CHANGE-004"], inputReceipts: reader.receipts(),
    trainingAllowed: false, qualification: { trainingAllowed: false, dataQualified: false },
    automaticSampleRelabellingAllowed: false, gpuStarted: false, trainingStarted: false,
    currentRegistryModified: false, historicalFilesModified: false };
}
