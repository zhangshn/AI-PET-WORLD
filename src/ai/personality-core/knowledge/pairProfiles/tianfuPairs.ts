/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 天府系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以天府为排序更靠前星曜”的组合人格资料。
 *
 * 天府相关组合通常强化：
 * - 稳定
 * - 承载
 * - 守成
 * - 资源整合
 * - 安全感
 *
 * 这类组合不是最快的，
 * 但通常很“稳”、很“能装”、很“能守”。
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const tianfuPairs: PairProfile[] = [
  {
    pairId: "pair_tianfu_tianxiang",
    starIds: ["star_07", "star_09"],
    pairCorePersonality: {
      activity: 0.52,
      curiosity: 0.40,
      dependency: 0.42,
      confidence: 0.82,
      sensitivity: 0.52
    },
    summaryText: "稳定、体面、协调感强，偏向维持平衡与秩序的治理型人格。",
    personalityTags: ["平衡", "稳重", "协调", "治理"]
  },
  {
    pairId: "pair_tianfu_taiyin",
    starIds: ["star_07", "star_14"],
    pairCorePersonality: {
      activity: 0.42,
      curiosity: 0.44,
      dependency: 0.63,
      confidence: 0.62,
      sensitivity: 0.76
    },
    summaryText: "稳定感与细腻感结合，重安全、重承载，也重关系中的安稳体验。",
    personalityTags: ["安稳", "细腻", "承载", "安全感"]
  }
]