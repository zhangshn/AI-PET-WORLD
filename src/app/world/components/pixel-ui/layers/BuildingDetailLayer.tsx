/**
 * 当前文件负责：承载建筑装饰、招牌、窗光、花盆与柜台细节层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function BuildingDetailLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="building-detail" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
