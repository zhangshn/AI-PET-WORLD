/**
 * 当前文件负责：渲染 Alpha 阶段固定建筑与家园结构。
 */

import { Container, Graphics } from "pixi.js"

export const TEMP_SHELTER_STAGE_POSITION = { x: 205, y: 235 }
export const INCUBATOR_STAGE_POSITION = { x: 240, y: 282 }
export const HOME_CONSTRUCTION_STAGE_POSITION = { x: 1040, y: 520 }
export const GARDEN_STAGE_POSITION = { x: 690, y: 540 }

export function drawTempShelter(layer: Container) {
  const { x, y } = TEMP_SHELTER_STAGE_POSITION

  const shadow = new Graphics()
  drawSoftShadow(shadow, x - 14, y + 92, 164, 34, 0.24)
  layer.addChild(shadow)

  const shelter = new Graphics()

  drawPixelWallBlock(shelter, x, y + 8, 135, 102, {
    outer: 0x3f2b1f,
    main: 0x725038,
    light: 0x906948,
    dark: 0x2f2118,
  })

  drawRoof(shelter, x - 10, y - 16, 155, 34)
  drawWoodStrips(shelter, x + 12, y + 22, 111, 72)
  drawDarkInterior(shelter, x + 22, y + 30, 90, 62)
  drawIncubatorWindow(shelter, x + 44, y + 47)
  drawCornerPosts(shelter, x, y + 8, 135, 102)

  layer.addChild(shelter)
}

export function drawHomeConstruction(layer: Container) {
  const { x, y } = HOME_CONSTRUCTION_STAGE_POSITION

  const shadow = new Graphics()
  drawSoftShadow(shadow, x - 16, y + 82, 186, 38, 0.22)
  layer.addChild(shadow)

  const home = new Graphics()

  drawPixelWallBlock(home, x, y + 16, 155, 86, {
    outer: 0x60462f,
    main: 0x9a805f,
    light: 0xb39972,
    dark: 0x4a3324,
  })

  drawUnfinishedRoof(home, x + 8, y, 140)
  drawConstructionDoor(home, x + 34, y + 56)
  drawConstructionWindow(home, x + 90, y + 45)
  drawLoosePlanks(home, x + 16, y + 34)

  layer.addChild(home)
}

export function drawGarden(layer: Container) {
  const { x, y } = GARDEN_STAGE_POSITION

  const shadow = new Graphics()
  drawSoftShadow(shadow, x - 8, y + 45, 136, 20, 0.16)
  layer.addChild(shadow)

  const garden = new Graphics()

  garden.rect(x, y, 120, 56).fill({
    color: 0x6f4e25,
    alpha: 0.74,
  })

  garden.rect(x, y, 120, 3).fill({
    color: 0xb88446,
    alpha: 0.45,
  })

  garden.rect(x, y + 53, 120, 3).fill({
    color: 0x3f2b16,
    alpha: 0.34,
  })

  for (let row = 0; row < 3; row += 1) {
    const rowY = y + 10 + row * 13

    garden.rect(x + 8, rowY, 104, 2).fill({
      color: 0x3f2b16,
      alpha: 0.22,
    })

    garden.rect(x + 8, rowY + 5, 104, 2).fill({
      color: 0x9b6a32,
      alpha: 0.2,
    })
  }

  drawGardenSprout(garden, x + 15, y + 14, 0x22c55e)
  drawGardenSprout(garden, x + 48, y + 29, 0xf472b6)
  drawGardenSprout(garden, x + 88, y + 16, 0xfacc15)
  drawGardenSprout(garden, x + 72, y + 39, 0x86efac)

  layer.addChild(garden)
}

function drawPixelWallBlock(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: {
    outer: number
    main: number
    light: number
    dark: number
  }
) {
  graphic.rect(x, y, width, height).fill(colors.outer)
  graphic.rect(x + 8, y + 8, width - 16, height - 14).fill(colors.main)

  graphic.rect(x + 8, y + 8, width - 16, 4).fill({
    color: colors.light,
    alpha: 0.5,
  })

  graphic.rect(x + 8, y + height - 10, width - 16, 5).fill({
    color: colors.dark,
    alpha: 0.34,
  })

  graphic.rect(x + 8, y + 8, 4, height - 14).fill({
    color: colors.light,
    alpha: 0.28,
  })

  graphic.rect(x + width - 12, y + 8, 4, height - 14).fill({
    color: colors.dark,
    alpha: 0.28,
  })
}

function drawRoof(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number
) {
  graphic.rect(x, y + 12, width, height - 12).fill(0x4a2514)
  graphic.rect(x + 8, y + 4, width - 16, 12).fill(0x6b351a)
  graphic.rect(x + 18, y, width - 36, 6).fill(0x7a3f20)

  graphic.rect(x + 8, y + height - 8, width - 16, 8).fill({
    color: 0x2a170e,
    alpha: 0.38,
  })

  for (let index = 0; index < 7; index += 1) {
    const stripX = x + 12 + index * 20

    graphic.rect(stripX, y + 7, 12, 3).fill({
      color: 0x8a4b28,
      alpha: index % 2 === 0 ? 0.45 : 0.28,
    })
  }
}

function drawUnfinishedRoof(
  graphic: Graphics,
  x: number,
  y: number,
  width: number
) {
  graphic.rect(x, y + 12, width, 18).fill({
    color: 0x6b3a1f,
    alpha: 0.85,
  })

  graphic.rect(x + 8, y + 4, width - 16, 10).fill(0x8b4d2a)

  for (let index = 0; index < 6; index += 1) {
    const plankX = x + 10 + index * 20

    graphic.rect(plankX, y + 17, 14, 4).fill({
      color: 0x3f2416,
      alpha: 0.32,
    })
  }

  graphic.rect(x + width - 28, y + 3, 18, 5).fill(0xb66a35)
}

function drawWoodStrips(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number
) {
  for (let index = 0; index < 5; index += 1) {
    const stripY = y + index * 14

    graphic.rect(x, stripY, width, 2).fill({
      color: 0x4b3324,
      alpha: 0.34,
    })

    graphic.rect(x + 4, stripY + 7, width - 8, 1).fill({
      color: 0x9b7351,
      alpha: 0.28,
    })
  }
}

function drawDarkInterior(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number
) {
  graphic.rect(x, y, width, height).fill({
    color: 0x111827,
    alpha: 0.42,
  })

  graphic.rect(x + 6, y + 6, width - 12, height - 12).stroke({
    color: 0x2f2419,
    width: 3,
  })

  graphic.rect(x + 10, y + 10, width - 20, height - 20).fill({
    color: 0x0f172a,
    alpha: 0.34,
  })
}

function drawIncubatorWindow(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 52, 40).fill(0x0f172a)

  graphic.rect(x + 4, y + 4, 44, 32).stroke({
    color: 0x38bdf8,
    width: 3,
  })

  graphic.rect(x + 10, y + 17, 32, 10).fill({
    color: 0x38bdf8,
    alpha: 0.28,
  })

  graphic.rect(x + 22, y + 12, 10, 10).fill({
    color: 0xbae6fd,
    alpha: 0.5,
  })
}

function drawCornerPosts(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number
) {
  graphic.rect(x + 4, y + 8, 8, height - 16).fill({
    color: 0x3a2518,
    alpha: 0.42,
  })

  graphic.rect(x + width - 12, y + 8, 8, height - 16).fill({
    color: 0x3a2518,
    alpha: 0.42,
  })
}

function drawConstructionDoor(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 28, 46).fill(0x5a351d)
  graphic.rect(x + 4, y + 4, 20, 40).fill(0x6b3f1d)
  graphic.rect(x + 18, y + 21, 4, 4).fill(0xd7a64b)

  graphic.rect(x, y + 44, 28, 4).fill({
    color: 0x2d1b10,
    alpha: 0.32,
  })
}

function drawConstructionWindow(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 28, 24).fill(0x31506a)
  graphic.rect(x + 3, y + 3, 22, 18).fill(0x93c5fd)

  graphic.rect(x + 3, y + 3, 22, 4).fill({
    color: 0xdbeafe,
    alpha: 0.55,
  })

  graphic.rect(x + 13, y + 3, 3, 18).fill({
    color: 0x31506a,
    alpha: 0.42,
  })
}

function drawLoosePlanks(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 44, 5).fill({
    color: 0x6f4527,
    alpha: 0.35,
  })

  graphic.rect(x + 82, y + 31, 22, 6).fill(0xfacc15)

  graphic.rect(x + 108, y + 28, 18, 4).fill({
    color: 0x7a4a24,
    alpha: 0.35,
  })
}

function drawGardenSprout(
  graphic: Graphics,
  x: number,
  y: number,
  blossomColor: number
) {
  graphic.rect(x + 3, y + 5, 2, 9).fill(0x2f7a3b)
  graphic.rect(x, y + 7, 4, 3).fill(0x3f9f4a)
  graphic.rect(x + 4, y + 4, 4, 3).fill(0x4fbf5a)
  graphic.rect(x + 2, y, 5, 5).fill(blossomColor)
}

function drawSoftShadow(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number
) {
  graphic.rect(x, y, width, height).fill({
    color: 0x000000,
    alpha,
  })

  graphic.rect(x + 8, y - 4, width - 16, 8).fill({
    color: 0x000000,
    alpha: alpha * 0.45,
  })
}