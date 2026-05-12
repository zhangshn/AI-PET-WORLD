/**
 * 当前文件负责：树影组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function TreeShadow({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="tree-shadow"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
