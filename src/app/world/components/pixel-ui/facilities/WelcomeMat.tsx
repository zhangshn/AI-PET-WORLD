/**
 * 当前文件负责：宠物抵达后的家园欢迎垫组件。
 */

import type { PixelPartProps } from "../pixel-ui.types"

export function WelcomeMat({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <span
      className={className}
      data-pixel-part="welcome-mat"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    />
  )
}
