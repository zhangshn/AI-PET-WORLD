/**
 * 当前文件负责：宠物领养中心招牌组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function AdoptionCenterSign({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="adoption-center-sign"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
