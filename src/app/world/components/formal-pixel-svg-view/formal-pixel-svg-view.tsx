// 该组件用于展示正式像素渲染模型生成的 SVG 画面。

import type { FormalPixelRenderModel } from "@/world/formal-pixel-renderer"
import { buildFormalPixelSvg } from "@/world/formal-pixel-renderer"

import styles from "./formal-pixel-svg-view.module.css"

export function FormalPixelSvgView(input: { model: FormalPixelRenderModel }) {
  const svg = buildFormalPixelSvg(input.model)

  return (
    <section
      aria-label="AI-PET-WORLD formal pixel preview"
      className={styles.shell}
      data-formal-pixel-svg-view="v0"
    >
      <div
        className={styles.viewport}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </section>
  )
}
