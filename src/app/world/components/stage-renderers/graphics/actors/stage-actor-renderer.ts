/**
 * 当前文件负责：组织宠物与管家等核心角色的舞台渲染流程。
 */

import { moveToward } from "./actor-motion"
import {
  getButlerBaseSpeed,
  getButlerTargetPosition,
  getPetBaseSpeed,
  getPetTargetPosition,
} from "./actor-target-resolver"
import type {
  ActorMotionState,
  ActorVisualState,
  CoreActorVisualRegistry,
  CreateCoreActorsInput,
  SyncCoreActorsInput,
} from "./actor-types"
import { createCoreActorVisuals } from "./actor-visual-factory"
import { drawButlerGraphic } from "./butler-renderer"
import { drawPetGraphic, getPetBob } from "./pet-renderer"
import { shouldRenderExternalPet } from "./stage-pet-visibility"

export { createCoreActorVisuals }

export function createCoreActorVisualRegistry(): CoreActorVisualRegistry {
  return {
    incubator: null,
    pet: null,
    butler: null,
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

export type {
  ActorMotionState,
  ActorVisualState,
  CoreActorVisualRegistry,
  CreateCoreActorsInput,
  SyncCoreActorsInput,
}