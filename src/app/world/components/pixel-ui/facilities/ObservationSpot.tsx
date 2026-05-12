/**
 * 当前文件负责：观察点组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function ObservationSpot({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="observation-spot"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
