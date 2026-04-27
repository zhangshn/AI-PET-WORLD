/**
 * 当前文件负责：根据世界环境判断当前世界生态群落倾向。
 */

import type { WorldEnvironment } from "../ecology/world-environment"

export type WorldBiomeType =
  | "starter_home"
  | "mild_grassland"
  | "quiet_garden"
  | "warm_shelter"
  | "damp_edge"
  | "cold_night_edge"

export type WorldBiomeState = {
  type: WorldBiomeType
  vegetationBias: number
  insectBias: number
  resourceBias: number
  safetyBias: number
  description: string
}

export function resolveWorldBiome(
  environment: WorldEnvironment
): WorldBiomeState {
  if (environment.temperature <= 10 && environment.lightLevel <= 30) {
    return {
      type: "cold_night_edge",
      vegetationBias: 20,
      insectBias: 5,
      resourceBias: 25,
      safetyBias: 35,
      description: "夜间低温让世界边缘显得安静而谨慎。",
    }
  }

  if (environment.humidity >= 68) {
    return {
      type: "damp_edge",
      vegetationBias: 70,
      insectBias: 35,
      resourceBias: 55,
      safetyBias: 45,
      description: "湿度升高，边缘区域更容易出现植物与水汽。",
    }
  }

  if (environment.temperature >= 24 && environment.lightLevel >= 55) {
    return {
      type: "warm_shelter",
      vegetationBias: 55,
      insectBias: 55,
      resourceBias: 45,
      safetyBias: 70,
      description: "温暖光照让庇护区变得舒适。",
    }
  }

  if (environment.lightLevel <= 35 && environment.windLevel <= 30) {
    return {
      type: "quiet_garden",
      vegetationBias: 45,
      insectBias: 20,
      resourceBias: 35,
      safetyBias: 65,
      description: "低光与低风形成安静花园倾向。",
    }
  }

  return {
    type: "mild_grassland",
    vegetationBias: 50,
    insectBias: 35,
    resourceBias: 40,
    safetyBias: 55,
    description: "当前世界处于温和草地区域状态。",
  }
}