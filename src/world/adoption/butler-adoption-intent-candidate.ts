/**
 * 当前文件职责：从领养机会观察生成管家领养意愿后置候选。
 */

import type {
  ButlerAdoptionIntent,
  AdoptionOpportunityObservation,
} from "./town-adoption-precheck-schema"

export function buildButlerAdoptionIntents(input: {
  adoptionOpportunityObservations: AdoptionOpportunityObservation[]
}): ButlerAdoptionIntent[] {
  return input.adoptionOpportunityObservations.map(buildButlerAdoptionIntent)
}

function buildButlerAdoptionIntent(
  observation: AdoptionOpportunityObservation
): ButlerAdoptionIntent {
  if (observation.kind === "construction_dependency_not_ready") {
    return buildDecision({
      observation,
      suffix: "prepare-first",
      type: "consider",
      canEnterAdoptionReview: false,
      reason:
        "家园准备条件尚未满足，管家会优先继续建设、整理资源和降低空间压力。",
      nextCheckHint: "等待下一次建设 Tick 后重新评估。",
      tags: [
        "consider",
        "construction_dependency_not_ready",
        "resource_space_first",
      ],
    })
  }

  if (observation.kind === "adoption_opportunity_later") {
    return buildDecision({
      observation,
      suffix: "eligible-later",
      type: "visit",
      canEnterAdoptionReview: false,
      reason:
        observation.readyForButlerAdoptionIntent &&
        observation.readiness.status === "visit"
          ? "世界已记录未来未来领养机会，但 MVP 阶段仍保持后置，不创建宠物事实。"
          : "未来可能出现未来领养机会，但当前仍需要继续准备。",
      nextCheckHint:
        observation.readiness.status === "visit"
          ? "后续 TownAdoptionPrecheck 阶段可以基于候选进入更细的生命入口判断。"
          : "继续观察资源、照护准备和空间压力。",
      tags: [
        "visit",
        "future_opportunity_only",
        "not_default_adoption",
        "no_actor_creation",
      ],
    })
  }

  if (observation.kind === "observe_world_ready") {
    return buildDecision({
      observation,
      suffix: "wait-and-observe",
      type: "wait",
      canEnterAdoptionReview: false,
      reason:
        "世界已经具备可观察状态，但管家领养意愿仍保持等待，避免默认生成宠物事实。",
      nextCheckHint: "继续观察建设变化、资源稳定性和管家照护倾向。",
      tags: [
        "wait",
        "world_observable",
        "not_default_adoption",
        "no_actor_creation",
      ],
    })
  }

  return buildDecision({
    observation,
    suffix: "none",
    type: "wait",
    canEnterAdoptionReview: false,
    reason: "当前没有管家领养意愿。",
    nextCheckHint: "等待世界形成更稳定的资源、空间和建设状态。",
    tags: [
      "wait",
      "not_default_adoption",
      "no_actor_creation",
    ],
  })
}

function buildDecision(input: {
  observation: AdoptionOpportunityObservation
  suffix: string
  type: ButlerAdoptionIntent["type"]
  canEnterAdoptionReview: boolean
  reason: string
  nextCheckHint: string
  tags: string[]
}): ButlerAdoptionIntent {
  return {
    intentId: `${input.observation.candidateId}-intent-${input.suffix}`,
    type: input.type,
    kind: input.type,
    worldId: input.observation.worldId,
    ownerId: input.observation.ownerId,
    canEnterAdoptionReview: input.canEnterAdoptionReview,
    readiness: input.observation.readiness,
    reason: input.reason,
    blockers: input.observation.blockers,
    nextCheckHint: input.nextCheckHint,
    tags: [
      "butler_adoption_intent",
      "town_adoption_precheck_01",
      "delayed_entry_only",
      "not_default_adoption",
      "no_actor_creation",
      ...input.tags,
    ],
  }
}
