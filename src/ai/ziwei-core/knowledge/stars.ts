/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge - Stars
 * ======================================================
 *
 * 【文件职责】
 * 这个文件只负责定义“星曜实体本身”，不负责人格计算。
 *
 * 它负责：
 * 1. 定义当前系统里有哪些基础星曜
 * 2. 定义每颗星的基础信息
 * 3. 提供按 ID 查询星曜的方法
 *
 * ------------------------------------------------------
 * 【当前范围】
 * 当前简化版本只使用：
 * - star_00 = 空宫
 * - star_01 ~ star_14 = 14 主星
 *
 * 不接入：
 * - 杂曜
 * - 辅星
 * - 小星
 * - 四化
 *
 * ------------------------------------------------------
 * 【注意】
 * - 这个文件不定义人格
 * - 单星人格定义在 starProfiles.ts
 * - 双星组合关系定义在 pairRelations.ts
 * - 双星组合人格定义在 pairProfiles/*
 *
 * ======================================================
 */

import type { StarId } from "../schema"

/**
 * ======================================================
 * 星曜类别
 * ======================================================
 */
export type StarCategory =
  | "empty"
  | "main"

/**
 * ======================================================
 * 星曜实体结构
 * ======================================================
 */
export interface StarDefinition {
  /**
   * 星曜唯一 ID
   */
  starId: StarId

  /**
   * 中文名
   */
  label: string

  /**
   * 类别
   */
  category: StarCategory

  /**
   * 当前是否启用
   */
  enabled: boolean
}

/**
 * ======================================================
 * 全部星曜定义
 * ======================================================
 */
export const stars: Record<StarId, StarDefinition> = {
  star_00: {
    starId: "star_00",
    label: "空宫",
    category: "empty",
    enabled: true
  },

  star_01: {
    starId: "star_01",
    label: "紫微",
    category: "main",
    enabled: true
  },
  star_02: {
    starId: "star_02",
    label: "贪狼",
    category: "main",
    enabled: true
  },
  star_03: {
    starId: "star_03",
    label: "巨门",
    category: "main",
    enabled: true
  },
  star_04: {
    starId: "star_04",
    label: "廉贞",
    category: "main",
    enabled: true
  },
  star_05: {
    starId: "star_05",
    label: "武曲",
    category: "main",
    enabled: true
  },
  star_06: {
    starId: "star_06",
    label: "破军",
    category: "main",
    enabled: true
  },
  star_07: {
    starId: "star_07",
    label: "天府",
    category: "main",
    enabled: true
  },
  star_08: {
    starId: "star_08",
    label: "天机",
    category: "main",
    enabled: true
  },
  star_09: {
    starId: "star_09",
    label: "天相",
    category: "main",
    enabled: true
  },
  star_10: {
    starId: "star_10",
    label: "天梁",
    category: "main",
    enabled: true
  },
  star_11: {
    starId: "star_11",
    label: "天同",
    category: "main",
    enabled: true
  },
  star_12: {
    starId: "star_12",
    label: "七杀",
    category: "main",
    enabled: true
  },
  star_13: {
    starId: "star_13",
    label: "太阳",
    category: "main",
    enabled: true
  },
  star_14: {
    starId: "star_14",
    label: "太阴",
    category: "main",
    enabled: true
  }
}

/**
 * ======================================================
 * 通过 starId 获取单个星曜定义
 * ======================================================
 */
export function getStarById(starId: StarId): StarDefinition | null {
  return stars[starId] ?? null
}

/**
 * ======================================================
 * 获取全部星曜定义
 * ======================================================
 */
export function getAllStars(): StarDefinition[] {
  return Object.values(stars)
}