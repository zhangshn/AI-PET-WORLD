/**
 * 当前文件负责：庭院地块组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function GardenPatch({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="garden-patch"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
