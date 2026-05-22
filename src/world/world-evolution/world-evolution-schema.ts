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
  | "build_path"
  | "build_shelter"
  | "maintain_area"
  | "repair_facility"
  | "clean_area"
  | "plant_nature"
  | "expand_area"
  | "move_object"
  | "remove_object"
  | "upgrade_facility"
  | "observe_area"
  | "rest_area"
  | "reorganize_area"
  | "rebalance_zones"
  | "no_change"

export type WorldChangePlanStatus = "proposed" | "blocked" | "skipped"

export type WorldChangePlanPriority =
  | "low"
  | "medium"
  | "high"
  | "critical"

export type WorldChangePlanRiskHint =
  | "low_risk"
  | "space_sensitive"
  | "resource_sensitive"
  | "pet_sensitive"
  | "initial_care_sensitive"
  | "geometry_sensitive"
  | "persistence_sensitive"

export type WorldChangePlanScope =
  | "single_placement"
  | "single_zone"
  | "multi_placement"
  | "multi_zone"
  | "whole_home"
  | "observation_only"

export type WorldChangeTarget = {
  zoneType?: HomeZoneType
  placementLayer?: MapPlacementLayer
  placementId?: string
  preferredAssetTags?: string[]
  tags: string[]
}

export type WorldChangePlan = {
  id: string
  type: WorldChangePlanType
  status: WorldChangePlanStatus
  sourceIntentType: ButlerIntentType
  sourceIntentScore: number
  priority: WorldChangePlanPriority
  scope: WorldChangePlanScope
  riskHints: WorldChangePlanRiskHint[]
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
