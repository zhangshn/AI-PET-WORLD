/**
 * 当前文件负责：提供八字动态运行层通用工具函数。
 */

import type {
  BaziPillar,
  WuXingElement,
  WuXingScore
} from "../bazi-schema"

import {
  BAZI_SIXTY_JIAZI,
  buildBaziPillarByIndex
} from "../bazi-data/bazi-ganzhi-data"

import { safeModulo, round } from "../bazi-utils"

export function getCurrentAge(params: {
  birthYear: number
  currentYear: number
}): number {
  return Math.max(1, params.currentYear - params.birthYear + 1)
}

export function getPillarCycleIndex(pillar: BaziPillar): number {
  const index = BAZI_SIXTY_JIAZI.findIndex((item) => {
    return item === pillar.label
  })

  return index >= 0 ? index : 0
}

export function movePillarByStep(params: {
  basePillar: BaziPillar
  step: number
}): BaziPillar {
  const baseIndex = getPillarCycleIndex(params.basePillar)

  return buildBaziPillarByIndex(
    safeModulo(baseIndex + params.step, 60)
  )
}

export function createEmptyRuntimeScore(): WuXingScore {
  return {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  }
}

export function addRuntimeElementScore(params: {
  score: WuXingScore
  element: WuXingElement
  weight: number
}) {
  params.score[params.element] = round(
    params.score[params.element] + params.weight,
    4
  )
}

export function addPillarToRuntimeScore(params: {
  score: WuXingScore
  pillar: BaziPillar
  weight: number
}) {
  addRuntimeElementScore({
    score: params.score,
    element: params.pillar.stemElement,
    weight: params.weight,
  })

  addRuntimeElementScore({
    score: params.score,
    element: params.pillar.branchElement,
    weight: params.weight,
  })
}