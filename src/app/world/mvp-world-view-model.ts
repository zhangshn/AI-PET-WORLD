/**
 * 当前文件职责：把 MVP pipeline result 转换为 /world 只读 ViewModel。
 */

import type { FormalVisualModel } from "@/world/formal-visual-model/formal-visual-model-gateway"
import type { AiPetWorldMvpPipelineResult } from "@/world/mvp-core/mvp-core-schema"

export type MvpWorldViewModel = {
  worldSummary: string
  butlerSummary: string
  constructionSummary: string
  logItems: string[]
  pPhoneMessages: Array<{
    title: string
    body: string
  }>
  auditSummary: string
  formalVisualModel: FormalVisualModel | null
  tags: string[]
}

export function buildMvpWorldViewModel(
  result: AiPetWorldMvpPipelineResult
): MvpWorldViewModel {
  const selectedPlanId =
    result.runtimeTick.constructionResult.fullPipelineAudit.selectedPlanId
  const acceptedDiffCount =
    result.runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds
      .length
  const rejectedDiffCount =
    result.runtimeTick.constructionResult.fullPipelineAudit.rejectedDiffIds
      .length

  return {
    worldSummary: [
      `世界 ${result.nextHomeMapState.worldId}`,
      `Owner ${result.nextHomeMapState.ownerId}`,
      `${result.nextHomeMapState.placements.length} 个世界对象`,
      `${result.nextHomeMapState.mapDiffs.length} 条 MapDiff`,
    ].join(" / "),
    butlerSummary: [
      result.butlerProfile.displayName,
      `说明语气：${result.butlerProfile.explanationTone}`,
      `生活节律：${result.butlerProfile.lifeRhythmBias}`,
    ].join(" / "),
    constructionSummary: [
      `计划：${selectedPlanId ?? "未选择"}`,
      `已接受 diff：${acceptedDiffCount}`,
      `已拒绝 diff：${rejectedDiffCount}`,
    ].join(" / "),
    logItems: result.worldLogs.map((log) => `${log.title}: ${log.body}`),
    pPhoneMessages: result.pPhoneData.messages.map((message) => ({
      title: message.title,
      body: message.body,
    })),
    auditSummary:
      result.audit.warnings.length === 0
        ? "MVP pipeline audit 无警告。"
        : `MVP pipeline audit 警告：${result.audit.warnings.join("；")}`,
    formalVisualModel: result.formalVisualRefresh.formalVisualModel,
    tags: [
      "mvp_world_view_model",
      "readonly_projection",
      "no_world_fact_generation",
      ...result.tags,
    ],
  }
}
