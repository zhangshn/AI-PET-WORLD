/**
 * 当前文件负责：地面边界过渡。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function GroundEdge({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="ground-edge"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
