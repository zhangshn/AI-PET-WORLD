/**
 * 当前文件负责：集中管理八字动态面板展示标签。
 */

export const BAZI_RUNTIME_ELEMENT_LABELS: Record<string, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
}

export const BAZI_RUNTIME_MODIFIER_LABELS: Record<string, string> = {
  activityModifier: "行动修正",
  emotionModifier: "情绪修正",
  recoveryModifier: "恢复修正",
  cautionModifier: "谨慎修正",
  explorationModifier: "探索修正",
  perceptionModifier: "感知修正",
}

export function getBaziRuntimeElementLabel(element: string): string {
  return BAZI_RUNTIME_ELEMENT_LABELS[element] ?? element
}

export function getBaziRuntimeDirectionLabel(direction: string): string {
  if (direction === "forward") return "顺行"
  if (direction === "backward") return "逆行"
  return direction
}

export function getBaziRuntimeGenderLabel(gender: string): string {
  if (gender === "male") return "男"
  if (gender === "female") return "女"
  return "未知"
}

export function formatRuntimeScore(value?: number): string {
  if (typeof value !== "number") {
    return "-"
  }

  return String(Math.round(value))
}