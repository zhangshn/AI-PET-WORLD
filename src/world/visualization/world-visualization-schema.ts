/**
 * 当前文件负责定义世界逻辑可视化模型。
 */

export type WorldVisualizationModel = {
  world: WorldStateSummary
  butler: ButlerTaskSummary
  construction: ConstructionTimelineSummary
  zones: ZoneGraphSummary
  mapDiffs: MapDiffLogSummary
  pet: PetNeedSummary
}

export type WorldStateSummary = {
  worldId: string
  ownerId: string
  tick: number
  dayLabel: string
  timeLabel: string
  homeStatus: string
  persistenceStatus: "local_saved" | "not_saved"
  lastAutoConstructionTick: number | null
  placementCount: number
  zoneCount: number
}

export type ButlerTaskSummary = {
  currentTask: string
  taskReason: string
  nextLikelyAction: string
  autonomyLevel: "observing" | "planning" | "building" | "completed"
}

export type ConstructionTimelineSummary = {
  planId: string | null
  currentStage: string
  progressPercent: number
  stages: Array<{
    id: string
    label: string
    status: "done" | "active" | "pending"
    description: string
  }>
  latestMessage: string
}

export type ZoneGraphSummary = {
  nodes: Array<{
    id: string
    label: string
    role: string
    status: "quiet" | "active" | "under_construction" | "completed"
  }>
  edges: Array<{
    from: string
    to: string
    label: string
  }>
}

export type MapDiffLogSummary = {
  items: Array<{
    id: string
    type: "add" | "update" | "move" | "remove"
    label: string
    description: string
    tickLabel: string
  }>
}

export type PetNeedSummary = {
  restNeed: number
  foodNeed: number
  waterNeed: number
  safetyNeed: number
  currentFocus: string
}
