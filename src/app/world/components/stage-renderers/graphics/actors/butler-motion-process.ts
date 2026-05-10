/**
 * 当前文件负责：根据管家视觉意图生成前端运动过程。
 *
 * MotionProcess 只影响像素舞台表现，不改变管家后台任务。
 */

import type {
  ButlerState,
} from "@/types/butler"
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

export type ButlerMotionProcessState = {
  lastIntentKey: string | null
  holdUntilTick: number
  workSeed: number
  patrolSeed: number
  lastProcessTag: string | null
}

export type ButlerMotionProcessResult = {
  targetX: number
  targetY: number
  speed: number
  processTag: string
}

export type UpdateButlerMotionProcessInput = {
  butler: ButlerState | null
  butlerIntent: ActorVisualIntent | null
  currentMotion: ActorMotionState
  processState: ButlerMotionProcessState
  tick: number
  ecology: WorldEcologyState | null
  petMotion?: ActorMotionState
}

type StagePoint = {
  x: number
  y: number
}

const HOME_WORK_POINT = { x: 900, y: 540 }
const HOME_IDLE_POINT = { x: 520, y: 420 }
const INCUBATOR_WATCH_POINT = { x: 455, y: 340 }
const GARDEN_WORK_POINT = { x: 980, y: 430 }
const WORLD_PATROL_POINT = { x: 760, y: 455 }

export function createInitialButlerMotionProcessState():
  ButlerMotionProcessState {
  return {
    lastIntentKey: null,
    holdUntilTick: 0,
    workSeed: 31,
    patrolSeed: 73,
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
  return (seed * 1664525 + 1013904223 + tick) % 2147483647
}

function getSeededOffset(input: {
  seed: number
  radius: number
}): StagePoint {
  const angle = (input.seed % 360) * (Math.PI / 180)
  const distance = input.radius * (0.35 + (input.seed % 41) / 100)

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  }
}

function getPetOffset(seed: number, distance: number): StagePoint {
  const side = seed % 2 === 0 ? -1 : 1

  return {
    x: side * distance,
    y: 26 + (seed % 15),
  }
}

function refreshProcessState(input: UpdateButlerMotionProcessInput) {
  const key = buildIntentKey(input.butlerIntent)
  const intentChanged = input.processState.lastIntentKey !== key

  if (!intentChanged && input.tick < input.processState.holdUntilTick) {
    return
  }

  input.processState.lastIntentKey = key
  input.processState.workSeed = nextSeed(
    input.processState.workSeed,
    input.tick
  )
  input.processState.patrolSeed = nextSeed(
    input.processState.patrolSeed,
    input.tick + 7
  )

  if (input.butlerIntent?.pose === "work") {
    input.processState.holdUntilTick = input.tick + 20
    return
  }

  if (input.butlerIntent?.motionStyle === "hesitate") {
    input.processState.holdUntilTick = input.tick + 10
    return
  }

  if (input.butlerIntent?.motionStyle === "targeted") {
    input.processState.holdUntilTick = input.tick + 14
    return
  }

  input.processState.holdUntilTick = input.tick + 8
}

function getFocusPoint(
  input: UpdateButlerMotionProcessInput
): StagePoint {
  const intent = input.butlerIntent

  if (intent?.focusTarget === "incubator") {
    return (
      getActiveZonePosition(input.ecology, "incubator_zone") ??
      INCUBATOR_WATCH_POINT
    )
  }

  if (intent?.focusTarget === "garden") {
    return (
      getActiveZonePosition(input.ecology, "observation_zone") ??
      GARDEN_WORK_POINT
    )
  }

  if (intent?.focusTarget === "pet" && input.petMotion) {
    const distance = intent.pose === "offer" ? 74 : 118
    const offset = getPetOffset(input.processState.patrolSeed, distance)

    return {
      x: input.petMotion.x + offset.x,
      y: input.petMotion.y + offset.y,
    }
  }

  if (intent?.focusTarget === "boundary") {
    return (
      getActiveZonePosition(input.ecology, "observation_zone") ??
      WORLD_PATROL_POINT
    )
  }

  if (intent?.focusTarget === "home") {
    return (
      getActiveZonePosition(input.ecology, "home_build_zone") ??
      HOME_WORK_POINT
    )
  }

  return HOME_IDLE_POINT
}

function resolveTarget(input: UpdateButlerMotionProcessInput): StagePoint {
  const intent = input.butlerIntent

  if (!intent || !input.butler) {
    return {
      x: input.currentMotion.x,
      y: input.currentMotion.y,
    }
  }

  if (intent.motionStyle === "still") {
    return {
      x: input.currentMotion.x,
      y: input.currentMotion.y,
    }
  }

  const focusPoint = getFocusPoint(input)

  if (intent.pose === "work") {
    const offset = getSeededOffset({
      seed: input.processState.workSeed,
      radius: 34,
    })

    return {
      x: focusPoint.x + offset.x,
      y: focusPoint.y + offset.y,
    }
  }

  if (intent.motionStyle === "hesitate") {
    if (input.tick < input.processState.holdUntilTick - 5) {
      return {
        x: input.currentMotion.x,
        y: input.currentMotion.y,
      }
    }

    const offset = getSeededOffset({
      seed: input.processState.patrolSeed,
      radius: 20,
    })

    return {
      x: focusPoint.x + offset.x,
      y: focusPoint.y + offset.y,
    }
  }

  if (intent.pose === "idle") {
    const offset = getSeededOffset({
      seed: input.processState.patrolSeed,
      radius: 22,
    })

    return {
      x: HOME_IDLE_POINT.x + offset.x,
      y: HOME_IDLE_POINT.y + offset.y,
    }
  }

  return focusPoint
}

function resolveSpeed(intent: ActorVisualIntent | null): number {
  if (!intent) return 0.7

  if (intent.motionStyle === "still") return 0
  if (intent.motionStyle === "slow") return 0.5
  if (intent.motionStyle === "hesitate") return 0.35
  if (intent.motionStyle === "targeted") return 0.95
  if (intent.motionStyle === "quick") return 1.35
  if (intent.pose === "work") return 0.75

  return 0.7
}

export function updateButlerMotionProcess(
  input: UpdateButlerMotionProcessInput
): ButlerMotionProcessResult {
  refreshProcessState(input)

  const target = resolveTarget(input)
  const processTag = input.butlerIntent
    ? `butler_motion_${input.butlerIntent.pose}_${input.butlerIntent.motionStyle}`
    : "butler_motion_none"

  input.processState.lastProcessTag = processTag

  return {
    targetX: target.x,
    targetY: target.y,
    speed: resolveSpeed(input.butlerIntent),
    processTag,
  }
}
