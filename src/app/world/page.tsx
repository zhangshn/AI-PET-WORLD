"use client"

/**
 * 当前文件负责：新版 /world 地图页面，旧前端界面已删除出入口。
 */

import { type CSSProperties } from "react"

import { WORLD_MAP_ASSETS, type WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
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
          {INITIAL_HOME_MAP_LAYOUT.pathLayer.tiles.map((tile) => (
            <div
              key={`path-${tile.x}-${tile.y}`}
              style={{ ...styles.pathTile, left: left(tile.x), top: top(tile.y) }}
            />
          ))}
          {SPRITES.map((placement) => (
            <MapSprite key={placement.id} placement={placement} />
          ))}
          <div style={styles.grid} />
          <AxisLabels />
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
    <img
      alt={placement.label}
      src={asset.path}
      style={{
        ...styles.sprite,
        ...anchorStyle(placement.assetId, placement.x, placement.y),
        height: size,
        opacity: placement.alpha ?? 1,
        width: size,
        zIndex: placement.layer,
      }}
    />
  )
}

function AxisLabels() {
  return (
    <>
      {Array.from({ length: INITIAL_HOME_MAP_LAYOUT.columns }, (_, index) => index + 1).map((x) => (
        <span key={`x-${x}`} style={{ ...styles.label, left: left(x) + 1, top: 1 }}>
          {x}
        </span>
      ))}
      {Array.from({ length: INITIAL_HOME_MAP_LAYOUT.rows }, (_, index) => index + 1).map((y) => (
        <span key={`y-${y}`} style={{ ...styles.label, left: 1, top: top(y) + 1 }}>
          {y}
        </span>
      ))}
    </>
  )
}

function anchorStyle(assetId: WorldMapAssetId, x: number, y: number): CSSProperties {
  const asset = WORLD_MAP_ASSETS[assetId]

  if (asset.anchor === "top-left") {
    return { left: left(x), top: top(y), transform: "none" }
  }

  if (asset.anchor === "center") {
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
    backgroundImage: `url(${WORLD_MAP_ASSETS[INITIAL_HOME_MAP_LAYOUT.groundAssetId].path})`,
    backgroundRepeat: "repeat",
    backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
    height: MAP_HEIGHT,
    left: 0,
    position: "absolute",
    top: 0,
    width: MAP_WIDTH,
    zIndex: 1,
  },
  pathTile: {
    backgroundImage: `url(${WORLD_MAP_ASSETS[INITIAL_HOME_MAP_LAYOUT.pathAssetId].path})`,
    backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
    height: TILE_SIZE,
    opacity: 0.94,
    position: "absolute",
    width: TILE_SIZE,
    zIndex: 10,
  },
  sprite: {
    imageRendering: "pixelated",
    objectFit: "contain",
    pointerEvents: "none",
    position: "absolute",
  },
  grid: {
    backgroundImage:
      "linear-gradient(to right, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,.36) 2px, transparent 2px), linear-gradient(to bottom, rgba(255,255,255,.36) 2px, transparent 2px)",
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
    width: TILE_SIZE - 2,
    zIndex: 500,
  },
}
