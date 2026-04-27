/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 武曲系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以武曲为排序更靠前星曜”的组合人格资料。
 *
 * 武曲相关组合通常强化：
 * - 执行
 * - 现实
 * - 资源意识
 * - 抗压
 * - 结果导向
 *
 * 这类组合多数比较“硬”，
 * 也更容易和“效率”“控制”“资源”绑定。
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const wuquPairs: PairProfile[] = [
  {
    pairId: "pair_wuqu_qisha",
    starIds: ["star_05", "star_12"],
    pairCorePersonality: {
      activity: 0.82,
      curiosity: 0.42,
      dependency: 0.12,
      confidence: 0.94,
      sensitivity: 0.22
    },
    summaryText: "执行力与决断力极强，偏冷硬、偏直接，重结果胜过过程。",
    personalityTags: ["执行", "冷硬", "果断", "结果导向"]
  },
  {
    pairId: "pair_wuqu_tianfu",
    starIds: ["star_05", "star_07"],
    pairCorePersonality: {
      activity: 0.63,
      curiosity: 0.36,
      dependency: 0.28,
      confidence: 0.90,
      sensitivity: 0.32
    },
    summaryText: "资源掌控、执行稳定与守成能力兼备，偏强结构型人格。",
    personalityTags: ["资源", "稳定", "执行", "守成"]
  },
  {
    pairId: "pair_wuqu_tianxiang",
    starIds: ["star_05", "star_09"],
    pairCorePersonality: {
      activity: 0.60,
      curiosity: 0.40,
      dependency: 0.34,
      confidence: 0.84,
      sensitivity: 0.46
    },
    summaryText: "务实执行与秩序平衡结合，既有硬度，也有外部规则感。",
    personalityTags: ["务实", "秩序", "执行", "平衡"]
  }
]