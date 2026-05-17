/**
 * 当前文件负责：验证创建世界输入是否影响世界生成运行时参数。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

import {
  buildWorldCreationRuntime,
  type CreateWorldInput,
  type WorldCreationRuntimeResult,
} from "./world-creation-runtime"

export type WorldCreationInfluenceCase = {
  id: string
  label: string
  input: CreateWorldInput
  runtime: Pick<
    WorldCreationRuntimeResult,
    | "worldId"
    | "birthSignature"
    | "butlerConstructionStyle"
    | "styleSource"
    | "debug"
  >
  styleDeltaFromBase: ButlerConstructionStyleVector
}

export type WorldCreationInfluenceTestResult = {
  baseCaseId: string
  cases: WorldCreationInfluenceCase[]
  summary: {
    caseCount: number
    allUseLifeProfileCore: boolean
    changedStyleCaseCount: number
    note: string
  }
}

export function buildWorldCreationInfluenceTest(input: {
  baseCreateWorldInput: CreateWorldInput
}): WorldCreationInfluenceTestResult {
  const caseInputs = buildInfluenceCaseInputs(input.baseCreateWorldInput)
  const baseRuntime = buildWorldCreationRuntime({
    createWorldInput: caseInputs[0].input,
  })

  const cases = caseInputs.map((caseInput) => {
    const runtime = buildWorldCreationRuntime({
      createWorldInput: caseInput.input,
    })

    return {
      id: caseInput.id,
      label: caseInput.label,
      input: caseInput.input,
      runtime: {
        worldId: runtime.worldId,
        birthSignature: runtime.birthSignature,
        butlerConstructionStyle: runtime.butlerConstructionStyle,
        styleSource: runtime.styleSource,
        debug: runtime.debug,
      },
      styleDeltaFromBase: buildStyleDelta({
        baseStyle: baseRuntime.butlerConstructionStyle,
        targetStyle: runtime.butlerConstructionStyle,
      }),
    }
  })

  const changedStyleCaseCount = cases.filter((influenceCase) =>
    hasMeaningfulStyleDelta(influenceCase.styleDeltaFromBase)
  ).length

  return {
    baseCaseId: caseInputs[0].id,
    cases,
    summary: {
      caseCount: cases.length,
      allUseLifeProfileCore: cases.every(
        (influenceCase) => influenceCase.runtime.styleSource === "life_profile_core"
      ),
      changedStyleCaseCount,
      note:
        "这里用于验证：同一套世界创建入口，改变出生时间或性别视角后，管家建设风格是否发生可观察变化。",
    },
  }
}

function buildInfluenceCaseInputs(
  baseInput: CreateWorldInput
): Array<{
  id: string
  label: string
  input: CreateWorldInput
}> {
  return [
    {
      id: "base_input",
      label: "当前创建世界输入",
      input: baseInput,
    },
    {
      id: "same_birth_female",
      label: "相同生日 / 女性视角",
      input: {
        ...baseInput,
        perspective: "female",
      },
    },
    {
      id: "same_birth_male",
      label: "相同生日 / 男性视角",
      input: {
        ...baseInput,
        perspective: "male",
      },
    },
    {
      id: "early_morning_birth",
      label: "相同日期 / 清晨出生",
      input: {
        ...baseInput,
        time: "05:30",
      },
    },
    {
      id: "late_night_birth",
      label: "相同日期 / 深夜出生",
      input: {
        ...baseInput,
        time: "23:30",
      },
    },
  ]
}

function buildStyleDelta(input: {
  baseStyle: ButlerConstructionStyleVector
  targetStyle: ButlerConstructionStyleVector
}): ButlerConstructionStyleVector {
  return {
    structuredBuilder: buildDelta(
      input.baseStyle.structuredBuilder,
      input.targetStyle.structuredBuilder
    ),
    warmCaretaker: buildDelta(
      input.baseStyle.warmCaretaker,
      input.targetStyle.warmCaretaker
    ),
    protectiveKeeper: buildDelta(
      input.baseStyle.protectiveKeeper,
      input.targetStyle.protectiveKeeper
    ),
    aestheticOrganizer: buildDelta(
      input.baseStyle.aestheticOrganizer,
      input.targetStyle.aestheticOrganizer
    ),
    quietMaintainer: buildDelta(
      input.baseStyle.quietMaintainer,
      input.targetStyle.quietMaintainer
    ),
    adaptivePlanner: buildDelta(
      input.baseStyle.adaptivePlanner,
      input.targetStyle.adaptivePlanner
    ),
  }
}

function buildDelta(baseValue: number, targetValue: number): number {
  return Number((targetValue - baseValue).toFixed(3))
}

function hasMeaningfulStyleDelta(styleDelta: ButlerConstructionStyleVector): boolean {
  return Object.values(styleDelta).some((delta) => Math.abs(delta) >= 0.01)
}
