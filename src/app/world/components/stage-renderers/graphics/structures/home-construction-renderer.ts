/**
 * 当前文件负责：渲染家园中正在建设的房屋结构。
 */

import { Container, Graphics } from "pixi.js"

import {
  HOME_CONSTRUCTION_STAGE_POSITION,
  type StagePoint,
} from "./structure-types"
import {
  drawConstructionDoor,
  drawConstructionWindow,
  drawLoosePlanks,
  drawPixelWallBlock,
  drawSoftShadow,
  drawUnfinishedRoof,
} from "./structure-shape-utils"

export function drawHomeConstruction(layer: Container, position?: StagePoint) {
  const { x, y } = position ?? HOME_CONSTRUCTION_STAGE_POSITION

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