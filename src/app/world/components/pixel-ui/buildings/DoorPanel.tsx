/**
 * 当前文件负责：门板组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function DoorPanel({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="door-panel"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
