/**
 * 当前文件负责：渲染家园中正在建设的正式住所结构。
 */

import { Container, Graphics } from "pixi.js"

import {
  HOME_CONSTRUCTION_STAGE_POSITION,
  type StagePoint,
} from "./structure-types"
import { drawSoftShadow } from "./structure-shape-utils"

export function drawHomeConstruction(layer: Container, position?: StagePoint) {
  const { x, y } = position ?? HOME_CONSTRUCTION_STAGE_POSITION

  const shadow = new Graphics()
  drawSoftShadow(shadow, x - 20, y + 88, 196, 34, 0.18)
  layer.addChild(shadow)

  const construction = new Graphics()

  drawFoundation(construction, x, y + 64)
  drawWoodFrame(construction, x + 14, y + 18)
  drawHalfRoof(construction, x + 8, y + 2)
  drawWorkBench(construction, x + 96, y + 76)
  drawToolCrate(construction, x + 18, y + 86)
  drawConstructionMarker(construction, x + 126, y + 42)

  layer.addChild(construction)
}

function drawFoundation(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 158, 44).fill({
    color: 0x8b7355,
    alpha: 0.78,
  })

  graphic.rect(x + 8, y + 8, 142, 24).fill({
    color: 0xa18a68,
    alpha: 0.5,
  })

  graphic.rect(x, y + 39, 158, 5).fill({
    color: 0x4a3324,
    alpha: 0.32,
  })

  for (let index = 0; index < 5; index += 1) {
    graphic.rect(x + 12 + index * 28, y + 12, 16, 4).fill({
      color: 0x6b4b36,
      alpha: index % 2 === 0 ? 0.24 : 0.14,
    })
  }
}

function drawWoodFrame(graphic: Graphics, x: number, y: number) {
  const wood = 0x7a4a24
  const darkWood = 0x3f2416
  const lightWood = 0xb66a35

  graphic.rect(x, y + 46, 124, 8).fill(darkWood)
  graphic.rect(x + 4, y + 4, 8, 88).fill(wood)
  graphic.rect(x + 56, y, 8, 92).fill(wood)
  graphic.rect(x + 112, y + 10, 8, 82).fill(wood)

  graphic.rect(x + 4, y + 18, 116, 7).fill(lightWood)
  graphic.rect(x + 4, y + 52, 116, 7).fill(wood)

  graphic.rect(x + 16, y + 30, 48, 5).fill({
    color: darkWood,
    alpha: 0.32,
  })

  graphic.rect(x + 70, y + 64, 36, 5).fill({
    color: darkWood,
    alpha: 0.28,
  })

  graphic.rect(x + 16, y + 78, 30, 6).fill(lightWood)
}

function drawHalfRoof(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y + 20, 132, 16).fill({
    color: 0x6b3a1f,
    alpha: 0.88,
  })

  graphic.rect(x + 10, y + 10, 112, 12).fill(0x8b4d2a)

  graphic.rect(x + 22, y + 4, 76, 8).fill({
    color: 0xb66a35,
    alpha: 0.9,
  })

  for (let index = 0; index < 5; index += 1) {
    graphic.rect(x + 12 + index * 23, y + 25, 14, 4).fill({
      color: 0x3f2416,
      alpha: 0.3,
    })
  }

  graphic.rect(x + 104, y + 2, 20, 5).fill({
    color: 0xfacc15,
    alpha: 0.75,
  })
}

function drawWorkBench(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 58, 8).fill(0x6b3f1d)
  graphic.rect(x + 4, y - 9, 46, 10).fill({
    color: 0x8b5a2b,
    alpha: 0.86,
  })

  graphic.rect(x + 6, y + 8, 6, 22).fill(0x3f2416)
  graphic.rect(x + 44, y + 8, 6, 22).fill(0x3f2416)

  graphic.rect(x + 20, y - 18, 22, 5).fill(0x94a3b8)
  graphic.rect(x + 28, y - 25, 5, 12).fill(0x64748b)
}

function drawToolCrate(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 42, 24).fill(0x6b3f1d)
  graphic.rect(x + 4, y + 4, 34, 16).fill({
    color: 0x8b5a2b,
    alpha: 0.82,
  })

  graphic.rect(x + 6, y + 10, 30, 3).fill({
    color: 0x3f2416,
    alpha: 0.28,
  })

  graphic.rect(x + 8, y - 10, 20, 5).fill(0xfacc15)
  graphic.rect(x + 27, y - 13, 6, 12).fill(0x64748b)
}

function drawConstructionMarker(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 18, 44).fill(0x7a4a24)

  graphic.rect(x - 14, y + 4, 46, 22).fill({
    color: 0xfacc15,
    alpha: 0.86,
  })

  graphic.rect(x - 10, y + 8, 38, 4).fill({
    color: 0x3f2416,
    alpha: 0.42,
  })

  graphic.rect(x - 10, y + 17, 26, 4).fill({
    color: 0x3f2416,
    alpha: 0.32,
  })
}