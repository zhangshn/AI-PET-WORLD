/**
 * 当前文件负责：把管家与宠物关系状态转换成任务选择层可读取的轻量调参。
 */

import type { ButlerRelationState } from "./butler-relation"

export type ButlerRelationTaskTuning = {
  carePriorityOffset: number
  constructionDriveOffset: number
  foodSensitivityOffset: number
  restSensitivityOffset: number
  approachSensitivityOffset: number
  observationBiasOffset: number
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

function getSuccessfulOfferConfidence(relation: ButlerRelationState): number {
  return Math.min(1, relation.successfulOffers / 8)
}

function getRejectionPressure(relation: ButlerRelationState): number {
  return Math.min(1, relation.rejectedOffers / 5)
}

function getTrustNormalized(relation: ButlerRelationState): number {
  return Math.max(0, Math.min(1, relation.trustEstimate / 80))
}

function getFamiliarityNormalized(relation: ButlerRelationState): number {
  return Math.max(0, Math.min(1, relation.familiarity / 70))
}

export function buildButlerRelationTaskTuning(
  relation: ButlerRelationState | null | undefined
): ButlerRelationTaskTuning {
  if (!relation) {
    return DEFAULT_TUNING
  }

  const trust = getTrustNormalized(relation)
  const familiarity = getFamiliarityNormalized(relation)
  const successConfidence = getSuccessfulOfferConfidence(relation)
  const rejectionPressure = getRejectionPressure(relation)

  let tuning: ButlerRelationTaskTuning = {
    ...DEFAULT_TUNING,
  }

  if (relation.tone === "unfamiliar") {
    tuning = {
      ...tuning,
      observationBiasOffset: tuning.observationBiasOffset + 5,
      approachSensitivityOffset: tuning.approachSensitivityOffset - 5,
    }
  }

  if (relation.tone === "observing") {
    tuning = {
      ...tuning,
      observationBiasOffset: tuning.observationBiasOffset + 4,
      approachSensitivityOffset: tuning.approachSensitivityOffset - 2,
    }
  }

  if (relation.tone === "familiar") {
    tuning = {
      ...tuning,
      observationBiasOffset: tuning.observationBiasOffset + 1,
      approachSensitivityOffset:
        tuning.approachSensitivityOffset + 2 + successConfidence * 2,
      restSensitivityOffset: tuning.restSensitivityOffset + 1,
    }
  }

  if (relation.tone === "trusted") {
    tuning = {
      ...tuning,
      carePriorityOffset: tuning.carePriorityOffset + 3 + trust * 2,
      approachSensitivityOffset:
        tuning.approachSensitivityOffset + 4 + successConfidence * 2,
      foodSensitivityOffset: tuning.foodSensitivityOffset + 1,
      restSensitivityOffset: tuning.restSensitivityOffset + 2,
    }
  }

  if (relation.tone === "guarded") {
    tuning = {
      ...tuning,
      observationBiasOffset:
        tuning.observationBiasOffset + 7 + rejectionPressure * 3,
      approachSensitivityOffset:
        tuning.approachSensitivityOffset - 8 - rejectionPressure * 4,
      carePriorityOffset: tuning.carePriorityOffset - 2,
    }
  }

  tuning = {
    ...tuning,
    carePriorityOffset:
      tuning.carePriorityOffset + Math.max(0, trust - 0.5) * 4,
    approachSensitivityOffset:
      tuning.approachSensitivityOffset +
      Math.max(0, trust - 0.45) * 5 +
      Math.max(0, familiarity - 0.55) * 2,
    observationBiasOffset:
      tuning.observationBiasOffset +
      Math.max(0, 0.35 - familiarity) * 5,
    restSensitivityOffset:
      tuning.restSensitivityOffset + successConfidence * 1.5,
  }

  if (relation.rejectedOffers > 0) {
    tuning = {
      ...tuning,
      approachSensitivityOffset:
        tuning.approachSensitivityOffset -
        Math.min(10, relation.rejectedOffers * 1.5),
      observationBiasOffset:
        tuning.observationBiasOffset +
        Math.min(8, relation.rejectedOffers * 1.2),
    }
  }

  if (
    relation.latestOpportunityFeedback &&
    !relation.latestOpportunityFeedback.accepted
  ) {
    tuning = {
      ...tuning,
      approachSensitivityOffset: tuning.approachSensitivityOffset - 2,
      observationBiasOffset: tuning.observationBiasOffset + 2,
    }
  }

  if (
    relation.latestOpportunityFeedback &&
    relation.latestOpportunityFeedback.accepted
  ) {
    tuning = {
      ...tuning,
      carePriorityOffset: tuning.carePriorityOffset + 1,
    }
  }

  return {
    carePriorityOffset: clampOffset(tuning.carePriorityOffset),
    constructionDriveOffset: clampOffset(tuning.constructionDriveOffset),
    foodSensitivityOffset: clampOffset(tuning.foodSensitivityOffset),
    restSensitivityOffset: clampOffset(tuning.restSensitivityOffset),
    approachSensitivityOffset: clampOffset(tuning.approachSensitivityOffset),
    observationBiasOffset: clampOffset(tuning.observationBiasOffset),
  }
}