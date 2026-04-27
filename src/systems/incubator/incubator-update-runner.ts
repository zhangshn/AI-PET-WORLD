/**
 * 当前文件负责：推进孵化器自然成长。
 */

import type { IncubatorState } from "@/types/incubator"
import { clampIncubatorValues } from "./incubator-value-runner"
import { refreshIncubatorStatus } from "./incubator-status-runner"

export function updateIncubatorNaturally(
  incubator: IncubatorState
): IncubatorState {
  if (!incubator.hasEmbryo) {
    return { ...incubator }
  }

  if (incubator.status === "hatched") {
    return { ...incubator }
  }

  const nextIncubator: IncubatorState = {
    ...incubator,
    progress: incubator.progress + 3,
    stability: incubator.stability - 1,
  }

  return refreshIncubatorStatus(clampIncubatorValues(nextIncubator))
}