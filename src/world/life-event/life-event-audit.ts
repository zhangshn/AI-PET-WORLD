/**
 * 当前文件职责：审计生命事件与伴生生命决策后置候选。
 */

import type {
  CompanionDecisionCandidate,
  LifeEventAudit,
  LifeEventCandidate,
  LifeEventCandidateBuilderInput,
} from "./life-event-schema"

const FORBIDDEN_LIFE_EVENT_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "pet-near-arrival-point",
  "pet-bed",
  "pet_actor",
  "incubator",
  "embryo",
  "hatching",
  "incubating",
]

export function auditLifeEventCandidates(input: {
  builderInput: LifeEventCandidateBuilderInput
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
}): LifeEventAudit {
  const warnings = [
    ...auditCandidateCompleteness(input.lifeEventCandidates),
    ...auditCompanionBoundaries(input.companionDecisionCandidates),
    ...auditReadinessConsistency(input),
    ...auditForbiddenTokens(input),
  ]
  const readinessScore = input.lifeEventCandidates[0]?.readiness.score ?? 0
  const blockerCount = input.lifeEventCandidates.reduce(
    (total, candidate) => total + candidate.blockers.length,
    0
  )

  return {
    stableLifeEventFingerprint: buildStableLifeEventFingerprint(input),
    worldId: input.builderInput.homeMapState.worldId,
    ownerId: input.builderInput.homeMapState.ownerId,
    lifeEventCandidateIds: input.lifeEventCandidates.map(
      (candidate) => candidate.candidateId
    ),
    companionDecisionCandidateIds: input.companionDecisionCandidates.map(
      (candidate) => candidate.candidateId
    ),
    readinessScore,
    blockerCount,
    warnings,
    tags: [
      "life_event_candidate_audit",
      "life_event_01",
      warnings.length === 0
        ? "life_event_candidates_valid"
        : "life_event_candidates_warning",
      "delayed_companion_entry_only",
      "no_actor_creation",
    ],
  }
}

function auditCandidateCompleteness(
  candidates: LifeEventCandidate[]
): string[] {
  const warnings: string[] = []

  if (candidates.length === 0) {
    warnings.push("LifeEvent candidate list is empty.")
  }

  candidates.forEach((candidate) => {
    if (!candidate.readiness.readinessId.trim()) {
      warnings.push(`LifeEvent candidate ${candidate.candidateId} missing readiness.`)
    }
    if (candidate.resourceReasons.length === 0) {
      warnings.push(
        `LifeEvent candidate ${candidate.candidateId} missing resource reasons.`
      )
    }
    if (candidate.worldReasons.length === 0) {
      warnings.push(
        `LifeEvent candidate ${candidate.candidateId} missing world reasons.`
      )
    }
    if (candidate.readiness.score < 0 || candidate.readiness.score > 100) {
      warnings.push(
        `LifeEvent candidate ${candidate.candidateId} readiness score out of range.`
      )
    }
  })

  return warnings
}

function auditCompanionBoundaries(
  candidates: CompanionDecisionCandidate[]
): string[] {
  return candidates.flatMap((candidate) =>
    candidate.canEnterCompanionFlow
      ? [
          `CompanionDecisionCandidate ${candidate.candidateId} cannot enter companion flow in MVP LifeEvent-01.`,
        ]
      : []
  )
}

function auditReadinessConsistency(input: {
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
}): string[] {
  const warnings: string[] = []

  input.lifeEventCandidates.forEach((candidate) => {
    const blockingCount = candidate.blockers.filter(
      (blocker) => blocker.severity === "blocking"
    ).length

    if (
      blockingCount > 0 &&
      candidate.kind === "companion_opportunity_later" &&
      candidate.readyForCompanionDecision
    ) {
      warnings.push(
        `LifeEvent candidate ${candidate.candidateId} is ready despite blocking blockers.`
      )
    }

    if (
      candidate.kind === "no_event" &&
      candidate.readiness.status === "eligible_later"
    ) {
      warnings.push(
        `LifeEvent candidate ${candidate.candidateId} should not be no_event when readiness is eligible_later.`
      )
    }
  })

  input.companionDecisionCandidates.forEach((candidate) => {
    if (
      candidate.kind === "eligible_later" &&
      candidate.readiness.status === "not_ready"
    ) {
      warnings.push(
        `Companion decision ${candidate.candidateId} cannot be eligible_later while readiness is not_ready.`
      )
    }
  })

  return warnings
}

function auditForbiddenTokens(input: {
  builderInput: LifeEventCandidateBuilderInput
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
}): string[] {
  const tokens = [
    ...input.builderInput.tags,
    ...input.lifeEventCandidates.flatMap((candidate) => [
      candidate.candidateId,
      candidate.type,
      candidate.kind,
      candidate.reason,
      candidate.readiness.status,
      candidate.readiness.recommendedNextStep,
      ...candidate.resourceReasons,
      ...candidate.worldReasons,
      ...candidate.blockers.map((blocker) => blocker.reason),
      ...candidate.tags,
    ]),
    ...input.companionDecisionCandidates.flatMap((candidate) => [
      candidate.candidateId,
      candidate.type,
      candidate.kind,
      candidate.reason,
      candidate.nextCheckHint,
      ...candidate.blockers.map((blocker) => blocker.reason),
      ...candidate.tags,
    ]),
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_LIFE_EVENT_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`LifeEvent candidate 包含禁止 token：${token}`]
      : []
  )
}

function buildStableLifeEventFingerprint(input: {
  builderInput: LifeEventCandidateBuilderInput
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
}): string {
  return [
    input.builderInput.homeMapState.worldId,
    input.builderInput.homeMapState.ownerId,
    input.builderInput.homeMapState.seed,
    String(input.builderInput.now),
    input.lifeEventCandidates
      .map(
        (candidate) =>
          `${candidate.candidateId}:${candidate.kind}:${candidate.readiness.score}:${candidate.readiness.status}`
      )
      .sort()
      .join("+"),
    input.companionDecisionCandidates
      .map(
        (candidate) =>
          `${candidate.candidateId}:${candidate.kind}:${candidate.readiness.status}`
      )
      .sort()
      .join("+"),
  ].join("::")
}