/**
 * 当前文件负责：提供八字动态运行层统一入口。
 */

import type {
  BaziRuntimeInput,
  BaziRuntimeProfile
} from "./bazi-runtime-schema"

import { buildBaziDaYunResult } from "./bazi-da-yun-engine"
import { buildBaziFlowResult } from "./bazi-flow-engine"

import {
  buildRuntimeElementField,
  mapRuntimeElementsToModifiers
} from "./bazi-runtime-mapper"

export function buildBaziRuntimeProfile(
  input: BaziRuntimeInput
): BaziRuntimeProfile {
  const daYun = buildBaziDaYunResult({
    chart: input.birthChart,
    gender: input.gender,
    currentYear: input.currentYear,
  })

  const flows = buildBaziFlowResult({
    currentYear: input.currentYear,
    currentMonth: input.currentMonth,
    currentDay: input.currentDay,
    currentHour: input.currentHour,
  })

  const runtimeElementField = buildRuntimeElementField({
    daYunPillar: daYun.currentDaYun?.pillar ?? null,
    liuNian: flows.liuNian,
    liuYue: flows.liuYue,
    liuRi: flows.liuRi,
    liuShi: flows.liuShi,
  })

  const modifiers = mapRuntimeElementsToModifiers(
    runtimeElementField.elementScores
  )

  return {
    birthChart: input.birthChart,
    gender: input.gender,
    currentAge: daYun.currentAge,

    daYun,
    flows,

    runtimeElementField,
    modifiers,

    debug: {
      usedRuntimePillars: [
        ...(daYun.currentDaYun ? [`大运:${daYun.currentDaYun.pillar.label}`] : []),
        `流年:${flows.liuNian.label}`,
        `流月:${flows.liuYue.label}`,
        `流日:${flows.liuRi.label}`,
        ...(flows.liuShi ? [`流时:${flows.liuShi.label}`] : []),
      ],
      note: input.birthChart.hasHour
        ? "当前八字动态层使用原局四柱，并叠加大运、流年、流月、流日、流时环境场。"
        : "当前八字动态层使用原局三柱。流时仅作为环境场，不作为原局时柱感应。",
    },
  }
}

export type {
  BaziDaYunDirection,
  BaziDaYunItem,
  BaziDaYunResult,
  BaziFlowResult,
  BaziRuntimeElementField,
  BaziRuntimeGender,
  BaziRuntimeInput,
  BaziRuntimeModifiers,
  BaziRuntimeProfile,
} from "./bazi-runtime-schema"