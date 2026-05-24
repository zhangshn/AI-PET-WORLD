import type { HomeMapState, MapDiff } from "@/world/map-state/home-map-state-schema"

export type TownReadiness = "not_visible" | "hinted" | "road_pending" | "observable" | "stable"

export type TownState = {
  readiness: TownReadiness
  isFullyOpenAtStartup: boolean
  tags: string[]
}

export type AdoptionCenterState = {
  visibility: "not_visible" | "hint_only" | "observable" | "open"
  candidateCount: number
  tags: string[]
}

export type AdoptionCandidate = {
  candidateId: string
  displayName: string
  tags: string[]
}

export type ButlerAdoptionIntent = {
  intent: "wait" | "reject" | "review"
  reasons: string[]
  resourceScore: number
  spaceScore: number
  careScore: number
}

export type AdoptionReview = {
  reviewId: string
  status: "waiting" | "rejected" | "accepted"
  reasons: string[]
}

export type AdoptionSafeApply = {
  safeApplyId: string
  status: "blocked" | "applied"
  mapDiffs: MapDiff[]
  warnings: string[]
}

export type V26RedlineAuditInput = {
  homeMapState: HomeMapState
  isInitialWorld?: boolean
  townState?: TownState
  adoptionCenterState?: AdoptionCenterState
  adoptionCandidate?: AdoptionCandidate | null
  butlerAdoptionIntent?: ButlerAdoptionIntent | null
  adoptionReview?: AdoptionReview | null
  adoptionSafeApply?: AdoptionSafeApply | null
  playerSignalDirectPetEntry?: boolean
  visualModelGeneratedFacts?: boolean
}

export type V26RedlineAuditResult = {
  passed: boolean
  warnings: string[]
  blocked: string[]
  tags: string[]
}

const AUDIT_ONLY_BLOCKED_TOKENS = [
  "pet_actor",
  "pet_arrival",
  "pet_rest",
  "pet_bed",
  "pet-bed",
  "pet bed",
  "incubator",
  "embryo",
  "hatching",
  "hatchery",
]

export function auditV26Redlines(
  input: V26RedlineAuditInput
): V26RedlineAuditResult {
  const blocked: string[] = []
  const warnings: string[] = []
  const factTokens = collectHomeMapTokens(input.homeMapState)

  AUDIT_ONLY_BLOCKED_TOKENS.forEach((token) => {
    if (factTokens.some((item) => item.includes(token))) {
      blocked.push(`HomeMapState contains blocked startup/fact token: ${token}`)
    }
  })

  if (input.isInitialWorld && hasPetActor(input.homeMapState)) {
    blocked.push("Initial world contains a pet actor.")
  }

  if (
    input.isInitialWorld &&
    input.townState?.isFullyOpenAtStartup
  ) {
    blocked.push("Town is fully open at startup.")
  }

  if (
    input.isInitialWorld &&
    input.adoptionCenterState?.visibility === "open"
  ) {
    blocked.push("Adoption center is fully open at startup.")
  }

  if (input.visualModelGeneratedFacts) {
    blocked.push("UI/ViewModel/FormalVisualModel attempted to generate world facts.")
  }

  if (input.playerSignalDirectPetEntry) {
    blocked.push("Player signal attempted to directly add a pet world fact.")
  }

  const petFactRequested = Boolean(input.adoptionCandidate) || hasPetActor(input.homeMapState)
  const reviewAccepted = input.adoptionReview?.status === "accepted"
  const safeApplied = input.adoptionSafeApply?.status === "applied"

  if (petFactRequested && (!reviewAccepted || !safeApplied)) {
    blocked.push(
      "Pet world fact requires accepted AdoptionReview and applied AdoptionSafeApply."
    )
  }

  if (input.butlerAdoptionIntent) {
    const { resourceScore, spaceScore, careScore, intent } =
      input.butlerAdoptionIntent
    const capacityBlocked =
      resourceScore < 50 || spaceScore < 50 || careScore < 50

    if (capacityBlocked && intent === "review") {
      blocked.push(
        "Insufficient resources, space, or care capacity must return wait/reject."
      )
    }
  } else if (input.adoptionCandidate) {
    warnings.push("Adoption candidate exists without ButlerAdoptionIntent.")
  }

  return {
    passed: blocked.length === 0,
    warnings,
    blocked,
    tags: [
      "v26_redline_audit",
      "butler_first",
      "town_adoption_center_only",
      "home_map_state_safe_apply_required",
      blocked.length === 0 ? "passed" : "blocked",
    ],
  }
}

function hasPetActor(homeMapState: HomeMapState): boolean {
  return homeMapState.placements.some((placement) => {
    if (placement.layer !== "actor") return false
    const tokens = [
      placement.id,
      placement.label,
      placement.assetId,
      ...placement.tags,
    ].map((item) => String(item).toLowerCase())

    return tokens.some((token) => token.includes("pet"))
  })
}

function collectHomeMapTokens(homeMapState: HomeMapState): string[] {
  return [
    homeMapState.worldId,
    homeMapState.ownerId,
    homeMapState.seed,
    ...homeMapState.tags,
    ...homeMapState.zones.flatMap((zone) => [
      zone.id,
      zone.type,
      zone.name,
      zone.purpose,
      ...zone.tags,
    ]),
    ...homeMapState.placements.flatMap((placement) => [
      placement.id,
      placement.assetId,
      placement.label,
      placement.layer,
      placement.source,
      ...placement.tags,
    ]),
    ...homeMapState.constructionPlans.flatMap((plan) => [
      plan.id,
      plan.title,
      plan.reason,
      ...plan.tags,
    ]),
    ...homeMapState.mapDiffs.flatMap((diff) => [
      diff.id,
      diff.operation,
      diff.placementId,
      diff.reason,
      ...(diff.patch?.tags ?? []),
      ...diff.tags,
    ]),
  ].map((item) => String(item).toLowerCase())
}
