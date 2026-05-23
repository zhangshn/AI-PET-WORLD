/**
 * 当前文件负责：从 HomeMapState 与管家建设倾向构建 ConstructionPlanner 输入。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import { getBiomeRule, selectBiomeType } from "@/world/ecology/biome-rules"
import type {
  HomeMapState,
  HomeZoneType,
} from "@/world/map-state/home-map-state-schema"
import { buildHousePreference } from "@/world/house-style/house-preference-builder"
import { auditHousePreference } from "@/world/house-style/house-style-audit"
import { buildInitialResourcePoolState } from "@/world/resource-cycle/resource-cycle"

import type {
  ButlerConstructionIntentInput,
  ConstructionIntentGoal,
  ConstructionIntentSource,
  ConstructionPlannerInput,
  ConstructionPlannerInputBuildResult,
  ConstructionPlannerPhaseInput,
  ConstructionPlannerStage,
} from "./construction-schema"
import { toConstructionResourceSnapshot } from "./construction-schema"
import { auditConstructionPlannerInput } from "./construction-planner-input-audit"

const DEFERRED_BUTLER_CONSTRUCTION_TARGETS: readonly HomeZoneType[] = [
  "temporary_shelter",
  "initial_care",
  "storage_tools",
  "quiet_living",
]

export function buildConstructionPlannerInput(input: {
  homeMapState: HomeMapState
  constructionStyle: ButlerConstructionStyleVector
  worldDay: number
}): ConstructionPlannerInputBuildResult {
  const resources = toConstructionResourceSnapshot(input.homeMapState.resources)
  const resourcePoolState =
    input.homeMapState.resources.resourcePoolState ??
    buildInitialResourcePoolState({
      worldId: input.homeMapState.worldId,
      regionId: "construction-runtime-fallback",
      seed: input.homeMapState.seed,
      biomeType: selectBiomeType({
        requestedBiomeType: undefined,
        seed: input.homeMapState.seed,
      }),
      currentOverrides: resources,
      tags: ["construction_runtime_resource_pool_fallback"],
    })
  const biomeRule = getBiomeRule(resourcePoolState.biomeType)
  const housePreference = buildHousePreference({
    worldId: input.homeMapState.worldId,
    seed: input.homeMapState.seed,
    constructionStyle: input.constructionStyle,
    biomeType: biomeRule.biomeType,
    resources,
    maintenanceRisk: biomeRule.constructionModifiers.maintenanceRisk,
    materialCostMultiplier:
      biomeRule.constructionModifiers.materialCostMultiplier,
    boundaryDensityBias: biomeRule.layoutModifiers.boundaryDensityBias,
    shelterSafetyBias: biomeRule.layoutModifiers.shelterSafetyBias,
    tags: ["construction_planner_house_style"],
  })
  const housePreferenceAudit = auditHousePreference(housePreference)
  const phase = buildConstructionPlannerPhase({
    resources,
    worldDay: input.worldDay,
    constructionStyle: input.constructionStyle,
    biomeRule,
  })
  const intents = buildButlerConstructionIntents({
    homeMapState: input.homeMapState,
    constructionStyle: input.constructionStyle,
    biomeRule,
    phase,
  })
  const plannerInput: ConstructionPlannerInput = {
    worldId: input.homeMapState.worldId,
    ownerId: input.homeMapState.ownerId,
    seed: input.homeMapState.seed,
    homeMapState: input.homeMapState,
    constructionStyle: input.constructionStyle,
    biomeRule,
    resourcePoolState,
    housePreference,
    resources,
    phase,
    intents,
    existingPlanIds: input.homeMapState.constructionPlans.map((plan) => plan.id),
    tags: [
      "construction_planner_input",
      "home_map_state_driven",
      "butler_style_driven",
      "resource_snapshot_driven",
      "biome_rule_driven",
      "resource_pool_state_driven",
      "house_preference_driven",
      "deferred_butler_construction_target_supported",
      ...housePreferenceAudit.tags,
      "no_direct_map_mutation",
      "no_default_companion_plan",
    ],
  }

  return {
    input: plannerInput,
    audit: auditConstructionPlannerInput(plannerInput),
  }
}

function buildConstructionPlannerPhase(input: {
  resources: ConstructionPlannerInput["resources"]
  worldDay: number
  constructionStyle: ButlerConstructionStyleVector
  biomeRule: ConstructionPlannerInput["biomeRule"]
}): ConstructionPlannerPhaseInput {
  const developmentPressure = clamp01(
    input.resources.spacePressure / 100 +
      (100 - input.resources.materialReadiness) / 260
  )
  const maintenancePressure = clamp01(
    (100 - input.resources.groundHealth) / 140 +
      input.resources.naturalGrowth / 260 +
      input.biomeRule.constructionModifiers.maintenanceRisk / 4
  )
  const expansionReadiness = clamp01(
    input.resources.materialReadiness / 120 +
      input.constructionStyle.structuredBuilder / 3 +
      input.constructionStyle.adaptivePlanner / 5
  )

  return {
    stage: resolveConstructionPlannerStage({
      resources: input.resources,
      developmentPressure,
      maintenancePressure,
    }),
    worldDay: input.worldDay,
    developmentPressure,
    maintenancePressure,
    expansionReadiness,
    tags: [
      "construction_phase_input",
      `development:${developmentPressure.toFixed(2)}`,
      `maintenance:${maintenancePressure.toFixed(2)}`,
      `expansion:${expansionReadiness.toFixed(2)}`,
    ],
  }
}

function resolveConstructionPlannerStage(input: {
  resources: ConstructionPlannerInput["resources"]
  developmentPressure: number
  maintenancePressure: number
}): ConstructionPlannerStage {
  if (input.maintenancePressure >= 0.46 || input.resources.naturalGrowth >= 68) {
    return "boundary_maintenance"
  }

  if (input.resources.spacePressure >= 38 || input.resources.materialReadiness >= 58) {
    return "resource_organization"
  }

  if (input.resources.careReadiness >= 54 || input.developmentPressure >= 0.42) {
    return "basic_living_support"
  }

  return "initial_stabilization"
}

function buildButlerConstructionIntents(input: {
  homeMapState: HomeMapState
  constructionStyle: ButlerConstructionStyleVector
  biomeRule: ConstructionPlannerInput["biomeRule"]
  phase: ConstructionPlannerPhaseInput
}): ButlerConstructionIntentInput[] {
  const intents = [
    createIntent({
      id: "stabilize-temporary-shelter",
      source: "butler_autonomy",
      goal: "stabilize_temporary_shelter",
      targetZoneType: "temporary_shelter",
      urgency: 0.48 + input.constructionStyle.protectiveKeeper * 0.28,
      patience: 0.42 + input.constructionStyle.quietMaintainer * 0.28,
      resourceSensitivity: 0.45 + input.constructionStyle.structuredBuilder * 0.24,
      spaceSensitivity: 0.35 + input.constructionStyle.protectiveKeeper * 0.24,
      reason: "管家优先判断是否需要搭建临时住所；该目标不是初始世界事实，必须通过资源消耗与 MapDiff 后续进入世界。",
      tags: [
        "temporary_shelter",
        "initial_stabilization",
        "butler_construction_target",
        "not_initial_world_fact",
      ],
    }),
    createIntent({
      id: "improve-initial-care",
      source: "resource_pressure",
      goal: "improve_initial_care",
      targetZoneType: "initial_care",
      urgency: 0.42 + input.constructionStyle.warmCaretaker * 0.34,
      patience: 0.36 + input.constructionStyle.adaptivePlanner * 0.2,
      resourceSensitivity: 0.5 + input.constructionStyle.warmCaretaker * 0.22,
      spaceSensitivity: 0.32 + input.constructionStyle.structuredBuilder * 0.18,
      reason: "照护点属于管家建设目标，不属于世界自然初始内容；管家会先确认材料、照护准备和空间条件。",
      tags: [
        "initial_care",
        "basic_living_support",
        "no_pet_assumption",
        "butler_construction_target",
        "not_initial_world_fact",
      ],
    }),
    createIntent({
      id: "organize-storage-tools",
      source: "resource_pressure",
      goal: "organize_storage_tools",
      targetZoneType: "storage_tools",
      urgency: 0.34 + input.constructionStyle.structuredBuilder * 0.36,
      patience: 0.44 + input.constructionStyle.adaptivePlanner * 0.16,
      resourceSensitivity: 0.58 + input.constructionStyle.structuredBuilder * 0.24,
      spaceSensitivity: 0.46 + input.homeMapState.resources.spacePressure / 220,
      reason: "管家根据材料准备度和空间压力判断是否整理工具储备区；储物区需要由管家后续建设生成。",
      tags: [
        "storage_tools",
        "resource_organization",
        "butler_construction_target",
        "not_initial_world_fact",
      ],
    }),
    createIntent({
      id: "maintain-natural-boundary",
      source: "maintenance_need",
      goal: "maintain_natural_boundary",
      targetZoneType: "natural_boundary",
      urgency: 0.26 + input.constructionStyle.protectiveKeeper * 0.25,
      patience: 0.38 + input.constructionStyle.quietMaintainer * 0.2,
      resourceSensitivity: 0.28 + input.homeMapState.resources.naturalGrowth / 240,
      spaceSensitivity: 0.4 + input.constructionStyle.protectiveKeeper * 0.18,
      reason: "自然边界属于世界自然事实，管家只能维护、修剪或整理，不能把自然边界当作人工建筑。",
      tags: ["natural_boundary", "boundary_maintenance", "world_nature_fact"],
    }),
    createIntent({
      id: "preserve-quiet-living",
      source: "butler_autonomy",
      goal: "preserve_quiet_living",
      targetZoneType: "quiet_living",
      urgency: 0.3 + input.constructionStyle.quietMaintainer * 0.34,
      patience: 0.5 + input.constructionStyle.quietMaintainer * 0.26,
      resourceSensitivity: 0.3 + input.constructionStyle.aestheticOrganizer * 0.18,
      spaceSensitivity: 0.5 + input.constructionStyle.quietMaintainer * 0.18,
      reason: "安静生活区属于管家的后续空间规划，不应作为初始世界事实直接出现。",
      tags: [
        "quiet_living",
        "living_buffer",
        "butler_construction_target",
        "not_initial_world_fact",
      ],
    }),
    createIntent({
      id: "prepare-future-expansion",
      source: "world_phase",
      goal: "prepare_future_expansion",
      targetZoneType: "visual_center",
      urgency: 0.18 + input.phase.expansionReadiness * 0.3,
      patience: 0.48 + input.constructionStyle.adaptivePlanner * 0.26,
      resourceSensitivity: 0.52 + input.phase.expansionReadiness * 0.18,
      spaceSensitivity: 0.42 + input.phase.developmentPressure * 0.22,
      reason: "仅预留未来扩展判断，不直接生成新对象，也不触发宠物进入。",
      tags: ["future_expansion", "planning_only", "no_direct_map_mutation"],
    }),
  ]

  return prioritizeIntentsByPhase(intents, input.phase.stage)
    .map((intent) =>
      applyBiomeIntentModifiers({
        intent,
        biomeRule: input.biomeRule,
        phase: input.phase,
      })
    )
    .filter((intent) =>
      isActionableConstructionTarget({
        homeMapState: input.homeMapState,
        targetZoneType: intent.targetZoneType,
      })
    )
}

function applyBiomeIntentModifiers(input: {
  intent: ButlerConstructionIntentInput
  biomeRule: ConstructionPlannerInput["biomeRule"]
  phase: ConstructionPlannerPhaseInput
}): ButlerConstructionIntentInput {
  const maintenanceRisk = input.biomeRule.constructionModifiers.maintenanceRisk
  const materialCostMultiplier =
    input.biomeRule.constructionModifiers.materialCostMultiplier
  const biomeBoost =
    input.intent.goal === "maintain_natural_boundary"
      ? maintenanceRisk * 0.16
      : input.intent.goal === "organize_storage_tools"
        ? materialCostMultiplier > 1
          ? 0.08
          : 0.03
        : input.intent.goal === "stabilize_temporary_shelter"
          ? input.biomeRule.layoutModifiers.shelterSafetyBias * 0.16
          : 0

  return {
    ...input.intent,
    urgency: clamp01(input.intent.urgency + biomeBoost),
    resourceSensitivity: clamp01(
      input.intent.resourceSensitivity + materialCostMultiplier / 20
    ),
    reason: [
      input.intent.reason,
      `Biome:${input.biomeRule.biomeType}.`,
      `Resource pressure:${input.phase.developmentPressure.toFixed(2)}.`,
      `Maintenance:${input.phase.maintenancePressure.toFixed(2)}.`,
    ].join(" "),
    tags: [
      ...input.intent.tags,
      `biome:${input.biomeRule.biomeType}`,
      `material_cost:${materialCostMultiplier.toFixed(2)}`,
      `maintenance_risk:${maintenanceRisk.toFixed(2)}`,
    ],
  }
}

function prioritizeIntentsByPhase(
  intents: ButlerConstructionIntentInput[],
  stage: ConstructionPlannerStage
): ButlerConstructionIntentInput[] {
  const boostedGoal = {
    initial_stabilization: "stabilize_temporary_shelter",
    basic_living_support: "improve_initial_care",
    resource_organization: "organize_storage_tools",
    boundary_maintenance: "maintain_natural_boundary",
  } satisfies Record<ConstructionPlannerStage, ConstructionIntentGoal>

  return intents
    .map((intent) =>
      intent.goal === boostedGoal[stage]
        ? {
            ...intent,
            urgency: clamp01(intent.urgency + 0.18),
            tags: [...intent.tags, `phase_boost:${stage}`],
          }
        : intent
    )
    .sort((left, right) => right.urgency - left.urgency)
}

function createIntent(input: {
  id: string
  source: ConstructionIntentSource
  goal: ConstructionIntentGoal
  targetZoneType: HomeZoneType
  urgency: number
  patience: number
  resourceSensitivity: number
  spaceSensitivity: number
  reason: string
  tags: string[]
}): ButlerConstructionIntentInput {
  return {
    intentId: input.id,
    source: input.source,
    goal: input.goal,
    urgency: clamp01(input.urgency),
    patience: clamp01(input.patience),
    resourceSensitivity: clamp01(input.resourceSensitivity),
    spaceSensitivity: clamp01(input.spaceSensitivity),
    targetZoneType: input.targetZoneType,
    reason: input.reason,
    tags: ["construction_intent", ...input.tags],
  }
}

function isActionableConstructionTarget(input: {
  homeMapState: HomeMapState
  targetZoneType: HomeZoneType
}): boolean {
  if (hasZone(input.homeMapState, input.targetZoneType)) {
    return true
  }

  if (DEFERRED_BUTLER_CONSTRUCTION_TARGETS.includes(input.targetZoneType)) {
    return true
  }

  return input.homeMapState.constructionPlans.some(
    (plan) => plan.targetZoneType === input.targetZoneType
  )
}

function hasZone(homeMapState: HomeMapState, zoneType: HomeZoneType): boolean {
  return homeMapState.zones.some((zone) => zone.type === zoneType)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
