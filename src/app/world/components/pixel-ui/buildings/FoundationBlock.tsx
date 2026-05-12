/**
 * 当前文件负责：地基块组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function FoundationBlock({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="foundation-block"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
