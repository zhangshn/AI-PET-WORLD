/**
 * 当前文件职责：把管家的内在动机转换为可排序的自主目标候选。
 */

import type {
  ButlerConsciousState,
  ButlerGoal,
  ButlerMemoryState,
  ButlerMotivation,
  ButlerWorldPerception,
} from "./butler-autonomy-schema"

export function buildButlerGoals(input: {
  motivations: ButlerMotivation[]
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
  memoryState: ButlerMemoryState
}): ButlerGoal[] {
  const motivationByKind = new Map(
    input.motivations.map((motivation) => [motivation.kind, motivation])
  )

  return [
    buildWaitAndRecordGoal({
      motivationByKind,
      consciousState: input.consciousState,
      perception: input.perception,
    }),
    buildPrepareResourcesGoal({
      motivationByKind,
      perception: input.perception,
      memoryState: input.memoryState,
    }),
    buildPrepareCareGoal({
      motivationByKind,
      perception: input.perception,
      memoryState: input.memoryState,
    }),
    buildMaintainBoundaryGoal({
      motivationByKind,
      perception: input.perception,
      memoryState: input.memoryState,
    }),
    buildPreserveQuietSpaceGoal({
      motivationByKind,
      perception: input.perception,
    }),
    buildObserveWorldGoal({
      perception: input.perception,
      consciousState: input.consciousState,
    }),
    buildExplainToPlayerGoal({
      motivationByKind,
      consciousState: input.consciousState,
    }),
  ].sort((left, right) => right.priority - left.priority)
}

function buildWaitAndRecordGoal(input: {
  motivationByKind: Map<ButlerMotivation["kind"], ButlerMotivation>
  consciousState: ButlerConsciousState
  perception: ButlerWorldPerception
}): ButlerGoal {
  const waiting = input.motivationByKind.get("waiting")?.intensity ?? 50
  const resourcePrudence =
    input.motivationByKind.get("resource_prudence")?.intensity ?? 50
  const priority = weightedScore([
    [waiting, 0.4],
    [resourcePrudence, 0.25],
    [input.consciousState.recoveryPressure, 0.2],
    [input.perception.resourcePressure, 0.15],
  ])

  return buildGoal({
    kind: "wait_and_record",
    priority,
    constructionAllowed: false,
    sourceMotivationIds: ["motivation-waiting", "motivation-resource_prudence"],
    reason:
      "当资源、恢复或风险压力偏高时，等待与记录是管家的合法自主目标，而不是系统停摆。",
    tags: ["wait_strategy", "memory_record", "no_construction"],
  })
}

function buildPrepareResourcesGoal(input: {
  motivationByKind: Map<ButlerMotivation["kind"], ButlerMotivation>
  perception: ButlerWorldPerception
  memoryState: ButlerMemoryState
}): ButlerGoal {
  const order = input.motivationByKind.get("order")?.intensity ?? 50
  const resourcePrudence =
    input.motivationByKind.get("resource_prudence")?.intensity ?? 50
  const priority = weightedScore([
    [order, 0.35],
    [resourcePrudence, 0.25],
    [input.perception.storageNeed, 0.25],
    [input.memoryState.learnedPreferences.resourceCautionBias, 0.15],
  ])

  return buildGoal({
    kind: "prepare_resources",
    priority,
    constructionAllowed: true,
    sourceMotivationIds: ["motivation-order", "motivation-resource_prudence"],
    reason:
      "材料、储物和资源谨慎动机共同指向资源准备，后续可交给建设规划层判断能否执行。",
    tags: ["resource_preparation", "construction_planner_candidate"],
  })
}

function buildPrepareCareGoal(input: {
  motivationByKind: Map<ButlerMotivation["kind"], ButlerMotivation>
  perception: ButlerWorldPerception
  memoryState: ButlerMemoryState
}): ButlerGoal {
  const care = input.motivationByKind.get("care")?.intensity ?? 50
  const priority = weightedScore([
    [care, 0.5],
    [input.perception.careNeed, 0.3],
    [input.memoryState.learnedPreferences.careBias, 0.2],
  ])

  return buildGoal({
    kind: "prepare_care",
    priority,
    constructionAllowed: true,
    sourceMotivationIds: ["motivation-care"],
    reason:
      "照护目标只代表管家准备基础生活与关系条件，不代表默认生成宠物或宠物专属设施。",
    tags: ["care_preparation", "future_life_boundary", "no_default_pet"],
  })
}

function buildMaintainBoundaryGoal(input: {
  motivationByKind: Map<ButlerMotivation["kind"], ButlerMotivation>
  perception: ButlerWorldPerception
  memoryState: ButlerMemoryState
}): ButlerGoal {
  const safety = input.motivationByKind.get("safety")?.intensity ?? 50
  const ecologyRespect =
    input.motivationByKind.get("ecology_respect")?.intensity ?? 50
  const priority = weightedScore([
    [safety, 0.45],
    [ecologyRespect, 0.2],
    [input.perception.boundaryMaintenanceNeed, 0.25],
    [input.memoryState.learnedPreferences.boundaryBias, 0.1],
  ])

  return buildGoal({
    kind: "maintain_boundary",
    priority,
    constructionAllowed: true,
    sourceMotivationIds: ["motivation-safety", "motivation-ecology_respect"],
    reason:
      "边界维护来自安全与生态尊重动机，优先保护世界稳定，而不是单纯扩张建设。",
    tags: ["boundary_maintenance", "ecology_respect"],
  })
}

function buildPreserveQuietSpaceGoal(input: {
  motivationByKind: Map<ButlerMotivation["kind"], ButlerMotivation>
  perception: ButlerWorldPerception
}): ButlerGoal {
  const ecologyRespect =
    input.motivationByKind.get("ecology_respect")?.intensity ?? 50
  const priority = weightedScore([
    [input.perception.quietSpaceNeed, 0.45],
    [input.perception.spacePressure, 0.25],
    [ecologyRespect, 0.3],
  ])

  return buildGoal({
    kind: "preserve_quiet_space",
    priority,
    constructionAllowed: true,
    sourceMotivationIds: ["motivation-ecology_respect"],
    reason:
      "当空间压力或生态压力存在时，管家可能优先保留安静空间，而不是继续加建筑。",
    tags: ["quiet_space", "anti_overbuilding"],
  })
}

function buildObserveWorldGoal(input: {
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
}): ButlerGoal {
  const priority = weightedScore([
    [52, 0.35],
    [input.consciousState.attentionLevel, 0.3],
    [input.perception.risks.length > 0 ? 68 : 42, 0.2],
    [input.perception.opportunities.length > 0 ? 58 : 45, 0.15],
  ])

  return buildGoal({
    kind: "observe_world",
    priority,
    constructionAllowed: false,
    sourceMotivationIds: [],
    reason:
      "观察世界是管家自主生活的一部分。没有足够把握时，先观察比盲目行动更合理。",
    tags: ["observe_world", "no_construction"],
  })
}

function buildExplainToPlayerGoal(input: {
  motivationByKind: Map<ButlerMotivation["kind"], ButlerMotivation>
  consciousState: ButlerConsciousState
}): ButlerGoal {
  const explanation = input.motivationByKind.get("explanation")?.intensity ?? 48
  const priority = weightedScore([
    [explanation, 0.6],
    [input.consciousState.attentionLevel, 0.25],
    [input.consciousState.recoveryPressure, 0.15],
  ])

  return buildGoal({
    kind: "explain_to_player",
    priority,
    constructionAllowed: false,
    sourceMotivationIds: ["motivation-explanation"],
    reason:
      "管家可以向玩家解释自己为什么行动或等待，但解释不能制造新的世界事实。",
    tags: ["explain_to_player", "p_phone_ready", "no_world_fact_write"],
  })
}

function buildGoal(input: {
  kind: ButlerGoal["kind"]
  priority: number
  constructionAllowed: boolean
  sourceMotivationIds: string[]
  reason: string
  tags: string[]
}): ButlerGoal {
  const priority = clampScore(input.priority)

  return {
    goalId: `goal-${input.kind}`,
    kind: input.kind,
    priority,
    confidence: clampScore(45 + priority / 2),
    constructionAllowed: input.constructionAllowed,
    sourceMotivationIds: input.sourceMotivationIds,
    reason: input.reason,
    tags: ["butler_goal", input.kind, ...input.tags],
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
