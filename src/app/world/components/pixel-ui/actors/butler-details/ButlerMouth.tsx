/**
 * 当前文件负责：管家嘴巴组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerMouth({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-mouth"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
