/**
 * 当前文件负责：宠物身体基础组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetBody({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-body"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
