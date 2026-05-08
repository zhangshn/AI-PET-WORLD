/**
 * 当前文件负责：定义世界本地存档的数据结构。
 */

import type { AiDataRecord } from "@/ai/data-core/ai-data-types"
import type { TimeState } from "@/engine/timeSystem"
import type { ButlerState } from "@/types/butler"
import type { WorldEvent } from "@/types/event"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldStimulus } from "@/ai/gateway"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import type { WorldProgressionState } from "@/world/progression/world-progression-gateway"

export const WORLD_SAVE_VERSION = 1

export type WorldSaveSource =
  | "auto_save"
  | "manual_save"
  | "offline_catchup"
  | "restore_test"

export type WorldSaveSnapshot = {
  saveVersion: typeof WORLD_SAVE_VERSION
  savedAt: number
  lastPlayedAt: number

  engine: {
    tick: number
    time: TimeState
  }

  systems: {
    pet: PetState | null
    butler: ButlerState
    home: HomeState
    incubator: IncubatorState
    events: WorldEvent[]
  }

  world: {
    stimuli: WorldStimulus[]
    runtime: WorldRuntimeState
    progression: WorldProgressionState
  }

  aiData: {
    records: AiDataRecord[]
  }

  meta: {
    source: WorldSaveSource
    appVersion?: string
  }
}

export type WorldSaveValidationResult = {
  ok: boolean
  reason?: string
}