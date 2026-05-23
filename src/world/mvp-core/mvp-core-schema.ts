/**
 * 当前文件职责：定义 MVP 核心 debug runner 的输入、审计与报告协议。
 */

import type {
  ButlerConstructionStyleVector,
  WorldLayoutBiomeType,
} from "@/world/generation/generation-schema"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type {
  ButlerMvpAudit,
  ButlerMvpBuildResult,
  ButlerMvpProfile,
  ButlerMvpReport,
} from "@/world/butler/butler-mvp-schema"
import type {
  ConstructionPersistenceAdapterDryRunResult,
  ConstructionRuntimeBridgeResult,
  ConstructionSnapshotRefreshRequest,
  ConstructionFormalVisualRefreshPrecheck,
} from "@/world/construction/construction-schema"
import type {
  CompanionDecisionCandidate,
  LifeEventCandidate,
  LifeEventCandidateBuilderResult,
} from "@/world/life-event/life-event-schema"

import type { MvpButlerExplanationEntry as PipelineButlerExplanationEntry } from "./mvp-butler-explanation"
import type { MvpFormalVisualRefreshResult } from "./mvp-formal-visual-refresh"
import type { MvpInitialWorldResult } from "./mvp-initial-world-builder"
import type { MvpPersistenceDryRunResult, MvpPersistenceMode } from "./mvp-persistence-dry-run"
import type { MvpPPhoneData as PipelinePPhoneData } from "./mvp-pphone-data"
import type { MvpVisualRefreshResult } from "./mvp-visual-refresh"
import type { MvpWorldLogEntry as PipelineWorldLogEntry } from "./mvp-world-log"
import type { MvpWorldRuntimeTickResult } from "./mvp-world-runtime-tick"

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

export type AiPetWorldMvpPipelineInput = {
  playerId: string
  ownerId: string
  worldId: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
  timezone: string
  worldDay: number
  now: number
  seed: string
  biomeType?: WorldLayoutBiomeType
  runMode: "debug" | "preview" | "mvp"
  persistenceMode: MvpPersistenceMode
  visualMode: "refresh_request" | "formal_precheck" | "disabled"
  tags: string[]
}

export type AiPetWorldMvpAudit = {
  stableMvpFingerprint: string
  worldId: string
  ownerId: string
  warnings: string[]
  tags: string[]
}

export type AiPetWorldMvpReport = {
  reportId: string
  worldId: string
  ownerId: string
  sections: MvpCoreReportSection[]
  messages: string[]
  tags: string[]
}

export type AiPetWorldMvpPipelineResult = {
  butlerProfile: ButlerMvpProfile
  butlerBuildResult: ButlerMvpBuildResult
  butlerAudit: ButlerMvpAudit
  butlerReport: ButlerMvpReport
  initialWorld: MvpInitialWorldResult
  runtimeTick: MvpWorldRuntimeTickResult
  persistence: MvpPersistenceDryRunResult
  visualRefresh: MvpVisualRefreshResult
  formalVisualRefresh: MvpFormalVisualRefreshResult
  worldLogs: PipelineWorldLogEntry[]
  butlerExplanations: PipelineButlerExplanationEntry[]
  pPhoneData: PipelinePPhoneData
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
  audit: AiPetWorldMvpAudit
  report: AiPetWorldMvpReport
  nextHomeMapState: HomeMapState
  messages: string[]
  tags: string[]
}
