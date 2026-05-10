/**
 * 当前文件负责：渲染家园外部临时住所结构。
 */

import { Container, Graphics } from "pixi.js"

import type { HomeState } from "@/types/home"

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

export function drawTempShelter(
  layer: Container,
  position?: StagePoint,
  home?: HomeState | null
) {
  const { x, y } = position ?? TEMP_SHELTER_STAGE_POSITION
  const progress = clampPercent(home?.progress ?? 0)
  const stability = clampPercent(home?.stability ?? 45)
  const isCompleted = home?.status === "completed"

  const shadow = new Graphics()
  drawSoftShadow(shadow, x - 18, y + 94, 174, 38, isCompleted ? 0.2 : 0.28)
  layer.addChild(shadow)

  const shelter = new Graphics()

  drawGroundClaim(shelter, x, y, progress)

  drawPixelWallBlock(shelter, x, y + 8, 135, 102, {
    outer: 0x3f2b1f,
    main: isCompleted ? 0x806044 : 0x725038,
    light: isCompleted ? 0xa27a55 : 0x906948,
    dark: 0x2f2118,
  })

  drawRoof(shelter, x - 10, y - 16, 155, 34)
  drawWoodStrips(shelter, x + 12, y + 22, 111)
  drawDarkInterior(shelter, x + 22, y + 30, 90, 62)
  drawLifeCapsuleFocus(shelter, x + 39, y + 37)
  drawIncubatorWindow(shelter, x + 44, y + 47)
  drawCapsuleGlow(shelter, x + 45, y + 45, stability)
  drawCornerPosts(shelter, x, y + 8, 135, 102)
  drawShelterLifeSignals(shelter, x, y, progress, stability)
  drawGrowthAddons(shelter, x, y, progress, isCompleted)

  layer.addChild(shelter)
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function drawGroundClaim(graphic: Graphics, x: number, y: number, progress: number) {
  const alpha = 0.12 + progress / 500

  graphic.rect(x - 26, y + 104, 184, 12).fill({
    color: 0xb89763,
    alpha,
  })

  if (progress >= 35) {
    graphic.rect(x - 20, y + 116, 168, 5).fill({
      color: 0x7a5a34,
      alpha: 0.18,
    })
  }

  if (progress >= 70) {
    graphic.rect(x - 14, y + 122, 152, 4).fill({
      color: 0xd3b27a,
      alpha: 0.16,
    })
  }
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

function drawCapsuleGlow(graphic: Graphics, x: number, y: number, stability: number) {
  const stabilityAlpha = 0.08 + stability / 900

  graphic.circle(x + 20, y + 18, 28).fill({
    color: 0x86efac,
    alpha: stabilityAlpha,
  })

  graphic.circle(x + 20, y + 18, 18).fill({
    color: 0xa7f3d0,
    alpha: stabilityAlpha + 0.04,
  })

  graphic.rect(x + 4, y + 3, 32, 3).fill({
    color: 0xfde68a,
    alpha: 0.3 + stability / 350,
  })

  graphic.rect(x + 7, y + 34, 26, 2).fill({
    color: 0x86efac,
    alpha: 0.22 + stability / 500,
  })

  graphic.rect(x + 39, y + 10, 3, 20).fill({
    color: 0xa7f3d0,
    alpha: 0.18 + stability / 650,
  })
}

function drawShelterLifeSignals(
  graphic: Graphics,
  x: number,
  y: number,
  progress: number,
  stability: number
) {
  graphic.rect(x + 112, y + 20, 11, 4).fill({
    color: 0x86efac,
    alpha: 0.42 + stability / 450,
  })

  graphic.rect(x + 112, y + 29, 7, 3).fill({
    color: 0xfde68a,
    alpha: 0.32 + progress / 500,
  })

  graphic.rect(x + 14, y + 104, 108, 4).fill({
    color: 0x1f4d2b,
    alpha: 0.36 + progress / 700,
  })

  graphic.rect(x + 24, y + 111, 22, 3).fill({
    color: 0x86efac,
    alpha: 0.18 + progress / 700,
  })

  graphic.rect(x + 87, y + 111, 18, 3).fill({
    color: 0xfacc15,
    alpha: 0.16 + stability / 700,
  })
}

function drawGrowthAddons(
  graphic: Graphics,
  x: number,
  y: number,
  progress: number,
  isCompleted: boolean
) {
  if (progress >= 28) {
    graphic.rect(x - 18, y + 86, 18, 12).fill(0x5b3a22)
    graphic.rect(x - 15, y + 82, 12, 5).fill(0x8b5a2b)
  }

  if (progress >= 48) {
    graphic.rect(x + 136, y + 64, 26, 10).fill(0x7a4a24)
    graphic.rect(x + 140, y + 57, 18, 8).fill(0xb66a35)
    graphic.rect(x + 142, y + 72, 4, 20).fill(0x3f2416)
    graphic.rect(x + 154, y + 72, 4, 20).fill(0x3f2416)
  }

  if (progress >= 68) {
    graphic.rect(x - 24, y + 18, 20, 4).fill({ color: 0xfacc15, alpha: 0.58 })
    graphic.rect(x - 22, y + 26, 14, 3).fill({ color: 0x86efac, alpha: 0.45 })
  }

  if (isCompleted || progress >= 90) {
    graphic.rect(x + 9, y - 22, 116, 4).fill({ color: 0xfde68a, alpha: 0.28 })
    graphic.rect(x + 130, y + 25, 4, 72).fill({ color: 0xa7f3d0, alpha: 0.18 })
  }
}
