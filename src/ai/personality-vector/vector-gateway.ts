/**
 * 当前文件负责：提供统一人格向量系统出口。
 */

import type {
  BuildFinalPersonalityInput,
  FinalPersonalityProfile,
  FinalPersonalityVector,
} from "./vector-types"
import {
  buildFinalPersonalityBias,
  buildFinalPersonalityLabels,
  buildFinalPersonalitySummary,
  mapBaziToBaseVector,
  mapZiweiToBaseVector,
  mergeZiweiAndBaziVectors,
  resolvePersonalitySourceMode,
} from "./vector-mapper"

function buildFallbackVector(): FinalPersonalityVector {
  return {
    curiosity: 50,
    activity: 50,
    stability: 50,
    sensitivity: 50,
    discipline: 50,
    attachment: 50,
    control: 50,
    explorationDrive: 50,
    reactionSpeed: 50,
    persistence: 50,
    adaptability: 50,
    sensoryDepth: 50,
    restPreference: 50,
  }
}

export function buildFinalPersonalityProfile(
  input: BuildFinalPersonalityInput
): FinalPersonalityProfile {
  const mode = resolvePersonalitySourceMode(input)

  const ziweiVector = input.ziweiProfile
    ? mapZiweiToBaseVector(input.ziweiProfile)
    : null

  const baziVector = input.baziProfile
    ? mapBaziToBaseVector(input.baziProfile)
    : null

  let vector: FinalPersonalityVector

  if (ziweiVector && baziVector) {
    vector = mergeZiweiAndBaziVectors({
      ziweiVector,
      baziVector,
    })
  } else if (ziweiVector) {
    vector = ziweiVector
  } else if (baziVector) {
    vector = baziVector
  } else {
    vector = buildFallbackVector()
  }

  const bias = buildFinalPersonalityBias(vector)
  const labels = buildFinalPersonalityLabels(vector)

  return {
    mode,
    vector,
    bias,
    sources: {
      ziwei: input.ziweiProfile ?? null,
      bazi: input.baziProfile ?? null,
    },
    labels,
    summary: buildFinalPersonalitySummary({
      mode,
      labels,
      vector,
    }),
    debug: {
      usedZiwei: Boolean(input.ziweiProfile),
      usedBazi: Boolean(input.baziProfile),
      note: "FinalPersonalityProfile 是 AI-PET-WORLD 的统一人格桥梁层，用于连接紫微结构、八字动力与后续宠物/管家/建筑行为适配。",
    },
  }
}

export type {
  BuildFinalPersonalityInput,
  FinalPersonalityBias,
  FinalPersonalityProfile,
  FinalPersonalityVector,
  PersonalitySourceMode,
} from "./vector-types"