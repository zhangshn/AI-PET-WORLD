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