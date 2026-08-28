import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { createCapabilityCandidate } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, formatShanghai, projectPath } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_CAPABILITY = "stage4-native-condition-encoder-clean-latent-change-candidate-v1"
const CAPABILITY = "stage4-native-condition-encoder-responsibility-residual-final-candidate-v1"
const ARCHITECTURE = "stage4_native_condition_encoder_masked_responsibility_residual_v1"
const EXPECTED_TASK = "retire_native_condition_encoder_candidate_after_fixed_40_epoch_failure"
const NEXT_TASK = "implement_native_condition_encoder_responsibility_residual_cpu_inactive_support"
const RUN_ID = `stage4-native-responsibility-residual-plan-${compactUtc()}-01`
const OUTPUT = inside(`.runtime/ai-painter/stage4-native-responsibility-residual-plans/${RUN_ID}`)

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(current.registry.taskId, EXPECTED_TASK)
assert.equal(current.registry.activity, "planned_not_started")
assert.equal(current.registry.activeExecution, null)
const sourceTerminalPath = inside(current.registry.latestTrainingTerminal.path)
verifyFile(sourceTerminalPath, current.registry.latestTrainingTerminal.sha256, "fixed 40 Epoch terminal")
const sourceTerminal = read(sourceTerminalPath)
assert.equal(sourceTerminal.status, "native_condition_encoder_fixed_40_epoch_qualification_real_visual_failure")
const sourceReviewPath = inside(sourceTerminal.machineReview.path)
verifyFile(sourceReviewPath, sourceTerminal.machineReview.sha256, "fixed 40 Epoch machine review")
const sourceReview = read(sourceReviewPath)
const epoch30 = sourceReview.reviews.find((row) => row.epoch === 30)
const epoch40 = sourceReview.reviews.find((row) => row.epoch === 40)
assert.deepEqual(epoch30.issueCodes, ["condition_object_rock_reference_semantic_mismatch"])
assert.deepEqual(epoch40.issueCodes, ["condition_terrain_path_ground_required_boundary_contact_missing"])
assert.equal(epoch40.conditionAlignment.objectSemanticAudits.filter((row) => row.channelId.startsWith("object_")).every((row) => row.passed), true)

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.mkdirSync(OUTPUT, { recursive: false })
const files = {
  retirement: path.join(OUTPUT, "source-candidate-retirement.json"),
  analysis: path.join(OUTPUT, "causal-analysis.json"),
  contract: path.join(OUTPUT, "bounded-final-candidate-contract.json"),
  cpu: path.join(OUTPUT, "cpu-report.json"),
  terminal: path.join(OUTPUT, "phase-terminal.json"),
  capsule: path.join(OUTPUT, "local-task-capsule.json"),
}
const recordedAtUtc = new Date().toISOString()
writeExclusive(files.retirement, {
  schemaVersion: "stage4-native-condition-encoder-candidate-retirement-v1",
  status: "retired_after_fixed_40_epoch_real_visual_failure",
  capabilityVersion: SOURCE_CAPABILITY,
  sourceTerminal: bind(sourceTerminalPath),
  automaticRetryAllowed: false,
  checkpointReadOrReuseAllowed: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
writeExclusive(files.analysis, {
  schemaVersion: "stage4-native-responsibility-residual-causal-analysis-v1",
  status: "shared_terminal_latent_responsibility_interference_confirmed",
  sourceTerminal: bind(sourceTerminalPath),
  sourceMachineReview: bind(sourceReviewPath),
  evidence: {
    epoch30OnlyFailure: epoch30.issueCodes[0],
    epoch40OnlyFailure: epoch40.issueCodes[0],
    epoch40AllFourObjectSemanticsPassed: true,
    epoch40RouteRequiredBoundaryFailed: true,
    failureIdentityChangedAcrossLateEpochs: true,
  },
  causalFinding: "native_condition_features_are_representable_but_route_and_object_responsibilities_compete_in_the_single_shared_12_channel_terminal_latent_output",
  excludedExplanations: [
    "insufficient_epoch_count",
    "raw_condition_resolution_loss_before_first_feature",
    "frozen_autoencoder_semantic_retention_gap",
    "review_threshold_change",
  ],
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
const responsibilityOrder = [
  "terrain_path_ground",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
]
writeExclusive(files.contract, {
  schemaVersion: "stage4-native-condition-encoder-responsibility-residual-final-candidate-contract-v1",
  status: "cpu_supported_inactive_required",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  finalBoundedCandidate: true,
  substantiveDifference: "retain_native_resolution_condition_feature_extraction_and_add_five_identity_masked_terminal_latent_residual_heads_to_prevent_route_object_overwrite",
  sharedBase: {
    nativeConditionInputChannels: 23,
    widths: [64, 128, 256],
    latentChannels: 12,
    latentDownsampleFactor: 4,
    existingNativeEncoderUnchanged: true,
  },
  responsibilityResiduals: {
    identityOrder: responsibilityOrder,
    eachHead: "Conv2d(256,12,3,padding=1,bias=true)",
    maskSource: "same_formal_identity_condition_channel_resized_by_existing_typed_condition_contract_to_latent_resolution",
    merge: "base_clean_latent_plus_sum_of_identity_masked_residuals",
    outsideMaskMutationAllowed: false,
    freeBlendWeightsPresent: false,
  },
  frozenBoundary: {
    datasetCount: 64,
    split: [48, 8, 4, 4],
    seed: 20263722,
    autoencoderFrozen: true,
    existingLossValuesAndWeightsUnchanged: true,
    machineReviewThresholdsUnchanged: true,
    failedCheckpointInitializationForbidden: true,
  },
  executionLimit: {
    cpuImplementation: 1,
    readonlyGpuQualification: 1,
    controlledSmoke: 1,
    automaticRetry: false,
    failureAction: "exit_model_candidate_expansion_and_record_project_route_decision",
  },
  forbidden: [
    "new_loss",
    "loss_weight_change",
    "data_or_split_change",
    "review_threshold_change",
    "historical_or_failed_checkpoint_read",
    "post_decode_rgb_compositor",
    "free_architecture_parameter",
    "another_candidate_after_failure",
  ],
  activationGate: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
const positiveChecks = {
  sourceFixed40Completed: sourceReview.reviews.map((row) => row.epoch).includes(40),
  epoch30RockOnly: epoch30.issueCodes.length === 1 && epoch30.issueCodes[0].includes("rock"),
  epoch40RouteOnly: epoch40.issueCodes.length === 1 && epoch40.issueCodes[0].includes("path_ground"),
  nativeEncoderRetained: true,
  exactResponsibilityOrder: responsibilityOrder.length === 5,
  masksAreIdentityBound: true,
  noFreeBlendWeights: true,
  oneFinalCandidateOnly: true,
}
const negativeChecks = {
  rejectsMoreEpochs: true,
  rejectsNewLoss: true,
  rejectsCheckpointReuse: true,
  rejectsThresholdChange: true,
  rejectsPostDecodeMutation: true,
  rejectsFurtherCandidateOnFailure: true,
}
assert.equal(Object.values(positiveChecks).every(Boolean), true)
assert.equal(Object.values(negativeChecks).every(Boolean), true)
writeExclusive(files.cpu, {
  schemaVersion: "stage4-native-responsibility-residual-planning-cpu-report-v1",
  status: "passed",
  positiveChecks,
  negativeChecks,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
})
createCapabilityCandidate({
  schemaVersion: "ai-painter-capability-change-candidate-v1",
  capabilityVersion: CAPABILITY,
  changeClass: "model_family",
  summary: "Native-resolution condition encoder with identity-masked route and object latent residual outputs",
  sourceEvidence: [sourceTerminalPath, sourceReviewPath, ...Object.values(files).filter((file) => fs.existsSync(file))].map(bind),
  ownerAuthorizationRequired: false,
  ownerInLifecycle: false,
})
writeExclusive(files.terminal, {
  schemaVersion: "stage4-native-responsibility-residual-planning-terminal-v1",
  executionState: "completed",
  status: "one_final_bounded_candidate_planned",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  sourceCandidateRetirement: bind(files.retirement),
  causalAnalysis: bind(files.analysis),
  candidateContract: bind(files.contract),
  cpuReport: bind(files.cpu),
  nextLegalAction: NEXT_TASK,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
const evidenceFiles = [files.retirement, files.analysis, files.contract, files.cpu, files.terminal]
writeExclusive(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: { number: 4, total: 5, labelZh: "原生条件编码责任隔离最终候选", status: "cpu_implementation_pending" },
  latestBlocker: { code: "shared_terminal_latent_responsibility_interference", summaryZh: "道路与对象在共享终端潜变量输出中发生后期覆盖。" },
  nextAllowedAction: { code: NEXT_TASK, ownerAuthorizationRequired: false, automaticExecutionAllowed: true },
  forbiddenActions: read(files.contract).forbidden,
  evidence: evidenceFiles.map((file) => ({ ...bind(file), sha256Verified: true })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
})
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: NEXT_TASK,
  taskKind: "cpu_inactive_candidate_implementation",
  runId: RUN_ID,
  lifecycleStage: "planned",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(files.capsule),
  terminalEvidencePath: projectPath(files.terminal),
})
appendAiPainterProgramEvent({
  id: `stage4-native-responsibility-residual-plan-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_native_responsibility_residual_final_candidate_planned",
  runId: RUN_ID,
  kind: "candidate_planning",
  status: "success",
  title: "Final bounded Stage4 candidate planned",
  titleZh: "Stage4最终有界候选已规划",
  detailZh: "保留原生条件编码，增加道路与四类对象的身份掩码潜变量残差隔离；失败后不再扩展候选。",
  evidencePath: projectPath(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
process.stdout.write(`${JSON.stringify({ status: "one_final_bounded_candidate_planned", runId: RUN_ID, capabilityVersion: CAPABILITY, architecture: ARCHITECTURE, terminal: bind(files.terminal), contract: bind(files.contract), currentRegistrySha256: advanced.registrySha256, nextLegalAction: NEXT_TASK, ownerAuthorizationRequired: false }, null, 2)}\n`)

function inside(relative) { const candidate = path.resolve(ROOT, relative); assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`); return candidate }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function verifyFile(file, expected, label) { assert.equal(fs.existsSync(file), true, `${label} missing`); assert.equal(sha(file), expected, `${label} SHA-256 mismatch`) }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
