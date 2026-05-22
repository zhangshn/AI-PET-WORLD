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
    tags: ["initial_care", "basic_living_support", "no_pet_assumption"],
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
      "no_default_companion_plan",
    ],
  }
}

export function createInitialConstructionPlan(
  homeMapState: HomeMapState
): ConstructionPlan {
  return {
    id: "mvp-quiet-living-plan",
    projectType: "preserve_quiet_living",
    title: "整理安静生活区",
    reason:
      "管家观察到初始家园需要一个更稳定的安静生活区，因此先整理基础生活空间。",
    targetZoneType: "quiet_living",
    status: "planned",
    currentStage: "planned",
    priority: 72,
    stages: DEFAULT_STAGE_TYPES.map((type) =>
      createStage(type, "安静生活区")
    ),
    createdAt: homeMapState.updatedAt,
    updatedAt: homeMapState.updatedAt,
    tags: ["mvp_construction_plan", "quiet_living_area", "no_ai_api"],
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
    targetZoneType: intent.targetZoneType,
    status: "planned",
    currentStage: "planned",
    priority,
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
