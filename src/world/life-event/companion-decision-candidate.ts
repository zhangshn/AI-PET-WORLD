/**
 * 当前文件职责：从生命事件候选生成伴生生命决策后置候选。
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
  if (candidate.kind === "construction_dependency_not_ready") {
    return buildDecision({
      candidate,
      suffix: "prepare-first",
      type: "prepare_world_first",
      canEnterCompanionFlow: false,
      reason:
        "家园准备条件尚未满足，管家会优先继续建设、整理资源和降低空间压力。",
      nextCheckHint: "等待下一次建设 Tick 后重新评估。",
      tags: [
        "prepare_world_first",
        "construction_dependency_not_ready",
        "resource_space_first",
      ],
    })
  }

  if (candidate.kind === "companion_opportunity_later") {
    return buildDecision({
      candidate,
      suffix: "eligible-later",
      type: "eligible_later",
      canEnterCompanionFlow: false,
      reason:
        candidate.readyForCompanionDecision &&
        candidate.readiness.status === "eligible_later"
          ? "世界已记录未来伴生生命机会，但 MVP 阶段仍保持后置，不创建生命体。"
          : "未来可能出现伴生生命机会，但当前仍需要继续准备。",
      nextCheckHint:
        candidate.readiness.status === "eligible_later"
          ? "后续 LifeEvent 阶段可以基于候选进入更细的生命入口判断。"
          : "继续观察资源、照护准备和空间压力。",
      tags: [
        "eligible_later",
        "future_opportunity_only",
        "not_default_companion",
        "no_actor_creation",
      ],
    })
  }

  if (candidate.kind === "observe_world_ready") {
    return buildDecision({
      candidate,
      suffix: "wait-and-observe",
      type: "wait_and_observe",
      canEnterCompanionFlow: false,
      reason:
        "世界已经具备可观察状态，但伴生生命决策仍保持等待，避免默认生成生命事实。",
      nextCheckHint: "继续观察建设变化、资源稳定性和管家照护倾向。",
      tags: [
        "wait_and_observe",
        "world_observable",
        "not_default_companion",
        "no_actor_creation",
      ],
    })
  }

  return buildDecision({
    candidate,
    suffix: "none",
    type: "no_companion_decision",
    canEnterCompanionFlow: false,
    reason: "当前没有伴生生命决策候选。",
    nextCheckHint: "等待世界形成更稳定的资源、空间和建设状态。",
    tags: [
      "no_companion_decision",
      "not_default_companion",
      "no_actor_creation",
    ],
  })
}

function buildDecision(input: {
  candidate: LifeEventCandidate
  suffix: string
  type: CompanionDecisionCandidate["type"]
  canEnterCompanionFlow: boolean
  reason: string
  nextCheckHint: string
  tags: string[]
}): CompanionDecisionCandidate {
  return {
    candidateId: `${input.candidate.candidateId}-decision-${input.suffix}`,
    type: input.type,
    kind: input.type,
    worldId: input.candidate.worldId,
    ownerId: input.candidate.ownerId,
    canEnterCompanionFlow: input.canEnterCompanionFlow,
    readiness: input.candidate.readiness,
    reason: input.reason,
    blockers: input.candidate.blockers,
    nextCheckHint: input.nextCheckHint,
    tags: [
      "companion_decision_candidate",
      "life_event_01",
      "delayed_entry_only",
      "not_default_companion",
      "no_actor_creation",
      ...input.tags,
    ],
  }
}