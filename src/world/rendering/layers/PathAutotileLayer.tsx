"use client"

/**
 * 当前文件负责：用 Canvas 渲染路径与草泥边缘层。
 */

import { useEffect, useRef } from "react"

import { WORLD_MAP_ASSETS } from "@/world/map-assets/world-map-asset-registry"
import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import {
  preloadCanvasAssetSources,
  type CanvasAssetRegistryLike,
  type CanvasAssetSource,
} from "../canvas/canvas-asset-cache"
import { selectPathAutotileAssetId } from "../canvas/autotile"
import { WORLD_RENDER_FEATURE_FLAGS } from "../rendering-feature-flags"

export type PathAutotileLayerProps = {
  mapSize: {
    columns: number
    rows: number
  }
  tileSize: number
  pathPlacements: readonly MapPlacement[]
  edgePlacements: readonly MapPlacement[]
  assetRegistry: CanvasAssetRegistryLike
  revisionKey: string
}

export function PathAutotileLayer({
  assetRegistry,
  edgePlacements,
  mapSize,
  pathPlacements,
  revisionKey,
  tileSize,
}: PathAutotileLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (
      !WORLD_RENDER_FEATURE_FLAGS.useCanvasPath &&
      !WORLD_RENDER_FEATURE_FLAGS.useCanvasEdge
    ) {
      return
    }

    let cancelled = false

    async function paintPath(): Promise<void> {
      const canvas = canvasRef.current

      if (!canvas) return

      const logicalWidth = mapSize.columns * tileSize
      const logicalHeight = mapSize.rows * tileSize
      const dpr =
        typeof window === "undefined"
          ? 1
          : Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = logicalWidth * dpr
      canvas.height = logicalHeight * dpr
      canvas.style.width = `${logicalWidth}px`
      canvas.style.height = `${logicalHeight}px`

      const context = canvas.getContext("2d")

      if (!context) return

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.imageSmoothingEnabled = false
      context.clearRect(0, 0, logicalWidth, logicalHeight)

      const pathSet = new Set(
        pathPlacements.map((placement) =>
          buildPointKey(placement.x, placement.y)
        )
      )
      const pathAssetIds = WORLD_RENDER_FEATURE_FLAGS.useCanvasPath
        ? pathPlacements.map((placement) =>
            selectPathAutotileAssetId(
              { x: placement.x, y: placement.y },
              pathSet,
              hasAsset,
              placement.assetId
            )
          )
        : []
      const edgeAssetIds = WORLD_RENDER_FEATURE_FLAGS.useCanvasEdge
        ? edgePlacements.map((placement) => placement.assetId)
        : []
      const assetMap = await preloadCanvasAssetSources(
        [...pathAssetIds, ...edgeAssetIds],
        assetRegistry
      )

      if (cancelled) return

      if (WORLD_RENDER_FEATURE_FLAGS.useCanvasPath) {
        pathPlacements.forEach((placement) => {
          const assetId = selectPathAutotileAssetId(
            { x: placement.x, y: placement.y },
            pathSet,
            hasAsset,
            placement.assetId
          )

          drawTile(context, assetMap.get(assetId), placement, tileSize)
        })
      }

      if (WORLD_RENDER_FEATURE_FLAGS.useCanvasEdge) {
        edgePlacements.forEach((placement) => {
          drawTile(context, assetMap.get(placement.assetId), placement, tileSize)
        })
      }
    }

    void paintPath().catch(() => {
      return
    })

    return () => {
      cancelled = true
    }
  }, [
    assetRegistry,
    edgePlacements,
    mapSize.columns,
    mapSize.rows,
    pathPlacements,
    revisionKey,
    tileSize,
  ])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      role="presentation"
      style={{
        height: `${mapSize.rows * tileSize}px`,
        imageRendering: "pixelated",
        left: 0,
        pointerEvents: "none",
        position: "absolute",
        top: 0,
        width: `${mapSize.columns * tileSize}px`,
        zIndex: 10,
      }}
    >
      Path canvas layer
    </canvas>
  )
}

function buildPointKey(x: number, y: number): string {
  return `${x}:${y}`
}

function hasAsset(assetId: string): boolean {
  return assetId in WORLD_MAP_ASSETS
}

function drawTile(
  context: CanvasRenderingContext2D,
  source: CanvasAssetSource | undefined,
  placement: MapPlacement,
  tileSize: number
) {
  if (!source) return

  context.drawImage(
    source,
    (placement.x - 1) * tileSize,
    (placement.y - 1) * tileSize,
    tileSize + 1,
    tileSize + 1
  )
}
