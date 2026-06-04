"use client"

import type { PixelWorldPixelBufferFrame } from "@/world/pixel-worldview"
import { Application, Container, Graphics } from "pixi.js"
import { useEffect, useRef } from "react"

import styles from "./pixi-pixel-world-renderer.module.css"

export function PixiPixelWorldRendererClient(input: {
  buffer: PixelWorldPixelBufferFrame
}) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current

    const app = new Application()
    let initialized = false
    let disposed = false

    mount.replaceChildren()

    async function initialize() {
      await app.init({
        width: input.buffer.canvas.width,
        height: input.buffer.canvas.height,
        backgroundAlpha: 0,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      initialized = true

      if (disposed) {
        app.destroy(true, { children: true })
        return
      }

      mount.appendChild(app.canvas)

      const root = new Container()
      input.buffer.layers.forEach((layer) => {
        const graphics = new Graphics()

        layer.cells.forEach((cell) => {
          if (!cell.visible) return

          graphics.rect(cell.x, cell.y, cell.width, cell.height)
          graphics.fill({
            color: parseColorHintToNumber(cell.colorHint),
            alpha: clampOpacity(cell.opacity),
          })
        })

        root.addChild(graphics)
      })

      app.stage.addChild(root)
    }

    void initialize()

    return () => {
      disposed = true
      if (initialized) app.destroy(true, { children: true })
      mount.replaceChildren()
    }
  }, [input.buffer])

  return (
    <section className={styles.shell}>
      <div
        ref={mountRef}
        className={styles.mount}
        aria-label="Pixi PixelWorldView canvas mount"
      />
    </section>
  )
}

function parseColorHintToNumber(colorHint?: string): number {
  if (!colorHint || !/^#[0-9a-f]{6}$/i.test(colorHint)) return 0xff00ff

  return Number.parseInt(colorHint.slice(1), 16)
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value))
}
