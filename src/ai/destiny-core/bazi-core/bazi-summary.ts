/**
 * 当前文件负责：生成八字动力系统摘要、行为标签与解释。
 */

import type {
  BaziBehaviorTag,
  BaziDynamicsInterpretation,
  BaziDynamicsVector,
  BaziMode,
  WuXingElement
} from "./bazi-schema"

const ELEMENT_LABELS: Record<WuXingElement, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
}

export function buildBaziBehaviorTags(
  dynamics: BaziDynamicsVector
): BaziBehaviorTag[] {
  const tags: BaziBehaviorTag[] = []

  if (dynamics.actionIntensity >= 62) tags.push("high_action_release")
  if (dynamics.reactionSpeed >= 62) tags.push("fast_reaction")
  if (dynamics.sensoryDepth >= 62) tags.push("deep_observer")
  if (dynamics.stability >= 62) tags.push("stable_state")
  if (dynamics.consistency >= 62) tags.push("consistent_pattern")
  if (dynamics.explorationDrive >= 62) tags.push("strong_exploration")
  if (dynamics.persistence >= 62) tags.push("persistent_behavior")
  if (dynamics.adaptability >= 62) tags.push("adaptive_response")

  if (tags.length === 0) {
    tags.push("balanced_dynamics")
  }

  return tags
}

export function interpretBaziDynamics(input: {
  dominantElements: WuXingElement[]
  dynamics: BaziDynamicsVector
  behaviorTags: BaziBehaviorTag[]
  mode: BaziMode
}): BaziDynamicsInterpretation {
  const dominantText = input.dominantElements
    .map((element) => ELEMENT_LABELS[element])
    .join(" / ")

  const modeText =
    input.mode === "FOUR_PILLARS"
      ? "当前使用四柱模式，能量动力精度较高。"
      : "当前使用三柱模式，缺少时柱，能量动力以中等精度估算。"

  return {
    title: `八字动力底盘：${dominantText}`,
    summary: `${modeText} 原局能量以 ${dominantText} 为主。`,
    behaviorDescription: [
      `行动强度：${Math.round(input.dynamics.actionIntensity)}`,
      `探索驱动：${Math.round(input.dynamics.explorationDrive)}`,
      `感知深度：${Math.round(input.dynamics.sensoryDepth)}`,
    ],
    newbornTendency: [
      input.dynamics.actionIntensity >= 60
        ? "新生期更容易主动释放动作。"
        : "新生期动作释放较平缓。",
      input.dynamics.sensoryDepth >= 60
        ? "对环境变化更敏感，观察时间更长。"
        : "对环境变化保持中性反应。",
    ],
    butlerTendency: [
      input.dynamics.consistency >= 60
        ? "管家侧更适合稳定节奏照看。"
        : "管家侧需要保留更高弹性。",
    ],
    constructionTendency: [
      input.dynamics.persistence >= 60
        ? "家园建设偏持续推进。"
        : "家园建设偏阶段性推进。",
    ],
  }
}

export function buildBaziProfileSummary(input: {
  mode: BaziMode
  dominantElements: WuXingElement[]
  weakElements: WuXingElement[]
}): string {
  const dominantText = input.dominantElements
    .map((element) => ELEMENT_LABELS[element])
    .join(" / ")

  const weakText = input.weakElements
    .map((element) => ELEMENT_LABELS[element])
    .join(" / ")

  const modeText =
    input.mode === "FOUR_PILLARS"
      ? "当前为四柱模式。"
      : "当前为三柱模式，出生时辰未知，时柱不参与原局计算。"

  return `${modeText} 原局主导能量为 ${dominantText}，相对弱项为 ${weakText}。八字在当前系统中作为 AI 生命的能量动力层，用于影响行动节奏、感知深度、恢复方式与环境适应。`
}