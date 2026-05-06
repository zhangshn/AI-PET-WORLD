/**
 * 当前文件负责：转换管家状态展示文案。
 */

import type { ButlerState, ButlerTask } from "@/types/butler"

export function getButlerTaskLabel(task?: ButlerTask): string {
  if (!task) return "待命"

  if (task === "watching_incubator") return "照看孵化器"
  if (task === "building_home") return "建设家园"
  if (task === "watching_pet") return "观察宠物"
  if (task === "offering_food") return "提供食物机会"
  if (task === "offering_rest") return "准备恢复环境"
  if (task === "offering_approach") return "尝试靠近"
  if (task === "idle") return "待命"

  return task
}

export function getButlerMoodLabel(mood?: string): string {
  if (!mood) return "平静"

  if (mood === "calm") return "平静"
  if (mood === "busy") return "忙碌"
  if (mood === "gentle") return "温和"
  if (mood === "alert") return "警觉"
  if (mood === "focused") return "专注"

  return mood
}

export function getButlerOpportunityLabel(type?: string): string {
  if (type === "food_offer") return "食物机会"
  if (type === "rest_offer") return "恢复机会"
  if (type === "approach_offer") return "接近机会"

  return "未知机会"
}

export function getButlerMappingModeLabel(mode?: string): string {
  if (mode === "self_projection") return "映射自己"
  if (mode === "parallel_self") return "平行世界"

  return "未设定"
}

export function getButlerBirthTimeModeLabel(mode?: string): string {
  if (mode === "date_only") return "仅日期"
  if (mode === "full_datetime") return "完整时间"

  return "未设定"
}

export function getButlerCareStyleLabel(style?: string): string {
  if (style === "gentle_observer") return "温和观察"
  if (style === "active_supporter") return "主动照护"
  if (style === "protective_guardian") return "保护守护"
  if (style === "quiet_maintainer") return "安静维护"
  if (style === "structured_manager") return "结构管理"

  return "未设定"
}

export function getButlerBuildStyleLabel(style?: string): string {
  if (style === "steady_builder") return "稳步建设"
  if (style === "adaptive_builder") return "适应式建设"
  if (style === "protective_builder") return "保护型建设"
  if (style === "aesthetic_builder") return "审美型建设"
  if (style === "minimal_builder") return "最小维护"

  return "未设定"
}

export function getButlerBoundaryStyleLabel(style?: string): string {
  if (style === "soft_boundary") return "柔和边界"
  if (style === "balanced_boundary") return "平衡边界"
  if (style === "clear_boundary") return "清晰边界"
  if (style === "watchful_boundary") return "观察边界"

  return "未设定"
}

export function getButlerOpportunityStyleLabel(style?: string): string {
  if (style === "offer_gently") return "温和提供"
  if (style === "offer_actively") return "主动提供"
  if (style === "offer_when_needed") return "需要时提供"
  if (style === "offer_after_observation") return "观察后提供"

  return "未设定"
}

export function buildButlerProfileSummary(butler: ButlerState): string {
  const profile = butler.profile

  if (!profile) {
    return "管家 Profile 尚未设定。当前管家只按照基础系统职责运行。"
  }

  return [
    `当前管家采用「${getButlerMappingModeLabel(profile.identity.mappingMode)}」模式。`,
    `它更倾向于「${getButlerCareStyleLabel(profile.careStyle)}」、`,
    `「${getButlerBuildStyleLabel(profile.buildStyle)}」、`,
    `「${getButlerBoundaryStyleLabel(profile.boundaryStyle)}」，`,
    `并以「${getButlerOpportunityStyleLabel(profile.opportunityStyle)}」的方式提供机会。`,
  ].join("")
}

export function buildButlerSummary(butler: ButlerState): string {
  if (butler.task === "watching_incubator") {
    return "管家正在优先确认孵化器状态。它的职责是维护环境，而不是替未来的生命决定性格。"
  }

  if (butler.task === "building_home") {
    return "管家正在推进家园建设。家园会给生命提供更稳定的活动和恢复空间。"
  }

  if (butler.task === "offering_food") {
    return "管家正在提供食物机会。宠物是否接受，仍然由宠物自己的状态和判断决定。"
  }

  if (butler.task === "offering_rest") {
    return "管家正在准备更适合恢复的环境。它只能创造条件，不能强制宠物休息。"
  }

  if (butler.task === "offering_approach") {
    return "管家正在尝试缩短关系距离。宠物是否回应，取决于它自己的安全感和当前倾向。"
  }

  if (butler.task === "watching_pet") {
    return "管家正在观察宠物状态。它会根据环境和生命反应提供机会，但不会直接控制宠物。"
  }

  return "管家暂时保持待命，等待世界状态出现新的需要。"
}