"use client"

/**
 * 当前文件负责：渲染地表点缀 decal 层。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import { HomeMapPlacementSprite } from "../HomeMapPlacementSprite"
import { RENDER_LAYER_Z_INDEX } from "../home-map-render-styles"

export type DecalLayerProps = {
  placements: MapPlacement[]
  tileSize: number
  width: number
  height: number
}

export function DecalLayer({
  placements,
  tileSize,
  width,
  height,
}: DecalLayerProps) {
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
        zIndex: RENDER_LAYER_Z_INDEX.decal,
      }}
    >
      {placements.map((placement) => (
        <HomeMapPlacementSprite
          key={placement.id}
          placement={placement}
          pixelOffset={getStableDecalOffset(placement.id)}
          renderMode="decal"
          tileSize={tileSize}
        />
      ))}
    </div>
  )
}

function getStableDecalOffset(id: string): { x: number; y: number } {
  return {
    x: getStableRangeValue(`${id}:x`, -5, 5),
    y: getStableRangeValue(`${id}:y`, -4, 4),
  }
}

function getStableRangeValue(seed: string, min: number, max: number): number {
  const range = max - min + 1

  return min + (hashString(seed) % range)
}

function hashString(value: string): number {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0
  }, 2166136261)
}
