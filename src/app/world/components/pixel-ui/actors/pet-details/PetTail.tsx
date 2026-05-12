/**
 * 当前文件负责：宠物尾巴组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetTail({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-tail"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
