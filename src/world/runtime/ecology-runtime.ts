/**
 * 当前文件负责：把 ecology-engine 的环境状态包装成 world runtime 可消费状态。
 */

import {
  buildNextWorldEcologyState,
  type WorldEcologyState,
} from "../ecology/ecology-engine"
import type { TimeState } from "../../engine/timeSystem"

export function stepEcologyRuntime(input: {
  tick: number
  time: TimeState
  previous: WorldEcologyState
}): WorldEcologyState {
  return buildNextWorldEcologyState({
    tick: input.tick,
    time: input.time,
    previousEnvironment: input.previous.environment,
    previousZones: input.previous.zones,
  })
}