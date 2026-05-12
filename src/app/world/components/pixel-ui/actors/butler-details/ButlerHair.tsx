/**
 * 当前文件负责：管家头发组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

export function ButlerHair({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="butler-hair"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
