/**
 * 当前文件负责：饮水碗组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function WaterBowl({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="water-bowl"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
