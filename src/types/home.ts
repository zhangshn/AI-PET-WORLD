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
}