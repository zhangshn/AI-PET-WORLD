/**
 * 当前文件负责：定义家园系统状态。
 */

export type HomeStatus =
  | "idle"
  | "building"
  | "completed"

export type HomeConstructionStage =
  | "temporary_shelter"
  | "foundation"
  | "frame"
  | "roof"
  | "interior"
  | "garden"
  | "completed"

export type HomeEvolutionFocus =
  | "balanced"
  | "expansion"
  | "stability"
  | "comfort"
  | "order"
  | "adaptive"

export type HomeSpaceId =
  | "empty_land"
  | "incubator_area"
  | "temporary_shelter"
  | "garden_area"
  | "storage_area"
  | "activity_area"

export type HomeSpaceStatus =
  | "locked"
  | "available"
  | "building"
  | "active"

export type HomeSpaceRole =
  | "origin"
  | "incubation"
  | "shelter"
  | "garden"
  | "storage"
  | "activity"

export type HomeSpaceState = {
  id: HomeSpaceId
  name: string
  role: HomeSpaceRole
  status: HomeSpaceStatus
  order: number
  progress: number
  comfort: number
  stability: number
  activity: number
  description: string
  tags: string[]
}

export type HomeSpaceSummary = {
  primarySpaceId: HomeSpaceId
  primarySpaceName: string
  buildingSpaceIds: HomeSpaceId[]
  activeSpaceIds: HomeSpaceId[]
  availableSpaceIds: HomeSpaceId[]
  maintenanceSpaceIds: HomeSpaceId[]
  activitySpaceIds: HomeSpaceId[]
  overallComfort: number
  overallStability: number
  overallActivity: number
  summary: string
  tags: string[]
}

export type HomeState = {
  level: number
  progress: number
  status: HomeStatus
  constructionStage: HomeConstructionStage
  evolutionFocus: HomeEvolutionFocus
  gardenProgress: number
  comfort: number
  stability: number
  expansion: number
  homeSpaces?: HomeSpaceState[]
  spaceSummary?: HomeSpaceSummary
}
