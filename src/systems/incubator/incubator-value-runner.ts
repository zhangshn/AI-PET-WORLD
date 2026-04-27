/**
 * 当前文件负责：限制孵化器数值范围。
 */

import type { IncubatorState } from "@/types/incubator"
import { clamp } from "./incubator-utils"

export function clampIncubatorValues(
  incubator: IncubatorState
): IncubatorState {
  return {
    ...incubator,
    progress: clamp(incubator.progress),
    stability: clamp(incubator.stability),
  }
}