/**
 * 当前文件负责：封装世界刺激生成流程，并统一处理刺激输入与日志输出。
 */

import {
  buildWorldStimuli,
  type WorldStimulus,
} from "@/ai/gateway"

import type { TimeState } from "../timeSystem"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

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

export function runWorldStimulus(input: RunWorldStimulusInput): RunWorldStimulusResult {
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

function logGeneratedWorldStimuli(stimuli: WorldStimulus[]) {
  if (stimuli.length === 0) return

  for (const item of stimuli) {
    if (item.source?.kind === "world_entity") {
      console.log(
        "🌍 世界刺激：",
        item.type,
        item.summary,
        {
          source: item.source.name ?? item.source.id,
          sourceType: item.source.type,
        }
      )
      continue
    }

    console.log("🌍 世界刺激：", item.type, item.summary)
  }
}