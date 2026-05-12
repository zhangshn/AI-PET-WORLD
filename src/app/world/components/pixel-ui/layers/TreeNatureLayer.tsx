/**
 * 当前文件负责：承载树干、树冠、树叶、树影、石头与落叶层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function TreeNatureLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="tree-nature" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
