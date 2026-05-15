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
}

export function HomeMapPlacementSprite({
  placement,
  tileSize,
}: HomeMapPlacementSpriteProps) {
  const asset = WORLD_MAP_ASSETS[placement.assetId]
  const size = asset.baseSize * (tileSize / 32) * placement.scale
  const placementSize = getPlacementSize(placement, size, tileSize)

  return (
    <div
      aria-label={placement.label}
      title={placement.label}
      style={{
        ...HOME_MAP_RENDER_STYLES.sprite,
        ...anchorStyle(asset.anchor as WorldMapAssetAnchor, placement, tileSize),
        backgroundColor: getFallbackSpriteColor(placement.assetId),
        backgroundImage: buildFallbackSpriteBackground(
          placement.assetId,
          asset.path
        ),
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
        height: placementSize.height,
        opacity: placement.alpha,
        width: placementSize.width,
        zIndex: LAYER_Z_INDEX[placement.layer],
      }}
    />
  )
}

function getPlacementSize(
  placement: MapPlacement,
  defaultSize: number,
  tileSize: number
): { width: number; height: number } {
  if (
    placement.layer === "ground" ||
    placement.layer === "path" ||
    placement.layer === "edge"
  ) {
    return { width: tileSize, height: tileSize }
  }

  return { width: defaultSize, height: defaultSize }
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
