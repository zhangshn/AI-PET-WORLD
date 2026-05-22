/**
 * 褰撳墠鏂囦欢璐熻矗锛氱粺涓€浠庡悇绯荤粺璇诲彇褰撳墠涓栫晫鐘舵€侊紝閬垮厤 worldEngine 涓噸澶嶆暎钀?getState/getHome/getPet 璋冪敤銆?
 */

import type { ButlerState } from "@/types/butler"
import type { HomeState } from "@/types/home"
import type { PetState } from "@/types/pet"

import type {
  PetSystem,
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
