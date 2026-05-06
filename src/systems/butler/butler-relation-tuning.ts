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

  return Math.max(-18, Math.min(18, Math.round(value)))
}

export function buildButlerRelationTaskTuning(
  relation: ButlerRelationState | null | undefined
): ButlerRelationTaskTuning {
  if (!relation) {
    return DEFAULT_TUNING
  }

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
      approachSensitivityOffset: tuning.approachSensitivityOffset + 3,
      restSensitivityOffset: tuning.restSensitivityOffset + 1,
    }
  }

  if (relation.tone === "trusted") {
    tuning = {
      ...tuning,
      carePriorityOffset: tuning.carePriorityOffset + 4,
      approachSensitivityOffset: tuning.approachSensitivityOffset + 6,
      foodSensitivityOffset: tuning.foodSensitivityOffset + 2,
      restSensitivityOffset: tuning.restSensitivityOffset + 2,
    }
  }

  if (relation.tone === "guarded") {
    tuning = {
      ...tuning,
      observationBiasOffset: tuning.observationBiasOffset + 7,
      approachSensitivityOffset: tuning.approachSensitivityOffset - 8,
      carePriorityOffset: tuning.carePriorityOffset - 2,
    }
  }

  tuning = {
    ...tuning,
    carePriorityOffset:
      tuning.carePriorityOffset + Math.max(0, relation.trustEstimate - 50) * 0.08,
    approachSensitivityOffset:
      tuning.approachSensitivityOffset + Math.max(0, relation.trustEstimate - 45) * 0.1,
    observationBiasOffset:
      tuning.observationBiasOffset + Math.max(0, 30 - relation.familiarity) * 0.08,
  }

  if (relation.rejectedOffers >= 3) {
    tuning = {
      ...tuning,
      approachSensitivityOffset:
        tuning.approachSensitivityOffset - relation.rejectedOffers,
      observationBiasOffset:
        tuning.observationBiasOffset + Math.min(8, relation.rejectedOffers),
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