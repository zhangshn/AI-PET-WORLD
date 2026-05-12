/**
 * 当前文件负责：落叶组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function FallenLeaf({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="fallen-leaf"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
