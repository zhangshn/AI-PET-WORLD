/**
 * 当前文件负责：定义 ConstructionPlanner 输入协议与建设计划类型。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type { BiomeRule } from "@/world/ecology/ecology-schema"
import type {
  HomeMapState,
  HomeResourceState,
  HomeZoneType,
  MapDiff,
} from "@/world/map-state/home-map-state-schema"
import type {
  ResourceCycleResult,
  ResourcePoolState,
  ResourceTransaction,
  ResourceTransactionRequest,
} from "@/world/resource-cycle/resource-schema"

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
  biomeRule: BiomeRule
  resourcePoolState: ResourcePoolState
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
  reasonDrivers: string[]
  targetZoneType: HomeZoneType
  status: ConstructionPlanStatus
  currentStage: ConstructionStageType
  priority: number
  resourceRequests: ResourceTransactionRequest[]
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
  resourceCycleResult: ResourceCycleResult | null
  resourceTransactions: ResourceTransaction[]
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

export type ConstructionWorldLoopProtocolInput = {
  homeMapState: HomeMapState
  constructionStyle: ButlerConstructionStyleVector
  worldDay: number
  now: number
  preferredPlanId?: string
  tags: string[]
}

export type ConstructionWorldLoopAudit = {
  stableWorldLoopFingerprint: string
  selectedPlanId: string | null
  plannerWarningCount: number
  candidateWarningCount: number
  executionWarningCount: number
  safeApplyWarningCount: number
  acceptedDiffIds: string[]
  rejectedDiffIds: string[]
  warnings: string[]
  tags: string[]
}

export type ConstructionWorldLoopProtocolResult = {
  nextHomeMapState: HomeMapState
  plannerInputResult: ConstructionPlannerInputBuildResult
  candidateResult: ConstructionPlanCandidateResult
  selectedPlan: ConstructionPlan | null
  executionResult: ConstructionExecutionResult | null
  safeApplyResult: ConstructionSafeApplyResult | null
  messages: string[]
  audit: ConstructionWorldLoopAudit
  tags: string[]
}

export type ConstructionWorldLoopProtocolBuildResult = {
  input: ConstructionWorldLoopProtocolInput
  result: ConstructionWorldLoopProtocolResult
  audit: ConstructionWorldLoopAudit
}

export type ConstructionRuntimeRunReason =
  | "manual_debug"
  | "scheduled_tick"
  | "world_recovery"
  | "maintenance_check"

export type ConstructionPersistenceMode =
  | "proposal_only"
  | "disabled"

export type ConstructionVisualRefreshMode =
  | "signal_only"
  | "disabled"

export type ConstructionRuntimeCycleInput = {
  homeMapState: HomeMapState
  constructionStyle: ButlerConstructionStyleVector
  worldDay: number
  now: number
  preferredPlanId?: string
  runReason: ConstructionRuntimeRunReason
  persistenceMode: ConstructionPersistenceMode
  visualRefreshMode: ConstructionVisualRefreshMode
  tags: string[]
}

export type ConstructionPersistenceProposal = {
  proposalId: string
  worldId: string
  ownerId: string
  seed: string
  sourcePlanId: string | null
  shouldPersist: boolean
  baseUpdatedAt: number
  nextUpdatedAt: number
  acceptedDiffIds: string[]
  rejectedDiffIds: string[]
  reason: string
  tags: string[]
}

export type ConstructionVisualRefreshSignal = {
  signalId: string
  worldId: string
  ownerId: string
  sourcePlanId: string | null
  shouldRefresh: boolean
  acceptedDiffIds: string[]
  changedPlacementIds: string[]
  reason: string
  tags: string[]
}

export type ConstructionRuntimeCycleAudit = {
  stableRuntimeFingerprint: string
  sourceWorldId: string
  sourceOwnerId: string
  selectedPlanId: string | null
  acceptedDiffIds: string[]
  rejectedDiffIds: string[]
  persistenceProposalId: string | null
  visualRefreshSignalId: string | null
  warnings: string[]
  tags: string[]
}

export type ConstructionRuntimeCycleResult = {
  nextHomeMapState: HomeMapState
  worldLoopProtocolResult: ConstructionWorldLoopProtocolResult
  persistenceProposal: ConstructionPersistenceProposal | null
  visualRefreshSignal: ConstructionVisualRefreshSignal | null
  messages: string[]
  audit: ConstructionRuntimeCycleAudit
  tags: string[]
}

export type ConstructionRuntimeCycleBuildResult = {
  input: ConstructionRuntimeCycleInput
  result: ConstructionRuntimeCycleResult
  audit: ConstructionRuntimeCycleAudit
}

export type ConstructionMemoryPersistenceMode =
  | "memory_commit"
  | "memory_preview"
  | "disabled"

export type ConstructionRuntimeAdapterInput = ConstructionRuntimeCycleInput & {
  memoryPersistenceMode?: ConstructionMemoryPersistenceMode
}

export type ConstructionRuntimeVerticalSliceInput =
  ConstructionRuntimeAdapterInput

export type ConstructionMemoryPersistenceMockResult = {
  mockPersistenceId: string
  proposalId: string | null
  mode: ConstructionMemoryPersistenceMode
  didStore: boolean
  shouldCommit: boolean
  previewOnly: boolean
  storedWorldId: string
  storedUpdatedAt: number | null
  acceptedDiffIds: string[]
  reason: string
  tags: string[]
}

export type ConstructionVisualRefreshBridgeResult = {
  bridgeId: string
  signalId: string | null
  shouldRequestRefresh: boolean
  changedPlacementIds: string[]
  acceptedDiffIds: string[]
  reason: string
  tags: string[]
}

export type ConstructionSnapshotRefreshRequest = {
  requestId: string
  worldId: string
  ownerId: string
  changedPlacementIds: string[]
  acceptedDiffIds: string[]
  reason: string
  shouldRefreshSnapshot: boolean
  shouldRebuildFormalVisualModel: boolean
  stableRefreshFingerprint: string
  tags: string[]
}

export type ConstructionSnapshotRefreshAudit = {
  stableSnapshotRefreshFingerprint: string
  sourceWorldId: string
  changedPlacementIds: string[]
  acceptedDiffIds: string[]
  warnings: string[]
  tags: string[]
}

export type ConstructionFormalVisualRefreshPrecheck = {
  worldId: string
  shouldRebuildFormalVisualModel: boolean
  reason: string
  audit: ConstructionSnapshotRefreshAudit
  tags: string[]
}

export type ConstructionPersistenceAdapterRequest = {
  requestId: string
  proposalId: string | null
  worldId: string
  ownerId: string
  seed: string
  sourceUpdatedAt: number
  nextUpdatedAt: number
  acceptedDiffIds: string[]
  shouldPersist: boolean
  reason: string
  tags: string[]
}

export type ConstructionPersistenceAdapterAudit = {
  stablePersistenceFingerprint: string
  sourceWorldId: string
  sourceOwnerId: string
  acceptedDiffIds: string[]
  warnings: string[]
  tags: string[]
}

export type ConstructionPersistenceAdapterDryRunResult = {
  request: ConstructionPersistenceAdapterRequest
  audit: ConstructionPersistenceAdapterAudit
  canPersist: boolean
  shouldPersist: boolean
  rejectedReason: string | null
  sourceWorldId: string
  sourceUpdatedAt: number
  nextUpdatedAt: number
  acceptedDiffIds: string[]
  tags: string[]
}

export type ConstructionFullPipelineAudit = {
  stablePipelineFingerprint: string
  worldId: string
  ownerId: string
  selectedPlanId: string | null
  acceptedDiffIds: string[]
  rejectedDiffIds: string[]
  shouldPersist: boolean
  shouldRefresh: boolean
  warnings: string[]
  tags: string[]
}

export type ConstructionPipelineReport = {
  reportId: string
  worldId: string
  ownerId: string
  status: "applied_to_memory_mock" | "no_changes" | "blocked_by_audit"
  selectedPlanId: string | null
  acceptedDiffCount: number
  rejectedDiffCount: number
  changedPlacementCount: number
  shouldPersist: boolean
  shouldRefresh: boolean
  messages: string[]
  sections: ConstructionPipelineReportSection[]
  tags: string[]
}

export type ConstructionPipelineReportSection = {
  title: string
  status: "ok" | "warning" | "skipped"
  lines: string[]
  tags: string[]
}

export type ConstructionRuntimeAdapterResult = {
  nextHomeMapState: HomeMapState
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
  fullPipelineAudit: ConstructionFullPipelineAudit
  pipelineReport: ConstructionPipelineReport
  messages: string[]
  tags: string[]
}

export type ConstructionRuntimeVerticalSliceResult =
  ConstructionRuntimeAdapterResult

export type ConstructionRuntimeBridgeInput =
  ConstructionRuntimeVerticalSliceInput & {
    bridgeId: string
  }

export type ConstructionRuntimeBridgeAudit = {
  stableRuntimeBridgeFingerprint: string
  bridgeId: string
  worldId: string
  ownerId: string
  selectedPlanId: string | null
  warnings: string[]
  tags: string[]
}

export type ConstructionRuntimeBridgeReport = {
  reportId: string
  bridgeId: string
  shouldEnterRuntime: boolean
  shouldPersist: boolean
  shouldRefresh: boolean
  hasAuditWarning: boolean
  sections: ConstructionPipelineReportSection[]
  messages: string[]
  tags: string[]
}

export type ConstructionRuntimeBridgeResult = {
  bridgeId: string
  verticalSliceResult: ConstructionRuntimeVerticalSliceResult
  shouldEnterRuntime: boolean
  shouldPersist: boolean
  shouldRefresh: boolean
  audit: ConstructionRuntimeBridgeAudit
  report: ConstructionRuntimeBridgeReport
  messages: string[]
  tags: string[]
}

export type ConstructionDebugHarnessInput = ConstructionRuntimeAdapterInput & {
  harnessId: string
}

export type ConstructionDebugHarnessResult = {
  harnessId: string
  adapterResult: ConstructionRuntimeAdapterResult
  report: ConstructionPipelineReport
  audit: ConstructionFullPipelineAudit
  messages: string[]
  tags: string[]
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
