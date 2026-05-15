"use client"

/**
 * 当前文件负责：渲染 HomeMapRenderModel。
 */

import { WORLD_MAP_ASSETS } from "@/world/map-assets/world-map-asset-registry"
import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import { HomeMapPlacementSprite } from "./HomeMapPlacementSprite"
import type { HomeMapRenderModel } from "./home-map-render-model"
import { HOME_MAP_RENDER_STYLES } from "./home-map-render-styles"

const SHOW_DEBUG_GRID = false
const SHOW_AXIS_LABELS = false

export type HomeMapRendererProps = {
  renderModel: HomeMapRenderModel
  worldTick: number
}

export function HomeMapRenderer({
  renderModel,
  worldTick,
}: HomeMapRendererProps) {
  const tileSize = renderModel.mapSize.tileSize
  const mapWidth = renderModel.mapSize.columns * tileSize
  const mapHeight = renderModel.mapSize.rows * tileSize
  const baseGround = getBaseGroundPlacement(renderModel.allPlacements)

  return (
    <main style={HOME_MAP_RENDER_STYLES.page}>
      <section
        style={HOME_MAP_RENDER_STYLES.viewport}
        aria-label="AI-PET-WORLD 初始家园"
      >
        <div
          style={{
            ...HOME_MAP_RENDER_STYLES.mapCanvas,
            height: mapHeight,
            width: mapWidth,
          }}
        >
          <div
            style={{
              ...HOME_MAP_RENDER_STYLES.ground,
              backgroundImage: `url(${WORLD_MAP_ASSETS[baseGround.assetId].path})`,
              backgroundSize: `${tileSize}px ${tileSize}px`,
              height: mapHeight,
              width: mapWidth,
            }}
          />

          {renderModel.allPlacements
            .filter((placement) => placement.id !== baseGround.id)
            .map((placement) => (
              <HomeMapPlacementSprite
                key={placement.id}
                placement={placement}
                tileSize={tileSize}
              />
            ))}

          <div
            style={{
              ...HOME_MAP_RENDER_STYLES.dayNightAtmosphere,
              height: mapHeight,
              width: mapWidth,
            }}
          />

          {SHOW_DEBUG_GRID ? (
            <div
              style={{
                ...HOME_MAP_RENDER_STYLES.grid,
                backgroundSize:
                  `${tileSize}px ${tileSize}px, ${tileSize}px ${tileSize}px, ${tileSize * 5}px ${tileSize * 5}px, ${tileSize * 5}px ${tileSize * 5}px`,
                height: mapHeight,
                width: mapWidth,
              }}
            />
          ) : null}

          {SHOW_AXIS_LABELS ? (
            <AxisLabels
              columns={renderModel.mapSize.columns}
              rows={renderModel.mapSize.rows}
              tileSize={tileSize}
            />
          ) : null}

          <span style={HOME_MAP_RENDER_STYLES.hiddenStatus}>
            {`world tick ${worldTick}; placements ${renderModel.debugInfo.placementCount}`}
          </span>
        </div>
      </section>
    </main>
  )
}

function getBaseGroundPlacement(placements: MapPlacement[]): MapPlacement {
  return (
    placements.find((placement) => placement.tags.includes("base_ground")) ??
    createFallbackGroundPlacement()
  )
}

function createFallbackGroundPlacement(): MapPlacement {
  return {
    id: "fallback-base-ground",
    assetId: "groundGrassBase01",
    x: 1,
    y: 1,
    layer: "ground",
    scale: 1,
    alpha: 1,
    label: "基础草地",
    source: "scene_recipe",
    tags: ["base_ground", "fallback"],
  }
}

function AxisLabels(props: {
  columns: number
  rows: number
  tileSize: number
}) {
  return (
    <>
      {Array.from({ length: props.columns }, (_, index) => index + 1).map(
        (x) => (
          <span
            key={`x-${x}`}
            style={{
              ...HOME_MAP_RENDER_STYLES.label,
              left: left(x, props.tileSize) + 1,
              top: 1,
              width: props.tileSize - 2,
            }}
          >
            {x}
          </span>
        )
      )}
      {Array.from({ length: props.rows }, (_, index) => index + 1).map((y) => (
        <span
          key={`y-${y}`}
          style={{
            ...HOME_MAP_RENDER_STYLES.label,
            left: 1,
            top: top(y, props.tileSize) + 1,
            width: props.tileSize - 2,
          }}
        >
          {y}
        </span>
      ))}
    </>
  )
}

function left(x: number, tileSize: number): number {
  return (x - 1) * tileSize
}

function top(y: number, tileSize: number): number {
  return (y - 1) * tileSize
}
