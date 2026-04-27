/**
 * 当前文件负责：渲染宠物、管家与孵化器等核心角色。
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js"

import type { ActiveBehaviorProcess } from "@/ai/behavior-core/behavior-types"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

import {
  getActiveZonePosition,
} from "./stage-zone-renderer"
import {
  INCUBATOR_STAGE_POSITION,
  TEMP_SHELTER_STAGE_POSITION,
} from "./stage-structure-renderer"

export type ActorMotionState = {
  x: number
  y: number
  targetX: number
  targetY: number
  speed: number
}

export type ActorVisualState = {
  container: Container
  graphic: Graphics
  label: Text
}

export type CoreActorVisualRegistry = {
  incubator: Graphics | null
  pet: ActorVisualState | null
  butler: ActorVisualState | null
}

export type CreateCoreActorsInput = {
  layer: Container
  registry: CoreActorVisualRegistry
}

export type SyncCoreActorsInput = {
  registry: CoreActorVisualRegistry
  pet: PetState | null
  butler: ButlerState | null
  incubator: IncubatorState | null
  ecology: WorldEcologyState | null
  tick: number
  phase: number
  petMotion: ActorMotionState
  butlerMotion: ActorMotionState
}

const PET_CENTER_ZONE = { x: 620, y: 420 }
const PET_EXPLORE_ZONE_A = { x: 980, y: 350 }
const PET_EXPLORE_ZONE_B = { x: 1120, y: 620 }
const PET_OBSERVE_ZONE = { x: 760, y: 455 }
const PET_ALERT_ZONE = { x: 680, y: 420 }
const PET_IDLE_ZONE = { x: 640, y: 430 }
const PET_SLEEP_ZONE = { x: 1090, y: 600 }
const PET_REST_ZONE = { x: 1040, y: 590 }
const PET_EAT_ZONE = { x: 720, y: 570 }
const PET_APPROACH_ZONE = { x: 560, y: 440 }

const BUTLER_INCUBATOR_ZONE = { x: 340, y: 340 }
const BUTLER_HOME_ZONE = { x: 900, y: 540 }
const BUTLER_IDLE_ZONE = { x: 520, y: 420 }

export function createCoreActorVisualRegistry(): CoreActorVisualRegistry {
  return {
    incubator: null,
    pet: null,
    butler: null,
  }
}

export function createCoreActorVisuals(input: CreateCoreActorsInput) {
  if (!input.registry.incubator) {
    const container = new Container()
    const graphic = new Graphics()
    const label = new Text({
      text: "孵化器 / Incubator",
      style: new TextStyle({
        fill: 0xe2e8f0,
        fontSize: 10,
      }),
    })

    label.x = -10
    label.y = -18
    label.visible = false

    container.x = INCUBATOR_STAGE_POSITION.x
    container.y = INCUBATOR_STAGE_POSITION.y
    container.addChild(graphic)
    container.addChild(label)

    input.registry.incubator = graphic
    input.layer.addChild(container)
  }

  if (!input.registry.butler) {
    const container = new Container()
    const graphic = new Graphics()
    const label = new Text({
      text: "管家",
      style: new TextStyle({
        fill: 0xe2e8f0,
        fontSize: 11,
      }),
    })

    graphic.rect(0, 0, 18, 18).fill(0xf5d0a9)
    graphic.rect(-4, 18, 26, 30).fill(0x6366f1)
    graphic.rect(-2, 48, 8, 20).fill(0x1e293b)
    graphic.rect(12, 48, 8, 20).fill(0x1e293b)

    label.x = -36
    label.y = -22
    label.visible = false

    container.addChild(graphic)
    container.addChild(label)

    input.registry.butler = {
      container,
      graphic,
      label,
    }

    input.layer.addChild(container)
  }

  if (!input.registry.pet) {
    const container = new Container()
    const graphic = new Graphics()
    const label = new Text({
      text: "AI Pet",
      style: new TextStyle({
        fill: 0xf8fafc,
        fontSize: 11,
      }),
    })

    label.x = -12
    label.y = -24
    label.visible = false

    container.addChild(graphic)
    container.addChild(label)

    input.registry.pet = {
      container,
      graphic,
      label,
    }

    input.layer.addChild(container)
  }
}

export function syncCoreActorVisuals(input: SyncCoreActorsInput) {
  drawIncubatorGraphic(input.registry.incubator, input.incubator)

  if (input.registry.pet) {
    const target = getPetTargetPosition(input.pet, input.ecology, input.tick)
    const speed = getPetBaseSpeed(
      input.pet?.action,
      input.pet?.activeBehaviorProcess,
      input.pet?.lifeState?.phase
    )

    input.petMotion.targetX = target.x
    input.petMotion.targetY = target.y
    input.petMotion.speed = speed

    moveToward(input.petMotion)

    input.registry.pet.container.x = input.petMotion.x
    input.registry.pet.container.y =
      input.petMotion.y + getPetBob(input.pet?.action, input.phase)

    drawPetGraphic(input.registry.pet.graphic, input.pet)
    input.registry.pet.label.text = input.pet?.name ?? "AI Pet"
  }

  if (input.registry.butler) {
    const target = getButlerTargetPosition(input.butler, input.ecology)

    input.butlerMotion.targetX = target.x
    input.butlerMotion.targetY = target.y
    input.butlerMotion.speed = getButlerBaseSpeed(input.butler?.task)

    moveToward(input.butlerMotion)

    input.registry.butler.container.x = input.butlerMotion.x
    input.registry.butler.container.y = input.butlerMotion.y
    input.registry.butler.label.text = input.butler?.task ?? "管家"
  }
}

export function clearCoreActorVisuals(registry: CoreActorVisualRegistry) {
  registry.pet?.container.destroy({ children: true })
  registry.butler?.container.destroy({ children: true })

  registry.pet = null
  registry.butler = null
  registry.incubator = null
}

function drawIncubatorGraphic(
  graphic: Graphics | null,
  incubator: IncubatorState | null
) {
  if (!graphic) return

  graphic.clear()

  const progress = incubator?.progress ?? 0
  const stable = incubator?.stability ?? 100

  graphic.rect(0, 0, 54, 54).fill({
    color: 0x0f172a,
    alpha: 0.92,
  })

  graphic.rect(6, 6, 42, 42).stroke({
    color: stable > 60 ? 0x38bdf8 : 0xf97316,
    width: 3,
  })

  graphic.rect(12, 26, 30, 6).fill({
    color: 0x38bdf8,
    alpha: 0.26,
  })

  graphic.rect(12, 26, Math.max(2, (30 * progress) / 100), 6).fill({
    color: stable > 60 ? 0x67e8f9 : 0xfacc15,
    alpha: 0.88,
  })

  graphic.circle(27, 21, 6).fill({
    color: 0xf8fafc,
    alpha: 0.28,
  })
}

function getPetTargetPosition(
  pet: PetState | null,
  ecology: WorldEcologyState | null,
  tick: number
): { x: number; y: number } {
  if (!pet) return PET_CENTER_ZONE

  const lifePhase = pet.lifeState?.phase

  if (lifePhase === "newborn") {
    return {
      x: INCUBATOR_STAGE_POSITION.x + 42,
      y: INCUBATOR_STAGE_POSITION.y + 42,
    }
  }

  if (lifePhase === "adaptation") {
    return tick % 2 === 0
      ? {
          x: INCUBATOR_STAGE_POSITION.x + 70,
          y: INCUBATOR_STAGE_POSITION.y + 58,
        }
      : {
          x: TEMP_SHELTER_STAGE_POSITION.x + 96,
          y: TEMP_SHELTER_STAGE_POSITION.y + 86,
        }
  }

  if (lifePhase === "dependent" && pet.action === "exploring") {
    return PET_OBSERVE_ZONE
  }

  if (pet.action === "sleeping") {
    return getActiveZonePosition(ecology, "sleep_zone") ?? PET_SLEEP_ZONE
  }

  if (pet.action === "eating") {
    return getActiveZonePosition(ecology, "food_zone") ?? PET_EAT_ZONE
  }

  if (pet.action === "resting") {
    return (
      getActiveZonePosition(ecology, "quiet_zone") ??
      getActiveZonePosition(ecology, "warm_zone") ??
      PET_REST_ZONE
    )
  }

  if (pet.action === "observing") {
    return getActiveZonePosition(ecology, "observation_zone") ?? PET_OBSERVE_ZONE
  }

  if (pet.action === "exploring") {
    return tick % 2 === 0 ? PET_EXPLORE_ZONE_A : PET_EXPLORE_ZONE_B
  }

  if (pet.action === "approaching") return PET_APPROACH_ZONE
  if (pet.action === "alert_idle") return PET_ALERT_ZONE
  if (pet.action === "idle") return PET_IDLE_ZONE

  return PET_CENTER_ZONE
}

function getButlerTargetPosition(
  butler: ButlerState | null,
  ecology: WorldEcologyState | null
): { x: number; y: number } {
  if (butler?.task === "watching_incubator") {
    return getActiveZonePosition(ecology, "incubator_zone") ?? BUTLER_INCUBATOR_ZONE
  }

  if (butler?.task === "building_home") {
    return getActiveZonePosition(ecology, "home_build_zone") ?? BUTLER_HOME_ZONE
  }

  return BUTLER_IDLE_ZONE
}

function getPetBaseSpeed(
  action?: string,
  process?: ActiveBehaviorProcess | null,
  lifePhase?: string
): number {
  let baseSpeed = 0.7

  if (action === "exploring") baseSpeed = 1.8
  if (action === "walking") baseSpeed = 1.5
  if (action === "approaching") baseSpeed = 1.25
  if (action === "observing") baseSpeed = 0.55

  if (action === "eating" || action === "sleeping" || action === "resting") {
    baseSpeed = 0.35
  }

  if (process?.stage === "peak") baseSpeed *= 1.28
  if (process?.stage === "cooldown") baseSpeed *= 0.72

  if (lifePhase === "newborn") baseSpeed *= 0.28
  if (lifePhase === "adaptation") baseSpeed *= 0.45
  if (lifePhase === "dependent") baseSpeed *= 0.65

  return baseSpeed
}

function getButlerBaseSpeed(task?: string): number {
  if (task === "watching_incubator") return 1.15
  if (task === "building_home") return 1.2

  return 0.85
}

function moveToward(state: ActorMotionState) {
  const dx = state.targetX - state.x
  const dy = state.targetY - state.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance < 0.5) {
    state.x = state.targetX
    state.y = state.targetY
    return
  }

  const step = state.speed

  if (distance <= step) {
    state.x = state.targetX
    state.y = state.targetY
    return
  }

  state.x += (dx / distance) * step
  state.y += (dy / distance) * step
}

function getPetColor(pet: PetState | null): number {
  if (!pet) return 0xf8fafc
  if (pet.action === "sleeping") return 0x94a3b8
  if (pet.action === "eating") return 0xfacc15
  if (pet.action === "resting") return 0xa7f3d0
  if (pet.mood === "happy") return 0xf59e0b
  if (pet.mood === "alert") return 0xef4444
  if (pet.mood === "curious") return 0x22c55e

  return 0xf8fafc
}

function drawPetGraphic(graphic: Graphics, pet: PetState | null) {
  graphic.clear()

  const color = getPetColor(pet)

  if (pet?.action === "sleeping") {
    graphic.rect(0, 8, 26, 13).fill(color)
    graphic.rect(4, 2, 14, 8).fill(color)
    graphic.rect(28, -4, 5, 5).fill(0xe2e8f0)
    graphic.rect(35, -11, 6, 6).fill(0xf8fafc)
    return
  }

  graphic.rect(0, 0, 22, 18).fill(color)
  graphic.rect(4, -6, 14, 8).fill(color)
  graphic.rect(2, 18, 5, 5).fill(0x111827)
  graphic.rect(15, 18, 5, 5).fill(0x111827)
}

function getPetBob(action?: string, phase = 0): number {
  if (action === "sleeping") return Math.sin(phase * 1.6) * 0.45
  if (action === "exploring") return Math.sin(phase * 6.5) * 2.2
  if (action === "walking") return Math.sin(phase * 6) * 1.8

  return Math.sin(phase * 3) * 0.8
}