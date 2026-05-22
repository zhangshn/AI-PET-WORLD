/**
 * 当前文件职责：从生命事件候选生成伙伴决策后置候选。
 */

import type {
  CompanionDecisionCandidate,
  LifeEventCandidate,
} from "./life-event-schema"

export function buildCompanionDecisionCandidates(input: {
  lifeEventCandidates: LifeEventCandidate[]
}): CompanionDecisionCandidate[] {
  return input.lifeEventCandidates.map(buildCompanionDecisionCandidate)
}

function buildCompanionDecisionCandidate(
  candidate: LifeEventCandidate
): CompanionDecisionCandidate {
  if (
    candidate.kind === "companion_opportunity_later" &&
    candidate.readyForCompanionDecision
  ) {
    return {
      candidateId: `${candidate.candidateId}-decision-later`,
      kind: "eligible_later",
      worldId: candidate.worldId,
      ownerId: candidate.ownerId,
      canEnterCompanionFlow: false,
      reason: "伙伴机会仅作为后置候选记录，本阶段不让伙伴进入世界。",
      tags: [
        "companion_decision_candidate",
        "delayed_entry_only",
        "not_default_companion",
        "no_actor_creation",
      ],
    }
  }

  if (candidate.kind === "observe_world_ready") {
    return {
      candidateId: `${candidate.candidateId}-decision-observe`,
      kind: "wait_and_observe",
      worldId: candidate.worldId,
      ownerId: candidate.ownerId,
      canEnterCompanionFlow: false,
      reason: "世界已可观察，但伙伴决策仍需等待并观察后续生命关系事件。",
      tags: [
        "companion_decision_candidate",
        "wait_and_observe",
        "not_default_companion",
        "no_actor_creation",
      ],
    }
  }

  return {
    candidateId: `${candidate.candidateId}-decision-none`,
    kind: "no_companion_decision",
    worldId: candidate.worldId,
    ownerId: candidate.ownerId,
    canEnterCompanionFlow: false,
    reason: "当前没有伙伴决策候选。",
    tags: [
      "companion_decision_candidate",
      "no_companion_decision",
      "not_default_companion",
      "no_actor_creation",
    ],
  }
}
