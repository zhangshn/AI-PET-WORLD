/**
 * 当前文件负责：定义 ConstructionPlanner 输入协议与建设计划类型。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type {
  HomeMapState,
  HomeResourceState,
  HomeZoneType,
  MapDiff,
} from "@/world/map-state/home-map-state-schema"

export type ConstructionProjectType =
  | "stabilize_temporary_shelter"
  | "improve_initial_care"
  | "organize_storage_area"
  | "improve_path"
  | "maintain_natural_boundary"
  | "preserve_quiet_living"
  | "prepare_future_expansion"
  | "decorate_home"

export type ConstructionStageType =
  | "planned"
  | "preparing_ground"
  | "placing_materials"
  | "building"
  | "decorating"
  | "completed"

export type ConstructionPlanStatus =
  | "planned"
  | "active"
  | "paused"
  | "completed"

export type ConstructionPlannerStage =
  | "initial_stabilization"
  | "basic_living_support"
  | "resource_organization"
  | "boundary_maintenance"

export type ConstructionIntentGoal =
  | "stabilize_temporary_shelter"
  | "improve_initial_care"
  | "organize_storage_tools"
  | "maintain_natural_boundary"
  | "preserve_quiet_living"
  | "prepare_future_expansion"

export type ConstructionIntentSource =
  | "butler_autonomy"
  | "resource_pressure"
  | "world_phase"
  | "maintenance_need"

export type ConstructionResourceKey =
  | "groundHealth"
  | "naturalGrowth"
  | "materialReadiness"
  | "careReadiness"
  | "spacePressure"

export type ConstructionPlannerResourceSnapshot = Record<
  ConstructionResourceKey,
  number
>

export type ConstructionPlannerPhaseInput = {
  stage: ConstructionPlannerStage
  worldDay: number
  developmentPressure: number
  maintenancePressure: number
  expansionReadiness: number
  tags: string[]
}

export type ButlerConstructionIntentInput = {
  intentId: string
  source: ConstructionIntentSource
  goal: ConstructionIntentGoal
  urgency: number
  patience: number
  resourceSensitivity: number
  spaceSensitivity: number
  targetZoneType: HomeZoneType
  reason: string
  tags: string[]
}

export type ConstructionPlannerInput = {
  worldId: string
  ownerId: string
  seed: string
  homeMapState: HomeMapState
  constructionStyle: ButlerConstructionStyleVector
  resources: ConstructionPlannerResourceSnapshot
  phase: ConstructionPlannerPhaseInput
  intents: ButlerConstructionIntentInput[]
  existingPlanIds: string[]
  tags: string[]
}

export type ConstructionPlannerInputAudit = {
  stableInputFingerprint: string
  checkedIntentIds: string[]
  checkedZoneTypes: HomeZoneType[]
  warnings: string[]
  tags: string[]
}

export type ConstructionPlannerInputBuildResult = {
  input: ConstructionPlannerInput
  audit: ConstructionPlannerInputAudit
}

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

export type ConstructionPlanCandidateAudit = {
  stableOutputFingerprint: string
  candidatePlanIds: string[]
  acceptedIntentIds: string[]
  skippedIntentIds: string[]
  warnings: string[]
  tags: string[]
}

export type ConstructionPlanCandidateResult = {
  plans: ConstructionPlan[]
  audit: ConstructionPlanCandidateAudit
  tags: string[]
}

export type ConstructionExecutionInput = {
  homeMapState: HomeMapState
  plan: ConstructionPlan
  now: number
}

export type ConstructionMapDiffCandidate = MapDiff & {
  tags: string[]
}

export type ConstructionExecutionAudit = {
  stableExecutionFingerprint: string
  planId: string
  mapDiffIds: string[]
  warnings: string[]
  tags: string[]
}

export type ConstructionExecutionResult = {
  nextPlan: ConstructionPlan
  mapDiffs: MapDiff[]
  messages: string[]
  audit: ConstructionExecutionAudit
  tags: string[]
}

export type ConstructionExecutionBuildResult = {
  input: ConstructionExecutionInput
  result: ConstructionExecutionResult
  audit: ConstructionExecutionAudit
}

export type ConstructionSafeApplyInput = {
  homeMapState: HomeMapState
  executionResult: ConstructionExecutionResult
  now: number
}

export type ConstructionSafeApplyRejectedDiff = {
  diffId: string
  reason: string
  tags: string[]
}

export type ConstructionSafeApplyAudit = {
  stableSafeApplyFingerprint: string
  sourcePlanId: string
  acceptedDiffIds: string[]
  rejectedDiffIds: string[]
  warnings: string[]
  tags: string[]
}

export type ConstructionSafeApplyResult = {
  nextHomeMapState: HomeMapState
  acceptedDiffIds: string[]
  rejectedDiffs: ConstructionSafeApplyRejectedDiff[]
  messages: string[]
  audit: ConstructionSafeApplyAudit
  tags: string[]
}

export type ConstructionSafeApplyBuildResult = {
  input: ConstructionSafeApplyInput
  result: ConstructionSafeApplyResult
  audit: ConstructionSafeApplyAudit
}

export function toConstructionResourceSnapshot(
  resources: HomeResourceState
): ConstructionPlannerResourceSnapshot {
  return {
    groundHealth: resources.groundHealth,
    naturalGrowth: resources.naturalGrowth,
    materialReadiness: resources.materialReadiness,
    careReadiness: resources.careReadiness,
    spacePressure: resources.spacePressure,
  }
}
