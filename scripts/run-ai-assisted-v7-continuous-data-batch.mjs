import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const AUTHORIZATION_ID = "owner-authorized-v7-remaining-104-continuous-batch-20260723"
const CONFIG_PATH = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"
const CAPACITY_POINTER_PATH = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const TASK_ROOT = ".runtime/ai-painter/ai-assisted-v7-data-tasks"
const REQUEST_ROOT = ".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests"
const BATCH_ROOT = ".runtime/ai-painter/ai-assisted-v7-continuous-data-batches"
const LATEST_PATH = `${BATCH_ROOT}/latest.json`
const prepareNext = process.argv.includes("--prepare-next")
const statusOnly = process.argv.includes("--status")
const reconcileOnly = process.argv.includes("--reconcile-only")
const ownerStop = process.argv.includes("--owner-stop")

assert(
  [prepareNext, statusOnly, reconcileOnly, ownerStop].filter(Boolean).length === 1,
  "use exactly one of --prepare-next, --status, --reconcile-only, or --owner-stop",
)
const config = readJson(CONFIG_PATH)
const decision = config.training?.dataCapacityDecision
const authorization = decision?.continuousBatchAuthorization
assert(decision?.batchImageGenerationAuthorized === true, "V7 continuous batch is not authorized")
assert(authorization?.authorizationId === AUTHORIZATION_ID, "V7 continuous batch authorization mismatch")
assert(authorization?.authorizedRecordCount === 104, "V7 continuous batch scope must remain 104 records")
assert(authorization?.executionMode === "sequential_one_active_generation_request", "V7 batch must remain sequential")
assert(authorization?.ownerApprovalAutomatic === false, "owner approval must remain manual")
assert(authorization?.capacityContributionAutomaticBeforeOwnerApproval === false, "capacity contribution must wait for owner approval")
assert(authorization?.gpuTrainingAutomatic === false && decision?.gpuTrainingAuthorized === false, "V7 GPU training must remain blocked")

const capacityPointer = readJson(CAPACITY_POINTER_PATH)
verifyHash(capacityPointer.gapListPath, capacityPointer.gapListSha256, "V7 gap-list hash mismatch")
const gapList = readJson(capacityPointer.gapListPath)
const remainingAuthorizedSlots = (gapList.plannedSlots ?? []).filter((slot) => slot.continuousBatchAuthorizationId === AUTHORIZATION_ID)
const remainingAuthorizedSlotById = new Map(remainingAuthorizedSlots.map((slot) => [slot.slotId, slot]))
const authorizedSlots = Array.from({ length: authorization.authorizedRecordCount }, (_, index) => {
  const slotId = `v7-capacity-slot-${String(index + 4).padStart(3, "0")}`
  return remainingAuthorizedSlotById.get(slotId) ?? {
    slotId,
    split: null,
    regionalLandscapeType: null,
    monsoonSeason: null,
    removedFromGapListAfterQualification: true,
  }
})
assert(authorizedSlots.length === 104, `authorized continuous batch expected 104 slots, got ${authorizedSlots.length}`)
assert(authorizedSlots[0]?.slotId === "v7-capacity-slot-004", "continuous batch must start at slot 004")
assert(authorizedSlots.at(-1)?.slotId === "v7-capacity-slot-107", "continuous batch must end at slot 107")

const tasks = readTaskManifests()
const requests = readGenerationRequests()
const state = buildState({ authorizedSlots, tasks, requests })
const previousBatch = readJsonSafe(LATEST_PATH)

if (ownerStop) {
  const suspendedRequest = state.activeRequests[0] ?? null
  const result = persistState({
    ...state,
    status: "stopped_by_owner",
    nextAction: "none_waiting_owner_instruction",
    activeRequest: null,
    activeRequests: [],
    suspendedRequest,
    stoppedByOwner: true,
    stopReason: "owner_stopped_batch_due_to_repeated_transform_derived_compositions",
  })
  appendAiPainterProgramEvent({
    runId: result.batchRunId,
    status: "blocked",
    stage: "ai_assisted_v7_continuous_batch_stopped_by_owner",
    action: "stop_v7_continuous_batch",
    kind: "v7_continuous_data_batch",
    titleZh: "项目所有者已停止 V7 连续数据批次",
    titleEn: "The project owner stopped the V7 continuous data batch",
    summaryZh: `连续出图、下一槽准备和 V7 GPU 训练均已停止。暂停请求=${suspendedRequest?.requestId ?? "无"}；其历史证据保留，不生成 RGB。`,
    summaryEn: `Continuous image generation, next-slot preparation, and V7 GPU training are stopped. Suspended request=${suspendedRequest?.requestId ?? "none"}; its historical evidence is retained and no RGB is generated.`,
    errorCode: "owner_stopped_continuous_batch_due_to_transform_derived_repetition",
    evidence: [result.statePath, LATEST_PATH, suspendedRequest?.requestPath].filter(Boolean),
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (statusOnly) {
  console.log(JSON.stringify(previousBatch?.status === "stopped_by_owner"
    ? {
        ...state,
        status: "stopped_by_owner",
        nextAction: "none_waiting_owner_instruction",
        activeRequests: [],
        activeRequest: null,
        suspendedRequest: previousBatch.suspendedRequest ?? previousBatch.activeRequest ?? null,
        stoppedByOwner: true,
        stopReason: previousBatch.stopReason,
        stoppedAtUtc: previousBatch.updatedAtUtc,
        stoppedAtAsiaShanghai: previousBatch.updatedAtAsiaShanghai,
      }
    : state, null, 2))
  process.exit(0)
}

assert(previousBatch?.status !== "stopped_by_owner", "V7 continuous batch is stopped by the project owner")

if (reconcileOnly) {
  const result = persistState({
    ...state,
    status: state.activeRequests.length > 0
      ? "waiting_for_current_slot_generation_result"
      : "ready_to_prepare_next_slot",
    nextAction: state.activeRequests.length > 0
      ? "codex_builtin_generate_then_program_finalize"
      : "prepare_next_authorized_slot",
    activeRequest: state.activeRequests[0] ?? null,
  })
  appendAiPainterProgramEvent({
    runId: result.batchRunId,
    status: "success",
    stage: "ai_assisted_v7_continuous_batch_reconciled",
    action: "reconcile_v7_continuous_batch_state",
    kind: "v7_continuous_data_batch",
    titleZh: "V7 连续数据批次状态已按真实任务和请求记录完成对账",
    titleEn: "The V7 continuous data batch state was reconciled from persisted tasks and requests",
    summaryZh: `程序只重建批次摘要：已生成 ${result.generatedResultCount} 条，机器待人工审核 ${result.machinePassedPendingOwnerCount} 条，机器拒绝 ${result.machineRejectedCount} 条；未生成图片，也未启动 GPU 训练。`,
    summaryEn: `The program rebuilt only the batch summary: generated=${result.generatedResultCount}, machine-passed pending owner=${result.machinePassedPendingOwnerCount}, machine-rejected=${result.machineRejectedCount}. No image was generated and no GPU training was started.`,
    evidence: [result.statePath, LATEST_PATH],
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (state.activeRequests.length > 0) {
  const result = persistState({
    ...state,
    status: "waiting_for_current_slot_generation_result",
    nextAction: "codex_builtin_generate_then_program_finalize",
    activeRequest: state.activeRequests[0],
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

const nextSlot = authorizedSlots.find((slot) => !requests.some((request) => (
  request.sourceRecordId === slot.slotId && !isReplaceablePreGenerationFailure(request)
)))
if (!nextSlot) {
  const result = persistState({
    ...state,
    status: "continuous_batch_generation_complete_waiting_owner_review",
    nextAction: "project_owner_review_machine_passed_queue",
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

let task = tasks.find((entry) => entry.row?.capacitySlotId === nextSlot.slotId)
if (!task || !taskSatisfiesNoPresetSiteContract(task)) {
  const args = ["--v7-slot-id", nextSlot.slotId]
  if (task) args.push("--supersede-incompatible-pre-generation-task")
  runNode("scripts/build-ai-assisted-conditional-world-fact-blueprints.mjs", args, "prepare V7 slot task")
  runNode("scripts/check-ai-assisted-v7-data-task.mjs", ["--slot-id", nextSlot.slotId], "check V7 slot task")
  task = readTaskManifests().find((entry) => entry.row?.capacitySlotId === nextSlot.slotId)
}
assert(task, `prepared V7 task is missing: ${nextSlot.slotId}`)
assert(task.continuousBatchAuthorization?.authorizationId === AUTHORIZATION_ID, "prepared task has the wrong continuous batch authorization")

runNode("scripts/build-current-world-condition-guide.mjs", [
  "--task", task.row.taskPackagePath,
  "--condition-pack", task.row.conditionPackPath,
], "build current slot condition guide")
const request = runNode("scripts/build-ai-assisted-conditional-rgb-generation-request.mjs", [
  "--v7-task-manifest", task.manifestPath,
], "build current slot generation request")
runNode("scripts/check-ai-assisted-conditional-rgb-request.mjs", ["--request", request.requestPath], "check current slot generation request")

const updatedState = buildState({
  authorizedSlots,
  tasks: readTaskManifests(),
  requests: readGenerationRequests(),
})
const result = persistState({
  ...updatedState,
  status: "waiting_for_current_slot_generation_result",
  nextAction: "codex_builtin_generate_then_program_finalize",
  preparedSlotId: nextSlot.slotId,
  activeRequest: {
    requestId: request.requestId,
    outputRecordId: request.outputRecordId,
    requestPath: request.requestPath,
    promptEvidencePath: request.promptEvidencePath,
    conditionGuidePath: request.conditionGuidePath,
    prompt: request.prompt,
  },
})

appendAiPainterProgramEvent({
  runId: result.batchRunId,
  status: "success",
  stage: "ai_assisted_v7_continuous_batch_slot_prepared",
  action: "prepare_next_v7_continuous_batch_slot",
  kind: "v7_continuous_data_batch",
  titleZh: `V7 连续数据批次已准备 ${nextSlot.slotId}，等待内置生成通道返回 RGB`,
  titleEn: `The V7 continuous data batch prepared ${nextSlot.slotId} and is waiting for the built-in generation route to return RGB`,
  summaryZh: "程序已逐槽保存世界事实、世界导演、完整地图任务、23通道、范围审核和生成请求。任何时刻只保留一个活动请求；没有启动V7 GPU训练，也没有自动授予人工审核通过。",
  summaryEn: "The program persisted the world facts, World Director output, complete-map task, 23 channels, scope audit, and generation request for one slot. Only one request is active; V7 GPU training was not started and owner approval was not granted automatically.",
  evidence: [request.requestPath, request.promptEvidencePath, request.conditionGuidePath],
})
console.log(JSON.stringify(result, null, 2))

function buildState({ authorizedSlots: slots, tasks: taskRows, requests: requestRows }) {
  const slotStates = slots.map((slot) => {
    const task = taskRows.find((entry) => entry.row?.capacitySlotId === slot.slotId) ?? null
    const slotRequests = requestRows.filter((entry) => entry.sourceRecordId === slot.slotId)
    const latestRequest = slotRequests.at(-1) ?? null
    return {
      slotId: slot.slotId,
      split: slot.split,
      regionalLandscapeType: slot.regionalLandscapeType,
      monsoonSeason: slot.monsoonSeason,
      taskStatus: task?.status ?? "not_prepared",
      requestId: latestRequest?.requestId ?? null,
      requestStatus: latestRequest?.status ?? "not_requested",
      machineReviewStatus: latestRequest?.machineReviewStatus ?? null,
      ownerReviewStatus: latestRequest?.ownerReviewStatus ?? null,
    }
  })
  const activeRequests = requestRows
    .filter((request) => request.status === "ready_for_openai_assisted_generation")
    .map((request) => ({
      sourceRecordId: request.sourceRecordId,
      requestId: request.requestId,
      outputRecordId: request.outputRecordId,
      requestPath: request.requestPath,
      promptEvidencePath: request.promptEvidencePath,
      conditionGuidePath: request.referenceImagePaths?.[0] ?? null,
      prompt: request.prompt ?? readJson(request.promptEvidencePath).prompt,
    }))
  assert(activeRequests.length <= 1, `continuous batch has ${activeRequests.length} active requests; sequential invariant failed`)
  return {
    schemaVersion: "ai-assisted-v7-continuous-data-batch-state-v1",
    authorizationId: AUTHORIZATION_ID,
    capacityPlanRunId: capacityPointer.runId,
    status: activeRequests.length > 0 ? "waiting_for_current_slot_generation_result" : "ready_to_prepare_next_slot",
    approvedCapacity: 128,
    existingQualifiedAtAuthorization: 24,
    authorizedSlotCount: slots.length,
    preparedTaskCount: slotStates.filter((slot) => slot.taskStatus !== "not_prepared").length,
    generatedResultCount: slotStates.filter((slot) => !["not_requested", "ready_for_openai_assisted_generation"].includes(slot.requestStatus)).length,
    machinePassedPendingOwnerCount: slotStates.filter((slot) => slot.requestStatus === "generated_intaked_machine_passed_waiting_owner_review").length,
    machineRejectedCount: slotStates.filter((slot) => slot.requestStatus === "generated_intaked_machine_rejected").length,
    generationFailureCount: slotStates.filter((slot) => ["generation_failed_retryable", "generated_rejected_source_contract"].includes(slot.requestStatus)).length,
    unrequestedSlotCount: slotStates.filter((slot) => slot.requestStatus === "not_requested").length,
    activeRequests,
    ownerApprovalAutomatic: false,
    capacityContributionAutomaticBeforeOwnerApproval: false,
    v7GpuTrainingStarted: false,
    v7GpuTrainingAuthorized: false,
    pixelGenerationRoute: "codex_builtin_image_generation",
    programOrchestrationAutomatic: true,
    slotStates,
  }
}

function persistState(value) {
  const timestamp = new Date().toISOString()
  const previous = readJsonSafe(LATEST_PATH)
  const batchRunId = previous?.batchRunId ?? `ai-assisted-v7-continuous-data-batch-${timestamp.replace(/[:.]/g, "-")}`
  const state = {
    ...value,
    batchRunId,
    updatedAtUtc: timestamp,
    updatedAtAsiaShanghai: formatShanghai(timestamp),
    automaticStorage: true,
  }
  const runRoot = path.join(ROOT, BATCH_ROOT, batchRunId)
  const eventPath = path.join(runRoot, "events", `${timestamp.replace(/[:.]/g, "-")}.json`)
  const statePath = path.join(runRoot, "state.json")
  writeAndIndex(eventPath, state, batchRunId)
  writeAndIndex(statePath, state, batchRunId)
  const pointer = {
    schemaVersion: "ai-assisted-v7-continuous-data-batch-latest-v1",
    batchRunId,
    status: state.status,
    updatedAtUtc: timestamp,
    updatedAtAsiaShanghai: state.updatedAtAsiaShanghai,
    authorizationId: AUTHORIZATION_ID,
    statePath: projectPath(statePath),
    stateSha256: sha256(fs.readFileSync(statePath)),
    activeRequest: state.status === "stopped_by_owner"
      ? null
      : state.activeRequest ?? state.activeRequests?.[0] ?? null,
    suspendedRequest: state.suspendedRequest ?? null,
    stoppedByOwner: state.stoppedByOwner === true,
    stopReason: state.stopReason ?? null,
    generatedResultCount: state.generatedResultCount,
    machinePassedPendingOwnerCount: state.machinePassedPendingOwnerCount,
    machineRejectedCount: state.machineRejectedCount,
    generationFailureCount: state.generationFailureCount,
    unrequestedSlotCount: state.unrequestedSlotCount,
    ownerApprovalAutomatic: false,
    v7GpuTrainingStarted: false,
    automaticStorage: true,
  }
  writeAndIndex(path.join(ROOT, LATEST_PATH), pointer, batchRunId)
  closeStorageCatalog()
  return { ...pointer, ...state, statePath: pointer.statePath }
}

function readTaskManifests() {
  return listFiles(resolveProjectPath(TASK_ROOT), "manifest.json")
    .flatMap((filePath) => {
      const value = readJsonSafe(filePath)
      return value?.row?.capacitySlotId ? [{ ...value, manifestPath: projectPath(filePath) }] : []
    })
    .filter((entry) => entry.status !== "failed_before_rgb_generation")
    .sort((left, right) => String(right.createdAtUtc ?? right.createdAt ?? "").localeCompare(String(left.createdAtUtc ?? left.createdAt ?? "")))
}

function readGenerationRequests() {
  return listFiles(resolveProjectPath(REQUEST_ROOT), "request.json")
    .flatMap((filePath) => {
      const value = readJsonSafe(filePath)
      return value?.requestId ? [{ ...value, requestPath: projectPath(filePath) }] : []
    })
    .filter((request) => /^v7-capacity-slot-\d{3}$/.test(request.sourceRecordId ?? ""))
    .sort((left, right) => (left.updatedAtUtc ?? left.createdAtUtc).localeCompare(right.updatedAtUtc ?? right.createdAtUtc))
}

function isReplaceablePreGenerationFailure(request) {
  return request.status === "generation_failed_retryable"
    && request.lastGenerationFailureCode === "v7_stale_task_manifest_selected_before_generation"
    && !request.generatedImagePath
}

function taskSatisfiesNoPresetSiteContract(task) {
  const taskPackage = readJsonSafe(task.row?.taskPackagePath)
  const conditionPack = readJsonSafe(task.row?.conditionPackPath)
  const focalChannel = conditionPack?.channels?.find((entry) => entry.id === "focal_area")
  return taskPackage?.singleMapCompositionFields?.siteSelectionPolicy === "runtime_butler_autonomy_only"
    && Number(focalChannel?.statistics?.nonZeroCount ?? -1) === 0
}

function runNode(script, args, label) {
  const child = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
  if (child.status !== 0) throw new Error(child.stderr || child.stdout || `${label} exited ${child.status}`)
  try {
    return JSON.parse(child.stdout)
  } catch {
    throw new Error(`${label} did not return JSON: ${child.stdout.slice(-2000)}`)
  }
}

function listFiles(root, fileName) {
  if (!fs.existsSync(root)) return []
  const files = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(resolved, fileName))
    else if (entry.isFile() && entry.name === fileName) files.push(resolved)
  }
  return files
}

function writeAndIndex(filePath, value, runId) {
  writeJsonAtomic(filePath, value)
  const stat = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256(fs.readFileSync(filePath)),
  })
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}
function readJsonSafe(value) {
  try { return readJson(value) } catch { return null }
}
function verifyHash(value, expected, message) { assert(sha256(fs.readFileSync(resolveProjectPath(value))) === expected, message) }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  return resolved
}
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
