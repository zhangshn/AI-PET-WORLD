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
    canvas.style.width = `${input.model.canvas.width}px`
    canvas.style.height = `${input.model.canvas.height}px`
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.imageSmoothingEnabled = false

    drawWorldCanvas(context, input.model)
  }, [input.model])

  return (
    <canvas
      ref={canvasRef}
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
    context.fillStyle = "rgba(255, 255, 255, 0.06)"
    context.fillRect(tile.x, tile.y, tile.width, 2)
    context.fillStyle = "rgba(36, 72, 40, 0.12)"
    context.fillRect(tile.x, tile.y + tile.height - 2, tile.width, 2)

    if (!tile.passable) {
      context.fillStyle = "rgba(35, 55, 38, 0.26)"
      context.fillRect(tile.x, tile.y, tile.width, tile.height)
    }
  })
}

function drawTraceLayer(
  context: CanvasRenderingContext2D,
  traces: WorldViewTrace[]
) {
  traces.forEach((trace) => {
    const size = trace.radius * 2
    const x = trace.x - trace.radius
    const y = trace.y - trace.radius
    context.globalAlpha = trace.opacity
    context.fillStyle = resolveTraceColor(trace)
    context.fillRect(x, y, size, Math.max(6, size * 0.42))
    context.fillStyle = "rgba(255, 255, 255, 0.08)"
    context.fillRect(x + 4, y + 4, Math.max(4, size - 8), 4)
    context.globalAlpha = 1
  })
}

function drawObjectLayer(
  context: CanvasRenderingContext2D,
  objects: WorldViewObject[]
) {
  const orderedObjects = [...objects].sort(
    (left, right) => layerOrder(left.layer) - layerOrder(right.layer)
  )

  orderedObjects.forEach((object) => {
    const scale = Math.max(0.6, object.scale)
    const x = object.x
    const y = object.y
    context.globalAlpha = object.opacity

    if (object.kind === "tree") {
      drawTree(context, x, y, scale)
    } else if (object.kind === "bush") {
      drawBush(context, x, y, scale)
    } else if (object.kind === "stone") {
      drawStone(context, x, y, scale)
    } else if (object.kind === "flower") {
      drawFlower(context, x, y, scale)
    } else if (object.kind === "mushroom") {
      drawMushroom(context, x, y, scale)
    } else if (object.kind === "insect_signal") {
      drawInsectSignal(context, x, y, scale)
    } else {
      drawStructure(context, x, y, scale)
    }

    context.globalAlpha = 1
  })
}

function drawSpriteLayer(
  context: CanvasRenderingContext2D,
  actors: WorldViewActor[]
) {
  actors
    .filter((actor) => actor.visible)
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
  context.globalAlpha = model.atmosphere.opacity
  context.fillStyle = resolveAtmosphereOverlay(model.atmosphere.weather)
  context.fillRect(0, 0, model.canvas.width, model.canvas.height)
  context.globalAlpha = 1
}

function drawTree(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 10 * scale
  context.fillStyle = "#744f2f"
  context.fillRect(x - unit * 0.22, y - unit * 0.9, unit * 0.44, unit * 0.9)
  context.fillStyle = "#3f743d"
  context.fillRect(x - unit * 0.9, y - unit * 1.75, unit * 1.8, unit * 1.1)
  context.fillStyle = "#65a657"
  context.fillRect(x - unit * 0.55, y - unit * 1.95, unit * 1.1, unit * 0.7)
}

function drawBush(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 9 * scale
  context.fillStyle = "#477c3e"
  context.fillRect(x - unit, y - unit, unit * 2, unit)
  context.fillStyle = "#65a657"
  context.fillRect(x - unit * 0.45, y - unit * 1.35, unit, unit)
}

function drawStone(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 8 * scale
  context.fillStyle = "#747c78"
  context.fillRect(x - unit, y - unit, unit * 1.8, unit)
  context.fillStyle = "#a4aaa4"
  context.fillRect(x - unit * 0.4, y - unit * 1.25, unit, unit * 0.5)
}

function drawFlower(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 5 * scale
  context.fillStyle = "#5d994c"
  context.fillRect(x - unit * 0.2, y - unit * 1.2, unit * 0.4, unit * 1.2)
  context.fillStyle = "#d87d86"
  context.fillRect(x - unit, y - unit * 1.8, unit * 2, unit)
  context.fillStyle = "#ead66b"
  context.fillRect(x - unit * 0.35, y - unit * 1.65, unit * 0.7, unit * 0.7)
}

function drawMushroom(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 6 * scale
  context.fillStyle = "#f1d9bc"
  context.fillRect(x - unit * 0.25, y - unit, unit * 0.5, unit)
  context.fillStyle = "#c75f5f"
  context.fillRect(x - unit, y - unit * 1.55, unit * 2, unit * 0.8)
}

function drawInsectSignal(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 4 * scale
  context.fillStyle = "#263321"
  context.fillRect(x - unit, y - unit, unit, unit)
  context.fillRect(x + unit, y - unit * 0.5, unit, unit)
  context.fillStyle = "#f5df6e"
  context.fillRect(x, y - unit * 2, unit, unit)
}

function drawStructure(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 12 * scale
  context.fillStyle = "#8d6844"
  context.fillRect(x - unit, y - unit, unit * 2, unit)
  context.fillStyle = "#b98c5a"
  context.fillRect(x - unit * 0.8, y - unit * 1.55, unit * 1.6, unit * 0.8)
}

function drawButler(context: CanvasRenderingContext2D, actor: WorldViewActor) {
  const x = actor.x
  const y = actor.y
  context.fillStyle = "rgba(30, 42, 70, 0.22)"
  context.fillRect(x - 10, y - 2, 20, 5)
  context.fillStyle = "#f1d6b0"
  context.fillRect(x - 5, y - 30, 10, 10)
  context.fillStyle = "#5368b2"
  context.fillRect(x - 7, y - 19, 14, 18)
  context.fillStyle = "#e8f0df"
  context.fillRect(x + 2, y - 12, 8, 10)
  context.fillStyle = actor.pose === "maintain" ? "#788c52" : "#79592e"
  context.fillRect(x + 9, y - 16, 4, 13)
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
