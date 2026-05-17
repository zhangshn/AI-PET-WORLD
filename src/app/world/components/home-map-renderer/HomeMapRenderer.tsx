/**
 * 当前文件负责：按 HomeMapState 渲染低保真初始家园。
 */

import type { CSSProperties } from "react"

import { buildHomeMapRenderModel } from "@/world/rendering/home-map-render-model"
import type {
  HomeMapState,
  HomeZoneType,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import { WORLD_MAP_ASSETS } from "@/world/map-assets/world-map-asset-registry"
import type { WorldMapAssetAnchor } from "@/world/map-assets/world-map-asset-schema"

import styles from "./home-map-renderer.styles.module.css"

const VIEW_TILE_SIZE = 18
const ASSET_REFERENCE_TILE_SIZE = 32
const VIEWPORT_PADDING_TILES = 5

export function HomeMapRenderer(input: { homeMapState: HomeMapState }) {
  const renderModel = buildHomeMapRenderModel(input.homeMapState)
  const viewport = buildActiveViewport(input.homeMapState)
  const visiblePlacements = renderModel.allPlacements
    .filter((placement) => isPlacementInsideViewport(placement, viewport))
    .filter((placement) => placement.layer !== "atmosphere")
    .sort(sortPlacementsForRender)

  return (
    <section className={styles.rendererPanel}>
      <div className={styles.rendererHeader}>
        <div>
          <div className={styles.eyebrow}>HOME MAP RENDERER / UI-06</div>
          <h2>初始家园</h2>
          <p>
            这里按 HomeMapState 的区域、地面、道路、承托、建筑、设施、自然物和角色绘制第一幕家园。
          </p>
        </div>
        <div className={styles.rendererMeta}>
          <span>placements: {renderModel.debugInfo.placementCount}</span>
          <span>visible: {visiblePlacements.length}</span>
        </div>
      </div>

      <div className={styles.viewport}>
        <div
          className={styles.mapCanvas}
          style={{
            width: viewport.columns * VIEW_TILE_SIZE,
            height: viewport.rows * VIEW_TILE_SIZE,
          }}
        >
          {input.homeMapState.zones
            .filter((zone) => zone.type !== "visual_center")
            .filter((zone) => isZoneInsideViewport(zone.bounds, viewport))
            .map((zone) => (
              <div
                aria-label={zone.name}
                className={styles.zonePad}
                data-zone={zone.type}
                key={zone.id}
                style={buildZonePadStyle(zone, viewport)}
                title={`${zone.name}：${zone.purpose}`}
              />
            ))}

          {visiblePlacements.map((placement) => (
            <PlacementLayerItem
              key={placement.id}
              placement={placement}
              viewport={viewport}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function PlacementLayerItem(input: {
  placement: MapPlacement
  viewport: HomeMapViewport
}) {
  if (input.placement.layer === "zone") return null

  if (input.placement.layer === "ground") {
    return <TerrainCell placement={input.placement} viewport={input.viewport} />
  }

  if (input.placement.layer === "path") {
    return <PathCell placement={input.placement} viewport={input.viewport} />
  }

  if (input.placement.layer === "edge") {
    return <EdgeCell placement={input.placement} viewport={input.viewport} />
  }

  return <ObjectSprite placement={input.placement} viewport={input.viewport} />
}

function TerrainCell(input: {
  placement: MapPlacement
  viewport: HomeMapViewport
}) {
  return (
    <span
      aria-hidden="true"
      className={styles.terrainCell}
      data-asset={input.placement.assetId}
      style={buildTileStyle(input.placement, input.viewport, 1)}
    />
  )
}

function PathCell(input: { placement: MapPlacement; viewport: HomeMapViewport }) {
  return (
    <span
      aria-label={input.placement.label}
      className={styles.pathCell}
      data-asset={input.placement.assetId}
      style={buildPathStyle(input.placement, input.viewport)}
      title={`${input.placement.label} / ${input.placement.assetId}`}
    />
  )
}

function EdgeCell(input: { placement: MapPlacement; viewport: HomeMapViewport }) {
  return (
    <span
      aria-hidden="true"
      className={styles.edgeCell}
      data-asset={input.placement.assetId}
      style={buildTileStyle(input.placement, input.viewport, 3)}
    />
  )
}

function ObjectSprite(input: {
  placement: MapPlacement
  viewport: HomeMapViewport
}) {
  const asset = WORLD_MAP_ASSETS[input.placement.assetId]
  const size = Math.max(
    6,
    Math.round(
      VIEW_TILE_SIZE *
        (asset.baseSize / ASSET_REFERENCE_TILE_SIZE) *
        input.placement.scale
    )
  )

  const style: CSSProperties = {
    left: (input.placement.x - input.viewport.originX) * VIEW_TILE_SIZE,
    top: (input.placement.y - input.viewport.originY) * VIEW_TILE_SIZE,
    width: size,
    height: size,
    opacity: input.placement.alpha,
    zIndex: buildPlacementZIndex(input.placement),
    backgroundImage: `url(${asset.path})`,
    transform: buildAnchorTransform(asset.anchor),
  }

  return (
    <span
      aria-label={input.placement.label}
      className={styles.objectSprite}
      data-layer={input.placement.layer}
      data-asset={input.placement.assetId}
      style={style}
      title={`${input.placement.label} / ${input.placement.assetId}`}
    />
  )
}

type HomeMapViewport = {
  originX: number
  originY: number
  columns: number
  rows: number
}

type HomeMapBounds = {
  x: number
  y: number
  width: number
  height: number
}

function buildActiveViewport(homeMapState: HomeMapState): HomeMapViewport {
  const visualCenterZone = homeMapState.zones.find(
    (zone) => zone.type === "visual_center"
  )

  if (visualCenterZone) {
    return buildViewportFromBounds(homeMapState, visualCenterZone.bounds)
  }

  const activePlacements = homeMapState.placements.filter(
    (placement) =>
      placement.layer !== "ground" &&
      placement.layer !== "atmosphere" &&
      placement.layer !== "edge"
  )

  if (activePlacements.length === 0) {
    return {
      originX: 0,
      originY: 0,
      columns: homeMapState.mapSize.columns,
      rows: homeMapState.mapSize.rows,
    }
  }

  const minX = Math.min(...activePlacements.map((placement) => placement.x))
  const minY = Math.min(...activePlacements.map((placement) => placement.y))
  const maxX = Math.max(...activePlacements.map((placement) => placement.x))
  const maxY = Math.max(...activePlacements.map((placement) => placement.y))

  return buildViewportFromBounds(homeMapState, {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  })
}

function buildViewportFromBounds(
  homeMapState: HomeMapState,
  bounds: HomeMapBounds
): HomeMapViewport {
  const originX = Math.max(0, bounds.x - VIEWPORT_PADDING_TILES)
  const originY = Math.max(0, bounds.y - VIEWPORT_PADDING_TILES)
  const endX = Math.min(
    homeMapState.mapSize.columns,
    bounds.x + bounds.width + VIEWPORT_PADDING_TILES
  )
  const endY = Math.min(
    homeMapState.mapSize.rows,
    bounds.y + bounds.height + VIEWPORT_PADDING_TILES
  )

  return {
    originX,
    originY,
    columns: Math.max(1, endX - originX),
    rows: Math.max(1, endY - originY),
  }
}

function buildZonePadStyle(
  zone: { type: HomeZoneType; bounds: HomeMapBounds },
  viewport: HomeMapViewport
): CSSProperties {
  return {
    left: (zone.bounds.x - viewport.originX) * VIEW_TILE_SIZE,
    top: (zone.bounds.y - viewport.originY) * VIEW_TILE_SIZE,
    width: zone.bounds.width * VIEW_TILE_SIZE,
    height: zone.bounds.height * VIEW_TILE_SIZE,
    zIndex: buildZoneZIndex(zone.type),
  }
}

function buildTileStyle(
  placement: MapPlacement,
  viewport: HomeMapViewport,
  zIndex: number
): CSSProperties {
  return {
    left: (placement.x - viewport.originX) * VIEW_TILE_SIZE,
    top: (placement.y - viewport.originY) * VIEW_TILE_SIZE,
    width: VIEW_TILE_SIZE + 1,
    height: VIEW_TILE_SIZE + 1,
    opacity: placement.alpha,
    zIndex,
  }
}

function buildPathStyle(
  placement: MapPlacement,
  viewport: HomeMapViewport
): CSSProperties {
  const baseLeft = (placement.x - viewport.originX) * VIEW_TILE_SIZE
  const baseTop = (placement.y - viewport.originY) * VIEW_TILE_SIZE
  const isHorizontal = placement.assetId === "pathDirtHorizontal01"
  const isVertical = placement.assetId === "pathDirtVertical01"

  return {
    left: baseLeft + (isVertical ? 4 : -2),
    top: baseTop + (isHorizontal ? 4 : -2),
    width: isVertical ? VIEW_TILE_SIZE - 8 : VIEW_TILE_SIZE + 5,
    height: isHorizontal ? VIEW_TILE_SIZE - 8 : VIEW_TILE_SIZE + 5,
    opacity: placement.alpha,
    zIndex: buildPlacementZIndex(placement),
  }
}

function isPlacementInsideViewport(
  placement: MapPlacement,
  viewport: HomeMapViewport
): boolean {
  return (
    placement.x >= viewport.originX &&
    placement.y >= viewport.originY &&
    placement.x < viewport.originX + viewport.columns &&
    placement.y < viewport.originY + viewport.rows
  )
}

function isZoneInsideViewport(
  bounds: HomeMapBounds,
  viewport: HomeMapViewport
): boolean {
  return (
    bounds.x + bounds.width >= viewport.originX &&
    bounds.y + bounds.height >= viewport.originY &&
    bounds.x < viewport.originX + viewport.columns &&
    bounds.y < viewport.originY + viewport.rows
  )
}

function sortPlacementsForRender(left: MapPlacement, right: MapPlacement): number {
  return buildPlacementZIndex(left) - buildPlacementZIndex(right)
}

function buildPlacementZIndex(placement: MapPlacement): number {
  return buildLayerOrder(placement.layer) * 100_000 + placement.y * 100 + placement.x
}

function buildLayerOrder(layer: MapPlacement["layer"]): number {
  if (layer === "ground") return 1
  if (layer === "path") return 2
  if (layer === "edge") return 3
  if (layer === "zone") return 4
  if (layer === "nature") return 5
  if (layer === "surface-decoration") return 6
  if (layer === "structure") return 7
  if (layer === "facility") return 8
  if (layer === "actor") return 9
  if (layer === "atmosphere") return 10

  return 0
}

function buildZoneZIndex(zoneType: HomeZoneType): number {
  if (zoneType === "natural_boundary") return 15_000
  if (zoneType === "pet_arrival") return 35_000
  if (zoneType === "initial_care") return 35_000
  if (zoneType === "temporary_shelter") return 35_000
  if (zoneType === "pet_rest") return 35_000

  return 25_000
}

function buildAnchorTransform(anchor: WorldMapAssetAnchor): string {
  if (anchor === "bottom-center") return "translate(-50%, -100%)"
  if (anchor === "center") return "translate(-50%, -50%)"

  return "none"
}
