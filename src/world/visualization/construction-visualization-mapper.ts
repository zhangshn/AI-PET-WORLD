/**
 * 当前文件负责把建设计划转换为可视化摘要。
 */

import type {
  ConstructionPlan,
  ConstructionStageType,
} from "@/world/construction/construction-schema"

import type {
  ButlerTaskSummary,
  ConstructionTimelineSummary,
  PetNeedSummary,
} from "./world-visualization-schema"

const STAGE_ORDER: ConstructionStageType[] = [
  "planned",
  "preparing_ground",
  "placing_materials",
  "building",
  "decorating",
  "completed",
]

const DEFAULT_STAGE_TEXT: Record<
  ConstructionStageType,
  { label: string; description: string }
> = {
  planned: {
    label: "计划形成",
    description: "管家观察宠物抵达后的家园需求。",
  },
  preparing_ground: {
    label: "整理地面",
    description: "先整理宠物休息角附近的基础空间。",
  },
  placing_materials: {
    label: "放置材料",
    description: "把需要的材料移动到建设目标附近。",
  },
  building: {
    label: "搭建结构",
    description: "整理宠物床和休息角基础设施。",
  },
  decorating: {
    label: "完成布置",
    description: "加入少量自然点缀，让休息角更稳定。",
  },
  completed: {
    label: "建设完成",
    description: "宠物休息角进入可持续维护状态。",
  },
}

export function buildConstructionTimelineSummary(
  plan: ConstructionPlan | null,
  latestMessage: string
): ConstructionTimelineSummary {
  if (!plan) {
    return {
      planId: null,
      currentStage: "未开始",
      progressPercent: 0,
      stages: STAGE_ORDER.map((stageType) => ({
        id: stageType,
        label: DEFAULT_STAGE_TEXT[stageType].label,
        status: "pending",
        description: DEFAULT_STAGE_TEXT[stageType].description,
      })),
      latestMessage,
    }
  }

  const currentIndex = STAGE_ORDER.indexOf(plan.currentStage)
  const safeCurrentIndex = Math.max(currentIndex, 0)
  const progressPercent =
    plan.currentStage === "completed"
      ? 100
      : Math.round((safeCurrentIndex / (STAGE_ORDER.length - 1)) * 100)

  return {
    planId: plan.id,
    currentStage: getStageLabel(plan.currentStage),
    progressPercent,
    stages: STAGE_ORDER.map((stageType, index) => {
      const planStage = plan.stages.find((stage) => stage.type === stageType)

      return {
        id: stageType,
        label: planStage?.label ?? DEFAULT_STAGE_TEXT[stageType].label,
        status: getTimelineStageStatus(index, safeCurrentIndex, plan),
        description:
          planStage?.description ?? DEFAULT_STAGE_TEXT[stageType].description,
      }
    }),
    latestMessage,
  }
}

export function buildButlerTaskSummary(
  plan: ConstructionPlan | null
): ButlerTaskSummary {
  if (!plan) {
    return {
      currentTask: "观察家园状态",
      taskReason: "宠物已经抵达，管家正在评估最需要先稳定的生活区域。",
      nextLikelyAction: "形成宠物休息角的第一版建设计划。",
      autonomyLevel: "observing",
    }
  }

  return {
    currentTask: plan.title,
    taskReason: plan.reason,
    nextLikelyAction: getNextLikelyAction(plan.currentStage),
    autonomyLevel: getAutonomyLevel(plan.currentStage),
  }
}

export function buildPetNeedSummary(
  plan: ConstructionPlan | null
): PetNeedSummary {
  const completed = plan?.currentStage === "completed"
  const building = plan !== null && !completed

  return {
    restNeed: completed ? 35 : 82,
    foodNeed: 48,
    waterNeed: 46,
    safetyNeed: building ? 62 : 54,
    currentFocus: completed
      ? "宠物休息角已经完成，后续会继续观察食物、饮水和安全感需求。"
      : "宠物状态接入中，当前建设以休息需求为优先。",
  }
}

export function getStageLabel(stageType: ConstructionStageType): string {
  return DEFAULT_STAGE_TEXT[stageType].label
}

function getTimelineStageStatus(
  stageIndex: number,
  currentIndex: number,
  plan: ConstructionPlan
): "done" | "active" | "pending" {
  if (plan.currentStage === "completed") {
    return stageIndex < STAGE_ORDER.length - 1 ? "done" : "active"
  }

  if (stageIndex < currentIndex) return "done"
  if (stageIndex === currentIndex) return "active"
  return "pending"
}

function getNextLikelyAction(stageType: ConstructionStageType): string {
  const actions: Record<ConstructionStageType, string> = {
    planned: "整理宠物休息角地面。",
    preparing_ground: "把材料放到休息角附近。",
    placing_materials: "整理原有宠物床的位置。",
    building: "给休息角增加自然点缀。",
    decorating: "确认宠物休息角完成。",
    completed: "继续观察宠物状态与家园资源。",
  }

  return actions[stageType]
}

function getAutonomyLevel(
  stageType: ConstructionStageType
): ButlerTaskSummary["autonomyLevel"] {
  if (stageType === "completed") return "completed"
  if (stageType === "planned" || stageType === "preparing_ground") {
    return "planning"
  }

  return "building"
}
