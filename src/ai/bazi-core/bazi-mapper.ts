/**
 * 当前文件负责：把八字五行分布映射为 AI 行为动力向量。
 */

import type {
  BaziDynamicsVector,
  WuXingDistribution,
  WuXingElement,
} from "./bazi-types"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function scale(value: number): number {
  return clamp(35 + value * 90)
}

export function mapWuXingToDynamics(
  distribution: WuXingDistribution
): BaziDynamicsVector {
  const fire = distribution.fire
  const water = distribution.water
  const wood = distribution.wood
  const metal = distribution.metal
  const earth = distribution.earth

  return {
    actionIntensity: scale(fire * 0.8 + wood * 0.25),
    reactionSpeed: scale(fire * 0.65 + metal * 0.25 + wood * 0.1),
    sensoryDepth: scale(water * 0.8 + earth * 0.15),
    consistency: scale(metal * 0.75 + earth * 0.25),
    explorationDrive: scale(wood * 0.75 + fire * 0.2),
    stability: scale(earth * 0.8 + water * 0.15),
    persistence: scale(earth * 0.45 + metal * 0.35 + wood * 0.15),
    adaptability: scale(water * 0.45 + wood * 0.35 + fire * 0.1),
  }
}

export function buildBaziDynamicsSummary(input: {
  dominantElements: WuXingElement[]
  dynamics: BaziDynamicsVector
}): string {
  const elementLabelMap: Record<WuXingElement, string> = {
    wood: "木",
    fire: "火",
    earth: "土",
    metal: "金",
    water: "水",
  }

  const dominantText = input.dominantElements
    .map((element) => elementLabelMap[element])
    .join("、")

  const strongestDynamics = Object.entries(input.dynamics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([key]) => key)
    .join("、")

  return `八字动力倾向以 ${dominantText} 为主，AI 行为动力更偏向 ${strongestDynamics}。`
}