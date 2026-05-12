/**
 * 当前文件负责：杂草组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function WeedPatch({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="weed-patch"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
