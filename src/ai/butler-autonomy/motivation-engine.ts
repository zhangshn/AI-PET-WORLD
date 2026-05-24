/**
 * 当前文件职责：根据灵魂底盘、世界感知、意识状态和记忆生成管家内在动机。
 */

import type {
  ButlerConsciousState,
  ButlerMemoryState,
  ButlerMotivation,
  ButlerSoulProfile,
  ButlerWorldPerception,
} from "./schema"

export function buildButlerMotivations(input: {
  soulProfile: ButlerSoulProfile
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
  memoryState: ButlerMemoryState
}): ButlerMotivation[] {
  return [
    buildResourcePrudenceMotivation(input),
    buildCareMotivation(input),
    buildOrderMotivation(input),
    buildSafetyMotivation(input),
    buildEcologyRespectMotivation(input),
    buildWaitingMotivation(input),
    buildExplanationMotivation(input),
  ].sort((left, right) => right.intensity - left.intensity)
}

function buildResourcePrudenceMotivation(input: {
  soulProfile: ButlerSoulProfile
  perception: ButlerWorldPerception
  memoryState: ButlerMemoryState
}): ButlerMotivation {
  const intensity = weightedScore([
    [input.perception.resourcePressure, 0.45],
    [input.soulProfile.resourcePrudence, 0.35],
    [input.memoryState.learnedPreferences.resourceCautionBias, 0.2],
  ])

  return buildMotivation({
    kind: "resource_prudence",
    intensity,
    sourceSoulFactors: ["resourcePrudence"],
    sourceWorldFactors: ["resourcePressure", "materialReadiness", "careReadiness"],
    sourceMemoryFactors: ["resourceCautionBias"],
    reason: "管家把材料、照护准备和长期资源谨慎倾向合并为资源判断。",
    tags: ["resource_pressure", "resource_caution"],
  })
}

function buildCareMotivation(input: {
  soulProfile: ButlerSoulProfile
  perception: ButlerWorldPerception
  memoryState: ButlerMemoryState
}): ButlerMotivation {
  const intensity = weightedScore([
    [input.perception.careNeed, 0.45],
    [input.soulProfile.careDrive, 0.35],
    [input.memoryState.learnedPreferences.careBias, 0.2],
  ])

  return buildMotivation({
    kind: "care",
    intensity,
    sourceSoulFactors: ["careDrive"],
    sourceWorldFactors: ["careNeed", "adoptionReadinessConcern"],
    sourceMemoryFactors: ["careBias"],
    reason: "照护需求、管家照护倾向和记忆中的照护偏置共同形成照护动机。",
    tags: ["care_need", "future_life_boundary"],
  })
}

function buildOrderMotivation(input: {
  soulProfile: ButlerSoulProfile
  perception: ButlerWorldPerception
  memoryState: ButlerMemoryState
}): ButlerMotivation {
  const intensity = weightedScore([
    [input.perception.storageNeed, 0.4],
    [input.soulProfile.orderPreference, 0.4],
    [input.memoryState.learnedPreferences.storageBias, 0.2],
  ])

  return buildMotivation({
    kind: "order",
    intensity,
    sourceSoulFactors: ["orderPreference"],
    sourceWorldFactors: ["storageNeed", "constructionDebt"],
    sourceMemoryFactors: ["storageBias"],
    reason: "材料缺口、建设债务和秩序偏好会推动管家先整理资源与空间。",
    tags: ["order_preference", "storage_need"],
  })
}

function buildSafetyMotivation(input: {
  soulProfile: ButlerSoulProfile
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
  memoryState: ButlerMemoryState
}): ButlerMotivation {
  const intensity = weightedScore([
    [input.perception.boundaryMaintenanceNeed, 0.35],
    [input.soulProfile.boundaryDrive, 0.25],
    [input.soulProfile.riskSensitivity, 0.2],
    [input.memoryState.learnedPreferences.boundaryBias, 0.1],
    [input.consciousState.cautionLevel, 0.1],
  ])

  return buildMotivation({
    kind: "safety",
    intensity,
    sourceSoulFactors: ["boundaryDrive", "riskSensitivity"],
    sourceWorldFactors: ["boundaryMaintenanceNeed", "spacePressure"],
    sourceMemoryFactors: ["boundaryBias"],
    reason: "边界、风险敏感度、空间压力和谨慎意识共同形成安全维护动机。",
    tags: ["safety", "boundary_maintenance"],
  })
}

function buildEcologyRespectMotivation(input: {
  soulProfile: ButlerSoulProfile
  perception: ButlerWorldPerception
}): ButlerMotivation {
  const ecologicalPressure = clampScore(100 - input.perception.ecologicalStability)
  const intensity = weightedScore([
    [ecologicalPressure, 0.5],
    [input.soulProfile.patience, 0.25],
    [input.soulProfile.boundaryDrive, 0.25],
  ])

  return buildMotivation({
    kind: "ecology_respect",
    intensity,
    sourceSoulFactors: ["patience", "boundaryDrive"],
    sourceWorldFactors: ["ecologicalStability"],
    sourceMemoryFactors: [],
    reason: "生态稳定度下降时，管家会提高维护自然和减少扩张的倾向。",
    tags: ["ecology_respect", "world_ecology"],
  })
}

function buildWaitingMotivation(input: {
  soulProfile: ButlerSoulProfile
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
  memoryState: ButlerMemoryState
}): ButlerMotivation {
  const intensity = weightedScore([
    [input.soulProfile.patience, 0.25],
    [input.perception.resourcePressure, 0.25],
    [input.consciousState.recoveryPressure, 0.25],
    [input.memoryState.learnedPreferences.waitingBias, 0.25],
  ])

  return buildMotivation({
    kind: "waiting",
    intensity,
    sourceSoulFactors: ["patience"],
    sourceWorldFactors: ["resourcePressure", "recoveryPressure"],
    sourceMemoryFactors: ["waitingBias"],
    reason: "等待不是停摆，而是管家在风险、资源或恢复压力下的合法自主策略。",
    tags: ["waiting", "deadlock_prevention"],
  })
}

function buildExplanationMotivation(input: {
  soulProfile: ButlerSoulProfile
  consciousState: ButlerConsciousState
}): ButlerMotivation {
  const toneBonus = input.soulProfile.explanationTone === "reserved" ? 35 : 55
  const intensity = weightedScore([
    [toneBonus, 0.45],
    [input.soulProfile.socialWarmth, 0.25],
    [input.consciousState.attentionLevel, 0.3],
  ])

  return buildMotivation({
    kind: "explanation",
    intensity,
    sourceSoulFactors: ["explanationTone", "socialWarmth"],
    sourceWorldFactors: ["attentionLevel"],
    sourceMemoryFactors: [],
    reason: "正式世界需要可解释，管家会根据表达倾向和注意力决定是否向玩家解释。",
    tags: ["explainability", "p_phone_ready"],
  })
}

function buildMotivation(input: {
  kind: ButlerMotivation["kind"]
  intensity: number
  sourceSoulFactors: string[]
  sourceWorldFactors: string[]
  sourceMemoryFactors: string[]
  reason: string
  tags: string[]
}): ButlerMotivation {
  return {
    motivationId: `motivation-${input.kind}`,
    kind: input.kind,
    intensity: clampScore(input.intensity),
    sourceSoulFactors: input.sourceSoulFactors,
    sourceWorldFactors: input.sourceWorldFactors,
    sourceMemoryFactors: input.sourceMemoryFactors,
    reason: input.reason,
    tags: ["butler_motivation", input.kind, ...input.tags],
  }
}

function weightedScore(items: Array<[number, number]>): number {
  const totalWeight = items.reduce((total, item) => total + item[1], 0)
  if (totalWeight <= 0) return 0

  const total = items.reduce((sum, item) => sum + item[0] * item[1], 0)
  return clampScore(total / totalWeight)
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
