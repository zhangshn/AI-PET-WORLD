"use client"

/**
 * 当前文件负责：用 Canvas 渲染 terrain tilemap 层。
 */

import { useEffect, useRef } from "react"

import { HOME_MAP_RENDER_STYLES } from "../home-map-render-styles"
import { drawGroundCanvas } from "./draw-ground-canvas"
import type { GroundCanvasLayerInput } from "./ground-canvas-types"

export interface GroundCanvasLayerProps {
  input: GroundCanvasLayerInput
}

export function GroundCanvasLayer({ input }: GroundCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inputRef = useRef(input)

  useEffect(() => {
    inputRef.current = input
  }, [input])

  useEffect(() => {
    let cancelled = false

    const redraw = () => {
      const canvas = canvasRef.current

      if (!canvas) return

      void drawGroundCanvas({
        canvas,
        isCancelled: () => cancelled,
        input: inputRef.current,
      })
    }

    redraw()
    window.addEventListener("resize", redraw)

    return () => {
      cancelled = true
      window.removeEventListener("resize", redraw)
    }
  }, [
    input.dirtyKey,
    input.mapSize.columns,
    input.mapSize.rows,
    input.tileSize,
  ])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={HOME_MAP_RENDER_STYLES.groundCanvas}
    />
  )
}
