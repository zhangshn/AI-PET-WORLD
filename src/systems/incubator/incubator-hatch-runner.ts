/**
 * 当前文件负责：判断与执行孵化器完成孵化。
 */

import type { IncubatorState } from "@/types/incubator"

export function canHatchIncubator(incubator: IncubatorState): boolean {
  return (
    incubator.hasEmbryo &&
    incubator.progress >= 100 &&
    incubator.stability >= 60 &&
    incubator.status !== "hatched"
  )
}

export type HatchIncubatorResult = {
  incubator: IncubatorState
  petName: string | null
}

export function hatchIncubator(
  incubator: IncubatorState
): HatchIncubatorResult {
  if (!canHatchIncubator(incubator)) {
    return {
      incubator: { ...incubator },
      petName: null,
    }
  }

  return {
    incubator: {
      ...incubator,
      status: "hatched",
    },
    petName: incubator.embryoName,
  }
}