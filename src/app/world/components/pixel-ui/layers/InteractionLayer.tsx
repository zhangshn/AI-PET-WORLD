/**
 * 当前文件负责：承载点击涟漪、可观察提示、入口提示与抵达点提示层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function InteractionLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="interaction" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
