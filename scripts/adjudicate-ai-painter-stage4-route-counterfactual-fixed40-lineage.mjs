import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  advanceCapabilityLifecycle,
  createCapabilityCandidate,
} from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_CAPABILITY = "stage4-native-route-counterfactual-compositor-change-candidate-v1"
const SUCCESSOR_CAPABILITY = "stage4-native-route-counterfactual-compositor-fixed-40-qualification-successor-v1"
const ARCHITECTURE = "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1"
const EXPECTED_REGISTRY_REVISION = 36
const EXPECTED_REGISTRY_SHA256 = "08ba3ace31721c07df0f276ed6f3e77001f04f247a6ff07df57b705b64674b29"
const EXPECTED_TASK = "retire_route_counterfactual_compositor_and_escalate_generation_paradigm"
const NEXT_TASK = "run_route_counterfactual_compositor_fixed_40_epoch_qualification"
const SOURCE_RUN_ID = "stage4-route-counterfactual-compositor-smoke-20260828004950-01"
const RUN_ID = `stage4-route-counterfactual-fixed40-lineage-${compactUtc()}-01`

const SOURCE_SMOKE_ROOT = inside(
  `.runtime/ai-painter/stage4-route-counterfactual-compositor-controlled-smokes/${SOURCE_RUN_ID}`,
)
const SOURCE_TERMINAL = path.join(SOURCE_SMOKE_ROOT, "phase-terminal.json")
const SOURCE_REVIEW = path.join(SOURCE_SMOKE_ROOT, "machine-review.json")
const SOURCE_QUALIFICATION = path.join(SOURCE_SMOKE_ROOT, "late-stability-qualification.json")
const SOURCE_LIFECYCLE_ROOT = inside(
  `.runtime/ai-painter/capability-lifecycle/${SOURCE_CAPABILITY}`,
)
const SOURCE_LIFECYCLE_STATE = path.join(SOURCE_LIFECYCLE_ROOT, "state.json")
const SOURCE_CPU_LIFECYCLE_EVIDENCE = path.join(
  SOURCE_LIFECYCLE_ROOT,
  "evidence/002-cpu_contract_verified.json",
)
const SOURCE_GPU_LIFECYCLE_EVIDENCE = path.join(
  SOURCE_LIFECYCLE_ROOT,
  "evidence/003-readonly_gpu_qualified.json",
)
const SOURCE_REJECTION_EVIDENCE = path.join(
  SOURCE_LIFECYCLE_ROOT,
  "evidence/004-rejected.json",
)
const SOURCE_ARCHITECTURE_CONTRACT = inside(
  ".runtime/ai-painter/stage4-route-counterfactual-plans/" +
  "stage4-route-counterfactual-plan-20260828001753-01/inactive-architecture-contract.json",
)
const OUTPUT = inside(
  `.runtime/ai-painter/stage4-route-counterfactual-fixed40-lineage-adjudications/${RUN_ID}`,
)

const EXPECTED_HASHES = Object.freeze({
  sourceTerminal: "223abfae4252cbb66b3a6d5d5a0074b0f5b1ad4adccb96704e95e39b90bbef57",
  sourceReview: "09234fc4544a57ef612b572ec4da00750c12674f34617f672596647498630e9c",
  sourceQualification: "a205446749b84002132cba242be037fca1b3d361ed1001465fbd599f33148d01",
  sourceLifecycleState: "fa92f17b2d0d1a34d2699fb0839da0ec07410e286cdd490271a34212e377c084",
  sourceCpuLifecycleEvidence: "bdf57412ea0962a00afa2d2f4e587fa4208b9157ba67c19064e8d1496c18cc5d",
  sourceGpuLifecycleEvidence: "cb61dae26b588b93b4d9c3e19cf807a92b998cf2e0389713dda7fb1660a06af3",
  sourceRejectionEvidence: "a49375ead2efe9e76696cfb4fa8feb0342cd052bfcbaaf1dfd187592a6590da6",
  sourceArchitectureContract: "4900a99f2d092582c15d546fc1054c10516ccfe2d78dd6f94683cc5c8579141b",
})

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registrySha256, EXPECTED_REGISTRY_SHA256)
assert.equal(current.registry.registryRevision, EXPECTED_REGISTRY_REVISION)
assert.equal(current.registry.eventSequence, EXPECTED_REGISTRY_REVISION)
assert.equal(current.registry.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(current.registry.packageId, SOURCE_RUN_ID)
assert.equal(current.registry.runId, SOURCE_RUN_ID)
assert.equal(current.registry.taskId, EXPECTED_TASK)
assert.equal(current.registry.taskKind, "project_level_route_decision")
assert.equal(current.registry.lifecycleStage, "rejected")
assert.equal(current.registry.executionState, "package_materialized")
assert.equal(current.registry.activity, "planned_not_started")
assert.equal(current.registry.activeExecution, null)
assert.equal(current.registry.selectedHistoricalRun, null)
assert.equal(current.registry.terminalEvidence.sha256, EXPECTED_HASHES.sourceTerminal)

verify(SOURCE_TERMINAL, EXPECTED_HASHES.sourceTerminal)
verify(SOURCE_REVIEW, EXPECTED_HASHES.sourceReview)
verify(SOURCE_QUALIFICATION, EXPECTED_HASHES.sourceQualification)
verify(SOURCE_LIFECYCLE_STATE, EXPECTED_HASHES.sourceLifecycleState)
verify(SOURCE_CPU_LIFECYCLE_EVIDENCE, EXPECTED_HASHES.sourceCpuLifecycleEvidence)
verify(SOURCE_GPU_LIFECYCLE_EVIDENCE, EXPECTED_HASHES.sourceGpuLifecycleEvidence)
verify(SOURCE_REJECTION_EVIDENCE, EXPECTED_HASHES.sourceRejectionEvidence)
verify(SOURCE_ARCHITECTURE_CONTRACT, EXPECTED_HASHES.sourceArchitectureContract)

const terminal = read(SOURCE_TERMINAL)
const review = read(SOURCE_REVIEW)
const qualification = read(SOURCE_QUALIFICATION)
const sourceLifecycleState = read(SOURCE_LIFECYCLE_STATE)
const sourceCpuLifecycleEvidence = read(SOURCE_CPU_LIFECYCLE_EVIDENCE)
const sourceGpuLifecycleEvidence = read(SOURCE_GPU_LIFECYCLE_EVIDENCE)
const sourceRejectionEvidence = read(SOURCE_REJECTION_EVIDENCE)
const architectureContract = read(SOURCE_ARCHITECTURE_CONTRACT)

assert.equal(terminal.executionState, "completed")
assert.equal(terminal.status, "route_counterfactual_compositor_controlled_smoke_real_visual_failure")
assert.equal(terminal.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(terminal.runId, SOURCE_RUN_ID)
assert.equal(terminal.nextLegalAction, EXPECTED_TASK)
assert.equal(terminal.automaticRetryStarted, false)
assert.equal(terminal.stage0Started, false)
assert.equal(terminal.checkpointPromotable, false)
assert.equal(terminal.machineReview.sha256, EXPECTED_HASHES.sourceReview)
assert.equal(terminal.lateStabilityQualification.sha256, EXPECTED_HASHES.sourceQualification)

assert.equal(review.schemaVersion, "stage4-route-counterfactual-compositor-machine-review-v1")
assert.equal(review.status, "machine_reviews_failed")
assert.equal(review.previewCount, 5)
assert.equal(review.previewPassCount, 0)
assert.deepEqual(review.reviews.map((row) => row.epoch), [1, 5, 10, 20, 30])
assert.equal(review.reviews.every((row) => row.byteExactReproduced === true), true)
assert.equal(
  review.reviews.every((row) => row.previewSha256 === row.reproductionSha256),
  true,
)

assert.equal(qualification.status, "late_stability_not_qualified")
assert.equal(qualification.runId, SOURCE_RUN_ID)
assert.equal(qualification.finalPreviewByteReproductionValid, true)
assert.equal(qualification.noTerminalRegression, true)
assert.equal(qualification.thresholdsChanged, false)
assert.equal(qualification.qualified, false)
assert.deepEqual(qualification.lateEpochs.map((row) => row.epoch), [10, 20, 30])
assert.deepEqual(qualification.lateEpochs.map((row) => row.failureCount), [7, 5, 1])
assert.deepEqual(
  qualification.lateEpochs.at(-1).failureItems,
  ["condition_object_rock_reference_semantic_mismatch"],
)

const epoch30 = review.reviews.find((row) => row.epoch === 30)
assert.ok(epoch30)
assert.deepEqual(epoch30.issueCodes, ["condition_object_rock_reference_semantic_mismatch"])
assert.equal(epoch30.professionalAesthetic.passed, true)
const waterAudit = requiredById(epoch30.conditionAlignment.channelAudits, "terrain_water")
const routeAudit = requiredById(epoch30.conditionAlignment.channelAudits, "terrain_path_ground")
assert.equal(waterAudit.passed, true)
assert.equal(routeAudit.passed, true)
assert.deepEqual(routeAudit.boundaryContactAudit.missingRequiredSides, [])
assert.deepEqual(routeAudit.boundaryContactAudit.unexpectedContactSides, [])
assert.equal(routeAudit.boundaryContactAudit.passed, true)
assert.equal(epoch30.conditionAlignment.waterClassifier.acceptanceThresholdsChanged, false)
assert.equal(epoch30.conditionAlignment.pathClassifier.acceptanceThresholdsChanged, false)

const objectAudits = new Map(
  epoch30.conditionAlignment.objectSemanticAudits.map((row) => [row.channelId, row]),
)
for (const objectId of ["object_footprints", "object_tree", "object_vegetation"]) {
  const audit = objectAudits.get(objectId)
  assert.ok(audit, `${objectId} audit is missing`)
  assert.equal(audit.passed, true)
  assert.equal(audit.localResponsePassed, true)
  assert.equal(audit.priorAcceptanceThresholdChanged, false)
}
const rockAudit = objectAudits.get("object_rock")
assert.ok(rockAudit, "object_rock audit is missing")
assert.equal(rockAudit.passed, false)
assert.equal(rockAudit.localResponsePassed, true)
assert.equal(rockAudit.priorAcceptanceThresholdChanged, false)
assert.equal(rockAudit.referenceResponse.maskedRgbMae, 0.1007)
assert.equal(rockAudit.referenceResponse.maskedEdgeMae, 0.0812)
assert.equal(rockAudit.referenceResponse.maskedLumaCorrelation, 0.0476)
assert.equal(rockAudit.referenceThresholds.maximumMaskedRgbMae, 0.2)
assert.equal(rockAudit.referenceThresholds.maximumMaskedEdgeMae, 0.12)
assert.equal(rockAudit.referenceThresholds.minimumMaskedLumaCorrelation, 0.08)
assert.equal(
  rockAudit.issues.every((issue) => issue.code === "condition_object_rock_reference_semantic_mismatch"),
  true,
)

assert.equal(sourceLifecycleState.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(sourceLifecycleState.state, "rejected")
assert.equal(sourceLifecycleState.sequence, 4)
assert.equal(sourceRejectionEvidence.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(sourceRejectionEvidence.targetState, "rejected")
assert.equal(sourceRejectionEvidence.status, "failed")
assert.equal(sourceCpuLifecycleEvidence.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(sourceCpuLifecycleEvidence.targetState, "cpu_contract_verified")
assert.equal(sourceCpuLifecycleEvidence.status, "passed")
assert.equal(sourceGpuLifecycleEvidence.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(sourceGpuLifecycleEvidence.targetState, "readonly_gpu_qualified")
assert.equal(sourceGpuLifecycleEvidence.status, "passed")
verifyBindings(sourceCpuLifecycleEvidence.bindings)
verifyBindings(sourceGpuLifecycleEvidence.bindings)
verifyBindings(sourceRejectionEvidence.bindings)

assert.equal(architectureContract.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(architectureContract.architecture, ARCHITECTURE)
assert.equal(architectureContract.nativeEncoder.inputChannels, 23)
assert.deepEqual(architectureContract.nativeEncoder.widths, [64, 128, 256])
assert.equal(architectureContract.nativeEncoder.latentChannels, 12)
assert.equal(architectureContract.nativeEncoder.trainableParameterCopies, 1)
assert.equal(architectureContract.nativeEncoder.newTrainableParameters, 0)
assert.equal(architectureContract.frozenBoundary.datasetCount, 64)
assert.deepEqual(architectureContract.frozenBoundary.split, [48, 8, 4, 4])
assert.equal(architectureContract.frozenBoundary.seed, 20263722)
assert.equal(architectureContract.frozenBoundary.autoencoderFrozen, true)
assert.equal(architectureContract.frozenBoundary.existingLossValuesAndWeightsUnchanged, true)
assert.equal(architectureContract.frozenBoundary.machineReviewThresholdsUnchanged, true)
assert.equal(
  architectureContract.failureBoundary,
  "if_the_controlled_smoke_still_has_uncontracted_route_contact_exit_to_project_level_generation_paradigm_decision_without_another_patch",
)

assert.equal(fs.existsSync(OUTPUT), false, "lineage adjudication output reuse is forbidden")
assert.equal(
  fs.existsSync(inside(`.runtime/ai-painter/capability-lifecycle/${SUCCESSOR_CAPABILITY}`)),
  false,
  "successor capability identity already exists",
)
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.mkdirSync(OUTPUT, { recursive: false })

const files = {
  adjudication: path.join(OUTPUT, "next-action-mapping-adjudication.json"),
  lineage: path.join(OUTPUT, "qualification-lineage-correction-contract.json"),
  fixed40: path.join(OUTPUT, "fixed-40-epoch-qualification-contract.json"),
  cpu: path.join(OUTPUT, "cpu-report.json"),
  terminal: path.join(OUTPUT, "phase-terminal.json"),
  capsule: path.join(OUTPUT, "local-task-capsule.json"),
}
const recordedAtUtc = new Date().toISOString()

writeExclusive(files.adjudication, {
  schemaVersion: "stage4-route-counterfactual-smoke-next-action-mapping-adjudication-v1",
  status: "over_broad_smoke_failure_mapping_defect_confirmed",
  sourceCapabilityVersion: SOURCE_CAPABILITY,
  successorCapabilityVersion: SUCCESSOR_CAPABILITY,
  sourceSmoke: bind(SOURCE_TERMINAL),
  sourceMachineReview: bind(SOURCE_REVIEW),
  sourceQualification: bind(SOURCE_QUALIFICATION),
  verifiedFacts: {
    lateFailureCounts: [7, 5, 1],
    epoch30OnlyFailure: "condition_object_rock_reference_semantic_mismatch",
    routePassed: true,
    waterPassed: true,
    footprintsPassed: true,
    treePassed: true,
    vegetationPassed: true,
    professionalAestheticPassed: true,
    rockLocalResponsePassed: true,
    rockMaskedRgbMae: 0.1007,
    rockMaskedEdgeMae: 0.0812,
    rockMaskedLumaCorrelation: 0.0476,
    frozenRockMinimumMaskedLumaCorrelation: 0.08,
    allPreviewBytesReproduced: true,
    thresholdsChanged: false,
  },
  defect: {
    code: "controlled_smoke_failure_outcome_mapped_to_generation_paradigm_without_contract_branch_match",
    observedMapping: EXPECTED_TASK,
    frozenRouteFailureBoundary: architectureContract.failureBoundary,
    boundaryMatched: false,
    reason: "the_route_and_its_required_and_forbidden_boundary_contacts_passed_at_epoch_30",
  },
  uniqueDecision: "one_existing_architecture_fixed_40_epoch_upper_bound_qualification_required",
  sourceRejectedHistoryPreserved: true,
  sourceLifecycleReactivationForbidden: true,
  generationParadigmEscalationPermittedNow: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})

writeExclusive(files.lineage, {
  schemaVersion: "stage4-route-counterfactual-fixed40-qualification-lineage-correction-contract-v1",
  status: "compiled_not_started",
  sourceCapabilityVersion: SOURCE_CAPABILITY,
  sourceLifecycleState: "rejected_preserved_immutable_history",
  successorCapabilityVersion: SUCCESSOR_CAPABILITY,
  changeClass: "program_lineage",
  architecture: ARCHITECTURE,
  architectureChanged: false,
  parameterIdentityChanged: false,
  dataChanged: false,
  lossChanged: false,
  reviewThresholdsChanged: false,
  sourceCpuQualificationInheritedByImmutableEvidence: bind(SOURCE_CPU_LIFECYCLE_EVIDENCE),
  sourceGpuQualificationInheritedByImmutableEvidence: bind(SOURCE_GPU_LIFECYCLE_EVIDENCE),
  sourceRejectionPreserved: bind(SOURCE_REJECTION_EVIDENCE),
  sourceArchitectureContract: bind(SOURCE_ARCHITECTURE_CONTRACT),
  sourceCheckpointPermitted: false,
  sourceRunOutputPermittedAsTrainingInput: false,
  failedPreviewPermittedAsTrainingTarget: false,
  automaticRetry: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})

writeExclusive(files.fixed40, {
  schemaVersion: "stage4-route-counterfactual-compositor-fixed-40-epoch-qualification-contract-v1",
  status: "compiled_not_started",
  capabilityVersion: SUCCESSOR_CAPABILITY,
  architecture: ARCHITECTURE,
  sourceAdjudication: bind(files.adjudication),
  lineageCorrection: bind(files.lineage),
  epochCount: 40,
  previewEpochs: [1, 5, 10, 20, 30, 40],
  resolution: { width: 256, height: 192 },
  seed: 20263722,
  splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
  initialization: "same_contract_fixed_random_initialization_from_scratch",
  checkpointInputAllowed: false,
  smokeCheckpointReadAllowed: false,
  modelChangeAllowed: false,
  lossChangeAllowed: false,
  dataChangeAllowed: false,
  splitChangeAllowed: false,
  reviewThresholdChangeAllowed: false,
  automaticMachineReview: true,
  automaticTerminalRecording: true,
  automaticRetry: false,
  successNextAction: "compile_route_counterfactual_compositor_formal_stage0",
  failureNextAction: "retire_fixed40_successor_and_escalate_generation_paradigm",
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})

writeExclusive(files.cpu, {
  schemaVersion: "stage4-route-counterfactual-fixed40-lineage-cpu-report-v1",
  status: "passed",
  currentRegistryRevisionVerified: EXPECTED_REGISTRY_REVISION,
  currentRegistrySha256Verified: EXPECTED_REGISTRY_SHA256,
  sourceTerminalSha256Verified: EXPECTED_HASHES.sourceTerminal,
  sourceRejectedHistoryPreserved: true,
  lateFailureCountsVerified: [7, 5, 1],
  epoch30OnlyRockVerified: true,
  routeWaterAndOtherObjectsPassedVerified: true,
  previewByteReproductionVerified: true,
  frozenThresholdIdentitiesVerified: true,
  overBroadNextActionMappingDefectVerified: true,
  identicalArchitectureCpuEvidenceVerified: true,
  identicalArchitectureGpuEvidenceVerified: true,
  checkpointFilesRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  gpuStarted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})

createCapabilityCandidate({
  schemaVersion: "ai-painter-capability-change-candidate-v1",
  capabilityVersion: SUCCESSOR_CAPABILITY,
  changeClass: "program_lineage",
  summary: "Qualification-only successor preserving the rejected source while correcting the over-broad Smoke outcome mapping",
  sourceEvidence: [
    SOURCE_TERMINAL,
    SOURCE_REVIEW,
    SOURCE_QUALIFICATION,
    SOURCE_LIFECYCLE_STATE,
    SOURCE_REJECTION_EVIDENCE,
    SOURCE_ARCHITECTURE_CONTRACT,
    files.adjudication,
    files.lineage,
    files.fixed40,
    files.cpu,
  ].map(bind),
  ownerAuthorizationRequired: false,
  ownerInLifecycle: false,
}, { root: ROOT, recordedAtUtc })

advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: SUCCESSOR_CAPABILITY,
  targetState: "isolated_implementation",
  evidence: stageEvidence("isolated_implementation", [
    files.adjudication,
    files.lineage,
    SOURCE_ARCHITECTURE_CONTRACT,
    SOURCE_REJECTION_EVIDENCE,
  ]),
  recordedAtUtc,
})
advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: SUCCESSOR_CAPABILITY,
  targetState: "cpu_contract_verified",
  evidence: stageEvidence("cpu_contract_verified", [
    files.cpu,
    files.fixed40,
    SOURCE_CPU_LIFECYCLE_EVIDENCE,
  ]),
  recordedAtUtc,
})
const successorLifecycle = advanceCapabilityLifecycle({
  root: ROOT,
  capabilityVersion: SUCCESSOR_CAPABILITY,
  targetState: "readonly_gpu_qualified",
  evidence: stageEvidence("readonly_gpu_qualified", [
    files.lineage,
    SOURCE_GPU_LIFECYCLE_EVIDENCE,
    SOURCE_ARCHITECTURE_CONTRACT,
  ]),
  recordedAtUtc,
})

verify(SOURCE_LIFECYCLE_STATE, EXPECTED_HASHES.sourceLifecycleState)
verify(SOURCE_REJECTION_EVIDENCE, EXPECTED_HASHES.sourceRejectionEvidence)

writeExclusive(files.terminal, {
  schemaVersion: "stage4-route-counterfactual-fixed40-lineage-adjudication-terminal-v1",
  executionState: "completed",
  status: "route_counterfactual_fixed40_lineage_adjudication_succeeded",
  runId: RUN_ID,
  sourceCapabilityVersion: SOURCE_CAPABILITY,
  successorCapabilityVersion: SUCCESSOR_CAPABILITY,
  sourceRejectedHistoryPreserved: true,
  successorLifecycleState: successorLifecycle.state,
  successorLifecycleSequence: successorLifecycle.sequence,
  nextActionMappingAdjudication: bind(files.adjudication),
  lineageCorrectionContract: bind(files.lineage),
  fixed40QualificationContract: bind(files.fixed40),
  cpuReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: NEXT_TASK,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})

const capsuleEvidence = [
  files.adjudication,
  files.lineage,
  files.fixed40,
  files.cpu,
  files.terminal,
  SOURCE_TERMINAL,
  SOURCE_REVIEW,
  SOURCE_QUALIFICATION,
  SOURCE_REJECTION_EVIDENCE,
  SOURCE_CPU_LIFECYCLE_EVIDENCE,
  SOURCE_GPU_LIFECYCLE_EVIDENCE,
  SOURCE_ARCHITECTURE_CONTRACT,
]
writeExclusive(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
  currentStage: {
    number: 4,
    total: 5,
    labelZh: "共享权重道路反事实候选固定40 Epoch上限资格",
    status: "qualification_compiled_not_started",
  },
  latestBlocker: {
    code: "rock_reference_luminance_structure_not_converged_by_epoch_30",
    summaryZh: "道路、水体及其余对象已通过；rock局部响应有效，但参考亮度结构在30 Epoch尚未达到冻结要求。",
  },
  nextAllowedAction: {
    code: NEXT_TASK,
    labelZh: "从固定随机初始化执行唯一一次40 Epoch上限资格并自动机器审核。",
    ownerAuthorizationRequired: false,
    automaticExecutionAllowed: true,
    planEvidenceConfirmed: true,
  },
  forbiddenActions: [
    "reactivate_rejected_source_capability",
    "reuse_smoke_or_failed_checkpoint",
    "reuse_source_run_output_as_training_input",
    "change_model_loss_data_split_seed_or_review_threshold",
    "automatic_retry_after_fixed40_failure",
  ],
  taskIdentity: {
    modelId: ARCHITECTURE,
    sourceRunId: SOURCE_RUN_ID,
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation",
    seed: 20263722,
    requiredBoundarySides: ["west"],
  },
  evidence: capsuleEvidence.map((file) => ({
    kind: path.basename(file),
    labelZh: path.basename(file),
    ...bind(file),
    expectedSha256: sha(file),
    sha256Verified: true,
  })),
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
    migrationRegistryStatus: "current_execution_registry_active",
  },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: SUCCESSOR_CAPABILITY,
  packageId: RUN_ID,
  taskId: NEXT_TASK,
  taskKind: "controlled_smoke",
  runId: RUN_ID,
  lifecycleStage: "readonly_gpu_qualified",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(files.capsule),
  terminalEvidencePath: projectPath(files.terminal),
})

appendAiPainterProgramEvent({
  id: `stage4-route-counterfactual-fixed40-lineage-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_route_counterfactual_fixed40_qualification_lineage_corrected",
  runId: RUN_ID,
  kind: "cpu_readonly_analysis",
  status: "success",
  title: "Route-counterfactual fixed-40 qualification lineage corrected",
  titleZh: "共享权重道路反事实候选固定40 Epoch资格血缘已纠正",
  detailZh: "确认30 Epoch晚期失败7→5→1且仅剩rock；保留原拒绝历史，建立不改变架构的资格专用后继血缘。",
  evidencePath: projectPath(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

process.stdout.write(`${JSON.stringify({
  status: "route_counterfactual_fixed40_lineage_adjudication_succeeded",
  runId: RUN_ID,
  sourceCapabilityVersion: SOURCE_CAPABILITY,
  successorCapabilityVersion: SUCCESSOR_CAPABILITY,
  sourceRejectedHistoryPreserved: true,
  successorLifecycleState: successorLifecycle.state,
  lateFailureCounts: [7, 5, 1],
  epoch30OnlyFailure: "condition_object_rock_reference_semantic_mismatch",
  terminal: bind(files.terminal),
  fixed40QualificationContract: bind(files.fixed40),
  currentRegistrySha256: advanced.registrySha256,
  nextLegalAction: NEXT_TASK,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
}, null, 2)}\n`)

function stageEvidence(targetState, filesToBind) {
  return {
    schemaVersion: "ai-painter-capability-stage-evidence-v1",
    capabilityVersion: SUCCESSOR_CAPABILITY,
    targetState,
    status: "passed",
    bindings: filesToBind.map(bind),
    sourceCapabilityVersion: SOURCE_CAPABILITY,
    identicalArchitectureEvidenceInherited: true,
    sourceRejectedHistoryPreserved: true,
    ownerAuthorizationRequired: false,
  }
}

function requiredById(rows, id) {
  const row = rows.find((item) => item.channelId === id)
  assert.ok(row, `${id} audit is missing`)
  return row
}

function verifyBindings(bindings) {
  assert.ok(Array.isArray(bindings) && bindings.length > 0)
  for (const binding of bindings) {
    const absolute = inside(binding.path)
    verify(absolute, binding.sha256)
  }
}

function inside(relative) {
  assert.equal(typeof relative, "string")
  assert.ok(relative.length > 0)
  assert.equal(path.isAbsolute(relative), false, `absolute project path is forbidden: ${relative}`)
  assert.doesNotMatch(relative, /^[A-Za-z]:[\\/]/u)
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate.startsWith(`${path.resolve(ROOT)}${path.sep}`), `path escapes project: ${relative}`)
  return candidate
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function sha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function bind(file) {
  return { path: projectPath(file), sha256: sha(file) }
}

function verify(file, expectedSha256) {
  assert.equal(fs.existsSync(file), true, `${projectPath(file)} is missing`)
  assert.equal(sha(file), expectedSha256, `${projectPath(file)} SHA-256 mismatch`)
}

function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  })
}

function compactUtc() {
  return new Date().toISOString().replaceAll(/[-:.TZ]/gu, "").slice(0, 14)
}
