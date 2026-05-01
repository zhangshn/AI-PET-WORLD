/**
 * 当前文件负责：集中管理八字动力底盘展示标签。
 */

export const BAZI_ELEMENT_LABELS: Record<string, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
}

export const BAZI_YIN_YANG_LABELS: Record<string, string> = {
  yin: "阴",
  yang: "阳",
}

export const BAZI_DYNAMIC_VECTOR_LABELS: Record<string, string> = {
  growthDrive: "生长驱动",
  expressionDrive: "表达驱动",
  stabilityDrive: "稳定驱动",
  boundaryDrive: "边界驱动",
  perceptionDrive: "感知驱动",
}

export const BAZI_BEHAVIOR_BIAS_LABELS: Record<string, string> = {
  activity: "行动倾向",
  restPreference: "休息偏好",
  emotionalSensitivity: "情绪敏感",
  explorationDrive: "探索驱动",
  caution: "谨慎倾向",
  adaptability: "适应能力",
}

export function getBaziElementLabel(element?: string): string {
  if (!element) return "-"
  return BAZI_ELEMENT_LABELS[element] ?? element
}

export function getBaziYinYangLabel(value?: string): string {
  if (!value) return "-"
  return BAZI_YIN_YANG_LABELS[value] ?? value
}

export function formatBaziScore(value?: number): string {
  if (typeof value !== "number") {
    return "-"
  }

  return String(Math.round(value))
}