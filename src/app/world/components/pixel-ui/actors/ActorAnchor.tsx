/**
 * 当前文件负责：角色定位锚点组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function ActorAnchor({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <div
      className={className}
      data-pixel-part="actor-anchor"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
