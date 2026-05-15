/**
 * 当前文件负责：定义 MVP 初始家园地图图层的坐标摆放结构。
 */

import type { WorldMapAssetId } from "../../../map-assets/world-map-asset-registry"

export type InitialHomeTileCoordinate = {
  x: number
  y: number
}

export type InitialHomeSpritePlacement = InitialHomeTileCoordinate & {
  id: string
  assetId: WorldMapAssetId
  label: string
  scale: number
  layer: number
  alpha?: number
}

export type InitialHomeLayoutLayer = {
  id: string
  name: string
  placements: InitialHomeSpritePlacement[]
}

export type InitialHomePathLayer = {
  id: string
  name: string
  tiles: InitialHomeTileCoordinate[]
}
