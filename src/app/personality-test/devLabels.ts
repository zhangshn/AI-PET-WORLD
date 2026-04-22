/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Test - Dev Labels
 * ======================================================
 *
 * 【文件作用】
 * 仅用于开发调试页面（personality-test）
 *
 * 负责把：
 * - sector（业务宫位）
 * - star（主星）
 * - trait（行为层字段）
 *
 * 转成中文或可读标签。
 *
 * ------------------------------------------------------
 * 【注意】
 * 这个文件只用于“展示层”
 * 不能参与任何算法计算。
 *
 * ------------------------------------------------------
 * 【兼容原则】
 * 当前文件同时保留：
 * - 新命名
 * - 旧测试页命名
 *
 * 这样可以减少 page.tsx 的来回修改。
 * ======================================================
 */

/**
 * ======================================================
 * 宫位中文映射
 * ======================================================
 */
export const SECTOR_LABELS: Record<string, string> = {
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
 * 兼容旧测试页命名
 */
export const DEV_SECTOR_LABELS = SECTOR_LABELS

/**
 * ======================================================
 * 14 主星中文映射
 * ======================================================
 */
export const STAR_LABELS: Record<string, string> = {
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
 * 行为层 traits 中文映射
 * ======================================================
 *
 * 仅用于测试页展示。
 * ======================================================
 */
export const TRAIT_LABELS: Record<string, string> = {
  activity: "活跃度",
  restPreference: "休息偏好",
  appetite: "食欲倾向",
  discipline: "纪律性",
  curiosity: "好奇心",
  emotionalSensitivity: "情绪敏感度",
  stability: "稳定度",
  caregiving: "照料倾向",
  buildingPreference: "建造偏好"
}

/**
 * 兼容旧测试页命名
 */
export const DEV_TRAIT_LABELS = TRAIT_LABELS

/**
 * ======================================================
 * 获取宫位中文
 * ======================================================
 */
export function getSectorLabel(sector?: string): string {
  if (!sector) return "未知宫位"
  return SECTOR_LABELS[sector] || sector
}

/**
 * ======================================================
 * 获取星曜中文
 * ======================================================
 */
export function getStarLabel(star?: string): string {
  if (!star) return "未知星"
  return STAR_LABELS[star] || star
}

/**
 * 兼容旧测试页命名
 */
export function getDevStarLabel(star?: string): string {
  return getStarLabel(star)
}

/**
 * ======================================================
 * 多星转字符串
 * ======================================================
 */
export function formatStars(stars: string[] = []): string {
  if (!stars.length) return "空宫"

  return stars
    .map((star) => getStarLabel(star))
    .join(" / ")
}

/**
 * ======================================================
 * 宫位标题格式化
 * ======================================================
 */
export function formatSectorTitle(
  sector: string,
  isPrimary: boolean
): string {
  const label = getSectorLabel(sector)
  return isPrimary ? `${label} ⭐` : label
}

/**
 * ======================================================
 * Debug 用宫位文本
 * ======================================================
 */
export function formatSectorDebug(
  sector: string,
  stars: string[]
): string {
  return `${getSectorLabel(sector)}：${formatStars(stars)}`
}