import path from "node:path"

import { readWorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-store-adapter"
import {
  buildWorldVisualApprovedFrame,
  buildWorldVisualFactManifest,
  buildWorldVisualFixPlan,
  buildWorldVisualPainterDecision,
  buildWorldVisualReviewReport,
  readLatestWorldVisualCandidateRecord,
  writeWorldVisualApprovedFrameRecord,
  writeWorldVisualCandidateRecord,
  writeWorldVisualFixPlanRecord,
} from "@/world/world-visual-painter"

export type TrainingWorldPromotionResult = {
  attempted: boolean
  ok: boolean
  status:
    | "not_applicable"
    | "runtime_world_missing"
    | "image_model_not_ready"
    | "candidate_missing"
    | "candidate_write_failed"
    | "review_failed"
    | "approved_frame_written"
    | "approved_frame_write_failed"
  message: string
  candidatePath: string | null
  approvedFramePath: string | null
  reviewStatus: string | null
  tags: string[]
}

export async function tryPromoteTrainingResultToWorldVisual(input: {
  action: string
}): Promise<TrainingWorldPromotionResult> {
  if (!isWorldVisualTrainingAction(input.action)) {
    return skipped("not_applicable", "该训练动作不是自然世界画图模型，不尝试进入世界视觉链路。")
  }

  return withTrainingModelEnvironment(input.action, () => promoteCurrentRuntimeWorld())
}

async function promoteCurrentRuntimeWorld(): Promise<TrainingWorldPromotionResult> {
  const runtimeReadResult = await readWorldRuntimeSaveRecord()
  if (runtimeReadResult.status !== "found" || !runtimeReadResult.record) {
    return skipped("runtime_world_missing", "世界尚未创建，训练结果只保留在历史记录，不生成 Candidate。")
  }

  const decision = await buildWorldVisualPainterDecision({
    saveRecord: runtimeReadResult.record,
  })
  if (!decision.imageModelStatus.canGenerate) {
    return skipped("image_model_not_ready", decision.imageModelStatus.reason.zh)
  }
  if (!decision.aiImageCandidate) {
    return skipped("candidate_missing", "内部模型没有生成可写入的隐藏 Candidate。")
  }

  const candidateWriteResult = await writeWorldVisualCandidateRecord({
    ownerId: runtimeReadResult.record.ownerId,
    worldId: runtimeReadResult.record.worldId,
    tick: runtimeReadResult.record.tick,
    candidate: decision.aiImageCandidate,
    generationCondition: decision.generationCondition,
    factManifest: decision.factManifest,
    aiImageGenerationRequest: decision.aiImageGenerationRequest,
  })
  if (!candidateWriteResult.ok) {
    return {
      attempted: true,
      ok: false,
      status: "candidate_write_failed",
      message: "隐藏 Candidate 写入失败，不能进入 VisualJudge。",
      candidatePath: candidateWriteResult.path,
      approvedFramePath: null,
      reviewStatus: null,
      tags: ["training_world_visual_promotion", "candidate_write_failed", ...candidateWriteResult.tags],
    }
  }

  const factManifest = buildWorldVisualFactManifest({
    saveRecord: runtimeReadResult.record,
  })
  const candidateReadResult = await readLatestWorldVisualCandidateRecord({
    ownerId: runtimeReadResult.record.ownerId,
    worldId: runtimeReadResult.record.worldId,
    currentTick: runtimeReadResult.record.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
  })
  if (candidateReadResult.status !== "found" || !candidateReadResult.record) {
    return {
      attempted: true,
      ok: false,
      status: "candidate_write_failed",
      message: "隐藏 Candidate 已写入，但没有通过当前 runtime 读取闸门，不能进入 VisualJudge。",
      candidatePath: candidateWriteResult.path,
      approvedFramePath: null,
      reviewStatus: null,
      tags: ["training_world_visual_promotion", "candidate_read_gate_failed", ...candidateReadResult.tags],
    }
  }
  const candidateRecord = candidateReadResult.record
  const reviewReport = await buildWorldVisualReviewReport({
    factManifest,
    generationCondition: candidateRecord.generationCondition,
    aiImageGenerationRequest: candidateRecord.aiImageGenerationRequest,
    aiImageCandidate: candidateRecord.candidate,
  })
  const fixPlan = buildWorldVisualFixPlan({
    factManifest,
    reviewReport,
  })
  await writeWorldVisualFixPlanRecord({
    ownerId: runtimeReadResult.record.ownerId,
    worldId: runtimeReadResult.record.worldId,
    tick: runtimeReadResult.record.tick,
    fixPlan,
    reviewReport,
    factManifest,
  })

  const approvedFrame = buildWorldVisualApprovedFrame({
    factManifest,
    generationCondition: candidateRecord.generationCondition,
    aiImageGenerationRequest: candidateRecord.aiImageGenerationRequest,
    aiImageCandidate: candidateRecord.candidate,
    reviewReport,
  })
  if (!approvedFrame) {
    return {
      attempted: true,
      ok: false,
      status: "review_failed",
      message: "VisualJudge 未生成受控 MVP ApprovedFrame，训练结果只保留为候选和失败/修正记录。",
      candidatePath: candidateWriteResult.path,
      approvedFramePath: null,
      reviewStatus: reviewReport.status,
      tags: ["training_world_visual_promotion", "review_failed", reviewReport.status, ...reviewReport.tags],
    }
  }

  const approvedWriteResult = await writeWorldVisualApprovedFrameRecord({
    ownerId: runtimeReadResult.record.ownerId,
    worldId: runtimeReadResult.record.worldId,
    tick: runtimeReadResult.record.tick,
    approvedFrame,
    reviewReport,
    sourceCandidateRecord: candidateRecord,
  })

  return {
    attempted: true,
    ok: approvedWriteResult.ok,
    status: approvedWriteResult.ok ? "approved_frame_written" : "approved_frame_write_failed",
    message: approvedWriteResult.ok
      ? "训练结果已自动写入隐藏 Candidate，并通过 VisualJudge 生成受控 MVP ApprovedFrame。"
      : "ApprovedFrame 写入失败，/world 不能展示本轮训练结果。",
    candidatePath: candidateWriteResult.path,
    approvedFramePath: approvedWriteResult.path,
    reviewStatus: reviewReport.status,
    tags: [
      "training_world_visual_promotion",
      approvedWriteResult.ok ? "approved_frame_written" : "approved_frame_write_failed",
      reviewReport.status,
      ...approvedWriteResult.tags,
    ],
  }
}

function isWorldVisualTrainingAction(action: string) {
  return action.startsWith("full_natural_home_v")
}

async function withTrainingModelEnvironment<T>(
  action: string,
  run: () => Promise<T>,
): Promise<T> {
  const previousVersion = process.env.AI_PET_WORLD_IMAGE_MODEL_VERSION
  const previousAssetDir = process.env.AI_PET_WORLD_IMAGE_MODEL_ASSET_DIR
  const override = imageModelEnvironmentForAction(action)

  if (override) {
    process.env.AI_PET_WORLD_IMAGE_MODEL_VERSION = override.modelVersion
    process.env.AI_PET_WORLD_IMAGE_MODEL_ASSET_DIR = override.assetDir
  }

  try {
    return await run()
  } finally {
    if (previousVersion === undefined) {
      delete process.env.AI_PET_WORLD_IMAGE_MODEL_VERSION
    } else {
      process.env.AI_PET_WORLD_IMAGE_MODEL_VERSION = previousVersion
    }
    if (previousAssetDir === undefined) {
      delete process.env.AI_PET_WORLD_IMAGE_MODEL_ASSET_DIR
    } else {
      process.env.AI_PET_WORLD_IMAGE_MODEL_ASSET_DIR = previousAssetDir
    }
  }
}

function imageModelEnvironmentForAction(action: string) {
  if (action === "full_natural_home_v19_promoted_source") {
    return {
      modelVersion: "ai-pet-world-natural-home-v19-promoted-source",
      assetDir: path.join(process.cwd(), ".runtime", "ai-painter", "natural-home-local-detail-v19-promoted-source"),
    }
  }
  if (action === "full_natural_home_v20_multisource_generalization") {
    return {
      modelVersion: "ai-pet-world-natural-home-v20-multisource-generalization",
      assetDir: path.join(process.cwd(), ".runtime", "ai-painter", "natural-home-local-detail-v20-multisource-generalization"),
    }
  }
  if (action === "full_natural_home_v22_warning_focus") {
    return {
      modelVersion: "ai-pet-world-natural-home-v22-warning-focus",
      assetDir: path.join(process.cwd(), ".runtime", "ai-painter", "natural-home-local-detail-v22-warning-focus"),
    }
  }
  if (action === "full_natural_home_v23_candidate_consolidation") {
    return {
      modelVersion: "ai-pet-world-natural-home-v23-candidate-consolidation",
      assetDir: path.join(process.cwd(), ".runtime", "ai-painter", "natural-home-local-detail-v23-candidate-consolidation"),
    }
  }
  if (action === "full_natural_home_v24_diversity_generation") {
    return {
      modelVersion: "ai-pet-world-natural-home-v24-diversity-generation",
      assetDir: path.join(process.cwd(), ".runtime", "ai-painter", "natural-home-v24-diversity-generation"),
    }
  }
  if (action === "full_natural_home_v25_diversity_generalization") {
    return {
      modelVersion: "ai-pet-world-natural-home-v25-diversity-generalization",
      assetDir: path.join(process.cwd(), ".runtime", "ai-painter", "natural-home-v25-diversity-generation"),
    }
  }
  return null
}

function skipped(
  status: TrainingWorldPromotionResult["status"],
  message: string,
): TrainingWorldPromotionResult {
  return {
    attempted: false,
    ok: false,
    status,
    message,
    candidatePath: null,
    approvedFramePath: null,
    reviewStatus: null,
    tags: ["training_world_visual_promotion", "skipped", status],
  }
}
