/**
 * 当前文件负责：根据时间阶段变化生成世界时间事件。
 */

import type { WorldEvent } from "@/types/event"
import { makeWorldEvent } from "./event-factory-runner"

export type BuildTimePeriodEventsInput = {
  tick: number
  day: number
  hour: number
  prevPeriod: string
  currentPeriod: string
}

export function buildTimePeriodEvents(
  input: BuildTimePeriodEventsInput
): WorldEvent[] {
  if (input.prevPeriod === input.currentPeriod) {
    return []
  }

  return [
    makeWorldEvent({
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "time_period_changed",
      message: `时间进入了新的阶段：${input.currentPeriod}。`,
      payload: {
        prevPeriod: input.prevPeriod,
        currentPeriod: input.currentPeriod,
      },
    }),
  ]
}