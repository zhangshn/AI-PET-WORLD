/**
 * 当前文件负责：通用像素嘴巴组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PixelMouth({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pixel-mouth"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
