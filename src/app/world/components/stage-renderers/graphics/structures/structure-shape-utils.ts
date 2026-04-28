/**
 * 当前文件负责：提供家园结构渲染共用的像素形状工具。
 */

import type { Graphics } from "pixi.js"

export function drawPixelWallBlock(
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

export function drawRoof(
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

export function drawUnfinishedRoof(
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

export function drawWoodStrips(
  graphic: Graphics,
  x: number,
  y: number,
  width: number
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

export function drawDarkInterior(
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

export function drawIncubatorWindow(graphic: Graphics, x: number, y: number) {
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

export function drawCornerPosts(
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

export function drawConstructionDoor(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 28, 46).fill(0x5a351d)
  graphic.rect(x + 4, y + 4, 20, 40).fill(0x6b3f1d)
  graphic.rect(x + 18, y + 21, 4, 4).fill(0xd7a64b)

  graphic.rect(x, y + 44, 28, 4).fill({
    color: 0x2d1b10,
    alpha: 0.32,
  })
}

export function drawConstructionWindow(graphic: Graphics, x: number, y: number) {
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

export function drawLoosePlanks(graphic: Graphics, x: number, y: number) {
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

export function drawGardenSprout(
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

export function drawSoftShadow(
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