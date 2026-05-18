/**
 * 当前文件职责：定义世界变化层审计报告类型。
 */

import type { IntentDecision } from "@/world/intent-system/intent-gateway"
import type { MapDiffValidationResult } from "@/world/map-state/map-diff-validator"
import type {
  WorldChangePlan,
  WorldChangePlanStatus,
  WorldChangePlanType,
  WorldDiffProposal,
  WorldDiffProposalType,
} from "@/world/world-evolution/world-evolution-gateway"
import type { ButlerIntentType } from "@/world/intent-system/intent-gateway"

export type WorldEvolutionAuditRiskLevel = "none" | "low" | "medium" | "high"

export type WorldEvolutionAuditSummary = {
  planStatus: WorldChangePlanStatus
  planType: WorldChangePlanType
  sourceIntentType: ButlerIntentType
  sourceIntentScore: number
  proposalType: WorldDiffProposalType
  shouldGenerateDiff: boolean
  acceptedForPlanning: boolean
  mapDiffCount: number
  acceptedDiffCount: number
  rejectedDiffCount: number
  warningCount: number
  blockerCount: number
  canApplySafely: boolean
  riskLevel: WorldEvolutionAuditRiskLevel
}

export type WorldEvolutionAuditReport = {
  id: string
  checkedAt: number
  summary: WorldEvolutionAuditSummary
  blockers: string[]
  warnings: string[]
  rejectedReasons: string[]
  decisionTags: string[]
  planTags: string[]
  proposalTags: string[]
  validationTags: string[]
  notes: string[]
  tags: string[]
}

export type BuildWorldEvolutionAuditReportInput = {
  checkedAt: number
  decision: IntentDecision
  plan: WorldChangePlan
  proposal: WorldDiffProposal
  validation: MapDiffValidationResult
}
