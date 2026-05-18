/**
 * 当前文件职责：定义世界引擎链路总审计报告类型。
 */

import type { EnvironmentState } from "@/world/environment/environment-gateway"
import type {
  ButlerIntentType,
  IntentDecision,
} from "@/world/intent-system/intent-gateway"
import type { MapDiffValidationResult } from "@/world/map-state/map-diff-validator"
import type {
  WorldEvolutionAuditReport,
  WorldEvolutionAuditRiskLevel,
} from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import type { WorldEvolutionExecutionResult } from "@/world/world-evolution-executor/world-evolution-executor-gateway"
import type {
  WorldChangePlan,
  WorldChangePlanStatus,
  WorldChangePlanType,
  WorldDiffProposal,
  WorldDiffProposalType,
} from "@/world/world-evolution/world-evolution-gateway"

export type WorldEngineChainStageStatus =
  | "pass"
  | "wait"
  | "blocked"
  | "skipped"
  | "applied"

export type WorldEngineChainBlockedAt =
  | "none"
  | "intent"
  | "plan"
  | "proposal"
  | "validation"
  | "audit"
  | "execution"

export type WorldEngineChainSummary = {
  selectedIntentType: ButlerIntentType
  selectedIntentScore: number
  shouldAct: boolean
  planType: WorldChangePlanType
  planStatus: WorldChangePlanStatus
  shouldGenerateDiff: boolean
  proposalType: WorldDiffProposalType
  proposalAcceptedForPlanning: boolean
  proposalMapDiffCount: number
  validationAcceptedCount: number
  validationRejectedCount: number
  auditRiskLevel: WorldEvolutionAuditRiskLevel
  auditCanApplySafely: boolean
  executionStatus: WorldEvolutionExecutionResult["status"]
  executionAppliedMapDiffCount: number
  blockedAt: WorldEngineChainBlockedAt
  overallStatus: WorldEngineChainStageStatus
}

export type WorldEngineChainAuditReport = {
  id: string
  checkedAt: number
  summary: WorldEngineChainSummary
  timeline: {
    stage: string
    status: WorldEngineChainStageStatus
    message: string
  }[]
  keyReasons: string[]
  blockers: string[]
  warnings: string[]
  notes: string[]
  tags: string[]
}

export type BuildWorldEngineChainAuditReportInput = {
  checkedAt: number
  environment: EnvironmentState
  decision: IntentDecision
  plan: WorldChangePlan
  proposal: WorldDiffProposal
  validation: MapDiffValidationResult
  audit: WorldEvolutionAuditReport
  execution: WorldEvolutionExecutionResult
}
