/**
 * 当前文件负责：定义孵化器数值规则与状态判断。
 */

import type { IncubatorState, IncubatorStatus } from "../../types/incubator"

export const INCUBATOR_PROGRESS_MIN = 0
export const INCUBATOR_PROGRESS_MAX = 100
export const INCUBATOR_STABILITY_MIN = 0
export const INCUBATOR_STABILITY_MAX = 100

export const NATURAL_PROGRESS_GAIN = 3
export const NATURAL_STABILITY_LOSS = 1
export const HATCH_REQUIRED_PROGRESS = 100
export const HATCH_REQUIRED_STABILITY = 60

export function clampIncubatorValue(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max)
}

export function normalizeIncubatorState(
  state: IncubatorState
): IncubatorState {
  return {
    ...state,
    progress: clampIncubatorValue(
      state.progress,
      INCUBATOR_PROGRESS_MIN,
      INCUBATOR_PROGRESS_MAX
    ),
    stability: clampIncubatorValue(
      state.stability,
      INCUBATOR_STABILITY_MIN,
      INCUBATOR_STABILITY_MAX
    ),
  }
}

export function canHatchIncubator(state: IncubatorState): boolean {
  return (
    state.hasEmbryo &&
    state.progress >= HATCH_REQUIRED_PROGRESS &&
    state.stability >= HATCH_REQUIRED_STABILITY &&
    state.status !== "hatched"
  )
}

export function resolveIncubatorStatus(
  state: IncubatorState
): IncubatorStatus {
  if (state.status === "hatched") {
    return "hatched"
  }

  if (canHatchIncubator(state)) {
    return "ready_to_hatch"
  }

  return "incubating"
}

export function refreshIncubatorState(
  state: IncubatorState
): IncubatorState {
  const normalized = normalizeIncubatorState(state)

  return {
    ...normalized,
    status: resolveIncubatorStatus(normalized),
  }
}