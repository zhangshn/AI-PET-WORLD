/**
 * 当前文件负责：把旧孵化器状态兼容映射为领养 / 抵达状态。
 */

import type {
  IncubatorState,
  IncubatorStatus,
} from "@/types/incubator"

import type {
  AdoptionState,
  AdoptionStatus,
} from "./adoption-center-schema"

type BuildAdoptionStateFromIncubatorContext = {
  tick?: number
  day?: number
  hour?: number
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

function mapIncubatorStatusToAdoptionStatus(
  status: IncubatorStatus | null
): AdoptionStatus {
  if (status === "incubating") return "preparing_arrival"
  if (status === "ready_to_hatch") return "ready_to_arrive"
  if (status === "hatched") return "arrived"

  return "not_registered"
}

function buildArrivalMoment(input: {
  status: AdoptionStatus
  context?: BuildAdoptionStateFromIncubatorContext
}): AdoptionState["arrivalMomentForPersonality"] {
  void input

  return null
}

export function buildAdoptionStateFromIncubator(
  incubator: IncubatorState | null,
  context?: BuildAdoptionStateFromIncubatorContext
): AdoptionState {
  if (!incubator) {
    return {
      hasPendingPet: false,
      pendingPetName: "",
      progress: 0,
      readiness: 0,
      status: "not_registered",
      source: "town_adoption_center",
      registeredAtTick: null,
      assignedAtTick: null,
      arrivedAtTick: null,
      arrivalMomentForPersonality: null,
      tags: [
        "adoption_state",
        "adoption_not_registered",
        "legacy_incubator_missing",
      ],
    }
  }

  const status = mapIncubatorStatusToAdoptionStatus(incubator.status)
  const hasPendingPet =
    incubator.hasEmbryo && incubator.status !== "hatched"

  return {
    hasPendingPet,
    pendingPetName: incubator.embryoName,
    progress: clampPercent(incubator.progress),
    readiness: clampPercent(incubator.stability),
    status,
    source: "town_adoption_center",
    registeredAtTick: null,
    assignedAtTick: null,
    arrivedAtTick: null,
    arrivalMomentForPersonality: buildArrivalMoment({
      status,
      context,
    }),
    tags: [
      "adoption_state",
      "legacy_incubator_adapter",
      `adoption_status_${status}`,
      `legacy_incubator_status_${incubator.status}`,
      incubator.hasEmbryo
        ? "legacy_has_embryo_retained"
        : "legacy_has_no_embryo",
      hasPendingPet ? "has_pending_pet" : "no_pending_pet",
      status === "arrived"
        ? "arrival_moment_not_recorded"
        : "arrival_moment_pending",
    ],
  }
}
