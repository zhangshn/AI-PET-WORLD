/**
 * 当前文件负责：处理管家照看孵化器后的进度与稳定度变化。
 */

import type { IncubatorState } from "@/types/incubator"
import { clampIncubatorValues } from "./incubator-value-runner"
import { refreshIncubatorStatus } from "./incubator-status-runner"

export type CareIncubatorInput = {
  incubator: IncubatorState
  amountProgress: number
  amountStability: number
}

export function careIncubator(input: CareIncubatorInput): IncubatorState {
  if (!input.incubator.hasEmbryo) {
    return { ...input.incubator }
  }

  if (input.incubator.status === "hatched") {
    return { ...input.incubator }
  }

  const nextIncubator: IncubatorState = {
    ...input.incubator,
    progress: input.incubator.progress + input.amountProgress,
    stability: input.incubator.stability + input.amountStability,
  }

  return refreshIncubatorStatus(clampIncubatorValues(nextIncubator))
}