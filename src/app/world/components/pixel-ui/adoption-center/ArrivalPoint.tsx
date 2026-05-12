/**
 * 当前文件负责：宠物送达 / 抵达点组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function ArrivalPoint({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="arrival-point"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
