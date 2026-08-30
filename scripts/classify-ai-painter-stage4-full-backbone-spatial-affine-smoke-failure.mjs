import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  AXIS_DISPOSITION,
  CAPABILITY_VERSION,
  CLASSIFICATION,
  NEXT_LEGAL_ACTION,
  classifyFullBackboneSpatialAffineSmokeFailure,
} from "./lib/ai-painter-stage4-full-backbone-spatial-affine-smoke-failure-classifier-v1.mjs"
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
const SOURCE_RUN_ID = "stage4-full-backbone-spatial-affine-controlled-smoke-20260829-122026631-8c731d5a"
const RUN_ID = "stage4-full-backbone-spatial-affine-smoke-failure-classification-20260829-122026631-8c731d5a"
const SOURCE_ROOT = inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-controlled-smokes/${SOURCE_RUN_ID}`)
const OUTPUT_ROOT = inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-smoke-failure-classifications/${RUN_ID}`)
const PLAN = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const AXIS_ROOT = inside(".runtime/ai-painter/stage4-model-family-discriminations/stage4-model-family-discrimination-20260828232421-01")
const GPU_ROOT = inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-qualifications/full-backbone-spatial-affine-readonly-gpu-20260829-050738056-c535dd94")
const CHECKER = inside("scripts/check-ai-painter-stage4-full-backbone-spatial-affine-smoke-failure-classifier.mjs")
const LIBRARY = inside("scripts/lib/ai-painter-stage4-full-backbone-spatial-affine-smoke-failure-classifier-v1.mjs")

const SOURCE = Object.freeze({
  terminal: path.join(SOURCE_ROOT, "phase-terminal.json"),
  manifest: path.join(SOURCE_ROOT, "manifest.json"),
  finalization: path.join(SOURCE_ROOT, "finalization", "finalization.json"),
  review: path.join(SOURCE_ROOT, "machine-review-timeline.json"),
  qualification: path.join(SOURCE_ROOT, "late-stability-qualification.json"),
  executionState: path.join(SOURCE_ROOT, "execution-state.json"),
  trainingProgress: path.join(SOURCE_ROOT, "training-output", "progress.json"),
  trainingManifest: path.join(SOURCE_ROOT, "training-output", "manifest.json"),
  resourceTelemetry: path.join(SOURCE_ROOT, "training-output", "resource-telemetry.json"),
  controlledContract: inside(".runtime/ai-painter/stage4-full-backbone-spatial-affine-smoke-contract-compilations/stage4-full-backbone-spatial-affine-smoke-contract-20260829-122026631-8c731d5a/controlled-smoke-contract.json"),
  gpuReport: path.join(GPU_ROOT, "gpu-diagnostic-report.json"),
  gradientEvidence: path.join(GPU_ROOT, "gradient-evidence.json"),
  axisAudit: path.join(AXIS_ROOT, "model-family-axis-audit.json"),
  axisDecision: path.join(AXIS_ROOT, "unique-decision.json"),
  axisTerminal: path.join(AXIS_ROOT, "phase-terminal.json"),
})

const FILES = Object.freeze({
  metadata: path.join(OUTPUT_ROOT, "run-metadata.json"),
  problem: path.join(OUTPUT_ROOT, "problem-report.json"),
  analysis: path.join(OUTPUT_ROOT, "causal-analysis.json"),
  decision: path.join(OUTPUT_ROOT, "unique-decision.json"),
  routeExit: path.join(OUTPUT_ROOT, "candidate-route-exit.json"),
  axisExhaustion: path.join(OUTPUT_ROOT, "bounded-axis-exhaustion.json"),
  cpuReport: path.join(OUTPUT_ROOT, "cpu-report.json"),
  nextAction: path.join(OUTPUT_ROOT, "local-next-action.json"),
  terminal: path.join(OUTPUT_ROOT, "phase-terminal.json"),
  capsule: path.join(OUTPUT_ROOT, "local-task-capsule.json"),
  stagedPlan: path.join(OUTPUT_ROOT, "next-plan.md"),
  planReceipt: path.join(OUTPUT_ROOT, "plan-commit-receipt.json"),
  planSync: path.join(OUTPUT_ROOT, "plan-sync-record.json"),
  projectionJournal: path.join(OUTPUT_ROOT, "projection-journal.json"),
})

const existing = await readCurrentExecutionRegistry(ROOT)
assert.equal(existing.ok, true, existing.errorCode)
if (
  existing.registry.taskId === NEXT_LEGAL_ACTION
  && existing.registry.terminalEvidence?.path === projectPath(FILES.terminal)
  && fs.existsSync(FILES.terminal)
) {
  assert.equal(existing.registry.terminalEvidence.sha256, sha(FILES.terminal))
  process.stdout.write(`${JSON.stringify({
    status: read(FILES.terminal).status,
    runId: RUN_ID,
    classification: CLASSIFICATION,
    nextLegalAction: NEXT_LEGAL_ACTION,
    currentRegistryRevision: existing.registry.registryRevision,
    currentRegistrySha256: existing.registrySha256,
    recoveredExistingCompletion: true,
  }, null, 2)}\n`)
  process.exit(0)
}

assert.equal(existing.registry.registryRevision, 49)
assert.equal(existing.registry.eventSequence, 49)
assert.equal(existing.registry.capabilityVersion, CAPABILITY_VERSION)
assert.equal(existing.registry.taskId, "classify_full_backbone_spatial_affine_smoke_failure_and_close")
assert.equal(existing.registry.taskKind, "cpu_readonly_smoke_failure_classification")
assert.equal(existing.registry.runId, SOURCE_RUN_ID)
assert.equal(existing.registry.activity, "controlled_smoke_real_visual_failure_recorded")
assert.equal(existing.registry.activeExecution, null)

for (const file of [...Object.values(SOURCE), CHECKER, LIBRARY, PLAN]) {
  assert.equal(fs.existsSync(file), true, `required evidence missing: ${projectPath(file)}`)
}

if (!fs.existsSync(OUTPUT_ROOT)) {
  fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true })
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false })
}

const metadata = ensureMetadata(existing)
const recordedAtUtc = metadata.recordedAtUtc
const recordedAtAsiaShanghai = metadata.recordedAtAsiaShanghai

const checker = spawnSync(process.execPath, [CHECKER], { cwd: ROOT, encoding: "utf8" })
assert.equal(checker.status, 0, checker.stderr || checker.stdout)
const checkerResult = JSON.parse(checker.stdout)
assert.equal(checkerResult.status, "passed")
assert.equal(checkerResult.totalCases, 15)

const terminal = read(SOURCE.terminal)
const manifest = read(SOURCE.manifest)
const finalization = read(SOURCE.finalization)
const machineReview = read(SOURCE.review)
const lateQualification = read(SOURCE.qualification)
const trainingProgress = read(SOURCE.trainingProgress)
const trainingManifest = read(SOURCE.trainingManifest)
const controlledContract = read(SOURCE.controlledContract)
const gpuReport = read(SOURCE.gpuReport)
const gradientEvidence = read(SOURCE.gradientEvidence)
const priorAxisAudit = read(SOURCE.axisAudit)
const priorAxisDecision = read(SOURCE.axisDecision)

verifyBinding(terminal.manifest, SOURCE.manifest, "terminal manifest")
verifyBinding(terminal.finalization, SOURCE.finalization, "terminal finalization")
verifyBinding(terminal.machineReviewTimeline, SOURCE.review, "terminal machine review")
verifyBinding(terminal.lateStabilityQualification, SOURCE.qualification, "terminal late qualification")
verifyBinding(terminal.resourceTelemetry, SOURCE.resourceTelemetry, "terminal resource telemetry")
verifyBinding(manifest.trainingManifest, SOURCE.trainingManifest, "root training manifest")
verifyBinding(manifest.progress, SOURCE.trainingProgress, "root progress")
verifyBinding(manifest.controlledSmokeContract, SOURCE.controlledContract, "root controlled contract")
verifyBinding(manifest.machineReviewTimeline, SOURCE.review, "root machine review")
verifyBinding(manifest.lateStabilityQualification, SOURCE.qualification, "root late qualification")
verifyBinding(finalization.manifest, SOURCE.manifest, "finalization manifest")
verifyBinding(finalization.trainingManifest, SOURCE.trainingManifest, "finalization training manifest")
verifyBinding(finalization.machineReviewTimeline, SOURCE.review, "finalization machine review")
verifyBinding(finalization.lateStabilityQualification, SOURCE.qualification, "finalization late qualification")
verifyBinding(finalization.resourceTelemetry, SOURCE.resourceTelemetry, "finalization resource telemetry")
assert.equal(manifest.checkpoint.sha256, finalization.checkpoint.sha256)
assert.equal(manifest.checkpoint.promotable, false)
assert.equal(manifest.checkpoint.formalStageInitializationAllowed, false)
assert.equal(finalization.checkpoint.promotable, false)
assert.equal(finalization.checkpoint.formalStageInitializationAllowed, false)

verifyContractEvidence(controlledContract, "readonly-gpu-report", SOURCE.gpuReport)
verifyContractEvidence(controlledContract, "gradient-evidence", SOURCE.gradientEvidence)

const result = classifyFullBackboneSpatialAffineSmokeFailure({
  terminal,
  trainingProgress,
  trainingManifest,
  machineReview,
  lateQualification,
  gpuReport,
  gradientEvidence,
  priorAxisAudit,
  priorAxisDecision,
})

const evidence = Object.fromEntries(Object.entries(SOURCE).map(([role, file]) => [role, bind(file)]))
const fixedProgress = { completedStages: 3, totalStages: 5, percent: 60 }

ensureJson(FILES.problem, {
  schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-problem-report-v1",
  status: "completed",
  runId: RUN_ID,
  sourceRunId: SOURCE_RUN_ID,
  capabilityVersion: CAPABILITY_VERSION,
  facts: {
    completedEpochs: trainingProgress.currentEpoch,
    completedOptimizerSteps: trainingProgress.liveProgress.optimizerStep,
    machineReviewPassCount: machineReview.previewPassCount,
    machineReviewFailCount: machineReview.previewFailCount,
    fixedReviewEpochs: machineReview.reviews.map((row) => row.epoch),
    fixedReviewFailureCounts: machineReview.reviews.map((row) => row.issueCodes.length),
    lateFailureCounts: lateQualification.lateEpochs.map((row) => row.failureCount),
    modelWeightsChanged: trainingManifest.modelStateHashEvidence.weightsChanged,
    checkpointPromotable: manifest.checkpoint.promotable,
    stage0Started: terminal.stage0Started,
  },
  sourceTerminal: bind(SOURCE.terminal),
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

ensureJson(FILES.analysis, {
  schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-causal-analysis-v1",
  status: "completed",
  runId: RUN_ID,
  sourceRunId: SOURCE_RUN_ID,
  capabilityVersion: CAPABILITY_VERSION,
  classification: result.classification,
  findings: {
    executionWiringDefectConfirmed: result.executionWiringDefectConfirmed,
    dataOrReviewIdentityDefectConfirmed: result.dataOrReviewIdentityDefectConfirmed,
    checkpointOrTerminalIdentityDefectConfirmed: result.checkpointOrTerminalIdentityDefectConfirmed,
    finalCoordinationRegressionConfirmed: result.finalCoordinationRegressionConfirmed,
    frozenSmokeCapabilityInsufficientConfirmed: result.frozenSmokeCapabilityInsufficientConfirmed,
    trainingWasEffectiveButInsufficient: result.trainingWasEffectiveButInsufficient,
    fullConditionGradientCoverage: "23_of_23_finite_nonzero",
    affineParameterGradientCoverage: "24_of_24_finite_nonzero",
    persistentLateFailures: result.persistentLateFailures,
    finalObjectMaskedLumaCorrelations: result.finalObjectCorrelations,
    finalObjectMinimumRequiredCorrelation: 0.08,
    finalWaterConditionPassed: true,
    finalRouteUnexpectedBoundarySide: "south",
    noTerminalRegression: lateQualification.noTerminalRegression,
  },
  scope: result.scope,
  evidence,
  checkpointWeightsRead: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

ensureJson(FILES.decision, {
  schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-unique-decision-v1",
  status: "uniquely_classified",
  runId: RUN_ID,
  sourceRunId: SOURCE_RUN_ID,
  capabilityVersion: CAPABILITY_VERSION,
  classification: result.classification,
  candidateDisposition: "rejected_failed_closed",
  stage0Qualified: false,
  stage0Started: false,
  boundedThreeAxisUniverseDisposition: AXIS_DISPOSITION,
  globalArchitecturalImpossibilityClaimed: false,
  allMathematicallyPossibleArchitecturesExhaustedClaimed: false,
  nextLegalAction: NEXT_LEGAL_ACTION,
  currentFixedProgress: fixedProgress,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  automaticTrainingContinuationAllowed: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

ensureJson(FILES.routeExit, {
  schemaVersion: "stage4-full-backbone-spatial-affine-candidate-route-exit-v1",
  status: "candidate_rejected_failed_closed",
  runId: RUN_ID,
  sourceRunId: SOURCE_RUN_ID,
  capabilityVersion: CAPABILITY_VERSION,
  sourceDecision: bind(FILES.decision),
  reason: "frozen_controlled_smoke_completed_with_valid_learning_and_identity_but_failed_all_five_machine_reviews",
  prohibitedReuse: {
    rerunSameCandidateSmoke: true,
    useSmokeCheckpointAsInitialization: true,
    promoteSmokeCheckpoint: true,
    renamedEquivalentCandidate: true,
  },
  checkpointWeightsRead: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

ensureJson(FILES.axisExhaustion, {
  schemaVersion: "stage4-bounded-three-axis-universe-exhaustion-v1",
  status: AXIS_DISPOSITION,
  runId: RUN_ID,
  priorAxisAudit: bind(SOURCE.axisAudit),
  priorAxisDecision: bind(SOURCE.axisDecision),
  axisOutcomes: [
    { axis: "final_output_condition_modulation", disposition: "failed_closed" },
    { axis: "per_class_isolated_semantic_representation", disposition: "failed_closed" },
    { axis: "whole_backbone_spatial_affine_modulation", disposition: "failed_closed_by_current_frozen_smoke" },
  ],
  boundedUniverseExhausted: true,
  allMathematicallyPossibleArchitecturesExhausted: false,
  nextLegalAction: NEXT_LEGAL_ACTION,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

ensureJson(FILES.cpuReport, {
  schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-classifier-cpu-report-v1",
  status: "passed",
  runId: RUN_ID,
  checker: { ...bind(CHECKER), result: checkerResult },
  decisionLibrary: bind(LIBRARY),
  verifiedEvidence: evidence,
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
  taskKind: "cpu_readonly_bounded_model_family_design",
  constraints: {
    mustBeOutsideExhaustedThreeAxisUniverse: true,
    mustBeUniquelyDerivedFromCurrentEvidence: true,
    freeArchitectureOrHyperparameterSelectionAllowed: false,
    checkpointReadAllowed: false,
    gpuAllowed: false,
    trainingAllowed: false,
  },
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

ensureJson(FILES.terminal, {
  schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-classification-terminal-v1",
  executionState: "completed",
  status: "stage4_full_backbone_spatial_affine_smoke_failure_classified_candidate_rejected",
  runId: RUN_ID,
  sourceRunId: SOURCE_RUN_ID,
  capabilityVersion: CAPABILITY_VERSION,
  problemReport: bind(FILES.problem),
  causalAnalysis: bind(FILES.analysis),
  uniqueDecision: bind(FILES.decision),
  candidateRouteExit: bind(FILES.routeExit),
  boundedAxisExhaustion: bind(FILES.axisExhaustion),
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
    labelZh: "全主干空间仿射Smoke失败分类与三轴收口",
    status: "completed",
  },
  fixedOverallProgress: fixedProgress,
  uniqueDecision: CLASSIFICATION,
  latestBlocker: "bounded_three_axis_universe_exhausted_without_stage0_qualified_candidate",
  nextAllowedAction: {
    code: NEXT_LEGAL_ACTION,
    taskKind: "cpu_readonly_bounded_model_family_design",
    ownerAuthorizationRequired: false,
    automaticTrainingAllowed: false,
  },
  latestTrainingTerminal: bind(SOURCE.terminal),
  evidence: [
    FILES.problem,
    FILES.analysis,
    FILES.decision,
    FILES.routeExit,
    FILES.axisExhaustion,
    FILES.cpuReport,
    FILES.nextAction,
    FILES.terminal,
  ].map((file) => ({ ...bind(file), sha256Verified: true })),
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
const planBeforeSha256 = metadata.planBeforeSha256
const planAfter = updatePlan(planSource, recordedAtUtc)
ensureText(FILES.stagedPlan, planAfter)
const planAfterSha256 = sha(FILES.stagedPlan)
commitPlan(planBeforeSha256, planAfterSha256)
ensureJson(FILES.planReceipt, {
  schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-classification-plan-commit-receipt-v1",
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
  schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-classification-plan-sync-v1",
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
  id: `stage4-full-backbone-spatial-affine-smoke-failure-classification-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_full_backbone_spatial_affine_smoke_failure_classified_candidate_rejected",
  runId: RUN_ID,
  kind: "cpu_readonly_smoke_failure_classification",
  status: "success",
  title: "Stage4 full-backbone spatial-affine Smoke failure classified",
  titleZh: "Stage4全主干空间仿射Smoke失败已完成分类并退出候选",
  detailZh: "训练、梯度、数据、复现和审核身份有效；冻结30步单样本Smoke机器审核0/5。当前候选能力不足并失败关闭，三条有界模型轴均已退出，但不宣称所有可能架构均已穷尽。",
  evidencePath: projectPath(FILES.terminal),
  evidenceSha256: sha(FILES.terminal),
  fixedTotalProgress: fixedProgress,
}

for (const file of outputArtifacts()) index(file, RUN_ID)
const event = ensureAiPainterProgramEventCommitted(eventInput)
const eventCommit = verifyAiPainterProgramEventCommitted(event)

ensureJson(FILES.projectionJournal, {
  schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-classification-projection-journal-v1",
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
index(FILES.projectionJournal, RUN_ID)

const catalogFiles = [...outputArtifacts(), FILES.projectionJournal]
const catalogArtifacts = catalogFiles.map((file) => ({
  logicalPath: logicalProjectPath(file),
  sha256: sha(file),
}))

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY_VERSION,
  packageId: RUN_ID,
  taskId: NEXT_LEGAL_ACTION,
  taskKind: "cpu_readonly_bounded_model_family_design",
  runId: RUN_ID,
  lifecycleStage: "bounded_three_axis_model_family_routes_exhausted",
  executionState: "completed",
  activity: "bounded_new_model_family_cpu_design_pending",
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
      { role: "classification-terminal", ...bind(FILES.terminal) },
      { role: "local-task-capsule", ...bind(FILES.capsule) },
      { role: "source-smoke-terminal", ...bind(SOURCE.terminal) },
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
assert.equal(advanced.registry.registryRevision, 50)
assert.equal(advanced.registry.taskId, NEXT_LEGAL_ACTION)
assert.equal(advanced.registry.terminalEvidence.sha256, sha(FILES.terminal))

process.stdout.write(`${JSON.stringify({
  status: read(FILES.terminal).status,
  runId: RUN_ID,
  sourceRunId: SOURCE_RUN_ID,
  classification: CLASSIFICATION,
  boundedAxisDisposition: AXIS_DISPOSITION,
  nextLegalAction: NEXT_LEGAL_ACTION,
  terminal: bind(FILES.terminal),
  causalAnalysis: bind(FILES.analysis),
  uniqueDecision: bind(FILES.decision),
  routeExit: bind(FILES.routeExit),
  boundedAxisExhaustion: bind(FILES.axisExhaustion),
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

function ensureMetadata(current) {
  const now = new Date().toISOString()
  const value = {
    schemaVersion: "stage4-full-backbone-spatial-affine-smoke-failure-classification-run-metadata-v1",
    runId: RUN_ID,
    sourceRunId: SOURCE_RUN_ID,
    sourceRegistryRevision: current.registry.registryRevision,
    sourceRegistrySha256: current.registrySha256,
    planBeforeSha256: sha(PLAN),
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  }
  if (!fs.existsSync(FILES.metadata)) writeExclusiveJson(FILES.metadata, value)
  const persisted = read(FILES.metadata)
  assert.equal(persisted.runId, RUN_ID)
  assert.equal(persisted.sourceRunId, SOURCE_RUN_ID)
  assert.equal(persisted.sourceRegistryRevision, 49)
  assert.equal(persisted.sourceRegistrySha256, current.registrySha256)
  return persisted
}

function updatePlan(source, utc) {
  const shanghai = formatShanghai(utc).replace("T", " ").replace("+08:00", " +08:00")
  const status = "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4全主干空间仿射Smoke能力不足已裁决，三条有界模型轴均已退出，新模型家族CPU设计待执行"
  const current = "固定进度3/5（60%）；全主干空间仿射候选受控Smoke失败分类完成，执行、数据、梯度、复现、审核与终态身份有效；当前冻结Smoke能力不足，既定三轴范围内无Stage 0合格候选"
  const next = "下一步由本地程序执行三轴范围外的有界新模型家族CPU设计；不得自由选择结构或参数，不得读取Checkpoint、启动GPU或训练"
  const latest = "全主干空间仿射候选从固定随机初始化自然完成30 Epoch与30次优化，Epoch 1/5/10/20/30均完成字节级复现和正式机器审核。只读GPU资格与训练证据证明23/23条件通道及24/24空间仿射参数梯度有限非零，模型权重真实变化，训练和固定验证指标持续改善。\n\n五个审核节点的专业画面均通过，但条件审核0/5；Epoch 10/20/30持续存在footprints、tree、rock、vegetation参考语义不匹配与道路未授权南侧边界接触。CPU只读裁决据此排除接线、数据、审核、Checkpoint和终态身份故障，确认该候选在冻结的30步单样本Smoke合同下能力不足并登记为`rejected_failed_closed`。该结论不外推为模型在任意训练预算下先天无能力。"
  const blocker = "最终输出调制、逐类隔离语义表示和全主干空间仿射调制三条既定有界模型轴均已完成正式验证并失败关闭，当前范围内没有可进入Stage 0的候选；这只穷尽已绑定的三轴集合，不代表所有可能架构已穷尽。\n\n固定进度保持3/5（60%）。唯一下一动作是由本地程序执行三轴范围外的有界新模型家族CPU设计，必须从当前对象语义相关性不足与道路拓扑泄漏证据唯一派生职责边界、参数来源和验收合同；设计阶段不得自由调参、读取Checkpoint、启动GPU或训练。设计通过后才可进入CPU实现、只读GPU资格和一次受控Smoke。"
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
  const currentSha256 = sha(PLAN)
  if (currentSha256 === beforeSha256) writeAtomicText(PLAN, fs.readFileSync(FILES.stagedPlan, "utf8"))
  else assert.equal(currentSha256, afterSha256, "unique plan changed outside classification transaction")
  assert.equal(sha(PLAN), afterSha256)
}

function replaceOnce(source, pattern, replacement) {
  const matches = source.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)) ?? []
  assert.equal(matches.length, 1, `plan replacement count mismatch: ${pattern}`)
  return source.replace(pattern, replacement)
}

function outputArtifacts() {
  return [
    FILES.metadata,
    FILES.problem,
    FILES.analysis,
    FILES.decision,
    FILES.routeExit,
    FILES.axisExhaustion,
    FILES.cpuReport,
    FILES.nextAction,
    FILES.terminal,
    FILES.capsule,
    FILES.stagedPlan,
    FILES.planReceipt,
    FILES.planSync,
  ]
}

function verifyContractEvidence(contract, role, file) {
  const matches = contract.sourceEvidence.filter((item) => item.role === role)
  assert.equal(matches.length, 1, `contract source evidence count mismatch: ${role}`)
  verifyBinding(matches[0], file, `contract ${role}`)
}

function verifyBinding(binding, file, label) {
  assert.equal(binding?.path, projectPath(file), `${label} path mismatch`)
  assert.equal(binding?.sha256, sha(file), `${label} SHA-256 mismatch`)
}

function bind(file) {
  return { path: projectPath(file), sha256: sha(file) }
}

function index(file, runId) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: "stage4_full_backbone_spatial_affine_smoke_failure_classification",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
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
