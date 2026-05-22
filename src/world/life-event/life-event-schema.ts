/**
 * 当前文件职责：定义生命事件与伙伴决策后置入口候选协议。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { ConstructionRuntimeBridgeResult } from "@/world/construction/construction-schema"

export type LifeEventCandidateKind =
  | "no_event"
  | "observe_world_ready"
  | "companion_opportunity_later"
  | "construction_dependency_not_ready"

export type CompanionDecisionCandidateKind =
  | "no_companion_decision"
  | "observe_world_first"
  | "companion_opportunity_later"

export type LifeEventCandidate = {
  candidateId: string
  kind: LifeEventCandidateKind
  worldId: string
  ownerId: string
  readyForCompanionDecision: boolean
  reason: string
  tags: string[]
}

export type CompanionDecisionCandidate = {
  candidateId: string
  kind: CompanionDecisionCandidateKind
  worldId: string
  ownerId: string
  canEnterCompanionFlow: boolean
  reason: string
  tags: string[]
}

export type LifeEventAudit = {
  stableLifeEventFingerprint: string
  worldId: string
  ownerId: string
  lifeEventCandidateIds: string[]
  companionDecisionCandidateIds: string[]
  warnings: string[]
  tags: string[]
}

export type LifeEventReport = {
  reportId: string
  worldId: string
  ownerId: string
  sections: LifeEventReportSection[]
  messages: string[]
  tags: string[]
}

export type LifeEventReportSection = {
  title: string
  status: "ok" | "warning" | "skipped"
  lines: string[]
  tags: string[]
}

export type LifeEventCandidateBuilderInput = {
  homeMapState: HomeMapState
  constructionBridgeResult: ConstructionRuntimeBridgeResult
  now: number
  tags: string[]
}

export type LifeEventCandidateBuilderResult = {
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
  audit: LifeEventAudit
  report: LifeEventReport
  messages: string[]
  tags: string[]
}
