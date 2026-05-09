/**
 * 当前文件负责：把八字动力结果适配为人格解释核心的辅助动力。
 */

import type { BaziProfile } from "../../destiny-core/bazi-core/bazi-types"

import type {
  BaziDynamicsSupportItem,
  BaziDynamicsSupportKey,
  BaziDynamicsSupportProfile,
} from "./interpretation-schema"
import {
  getInterpretationScoreLevelLabel,
  resolveInterpretationScoreLevel,
} from "./interpretation-utils"

type BaziSupportRule = {
  key: BaziDynamicsSupportKey
  label: string
  summaryPrefix: string
}

const BAZI_SUPPORT_RULES: Record<BaziDynamicsSupportKey, BaziSupportRule> = {
  actionIntensity: {
    key: "actionIntensity",
    label: "行动强度",
    summaryPrefix: "行动释放力度",
  },
  reactionSpeed: {
    key: "reactionSpeed",
    label: "反应速度",
    summaryPrefix: "对变化的反应速度",
  },
  sensoryDepth: {
    key: "sensoryDepth",
    label: "感知深度",
    summaryPrefix: "对环境和关系氛围的感知深度",
  },
  consistency: {
    key: "consistency",
    label: "一致性",
    summaryPrefix: "行为模式的一致性",
  },
  explorationDrive: {
    key: "explorationDrive",
    label: "探索动力",
    summaryPrefix: "主动接触未知的动力",
  },
  stability: {
    key: "stability",
    label: "稳定动力",
    summaryPrefix: "维持稳定状态的动力",
  },
  persistence: {
    key: "persistence",
    label: "持续力",
    summaryPrefix: "持续推进一件事的能力",
  },
  adaptability: {
    key: "adaptability",
    label: "适应力",
    summaryPrefix: "面对环境变化的适应力",
  },
}

const BAZI_SUPPORT_ORDER: BaziDynamicsSupportKey[] = [
  "actionIntensity",
  "reactionSpeed",
  "sensoryDepth",
  "consistency",
  "explorationDrive",
  "stability",
  "persistence",
  "adaptability",
]

function readBaziDynamicsScore(
  profile: BaziProfile,
  key: BaziDynamicsSupportKey
): number {
  const value = profile.dynamics[key]

  if (typeof value !== "number") {
    return 50
  }

  return Math.round(value)
}

function buildBaziSupportSummary(input: {
  rule: BaziSupportRule
  score: number
}): string {
  const level = resolveInterpretationScoreLevel(input.score)
  const levelLabel = getInterpretationScoreLevelLabel(level)

  return `${input.rule.summaryPrefix}${levelLabel}。`
}

function buildBaziSupportItem(input: {
  profile: BaziProfile
  key: BaziDynamicsSupportKey
}): BaziDynamicsSupportItem {
  const rule = BAZI_SUPPORT_RULES[input.key]
  const score = readBaziDynamicsScore(input.profile, input.key)
  const level = resolveInterpretationScoreLevel(score)

  return {
    key: rule.key,
    label: rule.label,
    score,
    level,
    summary: buildBaziSupportSummary({
      rule,
      score,
    }),
  }
}

function buildBaziDynamicsSupportSummary(input: {
  profile: BaziProfile
  strongestItems: BaziDynamicsSupportItem[]
}): string {
  const strongestText = input.strongestItems
    .map((item) => item.label)
    .join("、")

  const dominantText =
    input.profile.dominantElements.length > 0
      ? input.profile.dominantElements.join("、")
      : "无明显偏旺元素"

  return `八字作为辅助动力参与解释。当前较明显的动力项为${strongestText}；五行偏向为${dominantText}。八字只修正动力强弱和节奏，不推翻紫微主结构。`
}

export function adaptBaziDynamicsSupport(input: {
  baziProfile: BaziProfile
}): BaziDynamicsSupportProfile {
  const items = BAZI_SUPPORT_ORDER.map((key) =>
    buildBaziSupportItem({
      profile: input.baziProfile,
      key,
    })
  )

  const strongestItems = [...items]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return {
    items,
    dominantElements: input.baziProfile.dominantElements,
    weakElements: input.baziProfile.weakElements,
    summary: buildBaziDynamicsSupportSummary({
      profile: input.baziProfile,
      strongestItems,
    }),
    debug: {
      source: "bazi",
      note: "八字在本模块中只作为辅助动力适配器使用，不决定生命功能来源，不修改紫微结构。",
    },
  }
}