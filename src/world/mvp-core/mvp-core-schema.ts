/**
 * 当前文件职责：定义 MVP 核心 debug runner 的输入、审计与报告协议。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type {
  ConstructionPersistenceAdapterDryRunResult,
  ConstructionRuntimeBridgeResult,
  ConstructionSnapshotRefreshRequest,
  ConstructionFormalVisualRefreshPrecheck,
} from "@/world/construction/construction-schema"
import type { LifeEventCandidateBuilderResult } from "@/world/life-event/life-event-schema"

export type MvpCoreDebugRunnerInput = {
  homeMapState: HomeMapState
  constructionStyle: ButlerConstructionStyleVector
  worldDay: number
  now: number
  preferredPlanId?: string
  tags: string[]
}

export type MvpCoreAudit = {
  stableMvpCoreFingerprint: string
  worldId: string
  ownerId: string
  warnings: string[]
  tags: string[]
}

export type MvpCoreReportSection = {
  title: string
  status: "ok" | "warning" | "skipped"
  lines: string[]
  tags: string[]
}

export type MvpCoreReport = {
  reportId: string
  worldId: string
  ownerId: string
  sections: MvpCoreReportSection[]
  messages: string[]
  tags: string[]
}

export type MvpCoreDebugRunnerResult = {
  constructionBridgeResult: ConstructionRuntimeBridgeResult
  persistenceDryRunResult: ConstructionPersistenceAdapterDryRunResult
  snapshotRefreshRequest: ConstructionSnapshotRefreshRequest
  formalVisualRefreshPrecheck: ConstructionFormalVisualRefreshPrecheck
  lifeEventResult: LifeEventCandidateBuilderResult
  audit: MvpCoreAudit
  report: MvpCoreReport
  messages: string[]
  tags: string[]
}

export type MvpWorldLogEntry = {
  id: string
  title: string
  body: string
  severity: "info" | "warning" | "success"
  tags: string[]
}

export type MvpButlerExplanation = {
  explanationId: string
  title: string
  summary: string
  nextActionHint: string
  tags: string[]
}

export type MvpPPhoneData = {
  phoneId: string
  worldId: string
  ownerId: string
  statusLabel: string
  primaryActionLabel: string
  logEntries: MvpWorldLogEntry[]
  butlerExplanation: MvpButlerExplanation
  tags: string[]
}

export type MvpPresentationModel = {
  worldId: string
  ownerId: string
  report: MvpCoreReport
  pPhoneData: MvpPPhoneData
  warnings: string[]
  tags: string[]
}
