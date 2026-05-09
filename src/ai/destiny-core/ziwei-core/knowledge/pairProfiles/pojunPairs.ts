/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 破军系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以破军为排序更靠前星曜”的组合人格资料。
 *
 * 破军相关组合常强化：
 * - 破局
 * - 重建
 * - 变化
 * - 冒险
 * - 抗旧秩序
 *
 * 这类组合通常动态很强，
 * 也最容易在系统里体现出“主动打破稳定”的气质。
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const pojunPairs: PairProfile[] = [
  {
    pairId: "pair_pojun_qisha",
    starIds: ["star_06", "star_12"],
    pairCorePersonality: {
      activity: 0.95,
      curiosity: 0.66,
      dependency: 0.08,
      confidence: 0.92,
      sensitivity: 0.20
    },
    summaryText: "极强的行动冲击力与破局倾向，几乎不愿受束缚，转向迅猛。",
    personalityTags: ["极端行动", "破局", "孤决", "强冲击"]
  },
  {
    pairId: "pair_pojun_tianxiang",
    starIds: ["star_06", "star_09"],
    pairCorePersonality: {
      activity: 0.76,
      curiosity: 0.55,
      dependency: 0.26,
      confidence: 0.78,
      sensitivity: 0.45
    },
    summaryText: "破坏性与秩序感并存，常在冲突与平衡之间寻找新结构。",
    personalityTags: ["变动", "重建", "秩序", "拉扯"]
  }
]