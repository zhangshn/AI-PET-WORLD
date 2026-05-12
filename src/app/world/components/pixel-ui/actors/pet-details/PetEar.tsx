/**
 * 当前文件负责：宠物耳朵组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetEar({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-ear"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
