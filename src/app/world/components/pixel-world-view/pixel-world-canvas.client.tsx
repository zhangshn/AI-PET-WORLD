"use client"

import { useEffect, useRef } from "react"

import type {
  WorldViewActor,
  WorldViewModel,
  WorldViewObject,
  WorldViewTile,
  WorldViewTrace,
} from "@/world/world-view-model"

import styles from "./pixel-world-view.module.css"

export function PixelWorldCanvas(input: { model: WorldViewModel }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")

    if (!canvas || !context) return

    const ratio = window.devicePixelRatio || 1
    canvas.width = input.model.canvas.width * ratio
    canvas.height = input.model.canvas.height * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.imageSmoothingEnabled = false

    drawWorldCanvas(context, input.model)
  }, [input.model])

  return (
    <canvas
      ref={canvasRef}
      width={input.model.canvas.width}
      height={input.model.canvas.height}
      className={styles.pixelWorldCanvas}
      aria-label="pixel world canvas tile layer trace layer object layer sprite layer atmosphere layer"
      role="img"
    />
  )
}

function drawWorldCanvas(context: CanvasRenderingContext2D, model: WorldViewModel) {
  context.clearRect(0, 0, model.canvas.width, model.canvas.height)
  context.fillStyle = resolveAtmosphereBase(model.atmosphere.mood)
  context.fillRect(0, 0, model.canvas.width, model.canvas.height)
  drawTileLayer(context, model.tiles)
  drawTraceLayer(context, model.traces)
  drawObjectLayer(context, model.objects)
  drawSpriteLayer(context, model.actors)
  drawAtmosphereLayer(context, model)
}

function drawTileLayer(
  context: CanvasRenderingContext2D,
  tiles: WorldViewTile[]
) {
  tiles.forEach((tile) => {
    context.fillStyle = resolveTileColor(tile)
    context.fillRect(tile.x, tile.y, tile.width, tile.height)
    drawTileVariation(context, tile)
    drawTileTraceSurface(context, tile)

    if (!tile.passable) {
      context.fillStyle = "rgba(28, 42, 31, 0.3)"
      context.fillRect(tile.x, tile.y, tile.width, tile.height)
      context.fillStyle = "rgba(255, 255, 255, 0.08)"
      context.fillRect(tile.x + 3, tile.y + 3, tile.width - 6, 2)
    }
  })
}

function drawTraceLayer(
  context: CanvasRenderingContext2D,
  traces: WorldViewTrace[]
) {
  const orderedTraces = [...traces].sort(
    (left, right) => traceLayerOrder(left.layer) - traceLayerOrder(right.layer)
  )

  orderedTraces.forEach((trace) => {
    if (trace.layer === "attention") {
      drawAttentionTrace(context, trace)
      return
    }

    if (trace.layer === "ground") {
      drawGroundTrace(context, trace)
      return
    }

    drawSurfaceTrace(context, trace)
  })
}

function drawGroundTrace(context: CanvasRenderingContext2D, trace: WorldViewTrace) {
  const size = Math.max(8, trace.radius * 2)
  const x = trace.x - trace.radius
  const y = trace.y - trace.radius
  const block = Math.max(3, Math.round(size / 9))

  context.save()
  context.globalAlpha = trace.opacity
  context.fillStyle = resolveTraceColor(trace)

  for (let index = 0; index < 12; index += 1) {
    const offsetX = deterministicOffset(`${trace.id}:ground:x:${index}`, size)
    const offsetY = deterministicOffset(`${trace.id}:ground:y:${index}`, size * 0.62)
    context.fillRect(
      x + offsetX,
      y + offsetY,
      block + (index % 4) * 2,
      Math.max(2, block * 0.8)
    )
  }

  context.fillStyle = "rgba(255, 255, 255, 0.07)"
  context.fillRect(x + block, y + block, Math.max(4, size - block * 2), 2)
  context.restore()
}

function drawSurfaceTrace(context: CanvasRenderingContext2D, trace: WorldViewTrace) {
  const radius = Math.max(6, trace.radius)
  const block = Math.max(3, Math.round(radius / 4))

  context.save()
  context.globalAlpha = trace.opacity
  context.fillStyle = resolveTraceColor(trace)

  for (let index = 0; index < 7; index += 1) {
    const offsetX = deterministicOffset(`${trace.id}:surface:x:${index}`, radius * 2) - radius
    const offsetY = deterministicOffset(`${trace.id}:surface:y:${index}`, radius) - radius * 0.45
    context.fillRect(trace.x + offsetX, trace.y + offsetY, block, block)
  }

  context.restore()
}

function drawAttentionTrace(context: CanvasRenderingContext2D, trace: WorldViewTrace) {
  const radius = Math.max(10, trace.radius)

  context.save()
  context.globalAlpha = Math.min(0.52, trace.opacity + 0.12)
  context.fillStyle = resolveTraceColor(trace)
  context.fillRect(trace.x - radius * 0.55, trace.y - 2, radius * 1.1, 4)
  context.fillRect(trace.x - 2, trace.y - radius * 0.45, 4, radius * 0.9)
  context.globalAlpha = Math.min(0.28, trace.opacity)
  context.fillRect(trace.x - radius, trace.y - radius, radius * 2, radius * 2)
  context.restore()
}

function drawObjectLayer(
  context: CanvasRenderingContext2D,
  objects: WorldViewObject[]
) {
  const orderedObjects = [...objects].sort((left, right) => {
    if (layerOrder(left.layer) !== layerOrder(right.layer)) {
      return layerOrder(left.layer) - layerOrder(right.layer)
    }

    return left.y - right.y
  })

  orderedObjects.forEach((object) => {
    const scale = Math.max(0.44, object.scale)
    const x = object.x
    const y = object.y

    context.save()
    context.globalAlpha = object.opacity
    drawObjectAnchor(context, object)

    if (object.kind === "tree") {
      drawTree(context, object, x, y, scale)
    } else if (object.kind === "bush") {
      drawBush(context, object, x, y, scale)
    } else if (object.kind === "stone") {
      drawStone(context, object, x, y, scale)
    } else if (object.kind === "flower") {
      drawFlower(context, object, x, y, scale)
    } else if (object.kind === "mushroom") {
      drawMushroom(context, object, x, y, scale)
    } else if (object.kind === "insect_signal") {
      drawInsectSignal(context, object, x, y, scale)
    } else {
      drawStructure(context, object, x, y, scale)
    }

    context.restore()
  })
}

function drawSpriteLayer(
  context: CanvasRenderingContext2D,
  actors: WorldViewActor[]
) {
  actors
    .filter((actor) => actor.visible)
    .sort((left, right) => left.y - right.y)
    .forEach((actor) => {
      if (actor.kind === "butler") {
        drawButler(context, actor)
      } else {
        drawPet(context, actor)
      }
    })
}

function drawAtmosphereLayer(
  context: CanvasRenderingContext2D,
  model: WorldViewModel
) {
  context.save()
  context.globalAlpha = model.atmosphere.opacity
  context.fillStyle = resolveAtmosphereOverlay(model.atmosphere.weather)
  context.fillRect(0, 0, model.canvas.width, model.canvas.height)
  context.globalAlpha = Math.min(0.18, model.atmosphere.opacity)
  context.fillStyle = "rgba(255, 255, 255, 0.1)"
  for (let y = 0; y < model.canvas.height; y += 48) {
    context.fillRect(0, y, model.canvas.width, 1)
  }
  context.restore()
}

function drawObjectAnchor(context: CanvasRenderingContext2D, object: WorldViewObject) {
  const width = object.source === "world_fact" ? 18 : 12
  const alpha = object.source === "world_fact" ? 0.18 : 0.1

  context.fillStyle = `rgba(25, 38, 25, ${alpha})`
  context.fillRect(object.x - width / 2, object.y - 2, width, 4)
}

function drawTree(
  context: CanvasRenderingContext2D,
  object: WorldViewObject,
  x: number,
  y: number,
  scale: number
) {
  const healthRate = object.health / 100
  const stageScale = object.growthStage === "old" ? 1.08 : object.growthStage === "young" ? 0.82 : 1
  const unit = 10 * scale * stageScale
  const crownHeight = unit * (0.86 + healthRate * 0.42)

  context.fillStyle = "rgba(38, 58, 36, 0.2)"
  context.fillRect(x - unit * 0.9, y - unit * 0.18, unit * 1.9, unit * 0.28)
  context.fillStyle = object.growthStage === "old" ? "#6b5137" : "#744f2f"
  context.fillRect(x - unit * 0.22, y - unit * 0.9, unit * 0.44, unit * 0.9)
  context.fillStyle = healthRate < 0.48 ? "#506a38" : "#3f743d"
  context.fillRect(x - unit * 0.9, y - unit * 1.75, unit * 1.8, crownHeight)

  if (healthRate > 0.56) {
    context.fillStyle = "#65a657"
    context.fillRect(x - unit * 0.55, y - unit * 1.95, unit * 1.1, unit * 0.7)
  }

  if (object.growthStage === "declining") {
    context.fillStyle = "rgba(114, 86, 52, 0.52)"
    context.fillRect(x - unit * 0.75, y - unit * 1.3, unit * 0.38, unit * 0.36)
  } else {
    context.fillStyle = "#2f5f33"
    context.fillRect(x - unit * 1.05, y - unit * 1.25, unit * 0.45, unit * 0.42)
  }
}

function drawBush(
  context: CanvasRenderingContext2D,
  object: WorldViewObject,
  x: number,
  y: number,
  scale: number
) {
  const unit = 9 * scale
  const healthy = object.health >= 58
  context.fillStyle = healthy ? "#477c3e" : "#647044"
  context.fillRect(x - unit, y - unit, unit * 2, unit)
  context.fillStyle = healthy ? "#65a657" : "#7b854f"
  context.fillRect(x - unit * 0.45, y - unit * 1.35, unit, unit)

  if (object.source === "world_fact") {
    context.fillStyle = "rgba(255, 255, 255, 0.1)"
    context.fillRect(x - unit * 0.7, y - unit * 1.18, unit * 0.44, 3)
  }
}

function drawStone(
  context: CanvasRenderingContext2D,
  object: WorldViewObject,
  x: number,
  y: number,
  scale: number
) {
  const unit = 8 * scale
  context.fillStyle = object.source === "world_fact" ? "#68716f" : "#747c78"
  context.fillRect(x - unit, y - unit, unit * 1.8, unit)
  context.fillStyle = "#a4aaa4"
  context.fillRect(x - unit * 0.4, y - unit * 1.25, unit, unit * 0.5)
}

function drawFlower(
  context: CanvasRenderingContext2D,
  object: WorldViewObject,
  x: number,
  y: number,
  scale: number
) {
  const unit = 5 * scale
  const bloomScale = object.health > 70 ? 1.12 : 0.86
  context.fillStyle = "#5d994c"
  context.fillRect(x - unit * 0.2, y - unit * 1.2, unit * 0.4, unit * 1.2)
  context.fillStyle = object.health > 62 ? "#d87d86" : "#b78271"
  context.fillRect(x - unit * bloomScale, y - unit * 1.8, unit * 2 * bloomScale, unit)
  context.fillStyle = "#ead66b"
  context.fillRect(x - unit * 0.35, y - unit * 1.65, unit * 0.7, unit * 0.7)
}

function drawMushroom(
  context: CanvasRenderingContext2D,
  object: WorldViewObject,
  x: number,
  y: number,
  scale: number
) {
  const unit = 6 * scale
  context.fillStyle = object.health > 62 ? "#f1d9bc" : "#d7c0a6"
  context.fillRect(x - unit * 0.25, y - unit, unit * 0.5, unit)
  context.fillStyle = object.health > 62 ? "#c75f5f" : "#9e6761"
  context.fillRect(x - unit, y - unit * 1.55, unit * 2, unit * 0.8)
  context.fillStyle = "rgba(255, 255, 255, 0.32)"
  context.fillRect(x - unit * 0.45, y - unit * 1.42, unit * 0.32, unit * 0.18)
}

function drawInsectSignal(
  context: CanvasRenderingContext2D,
  object: WorldViewObject,
  x: number,
  y: number,
  scale: number
) {
  const unit = 4 * scale
  context.fillStyle = "#263321"
  context.fillRect(x - unit, y - unit, unit, unit)
  context.fillRect(x + unit, y - unit * 0.5, unit, unit)
  context.fillStyle = object.health > 64 ? "#f5df6e" : "#d1c46c"
  context.fillRect(x, y - unit * 2, unit, unit)
}

function drawStructure(
  context: CanvasRenderingContext2D,
  object: WorldViewObject,
  x: number,
  y: number,
  scale: number
) {
  const unit = 12 * scale
  context.fillStyle = object.kind === "facility" ? "#7b735e" : "#8d6844"
  context.fillRect(x - unit, y - unit, unit * 2, unit)
  context.fillStyle = object.kind === "facility" ? "#aaa078" : "#b98c5a"
  context.fillRect(x - unit * 0.8, y - unit * 1.55, unit * 1.6, unit * 0.8)
  if (object.source === "world_fact") {
    context.fillStyle = "rgba(255, 255, 255, 0.12)"
    context.fillRect(x - unit * 0.55, y - unit * 1.42, unit * 0.5, 3)
  }
}

function drawButler(context: CanvasRenderingContext2D, actor: WorldViewActor) {
  const x = actor.x
  const y = actor.y
  context.save()
  context.fillStyle = "rgba(30, 42, 70, 0.22)"
  context.fillRect(x - 10, y - 2, 20, 5)
  context.fillStyle = "#f1d6b0"
  context.fillRect(x - 5, y - 30, 10, 10)
  context.fillStyle = actor.pose === "observe" ? "#4f6fa8" : "#5368b2"
  context.fillRect(x - 7, y - 19, 14, 18)
  context.fillStyle = "#e8f0df"
  context.fillRect(x + 2, y - 12, 8, 10)
  context.fillStyle = actor.pose === "maintain" ? "#788c52" : "#79592e"
  context.fillRect(x + 9, y - 16, 4, 13)

  if (actor.pose === "wait") {
    context.fillStyle = "rgba(255, 255, 255, 0.22)"
    context.fillRect(x - 11, y - 36, 3, 3)
    context.fillRect(x - 15, y - 41, 3, 3)
  }

  context.restore()
}

function drawPet(context: CanvasRenderingContext2D, actor: WorldViewActor) {
  const x = actor.x
  const y = actor.y
  context.fillStyle = "#b78555"
  context.fillRect(x - 9, y - 12, 18, 10)
  context.fillRect(x + 5, y - 18, 8, 8)
}

function resolveTileColor(tile: WorldViewTile): string {
  if (tile.kind === "pressed_grass") return "#72aa59"
  if (tile.kind === "worn_grass") return "#91a45d"
  if (tile.kind === "exposed_soil") return "#a07042"
  if (tile.kind === "ecology_transition") return "#8cad59"
  if (tile.kind === "recovery_growth") return "#91c96a"
  if (tile.kind === "soil") return "#a07042"
  if (tile.kind === "built") return "#b28f62"
  if (tile.kind === "boundary") return "#4f6a49"

  return tile.traceIntensity > 48 ? "#76af5e" : "#7dbd68"
}

function drawTileVariation(context: CanvasRenderingContext2D, tile: WorldViewTile) {
  const inset = 3 + (tile.variant % 3)
  const bright = tile.variant % 2 === 0

  context.fillStyle = bright
    ? "rgba(255, 255, 255, 0.055)"
    : "rgba(32, 72, 38, 0.07)"
  context.fillRect(
    tile.x + inset,
    tile.y + ((tile.variant * 5) % Math.max(1, tile.height - 5)),
    Math.max(4, tile.width * 0.32),
    3
  )

  if (tile.kind === "boundary") {
    context.fillStyle = "rgba(26, 44, 30, 0.28)"
    for (let offset = 0; offset < tile.width; offset += 8) {
      context.fillRect(tile.x + offset, tile.y, 4, tile.height)
    }
  }
}

function drawTileTraceSurface(
  context: CanvasRenderingContext2D,
  tile: WorldViewTile
) {
  if (tile.traceIntensity <= 0) return

  const alpha = Math.min(0.28, 0.05 + tile.traceIntensity / 420)
  context.fillStyle = `rgba(64, 92, 45, ${alpha})`

  if (tile.kind === "pressed_grass" || tile.kind === "worn_grass") {
    context.fillRect(tile.x + 4, tile.y + tile.height * 0.52, tile.width - 8, 3)
  }

  if (tile.kind === "exposed_soil") {
    for (let index = 0; index < 3; index += 1) {
      const x = tile.x + deterministicOffset(`${tile.id}:soil:x:${index}`, tile.width - 5)
      const y = tile.y + deterministicOffset(`${tile.id}:soil:y:${index}`, tile.height - 5)
      context.fillRect(x, y, 4, 3)
    }
  }

  if (tile.kind === "ecology_transition" || tile.kind === "recovery_growth") {
    context.fillStyle = `rgba(222, 238, 142, ${alpha})`
    context.fillRect(tile.x + 5, tile.y + 5, Math.max(5, tile.width * 0.35), 3)
  }
}

function resolveTraceColor(trace: WorldViewTrace): string {
  if (trace.visualKind === "exposed_soil") return "#895f3a"
  if (trace.visualKind === "worn_ground") return "#81693f"
  if (trace.visualKind === "moss") return "#407c42"
  if (trace.visualKind === "mushroom") return "#caa47d"
  if (trace.visualKind === "repaired_ground") return "#b4ce76"
  if (trace.visualKind === "maintained_area") return "#b9d37c"
  if (trace.visualKind === "faded_area") return "#c8c198"
  if (trace.visualKind === "waiting_spot") return "#889fc0"
  if (trace.visualKind === "comfort_spot") return "#ddb876"
  if (trace.visualKind === "attention_glow") return "#ffdf72"

  return "#679147"
}

function resolveAtmosphereBase(mood: WorldViewModel["atmosphere"]["mood"]): string {
  if (mood === "warm") return "#82b967"
  if (mood === "recovering") return "#78a969"
  if (mood === "busy") return "#86a95f"

  return "#7caf5d"
}

function resolveAtmosphereOverlay(
  weather: WorldViewModel["atmosphere"]["weather"]
): string {
  if (weather === "damp") return "rgba(160, 190, 178, 0.24)"
  if (weather === "soft") return "rgba(255, 246, 190, 0.18)"

  return "rgba(255, 250, 210, 0.12)"
}

function layerOrder(layer: WorldViewObject["layer"]): number {
  if (layer === "back") return 1
  if (layer === "front") return 3

  return 2
}

function traceLayerOrder(layer: WorldViewTrace["layer"]): number {
  if (layer === "ground") return 1
  if (layer === "attention") return 3

  return 2
}

function deterministicOffset(seed: string, range: number): number {
  return deterministicHash(seed) % Math.max(1, Math.round(range))
}

function deterministicHash(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0)
}
