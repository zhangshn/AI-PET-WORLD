/**
 * 当前文件负责：解析宠物与管家的舞台目标位置和移动速度。
 */

import type { ActiveBehaviorProcess } from "@/ai/behavior-core/behavior-types"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

import type { SyncCoreActorsInput } from "./actor-types"
import { shouldKeepPetNearShelter } from "./stage-pet-visibility"
import { getActiveZonePosition } from "../zones/stage-zone-renderer"

const PET_CENTER_ZONE = { x: 620, y: 420 }
const PET_EXPLORE_ZONE_A = { x: 980, y: 350 }
const PET_EXPLORE_ZONE_B = { x: 1120, y: 620 }
const PET_OBSERVE_ZONE = { x: 760, y: 455 }
const PET_ALERT_ZONE = { x: 680, y: 420 }
const PET_IDLE_ZONE = { x: 640, y: 430 }
const PET_SLEEP_ZONE = { x: 1090, y: 600 }
const PET_REST_ZONE = { x: 1040, y: 590 }
const PET_EAT_ZONE = { x: 720, y: 570 }
const PET_APPROACH_ZONE = { x: 560, y: 440 }
const PET_SHELTER_YARD_ZONE = { x: 610, y: 360 }
const PET_SHELTER_DOOR_ZONE = { x: 555, y: 390 }

const BUTLER_HOME_ZONE = { x: 900, y: 540 }
const BUTLER_IDLE_ZONE = { x: 520, y: 420 }
const BUTLER_SHELTER_CARE_ZONE = { x: 455, y: 340 }
const BUTLER_SHELTER_DOOR_ZONE = { x: 520, y: 380 }

export function getPetTargetPosition(input: {
  pet: PetState | null
  incubator: IncubatorState | null
  ecology: WorldEcologyState | null
  tick: number
}): { x: number; y: number } {
  if (!input.pet) return PET_CENTER_ZONE

  if (
    shouldKeepPetNearShelter({
      pet: input.pet,
      incubator: input.incubator,
    })
  ) {
    return input.tick % 2 === 0 ? PET_SHELTER_YARD_ZONE : PET_SHELTER_DOOR_ZONE
  }

  const lifePhase = input.pet.lifeState?.phase

  if (lifePhase === "dependent" && input.pet.action === "exploring") {
    return PET_OBSERVE_ZONE
  }

  if (input.pet.action === "sleeping") {
    return getActiveZonePosition(input.ecology, "sleep_zone") ?? PET_SLEEP_ZONE
  }

  if (input.pet.action === "eating") {
    return getActiveZonePosition(input.ecology, "food_zone") ?? PET_EAT_ZONE
  }

  if (input.pet.action === "resting") {
    return (
      getActiveZonePosition(input.ecology, "quiet_zone") ??
      getActiveZonePosition(input.ecology, "warm_zone") ??
      PET_REST_ZONE
    )
  }

  if (input.pet.action === "observing") {
    return (
      getActiveZonePosition(input.ecology, "observation_zone") ??
      PET_OBSERVE_ZONE
    )
  }

  if (input.pet.action === "exploring") {
    return input.tick % 2 === 0 ? PET_EXPLORE_ZONE_A : PET_EXPLORE_ZONE_B
  }

  if (input.pet.action === "approaching") return PET_APPROACH_ZONE
  if (input.pet.action === "alert_idle") return PET_ALERT_ZONE
  if (input.pet.action === "idle") return PET_IDLE_ZONE

  return PET_CENTER_ZONE
}

export function getButlerTargetPosition(
  input: SyncCoreActorsInput
): { x: number; y: number } {
  const petPhase = input.pet?.lifeState?.phase

  if (input.butler?.task === "watching_incubator") {
    if (input.incubator?.status === "hatched") {
      return petPhase === "newborn"
        ? BUTLER_SHELTER_CARE_ZONE
        : BUTLER_SHELTER_DOOR_ZONE
    }

    return (
      getActiveZonePosition(input.ecology, "incubator_zone") ??
      BUTLER_SHELTER_CARE_ZONE
    )
  }

  if (input.butler?.task === "building_home") {
    return (
      getActiveZonePosition(input.ecology, "home_build_zone") ??
      BUTLER_HOME_ZONE
    )
  }

  if (petPhase === "newborn" || petPhase === "adaptation") {
    return BUTLER_SHELTER_DOOR_ZONE
  }

  return BUTLER_IDLE_ZONE
}

export function getPetBaseSpeed(
  action?: PetState["action"],
  process?: ActiveBehaviorProcess | null,
  lifePhase?: string
): number {
  let baseSpeed = 0.7

  if (action === "exploring") baseSpeed = 1.8
  if (action === "walking") baseSpeed = 1.5
  if (action === "approaching") baseSpeed = 1.25
  if (action === "observing") baseSpeed = 0.55

  if (action === "eating" || action === "sleeping" || action === "resting") {
    baseSpeed = 0.35
  }

  if (process?.stage === "peak") baseSpeed *= 1.28
  if (process?.stage === "cooldown") baseSpeed *= 0.72

  if (lifePhase === "newborn") baseSpeed *= 0.28
  if (lifePhase === "adaptation") baseSpeed *= 0.45
  if (lifePhase === "dependent") baseSpeed *= 0.65

  return baseSpeed
}

export function getButlerBaseSpeed(task?: ButlerState["task"]): number {
  if (task === "watching_incubator") return 1.15
  if (task === "building_home") return 1.2

  return 0.85
}