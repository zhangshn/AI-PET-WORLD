/**
 * 当前文件负责：把八字原局与动态运行层合成为当前流动气质和行动趋向。
 */

import type {
  BaziProfile,
  WuXingElement,
  WuXingScore
} from "../../bazi-schema"

import type {
  BaziRuntimeProfile
} from "../bazi-runtime-schema"

import {
  buildBaziCurrentTendencySummary
} from "./bazi-current-tendency-summary"

import type {
  BaziCurrentDynamicTemperament,
  BaziCurrentEnergyTone,
  BaziCurrentTendencies,
  BaziCurrentTendencyProfile
} from "./bazi-current-tendency-schema"

import {
  clampScore,
  getDominantElements,
  getScoreDelta,
  getWeakElements
} from "./bazi-current-tendency-normalizer"

export interface BuildBaziCurrentTendencyProfileInput {
  baseProfile: BaziProfile
  runtimeProfile: BaziRuntimeProfile
}

function getElementScore(
  scores: WuXingScore,
  element: WuXingElement
): number {
  return scores[element] ?? 0
}

function resolveEnergyTone(scores: WuXingScore): BaziCurrentEnergyTone {
  const dominant = getDominantElements(scores, 1)[0]

  if (dominant === "wood") {
    return "active"
  }

  if (dominant === "fire") {
    return "warm"
  }

  if (dominant === "earth") {
    return "stable"
  }

  if (dominant === "metal") {
    return "sharp"
  }

  if (dominant === "water") {
    return "deep"
  }

  return "balanced"
}

function composeCurrentTemperament(params: {
  runtimeProfile: BaziRuntimeProfile
}): BaziCurrentDynamicTemperament {
  const elementField = params.runtimeProfile.runtimeElementField.elementScores

  return {
    dominantRuntimeElements: getDominantElements(elementField),
    weakRuntimeElements: getWeakElements(elementField),
    energyTone: resolveEnergyTone(elementField),
    elementField,
    modifiers: params.runtimeProfile.modifiers
  }
}

function composeCurrentTendencies(params: {
  baseProfile: BaziProfile
  runtimeProfile: BaziRuntimeProfile
}): BaziCurrentTendencies {
  const baseBias = params.baseProfile.behaviorBias
  const baseDynamics = params.baseProfile.dynamics
  const modifiers = params.runtimeProfile.modifiers
  const runtimeElements = params.runtimeProfile.runtimeElementField.elementScores

  const woodDelta = getScoreDelta(getElementScore(runtimeElements, "wood"))
  const fireDelta = getScoreDelta(getElementScore(runtimeElements, "fire"))
  const earthDelta = getScoreDelta(getElementScore(runtimeElements, "earth"))
  const metalDelta = getScoreDelta(getElementScore(runtimeElements, "metal"))
  const waterDelta = getScoreDelta(getElementScore(runtimeElements, "water"))

  return {
    actionTendency: clampScore(
      baseBias.activity * 0.45 +
        baseDynamics.actionIntensity * 0.25 +
        modifiers.activityModifier * 0.3 +
        fireDelta * 6
    ),
    reactionTendency: clampScore(
      baseDynamics.reactionSpeed * 0.45 +
        modifiers.emotionModifier * 0.35 +
        fireDelta * 5 +
        woodDelta * 3
    ),
    explorationTendency: clampScore(
      baseBias.explorationDrive * 0.45 +
        modifiers.explorationModifier * 0.4 +
        woodDelta * 6
    ),
    recoveryTendency: clampScore(
      baseBias.restPreference * 0.4 +
        modifiers.recoveryModifier * 0.4 +
        earthDelta * 5 +
        waterDelta * 4
    ),
    cautionTendency: clampScore(
      baseBias.caution * 0.45 +
        modifiers.cautionModifier * 0.4 +
        metalDelta * 6
    ),
    perceptionTendency: clampScore(
      baseDynamics.sensoryDepth * 0.35 +
        modifiers.perceptionModifier * 0.45 +
        waterDelta * 7
    ),
    stabilityTendency: clampScore(
      baseDynamics.stability * 0.35 +
        baseDynamics.consistency * 0.25 +
        modifiers.recoveryModifier * 0.25 +
        earthDelta * 6
    ),
    adaptabilityTendency: clampScore(
      baseBias.adaptability * 0.45 +
        baseDynamics.adaptability * 0.3 +
        modifiers.explorationModifier * 0.15 +
        woodDelta * 4 -
        metalDelta * 2
    )
  }
}

export function buildBaziCurrentTendencyProfile(
  input: BuildBaziCurrentTendencyProfileInput
): BaziCurrentTendencyProfile {
  const currentTemperament = composeCurrentTemperament({
    runtimeProfile: input.runtimeProfile
  })

  const currentTendencies = composeCurrentTendencies({
    baseProfile: input.baseProfile,
    runtimeProfile: input.runtimeProfile
  })

  return {
    baseProfile: input.baseProfile,
    runtimeProfile: input.runtimeProfile,
    currentTemperament,
    currentTendencies,
    labels: {
      title: "八字当前流动气质 / 行动趋向",
      summary: buildBaziCurrentTendencySummary({
        energyTone: currentTemperament.energyTone,
        dominantElements: currentTemperament.dominantRuntimeElements,
        hasHour: input.baseProfile.hasHour
      }),
      modeLabel: input.baseProfile.hasHour ? "四柱模式" : "三柱模式",
      precisionLabel: input.baseProfile.hasHour ? "高精度" : "中精度"
    },
    debug: {
      usedRuntimePillars: input.runtimeProfile.debug.usedRuntimePillars,
      note: input.runtimeProfile.debug.note
    }
  }
}