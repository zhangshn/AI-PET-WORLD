/**
 * 当前文件职责：定义 MVP 世界闭环 runtime 的状态、步骤结果与审计协议。
 */

import type { EnvironmentState } from "@/world/environment/environment-gateway"
import type { PlacementGeometryAuditReport } from "@/world/geometry-audit/geometry-audit-gateway"
import type {
  ButlerIntentContext,
  IntentDecision,
  PetIntentContext,
} from "@/world/intent-system/intent-gateway"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { MapDiffValidationResult } from "@/world/map-state/map-diff-validator"
import type { RenderableWorldSnapshot } from "@/world/rendering/renderer-gateway"
import type { WorldEngineChainAuditReport } from "@/world/world-engine-chain-audit/world-engine-chain-audit-gateway"
import type { WorldEvolutionAuditReport } from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import type { WorldEvolutionExecutionResult } from "@/world/world-evolution-executor/world-evolution-executor-gateway"
import type {
  WorldChangePlan,
  WorldDiffProposal,
} from "@/world/world-evolution/world-evolution-gateway"

export type WorldLoopStepStatus =
  | "not_started"
  | "skipped"
  | "blocked"
  | "applied"
  | "rendered"

export type WorldLoopStageName =
  | "runtime_input"
  | "environment"
  | "geometry_audit"
  | "intent"
  | "plan"
  | "proposal"
  | "validation"
  | "audit"
  | "execution"
  | "safe_apply"
  | "renderable_snapshot"

export type WorldLoopStageRecord = {
  stage: WorldLoopStageName
  status: WorldLoopStepStatus
  message: string
  tags: string[]
}

export type WorldLoopAuditTrail = {
  id: string
  tickId: string
  checkedAt: number
  stages: WorldLoopStageRecord[]
  blockers: string[]
  warnings: string[]
  notes: string[]
  tags: string[]
}

export type WorldLoopContext = {
  worldId: string
  ownerId: string
  tickId: string
  tickIndex: number
  now: number
  source: "initial_world" | "manual_tick" | "auto_tick" | "debug_tick"
  tags: string[]
}

export type RuntimeWorldState = {
  worldId: string
  ownerId: string
  tickIndex: number
  currentHomeMapState: HomeMapState
  currentRenderableSnapshot: RenderableWorldSnapshot
  lastStepResult?: WorldLoopStepResult
  auditTrail: WorldLoopAuditTrail[]
  tags: string[]
}

export type WorldLoopRenderableState = {
  homeMapState: HomeMapState
  environmentState: EnvironmentState
  placementGeometryAudit: PlacementGeometryAuditReport
  renderableWorldSnapshot: RenderableWorldSnapshot
  tags: string[]
}

export type WorldLoopStepResult = {
  id: string
  context: WorldLoopContext
  status: WorldLoopStepStatus

  previousHomeMapState: HomeMapState
  nextHomeMapState: HomeMapState

  environmentState: EnvironmentState
  placementGeometryAudit: PlacementGeometryAuditReport

  intentDecision: IntentDecision
  worldChangePlan: WorldChangePlan
  worldDiffProposal: WorldDiffProposal
  worldDiffValidation: MapDiffValidationResult
  worldEvolutionAudit: WorldEvolutionAuditReport
  worldEvolutionExecution: WorldEvolutionExecutionResult
  worldEngineChainAudit: WorldEngineChainAuditReport

  renderableState: WorldLoopRenderableState

  auditTrail: WorldLoopAuditTrail
  tags: string[]
}

export type BuildRuntimeWorldStateInput = {
  worldId: string
  ownerId: string
  initialHomeMapState: HomeMapState
  initialRenderableSnapshot: RenderableWorldSnapshot
  now: number
}

export type BuildWorldLoopStepInput = {
  runtimeState: RuntimeWorldState
  now: number
  source: WorldLoopContext["source"]
  butlerIntentContext?: ButlerIntentContext
  petIntentContext?: PetIntentContext
}

export type ApplyWorldLoopStepInput = {
  runtimeState: RuntimeWorldState
  stepResult: WorldLoopStepResult
}
