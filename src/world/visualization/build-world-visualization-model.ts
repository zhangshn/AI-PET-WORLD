/**
 * 当前文件负责把世界状态转换为逻辑可视化模型。
 */

import type { ConstructionPlan } from "@/world/construction/construction-schema"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import {
  buildButlerTaskSummary,
  buildConstructionTimelineSummary,
  buildPetNeedSummary,
} from "./construction-visualization-mapper"
import { buildMapDiffLogSummary } from "./map-diff-log-mapper"
import type {
  WorldStateSummary,
  WorldVisualizationModel,
} from "./world-visualization-schema"
import { buildZoneGraphSummary } from "./zone-graph-mapper"

export type BuildWorldVisualizationModelInput = {
  homeMapState: HomeMapState
  constructionPlan: ConstructionPlan | null
  constructionMessage: string
  worldTick: number
  lastAutoConstructionTick: number | null
  localSnapshotLoaded: boolean
}

export function buildWorldVisualizationModel(
  input: BuildWorldVisualizationModelInput
): WorldVisualizationModel {
  return {
    world: buildWorldStateSummary(input),
    butler: buildButlerTaskSummary(input.constructionPlan),
    construction: buildConstructionTimelineSummary(
      input.constructionPlan,
      input.constructionMessage
    ),
    zones: buildZoneGraphSummary(input.homeMapState, input.constructionPlan),
    mapDiffs: buildMapDiffLogSummary(
      input.homeMapState,
      input.constructionMessage
    ),
    pet: buildPetNeedSummary(input.constructionPlan),
  }
}

function buildWorldStateSummary(
  input: BuildWorldVisualizationModelInput
): WorldStateSummary {
  return {
    worldId: input.homeMapState.worldId,
    ownerId: input.homeMapState.ownerId,
    tick: input.worldTick,
    dayLabel: buildDayLabel(input.worldTick),
    timeLabel: buildTimeLabel(input.worldTick),
    homeStatus: buildHomeStatus(input.constructionPlan),
    persistenceStatus: input.localSnapshotLoaded ? "local_saved" : "not_saved",
    lastAutoConstructionTick: input.lastAutoConstructionTick,
    placementCount: input.homeMapState.placements.length,
    zoneCount: input.homeMapState.zones.length,
  }
}

function buildDayLabel(worldTick: number): string {
  const day = Math.floor(worldTick / 24) + 1
  return `第 ${day} 天`
}

function buildTimeLabel(worldTick: number): string {
  const hour = worldTick % 24
  return `${String(hour).padStart(2, "0")}:00`
}

function buildHomeStatus(plan: ConstructionPlan | null): string {
  if (!plan) return "初始家园观察中"
  if (plan.currentStage === "completed") return "宠物休息角已完成"
  return "宠物休息角建设中"
}
