/**
 * 当前文件负责：通用角色阴影组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function ActorShadow({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="actor-shadow"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
