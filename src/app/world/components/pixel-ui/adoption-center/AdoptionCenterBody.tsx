/**
 * 当前文件负责：小镇宠物领养中心主体组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function AdoptionCenterBody({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="adoption-center-body"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
