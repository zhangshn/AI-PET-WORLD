/**
 * 当前文件负责：墙体面板组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function WallPanel({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="wall-panel"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
