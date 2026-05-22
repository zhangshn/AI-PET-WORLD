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
  atmosphereLabel: string
  currentWorldPhaseLabel: string
  companionStatusLabel: string
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
    logItems: [
      `世界运行：当前有 ${result.nextHomeMapState.placements.length} 个可观察对象。`,
      `建设链路：接受 ${acceptedDiffCount} 条 MapDiff，拒绝 ${rejectedDiffCount} 条。`,
      `视觉刷新：${result.visualRefresh.reason}`,
      `生命事件：${result.lifeEventCandidates
        .map((candidate) => candidate.type)
        .join("、")}`,
    ],
    pPhoneMessages: [
      {
        title: "家园摘要",
        body: `当前世界已进入只读展示，${result.nextHomeMapState.placements.length} 个对象来自 HomeMapState。`,
      },
      {
        title: "管家观察",
        body:
          selectedPlanId !== null
            ? `我会优先观察 ${selectedPlanId} 的建设结果，并等待 SafeApply 与视觉刷新确认。`
            : "我会继续观察家园资源、空间和阶段，等待合适的建设机会。",
      },
      {
        title: "伙伴状态",
        body: "伙伴入口保持后置等待，当前不会默认进入主世界。",
      },
    ],
    auditSummary:
      result.audit.warnings.length === 0
        ? "MVP pipeline audit 无警告。"
        : `MVP pipeline audit 警告：${result.audit.warnings.join("；")}`,
    formalVisualModel: result.formalVisualRefresh.formalVisualModel,
    atmosphereLabel: "温暖、安静、自然",
    currentWorldPhaseLabel:
      result.nextHomeMapState.mapDiffs.length > 0
        ? "家园正在运行"
        : "第一片家园已建立",
    companionStatusLabel: "后置等待，尚未接纳",
    tags: [
      "mvp_world_view_model",
      "readonly_projection",
      "no_world_fact_generation",
      ...result.tags,
    ],
  }
}
