/**
 * 当前文件职责：保留旧完整 world tick runner 的兼容占位。
 *
 * 当前 M11 主链路不通过这里运行旧宠物 runtime、旧宠物认知或旧完整 world tick。
 */

import type { TimeState } from "../../timeSystem"
import type { WorldStimulus } from "@/ai/ai-system-gateway"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

export type RunWorldTickInput = {
  tick: number
  prevTime: TimeState
  currentTime: TimeState
  worldStimuli: WorldStimulus[]
  worldRuntime: WorldRuntimeState
}

export type RunWorldTickResult = {
  worldStimuli: WorldStimulus[]
  worldRuntime: WorldRuntimeState
}

export function runWorldTick(input: RunWorldTickInput): RunWorldTickResult {
  return {
    worldStimuli: input.worldStimuli,
    worldRuntime: input.worldRuntime,
  }
}
