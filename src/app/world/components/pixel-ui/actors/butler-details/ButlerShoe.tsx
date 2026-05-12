/**
 * 当前文件负责：管家鞋子组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerShoe({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-shoe"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
