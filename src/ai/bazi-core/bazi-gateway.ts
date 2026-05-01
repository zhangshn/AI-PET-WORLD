/**
 * 当前文件负责：提供八字动力系统统一出口。
 */

import type {
  BaziInput,
  BaziProfile
} from "./bazi-schema"

import { calculateBaziChart } from "./bazi-calculator"
import { analyzeBaziElements } from "./bazi-elements"
import {
  mapElementsToBehaviorBias,
  mapElementsToDynamicVector,
  mapElementsToLegacyDynamics
} from "./bazi-mapper"
import {
  buildBaziBehaviorTags,
  buildBaziProfileSummary,
  interpretBaziDynamics
} from "./bazi-summary"

export function buildBaziProfile(input: BaziInput): BaziProfile {
  const chart = calculateBaziChart(input)
  const elementAnalysis = analyzeBaziElements(chart)

  const dynamicVector = mapElementsToDynamicVector(
    elementAnalysis.elementScores
  )

  const behaviorBias = mapElementsToBehaviorBias(
    elementAnalysis.elementScores
  )

  const dynamics = mapElementsToLegacyDynamics(
    elementAnalysis.elementScores
  )

  const behaviorTags = buildBaziBehaviorTags(dynamics)

  const interpretation = interpretBaziDynamics({
    dominantElements: elementAnalysis.dominantElements,
    dynamics,
    behaviorTags,
    mode: chart.mode,
  })

  return {
    chart,

    mode: chart.mode,
    precision: chart.hasHour ? "high" : "medium",
    hasHour: chart.hasHour,

    dayMaster: chart.dayMaster,

    elementScores: elementAnalysis.elementScores,
    yinYangScores: elementAnalysis.yinYangScores,
    dominantElements: elementAnalysis.dominantElements,
    weakElements: elementAnalysis.weakElements,

    dynamicVector,
    behaviorBias,

    rawScore: elementAnalysis.rawScore,
    distribution: elementAnalysis.elementScores,
    dynamics,
    behaviorTags,
    interpretation,

    summary: buildBaziProfileSummary({
      mode: chart.mode,
      dominantElements: elementAnalysis.dominantElements,
      weakElements: elementAnalysis.weakElements,
    }),

    debug: {
      usedPillars: chart.pillars.map((pillar) => pillar.label),
      missingHour: !chart.hasHour,
      elementDetails: elementAnalysis.details,
      note: chart.hasHour
        ? "当前八字计算使用四柱模式。"
        : "当前八字计算使用三柱模式，出生时辰未知，时柱不参与原局计算。",
    },
  }
}

export {
  buildBaziRuntimeProfile
} from "./bazi-runtime/bazi-runtime-gateway"

export type {
  BaziBehaviorBias,
  BaziChart,
  BaziDynamicVector,
  BaziInput,
  BaziMode,
  BaziPillar,
  BaziPrecision,
  BaziProfile,
  EarthlyBranch,
  HeavenlyStem,
  WuXingElement,
  WuXingScore,
  YinYang,
} from "./bazi-schema"

export type {
  BaziDaYunTimeOption,
  BaziDaYunDirection,
  BaziDaYunItem,
  BaziDaYunResult,
  BaziFlowResult,
  BaziHourTimeOption,
  BaziLiuNianTimeOption,
  BaziRuntimeElementField,
  BaziRuntimeFlowLevel,
  BaziRuntimeGender,
  BaziRuntimeInput,
  BaziRuntimeModifiers,
  BaziRuntimeProfile,
  BaziRuntimeTimeSelection,
  BaziRuntimeTimeTable,
  BaziSimpleTimeOption,
} from "./bazi-runtime/bazi-runtime-gateway"
