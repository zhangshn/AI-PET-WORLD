import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import {
  findOriginalImageRecord,
  listOriginalImageRecords,
  type OriginalImageRecord,
} from "@/server/ai-painter-original-image-library"

const execFileAsync = promisify(execFile)
const PROJECT_ROOT = process.cwd()
const REVIEW_SCRIPT = path.join(PROJECT_ROOT, "scripts", "record-ai-assisted-cold-start-owner-review.mjs")
const CONTRIBUTION_SCRIPT = path.join(PROJECT_ROOT, "scripts", "register-ai-assisted-v7-capacity-contribution.mjs")
const CONTRIBUTION_CHECK_SCRIPT = path.join(PROJECT_ROOT, "scripts", "check-ai-assisted-v7-capacity-contribution.mjs")
const DATASET_BUILD_SCRIPT = path.join(PROJECT_ROOT, "scripts", "build-ai-assisted-cold-start-dataset-package.mjs")
const DATASET_CHECK_SCRIPT = path.join(PROJECT_ROOT, "scripts", "check-ai-assisted-cold-start-dataset-package.mjs")
const CAPACITY_PLAN_SCRIPT = path.join(PROJECT_ROOT, "scripts", "build-ai-assisted-v7-data-capacity-plan.mjs")
const activeReviews = new Set<string>()

export type OwnerReviewDecision = "approved" | "rejected"

export async function runOriginalImageOwnerReview(input: {
  categoryId: string
  recordId: string
  decision: OwnerReviewDecision
  comment: string
  ownerCommandRef: string
}) {
  const key = `${input.categoryId}:${input.recordId}`
  if (activeReviews.has(key)) throw new OwnerReviewConflictError("该原图正在写入审核，请勿重复提交。")
  activeReviews.add(key)

  try {
    const record = await requireReviewableRecord(input.categoryId, input.recordId)
    const ownerCommandRef = input.ownerCommandRef.trim()
    if (!ownerCommandRef) throw new OwnerReviewInputError("Owner命令身份不能为空。")
    const comment = normalizeComment(input.comment, input.decision)
    const sequenceNumber = input.decision === "approved" && hasV7CapacitySlot(record)
      ? await nextAutonomousSequence(record)
      : null

    const reviewArguments = [
      REVIEW_SCRIPT,
      "--record-id", input.recordId,
      "--category-id", input.categoryId,
      "--decision", input.decision,
      "--owner-command-ref", ownerCommandRef,
      "--comment", comment,
    ]
    if (sequenceNumber != null) {
      reviewArguments.push("--autonomous-sequence", String(sequenceNumber))
    }
    if (input.decision === "rejected") {
      const rejection = classifyOwnerRejection(comment)
      reviewArguments.push(
        "--reason-codes", rejection.reasonCodes.join(","),
        "--reason-codes-zh", rejection.reasonCodesZh.join(","),
        "--affected-regions", rejection.affectedRegions.join(","),
        "--next-training-target", comment,
      )
    }

    const completedSteps = [await runProgram("owner_review", reviewArguments)]
    const updatedRecord = await findOriginalImageRecord(input.categoryId, input.recordId)
    if (!updatedRecord) throw new Error("审核写入后无法读取原图记录。")

    if (input.decision === "approved" && hasV7CapacitySlot(updatedRecord)) {
      completedSteps.push(await runProgram("v7_capacity_contribution", [
        CONTRIBUTION_SCRIPT,
        "--record-id", input.recordId,
        "--owner-command-ref", ownerCommandRef,
      ]))
      completedSteps.push(await runProgram("v7_capacity_contribution_check", [CONTRIBUTION_CHECK_SCRIPT]))
      completedSteps.push(await runProgram("dataset_package_build", [DATASET_BUILD_SCRIPT]))
      completedSteps.push(await runProgram("dataset_package_check", [DATASET_CHECK_SCRIPT]))
      completedSteps.push(await runProgram("capacity_plan_refresh", [CAPACITY_PLAN_SCRIPT]))
    }

    return {
      status: input.decision === "approved" ? "owner_review_approved" : "owner_review_rejected",
      recordId: input.recordId,
      ownerCommandRef,
      sequenceNumber,
      completedSteps,
      record: await findOriginalImageRecord(input.categoryId, input.recordId),
    }
  } finally {
    activeReviews.delete(key)
  }
}

async function requireReviewableRecord(categoryId: string, recordId: string) {
  if (categoryId !== "complete-maps") {
    throw new OwnerReviewConflictError("当前页面审核只允许完整地图原图。")
  }
  const record = await findOriginalImageRecord(categoryId, recordId)
  if (!record) throw new OwnerReviewNotFoundError("未找到原图记录。")
  if (record.reviews?.machineReviewStatus !== "machine_contract_passed_waiting_owner_visual_review") {
    throw new OwnerReviewConflictError("该原图尚未通过机器合同审核，不能进行项目所有者审核。")
  }
  if (record.reviews?.ownerReviewStatus !== "pending_review") {
    throw new OwnerReviewConflictError("该原图已经完成人工审核，历史结论禁止覆盖。")
  }
  return record
}

async function nextAutonomousSequence(record: OriginalImageRecord) {
  const existing = record.autonomousGenerationTrainingOriginal?.sequenceNumber
  if (existing) return existing
  const records = await listOriginalImageRecords("complete-maps")
  return records.reduce((maximum, item) => (
    Math.max(maximum, item.autonomousGenerationTrainingOriginal?.sequenceNumber ?? 0)
  ), 0) + 1
}

export function hasV7CapacitySlot(record: OriginalImageRecord) {
  const worldBinding = record.worldBinding ?? {}
  const conditionBinding = record.conditionBinding ?? {}
  const identityValues = [
    record.recordId,
    worldBinding.capacitySlotId,
    worldBinding.taskPackagePath,
    conditionBinding.capacitySlotId,
    conditionBinding.taskPackagePath,
  ]
  return identityValues.some((value) => (
    typeof value === "string" && /(?:^|[-/\\])v7-capacity-slot-\d{3}(?:[-/\\]|$)/.test(value)
  ))
}

function normalizeComment(value: string, decision: OwnerReviewDecision) {
  const comment = value.trim()
  if (comment.length > 2000) throw new OwnerReviewInputError("审核说明不能超过 2000 个字符。")
  if (decision === "rejected" && !comment) {
    throw new OwnerReviewInputError("拒绝时必须填写具体原因和下一轮修复目标。")
  }
  return comment || "项目所有者通过控制台确认该完整地图原图符合当前训练数据标准。"
}

export function classifyOwnerRejection(comment: string) {
  const normalized = comment.trim().toLowerCase()
  const duplicateSignal =
    /(重复|雷同|相同|一样|重新画|duplicate|duplicated|reus(?:e|ed|ing))/.test(normalized)
  const compositionSignal =
    /(构图|主体|框架|结构|布局|地图|河道|道路|composition|framework|template|layout|map|river|route)/.test(normalized)
  if (duplicateSignal && compositionSignal) {
    return {
      reasonCodes: ["composition_duplicate"],
      reasonCodesZh: ["完整地图主体构图重复"],
      affectedRegions: ["full_map_composition"],
    }
  }
  return {
    reasonCodes: ["owner_visual_quality_rejected"],
    reasonCodesZh: ["项目所有者判定完整地图视觉质量不通过"],
    affectedRegions: ["complete-map"],
  }
}

async function runProgram(step: string, args: string[]) {
  try {
    const result = await execFileAsync(process.execPath, args, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    return { step, status: "completed", output: outputTail(result.stdout) }
  } catch (error) {
    const details = error as Error & { stdout?: string; stderr?: string }
    const output = [details.stdout, details.stderr, details.message].filter(Boolean).join("\n")
    throw new Error(`${step} 失败：${outputTail(output)}`)
  }
}

function outputTail(value: string) {
  return value.trim().split(/\r?\n/).slice(-12).join("\n")
}

export class OwnerReviewInputError extends Error {}
export class OwnerReviewConflictError extends Error {}
export class OwnerReviewNotFoundError extends Error {}
