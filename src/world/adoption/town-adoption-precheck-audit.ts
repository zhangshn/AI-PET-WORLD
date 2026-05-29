/**
 * 当前文件职责：审计小镇领养观察与管家领养意愿后置候选。
 */

import type {
  ButlerAdoptionIntent,
  TownAdoptionPrecheckAudit,
  AdoptionOpportunityObservation,
  TownAdoptionPrecheckBuilderInput,
} from "./town-adoption-precheck-schema"

export function auditAdoptionOpportunityObservations(input: {
  builderInput: TownAdoptionPrecheckBuilderInput
  adoptionOpportunityObservations: AdoptionOpportunityObservation[]
  butlerAdoptionIntents: ButlerAdoptionIntent[]
}): TownAdoptionPrecheckAudit {
  const warnings = [
    ...auditCandidateCompleteness(input.adoptionOpportunityObservations),
    ...auditAdoptionBoundaries(input.butlerAdoptionIntents),
    ...auditReadinessConsistency(input),
  ]
  const readinessScore = input.adoptionOpportunityObservations[0]?.readiness.score ?? 0
  const blockerCount = input.adoptionOpportunityObservations.reduce(
    (total, candidate) => total + candidate.blockers.length,
    0
  )

  return {
    stableTownAdoptionFingerprint: buildStableTownAdoptionFingerprint(input),
    worldId: input.builderInput.homeMapState.worldId,
    ownerId: input.builderInput.homeMapState.ownerId,
    adoptionOpportunityObservationIds: input.adoptionOpportunityObservations.map(
      (candidate) => candidate.observationId
    ),
    butlerAdoptionIntentIds: input.butlerAdoptionIntents.map(
      (candidate) => candidate.intentId
    ),
    readinessScore,
    blockerCount,
    warnings,
    tags: [
      "town_adoption_precheck_opportunity_observation_audit",
      "town_adoption_precheck_01",
      warnings.length === 0
        ? "town_adoption_precheck_opportunities_valid"
        : "town_adoption_precheck_opportunities_warning",
      "town_adoption_deferred_only",
      "no_actor_creation",
    ],
  }
}

function auditCandidateCompleteness(
  candidates: AdoptionOpportunityObservation[]
): string[] {
  const warnings: string[] = []

  if (candidates.length === 0) {
    warnings.push("Adoption opportunity observation list is empty.")
  }

  candidates.forEach((candidate) => {
    if (!candidate.readiness.readinessId.trim()) {
      warnings.push(`Adoption opportunity observation ${candidate.observationId} missing readiness.`)
    }
    if (candidate.resourceReasons.length === 0) {
      warnings.push(
        `Adoption opportunity observation ${candidate.observationId} missing resource reasons.`
      )
    }
    if (candidate.worldReasons.length === 0) {
      warnings.push(
        `Adoption opportunity observation ${candidate.observationId} missing world reasons.`
      )
    }
    if (candidate.readiness.score < 0 || candidate.readiness.score > 100) {
      warnings.push(
        `Adoption opportunity observation ${candidate.observationId} readiness score out of range.`
      )
    }
  })

  return warnings
}

function auditAdoptionBoundaries(
  candidates: ButlerAdoptionIntent[]
): string[] {
  return candidates.flatMap((candidate) =>
    candidate.canEnterAdoptionReview
      ? [
          `ButlerAdoptionIntent ${candidate.intentId} cannot enter adoption review flow in MVP TownAdoptionPrecheck-01.`,
        ]
      : []
  )
}

function auditReadinessConsistency(input: {
  adoptionOpportunityObservations: AdoptionOpportunityObservation[]
  butlerAdoptionIntents: ButlerAdoptionIntent[]
}): string[] {
  const warnings: string[] = []

  input.adoptionOpportunityObservations.forEach((candidate) => {
    const blockingCount = candidate.blockers.filter(
      (blocker) => blocker.severity === "blocking"
    ).length

    if (
      blockingCount > 0 &&
      candidate.kind === "adoption_opportunity_later" &&
      candidate.readyForButlerAdoptionIntent
    ) {
      warnings.push(
        `Adoption opportunity observation ${candidate.observationId} is ready despite blocking blockers.`
      )
    }

    if (
      candidate.kind === "no_event" &&
      candidate.readiness.status === "visit"
    ) {
      warnings.push(
        `Adoption opportunity observation ${candidate.observationId} should not be no_event when readiness is visit.`
      )
    }
  })

  input.butlerAdoptionIntents.forEach((candidate) => {
    if (
      candidate.kind === "visit" &&
      candidate.readiness.status === "not_ready"
    ) {
      warnings.push(
        `Adoption decision ${candidate.intentId} cannot be visit while readiness is not_ready.`
      )
    }
  })

  return warnings
}

function buildStableTownAdoptionFingerprint(input: {
  builderInput: TownAdoptionPrecheckBuilderInput
  adoptionOpportunityObservations: AdoptionOpportunityObservation[]
  butlerAdoptionIntents: ButlerAdoptionIntent[]
}): string {
  return [
    input.builderInput.homeMapState.worldId,
    input.builderInput.homeMapState.ownerId,
    input.builderInput.homeMapState.seed,
    String(input.builderInput.now),
    input.adoptionOpportunityObservations
      .map(
        (candidate) =>
          `${candidate.observationId}:${candidate.kind}:${candidate.readiness.score}:${candidate.readiness.status}`
      )
      .sort()
      .join("+"),
    input.butlerAdoptionIntents
      .map(
        (candidate) =>
          `${candidate.intentId}:${candidate.kind}:${candidate.readiness.status}`
      )
      .sort()
      .join("+"),
  ].join("::")
}
