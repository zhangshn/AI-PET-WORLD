/**
 * 当前文件负责：根据孵化器进度与稳定度刷新孵化状态。
 */

import type { IncubatorState } from "@/types/incubator"

export function refreshIncubatorStatus(
  incubator: IncubatorState
): IncubatorState {
  const nextIncubator: IncubatorState = { ...incubator }

  if (nextIncubator.status === "hatched") {
    return nextIncubator
  }

  if (nextIncubator.progress >= 100 && nextIncubator.stability >= 60) {
    nextIncubator.status = "ready_to_hatch"
    return nextIncubator
  }

  nextIncubator.status = "incubating"

  return nextIncubator
}