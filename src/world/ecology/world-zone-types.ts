/**
 * 当前文件负责：定义世界区域类型、区域功能、区域效果与空间范围。
 */

export type WorldZoneType =
  | "sleep_zone"
  | "food_zone"
  | "warm_zone"
  | "quiet_zone"
  | "observation_zone"
  | "incubator_zone"
  | "home_build_zone"
  | "exploration_zone"

export type WorldZoneEffect = {
  comfortBonus: number
  safetyBonus: number
  curiosityBonus: number
  restBonus: number
  stressModifier: number
}

export type WorldZone = {
  id: string
  type: WorldZoneType
  name: string
  x: number
  y: number
  radius: number
  effect: WorldZoneEffect
  isActive: boolean
}