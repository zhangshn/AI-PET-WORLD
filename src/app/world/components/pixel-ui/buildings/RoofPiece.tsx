/**
 * 当前文件负责：屋顶部件组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function RoofPiece({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="roof-piece"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
