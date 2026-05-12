/**
 * 当前文件负责：承载白天、夜晚、灯光、天气与世界氛围层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function AtmosphereLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="atmosphere" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
