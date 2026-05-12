/**
 * 当前文件负责：门把手组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function DoorHandle({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="door-handle"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
