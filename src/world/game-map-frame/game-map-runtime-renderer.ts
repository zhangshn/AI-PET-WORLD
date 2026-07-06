import type { GameMapRuntimeFrame } from "./game-map-runtime-frame-schema"

export type GameMapRuntimeRenderPolygon = {
  id: string
  layer: "terrain" | "walkable" | "collision"
  kind: string
  points: string
  fill: string
  stroke: string | null
  strokeWidth: number
  opacity: number
}

export type GameMapRuntimeRenderObject = {
  id: string
  kind: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  blocksMovement: boolean
}

export type GameMapRuntimeRenderInteraction = {
  id: string
  kind: string
  x: number
  y: number
  width: number
  height: number
}

export type GameMapRuntimeRenderModel = {
  renderVersion: "game-map-runtime-render-v1"
  runtimeFrameId: string
  worldId: string
  tick: number
  viewport: {
    width: number
    height: number
    aspectRatio: "4:3"
  }
  background: string
  terrain: GameMapRuntimeRenderPolygon[]
  objects: GameMapRuntimeRenderObject[]
  walkable: GameMapRuntimeRenderPolygon[]
  collision: GameMapRuntimeRenderPolygon[]
  interactions: GameMapRuntimeRenderInteraction[]
  hud: {
    title: "AI-PET-WORLD"
    mode: "Natural Home Runtime"
  }
  tags: string[]
}

export function buildGameMapRuntimeRenderModel(
  runtimeFrame: GameMapRuntimeFrame
): GameMapRuntimeRenderModel {
  return {
    renderVersion: "game-map-runtime-render-v1",
    runtimeFrameId: runtimeFrame.runtimeFrameId,
    worldId: runtimeFrame.worldId,
    tick: runtimeFrame.tick,
    viewport: {
      width: runtimeFrame.visual.imageWidth,
      height: runtimeFrame.visual.imageHeight,
      aspectRatio: "4:3",
    },
    background: "#17231a",
    terrain: runtimeFrame.layers.terrain.map((region) => ({
      id: region.id,
      layer: "terrain",
      kind: region.kind,
      points: toSvgPoints(region.polygon),
      fill: terrainFill(region.kind),
      stroke: null,
      strokeWidth: 0,
      opacity: region.kind === "path_ground" ? 0.9 : 0.78,
    })),
    objects: runtimeFrame.layers.objects.map((object) => ({
      id: object.id,
      kind: object.kind,
      x: object.footprint.x,
      y: object.footprint.y,
      width: object.footprint.width,
      height: object.footprint.height,
      fill: objectFill(object.kind),
      stroke: "rgba(235, 248, 218, 0.22)",
      blocksMovement: object.blocksMovement,
    })),
    walkable: runtimeFrame.layers.walkable.map((region) => ({
      id: region.id,
      layer: "walkable",
      kind: region.kind,
      points: toSvgPoints(region.polygon),
      fill: "transparent",
      stroke: "rgba(246, 218, 128, 0.34)",
      strokeWidth: 2,
      opacity: 1,
    })),
    collision: runtimeFrame.layers.collision.map((region) => ({
      id: region.id,
      layer: "collision",
      kind: region.kind,
      points: toSvgPoints(region.polygon),
      fill: "rgba(12, 28, 20, 0.42)",
      stroke: "rgba(186, 230, 168, 0.2)",
      strokeWidth: 1,
      opacity: 1,
    })),
    interactions: runtimeFrame.layers.interactions.map((item) => ({
      id: item.id,
      kind: item.kind,
      x: item.bounds.x,
      y: item.bounds.y,
      width: item.bounds.width,
      height: item.bounds.height,
    })),
    hud: {
      title: "AI-PET-WORLD",
      mode: "Natural Home Runtime",
    },
    tags: [
      "game_map_runtime_render_model",
      "rendered_from_runtime_frame_layers",
      "mvp_game_frontend_render_ready",
      "world_page_runtime_layers_only",
      "not_single_training_image",
    ],
  }
}

function toSvgPoints(points: Array<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ")
}

function terrainFill(kind: string): string {
  if (kind === "water") return "#2b7f91"
  if (kind === "shoreline") return "#7a8d65"
  if (kind === "path_ground") return "#b8874f"
  if (kind === "natural_boundary") return "#1f4b31"
  return "#5f9a57"
}

function objectFill(kind: string): string {
  if (kind === "tree") return "rgba(32, 94, 53, 0.86)"
  if (kind === "rock") return "rgba(126, 136, 126, 0.82)"
  if (kind === "shrub") return "rgba(44, 120, 63, 0.76)"
  if (kind === "flower_patch") return "rgba(216, 214, 126, 0.72)"
  return "rgba(137, 176, 95, 0.58)"
}
