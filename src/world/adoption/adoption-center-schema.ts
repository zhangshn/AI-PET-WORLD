/**
 * 当前文件负责：定义小镇宠物领养中心的最小状态。
 */

export type AdoptionStatus =
  | "town_not_visible"
  | "center_not_visible"
  | "center_observable"
  | "opportunity_observable"
  | "butler_reviewing"
  | "waiting"
  | "rejected"
  | "accepted_applied"

export type AdoptionSource = "town_adoption_center"

export type AdoptionState = {
  hasOpportunityObservation: boolean
  opportunityObservationLabel: string
  progress: number
  readiness: number
  status: AdoptionStatus
  source: AdoptionSource
  registeredAtTick: number | null
  reviewStartedAtTick: number | null
  acceptedAtTick: number | null
  appliedAtTick: number | null
  adoptionMomentForPersonality?: {
    day: number
    hour: number
    tick: number
  } | null
  tags: string[]
}

export function buildEmptyAdoptionState(): AdoptionState {
  return {
    hasOpportunityObservation: false,
    opportunityObservationLabel: "",
    progress: 0,
    readiness: 0,
    status: "town_not_visible",
    source: "town_adoption_center",
    registeredAtTick: null,
    reviewStartedAtTick: null,
    acceptedAtTick: null,
    appliedAtTick: null,
    adoptionMomentForPersonality: null,
    tags: [
      "adoption_state_empty",
      "town_adoption_center_deferred",
      "no_pet_fact_before_review",
    ],
  }
}
