/**
 * 当前文件负责：通用脚部细节组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function PixelFootDetail({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="pixel-foot-detail"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
