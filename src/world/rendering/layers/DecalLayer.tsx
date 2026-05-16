"use client"

/**
 * 当前文件负责：用 Canvas 渲染地表装饰 decal 层。
 */

import { useEffect, useRef } from "react"

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import {
  preloadCanvasAssetSources,
  type CanvasAssetRegistryLike,
  type CanvasAssetSource,
} from "../canvas/canvas-asset-cache"
import { buildStableCanvasOffset } from "../canvas/stable-offset"
import { WORLD_RENDER_FEATURE_FLAGS } from "../rendering-feature-flags"

export type DecalLayerProps = {
  mapSize: {
    columns: number
    rows: number
  }
  tileSize: number
  placements: readonly MapPlacement[]
  assetRegistry: CanvasAssetRegistryLike
  revisionKey: string
  seedBase?: string
}

export function DecalLayer({
  assetRegistry,
  mapSize,
  placements,
  revisionKey,
  seedBase = "mvp-decal-canvas",
  tileSize,
}: DecalLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!WORLD_RENDER_FEATURE_FLAGS.useCanvasDecal) return

    let cancelled = false

    async function paintDecals(): Promise<void> {
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

      const assetMap = await preloadCanvasAssetSources(
        placements.map((placement) => placement.assetId),
        assetRegistry
      )

      if (cancelled) return

      placements.forEach((placement) => {
        drawDecal(
          context,
          assetMap.get(placement.assetId),
          placement,
          tileSize,
          seedBase
        )
      })
    }

    void paintDecals().catch(() => {
      return
    })

    return () => {
      cancelled = true
    }
  }, [
    assetRegistry,
    mapSize.columns,
    mapSize.rows,
    placements,
    revisionKey,
    seedBase,
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
        zIndex: 40,
      }}
    >
      Decal canvas layer
    </canvas>
  )
}

function drawDecal(
  context: CanvasRenderingContext2D,
  source: CanvasAssetSource | undefined,
  placement: MapPlacement,
  tileSize: number,
  seedBase: string
) {
  if (!source) return

  const offset = buildStableCanvasOffset(seedBase, placement.id)
  const size = Math.round(tileSize * placement.scale)
  const drawX = Math.round((placement.x - 1) * tileSize + offset.dx)
  const drawY = Math.round((placement.y - 1) * tileSize + offset.dy)

  context.drawImage(source, drawX, drawY, size, size)
}
