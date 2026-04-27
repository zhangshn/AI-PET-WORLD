/**
 * 当前文件负责：根据孵化器状态变化生成孵化器事件。
 */

import type { WorldEvent } from "@/types/event"
import type { IncubatorState } from "@/types/incubator"
import { makeWorldEvent } from "./event-factory-runner"

export type BuildIncubatorEventsInput = {
  tick: number
  day: number
  hour: number
  prevIncubator: IncubatorState
  currentIncubator: IncubatorState
}

export function buildIncubatorEvents(
  input: BuildIncubatorEventsInput
): WorldEvent[] {
  if (input.prevIncubator.progress === input.currentIncubator.progress) {
    return []
  }

  const added = input.currentIncubator.progress - input.prevIncubator.progress

  if (added <= 0) {
    return []
  }

  return [
    makeWorldEvent({
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "incubator_progress_changed",
      message: "孵化器的进度又向前推进了一些。",
      payload: {
        addedProgress: added,
        progress: input.currentIncubator.progress,
      },
    }),
  ]
}