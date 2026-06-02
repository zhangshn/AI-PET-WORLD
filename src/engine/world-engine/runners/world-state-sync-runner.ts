/**
 * 当前文件职责：统一从各系统读取当前世界状态。
 */

import type { ButlerState } from "@/systems/butler/butler-schema"
import type { HomeState } from "@/types/home"
import type { PetState } from "@/types/pet"
import type { PetSystem } from "@/systems/petSystem"

import type {
  ButlerSystem,
  HomeSystem,
} from "@/systems/systems-gateway"

export type WorldSystemStateSnapshot = {
  pet: PetState | null
  butler: ButlerState
  home: HomeState
}

export type RefreshWorldSystemStateInput = {
  petSystem: PetSystem
  butlerSystem: ButlerSystem
  homeSystem: HomeSystem
}

export function refreshWorldSystemState(
  input: RefreshWorldSystemStateInput
): WorldSystemStateSnapshot {
  return {
    pet: input.petSystem.getPet(),
    butler: input.butlerSystem.getState(),
    home: input.homeSystem.getHome(),
  }
}
