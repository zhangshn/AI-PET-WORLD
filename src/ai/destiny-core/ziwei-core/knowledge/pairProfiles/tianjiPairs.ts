/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 天机系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以天机为排序更靠前星曜”的组合人格资料。
 *
 * 天机相关组合通常强化：
 * - 脑力
 * - 观察
 * - 联想
 * - 变化
 * - 机敏
 *
 * 它和不同星组合时，最容易把“人格波动”放大成“思维波动”。
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const tianjiPairs: PairProfile[] = [
  {
    pairId: "pair_tianji_taiyin",
    starIds: ["star_08", "star_14"],
    pairCorePersonality: {
      activity: 0.46,
      curiosity: 0.83,
      dependency: 0.58,
      confidence: 0.36,
      sensitivity: 0.86
    },
    summaryText: "思维细腻而敏感，观察入微，容易把外界变化转化为内在情绪波动。",
    personalityTags: ["细腻", "敏感", "观察", "多思"]
  }
]