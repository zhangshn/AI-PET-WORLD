/**
 * 当前文件负责：由管家 Profile 解释关系事实，并转换成任务选择层可读取的轻量调参。
 */

import type { ButlerProfile } from "@/ai/gateway"

import type { ButlerRelationState } from "./butler-relation"

export type ButlerRelationTaskTuning = {
  carePriorityOffset: number
  constructionDriveOffset: number
  foodSensitivityOffset: number
  restSensitivityOffset: number
  approachSensitivityOffset: number
  observationBiasOffset: number
}

export type ButlerRelationTaskTuningInput = {
  relation: ButlerRelationState | null | undefined
  profile: ButlerProfile | null | undefined
}

const DEFAULT_TUNING: ButlerRelationTaskTuning = {
  carePriorityOffset: 0,
  constructionDriveOffset: 0,
  foodSensitivityOffset: 0,
  restSensitivityOffset: 0,
  approachSensitivityOffset: 0,
  observationBiasOffset: 0,
}

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(-14, Math.min(14, Math.round(value)))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

function normalizeInput(
  input:
    | ButlerRelationTaskTuningInput
    | ButlerRelationState
    | null
    | undefined
): ButlerRelationTaskTuningInput {
  if (!input) {
    return {
      relation: null,
      profile: null,
    }
  }

  if ("relation" in input) {
    return {
      relation: input.relation,
      profile: input.profile,
    }
  }

  return {
    relation: input,
    profile: null,
  }
}

function addTuning(
  base: ButlerRelationTaskTuning,
  delta: Partial<ButlerRelationTaskTuning>
): ButlerRelationTaskTuning {
  return {
    carePriorityOffset:
      base.carePriorityOffset + (delta.carePriorityOffset ?? 0),
    constructionDriveOffset:
      base.constructionDriveOffset +
      (delta.constructionDriveOffset ?? 0),
    foodSensitivityOffset:
      base.foodSensitivityOffset +
      (delta.foodSensitivityOffset ?? 0),
    restSensitivityOffset:
      base.restSensitivityOffset +
      (delta.restSensitivityOffset ?? 0),
    approachSensitivityOffset:
      base.approachSensitivityOffset +
      (delta.approachSensitivityOffset ?? 0),
    observationBiasOffset:
      base.observationBiasOffset +
      (delta.observationBiasOffset ?? 0),
  }
}

function finalizeTuning(
  tuning: ButlerRelationTaskTuning
): ButlerRelationTaskTuning {
  return {
    carePriorityOffset: clampOffset(tuning.carePriorityOffset),
    constructionDriveOffset: clampOffset(tuning.constructionDriveOffset),
    foodSensitivityOffset: clampOffset(tuning.foodSensitivityOffset),
    restSensitivityOffset: clampOffset(tuning.restSensitivityOffset),
    approachSensitivityOffset: clampOffset(tuning.approachSensitivityOffset),
    observationBiasOffset: clampOffset(tuning.observationBiasOffset),
  }
}

function getTrustLevel(relation: ButlerRelationState): number {
  return clamp01(relation.trustEstimate / 80)
}

function getFamiliarityLevel(relation: ButlerRelationState): number {
  return clamp01(relation.familiarity / 70)
}

function getSuccessLevel(relation: ButlerRelationState): number {
  return clamp01(relation.successfulOffers / 8)
}

function getRejectionLevel(relation: ButlerRelationState): number {
  return clamp01(relation.rejectedOffers / 5)
}

function getBiasLevel(value: number): number {
  return clamp01(value / 100)
}

function buildNoProfileRelationTuning(
  relation: ButlerRelationState
): ButlerRelationTaskTuning {
  let tuning = {
    ...DEFAULT_TUNING,
  }

  if (relation.tone === "unfamiliar") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1,
      approachSensitivityOffset: -1,
    })
  }

  if (relation.tone === "observing") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1,
    })
  }

  if (relation.tone === "familiar") {
    tuning = addTuning(tuning, {
      approachSensitivityOffset: 1,
    })
  }

  if (relation.tone === "trusted") {
    tuning = addTuning(tuning, {
      carePriorityOffset: 1,
      approachSensitivityOffset: 1,
    })
  }

  if (relation.tone === "guarded") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1,
      approachSensitivityOffset: -1,
    })
  }

  return finalizeTuning(tuning)
}

function buildToneBaseTuning(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}): ButlerRelationTaskTuning {
  const { relation, profile } = input
  const trust = getTrustLevel(relation)
  const familiarity = getFamiliarityLevel(relation)
  const success = getSuccessLevel(relation)

  let tuning = {
    ...DEFAULT_TUNING,
  }

  if (relation.tone === "unfamiliar") {
    tuning = addTuning(tuning, {
      observationBiasOffset:
        profile.bias.observationPatience >= 55
          ? 2
          : 1,
      approachSensitivityOffset:
        profile.bias.boundarySensitivity >= 60
          ? -2
          : -1,
    })
  }

  if (relation.tone === "observing") {
    tuning = addTuning(tuning, {
      observationBiasOffset:
        profile.bias.observationPatience >= 60
          ? 2
          : 1,
      approachSensitivityOffset:
        familiarity >= 0.35 && trust >= 0.25
          ? 1
          : 0,
    })
  }

  if (relation.tone === "familiar") {
    tuning = addTuning(tuning, {
      carePriorityOffset:
        profile.bias.carePriority >= 55
          ? 1
          : 0,
      approachSensitivityOffset:
        profile.bias.boundarySensitivity >= 70
          ? 0
          : 1 + success,
      restSensitivityOffset:
        profile.bias.carePriority >= 60
          ? 1
          : 0,
    })
  }

  if (relation.tone === "trusted") {
    tuning = addTuning(tuning, {
      carePriorityOffset:
        1 + Math.max(0, trust - 0.65) * 3,
      approachSensitivityOffset:
        profile.bias.boundarySensitivity >= 70
          ? 1
          : 2 + success * 2,
      foodSensitivityOffset:
        profile.bias.carePriority >= 60
          ? 1
          : 0,
      restSensitivityOffset:
        profile.bias.carePriority >= 60
          ? 1
          : 0,
    })
  }

  if (relation.tone === "guarded") {
    tuning = addTuning(tuning, {
      observationBiasOffset:
        profile.bias.boundarySensitivity >= 50
          ? 2
          : 1,
      approachSensitivityOffset:
        profile.bias.boundarySensitivity >= 60
          ? -3
          : -1,
    })
  }

  return tuning
}

function interpretByCareStyle(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}): ButlerRelationTaskTuning {
  const { relation, profile } = input
  const latest = relation.latestOpportunityFeedback
  const rejection = getRejectionLevel(relation)
  const success = getSuccessLevel(relation)
  const care = getBiasLevel(profile.bias.carePriority)
  const initiative = getBiasLevel(profile.bias.opportunityInitiative)
  const boundary = getBiasLevel(profile.bias.boundarySensitivity)

  let tuning = {
    ...DEFAULT_TUNING,
  }

  if (profile.careStyle === "gentle_observer") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1 + care,
      restSensitivityOffset:
        latest?.accepted
          ? success
          : 0,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        observationBiasOffset: 1 + boundary,
      })
    }
  }

  if (profile.careStyle === "active_supporter") {
    tuning = addTuning(tuning, {
      carePriorityOffset: 1 + care * 2,
      foodSensitivityOffset: initiative,
      restSensitivityOffset: 1 + initiative,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        restSensitivityOffset: care >= 0.6 ? 1 : 0,
        foodSensitivityOffset: care >= 0.7 ? 1 : 0,
        approachSensitivityOffset:
          boundary >= 0.65
            ? -1
            : 0,
      })
    }
  }

  if (profile.careStyle === "protective_guardian") {
    tuning = addTuning(tuning, {
      carePriorityOffset: 1 + care * 2,
      observationBiasOffset: 1 + boundary,
      restSensitivityOffset: 1,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        approachSensitivityOffset: -1 - boundary * 2,
        observationBiasOffset: 1 + rejection,
      })
    }
  }

  if (profile.careStyle === "quiet_maintainer") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1,
      constructionDriveOffset: 1,
      restSensitivityOffset:
        latest?.accepted
          ? 1
          : 0,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        constructionDriveOffset: 1,
      })
    }
  }

  if (profile.careStyle === "structured_manager") {
    tuning = addTuning(tuning, {
      carePriorityOffset: care >= 0.55 ? 1 : 0,
      constructionDriveOffset: 1,
      observationBiasOffset: 1,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        constructionDriveOffset: 1,
        observationBiasOffset: boundary >= 0.55 ? 1 : 0,
      })
    }
  }

  return tuning
}

function interpretByBuildStyle(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}): ButlerRelationTaskTuning {
  const { relation, profile } = input
  const latest = relation.latestOpportunityFeedback
  const construction = getBiasLevel(profile.bias.constructionDrive)

  let tuning = {
    ...DEFAULT_TUNING,
  }

  if (profile.buildStyle === "steady_builder") {
    tuning = addTuning(tuning, {
      constructionDriveOffset: construction >= 0.5 ? 1 : 0,
    })
  }

  if (profile.buildStyle === "adaptive_builder") {
    tuning = addTuning(tuning, {
      constructionDriveOffset:
        latest && !latest.accepted
          ? 2
          : 1,
    })
  }

  if (profile.buildStyle === "protective_builder") {
    tuning = addTuning(tuning, {
      constructionDriveOffset: 1 + construction,
      observationBiasOffset:
        relation.rejectedOffers > 0
          ? 1
          : 0,
    })
  }

  if (profile.buildStyle === "aesthetic_builder") {
    tuning = addTuning(tuning, {
      constructionDriveOffset:
        latest?.type === "approach_offer" && !latest.accepted
          ? 1
          : 0,
    })
  }

  if (profile.buildStyle === "minimal_builder") {
    tuning = addTuning(tuning, {
      constructionDriveOffset:
        construction >= 0.65
          ? 1
          : 0,
    })
  }

  return tuning
}

function interpretByBoundaryStyle(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}): ButlerRelationTaskTuning {
  const { relation, profile } = input
  const latest = relation.latestOpportunityFeedback
  const boundary = getBiasLevel(profile.bias.boundarySensitivity)
  const rejection = getRejectionLevel(relation)

  let tuning = {
    ...DEFAULT_TUNING,
  }

  if (profile.boundaryStyle === "soft_boundary") {
    tuning = addTuning(tuning, {
      approachSensitivityOffset:
        relation.trustEstimate >= 24
          ? 1
          : 0,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        approachSensitivityOffset:
          boundary >= 0.7
            ? -1
            : 0,
      })
    }
  }

  if (profile.boundaryStyle === "balanced_boundary") {
    tuning = addTuning(tuning, {
      observationBiasOffset:
        relation.rejectedOffers > relation.successfulOffers
          ? 1
          : 0,
      approachSensitivityOffset:
        relation.successfulOffers >= 2 && relation.trustEstimate >= 20
          ? 1
          : 0,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        approachSensitivityOffset:
          latest.type === "approach_offer"
            ? -1
            : 0,
      })
    }
  }

  if (profile.boundaryStyle === "clear_boundary") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1 + boundary,
      approachSensitivityOffset:
        latest && !latest.accepted
          ? -1 - rejection
          : 0,
    })
  }

  if (profile.boundaryStyle === "watchful_boundary") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 2 + boundary * 2,
      approachSensitivityOffset:
        latest && !latest.accepted
          ? -2 - rejection * 2
          : -1,
    })
  }

  return tuning
}

function interpretByOpportunityStyle(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}): ButlerRelationTaskTuning {
  const { relation, profile } = input
  const latest = relation.latestOpportunityFeedback
  const initiative = getBiasLevel(profile.bias.opportunityInitiative)
  const care = getBiasLevel(profile.bias.carePriority)
  const boundary = getBiasLevel(profile.bias.boundarySensitivity)
  const success = getSuccessLevel(relation)

  let tuning = {
    ...DEFAULT_TUNING,
  }

  if (profile.opportunityStyle === "offer_gently") {
    tuning = addTuning(tuning, {
      restSensitivityOffset: initiative >= 0.5 ? 1 : 0,
      approachSensitivityOffset:
        relation.trustEstimate >= 30
          ? 1
          : 0,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        observationBiasOffset: boundary >= 0.55 ? 1 : 0,
      })
    }
  }

  if (profile.opportunityStyle === "offer_actively") {
    tuning = addTuning(tuning, {
      carePriorityOffset: initiative >= 0.55 ? 1 : 0,
      foodSensitivityOffset: initiative >= 0.6 ? 1 : 0,
      restSensitivityOffset: initiative >= 0.55 ? 1 : 0,
      approachSensitivityOffset:
        boundary >= 0.75
          ? 0
          : 1,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        approachSensitivityOffset:
          latest.type === "approach_offer" && boundary >= 0.55
            ? -1
            : 0,
        foodSensitivityOffset:
          care >= 0.65
            ? 1
            : 0,
        restSensitivityOffset:
          care >= 0.65
            ? 1
            : 0,
      })
    }
  }

  if (profile.opportunityStyle === "offer_when_needed") {
    tuning = addTuning(tuning, {
      carePriorityOffset: care >= 0.55 ? 1 : 0,
      foodSensitivityOffset:
        latest?.type === "food_offer" && latest.accepted
          ? 1
          : 0,
      restSensitivityOffset:
        latest?.type === "rest_offer" && latest.accepted
          ? 1
          : 0,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        observationBiasOffset: 1,
      })
    }
  }

  if (profile.opportunityStyle === "offer_after_observation") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 2,
      approachSensitivityOffset:
        success >= 0.4 && relation.trustEstimate >= 30
          ? 1
          : 0,
    })

    if (latest && !latest.accepted) {
      tuning = addTuning(tuning, {
        observationBiasOffset: 1 + boundary,
        approachSensitivityOffset:
          latest.type === "approach_offer"
            ? -1
            : 0,
      })
    }
  }

  return tuning
}

function interpretByBias(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}): ButlerRelationTaskTuning {
  const { relation, profile } = input
  const latest = relation.latestOpportunityFeedback
  const care = getBiasLevel(profile.bias.carePriority)
  const construction = getBiasLevel(profile.bias.constructionDrive)
  const patience = getBiasLevel(profile.bias.observationPatience)
  const boundary = getBiasLevel(profile.bias.boundarySensitivity)
  const initiative = getBiasLevel(profile.bias.opportunityInitiative)
  const trust = getTrustLevel(relation)
  const familiarity = getFamiliarityLevel(relation)

  let tuning = {
    ...DEFAULT_TUNING,
  }

  tuning = addTuning(tuning, {
    carePriorityOffset:
      Math.max(0, care - 0.55) * 3,
    constructionDriveOffset:
      Math.max(0, construction - 0.6) * 2,
    observationBiasOffset:
      Math.max(0, patience - 0.5) * 3,
  })

  if (trust >= 0.35 && familiarity >= 0.35) {
    tuning = addTuning(tuning, {
      approachSensitivityOffset:
        Math.max(0, initiative - boundary) * 3,
      restSensitivityOffset:
        Math.max(0, care - 0.55) * 2,
    })
  }

  if (latest && !latest.accepted) {
    tuning = addTuning(tuning, {
      approachSensitivityOffset:
        -Math.max(0, boundary - 0.45) * 3,
      observationBiasOffset:
        Math.max(0, patience - 0.45) * 2,
      carePriorityOffset:
        Math.max(0, care - 0.7) * 1,
    })
  }

  if (latest?.accepted) {
    tuning = addTuning(tuning, {
      carePriorityOffset:
        Math.max(0, care - 0.5) * 2,
      approachSensitivityOffset:
        latest.type === "approach_offer"
          ? Math.max(0, initiative - boundary) * 2
          : 0,
    })
  }

  return tuning
}

export function buildButlerRelationTaskTuning(
  input:
    | ButlerRelationTaskTuningInput
    | ButlerRelationState
    | null
    | undefined
): ButlerRelationTaskTuning {
  const normalized = normalizeInput(input)
  const relation = normalized.relation
  const profile = normalized.profile

  if (!relation) {
    return DEFAULT_TUNING
  }

  if (!profile) {
    return buildNoProfileRelationTuning(relation)
  }

  let tuning = {
    ...DEFAULT_TUNING,
  }

  tuning = addTuning(tuning, buildToneBaseTuning({
    relation,
    profile,
  }))

  tuning = addTuning(tuning, interpretByCareStyle({
    relation,
    profile,
  }))

  tuning = addTuning(tuning, interpretByBuildStyle({
    relation,
    profile,
  }))

  tuning = addTuning(tuning, interpretByBoundaryStyle({
    relation,
    profile,
  }))

  tuning = addTuning(tuning, interpretByOpportunityStyle({
    relation,
    profile,
  }))

  tuning = addTuning(tuning, interpretByBias({
    relation,
    profile,
  }))

  return finalizeTuning(tuning)
}