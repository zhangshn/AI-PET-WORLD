/**
 * 当前文件负责：小镇服务点提示组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function TownServiceMarker({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="town-service-marker"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
