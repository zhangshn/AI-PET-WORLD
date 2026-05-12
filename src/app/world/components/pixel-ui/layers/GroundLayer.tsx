/**
 * 当前文件负责：承载土地、泥地、石地、水边与边界地形层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function GroundLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="ground" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
