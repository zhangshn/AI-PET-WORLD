/**
 * 当前文件职责：定义管家建设计划与执行结果类型。
 */

import type {
  HomeMapState,
  HomeZoneType,
  MapDiff,
} from "@/world/map-state/home-map-state-schema"

export type ConstructionProjectType =
  | "improve_quiet_living"
  | "improve_care_area"
  | "improve_food_water_area"
  | "organize_storage_area"
  | "improve_path"
  | "decorate_home"

export type ConstructionStageType =
  | "planned"
  | "preparing_ground"
  | "placing_materials"
  | "building"
  | "decorating"
  | "completed"

export type ConstructionPlanStatus = "planned" | "active" | "completed"

export type ConstructionStage = {
  id: string
  type: ConstructionStageType
  label: string
  description: string
  progress: number
  mapDiffIds: string[]
  completed: boolean
}

export type ConstructionPlan = {
  id: string
  projectType: ConstructionProjectType
  title: string
  reason: string
  targetZoneType: HomeZoneType
  status: ConstructionPlanStatus
  currentStage: ConstructionStageType
  priority: number
  stages: ConstructionStage[]
  createdAt: number
  updatedAt: number
  tags: string[]
}

export type ConstructionExecutionInput = {
  homeMapState: HomeMapState
  plan: ConstructionPlan
  now: number
}

export type ConstructionExecutionResult = {
  nextPlan: ConstructionPlan
  mapDiffs: MapDiff[]
  messages: string[]
  tags: string[]
}
