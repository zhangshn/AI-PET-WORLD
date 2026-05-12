/**
 * 当前文件负责：树干组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function TreeTrunk({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="tree-trunk"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
