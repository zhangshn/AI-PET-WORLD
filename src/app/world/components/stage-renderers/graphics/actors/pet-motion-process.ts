/**
 * 当前文件负责：根据宠物视觉意图生成前端运动过程。
 *
 * MotionProcess 只影响像素舞台表现，不改变宠物后台行为。
 */

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
  ActorVisualIntent,
} from "../../visual-intent/actor-visual-intent-types"
import type {
  ActorMotionState,
} from "./actor-types"
import {
  getActiveZonePosition,
} from "../zones/stage-zone-renderer"

export type PetMotionObserveDirection =
  | "left"
  | "right"
  | "up"
  | "down"

export type PetMotionProcessState = {
  lastIntentKey: string | null
  holdUntilTick: number
  wanderSeed: number
  observeDirection: PetMotionObserveDirection
  lastProcessTag: string | null
}

export type PetMotionProcessResult = {
  targetX: number
  targetY: number
  speed: number
  processTag: string
}

export type UpdatePetMotionProcessInput = {
  pet: PetState | null
  petIntent: ActorVisualIntent | null
  currentMotion: ActorMotionState
  processState: PetMotionProcessState
  tick: number
  ecology: WorldEcologyState | null
  incubator: IncubatorState | null
}

type StagePoint = {
  x: number
  y: number
}

const HOME_CENTER = { x: 640, y: 430 }
const SHELTER_CENTER = { x: 590, y: 375 }
const SHELTER_REST = { x: 1040, y: 590 }
const INCUBATOR_POINT = { x: 455, y: 340 }
const GARDEN_POINT = { x: 980, y: 430 }
const BOUNDARY_POINT = { x: 1100, y: 560 }

const OBSERVE_DIRECTIONS: PetMotionObserveDirection[] = [
  "left",
  "right",
  "up",
  "down",
]

export function createInitialPetMotionProcessState(): PetMotionProcessState {
  return {
    lastIntentKey: null,
    holdUntilTick: 0,
    wanderSeed: 17,
    observeDirection: "right",
    lastProcessTag: null,
  }
}

function buildIntentKey(intent: ActorVisualIntent | null): string {
  if (!intent) return "none"

  return [
    intent.pose,
    intent.motionStyle,
    intent.focusTarget ?? "none",
    intent.emotionTone,
  ].join(":")
}

function nextSeed(seed: number, tick: number): number {
  return (seed * 1103515245 + 12345 + tick) % 2147483647
}

function getSeededOffset(input: {
  seed: number
  radius: number
}): StagePoint {
  const angle = (input.seed % 360) * (Math.PI / 180)
  const distance = input.radius * (0.45 + (input.seed % 37) / 100)

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  }
}

function getObserveDirection(seed: number): PetMotionObserveDirection {
  return OBSERVE_DIRECTIONS[seed % OBSERVE_DIRECTIONS.length] ?? "right"
}

function getObserveOffset(direction: PetMotionObserveDirection): StagePoint {
  if (direction === "left") return { x: -18, y: 0 }
  if (direction === "right") return { x: 18, y: 0 }
  if (direction === "up") return { x: 0, y: -14 }

  return { x: 0, y: 14 }
}

function getBaseFocusPoint(
  input: UpdatePetMotionProcessInput
): StagePoint {
  const focusTarget = input.petIntent?.focusTarget

  if (focusTarget === "incubator") {
    return (
      getActiveZonePosition(input.ecology, "incubator_zone") ??
      INCUBATOR_POINT
    )
  }

  if (focusTarget === "garden") {
    return (
      getActiveZonePosition(input.ecology, "observation_zone") ??
      getActiveZonePosition(input.ecology, "exploration_zone") ??
      GARDEN_POINT
    )
  }

  if (focusTarget === "shelter") return SHELTER_CENTER

  if (focusTarget === "boundary") {
    return (
      getActiveZonePosition(input.ecology, "exploration_zone") ??
      getActiveZonePosition(input.ecology, "observation_zone") ??
      BOUNDARY_POINT
    )
  }

  if (focusTarget === "home" || focusTarget === "butler") {
    return (
      getActiveZonePosition(input.ecology, "home_build_zone") ??
      HOME_CENTER
    )
  }

  return {
    x: input.currentMotion.targetX,
    y: input.currentMotion.targetY,
  }
}

function getRestPoint(input: UpdatePetMotionProcessInput): StagePoint {
  if (
    input.incubator?.hasEmbryo &&
    input.incubator.status !== "hatched"
  ) {
    return SHELTER_CENTER
  }

  return (
    getActiveZonePosition(input.ecology, "quiet_zone") ??
    getActiveZonePosition(input.ecology, "warm_zone") ??
    SHELTER_REST
  )
}

function resolveSpeed(intent: ActorVisualIntent | null): number {
  if (!intent) return 0.65

  if (intent.pose === "sleep" || intent.motionStyle === "still") return 0
  if (intent.pose === "alert") return 0.05
  if (intent.motionStyle === "slow") return 0.45
  if (intent.motionStyle === "hesitate") return 0.35
  if (intent.motionStyle === "targeted") return 1.15
  if (intent.motionStyle === "quick") return 1.55
  if (intent.motionStyle === "wander") return 0.85

  return 0.65
}

function refreshProcessState(input: UpdatePetMotionProcessInput) {
  const key = buildIntentKey(input.petIntent)
  const intentChanged = input.processState.lastIntentKey !== key

  if (!intentChanged && input.tick < input.processState.holdUntilTick) {
    return
  }

  const next = nextSeed(input.processState.wanderSeed, input.tick)

  input.processState.lastIntentKey = key
  input.processState.wanderSeed = next
  input.processState.observeDirection = getObserveDirection(next)

  if (input.petIntent?.motionStyle === "wander") {
    input.processState.holdUntilTick = input.tick + 18
    return
  }

  if (input.petIntent?.motionStyle === "hesitate") {
    input.processState.holdUntilTick = input.tick + 8
    return
  }

  input.processState.holdUntilTick = input.tick + 4
}

function resolveTarget(input: UpdatePetMotionProcessInput): StagePoint {
  const intent = input.petIntent

  if (!intent || !input.pet) {
    return {
      x: input.currentMotion.x,
      y: input.currentMotion.y,
    }
  }

  if (intent.pose === "sleep" || intent.pose === "rest") {
    return getRestPoint(input)
  }

  if (intent.pose === "eat") {
    return (
      getActiveZonePosition(input.ecology, "food_zone") ??
      SHELTER_CENTER
    )
  }

  const basePoint = getBaseFocusPoint(input)

  if (intent.motionStyle === "still") {
    return {
      x: input.currentMotion.x,
      y: input.currentMotion.y,
    }
  }

  if (intent.motionStyle === "wander") {
    const offset = getSeededOffset({
      seed: input.processState.wanderSeed,
      radius: intent.focusTarget === "boundary" ? 82 : 52,
    })

    return {
      x: basePoint.x + offset.x,
      y: basePoint.y + offset.y,
    }
  }

  if (intent.motionStyle === "hesitate" || intent.pose === "observe") {
    if (input.tick < input.processState.holdUntilTick - 4) {
      return {
        x: input.currentMotion.x,
        y: input.currentMotion.y,
      }
    }

    const offset = getObserveOffset(input.processState.observeDirection)

    return {
      x: basePoint.x + offset.x,
      y: basePoint.y + offset.y,
    }
  }

  return basePoint
}

export function updatePetMotionProcess(
  input: UpdatePetMotionProcessInput
): PetMotionProcessResult {
  refreshProcessState(input)

  const target = resolveTarget(input)
  const processTag = input.petIntent
    ? `pet_motion_${input.petIntent.pose}_${input.petIntent.motionStyle}`
    : "pet_motion_none"

  input.processState.lastProcessTag = processTag

  return {
    targetX: target.x,
    targetY: target.y,
    speed: resolveSpeed(input.petIntent),
    processTag,
  }
}
