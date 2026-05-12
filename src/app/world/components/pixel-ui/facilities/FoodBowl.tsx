/**
 * 当前文件负责：食物碗组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function FoodBowl({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="food-bowl"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
