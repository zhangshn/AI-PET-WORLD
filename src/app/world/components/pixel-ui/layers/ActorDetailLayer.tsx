/**
 * 当前文件负责：承载眼睛、鼻子、嘴巴、耳朵、尾巴、衣服与工具细节层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function ActorDetailLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="actor-detail" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
