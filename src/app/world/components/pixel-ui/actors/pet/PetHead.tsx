/**
 * 当前文件负责：宠物头部基础组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetHead({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-head"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
