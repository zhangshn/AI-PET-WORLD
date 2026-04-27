/**
 * 当前文件负责：封装宠物运行更新与宠物状态日志输出。
 */

import type { TimeState } from "../../timeSystem"
import type { PetSystem } from "@/systems/petSystem"
import type { PetState } from "@/types/pet"
import type { WorldZone } from "@/world/ecology/world-zone-types"

export type RunPetRuntimeInput = {
  time: TimeState
  petSystem: PetSystem
  zones: WorldZone[]
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
      console.log("世界引擎：当前宠物尚未出生，宠物行为系统未激活。")
    }

    return {
      pet: null,
      hasPet: false,
    }
  }

  input.petSystem.update(input.time, input.zones)

  const pet = input.petSystem.getPet()

  if (pet && (input.shouldLog ?? true)) {
    logPetRuntimeState(pet)
  }

  return {
    pet,
    hasPet: true,
  }
}

function logPetRuntimeState(pet: PetState) {
  console.log("🐾 宠物行为：", pet.action)
  console.log(
    "📊 状态：",
    "能量",
    pet.timelineSnapshot?.state.physical.energy ?? pet.energy,
    "饥饿",
    pet.timelineSnapshot?.state.physical.hunger ?? pet.hunger,
    "情绪",
    pet.timelineSnapshot?.state.emotional.label ?? pet.mood,
    "生命阶段",
    pet.lifeState.phase
  )
}