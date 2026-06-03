/**
 * 当前文件负责：根据 ConstructionPlannerInput 生成建设候选计划。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import {
  auditConstructionPlanCandidates,
} from "./construction-plan-candidate-audit"
import type {
  ButlerConstructionIntentInput,
  ConstructionIntentGoal,
  ConstructionPlan,
  ConstructionPlanCandidateResult,
  ConstructionPlannerInput,
  ConstructionProjectType,
  ConstructionStage,
  ConstructionStageType,
} from "./construction-schema"

const DEFAULT_STAGE_TYPES: readonly ConstructionStageType[] = [
  "planned",
  "preparing_ground",
  "placing_materials",
  "building",
  "decorating",
  "completed",
]

const PLAN_SPEC_BY_GOAL = {
  stabilize_temporary_shelter: {
    projectType: "stabilize_temporary_shelter",
    idPrefix: "stabilize-temporary-shelter",
    title: "稳定临时住所",
    reason: "管家根据遮蔽、整理和基础管理需求，提出稳定临时住所的建设候选。",
    stageTopic: "临时住所",
    basePriority: 64,
    tags: ["temporary_shelter", "initial_stabilization"],
  },
  improve_initial_care: {
    projectType: "improve_initial_care",
    idPrefix: "improve-initial-care",
    title: "改善初始照护点",
    reason: "管家根据基础物资、观察和整理需求，提出改善初始照护点的建设候选。",
    stageTopic: "初始照护点",
    basePriority: 60,
    tags: ["initial_care", "basic_living_support", "no_unplanned_life_assumption"],
  },
  organize_storage_tools: {
    projectType: "organize_storage_area",
    idPrefix: "organize-storage-tools",
    title: "整理工具储备区",
    reason: "管家根据材料准备度和空间压力，提出整理工具储备区的建设候选。",
    stageTopic: "工具储备区",
    basePriority: 58,
    tags: ["storage_tools", "resource_organization"],
  },
  maintain_natural_boundary: {
    projectType: "maintain_natural_boundary",
    idPrefix: "maintain-natural-boundary",
    title: "维护自然边界",
    reason: "管家根据边界感、生态缓冲和维护压力，提出维护自然边界的建设候选。",
    stageTopic: "自然边界",
    basePriority: 52,
    tags: ["natural_boundary", "boundary_maintenance"],
  },
  preserve_quiet_living: {
    projectType: "preserve_quiet_living",
    idPrefix: "preserve-quiet-living",
    title: "保留安静生活区",
    reason: "管家根据生活缓冲、留白和安静倾向，提出保留安静生活区的建设候选。",
    stageTopic: "安静生活区",
    basePriority: 54,
    tags: ["quiet_living", "living_buffer"],
  },
  prepare_future_expansion: {
    projectType: "prepare_future_expansion",
    idPrefix: "prepare-future-expansion",
    title: "预留未来扩展判断",
    reason: "管家根据发展压力和扩展准备度，提出未来扩展的观察性候选，不直接生成新对象。",
    stageTopic: "未来扩展预留",
    basePriority: 38,
    tags: ["future_expansion", "planning_only", "no_direct_map_mutation"],
  },
} satisfies Record<
  ConstructionIntentGoal,
  {
    projectType: ConstructionProjectType
    idPrefix: string
    title: string
    reason: string
    stageTopic: string
    basePriority: number
    tags: string[]
  }
>

export function buildConstructionPlanCandidates(
  plannerInput: ConstructionPlannerInput
): ConstructionPlanCandidateResult {
  const acceptedIntentIds: string[] = []
  const skippedIntentIds: string[] = []
  const plans = plannerInput.intents.flatMap((intent) => {
    const candidateId = buildPlanId(intent)

    if (plannerInput.existingPlanIds.includes(candidateId)) {
      skippedIntentIds.push(intent.intentId)
      return []
    }

    acceptedIntentIds.push(intent.intentId)
    return [createPlanFromIntent(plannerInput, intent, candidateId)]
  })
  const audit = auditConstructionPlanCandidates({
    plannerInput,
    plans,
    acceptedIntentIds,
    skippedIntentIds,
  })

  return {
    plans,
    audit,
    tags: [
      "construction_plan_candidate_result",
      "planner_input_driven",
      "no_map_diff_generated",
      "no_home_map_state_mutation",
      "no_direct_life_plan",
    ],
  }
}

export function createInitialConstructionPlan(
  homeMapState: HomeMapState
): ConstructionPlan {
  return {
    id: "runtime-quiet-living-plan",
    projectType: "preserve_quiet_living",
    title: "整理安静生活区",
    reason:
      "管家观察到初始家园需要一个更稳定的安静生活区，因此先整理基础生活空间。",
    reasonDrivers: [
      "personality:quiet_maintainer",
      "world_phase:initial_plan",
      "resource:initial_plan",
      "biome:initial_plan",
    ],
    houseStyle: {
      preferenceId: "initial-house-style",
      archetype: "quiet_retreat_house",
      materialPreference: "balanced_natural_mix",
      spatialPreference: {
        footprint: "compact",
        privacy: "buffered",
        layoutFlow: "soft",
        preferredAnchorZone: "quiet_living",
        expansionReadiness: 0.2,
        maintenanceRisk: 0.2,
        tags: ["initial_house_style"],
      },
      scalePreference: "conservative",
      resourcePosture: "stable",
      sourceBiome: "grassland",
      personalityDrivers: ["quietMaintainer"],
      resourceDrivers: ["initial_plan"],
      styleReason: "initial_plan",
      styleTags: ["initial_house_style"],
    },
    styleReason: "initial_plan",
    styleTags: ["initial_house_style"],
    targetZoneType: "quiet_living",
    status: "planned",
    currentStage: "planned",
    priority: 72,
    resourceRequests: [],
    stages: DEFAULT_STAGE_TYPES.map((type) =>
      createStage(type, "安静生活区")
    ),
    createdAt: homeMapState.updatedAt,
    updatedAt: homeMapState.updatedAt,
    tags: ["runtime_construction_plan", "quiet_living_area", "no_ai_api"],
  }
}

function createPlanFromIntent(
  plannerInput: ConstructionPlannerInput,
  intent: ButlerConstructionIntentInput,
  candidateId: string
): ConstructionPlan {
  const spec = PLAN_SPEC_BY_GOAL[intent.goal]
  const priority = calculatePlanPriority(plannerInput, intent, spec.basePriority)

  return {
    id: candidateId,
    projectType: spec.projectType,
    title: spec.title,
    reason: `${spec.reason} ${intent.reason}`,
    reasonDrivers: buildReasonDrivers({ plannerInput, intent }),
    houseStyle: plannerInput.housePreference,
    styleReason: plannerInput.housePreference.styleReason,
    styleTags: plannerInput.housePreference.styleTags,
    targetZoneType: intent.targetZoneType,
    status: "planned",
    currentStage: "planned",
    priority,
    resourceRequests: buildConstructionResourceRequests({
      plannerInput,
      intent,
      planId: candidateId,
      projectType: spec.projectType,
    }),
    stages: DEFAULT_STAGE_TYPES.map((type) =>
      createStage(type, spec.stageTopic)
    ),
    createdAt: plannerInput.homeMapState.updatedAt,
    updatedAt: plannerInput.homeMapState.updatedAt,
    tags: [
      "construction_plan_candidate",
      "planner_input_driven",
      `intent:${intent.intentId}`,
      `phase:${plannerInput.phase.stage}`,
      `biome:${plannerInput.biomeRule.biomeType}`,
      `house:${plannerInput.housePreference.archetype}`,
      "resource_transaction_planned",
      "house_style_metadata",
      ...spec.tags,
    ],
  }
}

function calculatePlanPriority(
  plannerInput: ConstructionPlannerInput,
  intent: ButlerConstructionIntentInput,
  basePriority: number
): number {
  const urgencyScore = intent.urgency * 24
  const resourceScore = intent.resourceSensitivity * 10
  const spaceScore = intent.spaceSensitivity * 8
  const phaseScore =
    intent.tags.some((tag) => tag.startsWith("phase_boost:")) ||
    intent.source === "world_phase"
      ? 8
      : 0
  const pressureScore = plannerInput.phase.developmentPressure * 6

  return clampPriority(
    Math.round(
      basePriority + urgencyScore + resourceScore + spaceScore + phaseScore + pressureScore
    )
  )
}

function buildConstructionResourceRequests(input: {
  plannerInput: ConstructionPlannerInput
  intent: ButlerConstructionIntentInput
  planId: string
  projectType: ConstructionProjectType
}): ConstructionPlan["resourceRequests"] {
  const multiplier =
    input.plannerInput.biomeRule.constructionModifiers.materialCostMultiplier
  const baseCost = getProjectBaseCost(input.projectType)
  const materialCost = -roundResourceCost(baseCost.materialReadiness * multiplier)
  const careCost = -roundResourceCost(baseCost.careReadiness)
  const groundCost = -roundResourceCost(
    baseCost.groundHealth *
      (1 + input.plannerInput.biomeRule.constructionModifiers.maintenanceRisk / 2)
  )
  const requests: ConstructionPlan["resourceRequests"] = [
    {
      transactionId: `${input.planId}:material-cost`,
      resourceKey: "materialReadiness",
      amount: materialCost,
      reason: buildResourceRequestReason(input, "material"),
      source: "construction_cost",
      tags: ["construction_resource_cost", input.projectType],
    },
  ]

  if (careCost < 0) {
    requests.push({
      transactionId: `${input.planId}:care-cost`,
      resourceKey: "careReadiness",
      amount: careCost,
      reason: buildResourceRequestReason(input, "care"),
      source: "construction_cost",
      tags: ["construction_resource_cost", input.projectType],
    })
  }

  if (groundCost < 0) {
    requests.push({
      transactionId: `${input.planId}:ground-cost`,
      resourceKey: "groundHealth",
      amount: groundCost,
      reason: buildResourceRequestReason(input, "ground"),
      source: "construction_cost",
      tags: ["construction_resource_cost", input.projectType],
    })
  }

  return requests
}

function getProjectBaseCost(
  projectType: ConstructionProjectType
): {
  materialReadiness: number
  careReadiness: number
  groundHealth: number
} {
  const costs = {
    stabilize_temporary_shelter: {
      materialReadiness: 8,
      careReadiness: 2,
      groundHealth: 2,
    },
    improve_initial_care: {
      materialReadiness: 5,
      careReadiness: 6,
      groundHealth: 1,
    },
    organize_storage_area: {
      materialReadiness: 6,
      careReadiness: 1,
      groundHealth: 1,
    },
    improve_path: {
      materialReadiness: 4,
      careReadiness: 0,
      groundHealth: 3,
    },
    maintain_natural_boundary: {
      materialReadiness: 3,
      careReadiness: 2,
      groundHealth: 4,
    },
    preserve_quiet_living: {
      materialReadiness: 4,
      careReadiness: 3,
      groundHealth: 1,
    },
    prepare_future_expansion: {
      materialReadiness: 1,
      careReadiness: 0,
      groundHealth: 0,
    },
    decorate_home: {
      materialReadiness: 3,
      careReadiness: 1,
      groundHealth: 0,
    },
  } satisfies Record<
    ConstructionProjectType,
    { materialReadiness: number; careReadiness: number; groundHealth: number }
  >

  return costs[projectType]
}

function buildResourceRequestReason(
  input: {
    plannerInput: ConstructionPlannerInput
    intent: ButlerConstructionIntentInput
    projectType: ConstructionProjectType
  },
  costType: "material" | "care" | "ground"
): string {
  return [
    `personality:${input.intent.intentId}`,
    `world:${input.plannerInput.phase.stage}`,
    `resource:${costType}`,
    `biome:${input.plannerInput.biomeRule.biomeType}`,
  ].join(" / ")
}

function buildReasonDrivers(input: {
  plannerInput: ConstructionPlannerInput
  intent: ButlerConstructionIntentInput
}): string[] {
  return [
    `personality:structured-${input.plannerInput.constructionStyle.structuredBuilder.toFixed(2)}`,
    `personality:care-${input.plannerInput.constructionStyle.warmCaretaker.toFixed(2)}`,
    `personality:protect-${input.plannerInput.constructionStyle.protectiveKeeper.toFixed(2)}`,
    `world_phase:${input.plannerInput.phase.stage}`,
    `resource:material-${input.plannerInput.resources.materialReadiness}`,
    `resource:space-${input.plannerInput.resources.spacePressure}`,
    `biome:${input.plannerInput.biomeRule.biomeType}`,
    `house:${input.plannerInput.housePreference.archetype}`,
    `intent:${input.intent.intentId}`,
  ]
}

function roundResourceCost(value: number): number {
  return Math.max(0, Math.round(value))
}

function buildPlanId(intent: ButlerConstructionIntentInput): string {
  return `candidate-${PLAN_SPEC_BY_GOAL[intent.goal].idPrefix}`
}

function createStage(
  type: ConstructionStageType,
  topic: string
): ConstructionStage {
  const stageText: Record<
    ConstructionStageType,
    { label: string; description: string }
  > = {
    planned: {
      label: "计划",
      description: `确认${topic}的位置、目标和资源约束。`,
    },
    preparing_ground: {
      label: "整理地面",
      description: `整理${topic}附近的地面，让后续建设有承托。`,
    },
    placing_materials: {
      label: "放置材料",
      description: `把基础材料放到${topic}附近。`,
    },
    building: {
      label: "搭建",
      description: `形成${topic}的基础结构和可见秩序。`,
    },
    decorating: {
      label: "点缀",
      description: `用自然细节让${topic}更融入家园。`,
    },
    completed: {
      label: "完成",
      description: `标记${topic}候选建设流程完成。`,
    },
  }

  return {
    id: `stage-${type}`,
    type,
    label: stageText[type].label,
    description: stageText[type].description,
    progress: 0,
    mapDiffIds: [],
    completed: false,
  }
}

function clampPriority(value: number): number {
  return Math.min(100, Math.max(0, value))
}