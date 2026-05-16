"use client"

/**
 * 当前文件负责：渲染单个家园地图摆放物。
 */

import type { CSSProperties } from "react"

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import {
  buildFallbackSpriteBackground,
  getFallbackSpriteColor,
} from "./fallback-sprite-style"
import {
  HOME_MAP_RENDER_STYLES,
  LAYER_Z_INDEX,
} from "./home-map-render-styles"
import {
  resolveMapPlacementAsset,
  type ResolvedMapPlacementAsset,
} from "./resolve-map-placement-asset"

export type HomeMapPlacementSpriteProps = {
  placement: MapPlacement
  tileSize: number
  renderMode: "entity" | "actor"
}

export function HomeMapPlacementSprite({
  placement,
  tileSize,
  renderMode,
}: HomeMapPlacementSpriteProps) {
  if (isTerrainLikePlacement(placement)) {
    warnTerrainPlacement(placement)

    return null
  }

  const asset = resolveMapPlacementAsset(placement.assetId)

  if (!asset) {
    warnMissingAsset(placement)

    return null
  }

  const size = getSpriteBaseSize(placement) * (tileSize / 32) * placement.scale
  const placementSize = getPlacementSize(size)
  const baseStyle: CSSProperties = {
    ...HOME_MAP_RENDER_STYLES.sprite,
    ...anchorStyle(
      "bottom-center",
      placement,
      tileSize
    ),
    backgroundColor: getFallbackSpriteColor(placement.assetId),
    backgroundImage: buildFallbackSpriteBackground(placement.assetId, asset.path),
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
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

function getPlacementSize(defaultSize: number): { width: number; height: number } {
  return { width: defaultSize, height: defaultSize }
}

function anchorStyle(
  anchor: NonNullable<ResolvedMapPlacementAsset["anchor"]>,
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

function getSpriteBaseSize(placement: MapPlacement): number {
  if (placement.layer === "actor") return 64
  if (placement.layer === "nature") return 64
  if (placement.layer === "facility") return 64
  if (placement.layer === "structure") return 128

  return 64
}

function isTerrainLikePlacement(placement: MapPlacement): boolean {
  return (
    placement.layer === "ground" ||
    placement.layer === "path" ||
    placement.layer === "edge" ||
    placement.layer === "surface-decoration" ||
    placement.tags.includes("ground_support") ||
    placement.id.startsWith("support-") ||
    placement.id.includes("support")
  )
}

function warnTerrainPlacement(placement: MapPlacement) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[HomeMapPlacementSprite] terrain placement should be rendered by GroundCanvasLayer: ${placement.id}`
    )
  }
}

function warnMissingAsset(placement: MapPlacement) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[HomeMapPlacementSprite] missing asset for placement: ${placement.id}`
    )
  }
}
