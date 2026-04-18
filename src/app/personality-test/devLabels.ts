/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Test - Dev Labels
 * ======================================================
 *
 * 【文件职责】
 * 这个文件是“测试页专用的开发映射文件”。
 *
 * 它只服务于：
 *   /personality-test
 *
 * ------------------------------------------------------
 * 【为什么要单独拆出来】
 * 因为正式产品中不能直接出现紫微斗数术语，
 * 这些名字只允许用于：
 * - 开发调试
 * - 算法校验
 * - 测试页展示
 *
 * 所以这里不能放进正式知识层公共展示出口，
 * 只能放在测试页本地使用。
 *
 * ------------------------------------------------------
 * 【提供内容】
 * 1. 星曜中文名（仅测试页）
 * 2. 宫位中文名（仅测试页）
 * 3. traits 中文名（仅测试页）
 *
 * ======================================================
 */

import type { SectorName, StarId } from "../../ai/personality-core/schema"

/**
 * ======================================================
 * 星曜中文名（仅测试页）
 * ======================================================
 */
export const DEV_STAR_LABELS: Record<StarId, string> = {
  star_00: "空宫",
  star_01: "紫微",
  star_02: "贪狼",
  star_03: "巨门",
  star_04: "廉贞",
  star_05: "武曲",
  star_06: "破军",
  star_07: "天府",
  star_08: "天机",
  star_09: "天相",
  star_10: "天梁",
  star_11: "天同",
  star_12: "七杀",
  star_13: "太阳",
  star_14: "太阴"
}

/**
 * ======================================================
 * 宫位中文名（仅测试页）
 * ======================================================
 */
export const DEV_SECTOR_LABELS: Record<SectorName, string> = {
  life: "命宫",
  siblings: "兄弟",
  spouse: "夫妻",
  children: "子女",
  wealth: "财帛",
  health: "疾厄",
  travel: "迁移",
  friends: "交友",
  career: "官禄",
  property: "田宅",
  fortune: "福德",
  parents: "父母"
}

/**
 * ======================================================
 * 人格参数中文名（仅测试页）
 * ======================================================
 */
export const DEV_TRAIT_LABELS: Record<string, string> = {
  activity: "活跃度",
  restPreference: "休息倾向",
  appetite: "食欲",
  discipline: "自律",
  curiosity: "好奇心",
  emotionalSensitivity: "情绪敏感度",
  stability: "稳定性",
  caregiving: "照料倾向",
  buildingPreference: "建设倾向"
}

/**
 * ======================================================
 * 获取星曜中文名
 * ======================================================
 */
export function getDevStarLabel(starId: StarId): string {
  return DEV_STAR_LABELS[starId] ?? starId
}