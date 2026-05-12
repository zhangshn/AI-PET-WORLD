/**
 * 当前文件负责：宠物腿部基础组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetLegs({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-legs"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
