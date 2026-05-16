/**
 * 当前文件负责：生成 MVP 第一版管家建设计划。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionPlan,
  ConstructionStage,
  ConstructionStageType,
} from "./construction-schema"

const PET_REST_STAGE_TYPES: ConstructionStageType[] = [
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
    id: "mvp-pet-rest-area-plan",
    projectType: "build_pet_rest_area",
    title: "整理宠物休息角",
    reason:
      "管家观察到宠物抵达后需要一个更稳定的休息角，因此先整理宠物休息区。",
    targetZoneType: "pet_rest",
    status: "planned",
    currentStage: "planned",
    priority: 72,
    stages: PET_REST_STAGE_TYPES.map(createStage),
    createdAt: homeMapState.updatedAt,
    updatedAt: homeMapState.updatedAt,
    tags: ["mvp_construction_plan", "pet_rest_area", "no_ai_api"],
  }
}

function createStage(type: ConstructionStageType): ConstructionStage {
  const stageText: Record<
    ConstructionStageType,
    { label: string; description: string }
  > = {
    planned: {
      label: "计划",
      description: "确认宠物休息角的位置与基础整理目标。",
    },
    preparing_ground: {
      label: "整理地面",
      description: "清理宠物休息区附近的地面，让后续设施有承托。",
    },
    placing_materials: {
      label: "放置材料",
      description: "把基础材料放到宠物休息区附近。",
    },
    building: {
      label: "搭建",
      description: "放置宠物床，形成可见休息点。",
    },
    decorating: {
      label: "点缀",
      description: "用小草、花与石头让休息角更自然。",
    },
    completed: {
      label: "完成",
      description: "标记宠物休息角已经完成。",
    },
  }

  return {
    id: `stage-${type}`,
    type,
    label: stageText[type].label,
    description: stageText[type].description,
    progress: type === "planned" ? 0 : 0,
    mapDiffIds: [],
    completed: false,
  }
}
