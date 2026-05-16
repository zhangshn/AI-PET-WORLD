/**
 * 当前文件负责：定义地表 Canvas 渲染契约。
 */

import type {
  HomeMapSize,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

export interface GroundCanvasCell {
  tileX: number
  tileY: number
  ground?: MapPlacement
  support?: MapPlacement
  path?: MapPlacement
  edge?: MapPlacement
  decals: MapPlacement[]
}

export interface GroundCanvasLayerInput {
  mapSize: HomeMapSize
  tileSize: number
  matrix: GroundCanvasCell[][]
  placements: {
    ground: MapPlacement[]
    support: MapPlacement[]
    path: MapPlacement[]
    edge: MapPlacement[]
    decals: MapPlacement[]
  }
  dirtyKey: string
}
