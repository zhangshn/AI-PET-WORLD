/**
 * 当前文件负责：渲染世界地图地块的基础底色与基础材质。
 */

import { Graphics } from "pixi.js"

import {
  getStageTileVisual,
  STAGE_VISUAL_CONFIG,
} from "../../config/stage-visual-config"
import { createPointSeed } from "../../shared/stage-renderer-utils"
import type { TileContext } from "./tile-types"
import {
  getTileColorWithVariation,
  isGrassLike,
} from "./tile-utils"

const HIGHLIGHT_ALPHA = 0.18

export function drawTileBase(graphic: Graphics, context: TileContext) {
  const { type, x, y, tileX, tileY, tileSize } = context

  graphic.rect(x, y, tileSize, tileSize).fill(
    getTileColorWithVariation(type, tileX, tileY)
  )

  if (isGrassLike(type)) {
    drawSoftGrassBase(graphic, context)
    return
  }

  if (type === "water") {
    drawWaterBase(graphic, context)
    return
  }

  if (type === "path") {
    drawPathBase(graphic, context)
    return
  }

  if (type === "town_path") {
    drawTownPathBase(graphic, context)
    return
  }

  if (type === "soil" || type === "garden_soil") {
    drawSoilBase(graphic, context)
    return
  }

  if (type === "shelter_foundation") {
    drawFoundationBase(graphic, context)
  }
}

function drawSoftGrassBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  if (seed % 3 === 0) {
    graphic.rect(x, y, tileSize, 3).fill({
      color: visual.light,
      alpha: HIGHLIGHT_ALPHA,
    })
  }

  if (seed % 4 === 0) {
    graphic.rect(x + 2, y + tileSize - 4, tileSize - 4, 2).fill({
      color: visual.dark,
      alpha: 0.12,
    })
  }

  if (type === "forest_edge") {
    graphic.rect(x, y, tileSize, tileSize).fill({
      color: visual.dark,
      alpha: 0.14,
    })
  }
}

function drawWaterBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual("water")
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, tileSize).fill({
    color: visual.dark,
    alpha: 0.18,
  })

  graphic.rect(x + 1, y + 1, tileSize - 2, 2).fill({
    color: STAGE_VISUAL_CONFIG.highlightColor,
    alpha: 0.18,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 8, tileSize - 8, 2).fill({
      color: visual.light,
      alpha: 0.42,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 7, y + 17, tileSize - 12, 2).fill({
      color: visual.detail,
      alpha: 0.34,
    })
  }

  graphic.rect(x + 1, y + tileSize - 3, tileSize - 2, 3).fill({
    color: visual.dark,
    alpha: 0.32,
  })
}

function drawPathBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual("path")
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, 3).fill({
    color: visual.detail,
    alpha: 0.3,
  })

  graphic.rect(x, y + tileSize - 3, tileSize, 3).fill({
    color: visual.dark,
    alpha: 0.12,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 8, 5, 3).fill({
      color: visual.dark,
      alpha: 0.22,
    })
  }

  if (seed % 4 === 0) {
    graphic.rect(x + 15, y + 16, 4, 3).fill({
      color: visual.dark,
      alpha: 0.18,
    })
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 10, y + 4, 8, 2).fill({
      color: visual.light,
      alpha: 0.22,
    })
  }
}

function drawTownPathBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual("town_path")
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x, y + 2, tileSize, tileSize - 4).fill({
    color: visual.base,
    alpha: 0.55,
  })

  graphic.rect(x, y, tileSize, 3).fill({
    color: visual.light,
    alpha: 0.36,
  })

  graphic.rect(x, y + tileSize - 4, tileSize, 4).fill({
    color: visual.dark,
    alpha: 0.22,
  })

  graphic.rect(x + 2, y + 6, tileSize - 4, 2).fill({
    color: visual.detail,
    alpha: 0.3,
  })

  graphic.rect(x + 2, y + tileSize - 8, tileSize - 4, 2).fill({
    color: visual.edge,
    alpha: 0.16,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 4, y + 11, 6, 3).fill({
      color: visual.dark,
      alpha: 0.18,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 14, y + 8, 7, 2).fill({
      color: visual.light,
      alpha: 0.28,
    })
  }

  if (seed % 5 === 0) {
    graphic.rect(x + 11, y + 17, 5, 3).fill({
      color: visual.detail,
      alpha: 0.24,
    })
  }

  if (tileX >= context.map.size.width - 5) {
    graphic.rect(x + tileSize - 5, y + 5, 3, tileSize - 10).fill({
      color: visual.light,
      alpha: 0.36,
    })
  }
}

function drawSoilBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize, type } = context
  const visual = getStageTileVisual(type)
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x + 2, y + 6, tileSize - 4, 2).fill({
    color: visual.dark,
    alpha: 0.28,
  })

  graphic.rect(x + 2, y + 14, tileSize - 4, 2).fill({
    color: visual.dark,
    alpha: 0.22,
  })

  graphic.rect(x + 2, y + 21, tileSize - 4, 2).fill({
    color: visual.dark,
    alpha: 0.18,
  })

  if (seed % 2 === 0) {
    graphic.rect(x + 5, y + 10, 3, 2).fill({
      color: visual.light,
      alpha: 0.24,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(x + 15, y + 18, 4, 2).fill({
      color: visual.edge,
      alpha: 0.16,
    })
  }
}

function drawFoundationBase(graphic: Graphics, context: TileContext) {
  const { x, y, tileX, tileY, tileSize } = context
  const visual = getStageTileVisual("shelter_foundation")
  const seed = createPointSeed(tileX, tileY)

  graphic.rect(x, y, tileSize, tileSize).fill({
    color: visual.dark,
    alpha: 0.08,
  })

  if (seed % 2 === 0) {
    graphic.rect(x, y, tileSize, 2).fill({
      color: visual.light,
      alpha: 0.18,
    })
  }
}