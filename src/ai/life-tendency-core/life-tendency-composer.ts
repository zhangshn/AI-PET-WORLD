/**
 * 当前文件负责：合成当前生命趋向结果。
 */

import type {
  CurrentDynamicTendencies
} from "../ziwei-core/ziwei-gateway"

import type {
  BaziCurrentTendencies
} from "../bazi-core/bazi-gateway"

import type {
  BuildCurrentLifeTendencyProfileInput,
  CurrentLifeTendencyProfile,
  LifeTendencyKey,
  LifeTendencyScoreItem,
  LifeTendencyScores
} from "./life-tendency-schema"

import {
  buildLifeTendencyFiveDimensionScores
} from "./life-tendency-five-dimension"

import {
  clampLifeTendencyScore,
  getLifeTendencyLevel,
  getTopLifeTendencies,
  mixLifeTendencyScore
} from "./life-tendency-normalizer"

function getZiweiValue(
  ziweiTendencies: CurrentDynamicTendencies | null,
  key: keyof CurrentDynamicTendencies
): number | null {
  return ziweiTendencies?.[key] ?? null
}

function createScoreItem(params: {
  key: LifeTendencyKey
  label: string
  ziwei: number | null
  bazi: number
  fiveDimension: number
  source: string
}): LifeTendencyScoreItem {
  const score = mixLifeTendencyScore({
    ziwei: params.ziwei,
    bazi: params.bazi,
    fiveDimension: params.fiveDimension,
  })

  return {
    key: params.key,
    label: params.label,
    score,
    level: getLifeTendencyLevel(score),
    source: params.source,
    inputs: {
      ziwei: params.ziwei,
      bazi: params.bazi,
      fiveDimension: params.fiveDimension,
    },
  }
}

function buildBaziApproachScore(
  bazi: BaziCurrentTendencies
): number {
  return clampLifeTendencyScore(
    bazi.adaptabilityTendency * 0.45 +
      bazi.actionTendency * 0.25 +
      (100 - bazi.cautionTendency) * 0.3
  )
}

function buildBaziCareScore(
  bazi: BaziCurrentTendencies
): number {
  return clampLifeTendencyScore(
    bazi.stabilityTendency * 0.45 +
      bazi.recoveryTendency * 0.25 +
      bazi.perceptionTendency * 0.3
  )
}

function buildBaziProtectScore(
  bazi: BaziCurrentTendencies
): number {
  return clampLifeTendencyScore(
    bazi.cautionTendency * 0.45 +
      bazi.stabilityTendency * 0.35 +
      bazi.perceptionTendency * 0.2
  )
}

function buildLifeTendencyScoreItems(
  input: BuildCurrentLifeTendencyProfileInput
): LifeTendencyScoreItem[] {
  const ziweiTendencies =
    input.ziweiProfile?.currentTendencies ?? null

  const bazi = input.baziTendencyProfile.currentTendencies

  const dynamicTraits =
    input.ziweiProfile?.currentTraits ??
      input.fallbackTraits ??
      null

  const five = buildLifeTendencyFiveDimensionScores(dynamicTraits)

  return [
    createScoreItem({
      key: "explore",
      label: "探索趋向",
      ziwei: getZiweiValue(ziweiTendencies, "exploreTendency"),
      bazi: bazi.explorationTendency,
      fiveDimension: five.explore,
      source: "紫微 explore + 八字 exploration + 五维探索性",
    }),
    createScoreItem({
      key: "observe",
      label: "观察趋向",
      ziwei: getZiweiValue(ziweiTendencies, "observeTendency"),
      bazi: bazi.perceptionTendency,
      fiveDimension: five.observe,
      source: "紫微 observe + 八字 perception + 五维观察解释",
    }),
    createScoreItem({
      key: "approach",
      label: "靠近趋向",
      ziwei: getZiweiValue(ziweiTendencies, "approachTendency"),
      bazi: buildBaziApproachScore(bazi),
      fiveDimension: five.approach,
      source: "紫微 approach + 八字适应/行动/谨慎修正 + 五维关系倾向",
    }),
    createScoreItem({
      key: "recover",
      label: "恢复趋向",
      ziwei: getZiweiValue(ziweiTendencies, "recoverTendency"),
      bazi: bazi.recoveryTendency,
      fiveDimension: five.recover,
      source: "紫微 recover + 八字 recovery + 五维稳定/休息倾向",
    }),
    createScoreItem({
      key: "care",
      label: "照护趋向",
      ziwei: getZiweiValue(ziweiTendencies, "careTendency"),
      bazi: buildBaziCareScore(bazi),
      fiveDimension: five.care,
      source: "紫微 care + 八字稳定/感知辅助 + 五维照护性",
    }),
    createScoreItem({
      key: "protect",
      label: "保护趋向",
      ziwei: getZiweiValue(ziweiTendencies, "protectTendency"),
      bazi: buildBaziProtectScore(bazi),
      fiveDimension: five.protect,
      source: "紫微 protect + 八字谨慎/稳定辅助 + 五维保护性",
    }),
    createScoreItem({
      key: "boundary",
      label: "边界趋向",
      ziwei: getZiweiValue(ziweiTendencies, "boundaryTendency"),
      bazi: bazi.cautionTendency,
      fiveDimension: five.boundary,
      source: "紫微 boundary + 八字 caution + 五维边界/执行解释",
    }),
    createScoreItem({
      key: "routine",
      label: "秩序趋向",
      ziwei: getZiweiValue(ziweiTendencies, "routineTendency"),
      bazi: bazi.stabilityTendency,
      fiveDimension: five.routine,
      source: "紫微 routine + 八字 stability + 五维执行/规律倾向",
    }),
    createScoreItem({
      key: "action",
      label: "行动强度",
      ziwei: getZiweiValue(ziweiTendencies, "exploreTendency"),
      bazi: bazi.actionTendency,
      fiveDimension: five.action,
      source: "紫微探索外显 + 八字 action + 五维活动/执行倾向",
    }),
    createScoreItem({
      key: "perception",
      label: "感知深度",
      ziwei: getZiweiValue(ziweiTendencies, "observeTendency"),
      bazi: bazi.perceptionTendency,
      fiveDimension: five.perception,
      source: "紫微观察 + 八字 perception + 五维敏感/好奇解释",
    }),
  ]
}

function buildLifeTendencyScores(
  items: LifeTendencyScoreItem[]
): LifeTendencyScores {
  return {
    explore: items.find((item) => item.key === "explore")?.score ?? 50,
    observe: items.find((item) => item.key === "observe")?.score ?? 50,
    approach: items.find((item) => item.key === "approach")?.score ?? 50,
    recover: items.find((item) => item.key === "recover")?.score ?? 50,
    care: items.find((item) => item.key === "care")?.score ?? 50,
    protect: items.find((item) => item.key === "protect")?.score ?? 50,
    boundary: items.find((item) => item.key === "boundary")?.score ?? 50,
    routine: items.find((item) => item.key === "routine")?.score ?? 50,
    action: items.find((item) => item.key === "action")?.score ?? 50,
    perception: items.find((item) => item.key === "perception")?.score ?? 50,
  }
}

function buildSummary(topItems: LifeTendencyScoreItem[]): string {
  const topText = topItems
    .map((item) => `${item.label} ${item.score}`)
    .join(" / ")

  return `当前生命趋向以 ${topText} 为主要表现。`
}

export function buildCurrentLifeTendencyProfile(
  input: BuildCurrentLifeTendencyProfileInput
): CurrentLifeTendencyProfile {
  const scoreItems = buildLifeTendencyScoreItems(input)
  const topTendencies = getTopLifeTendencies(scoreItems)

  const dynamicTraits =
    input.ziweiProfile?.currentTraits ??
      input.fallbackTraits ??
      null

  const fiveDimensionScores =
    buildLifeTendencyFiveDimensionScores(dynamicTraits)

  const ziweiSummary =
    input.ziweiProfile?.labels.summary ??
      "紫微动态数据暂不可用，当前以八字辅助与五维解释降级合成。"

  const baziSummary = input.baziTendencyProfile.labels.summary

  return {
    scores: buildLifeTendencyScores(scoreItems),
    scoreItems,
    topTendencies,
    fiveDimensionScores,
    sourceProfile: {
      ziweiSummary,
      baziSummary,
      fiveDimensionSummary:
        "五维负责把紫微动态 traits 与八字辅助趋向翻译成可读生命功能维度。",
    },
    labels: {
      title: "当前生命趋向",
      summary: buildSummary(topTendencies),
      topSummary: topTendencies
        .map((item) => item.label)
        .join(" / "),
      gameUsage:
        "该结果不会直接输出 action，而是作为 drive / goal / behavior 前的生命趋向输入。",
    },
    debug: {
      hasZiweiProfile: input.ziweiProfile !== null,
      usedZiweiDynamicTraits: input.ziweiProfile !== null,
      baziEnergyTone:
        input.baziTendencyProfile.currentTemperament.energyTone,
      baziDominantElements:
        input.baziTendencyProfile.currentTemperament
          .dominantRuntimeElements,
      baziUsedRuntimePillars:
        input.baziTendencyProfile.debug.usedRuntimePillars,
    },
  }
}