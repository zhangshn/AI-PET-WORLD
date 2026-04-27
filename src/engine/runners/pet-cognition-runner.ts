/**
 * 当前文件负责：封装宠物感知世界刺激、生成认知结果并写入事件系统的流程。
 */

import type { WorldStimulus } from "@/ai/gateway"
import type { TimeState } from "../timeSystem"
import type { PetSystem } from "@/systems/petSystem"
import type { EventSystem } from "@/systems/eventSystem"

export type RunPetCognitionInput = {
  tick: number
  time: TimeState
  petSystem: PetSystem
  eventSystem: EventSystem
  latestStimuli: WorldStimulus[]
  shouldLog?: boolean
}

export function runPetCognition(input: RunPetCognitionInput) {
  if (!input.petSystem.hasPet()) return
  if (input.latestStimuli.length === 0) return

  const cognitionResults = input.petSystem.perceiveWorldStimuli(
    input.latestStimuli,
    {
      day: input.time.day,
      hour: input.time.hour,
      period: input.time.period,
    }
  )

  for (const result of cognitionResults) {
    if (input.shouldLog ?? true) {
      console.log("🧠 宠物认知：", result.summary)
    }

    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message: result.summary,
    })
  }
}