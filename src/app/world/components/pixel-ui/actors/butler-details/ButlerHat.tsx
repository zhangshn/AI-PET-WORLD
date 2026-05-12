/**
 * 当前文件负责：管家帽子组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerHat({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-hat"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
