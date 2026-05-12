/**
 * 当前文件负责：宠物眼睛组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetEye({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-eye"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
