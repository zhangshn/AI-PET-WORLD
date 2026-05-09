/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge / Labels
 *
 * 功能：
 * 1. 提供 star 中文映射
 * 2. 提供 group 中文映射
 * 3. 动态生成组合显示名称
 *
 * 当前版本重点：
 * - 不再写死 PAIR_LABELS
 * - 组合名由 starId + starId 动态生成
 * ======================================================
 */

export type StarGroupLabel =
  | "group_a"
  | "group_b"
  | "group_c"
  | "group_d"
  | "group_special"

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

export const GROUP_LABELS: Record<StarGroupLabel, string> = {
  group_a: "开创型",
  group_b: "领导型",
  group_c: "支援型",
  group_d: "合作型",
  group_special: "特殊型"
}

export function getStarLabel(starId: string): string {
  return STAR_LABELS[starId] ?? starId
}

export function getGroupLabel(groupType: StarGroupLabel): string {
  return GROUP_LABELS[groupType] ?? groupType
}

/**
 * 动态生成组合名称
 */
export function getPairLabelByStars(
  starIdA: string,
  starIdB: string
): string {
  const sortedStarIds = [starIdA, starIdB].sort()

  const labelA = getStarLabel(sortedStarIds[0])
  const labelB = getStarLabel(sortedStarIds[1])

  return `${labelA}${labelB}`
}