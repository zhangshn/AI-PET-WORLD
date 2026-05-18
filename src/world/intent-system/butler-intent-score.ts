/**
 * 当前文件职责：根据世界上下文生成管家行为意图候选评分。
 */

import type {
  BuildButlerIntentDecisionInput,
  ButlerIntentType,
  IntentCandidate,
  IntentUrgency,
} from "./intent-schema"

export function buildButlerIntentCandidates(
  input: BuildButlerIntentDecisionInput
): IntentCandidate[] {
  return [
    buildBuildCandidate(input),
    buildMaintainCandidate(input),
    buildPlantCandidate(input),
    buildExpandCandidate(input),
    buildObserveCandidate(input),
    buildRestCandidate(input),
    buildReorganizeCandidate(input),
    buildDoNothingCandidate(input),
  ]
}

function buildBuildCandidate(
  input: BuildButlerIntentDecisionInput
): IntentCandidate {
  const activePlanBlocker = input.world.activeConstructionPlanCount >= 3
  const score = clampPercent(
    input.butler.constructionStyle.structuredBuilder * 0.35 +
      input.environment.materials.buildReadiness * 0.35 +
      input.world.spacePressure * 0.2 +
      (100 - input.world.activeConstructionPlanCount * 18) * 0.1 -
      (activePlanBlocker ? 20 : 0)
  )

  return createCandidate({
    type: "build",
    score,
    reason: "根据建设倾向、建材准备度与空间压力评估是否推进建设。",
    drivers: compactStrings([
      input.butler.constructionStyle.structuredBuilder >= 60
        ? "管家建设执行倾向较高"
        : "",
      input.environment.materials.buildReadiness >= 55
        ? "建造准备度较好"
        : "",
      input.world.spacePressure >= 60 ? "空间压力较高" : "",
    ]),
    blockers: compactStrings([
      activePlanBlocker ? "活跃建设计划过多" : "",
      input.environment.materials.buildReadiness < 35 ? "建材准备不足" : "",
    ]),
    tags: ["intent_v0", "construction"],
  })
}

function buildMaintainCandidate(
  input: BuildButlerIntentDecisionInput
): IntentCandidate {
  const habitatStress = 100 - input.environment.ecology.habitatStability
  const lowPetEnergy = input.pet.energy < 35
  const score = clampPercent(
    input.butler.constructionStyle.protectiveKeeper * 0.35 +
      habitatStress * 0.35 +
      (lowPetEnergy ? 20 : 0) +
      input.butler.constructionStyle.quietMaintainer * 0.1
  )

  return createCandidate({
    type: "maintain",
    score,
    reason: "根据守护倾向、栖息稳定性与宠物精力评估维护需求。",
    drivers: compactStrings([
      input.butler.constructionStyle.protectiveKeeper >= 55
        ? "管家守护倾向较高"
        : "",
      habitatStress >= 45 ? "栖息环境不够稳定" : "",
      lowPetEnergy ? "宠物精力偏低" : "",
    ]),
    blockers: compactStrings([
      input.environment.ecology.habitatStability >= 75
        ? "栖息环境稳定"
        : "",
    ]),
    tags: ["intent_v0", "maintenance"],
  })
}

function buildPlantCandidate(
  input: BuildButlerIntentDecisionInput
): IntentCandidate {
  const waterPoor = input.environment.materials.tags.includes("water_poor")
  const styleScore =
    (input.butler.constructionStyle.aestheticOrganizer +
      input.butler.constructionStyle.warmCaretaker) /
    2
  const score = clampPercent(
    styleScore * 0.35 +
      input.environment.ecology.naturalGrowthPotential * 0.35 +
      input.environment.materials.water * 0.2 -
      (waterPoor ? 18 : 0)
  )

  return createCandidate({
    type: "plant",
    score,
    reason: "根据整理照料倾向、自然生长潜力与水资源评估种植意图。",
    drivers: compactStrings([
      styleScore >= 55 ? "管家有美化或照料倾向" : "",
      input.environment.ecology.naturalGrowthPotential >= 55
        ? "自然生长潜力较好"
        : "",
      input.environment.materials.water >= 50 ? "水资源可支持种植" : "",
    ]),
    blockers: compactStrings([waterPoor ? "水资源不足" : ""]),
    tags: ["intent_v0", "ecology"],
  })
}

function buildExpandCandidate(
  input: BuildButlerIntentDecisionInput
): IntentCandidate {
  const lowMaterials = input.environment.materials.tags.includes("low_materials")
  const styleScore =
    (input.butler.constructionStyle.adaptivePlanner +
      input.butler.constructionStyle.structuredBuilder) /
    2
  const score = clampPercent(
    styleScore * 0.3 +
      input.world.spacePressure * 0.35 +
      input.environment.materials.buildReadiness * 0.25 -
      (lowMaterials ? 18 : 0)
  )

  return createCandidate({
    type: "expand",
    score,
    reason: "根据扩张规划倾向、空间压力与建造准备度评估扩建意图。",
    drivers: compactStrings([
      styleScore >= 55 ? "管家规划扩张倾向较高" : "",
      input.world.spacePressure >= 60 ? "空间压力推动扩张" : "",
      input.environment.materials.buildReadiness >= 55
        ? "建造准备度支持扩建"
        : "",
    ]),
    blockers: compactStrings([lowMaterials ? "材料储备偏低" : ""]),
    tags: ["intent_v0", "expansion"],
  })
}

function buildObserveCandidate(
  input: BuildButlerIntentDecisionInput
): IntentCandidate {
  const quietMood = includesAny(input.pet.mood, ["quiet", "resting"])
  const lowBuildReadiness = input.environment.materials.buildReadiness < 45
  const score = clampPercent(
    42 +
      input.butler.constructionStyle.quietMaintainer * 0.18 +
      (quietMood ? 16 : 0) +
      (lowBuildReadiness ? 14 : 0)
  )

  return createCandidate({
    type: "observe",
    score,
    reason: "观察是默认合法行为，会在低建造准备或安静状态下提升。",
    drivers: compactStrings([
      "观察可保持世界状态稳定",
      quietMood ? "宠物处于安静或休息状态" : "",
      lowBuildReadiness ? "建造准备度偏低，适合先观察" : "",
    ]),
    blockers: [],
    tags: ["intent_v0", "observation"],
  })
}

function buildRestCandidate(
  input: BuildButlerIntentDecisionInput
): IntentCandidate {
  const tiredButler = includesAny(input.butler.mood, ["tired", "fatigue"])
  const lowPetEnergy = input.pet.energy < 25
  const score = clampPercent(
    22 +
      (tiredButler ? 38 : 0) +
      (lowPetEnergy ? 26 : 0) +
      input.butler.constructionStyle.quietMaintainer * 0.12
  )

  return createCandidate({
    type: "rest",
    score,
    reason: "根据管家疲劳状态与宠物精力评估是否进入休整。",
    drivers: compactStrings([
      tiredButler ? "管家情绪包含疲惫信号" : "",
      lowPetEnergy ? "宠物精力很低" : "",
    ]),
    blockers: compactStrings([
      input.world.spacePressure >= 75 ? "空间压力较高，不宜久停" : "",
    ]),
    tags: ["intent_v0", "rest"],
  })
}

function buildReorganizeCandidate(
  input: BuildButlerIntentDecisionInput
): IntentCandidate {
  const planPressure = Math.min(100, input.world.constructionPlanCount * 16)
  const habitatStress = 100 - input.environment.ecology.habitatStability
  const score = clampPercent(
    input.butler.constructionStyle.aestheticOrganizer * 0.4 +
      planPressure * 0.25 +
      habitatStress * 0.25
  )

  return createCandidate({
    type: "reorganize",
    score,
    reason: "根据整理倾向、计划数量与栖息稳定性评估重整意图。",
    drivers: compactStrings([
      input.butler.constructionStyle.aestheticOrganizer >= 55
        ? "管家整理倾向较高"
        : "",
      input.world.constructionPlanCount >= 3 ? "建设计划较多" : "",
      habitatStress >= 45 ? "栖息稳定性需要修正" : "",
    ]),
    blockers: [],
    tags: ["intent_v0", "organization"],
  })
}

function buildDoNothingCandidate(
  input: BuildButlerIntentDecisionInput
): IntentCandidate {
  const lowMaterials = input.environment.materials.tags.includes("low_materials")
  const buildLimited =
    input.environment.materials.tags.includes("build_limited")
  const fragileHabitat =
    input.environment.ecology.tags.includes("fragile_habitat")
  const passiveButler =
    input.butler.tags.includes("passive") || input.butler.tags.includes("avoidant")
  const score = clampPercent(
    28 +
      (lowMaterials ? 14 : 0) +
      (buildLimited ? 14 : 0) +
      (fragileHabitat ? 12 : 0) +
      (passiveButler ? 22 : 0)
  )

  return createCandidate({
    type: "do_nothing",
    score,
    reason: "停滞或等待是合法结果，会在资源不足或环境脆弱时提升。",
    drivers: compactStrings([
      lowMaterials ? "材料储备偏低" : "",
      buildLimited ? "建造受限" : "",
      fragileHabitat ? "栖息环境脆弱" : "",
      passiveButler ? "管家倾向被动或回避" : "",
    ]),
    blockers: [],
    tags: ["intent_v0", "wait"],
  })
}

function createCandidate(input: {
  type: ButlerIntentType
  score: number
  reason: string
  drivers: string[]
  blockers: string[]
  tags: string[]
}): IntentCandidate {
  const score = clampPercent(input.score)

  return {
    type: input.type,
    score,
    urgency: buildUrgency(score),
    reason: input.reason,
    drivers: input.drivers,
    blockers: input.blockers,
    tags: input.tags,
  }
}

function buildUrgency(score: number): IntentUrgency {
  if (score >= 70) {
    return "high"
  }

  if (score >= 40) {
    return "medium"
  }

  return "low"
}

function includesAny(value: string, keywords: string[]): boolean {
  const normalizedValue = value.toLowerCase()

  return keywords.some((keyword) => normalizedValue.includes(keyword))
}

function compactStrings(values: string[]): string[] {
  return values.filter((value) => value.length > 0)
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}
