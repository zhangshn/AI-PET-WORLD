/**
 * 当前文件负责：宠物床组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function PetBed({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pet-bed"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
