/**
 * 当前文件负责：封装世界刺激生成流程，并统一处理刺激输入与日志输出。
 */

import {
  buildWorldStimuli,
  type WorldStimulus,
} from "@/ai/ai-system-gateway"

import type { TimeState } from "../../timeSystem"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import { logGeneratedWorldStimuli } from "../world-runtime-logger"

export type RunWorldStimulusInput = {
  tick: number
  time: TimeState
  worldRuntime: WorldRuntimeState
  existingStimuli: WorldStimulus[]
  shouldLog?: boolean
}

export type RunWorldStimulusResult = {
  activeStimuli: WorldStimulus[]
  latestGenerated: WorldStimulus[]
}

export function runWorldStimulus(
  input: RunWorldStimulusInput
): RunWorldStimulusResult {
  const stimulusState = buildWorldStimuli({
    tick: input.tick,

    time: {
      day: input.time.day,
      hour: input.time.hour,
      period: input.time.period,
    },

    ecology: input.worldRuntime.ecology,
    worldRuntime: input.worldRuntime,

    existingStimuli: input.existingStimuli,
  })

  if (input.shouldLog ?? true) {
    logGeneratedWorldStimuli(stimulusState.latestGenerated)
  }

  return {
    activeStimuli: stimulusState.activeStimuli,
    latestGenerated: stimulusState.latestGenerated,
  }
}