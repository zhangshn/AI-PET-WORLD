/**
 * 当前文件职责：定义小镇领养观察与小镇领养观察入口候选协议。
 */

import type { ConstructionRuntimeBridgeResult } from "@/world/construction/construction-schema"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

export type TownAdoptionCandidateKind =
  | "no_event"
  | "observe_world_ready"
  | "adoption_candidate_later"
  | "construction_dependency_not_ready"

export type ButlerAdoptionIntentCandidateKind =
  | "no_adoption_intent"
  | "wait_and_observe"
  | "prepare_world_first"
  | "eligible_later"

export type TownAdoptionCandidateType = TownAdoptionCandidateKind
export type ButlerAdoptionIntentCandidateType = ButlerAdoptionIntentCandidateKind

export type TownAdoptionBlockerSeverity = "info" | "warning" | "blocking"

export type TownAdoptionBlocker = {
  blockerId: string
  severity: TownAdoptionBlockerSeverity
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

export type TownAdoptionResourceReadiness = {
  materialReadiness: number
  careReadiness: number
  groundHealth: number
  naturalGrowth: number
  spacePressure: number
  score: number
  status: "scarce" | "limited" | "stable" | "ready"
  reasons: string[]
}

export type TownAdoptionWorldReadiness = {
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

export type TownAdoptionReadinessSnapshot = {
  readinessId: string
  worldId: string
  ownerId: string
  score: number
  status: "not_ready" | "preparing" | "observable" | "eligible_later"
  resourceReadiness: TownAdoptionResourceReadiness
  worldReadiness: TownAdoptionWorldReadiness
  blockers: TownAdoptionBlocker[]
  recommendedNextStep:
    | "wait"
    | "prepare_resources"
    | "continue_construction"
    | "observe_world"
    | "record_future_opportunity"
  tags: string[]
}

export type TownAdoptionCandidate = {
  candidateId: string
  type: TownAdoptionCandidateType
  kind: TownAdoptionCandidateKind
  worldId: string
  ownerId: string
  readyForButlerAdoptionIntent: boolean
  readiness: TownAdoptionReadinessSnapshot
  reason: string
  resourceReasons: string[]
  worldReasons: string[]
  blockers: TownAdoptionBlocker[]
  tags: string[]
}

export type ButlerAdoptionIntentCandidate = {
  candidateId: string
  type: ButlerAdoptionIntentCandidateType
  kind: ButlerAdoptionIntentCandidateKind
  worldId: string
  ownerId: string
  canEnterAdoptionReview: boolean
  readiness: TownAdoptionReadinessSnapshot
  reason: string
  blockers: TownAdoptionBlocker[]
  nextCheckHint: string
  tags: string[]
}

export type TownAdoptionPrecheckAudit = {
  stableTownAdoptionFingerprint: string
  worldId: string
  ownerId: string
  townAdoptionCandidateIds: string[]
  butlerAdoptionIntentCandidateIds: string[]
  readinessScore: number
  blockerCount: number
  warnings: string[]
  tags: string[]
}

export type TownAdoptionPrecheckReport = {
  reportId: string
  worldId: string
  ownerId: string
  sections: TownAdoptionPrecheckReportSection[]
  messages: string[]
  tags: string[]
}

export type TownAdoptionPrecheckReportSection = {
  title: string
  status: "ok" | "warning" | "skipped"
  lines: string[]
  tags: string[]
}

export type TownAdoptionPrecheckBuilderInput = {
  homeMapState: HomeMapState
  constructionBridgeResult?: ConstructionRuntimeBridgeResult
  now: number
  tags: string[]
}

export type TownAdoptionPrecheckBuilderResult = {
  townAdoptionCandidates: TownAdoptionCandidate[]
  butlerAdoptionIntentCandidates: ButlerAdoptionIntentCandidate[]
  audit: TownAdoptionPrecheckAudit
  report: TownAdoptionPrecheckReport
  messages: string[]
  tags: string[]
}