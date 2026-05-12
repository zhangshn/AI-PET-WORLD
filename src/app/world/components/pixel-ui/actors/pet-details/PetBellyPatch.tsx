/**
 * 当前文件负责：宠物腹部花纹组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PetBellyPatch({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-belly-patch"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
