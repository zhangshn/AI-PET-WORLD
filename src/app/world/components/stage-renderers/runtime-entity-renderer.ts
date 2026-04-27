/**
 * 当前文件负责：把 worldRuntime 中的自然实体渲染到 Pixi 舞台层。
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js"

import type { WorldRuntimeEntity } from "@/world/runtime/entity-runtime"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import type {
  RuntimeVisualState,
  StageVisualRegistry,
} from "./stage-renderer-types"

export type RuntimeEntityVisualState = RuntimeVisualState & {
  label: Text
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
      existing.label.text = entity.name
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
  const label = new Text({
    text: entity.name,
    style: new TextStyle({
      fill: 0xe2e8f0,
      fontSize: 10,
    }),
  })

  label.x = -18
  label.y = -24
  label.visible = false

  drawRuntimeEntityGraphic(graphic, entity, tileSize)

  container.addChild(graphic)
  container.addChild(label)

  return {
    container,
    graphic,
    label,
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
    drawTreeEntity(graphic, tileSize)
    return
  }

  if (entity.type === "flower") {
    drawFlowerEntity(graphic)
    return
  }

  if (entity.type === "water") {
    drawWaterEntity(graphic, tileSize)
    return
  }

  if (entity.type === "butterfly") {
    drawButterflyEntity(graphic)
    return
  }

  graphic.circle(0, 0, tileSize * 0.35).fill(0xe5e7eb)
}

function drawTreeEntity(graphic: Graphics, tileSize: number) {
  graphic.rect(-4, 6, 8, 16).fill(0x7a4b2a)
  graphic.circle(0, -4, tileSize * 0.58).fill(0x2f7d32)
  graphic.circle(-8, 2, tileSize * 0.42).fill(0x3f9f46)
  graphic.circle(8, 4, tileSize * 0.42).fill(0x4ade80)
}

function drawFlowerEntity(graphic: Graphics) {
  graphic.rect(-2, 2, 4, 12).fill(0x15803d)
  graphic.circle(0, 0, 5).fill(0xf472b6)
  graphic.circle(-5, 0, 3).fill(0xf9a8d4)
  graphic.circle(5, 0, 3).fill(0xf9a8d4)
  graphic.circle(0, -5, 3).fill(0xfbcfe8)
  graphic.circle(0, 5, 3).fill(0xfbcfe8)
}

function drawWaterEntity(graphic: Graphics, tileSize: number) {
  graphic.circle(0, 0, tileSize * 0.42).fill({
    color: 0x38bdf8,
    alpha: 0.62,
  })

  graphic.rect(-8, -2, 16, 3).fill({
    color: 0xbae6fd,
    alpha: 0.76,
  })

  graphic.rect(-5, 6, 12, 2).fill({
    color: 0xe0f2fe,
    alpha: 0.62,
  })
}

function drawButterflyEntity(graphic: Graphics) {
  graphic.circle(-5, 0, 5).fill(0xfacc15)
  graphic.circle(5, 0, 5).fill(0xfbbf24)
  graphic.rect(-1, -5, 2, 10).fill(0x1f2937)
  graphic.rect(-2, 6, 4, 2).fill(0x1f2937)
}