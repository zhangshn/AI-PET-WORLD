/**
 * 当前文件负责：定义小镇宠物领养中心的最小状态。
 */

export type AdoptionStatus =
  | "not_registered"
  | "registered"
  | "reviewing"
  | "assigned"
  | "preparing_arrival"
  | "ready_to_arrive"
  | "arrived"

export type AdoptionSource =
  | "town_adoption_center"
  | "system_assignment"

export type AdoptionState = {
  hasPendingPet: boolean
  pendingPetName: string
  progress: number
  readiness: number
  status: AdoptionStatus
  source: AdoptionSource
  registeredAtTick: number | null
  assignedAtTick: number | null
  arrivedAtTick: number | null
  arrivalMomentForPersonality?: {
    day: number
    hour: number
    tick: number
  } | null
  tags: string[]
}

export function buildEmptyAdoptionState(): AdoptionState {
  return {
    hasPendingPet: false,
    pendingPetName: "",
    progress: 0,
    readiness: 0,
    status: "not_registered",
    source: "system_assignment",
    registeredAtTick: null,
    assignedAtTick: null,
    arrivedAtTick: null,
    arrivalMomentForPersonality: null,
    tags: ["adoption_state_empty", "companion_deferred"],
  }
}
