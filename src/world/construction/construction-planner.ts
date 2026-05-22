/**
 * 当前文件负责：生成 MVP 第一版管家建设计划。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionPlan,
  ConstructionStage,
  ConstructionStageType,
} from "./construction-schema"

const QUIET_LIVING_STAGE_TYPES: ConstructionStageType[] = [
  "planned",
  "preparing_ground",
  "placing_materials",
  "building",
  "decorating",
  "completed",
]

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
    stages: QUIET_LIVING_STAGE_TYPES.map(createStage),
    createdAt: homeMapState.updatedAt,
    updatedAt: homeMapState.updatedAt,
    tags: ["mvp_construction_plan", "quiet_living_area", "no_ai_api"],
  }
}

function createStage(type: ConstructionStageType): ConstructionStage {
  const stageText: Record<
    ConstructionStageType,
    { label: string; description: string }
  > = {
    planned: {
      label: "计划",
      description: "确认安静生活区的位置与基础整理目标。",
    },
    preparing_ground: {
      label: "整理地面",
      description: "清理安静生活区附近的地面，让后续生活设施有承托。",
    },
    placing_materials: {
      label: "放置材料",
      description: "把基础材料放到安静生活区附近。",
    },
    building: {
      label: "搭建",
      description: "整理基础生活支撑点，形成可见的生活秩序。",
    },
    decorating: {
      label: "点缀",
      description: "用小草、花与石头让生活区更自然。",
    },
    completed: {
      label: "完成",
      description: "标记安静生活区已经完成。",
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
