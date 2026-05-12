/**
 * 当前文件负责：管家低保真主体组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

import { ButlerBody } from "./ButlerBody"
import { ButlerFeet } from "./ButlerFeet"
import { ButlerHands } from "./ButlerHands"
import { ButlerHead } from "./ButlerHead"

export function ButlerActor({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <div
      className={className}
      data-pixel-part="butler-actor"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    >
      <ButlerFeet variant={variant} state={state} debug={debug} />
      <ButlerBody variant={variant} state={state} debug={debug} />
      <ButlerHead variant={variant} state={state} debug={debug} />
      <ButlerHands variant={variant} state={state} debug={debug} />
    </div>
  )
}
