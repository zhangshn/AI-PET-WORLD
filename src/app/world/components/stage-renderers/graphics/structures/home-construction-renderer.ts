/**
 * 当前文件负责：渲染家园中正在建设的正式住所结构。
 */

import { Container, Graphics } from "pixi.js"

import type { HomeState } from "@/types/home"

import {
  HOME_CONSTRUCTION_STAGE_POSITION,
  type StagePoint,
} from "./structure-types"
import { drawSoftShadow } from "./structure-shape-utils"

export function drawHomeConstruction(
  layer: Container,
  position?: StagePoint,
  home?: HomeState | null
) {
  const { x, y } = position ?? HOME_CONSTRUCTION_STAGE_POSITION
  const stage = home?.constructionStage ?? "foundation"
  const progress = clampPercent(home?.progress ?? 0)
  const comfort = clampPercent(home?.comfort ?? 0)
  const stability = clampPercent(home?.stability ?? 40)

  const shadow = new Graphics()
  drawSoftShadow(shadow, x - 20, y + 88, 196, 34, 0.14 + stability / 900)
  layer.addChild(shadow)

  const construction = new Graphics()

  drawFoundation(construction, x, y + 64, progress, stage)

  if (isAtLeast(stage, "frame")) {
    drawWoodFrame(construction, x + 14, y + 18, stability, stage)
  }

  if (isAtLeast(stage, "roof")) {
    drawHalfRoof(construction, x + 8, y + 2, stage)
  }

  if (isAtLeast(stage, "interior")) {
    drawInteriorWarmth(construction, x + 26, y + 42, comfort)
  }

  if (stage === "garden" || stage === "completed") {
    drawCompletedHomeDetails(construction, x, y, comfort, stability)
  }

  drawWorkBench(construction, x + 96, y + 76, stage)
  drawToolCrate(construction, x + 18, y + 86, progress)
  drawConstructionMarker(construction, x + 126, y + 42, stage)

  layer.addChild(construction)
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

type OrderedHomeStage = "foundation" | "frame" | "roof" | "interior" | "garden" | "completed"

const stageOrder: OrderedHomeStage[] = [
  "foundation",
  "frame",
  "roof",
  "interior",
  "garden",
  "completed",
]

function normalizeStage(stage: HomeState["constructionStage"]): OrderedHomeStage {
  if (stage === "temporary_shelter") return "foundation"
  return stage
}

function isAtLeast(stage: HomeState["constructionStage"], target: OrderedHomeStage): boolean {
  return stageOrder.indexOf(normalizeStage(stage)) >= stageOrder.indexOf(target)
}

function drawFoundation(
  graphic: Graphics,
  x: number,
  y: number,
  progress: number,
  stage: HomeState["constructionStage"]
) {
  const width = stage === "foundation" ? 86 + Math.floor(progress * 0.72) : 158

  graphic.rect(x, y, width, 44).fill({
    color: 0x8b7355,
    alpha: 0.78,
  })

  graphic.rect(x + 8, y + 8, Math.max(42, width - 16), 24).fill({
    color: 0xa18a68,
    alpha: 0.5,
  })

  graphic.rect(x, y + 39, width, 5).fill({
    color: 0x4a3324,
    alpha: 0.32,
  })

  const blockCount = Math.max(3, Math.floor(width / 30))
  for (let index = 0; index < blockCount; index += 1) {
    graphic.rect(x + 12 + index * 28, y + 12, 16, 4).fill({
      color: 0x6b4b36,
      alpha: index % 2 === 0 ? 0.24 : 0.14,
    })
  }

  if (stage === "foundation") {
    graphic.rect(x + width + 8, y + 7, 22, 6).fill({
      color: 0xb66a35,
      alpha: 0.72,
    })
    graphic.rect(x + width + 4, y + 20, 18, 5).fill({
      color: 0x7a4a24,
      alpha: 0.68,
    })
  }
}

function drawWoodFrame(
  graphic: Graphics,
  x: number,
  y: number,
  stability: number,
  stage: HomeState["constructionStage"]
) {
  const wood = 0x7a4a24
  const darkWood = 0x3f2416
  const lightWood = 0xb66a35
  const frameAlpha = stage === "frame" ? 0.82 : 1

  graphic.rect(x, y + 46, 124, 8).fill({ color: darkWood, alpha: frameAlpha })
  graphic.rect(x + 4, y + 4, 8, 88).fill({ color: wood, alpha: frameAlpha })
  graphic.rect(x + 56, y, 8, 92).fill({ color: wood, alpha: frameAlpha })
  graphic.rect(x + 112, y + 10, 8, 82).fill({ color: wood, alpha: frameAlpha })

  graphic.rect(x + 4, y + 18, 116, 7).fill({ color: lightWood, alpha: frameAlpha })
  graphic.rect(x + 4, y + 52, 116, 7).fill({ color: wood, alpha: frameAlpha })

  graphic.rect(x + 16, y + 30, 48, 5).fill({
    color: darkWood,
    alpha: 0.32,
  })

  graphic.rect(x + 70, y + 64, 36, 5).fill({
    color: darkWood,
    alpha: 0.28,
  })

  graphic.rect(x + 16, y + 78, 30, 6).fill(lightWood)

  if (stage === "frame") {
    graphic.rect(x + 126, y + 22, 18, 6).fill({ color: 0xfacc15, alpha: 0.72 })
    graphic.rect(x + 132, y + 28, 5, 34).fill({ color: 0x64748b, alpha: 0.78 })
  }

  if (stability >= 70) {
    graphic.rect(x + 8, y + 10, 108, 3).fill({ color: 0xfde68a, alpha: 0.18 })
  }
}

function drawHalfRoof(graphic: Graphics, x: number, y: number, stage: HomeState["constructionStage"]) {
  const roofAlpha = stage === "roof" ? 0.82 : 0.96

  graphic.rect(x, y + 20, 132, 16).fill({
    color: 0x6b3a1f,
    alpha: roofAlpha,
  })

  graphic.rect(x + 10, y + 10, 112, 12).fill({ color: 0x8b4d2a, alpha: roofAlpha })

  graphic.rect(x + 22, y + 4, 76, 8).fill({
    color: 0xb66a35,
    alpha: roofAlpha,
  })

  for (let index = 0; index < 5; index += 1) {
    graphic.rect(x + 12 + index * 23, y + 25, 14, 4).fill({
      color: 0x3f2416,
      alpha: 0.3,
    })
  }

  graphic.rect(x + 104, y + 2, 20, 5).fill({
    color: 0xfacc15,
    alpha: stage === "roof" ? 0.75 : 0.36,
  })
}

function drawInteriorWarmth(graphic: Graphics, x: number, y: number, comfort: number) {
  const alpha = 0.24 + comfort / 380

  graphic.rect(x, y, 78, 34).fill({ color: 0xfde68a, alpha })
  graphic.rect(x + 10, y + 6, 18, 18).fill({ color: 0x8b5a2b, alpha: 0.72 })
  graphic.rect(x + 42, y + 8, 20, 14).fill({ color: 0xa7f3d0, alpha: 0.28 + comfort / 500 })
}

function drawCompletedHomeDetails(
  graphic: Graphics,
  x: number,
  y: number,
  comfort: number,
  stability: number
) {
  graphic.rect(x + 16, y + 106, 128, 8).fill({ color: 0xd3b27a, alpha: 0.28 })
  graphic.rect(x - 16, y + 112, 44, 4).fill({ color: 0x86efac, alpha: 0.22 + stability / 700 })
  graphic.rect(x + 126, y + 112, 42, 4).fill({ color: 0x86efac, alpha: 0.22 + stability / 700 })

  if (comfort >= 55) {
    graphic.rect(x + 150, y + 64, 18, 16).fill({ color: 0x8b5a2b, alpha: 0.8 })
    graphic.rect(x + 153, y + 58, 12, 7).fill({ color: 0xfde68a, alpha: 0.54 })
  }
}

function drawWorkBench(graphic: Graphics, x: number, y: number, stage: HomeState["constructionStage"]) {
  const alpha = stage === "completed" ? 0.36 : 0.86

  graphic.rect(x, y, 58, 8).fill({ color: 0x6b3f1d, alpha })
  graphic.rect(x + 4, y - 9, 46, 10).fill({
    color: 0x8b5a2b,
    alpha,
  })

  graphic.rect(x + 6, y + 8, 6, 22).fill({ color: 0x3f2416, alpha })
  graphic.rect(x + 44, y + 8, 6, 22).fill({ color: 0x3f2416, alpha })

  if (stage !== "completed") {
    graphic.rect(x + 20, y - 18, 22, 5).fill(0x94a3b8)
    graphic.rect(x + 28, y - 25, 5, 12).fill(0x64748b)
  }
}

function drawToolCrate(graphic: Graphics, x: number, y: number, progress: number) {
  const alpha = progress >= 95 ? 0.35 : 0.82

  graphic.rect(x, y, 42, 24).fill({ color: 0x6b3f1d, alpha })
  graphic.rect(x + 4, y + 4, 34, 16).fill({
    color: 0x8b5a2b,
    alpha,
  })

  graphic.rect(x + 6, y + 10, 30, 3).fill({
    color: 0x3f2416,
    alpha: 0.28,
  })

  if (progress < 90) {
    graphic.rect(x + 8, y - 10, 20, 5).fill(0xfacc15)
    graphic.rect(x + 27, y - 13, 6, 12).fill(0x64748b)
  }
}

function drawConstructionMarker(graphic: Graphics, x: number, y: number, stage: HomeState["constructionStage"]) {
  if (stage === "completed") return

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
