/**
 * 当前文件负责：组织宠物与管家等核心角色的舞台渲染流程。
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js"

import type { ActiveBehaviorProcess } from "@/ai/behavior-core/behavior-types"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import {
  darkenColor,
  lightenColor,
} from "../../shared/stage-renderer-utils"
import { moveToward } from "./actor-motion"
import type {
  ActorMotionState,
  ActorVisualState,
  CoreActorVisualRegistry,
  CreateCoreActorsInput,
  SyncCoreActorsInput,
} from "./actor-types"
import {
  shouldKeepPetNearShelter,
  shouldRenderExternalPet,
} from "./stage-pet-visibility"
import { getActiveZonePosition } from "../zones/stage-zone-renderer"

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
const PET_SHELTER_YARD_ZONE = { x: 610, y: 360 }
const PET_SHELTER_DOOR_ZONE = { x: 555, y: 390 }

const BUTLER_HOME_ZONE = { x: 900, y: 540 }
const BUTLER_IDLE_ZONE = { x: 520, y: 420 }
const BUTLER_SHELTER_CARE_ZONE = { x: 455, y: 340 }
const BUTLER_SHELTER_DOOR_ZONE = { x: 520, y: 380 }

export function createCoreActorVisualRegistry(): CoreActorVisualRegistry {
  return {
    incubator: null,
    pet: null,
    butler: null,
  }
}

export function createCoreActorVisuals(input: CreateCoreActorsInput) {
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
  } else if (input.registry.butler.container.parent !== input.layer) {
    input.layer.addChild(input.registry.butler.container)
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
  } else if (input.registry.pet.container.parent !== input.layer) {
    input.layer.addChild(input.registry.pet.container)
  }
}

export function syncCoreActorVisuals(input: SyncCoreActorsInput) {
  syncPetVisual(input)
  syncButlerVisual(input)
}

export function clearCoreActorVisuals(registry: CoreActorVisualRegistry) {
  registry.pet?.container.destroy({ children: true })
  registry.butler?.container.destroy({ children: true })

  registry.pet = null
  registry.butler = null
  registry.incubator = null
}

function syncPetVisual(input: SyncCoreActorsInput) {
  if (!input.registry.pet) return

  if (
    !shouldRenderExternalPet({
      pet: input.pet,
      incubator: input.incubator,
    })
  ) {
    input.registry.pet.container.visible = false
    input.registry.pet.graphic.clear()
    return
  }

  input.registry.pet.container.visible = true

  const target = getPetTargetPosition({
    pet: input.pet,
    incubator: input.incubator,
    ecology: input.ecology,
    tick: input.tick,
  })

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

  drawPetGraphic(input.registry.pet.graphic, input.pet, input.phase)
  input.registry.pet.label.text = input.pet?.name ?? "AI Pet"
}

function syncButlerVisual(input: SyncCoreActorsInput) {
  if (!input.registry.butler) return

  const target = getButlerTargetPosition(input)

  input.butlerMotion.targetX = target.x
  input.butlerMotion.targetY = target.y
  input.butlerMotion.speed = getButlerBaseSpeed(input.butler?.task)

  moveToward(input.butlerMotion)

  input.registry.butler.container.x = input.butlerMotion.x
  input.registry.butler.container.y = input.butlerMotion.y
  input.registry.butler.container.visible = true

  drawButlerGraphic(input.registry.butler.graphic, input.butler, input.phase)
  input.registry.butler.label.text = input.butler?.task ?? "管家"
}

function drawButlerGraphic(
  graphic: Graphics,
  butler: ButlerState | null,
  phase: number
) {
  graphic.clear()

  const task = butler?.task
  const visual = STAGE_VISUAL_CONFIG.actor.butler
  const working = task === "watching_incubator" || task === "building_home"
  const bob = working
    ? Math.sin(phase * 5.5) * 1.1
    : Math.sin(phase * 2.5) * 0.45

  drawActorShadow(graphic, 9, 67, 15, 5, 0.22)

  const bodyY = bob

  graphic.rect(3, bodyY, 12, 10).fill(visual.skin)
  graphic.rect(5, bodyY + 2, 3, 2).fill(visual.outline)
  graphic.rect(11, bodyY + 2, 3, 2).fill(visual.outline)
  graphic.rect(7, bodyY + 7, 5, 2).fill({
    color: visual.skinShadow,
    alpha: 0.42,
  })

  graphic.rect(0, bodyY + 10, 18, 28).fill(darkenColor(visual.cloth, 24))
  graphic.rect(3, bodyY + 12, 12, 22).fill(visual.cloth)
  graphic.rect(6, bodyY + 10, 6, 28).fill({
    color: visual.clothLight,
    alpha: 0.22,
  })

  graphic.rect(-4, bodyY + 15, 5, 19).fill(visual.skin)
  graphic.rect(17, bodyY + 15, 5, 19).fill(visual.skin)

  if (working) {
    graphic.rect(20, bodyY + 22, 11, 4).fill(0x8b5a2b)
    graphic.rect(28, bodyY + 17, 5, 12).fill(0x6b3f1d)
  }

  graphic.rect(3, bodyY + 38, 5, 22).fill(darkenColor(visual.dark, 6))
  graphic.rect(11, bodyY + 38, 5, 22).fill(darkenColor(visual.dark, 6))

  graphic.rect(1, bodyY + 60, 8, 4).fill(visual.dark)
  graphic.rect(10, bodyY + 60, 8, 4).fill(visual.dark)

  graphic.rect(2, bodyY - 4, 14, 4).fill(0x3f2a18)
  graphic.rect(0, bodyY - 1, 18, 3).fill(0x5a3b22)
}

function getPetTargetPosition(input: {
  pet: PetState | null
  incubator: IncubatorState | null
  ecology: WorldEcologyState | null
  tick: number
}): { x: number; y: number } {
  if (!input.pet) return PET_CENTER_ZONE

  if (
    shouldKeepPetNearShelter({
      pet: input.pet,
      incubator: input.incubator,
    })
  ) {
    return input.tick % 2 === 0 ? PET_SHELTER_YARD_ZONE : PET_SHELTER_DOOR_ZONE
  }

  const lifePhase = input.pet.lifeState?.phase

  if (lifePhase === "dependent" && input.pet.action === "exploring") {
    return PET_OBSERVE_ZONE
  }

  if (input.pet.action === "sleeping") {
    return getActiveZonePosition(input.ecology, "sleep_zone") ?? PET_SLEEP_ZONE
  }

  if (input.pet.action === "eating") {
    return getActiveZonePosition(input.ecology, "food_zone") ?? PET_EAT_ZONE
  }

  if (input.pet.action === "resting") {
    return (
      getActiveZonePosition(input.ecology, "quiet_zone") ??
      getActiveZonePosition(input.ecology, "warm_zone") ??
      PET_REST_ZONE
    )
  }

  if (input.pet.action === "observing") {
    return (
      getActiveZonePosition(input.ecology, "observation_zone") ??
      PET_OBSERVE_ZONE
    )
  }

  if (input.pet.action === "exploring") {
    return input.tick % 2 === 0 ? PET_EXPLORE_ZONE_A : PET_EXPLORE_ZONE_B
  }

  if (input.pet.action === "approaching") return PET_APPROACH_ZONE
  if (input.pet.action === "alert_idle") return PET_ALERT_ZONE
  if (input.pet.action === "idle") return PET_IDLE_ZONE

  return PET_CENTER_ZONE
}

function getButlerTargetPosition(
  input: SyncCoreActorsInput
): { x: number; y: number } {
  const petPhase = input.pet?.lifeState?.phase

  if (input.butler?.task === "watching_incubator") {
    if (input.incubator?.status === "hatched") {
      return petPhase === "newborn"
        ? BUTLER_SHELTER_CARE_ZONE
        : BUTLER_SHELTER_DOOR_ZONE
    }

    return (
      getActiveZonePosition(input.ecology, "incubator_zone") ??
      BUTLER_SHELTER_CARE_ZONE
    )
  }

  if (input.butler?.task === "building_home") {
    return (
      getActiveZonePosition(input.ecology, "home_build_zone") ??
      BUTLER_HOME_ZONE
    )
  }

  if (petPhase === "newborn" || petPhase === "adaptation") {
    return BUTLER_SHELTER_DOOR_ZONE
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

function getPetColor(pet: PetState | null): number {
  const visual = STAGE_VISUAL_CONFIG.actor.petDefault

  if (!pet) return visual.skin
  if (pet.action === "sleeping") return 0x94a3b8
  if (pet.action === "eating") return visual.cloth
  if (pet.action === "resting") return 0xa7f3d0
  if (pet.mood === "happy") return visual.cloth
  if (pet.mood === "alert") return 0xef4444
  if (pet.mood === "curious") return 0x22c55e

  return visual.skin
}

function drawPetGraphic(graphic: Graphics, pet: PetState | null, phase: number) {
  graphic.clear()

  const visual = STAGE_VISUAL_CONFIG.actor.petDefault
  const color = getPetColor(pet)
  const blink = Math.sin(phase * 1.4) > 0.96
  const moving = pet?.action === "walking" || pet?.action === "exploring"
  const step = moving ? Math.sin(phase * 7) * 1.5 : 0

  if (pet?.action === "sleeping") {
    drawActorShadow(graphic, 12, 20, 15, 5, 0.18)

    graphic.rect(0, 8, 26, 13).fill(color)
    graphic.rect(4, 3, 14, 8).fill(lightenColor(color, 8))
    graphic.rect(2, 19, 22, 3).fill({
      color: visual.outline,
      alpha: 0.18,
    })

    graphic.rect(6, 8, 3, 2).fill(visual.dark)
    graphic.rect(28, -4, 5, 5).fill(0xe2e8f0)
    graphic.rect(35, -11, 6, 6).fill(STAGE_VISUAL_CONFIG.highlightColor)
    return
  }

  drawActorShadow(graphic, 11, 24, 14, 5, 0.2)

  graphic.rect(0, 5, 22, 15).fill(color)
  graphic.rect(3, 0, 16, 9).fill(lightenColor(color, 8))

  graphic.rect(2, -3, 5, 5).fill(lightenColor(color, 5))
  graphic.rect(15, -3, 5, 5).fill(lightenColor(color, 5))

  if (blink) {
    graphic.rect(5, 4, 4, 1).fill(visual.dark)
    graphic.rect(14, 4, 4, 1).fill(visual.dark)
  } else {
    graphic.rect(6, 3, 3, 3).fill(visual.dark)
    graphic.rect(14, 3, 3, 3).fill(visual.dark)
    graphic.rect(7, 3, 1, 1).fill(STAGE_VISUAL_CONFIG.highlightColor)
    graphic.rect(15, 3, 1, 1).fill(STAGE_VISUAL_CONFIG.highlightColor)
  }

  graphic.rect(10, 8, 3, 2).fill({
    color: visual.skinShadow,
    alpha: 0.45,
  })

  graphic.rect(2, 19, 5, 5 + Math.max(0, step)).fill(visual.dark)
  graphic.rect(15, 19, 5, 5 + Math.max(0, -step)).fill(visual.dark)

  if (pet?.action === "observing") {
    graphic.rect(22, 6, 5, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.35,
    })
  }

  if (pet?.action === "eating") {
    graphic.rect(22, 15, 5, 4).fill(visual.cloth)
    graphic.rect(24, 12, 2, 3).fill(0x22c55e)
  }
}

function getPetBob(action?: string, phase = 0): number {
  if (action === "sleeping") return Math.sin(phase * 1.6) * 0.45
  if (action === "exploring") return Math.sin(phase * 6.5) * 2.2
  if (action === "walking") return Math.sin(phase * 6) * 1.8

  return Math.sin(phase * 3) * 0.8
}

function drawActorShadow(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number
) {
  graphic.ellipse(x, y, width, height).fill({
    color: STAGE_VISUAL_CONFIG.shadowColor,
    alpha,
  })
}

export type {
  ActorMotionState,
  ActorVisualState,
  CoreActorVisualRegistry,
  CreateCoreActorsInput,
  SyncCoreActorsInput,
}