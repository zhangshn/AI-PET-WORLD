"use client"

/**
 * 当前文件负责：新版 /world 坐标地图页面。
 */

import type { CSSProperties } from "react"

import {
  WORLD_MAP_ASSETS,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"
import type { WorldMapAssetAnchor } from "@/world/map-assets/world-map-asset-schema"
import {
  INITIAL_HOME_MAP_LAYOUT,
  INITIAL_HOME_SPRITE_LAYERS,
} from "@/world/maps/home/initial-home/initial-home-map-layout"
import type { InitialHomeSpritePlacement } from "@/world/maps/home/initial-home/initial-home-map-schema"

import { useWorldEngineState } from "./hooks/useWorldEngineState"

const TILE_SIZE = INITIAL_HOME_MAP_LAYOUT.tileSize
const MAP_WIDTH = INITIAL_HOME_MAP_LAYOUT.columns * TILE_SIZE
const MAP_HEIGHT = INITIAL_HOME_MAP_LAYOUT.rows * TILE_SIZE
const SPRITES = INITIAL_HOME_SPRITE_LAYERS.flatMap((layer) => layer.placements)

export default function WorldPage() {
  useWorldEngineState()

  return (
    <main style={styles.page}>
      <section style={styles.viewport}>
        <div style={styles.mapCanvas}>
          <div style={styles.ground} />

          {INITIAL_HOME_MAP_LAYOUT.groundLayer.overlayTiles.map((tile) => (
            <div
              key={`ground-${tile.x}-${tile.y}`}
              style={{
                ...styles.tile,
                backgroundImage: `url(${WORLD_MAP_ASSETS[tile.assetId].path})`,
                left: left(tile.x),
                top: top(tile.y),
                zIndex: 2,
              }}
            />
          ))}

          {INITIAL_HOME_MAP_LAYOUT.pathLayer.tiles.map((tile) => (
            <div
              key={`path-${tile.x}-${tile.y}`}
              style={{
                ...styles.tile,
                backgroundColor: "#7b5536",
                backgroundImage: `url(${WORLD_MAP_ASSETS[tile.assetId].path})`,
                left: left(tile.x),
                opacity: 0.94,
                top: top(tile.y),
                zIndex: 10,
              }}
            />
          ))}

          {SPRITES.map((placement) => (
            <MapSprite key={placement.id} placement={placement} />
          ))}

          <div style={styles.dayNightAtmosphere} />
          <div style={styles.grid} />
        </div>
      </section>
    </main>
  )
}

function MapSprite(props: { placement: InitialHomeSpritePlacement }) {
  const placement = props.placement
  const asset = WORLD_MAP_ASSETS[placement.assetId]
  const size = asset.baseSize * (TILE_SIZE / 32) * placement.scale

  return (
    <div
      aria-label={placement.label}
      title={placement.label}
      style={{
        ...styles.sprite,
        ...anchorStyle(placement.assetId, placement.x, placement.y),
        backgroundColor: getFallbackColor(placement.assetId),
        backgroundImage: buildSpriteBackground(placement.assetId, asset.path),
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
        height: size,
        opacity: placement.alpha ?? 1,
        width: size,
        zIndex: placement.layer,
      }}
    />
  )
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

  return "#7b5536"
}

function anchorStyle(
  assetId: WorldMapAssetId,
  x: number,
  y: number
): CSSProperties {
  const asset = WORLD_MAP_ASSETS[assetId]
  const anchor = asset.anchor as WorldMapAssetAnchor

  if (anchor === "top-left") {
    return { left: left(x), top: top(y), transform: "none" }
  }

  if (anchor === "center") {
    return {
      left: objectX(x),
      top: top(y) + TILE_SIZE / 2,
      transform: "translate(-50%, -50%)",
    }
  }

  return {
    left: objectX(x),
    top: objectY(y),
    transform: "translate(-50%, -100%)",
  }
}

function left(x: number): number {
  return (x - 1) * TILE_SIZE
}

function top(y: number): number {
  return (y - 1) * TILE_SIZE
}

function objectX(x: number): number {
  return left(x) + TILE_SIZE / 2
}

function objectY(y: number): number {
  return top(y) + TILE_SIZE
}

const styles: Record<string, CSSProperties> = {
  page: {
    background: "#0f170d",
    minHeight: "100vh",
  },
  viewport: {
    height: "100vh",
    overflow: "auto",
    width: "100vw",
  },
  mapCanvas: {
    background: "#4c7337",
    height: MAP_HEIGHT,
    imageRendering: "pixelated",
    position: "relative",
    width: MAP_WIDTH,
  },
  ground: {
    backgroundColor: "#4c7337",
    backgroundImage: `url(${WORLD_MAP_ASSETS[INITIAL_HOME_MAP_LAYOUT.groundLayer.baseAssetId].path})`,
    backgroundRepeat: "repeat",
    backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
    height: MAP_HEIGHT,
    left: 0,
    position: "absolute",
    top: 0,
    width: MAP_WIDTH,
    zIndex: 1,
  },
  tile: {
    backgroundColor: "#4c7337",
    backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
    height: TILE_SIZE,
    position: "absolute",
    width: TILE_SIZE,
  },
  sprite: {
    border: "1px solid rgba(24, 23, 18, 0.25)",
    boxSizing: "border-box",
    imageRendering: "pixelated",
    pointerEvents: "none",
    position: "absolute",
  },
  dayNightAtmosphere: {
    background:
      "linear-gradient(180deg, rgba(255, 226, 145, 0.08), transparent 36%, rgba(26, 40, 76, 0.12))",
    height: MAP_HEIGHT,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    width: MAP_WIDTH,
    zIndex: 440,
  },
  grid: {
    backgroundImage:
      "linear-gradient(to right, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,.34) 2px, transparent 2px), linear-gradient(to bottom, rgba(255,255,255,.34) 2px, transparent 2px)",
    backgroundSize:
      `${TILE_SIZE}px ${TILE_SIZE}px, ${TILE_SIZE}px ${TILE_SIZE}px, ${TILE_SIZE * 5}px ${TILE_SIZE * 5}px, ${TILE_SIZE * 5}px ${TILE_SIZE * 5}px`,
    height: MAP_HEIGHT,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    width: MAP_WIDTH,
    zIndex: 450,
  },
}
