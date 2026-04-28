/**
 * 当前文件负责：渲染家园花园结构。
 */

import { Container, Graphics } from "pixi.js"

import { GARDEN_STAGE_POSITION, type StagePoint } from "./structure-types"
import { drawGardenSprout, drawSoftShadow } from "./structure-shape-utils"

export function drawGarden(layer: Container, position?: StagePoint) {
  const { x, y } = position ?? GARDEN_STAGE_POSITION

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