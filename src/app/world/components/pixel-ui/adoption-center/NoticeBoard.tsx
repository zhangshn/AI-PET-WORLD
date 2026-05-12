/**
 * 当前文件负责：领养公告板组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function NoticeBoard({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="notice-board"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
