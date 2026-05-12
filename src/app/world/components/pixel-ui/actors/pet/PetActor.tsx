/**
 * 当前文件负责：宠物低保真主体组件。
 */

import type { PixelPartProps } from "../../pixel-ui.types"

import { PetBody } from "./PetBody"
import { PetHead } from "./PetHead"
import { PetLegs } from "./PetLegs"

export function PetActor({
  variant = "default",
  state = "idle",
  debug = false,
  className,
}: PixelPartProps) {
  return (
    <div
      className={className}
      data-pixel-part="pet-actor"
      data-variant={variant}
      data-state={state}
      data-debug={debug ? "true" : "false"}
    >
      <PetLegs variant={variant} state={state} debug={debug} />
      <PetBody variant={variant} state={state} debug={debug} />
      <PetHead variant={variant} state={state} debug={debug} />
    </div>
  )
}
