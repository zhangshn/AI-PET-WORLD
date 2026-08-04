import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const args = parseArgs(process.argv.slice(2))
const IS_REPAIR_R1 = args.profile === "v7-repair-r1"
const REPAIR_R1_PENDING_REQUEST_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-repair-r1-strict-revalidation-2026-08-03t04-12-49-525z/request.json"
const REPAIR_R1_PENDING_REQUEST_SHA256 = "2e4a648ceb28732568330757000437b2f24e5a57466546491546a5de61e74945"
const REPAIR_R1_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-repair-r1-strict-revalidation-after-directory-fix-resolution-20260803/request.json"
const REPAIR_R1_AUTHORIZATION_SCOPE = "v7_repair_r1_strict_challenge_multiseed_revalidation_only"
const REPAIR_R1_FINALIZATION_SHA256 = "bede1821fff7ac3b6cbdf5bd475f669997bcc2edd3a5c84915704873446fed68"
const CONFIG_PATH = IS_REPAIR_R1
  ? ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r1/derived-configs/ai-assisted-v7-repair-r1-full-training-2026-08-03T04-12-49-525Z.json"
  : "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"
const CHECKPOINT_POINTER = IS_REPAIR_R1
  ? ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r1/ai-assisted-v7-repair-r1-stage-2-2026-08-03T04-12-49-525Z/manifest.json"
  : ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7/latest.json"
const AUTHORIZATION_PATH = IS_REPAIR_R1
  ? REPAIR_R1_AUTHORIZATION_PATH
  : ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-post-training-validation-resolution-20260802/request.json"
const SINGLE_RUNNER = "scripts/run-ai-assisted-conditional-inference-validation.mjs"
const BATCH_RUNNER = "scripts/run-ai-assisted-v7-post-training-validation.mjs"
const SINGLE_RUN_LATEST = IS_REPAIR_R1
  ? ".runtime/ai-painter/ai-assisted-v7-repair-r1-strict-revalidation-trajectories/latest.json"
  : ".runtime/ai-painter/ai-assisted-conditional-inference-validation/latest.json"
const OUTPUT_ROOT = IS_REPAIR_R1
  ? ".runtime/ai-painter/v7-repair-r1-strict-revalidations"
  : ".runtime/ai-painter/v7-post-training-validations"
const EXPECTED_CHECKPOINT_SHA256 = IS_REPAIR_R1
  ? "572c59f75d55419f7e59bc57546891abfd47665eaa29598ee7acc64516e5164b"
  : "5a105a8143112f0d2fe19cb90f250b9fb204530d5ed07ba06a60fdbdfbcd23a5"
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const config = readJson(CONFIG_PATH)
const checkpoint = readJson(CHECKPOINT_POINTER)
const pendingRequest = IS_REPAIR_R1 ? readJson(REPAIR_R1_PENDING_REQUEST_PATH) : null
const trainingFinalization = IS_REPAIR_R1 ? readJson(pendingRequest.taskIdentity.trainingFinalizationPath) : null
const authorization = fs.existsSync(path.resolve(ROOT, AUTHORIZATION_PATH)) ? readJson(AUTHORIZATION_PATH) : null
const sourceIndex = readJson(checkpoint.sourceIndexPath)
const eligibleRows = sourceIndex.samples.filter(isCurrentV7CapacityRow)
const splitCounts = Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, eligibleRows.filter((row) => row.split === split).length]))
const heldOutSplit = config.training.strictHeldOutInferenceSplit
const challengeRows = eligibleRows.filter((row) => row.split === heldOutSplit).sort((left, right) => left.conditionLabel.localeCompare(right.conditionLabel))
const challengeConditionPacks = challengeRows.map((row) => ({ row, pack: readJson(row.conditionPackPath) }))
const seedsPerSample = Number(config.training.checkpointRolloutSeedsPerSample)
const blockers = []

if (IS_REPAIR_R1) {
  if (!fileHashMatches(REPAIR_R1_PENDING_REQUEST_PATH, REPAIR_R1_PENDING_REQUEST_SHA256)) blockers.push("v7_repair_r1_pending_request_hash_invalid")
  if (pendingRequest.status !== "waiting_owner_authorization" || pendingRequest.resolution?.revalidationAuthorized !== false) blockers.push("v7_repair_r1_pending_request_invalid")
  if (!fileHashMatches(pendingRequest.taskIdentity.trainingFinalizationPath, REPAIR_R1_FINALIZATION_SHA256)) blockers.push("v7_repair_r1_training_finalization_hash_invalid")
  if (trainingFinalization.status !== "full_stage0_stage1_stage2_training_completed_pending_strict_revalidation") blockers.push("v7_repair_r1_training_not_completed_pending_revalidation")
  if (trainingFinalization.derivedConfigPath !== CONFIG_PATH || !fileHashMatches(CONFIG_PATH, trainingFinalization.derivedConfigSha256)) blockers.push("v7_repair_r1_derived_config_identity_invalid")
  if (pendingRequest.taskIdentity.stage2CheckpointPath !== checkpoint.checkpointPath || pendingRequest.taskIdentity.stage2CheckpointSha256 !== checkpoint.checkpointSha256) blockers.push("v7_repair_r1_checkpoint_request_identity_mismatch")
  if (!args.preflightOnly) {
    if (!authorization || !args.authorizationSha256) blockers.push("v7_repair_r1_strict_revalidation_authorization_missing")
    if (authorization && !fileHashMatches(AUTHORIZATION_PATH, args.authorizationSha256)) blockers.push("v7_repair_r1_strict_revalidation_authorization_hash_invalid")
    if (args.ownerCommandRef !== authorization?.ownerDecision?.commandRef) blockers.push("v7_repair_r1_strict_revalidation_owner_command_ref_mismatch")
    if (authorization?.status !== "resolved_owner_authorized" || authorization?.resolution?.revalidationAuthorized !== true) blockers.push("v7_repair_r1_strict_revalidation_not_authorized")
    if (authorization?.ownerDecision?.scope !== REPAIR_R1_AUTHORIZATION_SCOPE) blockers.push("v7_repair_r1_strict_revalidation_scope_invalid")
    if (authorization?.taskIdentity?.stage2CheckpointSha256 !== EXPECTED_CHECKPOINT_SHA256) blockers.push("v7_repair_r1_strict_revalidation_authorization_target_mismatch")
    if (!fileHashMatches(SINGLE_RUNNER, authorization?.taskIdentity?.singleTrajectoryRunnerSha256)) blockers.push("v7_repair_r1_single_trajectory_runner_hash_mismatch")
    if (!fileHashMatches(BATCH_RUNNER, authorization?.taskIdentity?.batchRunnerSha256)) blockers.push("v7_repair_r1_batch_runner_hash_mismatch")
    if (authorization?.resolution?.formalInferenceAuthorized !== false || authorization?.resolution?.runtimeFrameAuthorized !== false || authorization?.resolution?.worldEntryAuthorized !== false) blockers.push("v7_repair_r1_strict_revalidation_authorization_improperly_expands_scope")
  }
} else {
  if (args.ownerCommandRef !== authorization?.ownerDecision?.commandRef) blockers.push("v7_post_training_validation_owner_command_ref_mismatch")
  if (authorization?.status !== "owner_authorized_pending_execution" || authorization?.resolution?.postTrainingValidationAuthorized !== true) blockers.push("v7_post_training_validation_not_authorized")
  if (authorization?.resolution?.formalInferenceAuthorized !== false) blockers.push("v7_post_training_validation_authorization_improperly_opens_formal_inference")
}
if (checkpoint.status !== "conditional_denoiser_training_completed_pending_validation") blockers.push("v7_stage2_checkpoint_not_pending_validation")
if (checkpoint.checkpointSha256 !== EXPECTED_CHECKPOINT_SHA256 || sha256File(checkpoint.checkpointPath) !== EXPECTED_CHECKPOINT_SHA256) blockers.push("v7_stage2_checkpoint_hash_mismatch")
if (checkpoint.actualLoadedV7CapacityCount !== 64 || eligibleRows.length !== 64) blockers.push("v7_post_training_validation_capacity_not_64")
if (JSON.stringify(splitCounts) !== JSON.stringify(EXPECTED_SPLITS)) blockers.push("v7_post_training_validation_split_not_48_8_4_4")
if (heldOutSplit !== "challenge" || challengeRows.length !== 4) blockers.push("v7_post_training_validation_challenge_contract_invalid")
if (seedsPerSample !== 2) blockers.push("v7_post_training_validation_seed_count_not_2")
if (challengeRows.some((row) => row.currentConditionIdentityMatches === true)) blockers.push("v7_post_training_validation_legacy_identity_leak")
if (challengeConditionPacks.some(({ pack }) => !isV7CompleteNaturalRegionConditionPack(pack))) blockers.push("v7_post_training_validation_condition_contract_invalid")
if (blockers.length) failPreflight(blockers)

const plannedTrajectories = challengeRows.flatMap((row) => Array.from({ length: seedsPerSample }, (_, seedIndex) => ({
  recordId: row.recordId,
  capacitySlotId: row.capacitySlotId,
  conditionLabel: row.conditionLabel,
  split: row.split,
  seedIndex,
  seed: deterministicSeed(row.conditionLabel, seedIndex),
})))

const trajectoryPreflights = plannedTrajectories.map((planned) => runSingleTrajectoryPreflight(planned))
if (trajectoryPreflights.some((item) => item.exitCode !== 0)) {
  failPreflight(["v7_post_training_validation_single_trajectory_preflight_failed"], { trajectoryPreflights })
}

if (args.preflightOnly) {
  console.log(JSON.stringify({
    ok: true,
    status: IS_REPAIR_R1
      ? "v7_repair_r1_strict_revalidation_read_only_preflight_passed_waiting_owner_authorization"
      : "v7_post_training_validation_preflight_passed",
    validationProfile: args.profile,
    checkpointSha256: checkpoint.checkpointSha256,
    actualLoadedV7CapacityCount: eligibleRows.length,
    splitCounts,
    heldOutSplit,
    challengeRecordCount: challengeRows.length,
    seedsPerSample,
    plannedTrajectoryCount: plannedTrajectories.length,
    plannedTrajectories,
    trajectoryPreflights,
    authorizationReady: IS_REPAIR_R1 ? Boolean(authorization) : true,
    authorizationConsumed: false,
    outputWritten: false,
    formalInferenceAuthorized: false,
  }, null, 2))
  process.exit(0)
}

const previousCompletedReport = readLatestCompletedReport()
if (previousCompletedReport?.ownerCommandRef === args.ownerCommandRef
  && previousCompletedReport?.checkpointSha256 === checkpoint.checkpointSha256) {
  failPreflight(["v7_post_training_validation_authorization_already_consumed"])
}
const releaseValidationLock = acquireValidationLock()
process.on("exit", releaseValidationLock)
const authorizationConsumption = consumeValidationAuthorization()
const authorizationConsumptionSha256 = sha256File(authorizationConsumption.path)

const createdAtUtc = new Date().toISOString()
const batchId = `${IS_REPAIR_R1 ? "ai-assisted-v7-repair-r1-strict-revalidation" : "ai-assisted-v7-post-training-validation"}-${createdAtUtc.replace(/[:.]/g, "-")}`
appendAiPainterProgramEvent({
  action: "run_ai_assisted_v7_post_training_validation",
  runId: batchId,
  kind: "post_training_validation_started",
  status: "running",
  title: "V7 strict held-out post-training validation started",
  titleZh: "V7严格未见集训练后验证已开始",
  detail: `challengeRecords=${challengeRows.length}; seedsPerSample=${seedsPerSample}; trajectories=${plannedTrajectories.length}`,
  detailZh: `challenge记录=${challengeRows.length}；每记录种子=${seedsPerSample}；轨迹=${plannedTrajectories.length}`,
  script: SINGLE_RUNNER,
  currentStep: "strict_held_out_challenge_validation",
  evidencePath: AUTHORIZATION_PATH,
  nextAction: "run_all_authorized_challenge_trajectories_without_retry",
  nextActionZh: "执行全部已授权challenge轨迹且不自动重试",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

const trajectories = []
for (const planned of plannedTrajectories) {
  const startedAtMs = Date.now()
  const child = spawnSync(process.execPath, [
    SINGLE_RUNNER,
    "--model-version", IS_REPAIR_R1 ? "v7-repair-r1" : "v7",
    "--condition-label", planned.conditionLabel,
    "--seed", String(planned.seed),
    "--owner-command-ref", args.ownerCommandRef,
    ...(IS_REPAIR_R1 ? [
      "--parent-batch-consumption", authorizationConsumption.path,
      "--parent-batch-consumption-sha256", authorizationConsumptionSha256,
    ] : []),
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  })
  if (child.status !== 0) {
    trajectories.push({
      ...planned,
      status: "execution_failed",
      durationMs: Date.now() - startedAtMs,
      exitCode: child.status,
      signal: child.signal,
      stdout: child.stdout ?? "",
      stderr: child.stderr ?? "",
    })
    break
  }
  const latest = readJson(SINGLE_RUN_LATEST)
  if (latest.conditionLabel !== planned.conditionLabel || latest.seed !== planned.seed || latest.ownerCommandRef !== args.ownerCommandRef) {
    trajectories.push({ ...planned, status: "evidence_identity_mismatch", durationMs: Date.now() - startedAtMs })
    break
  }
  trajectories.push({
    ...planned,
    status: latest.status,
    durationMs: Date.now() - startedAtMs,
    runId: latest.runId,
    manifestPath: latest.manifestPath,
    outputImagePath: latest.outputImagePath,
    outputImageSha256: latest.outputImageSha256,
    machineReviewPath: latest.machineReviewPath,
    machineReviewSha256: latest.machineReviewSha256,
    machineReviewIssueCodes: latest.machineReviewIssueCodes ?? [],
    validationTokenAccounting: latest.validationTokenAccounting ?? null,
  })
}

const executionFailed = trajectories.length !== plannedTrajectories.length || trajectories.some((row) => row.status === "execution_failed" || row.status === "evidence_identity_mismatch")
const machineRejected = trajectories.filter((row) => row.status === "machine_rejected")
const duplicateHashes = duplicateValues(trajectories.map((row) => row.outputImageSha256).filter(Boolean))
const allMachinePassed = !executionFailed && machineRejected.length === 0 && duplicateHashes.length === 0
const status = executionFailed
  ? "post_training_validation_execution_failed"
  : allMachinePassed
    ? "machine_passed_waiting_owner_validation_review"
    : "post_training_validation_completed_with_machine_failures"
const tokenTotals = sumTokenAccounting(trajectories)
const completedAtUtc = new Date().toISOString()
const report = {
  schemaVersion: "ai-assisted-v7-post-training-validation-report-v1",
  validationProfile: args.profile,
  batchId,
  status,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  completedAtUtc,
  completedAtAsiaShanghai: formatShanghai(completedAtUtc),
  ownerCommandRef: args.ownerCommandRef,
  authorizationPath: AUTHORIZATION_PATH,
  authorizationSha256: sha256File(AUTHORIZATION_PATH),
  authorizationConsumption,
  authorizationConsumptionSha256,
  modelId: checkpoint.modelId,
  checkpointRunId: checkpoint.runId,
  checkpointPath: checkpoint.checkpointPath,
  checkpointSha256: checkpoint.checkpointSha256,
  datasetPackageId: checkpoint.datasetPackageId,
  datasetManifestPath: checkpoint.datasetManifestPath,
  datasetManifestSha256: checkpoint.datasetManifestSha256,
  actualLoadedV7CapacityCount: eligibleRows.length,
  splitCounts,
  strictHeldOutSplit: heldOutSplit,
  challengeRecordCount: challengeRows.length,
  seedsPerSample,
  plannedTrajectoryCount: plannedTrajectories.length,
  completedTrajectoryCount: trajectories.length,
  machinePassedCount: trajectories.filter((row) => row.status === "machine_passed_waiting_owner_review").length,
  machineRejectedCount: machineRejected.length,
  duplicateOutputHashes: duplicateHashes,
  validationTokenAccounting: {
    schemaVersion: "ai-assisted-local-validation-batch-token-accounting-v1",
    localValidationTokenUnit: "one_latent_spatial_position_processed_by_one_denoiser_sample_forward_pass",
    isNlpToken: false,
    tokenizerUsed: false,
    ...tokenTotals,
    externalApiTokens: 0,
  },
  trajectories,
  issueCodes: [
    ...new Set([
      ...trajectories.flatMap((row) => row.machineReviewIssueCodes ?? []),
      ...(duplicateHashes.length ? ["v7_post_training_validation_output_hash_duplicate"] : []),
      ...(executionFailed ? ["v7_post_training_validation_trajectory_execution_failed"] : []),
    ]),
  ],
  trainingWeightsModified: false,
  automaticRetryCount: 0,
  formalCandidate: false,
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  nextOwnerActionZh: allMachinePassed
    ? "项目所有者查看8张验证图和聚合证据；即使全部通过，正式推理仍须另行授权。"
    : "项目所有者查看机器失败、重复或执行失败证据；未经新授权不得重试、修复训练或启动正式推理。",
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: batchId,
  fileName: "validation-report.json",
  record: report,
  latest: {
    batchId,
    checkpointSha256: checkpoint.checkpointSha256,
    plannedTrajectoryCount: plannedTrajectories.length,
    completedTrajectoryCount: trajectories.length,
    machinePassedCount: report.machinePassedCount,
    machineRejectedCount: report.machineRejectedCount,
    formalInferenceEligible: false,
  },
})
const ownerActionRequest = recordAiPainterOwnerActionRequest(
  buildAutomaticOwnerActionRequest(report, stored.runPath),
  {
    root: ROOT,
    sourceEvidencePath: stored.runPath,
    script: "scripts/run-ai-assisted-v7-post-training-validation.mjs",
  },
)
appendAiPainterProgramEvent({
  action: "run_ai_assisted_v7_post_training_validation",
  runId: batchId,
  kind: "post_training_validation_completed",
  status: allMachinePassed ? "success" : "failed",
  title: "V7 strict held-out post-training validation completed",
  titleZh: "V7严格未见集训练后验证已完成",
  detail: `status=${status}; passed=${report.machinePassedCount}; rejected=${report.machineRejectedCount}; duplicateHashes=${duplicateHashes.length}`,
  detailZh: `状态=${status}；机器通过=${report.machinePassedCount}；机器拒绝=${report.machineRejectedCount}；重复哈希=${duplicateHashes.length}`,
  script: "scripts/run-ai-assisted-v7-post-training-validation.mjs",
  currentStep: "waiting_owner_validation_review",
  evidencePath: stored.runPath,
  nextAction: "wait_for_owner_review_and_separate_formal_inference_authorization",
  nextActionZh: report.nextOwnerActionZh,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})
console.log(JSON.stringify({
  ok: !executionFailed,
  status,
  batchId,
  reportPath: stored.runPath,
  reportSha256: sha256File(stored.runPath),
  plannedTrajectoryCount: report.plannedTrajectoryCount,
  completedTrajectoryCount: report.completedTrajectoryCount,
  machinePassedCount: report.machinePassedCount,
  machineRejectedCount: report.machineRejectedCount,
  duplicateOutputHashes: duplicateHashes,
  validationTokenAccounting: report.validationTokenAccounting,
  issueCodes: report.issueCodes,
  ownerActionRequest,
  formalInferenceEligible: false,
}, null, 2))
releaseValidationLock()
if (executionFailed) process.exit(1)

function parseArgs(values) {
  const read = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : null }
  const profile = read("--profile") ?? "v7-legacy"
  if (!new Set(["v7-legacy", "v7-repair-r1"]).has(profile)) throw new Error("--profile must be v7-legacy or v7-repair-r1")
  return {
    ownerCommandRef: read("--owner-command-ref"),
    authorizationSha256: read("--authorization-sha256"),
    preflightOnly: values.includes("--preflight-only"),
    profile,
  }
}

function runSingleTrajectoryPreflight(planned) {
  const child = spawnSync(process.execPath, [
    SINGLE_RUNNER,
    "--model-version", IS_REPAIR_R1 ? "v7-repair-r1" : "v7",
    "--condition-label", planned.conditionLabel,
    "--seed", String(planned.seed),
    "--owner-command-ref", args.ownerCommandRef ?? "read-only-validation-preflight",
    "--preflight-only",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  })
  return {
    recordId: planned.recordId,
    conditionLabel: planned.conditionLabel,
    seed: planned.seed,
    exitCode: child.status,
    result: parseJsonOutput(child.stdout),
    blockers: parseJsonOutput(child.stderr)?.blockers ?? [],
  }
}

function parseJsonOutput(value) {
  const source = String(value ?? "")
  const start = source.indexOf("{")
  const end = source.lastIndexOf("}")
  if (start < 0 || end < start) return null
  try { return JSON.parse(source.slice(start, end + 1)) } catch { return null }
}
function isCurrentV7CapacityRow(row) {
  return row.categoryId === "complete-maps"
    && row.trainingRoles?.includes("conditional_denoiser")
    && row.formalConditionalTrainingEligible === true
    && row.conditionBound === true
    && row.v7CapacityContributionRegistered === true
    && row.ownerReviewStatus === "owner_approved"
    && row.machineReviewStatus === "passed"
    && row.aiAssistedColdStartEligible === true
    && row.independentTrainingEligible === false
}
function isV7CompleteNaturalRegionConditionPack(pack) {
  const mustShow = new Set(pack?.categoricalConditions?.sceneIntent?.mustShow ?? [])
  return pack?.schemaVersion === "complete-world-visual-condition-pack-v1"
    && pack?.canvas?.width === 1024
    && pack?.canvas?.height === 768
    && pack?.canvas?.frameScope === "complete_runtime_frame"
    && pack?.categoricalConditions?.sceneIntent?.sceneType === "training_complete_natural_region_map"
    && ["entrance", "main_path", "natural_boundary", "multiple_ecological_zones"].every((value) => mustShow.has(value))
    && !mustShow.has("home_center")
}
function deterministicSeed(conditionLabel, seedIndex) {
  const seedContract = IS_REPAIR_R1 ? "v7-repair-r1-strict-revalidation" : "v7-mvp64-post-training-validation"
  return Number.parseInt(crypto.createHash("sha256").update(`${conditionLabel}:${seedIndex}:${seedContract}`).digest("hex").slice(0, 8), 16)
}
function duplicateValues(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value)
}
function sumTokenAccounting(rows) {
  const totals = { denoiserSampleForwardPasses: 0, latentSpatialTokens: 0, latentChannelValues: 0, conditionScalarValues: 0, decodedRgbFrames: 0, decodedRgbPixelPredictions: 0 }
  for (const row of rows) {
    const run = row.validationTokenAccounting?.runTotals
    if (!run) continue
    for (const key of Object.keys(totals)) totals[key] += Number(run[key] ?? 0)
  }
  return totals
}
function buildAutomaticOwnerActionRequest(validationReport, validationReportPath) {
  const passed = validationReport.status === "machine_passed_waiting_owner_validation_review"
  const requestId = `owner-action-request-v7-validation-${validationReport.createdAtUtc.replace(/[:.]/g, "-").toLowerCase()}`
  return {
    schemaVersion: "ai-painter-owner-action-request-input-v1",
    requestId,
    subsystem: "ai_painter_v7_post_training_validation_outcome",
    status: passed ? "waiting_owner_review" : "waiting_owner_authorization",
    taskIdentity: {
      modelId: validationReport.modelId,
      checkpointSha256: validationReport.checkpointSha256,
      validationBatchId: validationReport.batchId,
      strictHeldOutSplit: validationReport.strictHeldOutSplit,
      uniqueTrajectoryCount: validationReport.plannedTrajectoryCount,
      machinePassedCount: validationReport.machinePassedCount,
      machineRejectedCount: validationReport.machineRejectedCount,
    },
    ownerVisibleConclusionZh: passed
      ? "V7严格留出训练后验证已通过机器门禁，但仍未取得项目所有者终审和正式推理授权。"
      : `V7严格留出训练后验证已完成，机器通过${validationReport.machinePassedCount}条、拒绝${validationReport.machineRejectedCount}条，当前权重不具备正式推理资格。`,
    localSystemFindingZh: passed
      ? "本地验证程序已自动保存全部轨迹、Token、机器审核和聚合证据。"
      : `本地验证程序自动记录失败码：${validationReport.issueCodes.join(", ") || "execution_failed"}。`,
    blockingReasonCode: passed
      ? "v7_post_training_validation_waiting_owner_review"
      : "v7_post_training_validation_machine_or_execution_failed",
    whyCannotProceedZh: passed
      ? "机器验证通过不等于项目所有者批准正式推理。"
      : "训练后验证未通过，不能启动正式推理、RuntimeFrame或世界运行；修改模型、重训和重新验证均需要新的owner授权。",
    minimumRequestedActionZh: passed
      ? "请项目所有者查看验证图和聚合证据，并决定通过或拒绝；正式推理仍需后续单独授权。"
      : "请项目所有者决定是否授权根据失败码设计下一轮修复、从新Stage 0重训并重新验证。",
    invariants: [
      "validation_evidence_remains_immutable",
      "training_weights_are_not_modified_by_validation",
      "formal_inference_runtime_frame_and_world_remain_blocked",
    ],
    forbiddenActions: [
      "fabricate_owner_review",
      "delete_validation_failures",
      "automatically_retrain_or_revalidate",
      "start_formal_inference",
      "start_runtime_frame",
      "enter_world",
    ],
    ownerFacingMessageZh: passed
      ? "V7训练后验证机器门禁已通过，请在本地控制台查看8条轨迹后作出owner决定。"
      : "V7训练后验证未通过。失败证据、计算量和下一步最小授权请求已由本地程序自动保存。",
    nextActionAfterAuthorization: passed
      ? ["record_owner_validation_review", "request_separate_formal_inference_authorization"]
      : ["design_bounded_v7_repair", "run_cpu_regression", "retrain_from_new_stage_0", "rerun_strict_held_out_validation", "stop_before_formal_inference"],
    evidencePaths: [validationReportPath, CHECKPOINT_POINTER],
    ownerDecision: null,
    resolution: {
      postTrainingValidationPassed: passed,
      formalInferenceAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    },
  }
}
function readLatestCompletedReport() {
  const pointerPath = path.resolve(ROOT, OUTPUT_ROOT, "latest.json")
  if (!fs.existsSync(pointerPath)) return null
  const pointer = readJson(pointerPath)
  const runPath = pointer?.runPath
  if (!runPath || !fs.existsSync(path.resolve(ROOT, runPath))) return null
  const report = readJson(runPath)
  return report?.completedTrajectoryCount === report?.plannedTrajectoryCount ? report : null
}
function acquireValidationLock() {
  const lockPath = path.resolve(ROOT, OUTPUT_ROOT, "active-validation.lock.json")
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  try {
    const handle = fs.openSync(lockPath, "wx")
    fs.writeFileSync(handle, `${JSON.stringify({ pid: process.pid, ownerCommandRef: args.ownerCommandRef, createdAtUtc: new Date().toISOString() }, null, 2)}\n`)
    fs.closeSync(handle)
  } catch (error) {
    if (error?.code !== "EEXIST") throw error
    const existing = readJson(lockPath)
    if (processIsAlive(Number(existing?.pid))) throw new Error("another V7 post-training validation process is already active")
    const preserved = `${lockPath}.stale-${new Date().toISOString().replace(/[:.]/g, "-")}`
    fs.renameSync(lockPath, preserved)
    const handle = fs.openSync(lockPath, "wx")
    fs.writeFileSync(handle, `${JSON.stringify({ pid: process.pid, ownerCommandRef: args.ownerCommandRef, createdAtUtc: new Date().toISOString(), replacedStaleLock: projectPath(preserved) }, null, 2)}\n`)
    fs.closeSync(handle)
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (!fs.existsSync(lockPath)) return
    const current = readJson(lockPath)
    if (Number(current?.pid) === process.pid) fs.rmSync(lockPath)
  }
}
function consumeValidationAuthorization() {
  const authorizationSha256 = sha256File(AUTHORIZATION_PATH)
  const consumptionRoot = path.resolve(ROOT, OUTPUT_ROOT, "authorization-consumptions")
  const consumptionPath = path.join(consumptionRoot, `${authorizationSha256}.json`)
  fs.mkdirSync(consumptionRoot, { recursive: true })
  let handle
  try {
    handle = fs.openSync(consumptionPath, "wx")
    const record = {
      schemaVersion: IS_REPAIR_R1
        ? "ai-assisted-v7-repair-r1-strict-revalidation-authorization-consumption-v1"
        : "ai-assisted-v7-post-training-validation-authorization-consumption-v1",
      status: "consumed_before_first_trajectory",
      consumedAtUtc: new Date().toISOString(),
      consumedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
      pid: process.pid,
      ownerCommandRef: args.ownerCommandRef,
      authorizationScope: IS_REPAIR_R1 ? REPAIR_R1_AUTHORIZATION_SCOPE : authorization?.ownerDecision?.scope ?? null,
      checkpointSha256: checkpoint.checkpointSha256,
      authorizationPath: AUTHORIZATION_PATH,
      authorizationSha256,
      plannedTrajectoryCount: plannedTrajectories.length,
      completionRequiredForReuse: false,
      incompleteRunRequiresNewOwnerAuthorization: true,
    }
    fs.writeFileSync(handle, `${JSON.stringify(record, null, 2)}\n`)
    return { ...record, path: projectPath(consumptionPath) }
  } catch (error) {
    if (error?.code === "EEXIST") failPreflight(["v7_post_training_validation_authorization_already_consumed_or_incomplete"])
    throw error
  } finally {
    if (handle !== undefined) fs.closeSync(handle)
  }
}
function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch { return false }
}
function projectPath(value) { return path.relative(ROOT, path.resolve(ROOT, value)).replaceAll("\\", "/") }
function failPreflight(reasons, evidence = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: IS_REPAIR_R1
      ? "v7_repair_r1_strict_revalidation_read_only_preflight_failed"
      : "v7_post_training_validation_preflight_failed",
    validationProfile: args.profile,
    blockers: reasons,
    ...evidence,
    authorizationConsumed: false,
    outputWritten: false,
    formalInferenceEligible: false,
  }, null, 2))
  process.exit(1)
}
function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
function fileHashMatches(value, expected) {
  if (!value || !expected) return false
  const absolute = path.resolve(ROOT, value)
  return fs.existsSync(absolute) && sha256File(absolute) === String(expected).toLowerCase()
}
