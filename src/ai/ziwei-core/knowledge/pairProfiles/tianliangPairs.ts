/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 天梁系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以天梁为排序更靠前星曜”的组合人格资料。
 *
 * 天梁相关组合通常强化：
 * - 保护
 * - 慈悲
 * - 长辈感
 * - 庇护
 * - 道义感
 *
 * 这类组合往往更容易表现出：
 * “我想照顾、我想维持、我想避免伤害”
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const tianliangPairs: PairProfile[] = [
  {
    pairId: "pair_tianliang_tiantong",
    starIds: ["star_10", "star_11"],
    pairCorePersonality: {
      activity: 0.34,
      curiosity: 0.44,
      dependency: 0.78,
      confidence: 0.34,
      sensitivity: 0.84
    },
    summaryText: "保护欲与和气感并存，重照顾、重关系，也容易变得心软而回避冲突。",
    personalityTags: ["照顾", "心软", "和气", "依恋"]
  }
]