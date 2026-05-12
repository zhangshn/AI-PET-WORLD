/**
 * 当前文件负责：宠物鼻子组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetNose({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-nose"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
