/**
 * 当前文件负责：渲染家园外部临时住所结构。
 */

import { Container, Graphics } from "pixi.js"

import { TEMP_SHELTER_STAGE_POSITION, type StagePoint } from "./structure-types"
import {
  drawCornerPosts,
  drawDarkInterior,
  drawIncubatorWindow,
  drawPixelWallBlock,
  drawRoof,
  drawSoftShadow,
  drawWoodStrips,
} from "./structure-shape-utils"

export function drawTempShelter(layer: Container, position?: StagePoint) {
  const { x, y } = position ?? TEMP_SHELTER_STAGE_POSITION

  const shadow = new Graphics()
  drawSoftShadow(shadow, x - 18, y + 94, 174, 38, 0.28)
  layer.addChild(shadow)

  const shelter = new Graphics()

  drawPixelWallBlock(shelter, x, y + 8, 135, 102, {
    outer: 0x3f2b1f,
    main: 0x725038,
    light: 0x906948,
    dark: 0x2f2118,
  })

  drawRoof(shelter, x - 10, y - 16, 155, 34)
  drawWoodStrips(shelter, x + 12, y + 22, 111)
  drawDarkInterior(shelter, x + 22, y + 30, 90, 62)
  drawLifeCapsuleFocus(shelter, x + 39, y + 37)
  drawIncubatorWindow(shelter, x + 44, y + 47)
  drawCapsuleGlow(shelter, x + 45, y + 45)
  drawCornerPosts(shelter, x, y + 8, 135, 102)
  drawShelterLifeSignals(shelter, x, y)

  layer.addChild(shelter)
}

function drawLifeCapsuleFocus(graphic: Graphics, x: number, y: number) {
  graphic.rect(x - 8, y - 5, 62, 58).fill({
    color: 0x0f241b,
    alpha: 0.58,
  })

  graphic.rect(x - 5, y - 2, 56, 52).fill({
    color: 0x163d2a,
    alpha: 0.34,
  })

  graphic.rect(x - 2, y + 1, 50, 46).fill({
    color: 0x0b1b14,
    alpha: 0.52,
  })
}

function drawCapsuleGlow(graphic: Graphics, x: number, y: number) {
  graphic.circle(x + 20, y + 18, 28).fill({
    color: 0x86efac,
    alpha: 0.09,
  })

  graphic.circle(x + 20, y + 18, 18).fill({
    color: 0xa7f3d0,
    alpha: 0.12,
  })

  graphic.rect(x + 4, y + 3, 32, 3).fill({
    color: 0xfde68a,
    alpha: 0.42,
  })

  graphic.rect(x + 7, y + 34, 26, 2).fill({
    color: 0x86efac,
    alpha: 0.35,
  })

  graphic.rect(x + 39, y + 10, 3, 20).fill({
    color: 0xa7f3d0,
    alpha: 0.25,
  })
}

function drawShelterLifeSignals(graphic: Graphics, x: number, y: number) {
  graphic.rect(x + 112, y + 20, 11, 4).fill({
    color: 0x86efac,
    alpha: 0.58,
  })

  graphic.rect(x + 112, y + 29, 7, 3).fill({
    color: 0xfde68a,
    alpha: 0.45,
  })

  graphic.rect(x + 14, y + 104, 108, 4).fill({
    color: 0x1f4d2b,
    alpha: 0.5,
  })

  graphic.rect(x + 24, y + 111, 22, 3).fill({
    color: 0x86efac,
    alpha: 0.24,
  })

  graphic.rect(x + 87, y + 111, 18, 3).fill({
    color: 0xfacc15,
    alpha: 0.22,
  })
}