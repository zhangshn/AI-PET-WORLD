/**
 * 当前文件负责：低保真草地基础块。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function GrassTile({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="grass-tile"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
