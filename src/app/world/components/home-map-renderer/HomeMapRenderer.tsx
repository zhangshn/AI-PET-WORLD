/**
 * 当前文件负责：按 HomeMapState 渲染低保真初始家园。
 */

import type { CSSProperties } from "react"

import { buildHomeMapRenderModel } from "@/world/rendering/home-map-render-model"
import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import {
  WORLD_MAP_ASSETS,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"

import styles from "./home-map-renderer.styles.module.css"

const VIEW_TILE_SIZE = 14
const ASSET_REFERENCE_TILE_SIZE = 32

export function HomeMapRenderer(input: { homeMapState: HomeMapState }) {
  const renderModel = buildHomeMapRenderModel(input.homeMapState)
  const orderedPlacements = [...renderModel.allPlacements].sort(
    sortPlacementsForRender
  )

  return (
    <section className={styles.rendererPanel}>
      <div className={styles.rendererHeader}>
        <div>
          <div className={styles.eyebrow}>HOME MAP RENDERER / UI-06</div>
          <h2>初始家园</h2>
          <p>
            Renderer 只读取 HomeMapState 的 placements。地面、道路、设施、建筑、自然物和角色都来自数据层。
          </p>
        </div>
        <div className={styles.rendererMeta}>
          <span>placements: {renderModel.debugInfo.placementCount}</span>
          <span>zones: {renderModel.debugInfo.zoneCount}</span>
        </div>
      </div>

      <div className={styles.viewport}>
        <div
          className={styles.mapCanvas}
          style={{
            width: renderModel.mapSize.columns * VIEW_TILE_SIZE,
            height: renderModel.mapSize.rows * VIEW_TILE_SIZE,
          }}
        >
          {input.homeMapState.zones.map((zone) => (
            <div
              aria-label={zone.name}
              className={styles.zoneAura}
              data-zone={zone.type}
              key={zone.id}
              style={{
                left: zone.bounds.x * VIEW_TILE_SIZE,
                top: zone.bounds.y * VIEW_TILE_SIZE,
                width: zone.bounds.width * VIEW_TILE_SIZE,
                height: zone.bounds.height * VIEW_TILE_SIZE,
              }}
              title={`${zone.name}：${zone.purpose}`}
            />
          ))}

          {orderedPlacements.map((placement) => (
            <PlacementSprite key={placement.id} placement={placement} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PlacementSprite(input: { placement: MapPlacement }) {
  const asset = WORLD_MAP_ASSETS[input.placement.assetId]
  const size = Math.max(
    5,
    Math.round(
      VIEW_TILE_SIZE *
        (asset.baseSize / ASSET_REFERENCE_TILE_SIZE) *
        input.placement.scale
    )
  )

  const style: CSSProperties = {
    left: input.placement.x * VIEW_TILE_SIZE,
    top: input.placement.y * VIEW_TILE_SIZE,
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
      className={styles.sprite}
      data-layer={input.placement.layer}
      data-asset={input.placement.assetId}
      style={style}
      title={`${input.placement.label} / ${input.placement.assetId}`}
    />
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

function buildAnchorTransform(anchor: (typeof WORLD_MAP_ASSETS)[WorldMapAssetId]["anchor"]): string {
  if (anchor === "bottom-center") return "translate(-50%, -100%)"
  if (anchor === "center") return "translate(-50%, -50%)"

  return "none"
}
