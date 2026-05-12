/**
 * 当前文件负责：承载管家影子、宠物影子与移动落点层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function ActorShadowLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="actor-shadow" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
