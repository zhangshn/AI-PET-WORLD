/**
 * 当前文件负责：管家头部基础组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerHead({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-head"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
