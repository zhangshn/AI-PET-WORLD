/**
 * Minimal local MVP runtime protocol for a saveable, resumable V2.6 world.
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { MvpWorldRuntimeTickResult } from "@/world/mvp-core/mvp-world-runtime-tick"
import type { SpaceTraceInfluenceSummary } from "@/world/space"
import type { TraceField, TraceMemorySeedField } from "@/world/trace"
import type {
  ButlerRuntimeDecision,
  ButlerRuntimeMotivationType,
} from "./butler-runtime-motivation-schema"
import type {
  ButlerRuntimeIntent,
  ButlerWorldRuleValidation,
} from "./butler-runtime-intent"

export type WorldRuntimeVersion = "v2.6-runtime-00"

export type WorldRuntimeEventLog = {
  id: string
  tick: number
  title: string
  body: string
  source: "runtime" | "butler" | "construction" | "safe_apply" | "audit"
  createdAt: string
  tags: string[]
}

export type WorldRuntimeActionSummary = {
  tick: number
  actionSignature: string
  projectId?: string
  targetZoneType?: string
  stage?: string
  acceptedDiffCount: number
  resourceTransactionCount: number
  createdAt: string
  tags: string[]
}

export type WorldRuntimeSaveRecord = {
  version: WorldRuntimeVersion
  worldId: string
  ownerId: string
  tick: number
  savedAt: string
  homeMapState: HomeMapState
  recentEvents: WorldRuntimeEventLog[]
  recentActionSignatures?: string[]
  lastRuntimeAction?: WorldRuntimeActionSummary | null
  lastButlerRuntimeDecision?: ButlerRuntimeDecision | null
  lastButlerRuntimeIntent?: ButlerRuntimeIntent | null
  lastButlerWorldRuleValidation?: ButlerWorldRuleValidation | null
  recentMotivationTypes?: ButlerRuntimeMotivationType[]
  traceField?: TraceField
  traceMemorySeedField?: TraceMemorySeedField
  traceInfluenceSummary?: SpaceTraceInfluenceSummary
  tags: string[]
}

export type WorldRuntimeTickInput = {
  saveRecord: WorldRuntimeSaveRecord
  now: number
  tags: string[]
}

export type WorldRuntimeAudit = {
  ok: boolean
  warnings: string[]
  tags: string[]
}

export type WorldRuntimeTickResult = {
  previousSaveRecord: WorldRuntimeSaveRecord
  nextSaveRecord: WorldRuntimeSaveRecord
  runtimeTick: MvpWorldRuntimeTickResult | null
  events: WorldRuntimeEventLog[]
  audit: WorldRuntimeAudit
  persisted: boolean
  messages: string[]
  tags: string[]
}

export type WorldRuntimeStoreReadResult = {
  status: "found" | "empty" | "invalid" | "failed"
  record: WorldRuntimeSaveRecord | null
  path: string
  message: string
  warnings: string[]
  tags: string[]
}

export type WorldRuntimeStoreWriteResult = {
  ok: boolean
  path: string
  message: string
  warnings: string[]
  tags: string[]
}
