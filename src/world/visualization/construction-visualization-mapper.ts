/**
 * 当前文件职责：把建设计划转换为可视化摘要。
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
    description: "管家观察第一片家园的基础生活需求。",
  },
  preparing_ground: {
    label: "整理地面",
    description: "先整理安静生活区附近的基础空间。",
  },
  placing_materials: {
    label: "放置材料",
    description: "把需要的材料移动到建设目标附近。",
  },
  building: {
    label: "搭建结构",
    description: "整理基础生活支撑点和生活区秩序。",
  },
  decorating: {
    label: "完成布置",
    description: "加入少量自然点缀，让生活区更稳定。",
  },
  completed: {
    label: "建设完成",
    description: "安静生活区进入可持续维护状态。",
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
      taskReason: "管家正在评估第一片家园最需要先稳定的生活区域。",
      nextLikelyAction: "形成安静生活区的第一版建设计划。",
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
    restNeed: completed ? 35 : 64,
    foodNeed: 48,
    waterNeed: 46,
    safetyNeed: building ? 62 : 54,
    currentFocus: completed
      ? "安静生活区已经完成，后续会继续观察基础资源和安全感需求。"
      : "当前建设以稳定第一片家园的生活秩序为优先。",
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
    planned: "整理安静生活区地面。",
    preparing_ground: "把材料放到生活区附近。",
    placing_materials: "整理基础生活支撑点。",
    building: "给生活区增加自然点缀。",
    decorating: "确认安静生活区完成。",
    completed: "继续观察家园状态与基础资源。",
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
