/**
 * 当前文件负责：把本命人格与紫微动态影响合成为当前流动人格与行动趋向。
 */

import type {
  CorePersonality,
  PersonalityProfile,
  PersonalityTraits
} from "../../schema"

import type {
  ZiweiDynamicChart,
  ZiweiDynamicInfluence,
  ZiweiFlowResult
} from "../dynamic-schema"

import {
  buildCurrentDynamicProfileSummary
} from "./current-dynamic-profile-summary"

import type {
  CurrentDynamicBiases,
  CurrentDynamicFlowSummary,
  CurrentDynamicProfile,
  CurrentDynamicTendencies
} from "./current-dynamic-profile-schema"

import {
  clampScore,
  clampUnit,
  getBiasDelta,
  normalizeCorePersonality,
  normalizeTraits
} from "./current-dynamic-profile-normalizer"

export interface BuildCurrentDynamicProfileInput {
  baseProfile: PersonalityProfile
  chart: ZiweiDynamicChart
  influence: ZiweiDynamicInfluence
}

function getChartFlows(chart: ZiweiDynamicChart): ZiweiFlowResult[] {
  return [
    chart.natal,
    chart.daYun,
    chart.liuNian,
    chart.liuYue,
    chart.liuRi,
    chart.liuShi
  ]
}

function getActiveFlows(chart: ZiweiDynamicChart): ZiweiFlowResult[] {
  return getChartFlows(chart).filter((flow) => {
    return flow.isActive && flow.influence > 0
  })
}

function toFlowSummary(flow: ZiweiFlowResult): CurrentDynamicFlowSummary {
  return {
    type: flow.type,
    palace: flow.palace,
    sectorName: flow.sectorName,
    stars: flow.stars,
    pairIds: flow.pairIds,
    influence: flow.influence,
    isActive: flow.isActive,
    inactiveReason: flow.inactiveReason
  }
}

function getDominantFlow(activeFlows: ZiweiFlowResult[]): ZiweiFlowResult {
  return [...activeFlows].sort((a, b) => {
    return b.influence - a.influence
  })[0]
}

function getTemporalDominantFlow(
  activeFlows: ZiweiFlowResult[]
): ZiweiFlowResult | null {
  const temporalFlows = activeFlows.filter((flow) => {
    return flow.type !== "natal"
  })

  if (temporalFlows.length <= 0) {
    return null
  }

  return getDominantFlow(temporalFlows)
}

function pickCurrentBiases(
  influence: ZiweiDynamicInfluence
): CurrentDynamicBiases {
  return {
    careBias: influence.careBias,
    observeBias: influence.observeBias,
    protectBias: influence.protectBias,
    exploreBias: influence.exploreBias,
    recordBias: influence.recordBias,
    routineBias: influence.routineBias,
    repairBias: influence.repairBias,
    boundaryBias: influence.boundaryBias
  }
}

function composeCurrentCorePersonality(params: {
  baseCore: CorePersonality
  biases: CurrentDynamicBiases
}): CorePersonality {
  const base = params.baseCore
  const biases = params.biases

  const exploreDelta = getBiasDelta(biases.exploreBias)
  const observeDelta = getBiasDelta(biases.observeBias)
  const recordDelta = getBiasDelta(biases.recordBias)
  const careDelta = getBiasDelta(biases.careBias)
  const protectDelta = getBiasDelta(biases.protectBias)
  const routineDelta = getBiasDelta(biases.routineBias)
  const boundaryDelta = getBiasDelta(biases.boundaryBias)

  return normalizeCorePersonality({
    activity: clampUnit(
      base.activity +
        exploreDelta * 0.08 +
        routineDelta * 0.03
    ),
    curiosity: clampUnit(
      base.curiosity +
        observeDelta * 0.08 +
        recordDelta * 0.05
    ),
    dependency: clampUnit(
      base.dependency +
        careDelta * 0.06 -
        boundaryDelta * 0.03
    ),
    confidence: clampUnit(
      base.confidence +
        boundaryDelta * 0.05 +
        routineDelta * 0.03
    ),
    sensitivity: clampUnit(
      base.sensitivity +
        protectDelta * 0.05 +
        observeDelta * 0.03
    )
  })
}

function shiftTrait(value: number, amount: number): number {
  return clampScore(value + amount)
}

function composeCurrentTraits(params: {
  baseTraits: PersonalityTraits
  biases: CurrentDynamicBiases
}): PersonalityTraits {
  const base = params.baseTraits
  const biases = params.biases

  const careDelta = getBiasDelta(biases.careBias)
  const observeDelta = getBiasDelta(biases.observeBias)
  const protectDelta = getBiasDelta(biases.protectBias)
  const exploreDelta = getBiasDelta(biases.exploreBias)
  const recordDelta = getBiasDelta(biases.recordBias)
  const routineDelta = getBiasDelta(biases.routineBias)
  const repairDelta = getBiasDelta(biases.repairBias)
  const boundaryDelta = getBiasDelta(biases.boundaryBias)

  return normalizeTraits({
    ...base,
    activity: shiftTrait(
      base.activity,
      exploreDelta * 8 + routineDelta * 2
    ),
    curiosity: shiftTrait(
      base.curiosity,
      observeDelta * 7 + recordDelta * 5
    ),
    discipline: shiftTrait(
      base.discipline,
      routineDelta * 7 + boundaryDelta * 4
    ),
    stability: shiftTrait(
      base.stability,
      protectDelta * 5 + routineDelta * 4 - exploreDelta * 2
    ),
    caregiving: shiftTrait(
      base.caregiving,
      careDelta * 7 + protectDelta * 4
    ),
    buildingPreference: shiftTrait(
      base.buildingPreference,
      repairDelta * 7 + routineDelta * 3
    ),
    emotionalSensitivity: shiftTrait(
      base.emotionalSensitivity,
      protectDelta * 4 + observeDelta * 3
    ),
    restPreference: shiftTrait(
      base.restPreference,
      careDelta * 4 + routineDelta * 3 - exploreDelta * 3
    ),
    appetite: shiftTrait(
      base.appetite,
      careDelta * 2
    )
  })
}

function composeCurrentTendencies(params: {
  traits: PersonalityTraits
  biases: CurrentDynamicBiases
}): CurrentDynamicTendencies {
  const traits = params.traits
  const biases = params.biases

  return {
    exploreTendency: clampScore(
      traits.activity * 0.45 +
        traits.curiosity * 0.35 +
        biases.exploreBias * 0.2
    ),
    observeTendency: clampScore(
      traits.curiosity * 0.45 +
        traits.emotionalSensitivity * 0.2 +
        biases.observeBias * 0.35
    ),
    approachTendency: clampScore(
      traits.activity * 0.25 +
        traits.stability * 0.25 +
        biases.careBias * 0.2 +
        (100 - biases.boundaryBias) * 0.3
    ),
    recoverTendency: clampScore(
      traits.restPreference * 0.45 +
        traits.stability * 0.25 +
        biases.routineBias * 0.3
    ),
    careTendency: clampScore(
      traits.caregiving * 0.55 +
        biases.careBias * 0.45
    ),
    protectTendency: clampScore(
      traits.stability * 0.35 +
        traits.caregiving * 0.25 +
        biases.protectBias * 0.4
    ),
    boundaryTendency: clampScore(
      traits.discipline * 0.35 +
        traits.confidence * 0.15 +
        biases.boundaryBias * 0.5
    ),
    routineTendency: clampScore(
      traits.discipline * 0.5 +
        traits.restPreference * 0.2 +
        biases.routineBias * 0.3
    ),
    repairTendency: clampScore(
      traits.buildingPreference * 0.55 +
        traits.discipline * 0.15 +
        biases.repairBias * 0.3
    ),
    recordTendency: clampScore(
      traits.curiosity * 0.35 +
        traits.discipline * 0.25 +
        biases.recordBias * 0.4
    )
  }
}

export function buildCurrentDynamicProfile(
  input: BuildCurrentDynamicProfileInput
): CurrentDynamicProfile {
  const activeFlows = getActiveFlows(input.chart)
  const dominantFlow = getDominantFlow(activeFlows)
  const temporalDominantFlow = getTemporalDominantFlow(activeFlows)
  const currentBiases = pickCurrentBiases(input.influence)

  const currentCorePersonality = composeCurrentCorePersonality({
    baseCore: input.baseProfile.corePersonality,
    biases: currentBiases
  })

  const currentTraits = composeCurrentTraits({
    baseTraits: input.baseProfile.traits,
    biases: currentBiases
  })

  const currentTendencies = composeCurrentTendencies({
    traits: currentTraits,
    biases: currentBiases
  })

  const phase = input.influence.currentPhaseLabel
  const focus = input.influence.currentFocusLabel

  return {
    baseProfile: input.baseProfile,
    currentCorePersonality,
    currentTraits,
    currentBiases,
    currentTendencies,
    currentPreference: {
      positionBias: input.influence.positionBias,
      observationDistance: input.influence.observationDistance,
      toneBias: input.influence.toneBias
    },
    dominantFlow: toFlowSummary(dominantFlow),
    temporalDominantFlow: temporalDominantFlow
      ? toFlowSummary(temporalDominantFlow)
      : null,
    labels: {
      phase,
      focus,
      summary: buildCurrentDynamicProfileSummary({
        dominantFlow: toFlowSummary(dominantFlow),
        temporalDominantFlow: temporalDominantFlow
          ? toFlowSummary(temporalDominantFlow)
          : null,
        phase,
        focus
      })
    },
    debug: {
      activeFlows: input.influence.debug.activeFlows,
      topBiases: input.influence.debug.topBiases
    }
  }
}