/**
 * 当前文件负责：组织住所室内场景渲染流程。
 */

import { Container, Graphics } from "pixi.js"

import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

import {
  drawInteriorBackground,
  drawInteriorFloor,
} from "./interior-background-renderer"
import {
  drawBirthRecordDesk,
  drawInteriorDoor,
  drawRestCorner,
  drawStorageShelf,
} from "./interior-furniture-renderer"
import { drawInteriorForeground } from "./interior-foreground-renderer"
import { drawIncubatorStation } from "./interior-incubator-renderer"
import { drawNewbornNest } from "./interior-newborn-nest-renderer"
import { drawInteriorText } from "./interior-text-renderer"

export type DrawShelterInteriorInput = {
  backgroundLayer: Container | null
  terrainLayer: Container | null
  structureLayer: Container | null
  natureLayer: Container | null
  foregroundLayer: Container | null
  incubator: IncubatorState | null
  pet: PetState | null
  width: number
  height: number
}

export function drawShelterInterior(input: DrawShelterInteriorInput) {
  if (
    !input.backgroundLayer ||
    !input.terrainLayer ||
    !input.structureLayer ||
    !input.natureLayer ||
    !input.foregroundLayer
  ) {
    return
  }

  input.backgroundLayer.removeChildren()
  input.terrainLayer.removeChildren()
  input.structureLayer.removeChildren()
  input.natureLayer.removeChildren()
  input.foregroundLayer.removeChildren()

  drawInteriorBackground(input.backgroundLayer, input.width, input.height)
  drawInteriorFloor(input.terrainLayer, input.width, input.height)
  drawInteriorStructures(input.structureLayer, input.incubator, input.pet)
  drawInteriorForeground(input.foregroundLayer, input.width, input.height)
}

export function getShelterInteriorRenderKey(input: {
  incubator: IncubatorState | null
  pet: PetState | null
  width: number
  height: number
}): string {
  const progress = Math.round(input.incubator?.progress ?? 0)
  const stability = Math.round(input.incubator?.stability ?? 0)
  const petPhase = input.pet?.lifeState?.phase ?? "none"
  const petName = input.pet?.name ?? "none"

  return `shelter-interior-${input.width}-${input.height}-${progress}-${stability}-${petPhase}-${petName}`
}

function drawInteriorStructures(
  layer: Container,
  incubator: IncubatorState | null,
  pet: PetState | null
) {
  const graphic = new Graphics()

  drawInteriorDoor(graphic, 1080, 430)
  drawRestCorner(graphic, 190, 440)
  drawNewbornNest(graphic, 360, 470, incubator, pet)
  drawStorageShelf(graphic, 185, 150)
  drawIncubatorStation(graphic, 530, 285, incubator, pet)
  drawBirthRecordDesk(graphic, 720, 190, pet)

  layer.addChild(graphic)
  drawInteriorText(layer)
}