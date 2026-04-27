/**
 * 当前文件负责：定义世界刺激系统核心类型、空间刺激状态，以及生态系统输入结构。
 */

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

export type WorldStimulusCategory =
  | "environment"
  | "dynamic"
  | "spatial"

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
}

export type WorldStimulusSystemState = {
  activeStimuli: WorldStimulus[]
  latestGenerated: WorldStimulus[]
}