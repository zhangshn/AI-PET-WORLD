/**
 * 当前文件负责：把动态宫位落点中的星曜与组合转成当前行为影响。
 */

import { getPairProfile } from "../knowledge/pairProfiles/registry"
import { getStarProfile } from "../knowledge/starProfiles"

import type {
  CorePersonality,
  PersonalityTraits
} from "../schema"

import type {
  ZiweiDynamicChart,
  ZiweiDynamicInfluence,
  ZiweiDynamicPositionBias,
  ZiweiFlowResult,
  ZiweiObservationDistance,
  ZiweiToneBias
} from "./dynamic-schema"

type BiasKey =
  | "careBias"
  | "observeBias"
  | "protectBias"
  | "exploreBias"
  | "recordBias"
  | "routineBias"
  | "repairBias"
  | "boundaryBias"

type BiasScores = Record<BiasKey, number>

const BIAS_KEYS: BiasKey[] = [
  "careBias",
  "observeBias",
  "protectBias",
  "exploreBias",
  "recordBias",
  "routineBias",
  "repairBias",
  "boundaryBias"
]

function createBaseBiasScores(): BiasScores {
  return {
    careBias: 50,
    observeBias: 50,
    protectBias: 50,
    exploreBias: 50,
    recordBias: 50,
    routineBias: 50,
    repairBias: 50,
    boundaryBias: 50
  }
}

function clampBias(value: number): number {
  if (value < 0) {
    return 0
  }

  if (value > 100) {
    return 100
  }

  return Math.round(value)
}

function addBias(
  scores: BiasScores,
  key: BiasKey,
  value: number,
  influence: number
): void {
  scores[key] = clampBias(scores[key] + value * influence)
}

/**
 * 从 0~100 traits 映射动态影响。
 */
function applyTraitsToBiases(
  scores: BiasScores,
  traits: Partial<PersonalityTraits>,
  influence: number
): void {
  const activity = traits.activity ?? 50
  const curiosity = traits.curiosity ?? 50
  const discipline = traits.discipline ?? 50
  const stability = traits.stability ?? 50
  const caregiving = traits.caregiving ?? 50
  const buildingPreference = traits.buildingPreference ?? 50
  const emotionalSensitivity = traits.emotionalSensitivity ?? 50
  const restPreference = traits.restPreference ?? 50

  addBias(scores, "careBias", (caregiving - 50) * 0.55, influence)
  addBias(scores, "observeBias", (curiosity - 50) * 0.45, influence)
  addBias(scores, "protectBias", (stability - 50) * 0.3, influence)
  addBias(scores, "exploreBias", (activity - 50) * 0.5, influence)
  addBias(scores, "recordBias", (curiosity - 50) * 0.25, influence)
  addBias(scores, "routineBias", (discipline - 50) * 0.45, influence)
  addBias(scores, "repairBias", (buildingPreference - 50) * 0.35, influence)
  addBias(scores, "boundaryBias", (discipline - 50) * 0.25, influence)

  addBias(scores, "careBias", (emotionalSensitivity - 50) * 0.2, influence)
  addBias(scores, "observeBias", (emotionalSensitivity - 50) * 0.25, influence)
  addBias(scores, "protectBias", (caregiving - 50) * 0.25, influence)
  addBias(scores, "routineBias", (restPreference - 50) * 0.15, influence)
}

/**
 * 从 0~1 核心人格映射动态影响。
 */
function applyCoreToBiases(
  scores: BiasScores,
  core: Partial<CorePersonality>,
  influence: number
): void {
  const activity = core.activity ?? 0.5
  const curiosity = core.curiosity ?? 0.5
  const dependency = core.dependency ?? 0.5
  const confidence = core.confidence ?? 0.5
  const sensitivity = core.sensitivity ?? 0.5

  addBias(scores, "exploreBias", (activity - 0.5) * 40, influence)
  addBias(scores, "observeBias", (curiosity - 0.5) * 42, influence)
  addBias(scores, "careBias", (dependency - 0.5) * 28, influence)
  addBias(scores, "protectBias", (sensitivity - 0.5) * 24, influence)
  addBias(scores, "recordBias", (curiosity - 0.5) * 28, influence)

  addBias(scores, "boundaryBias", (confidence - 0.5) * 32, influence)
  addBias(scores, "routineBias", (confidence - 0.5) * 18, influence)

  addBias(scores, "boundaryBias", (0.5 - dependency) * 20, influence)
}

/**
 * 应用单星影响。
 */
function applyStarInfluence(
  scores: BiasScores,
  flow: ZiweiFlowResult
): void {
  flow.stars.forEach((starId) => {
    if (starId === "star_00") {
      return
    }

    const profile = getStarProfile(starId)

    if (!profile) {
      return
    }

    applyCoreToBiases(
      scores,
      profile.baseCorePersonality,
      flow.influence
    )

    applyTraitsToBiases(
      scores,
      profile.baseTraits,
      flow.influence
    )
  })
}

/**
 * 应用双星组合影响。
 */
function applyPairInfluence(
  scores: BiasScores,
  flow: ZiweiFlowResult
): void {
  flow.pairIds.forEach((pairId) => {
    const profile = getPairProfile(pairId)

    if (!profile) {
      return
    }

    applyCoreToBiases(
      scores,
      profile.pairCorePersonality,
      flow.influence
    )

    if (profile.pairTraits) {
      applyTraitsToBiases(
        scores,
        profile.pairTraits,
        flow.influence
      )
    }
  })
}

function getActiveFlows(chart: ZiweiDynamicChart): ZiweiFlowResult[] {
  return [
    chart.natal,
    chart.daYun,
    chart.liuNian,
    chart.liuYue,
    chart.liuRi,
    chart.liuShi
  ]
}

function getTopBiases(scores: BiasScores): BiasKey[] {
  return [...BIAS_KEYS].sort((a, b) => {
    return scores[b] - scores[a]
  })
}

function resolvePositionBias(scores: BiasScores): ZiweiDynamicPositionBias {
  const top = getTopBiases(scores)[0]

  if (top === "careBias") {
    return "near_incubator"
  }

  if (top === "protectBias") {
    return "near_door"
  }

  if (top === "recordBias" || top === "routineBias") {
    return "near_desk"
  }

  if (top === "exploreBias" || top === "boundaryBias") {
    return "patrol_room"
  }

  return "near_nest"
}

function resolveObservationDistance(
  scores: BiasScores
): ZiweiObservationDistance {
  if (scores.careBias >= 64 || scores.protectBias >= 66) {
    return "close"
  }

  if (scores.boundaryBias >= 66 && scores.careBias < 58) {
    return "distant"
  }

  return "medium"
}

function resolveToneBias(scores: BiasScores): ZiweiToneBias {
  const top = getTopBiases(scores)[0]

  if (top === "careBias") {
    return "gentle"
  }

  if (top === "protectBias" || top === "boundaryBias") {
    return "protective"
  }

  if (top === "recordBias" || top === "routineBias") {
    return "concise"
  }

  if (top === "observeBias") {
    return "rational"
  }

  return "curious"
}

function getBiasLabel(key: BiasKey): string {
  const labels: Record<BiasKey, string> = {
    careBias: "照护",
    observeBias: "观察",
    protectBias: "保护",
    exploreBias: "探索",
    recordBias: "记录",
    routineBias: "秩序",
    repairBias: "修复",
    boundaryBias: "边界"
  }

  return labels[key]
}

function resolveCurrentPhaseLabel(scores: BiasScores): string {
  const top = getTopBiases(scores)[0]

  if (top === "careBias") {
    return "照护增强阶段"
  }

  if (top === "observeBias") {
    return "观察分析阶段"
  }

  if (top === "protectBias") {
    return "保护警觉阶段"
  }

  if (top === "exploreBias") {
    return "探索外放阶段"
  }

  if (top === "recordBias") {
    return "记录整理阶段"
  }

  if (top === "routineBias") {
    return "秩序维护阶段"
  }

  if (top === "repairBias") {
    return "修复建设阶段"
  }

  return "边界确认阶段"
}

function resolveCurrentFocusLabel(scores: BiasScores): string {
  const topBiases = getTopBiases(scores).slice(0, 2)
  return topBiases.map(getBiasLabel).join(" / ")
}

/**
 * 合成完整动态行为影响。
 */
export function composeZiweiDynamicInfluence(
  chart: ZiweiDynamicChart
): ZiweiDynamicInfluence {
  const scores = createBaseBiasScores()
  const activeFlows = getActiveFlows(chart)

  activeFlows.forEach((flow) => {
    applyStarInfluence(scores, flow)
    applyPairInfluence(scores, flow)
  })

  const topBiases = getTopBiases(scores)

  return {
    careBias: scores.careBias,
    observeBias: scores.observeBias,
    protectBias: scores.protectBias,
    exploreBias: scores.exploreBias,
    recordBias: scores.recordBias,
    routineBias: scores.routineBias,
    repairBias: scores.repairBias,
    boundaryBias: scores.boundaryBias,

    positionBias: resolvePositionBias(scores),
    observationDistance: resolveObservationDistance(scores),
    toneBias: resolveToneBias(scores),

    currentPhaseLabel: resolveCurrentPhaseLabel(scores),
    currentFocusLabel: resolveCurrentFocusLabel(scores),

    debug: {
      activeFlows,
      topBiases
    }
  }
}