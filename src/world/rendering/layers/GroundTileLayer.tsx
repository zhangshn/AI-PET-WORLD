"use client"

/**
 * 当前文件负责：渲染地表 tilemap 层。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import { HomeMapPlacementSprite } from "../HomeMapPlacementSprite"
import { RENDER_LAYER_Z_INDEX } from "../home-map-render-styles"

export type GroundTileLayerProps = {
  placements: MapPlacement[]
  tileSize: number
  width: number
  height: number
}

export function GroundTileLayer({
  placements,
  tileSize,
  width,
  height,
}: GroundTileLayerProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        left: 0,
        pointerEvents: "none",
        position: "absolute",
        top: 0,
        width,
        zIndex: RENDER_LAYER_Z_INDEX.groundTilemap,
      }}
    >
      {placements.map((placement) => (
        <HomeMapPlacementSprite
          key={placement.id}
          placement={placement}
          renderMode="tile"
          tileSize={tileSize}
        />
      ))}
    </div>
  )
}
