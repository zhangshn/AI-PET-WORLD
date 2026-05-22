/**
 * 当前文件职责：审计生命事件与伙伴决策后置候选。
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
    ...auditCompanionBoundaries(input.companionDecisionCandidates),
    ...auditForbiddenTokens(input),
  ]

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
    warnings,
    tags: [
      "life_event_candidate_audit",
      warnings.length === 0
        ? "life_event_candidates_valid"
        : "life_event_candidates_warning",
      "delayed_companion_entry_only",
      "no_actor_creation",
    ],
  }
}

function auditCompanionBoundaries(
  candidates: CompanionDecisionCandidate[]
): string[] {
  return candidates.flatMap((candidate) =>
    candidate.canEnterCompanionFlow
      ? [
          `CompanionDecisionCandidate ${candidate.candidateId} cannot enter companion flow in this stage.`,
        ]
      : []
  )
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
      candidate.reason,
      ...candidate.tags,
    ]),
    ...input.companionDecisionCandidates.flatMap((candidate) => [
      candidate.candidateId,
      candidate.reason,
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
      .map((candidate) => `${candidate.candidateId}:${candidate.kind}`)
      .sort()
      .join("+"),
    input.companionDecisionCandidates
      .map((candidate) => `${candidate.candidateId}:${candidate.kind}`)
      .sort()
      .join("+"),
  ].join("::")
}
