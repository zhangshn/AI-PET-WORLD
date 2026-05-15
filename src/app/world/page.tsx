"use client"

/**
 * 当前文件负责：显示由 HomeMapState 驱动的新版 /world 地图。
 */

import { useMemo, type CSSProperties } from "react"

import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import {
  WORLD_MAP_ASSETS,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"
import type { WorldMapAssetAnchor } from "@/world/map-assets/world-map-asset-schema"
import type {
  MapPlacement,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"
import { buildHomeMapRenderModel } from "@/world/rendering/home-map-render-model"

import { useWorldEngineState } from "./hooks/useWorldEngineState"

const SHOW_DEBUG_GRID = false
const SHOW_AXIS_LABELS = false

const DEFAULT_CONSTRUCTION_STYLE = {
  structuredBuilder: 0.56,
  warmCaretaker: 0.72,
  protectiveKeeper: 0.42,
  aestheticOrganizer: 0.38,
  quietMaintainer: 0.48,
  adaptivePlanner: 0.52,
}

const LAYER_Z_INDEX: Record<MapPlacementLayer, number> = {
  ground: 1,
  path: 10,
  edge: 15,
  zone: 20,
  structure: 55,
  facility: 70,
  nature: 80,
  "surface-decoration": 90,
  actor: 120,
  atmosphere: 200,
}

export default function WorldPage() {
  const worldState = useWorldEngineState()
  const homeMapState = useMemo(
    () =>
      generateInitialHomeMap({
        worldId: "mvp-visible-world",
        ownerId: "local-player",
        birthSignature: "mvp-v1-2-visible-world",
        worldSalt: "initial-home",
        butlerConstructionStyle: DEFAULT_CONSTRUCTION_STYLE,
        now: 0,
      }),
    []
  )
  const renderModel = useMemo(
    () => buildHomeMapRenderModel(homeMapState),
    [homeMapState]
  )
  const tileSize = renderModel.mapSize.tileSize
  const mapWidth = renderModel.mapSize.columns * tileSize
  const mapHeight = renderModel.mapSize.rows * tileSize
  const baseGround = getBaseGroundPlacement(renderModel.allPlacements)

  return (
    <main style={styles.page}>
      <section style={styles.viewport} aria-label="AI-PET-WORLD 初始家园">
        <div
          style={{
            ...styles.mapCanvas,
            height: mapHeight,
            width: mapWidth,
          }}
        >
          <div
            style={{
              ...styles.ground,
              backgroundImage: `url(${WORLD_MAP_ASSETS[baseGround.assetId].path})`,
              backgroundSize: `${tileSize}px ${tileSize}px`,
              height: mapHeight,
              width: mapWidth,
            }}
          />

          {renderModel.allPlacements
            .filter((placement) => placement.id !== baseGround.id)
            .map((placement) => (
              <MapPlacementSprite
                key={placement.id}
                placement={placement}
                tileSize={tileSize}
              />
            ))}

          <div
            style={{
              ...styles.dayNightAtmosphere,
              height: mapHeight,
              width: mapWidth,
            }}
          />

          {SHOW_DEBUG_GRID ? (
            <div
              style={{
                ...styles.grid,
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

          <span style={styles.hiddenStatus}>
            {`world tick ${worldState.tick}; placements ${renderModel.debugInfo.placementCount}`}
          </span>
        </div>
      </section>
    </main>
  )
}

function MapPlacementSprite(props: {
  placement: MapPlacement
  tileSize: number
}) {
  const { placement, tileSize } = props
  const asset = WORLD_MAP_ASSETS[placement.assetId]
  const size = asset.baseSize * (tileSize / 32) * placement.scale

  return (
    <div
      aria-label={placement.label}
      title={placement.label}
      style={{
        ...styles.sprite,
        ...anchorStyle(asset.anchor as WorldMapAssetAnchor, placement, tileSize),
        backgroundColor: getFallbackColor(placement.assetId),
        backgroundImage: buildSpriteBackground(placement.assetId, asset.path),
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
        height: getPlacementSize(placement, size, tileSize).height,
        opacity: placement.alpha,
        width: getPlacementSize(placement, size, tileSize).width,
        zIndex: LAYER_Z_INDEX[placement.layer],
      }}
    />
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

function getPlacementSize(
  placement: MapPlacement,
  defaultSize: number,
  tileSize: number
): { width: number; height: number } {
  if (placement.layer === "ground" || placement.layer === "path") {
    return { width: tileSize, height: tileSize }
  }

  return { width: defaultSize, height: defaultSize }
}

function buildSpriteBackground(
  assetId: WorldMapAssetId,
  path: string
): string {
  if (assetId === "butlerBodyStandard01") {
    return [
      "linear-gradient(#2b2524 0 18%, transparent 18%)",
      "linear-gradient(90deg, transparent 0 18%, #d5a37e 18% 32%, transparent 32% 68%, #d5a37e 68% 82%, transparent 82%)",
      "linear-gradient(#d5a37e 0 32%, #60708d 32% 78%, #252b35 78%)",
      `url(${path})`,
    ].join(", ")
  }

  if (
    assetId === "petPoseSkeletonIdleFront01" ||
    assetId === "petPartBodyRound01"
  ) {
    return [
      "radial-gradient(circle at 36% 34%, #221817 0 4%, transparent 5%)",
      "radial-gradient(circle at 64% 34%, #221817 0 4%, transparent 5%)",
      "linear-gradient(135deg, transparent 0 12%, #9b604b 12% 24%, transparent 24%)",
      "linear-gradient(225deg, transparent 0 12%, #9b604b 12% 24%, transparent 24%)",
      "linear-gradient(#c78161 0 52%, #a86651 52%)",
      `url(${path})`,
    ].join(", ")
  }

  return `url(${path})`
}

function getFallbackColor(assetId: WorldMapAssetId): string {
  const asset = WORLD_MAP_ASSETS[assetId]

  if (asset.category === "actor") return "#c78161"
  if (asset.category === "structure") return "#b68756"
  if (asset.category === "facility") return "#d0a45d"
  if (asset.category === "nature") return "#4f8b45"
  if (asset.category === "surface_decoration") return "#76a95f"
  if (asset.category === "edge") return "#80603e"
  if (asset.category === "path") return "#7b5536"

  return "#4c7337"
}

function anchorStyle(
  anchor: WorldMapAssetAnchor,
  placement: MapPlacement,
  tileSize: number
): CSSProperties {
  if (anchor === "top-left") {
    return {
      left: left(placement.x, tileSize),
      top: top(placement.y, tileSize),
      transform: "none",
    }
  }

  if (anchor === "center") {
    return {
      left: objectX(placement.x, tileSize),
      top: top(placement.y, tileSize) + tileSize / 2,
      transform: "translate(-50%, -50%)",
    }
  }

  return {
    left: objectX(placement.x, tileSize),
    top: objectY(placement.y, tileSize),
    transform: "translate(-50%, -100%)",
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
              ...styles.label,
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
            ...styles.label,
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

function objectX(x: number, tileSize: number): number {
  return left(x, tileSize) + tileSize / 2
}

function objectY(y: number, tileSize: number): number {
  return top(y, tileSize) + tileSize
}

const styles: Record<string, CSSProperties> = {
  page: {
    background: "#10200f",
    minHeight: "100vh",
  },
  viewport: {
    height: "100vh",
    overflow: "auto",
    width: "100vw",
  },
  mapCanvas: {
    background: "#4c7337",
    imageRendering: "pixelated",
    position: "relative",
  },
  ground: {
    backgroundColor: "#4c7337",
    backgroundRepeat: "repeat",
    left: 0,
    position: "absolute",
    top: 0,
    zIndex: 1,
  },
  sprite: {
    boxSizing: "border-box",
    imageRendering: "pixelated",
    pointerEvents: "none",
    position: "absolute",
  },
  dayNightAtmosphere: {
    background:
      "linear-gradient(180deg, rgba(255, 226, 145, 0.08), transparent 42%, rgba(26, 40, 76, 0.14))",
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    zIndex: LAYER_Z_INDEX.atmosphere,
  },
  grid: {
    backgroundImage:
      "linear-gradient(to right, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,.34) 2px, transparent 2px), linear-gradient(to bottom, rgba(255,255,255,.34) 2px, transparent 2px)",
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    zIndex: 450,
  },
  label: {
    alignItems: "center",
    background: "rgba(16, 24, 15, 0.86)",
    color: "#ffffff",
    display: "flex",
    fontFamily: "Arial, Microsoft YaHei, sans-serif",
    fontSize: 12,
    fontWeight: 800,
    height: 14,
    justifyContent: "center",
    lineHeight: "14px",
    pointerEvents: "none",
    position: "absolute",
    zIndex: 500,
  },
  hiddenStatus: {
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    whiteSpace: "nowrap",
    width: 1,
  },
}
