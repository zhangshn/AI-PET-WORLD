/**
 * 当前文件负责：管家脚部基础组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerFeet({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-feet"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
