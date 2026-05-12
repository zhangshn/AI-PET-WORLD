/**
 * 当前文件负责：承载土路、石路、家园路、小镇路与脚印路线层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function PathLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="path" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
