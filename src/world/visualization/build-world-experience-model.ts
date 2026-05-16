/**
 * 当前文件负责把世界状态转换为正式体验模型。
 */

import type {
  ConstructionPlan,
  ConstructionStageType,
} from "@/world/construction/construction-schema"
import type {
  HomeMapState,
  HomeZoneType,
  MapDiff,
} from "@/world/map-state/home-map-state-schema"

import type { WorldExperienceModel } from "./world-experience-schema"

export type BuildWorldExperienceModelInput = {
  homeMapState: HomeMapState
  constructionPlan: ConstructionPlan | null
  constructionMessage: string
  worldTick: number
}

const STAGE_ORDER: ConstructionStageType[] = [
  "planned",
  "preparing_ground",
  "placing_materials",
  "building",
  "decorating",
  "completed",
]

const STAGE_COPY: Record<
  ConstructionStageType,
  {
    label: string
    narrative: string
    story: string
    nextAction: string
  }
> = {
  planned: {
    label: "形成计划",
    narrative: "管家正在确认宠物休息角的位置。",
    story: "管家先观察宠物抵达后的动线，判断哪里更适合短暂休息。",
    nextAction: "整理休息角附近的地面。",
  },
  preparing_ground: {
    label: "整理地面",
    narrative: "管家开始整理附近的地面，让休息区更稳定。",
    story: "附近空间被轻轻整理出来，休息角开始有了清晰边界。",
    nextAction: "把基础材料放到休息区附近。",
  },
  placing_materials: {
    label: "放置材料",
    narrative: "管家把基础材料放到休息区附近。",
    story: "材料被放在不会打扰宠物的位置，后续整理可以继续推进。",
    nextAction: "把宠物床整理到更安静的位置。",
  },
  building: {
    label: "搭建",
    narrative: "管家正在把宠物床整理到更安静的位置。",
    story: "宠物床被重新整理，休息角开始真正承担恢复精力的作用。",
    nextAction: "给休息角周围增加自然点缀。",
  },
  decorating: {
    label: "点缀",
    narrative: "管家在休息区周围增加了一些自然点缀。",
    story: "休息角周围多了一点柔和的自然感，环境不再显得临时。",
    nextAction: "确认宠物休息角已经可以使用。",
  },
  completed: {
    label: "完成",
    narrative: "宠物休息角已经完成，管家开始继续观察宠物状态。",
    story: "宠物现在拥有一个更稳定的休息角，管家把注意力转向后续照护。",
    nextAction: "继续观察宠物的饮食与安全需求。",
  },
}

const ZONE_COPY: Record<
  HomeZoneType,
  { label: string; description: string }
> = {
  visual_center: {
    label: "家园核心",
    description: "管家会在这里观察家园的主要生活关系。",
  },
  pet_arrival: {
    label: "宠物抵达区",
    description: "宠物来到家园后的第一处停留点。",
  },
  initial_care: {
    label: "初始照护区",
    description: "食物、饮水和基础照护会从这里开始。",
  },
  temporary_shelter: {
    label: "临时住所区",
    description: "家园早期可以依靠的安静住所。",
  },
  pet_rest: {
    label: "宠物休息区",
    description: "当前建设重点，直接回应宠物的休息需求。",
  },
  storage_tools: {
    label: "储物工具区",
    description: "管家整理材料和工具的地方。",
  },
  natural_boundary: {
    label: "自然边界区",
    description: "外围环境形成安全和缓冲。",
  },
}

export function buildWorldExperienceModel(
  input: BuildWorldExperienceModelInput
): WorldExperienceModel {
  const currentStage = input.constructionPlan?.currentStage ?? "planned"
  const stageCopy = STAGE_COPY[currentStage]
  const progressPercent = buildProgressPercent(input.constructionPlan)

  return {
    hero: {
      title: "AI-PET-WORLD",
      subtitle: "你的家园正在由管家自主照看",
      currentNarrative: buildCurrentNarrative(input.constructionPlan),
      statusLabel: buildStatusLabel(input.constructionPlan, input.worldTick),
    },
    pet: buildPetExperience(input.constructionPlan),
    butler: {
      taskLabel: input.constructionPlan?.title ?? "观察新抵达后的家园状态",
      reason:
        input.constructionPlan?.reason ??
        "管家正在判断宠物抵达后最需要被照看的生活区域。",
      nextAction: stageCopy.nextAction,
      autonomyLabel: buildAutonomyLabel(input.constructionPlan),
    },
    homeGrowth: {
      zones: buildHomeGrowthZones(input.homeMapState, input.constructionPlan),
    },
    construction: {
      currentStageLabel: stageCopy.label,
      progressPercent,
      stages: STAGE_ORDER.map((stageType, index) => ({
        id: stageType,
        label: STAGE_COPY[stageType].label,
        status: buildStageStatus(stageType, index, input.constructionPlan),
        story: STAGE_COPY[stageType].story,
      })),
    },
    events: buildExperienceEvents(input),
  }
}

function buildCurrentNarrative(plan: ConstructionPlan | null): string {
  if (!plan) {
    return "宠物刚抵达这个家园，管家正在安静观察：哪里适合休息，哪里适合照护，哪些地方需要先被整理出来。"
  }

  const stageCopy = STAGE_COPY[plan.currentStage]

  if (plan.currentStage === "completed") {
    return "管家先检查了宠物休息区附近的空间，然后把宠物床整理到更安静的位置。这个角落现在成为宠物短暂休息的地方。"
  }

  return stageCopy.narrative
}

function buildStatusLabel(
  plan: ConstructionPlan | null,
  worldTick: number
): string {
  const hour = String(worldTick % 24).padStart(2, "0")

  if (!plan) return `${hour}:00｜管家正在观察家园`
  if (plan.currentStage === "completed") {
    return `${hour}:00｜休息角已经完成`
  }

  return `${hour}:00｜管家正在自主建设`
}

function buildPetExperience(
  plan: ConstructionPlan | null
): WorldExperienceModel["pet"] {
  const completed = plan?.currentStage === "completed"

  return {
    stateLabel: completed ? "休息环境已稳定" : "正在适应新家园",
    restNeed: completed ? 34 : 82,
    foodNeed: 48,
    waterNeed: 46,
    safetyNeed: completed ? 45 : 62,
    currentFocus: completed
      ? "宠物现在有了更安静的休息角，管家会继续观察饮食和安全感。"
      : "宠物状态接入中，当前家园优先回应休息需求。",
  }
}

function buildAutonomyLabel(plan: ConstructionPlan | null): string {
  if (!plan) return "观察中"
  if (plan.currentStage === "completed") return "照看中"
  if (plan.currentStage === "planned" || plan.currentStage === "preparing_ground") {
    return "判断中"
  }

  return "建设中"
}

function buildHomeGrowthZones(
  homeMapState: HomeMapState,
  plan: ConstructionPlan | null
): WorldExperienceModel["homeGrowth"]["zones"] {
  const functionalZoneTypes: HomeZoneType[] = [
    "pet_arrival",
    "initial_care",
    "temporary_shelter",
    "pet_rest",
    "storage_tools",
  ]

  const existingZoneTypes = new Set(homeMapState.zones.map((zone) => zone.type))

  return functionalZoneTypes.map((zoneType) => ({
    id: zoneType,
    label: ZONE_COPY[zoneType].label,
    status: buildZoneStatus(zoneType, plan, existingZoneTypes.has(zoneType)),
    description: ZONE_COPY[zoneType].description,
  }))
}

function buildZoneStatus(
  zoneType: HomeZoneType,
  plan: ConstructionPlan | null,
  exists: boolean
): WorldExperienceModel["homeGrowth"]["zones"][number]["status"] {
  if (!exists) return "pending"
  if (plan?.targetZoneType === zoneType) {
    return plan.currentStage === "completed" ? "completed" : "active"
  }
  if (zoneType === "pet_arrival" || zoneType === "initial_care") {
    return "observing"
  }
  return "pending"
}

function buildProgressPercent(plan: ConstructionPlan | null): number {
  if (!plan) return 0
  if (plan.currentStage === "completed") return 100

  const currentIndex = STAGE_ORDER.indexOf(plan.currentStage)
  return Math.round((Math.max(currentIndex, 0) / (STAGE_ORDER.length - 1)) * 100)
}

function buildStageStatus(
  stageType: ConstructionStageType,
  stageIndex: number,
  plan: ConstructionPlan | null
): WorldExperienceModel["construction"]["stages"][number]["status"] {
  if (!plan) return stageType === "planned" ? "active" : "pending"
  if (plan.currentStage === "completed") {
    return stageType === "completed" ? "active" : "done"
  }

  const currentIndex = STAGE_ORDER.indexOf(plan.currentStage)
  if (stageIndex < currentIndex) return "done"
  if (stageIndex === currentIndex) return "active"
  return "pending"
}

function buildExperienceEvents(
  input: BuildWorldExperienceModelInput
): WorldExperienceModel["events"] {
  const diffEvents = [...input.homeMapState.mapDiffs]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 5)
    .map(mapDiffToExperienceEvent)

  if (diffEvents.length > 0) return diffEvents

  if (input.constructionPlan) {
    return [
      {
        id: "current-construction-message",
        text: normalizeConstructionMessage(
          input.constructionMessage,
          input.constructionPlan.currentStage
        ),
        tone:
          input.constructionPlan.currentStage === "completed"
            ? "complete"
            : "building",
      },
    ]
  }

  return [
    {
      id: "world-observation-started",
      text: "管家正在观察宠物抵达后的家园状态。",
      tone: "quiet",
    },
  ]
}

function mapDiffToExperienceEvent(
  diff: MapDiff
): WorldExperienceModel["events"][number] {
  if (diff.operation === "move") {
    return {
      id: diff.id,
      text: "管家把一个生活物件整理到了更合适的位置。",
      tone: "building",
    }
  }

  if (diff.operation === "update") {
    return {
      id: diff.id,
      text: buildUpdateEventText(diff),
      tone: diff.tags.includes("completed_construction") ? "complete" : "care",
    }
  }

  if (diff.operation === "add") {
    return {
      id: diff.id,
      text: buildAddEventText(diff),
      tone: diff.tags.includes("construction_decoration") ? "care" : "building",
    }
  }

  return {
    id: diff.id,
    text: "管家移除了一个暂时不再需要的临时布置。",
    tone: "quiet",
  }
}

function buildUpdateEventText(diff: MapDiff): string {
  if (diff.placementId.includes("pet-bed")) {
    return "管家把宠物床整理到了更安静的位置。"
  }

  return "管家更新了一个家园角落的状态。"
}

function buildAddEventText(diff: MapDiff): string {
  const tags = new Set([...(diff.placement?.tags ?? []), ...diff.tags])

  if (tags.has("construction_decoration")) {
    return "休息角附近增加了一些自然点缀。"
  }

  if (tags.has("construction_material")) {
    return "管家把基础材料放到了休息角附近。"
  }

  return "管家为家园增加了一处新的布置。"
}

function normalizeConstructionMessage(
  _message: string,
  stageType: ConstructionStageType
): string {
  return STAGE_COPY[stageType].narrative
}
