/**
 * 当前文件负责：领养登记柜台组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function AdoptionCounter({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="adoption-counter"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
