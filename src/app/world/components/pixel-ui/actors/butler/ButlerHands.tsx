/**
 * 当前文件负责：管家手部基础组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerHands({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-hands"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
