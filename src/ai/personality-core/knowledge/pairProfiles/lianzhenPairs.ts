/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 廉贞系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以廉贞为排序更靠前星曜”的组合人格资料。
 *
 * 廉贞相关组合常见的放大方向：
 * - 原则
 * - 控制
 * - 意志
 * - 边界
 * - 情绪中的刚性
 *
 * 这类组合往往带有：
 * “我不仅有态度，而且很难轻易退让”
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const lianzhenPairs: PairProfile[] = [
  {
    pairId: "pair_lianzhen_qisha",
    starIds: ["star_04", "star_12"],
    pairCorePersonality: {
      activity: 0.86,
      curiosity: 0.52,
      dependency: 0.14,
      confidence: 0.93,
      sensitivity: 0.30
    },
    summaryText: "强意志、强边界、强决断叠加，带有明显的压迫感与执行狠劲。",
    personalityTags: ["强势", "决断", "边界", "压迫"]
  },
  {
    pairId: "pair_lianzhen_pojun",
    starIds: ["star_04", "star_06"],
    pairCorePersonality: {
      activity: 0.89,
      curiosity: 0.63,
      dependency: 0.18,
      confidence: 0.86,
      sensitivity: 0.36
    },
    summaryText: "控制欲与破坏欲并存，既想设定规则，也会主动推翻旧局。",
    personalityTags: ["控制", "破局", "冲劲", "变动"]
  },
  {
    pairId: "pair_lianzhen_tianfu",
    starIds: ["star_04", "star_07"],
    pairCorePersonality: {
      activity: 0.64,
      curiosity: 0.48,
      dependency: 0.30,
      confidence: 0.84,
      sensitivity: 0.46
    },
    summaryText: "原则与稳重相结合，既强调边界，也重视可持续的掌控。",
    personalityTags: ["原则", "稳定", "掌控", "守成"]
  }
]