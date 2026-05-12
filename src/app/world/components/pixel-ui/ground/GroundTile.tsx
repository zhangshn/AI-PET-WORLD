/**
 * 当前文件负责：低保真地面基础块。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function GroundTile({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="ground-tile"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
