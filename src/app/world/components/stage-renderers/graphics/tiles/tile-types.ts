/**
 * 当前文件负责：定义世界地块渲染相关类型。
 */

import type { Graphics } from "pixi.js"

import type { WorldMapState, WorldMapTileType } from "@/world/map/world-map"

export type DrawWorldTilesInput = {
  terrainLayer: {
    addChild: (child: Graphics) => void
  }
  detailLayer: {
    addChild: (child: Graphics) => void
  }
  map: WorldMapState | null
}

export type TileContext = {
  map: WorldMapState
  type: WorldMapTileType
  x: number
  y: number
  tileX: number
  tileY: number
  tileSize: number
}