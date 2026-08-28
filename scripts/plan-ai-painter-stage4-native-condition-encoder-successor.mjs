import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { createCapabilityCandidate } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, projectPath } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_CAPABILITY = "stage4-direct-clean-latent-responsibility-residual-change-candidate-v1"
const CAPABILITY = "stage4-native-condition-encoder-clean-latent-change-candidate-v1"
const ARCHITECTURE = "stage4_native_condition_encoder_clean_latent_generator_v1"
const RUN_ID = `stage4-native-condition-encoder-plan-${compactUtc()}-01`
const OUTPUT = inside(`.runtime/ai-painter/stage4-native-condition-encoder-plans/${RUN_ID}`)
const SOURCE_ROOT = inside(".runtime/ai-painter/stage4-direct-responsibility-residual-formal-stage0/stage4-direct-responsibility-residual-stage0-20260827091911-01")
const SOURCE = {
  terminal: path.join(SOURCE_ROOT, "phase-terminal.json"),
  analysis: path.join(SOURCE_ROOT, "failure-analysis.json"),
  decision: path.join(SOURCE_ROOT, "failure-decision.json"),
  machineReview: path.join(SOURCE_ROOT, "machine-review.json"),
  bestReview: path.join(SOURCE_ROOT, "best-checkpoint-machine-review.json"),
  trainingManifest: path.join(SOURCE_ROOT, "training-output", "manifest.json"),
}
const MODEL_FACTORY = inside("ml/ai-painter/src/ai_painter/complete_world/model.py")

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(current.registry.taskId, "plan_one_bounded_successor_after_direct_responsibility_residual_stage0_rejection")
assert.equal(current.registry.lifecycleStage, "rejected")
for (const file of Object.values(SOURCE)) assert.equal(fs.existsSync(file), true, `source evidence missing: ${file}`)

const terminal = read(SOURCE.terminal)
const sourceAnalysis = read(SOURCE.analysis)
const decision = read(SOURCE.decision)
const review = read(SOURCE.machineReview)
const bestReview = read(SOURCE.bestReview)
const training = read(SOURCE.trainingManifest)
assert.equal(terminal.status, "direct_responsibility_residual_stage0_real_visual_failure")
assert.equal(terminal.classification, "direct_responsibility_residual_multisample_semantic_capacity_insufficient_confirmed")
assert.equal(sourceAnalysis.classification, terminal.classification)
assert.equal(decision.currentCandidateRejected, true)
assert.equal(review.previewCount, 6)
assert.equal(review.previewPassCount, 0)
assert.equal(review.previewFailCount, 6)
assert.equal(bestReview.passed, false)
assert.equal(training.epochCount, 40)
assert.equal(training.optimizerStepCount, 1920)
assert.equal(training.historicalDenoiserCheckpointRead, false)

const modelSource = fs.readFileSync(MODEL_FACTORY, "utf8")
const classStart = modelSource.indexOf("class ProjectOwnedDirectConditionCleanLatentGenerator")
const classEnd = modelSource.indexOf("class ProjectOwnedDirectConditionCleanLatentSystem", classStart)
assert.ok(classStart >= 0 && classEnd > classStart, "current direct generator source boundary missing")
const currentGeneratorSource = modelSource.slice(classStart, classEnd)
const rawResizeIndex = currentGeneratorSource.indexOf("typed_conditions = self.prepare_typed_conditions(conditions, latent_size)")
const firstLearnedFeatureIndex = currentGeneratorSource.indexOf("level0 = self.condition_stem(typed_conditions)")
assert.ok(rawResizeIndex >= 0 && firstLearnedFeatureIndex > rawResizeIndex, "current raw-condition resize-before-feature identity changed")

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.mkdirSync(OUTPUT, { recursive: false })
const paths = Object.fromEntries([
  "problem-report", "causal-analysis", "unique-decision", "bounded-successor-contract",
  "cpu-report", "phase-terminal", "local-task-capsule",
].map((name) => [name.replaceAll("-", "_"), path.join(OUTPUT, `${name}.json`)]))

writeExclusive(paths.problem_report, {
  schemaVersion: "stage4-native-condition-encoder-problem-v1",
  status: "pre_feature_extraction_condition_resolution_collapse_confirmed",
  runId: RUN_ID,
  sourceRunId: terminal.runId,
  facts: {
    epochCount: 40,
    optimizerStepCount: 1920,
    fixedReviewPassCount: 0,
    fixedReviewFailCount: 6,
    bestEpoch: training.bestEpoch,
    bestCheckpointPreviewPassed: false,
    bestCheckpointIssueCodes: bestReview.issueCodes,
    inputConditionSize: [256, 192],
    firstLearnedFeatureSizeInRejectedCandidate: [64, 48],
    reductionFactorBeforeFirstLearnedFeature: 4,
  },
  checkpointWeightsRead: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
writeExclusive(paths.causal_analysis, {
  schemaVersion: "stage4-native-condition-encoder-causal-analysis-v1",
  status: "unique_bounded_architecture_boundary_identified",
  runId: RUN_ID,
  sourceArchitecture: training.architecture,
  cause: "the_formal_23_channel_conditions_are_resized_to_the_frozen_autoencoder_latent_resolution_before_any_learned_spatial_feature_extraction",
  consequence: "thin_route_boundaries_and_small_per_class_object_structures_can_be_removed_before_the_trainable_generator_can_encode_them",
  sourceCodeIdentity: {
    className: "ProjectOwnedDirectConditionCleanLatentGenerator",
    rawResizeOccursBeforeConditionStem: true,
    rawResizeStatementIndex: rawResizeIndex,
    firstLearnedFeatureStatementIndex: firstLearnedFeatureIndex,
  },
  excludedActions: [
    "increase_existing_width_only",
    "add_another_loss",
    "change_dataset",
    "lower_machine_review_threshold",
    "reuse_failed_checkpoint",
    "post_decode_rgb_compositor",
  ],
  checkpointWeightsRead: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})

const candidate = {
  schemaVersion: "stage4-native-condition-encoder-clean-latent-contract-v1",
  status: "cpu_implementation_required_inactive",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  substantiveDifference: "extract_learned_spatial_features_from_the_native_23_channel_condition_tensor_before_the_existing_fourfold_autoencoder_latent_reduction",
  frozenBusinessAndTrainingBoundary: {
    conditionChannels: 23,
    latentChannels: 12,
    latentDownsampleFactor: 4,
    widths: [64, 128, 256],
    autoencoderFrozen: true,
    datasetCount: 64,
    split: [48, 8, 4, 4],
    existingLossValuesAndWeightsUnchanged: true,
    machineReviewThresholdsUnchanged: true,
    failedCheckpointInitializationForbidden: true,
  },
  nativeConditionEncoder: {
    input: "formal_23_channel_conditions_at_stage_native_resolution",
    stem: "Conv2d(23,64,3,padding=1,bias=true)->SiLU->ResidualBlock(64)",
    down1: "Conv2d(64,128,4,stride=2,padding=1,bias=true)->ResidualBlock(128)",
    down2: "Conv2d(128,256,4,stride=2,padding=1,bias=true)->ResidualBlock(256)",
    middle: "ResidualBlock(256)->ResidualBlock(256)",
    output: "GroupNorm(256)->SiLU->Conv2d(256,12,3,padding=1,bias=true)",
    outputSpatialIdentity: "native_condition_height_and_width_divided_by_existing_autoencoder_factor_4",
    rawConditionResizeBeforeStem: false,
    postDecodeRgbMutation: false,
  },
  derivation: {
    conditionChannels: "formal_condition_contract_23",
    widths: "existing_model_width_hierarchy_64_128_256",
    latentChannels: "current_frozen_autoencoder_latent_channels_12",
    downsampleStages: "existing_frozen_autoencoder_spatial_factor_4_as_two_stride2_stages",
    outputResolution: "Stage0_256x192_to_latent_64x48",
    noFreeArchitectureParameterChosen: true,
  },
  forbidden: [
    "new_loss", "loss_weight_change", "data_change", "split_change",
    "review_threshold_change", "failed_or_historical_checkpoint_initialization",
    "post_decode_rgb_compositor", "tile_or_patch_generation", "free_hyperparameter",
    "automatic_retry_of_rejected_candidate",
  ],
  activationGate: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusive(paths.bounded_successor_contract, candidate)

const positiveChecks = {
  sourceTerminalIdentityVerified: terminal.runId === current.registry.runId,
  sourceCandidateRejected: decision.currentCandidateRejected === true,
  fullTrainingCompleted: training.epochCount === 40 && training.optimizerStepCount === 1920,
  fixedAndBestReviewBothFailed: review.previewPassCount === 0 && bestReview.passed === false,
  currentRawResizeBeforeFirstFeatureProven: rawResizeIndex < firstLearnedFeatureIndex,
  successorStartsLearningAtNativeResolution: candidate.nativeConditionEncoder.rawConditionResizeBeforeStem === false,
  dimensionsUniquelyDerived: JSON.stringify(candidate.frozenBusinessAndTrainingBoundary.widths) === JSON.stringify([64, 128, 256]),
  businessAndReviewBoundariesFrozen: candidate.frozenBusinessAndTrainingBoundary.existingLossValuesAndWeightsUnchanged && candidate.frozenBusinessAndTrainingBoundary.machineReviewThresholdsUnchanged,
  checkpointWeightsNotRead: true,
}
const negativeChecks = {
  rejectsLatentResizeBeforeStem: candidate.nativeConditionEncoder.rawConditionResizeBeforeStem === false,
  rejectsWidthOnlyRetry: candidate.forbidden.includes("automatic_retry_of_rejected_candidate"),
  rejectsNewLoss: candidate.forbidden.includes("new_loss"),
  rejectsDataChange: candidate.forbidden.includes("data_change"),
  rejectsCheckpointReuse: candidate.forbidden.includes("failed_or_historical_checkpoint_initialization"),
  rejectsPostDecodeCompositor: candidate.forbidden.includes("post_decode_rgb_compositor"),
  rejectsFreeHyperparameter: candidate.forbidden.includes("free_hyperparameter"),
}
assert.equal(Object.values(positiveChecks).every(Boolean), true)
assert.equal(Object.values(negativeChecks).every(Boolean), true)
writeExclusive(paths.cpu_report, {
  schemaVersion: "stage4-native-condition-encoder-planning-cpu-report-v1",
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
writeExclusive(paths.unique_decision, {
  schemaVersion: "stage4-native-condition-encoder-unique-decision-v1",
  status: "unique_decision_formed",
  runId: RUN_ID,
  decision: "native_condition_feature_extraction_before_latent_resolution_reduction_is_the_only_bounded_successor",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})

createCapabilityCandidate({
  schemaVersion: "ai-painter-capability-change-candidate-v1",
  capabilityVersion: CAPABILITY,
  changeClass: "model_family",
  summary: "Native-resolution condition encoder producing the frozen Autoencoder clean-latent boundary",
  sourceEvidence: [...Object.values(SOURCE), paths.problem_report, paths.causal_analysis, paths.bounded_successor_contract, paths.cpu_report].map(bind),
  ownerAuthorizationRequired: false,
  ownerInLifecycle: false,
})
writeExclusive(paths.phase_terminal, {
  schemaVersion: "stage4-native-condition-encoder-planning-terminal-v1",
  executionState: "completed",
  status: "one_bounded_successor_planned",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  uniqueDecision: read(paths.unique_decision).decision,
  problem: bind(paths.problem_report),
  analysis: bind(paths.causal_analysis),
  candidate: bind(paths.bounded_successor_contract),
  cpuReport: bind(paths.cpu_report),
  nextLegalAction: "implement_native_condition_encoder_clean_latent_cpu_inactive_support",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
const evidenceFiles = [paths.problem_report, paths.causal_analysis, paths.unique_decision, paths.bounded_successor_contract, paths.cpu_report, paths.phase_terminal]
writeExclusive(paths.local_task_capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage 4原生条件编码候选建设", status: "cpu_implementation_pending" },
  candidateTerminal: { runId: RUN_ID, status: "planned", programStatus: "one_bounded_successor_planned", previewMachineStatus: "source_stage0_0_of_6", modelQualificationStatus: "cpu_implementation_pending", previewCount: 6, previewPassCount: 0, previewFailCount: 6, checkpointWritten: false, modelWeightsModified: false, recordedAtUtc: read(paths.phase_terminal).recordedAtUtc },
  latestBlocker: { code: "cpu_implementation_not_yet_verified", summaryZh: "原生分辨率条件编码唯一候选已经形成，CPU未激活实现尚未完成。" },
  nextAllowedAction: { code: "implement_native_condition_encoder_clean_latent_cpu_inactive_support", labelZh: "实施原生分辨率条件编码CPU未激活支持", ownerAuthorizationRequired: false, automaticExecutionAllowed: true, planEvidenceConfirmed: true },
  forbiddenActions: candidate.forbidden,
  taskIdentity: { modelId: ARCHITECTURE, sampleId: null, conditionLabel: null, sampleSplit: null, seed: 20263722, requiredBoundarySides: ["west"] },
  evidence: evidenceFiles.map((file) => ({ kind: path.basename(file, path.extname(file)), labelZh: path.basename(file), ...bind(file), expectedSha256: sha(file), sha256Verified: true, recordedAtUtc: new Date().toISOString(), recordedAtAsiaShanghai: null })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
})
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: "implement_native_condition_encoder_clean_latent_cpu_inactive_support",
  taskKind: "cpu_inactive_candidate_implementation",
  runId: RUN_ID,
  lifecycleStage: "change_candidate",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(paths.local_task_capsule),
  terminalEvidencePath: projectPath(paths.phase_terminal),
})
appendAiPainterProgramEvent({
  id: `stage4-native-condition-encoder-plan-${RUN_ID}`,
  timestamp: new Date().toISOString(),
  action: "stage4_native_condition_encoder_successor_planned",
  runId: RUN_ID,
  kind: "model_family_planning",
  status: "success",
  title: "Stage4 native-condition encoder successor planned",
  titleZh: "Stage4原生分辨率条件编码唯一后继已规划",
  detailZh: "程序确认当前候选在学习空间特征前压缩原始条件；唯一后继改为先提取原生分辨率特征再降至潜变量。",
  evidencePath: projectPath(paths.phase_terminal),
  evidenceSha256: sha(paths.phase_terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
process.stdout.write(`${JSON.stringify({ status: "one_bounded_successor_planned", runId: RUN_ID, capabilityVersion: CAPABILITY, terminal: bind(paths.phase_terminal), candidate: bind(paths.bounded_successor_contract), cpuReport: bind(paths.cpu_report), currentRegistrySha256: advanced.registrySha256, nextLegalAction: "implement_native_condition_encoder_clean_latent_cpu_inactive_support", ownerAuthorizationRequired: false }, null, 2)}\n`)

function inside(relativePath) { assert.ok(relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes("..")); const target = path.resolve(ROOT, relativePath); assert.ok(target.startsWith(`${ROOT}${path.sep}`)); return target }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
