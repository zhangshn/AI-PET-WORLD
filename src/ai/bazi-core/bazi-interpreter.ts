/**
 * 当前文件负责：把八字五行与动力向量解释成 AI 行为说明。
 */

import type {
  BaziBehaviorTag,
  BaziDynamicsInterpretation,
  BaziDynamicsVector,
  WuXingElement,
} from "./bazi-types"

const ELEMENT_LABELS: Record<WuXingElement, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
}

const TAG_LABELS: Record<BaziBehaviorTag, string> = {
  high_action_release: "行动释放强",
  fast_reaction: "反应速度快",
  deep_observer: "观察深度高",
  stable_state: "状态稳定",
  consistent_pattern: "行为模式一致",
  strong_exploration: "探索驱动力强",
  persistent_behavior: "持续性强",
  adaptive_response: "适应能力强",
  balanced_dynamics: "动力结构均衡",
}

function pickTopDynamics(dynamics: BaziDynamicsVector): string[] {
  return Object.entries(dynamics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key)
}

export function interpretBaziDynamics(input: {
  dominantElements: WuXingElement[]
  dynamics: BaziDynamicsVector
  behaviorTags: BaziBehaviorTag[]
}): BaziDynamicsInterpretation {
  const dominantText = input.dominantElements
    .map((element) => ELEMENT_LABELS[element])
    .join("、")

  const tagText = input.behaviorTags
    .map((tag) => TAG_LABELS[tag])
    .join("、")

  const topDynamics = pickTopDynamics(input.dynamics)

  const behaviorDescription: string[] = []

  if (input.dominantElements.includes("fire")) {
    behaviorDescription.push("火势较明显：行动释放更快，面对刺激时更容易立刻产生反应。")
  }

  if (input.dominantElements.includes("water")) {
    behaviorDescription.push("水势较明显：更偏向观察、感知和延迟决策，不会立刻冲动行动。")
  }

  if (input.dominantElements.includes("wood")) {
    behaviorDescription.push("木势较明显：更容易产生探索、成长、扩展和尝试新路径的倾向。")
  }

  if (input.dominantElements.includes("metal")) {
    behaviorDescription.push("金势较明显：行为更有规则感，倾向重复稳定路线和明确秩序。")
  }

  if (input.dominantElements.includes("earth")) {
    behaviorDescription.push("土势较明显：状态维持能力强，行为变化较慢，但持续性更好。")
  }

  const newbornTendency = [
    input.dynamics.actionIntensity >= 62
      ? "新生阶段可能更快尝试移动，但仍应被限制在孵化器和小屋附近。"
      : "新生阶段不会立刻大范围行动，更适合先观察和适应。",
    input.dynamics.sensoryDepth >= 62
      ? "会更频繁观察环境变化，例如光线、声音、管家的靠近。"
      : "对环境细节的反应较直接，不会长时间停留在观察状态。",
    input.dynamics.stability >= 62
      ? "状态波动较小，适合较平稳地进入适应期。"
      : "状态可能更容易被环境刺激打断，需要管家更频繁确认。"
  ]

  const butlerTendency = [
    input.dynamics.consistency >= 62
      ? "管家行为更容易形成固定照看节奏，例如定时检查孵化器和新生宠物。"
      : "管家行为更灵活，会根据当前环境临时调整照看方式。",
    input.dynamics.actionIntensity >= 62
      ? "管家在发现问题时更倾向快速处理，而不是长时间等待。"
      : "管家更倾向先观察确认，再采取行动。",
    input.dynamics.persistence >= 62
      ? "管家对长期建设任务更有持续推进能力。"
      : "管家更可能在照顾、观察、建设之间频繁切换。"
  ]

  const constructionTendency = [
    input.dynamics.explorationDrive >= 62
      ? "建筑规划更容易向外扩张，较早开辟花园、路径和探索区。"
      : "建筑规划更偏保守，会优先完善小屋和核心生活区。",
    input.dynamics.stability >= 62
      ? "家园布局更重视稳定、安全、耐用和长期维护。"
      : "家园布局更容易根据状态和需求快速变化。",
    input.dynamics.adaptability >= 62
      ? "面对天气、资源和宠物需求变化时，更容易调整建设计划。"
      : "建设路线更偏固定，调整速度较慢。"
  ]

  return {
    title: `八字动力主轴：${dominantText}`,
    summary: `当前八字动力以 ${dominantText} 为主，行为标签为：${tagText}。核心动力参数集中在：${topDynamics.join("、")}。`,
    behaviorDescription,
    newbornTendency,
    butlerTendency,
    constructionTendency,
  }
}