/**
 * 当前文件负责：计算八字原局五行能量、阴阳倾向、主导五行与弱五行。
 */

import type {
  BaziChart,
  BaziElementAnalysis,
  BaziElementDetail,
  BaziPillar,
  WuXingElement,
  WuXingScore,
  YinYangScore
} from "./bazi-schema"

import {
  BAZI_BRANCH_YIN_YANG_MAP,
  BAZI_STEM_ELEMENT_MAP,
  BAZI_STEM_YIN_YANG_MAP
} from "./bazi-data/bazi-ganzhi-data"

import { BAZI_ELEMENT_WEIGHTS } from "./bazi-data/bazi-element-weights"

import {
  getBottomKeys,
  getTopKeys,
  normalizeRecordToPercent,
  round
} from "./bazi-utils"

export const WUXING_ELEMENTS: WuXingElement[] = [
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
]

export function createEmptyWuXingScore(): WuXingScore {
  return {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  }
}

function createEmptyYinYangScore(): YinYangScore {
  return {
    yin: 0,
    yang: 0,
  }
}

function addScore(
  score: WuXingScore,
  element: WuXingElement,
  value: number
) {
  score[element] = round(score[element] + value, 4)
}

function getStemSource(index: number): BaziElementDetail["source"] {
  if (index === 0) return "yearStem"
  if (index === 1) return "monthStem"
  if (index === 2) return "dayStem"
  return "hourStem"
}

function getBranchSource(index: number): BaziElementDetail["source"] {
  if (index === 0) return "yearBranch"
  if (index === 1) return "monthBranch"
  if (index === 2) return "dayBranch"
  return "hourBranch"
}

function getStemWeight(index: number): number {
  if (index === 0) return BAZI_ELEMENT_WEIGHTS.yearStem
  if (index === 1) return BAZI_ELEMENT_WEIGHTS.monthStem
  if (index === 2) return BAZI_ELEMENT_WEIGHTS.dayStem
  return BAZI_ELEMENT_WEIGHTS.hourStem
}

function getBranchWeight(index: number): number {
  if (index === 0) return BAZI_ELEMENT_WEIGHTS.yearBranch
  if (index === 1) return BAZI_ELEMENT_WEIGHTS.monthBranch
  if (index === 2) return BAZI_ELEMENT_WEIGHTS.dayBranch
  return BAZI_ELEMENT_WEIGHTS.hourBranch
}

function addDetail(params: {
  details: BaziElementDetail[]
  pillar: BaziPillar
  source: BaziElementDetail["source"]
  element: WuXingElement
  yinYang: "yin" | "yang"
  weight: number
  note: string
}) {
  params.details.push({
    pillarLabel: params.pillar.label,
    source: params.source,
    element: params.element,
    yinYang: params.yinYang,
    weight: params.weight,
    note: params.note,
  })
}

export function collectUsedPillars(chart: BaziChart): BaziPillar[] {
  return chart.pillars
}

export function analyzeBaziElements(chart: BaziChart): BaziElementAnalysis {
  const rawScore = createEmptyWuXingScore()
  const yinYangRaw = createEmptyYinYangScore()
  const details: BaziElementDetail[] = []

  chart.pillars.forEach((pillar, index) => {
    const stemWeight = getStemWeight(index)
    const branchWeight = getBranchWeight(index)

    addScore(rawScore, pillar.stemElement, stemWeight)
    yinYangRaw[pillar.yinYang] = round(yinYangRaw[pillar.yinYang] + stemWeight, 4)

    addDetail({
      details,
      pillar,
      source: getStemSource(index),
      element: pillar.stemElement,
      yinYang: pillar.yinYang,
      weight: stemWeight,
      note: "天干主气",
    })

    addScore(rawScore, pillar.branchElement, branchWeight)
    yinYangRaw[BAZI_BRANCH_YIN_YANG_MAP[pillar.branch]] = round(
      yinYangRaw[BAZI_BRANCH_YIN_YANG_MAP[pillar.branch]] + branchWeight,
      4
    )

    addDetail({
      details,
      pillar,
      source: getBranchSource(index),
      element: pillar.branchElement,
      yinYang: BAZI_BRANCH_YIN_YANG_MAP[pillar.branch],
      weight: branchWeight,
      note: "地支主气",
    })

    pillar.hiddenStems.forEach((hiddenStem) => {
      const element = BAZI_STEM_ELEMENT_MAP[hiddenStem]
      const yinYang = BAZI_STEM_YIN_YANG_MAP[hiddenStem]
      const weight = BAZI_ELEMENT_WEIGHTS.hiddenStem

      addScore(rawScore, element, weight)
      yinYangRaw[yinYang] = round(yinYangRaw[yinYang] + weight, 4)

      addDetail({
        details,
        pillar,
        source: "hiddenStem",
        element,
        yinYang,
        weight,
        note: `藏干 ${hiddenStem}`,
      })
    })
  })

  const elementScores = normalizeRecordToPercent(rawScore)
  const yinYangScores = normalizeRecordToPercent(yinYangRaw)

  return {
    rawScore,
    elementScores,
    yinYangScores,
    dominantElements: getTopKeys(elementScores, 2),
    weakElements: getBottomKeys(elementScores, 2),
    details,
  }
}

export function calculateWuXingScore(chart: BaziChart): WuXingScore {
  return analyzeBaziElements(chart).rawScore
}

export function normalizeWuXingScore(score: WuXingScore): WuXingScore {
  return normalizeRecordToPercent(score)
}

export function getDominantElements(score: WuXingScore): WuXingElement[] {
  return getTopKeys(score, 2)
}