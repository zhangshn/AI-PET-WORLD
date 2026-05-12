/**
 * 当前文件负责：按可见 UI 层级承载像素世界的分层组件。
 */

import type { PixelLayerStackProps } from "./pixel-ui.types"

export function PixelLayerStack({
  children,
  debug = false,
}: PixelLayerStackProps) {
  return (
    <div data-pixel-ui="layer-stack" data-debug={debug ? "true" : "false"}>
      {children}
    </div>
  )
}
