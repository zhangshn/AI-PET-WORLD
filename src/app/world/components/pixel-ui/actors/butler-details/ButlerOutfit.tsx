/**
 * 当前文件负责：管家衣服组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerOutfit({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-outfit"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
