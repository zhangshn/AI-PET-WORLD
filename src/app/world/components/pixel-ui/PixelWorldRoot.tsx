/**
 * 当前文件负责：承载像素 UI 世界组件树的根容器。
 */

import type { PixelUiRootProps } from "./pixel-ui.types"

export function PixelWorldRoot({
  children,
  debug = false,
}: PixelUiRootProps) {
  return (
    <div data-pixel-ui="world-root" data-debug={debug ? "true" : "false"}>
      {children}
    </div>
  )
}
