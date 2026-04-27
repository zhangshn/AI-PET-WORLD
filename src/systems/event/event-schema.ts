/**
 * 当前文件负责：定义事件系统内部使用的输入类型与连续叙事状态类型。
 */

import type { PersonalityProfile } from "@/ai/ziwei-core/schema"
import type { ButlerState } from "@/types/butler"
import type { WorldEvent, NarrativeType } from "@/types/event"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState, PetAction } from "@/types/pet"

export type EventSystemUpdateInput = {
  tick: number
  day: number
  hour: number

  prevPeriod: string
  currentPeriod: string

  prevPet: PetState | null
  currentPet: PetState | null

  prevButler: ButlerState
  currentButler: ButlerState

  prevIncubator: IncubatorState
  currentIncubator: IncubatorState
}

export type InteractionEventInput = {
  tick: number
  day: number
  hour: number
  message: string
}

export type PetHatchedEventInput = {
  tick: number
  day: number
  hour: number
  petName: string
}

export type PetStateLike = PetState & {
  id?: string
  personalityProfile: PersonalityProfile
}

export type ContinuityState = {
  continuityId: string
  step: number
  action: PetAction
  narrativeType: NarrativeType
  drivePrimary: string | null
  sourceDrive: string | null
  lastTick: number
}

export type MakeWorldEventInput = {
  tick: number
  day: number
  hour: number
  type: string
  petName?: string
  message: string
  sourceAction?: string
  narrativeType?: NarrativeType
  continuityId?: string
  intensity?: number
  payload?: Record<string, unknown>
}

export type BuildHomeContextInput = {
  home?: HomeState
}

export type MakeWorldEventResult = WorldEvent