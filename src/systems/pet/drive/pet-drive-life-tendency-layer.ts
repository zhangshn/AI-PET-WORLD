/**
 * 当前文件负责：把当前生命运行趋向轻量映射到宠物 drive 分数。
 */

import type {
  CurrentLifeRuntimeBundle,
  LifeTendencyScores,
} from "../../../ai/gateway"

import type {
  DriveLayerContext,
} from "./pet-drive-types"

import {
  addScore,
} from "./pet-drive-score-utils"

import {
  LIFE_TENDENCY_ACTION_INTENSITY_TUNING,
  LIFE_TENDENCY_BOUNDARY_TUNING,
  LIFE_TENDENCY_CARE_TUNING,
  LIFE_TENDENCY_DRIVE_TUNING,
  LIFE_TENDENCY_PERCEPTION_TUNING,
} from "./pet-drive-tuning"

function getTendencyBonus(
  score: number,
  maxBonus: number
): number {
  if (!Number.isFinite(score)) {
    return 0
  }

  if (score <= 50) {
    return 0
  }

  return ((score - 50) / 50) * maxBonus
}

function applyConfiguredLifeTendencyScores(
  context: DriveLayerContext,
  scores: LifeTendencyScores
) {
  for (const item of LIFE_TENDENCY_DRIVE_TUNING) {
    const score = scores[item.tendencyKey]
    const bonus = getTendencyBonus(score, item.maxBonus)

    addScore(
      context.scores,
      context.reasons,
      item.drive,
      bonus,
      `${item.reason}（${score}）`
    )
  }
}

function applyActionIntensity(
  context: DriveLayerContext,
  scores: LifeTendencyScores
) {
  const tuning = LIFE_TENDENCY_ACTION_INTENSITY_TUNING
  const bonus = getTendencyBonus(scores.action, tuning.maxBonus)

  addScore(
    context.scores,
    context.reasons,
    "explore",
    bonus * tuning.exploreRatio,
    `生命趋向：行动强度推动探索表达（${scores.action}）`
  )

  addScore(
    context.scores,
    context.reasons,
    "approach",
    bonus * tuning.approachRatio,
    `生命趋向：行动强度推动靠近表达（${scores.action}）`
  )
}

function applyPerceptionDepth(
  context: DriveLayerContext,
  scores: LifeTendencyScores
) {
  const bonus = getTendencyBonus(
    scores.perception,
    LIFE_TENDENCY_PERCEPTION_TUNING.maxBonus
  )

  addScore(
    context.scores,
    context.reasons,
    "observe",
    bonus,
    `生命趋向：感知深度提高观察倾向（${scores.perception}）`
  )
}

function applyBoundaryAndProtection(
  context: DriveLayerContext,
  scores: LifeTendencyScores
) {
  const boundaryBonus = getTendencyBonus(
    scores.boundary,
    LIFE_TENDENCY_BOUNDARY_TUNING.boundaryMaxBonus
  )

  const protectBonus = getTendencyBonus(
    scores.protect,
    LIFE_TENDENCY_BOUNDARY_TUNING.protectMaxBonus
  )

  addScore(
    context.scores,
    context.reasons,
    "avoid",
    boundaryBonus,
    `生命趋向：边界趋向提高谨慎回避（${scores.boundary}）`
  )

  addScore(
    context.scores,
    context.reasons,
    "avoid",
    protectBonus,
    `生命趋向：保护趋向提高防御观察（${scores.protect}）`
  )
}

function applyCareTendency(
  context: DriveLayerContext,
  scores: LifeTendencyScores
) {
  const bonus = getTendencyBonus(
    scores.care,
    LIFE_TENDENCY_CARE_TUNING.maxBonus
  )

  addScore(
    context.scores,
    context.reasons,
    "approach",
    bonus,
    `生命趋向：照护趋向提高关系靠近（${scores.care}）`
  )
}

function getLifeRuntimeBundle(
  context: DriveLayerContext
): CurrentLifeRuntimeBundle | null {
  return context.input.pet.currentLifeRuntimeBundle ?? null
}

export function applyLifeTendencyLayer(
  context: DriveLayerContext
) {
  const bundle = getLifeRuntimeBundle(context)

  if (!bundle) {
    return
  }

  const scores = bundle.lifeTendencyProfile.scores

  applyConfiguredLifeTendencyScores(context, scores)
  applyActionIntensity(context, scores)
  applyPerceptionDepth(context, scores)
  applyBoundaryAndProtection(context, scores)
  applyCareTendency(context, scores)
}