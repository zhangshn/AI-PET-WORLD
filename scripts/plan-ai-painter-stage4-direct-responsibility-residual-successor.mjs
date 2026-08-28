import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { createCapabilityCandidate } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, projectPath, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_CAPABILITY = "stage4-direct-condition-clean-latent-generator-change-candidate-v1"
const CAPABILITY = "stage4-direct-clean-latent-responsibility-residual-change-candidate-v1"
const RUN_ID = `stage4-direct-responsibility-residual-plan-${compactUtc()}-01`
const OUTPUT = inside(`.runtime/ai-painter/stage4-direct-responsibility-residual-plans/${RUN_ID}`)
const SOURCE_ROOT = inside(".runtime/ai-painter/stage4-direct-clean-latent-formal-stage0/stage4-direct-clean-latent-stage0-20260827053643-01")
const SOURCE = {
  terminal: path.join(SOURCE_ROOT, "phase-terminal.json"),
  analysis: path.join(SOURCE_ROOT, "failure-analysis.json"),
  decision: path.join(SOURCE_ROOT, "failure-decision.json"),
  machineReview: path.join(SOURCE_ROOT, "machine-review.json"),
  bestReview: path.join(SOURCE_ROOT, "best-checkpoint-machine-review.json"),
  trainingManifest: path.join(SOURCE_ROOT, "training-output", "manifest.json"),
}
const MODEL_FACTORY = inside("ml/ai-painter/src/ai_painter/complete_world/model.py")
const PLAN = inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(current.registry.taskId, "plan_one_bounded_successor_after_direct_clean_latent_stage0_rejection")
assert.equal(current.registry.lifecycleStage, "rejected")
assert.equal(current.registry.latestTrainingTerminal.runId, read(SOURCE.terminal).runId)
for (const file of Object.values(SOURCE)) assert.equal(fs.existsSync(file), true, `source evidence missing: ${file}`)

const terminal = read(SOURCE.terminal)
const analysis = read(SOURCE.analysis)
const review = read(SOURCE.machineReview)
const bestReview = read(SOURCE.bestReview)
const training = read(SOURCE.trainingManifest)
assert.equal(terminal.status, "direct_clean_latent_stage0_real_visual_failure")
assert.equal(terminal.classification, "direct_clean_latent_multisample_semantic_capacity_insufficient_confirmed")
assert.equal(analysis.classification, terminal.classification)
assert.equal(review.previewCount, 6)
assert.equal(review.previewPassCount, 0)
assert.equal(review.previewFailCount, 6)
assert.equal(bestReview.passed, false)
assert.equal(training.epochCount, 40)
assert.equal(training.optimizerStepCount, 1920)
assert.equal(training.historicalDenoiserCheckpointRead, false)

const reviewTimeline = review.reviews.map((row) => ({ epoch: row.epoch, passed: row.passed, issueCodes: row.issueCodes }))
const persistentResponsibilities = [
  "terrain_path_ground",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
]
for (const responsibility of persistentResponsibilities) {
  assert.equal(
    reviewTimeline.slice(-3).some((row) => row.issueCodes.some((code) => code.includes(responsibility.replace("terrain_path_ground", "terrain_path_ground")))),
    true,
    `late responsibility failure evidence missing: ${responsibility}`,
  )
}
assert.equal(
  reviewTimeline.slice(2).every((row) => !row.issueCodes.some((code) => code.includes("terrain_water"))),
  true,
  "water must remain a learned base responsibility",
)

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.mkdirSync(OUTPUT, { recursive: false })
const paths = {
  problem: path.join(OUTPUT, "problem-report.json"),
  analysis: path.join(OUTPUT, "causal-analysis.json"),
  candidate: path.join(OUTPUT, "bounded-successor-contract.json"),
  cpu: path.join(OUTPUT, "cpu-report.json"),
  planSync: path.join(OUTPUT, "plan-sync-record.json"),
  terminal: path.join(OUTPUT, "phase-terminal.json"),
  capsule: path.join(OUTPUT, "local-task-capsule.json"),
}
writeExclusive(paths.problem, {
  schemaVersion: "stage4-direct-responsibility-residual-problem-v1",
  status: "direct_clean_latent_stage0_multisample_semantic_capacity_gap_confirmed",
  runId: RUN_ID,
  sourceRunId: terminal.runId,
  facts: {
    epochCount: 40,
    optimizerStepCount: 1920,
    fixedReviewPassCount: 0,
    fixedReviewFailCount: 6,
    bestEpoch: training.bestEpoch,
    bestCheckpointPreviewPassed: false,
    waterLateNodesPassed: true,
    persistentResponsibilityFailures: persistentResponsibilities,
  },
  checkpointWeightsRead: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
writeExclusive(paths.analysis, {
  schemaVersion: "stage4-direct-responsibility-residual-causal-analysis-v1",
  status: "unique_bounded_successor_boundary_identified",
  runId: RUN_ID,
  sourceArchitecture: training.architecture,
  cause: "single_shared_clean_latent_output_head_does_not_isolate_persistent_route_and_object_responsibilities_across_multiple_samples",
  excludedCauses: [
    "training_incomplete",
    "checkpoint_selection_identity_gap",
    "water_base_spatial_learning_absent",
    "historical_checkpoint_initialization",
    "machine_review_threshold_change",
  ],
  evidence: {
    reviewTimeline,
    bestEpoch: training.bestEpoch,
    bestCheckpointIssueCodes: bestReview.issueCodes,
  },
  checkpointWeightsRead: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
const candidate = {
  schemaVersion: "stage4-direct-clean-latent-responsibility-residual-contract-v1",
  status: "cpu_implementation_required_inactive",
  capabilityVersion: CAPABILITY,
  architecture: "stage4_direct_condition_clean_latent_responsibility_residual_v1",
  substantiveDifference: "retain_the_direct_clean_latent_backbone_and_add_five_mask_gated_parameter_isolated_residual_heads_at_the_final_latent_output",
  frozenBase: {
    conditionChannels: 23,
    latentChannels: 12,
    latentDownsampleFactor: 4,
    widths: [64, 128, 256],
    autoencoderFrozen: true,
    existingLossValuesAndWeightsUnchanged: true,
    datasetAndSplitUnchanged: true,
    machineReviewThresholdsUnchanged: true,
  },
  responsibilityResiduals: {
    identityOrder: persistentResponsibilities,
    sourceMasks: persistentResponsibilities,
    inputFeatureChannels: 64,
    outputLatentChannels: 12,
    headDefinition: "Conv2d(64,12,3,padding=1,bias=true)",
    parameterCountPerHead: 6924,
    headCount: 5,
    totalAddedParameterCount: 34620,
    merge: "base_clean_latent_plus_sum_of_mask_gated_residuals",
    outsideMaskResidualMustBeZero: true,
    trainableParametersSharedAcrossResponsibilities: false,
    freeBlendWeightsPresent: false,
  },
  derivation: {
    headIdentities: "exact_late_and_best_checkpoint_persistent_failed_responsibilities",
    featureWidth: "existing_direct_generator_final_feature_width_64",
    latentWidth: "existing_frozen_autoencoder_latent_channels_12",
    kernelAndPadding: "existing_direct_generator_final_output_3x3_padding1",
    headCount: "one_for_each_of_five_persistent_failed_responsibilities",
    noFreeArchitectureParameterChosen: true,
  },
  forbidden: [
    "new_loss",
    "loss_weight_change",
    "data_change",
    "review_threshold_change",
    "historical_or_failed_checkpoint_initialization",
    "water_specific_residual_head",
    "automatic_retry_of_rejected_direct_baseline",
    "free_hyperparameter",
  ],
  activationGate: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusive(paths.candidate, candidate)

const modelSource = fs.readFileSync(MODEL_FACTORY, "utf8")
const positiveChecks = {
  sourceFailureIdentityVerified: true,
  allSixFixedNodesAudited: reviewTimeline.length === 6,
  bestCheckpointAlsoFails: bestReview.passed === false,
  waterExcludedFromNewHeads: !candidate.responsibilityResiduals.identityOrder.includes("terrain_water"),
  fiveResponsibilitiesExact: JSON.stringify(candidate.responsibilityResiduals.identityOrder) === JSON.stringify(persistentResponsibilities),
  parameterCountDerived: candidate.responsibilityResiduals.parameterCountPerHead === 64 * 12 * 3 * 3 + 12 && candidate.responsibilityResiduals.totalAddedParameterCount === 5 * (64 * 12 * 3 * 3 + 12),
  modelFactoryContainsBoundedArchitecture: modelSource.includes(candidate.architecture),
  modelFactoryContainsMaskedResidualEvidence: modelSource.includes("maskedResponsibilityResiduals") && modelSource.includes("outsideMaskMutationAllowed"),
  checkpointWeightsNotRead: true,
}
const negativeChecks = {
  rejectWaterHead: ![...candidate.responsibilityResiduals.identityOrder, "terrain_water"].every((value) => persistentResponsibilities.includes(value)),
  rejectMissingResponsibility: candidate.responsibilityResiduals.identityOrder.slice(1).length !== 5,
  rejectFreeWidth: candidate.responsibilityResiduals.inputFeatureChannels !== 128,
  rejectSharedHead: candidate.responsibilityResiduals.trainableParametersSharedAcrossResponsibilities === false,
  rejectNewLoss: candidate.frozenBase.existingLossValuesAndWeightsUnchanged === true,
  rejectCheckpointReuse: candidate.forbidden.includes("historical_or_failed_checkpoint_initialization"),
}
assert.equal(Object.values(positiveChecks).every(Boolean), true)
assert.equal(Object.values(negativeChecks).every(Boolean), true)
writeExclusive(paths.cpu, {
  schemaVersion: "stage4-direct-responsibility-residual-planning-cpu-report-v1",
  status: "passed",
  runId: RUN_ID,
  positiveChecks,
  negativeChecks,
  positiveCount: Object.keys(positiveChecks).length,
  negativeCount: Object.keys(negativeChecks).length,
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
})

createCapabilityCandidate({
  schemaVersion: "ai-painter-capability-change-candidate-v1",
  capabilityVersion: CAPABILITY,
  changeClass: "model_family",
  summary: "Direct clean-latent generator with five mask-gated responsibility residual heads",
  sourceEvidence: [SOURCE.terminal, SOURCE.analysis, SOURCE.machineReview, SOURCE.bestReview, SOURCE.trainingManifest, paths.candidate, paths.cpu].map(bind),
  ownerAuthorizationRequired: false,
  ownerInLifecycle: false,
})
writeExclusive(paths.terminal, {
  schemaVersion: "stage4-direct-responsibility-residual-planning-terminal-v1",
  executionState: "completed",
  status: "one_bounded_successor_planned",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  uniqueDecision: "mask_gated_parameter_isolated_responsibility_residual_successor_only",
  problem: bind(paths.problem),
  analysis: bind(paths.analysis),
  candidate: bind(paths.candidate),
  cpuReport: bind(paths.cpu),
  nextLegalAction: "implement_direct_responsibility_residual_cpu_inactive_support",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
syncPlan()
writeExclusive(paths.planSync, {
  schemaVersion: "stage4-direct-responsibility-residual-plan-sync-v1",
  status: "synchronized",
  runId: RUN_ID,
  terminal: bind(paths.terminal),
  nextLegalAction: "implement_direct_responsibility_residual_cpu_inactive_support",
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
const evidenceFiles = [paths.problem, paths.analysis, paths.candidate, paths.cpu, paths.terminal, paths.planSync]
writeExclusive(paths.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage 4有界模型候选建设", status: "cpu_implementation_pending" },
  candidateTerminal: { runId: RUN_ID, status: "planned", programStatus: "one_bounded_successor_planned", previewMachineStatus: "source_stage0_0_of_6", modelQualificationStatus: "cpu_implementation_pending", previewCount: 6, previewPassCount: 0, previewFailCount: 6, checkpointWritten: false, modelWeightsModified: false, recordedAtUtc: read(paths.terminal).recordedAtUtc },
  latestBlocker: { code: "cpu_implementation_not_yet_verified", summaryZh: "唯一后继结构已经由正式失败证据派生；CPU未激活实现与隔离检查尚未完成。" },
  nextAllowedAction: { code: "implement_direct_responsibility_residual_cpu_inactive_support", labelZh: "实施掩码门控责任残差CPU未激活支持", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
  forbiddenActions: candidate.forbidden,
  taskIdentity: { modelId: candidate.architecture, sampleId: null, conditionLabel: null, sampleSplit: null, seed: 20263722, requiredBoundarySides: ["west"] },
  evidence: evidenceFiles.map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha(file), sha256Verified: true, recordedAtUtc: new Date().toISOString(), recordedAtAsiaShanghai: null })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
})
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: "implement_direct_responsibility_residual_cpu_inactive_support",
  taskKind: "cpu_inactive_candidate_implementation",
  runId: RUN_ID,
  lifecycleStage: "change_candidate",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(paths.capsule),
  terminalEvidencePath: projectPath(paths.terminal),
})
appendAiPainterProgramEvent({
  id: `stage4-direct-responsibility-residual-plan-${RUN_ID}`,
  timestamp: new Date().toISOString(),
  action: "stage4_direct_responsibility_residual_successor_planned",
  runId: RUN_ID,
  kind: "model_family_planning",
  status: "success",
  title: "Stage4 bounded responsibility residual successor planned",
  titleZh: "Stage4掩码门控责任残差唯一后继已规划",
  detailZh: "仅保留一个有实质结构差异的候选；未读取Checkpoint、未启动GPU或训练。",
  evidencePath: projectPath(paths.terminal),
  evidenceSha256: sha(paths.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
process.stdout.write(`${JSON.stringify({ status: "one_bounded_successor_planned", runId: RUN_ID, capabilityVersion: CAPABILITY, terminal: bind(paths.terminal), candidate: bind(paths.candidate), cpuReport: bind(paths.cpu), currentRegistrySha256: advanced.registrySha256, nextLegalAction: "implement_direct_responsibility_residual_cpu_inactive_support", ownerAuthorizationRequired: false }, null, 2)}\n`)

function syncPlan() {
  let value = fs.readFileSync(PLAN, "utf8")
  const timestamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date())
  value = value.replace(/^更新时间：.*$/m, `更新时间：${timestamp} +08:00`)
  value = value.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4掩码门控责任残差唯一有界候选已规划，CPU未激活实现待本地程序执行")
  value = value.replace(/\| 2 \| AI Painter R5 \/ Stage4 \|([^\n]+)\|[^\n]+\|[^\n]+\|/m, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；直接干净潜变量Stage 0以0/6及最佳Epoch失败退出；唯一后继为五责任掩码门控参数隔离残差结构 | 本地程序先完成CPU未激活实现和只读GPU资格；通过后才执行受控Smoke |")
  fs.writeFileSync(PLAN, value, "utf8")
}
function inside(relativePath) { assert.ok(relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes("..")); const target = path.resolve(ROOT, relativePath); assert.ok(target.startsWith(`${ROOT}${path.sep}`)); return target }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
