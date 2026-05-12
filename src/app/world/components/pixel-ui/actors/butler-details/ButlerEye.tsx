/**
 * 当前文件负责：管家眼睛组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerEye({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-eye"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
