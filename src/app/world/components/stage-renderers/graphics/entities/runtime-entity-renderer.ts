/**
 * 当前文件负责：把 worldRuntime 中的自然实体渲染到 Pixi 舞台层。
 */

import { Container, Graphics } from "pixi.js"

import type { WorldRuntimeEntity } from "@/world/runtime/entity-runtime"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import { createStringSeed, lightenColor } from "../../shared/stage-renderer-utils"
import type {
  RuntimeVisualState,
  StageVisualRegistry,
} from "../../shared/stage-renderer-types"

export type RuntimeEntityVisualState = RuntimeVisualState & {
  entityType: string
}

export type RuntimeEntityVisualRegistry =
  StageVisualRegistry<RuntimeEntityVisualState>

export type SyncRuntimeEntitiesInput = {
  layer: Container
  runtime: WorldRuntimeState | null
  visuals: RuntimeEntityVisualRegistry
}

export function createRuntimeEntityVisualRegistry(): RuntimeEntityVisualRegistry {
  return new Map<string, RuntimeEntityVisualState>()
}

export function syncRuntimeEntityVisuals(input: SyncRuntimeEntitiesInput) {
  const runtime = input.runtime
  const map = runtime?.map

  if (!runtime || !map) return

  const tileSize = map.tileSize
  const renderableEntities = getRenderableRuntimeEntities(runtime.entities.entities)
  const activeIds = new Set(renderableEntities.map((entity) => entity.id))

  for (const [entityId, visual] of input.visuals.entries()) {
    if (!activeIds.has(entityId)) {
      visual.container.destroy({ children: true })
      input.visuals.delete(entityId)
    }
  }

  for (const entity of renderableEntities) {
    const x = entity.position.x * tileSize + tileSize / 2
    const y = entity.position.y * tileSize + tileSize / 2
    const existing = input.visuals.get(entity.id)

    if (existing) {
      if (existing.container.parent !== input.layer) {
        input.layer.addChild(existing.container)
      }

      existing.container.x = x
      existing.container.y = y
      drawRuntimeEntityGraphic(existing.graphic, entity, tileSize)
      continue
    }

    const visual = createRuntimeEntityVisual(entity, tileSize)

    visual.container.x = x
    visual.container.y = y

    input.layer.addChild(visual.container)
    input.visuals.set(entity.id, visual)
  }
}

export function clearRuntimeEntityVisuals(
  visuals: RuntimeEntityVisualRegistry
) {
  for (const visual of visuals.values()) {
    visual.container.destroy({ children: true })
  }

  visuals.clear()
}

function getRenderableRuntimeEntities(
  entities: WorldRuntimeEntity[]
): WorldRuntimeEntity[] {
  return entities.filter((entity) => {
    if (!entity.active) return false

    return (
      entity.type === "tree" ||
      entity.type === "flower" ||
      entity.type === "water" ||
      entity.type === "butterfly"
    )
  })
}

function createRuntimeEntityVisual(
  entity: WorldRuntimeEntity,
  tileSize: number
): RuntimeEntityVisualState {
  const container = new Container()
  const graphic = new Graphics()

  drawRuntimeEntityGraphic(graphic, entity, tileSize)

  container.addChild(graphic)

  return {
    container,
    graphic,
    entityType: entity.type,
  }
}

function drawRuntimeEntityGraphic(
  graphic: Graphics,
  entity: WorldRuntimeEntity,
  tileSize: number
) {
  graphic.clear()

  if (entity.type === "tree") {
    drawTreeEntity(graphic, entity, tileSize)
    return
  }

  if (entity.type === "flower") {
    drawFlowerEntity(graphic, entity)
    return
  }

  if (entity.type === "water") {
    drawWaterEntity(graphic, entity, tileSize)
    return
  }

  if (entity.type === "butterfly") {
    drawButterflyEntity(graphic, entity)
    return
  }

  drawEntityShadow(graphic, 0, 10, 18, 7, 0.16)
  graphic.circle(0, 0, tileSize * 0.35).fill(0xe5e7eb)
}

function drawTreeEntity(
  graphic: Graphics,
  entity: WorldRuntimeEntity,
  tileSize: number
) {
  const seed = createStringSeed(entity.id)
  const heightOffset = seed % 3
  const crownShift = (seed % 5) - 2
  const visual = STAGE_VISUAL_CONFIG.entity.tree

  drawEntityShadow(graphic, 0, 18, 30, 10, 0.22)

  graphic.rect(-5, 4, 10, 20).fill(visual.trunk)
  graphic.rect(-3, 4, 4, 20).fill({
    color: visual.trunkLight,
    alpha: 0.38,
  })
  graphic.rect(2, 8, 3, 14).fill({
    color: visual.trunkDark,
    alpha: 0.28,
  })

  graphic.rect(-14 + crownShift, -13 - heightOffset, 28, 20).fill(
    visual.crownDark
  )
  graphic.rect(-18 + crownShift, -5 - heightOffset, 34, 18).fill(
    visual.crown
  )
  graphic.rect(-12 + crownShift, -20 - heightOffset, 24, 16).fill(
    lightenColor(visual.crown, 10)
  )
  graphic.rect(-4 + crownShift, -9 - heightOffset, 22, 18).fill(
    visual.crownLight
  )

  graphic.rect(-10 + crownShift, -18 - heightOffset, 9, 4).fill({
    color: lightenColor(visual.highlight, 4),
    alpha: 0.45,
  })
  graphic.rect(4 + crownShift, -6 - heightOffset, 9, 4).fill({
    color: visual.highlight,
    alpha: 0.36,
  })

  if (tileSize >= STAGE_VISUAL_CONFIG.tileSizeFallback) {
    graphic.rect(-17 + crownShift, 8 - heightOffset, 34, 4).fill({
      color: visual.crownDark,
      alpha: 0.18,
    })
  }
}

function drawFlowerEntity(graphic: Graphics, entity: WorldRuntimeEntity) {
  const seed = createStringSeed(entity.id)
  const visual = STAGE_VISUAL_CONFIG.entity.flower
  const blossomColor = getFlowerColor(seed)

  drawEntityShadow(graphic, 0, 10, 12, 4, 0.12)

  graphic.rect(-1, 0, 2, 13).fill(visual.stem)
  graphic.rect(-5, 5, 5, 3).fill(visual.leaf)
  graphic.rect(1, 3, 5, 3).fill(lightenColor(visual.leaf, 8))

  graphic.rect(-3, -4, 6, 6).fill(blossomColor)
  graphic.rect(-6, -1, 4, 4).fill(lightenColor(blossomColor, 18))
  graphic.rect(2, -1, 4, 4).fill(lightenColor(blossomColor, 12))
  graphic.rect(-1, -7, 3, 4).fill(lightenColor(blossomColor, 25))
  graphic.rect(-1, -1, 3, 3).fill(visual.center)
}

function drawWaterEntity(
  graphic: Graphics,
  entity: WorldRuntimeEntity,
  tileSize: number
) {
  const seed = createStringSeed(entity.id)
  const radius = tileSize * 0.34
  const visual = STAGE_VISUAL_CONFIG.entity.water

  drawEntityShadow(graphic, 0, 8, 24, 7, 0.1)

  graphic.circle(0, 0, radius).fill({
    color: visual.base,
    alpha: 0.38,
  })

  graphic.circle(0, 0, radius * 0.75).fill({
    color: visual.light,
    alpha: 0.28,
  })

  graphic.rect(-10, -3, 20, 2).fill({
    color: visual.highlight,
    alpha: 0.62,
  })

  if (seed % 2 === 0) {
    graphic.rect(-7, 5, 14, 2).fill({
      color: visual.light,
      alpha: 0.5,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(-3, -10, 9, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.32,
    })
  }
}

function drawButterflyEntity(graphic: Graphics, entity: WorldRuntimeEntity) {
  const seed = createStringSeed(entity.id)
  const visual = STAGE_VISUAL_CONFIG.entity.butterfly
  const wingColor = visual.wings[seed % visual.wings.length]
  const wingLight = visual.wingLights[seed % visual.wingLights.length]

  drawEntityShadow(graphic, 0, 8, 12, 4, 0.08)

  graphic.rect(-1, -5, 2, 12).fill(visual.body)
  graphic.rect(-2, 6, 4, 2).fill(visual.body)

  graphic.rect(-9, -5, 8, 8).fill(wingColor)
  graphic.rect(1, -5, 8, 8).fill(lightenColor(wingColor, 8))
  graphic.rect(-8, 3, 6, 6).fill(wingLight)
  graphic.rect(2, 3, 6, 6).fill(wingLight)

  graphic.rect(-7, -3, 3, 2).fill({
    color: STAGE_VISUAL_CONFIG.highlightColor,
    alpha: 0.42,
  })

  graphic.rect(4, -3, 3, 2).fill({
    color: STAGE_VISUAL_CONFIG.highlightColor,
    alpha: 0.38,
  })
}

function drawEntityShadow(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number
) {
  graphic.ellipse(x, y, width, height).fill({
    color: STAGE_VISUAL_CONFIG.shadowColor,
    alpha,
  })
}

function getFlowerColor(seed: number): number {
  const options = STAGE_VISUAL_CONFIG.entity.flower.blossoms

  return options[seed % options.length]
}
