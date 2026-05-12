/**
 * 当前文件负责：管家建设工具小锤子组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerToolHammer({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-tool-hammer"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
