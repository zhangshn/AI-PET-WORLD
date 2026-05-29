// 该文件用于把 WorldViewModel tiles 转换成正式地面层绘制指令。

import type { WorldViewTile } from "@/world/world-view-model/world-view-model-schema"

import type { FormalPixelTileLayer, FormalPixelTileRenderItem } from "./formal-pixel-renderer-schema"

export function buildFormalTileLayer(tiles: WorldViewTile[]): FormalPixelTileLayer {
  return {
    kind: "tile",
    items: tiles.map(toTileRenderItem),
    tags: [
      "formal_pixel_tile_layer",
      "source_world_view_model_tiles",
      "read_only_render_model",
    ],
  }
}

function toTileRenderItem(tile: WorldViewTile): FormalPixelTileRenderItem {
  return {
    id: tile.id,
    layerKind: "tile",
    x: tile.x,
    y: tile.y,
    width: tile.width,
    height: tile.height,
    kind: tile.kind,
    variant: tile.variant,
    passable: tile.passable,
    traceIntensity: tile.traceIntensity,
    drawOrder: buildTileDrawOrder(tile),
    tags: buildTileTags(tile),
  }
}

function buildTileDrawOrder(tile: WorldViewTile): number {
  const boundaryOffset = tile.kind === "boundary" ? 50 : 0
  return 1_000 + tile.y + boundaryOffset
}

function buildTileTags(tile: WorldViewTile): string[] {
  const tags = [
    "formal_pixel_tile",
    `tile_kind_${tile.kind}`,
    tile.passable ? "passable" : "blocked",
  ]

  if (tile.traceIntensity > 0) tags.push("trace_sensitive_tile")
  if (tile.kind === "boundary") tags.push("world_boundary_visual")

  return tags
}
