"use client"

/**
 * 当前文件负责：用 Canvas 渲染家园地表 tilemap。
 */

import { useEffect, useRef } from "react"

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import {
  preloadCanvasAssetSources,
  type CanvasAssetRegistryLike,
} from "../canvas/canvas-asset-cache"
import { WORLD_RENDER_FEATURE_FLAGS } from "../rendering-feature-flags"

type CanvasMapSizeLike = {
  columns: number
  rows: number
}

type GroundCanvasLayerProps = {
  mapSize: CanvasMapSizeLike
  tileSize: number
  groundPlacements: readonly MapPlacement[]
  assetRegistry: CanvasAssetRegistryLike
  revisionKey: string
  className?: string
}

function getTileOrigin(placement: MapPlacement, tileSize: number) {
  return {
    x: (placement.x - 1) * tileSize,
    y: (placement.y - 1) * tileSize,
  }
}

export function GroundCanvasLayer({
  mapSize,
  tileSize,
  groundPlacements,
  assetRegistry,
  revisionKey,
  className,
}: GroundCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!WORLD_RENDER_FEATURE_FLAGS.useCanvasGround) return

    let cancelled = false

    async function paintGround(): Promise<void> {
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

      const context = canvas.getContext("2d", { alpha: false })

      if (!context) return

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.imageSmoothingEnabled = false
      context.clearRect(0, 0, logicalWidth, logicalHeight)

      const assetIds = groundPlacements.map((placement) => placement.assetId)
      const assetSourceMap = await preloadCanvasAssetSources(
        assetIds,
        assetRegistry
      )

      if (cancelled) return

      groundPlacements.forEach((placement) => {
        const source = assetSourceMap.get(placement.assetId)

        if (!source) return

        const origin = getTileOrigin(placement, tileSize)
        const drawX = origin.x | 0
        const drawY = origin.y | 0

        context.drawImage(source, drawX, drawY, tileSize, tileSize)
      })
    }

    void paintGround().catch(() => {
      return
    })

    return () => {
      cancelled = true
    }
  }, [
    assetRegistry,
    groundPlacements,
    mapSize.columns,
    mapSize.rows,
    revisionKey,
    tileSize,
  ])

  const logicalWidth = mapSize.columns * tileSize
  const logicalHeight = mapSize.rows * tileSize

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      role="presentation"
      style={{
        height: `${logicalHeight}px`,
        imageRendering: "pixelated",
        left: 0,
        pointerEvents: "none",
        position: "absolute",
        top: 0,
        width: `${logicalWidth}px`,
        zIndex: 0,
      }}
    >
      Ground canvas layer
    </canvas>
  )
}
