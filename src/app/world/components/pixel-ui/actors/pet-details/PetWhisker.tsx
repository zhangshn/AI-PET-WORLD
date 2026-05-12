/**
 * 当前文件负责：宠物胡须组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetWhisker({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-whisker"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
