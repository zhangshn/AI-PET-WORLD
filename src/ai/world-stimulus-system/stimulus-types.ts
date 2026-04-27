/**
 * 当前文件负责：定义世界刺激系统核心类型、空间刺激状态，以及生态与实体刺激输入结构。
 */

import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

export type WorldStimulusType =
  | "breeze"
  | "light_shift"
  | "temperature_drop"
  | "butterfly"
  | "falling_leaf"
  | "distant_sound"
  | "shadow_motion"
  | "quiet_zone"
  | "warm_zone"
  | "tree_presence"
  | "flower_scent"
  | "water_sound"
  | "entity_motion"

export type WorldStimulusCategory =
  | "environment"
  | "dynamic"
  | "spatial"
  | "entity"

export type WorldStimulusIntensity =
  | "low"
  | "medium"
  | "high"

export type StimulusMovementPattern =
  | "static"
  | "floating"
  | "drifting"
  | "wandering"

export type StimulusWorldPosition = {
  x: number
  y: number
}

export type WorldStimulusSource = {
  kind: "environment" | "ecology_zone" | "world_entity"
  id?: string
  type?: string
  name?: string
}

export type WorldStimulus = {
  id: string
  type: WorldStimulusType
  category: WorldStimulusCategory

  tick: number
  day: number
  hour: number
  period?: string

  intensity: WorldStimulusIntensity
  durationTick: number
  expiresAtTick: number

  summary: string
  tags: string[]

  worldPosition: StimulusWorldPosition
  spatialRadius: number
  movementPattern: StimulusMovementPattern
  movementPhase: number

  source?: WorldStimulusSource
}

export type BuildWorldStimuliInput = {
  tick: number

  time: {
    day: number
    hour: number
    period?: string
  }

  ecology: WorldEcologyState
  existingStimuli: WorldStimulus[]

  worldRuntime?: WorldRuntimeState | null
}

export type WorldStimulusSystemState = {
  activeStimuli: WorldStimulus[]
  latestGenerated: WorldStimulus[]
}