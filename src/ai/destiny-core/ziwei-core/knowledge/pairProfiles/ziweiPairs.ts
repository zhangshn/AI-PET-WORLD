/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Pair Profiles - 紫微系组合
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只定义：
 * “以紫微为排序更靠前星曜”的组合人格资料
 *
 * ------------------------------------------------------
 * 【为什么这么拆】
 * 我们现在已经统一：
 * 组合人格资料按“星曜入口”拆分，而不是按人格类别拆分。
 *
 * 所以：
 * - 紫微 + 破军
 * - 紫微 + 天府
 * - 紫微 + 七杀
 * - 紫微 + 贪狼
 * - 紫微 + 天相
 *
 * 都放在这里。
 *
 * ------------------------------------------------------
 * 【注意】
 * 同一个组合只能写一次，不要在别的文件里再反向重复写。
 * 例如：
 * 紫微 + 破军 只写这里，
 * pojunPairs.ts 里不要再写 破军 + 紫微。
 *
 * ======================================================
 */

import type { PairProfile } from "./types"

export const ziweiPairs: PairProfile[] = [
  {
    pairId: "pair_ziwei_tianfu",
    starIds: ["star_01", "star_07"],
    pairCorePersonality: {
      activity: 0.62,
      curiosity: 0.42,
      dependency: 0.30,
      confidence: 0.96,
      sensitivity: 0.40
    },
    summaryText: "统御感与守成力并重，既重秩序，也重稳定与资源掌控。",
    personalityTags: ["统御", "稳重", "守成", "秩序"]
  },
  {
    pairId: "pair_ziwei_pojun",
    starIds: ["star_01", "star_06"],
    pairCorePersonality: {
      activity: 0.82,
      curiosity: 0.58,
      dependency: 0.18,
      confidence: 0.95,
      sensitivity: 0.33
    },
    summaryText: "主导欲与破局欲并存，既想掌控局面，也想主动改造旧秩序。",
    personalityTags: ["主导", "破局", "强势", "重构"]
  },
  {
    pairId: "pair_ziwei_qisha",
    starIds: ["star_01", "star_12"],
    pairCorePersonality: {
      activity: 0.80,
      curiosity: 0.50,
      dependency: 0.14,
      confidence: 0.97,
      sensitivity: 0.26
    },
    summaryText: "强烈的核心意志与决断力叠加，带有极强的掌控感与压迫感。",
    personalityTags: ["决断", "强控", "压迫", "孤锋"]
  },
  {
    pairId: "pair_ziwei_tanlang",
    starIds: ["star_01", "star_02"],
    pairCorePersonality: {
      activity: 0.78,
      curiosity: 0.72,
      dependency: 0.28,
      confidence: 0.89,
      sensitivity: 0.48
    },
    summaryText: "掌控欲与欲望表达交织，既追求中心地位，也追求丰富体验。",
    personalityTags: ["主导", "欲望", "社交", "扩张"]
  },
  {
    pairId: "pair_ziwei_tianxiang",
    starIds: ["star_01", "star_09"],
    pairCorePersonality: {
      activity: 0.61,
      curiosity: 0.46,
      dependency: 0.38,
      confidence: 0.90,
      sensitivity: 0.50
    },
    summaryText: "领导力中带有秩序感与体面意识，偏向制度化、平衡型主导。",
    personalityTags: ["领导", "秩序", "体面", "平衡"]
  }
]