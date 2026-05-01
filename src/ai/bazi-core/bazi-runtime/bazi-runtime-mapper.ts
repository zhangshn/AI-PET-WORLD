/**
 * 当前文件负责：把八字动态干支转成当前环境五行场与状态修正。
 */

import type {
  BaziRuntimeElementField,
  BaziRuntimeModifiers
} from "./bazi-runtime-schema"

import type {
  BaziPillar,
  WuXingScore
} from "../bazi-schema"

import {
  addPillarToRuntimeScore,
  createEmptyRuntimeScore
} from "./bazi-runtime-utils"

import {
  normalizeRecordToPercent,
  round
} from "../bazi-utils"

function getScore(score: WuXingScore, key: keyof WuXingScore): number {
  return score[key] ?? 0
}

export function buildRuntimeElementField(params: {
  daYunPillar: BaziPillar | null
  liuNian: BaziPillar
  liuYue: BaziPillar
  liuRi: BaziPillar
  liuShi: BaziPillar | null
}): BaziRuntimeElementField {
  const rawScore = createEmptyRuntimeScore()

  if (params.daYunPillar) {
    addPillarToRuntimeScore({
      score: rawScore,
      pillar: params.daYunPillar,
      weight: 1.2,
    })
  }

  addPillarToRuntimeScore({
    score: rawScore,
    pillar: params.liuNian,
    weight: 1.0,
  })

  addPillarToRuntimeScore({
    score: rawScore,
    pillar: params.liuYue,
    weight: 0.8,
  })

  addPillarToRuntimeScore({
    score: rawScore,
    pillar: params.liuRi,
    weight: 0.5,
  })

  if (params.liuShi) {
    addPillarToRuntimeScore({
      score: rawScore,
      pillar: params.liuShi,
      weight: 0.3,
    })
  }

  return {
    rawScore,
    elementScores: normalizeRecordToPercent(rawScore),
  }
}

export function mapRuntimeElementsToModifiers(
  elementScores: WuXingScore
): BaziRuntimeModifiers {
  const wood = getScore(elementScores, "wood")
  const fire = getScore(elementScores, "fire")
  const earth = getScore(elementScores, "earth")
  const metal = getScore(elementScores, "metal")
  const water = getScore(elementScores, "water")

  return {
    activityModifier: round(fire * 0.45 + wood * 0.3 + metal * 0.1),
    emotionModifier: round(fire * 0.35 + water * 0.3 + wood * 0.15),
    recoveryModifier: round(earth * 0.4 + water * 0.25 + wood * 0.2),
    cautionModifier: round(metal * 0.45 + water * 0.25 + earth * 0.15),
    explorationModifier: round(wood * 0.5 + fire * 0.25 + water * 0.15),
    perceptionModifier: round(water * 0.5 + metal * 0.2 + wood * 0.1),
  }
}