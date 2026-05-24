/**
 * Unified entry for the local MVP live-world runtime.
 */

import { buildButlerMvpProfile } from "@/world/butler/butler-personality-adapter"
import { buildMvpInitialWorld } from "@/world/mvp-core/mvp-initial-world-builder"

import {
  readWorldRuntimeSaveRecord,
  writeWorldRuntimeSaveRecord,
} from "./world-runtime-store"
import { runOneRuntimeTick } from "./world-runtime-tick-runner"
import type {
  WorldRuntimeSaveRecord,
  WorldRuntimeTickResult,
} from "./world-runtime-schema"

const DEFAULT_RUNTIME_INPUT = {
  playerId: "local-player",
  ownerId: "local-owner",
  worldId: "default-world",
  seed: "ai-pet-world-v2-6-local-runtime",
  birthYear: 1991,
  birthMonth: 6,
  birthDay: 18,
  birthHour: 8,
  timezone: "Asia/Shanghai",
}

export async function loadOrCreateRuntimeWorld(input?: {
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

export async function runAndPersistOneRuntimeTick(input?: {
  now?: number
}): Promise<WorldRuntimeTickResult> {
  const saveRecord = await loadOrCreateRuntimeWorld(input)
  const tickResultWithoutPersistence = runOneRuntimeTick({
    saveRecord,
    now: input?.now ?? Date.now(),
    tags: ["run_and_persist_one_runtime_tick"],
  })
  const writeResult = tickResultWithoutPersistence.audit.ok
    ? await writeWorldRuntimeSaveRecord({
        record: tickResultWithoutPersistence.nextSaveRecord,
      })
    : {
        ok: false,
        path: "",
        message: "Runtime audit blocked persistence.",
        warnings: tickResultWithoutPersistence.audit.warnings,
        tags: ["world_runtime_store_write", "blocked_by_audit"],
      }

  return {
    ...tickResultWithoutPersistence,
    persisted: writeResult.ok,
    messages: [
      ...tickResultWithoutPersistence.messages,
      writeResult.message,
      ...writeResult.warnings,
    ],
    tags: [
      ...tickResultWithoutPersistence.tags,
      ...writeResult.tags,
      writeResult.ok ? "runtime_save_persisted" : "runtime_save_not_persisted",
    ],
  }
}

function buildInitialRuntimeSaveRecord(input: {
  now: number
}): WorldRuntimeSaveRecord {
  const butlerBuildResult = buildButlerMvpProfile({
    ...DEFAULT_RUNTIME_INPUT,
    tags: ["world_runtime_initial_butler_profile"],
  })
  const initialWorld = buildMvpInitialWorld({
    worldId: DEFAULT_RUNTIME_INPUT.worldId,
    ownerId: DEFAULT_RUNTIME_INPUT.ownerId,
    seed: DEFAULT_RUNTIME_INPUT.seed,
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
    homeMapState: initialWorld.homeMapState,
    recentEvents: [
      {
        id: "runtime-event-0",
        tick: 0,
        title: "Runtime world initialized",
        body: "Initial HomeMapState was created for the local MVP runtime.",
        source: "runtime",
        createdAt: savedAt,
        tags: ["world_runtime_event", "initial_home_map_state"],
      },
    ],
    tags: [
      "world_runtime_save_record",
      "local_mvp_only",
      "initial_home_map_state",
    ],
  }
}
