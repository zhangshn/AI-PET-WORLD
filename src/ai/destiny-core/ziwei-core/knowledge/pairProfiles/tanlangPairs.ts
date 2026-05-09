/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 贪狼系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以贪狼为排序更靠前星曜”的组合人格资料。
 *
 * 贪狼的组合通常会强化：
 * - 欲望
 * - 社交性
 * - 新鲜体验
 * - 变化欲
 * - 吸引与试探
 *
 * 所以它的组合人格经常更“活”、更“动”、更“容易被世界牵引”。
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const tanlangPairs: PairProfile[] = [
  {
    pairId: "pair_tanlang_lianzhen",
    starIds: ["star_02", "star_04"],
    pairCorePersonality: {
      activity: 0.86,
      curiosity: 0.70,
      dependency: 0.24,
      confidence: 0.84,
      sensitivity: 0.56
    },
    summaryText: "欲望驱动与原则控制同时存在，既想要，也想掌控边界与节奏。",
    personalityTags: ["欲望", "控制", "边界", "张力"]
  },
  {
    pairId: "pair_tanlang_wuqu",
    starIds: ["star_02", "star_05"],
    pairCorePersonality: {
      activity: 0.79,
      curiosity: 0.63,
      dependency: 0.24,
      confidence: 0.86,
      sensitivity: 0.40
    },
    summaryText: "现实执行力与体验欲结合，既重资源，也重结果与满足感。",
    personalityTags: ["务实", "欲望", "执行", "资源"]
  },
  {
    pairId: "pair_tanlang_pojun",
    starIds: ["star_02", "star_06"],
    pairCorePersonality: {
      activity: 0.93,
      curiosity: 0.82,
      dependency: 0.18,
      confidence: 0.80,
      sensitivity: 0.44
    },
    summaryText: "变化、冲动与新鲜感极强，不喜欢被固定，偏好主动突破与冒险。",
    personalityTags: ["冒险", "变化", "冲动", "探索"]
  },
  {
    pairId: "pair_tanlang_jumen",
    starIds: ["star_02", "star_03"],
    pairCorePersonality: {
      activity: 0.73,
      curiosity: 0.86,
      dependency: 0.40,
      confidence: 0.66,
      sensitivity: 0.63
    },
    summaryText: "体验欲与思辨欲并存，既想靠近世界，也会反复分析与试探。",
    personalityTags: ["试探", "表达", "多思", "社交"]
  }
]