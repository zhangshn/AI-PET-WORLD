"use client"

/**
 * 当前文件负责：渲染建筑、设施和自然实体层。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import { HomeMapPlacementSprite } from "../HomeMapPlacementSprite"
import { RENDER_LAYER_Z_INDEX } from "../home-map-render-styles"

export type EntityLayerProps = {
  placements: MapPlacement[]
  tileSize: number
  width: number
  height: number
}

export function EntityLayer({
  placements,
  tileSize,
  width,
  height,
}: EntityLayerProps) {
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
        zIndex: RENDER_LAYER_Z_INDEX.entity,
      }}
    >
      {placements.map((placement) => (
        <HomeMapPlacementSprite
          key={placement.id}
          placement={placement}
          renderMode="entity"
          tileSize={tileSize}
        />
      ))}
    </div>
  )
}
