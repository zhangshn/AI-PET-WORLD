/**
 * 当前文件负责：定义世界引擎对外输出状态，并组装 UI 可消费的世界快照。
 */

import type { TimeState } from "../timeSystem"
import type { WorldStimulus } from "../../ai/gateway"

import type { ButlerState } from "../../types/butler"
import type { WorldEvent } from "../../types/event"
import type { HomeState } from "../../types/home"
import type { IncubatorState } from "../../types/incubator"
import type { PetState } from "../../types/pet"

import type { WorldEcologyState } from "../../world/ecology/ecology-engine"
import type { WorldRuntimeState } from "../../world/runtime/world-runtime"

export type WorldState = {
  tick: number
  time: string
  timeState: TimeState

  pet: PetState | null
  butler: ButlerState

  home: HomeState
  incubator: IncubatorState

  events: WorldEvent[]
  worldStimuli: WorldStimulus[]

  ecology: WorldEcologyState
  worldRuntime: WorldRuntimeState
}

export type BuildWorldStateInput = {
  tick: number
  formattedTime: string
  timeState: TimeState

  pet: PetState | null
  butler: ButlerState

  home: HomeState
  incubator: IncubatorState

  events: WorldEvent[]

  worldStimuli: WorldStimulus[]
  worldRuntime: WorldRuntimeState
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
    incubator: input.incubator,

    events: input.events,

    worldStimuli: input.worldStimuli,

    ecology: input.worldRuntime.ecology,
    worldRuntime: input.worldRuntime,
  }
}