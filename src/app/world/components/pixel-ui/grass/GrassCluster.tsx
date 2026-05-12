/**
 * 当前文件负责：草丛组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function GrassCluster({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="grass-cluster"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
