/**
 * 当前文件负责：构建单个世界刺激，并统一刺激 id、描述、空间位置、影响半径与移动模式生成。
 */

import type {
  StimulusMovementPattern,
  StimulusWorldPosition,
  WorldStimulus,
  WorldStimulusCategory,
  WorldStimulusIntensity,
  WorldStimulusType,
} from "./stimulus-types"

function buildStimulusId(type: WorldStimulusType, tick: number): string {
  return `stimulus-${type}-${tick}`
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}

function buildStimulusWorldPosition(
  type: WorldStimulusType,
  worldPosition?: StimulusWorldPosition
): StimulusWorldPosition {
  if (worldPosition) return worldPosition

  switch (type) {
    case "butterfly":
      return { x: randomBetween(620, 820), y: randomBetween(135, 260) }
    case "falling_leaf":
      return { x: randomBetween(240, 780), y: randomBetween(120, 210) }
    case "breeze":
      return { x: randomBetween(180, 820), y: randomBetween(150, 360) }
    case "distant_sound":
      return { x: randomBetween(120, 880), y: randomBetween(110, 420) }
    case "shadow_motion":
      return { x: randomBetween(80, 880), y: randomBetween(110, 390) }
    case "light_shift":
      return { x: randomBetween(320, 760), y: randomBetween(140, 330) }
    case "temperature_drop":
      return { x: randomBetween(260, 780), y: randomBetween(180, 390) }
    case "quiet_zone":
      return { x: randomBetween(560, 780), y: randomBetween(300, 400) }
    case "warm_zone":
      return { x: randomBetween(610, 760), y: randomBetween(320, 410) }
    default:
      return { x: 480, y: 260 }
  }
}

function resolveSpatialRadius(type: WorldStimulusType, spatialRadius?: number): number {
  if (typeof spatialRadius === "number") return spatialRadius

  switch (type) {
    case "butterfly":
      return 26
    case "falling_leaf":
      return 22
    case "breeze":
      return 54
    case "distant_sound":
      return 72
    case "shadow_motion":
      return 44
    case "light_shift":
      return 48
    case "temperature_drop":
      return 86
    case "quiet_zone":
      return 70
    case "warm_zone":
      return 64
    default:
      return 40
  }
}

function resolveMovementPattern(type: WorldStimulusType): StimulusMovementPattern {
  switch (type) {
    case "butterfly":
      return "wandering"
    case "falling_leaf":
    case "breeze":
    case "shadow_motion":
      return "drifting"
    case "light_shift":
      return "floating"
    case "distant_sound":
    case "temperature_drop":
    case "quiet_zone":
    case "warm_zone":
    default:
      return "static"
  }
}

export function createWorldStimulus(input: {
  type: WorldStimulusType
  category: WorldStimulusCategory
  tick: number
  day: number
  hour: number
  period?: string
  intensity: WorldStimulusIntensity
  durationTick: number
  summary: string
  tags?: string[]
  worldPosition?: StimulusWorldPosition
  spatialRadius?: number
}): WorldStimulus {
  return {
    id: buildStimulusId(input.type, input.tick),
    type: input.type,
    category: input.category,
    tick: input.tick,
    day: input.day,
    hour: input.hour,
    period: input.period,
    intensity: input.intensity,
    durationTick: input.durationTick,
    expiresAtTick: input.tick + input.durationTick,
    summary: input.summary,
    tags: input.tags ?? [],
    worldPosition: buildStimulusWorldPosition(input.type, input.worldPosition),
    spatialRadius: resolveSpatialRadius(input.type, input.spatialRadius),
    movementPattern: resolveMovementPattern(input.type),
    movementPhase: Math.random() * Math.PI * 2,
  }
}