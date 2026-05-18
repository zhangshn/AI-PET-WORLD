/**
 * 当前文件职责：定义世界变化计划与变化提案协议。
 */

import type { EnvironmentState } from "@/world/environment/environment-gateway"
import type {
  ButlerIntentType,
  IntentDecision,
} from "@/world/intent-system/intent-gateway"
import type {
  HomeMapState,
  HomeZoneType,
  MapDiff,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"

export type WorldChangePlanType =
  | "build_structure"
  | "maintain_area"
  | "plant_nature"
  | "expand_area"
  | "observe_area"
  | "rest_area"
  | "reorganize_area"
  | "no_change"

export type WorldChangePlanStatus = "proposed" | "blocked" | "skipped"

export type WorldChangeTarget = {
  zoneType?: HomeZoneType
  placementLayer?: MapPlacementLayer
  tags: string[]
}

export type WorldChangePlan = {
  id: string
  type: WorldChangePlanType
  status: WorldChangePlanStatus
  sourceIntentType: ButlerIntentType
  sourceIntentScore: number
  shouldGenerateDiff: boolean
  target: WorldChangeTarget
  reason: string
  blockers: string[]
  tags: string[]
}

export type WorldDiffProposalType =
  | "map_diff"
  | "geometry_diff"
  | "ecology_diff"
  | "state_diff"
  | "no_diff"

export type WorldDiffProposal = {
  id: string
  type: WorldDiffProposalType
  planId: string
  acceptedForPlanning: boolean
  mapDiffs: MapDiff[]
  reason: string
  warnings: string[]
  tags: string[]
}

export type BuildWorldChangePlanInput = {
  homeMapState: HomeMapState
  environment: EnvironmentState
  decision: IntentDecision
  now: number
}

export type BuildWorldDiffProposalInput = {
  homeMapState: HomeMapState
  plan: WorldChangePlan
  now: number
}
