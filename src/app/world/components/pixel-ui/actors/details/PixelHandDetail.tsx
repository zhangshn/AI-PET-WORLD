/**
 * 当前文件负责：通用手部细节组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PixelHandDetail({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pixel-hand-detail"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
