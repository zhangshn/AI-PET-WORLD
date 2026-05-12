/**
 * 当前文件负责：窗组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function WindowPanel({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="window-panel"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
