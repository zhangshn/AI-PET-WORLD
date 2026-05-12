/**
 * 当前文件负责：低保真泥地区块。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function DirtPatch({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="dirt-patch"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
