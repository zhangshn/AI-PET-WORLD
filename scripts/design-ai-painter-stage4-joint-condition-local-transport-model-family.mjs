import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  CANDIDATE_AXIS,
  CANDIDATE_CAPABILITY,
  DESIGN_DECISION,
  NEXT_LEGAL_ACTION,
  deriveJointConditionLocalTransportDesign,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-design-v1.mjs"
import {
  ensureAiPainterProgramEventCommitted,
  formatShanghai,
  projectPath,
  verifyAiPainterProgramEventCommitted,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { catalogPath, logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const RUN_ID = `stage4-joint-condition-local-transport-design-${compactUtc()}-${crypto.randomUUID().slice(0, 8)}`
const OUTPUT_ROOT = inside(`.runtime/ai-painter/stage4-joint-condition-local-transport-designs/${RUN_ID}`)
const FAILURE_ROOT = inside(`.runtime/ai-painter/stage4-joint-condition-local-transport-design-failures/${RUN_ID}`)
const PLAN = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const CLASSIFICATION_ROOT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-smoke-failure-classifications/stage4-full-backbone-spatial-affine-smoke-failure-classification-20260829-122026631-8c731d5a")
const AXIS_ROOT = inside(".runtime/ai-painter/stage4-model-family-discriminations/stage4-model-family-discrimination-20260828232421-01")
const COUNTERFACTUAL_PLAN_ROOT = inside(".runtime/ai-painter/stage4-route-counterfactual-plans/stage4-route-counterfactual-plan-20260828001753-01")
const COUNTERFACTUAL_SMOKE_ROOT = inside(".runtime/ai-painter/stage4-route-counterfactual-compositor-controlled-smokes/stage4-route-counterfactual-compositor-smoke-20260828004950-01")
const COUNTERFACTUAL_FIXED40_ROOT = inside(".runtime/ai-painter/stage4-route-counterfactual-compositor-fixed-40-epoch-qualifications/stage4-route-counterfactual-compositor-fixed-40-epoch-20260828013231-01")
const RETIRED_ROOT = inside(".runtime/ai-painter/stage4-staged-successor-unique-derivation-reviews/stage4-staged-successor-unique-derivation-review-20260828031427-01")

const SOURCE = Object.freeze({
  classificationTerminal: path.join(CLASSIFICATION_ROOT, "phase-terminal.json"),
  classificationAnalysis: path.join(CLASSIFICATION_ROOT, "causal-analysis.json"),
  classificationDecision: path.join(CLASSIFICATION_ROOT, "unique-decision.json"),
  axisExhaustion: path.join(CLASSIFICATION_ROOT, "bounded-axis-exhaustion.json"),
  priorNextAction: path.join(CLASSIFICATION_ROOT, "local-next-action.json"),
  axisAudit: path.join(AXIS_ROOT, "model-family-axis-audit.json"),
  exitedRouteMatrix: inside(".runtime/ai-painter/stage4-direct-clean-latent-architecture-derivations/stage4-direct-clean-latent-derivation-20260827-02/exited-route-matrix.json"),
  counterfactualContract: path.join(COUNTERFACTUAL_PLAN_ROOT, "inactive-architecture-contract.json"),
  counterfactualDecision: path.join(COUNTERFACTUAL_PLAN_ROOT, "unique-route-decision.json"),
  counterfactualSmokeTerminal: path.join(COUNTERFACTUAL_SMOKE_ROOT, "phase-terminal.json"),
  counterfactualSmokeReview: path.join(COUNTERFACTUAL_SMOKE_ROOT, "machine-review.json"),
  counterfactualFixed40Terminal: path.join(COUNTERFACTUAL_FIXED40_ROOT, "phase-terminal.json"),
  counterfactualFixed40Review: path.join(COUNTERFACTUAL_FIXED40_ROOT, "machine-review.json"),
  counterfactualLifecycleTerminal: inside(".runtime/ai-painter/capability-lifecycle/stage4-native-route-counterfactual-compositor-fixed-40-qualification-successor-v1/phase-terminal.json"),
  retiredSignatureIndex: path.join(RETIRED_ROOT, "retired-signature-index.json"),
  retiredUniqueReview: path.join(RETIRED_ROOT, "successor-structure-unique-derivation-review.json"),
  fullBackboneContract: inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-cpu-supports/stage4-full-backbone-spatial-affine-cpu-support-20260829002039-4237acc7-b88f-49e3-b043-95aeeaf6cd9c/architecture-support-contract.json"),
  nativeConditionEncoderContract: inside(".runtime/ai-painter/stage4-native-condition-encoder-plans/stage4-native-condition-encoder-plan-20260827103736-01/bounded-successor-contract.json"),
  formalObjective: inside("data/ai-painter/system-governance/stage4-formal-diffusion-objective-and-checkpoint-contract-v1.json"),
  modelSource: inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: inside("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
})

const EXPECTED = Object.freeze({
  classificationTerminal: "e1ef947bf92e8bedf2b3f4c8afff367bbba8ede48032133778f700d2013de526",
  classificationAnalysis: "4255a4901cde0d46ea95cd3b184873e0e676650eb1144c4c9a9ae4f65c2d3630",
  classificationDecision: "ea0db120b86bca2ce7da9fa74fbcdc0f0b6b2757f80b05a974ac96ce319a5c06",
  axisExhaustion: "b8d5dd9a6967188820a23dd04146f57950cdffce8d191f54a48c951fec123c26",
  priorNextAction: "49445ae684a159d73f1f309f973a3ad11013945cb42f441af2c0d5937809bc25",
  axisAudit: "5043fbd72416052a11fce320d15dabf1f43462c8acf21d16aae6294edbaa29f9",
  exitedRouteMatrix: "4903f66ea898e8266105980ec743f554b3307db22d76a8218e274a390387e13e",
  counterfactualContract: "4900a99f2d092582c15d546fc1054c10516ccfe2d78dd6f94683cc5c8579141b",
  counterfactualDecision: "947199c0c2f8568e3bb5e27f72e1e94bc511207896e7c9bfcba713369261de23",
  counterfactualSmokeTerminal: "223abfae4252cbb66b3a6d5d5a0074b0f5b1ad4adccb96704e95e39b90bbef57",
  counterfactualSmokeReview: "09234fc4544a57ef612b572ec4da00750c12674f34617f672596647498630e9c",
  counterfactualFixed40Terminal: "8db2d1ff2abf81308ac9d8f8d032350f84be59423fd17e4f54442e45d69a09ea",
  counterfactualFixed40Review: "8c11d206c07bc1bb73f46ed35aa8b54c98f05054a36f85779e168d6617619bb4",
  counterfactualLifecycleTerminal: "c87cab78df310b7ff9544dfb6fd5486b14a259a153e706e18910ab3f69cbdb9e",
  retiredSignatureIndex: "ac48bf47da0cfb2476718f08fff39b2361366d2ab1173b5c266f9542af86498a",
  retiredUniqueReview: "6763db033cf97529ab5eaedd18522f4ab419a98d890f4ecfc021f4a15ea95163",
  fullBackboneContract: "667d3e3501aa12a7e69745ca801944cccd6188532100cde859040590b814c8c1",
  nativeConditionEncoderContract: "564d1c2bf75c18ab260f30ee605a3f1a22283cbbc1da2de0ae2cf69276e74698",
  formalObjective: "779027a5fe2a58d80be4519d7df17a5dc39ffd58307a627eef09620adaf42059",
  modelSource: "ff94e0b009a188d6d60af4c961db3c8d8c2608980731be41032ced0e1180c132",
  modeRegistry: "d7faa410774d4352fdca60f10f9ec81aba7f1897d30f269ea4e826b442f1c54d",
})

const CHECKER = inside("scripts/check-ai-painter-stage4-joint-condition-local-transport-design.mjs")
const LIBRARY = inside("scripts/lib/ai-painter-stage4-joint-condition-local-transport-design-v1.mjs")

const FILES = Object.freeze({
  metadata: path.join(OUTPUT_ROOT, "run-metadata.json"),
  problem: path.join(OUTPUT_ROOT, "problem-report.json"),
  historyAudit: path.join(OUTPUT_ROOT, "history-mechanism-nonduplication-audit.json"),
  designReport: path.join(OUTPUT_ROOT, "model-family-design-report.json"),
  inactiveContract: path.join(OUTPUT_ROOT, "inactive-model-family-contract.json"),
  parameterAudit: path.join(OUTPUT_ROOT, "parameter-derivation-audit.json"),
  objectiveRisk: path.join(OUTPUT_ROOT, "objective-review-risk-audit.json"),
  resourceBoundary: path.join(OUTPUT_ROOT, "resource-boundary.json"),
  decision: path.join(OUTPUT_ROOT, "unique-bounded-decision.json"),
  cpuReport: path.join(OUTPUT_ROOT, "cpu-report.json"),
  nextAction: path.join(OUTPUT_ROOT, "local-next-action.json"),
  terminal: path.join(OUTPUT_ROOT, "phase-terminal.json"),
  capsule: path.join(OUTPUT_ROOT, "local-task-capsule.json"),
  stagedPlan: path.join(OUTPUT_ROOT, "next-plan.md"),
  planReceipt: path.join(OUTPUT_ROOT, "plan-commit-receipt.json"),
  planSync: path.join(OUTPUT_ROOT, "plan-sync-record.json"),
  projectionJournal: path.join(OUTPUT_ROOT, "projection-journal.json"),
})

main().catch((error) => {
  recordFailure(error)
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})

async function main() {
  const existing = await readCurrentExecutionRegistry(ROOT)
  assert.equal(existing.ok, true, existing.errorCode)
  assert.equal(existing.registry.registryRevision, 50)
  assert.equal(existing.registry.eventSequence, 50)
  assert.equal(existing.registry.taskId, "design_stage4_new_bounded_model_family_outside_exhausted_three_axis_universe")
  assert.equal(existing.registry.taskKind, "cpu_readonly_bounded_model_family_design")
  assert.equal(existing.registry.activity, "bounded_new_model_family_cpu_design_pending")
  assert.equal(existing.registry.activeExecution, null)
  assert.equal(existing.registrySha256, "92616482c4f2dad254afb72c8f4441510706782076ab139af3897559e70c8540")

  for (const [role, file] of Object.entries(SOURCE)) {
    assert.equal(fs.existsSync(file), true, `required source missing: ${projectPath(file)}`)
    assert.equal(sha(file), EXPECTED[role], `${role} SHA-256 mismatch`)
  }
  for (const file of [CHECKER, LIBRARY, PLAN]) {
    assert.equal(fs.existsSync(file), true, `required file missing: ${projectPath(file)}`)
  }
  assert.equal(fs.existsSync(OUTPUT_ROOT), false, "design output reuse is forbidden")
  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true })
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false })

  const recordedAtUtc = new Date().toISOString()
  const recordedAtAsiaShanghai = formatShanghai(recordedAtUtc)
  const planBeforeSha256 = sha(PLAN)
  ensureJson(FILES.metadata, {
    schemaVersion: "stage4-joint-condition-local-transport-design-run-metadata-v1",
    runId: RUN_ID,
    sourceRegistryRevision: existing.registry.registryRevision,
    sourceRegistrySha256: existing.registrySha256,
    planBeforeSha256,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const checker = spawnSync(process.execPath, [CHECKER], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  })
  assert.equal(checker.status, 0, checker.stderr || checker.stdout)
  const checkerResult = JSON.parse(checker.stdout)
  assert.equal(checkerResult.status, "passed")
  assert.equal(checkerResult.totalCases, 17)

  const sourceDecision = read(SOURCE.classificationDecision)
  const sourceAnalysis = read(SOURCE.classificationAnalysis)
  const axisExhaustion = read(SOURCE.axisExhaustion)
  const priorNextAction = read(SOURCE.priorNextAction)
  const axisAudit = read(SOURCE.axisAudit)
  const exitedRoutes = read(SOURCE.exitedRouteMatrix)
  const counterfactualContract = read(SOURCE.counterfactualContract)
  const counterfactualSmokeReview = read(SOURCE.counterfactualSmokeReview)
  const counterfactualFixed40Review = read(SOURCE.counterfactualFixed40Review)
  const counterfactualLifecycle = read(SOURCE.counterfactualLifecycleTerminal)
  const retiredIndex = read(SOURCE.retiredSignatureIndex)
  const retiredReview = read(SOURCE.retiredUniqueReview)

  assert.equal(sourceDecision.classification, "full_backbone_spatial_affine_frozen_smoke_capability_insufficient_confirmed")
  assert.equal(sourceDecision.candidateDisposition, "rejected_failed_closed")
  assert.equal(sourceAnalysis.findings.trainingWasEffectiveButInsufficient, true)
  assert.equal(axisExhaustion.boundedUniverseExhausted, true)
  assert.equal(axisExhaustion.allMathematicallyPossibleArchitecturesExhausted, false)
  assert.equal(priorNextAction.action, "design_stage4_new_bounded_model_family_outside_exhausted_three_axis_universe")
  assert.equal(axisAudit.axes.length, 3)
  assert.equal(axisAudit.doesNotClaimAllMathematicallyPossibleArchitecturesAreExhausted, true)
  assert.equal(exitedRoutes.routes.every((route) => route.excludedFromReuse === true), true)
  assert.equal(counterfactualContract.architecture, "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1")
  assert.equal(counterfactualContract.latentOwnership.freeBlendWeightsPresent, false)
  assert.equal(counterfactualSmokeReview.previewPassCount, 0)
  assert.equal(counterfactualFixed40Review.previewPassCount, 0)
  assert.equal(counterfactualLifecycle.state, "rejected")
  assert.equal(counterfactualLifecycle.releaseIdentity, null)
  assert.equal(retiredIndex.signatures.some((item) => (
    item.identity === "stage4-native-route-counterfactual-compositor-fixed-40-qualification-successor-v1"
    && item.state === "retired_real_visual_failure"
  )), true)
  assert.equal(retiredReview.renamedRetiredRouteAllowed, false)

  const sourceCorpus = [SOURCE.modelSource, SOURCE.modeRegistry]
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n")
  const operatorSearch = [
    "joint_condition_local_spatial_transport",
    "JointConditionLocalTransport",
    "masked_neighbor_softmax",
    "feature_neighbor_transport",
    "torch.nn.functional.unfold",
    "F.unfold(",
  ].map((term) => ({ term, count: literalCount(sourceCorpus, term) }))
  const candidateOperatorSourceHits = operatorSearch.reduce((sum, row) => sum + row.count, 0)
  assert.equal(candidateOperatorSourceHits, 0)

  const designInput = buildDesignInput({
    sourceDecision,
    axisExhaustion,
    counterfactualSmokeReview,
    counterfactualFixed40Review,
    candidateOperatorSourceHits,
  })
  const design = deriveJointConditionLocalTransportDesign(designInput)
  assert.equal(design.status, "uniquely_derived_inactive_bounded_hypothesis")
  assert.equal(design.parameterCount, 22464)
  assert.equal(design.activationBoundary.smokeReady, false)

  const fixedProgress = { completedStages: 3, totalStages: 5, percent: 60 }
  const sourceEvidence = Object.fromEntries(
    Object.entries(SOURCE).map(([role, file]) => [role, bind(file)]),
  )
  ensureJson(FILES.problem, {
    schemaVersion: "stage4-joint-condition-local-transport-design-problem-report-v1",
    status: "completed",
    runId: RUN_ID,
    facts: {
      priorBoundedAxesExhausted: true,
      allArchitecturesExhausted: false,
      latestFrozenSmokePassCount: 0,
      latestFrozenSmokeReviewCount: 5,
      persistentObjectMaskedLumaCorrelationFailure: true,
      persistentUnauthorizedRouteBoundaryContact: "south",
      historicalCounterfactualRouteAlreadyRetired: true,
      historicalCounterfactualRouteMayBeRenamedAndReused: false,
    },
    sourceClassification: bind(SOURCE.classificationTerminal),
    checkpointWeightsRead: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const mechanismMatrix = historicalMechanismMatrix()
  ensureJson(FILES.historyAudit, {
    schemaVersion: "stage4-joint-condition-local-transport-history-nonduplication-audit-v1",
    status: "verified_non_repeated_within_current_audited_mechanism_set",
    runId: RUN_ID,
    candidateCapabilityVersion: CANDIDATE_CAPABILITY,
    candidateAxis: CANDIDATE_AXIS,
    candidateOperatorSignature: design.operatorSignature,
    sourceOperatorSearch: {
      files: [bind(SOURCE.modelSource), bind(SOURCE.modeRegistry)],
      terms: operatorSearch,
      totalHits: candidateOperatorSourceHits,
    },
    mechanismMatrix,
    explicitlyRejectedRenamedSuccessor: {
      proposedMechanism: "authoritative_entity_exchange_plus_multi_branch_counterfactual_render_and_hard_composition",
      disposition: "rejected_as_substantive_repeat_of_retired_counterfactual_hard_ownership_family",
      historicalContract: bind(SOURCE.counterfactualContract),
      historicalSmokeTerminal: bind(SOURCE.counterfactualSmokeTerminal),
      historicalFixed40Terminal: bind(SOURCE.counterfactualFixed40Terminal),
      historicalLifecycleTerminal: bind(SOURCE.counterfactualLifecycleTerminal),
      renamedRetiredRouteAllowed: false,
    },
    claimBoundary: {
      currentWorkspaceAndRegisteredHistoryNonRepeated: true,
      globalMathematicalUniquenessClaimed: false,
      approximateFunctionalEquivalenceToAllPossibleNetworksExcluded: false,
    },
    checkpointWeightsRead: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.designReport, {
    schemaVersion: "stage4-joint-condition-local-transport-model-family-design-report-v1",
    status: "cpu_design_completed_inactive",
    runId: RUN_ID,
    candidateCapabilityVersion: CANDIDATE_CAPABILITY,
    candidateAxis: CANDIDATE_AXIS,
    decision: DESIGN_DECISION,
    substantiveDifference: "joint_23_channel_conditions_select_normalized_feature_values_from_a_masked_three_by_three_neighbor_simplex_at_each_existing_residual_norm_site",
    derivation: design,
    failureEvidenceInterpretation: {
      objectFailure: "low_masked_luma_spatial_correlation_despite_local_response_and_rgb_error_improvement",
      routeFailure: "correct_coverage_and_centroid_but_wrong_connected_boundary_side",
      boundedHypothesis: "condition_controlled_neighbor_information_flow_may_change_spatial_ordering_and_connectivity_where_pointwise_affine_modulation_did_not",
      sufficientRepairClaimed: false,
    },
    historyNonDuplicationAudit: bind(FILES.historyAudit),
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.inactiveContract, {
    schemaVersion: "stage4-joint-condition-local-transport-inactive-model-family-contract-v1",
    status: "cpu_design_supported_implementation_inactive",
    runId: RUN_ID,
    capabilityVersion: CANDIDATE_CAPABILITY,
    architecture: CANDIDATE_CAPABILITY,
    operatorSignature: design.operatorSignature,
    blockLayout: design.blockLayout,
    parameterIdentity: {
      siteCount: design.siteCount,
      projectionCount: design.projectionCount,
      parameterTensorCount: design.parameterTensorCount,
      parametersPerSite: design.parametersPerSite,
      parameterCount: design.parameterCount,
      candidateTotalParameters: design.candidateTotalParameters,
      candidateDenoiserParameters: design.candidateDenoiserParameters,
    },
    executionFormula: [
      "z = group_norm(feature)",
      "logits = conv2d(resized_typed_conditions_23_to_9_kernel3_padding1_bias_true)",
      "weights = softmax(mask_off_canvas_neighbors(logits), axis=nine_offsets, temperature=1)",
      "transported[c,p] = sum_over_valid_offsets(weights[p,offset] * z[c,p+offset])",
      "existing_silu_and_convolution_continue_unchanged",
    ],
    frozenBoundary: designInput.frozenBoundary,
    forbiddenMutations: designInput.freeParameterAudit.forbiddenFields,
    activationGates: {
      cpuImplementation: "next",
      readonlyGpuQualification: "requires_cpu_implementation_and_positive_negative_regression",
      controlledSmoke: "requires_readonly_gpu_qualification_and_measured_resource_telemetry",
      stage0: "requires_controlled_smoke_machine_review_qualification",
      formalInference: false,
      runtimeFrame: false,
    },
    objectiveReviewAlignmentClaimed: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.parameterAudit, {
    schemaVersion: "stage4-joint-condition-local-transport-parameter-derivation-audit-v1",
    status: "passed",
    runId: RUN_ID,
    formula: "12 * (9 * 23 * 3 * 3 + 9)",
    sites: "6_existing_time_residual_blocks_times_2_group_norm_sites",
    outputChannels: "9_row_major_offsets_from_existing_three_by_three_feature_neighborhood",
    parametersPerSite: design.parametersPerSite,
    parameterCount: design.parameterCount,
    parameterTensorCount: design.parameterTensorCount,
    removedSpatialAffineParameters: design.removedSpatialAffineParameters,
    netParameterChangeFromFailedAffine: design.netParameterChangeFromFailedAffine,
    freeParameterChosen: false,
    sourceModel: bind(SOURCE.modelSource),
    sourceFullBackboneContract: bind(SOURCE.fullBackboneContract),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.objectiveRisk, {
    schemaVersion: "stage4-joint-condition-local-transport-objective-review-risk-audit-v1",
    status: "unresolved_risk_recorded_not_design_blocking",
    runId: RUN_ID,
    trainingObjective: {
      object: "masked_rgb_l1",
      route: "mask_and_forbidden_boundary_rgb_l1",
    },
    formalReview: {
      object: "masked_edge_mae_and_masked_luma_correlation_minimum_0_08",
      route: "rgb_route_classification_connected_component_and_authorized_boundary_side_contact",
    },
    exactStatisticAlignment: false,
    implications: {
      cpuInactiveDesignAllowed: true,
      readonlyGpuPlumbingQualificationAllowedAfterImplementation: true,
      controlledSmokeMayOnlyBeInterpretedAsBoundedFalsification: true,
      smokeSuccessGuaranteed: false,
      futureFailureMayBeAttributedToArchitectureAlone: false,
      loweringReviewThresholdAllowed: false,
      usingReviewPixelsAsTrainingTargetAllowed: false,
    },
    formalObjectiveContract: bind(SOURCE.formalObjective),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.resourceBoundary, {
    schemaVersion: "stage4-joint-condition-local-transport-resource-boundary-v1",
    status: "cpu_estimate_passed_gpu_measurement_pending",
    runId: RUN_ID,
    estimate: design.resourceEstimate,
    stage0CpuImplementation: {
      wallClockHardLimitSeconds: 60,
      rssHardLimitMiB: 1536,
      gpuAllowed: false,
      optimizerAllowed: false,
      checkpointReadAllowed: false,
    },
    futureReadonlyGpu: {
      minimumFreeGpuMemoryMiB: 4096,
      maxTorchAllocatedMiB: 512,
      maxTorchReservedMiB: 768,
      maxWddmProcessMiB: 2200,
      wallClockHardLimitSeconds: 15,
    },
    futureControlledSmoke: {
      fixedResolution: "256x192",
      fixedBatchSize: 1,
      fixedEpochs: 30,
      maxTorchAllocatedMiB: 512,
      maxTorchReservedMiB: 768,
      maxWddmProcessMiB: 2200,
      wallClockHardLimitSeconds: 120,
      outputDirectoryHardLimitMiB: 64,
    },
    stage1OrStage2ResourceQualified: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.decision, {
    schemaVersion: "stage4-joint-condition-local-transport-unique-bounded-decision-v1",
    status: "unique_bounded_non_repeated_hypothesis_selected_inactive",
    runId: RUN_ID,
    decision: DESIGN_DECISION,
    candidateCapabilityVersion: CANDIDATE_CAPABILITY,
    candidateAxis: CANDIDATE_AXIS,
    currentAuditedMechanismSetNonRepeated: true,
    globalArchitecturalUniquenessClaimed: false,
    sufficientRepairClaimed: false,
    cpuImplementationAllowed: true,
    gpuAllowedNow: false,
    trainingAllowedNow: false,
    smokeReady: false,
    stage0Ready: false,
    nextLegalAction: NEXT_LEGAL_ACTION,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    currentFixedProgress: fixedProgress,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.cpuReport, {
    schemaVersion: "stage4-joint-condition-local-transport-design-cpu-report-v1",
    status: "passed",
    runId: RUN_ID,
    checker: { ...bind(CHECKER), result: checkerResult },
    designLibrary: bind(LIBRARY),
    sourceEvidence,
    outputs: {
      historyAudit: bind(FILES.historyAudit),
      designReport: bind(FILES.designReport),
      inactiveContract: bind(FILES.inactiveContract),
      parameterAudit: bind(FILES.parameterAudit),
      objectiveRisk: bind(FILES.objectiveRisk),
      resourceBoundary: bind(FILES.resourceBoundary),
      decision: bind(FILES.decision),
    },
    safety: {
      checkpointWeightsRead: false,
      gpuStarted: false,
      optimizerCreated: false,
      backwardExecuted: false,
      modelWeightsModified: false,
      trainingStarted: false,
    },
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.nextAction, {
    schemaVersion: "stage4-local-next-action-v1",
    status: "ready_for_local_cpu_execution",
    runId: RUN_ID,
    action: NEXT_LEGAL_ACTION,
    taskKind: "cpu_inactive_model_family_implementation",
    constraints: {
      exactInactiveContractRequired: bind(FILES.inactiveContract),
      historicalMechanismReuseAllowed: false,
      freeArchitectureOrHyperparameterSelectionAllowed: false,
      checkpointReadAllowed: false,
      gpuAllowed: false,
      optimizerAllowed: false,
      trainingAllowed: false,
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.terminal, {
    schemaVersion: "stage4-joint-condition-local-transport-design-terminal-v1",
    executionState: "completed",
    status: "stage4_joint_condition_local_transport_cpu_design_succeeded_inactive",
    runId: RUN_ID,
    candidateCapabilityVersion: CANDIDATE_CAPABILITY,
    candidateAxis: CANDIDATE_AXIS,
    problemReport: bind(FILES.problem),
    historyNonDuplicationAudit: bind(FILES.historyAudit),
    modelFamilyDesignReport: bind(FILES.designReport),
    inactiveModelFamilyContract: bind(FILES.inactiveContract),
    parameterDerivationAudit: bind(FILES.parameterAudit),
    objectiveReviewRiskAudit: bind(FILES.objectiveRisk),
    resourceBoundary: bind(FILES.resourceBoundary),
    uniqueBoundedDecision: bind(FILES.decision),
    cpuReport: bind(FILES.cpuReport),
    localNextAction: bind(FILES.nextAction),
    nextLegalAction: NEXT_LEGAL_ACTION,
    fixedTotalProgress: fixedProgress,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    stage0Started: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  ensureJson(FILES.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "联合条件局部传输新模型家族CPU设计",
      status: "completed",
    },
    fixedOverallProgress: fixedProgress,
    uniqueDecision: DESIGN_DECISION,
    latestBlocker: "candidate_cpu_implementation_not_yet_completed",
    nextAllowedAction: {
      code: NEXT_LEGAL_ACTION,
      taskKind: "cpu_inactive_model_family_implementation",
      ownerAuthorizationRequired: false,
      automaticTrainingAllowed: false,
    },
    latestTrainingTerminal: existing.registry.latestTrainingTerminal,
    evidence: [
      FILES.problem,
      FILES.historyAudit,
      FILES.designReport,
      FILES.inactiveContract,
      FILES.parameterAudit,
      FILES.objectiveRisk,
      FILES.resourceBoundary,
      FILES.decision,
      FILES.cpuReport,
      FILES.nextAction,
      FILES.terminal,
    ].map((file) => ({
      ...bind(file),
      sha256Verified: true,
    })),
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_pending_atomic_advance",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const planSource = fs.readFileSync(PLAN, "utf8")
  const planAfter = updatePlan(planSource, recordedAtUtc)
  ensureText(FILES.stagedPlan, planAfter)
  const planAfterSha256 = sha(FILES.stagedPlan)
  commitPlan(planBeforeSha256, planAfterSha256)
  ensureJson(FILES.planReceipt, {
    schemaVersion: "stage4-joint-condition-local-transport-design-plan-commit-receipt-v1",
    status: "committed",
    runId: RUN_ID,
    planPath: projectPath(PLAN),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    terminal: bind(FILES.terminal),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })
  ensureJson(FILES.planSync, {
    schemaVersion: "stage4-joint-condition-local-transport-design-plan-sync-v1",
    status: "committed",
    runId: RUN_ID,
    planPath: projectPath(PLAN),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    planCommitReceipt: bind(FILES.planReceipt),
    terminal: bind(FILES.terminal),
    nextLegalAction: NEXT_LEGAL_ACTION,
    currentFixedProgress: fixedProgress,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })

  const eventInput = {
    id: `stage4-joint-condition-local-transport-design-${RUN_ID}`,
    timestamp: recordedAtUtc,
    action: "stage4_joint_condition_local_transport_cpu_design_succeeded_inactive",
    runId: RUN_ID,
    kind: "cpu_readonly_bounded_model_family_design",
    status: "success",
    title: "Stage4 joint-condition local-transport model-family design completed",
    titleZh: "Stage4联合条件局部传输模型家族CPU设计完成",
    detailZh: "历史反事实硬合成路线已识别为重复并排除；23通道联合条件控制3×3局部特征传输是当前登记机制集合中的未重复有界假设。设计未宣称保证通过，Loss与正式审核统计错位已登记为未解决风险。",
    evidencePath: projectPath(FILES.terminal),
    evidenceSha256: sha(FILES.terminal),
    fixedTotalProgress: fixedProgress,
  }

  for (const file of outputArtifacts()) index(file)
  const event = ensureAiPainterProgramEventCommitted(eventInput)
  const eventCommit = verifyAiPainterProgramEventCommitted(event)
  ensureJson(FILES.projectionJournal, {
    schemaVersion: "stage4-joint-condition-local-transport-design-projection-journal-v1",
    state: "dependencies_committed",
    runId: RUN_ID,
    sourceRegistry: {
      registryRevision: existing.registry.registryRevision,
      eventSequence: existing.registry.eventSequence,
      sha256: existing.registrySha256,
      transactionId: existing.registry.transactionId,
    },
    plan: {
      path: projectPath(PLAN),
      beforeSha256: planBeforeSha256,
      afterSha256: planAfterSha256,
      receipt: bind(FILES.planReceipt),
      sync: bind(FILES.planSync),
    },
    programEvent: event,
    terminal: bind(FILES.terminal),
    recordedAtUtc,
    recordedAtAsiaShanghai,
  })
  index(FILES.projectionJournal)

  const catalogFiles = [...outputArtifacts(), FILES.projectionJournal]
  const catalogArtifacts = catalogFiles.map((file) => ({
    logicalPath: logicalProjectPath(file),
    sha256: sha(file),
  }))
  const advanced = await advanceCurrentExecutionRegistry({
    projectRoot: ROOT,
    capabilityVersion: CANDIDATE_CAPABILITY,
    packageId: RUN_ID,
    taskId: NEXT_LEGAL_ACTION,
    taskKind: "cpu_inactive_model_family_implementation",
    runId: RUN_ID,
    lifecycleStage: "bounded_model_family_cpu_design_completed",
    executionState: "completed",
    activity: "joint_condition_local_transport_cpu_implementation_pending",
    taskCapsulePath: projectPath(FILES.capsule),
    terminalEvidencePath: projectPath(FILES.terminal),
    latestTrainingTerminal: existing.registry.latestTrainingTerminal,
    expectedPreviousRegistryRevision: existing.registry.registryRevision,
    expectedPreviousRegistrySha256: existing.registrySha256,
    dependencyManifest: {
      schemaVersion: "ai-painter-current-execution-registry-dependency-manifest-v1",
      mode: "external",
      outerJournal: {
        path: projectPath(FILES.projectionJournal),
        sha256: sha(FILES.projectionJournal),
        requiredState: "dependencies_committed",
      },
      bindings: [
        { role: "committed-plan", path: projectPath(PLAN), sha256: planAfterSha256 },
        { role: "plan-commit-receipt", ...bind(FILES.planReceipt) },
        { role: "design-terminal", ...bind(FILES.terminal) },
        { role: "inactive-model-family-contract", ...bind(FILES.inactiveContract) },
        { role: "history-nonduplication-audit", ...bind(FILES.historyAudit) },
        { role: "local-task-capsule", ...bind(FILES.capsule) },
        { role: "source-classification-terminal", ...bind(SOURCE.classificationTerminal) },
      ],
      programEvent: {
        eventId: event.id,
        event,
        ledgerPath: eventCommit.ledger.path,
        latestPath: eventCommit.latest.path,
        catalogDatabasePath: path.resolve(catalogPath),
      },
      catalogArtifacts,
    },
  })
  assert.equal(advanced.ok, true, advanced.errorCode)
  assert.equal(advanced.registry.registryRevision, 51)
  assert.equal(advanced.registry.taskId, NEXT_LEGAL_ACTION)
  assert.equal(advanced.registry.terminalEvidence.sha256, sha(FILES.terminal))

  process.stdout.write(`${JSON.stringify({
    status: read(FILES.terminal).status,
    runId: RUN_ID,
    candidateCapabilityVersion: CANDIDATE_CAPABILITY,
    candidateAxis: CANDIDATE_AXIS,
    decision: DESIGN_DECISION,
    repeatedCounterfactualProposalRejected: true,
    parameterCount: design.parameterCount,
    nextLegalAction: NEXT_LEGAL_ACTION,
    terminal: bind(FILES.terminal),
    historyNonDuplicationAudit: bind(FILES.historyAudit),
    inactiveModelFamilyContract: bind(FILES.inactiveContract),
    objectiveReviewRiskAudit: bind(FILES.objectiveRisk),
    cpuReport: bind(FILES.cpuReport),
    plan: { path: projectPath(PLAN), sha256: planAfterSha256 },
    currentRegistryRevision: advanced.registry.registryRevision,
    currentRegistrySha256: advanced.registrySha256,
    currentFixedProgress: fixedProgress,
    ownerAuthorizationRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`)
}

function buildDesignInput({
  sourceDecision,
  axisExhaustion,
  counterfactualSmokeReview,
  counterfactualFixed40Review,
  candidateOperatorSourceHits,
}) {
  return {
    evidence: {
      sourceClassification: sourceDecision.classification,
      sourceCandidateDisposition: sourceDecision.candidateDisposition,
      boundedThreeAxisUniverseExhausted: axisExhaustion.boundedUniverseExhausted,
      allMathematicalArchitecturesExhausted: axisExhaustion.allMathematicallyPossibleArchitecturesExhausted,
      routeCounterfactualRetired: true,
      routeCounterfactualSmokePassCount: counterfactualSmokeReview.previewPassCount,
      routeCounterfactualFixed40PassCount: counterfactualFixed40Review.previewPassCount,
    },
    nonDuplicationAudit: {
      candidateSignaturePreviouslyRegistered: false,
      candidateOperatorSourceHits,
      counterfactualHardOwnershipEquivalent: false,
      finalOutputModulationEquivalent: false,
      perClassIsolationEquivalent: false,
      spatialAffineEquivalent: false,
      fixedConvolutionEquivalent: false,
      renamedRetiredRouteAllowed: false,
    },
    modelBoundary: {
      conditionChannels: 23,
      latentChannels: 12,
      timeEmbeddingChannels: 256,
      baseChannels: 64,
      widthHierarchy: [64, 128, 256],
      blocks: [
        { id: "block0", channels: 64, width: 64, height: 48 },
        { id: "block1", channels: 128, width: 32, height: 24 },
        { id: "middle1", channels: 256, width: 16, height: 12 },
        { id: "middle2", channels: 256, width: 16, height: 12 },
        { id: "up_block1", channels: 128, width: 32, height: 24 },
        { id: "up_block0", channels: 64, width: 64, height: 48 },
      ],
    },
    transportBoundary: {
      sitePlacement: "replace_group_norm_output_before_existing_silu_and_convolution",
      sitesPerBlock: 2,
      siteCount: 12,
      projectionInputChannels: 23,
      projectionOutputChannels: 9,
      kernelSize: 3,
      padding: 1,
      bias: true,
      featureChannelSharedStencil: true,
      siteProjectionSharingAllowed: false,
      neighborOrder: "row_major_top_left_to_bottom_right",
      neighborOffsets: [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 0], [0, 1],
        [1, -1], [1, 0], [1, 1],
      ],
      offCanvasPolicy: "mask_invalid_then_renormalize_valid_neighbors",
      zeroPaddingAllowed: false,
      circularPaddingAllowed: false,
      reflectionPaddingAllowed: false,
      softmaxAxis: "nine_neighbor_offsets",
      softmaxTemperature: 1,
      learnableTemperatureAllowed: false,
      residualTransportBlendAllowed: false,
      spatialAffineCoexistenceAllowed: false,
    },
    frozenBoundary: {
      datasetCount: 64,
      split: [48, 8, 4, 4],
      seed: 20263722,
      autoencoderFrozen: true,
      existingLossValuesAndWeightsUnchanged: true,
      conditionChannelOrderUnchanged: true,
      checkpointFormatUnchanged: true,
      machineReviewThresholdsUnchanged: true,
      failedCheckpointReadAllowed: false,
      failedCheckpointInitializationAllowed: false,
    },
    riskBoundary: {
      trainingObjectiveEqualsFormalReviewStatistic: false,
      auditAlignmentClaimed: false,
      topologyGuaranteeClaimed: false,
      objectSemanticGuaranteeClaimed: false,
      smokeSuccessGuaranteed: false,
      boundedFalsifiableHypothesisOnly: true,
    },
    freeParameterAudit: {
      freeParameterChosen: false,
      freeParameterFields: [],
      forbiddenFields: [
        "temperature",
        "gate",
        "head_count",
        "group_count",
        "hidden_width",
        "extra_depth",
        "per_class_branch",
        "output_residual",
        "counterfactual_render_branch",
        "new_loss_or_weight",
      ],
    },
  }
}

function historicalMechanismMatrix() {
  return [
    ["v7_and_capacity_only", "fixed_convolution_condition_fusion_or_width_change", "not_dynamic_neighbor_transport"],
    ["v8_decoded_alignment", "additive_typed_condition_adapter", "not_dynamic_neighbor_transport"],
    ["v9_object_semantic_alignment", "per_class_projection_and_readout", "retired_per_class_axis"],
    ["structure_fact_first", "structure_heads_plus_multiscale_additive_adapters", "not_dynamic_neighbor_transport"],
    ["condition_preserving_semantic_renderer", "branch_feature_gate_times_residual", "not_dynamic_neighbor_transport"],
    ["fact_conditioned_semantic_mixture", "expert_velocity_contribution_and_participation", "retired_output_mixture"],
    ["final_condition_fusion", "condition_residual_added_to_velocity", "retired_final_output_axis"],
    ["isolated_responsibility_components", "separate_trainable_namespaces", "retired_per_class_and_phase_axis"],
    ["authoritative_semantic_carrier", "mask_gated_channel_contribution", "retired_output_axis"],
    ["post_decode_compositors", "mask_composed_rgb_proposals", "retired_decoded_output_axis"],
    ["direct_clean_latent", "fixed_condition_encoder_decoder_to_clean_latent", "not_dynamic_neighbor_transport"],
    ["responsibility_residuals", "mask_gated_latent_residuals", "retired_output_and_per_class_axes"],
    ["native_condition_encoder", "fixed_local_condition_convolution", "moves_conditions_not_backbone_feature_neighbors"],
    ["route_counterfactual_compositor", "shared_weight_multi_forward_plus_hard_mask_ownership", "retired_and_explicitly_forbidden_to_rename"],
    ["decoder_spatial_affine", "pointwise_gamma_beta_at_two_decoder_blocks", "retired_spatial_affine_axis"],
    ["full_backbone_spatial_affine", "pointwise_gamma_beta_at_twelve_norm_sites", "closest_but_not_neighbor_value_transport"],
  ].map(([identity, signature, disposition]) => ({ identity, signature, disposition }))
}

function updatePlan(source, utc) {
  const shanghai = formatShanghai(utc).replace("T", " ").replace("+08:00", " +08:00")
  const status = "状态：active-module-plan / AI Painter固定进度3/5（60%）；三轴外联合条件局部传输模型家族CPU设计已完成且历史去重通过，CPU未激活实现待执行"
  const current = "固定进度3/5（60%）；三条既有有界模型轴及历史反事实硬所有权路线均已退出；联合条件局部传输候选已完成CPU未激活设计、参数唯一派生和历史去重，尚未实现或训练"
  const next = "下一步由本地程序按冻结合同完成联合条件局部传输CPU未激活实现与正反回归；不得读取Checkpoint、启动GPU或训练"
  const latest = "全主干空间仿射候选的失败分类与三轴收口保持有效。在完整历史机制去重中，反事实多路渲染与硬所有权合成被确认与已完成30 Epoch及fixed-40验证并退休的路线实质重复，因此禁止换名复用。\n\n当前三轴外唯一保留的有界假设是联合23通道条件控制的3×3局部特征传输：在六个既有TimeResidualBlock的两个归一化位置分别以`23→9`投影产生邻域softmax权重，共12个位置、24个参数张量和22,464个参数；它替换失败候选的空间仿射，不增加宽度、深度、专家、门、温度、Loss或阈值。该候选在当前登记机制集合中未重复，但不宣称全数学空间唯一或保证视觉通过。"
  const blocker = "当前候选只完成CPU设计，尚未具备执行资格。正式训练Loss与机器审核统计并非同一指标：对象训练项以掩码内RGB误差为主，而审核还要求亮度空间相关性；道路训练项以区域RGB误差为主，而审核检查连通分量和授权边界侧。该错位已登记为未解决风险，不阻止CPU实现和只读GPU接线资格，但未来Smoke只能解释为有界证伪，不能把失败唯一归因于模型结构。\n\n固定进度保持3/5（60%）。唯一下一动作是按未激活合同实施联合条件局部传输算子、Mode Registry和CPU正反门；通过后才允许只读GPU资格，资格通过后才可建立一次固定30 Epoch受控Smoke。"
  let output = replaceOnce(source, /^更新时间：.*$/mu, `更新时间：${shanghai}`)
  output = replaceOnce(output, /^状态：.*$/mu, status)
  output = replaceOnce(
    output,
    /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu,
    `| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | ${current} | ${next} |`,
  )
  output = replaceOnce(output, /## 4\. 最近一次模块终态[\s\S]*?(?=\n## 5\.)/u, `## 4. 最近一次模块终态\n\n${latest}\n`)
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u, `## 5. 当前阻断与后续实施顺序\n\n${blocker}\n`)
  return output
}

function commitPlan(beforeSha256, afterSha256) {
  assert.equal(sha(PLAN), beforeSha256, "unique plan changed during design transaction")
  writeAtomicText(PLAN, fs.readFileSync(FILES.stagedPlan, "utf8"))
  assert.equal(sha(PLAN), afterSha256)
}

function replaceOnce(source, pattern, replacement) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
  const matches = source.match(new RegExp(pattern.source, flags)) ?? []
  assert.equal(matches.length, 1, `plan replacement count mismatch: ${pattern}`)
  return source.replace(pattern, replacement)
}

function outputArtifacts() {
  return [
    FILES.metadata,
    FILES.problem,
    FILES.historyAudit,
    FILES.designReport,
    FILES.inactiveContract,
    FILES.parameterAudit,
    FILES.objectiveRisk,
    FILES.resourceBoundary,
    FILES.decision,
    FILES.cpuReport,
    FILES.nextAction,
    FILES.terminal,
    FILES.stagedPlan,
    FILES.planReceipt,
    FILES.planSync,
    FILES.capsule,
  ]
}

function index(file) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: RUN_ID,
    artifactType: "stage4_joint_condition_local_transport_model_family_design",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}

function recordFailure(error) {
  try {
    fs.mkdirSync(FAILURE_ROOT, { recursive: true })
    const file = path.join(FAILURE_ROOT, "failure-report.json")
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, `${JSON.stringify({
        schemaVersion: "stage4-joint-condition-local-transport-design-failure-report-v1",
        status: "failed_closed",
        runId: RUN_ID,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        checkpointWeightsRead: false,
        gpuStarted: false,
        trainingStarted: false,
        recordedAtUtc: new Date().toISOString(),
      }, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
    }
  } catch {
    // The original error remains the authoritative failure when evidence writing also fails.
  }
}

function bind(file) {
  return { path: projectPath(file), sha256: sha(file) }
}

function literalCount(source, needle) {
  if (needle.length === 0) return 0
  return source.split(needle).length - 1
}

function compactUtc() {
  return new Date().toISOString().replace(/[-:.]/gu, "").replace("Z", "Z")
}

function inside(relative) {
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return candidate
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""))
}

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function ensureJson(file, value) {
  if (!fs.existsSync(file)) writeExclusiveJson(file, value)
  assert.deepEqual(read(file), value, `immutable JSON mismatch: ${projectPath(file)}`)
}

function writeExclusiveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function ensureText(file, value) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" })
  }
  assert.equal(fs.readFileSync(file, "utf8"), value, `immutable text mismatch: ${projectPath(file)}`)
}

function writeAtomicText(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temporary, value, { encoding: "utf8", flag: "wx" })
  fs.renameSync(temporary, file)
}
