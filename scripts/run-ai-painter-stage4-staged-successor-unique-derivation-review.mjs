import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  adjudicateStagedSuccessorStructureUniqueDerivationReview,
  deriveStagedSuccessorStructureCandidateAudit,
  STAGED_SUCCESSOR_REVIEW_DECISIONS,
} from "./lib/ai-painter-stage4-staged-successor-unique-derivation-review-v1.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  indexArtifact,
} from "./lib/ai-pet-world-storage-catalog.mjs"
import {
  logicalProjectPath,
} from "./lib/ai-pet-world-storage.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4-native-route-counterfactual-compositor-fixed-40-qualification-successor-v1"
const SOURCE_RUN_ID = "stage4-route-counterfactual-compositor-fixed-40-epoch-20260828013231-01"
const RUN_ID = `stage4-staged-successor-unique-derivation-review-${compactUtc()}-01`
const NEXT_TASK = "stage4_model_construction_paused_no_unique_successor_structure"
const OUTPUT = inside(`.runtime/ai-painter/stage4-staged-successor-unique-derivation-reviews/${RUN_ID}`)
const FAILURE_OUTPUT = inside(`.runtime/ai-painter/stage4-staged-successor-unique-derivation-review-failures/${RUN_ID}`)
let fatalFailureRecorded = false
process.on("uncaughtExceptionMonitor", (error) => recordFatalFailure(error))
process.on("unhandledRejection", (error) => {
  recordFatalFailure(error)
  process.exitCode = 1
})

const FIXED40_ROOT = inside(
  `.runtime/ai-painter/stage4-route-counterfactual-compositor-fixed-40-epoch-qualifications/${SOURCE_RUN_ID}`,
)
const FILES = Object.freeze({
  currentRegistry: inside(".runtime/ai-painter/current-execution-registry/current.json"),
  fixed40Terminal: path.join(FIXED40_ROOT, "phase-terminal.json"),
  fixed40Manifest: path.join(FIXED40_ROOT, "manifest.json"),
  fixed40Review: path.join(FIXED40_ROOT, "machine-review.json"),
  fixed40Qualification: path.join(FIXED40_ROOT, "late-stability-qualification.json"),
  fixed40Lifecycle: inside(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/state.json`),
  fixed40Rejection: inside(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/evidence/004-rejected.json`),
  stagedInterface: inside(".runtime/ai-painter/stage4-staged-interface-evidence-support/20260823-143907117/phase-interface-contract.json"),
  retiredThreeComponentTerminal: inside(".runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudications-v2/local-ai-20260824-134500-three-component-causal/phase-terminal.json"),
  retiredThreeComponentDecision: inside(".runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudications-v2/local-ai-20260824-134500-three-component-causal/adjudication.json"),
  retiredComponentFamilyDecision: inside(".runtime/ai-painter/stage4-bounded-trainable-component-family-designs/20260823-151438887/adjudication.json"),
  retiredComponentFamilyContract: inside(".runtime/ai-painter/stage4-bounded-trainable-component-family-designs/20260823-151438887/inactive-component-family-contract.json"),
  parameterSourceAudit: inside(".runtime/ai-painter/stage4-bounded-trainable-component-family-designs/20260823-151438887/parameter-source-audit.json"),
  architecture: inside("docs/ARCHITECTURE.md"),
  formalSpec: inside("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md"),
  uniquePlan: inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
  reviewLibrary: inside("scripts/lib/ai-painter-stage4-staged-successor-unique-derivation-review-v1.mjs"),
  reviewChecker: inside("scripts/check-ai-painter-stage4-staged-successor-unique-derivation-review.mjs"),
  reviewRunner: inside("scripts/run-ai-painter-stage4-staged-successor-unique-derivation-review.mjs"),
})

const EXPECTED = Object.freeze({
  currentRegistry: "9b0de3ee2f3b8fc722636252da56561240dc4dc9eb4d0c26c69e533e23a95f74",
  fixed40Terminal: "8db2d1ff2abf81308ac9d8f8d032350f84be59423fd17e4f54442e45d69a09ea",
  fixed40Manifest: "bbc0a50e9d46a6e3db6c91d45ebf8f1b9389dfe93638c592a50d9ebd31f8a8dc",
  fixed40Review: "8c11d206c07bc1bb73f46ed35aa8b54c98f05054a36f85779e168d6617619bb4",
  fixed40Qualification: "8084d6e6206b1b7d38c33e52f2367584bbda2c82834a94dc9a463da49dc5a24b",
  fixed40Lifecycle: "c87cab78df310b7ff9544dfb6fd5486b14a259a153e706e18910ab3f69cbdb9e",
  fixed40Rejection: "d0ad6dacdba1f8b940154a0998f9262215208ef494581d8a478b3fc09c7696ea",
  stagedInterface: "d6f198eb9f29676d485789d232751ca275eb1ba699c69fc0e0d00775268ef677",
  retiredThreeComponentTerminal: "5dd077541b8a3958bf90907b7c645d1139b81715434f5fec5c7263ac837a5450",
  retiredThreeComponentDecision: "d38b2c727b2c3bb97cdda4e8f519a9bbfbec6af4c26567a7c8332e5a8222763b",
  retiredComponentFamilyDecision: "7068fe3f4106eefc660949320f53d01612bd5261735783d08932ffff4315dc13",
  retiredComponentFamilyContract: "1fa3392cc0dc39ad628ea3d50391b25858b089d0e63a55c9dbb931587a7fdc5b",
  parameterSourceAudit: "94402b91eaff7d9b1815213735a28f14895549abb0a0e6d503fa6d534174e5bc",
  architecture: "3b0a07246435522183bb0534f95a569347994fe0b6cc810fac11deaea358134d",
  formalSpec: "d62f985f61642a18d3ccae984379431dda7a29cad2622f87978deff483ae73a7",
  uniquePlan: "37d7718fd8191ca63582782f982631442c90a3afca4248bee10fa319cbbeac08",
})

for (const [role, file] of Object.entries(FILES)) {
  if (Object.hasOwn(EXPECTED, role)) verify(file, EXPECTED[role])
  else assert.equal(fs.existsSync(file), true, `${projectPath(file)} is missing`)
}
assert.equal(fs.existsSync(OUTPUT), false, "review output reuse is forbidden")

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registrySha256, EXPECTED.currentRegistry)
assert.equal(current.registry.registryRevision, 38)
assert.equal(current.registry.eventSequence, 38)
assert.equal(current.registry.capabilityVersion, CAPABILITY)
assert.equal(current.registry.runId, SOURCE_RUN_ID)
assert.equal(current.registry.taskId, "retire_fixed40_successor_and_escalate_generation_paradigm")
assert.equal(current.registry.lifecycleStage, "rejected")
assert.equal(current.registry.activeExecution, null)
assert.equal(current.registry.latestTrainingTerminal.sha256, EXPECTED.fixed40Terminal)

const fixed40Terminal = read(FILES.fixed40Terminal)
const fixed40Manifest = read(FILES.fixed40Manifest)
const fixed40Review = read(FILES.fixed40Review)
const fixed40Qualification = read(FILES.fixed40Qualification)
const fixed40Lifecycle = read(FILES.fixed40Lifecycle)
const fixed40Rejection = read(FILES.fixed40Rejection)
const stagedInterface = read(FILES.stagedInterface)
const retiredThreeComponentTerminal = read(FILES.retiredThreeComponentTerminal)
const retiredThreeComponentDecision = read(FILES.retiredThreeComponentDecision)
const retiredComponentFamilyDecision = read(FILES.retiredComponentFamilyDecision)
const retiredComponentFamilyContract = read(FILES.retiredComponentFamilyContract)
const parameterSourceAudit = read(FILES.parameterSourceAudit)

assert.equal(fixed40Terminal.status, "route_counterfactual_compositor_fixed_40_epoch_qualification_real_visual_failure")
assert.equal(fixed40Terminal.runId, SOURCE_RUN_ID)
assert.equal(fixed40Terminal.nextLegalAction, "retire_fixed40_successor_and_escalate_generation_paradigm")
assert.equal(fixed40Terminal.checkpointPromotable, false)
assert.equal(fixed40Terminal.automaticRetryStarted, false)
assert.equal(fixed40Terminal.stage0Started, false)
assert.equal(fixed40Manifest.modelWeightsModified, true)
assert.equal(fixed40Manifest.checkpointPromotable, false)
assert.equal(fixed40Review.previewCount, 6)
assert.equal(fixed40Review.previewPassCount, 0)
assert.equal(fixed40Review.previewFailCount, 6)
assert.deepEqual(fixed40Review.reviews.map(({ epoch }) => epoch), [1, 5, 10, 20, 30, 40])
assert.equal(fixed40Review.reviews.every((row) => row.byteExactReproduced === true), true)
assert.deepEqual(fixed40Qualification.lateEpochs.map(({ epoch }) => epoch), [10, 20, 30, 40])
assert.deepEqual(fixed40Qualification.lateEpochs.map(({ failureCount }) => failureCount), [7, 5, 1, 2])
assert.deepEqual(fixed40Qualification.lateEpochs.at(-1).failureItems, [
  "condition_terrain_path_ground_required_boundary_contact_missing",
  "condition_object_rock_reference_semantic_mismatch",
])
assert.equal(fixed40Qualification.noTerminalRegression, false)
assert.equal(fixed40Qualification.finalPreviewByteReproductionValid, true)
assert.equal(fixed40Qualification.qualified, false)
assert.equal(fixed40Qualification.thresholdsChanged, false)
assert.equal(fixed40Lifecycle.state, "rejected")
assert.equal(fixed40Rejection.targetState, "rejected")

assert.equal(retiredThreeComponentTerminal.executionState, "completed")
assert.equal(retiredThreeComponentTerminal.status, "three_component_smoke_failure_boundary_adjudicated")
assert.equal(retiredThreeComponentTerminal.selectedCause, "A")
assert.equal(retiredThreeComponentDecision.selectedDecision, "three_component_responsibility_or_existing_supervision_semantically_insufficient")
assert.equal(retiredComponentFamilyDecision.selectedDecision, "three_responsibility_isolated_trainable_components_required")
assert.match(retiredComponentFamilyDecision.alternativesRejected.bounded_shared_substrate_with_phase_isolated_outputs_supported, /gradient-interference/u)
assert.equal(retiredComponentFamilyContract.designBoundary.sharedTrainableSubstrateAllowed, false)
assert.equal(retiredComponentFamilyContract.sharedImmutableBoundaries.approvedDataCount, 64)
assert.deepEqual(retiredComponentFamilyContract.sharedImmutableBoundaries.split, { train: 48, validation: 8, challenge: 4, regression: 4 })
assert.equal(retiredComponentFamilyContract.sharedImmutableBoundaries.conditionChannelCount, 23)
assert.equal(retiredComponentFamilyContract.sharedImmutableBoundaries.autoencoderFrozen, true)
assert.equal(retiredComponentFamilyContract.sharedImmutableBoundaries.reviewThresholdsChanged, false)
assert.equal(parameterSourceAudit.freeModelNameChosen, false)
assert.equal(parameterSourceAudit.freeWidthChosen, false)
assert.equal(parameterSourceAudit.freeLayerCountChosen, false)
assert.equal(parameterSourceAudit.freeLossChosen, false)
assert.equal(parameterSourceAudit.freeLossWeightChosen, false)
assert.equal(parameterSourceAudit.freeHyperparameterChosen, false)

const architectureText = fs.readFileSync(FILES.architecture, "utf8")
const formalSpecText = fs.readFileSync(FILES.formalSpec, "utf8")
for (const phase of stagedInterface.taxonomy.generationResponsibilityPhases) {
  assert.match(architectureText, new RegExp(escapeRegExp(phase), "u"))
  assert.match(formalSpecText, new RegExp(escapeRegExp(phase), "u"))
}
assert.match(formalSpecText, /AP-PHASE-001/u)
assert.match(formalSpecText, /AP-PHASE-004/u)

const reviewInput = {
  fixed40Evidence: {
    terminalStatus: fixed40Terminal.status,
    epochs: fixed40Qualification.lateEpochs.map(({ epoch }) => epoch),
    failureCounts: fixed40Qualification.lateEpochs.map(({ failureCount }) => failureCount),
    noTerminalRegression: fixed40Qualification.noTerminalRegression,
    epoch40IssueCodes: fixed40Qualification.lateEpochs.at(-1).failureItems,
    lifecycleState: fixed40Lifecycle.state,
  },
  retiredThreeComponentEvidence: {
    selectedCause: retiredThreeComponentTerminal.selectedCause,
    selectedDecision: retiredThreeComponentDecision.selectedDecision,
    candidateRouteExited: true,
    lifecycleState: "rejected",
  },
  formalStagedInterface: stagedInterface,
  currentRegistryEvidence: current.registry,
  componentFamilyDecision: retiredComponentFamilyDecision,
  componentFamilyContract: retiredComponentFamilyContract,
  parameterSourceAudit,
}
const candidateAudit = deriveStagedSuccessorStructureCandidateAudit(reviewInput)
const decision = adjudicateStagedSuccessorStructureUniqueDerivationReview(reviewInput)
assert.equal(decision, STAGED_SUCCESSOR_REVIEW_DECISIONS.PAUSE)

const checkerExecution = spawnSync(process.execPath, [FILES.reviewChecker], {
  cwd: ROOT,
  encoding: "utf8",
  windowsHide: true,
})
assert.equal(checkerExecution.status, 0, checkerExecution.stderr || checkerExecution.stdout)
const checkerReport = JSON.parse(checkerExecution.stdout)
assert.equal(checkerReport.status, "passed")
assert.equal(checkerReport.currentEvidenceDecision, decision)
assert.equal(checkerReport.positivePassed, checkerReport.positiveTotal)
assert.equal(checkerReport.negativePassed, checkerReport.negativeTotal)

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.mkdirSync(OUTPUT, { recursive: false })
const outputs = {
  problem: path.join(OUTPUT, "problem-report.json"),
  audit: path.join(OUTPUT, "evidence-and-structure-boundary-audit.json"),
  exit: path.join(OUTPUT, "one-shot-route-exit-record.json"),
  review: path.join(OUTPUT, "successor-structure-unique-derivation-review.json"),
  axisMatrix: path.join(OUTPUT, "axis-derivation-matrix.json"),
  retiredSignatures: path.join(OUTPUT, "retired-signature-index.json"),
  candidateEnumeration: path.join(OUTPUT, "candidate-enumeration.json"),
  adjudication: path.join(OUTPUT, "adjudication.json"),
  boundary: path.join(OUTPUT, "project-pause-boundary-report.json"),
  cpu: path.join(OUTPUT, "cpu-report.json"),
  planSync: path.join(OUTPUT, "plan-sync-record.json"),
  terminal: path.join(OUTPUT, "phase-terminal.json"),
  capsule: path.join(OUTPUT, "local-task-capsule.json"),
}
const recordedAtUtc = new Date().toISOString()

writeExclusive(outputs.problem, {
  schemaVersion: "stage4-fixed40-failure-project-level-problem-report-v1",
  status: "one_shot_complete_map_generation_route_exhausted",
  sourceRunId: SOURCE_RUN_ID,
  fixed40FailureCounts: [7, 5, 1, 2],
  epoch30FailureItems: fixed40Qualification.lateEpochs.find(({ epoch }) => epoch === 30).failureItems,
  epoch40FailureItems: fixed40Qualification.lateEpochs.find(({ epoch }) => epoch === 40).failureItems,
  terminalRegressionConfirmed: true,
  lossAndCheckpointImprovementDidNotProduceVisualQualification: true,
  automaticRetryAllowed: false,
  stage0Allowed: false,
  fixedTotalProgress: progress(),
  recordedAtUtc,
})

writeExclusive(outputs.audit, {
  schemaVersion: "stage4-staged-successor-derivation-evidence-audit-v1",
  status: "passed",
  currentFixed40Evidence: [FILES.fixed40Terminal, FILES.fixed40Manifest, FILES.fixed40Review, FILES.fixed40Qualification, FILES.fixed40Lifecycle, FILES.fixed40Rejection].map(bind),
  retiredStagedImplementationEvidence: [FILES.retiredThreeComponentTerminal, FILES.retiredThreeComponentDecision, FILES.retiredComponentFamilyDecision, FILES.retiredComponentFamilyContract, FILES.parameterSourceAudit].map(bind),
  formalContractEvidence: [FILES.stagedInterface, FILES.architecture, FILES.formalSpec].map(bind),
  fixedBusinessBoundary: {
    approvedDataCount: 64,
    split: { train: 48, validation: 8, challenge: 4, regression: 4 },
    conditionChannels: 23,
    autoencoderFrozen: true,
    lossValuesAndWeightsChanged: false,
    reviewThresholdsChanged: false,
  },
  checkpointFilesRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
})

writeExclusive(outputs.exit, {
  schemaVersion: "stage4-route-counterfactual-fixed40-route-exit-record-v1",
  status: "route_counterfactual_compositor_fixed40_successor_formally_retired",
  capabilityVersion: CAPABILITY,
  lifecycleState: fixed40Lifecycle.state,
  immutableRejectionEvidence: bind(FILES.fixed40Rejection),
  failureTerminal: bind(FILES.fixed40Terminal),
  checkpointPromotable: false,
  checkpointReuseAllowed: false,
  automaticRetryAllowed: false,
  stage0Allowed: false,
  recordedAtUtc,
})

writeExclusive(outputs.review, {
  schemaVersion: "stage4-staged-generation-responsibility-successor-structure-unique-derivation-review-v1",
  status: "completed",
  selectedDecision: decision,
  retainedFormalResponsibilityPhases: stagedInterface.taxonomy.generationResponsibilityPhases,
  verifiedRetiredOrForbiddenRoutes: [
    "three_responsibility_isolated_trainable_components_required",
    "bounded_shared_substrate_with_phase_isolated_outputs_supported",
    "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1",
  ],
  remainingUniquelyDerivedCandidateCount:
    candidateAudit.candidateEnumeration.viableCandidateCount,
  unresolvedStructuralAxes: candidateAudit.candidateEnumeration.unresolvedAxes,
  reason: "formal_responsibility_interfaces_are_fixed_but_no_single_untried_trainable_structure_and_parameter_boundary_is_uniquely_implied_by_the_bound_evidence",
  renamedRetiredRouteAllowed: false,
  freeArchitectureChoiceAllowed: false,
  implementationAllowed: false,
  gpuAllowed: false,
  trainingAllowed: false,
  recordedAtUtc,
})

writeExclusive(outputs.axisMatrix, {
  schemaVersion: "stage4-staged-successor-axis-derivation-matrix-v1",
  status: "verified",
  rows: candidateAudit.axisDerivationMatrix,
  sourceBindings: [
    bind(FILES.stagedInterface),
    bind(FILES.retiredComponentFamilyDecision),
    bind(FILES.retiredComponentFamilyContract),
    bind(FILES.parameterSourceAudit),
  ],
  recordedAtUtc,
})

writeExclusive(outputs.retiredSignatures, {
  schemaVersion: "stage4-staged-successor-retired-signature-index-v1",
  status: "verified",
  signatures: candidateAudit.retiredSignatureIndex,
  recordedAtUtc,
})

writeExclusive(outputs.candidateEnumeration, {
  schemaVersion: "stage4-staged-successor-candidate-enumeration-v1",
  status: "verified",
  ...candidateAudit.candidateEnumeration,
  decision,
  callerSuppliedCandidateListUsed: false,
  recordedAtUtc,
})

writeExclusive(outputs.adjudication, {
  schemaVersion: "stage4-staged-successor-unique-derivation-adjudication-v1",
  status: "uniquely_adjudicated",
  selectedDecision: decision,
  oneShotRouteExhausted: true,
  retiredThreeComponentRouteCannotBeRenamedOrReused: true,
  uniqueUntriedStagedImplementationProven: false,
  nextLegalAction: NEXT_TASK,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  recordedAtUtc,
})

writeExclusive(outputs.boundary, {
  schemaVersion: "stage4-no-unique-successor-project-pause-boundary-report-v1",
  status: "stage4_model_construction_paused",
  boundaryCode: "no_unique_untried_successor_structure_derivable_from_current_contracts_and_evidence",
  unchanged: ["business_goal", "approved_64_dataset", "48_8_4_4_split", "23_channel_contract", "frozen_autoencoder", "existing_loss", "machine_review_thresholds", "stage_resolution_contract"],
  forbiddenWhilePaused: ["rename_and_retry_retired_route", "reuse_failed_checkpoint", "free_architecture_parameter_selection", "automatic_smoke_retry", "start_stage0", "start_stage1", "start_stage2"],
  evidenceRequiredToResume: "new_independent_machine_verifiable_evidence_that_reduces_the_remaining_structural_candidate_set_to_exactly_one_without_free_parameters",
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  recordedAtUtc,
})

writeExclusive(outputs.cpu, {
  schemaVersion: "stage4-staged-successor-unique-derivation-cpu-report-v1",
  status: "passed",
  currentRegistryRevisionVerified: 38,
  currentRegistrySha256Verified: EXPECTED.currentRegistry,
  fixed40LateFailureCountsVerified: [7, 5, 1, 2],
  fixed40TerminalRegressionVerified: true,
  fixed40PreviewByteReproductionVerified: true,
  retiredThreeComponentRouteVerified: true,
  sharedSubstrateAlternativePreviouslyRejectedVerified: true,
  formalFourStageInterfaceVerified: true,
  successorCandidateCount: candidateAudit.candidateEnumeration.viableCandidateCount,
  selectedDecision: decision,
  executableIdentity: {
    library: bind(FILES.reviewLibrary),
    checker: bind(FILES.reviewChecker),
    runner: bind(FILES.reviewRunner),
  },
  regression: checkerReport,
  checkpointFilesRead: false,
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
  schemaVersion: "stage4-staged-successor-project-pause-plan-sync-v1",
  status: "synchronized",
  planPath: projectPath(FILES.uniquePlan),
  beforeSha256: planBeforeSha256,
  afterSha256: planAfterSha256,
  commitState: "prepared_for_atomic_projection_after_registry_commit",
  selectedDecision: decision,
  fixedTotalProgress: progress(),
  recordedAtUtc,
})

writeExclusive(outputs.terminal, {
  schemaVersion: "stage4-staged-successor-unique-derivation-review-terminal-v1",
  executionState: "completed",
  status: "stage4_model_construction_paused_no_unique_successor_structure",
  runId: RUN_ID,
  sourceCapabilityVersion: CAPABILITY,
  sourceTrainingRunId: SOURCE_RUN_ID,
  selectedDecision: decision,
  problemReport: bind(outputs.problem),
  evidenceAudit: bind(outputs.audit),
  routeExitRecord: bind(outputs.exit),
  derivationReview: bind(outputs.review),
  axisDerivationMatrix: bind(outputs.axisMatrix),
  retiredSignatureIndex: bind(outputs.retiredSignatures),
  candidateEnumeration: bind(outputs.candidateEnumeration),
  adjudication: bind(outputs.adjudication),
  projectPauseBoundaryReport: bind(outputs.boundary),
  cpuReport: bind(outputs.cpu),
  planSyncRecord: bind(outputs.planSync),
  fixedTotalProgress: progress(),
  nextLegalAction: NEXT_TASK,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  stage0Started: false,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  recordedAtUtc,
})

const capsuleEvidence = Object.values(outputs).filter((file) => file !== outputs.capsule).map((file) => ({
  kind: path.basename(file),
  labelZh: path.basename(file),
  ...bind(file),
  expectedSha256: sha(file),
  sha256Verified: true,
}))
writeExclusive(outputs.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage 0→Stage 1→Stage 2完整训练", status: "model_construction_paused_no_unique_successor" },
  candidateTerminal: {
    runId: SOURCE_RUN_ID,
    status: "failed_closed",
    programStatus: fixed40Terminal.status,
    previewMachineStatus: fixed40Review.status,
    modelQualificationStatus: fixed40Qualification.status,
    previewCount: fixed40Review.previewCount,
    previewPassCount: fixed40Review.previewPassCount,
    previewFailCount: fixed40Review.previewFailCount,
    checkpointWritten: fixed40Terminal.checkpointWritten,
    checkpointPromotable: false,
    modelWeightsModified: fixed40Terminal.modelWeightsModified,
    recordedAtUtc: fixed40Terminal.recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(fixed40Terminal.recordedAtUtc),
  },
  latestBlocker: { code: "no_unique_untried_successor_structure_derivable", summaryZh: "一次性完整地图路线与既有三组件实现均已被正式证伪；现有证据不能唯一派生新的训练结构，Stage4模型建设已安全暂停。" },
  nextAllowedAction: { code: NEXT_TASK, labelZh: "保持失败关闭；只有新的独立机器证据将候选结构收敛为唯一时才能恢复CPU实现。", ownerAuthorizationRequired: false, automaticExecutionAllowed: false, planEvidenceConfirmed: true },
  forbiddenActions: ["retry_fixed40_route", "rename_retired_three_component_route", "reuse_failed_checkpoint", "free_parameter_selection", "start_gpu_smoke_or_stage_training"],
  taskIdentity: { modelId: null, sourceRunId: SOURCE_RUN_ID, sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6", sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"] },
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
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: NEXT_TASK,
  taskKind: "project_level_route_decision",
  runId: RUN_ID,
  lifecycleStage: "rejected",
  executionState: "completed",
  activity: "failed_closed",
  taskCapsulePath: projectPath(outputs.capsule),
  terminalEvidencePath: projectPath(outputs.terminal),
  expectedPreviousRegistryRevision: 38,
  expectedPreviousRegistrySha256: EXPECTED.currentRegistry,
})

writeAtomic(FILES.uniquePlan, nextPlan)
assert.equal(sha(FILES.uniquePlan), planAfterSha256)

appendAiPainterProgramEvent({
  id: `stage4-staged-successor-unique-derivation-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_staged_successor_unique_derivation_review",
  runId: RUN_ID,
  kind: "cpu_readonly_project_level_route_adjudication",
  status: "success",
  title: "Stage4 model construction paused without a uniquely derivable successor",
  titleZh: "Stage4因无唯一可派生后继结构已安全暂停",
  detailZh: "固定40资格出现7→5→1→2终态回退；旧三组件与共享底座路径也已被证伪，未启动GPU或训练。",
  evidencePath: projectPath(outputs.terminal),
  evidenceSha256: sha(outputs.terminal),
  fixedTotalProgress: progress(),
})

process.stdout.write(`${JSON.stringify({
  status: "stage4_model_construction_paused_no_unique_successor_structure",
  runId: RUN_ID,
  selectedDecision: decision,
  terminal: bind(outputs.terminal),
  projectPauseBoundaryReport: bind(outputs.boundary),
  currentRegistrySha256: advanced.registrySha256,
  fixedTotalProgress: progress(),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
}, null, 2)}\n`)

function updateUniquePlan(source, timestamp) {
  let output = source
  output = replaceOnce(output, /^更新时间：.*$/mu, `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`)
  output = replaceOnce(output, /^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4固定40 Epoch上限资格真实视觉失败，现有证据无法唯一派生未失败后继结构，模型建设已安全暂停")
  output = replaceOnce(output, /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；共享权重道路反事实候选完成固定40 Epoch资格，失败数7→5→1→2，Epoch 40道路west边界回退且rock语义仍失败；候选已拒绝，Stage 0未启动 | 既有一次性路线和三组件实现均已证伪，且无唯一可派生后继结构；保持失败关闭，禁止重跑、换名复用和自由参数试验 |")
  output = replaceOnce(output, /## 4\. 最近一次模块终态[\s\S]*?(?=\n## 5\.)/u, `## 4. 最近一次模块终态\n\n共享权重道路反事实候选在不读取任何历史或失败Checkpoint的前提下，从固定随机初始化完成40 Epoch上限资格、六个固定预览、字节复现及自动机器审核。Epoch 10/20/30/40失败数为\`7→5→1→2\`：Epoch 30仅剩rock参考语义失败；Epoch 40道路required-west边界失败重新出现，rock继续失败。六张预览均字节级复现一致，审核阈值未变化。\n\n训练Loss和Checkpoint选择分数持续改善，但冻结视觉资格发生终态回退，\`noTerminalRegression=false\`。该结果证明当前候选达到正式40 Epoch上限仍不稳定；其生命周期已保持\`rejected\`，不可重跑、复用Checkpoint或进入Stage 0。\n`)
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u, `## 5. 当前阻断与后续实施顺序\n\n本地程序已完成CPU只读分阶段后继结构唯一派生审查。长期四阶段责任接口继续有效，但历史三个隔离训练组件已被正式裁决为语义不足；共享训练底座也曾因多样本梯度干扰被排除。当前失败证据只证明道路边界与rock语义仍存在终态不稳定，不能把剩余的参数归属、语义载体形式和最终RGB保持机制唯一收敛为一个未失败的新训练结构。\n\n因此Stage4模型建设已安全暂停，当前不存在可合法启动的GPU、Smoke或Stage 0任务，也不存在可给出的完成时间。恢复条件是获得新的独立机器证据，使未失败后继结构、全部尺寸和参数边界唯一确定；不得通过换名重跑旧三组件、自由选择架构参数、修改审核阈值或复用失败Checkpoint恢复。\n`)
  return output
}

function replaceOnce(source, pattern, replacement) {
  assert.match(source, pattern, `unique plan pattern missing: ${pattern}`)
  const output = source.replace(pattern, replacement)
  assert.notEqual(output, source, `unique plan replacement did not change content: ${pattern}`)
  return output
}
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function verify(file, expectedSha256) { assert.equal(fs.existsSync(file), true, `${projectPath(file)} is missing`); assert.equal(sha(file), expectedSha256, `${projectPath(file)} SHA-256 mismatch`) }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function writeAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file) }
function inside(relative) { assert.equal(typeof relative, "string"); assert.ok(relative.length > 0); assert.equal(path.isAbsolute(relative), false, `absolute project path is forbidden: ${relative}`); assert.doesNotMatch(relative, /^[A-Za-z]:[\\/]/u); const candidate = path.resolve(ROOT, relative); assert.ok(candidate.startsWith(`${path.resolve(ROOT)}${path.sep}`), `path escapes project: ${relative}`); return candidate }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/gu, "").slice(0, 14) }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") }
function index(file) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: RUN_ID, artifactType: "stage4_staged_successor_unique_derivation_review_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
function recordFatalFailure(error) {
  if (fatalFailureRecorded) return
  fatalFailureRecorded = true
  try {
    fs.mkdirSync(FAILURE_OUTPUT, { recursive: true })
    const failurePath = path.join(FAILURE_OUTPUT, "failure-report.json")
    if (!fs.existsSync(failurePath)) {
      const currentRegistryBytes = fs.existsSync(FILES.currentRegistry)
        ? fs.readFileSync(FILES.currentRegistry)
        : null
      fs.writeFileSync(failurePath, `${JSON.stringify({
        schemaVersion: "stage4-staged-successor-unique-derivation-review-failure-v1",
        executionState: "failed_closed",
        status: "cpu_readonly_review_execution_failure",
        runId: RUN_ID,
        error: error instanceof Error ? error.message : String(error),
        currentRegistrySha256AtFailure: currentRegistryBytes === null
          ? null
          : crypto.createHash("sha256").update(currentRegistryBytes).digest("hex"),
        checkpointWeightsRead: false,
        gpuStarted: false,
        trainingStarted: false,
        recordedAtUtc: new Date().toISOString(),
      }, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
      try {
        appendAiPainterProgramEvent({
          id: `stage4-staged-successor-review-failure-${RUN_ID}`,
          action: "stage4_staged_successor_unique_derivation_review",
          runId: RUN_ID,
          kind: "cpu_readonly_project_level_route_adjudication",
          status: "error",
          title: "Stage4 staged successor review failed closed",
          titleZh: "Stage4分阶段后继结构审查失败关闭",
          detailZh: error instanceof Error ? error.message : String(error),
          evidencePath: projectPath(failurePath),
          evidenceSha256: sha(failurePath),
          fixedTotalProgress: progress(),
        })
      } catch {}
    }
  } catch {}
}
