/**
 * 当前文件负责：承载管家身体与宠物身体基础层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function ActorBodyLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="actor-body" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
