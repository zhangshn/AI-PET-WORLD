/**
 * 当前文件负责：封装宠物运行更新与宠物状态日志输出。
 */

import type { HomeState } from "@/types/home"
import type { TimeState } from "../../timeSystem"
import type { PetSystem } from "@/systems/petSystem"
import type { PetState } from "@/types/pet"
import type { WorldZone } from "@/world/ecology/world-zone-types"
import {
  logPetRuntimeInactive,
  logPetRuntimeState,
} from "../world-runtime-logger"

export type RunPetRuntimeInput = {
  time: TimeState
  petSystem: PetSystem
  zones: WorldZone[]
  home?: HomeState | null
  shouldLog?: boolean
}

export type RunPetRuntimeResult = {
  pet: PetState | null
  hasPet: boolean
}

export function runPetRuntime(
  input: RunPetRuntimeInput
): RunPetRuntimeResult {
  if (!input.petSystem.hasPet()) {
    if (input.shouldLog ?? true) {
      logPetRuntimeInactive()
    }

    return {
      pet: null,
      hasPet: false,
    }
  }

  input.petSystem.update(input.time, input.zones, input.home ?? null)

  const pet = input.petSystem.getPet()

  if (pet && (input.shouldLog ?? true)) {
    logPetRuntimeState(pet)
  }

  return {
    pet,
    hasPet: true,
  }
}