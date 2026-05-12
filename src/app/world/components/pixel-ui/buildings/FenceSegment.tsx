/**
 * 当前文件负责：围栏段组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function FenceSegment({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="fence-segment"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
