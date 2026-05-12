/**
 * 当前文件负责：承载食物碗、水盆、宠物床、储物箱与观察点设施层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function FacilityLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="facility" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
