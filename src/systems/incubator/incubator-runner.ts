/**
 * 当前文件负责：推进孵化器运行与照看逻辑。
 */

import type { IncubatorState } from "../../types/incubator"
import {
  NATURAL_PROGRESS_GAIN,
  NATURAL_STABILITY_LOSS,
  refreshIncubatorState,
} from "./incubator-rules"

export function runIncubatorTick(state: IncubatorState): IncubatorState {
  if (!state.hasEmbryo || state.status === "hatched") {
    return state
  }

  return refreshIncubatorState({
    ...state,
    progress: state.progress + NATURAL_PROGRESS_GAIN,
    stability: state.stability - NATURAL_STABILITY_LOSS,
  })
}

export function applyIncubatorCare(
  state: IncubatorState,
  amountProgress: number,
  amountStability: number
): IncubatorState {
  if (!state.hasEmbryo || state.status === "hatched") {
    return state
  }

  return refreshIncubatorState({
    ...state,
    progress: state.progress + amountProgress,
    stability: state.stability + amountStability,
  })
}