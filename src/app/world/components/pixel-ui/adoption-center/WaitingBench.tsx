/**
 * 当前文件负责：领养等待区长椅组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function WaitingBench({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="waiting-bench"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
