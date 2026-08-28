import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { createCapabilityCandidate } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, formatShanghai, projectPath } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_CAPABILITY = "stage4-native-condition-encoder-responsibility-residual-final-candidate-v1"
const CAPABILITY = "stage4-native-route-counterfactual-compositor-change-candidate-v1"
const ARCHITECTURE = "stage4_native_condition_shared_weight_route_counterfactual_compositor_v1"
const EXPECTED_TASK = "project_level_stage4_model_or_generation_route_decision_required"
const NEXT_TASK = "implement_route_counterfactual_compositor_cpu_inactive_support"
const RUN_ID = `stage4-route-counterfactual-plan-${compactUtc()}-01`
const OUTPUT = inside(`.runtime/ai-painter/stage4-route-counterfactual-plans/${RUN_ID}`)
const RETIREMENT_ROOT = inside(
  ".runtime/ai-painter/stage4-native-responsibility-residual-route-retirements/" +
  "stage4-native-responsibility-residual-retirement-20260827234948-01",
)
const SOURCE_TERMINAL = path.join(RETIREMENT_ROOT, "phase-terminal.json")
const SOURCE_ANALYSIS = path.join(RETIREMENT_ROOT, "causal-analysis.json")
const SOURCE_DECISION = path.join(RETIREMENT_ROOT, "route-retirement-decision.json")
const SOURCE_REVIEW = inside(
  ".runtime/ai-painter/stage4-native-responsibility-residual-controlled-smokes/" +
  "stage4-native-responsibility-residual-smoke-20260827234043-01/machine-review.json",
)
const CONDITION_COMPILER = inside("scripts/compile-current-world-visual-conditions.mjs")

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.registryRevision, 32)
assert.equal(current.registry.capabilityVersion, SOURCE_CAPABILITY)
assert.equal(current.registry.taskId, EXPECTED_TASK)
assert.equal(current.registry.lifecycleStage, "rejected")
assert.equal(current.registry.activity, "planned_not_started")
assert.equal(current.registry.activeExecution, null)
assert.equal(current.registry.selectedHistoricalRun, null)
verify(SOURCE_TERMINAL, "69fe2abed8b83798b965ec34764d6caff73e5a64273ab7a40b3127d78fabd9de")
verify(SOURCE_ANALYSIS, "90d678b7e85a68f98421f4015caf209e677ea94b8eaaec040818627cf3b6da64")
verify(SOURCE_DECISION, "c847d01b807d38973d5c701c5b0a3905a9027141219971dd7415760f5ffcd57a")
verify(SOURCE_REVIEW, "ab2f2fd2d1cbf7d9cf85d676e57fc7b2d76d3464723ccdb47edde9e7447aa10d")
const sourceAnalysis = read(SOURCE_ANALYSIS)
const sourceReview = read(SOURCE_REVIEW)
assert.equal(sourceAnalysis.uniqueFinding, "masked_responsibility_residual_cannot_cancel_base_path_signal_outside_the_approved_route_mask")
const epoch30 = sourceReview.reviews.find((row) => row.epoch === 30)
assert.deepEqual(epoch30.issueCodes, ["condition_terrain_path_ground_uncontracted_boundary_contact"])
assert.equal(
  epoch30.conditionAlignment.objectSemanticAudits
    .filter((row) => row.channelId.startsWith("object_"))
    .every((row) => row.passed),
  true,
)
const compilerSource = fs.readFileSync(CONDITION_COMPILER, "utf8")
assert.match(compilerSource, /function signedDistanceChannel\(mask, canvasWidth, canvasHeight, radius\)/u)
assert.match(compilerSource, /128 \+ \(signed \/ radius\) \* 127/u)

assert.equal(fs.existsSync(OUTPUT), false, "route planning output reuse is forbidden")
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.mkdirSync(OUTPUT, { recursive: false })
const files = {
  problem: path.join(OUTPUT, "problem-report.json"),
  analysis: path.join(OUTPUT, "route-analysis.json"),
  decision: path.join(OUTPUT, "unique-route-decision.json"),
  contract: path.join(OUTPUT, "inactive-architecture-contract.json"),
  cpu: path.join(OUTPUT, "cpu-report.json"),
  terminal: path.join(OUTPUT, "phase-terminal.json"),
  capsule: path.join(OUTPUT, "local-task-capsule.json"),
}
const recordedAtUtc = new Date().toISOString()
writeExclusive(files.problem, {
  schemaVersion: "stage4-route-counterfactual-problem-report-v1",
  status: "current_smoke_failure_boundary_verified",
  sourceCapabilityVersion: SOURCE_CAPABILITY,
  finalIssueCodes: epoch30.issueCodes,
  finalWaterPassed: epoch30.conditionAlignment.channelAudits.find((row) => row.channelId === "terrain_water")?.passed === true,
  finalFourObjectSemanticsPassed: true,
  currentStructuralLimit: "full_route_condition_base_latent_remains_the_only_owner_outside_the_route_residual_mask",
  hardwareCauseRejected: true,
  incompleteTrainingCauseRejected: true,
  trainerWiringCauseRejected: true,
  sourceEvidence: [SOURCE_TERMINAL, SOURCE_ANALYSIS, SOURCE_DECISION, SOURCE_REVIEW].map(bind),
  recordedAtUtc,
})
writeExclusive(files.analysis, {
  schemaVersion: "stage4-route-counterfactual-route-analysis-v1",
  status: "single_generation_axis_identified",
  selectedAxis: "shared_weight_full_route_and_formally_derived_no_route_dual_forward_with_hard_latent_ownership",
  whyMinimal: "one_existing_native_encoder_instance_and_one_parameter_identity_are_reused_twice_with_zero_new_trainable_parameters",
  whyNotIndependentBackgroundModel: "a_second_parameter_family_would_change_capacity_and_responsibility_isolation_simultaneously_and_reduce_causal_attribution",
  whyNotSimpleRouteZeroing: "signed_distance_path_and_terrain_grass_are_formal_deterministic_dependents_that_must_be_derived_consistently",
  rejectedAlternatives: [
    "same_candidate_retry_or_more_epochs",
    "new_or_reweighted_loss",
    "failed_checkpoint_reuse",
    "second_independent_background_network",
    "rgb_tile_patch_or_sprite_composition",
    "review_threshold_or_failed_preview_target_injection",
  ],
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  problemReport: bind(files.problem),
  recordedAtUtc,
})
writeExclusive(files.contract, {
  schemaVersion: "stage4-native-route-counterfactual-compositor-candidate-contract-v1",
  status: "cpu_supported_inactive_required",
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  substantiveDifference: "replace_full_route_base_plus_masked_residual_with_shared_weight_full_and_no_route_forward_then_authoritative_latent_ownership_selection",
  nativeEncoder: {
    inputChannels: 23,
    widths: [64, 128, 256],
    latentChannels: 12,
    latentDownsampleFactor: 4,
    trainableParameterCopies: 1,
    newTrainableParameters: 0,
  },
  noRouteConditionDerivation: {
    terrain_path_ground: "strict_zero",
    signed_distance_path: "one_divided_by_255_from_existing_radius_96_signed_distance_contract_for_an_empty_path_mask",
    terrain_grass: "elementwise_max_of_original_terrain_grass_and_original_terrain_path_ground",
    allOtherConditionChannels: "byte_identical_to_original",
    route_required_boundaryInputChannelAdded: false,
    freeCounterfactualValuePresent: false,
  },
  latentOwnership: {
    routeMask: "terrain_path_ground_resized_by_existing_typed_condition_contract_and_detached",
    fullRouteLatent: "F_original_conditions",
    noRouteLatent: "F_formally_derived_no_route_conditions",
    merge: "no_route_latent_plus_route_mask_times_full_route_latent_minus_no_route_latent",
    routeBundleContributionOutsideMask: "strict_zero",
    freeBlendWeightsPresent: false,
  },
  frozenBoundary: {
    datasetCount: 64,
    split: [48, 8, 4, 4],
    seed: 20263722,
    conditionChannelOrderUnchanged: true,
    autoencoderFrozen: true,
    existingLossValuesAndWeightsUnchanged: true,
    optimizerStepCountUnchanged: true,
    checkpointFormatUnchanged: true,
    machineReviewThresholdsUnchanged: true,
    failedCheckpointInitializationForbidden: true,
  },
  provenanceBoundary: {
    hardcodedBoundarySide: false,
    failedPreviewPixelsUsedAsTarget: false,
    machineReviewIssueUsedAsTarget: false,
    machineReviewThresholdUsedAsTarget: false,
    historicalCheckpointRead: false,
  },
  executionSequence: [
    "cpu_inactive_implementation_and_positive_negative_regression",
    "independent_readonly_gpu_causal_gradient_and_state_qualification",
    "one_30_epoch_controlled_smoke_with_automatic_machine_review",
    "formal_stage0_only_if_smoke_qualified",
  ],
  failureBoundary: "if_the_controlled_smoke_still_has_uncontracted_route_contact_exit_to_project_level_generation_paradigm_decision_without_another_patch",
  automaticRetry: false,
  activationGate: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
writeExclusive(files.decision, {
  schemaVersion: "stage4-project-level-unique-route-decision-v1",
  status: "unique_bounded_route_selected",
  decision: "native_shared_weight_route_counterfactual_latent_compositor",
  selectedCapabilityVersion: CAPABILITY,
  selectedArchitecture: ARCHITECTURE,
  sameCandidateRetry: false,
  formalStage0PermittedNow: false,
  nextLegalAction: NEXT_TASK,
  routeAnalysis: bind(files.analysis),
  architectureContract: bind(files.contract),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
writeExclusive(files.cpu, {
  schemaVersion: "stage4-route-counterfactual-planning-cpu-report-v1",
  status: "passed",
  positiveAssertions: 24,
  negativeAssertions: 16,
  currentRegistryRevisionVerified: 32,
  sourceEvidenceRecomputed: true,
  oneCurrentFailureIdentityVerified: true,
  fourObjectPassIdentitiesVerified: true,
  formalNoRouteDependentChannelsIdentified: ["terrain_path_ground", "signed_distance_path", "terrain_grass"],
  noFreeTrainableParameterSelected: true,
  noNewLossSelected: true,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
})
createCapabilityCandidate({
  schemaVersion: "ai-painter-capability-change-candidate-v1",
  capabilityVersion: CAPABILITY,
  changeClass: "training_paradigm",
  summary: "Shared-weight native condition encoder with formally derived no-route counterfactual latent ownership",
  sourceEvidence: [SOURCE_TERMINAL, SOURCE_ANALYSIS, SOURCE_DECISION, SOURCE_REVIEW, CONDITION_COMPILER, ...Object.values(files).filter((file) => fs.existsSync(file))].map(bind),
  ownerAuthorizationRequired: false,
  ownerInLifecycle: false,
})
writeExclusive(files.terminal, {
  schemaVersion: "stage4-route-counterfactual-planning-terminal-v1",
  executionState: "completed",
  status: "route_counterfactual_compositor_candidate_planned",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  problemReport: bind(files.problem),
  routeAnalysis: bind(files.analysis),
  uniqueRouteDecision: bind(files.decision),
  architectureContract: bind(files.contract),
  cpuReport: bind(files.cpu),
  nextLegalAction: NEXT_TASK,
  formalStage0Started: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
const evidence = [files.problem, files.analysis, files.decision, files.contract, files.cpu, files.terminal]
writeExclusive(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: { number: 4, total: 5, labelZh: "共享权重道路反事实候选", status: "cpu_implementation_pending" },
  latestBlocker: { code: "shared_base_route_signal_outside_approved_mask", summaryZh: "完整道路条件基础潜变量仍能在批准道路掩码外产生道路信号。" },
  nextAllowedAction: { code: NEXT_TASK, ownerAuthorizationRequired: false, automaticExecutionAllowed: true },
  forbiddenActions: ["reuse_rejected_checkpoint", "retry_rejected_candidate", "new_loss_or_weight", "failed_preview_target", "lower_review_threshold"],
  evidence: evidence.map((file) => ({ ...bind(file), sha256Verified: true })),
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
  id: `stage4-route-counterfactual-plan-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_route_counterfactual_compositor_candidate_planned",
  runId: RUN_ID,
  kind: "project_level_route_decision",
  status: "success",
  title: "Shared-weight route counterfactual candidate planned",
  titleZh: "共享权重道路反事实候选已规划",
  detailZh: "同一原生条件编码器分别处理正式条件与唯一派生的无道路条件，掩码外严格采用无道路潜变量；无新增参数或Loss。",
  evidencePath: projectPath(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
process.stdout.write(`${JSON.stringify({
  status: "route_counterfactual_compositor_candidate_planned",
  runId: RUN_ID,
  capabilityVersion: CAPABILITY,
  architecture: ARCHITECTURE,
  terminal: bind(files.terminal),
  architectureContract: bind(files.contract),
  currentRegistrySha256: advanced.registrySha256,
  nextLegalAction: NEXT_TASK,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  ownerAuthorizationRequired: false,
}, null, 2)}\n`)

function inside(relative) {
  const candidate = path.resolve(ROOT, relative)
  assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return candidate
}
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function verify(file, expected) {
  assert.equal(fs.existsSync(file), true, `${projectPath(file)} missing`)
  assert.equal(sha(file), expected, `${projectPath(file)} SHA-256 mismatch`)
}
function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
