/**
 * 当前文件负责：通用招牌组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function SignBoard({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="sign-board"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
