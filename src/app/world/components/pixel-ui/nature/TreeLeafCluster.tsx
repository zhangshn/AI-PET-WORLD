/**
 * 当前文件负责：树叶簇组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function TreeLeafCluster({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="tree-leaf-cluster"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
