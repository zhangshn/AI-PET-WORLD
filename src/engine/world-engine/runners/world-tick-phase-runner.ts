/**
 * 当前文件负责：封装世界事件系统在每个 Tick 后的统一更新输入。
 */

import type { TimeState } from "../../timeSystem"
import type { EventSystem } from "@/systems/eventSystem"
import type { ButlerState } from "@/systems/butler/butler-schema"
import type { PetState } from "@/types/pet"

export type RunWorldEventUpdateInput = {
  tick: number
  prevTime: TimeState
  currentTime: TimeState
  prevPet: PetState | null
  currentPet: PetState | null
  prevButler: ButlerState
  currentButler: ButlerState
  eventSystem: EventSystem
}

export function runWorldEventUpdate(input: RunWorldEventUpdateInput): void {
  input.eventSystem.update({
    tick: input.tick,
    day: input.currentTime.day,
    hour: input.currentTime.hour,
    prevPeriod: input.prevTime.period,
    currentPeriod: input.currentTime.period,
    prevPet: input.prevPet,
    currentPet: input.currentPet,
    prevButler: input.prevButler,
    currentButler: input.currentButler,
  })
}
