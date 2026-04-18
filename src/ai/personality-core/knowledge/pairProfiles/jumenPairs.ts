/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 巨门系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以巨门为排序更靠前星曜”的组合人格资料。
 *
 * 巨门相关组合通常会强化：
 * - 思辨
 * - 怀疑
 * - 表达
 * - 观察
 * - 反复衡量
 *
 * 这类组合往往不是最直接冲的，
 * 但会很“会想”、很“会看”、很“会说”。
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const jumenPairs: PairProfile[] = [
  {
    pairId: "pair_jumen_taiyang",
    starIds: ["star_03", "star_13"],
    pairCorePersonality: {
      activity: 0.66,
      curiosity: 0.82,
      dependency: 0.36,
      confidence: 0.70,
      sensitivity: 0.58
    },
    summaryText: "表达欲与思辨力加强，既会主动发声，也容易围绕观点不断展开。",
    personalityTags: ["表达", "辩证", "外放", "观察"]
  },
  {
    pairId: "pair_jumen_tianji",
    starIds: ["star_03", "star_08"],
    pairCorePersonality: {
      activity: 0.52,
      curiosity: 0.94,
      dependency: 0.42,
      confidence: 0.56,
      sensitivity: 0.66
    },
    summaryText: "脑力活动非常强，分析、联想、怀疑与推理会持续运转。",
    personalityTags: ["分析", "怀疑", "机敏", "推理"]
  },
  {
    pairId: "pair_jumen_tiantong",
    starIds: ["star_03", "star_11"],
    pairCorePersonality: {
      activity: 0.40,
      curiosity: 0.68,
      dependency: 0.63,
      confidence: 0.38,
      sensitivity: 0.78
    },
    summaryText: "内心感受细腻，但又容易反复想问题，偏向柔和又多虑的状态。",
    personalityTags: ["细腻", "多思", "敏感", "依恋"]
  }
]