/**
 * 当前文件负责：树冠组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function TreeCanopy({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="tree-canopy"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
