import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  DECISIONS,
  adjudicateModelFamilyAxes,
  deriveFullBackboneSpatialAffineContract,
} from "./lib/ai-painter-stage4-model-family-discrimination-v1.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_CAPABILITY = "stage4_multiscale_spatial_affine_conditioned_decoder_v1"
const CANDIDATE_CAPABILITY = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
const RUN_ID = `stage4-model-family-discrimination-${compactUtc()}-01`
const NEXT_TASK = "implement_stage4_full_backbone_spatial_affine_cpu_inactive_support"
const OUTPUT = inside(`.runtime/ai-painter/stage4-model-family-discriminations/${RUN_ID}`)
const FAILURE_OUTPUT = inside(`.runtime/ai-painter/stage4-model-family-discrimination-failures/${RUN_ID}`)

const FILES = Object.freeze({
  currentRegistry: inside(".runtime/ai-painter/current-execution-registry/current.json"),
  sourceAdjudicationTerminal: inside(".runtime/ai-painter/stage4-spatial-affine-screen-causal-adjudications/spatial-affine-screen-causal-adjudication-20260828174231-01/phase-terminal.json"),
  sourceCausalAnalysis: inside(".runtime/ai-painter/stage4-spatial-affine-screen-causal-adjudications/spatial-affine-screen-causal-adjudication-20260828174231-01/causal-analysis.json"),
  sourceUniqueDecision: inside(".runtime/ai-painter/stage4-spatial-affine-screen-causal-adjudications/spatial-affine-screen-causal-adjudication-20260828174231-01/unique-decision.json"),
  sourceTrainingTerminal: inside(".runtime/ai-painter/stage4-spatial-affine-full-data-screens/spatial-affine-screen-20260828164219346-ad821831/phase-terminal.json"),
  sourceMachineReview: inside(".runtime/ai-painter/stage4-spatial-affine-full-data-screens/spatial-affine-screen-20260828164219346-ad821831/machine-review.json"),
  conditionFusionDecision: inside(".runtime/ai-painter/stage4-condition-fusion-stage0-final-route-adjudications/20260823-083751371/adjudication.json"),
  postDecodeObjectDecision: inside(".runtime/ai-painter/stage4-post-decode-object-rgb-formal-stage0/20260825-151100-post-decode-stage0/failure-decision.json"),
  postDecodeFullConditionDecision: inside(".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-formal-stage0/stage4-post-decode-full-condition-responsibility-stage0-2026082603/failure-decision.json"),
  directResidualTerminal: inside(".runtime/ai-painter/stage4-direct-responsibility-residual-formal-stage0/stage4-direct-responsibility-residual-stage0-20260827091911-01/phase-terminal.json"),
  nativeResidualRetirement: inside(".runtime/ai-painter/stage4-native-responsibility-residual-route-retirements/stage4-native-responsibility-residual-retirement-20260827234948-01/route-retirement-decision.json"),
  isolatedComponentCpuTerminal: inside(".runtime/ai-painter/stage4-isolated-responsibility-component-cpu-supports/20260823-155547115/phase-terminal.json"),
  isolatedComponentGpuTerminal: inside(".runtime/ai-painter/stage4-isolated-responsibility-component-gpu-qualification-successes/20260823-165500000/phase-terminal.json"),
  threeComponentReview: inside(".runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-review-recoveries/20260824-041617238/machine-review/fixed-preview-reviews.json"),
  threeComponentDecision: inside(".runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudications-v2/local-ai-20260824-134500-three-component-causal/adjudication.json"),
  authoritativeCarrierAdjudication: inside(".runtime/ai-painter/stage4-authoritative-semantic-carrier-formal-stage0/20260824-184800-authoritative-carrier-stage0/failure-adjudication-terminal.json"),
  modelSource: inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  uniquePlan: inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
  library: inside("scripts/lib/ai-painter-stage4-model-family-discrimination-v1.mjs"),
  checker: inside("scripts/check-ai-painter-stage4-model-family-discrimination.mjs"),
  runner: inside("scripts/run-ai-painter-stage4-model-family-discrimination.mjs"),
})

const EXPECTED = Object.freeze({
  currentRegistry: "1be7e22270d3a7994a13bb341616643ffa24f75377e0ae9c0742987ccb88ca6c",
  sourceAdjudicationTerminal: "aaa4f2b453624713b731cb2f718ad882657e1aeaab0b470cd11c098056b59f13",
  sourceCausalAnalysis: "23f56d852a749cab01bdddb43f985b2abd1dfe1f7544afa4f5d1e740288f5195",
  sourceUniqueDecision: "d511e32158b438d3b4db96e389af434bbe9db565786ad031c441ea9de111a7d8",
  sourceTrainingTerminal: "b695bca7c4b7e5f23b630f7f78818fe90c8177b05d1668034655d31b0b8e9496",
  sourceMachineReview: "2d8062383481522dd490605ffe3e22c33e4a9ab6a887e5f0c53a79623d32b9a3",
  conditionFusionDecision: "3061d8261ff7facefef3e2f7f17e4356fe766d36857fa8b8e50058cc2c799e58",
  postDecodeObjectDecision: "d716301f8e127b92b7d68beeef3c35a021ae90b0fd68d5b14a37a6e2ab18c675",
  postDecodeFullConditionDecision: "f24b4dff2e5c4e3490aaa5c7aad8b34026a20e0ff682aba3756ee255a69348d6",
  directResidualTerminal: "b6efb179ae303afd7b618b129320090e0594adeee4854458f76b005727ea5e7d",
  nativeResidualRetirement: "c847d01b807d38973d5c701c5b0a3905a9027141219971dd7415760f5ffcd57a",
  isolatedComponentCpuTerminal: "70c60698936d82e2d702e2cf86bbddf96d9358c716f2c6d5e875bca2fcd23acd",
  isolatedComponentGpuTerminal: "4ba30bde5b34dd03509807fcea6b1fe0a8c29698bf0d22978deb931e9a653b53",
  threeComponentReview: "af0ff92085ea19af7f21e34f8b39cc7a2d740f6090297511ef7340404c0d0978",
  threeComponentDecision: "d38b2c727b2c3bb97cdda4e8f519a9bbfbec6af4c26567a7c8332e5a8222763b",
  authoritativeCarrierAdjudication: "db896b4e3deeaa76b1df3177a6b82cb135bd820063831d5db0f4f57e94d59743",
  modelSource: "0be848d30597cac3f6a3b5524f2711400ed2a57fa4e543199421a3115af87bb4",
  uniquePlan: "e26be3a4e0089ff12e75fb88bf56052726c87dd2f8d2ad91d23084d1d7593060",
})

main().catch((error) => {
  recordFailure(error)
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})

async function main() {
  for (const [role, file] of Object.entries(FILES)) {
    assert.equal(fs.existsSync(file), true, `${projectPath(file)} is missing`)
    if (Object.hasOwn(EXPECTED, role)) assert.equal(sha(file), EXPECTED[role], `${role} SHA-256 mismatch`)
  }
  assert.equal(fs.existsSync(OUTPUT), false, "model-family discrimination output reuse is forbidden")

  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, EXPECTED.currentRegistry)
  assert.equal(current.registry.registryRevision, 40)
  assert.equal(current.registry.eventSequence, 40)
  assert.equal(current.registry.taskId, "project_level_model_family_discrimination_required_no_unique_candidate")
  assert.equal(current.registry.activity, "failed_closed")
  assert.equal(current.registry.activeExecution, null)

  const sourceDecision = read(FILES.sourceUniqueDecision)
  const sourceAnalysis = read(FILES.sourceCausalAnalysis)
  const sourceReview = read(FILES.sourceMachineReview)
  assert.equal(sourceDecision.decision, "spatial_affine_execution_and_identity_wiring_valid_but_bounded_multisample_semantic_capacity_insufficient")
  assert.equal(sourceDecision.nextLegalAction, "project_level_model_family_discrimination_required_no_unique_candidate")
  assert.equal(sourceAnalysis.findings.executionWiringDefectConfirmed, false)
  assert.equal(sourceAnalysis.findings.dataOrReviewIdentityDefectConfirmed, false)
  assert.equal(sourceAnalysis.findings.boundedMultisampleSemanticCapacityInsufficientConfirmed, true)
  assert.deepEqual(sourceAnalysis.findings.nonUniqueStructuralAxesStillOpen, [
    "whole_backbone_spatial_affine_modulation",
    "final_output_condition_modulation",
    "per_class_isolated_semantic_representation",
  ])
  assert.equal(sourceReview.previewCount, 5)
  assert.equal(sourceReview.previewPassCount, 0)
  assert.deepEqual(sourceReview.reviews.map((row) => row.issueCodes.length), [8, 7, 6, 7, 6])
  assert.equal(sourceReview.reviews.every((row) => row.fixedPreviewReproducedExactly === true), true)
  assert.equal(sourceReview.reviews.every((row) => [
    "condition_object_footprints_reference_semantic_mismatch",
    "condition_object_tree_reference_semantic_mismatch",
    "condition_object_rock_reference_semantic_mismatch",
    "condition_object_vegetation_reference_semantic_mismatch",
  ].every((code) => row.issueCodes.includes(code))), true)

  const conditionFusion = read(FILES.conditionFusionDecision)
  const postDecodeObject = read(FILES.postDecodeObjectDecision)
  const postDecodeFull = read(FILES.postDecodeFullConditionDecision)
  const directResidual = read(FILES.directResidualTerminal)
  const nativeResidual = read(FILES.nativeResidualRetirement)
  assert.equal(conditionFusion.status, "condition_fusion_multisample_semantic_capacity_insufficient_confirmed")
  assert.equal(conditionFusion.selectedCause, "C")
  assert.equal(postDecodeObject.classification, "post_decode_object_rgb_multisample_semantic_capacity_insufficient_confirmed")
  assert.equal(postDecodeObject.currentCandidateRejected, true)
  assert.equal(postDecodeFull.classification, "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed")
  assert.equal(postDecodeFull.currentCandidateRejected, true)
  assert.equal(directResidual.status, "direct_responsibility_residual_stage0_real_visual_failure")
  assert.equal(nativeResidual.decision, "retire_final_bounded_native_responsibility_residual_candidate")

  const isolatedCpu = read(FILES.isolatedComponentCpuTerminal)
  const isolatedGpu = read(FILES.isolatedComponentGpuTerminal)
  const threeComponentReview = read(FILES.threeComponentReview)
  const threeComponentDecision = read(FILES.threeComponentDecision)
  const authoritativeCarrier = read(FILES.authoritativeCarrierAdjudication)
  assert.equal(isolatedCpu.status, "stage4_three_isolated_responsibility_component_cpu_support_succeeded_inactive")
  assert.equal(isolatedGpu.status, "stage4_three_isolated_responsibility_component_readonly_gpu_qualification_succeeded")
  assert.equal(threeComponentReview.previewCount, 5)
  assert.equal(threeComponentReview.previewPassCount, 0)
  assert.equal(threeComponentDecision.selectedDecision, "three_component_responsibility_or_existing_supervision_semantically_insufficient")
  assert.equal(threeComponentDecision.selectedCause, "A")
  assert.equal(authoritativeCarrier.status, "stage0_real_visual_failure_adjudicated_closed")

  const source = fs.readFileSync(FILES.modelSource, "utf8")
  const sourceAudit = auditModelSource(source)
  const input = {
    axisEvidence: {
      finalOutput: { formallyCovered: true, realVisualFailure: true },
      perClass: { formallyCovered: true, realVisualFailure: true },
      decoderOnlySpatialAffine: { formallyCovered: true, realVisualFailure: true },
      fullBackboneSpatialAffine: { previouslyTested: false },
    },
    modelBoundary: {
      baseChannels: 64,
      widthHierarchy: [64, 128, 256],
      conditionChannels: 23,
      residualBlocks: sourceAudit.blockLayout,
      spatialAffine: {
        conditionChannels: 23,
        kernelSize: 3,
        padding: 1,
        bias: true,
        projectionsPerBlock: 2,
        projectionOutputFormula: "2 * blockChannels",
        affineFormula: "normalized * (1 + gamma) + beta",
      },
    },
    freeParameterAudit: {
      freeParameterChosen: false,
      freeParameterFields: [],
    },
  }
  const contract = deriveFullBackboneSpatialAffineContract(input)
  const decision = adjudicateModelFamilyAxes(input)
  assert.equal(decision, DECISIONS.UNIQUE)
  assert.equal(contract.parameterCount, 745472)
  assert.equal(contract.netNewParameterCount, 585728)

  const checkerExecution = spawnSync(process.execPath, [FILES.checker], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  })
  assert.equal(checkerExecution.status, 0, checkerExecution.stderr || checkerExecution.stdout)
  const checker = JSON.parse(checkerExecution.stdout)
  assert.equal(checker.status, "passed")
  assert.equal(checker.positivePassed, checker.positiveTotal)
  assert.equal(checker.negativePassed, checker.negativeTotal)

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.mkdirSync(OUTPUT, { recursive: false })
  const outputs = {
    problem: path.join(OUTPUT, "problem-report.json"),
    axisAudit: path.join(OUTPUT, "model-family-axis-audit.json"),
    decision: path.join(OUTPUT, "unique-decision.json"),
    contract: path.join(OUTPUT, "inactive-architecture-contract.json"),
    parameterAudit: path.join(OUTPUT, "parameter-derivation-audit.json"),
    cpu: path.join(OUTPUT, "cpu-report.json"),
    planSync: path.join(OUTPUT, "plan-sync-record.json"),
    terminal: path.join(OUTPUT, "phase-terminal.json"),
    capsule: path.join(OUTPUT, "local-task-capsule.json"),
  }
  const recordedAtUtc = new Date().toISOString()

  writeExclusive(outputs.problem, {
    schemaVersion: "stage4-model-family-discrimination-problem-report-v1",
    status: "three_formally_open_axes_require_machine_discrimination",
    sourceCapabilityVersion: SOURCE_CAPABILITY,
    sourceDecision: bind(FILES.sourceUniqueDecision),
    persistentFailureBoundary: sourceAnalysis.findings.persistentFailureBoundary,
    sourcePreviewFailureCounts: [8, 7, 6, 7, 6],
    currentFixedProgress: progress(),
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })

  writeExclusive(outputs.axisAudit, {
    schemaVersion: "stage4-project-level-model-family-axis-audit-v1",
    status: "completed",
    axes: [
      {
        axis: "final_output_condition_modulation",
        disposition: "formally_covered_and_failed_not_a_new_candidate",
        coveredOutputBoundaries: ["predicted_velocity", "clean_latent", "decoded_rgb"],
        evidence: [
          bind(FILES.conditionFusionDecision),
          bind(FILES.postDecodeObjectDecision),
          bind(FILES.postDecodeFullConditionDecision),
          bind(FILES.directResidualTerminal),
          bind(FILES.nativeResidualRetirement),
        ],
      },
      {
        axis: "per_class_isolated_semantic_representation",
        disposition: "formally_implemented_qualified_trained_and_failed_no_unique_successor",
        evidence: [
          bind(FILES.isolatedComponentCpuTerminal),
          bind(FILES.isolatedComponentGpuTerminal),
          bind(FILES.threeComponentReview),
          bind(FILES.threeComponentDecision),
          bind(FILES.authoritativeCarrierAdjudication),
        ],
      },
      {
        axis: "whole_backbone_spatial_affine_modulation",
        disposition: "unique_untried_mechanically_derived_bounded_successor_axis",
        sourceModel: bind(FILES.modelSource),
        blockLayout: sourceAudit.blockLayout,
        stage0SpatialLayout: sourceAudit.stage0SpatialLayout,
        decoderOnlyCurrentCoverage: ["up_block1", "up_block0"],
        newlyCoveredBlocks: ["block0", "block1", "middle1", "middle2"],
      },
    ],
    universeBoundary: "only_the_three_axes_recorded_by_the_bound_source_causal_decision",
    doesNotClaimAllMathematicallyPossibleArchitecturesAreExhausted: true,
    recordedAtUtc,
  })

  writeExclusive(outputs.decision, {
    schemaVersion: "stage4-project-level-model-family-discrimination-decision-v1",
    status: "uniquely_adjudicated",
    selectedDecision: decision,
    selectedCandidateCapabilityVersion: CANDIDATE_CAPABILITY,
    uniqueWithinBoundThreeAxisUniverse: true,
    mathematicalGlobalUniquenessClaimed: false,
    implementationStarted: false,
    gpuStarted: false,
    trainingStarted: false,
    nextLegalAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  })

  writeExclusive(outputs.contract, {
    ...contract,
    schemaVersion: "stage4-full-backbone-spatial-affine-inactive-architecture-contract-v1",
    status: "cpu_design_supported_inactive_not_implemented",
    capabilityVersion: CANDIDATE_CAPABILITY,
    predecessorArchitecture: "stage4_multiscale_spatial_affine_conditioned_decoder_v1",
    architectureDifference: "extend_the_existing_23_channel_spatial_affine_operator_from_decoder_only_to_every_existing_time_residual_block",
    fixedBoundaries: {
      approvedDataCount: 64,
      split: { train: 48, validation: 8, challenge: 4, regression: 4 },
      conditionChannelCount: 23,
      latentChannelCount: 12,
      denoiserBaseChannels: 64,
      frozenAutoencoder: true,
      stage0Resolution: { width: 256, height: 192 },
      existingLossValuesAndWeightsChanged: false,
      checkpointFormatChanged: false,
      machineReviewThresholdsChanged: false,
    },
    forbiddenDesignChanges: [
      "zero_initialize_affine_heads",
      "add_gate_or_scale",
      "add_hidden_layer",
      "change_kernel_or_bias",
      "select_only_a_subset_of_blocks",
      "merge_middle1_and_middle2",
      "change_width_or_layer_count",
      "add_or_change_loss",
    ],
    activationGates: {
      gpuNow: false,
      optimizerNow: false,
      backwardNow: false,
      weightModificationNow: false,
      smokeNow: false,
      trainingNow: false,
      stage0Now: false,
      stage1Now: false,
      stage2Now: false,
      inferenceNow: false,
      runtimeFrameNow: false,
      worldEntryNow: false,
    },
    recordedAtUtc,
  })

  writeExclusive(outputs.parameterAudit, {
    schemaVersion: "stage4-full-backbone-spatial-affine-parameter-derivation-audit-v1",
    status: "passed",
    sourceModel: bind(FILES.modelSource),
    sourceAudit,
    derivedContract: contract,
    noFreeWidth: true,
    noFreeLayerCount: true,
    noFreeKernel: true,
    noFreeGateOrScale: true,
    noFreeLossOrWeight: true,
    recordedAtUtc,
  })

  writeExclusive(outputs.cpu, {
    schemaVersion: "stage4-project-level-model-family-discrimination-cpu-report-v1",
    status: "passed",
    currentRegistryRevisionVerified: 40,
    currentRegistrySha256Verified: EXPECTED.currentRegistry,
    sourceEvidenceHashesVerified: Object.keys(EXPECTED).filter((key) => !["currentRegistry", "uniquePlan"].includes(key)),
    finalOutputAxisFailureBoundaryVerified: true,
    perClassAxisFailureBoundaryVerified: true,
    fullBackboneAxisPreviouslyUntestedVerified: true,
    exactSixBlockLayoutVerified: true,
    exactParameterDerivationVerified: true,
    selectedDecision: decision,
    regression: checker,
    executableIdentity: {
      library: bind(FILES.library),
      checker: bind(FILES.checker),
      runner: bind(FILES.runner),
    },
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })

  const planBeforeSha256 = sha(FILES.uniquePlan)
  assert.equal(planBeforeSha256, EXPECTED.uniquePlan)
  const nextPlan = updateUniquePlan(fs.readFileSync(FILES.uniquePlan, "utf8"), recordedAtUtc)
  const planAfterSha256 = shaText(nextPlan)
  writeExclusive(outputs.planSync, {
    schemaVersion: "stage4-model-family-discrimination-plan-sync-v1",
    status: "prepared_for_atomic_projection_after_registry_commit",
    planPath: projectPath(FILES.uniquePlan),
    beforeSha256: planBeforeSha256,
    afterSha256: planAfterSha256,
    selectedDecision: decision,
    nextLegalAction: NEXT_TASK,
    currentFixedProgress: progress(),
    recordedAtUtc,
  })

  writeExclusive(outputs.terminal, {
    schemaVersion: "stage4-project-level-model-family-discrimination-terminal-v1",
    executionState: "completed",
    status: "stage4_model_family_discrimination_completed_unique_bounded_successor",
    runId: RUN_ID,
    sourceCapabilityVersion: SOURCE_CAPABILITY,
    selectedCandidateCapabilityVersion: CANDIDATE_CAPABILITY,
    selectedDecision: decision,
    problemReport: bind(outputs.problem),
    axisAudit: bind(outputs.axisAudit),
    uniqueDecision: bind(outputs.decision),
    inactiveArchitectureContract: bind(outputs.contract),
    parameterDerivationAudit: bind(outputs.parameterAudit),
    cpuReport: bind(outputs.cpu),
    planSyncRecord: bind(outputs.planSync),
    currentFixedProgress: progress(),
    nextLegalAction: NEXT_TASK,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    stage0Started: false,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  })

  const capsuleEvidence = Object.entries(outputs)
    .filter(([key]) => key !== "capsule")
    .map(([kind, file]) => ({ kind, labelZh: kind, ...bind(file), expectedSha256: sha(file), sha256Verified: true }))
  writeExclusive(outputs.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, labelZh: "Stage 0→Stage 1→Stage 2完整训练", status: "unique_bounded_successor_cpu_implementation_pending" },
    latestBlocker: {
      code: "full_backbone_spatial_affine_cpu_support_not_yet_implemented",
      summaryZh: "三轴判别已排除输出端和逐类别重复路线；全主干空间仿射成为唯一有界后继，但CPU未激活支持尚未实施。",
    },
    nextAllowedAction: {
      code: NEXT_TASK,
      labelZh: "实施全主干空间仿射候选的CPU未激活支持、参数身份审计和正反回归。",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: ["start_gpu_before_cpu_support", "reuse_failed_checkpoint", "add_free_parameters", "lower_review_thresholds", "retry_retired_model_family"],
    taskIdentity: { modelId: CANDIDATE_CAPABILITY, sourceRunId: RUN_ID, seed: 20263722 },
    evidence: capsuleEvidence,
    integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })

  for (const file of Object.values(outputs)) index(file)
  const advanced = await advanceCurrentExecutionRegistry({
    projectRoot: ROOT,
    capabilityVersion: CANDIDATE_CAPABILITY,
    packageId: RUN_ID,
    taskId: NEXT_TASK,
    taskKind: "cpu_inactive_candidate_implementation",
    runId: RUN_ID,
    lifecycleStage: "change_candidate",
    executionState: "completed",
    activity: "cpu_inactive_design_completed",
    taskCapsulePath: projectPath(outputs.capsule),
    terminalEvidencePath: projectPath(outputs.terminal),
    expectedPreviousRegistryRevision: 40,
    expectedPreviousRegistrySha256: EXPECTED.currentRegistry,
  })

  writeAtomic(FILES.uniquePlan, nextPlan)
  assert.equal(sha(FILES.uniquePlan), planAfterSha256)
  appendAiPainterProgramEvent({
    id: `stage4-model-family-discrimination-${RUN_ID}`,
    timestamp: recordedAtUtc,
    action: "stage4_model_family_discrimination_completed",
    runId: RUN_ID,
    kind: "cpu_readonly_project_level_model_family_discrimination",
    status: "success",
    title: "Stage4 model-family discrimination selected one bounded successor axis",
    titleZh: "Stage4模型家族判别已选出唯一有界后继结构轴",
    detailZh: "输出端条件调制和逐类别隔离路线均有正式失败证据；全主干空间仿射是绑定三轴范围内唯一未测试且可机械派生的后继。",
    evidencePath: projectPath(outputs.terminal),
    evidenceSha256: sha(outputs.terminal),
    fixedTotalProgress: progress(),
  })

  process.stdout.write(`${JSON.stringify({
    status: "stage4_model_family_discrimination_completed_unique_bounded_successor",
    runId: RUN_ID,
    selectedDecision: decision,
    selectedCandidateCapabilityVersion: CANDIDATE_CAPABILITY,
    inactiveArchitectureContract: bind(outputs.contract),
    terminal: bind(outputs.terminal),
    currentRegistrySha256: advanced.registrySha256,
    currentFixedProgress: progress(),
    gpuStarted: false,
    trainingStarted: false,
  }, null, 2)}\n`)
}

function auditModelSource(source) {
  const required = [
    "self.block0 = TimeResidualBlock(channels, time_channels)",
    "self.block1 = TimeResidualBlock(channels * 2, time_channels)",
    "self.middle1 = TimeResidualBlock(channels * 4, time_channels)",
    "self.middle2 = TimeResidualBlock(channels * 4, time_channels)",
    "self.up_block1 = TimeResidualBlock(",
    "self.up_block0 = TimeResidualBlock(",
    "return normalized * (1 + gamma) + beta",
  ]
  for (const text of required) assert.match(source, new RegExp(escapeRegExp(text), "u"), `model source boundary missing: ${text}`)
  assert.match(source, /if self\.up_block1\.spatial_affine_norm1 is not None/u)
  assert.match(source, /if self\.up_block0\.spatial_affine_norm1 is not None/u)
  assert.doesNotMatch(source, /if self\.block0\.spatial_affine_norm1 is not None/u)
  assert.doesNotMatch(source, /if self\.block1\.spatial_affine_norm1 is not None/u)
  assert.doesNotMatch(source, /if self\.middle1\.spatial_affine_norm1 is not None/u)
  assert.doesNotMatch(source, /if self\.middle2\.spatial_affine_norm1 is not None/u)
  return {
    status: "verified",
    blockLayout: [
      { id: "block0", role: "encoder_level0", channels: 64 },
      { id: "block1", role: "encoder_level1", channels: 128 },
      { id: "middle1", role: "bottleneck_first", channels: 256 },
      { id: "middle2", role: "bottleneck_second", channels: 256 },
      { id: "up_block1", role: "decoder_level1", channels: 128 },
      { id: "up_block0", role: "decoder_level0", channels: 64 },
    ],
    stage0SpatialLayout: [
      { id: "block0", width: 64, height: 48 },
      { id: "block1", width: 32, height: 24 },
      { id: "middle1", width: 16, height: 12 },
      { id: "middle2", width: 16, height: 12 },
      { id: "up_block1", width: 32, height: 24 },
      { id: "up_block0", width: 64, height: 48 },
    ],
    currentAffineBlocks: ["up_block1", "up_block0"],
    currentAffineProjectionCount: 4,
    currentAffineParameterTensorCount: 8,
    currentAffineParameterCount: 159744,
  }
}

function updateUniquePlan(source, timestamp) {
  let output = source
  output = replaceOnce(output, /^更新时间：.*$/mu, `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`)
  output = replaceOnce(output, /^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4项目级模型家族判别已收敛到全主干空间仿射唯一有界后继，CPU未激活支持待实施")
  output = replaceOnce(output, /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；空间仿射decoder-only全量筛选真实视觉失败并已拒绝；项目级三轴判别已排除输出端重复路线和逐类别/三组件重复路线 | 全主干六个既有残差块的23通道空间仿射是唯一未测试且可无自由参数派生的后继；下一步仅实施CPU未激活支持，不启动GPU或训练 |")
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u, `## 5. 当前阻断与后续实施顺序\n\n本地程序已完成项目级模型家族三轴判别。最终输出条件调制已在predicted velocity、clean latent和decoded RGB三个输出边界形成多份正式失败终态；逐类别隔离语义表示已完成CPU实现、只读GPU资格、三组件训练与机器审核并失败。因此这两个方向不再属于未验证的新候选。\n\n剩余的全主干空间仿射方向严格复用当前已验证算子，把23通道条件从仅up_block1/up_block0扩展到block0、block1、middle1、middle2、up_block1、up_block0六个既有TimeResidualBlock。层数、宽度64/128/256/256/128/64、两处归一化、3×3投影、bias和合并公式均由现有模型唯一派生；总计12个投影、24个参数张量、745472个仿射参数，相对当前decoder-only净增585728个参数。\n\n当前阻断仅是该候选尚未完成CPU未激活实现与正反回归。下一步由本地程序实施模型工厂、未激活配置、Mode Registry和CPU检查器支持；在CPU合同、参数初始化身份和旧模式兼容全部通过前，不得启动GPU、Smoke或Stage 0。\n`)
  return output
}

function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function writeAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file) }
function replaceOnce(source, pattern, replacement) { assert.match(source, pattern); const output = source.replace(pattern, replacement); assert.notEqual(output, source); return output }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/gu, "").slice(0, 14) }
function inside(relative) { assert.equal(path.isAbsolute(relative), false); const candidate = path.resolve(ROOT, relative); assert.ok(candidate.startsWith(`${path.resolve(ROOT)}${path.sep}`)); return candidate }
function index(file) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: RUN_ID, artifactType: "stage4_model_family_discrimination_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }

function recordFailure(error) {
  try {
    fs.mkdirSync(FAILURE_OUTPUT, { recursive: true })
    const failure = path.join(FAILURE_OUTPUT, "failure-report.json")
    if (!fs.existsSync(failure)) {
      writeExclusive(failure, {
        schemaVersion: "stage4-project-level-model-family-discrimination-failure-v1",
        executionState: "completed",
        status: "cpu_readonly_model_family_discrimination_failed_closed",
        runId: RUN_ID,
        error: error instanceof Error ? error.message : String(error),
        checkpointWeightsRead: false,
        gpuStarted: false,
        trainingStarted: false,
        recordedAtUtc: new Date().toISOString(),
      })
    }
  } catch {}
}
