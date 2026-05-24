/**
 * 当前文件职责：定义生命事件与伴生生命后置入口候选协议。
 */

import type { ConstructionRuntimeBridgeResult } from "@/world/construction/construction-schema"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

export type LifeEventCandidateKind =
  | "no_event"
  | "observe_world_ready"
  | "adoption_candidate_later"
  | "construction_dependency_not_ready"

export type CompanionDecisionCandidateKind =
  | "no_adoption_intent"
  | "wait_and_observe"
  | "prepare_world_first"
  | "eligible_later"

export type LifeEventCandidateType = LifeEventCandidateKind
export type CompanionDecisionCandidateType = CompanionDecisionCandidateKind

export type LifeEventBlockerSeverity = "info" | "warning" | "blocking"

export type LifeEventBlocker = {
  blockerId: string
  severity: LifeEventBlockerSeverity
  reason: string
  source:
    | "resource"
    | "space"
    | "construction"
    | "world_stability"
    | "safety_boundary"
    | "audit"
  tags: string[]
}

export type LifeEventResourceReadiness = {
  materialReadiness: number
  careReadiness: number
  groundHealth: number
  naturalGrowth: number
  spacePressure: number
  score: number
  status: "scarce" | "limited" | "stable" | "ready"
  reasons: string[]
}

export type LifeEventWorldReadiness = {
  acceptedDiffCount: number
  mapDiffCount: number
  constructionPlanCount: number
  hasHouseStyle: boolean
  hasStableShelterSignal: boolean
  hasCareSignal: boolean
  hasQuietZoneSignal: boolean
  score: number
  status: "empty" | "forming" | "stable" | "ready"
  reasons: string[]
}

export type LifeEventReadinessSnapshot = {
  readinessId: string
  worldId: string
  ownerId: string
  score: number
  status: "not_ready" | "preparing" | "observable" | "eligible_later"
  resourceReadiness: LifeEventResourceReadiness
  worldReadiness: LifeEventWorldReadiness
  blockers: LifeEventBlocker[]
  recommendedNextStep:
    | "wait"
    | "prepare_resources"
    | "continue_construction"
    | "observe_world"
    | "record_future_opportunity"
  tags: string[]
}

export type LifeEventCandidate = {
  candidateId: string
  type: LifeEventCandidateType
  kind: LifeEventCandidateKind
  worldId: string
  ownerId: string
  readyForCompanionDecision: boolean
  readiness: LifeEventReadinessSnapshot
  reason: string
  resourceReasons: string[]
  worldReasons: string[]
  blockers: LifeEventBlocker[]
  tags: string[]
}

export type CompanionDecisionCandidate = {
  candidateId: string
  type: CompanionDecisionCandidateType
  kind: CompanionDecisionCandidateKind
  worldId: string
  ownerId: string
  canEnterCompanionFlow: boolean
  readiness: LifeEventReadinessSnapshot
  reason: string
  blockers: LifeEventBlocker[]
  nextCheckHint: string
  tags: string[]
}

export type LifeEventAudit = {
  stableLifeEventFingerprint: string
  worldId: string
  ownerId: string
  lifeEventCandidateIds: string[]
  companionDecisionCandidateIds: string[]
  readinessScore: number
  blockerCount: number
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
  constructionBridgeResult?: ConstructionRuntimeBridgeResult
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