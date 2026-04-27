/**
 * 当前文件负责：渲染 Alpha 阶段固定建筑与家园结构。
 */

import { Container, Graphics } from "pixi.js"

export const TEMP_SHELTER_STAGE_POSITION = { x: 205, y: 235 }
export const INCUBATOR_STAGE_POSITION = { x: 240, y: 282 }
export const HOME_CONSTRUCTION_STAGE_POSITION = { x: 1040, y: 520 }
export const GARDEN_STAGE_POSITION = { x: 690, y: 540 }

export function drawTempShelter(layer: Container) {
  const shadow = new Graphics()

  shadow.rect(
    TEMP_SHELTER_STAGE_POSITION.x - 12,
    TEMP_SHELTER_STAGE_POSITION.y + 88,
    160,
    34
  ).fill({
    color: 0x000000,
    alpha: 0.22,
  })

  layer.addChild(shadow)

  const shelter = new Graphics()

  shelter.rect(
    TEMP_SHELTER_STAGE_POSITION.x,
    TEMP_SHELTER_STAGE_POSITION.y,
    135,
    112
  ).fill(0x4a3426)

  shelter.rect(
    TEMP_SHELTER_STAGE_POSITION.x + 10,
    TEMP_SHELTER_STAGE_POSITION.y + 12,
    115,
    92
  ).fill(0x7a5a3a)

  shelter.rect(
    TEMP_SHELTER_STAGE_POSITION.x - 8,
    TEMP_SHELTER_STAGE_POSITION.y - 14,
    151,
    18
  ).fill(0x5b2e16)

  shelter.rect(
    TEMP_SHELTER_STAGE_POSITION.x + 20,
    TEMP_SHELTER_STAGE_POSITION.y + 22,
    92,
    66
  ).fill({
    color: 0x1f2937,
    alpha: 0.32,
  })

  shelter.rect(
    TEMP_SHELTER_STAGE_POSITION.x + 26,
    TEMP_SHELTER_STAGE_POSITION.y + 26,
    80,
    54
  ).stroke({
    color: 0x2f2419,
    width: 3,
  })

  layer.addChild(shelter)
}

export function drawHomeConstruction(layer: Container) {
  const shadow = new Graphics()

  shadow.rect(
    HOME_CONSTRUCTION_STAGE_POSITION.x - 14,
    HOME_CONSTRUCTION_STAGE_POSITION.y + 76,
    184,
    36
  ).fill({
    color: 0x000000,
    alpha: 0.2,
  })

  layer.addChild(shadow)

  const home = new Graphics()

  home.rect(
    HOME_CONSTRUCTION_STAGE_POSITION.x,
    HOME_CONSTRUCTION_STAGE_POSITION.y,
    155,
    100
  ).fill({
    color: 0x8b7355,
    alpha: 0.75,
  })

  home.rect(
    HOME_CONSTRUCTION_STAGE_POSITION.x + 16,
    HOME_CONSTRUCTION_STAGE_POSITION.y + 14,
    124,
    14
  ).fill(0x7c2d12)

  home.rect(
    HOME_CONSTRUCTION_STAGE_POSITION.x + 34,
    HOME_CONSTRUCTION_STAGE_POSITION.y + 52,
    26,
    48
  ).fill(0x6b3f1d)

  home.rect(
    HOME_CONSTRUCTION_STAGE_POSITION.x + 90,
    HOME_CONSTRUCTION_STAGE_POSITION.y + 44,
    24,
    22
  ).fill(0x93c5fd)

  home.rect(
    HOME_CONSTRUCTION_STAGE_POSITION.x + 116,
    HOME_CONSTRUCTION_STAGE_POSITION.y + 72,
    18,
    8
  ).fill(0xfacc15)

  layer.addChild(home)
}

export function drawGarden(layer: Container) {
  const garden = new Graphics()

  garden.rect(
    GARDEN_STAGE_POSITION.x,
    GARDEN_STAGE_POSITION.y,
    120,
    56
  ).fill({
    color: 0x6f4e25,
    alpha: 0.72,
  })

  garden.rect(
    GARDEN_STAGE_POSITION.x + 15,
    GARDEN_STAGE_POSITION.y + 13,
    7,
    7
  ).fill(0x22c55e)

  garden.rect(
    GARDEN_STAGE_POSITION.x + 48,
    GARDEN_STAGE_POSITION.y + 28,
    7,
    7
  ).fill(0xf472b6)

  garden.rect(
    GARDEN_STAGE_POSITION.x + 88,
    GARDEN_STAGE_POSITION.y + 15,
    7,
    7
  ).fill(0xfacc15)

  garden.rect(
    GARDEN_STAGE_POSITION.x + 10,
    GARDEN_STAGE_POSITION.y + 42,
    95,
    3
  ).fill({
    color: 0x3f2b16,
    alpha: 0.42,
  })

  layer.addChild(garden)
}