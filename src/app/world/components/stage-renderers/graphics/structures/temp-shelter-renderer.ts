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
  drawWoodStrips(shelter, x + 12, y + 22, 111)
  drawDarkInterior(shelter, x + 22, y + 30, 90, 62)
  drawIncubatorWindow(shelter, x + 44, y + 47)
  drawCornerPosts(shelter, x, y + 8, 135, 102)

  layer.addChild(shelter)
}