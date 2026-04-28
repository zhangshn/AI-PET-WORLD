/**
 * 当前文件负责：渲染世界地图地块的程序化像素细节。
 */

import { Graphics } from "pixi.js"

import {
  getStageTileVisual,
  STAGE_VISUAL_CONFIG,
} from "../../config/stage-visual-config"
import { createPointSeed } from "../../shared/stage-renderer-utils"
import type { TileContext } from "./tile-types"

export function drawTileDetail(graphic: Graphics, context: TileContext) {
  const { type } = context

  if (type === "short_grass") {
    drawShortGrassDetail(graphic, context)
    return
  }

  if (type === "wild_grass") {
    drawWildGrassDetail(graphic, context)
    return
  }

  if (type === "flower_patch") {
    drawFlowerPatchDetail(graphic, context)
    return
  }

  if (type === "forest_edge") {
    drawForestEdgeDetail(graphic, context)
    return
  }

  if (type === "stone") {
    drawStoneDetail(graphic, context)
    return
  }

  if (type === "mud") {
    drawMudDetail(graphic, context)
  }
}

function drawShortGrassDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 18, 3, 4).fill(visual.detail)
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 15, y + 12, 2, 5).fill(visual.dark)
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 19, y + 20, 2, 3).fill({
      color: visual.light,
      alpha: 0.42,
    })
  }
}

function drawWildGrassDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x + 4, y + 13, 4, 9).fill(visual.detail)

  if (seed % 2 === 0) {
    graphic.rect(x + 11, y + 9, 3, 11).fill(visual.light)
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 18, y + 14, 3, 8).fill(visual.detail)
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 7, y + 7, 2, 4).fill(visual.light)
  }
}

function drawFlowerPatchDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x + 6, y + 16, 3, 4).fill(visual.dark)
  graphic.rect(x + 7, y + 7, 3, 3).fill(visual.detail)

  if (seed % 2 === 0) {
    graphic.rect(x + 14, y + 10, 3, 3).fill(
      STAGE_VISUAL_CONFIG.actor.petDefault.cloth
    )
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 17, y + 16, 3, 3).fill(
      STAGE_VISUAL_CONFIG.entity.flower.blossoms[1]
    )
  }
}

function drawForestEdgeDetail(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, type } = context
  const visual = getStageTileVisual(type)
  const treeVisual = STAGE_VISUAL_CONFIG.entity.tree
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x + 8, y + 15, 6, 9).fill(treeVisual.trunk)
  graphic.rect(x + 4, y + 10, 16, 12).fill(visual.detail)
  graphic.rect(x + 1, y + 5, 22, 10).fill(visual.light)

  if (seed % 2 === 0) {
    graphic.rect(x + 5, y + 2, 14, 7).fill(visual.light)
  }

  graphic.rect(x + 4, y + 20, 16, 3).fill({
    color: visual.edge,
    alpha: 0.22,
  })
}

function drawStoneDetail(graphic: Graphics, context: TileContext) {
  const { x, y, type } = context
  const visual = getStageTileVisual(type)

  graphic.rect(x + 5, y + 15, 14, 4).fill({
    color: visual.edge,
    alpha: 0.2,
  })
  graphic.rect(x + 6, y + 9, 12, 9).fill(visual.detail)
  graphic.rect(x + 8, y + 7, 9, 4).fill(visual.light)
  graphic.rect(x + 10, y + 17, 8, 2).fill(visual.dark)
}

function drawMudDetail(graphic: Graphics, context: TileContext) {
  const { x, y, type } = context
  const visual = getStageTileVisual(type)

  graphic.rect(x + 5, y + 9, 12, 3).fill(visual.detail)
  graphic.rect(x + 11, y + 17, 8, 2).fill(visual.detail)
  graphic.rect(x + 2, y + 21, 16, 2).fill({
    color: visual.dark,
    alpha: 0.35,
  })
}