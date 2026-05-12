/**
 * 当前文件负责：承载草皮、小草、草丛、花、杂草与踩踏痕迹层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function GrassLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="grass" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
