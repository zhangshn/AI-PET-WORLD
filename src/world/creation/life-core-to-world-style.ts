/**
 * 当前文件负责：把生命人格核心结果映射为世界建设风格。
 */

import type {
  ButlerProfile,
  ButlerProfileBias,
} from "@/ai/personality-core/butler-profile-core/butler-profile-gateway"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

export type BuildButlerConstructionStyleFromLifeCoreInput = {
  butlerProfile: ButlerProfile
  fallbackStyle: ButlerConstructionStyleVector
}

export type BuildButlerConstructionStyleFromLifeCoreResult = {
  constructionStyle: ButlerConstructionStyleVector
  source: "life_profile_core"
  debug: {
    careStyle: ButlerProfile["careStyle"]
    buildStyle: ButlerProfile["buildStyle"]
    boundaryStyle: ButlerProfile["boundaryStyle"]
    opportunityStyle: ButlerProfile["opportunityStyle"]
    bias: ButlerProfileBias
    note: string
  }
}

export function buildButlerConstructionStyleFromLifeCore(
  input: BuildButlerConstructionStyleFromLifeCoreInput
): BuildButlerConstructionStyleFromLifeCoreResult {
  const behaviorBias = input.butlerProfile.behaviorBias
  const butlerBias = input.butlerProfile.bias

  const constructionStyle: ButlerConstructionStyleVector = {
    structuredBuilder: normalizeStyleScore(
      weightedAverage([
        [butlerBias.constructionDrive, 0.45],
        [behaviorBias.buildingBias.orderPreference, 0.3],
        [behaviorBias.butlerBehaviorBias.constructionDrive, 0.25],
      ]),
      input.fallbackStyle.structuredBuilder
    ),
    warmCaretaker: normalizeStyleScore(
      weightedAverage([
        [butlerBias.carePriority, 0.42],
        [behaviorBias.buildingBias.comfortPreference, 0.28],
        [behaviorBias.butlerBehaviorBias.carePriority, 0.3],
      ]),
      input.fallbackStyle.warmCaretaker
    ),
    protectiveKeeper: normalizeStyleScore(
      weightedAverage([
        [butlerBias.boundarySensitivity, 0.42],
        [behaviorBias.buildingBias.stabilityPreference, 0.3],
        [100 - behaviorBias.butlerBehaviorBias.riskTolerance, 0.28],
      ]),
      input.fallbackStyle.protectiveKeeper
    ),
    aestheticOrganizer: normalizeStyleScore(
      weightedAverage([
        [behaviorBias.buildingBias.orderPreference, 0.34],
        [behaviorBias.buildingBias.comfortPreference, 0.28],
        [butlerBias.carePriority, 0.2],
        [butlerBias.observationPatience, 0.18],
      ]),
      input.fallbackStyle.aestheticOrganizer
    ),
    quietMaintainer: normalizeStyleScore(
      weightedAverage([
        [butlerBias.observationPatience, 0.38],
        [behaviorBias.butlerBehaviorBias.routinePreference, 0.34],
        [behaviorBias.buildingBias.stabilityPreference, 0.28],
      ]),
      input.fallbackStyle.quietMaintainer
    ),
    adaptivePlanner: normalizeStyleScore(
      weightedAverage([
        [butlerBias.opportunityInitiative, 0.3],
        [behaviorBias.buildingBias.adaptabilityPreference, 0.34],
        [behaviorBias.butlerBehaviorBias.responseSpeed, 0.24],
        [behaviorBias.butlerBehaviorBias.constructionDrive, 0.12],
      ]),
      input.fallbackStyle.adaptivePlanner
    ),
  }

  return {
    constructionStyle,
    source: "life_profile_core",
    debug: {
      careStyle: input.butlerProfile.careStyle,
      buildStyle: input.butlerProfile.buildStyle,
      boundaryStyle: input.butlerProfile.boundaryStyle,
      opportunityStyle: input.butlerProfile.opportunityStyle,
      bias: input.butlerProfile.bias,
      note:
        "建设风格来自管家人格核心：管家 bias + 性别感知行为偏置 + 建筑偏置共同映射。",
    },
  }
}

function weightedAverage(items: Array<[number, number]>): number {
  const totalWeight = items.reduce((sum, item) => sum + item[1], 0)

  if (totalWeight <= 0) return 50

  const weightedSum = items.reduce(
    (sum, item) => sum + clampPercent(item[0]) * item[1],
    0
  )

  return weightedSum / totalWeight
}

function normalizeStyleScore(
  rawPercentScore: number,
  fallbackValue: number
): number {
  if (!Number.isFinite(rawPercentScore)) {
    return clampUnit(fallbackValue)
  }

  const normalized = 0.18 + clampPercent(rawPercentScore) / 100 * 0.72

  return Number(clampUnit(normalized).toFixed(3))
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50

  return Math.max(0, Math.min(100, value))
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0.5

  return Math.max(0, Math.min(1, value))
}
