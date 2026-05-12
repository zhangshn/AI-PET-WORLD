/**
 * 当前文件负责：管家记录板组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerToolClipboard({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-tool-clipboard"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
