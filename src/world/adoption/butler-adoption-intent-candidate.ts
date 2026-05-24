/**
 * 当前文件职责：从领养候选观察生成管家领养意愿后置候选。
 */

import type {
  ButlerAdoptionIntentCandidate,
  TownAdoptionCandidate,
} from "./town-adoption-precheck-schema"

export function buildButlerAdoptionIntentCandidates(input: {
  townAdoptionCandidates: TownAdoptionCandidate[]
}): ButlerAdoptionIntentCandidate[] {
  return input.townAdoptionCandidates.map(buildButlerAdoptionIntentCandidate)
}

function buildButlerAdoptionIntentCandidate(
  candidate: TownAdoptionCandidate
): ButlerAdoptionIntentCandidate {
  if (candidate.kind === "construction_dependency_not_ready") {
    return buildDecision({
      candidate,
      suffix: "prepare-first",
      type: "prepare_world_first",
      canEnterAdoptionReview: false,
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

  if (candidate.kind === "adoption_candidate_later") {
    return buildDecision({
      candidate,
      suffix: "eligible-later",
      type: "eligible_later",
      canEnterAdoptionReview: false,
      reason:
        candidate.readyForButlerAdoptionIntent &&
        candidate.readiness.status === "eligible_later"
          ? "世界已记录未来未来领养机会，但 MVP 阶段仍保持后置，不创建宠物事实。"
          : "未来可能出现未来领养机会，但当前仍需要继续准备。",
      nextCheckHint:
        candidate.readiness.status === "eligible_later"
          ? "后续 TownAdoptionPrecheck 阶段可以基于候选进入更细的生命入口判断。"
          : "继续观察资源、照护准备和空间压力。",
      tags: [
        "eligible_later",
        "future_opportunity_only",
        "not_default_adoption",
        "no_actor_creation",
      ],
    })
  }

  if (candidate.kind === "observe_world_ready") {
    return buildDecision({
      candidate,
      suffix: "wait-and-observe",
      type: "wait_and_observe",
      canEnterAdoptionReview: false,
      reason:
        "世界已经具备可观察状态，但管家领养意愿仍保持等待，避免默认生成宠物事实。",
      nextCheckHint: "继续观察建设变化、资源稳定性和管家照护倾向。",
      tags: [
        "wait_and_observe",
        "world_observable",
        "not_default_adoption",
        "no_actor_creation",
      ],
    })
  }

  return buildDecision({
    candidate,
    suffix: "none",
    type: "no_adoption_intent",
    canEnterAdoptionReview: false,
    reason: "当前没有管家领养意愿候选。",
    nextCheckHint: "等待世界形成更稳定的资源、空间和建设状态。",
    tags: [
      "no_adoption_intent",
      "not_default_adoption",
      "no_actor_creation",
    ],
  })
}

function buildDecision(input: {
  candidate: TownAdoptionCandidate
  suffix: string
  type: ButlerAdoptionIntentCandidate["type"]
  canEnterAdoptionReview: boolean
  reason: string
  nextCheckHint: string
  tags: string[]
}): ButlerAdoptionIntentCandidate {
  return {
    candidateId: `${input.candidate.candidateId}-decision-${input.suffix}`,
    type: input.type,
    kind: input.type,
    worldId: input.candidate.worldId,
    ownerId: input.candidate.ownerId,
    canEnterAdoptionReview: input.canEnterAdoptionReview,
    readiness: input.candidate.readiness,
    reason: input.reason,
    blockers: input.candidate.blockers,
    nextCheckHint: input.nextCheckHint,
    tags: [
      "butler_adoption_intent_candidate",
      "town_adoption_precheck_01",
      "delayed_entry_only",
      "not_default_adoption",
      "no_actor_creation",
      ...input.tags,
    ],
  }
}