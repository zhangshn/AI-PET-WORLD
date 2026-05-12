/**
 * 当前文件负责：承载地基、平台、围栏底座与庭院底座层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function BuildingBaseLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="building-base" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
