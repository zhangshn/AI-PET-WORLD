/**
 * 当前文件负责：承载房子墙体、屋顶、门、窗与领养中心主体层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function BuildingBodyLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="building-body" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
