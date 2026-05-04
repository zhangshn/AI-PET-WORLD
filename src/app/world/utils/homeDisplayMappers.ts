/**
 * 当前文件负责：转换家园状态展示文案。
 */

import type {
  HomeConstructionStage,
  HomeEvolutionFocus,
  HomeState,
  HomeStatus,
} from "@/types/home"

export function getHomeStatusLabel(status?: HomeStatus): string {
  if (!status) return "未知"

  if (status === "idle") return "待建设"
  if (status === "building") return "建设中"
  if (status === "completed") return "已完成"

  return status
}

export function getHomeStageLabel(stage?: HomeConstructionStage): string {
  if (!stage) return "未知阶段"

  if (stage === "temporary_shelter") return "临时庇护"
  if (stage === "foundation") return "地基阶段"
  if (stage === "frame") return "框架阶段"
  if (stage === "roof") return "屋顶阶段"
  if (stage === "interior") return "内部整理"
  if (stage === "garden") return "庭院建设"
  if (stage === "completed") return "完整家园"

  return stage
}

export function getHomeFocusLabel(focus?: HomeEvolutionFocus): string {
  if (!focus) return "均衡"

  if (focus === "balanced") return "均衡"
  if (focus === "expansion") return "扩展"
  if (focus === "stability") return "稳定"
  if (focus === "comfort") return "舒适"
  if (focus === "order") return "秩序"
  if (focus === "adaptive") return "适应"

  return focus
}

export function getHomeProgressLabel(progress: number): string {
  return `${Math.round(progress)}%`
}

export function clampHomeMeterValue(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function buildHomeSummary(home: HomeState): string {
  if (home.status === "completed") {
    return "家园已经形成稳定结构。它会继续作为生命体活动、恢复和建立关系的基础空间。"
  }

  if (home.status === "building") {
    return "家园正在建设中。管家会在孵化器和宠物状态允许时推进空间完善。"
  }

  return "家园暂时没有进入明显建设阶段。世界会优先处理孵化器和生命状态。"
}