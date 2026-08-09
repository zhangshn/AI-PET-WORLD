import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-v9-stage4-object-semantic-architecture-design-and-diagnostic-manifest-contract-20260809"
const SCOPE = "cpu_only_v9_object_semantic_decoder_alignment_design_and_exact_17_metric_manifest_contract_only"
const DESIGN_CONTRACT_ID = "stage4_object_semantic_decoder_alignment_v9_v1"
const ARCHITECTURE_ID = "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment"
const OBJECTS = ["Footprints", "Tree", "Rock", "Vegetation"]
const OBJECT_CHANNELS = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
const DECODER_SCALES = ["up1", "up0"]
const FIXED_PREVIEW_EPOCHS = [1, 5, 10, 20, 30]
const REQUIRED_DECISION = "exit_current_v8_candidate_revision_and_require_v9_object_semantic_decoder_alignment_design"

const OBJECT_METRIC_SUFFIXES = [
  "IndependentLoss",
  "GradientContribution",
  "DecodedResponsePrototypeMae",
]
const DIAGNOSTIC_METRIC_NAMES = [
  ...OBJECTS.flatMap((objectName) => OBJECT_METRIC_SUFFIXES.map(
    (suffix) => `stage4DiagnosticObject${objectName}${suffix}`,
  )),
  "stage4DiagnosticObjectGradientAvailable",
  "stage4DiagnosticRouteActivationMassRatio",
  "stage4DiagnosticRouteSpatialDistributionL1",
  "stage4DiagnosticRouteCentroidDrift",
  "stage4DiagnosticRouteRequiredBoundaryContactMinimum",
]

function main(argv = process.argv.slice(2)) {
  const authorizationPath = argument(argv, "--authorization")
  if (!authorizationPath) throw new Error("v9_architecture_design_authorization_required")
  const authorization = validateAuthorization(authorizationPath)
  const output = authorization.outputPaths
  if (fs.existsSync(resolve(output.runRoot))) throw new Error("v9_architecture_design_run_root_already_exists")

  const attributionTerminal = readJsonRequired(authorization.bindings.v8AttributionTerminal.path)
  const attributionReport = readJsonRequired(authorization.bindings.v8AttributionReport.path)
  const architectureDecision = readJsonRequired(authorization.bindings.v8ArchitectureDecision.path)
  validateSourceEvidence(attributionTerminal, attributionReport, architectureDecision)

  const metricMappings = buildMetricMappings()
  assert(metricMappings.length === 17, "v9_diagnostic_metric_count_invalid")
  assert(new Set(metricMappings.map((row) => row.manifestField)).size === 17, "v9_diagnostic_metric_names_not_unique")

  const recordedAtUtc = new Date().toISOString()
  const report = buildDesignReport({
    authorizationPath,
    authorization,
    attributionReport,
    metricMappings,
    recordedAtUtc,
  })
  const inactiveContract = buildInactiveContract({
    authorizationPath,
    authorization,
    metricMappings,
    recordedAtUtc,
  })

  fs.mkdirSync(resolve(output.runRoot), { recursive: true })
  writeImmutableJson(output.designReport, report)
  writeImmutableJson(output.inactiveContract, inactiveContract)

  const terminal = {
    schemaVersion: "local-ai-v9-stage4-architecture-design-terminal-v1",
    status: "v9_stage4_architecture_design_and_diagnostic_manifest_contract_completed_closed",
    recordedAtUtc,
    designContractId: DESIGN_CONTRACT_ID,
    proposedArchitectureId: ARCHITECTURE_ID,
    designReportPath: projectPath(output.designReport),
    designReportSha256: sha256File(output.designReport),
    inactiveImplementationContractPath: projectPath(output.inactiveContract),
    inactiveImplementationContractSha256: sha256File(output.inactiveContract),
    diagnosticManifestMetricCount: metricMappings.length,
    diagnosticManifestFieldsExact: metricMappings.map((row) => row.manifestField),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    currentStage: 4,
    stage4Completed: false,
    stage4FullTrainingAuthorized: false,
    nextLegalAction: "separately_authorize_cpu_only_v9_architecture_support_diagnostic_registry_inactive_config_and_positive_negative_regressions",
    blockers: [],
    executionBoundary: readonlyBoundary(),
  }
  writeImmutableJson(output.terminal, terminal)

  console.log(JSON.stringify({
    ...terminal,
    terminalPath: projectPath(output.terminal),
    terminalSha256: sha256File(output.terminal),
  }, null, 2))
}

function validateAuthorization(authorizationPath) {
  const authorization = readJsonRequired(authorizationPath)
  assert(authorization.requestId === REQUEST_ID, "v9_architecture_design_authorization_request_invalid")
  assert(authorization.status === "resolved_owner_authorized", "v9_architecture_design_authorization_status_invalid")
  assert(authorization.ownerDecision?.commandRef === REQUEST_ID, "v9_architecture_design_command_ref_invalid")
  assert(authorization.ownerDecision?.scope === SCOPE, "v9_architecture_design_scope_invalid")
  assert(authorization.taskIdentity?.stage === 4, "v9_architecture_design_stage_invalid")
  assert(authorization.taskIdentity?.designContractId === DESIGN_CONTRACT_ID, "v9_architecture_design_contract_identity_invalid")
  assert(authorization.taskIdentity?.proposedArchitectureId === ARCHITECTURE_ID, "v9_architecture_design_architecture_identity_invalid")
  assert(authorization.taskIdentity?.conditionChannels === 23, "v9_architecture_design_condition_channel_count_invalid")
  assert(sameJson(authorization.taskIdentity?.preservedRequiredBoundarySides, ["west"]), "v9_architecture_design_west_topology_not_preserved")
  assert(sameJson(authorization.taskIdentity?.objectSemanticChannels, OBJECT_CHANNELS), "v9_architecture_design_object_channel_order_invalid")
  assert(sameJson(authorization.taskIdentity?.decoderScales, DECODER_SCALES), "v9_architecture_design_decoder_scale_identity_invalid")
  assert(authorization.taskIdentity?.requiredDiagnosticMetricCount === 17, "v9_architecture_design_required_metric_count_invalid")

  const actions = authorization.authorizedActions ?? {}
  for (const key of [
    "localV9ArchitectureDesignEntryImplementation",
    "oneCpuReadonlyArchitectureDesign",
    "architectureDesignReportWrite",
    "inactiveImplementationContractWrite",
    "terminalEvidenceWrite",
    "uniquePlanUpdate",
  ]) assert(actions[key] === true, `v9_architecture_design_action_closed:${key}`)
  for (const key of [
    "hyperparameterSelection",
    "checkpointFileReadOrLoad",
    "modelModification",
    "trainerModification",
    "smokeRunnerModification",
    "reviewThresholdModification",
    "optimizerCreation",
    "backwardExecution",
    "modelWeightModification",
    "gpuUse",
    "training",
    "automaticRetry",
  ]) assert(actions[key] === false, `v9_architecture_design_forbidden_action_open:${key}`)

  for (const [key, value] of Object.entries(authorization.bindings ?? {})) {
    assert(value?.path && value?.sha256, `v9_architecture_design_binding_incomplete:${key}`)
    assert(!/\.pt$/i.test(value.path), `v9_architecture_design_checkpoint_binding_forbidden:${key}`)
    assert(fileHashMatches(value.path, value.sha256), `v9_architecture_design_binding_changed:${key}`)
  }

  const consumption = readJsonRequired(authorization.consumptionPath)
  assert(consumption.status === "cpu_readonly_architecture_design_authorization_atomically_consumed", "v9_architecture_design_authorization_not_consumed")
  assert(consumption.requestId === REQUEST_ID && consumption.commandRef === REQUEST_ID, "v9_architecture_design_consumption_identity_invalid")
  assert(consumption.scope === SCOPE, "v9_architecture_design_consumption_scope_invalid")
  assert(consumption.authorizationSha256 === sha256File(authorizationPath), "v9_architecture_design_consumption_hash_changed")
  assert(consumption.hyperparameterSelected === false, "v9_architecture_design_consumption_hyperparameter_boundary_invalid")
  assert(consumption.checkpointFileRead === false, "v9_architecture_design_consumption_checkpoint_boundary_invalid")
  assert(consumption.gpuUsed === false && consumption.trainingStarted === false, "v9_architecture_design_consumption_execution_boundary_invalid")
  return authorization
}

function validateSourceEvidence(terminal, report, decision) {
  assert(terminal.status === "v8_stage4_smoke_failure_attribution_completed_closed", "v9_architecture_design_source_terminal_invalid")
  assert(terminal.decision === REQUIRED_DECISION, "v9_architecture_design_source_terminal_decision_invalid")
  assert(report.status === "v8_smoke_diagnostic_contract_and_visual_failure_attributed_read_only", "v9_architecture_design_source_report_invalid")
  assert(report.diagnosticAttribution?.classification === "diagnostic_metric_registration_or_export_contract_defect", "v9_architecture_design_diagnostic_attribution_invalid")
  assert(report.diagnosticAttribution?.expectedMetricCount === 17, "v9_architecture_design_source_metric_count_invalid")
  assert(report.diagnosticAttribution?.collectedMetricCount === 0, "v9_architecture_design_source_metric_gap_invalid")
  assert(sameJson(report.diagnosticAttribution?.expectedMetricNames, DIAGNOSTIC_METRIC_NAMES), "v9_architecture_design_source_metric_names_invalid")
  assert(report.visualAttribution?.classification === "current_v8_candidate_visual_effect_failure", "v9_architecture_design_visual_attribution_invalid")
  assert(report.visualAttribution?.previewPassCount === 0 && report.visualAttribution?.previewFailCount === 5, "v9_architecture_design_visual_timeline_invalid")
  assert(report.combinedFinding?.diagnosticContractDefectIndependentOfVisualResult === true, "v9_architecture_design_failure_independence_invalid")
  assert(report.combinedFinding?.currentV8CandidateQualifiedForStage4FullTraining === false, "v9_architecture_design_v8_exit_invalid")
  assert(decision.status === "current_v8_candidate_revision_exited_followup_architecture_design_required", "v9_architecture_design_source_decision_status_invalid")
  assert(decision.decision === REQUIRED_DECISION, "v9_architecture_design_source_decision_invalid")
  assert(Object.values(decision.activationGate ?? {}).every((value) => value === false), "v9_architecture_design_source_activation_gate_open")
}

function buildDesignReport({ authorizationPath, authorization, attributionReport, metricMappings, recordedAtUtc }) {
  return {
    schemaVersion: "local-ai-v9-stage4-object-semantic-decoder-alignment-architecture-design-v1",
    status: "v9_object_semantic_decoder_alignment_design_converged_inactive",
    recordedAtUtc,
    authorization: binding(authorizationPath),
    consumption: binding(authorization.consumptionPath),
    sourceEvidence: {
      v8AttributionTerminal: binding(authorization.bindings.v8AttributionTerminal.path),
      v8AttributionReport: binding(authorization.bindings.v8AttributionReport.path),
      v8ArchitectureDecision: binding(authorization.bindings.v8ArchitectureDecision.path),
      priorV8DesignReport: binding(authorization.bindings.priorV8DesignReport.path),
      priorV8InactiveContract: binding(authorization.bindings.priorV8InactiveContract.path),
      modelFrozen: binding(authorization.bindings.modelFrozen.path),
      trainerFrozen: binding(authorization.bindings.trainerFrozen.path),
      v8SmokeRunnerFrozen: binding(authorization.bindings.v8SmokeRunnerFrozen.path),
      formalSpecification: binding(authorization.bindings.formalSpecification.path),
    },
    businessFinding: {
      currentV8RevisionClosed: true,
      currentV8CheckpointEligibleForPromotion: false,
      problemA: "The V8 shared semantic-topology readout learned a lower aggregate BCE but did not deliver stable footprints, rock, and vegetation semantics into the final decoded image.",
      problemB: "The V8 Manifest exported training measurements but omitted all seventeen exact stage4Diagnostic fields required by the Smoke evidence contract.",
      relationship: "The visual-effect failure and diagnostic registration defect are independent; V9 must address both before another GPU execution can be considered.",
      v8PersistentEpoch30ObjectIssues: attributionReport.visualAttribution.epoch30PersistentIssues,
    },
    recommendation: {
      decision: "implement_bounded_v9_object_semantic_decoder_alignment_branch_after_separate_owner_authorization",
      designContractId: DESIGN_CONTRACT_ID,
      proposedArchitectureId: ARCHITECTURE_ID,
      rationale: "Replace the single aggregate object readout with four typed object projection routes at the two existing decoder scales, while retaining the already-correct sample-bound west route topology path and adding an exact diagnostic registry.",
      hyperparameterSelections: [],
    },
    architecture: {
      preservedBase: {
        conditionInputChannels: 23,
        conditionChannelOrderImmutable: true,
        latentOutputShapeUnchanged: true,
        decoderScalesReused: DECODER_SCALES,
        sampleBinding: { sampleId: "194", requiredBoundarySides: ["west"], topologyAuthority: "approved_world_facts_and_project_route_geometry" },
        autoencoderPolicy: "frozen_for_feature_and_rgb_alignment; never optimized by this branch",
        routeTopologyPath: "preserve the V8 sample-bound terrain_path_ground and route_required_boundary supervision/readout as a separate route path",
      },
      newV9ObjectPath: {
        objectTypes: OBJECT_CHANNELS,
        typedProjectionCount: 8,
        projectionRule: "For each of four object types, add one typed projection/fusion tap at up1 and one at up0; no object type may share its input identity with another type before its typed projection.",
        up1Role: "Align coarse object extent and contextual placement with the corresponding frozen Autoencoder decoded feature scale.",
        up0Role: "Align fine object boundary, texture-response placement, and semantic visibility with the corresponding frozen Autoencoder decoded feature scale.",
        readoutRule: "Expose one independently addressable semantic readout per object type, plus the preserved route/topology readout; do not collapse the four object targets into a single qualification signal.",
        fusionRule: "Fuse typed object features into the existing up1/up0 Denoiser path without changing the 23-channel input contract or latent output tensor shape.",
        noNewScale: true,
        noParallelBackend: true,
      },
      legalSupervisionSources: [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts",
        "original_object_semantic_and_identity_masks",
        "current_training_prediction_decoded_by_frozen_project_autoencoder",
        "frozen_project_autoencoder_decoded_features",
        "approved_project_route_geometry_and_region_graph_for_west_topology_consistency",
      ],
      forbiddenTrainingTargets: [
        "failed_preview_pixels",
        "machine_review_thresholds",
        "machine_review_pass_or_fail_labels",
        "diagnostic_qualification_thresholds",
        "historical_failed_checkpoint_outputs",
      ],
      modelStructureImpact: {
        newTrainableComponents: [
          "four_typed_object_projection_adapters_at_up1",
          "four_typed_object_projection_adapters_at_up0",
          "four_independent_object_semantic_readouts",
        ],
        frozenComponents: ["project_autoencoder_encoder", "project_autoencoder_decoder"],
        unchangedInterfaces: ["23_channel_condition_input", "denoiser_latent_input", "denoiser_latent_output_shape", "existing_stage_resolutions"],
        checkpointSchemaChanges: true,
      },
    },
    compatibility: {
      oldStage3AndStage4BehaviorPreservedByExplicitArchitectureBranch: true,
      v7AndV8CheckpointLoadIntoV9: "must_reject",
      reason: "V9 introduces object-specific projection and readout parameters that do not exist in V7/V8 checkpoint schemas.",
      futureStage0Initialization: "fixed_random_initialization_only",
      futureStage1Initialization: "same_run_stage0_checkpoint_only",
      futureStage2Initialization: "same_run_stage1_checkpoint_only",
      datasetAndSplit: "reuse approved 64/64 V7 capacity contribution and immutable 48/8/4/4 split; sample 194 remains validation-only for an explicitly authorized bounded diagnostic or Smoke",
      existingReviewThresholds: "unchanged_and_not_a_training_target",
    },
    resourceRisk: {
      overall: "medium_high_but_bounded",
      contributors: [
        "Eight typed projection taps add Denoiser activations at the existing up1 and up0 scales.",
        "Four independent semantic readouts and frozen decoded-feature comparisons add diagnostic and training-time tensors.",
        "Decoded-domain alignment retains the project Autoencoder in frozen inference/feature mode.",
      ],
      bounds: [
        "No new decoder scale or second Denoiser is introduced.",
        "The Autoencoder remains frozen and is not part of the optimizer.",
        "Input channels, latent shape, dataset identity, split, and Stage4 resolution schedule remain unchanged.",
        "Future GPU execution requires fresh resource and disk preflight under separate authorization.",
      ],
    },
    rollback: {
      point: "Before any V9 GPU diagnostic or Smoke authorization, retain V9 as an inactive architecture branch and configuration only.",
      action: "Disable/remove only the V9 branch, its four object projection/readout paths, and its exact diagnostic registry while leaving V7/V8 code paths and all historical evidence immutable.",
      checkpointPolicy: "Never promote the failed V8 Smoke checkpoint or any future V9 diagnostic/Smoke checkpoint automatically.",
    },
    diagnosticManifestRegistrationContract: {
      contractId: "stage4_diagnostic_manifest_registration_contract_v1",
      recordLocation: "manifest.metrics[*] for fixed preview epochs 1, 5, 10, 20, and 30",
      exactFieldCount: 17,
      exactFieldOrder: metricMappings.map((row) => row.manifestField),
      mappings: metricMappings,
      serializationRules: [
        "Every fixed-preview epoch record must contain all seventeen fields as finite nonnegative JSON numbers.",
        "No additional stage4Diagnostic-prefixed field is permitted without a new versioned contract.",
        "Runner collection, finalization evidence, and Manifest registration must use the same exact field order and spelling.",
        "ObjectGradientAvailable must be 1 only when all four object gradient-contribution fields are finite and strictly positive; otherwise it is 0 and qualification must fail.",
        "Metric export and visual machine review remain independent gates; exported metrics cannot reclassify a failed visual review.",
      ],
    },
    acceptanceRoute: {
      cpuBeforeAnyGpu: [
        "Synthetic tensor shape test: preserve 23 condition channels and latent output shape at up1 and up0.",
        "Channel identity/order test: each object mask reaches only its matching typed projections and readout.",
        "Gradient isolation test: each object loss produces a finite nonzero gradient in its own V9 path and rejects cross-object leakage.",
        "Frozen Autoencoder test: Denoiser gradients are available while all Autoencoder parameters and state hashes remain unchanged.",
        "West topology regression: sample 194 remains validation identity with requiredBoundarySides exactly west, and existing route metrics remain registered.",
        "Illegal supervision test: failed previews, review thresholds, review labels, and arbitrary external masks are rejected.",
        "Compatibility test: V7/V8 checkpoints are rejected by V9 while legacy architecture modes retain their existing behavior.",
        "Manifest test: fixed epochs 1/5/10/20/30 each contain exactly the seventeen versioned diagnostic fields and no unknown diagnostic fields.",
      ],
      futureGpuUnderSeparateAuthorization: [
        "One fixed forward-and-gradient routing diagnostic using sample 194, seed 20263722, west topology, and the frozen project Autoencoder.",
        "Only after the diagnostic passes, one separately authorized fixed 30 Epoch single-sample V9 Smoke with previews at Epoch 1/5/10/20/30.",
        "The Smoke must pass unchanged machine-review gates and produce all seventeen diagnostics before Stage4 full training may be requested.",
      ],
      stage4CompletionStillRequires: "A separately authorized Stage0-to-Stage1-to-Stage2 complete training run on the approved 64/64 data and 48/8/4/4 split, with every fixed preview review passing.",
    },
    executionBoundary: readonlyBoundary(),
  }
}

function buildInactiveContract({ authorizationPath, authorization, metricMappings, recordedAtUtc }) {
  return {
    schemaVersion: "stage4-v9-bounded-inactive-architecture-implementation-contract-v1",
    status: "designed_inactive_not_implemented",
    recordedAtUtc,
    contractId: DESIGN_CONTRACT_ID,
    proposedArchitectureId: ARCHITECTURE_ID,
    sourceAuthorization: binding(authorizationPath),
    sourceDecision: binding(authorization.bindings.v8ArchitectureDecision.path),
    immutableIdentity: {
      conditionChannels: 23,
      objectSemanticChannels: OBJECT_CHANNELS,
      decoderScales: DECODER_SCALES,
      requiredBoundarySides: ["west"],
      fixedDiagnosticEpochs: FIXED_PREVIEW_EPOCHS,
      exactDiagnosticMetricCount: 17,
      exactDiagnosticMetricNames: metricMappings.map((row) => row.manifestField),
    },
    boundedImplementationScope: {
      architectureBranch: ARCHITECTURE_ID,
      addTypedObjectAdaptersAtExistingScalesOnly: true,
      addFourIndependentObjectReadouts: true,
      preserveExistingRouteTopologyReadout: true,
      preserveConditionInputAndLatentOutputShapes: true,
      addExactDiagnosticManifestRegistry: true,
      selectHyperparameters: false,
      readOrLoadCheckpoint: false,
      createOptimizer: false,
      executeBackward: false,
      modifyWeights: false,
      useGpu: false,
      train: false,
    },
    supervisionPolicy: {
      allowed: [
        "original_owner_approved_reference_rgb",
        "original_compiled_23_channel_condition_pack",
        "approved_world_facts",
        "original_object_semantic_and_identity_masks",
        "current_training_prediction_decoded_by_frozen_project_autoencoder",
        "frozen_project_autoencoder_decoded_features",
        "approved_project_route_geometry_and_region_graph_for_west_topology_consistency",
      ],
      forbidden: [
        "failed_preview_pixels",
        "machine_review_thresholds",
        "machine_review_pass_or_fail_labels",
        "historical_failed_checkpoint_outputs",
        "unregistered_external_masks_or_geometry",
      ],
    },
    diagnosticManifestFields: metricMappings,
    checkpointCompatibility: {
      v7OrV8ParentDenoiserCheckpointAllowed: false,
      futureV9Stage0MustUseFixedRandomInitialization: true,
      futureV9Stage1AndStage2MayOnlyUseSameRunPreviousStage: true,
    },
    activationGate: {
      architectureImplementedNow: false,
      trainerSupportImplementedNow: false,
      diagnosticRegistryImplementedNow: false,
      inactiveConfigCompiledNow: false,
      hyperparametersSelectedNow: false,
      checkpointReadOrLoadedNow: false,
      optimizerCreatedNow: false,
      backwardExecutedNow: false,
      weightsModifiedNow: false,
      gpuUsedNow: false,
      trainingNow: false,
      stage4FullTrainingNow: false,
      checkpointPromotionNow: false,
    },
    nextOwnerAction: "separately_authorize_cpu_only_v9_architecture_support_diagnostic_registry_inactive_config_and_positive_negative_regressions",
    failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true },
  }
}

function buildMetricMappings() {
  const rows = []
  for (const objectName of OBJECTS) {
    const objectChannel = `object_${objectName.toLowerCase()}`
    rows.push({
      manifestField: `stage4DiagnosticObject${objectName}IndependentLoss`,
      type: "finite_nonnegative_number",
      source: `${objectChannel}_v9_independent_semantic_readout_vs_original_object_semantic_mask`,
      definition: "Per-object semantic alignment loss computed independently from the matching original object mask/reference-domain supervision; no failed preview pixels or review thresholds are permitted.",
    })
    rows.push({
      manifestField: `stage4DiagnosticObject${objectName}GradientContribution`,
      type: "finite_nonnegative_number",
      source: `${objectChannel}_loss_gradient_to_matching_v9_up1_up0_projection_path`,
      definition: "Norm of the matching object loss contribution to that object's typed V9 projection/readout route, sampled before an optimizer step; cross-object routes are excluded.",
    })
    rows.push({
      manifestField: `stage4DiagnosticObject${objectName}DecodedResponsePrototypeMae`,
      type: "finite_nonnegative_number",
      source: `${objectChannel}_masked_frozen_autoencoder_decoded_prediction_vs_original_approved_reference`,
      definition: "Masked decoded-domain prototype MAE between the current prediction decoded by the frozen project Autoencoder and the original approved reference inside the original matching object semantic mask.",
    })
  }
  rows.push({
    manifestField: "stage4DiagnosticObjectGradientAvailable",
    type: "binary_number_0_or_1",
    source: "all_four_object_gradient_contribution_fields",
    definition: "1 only when all four object gradient contributions are finite and strictly positive; otherwise 0.",
  })
  rows.push({
    manifestField: "stage4DiagnosticRouteActivationMassRatio",
    type: "finite_nonnegative_number",
    source: "terrain_path_ground_predicted_response_and_original_condition_mask",
    definition: "Ratio of predicted route-response mass to original terrain_path_ground mask mass for the bound sample.",
  })
  rows.push({
    manifestField: "stage4DiagnosticRouteSpatialDistributionL1",
    type: "finite_nonnegative_number",
    source: "terrain_path_ground_normalized_spatial_response_and_original_condition_mask",
    definition: "L1 distance between normalized predicted route spatial response and the original terrain_path_ground mask distribution.",
  })
  rows.push({
    manifestField: "stage4DiagnosticRouteCentroidDrift",
    type: "finite_nonnegative_number",
    source: "terrain_path_ground_predicted_and_original_centroids",
    definition: "Normalized centroid distance between predicted route response and the original terrain_path_ground mask.",
  })
  rows.push({
    manifestField: "stage4DiagnosticRouteRequiredBoundaryContactMinimum",
    type: "finite_nonnegative_number",
    source: "approved_world_facts_project_route_geometry_and_west_boundary_consistency_projection",
    definition: "Minimum predicted route contact on the required west boundary; WorldFacts and approved project geometry are authoritative and the condition mask is a consistency projection.",
  })
  return rows
}

function readonlyBoundary() {
  return {
    hyperparametersSelected: false,
    checkpointFileRead: false,
    checkpointLoaded: false,
    modelModified: false,
    trainerModified: false,
    smokeRunnerModified: false,
    reviewThresholdsModified: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    gpuUsed: false,
    trainingStarted: false,
    checkpointWritten: false,
    automaticRetryStarted: false,
  }
}

function argument(argv, name) { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : null }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolve(value)).replaceAll("\\", "/") }
function readJsonRequired(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { return fs.existsSync(resolve(value)) && sha256File(value) === expected }
function binding(value) { return { path: projectPath(value), sha256: sha256File(value) } }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function assert(condition, message) { if (!condition) throw new Error(message) }
function writeImmutableJson(value, body) {
  const absolute = resolve(value)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try {
    fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}

try { main() } catch (error) { console.error(error?.stack ?? String(error)); process.exitCode = 1 }
