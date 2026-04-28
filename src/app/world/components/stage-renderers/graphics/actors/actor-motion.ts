/**
 * 当前文件负责：提供舞台角色移动插值能力。
 */

import type { ActorMotionState } from "./actor-types"

export function moveToward(state: ActorMotionState) {
  const dx = state.targetX - state.x
  const dy = state.targetY - state.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance < 0.5) {
    state.x = state.targetX
    state.y = state.targetY
    return
  }

  const step = state.speed

  if (distance <= step) {
    state.x = state.targetX
    state.y = state.targetY
    return
  }

  state.x += (dx / distance) * step
  state.y += (dy / distance) * step
}