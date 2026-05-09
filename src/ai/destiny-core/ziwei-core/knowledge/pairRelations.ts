/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge - Pair Relations
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只负责定义：
 * 1. 哪两颗主星可以构成一个“组合关系”
 * 2. 每个组合关系对应的唯一 pairId
 * 3. 当前是否默认启用
 *
 * ------------------------------------------------------
 * 【这个文件不负责什么】
 * 它不负责：
 * - 组合人格数值
 * - 组合摘要文案
 * - personalityTags
 *
 * 这些内容都应该放在：
 *   knowledge/pairProfiles/*
 *
 * 也就是说：
 * - pairRelations.ts 回答：谁和谁是一组
 * - pairProfiles/* 回答：这组代表什么人格
 *
 * ------------------------------------------------------
 * 【为什么这个文件很重要】
 * mapper.ts 在判断命宫双星时，流程是：
 *
 * 1. 取出命宫双星 starA / starB
 * 2. 调用 getPairRelation(starA, starB)
 * 3. 通过返回的 pairId 去 getPairProfile(pairId)
 * 4. 再拿到组合人格
 *
 * 所以如果这里的 pairId 和 pairProfiles/* 中的 pairId 不一致，
 * 就会出现：
 * - 命中了关系
 * - 但查不到组合人格
 * - 最后 hitPairs / summaries / 组合人格全失效
 *
 * ------------------------------------------------------
 * 【当前正式规则】
 * 1. 当前只处理 24 组简化双星组合
 * 2. pairId 采用可读命名：
 *    pair_ziwei_tianfu
 *    pair_tianji_taiyin
 *    ...
 * 3. starIds 顺序必须固定
 * 4. getPairRelation() 内部会自动排序后匹配，
 *    所以：
 *    getPairRelation("star_07", "star_01")
 *    也能命中 pair_ziwei_tianfu
 *
 * ======================================================
 */

import type { StarId } from "../schema"

/**
 * ======================================================
 * PairRelation
 * ======================================================
 *
 * 说明：
 * - pairId：组合唯一标识
 * - starIds：组成该组合的两颗主星（顺序固定）
 * - enabledByDefault：默认是否启用
 * ======================================================
 */
export interface PairRelation {
  pairId: string
  starIds: [StarId, StarId]
  enabledByDefault: boolean
}

/**
 * ======================================================
 * 星曜顺序表
 * ======================================================
 *
 * 作用：
 * - 用于标准化组合顺序
 * - 保证：
 *   [star_01, star_07] 和 [star_07, star_01]
 *   会被视为同一个组合
 *
 * 当前顺序即你已经统一的主星顺序：
 * star_00 = 空宫（不参与双星组合）
 * star_01 ~ star_14 = 14 主星
 * ======================================================
 */
const STAR_ORDER: StarId[] = [
  "star_00",
  "star_01",
  "star_02",
  "star_03",
  "star_04",
  "star_05",
  "star_06",
  "star_07",
  "star_08",
  "star_09",
  "star_10",
  "star_11",
  "star_12",
  "star_13",
  "star_14"
]

/**
 * ======================================================
 * 工具函数：标准化双星顺序
 * ======================================================
 *
 * 说明：
 * - 不管输入顺序是什么
 * - 最终都按 STAR_ORDER 的顺序输出
 *
 * 例如：
 * normalizeStarPair("star_07", "star_01")
 * -> ["star_01", "star_07"]
 * ======================================================
 */
function normalizeStarPair(
  starA: StarId,
  starB: StarId
): [StarId, StarId] {
  const indexA = STAR_ORDER.indexOf(starA)
  const indexB = STAR_ORDER.indexOf(starB)

  if (indexA <= indexB) {
    return [starA, starB]
  }

  return [starB, starA]
}

/**
 * ======================================================
 * 当前启用的 24 组双星组合关系
 * ======================================================
 *
 * 注意：
 * 这里的 pairId 必须与 pairProfiles/* 中保持完全一致。
 * ======================================================
 */
export const pairRelations: PairRelation[] = [
  /**
   * ----------------------------------------------------
   * 紫微系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_ziwei_tianfu",
    starIds: ["star_01", "star_07"],
    enabledByDefault: true
  },
  {
    pairId: "pair_ziwei_pojun",
    starIds: ["star_01", "star_06"],
    enabledByDefault: true
  },
  {
    pairId: "pair_ziwei_qisha",
    starIds: ["star_01", "star_12"],
    enabledByDefault: true
  },
  {
    pairId: "pair_ziwei_tanlang",
    starIds: ["star_01", "star_02"],
    enabledByDefault: true
  },
  {
    pairId: "pair_ziwei_tianxiang",
    starIds: ["star_01", "star_09"],
    enabledByDefault: true
  },

  /**
   * ----------------------------------------------------
   * 贪狼系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_tanlang_lianzhen",
    starIds: ["star_02", "star_04"],
    enabledByDefault: true
  },
  {
    pairId: "pair_tanlang_wuqu",
    starIds: ["star_02", "star_05"],
    enabledByDefault: true
  },
  {
    pairId: "pair_tanlang_pojun",
    starIds: ["star_02", "star_06"],
    enabledByDefault: true
  },
  {
    pairId: "pair_tanlang_jumen",
    starIds: ["star_02", "star_03"],
    enabledByDefault: true
  },

  /**
   * ----------------------------------------------------
   * 巨门系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_jumen_taiyang",
    starIds: ["star_03", "star_13"],
    enabledByDefault: true
  },
  {
    pairId: "pair_jumen_tianji",
    starIds: ["star_03", "star_08"],
    enabledByDefault: true
  },
  {
    pairId: "pair_jumen_tiantong",
    starIds: ["star_03", "star_11"],
    enabledByDefault: true
  },

  /**
   * ----------------------------------------------------
   * 廉贞系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_lianzhen_qisha",
    starIds: ["star_04", "star_12"],
    enabledByDefault: true
  },
  {
    pairId: "pair_lianzhen_pojun",
    starIds: ["star_04", "star_06"],
    enabledByDefault: true
  },
  {
    pairId: "pair_lianzhen_tianfu",
    starIds: ["star_04", "star_07"],
    enabledByDefault: true
  },

  /**
   * ----------------------------------------------------
   * 武曲系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_wuqu_qisha",
    starIds: ["star_05", "star_12"],
    enabledByDefault: true
  },
  {
    pairId: "pair_wuqu_tianfu",
    starIds: ["star_05", "star_07"],
    enabledByDefault: true
  },
  {
    pairId: "pair_wuqu_tianxiang",
    starIds: ["star_05", "star_09"],
    enabledByDefault: true
  },

  /**
   * ----------------------------------------------------
   * 破军系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_pojun_qisha",
    starIds: ["star_06", "star_12"],
    enabledByDefault: true
  },
  {
    pairId: "pair_pojun_tianxiang",
    starIds: ["star_06", "star_09"],
    enabledByDefault: true
  },

  /**
   * ----------------------------------------------------
   * 天府系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_tianfu_tianxiang",
    starIds: ["star_07", "star_09"],
    enabledByDefault: true
  },
  {
    pairId: "pair_tianfu_taiyin",
    starIds: ["star_07", "star_14"],
    enabledByDefault: true
  },

  /**
   * ----------------------------------------------------
   * 天机系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_tianji_taiyin",
    starIds: ["star_08", "star_14"],
    enabledByDefault: true
  },

  /**
   * ----------------------------------------------------
   * 天梁系
   * ----------------------------------------------------
   */
  {
    pairId: "pair_tianliang_tiantong",
    starIds: ["star_10", "star_11"],
    enabledByDefault: true
  }
]

/**
 * ======================================================
 * 通过两颗主星获取组合关系
 * ======================================================
 *
 * 说明：
 * - 这个函数会自动标准化顺序
 * - 所以调用时不需要自己先排序
 *
 * 例如：
 * getPairRelation("star_07", "star_01")
 * 也会正常命中 pair_ziwei_tianfu
 *
 * 过滤规则：
 * - 空宫 star_00 不参与组合
 * - 同一颗星不构成组合
 * ======================================================
 */
export function getPairRelation(
  starA: StarId,
  starB: StarId
): PairRelation | null {
  /**
   * 空宫不参与双星组合
   */
  if (starA === "star_00" || starB === "star_00") {
    return null
  }

  /**
   * 同星不构成双星组合
   */
  if (starA === starB) {
    return null
  }

  const normalized = normalizeStarPair(starA, starB)

  return (
    pairRelations.find((item) => {
      return (
        item.starIds[0] === normalized[0] &&
        item.starIds[1] === normalized[1]
      )
    }) ?? null
  )
}

/**
 * ======================================================
 * 获取全部组合关系
 * ======================================================
 */
export function getAllPairRelations(): PairRelation[] {
  return pairRelations
}