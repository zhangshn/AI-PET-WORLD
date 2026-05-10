/**
 * 当前文件负责：定义世界本地存档快照结构。
 */

import type {
  AiDataRecord,
} from "@/ai/data-core/ai-data-types"
import type {
  WorldStimulus,
} from "@/ai/gateway"
import type {
  TimeState,
} from "@/engine/timeSystem"
import type {
  ButlerState,
} from "@/types/butler"
import type {
  WorldEvent,
} from "@/types/event"
import type {
  HomeState,
} from "@/types/home"
import type {
  IncubatorState,
} from "@/types/incubator"
import type {
  PetState,
} from "@/types/pet"
import type {
  WorldEcologyState,
} from "@/world/ecology/ecology-engine"
import type {
  WorldProgressionState,
} from "@/world/progression/world-progression-gateway"
import type {
  WorldRuntimeState,
} from "@/world/runtime/world-runtime"

export const WORLD_SAVE_VERSION = 1

export type WorldSaveSource =
  | "auto_save"
  | "manual_save"
  | "restore_test"

export type WorldSaveMetadata = {
  source: WorldSaveSource
  appVersion?: string
  notes?: string
  tags?: string[]
}

export type WorldSaveSnapshot = {
  version: typeof WORLD_SAVE_VERSION
  saveVersion: typeof WORLD_SAVE_VERSION
  savedAt: number
  lastPlayedAt: number
  tick: number
  time: TimeState
  pet: PetState | null
  butler: ButlerState
  home: HomeState
  incubator: IncubatorState
  worldRuntime: WorldRuntimeState
  ecology: WorldEcologyState
  sceneMode?: "exterior" | "shelterInterior"
  notes?: string
  tags?: string[]

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

  meta: WorldSaveMetadata
}

export type WorldSaveValidationResult = {
  ok: boolean
  reason?: string
}
