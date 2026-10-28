/**
 * Minimal local runtime runtime protocol for a saveable, resumable V2.6 world.
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { ButlerProfile } from "@/ai/personality-core/butler-profile-core/butler-profile-gateway"
import type {
  ButlerRuntimeProfileBirthInput,
  ButlerRuntimeProfile,
} from "@/world/butler/butler-runtime-profile-schema"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type { WorldCreationStyleSource } from "@/world/creation/world-creation-schema"
import type { WorldRuntimeConstructionTickResult } from "@/world/runtime-core/world-runtime-construction-tick"
import type { SpaceTraceInfluenceSummary } from "@/world/space"
import type { TraceField, TraceMemorySeedField } from "@/world/trace"
import type { ButlerRuntimeAuditSummary } from "./butler-runtime-audit-summary"
export type {
  WorldConnectivityRuntimeState,
  WorldRegionEdgePort,
  WorldRegionNeighborStub,
} from "./world-connectivity-runtime-schema"
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
  worldProfileId?: string
  worldProfileVersion?: string
  worldProfilePath?: string
  earthParameterSnapshotId?: string
  earthParameterSnapshotPath?: string
  butlerProfile: ButlerProfile
  butlerRuntimeProfile: ButlerRuntimeProfile
  butlerBirthInput: ButlerRuntimeProfileBirthInput
  butlerMappingMode: ButlerProfile["identity"]["mappingMode"]
  butlerConstructionStyle: ButlerConstructionStyleVector
  worldCreationStyleSource: WorldCreationStyleSource
  homeMapState: HomeMapState
  recentEvents: WorldRuntimeEventLog[]
  recentActionSignatures?: string[]
  lastRuntimeAction?: WorldRuntimeActionSummary | null
  lastButlerRuntimeDecision?: ButlerRuntimeDecision | null
  lastButlerRuntimeIntent?: ButlerRuntimeIntent | null
  lastButlerWorldRuleValidation?: ButlerWorldRuleValidation | null
  lastButlerRuntimeAuditSummary?: ButlerRuntimeAuditSummary | null
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
  runtimeTick: WorldRuntimeConstructionTickResult | null
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
  code?: "conflict" | "invalid_path" | "persistence_error"
  message: string
  warnings: string[]
  tags: string[]
}

export type WorldRuntimeStoreAdapterKind =
  | "local_file_runtime_store"
  | "configured_file_runtime_store"
  | "database_runtime_store"
  | "browser_local_runtime_store"

export type WorldRuntimeStoreAdapter = {
  kind: WorldRuntimeStoreAdapterKind
  readNatural?: (input: NaturalWorldRuntimeReadInput) => Promise<NaturalWorldRuntimeReadResult>
  writeNatural?: (input: NaturalWorldRuntimeWriteInput) => Promise<NaturalWorldRuntimeWriteResult>
  read(input?: { filePath?: string; ownerId?: string; worldId?: string }): Promise<WorldRuntimeStoreReadResult>
  write(input: {
    record: WorldRuntimeSaveRecord
    filePath?: string
    expectedTick?: number
  }): Promise<WorldRuntimeStoreWriteResult>
  getDefaultSavePath(): string
}

/** Architecture 4.2: persistence only; no source, semantic or visual qualification. */
export type NaturalWorldJson = null | boolean | number | string | NaturalWorldJson[] | NaturalWorldJsonObject
export type NaturalWorldJsonObject = { [key: string]: NaturalWorldJson }
export type NaturalWorldIdentity = {
  ownerId: string
  playerId: string
  worldId: string
  worldSeed: string
  worldProfileId: string
  regionId: string
}
type NaturalWorldSnapshotIdentity = { worldId: string; regionId: string; tick: number }
export type NaturalWorldRuntimeRecordInput = NaturalWorldIdentity & {
  version: "natural-world-runtime-save-v1"
  tick: number
  stateVersion: number
  savedAt: string
  worldFacts: NaturalWorldSnapshotIdentity & {
    schemaVersion: "natural-world-facts-snapshot-v1"
    payload: {
      terrainRegions: NaturalWorldJsonObject[]
      objectFootprints: NaturalWorldJsonObject[]
      walkableRegions: NaturalWorldJsonObject[]
      collisionRegions: NaturalWorldJsonObject[]
    }
  }
  worldState: NaturalWorldSnapshotIdentity & {
    schemaVersion: "natural-world-state-snapshot-v1"
    payload: {
      environment: NaturalWorldJsonObject
      objects: NaturalWorldJsonObject[]
      resources: NaturalWorldJsonObject[]
    }
  }
  ruleVersion: string
  eventCursor: number
  randomState:
    | { status: "captured"; algorithmId: string; algorithmVersion: string; state: NaturalWorldJsonObject }
    | { status: "not_consumed"; reason: string }
  sourceBindings: { role: string; uri: string; fileSha256: string }[]
}
export type NaturalWorldRuntimeSaveRecord = NaturalWorldRuntimeRecordInput & {
  worldFactsPayloadSha256: string
  statePayloadSha256: string
  recordContentSha256: string
}
export type NaturalWorldRuntimeReadInput = {
  ownerId: string
  worldId: string
  expectedTick?: number
  expectedStateVersion?: number
  expectedFileSha256?: string
  expectedPlayerId?: string
}
export type NaturalWorldRuntimeReadResult = Omit<WorldRuntimeStoreReadResult, "record"> & {
  record: NaturalWorldRuntimeSaveRecord | null
  fileSha256?: string
}
export type NaturalWorldRuntimeWriteInput = {
  record: NaturalWorldRuntimeRecordInput
  expectedTick: number
  expectedStateVersion: number
  expectedFileSha256: string | null
}
export type NaturalWorldRuntimeWriteResult = WorldRuntimeStoreWriteResult & {
  fileSha256?: string
  recordContentSha256?: string
  tick?: number
  stateVersion?: number
}
