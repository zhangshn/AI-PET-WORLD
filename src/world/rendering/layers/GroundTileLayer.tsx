"use client"

/**
 * 当前文件负责：作为地表 Canvas tilemap 层入口。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import type { CanvasAssetRegistryLike } from "../canvas/canvas-asset-cache"
import { GroundCanvasLayer } from "./GroundCanvasLayer"

export type GroundTileLayerProps = {
  mapSize: {
    columns: number
    rows: number
  }
  tileSize: number
  placements: readonly MapPlacement[]
  assetRegistry: CanvasAssetRegistryLike
  revisionKey: string
}

export function GroundTileLayer({
  assetRegistry,
  mapSize,
  placements,
  revisionKey,
  tileSize,
}: GroundTileLayerProps) {
  return (
    <GroundCanvasLayer
      assetRegistry={assetRegistry}
      groundPlacements={placements}
      mapSize={mapSize}
      revisionKey={revisionKey}
      tileSize={tileSize}
    />
  )
}
