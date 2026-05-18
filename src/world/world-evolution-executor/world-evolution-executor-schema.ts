/**
 * 当前文件职责：定义世界变化安全执行器结果类型。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { WorldEvolutionAuditReport } from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import type { WorldDiffProposal } from "@/world/world-evolution/world-evolution-gateway"

export type WorldEvolutionExecutionStatus = "applied" | "blocked" | "skipped"

export type WorldEvolutionExecutionResult = {
  id: string
  status: WorldEvolutionExecutionStatus
  appliedMapDiffCount: number
  nextHomeMapState: HomeMapState
  messages: string[]
  blockedReasons: string[]
  tags: string[]
}

export type BuildWorldEvolutionExecutionInput = {
  homeMapState: HomeMapState
  proposal: WorldDiffProposal
  audit: WorldEvolutionAuditReport
  now: number
}
