/**
 * 当前文件负责：把 worldRuntime 中的自然实体渲染到 Pixi 舞台层。
 */

import { Container, Graphics } from "pixi.js"

import type { WorldRuntimeEntity } from "@/world/runtime/entity-runtime"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import type {
  RuntimeVisualState,
  StageVisualRegistry,
} from "./stage-renderer-types"

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
  const seed = getEntitySeed(entity.id)
  const heightOffset = seed % 3
  const crownShift = (seed % 5) - 2

  drawEntityShadow(graphic, 0, 18, 30, 10, 0.22)

  graphic.rect(-5, 4, 10, 20).fill(0x6b3f24)
  graphic.rect(-3, 4, 4, 20).fill({
    color: 0x9a6336,
    alpha: 0.38,
  })
  graphic.rect(2, 8, 3, 14).fill({
    color: 0x3f2416,
    alpha: 0.28,
  })

  graphic.rect(-14 + crownShift, -13 - heightOffset, 28, 20).fill(0x245f2e)
  graphic.rect(-18 + crownShift, -5 - heightOffset, 34, 18).fill(0x2f7d32)
  graphic.rect(-12 + crownShift, -20 - heightOffset, 24, 16).fill(0x3f9f46)
  graphic.rect(-4 + crownShift, -9 - heightOffset, 22, 18).fill(0x4fa84a)

  graphic.rect(-10 + crownShift, -18 - heightOffset, 9, 4).fill({
    color: 0x7ccf63,
    alpha: 0.45,
  })
  graphic.rect(4 + crownShift, -6 - heightOffset, 9, 4).fill({
    color: 0x86d76a,
    alpha: 0.36,
  })

  if (tileSize >= 24) {
    graphic.rect(-17 + crownShift, 8 - heightOffset, 34, 4).fill({
      color: 0x1f4f25,
      alpha: 0.18,
    })
  }
}

function drawFlowerEntity(graphic: Graphics, entity: WorldRuntimeEntity) {
  const seed = getEntitySeed(entity.id)
  const blossomColor = getFlowerColor(seed)

  drawEntityShadow(graphic, 0, 10, 12, 4, 0.12)

  graphic.rect(-1, 0, 2, 13).fill(0x25743a)
  graphic.rect(-5, 5, 5, 3).fill(0x3f9f4a)
  graphic.rect(1, 3, 5, 3).fill(0x4fbf5a)

  graphic.rect(-3, -4, 6, 6).fill(blossomColor)
  graphic.rect(-6, -1, 4, 4).fill(lightenColor(blossomColor, 18))
  graphic.rect(2, -1, 4, 4).fill(lightenColor(blossomColor, 12))
  graphic.rect(-1, -7, 3, 4).fill(lightenColor(blossomColor, 25))
  graphic.rect(-1, -1, 3, 3).fill(0xfff3a3)
}

function drawWaterEntity(
  graphic: Graphics,
  entity: WorldRuntimeEntity,
  tileSize: number
) {
  const seed = getEntitySeed(entity.id)
  const radius = tileSize * 0.34

  drawEntityShadow(graphic, 0, 8, 24, 7, 0.1)

  graphic.circle(0, 0, radius).fill({
    color: 0x38bdf8,
    alpha: 0.38,
  })

  graphic.circle(0, 0, radius * 0.75).fill({
    color: 0x7dd3fc,
    alpha: 0.28,
  })

  graphic.rect(-10, -3, 20, 2).fill({
    color: 0xe0f2fe,
    alpha: 0.62,
  })

  if (seed % 2 === 0) {
    graphic.rect(-7, 5, 14, 2).fill({
      color: 0xbae6fd,
      alpha: 0.5,
    })
  }

  if (seed % 3 === 0) {
    graphic.rect(-3, -10, 9, 2).fill({
      color: 0xffffff,
      alpha: 0.32,
    })
  }
}

function drawButterflyEntity(graphic: Graphics, entity: WorldRuntimeEntity) {
  const seed = getEntitySeed(entity.id)
  const wingColor = seed % 2 === 0 ? 0xfacc15 : 0xf472b6
  const wingLight = seed % 2 === 0 ? 0xfef08a : 0xfbcfe8

  drawEntityShadow(graphic, 0, 8, 12, 4, 0.08)

  graphic.rect(-1, -5, 2, 12).fill(0x1f2937)
  graphic.rect(-2, 6, 4, 2).fill(0x1f2937)

  graphic.rect(-9, -5, 8, 8).fill(wingColor)
  graphic.rect(1, -5, 8, 8).fill(lightenColor(wingColor, 8))
  graphic.rect(-8, 3, 6, 6).fill(wingLight)
  graphic.rect(2, 3, 6, 6).fill(wingLight)

  graphic.rect(-7, -3, 3, 2).fill({
    color: 0xffffff,
    alpha: 0.42,
  })

  graphic.rect(4, -3, 3, 2).fill({
    color: 0xffffff,
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
    color: 0x000000,
    alpha,
  })
}

function getFlowerColor(seed: number): number {
  const options = [
    0xf472b6,
    0xfb7185,
    0xfacc15,
    0xa78bfa,
    0x86efac,
  ]

  return options[seed % options.length]
}

function getEntitySeed(entityId: string): number {
  let seed = 0

  for (let index = 0; index < entityId.length; index += 1) {
    seed += entityId.charCodeAt(index) * (index + 7)
  }

  return Math.abs(seed)
}

function lightenColor(color: number, amount: number): number {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255

  const nextR = clampNumber(r + amount, 0, 255)
  const nextG = clampNumber(g + amount, 0, 255)
  const nextB = clampNumber(b + amount, 0, 255)

  return (nextR << 16) + (nextG << 8) + nextB
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}