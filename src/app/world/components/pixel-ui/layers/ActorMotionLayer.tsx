/**
 * 当前文件负责：承载走路、观察、建设、休息、吃饭、等待与报名领养动作层。
 */

import type { PixelUiLayerProps } from "../pixel-ui.types"

export function ActorMotionLayer({ children, visible = true, debug = false }: PixelUiLayerProps) {
  if (!visible) return null

  return (
    <section data-pixel-layer="actor-motion" data-debug={debug ? "true" : "false"}>
      {children}
    </section>
  )
}
