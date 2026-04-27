/**
 * 当前文件负责：定义世界模拟的平衡参数。
 */

export type WorldBalanceConfig = {
  maxCreatures: number
  maxVegetation: number
  maxTemporaryNpcs: number
  baseResourceRegenRate: number
  ecologyTickInterval: number
  civilizationTickInterval: number
}

export const DEFAULT_WORLD_BALANCE: WorldBalanceConfig = {
  maxCreatures: 24,
  maxVegetation: 60,
  maxTemporaryNpcs: 8,
  baseResourceRegenRate: 1,
  ecologyTickInterval: 1,
  civilizationTickInterval: 6,
}