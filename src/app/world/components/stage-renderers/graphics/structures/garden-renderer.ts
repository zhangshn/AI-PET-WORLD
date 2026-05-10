/**
 * 当前文件负责：渲染家园花园结构。
 */

import { Container, Graphics } from "pixi.js"

import type { HomeState } from "@/types/home"

import { GARDEN_STAGE_POSITION, type StagePoint } from "./structure-types"
import { drawGardenSprout, drawSoftShadow } from "./structure-shape-utils"

export function drawGarden(
  layer: Container,
  position?: StagePoint,
  home?: HomeState | null
) {
  const { x, y } = position ?? GARDEN_STAGE_POSITION
  const gardenProgress = clampPercent(home?.gardenProgress ?? home?.progress ?? 0)
  const comfort = clampPercent(home?.comfort ?? 0)
  const activity = clampPercent(home?.spaceSummary?.overallActivity ?? home?.expansion ?? 0)

  const shadow = new Graphics()
  drawSoftShadow(shadow, x - 8, y + 45, 136 + gardenProgress * 0.32, 20, 0.16)
  layer.addChild(shadow)

  const garden = new Graphics()

  drawGardenGround(garden, x, y, gardenProgress)
  drawGardenRows(garden, x, y, gardenProgress)
  drawGardenPlants(garden, x, y, gardenProgress, comfort)
  drawActivityCorner(garden, x, y, gardenProgress, activity)
  drawGardenBoundary(garden, x, y, gardenProgress)

  layer.addChild(garden)
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function drawGardenGround(graphic: Graphics, x: number, y: number, progress: number) {
  const width = progress >= 70 ? 156 : progress >= 35 ? 136 : 120
  const height = progress >= 70 ? 68 : progress >= 35 ? 60 : 56

  graphic.rect(x, y, width, height).fill({
    color: 0x6f4e25,
    alpha: 0.62 + progress / 420,
  })

  graphic.rect(x, y, width, 3).fill({
    color: 0xb88446,
    alpha: 0.35 + progress / 500,
  })

  graphic.rect(x, y + height - 3, width, 3).fill({
    color: 0x3f2b16,
    alpha: 0.28 + progress / 700,
  })

  if (progress >= 55) {
    graphic.rect(x - 12, y + 8, 10, height - 14).fill({
      color: 0x3d6f2b,
      alpha: 0.26,
    })
    graphic.rect(x + width + 3, y + 12, 8, height - 22).fill({
      color: 0x3d6f2b,
      alpha: 0.22,
    })
  }
}

function drawGardenRows(graphic: Graphics, x: number, y: number, progress: number) {
  const rowCount = progress >= 80 ? 4 : 3
  const width = progress >= 70 ? 140 : 104

  for (let row = 0; row < rowCount; row += 1) {
    const rowY = y + 10 + row * 13

    graphic.rect(x + 8, rowY, width, 2).fill({
      color: 0x3f2b16,
      alpha: 0.18 + progress / 650,
    })

    graphic.rect(x + 8, rowY + 5, width, 2).fill({
      color: 0x9b6a32,
      alpha: 0.16 + progress / 750,
    })
  }
}

function drawGardenPlants(
  graphic: Graphics,
  x: number,
  y: number,
  progress: number,
  comfort: number
) {
  drawGardenSprout(graphic, x + 15, y + 14, 0x22c55e)
  drawGardenSprout(graphic, x + 48, y + 29, progress >= 35 ? 0xf472b6 : 0x22c55e)
  drawGardenSprout(graphic, x + 88, y + 16, progress >= 50 ? 0xfacc15 : 0x86efac)

  if (progress >= 35) {
    drawGardenSprout(graphic, x + 72, y + 39, 0x86efac)
    drawGardenSprout(graphic, x + 112, y + 34, 0x22c55e)
  }

  if (progress >= 60) {
    drawGardenSprout(graphic, x + 126, y + 18, 0xf472b6)
    drawGardenSprout(graphic, x + 33, y + 47, 0xfacc15)
  }

  if (progress >= 85 || comfort >= 70) {
    graphic.rect(x + 132, y + 48, 12, 5).fill({ color: 0xfde68a, alpha: 0.5 })
    graphic.rect(x + 136, y + 42, 5, 8).fill({ color: 0x22c55e, alpha: 0.55 })
    graphic.rect(x + 102, y + 52, 10, 4).fill({ color: 0xf472b6, alpha: 0.45 })
  }
}

function drawActivityCorner(
  graphic: Graphics,
  x: number,
  y: number,
  progress: number,
  activity: number
) {
  if (progress < 45 && activity < 45) return

  graphic.rect(x + 122, y + 58, 34, 10).fill({
    color: 0xb89763,
    alpha: 0.28 + activity / 500,
  })

  graphic.rect(x + 128, y + 50, 18, 6).fill({
    color: 0x8b5a2b,
    alpha: 0.48,
  })

  graphic.rect(x + 132, y + 46, 10, 4).fill({
    color: 0xd3b27a,
    alpha: 0.42,
  })

  if (activity >= 70) {
    graphic.rect(x + 151, y + 48, 5, 5).fill({ color: 0x93c5fd, alpha: 0.55 })
    graphic.rect(x + 158, y + 44, 4, 4).fill({ color: 0xfde68a, alpha: 0.42 })
  }
}

function drawGardenBoundary(graphic: Graphics, x: number, y: number, progress: number) {
  if (progress < 28) return

  const width = progress >= 70 ? 156 : 136
  const height = progress >= 70 ? 68 : 60
  const fenceAlpha = 0.34 + progress / 420

  for (let index = 0; index < Math.floor(width / 24); index += 1) {
    const fenceX = x + 5 + index * 24
    graphic.rect(fenceX, y - 6, 4, 11).fill({ color: 0x7a4a24, alpha: fenceAlpha })
    graphic.rect(fenceX, y + height - 3, 4, 10).fill({ color: 0x7a4a24, alpha: fenceAlpha * 0.8 })
  }

  graphic.rect(x + 4, y - 2, width - 8, 3).fill({ color: 0xb66a35, alpha: fenceAlpha * 0.7 })
  graphic.rect(x + 4, y + height, width - 8, 3).fill({ color: 0x6b3f1d, alpha: fenceAlpha * 0.58 })
}
