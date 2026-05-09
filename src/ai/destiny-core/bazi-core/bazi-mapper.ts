/**
 * 当前文件负责：把八字五行能量映射为 AI 动力向量与行为偏置。
 */

import type {
  BaziBehaviorBias,
  BaziDynamicVector,
  BaziDynamicsVector,
  WuXingScore
} from "./bazi-schema"

import { clamp, round } from "./bazi-utils"

function getScore(score: WuXingScore, key: keyof WuXingScore): number {
  return clamp(score[key] ?? 0)
}

export function mapElementsToDynamicVector(
  elementScores: WuXingScore
): BaziDynamicVector {
  const wood = getScore(elementScores, "wood")
  const fire = getScore(elementScores, "fire")
  const earth = getScore(elementScores, "earth")
  const metal = getScore(elementScores, "metal")
  const water = getScore(elementScores, "water")

  return {
    growthDrive: round(clamp(wood * 0.85 + fire * 0.15)),
    expressionDrive: round(clamp(fire * 0.85 + wood * 0.1 + metal * 0.05)),
    stabilityDrive: round(clamp(earth * 0.8 + metal * 0.1 + water * 0.1)),
    boundaryDrive: round(clamp(metal * 0.85 + earth * 0.1 + water * 0.05)),
    perceptionDrive: round(clamp(water * 0.85 + metal * 0.1 + wood * 0.05)),
  }
}

export function mapElementsToBehaviorBias(
  elementScores: WuXingScore
): BaziBehaviorBias {
  const wood = getScore(elementScores, "wood")
  const fire = getScore(elementScores, "fire")
  const earth = getScore(elementScores, "earth")
  const metal = getScore(elementScores, "metal")
  const water = getScore(elementScores, "water")

  return {
    activity: round(clamp(fire * 0.5 + wood * 0.35 + metal * 0.15)),
    restPreference: round(clamp(earth * 0.4 + water * 0.35 + metal * 0.15)),
    emotionalSensitivity: round(clamp(water * 0.45 + fire * 0.3 + wood * 0.15)),
    explorationDrive: round(clamp(wood * 0.6 + fire * 0.25 + water * 0.15)),
    caution: round(clamp(metal * 0.5 + water * 0.25 + earth * 0.15)),
    adaptability: round(clamp(water * 0.45 + wood * 0.3 + earth * 0.15)),
  }
}

export function mapElementsToLegacyDynamics(
  elementScores: WuXingScore
): BaziDynamicsVector {
  const vector = mapElementsToDynamicVector(elementScores)
  const bias = mapElementsToBehaviorBias(elementScores)

  return {
    actionIntensity: bias.activity,
    reactionSpeed: round(clamp(vector.expressionDrive * 0.65 + bias.activity * 0.25)),
    sensoryDepth: round(clamp(vector.perceptionDrive * 0.75 + bias.emotionalSensitivity * 0.2)),
    consistency: round(clamp(vector.stabilityDrive * 0.6 + vector.boundaryDrive * 0.25)),
    explorationDrive: bias.explorationDrive,
    stability: vector.stabilityDrive,
    persistence: round(clamp(vector.stabilityDrive * 0.45 + vector.boundaryDrive * 0.35)),
    adaptability: bias.adaptability,
  }
}

export function mapWuXingToDynamics(
  distribution: WuXingScore
): BaziDynamicsVector {
  return mapElementsToLegacyDynamics(distribution)
}

export function buildBaziDynamicsSummary(input: {
  dominantElements: string[]
  dynamics: BaziDynamicsVector
}): string {
  const dominantText = input.dominantElements.join(" / ")

  return `当前八字动力底盘以 ${dominantText} 为主，行动强度 ${Math.round(
    input.dynamics.actionIntensity
  )}，感知深度 ${Math.round(input.dynamics.sensoryDepth)}，适应性 ${Math.round(
    input.dynamics.adaptability
  )}。`
}