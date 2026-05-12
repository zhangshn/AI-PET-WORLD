/**
 * 当前文件负责：宠物嘴巴组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetMouth({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-mouth"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
