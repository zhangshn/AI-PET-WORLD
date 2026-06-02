/**
 * 当前文件负责：定义世界引擎对外输出状态，并组装 UI 可消费的世界快照。
 */

import type { TimeState } from "../timeSystem"
import type { WorldStimulus } from "../../ai/ai-system-gateway"

import type { ButlerState } from "../../systems/butler/butler-schema"
import type { WorldEvent } from "../../types/event"
import type { HomeState } from "../../types/home"
import type { PetState } from "../../types/pet"

import type { WorldEcologyState } from "../../world/ecology/ecology-engine"
import type { WorldRuntimeState } from "../../world/runtime/world-runtime"
import type { WorldProgressionState } from "../../world/progression/world-progression-gateway"

export type WorldState = {
  tick: number
  time: string
  timeState: TimeState

  pet: PetState | null
  butler: ButlerState

  home: HomeState

  events: WorldEvent[]
  worldStimuli: WorldStimulus[]

  ecology: WorldEcologyState
  worldRuntime: WorldRuntimeState
  worldProgression: WorldProgressionState
}

export type BuildWorldStateInput = {
  tick: number
  formattedTime: string
  timeState: TimeState

  pet: PetState | null
  butler: ButlerState

  home: HomeState

  events: WorldEvent[]

  worldStimuli: WorldStimulus[]
  worldRuntime: WorldRuntimeState
  worldProgression: WorldProgressionState
}

export function buildWorldState(
  input: BuildWorldStateInput
): WorldState {
  return {
    tick: input.tick,
    time: input.formattedTime,
    timeState: input.timeState,

    pet: input.pet,
    butler: input.butler,

    home: input.home,

    events: input.events,

    worldStimuli: input.worldStimuli,

    ecology: input.worldRuntime.ecology,
    worldRuntime: input.worldRuntime,
    worldProgression: input.worldProgression,
  }
}
