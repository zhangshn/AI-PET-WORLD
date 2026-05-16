"use client"

/**
 * 当前文件负责：渲染路径与草泥边缘层，并预留路径 autotile。
 */

import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
import type {
  MapCoordinate,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import { HomeMapPlacementSprite } from "../HomeMapPlacementSprite"
import { RENDER_LAYER_Z_INDEX } from "../home-map-render-styles"

export type PathAutotileLayerProps = {
  pathPlacements: MapPlacement[]
  edgePlacements: MapPlacement[]
  tileSize: number
  width: number
  height: number
}

export function PathAutotileLayer({
  pathPlacements,
  edgePlacements,
  tileSize,
  width,
  height,
}: PathAutotileLayerProps) {
  const pathSet = createPathSet(pathPlacements)

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
        zIndex: RENDER_LAYER_Z_INDEX.pathAutotile,
      }}
    >
      {pathPlacements.map((placement) => (
        <HomeMapPlacementSprite
          key={placement.id}
          placement={{
            ...placement,
            assetId: getPathAutotileAssetId(placement, pathSet),
          }}
          renderMode="tile"
          tileSize={tileSize}
        />
      ))}
      {edgePlacements.map((placement) => (
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

export function getPathAutotileAssetId(
  point: MapCoordinate & { assetId: WorldMapAssetId },
  pathSet: ReadonlySet<string>
): WorldMapAssetId {
  const north = pathSet.has(pointKey({ x: point.x, y: point.y - 1 }))
  const south = pathSet.has(pointKey({ x: point.x, y: point.y + 1 }))
  const west = pathSet.has(pointKey({ x: point.x - 1, y: point.y }))
  const east = pathSet.has(pointKey({ x: point.x + 1, y: point.y }))

  if ((east || west) && !north && !south) return "pathDirtHorizontal01"
  if ((north || south) && !east && !west) return "pathDirtVertical01"
  if (east && south && !north && !west) return "pathDirtCornerRightBottom01"
  if (east && north && !south && !west) return "pathDirtCornerRightTop01"
  if (west && south && !north && !east) return "pathDirtCornerLeftBottom01"
  if (west && north && !south && !east) return "pathDirtCornerLeftTop01"

  return point.assetId
}

function createPathSet(pathPlacements: MapPlacement[]): Set<string> {
  return new Set(pathPlacements.map(pointKey))
}

function pointKey(point: MapCoordinate): string {
  return `${point.x}:${point.y}`
}
