/**
 * 当前文件负责：在世界 Tick 中构建并打印生命运行动态数据包。
 */

import type {
  BuildCurrentLifeRuntimeBundleFromWorldInput,
  CurrentLifeRuntimeBundle,
  LifeTendencyRuntimeGender,
} from "@/ai/ai-system-gateway"

import {
  buildAiCurrentLifeRuntimeBundleFromWorld,
} from "@/ai/ai-system-gateway"

import type { TimeState } from "../../timeSystem"
import type { PetState } from "@/types/pet"

const ENABLE_LIFE_RUNTIME_LOG = true

/**
 * MVP 阶段临时世界起始日期。
 *
 * 说明：
 * 1. 当前 TimeState 只有 Day / Hour / Period，没有真实年月日。
 * 2. 所以这里先给世界 Day 1 一个固定公历日期。
 * 3. 后续应该从世界存档 / 世界配置 / 用户创建世界时间读取。
 */
const DEFAULT_WORLD_START_DATE = {
  year: 2026,
  month: 1,
  day: 1,
}

function resolveRuntimeGender(
  pet: PetState
): LifeTendencyRuntimeGender {
  if (
    pet.genderPerspective === "male" ||
    pet.genderPerspective === "female"
  ) {
    return pet.genderPerspective
  }

  return "unknown"
}

function buildBirthDateFromPet(pet: PetState) {
  const lunarInfo = pet.personalityProfile.pattern.lunarInfo

  return {
    year: lunarInfo.solarYear,
    month: lunarInfo.solarMonth,
    day: lunarInfo.solarDay,
  }
}

function buildLifeRuntimeInput(params: {
  pet: PetState
  time: TimeState
}): BuildCurrentLifeRuntimeBundleFromWorldInput {
  const birthDate = buildBirthDateFromPet(params.pet)

  return {
    pattern: params.pet.personalityProfile.pattern,
    baseProfile: params.pet.personalityProfile,
    baziProfile: params.pet.baziProfile,
    gender: resolveRuntimeGender(params.pet),

    worldTime: {
      day: params.time.day,
      hour: params.time.hour,
    },

    worldStartDate: DEFAULT_WORLD_START_DATE,
    birthDate,
  }
}

function formatTopTendencies(bundle: CurrentLifeRuntimeBundle): string {
  return bundle.lifeTendencyProfile.topTendencies
    .map((item) => `${item.label}:${item.score}`)
    .join(" / ")
}

function formatWorldTime(time: TimeState): string {
  return `Day ${time.day} - ${String(time.hour).padStart(
    2,
    "0"
  )}:00 - ${time.period}`
}

export function runLifeRuntimeLog(input: {
  tick: number
  time: TimeState
  pet: PetState | null
}): CurrentLifeRuntimeBundle | null {
  if (!input.pet) {
    return null
  }

  const bundle = buildAiCurrentLifeRuntimeBundleFromWorld(
    buildLifeRuntimeInput({
      pet: input.pet,
      time: input.time,
    })
  )

  if (ENABLE_LIFE_RUNTIME_LOG) {
    console.log("🧬 生命运行动态包", {
      tick: input.tick,
      worldTime: formatWorldTime(input.time),
      runtime: {
        daYun:
          bundle.baziRuntimeProfile.daYun.currentDaYun?.pillar.label ??
          "未起运",
        liuNian: bundle.baziRuntimeProfile.flows.liuNian.label,
        liuYue: bundle.baziRuntimeProfile.flows.liuYue.label,
        liuRi: bundle.baziRuntimeProfile.flows.liuRi.label,
        liuShi: bundle.baziRuntimeProfile.flows.liuShi?.label ?? "未知",
      },
      lifeTendencyTop: formatTopTendencies(bundle),
      ziweiDynamicAvailable: bundle.debug.hasZiweiDynamicProfile,
      baziUsedRuntimePillars:
        bundle.baziTendencyProfile.debug.usedRuntimePillars,
      gameUsage: bundle.lifeTendencyProfile.labels.gameUsage,
    })
  }

  return bundle
}