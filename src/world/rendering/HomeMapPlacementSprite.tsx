"use client"

/**
 * 当前文件负责：渲染单个家园地图摆放物。
 */

import type { CSSProperties } from "react"

import {
  WORLD_MAP_ASSETS,
  type WorldMapAssetId,
} from "@/world/map-assets/world-map-asset-registry"
import type { WorldMapAssetAnchor } from "@/world/map-assets/world-map-asset-schema"
import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import {
  buildFallbackSpriteBackground,
  getFallbackSpriteColor,
} from "./fallback-sprite-style"
import {
  HOME_MAP_RENDER_STYLES,
  LAYER_Z_INDEX,
} from "./home-map-render-styles"

export type HomeMapPlacementSpriteProps = {
  placement: MapPlacement
  tileSize: number
  renderMode?: "tile" | "decal" | "entity" | "actor"
  pixelOffset?: {
    x: number
    y: number
  }
}

export function HomeMapPlacementSprite({
  placement,
  tileSize,
  renderMode = "entity",
  pixelOffset = { x: 0, y: 0 },
}: HomeMapPlacementSpriteProps) {
  const asset = WORLD_MAP_ASSETS[placement.assetId]
  const size = asset.baseSize * (tileSize / 32) * placement.scale
  const placementSize = getPlacementSize(renderMode, size, tileSize)
  const tileBackgroundSize = renderMode === "tile" ? "cover" : "contain"
  const baseStyle: CSSProperties = {
    ...HOME_MAP_RENDER_STYLES.sprite,
    ...anchorStyle(
      getRenderAnchor(renderMode, asset.anchor as WorldMapAssetAnchor),
      placement,
      tileSize,
      pixelOffset
    ),
    backgroundColor: getFallbackSpriteColor(placement.assetId),
    backgroundImage: buildFallbackSpriteBackground(placement.assetId, asset.path),
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: tileBackgroundSize,
    height: placementSize.height,
    opacity: placement.alpha,
    width: placementSize.width,
    zIndex: LAYER_Z_INDEX[placement.layer],
  }

  if (renderMode === "entity" || renderMode === "actor") {
    return (
      <>
        <div
          aria-hidden="true"
          style={contactShadowStyle(placement, placementSize, tileSize)}
        />
        <div
          aria-label={placement.label}
          title={placement.label}
          style={baseStyle}
        />
      </>
    )
  }

  return (
    <div
      aria-label={placement.label}
      title={placement.label}
      style={baseStyle}
    />
  )
}

function getPlacementSize(
  renderMode: HomeMapPlacementSpriteProps["renderMode"],
  defaultSize: number,
  tileSize: number
): { width: number; height: number } {
  if (renderMode === "tile") {
    return { width: tileSize + 1, height: tileSize + 1 }
  }

  return { width: defaultSize, height: defaultSize }
}

function getRenderAnchor(
  renderMode: HomeMapPlacementSpriteProps["renderMode"],
  assetAnchor: WorldMapAssetAnchor
): WorldMapAssetAnchor {
  if (renderMode === "tile") return "top-left"
  if (renderMode === "decal") return "center"
  if (renderMode === "entity" || renderMode === "actor") {
    return "bottom-center"
  }

  return assetAnchor
}

function anchorStyle(
  anchor: WorldMapAssetAnchor,
  placement: MapPlacement,
  tileSize: number,
  pixelOffset: { x: number; y: number }
): CSSProperties {
  if (anchor === "top-left") {
    return {
      left: left(placement.x, tileSize) + pixelOffset.x,
      top: top(placement.y, tileSize) + pixelOffset.y,
      transform: "none",
    }
  }

  if (anchor === "center") {
    return {
      left: objectX(placement.x, tileSize) + pixelOffset.x,
      top: top(placement.y, tileSize) + tileSize / 2 + pixelOffset.y,
      transform: "translate(-50%, -50%)",
    }
  }

  return {
    left: objectX(placement.x, tileSize) + pixelOffset.x,
    top: objectY(placement.y, tileSize) + pixelOffset.y,
    transform: "translate(-50%, -100%)",
  }
}

function contactShadowStyle(
  placement: MapPlacement,
  placementSize: { width: number; height: number },
  tileSize: number
): CSSProperties {
  const shadowWidth = Math.max(tileSize * 0.9, placementSize.width * 0.58)
  const shadowHeight = Math.max(6, tileSize * 0.32)

  return {
    background:
      "radial-gradient(ellipse at center, rgba(25, 31, 21, 0.26) 0 45%, rgba(25, 31, 21, 0.08) 62%, transparent 72%)",
    height: shadowHeight,
    left: objectX(placement.x, tileSize),
    pointerEvents: "none",
    position: "absolute",
    top: objectY(placement.y, tileSize) - shadowHeight / 1.6,
    transform: "translate(-50%, -50%)",
    width: shadowWidth,
    zIndex: Math.max(0, LAYER_Z_INDEX[placement.layer] - 1),
  }
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

export function isKnownMapAssetId(assetId: string): assetId is WorldMapAssetId {
  return assetId in WORLD_MAP_ASSETS
}
