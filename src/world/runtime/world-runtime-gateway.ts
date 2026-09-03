/**
 * Unified entry for the live-world runtime.
 */

import { buildButlerRuntimeProfileFromLifeCore } from "@/world/butler/butler-personality-adapter"
import { randomUUID } from "node:crypto"
import {
  buildWorldCreationRuntime,
  type CreateWorldInput,
} from "@/world/creation/world-creation-runtime"
import { buildInitialRuntimeWorld } from "@/world/runtime-core/initial-runtime-world-builder"

import { buildButlerRuntimeAuditSummary } from "./butler-runtime-audit-summary"
import {
  readWorldRuntimeSaveRecord,
  writeWorldRuntimeSaveRecord,
} from "./world-runtime-store-adapter"
import { auditWorldRuntimeTick } from "./world-runtime-audit"
import { runOneRuntimeTick } from "./world-runtime-tick-runner"
import type {
  WorldRuntimeSaveRecord,
  WorldRuntimeStoreReadResult,
  WorldRuntimeTickResult,
} from "./world-runtime-schema"

const DEFAULT_RUNTIME_INPUT = {
  year: 1991,
  month: 6,
  day: 18,
  time: "08:00",
  hasBirthHour: true,
  perspective: "male" as const,
  createdAt: 19910618081,
}

export type WorldRuntimeCreateResult = {
  saveRecord: WorldRuntimeSaveRecord
  persisted: boolean
  messages: string[]
  tags: string[]
}

export async function createRuntimeWorldFromCreateWorldInput(input: {
  createWorldInput: CreateWorldInput
  worldInstanceId?: string
}): Promise<WorldRuntimeCreateResult> {
  const saveRecord = buildRuntimeSaveRecordFromCreateWorldInput({
    createWorldInput: input.createWorldInput,
    worldInstanceId: input.worldInstanceId ?? randomUUID(),
    serverCreatedAt: Date.now(),
  })
  const writeResult = await writeWorldRuntimeSaveRecord({ record: saveRecord })

  return {
    saveRecord,
    persisted: writeResult.ok,
    messages: [
      "Runtime world created from create-world input.",
      writeResult.message,
      ...writeResult.warnings,
    ],
    tags: [
      "world_runtime_create_result",
      "create_world_to_world_flow",
      writeResult.ok ? "runtime_save_persisted" : "runtime_save_not_persisted",
      ...writeResult.tags,
    ],
  }
}

export async function loadOrCreateRuntimeWorldForSmokeOnly(input?: {
  now?: number
}): Promise<WorldRuntimeSaveRecord> {
  const readResult = await readWorldRuntimeSaveRecord()
  if (readResult.status === "found" && readResult.record) {
    return readResult.record
  }

  const now = input?.now ?? Date.now()
  const initialRecord = buildInitialRuntimeSaveRecord({ now })
  await writeWorldRuntimeSaveRecord({ record: initialRecord })

  return initialRecord
}

export type WorldRuntimeViewReadResult = {
  saveRecord: WorldRuntimeSaveRecord
  readResult: WorldRuntimeStoreReadResult
  isPersisted: boolean
  messages: string[]
  tags: string[]
}

export async function readWorldRuntimeForView(input?: {
  now?: number
  worldId?: string
  ownerId?: string
}): Promise<WorldRuntimeViewReadResult> {
  const readResult = await readWorldRuntimeSaveRecord({
    ...(input?.worldId ? { worldId: input.worldId } : {}),
    ...(input?.ownerId ? { ownerId: input.ownerId } : {}),
  })

  if (readResult.status === "found" && readResult.record) {
    return {
      saveRecord: readResult.record,
      readResult,
      isPersisted: true,
      messages: [
        "Runtime save record loaded for read-only world view.",
        readResult.message,
      ],
      tags: [
        "world_runtime_view_read",
        "read_only",
        "persisted_save_loaded",
        ...readResult.tags,
      ],
    }
  }

  const initialRecord = buildInitialRuntimeSaveRecord({
    now: input?.now ?? Date.now(),
  })

  return {
    saveRecord: initialRecord,
    readResult,
    isPersisted: false,
    messages: [
      "Runtime save record was not found; built an in-memory read-only initial world view.",
      readResult.message,
      ...readResult.warnings,
    ],
    tags: [
      "world_runtime_view_read",
      "read_only",
      "missing_runtime_save_create_world_prompt",
      "no_runtime_save_write",
      ...readResult.tags,
    ],
  }
}

export async function runAndPersistOneRuntimeTick(input?: {
  now?: number
  worldId?: string
  ownerId?: string
}): Promise<WorldRuntimeTickResult> {
  const readResult = await readWorldRuntimeSaveRecord({
    ...(input?.worldId ? { worldId: input.worldId } : {}),
    ...(input?.ownerId ? { ownerId: input.ownerId } : {}),
  })
  if (readResult.status !== "found" || !readResult.record) {
    const initialRecord = buildInitialRuntimeSaveRecord({
      now: input?.now ?? Date.now(),
    })
    const writeResult = await writeWorldRuntimeSaveRecord({
      record: initialRecord,
      // -1 is the explicit empty-store CAS sentinel. Two concurrent first
      // ticks cannot both publish tick 0.
      expectedTick: -1,
    })
    const audit = auditWorldRuntimeTick({
      nextHomeMapState: initialRecord.homeMapState,
      events: initialRecord.recentEvents,
      expectedTick: initialRecord.tick,
      storeWriteSucceeded: writeResult.ok,
    })

    return {
      previousSaveRecord: initialRecord,
      nextSaveRecord: initialRecord,
      runtimeTick: null,
      events: initialRecord.recentEvents,
      audit,
      persisted: writeResult.ok,
      messages: [
        "Runtime save was empty; created tick 0 HomeMapState.",
        writeResult.message,
        ...writeResult.warnings,
        ...audit.warnings,
      ],
      tags: [
        "world_runtime_tick_result",
        "runtime_initial_save_created",
        ...writeResult.tags,
        ...audit.tags,
      ],
    }
  }

  const saveRecord = readResult.record
  const tickResultWithoutPersistence = runOneRuntimeTick({
    saveRecord,
    now: input?.now ?? Date.now(),
    tags: ["run_and_persist_one_runtime_tick"],
  })
  const enrichedNextSaveRecord = attachButlerRuntimeAuditSummary({
    nextSaveRecord: tickResultWithoutPersistence.nextSaveRecord,
  })
  const enrichedTickResult = {
    ...tickResultWithoutPersistence,
    nextSaveRecord: enrichedNextSaveRecord,
    audit: {
      ...tickResultWithoutPersistence.audit,
      tags: [
        ...tickResultWithoutPersistence.audit.tags,
        enrichedNextSaveRecord.lastButlerRuntimeAuditSummary
          ? "butler_runtime_audit_summary_persisted"
          : "butler_runtime_audit_summary_unavailable",
      ],
    },
    messages: [
      ...tickResultWithoutPersistence.messages,
      enrichedNextSaveRecord.lastButlerRuntimeAuditSummary?.userFacingSummary ??
        "Butler runtime audit summary was not available for this tick.",
    ],
    tags: [
      ...tickResultWithoutPersistence.tags,
      enrichedNextSaveRecord.lastButlerRuntimeAuditSummary
        ? "butler_runtime_audit_summary_persisted"
        : "butler_runtime_audit_summary_unavailable",
    ],
  }
  const writeResult = enrichedTickResult.audit.ok
    ? await writeWorldRuntimeSaveRecord({
        record: enrichedTickResult.nextSaveRecord,
        expectedTick: saveRecord.tick,
      })
    : {
        ok: false,
        path: "",
        message: "Runtime audit blocked persistence.",
        warnings: enrichedTickResult.audit.warnings,
        tags: ["world_runtime_store_write", "blocked_by_audit"],
      }

  return {
    ...enrichedTickResult,
    persisted: writeResult.ok,
    messages: [
      ...enrichedTickResult.messages,
      writeResult.message,
      ...writeResult.warnings,
    ],
    tags: [
      ...enrichedTickResult.tags,
      ...writeResult.tags,
      writeResult.ok ? "runtime_save_persisted" : "runtime_save_not_persisted",
    ],
  }
}

function attachButlerRuntimeAuditSummary(input: {
  nextSaveRecord: WorldRuntimeSaveRecord
}): WorldRuntimeSaveRecord {
  const record = input.nextSaveRecord
  const decision = record.lastButlerRuntimeDecision
  const intent = record.lastButlerRuntimeIntent
  const validation = record.lastButlerWorldRuleValidation

  if (!decision || !intent || !validation) {
    return record
  }

  const createdTrace =
    record.traceField?.traces.find(
      (trace) =>
        trace.sourceKind === "butler_behavior" &&
        trace.updatedAtTick === record.tick &&
        trace.derivedFrom.includes(intent.id) &&
        trace.derivedFrom.includes(validation.id)
    ) ?? null
  const summary = buildButlerRuntimeAuditSummary({
    tick: record.tick,
    createdAt: record.savedAt,
    decision,
    intent,
    validation,
    acceptedDiffCount: record.lastRuntimeAction?.acceptedDiffCount ?? 0,
    createdTrace,
    memorySeedCount: record.traceMemorySeedField?.summary.totalSeeds ?? 0,
  })

  return {
    ...record,
    lastButlerRuntimeAuditSummary: summary,
    tags: [...record.tags, "butler_runtime_audit_summary_persisted"],
  }
}

function buildRuntimeSaveRecordFromCreateWorldInput(input: {
  createWorldInput: CreateWorldInput
  worldInstanceId: string
  serverCreatedAt?: number
}): WorldRuntimeSaveRecord {
  const creationRuntime = buildWorldCreationRuntime({
    createWorldInput: input.createWorldInput,
    worldInstanceId: input.worldInstanceId,
    serverCreatedAt: input.serverCreatedAt,
  })
  const butlerBuildResult = buildButlerRuntimeProfileFromLifeCore({
    playerId: creationRuntime.ownerId,
    ownerId: creationRuntime.ownerId,
    worldId: creationRuntime.worldId,
    butlerProfile: creationRuntime.butlerProfile,
    constructionStyle: creationRuntime.butlerConstructionStyle,
    tags: [
      "world_runtime_created_from_create_world_input",
      `style_source:${creationRuntime.styleSource}`,
    ],
  })
  const initialWorld = buildInitialRuntimeWorld({
    worldId: creationRuntime.worldId,
    ownerId: creationRuntime.ownerId,
    seed: creationRuntime.worldSalt,
    butlerProfile: butlerBuildResult.profile,
    worldDay: 0,
    now: creationRuntime.now,
    tags: [
      "world_runtime_created_from_create_world_input",
      "create_world_to_world_flow",
      "no_unplanned_life_fact",
    ],
  })
  const savedAt = new Date(creationRuntime.now).toISOString()

  return {
    version: "v2.6-runtime-00",
    worldId: initialWorld.homeMapState.worldId,
    ownerId: initialWorld.homeMapState.ownerId,
    tick: 0,
    savedAt,
    butlerProfile: creationRuntime.butlerProfile,
    butlerRuntimeProfile: butlerBuildResult.profile,
    butlerBirthInput: butlerBuildResult.input,
    butlerMappingMode: creationRuntime.butlerMappingMode,
    butlerConstructionStyle: creationRuntime.butlerConstructionStyle,
    worldCreationStyleSource: creationRuntime.styleSource,
    homeMapState: initialWorld.homeMapState,
    recentEvents: [
      {
        id: "runtime-event-0",
        tick: 0,
        title: "世界已创建",
        body: "管家人格、世界种子和第一片家园已经根据出生信息生成。",
        source: "runtime",
        createdAt: savedAt,
        tags: [
          "world_runtime_event",
          "create_world_to_world_flow",
          "created_from_create_world_input",
          "no_unplanned_life_fact",
        ],
      },
    ],
    recentActionSignatures: [],
    lastRuntimeAction: null,
    recentMotivationTypes: [],
    lastButlerRuntimeDecision: null,
    lastButlerRuntimeIntent: null,
    lastButlerWorldRuleValidation: null,
    lastButlerRuntimeAuditSummary: null,
    tags: [
      "world_runtime_save_record",
      "local_file_runtime_store",
      "initial_home_map_state",
      "create_world_to_world_flow",
      "created_from_create_world_input",
      "no_unplanned_life_fact",
    ],
  }
}

function buildInitialRuntimeSaveRecord(input: {
  now: number
}): WorldRuntimeSaveRecord {
  const creationRuntime = buildWorldCreationRuntime({
    createWorldInput: {
      ...DEFAULT_RUNTIME_INPUT,
      createdAt: input.now,
    },
    worldInstanceId: "initial-runtime-world",
  })
  const butlerBuildResult = buildButlerRuntimeProfileFromLifeCore({
    playerId: creationRuntime.ownerId,
    ownerId: creationRuntime.ownerId,
    worldId: creationRuntime.worldId,
    butlerProfile: creationRuntime.butlerProfile,
    constructionStyle: creationRuntime.butlerConstructionStyle,
    tags: [
      "world_runtime_initial_butler_profile",
      `style_source:${creationRuntime.styleSource}`,
    ],
  })
  const initialWorld = buildInitialRuntimeWorld({
    worldId: creationRuntime.worldId,
    ownerId: creationRuntime.ownerId,
    seed: creationRuntime.worldSalt,
    butlerProfile: butlerBuildResult.profile,
    worldDay: 0,
    now: input.now,
    tags: ["world_runtime_initial_world"],
  })
  const savedAt = new Date(input.now).toISOString()

  return {
    version: "v2.6-runtime-00",
    worldId: initialWorld.homeMapState.worldId,
    ownerId: initialWorld.homeMapState.ownerId,
    tick: 0,
    savedAt,
    butlerProfile: creationRuntime.butlerProfile,
    butlerRuntimeProfile: butlerBuildResult.profile,
    butlerBirthInput: butlerBuildResult.input,
    butlerMappingMode: creationRuntime.butlerMappingMode,
    butlerConstructionStyle: creationRuntime.butlerConstructionStyle,
    worldCreationStyleSource: creationRuntime.styleSource,
    homeMapState: initialWorld.homeMapState,
    recentEvents: [
      {
        id: "runtime-event-0",
        tick: 0,
        title: "World initialized",
        body: "本地世界已生成第一片家园，后续变化将由管家意图和规则校验驱动。",
        source: "runtime",
        createdAt: savedAt,
        tags: ["world_runtime_event", "initial_home_map_state"],
      },
    ],
    recentActionSignatures: [],
    lastRuntimeAction: null,
    recentMotivationTypes: [],
    lastButlerRuntimeDecision: null,
    lastButlerRuntimeIntent: null,
    lastButlerWorldRuleValidation: null,
    lastButlerRuntimeAuditSummary: null,
    tags: [
      "world_runtime_save_record",
      "local_file_runtime_store",
      "smoke_default_runtime_input",
      "initial_home_map_state",
    ],
  }
}
