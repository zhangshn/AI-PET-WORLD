/**
 * 当前文件负责：通用像素眼睛组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PixelEye({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pixel-eye"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
