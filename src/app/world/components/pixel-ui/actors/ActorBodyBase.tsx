/**
 * 当前文件负责：通用角色身体基础组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function ActorBodyBase({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="actor-body-base"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
