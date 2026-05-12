/**
 * 当前文件负责：建筑阴影组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function BuildingShadow({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="building-shadow"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
