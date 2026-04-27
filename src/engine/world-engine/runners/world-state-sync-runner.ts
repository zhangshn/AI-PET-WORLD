/**
 * 当前文件负责：统一从各系统读取当前世界状态，避免 worldEngine 中重复散落 getState/getHome/getPet/getIncubator 调用。
 */

import type { ButlerState } from "@/types/butler"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

import type {
  PetSystem,
  ButlerSystem,
  HomeSystem,
  IncubatorSystem,
} from "@/systems/systems-gateway"

export type WorldSystemStateSnapshot = {
  pet: PetState | null
  butler: ButlerState
  home: HomeState
  incubator: IncubatorState
}

export type RefreshWorldSystemStateInput = {
  petSystem: PetSystem
  butlerSystem: ButlerSystem
  homeSystem: HomeSystem
  incubatorSystem: IncubatorSystem
}

export function refreshWorldSystemState(
  input: RefreshWorldSystemStateInput
): WorldSystemStateSnapshot {
  return {
    pet: input.petSystem.getPet(),
    butler: input.butlerSystem.getState(),
    home: input.homeSystem.getHome(),
    incubator: input.incubatorSystem.getIncubator(),
  }
}