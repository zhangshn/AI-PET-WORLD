/**
 * 当前文件负责：根据宠物行为生成 timeline 状态事件输入。
 */

import type { PetAction } from "../../../types/pet"

export type PetStateEvent =
  | {
      type: "fed"
      intensity: number
    }
  | {
      type: "rested"
      intensity: number
    }
  | {
      type: "stimulated"
      intensity: number
    }
  | {
      type: "bonding"
      intensity: number
    }
  | {
      type: "disturbed"
      intensity: number
    }
  | {
      type: "time_passed"
      intensity: number
    }

export function buildPetStateEvents(action: PetAction): PetStateEvent[] {
  switch (action) {
    case "eating":
      return [
        { type: "fed", intensity: 0.6 },
        { type: "time_passed", intensity: 0.15 },
      ]

    case "sleeping":
      return [
        { type: "rested", intensity: 0.9 },
        { type: "time_passed", intensity: 0.1 },
      ]

    case "resting":
      return [
        { type: "rested", intensity: 0.6 },
        { type: "time_passed", intensity: 0.2 },
      ]

    case "exploring":
      return [
        { type: "stimulated", intensity: 1.0 },
        { type: "time_passed", intensity: 0.6 },
      ]

    case "walking":
      return [
        { type: "time_passed", intensity: 0.6 },
        { type: "stimulated", intensity: 0.35 },
      ]

    case "approaching":
      return [
        { type: "bonding", intensity: 0.45 },
        { type: "time_passed", intensity: 0.5 },
      ]

    case "alert_idle":
      return [
        { type: "disturbed", intensity: 0.4 },
        { type: "time_passed", intensity: 0.3 },
      ]

    case "observing":
      return [{ type: "time_passed", intensity: 0.35 }]

    case "idle":
    default:
      return [{ type: "time_passed", intensity: 0.25 }]
  }
}