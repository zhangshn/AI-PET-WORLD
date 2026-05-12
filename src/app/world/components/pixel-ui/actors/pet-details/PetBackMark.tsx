/**
 * 当前文件负责：宠物背部花纹组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetBackMark({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-back-mark"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
