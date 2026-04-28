/**
 * 当前文件负责：渲染住所室内背景墙面与地板。
 */

import { Container, Graphics } from "pixi.js"

export function drawInteriorBackground(
  layer: Container,
  width: number,
  height: number
) {
  const graphic = new Graphics()

  graphic.rect(0, 0, width, height).fill(0x1f2933)

  graphic.rect(56, 42, width - 112, height - 96).fill({
    color: 0x3b2f2a,
    alpha: 0.96,
  })

  graphic.rect(72, 58, width - 144, height - 128).fill({
    color: 0x4a382e,
    alpha: 0.98,
  })

  graphic.rect(72, 58, width - 144, 18).fill({
    color: 0x6b4b36,
    alpha: 0.48,
  })

  graphic.rect(72, height - 88, width - 144, 18).fill({
    color: 0x241916,
    alpha: 0.34,
  })

  drawWallPattern(graphic, width, height)

  layer.addChild(graphic)
}

export function drawInteriorFloor(
  layer: Container,
  width: number,
  height: number
) {
  const graphic = new Graphics()
  const floorTop = 260

  graphic.rect(78, floorTop, width - 156, height - floorTop - 88).fill({
    color: 0x6b4a32,
    alpha: 0.98,
  })

  for (let y = floorTop + 16; y < height - 96; y += 28) {
    graphic.rect(88, y, width - 176, 3).fill({
      color: 0x3b271c,
      alpha: 0.22,
    })

    graphic.rect(88, y + 12, width - 176, 1).fill({
      color: 0x9a6a45,
      alpha: 0.13,
    })
  }

  for (let x = 102; x < width - 110; x += 74) {
    graphic.rect(x, floorTop + 8, 3, height - floorTop - 108).fill({
      color: 0x3b271c,
      alpha: 0.13,
    })
  }

  layer.addChild(graphic)
}

function drawWallPattern(graphic: Graphics, width: number, height: number) {
  for (let x = 96; x < width - 96; x += 48) {
    graphic.rect(x, 86, 26, 3).fill({
      color: 0x7a5a40,
      alpha: 0.18,
    })
  }

  for (let y = 116; y < height - 130; y += 46) {
    graphic.rect(76, y, 8, 24).fill({
      color: 0x2f241f,
      alpha: 0.18,
    })

    graphic.rect(width - 84, y + 8, 8, 24).fill({
      color: 0x2f241f,
      alpha: 0.18,
    })
  }
}