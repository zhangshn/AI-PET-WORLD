/**
 * 当前文件负责：根据出生年干与性别判断大运顺逆。
 */

import type { HeavenlyStem } from "../schema"

import { getHeavenlyStemPolarity } from "../knowledge/stems"

import type {
  ZiweiCycleDirection,
  ZiweiDynamicResult,
  ZiweiGender
} from "./dynamic-schema"

export interface ResolveZiweiCycleDirectionData {
  direction: ZiweiCycleDirection
  reason: string
}

export function isValidZiweiGender(value: unknown): value is ZiweiGender {
  return value === "male" || value === "female"
}

export function resolveZiweiCycleDirection(params: {
  birthYearStem: HeavenlyStem
  gender: unknown
}): ZiweiDynamicResult<ResolveZiweiCycleDirectionData> {
  if (params.gender === undefined || params.gender === null || params.gender === "") {
    return {
      ok: false,
      code: "missing_gender",
      message: "缺少性别，无法判断大运顺逆，紫微动态运势计算已停止。"
    }
  }

  if (!isValidZiweiGender(params.gender)) {
    return {
      ok: false,
      code: "invalid_gender",
      message: "性别参数无效，必须是 male 或 female，紫微动态运势计算已停止。"
    }
  }

  const polarity = getHeavenlyStemPolarity(params.birthYearStem)

  if (
    (polarity === "yang" && params.gender === "male") ||
    (polarity === "yin" && params.gender === "female")
  ) {
    return {
      ok: true,
      data: {
        direction: "forward",
        reason: "阳男阴女，顺行。"
      }
    }
  }

  return {
    ok: true,
    data: {
      direction: "backward",
      reason: "阴男阳女，逆行。"
    }
  }
}