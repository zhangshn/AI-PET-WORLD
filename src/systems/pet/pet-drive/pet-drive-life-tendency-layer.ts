/**
 * 当前文件负责：把当前生命运行趋向轻量映射到宠物 drive 分数。
 */

import type {
  CurrentLifeRuntimeBundle,
  LifeTendencyScores,
} from "../../../ai/gateway"

import type {
  DriveLayerContext,
  DriveType,
} from "./pet-drive-types"

import {
  addScore,
} from "./pet-drive-score-utils"

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

function addLifeTendencyScore(params: {
  context: DriveLayerContext
  scores: LifeTendencyScores
  drive: DriveType
  tendencyKey: keyof LifeTendencyScores
  maxBonus: number
  reason: string
}) {
  const score = params.scores[params.tendencyKey]
  const bonus = getTendencyBonus(score, params.maxBonus)

  addScore(
    params.context.scores,
    params.context.reasons,
    params.drive,
    bonus,
    `${params.reason}（${score}）`
  )
}

function applyActionIntensity(
  context: DriveLayerContext,
  scores: LifeTendencyScores
) {
  const bonus = getTendencyBonus(scores.action, 3)

  addScore(
    context.scores,
    context.reasons,
    "explore",
    bonus * 0.6,
    `生命趋向：行动强度推动探索表达（${scores.action}）`
  )

  addScore(
    context.scores,
    context.reasons,
    "approach",
    bonus * 0.4,
    `生命趋向：行动强度推动靠近表达（${scores.action}）`
  )
}

function applyPerceptionDepth(
  context: DriveLayerContext,
  scores: LifeTendencyScores
) {
  const bonus = getTendencyBonus(scores.perception, 3)

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
  const boundaryBonus = getTendencyBonus(scores.boundary, 2)
  const protectBonus = getTendencyBonus(scores.protect, 2)

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
  const bonus = getTendencyBonus(scores.care, 2)

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

  addLifeTendencyScore({
    context,
    scores,
    drive: "explore",
    tendencyKey: "explore",
    maxBonus: 6,
    reason: "生命趋向：探索趋向",
  })

  addLifeTendencyScore({
    context,
    scores,
    drive: "observe",
    tendencyKey: "observe",
    maxBonus: 5,
    reason: "生命趋向：观察趋向",
  })

  addLifeTendencyScore({
    context,
    scores,
    drive: "approach",
    tendencyKey: "approach",
    maxBonus: 4,
    reason: "生命趋向：靠近趋向",
  })

  addLifeTendencyScore({
    context,
    scores,
    drive: "rest",
    tendencyKey: "recover",
    maxBonus: 4,
    reason: "生命趋向：恢复趋向",
  })

  addLifeTendencyScore({
    context,
    scores,
    drive: "observe",
    tendencyKey: "routine",
    maxBonus: 2,
    reason: "生命趋向：秩序趋向提高稳定观察",
  })

  applyActionIntensity(context, scores)
  applyPerceptionDepth(context, scores)
  applyBoundaryAndProtection(context, scores)
  applyCareTendency(context, scores)
}