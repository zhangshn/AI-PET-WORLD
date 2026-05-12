/**
 * 当前文件负责：踩踏草痕组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function TrampledGrass({
  variant = "default",
  state = "trampled",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="trampled-grass"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
