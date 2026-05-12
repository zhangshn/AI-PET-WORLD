/**
 * 当前文件负责：承载情绪、状态、抵达与轻量像素特效层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function EffectLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="effect" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
