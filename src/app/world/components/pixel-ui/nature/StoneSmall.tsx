/**
 * 当前文件负责：小石头组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function StoneSmall({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="stone-small"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
