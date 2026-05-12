/**
 * 当前文件负责：储物箱组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function StorageBox({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="storage-box"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
