/**
 * 当前文件负责：生成同盘男女解释对照结果。
 */

import {
  GENDER_COMPARISON_CONCLUSION,
  PERSONALITY_INTERPRETATION_PRINCIPLE,
} from "./interpretation-constants"
import { adaptBaziDynamicsSupport } from "./bazi-dynamics-adapter"
import { buildBaziPrimaryInterpretationParts } from "./bazi-gender-mapper"
import { mapFiveDimensionProfile } from "./five-dimension-mapper"
import { buildFinalVectorFingerprint } from "./interpretation-utils"
import type {
  BuildGenderPerspectiveComparisonInput,
  BuildPersonalityInterpretationInput,
  GenderPerspective,
  GenderPerspectiveComparison,
  PersonalityInterpretationMode,
  PersonalityInterpretationProfile,
} from "./interpretation-schema"
import { mapZiweiToLifeFunctionProfile } from "./ziwei-life-function-mapper"

function resolveInterpretationMode(
  input: BuildPersonalityInterpretationInput
): PersonalityInterpretationMode {
  if (input.hasBirthHour && input.ziweiProfile) {
    return "ziwei_primary"
  }

  return "bazi_primary"
}

function buildInterpretationSummary(input: {
  mode: PersonalityInterpretationMode
  genderPerspective: GenderPerspective
  fiveDimensionSummary: string
}): string {
  const viewpointText =
    input.genderPerspective === "male" ? "男命视角" : "女命视角"

  const modeText =
    input.mode === "ziwei_primary"
      ? "紫微主导模式"
      : "八字主导模式"

  return `${viewpointText}解释完成。当前采用${modeText}。${input.fiveDimensionSummary}`
}

function buildZiweiPrimaryInterpretation(
  input: BuildPersonalityInterpretationInput
): PersonalityInterpretationProfile {
  if (!input.ziweiProfile) {
    throw new Error("紫微主导模式需要 ziweiProfile。")
  }

  const ziweiLifeFunctionProfile = mapZiweiToLifeFunctionProfile({
    ziweiProfile: input.ziweiProfile,
    genderPerspective: input.genderPerspective,
  })

  const baziDynamicsSupportProfile = adaptBaziDynamicsSupport({
    baziProfile: input.baziProfile,
  })

  const fiveDimensionProfile = mapFiveDimensionProfile({
    genderPerspective: input.genderPerspective,
    lifeFunctionProfile: ziweiLifeFunctionProfile,
    baziSupportProfile: baziDynamicsSupportProfile,
    finalPersonalityProfile: input.finalPersonalityProfile,
  })

  return {
    mode: "ziwei_primary",
    genderPerspective: input.genderPerspective,
    principle: PERSONALITY_INTERPRETATION_PRINCIPLE,
    ziweiLifeFunctionProfile,
    baziGenderFunctionProfile: null,
    baziDynamicsSupportProfile,
    fiveDimensionProfile,
    summary: buildInterpretationSummary({
      mode: "ziwei_primary",
      genderPerspective: input.genderPerspective,
      fiveDimensionSummary: fiveDimensionProfile.summary,
    }),
    debug: {
      doesModifyZiweiProfile: false,
      doesModifyBaziProfile: false,
      doesModifyFinalPersonalityVector: false,
      note: "紫微主导模式：紫微定结构，男女进入紫微结构解释，八字作为辅助动力。",
    },
  }
}

function buildBaziPrimaryInterpretation(
  input: BuildPersonalityInterpretationInput
): PersonalityInterpretationProfile {
  const baziDynamicsSupportProfile = adaptBaziDynamicsSupport({
    baziProfile: input.baziProfile,
  })

  const {
    baziGenderFunctionProfile,
    fiveDimensionProfile,
  } = buildBaziPrimaryInterpretationParts({
    baziProfile: input.baziProfile,
    baziSupportProfile: baziDynamicsSupportProfile,
    finalPersonalityProfile: input.finalPersonalityProfile,
    genderPerspective: input.genderPerspective,
  })

  return {
    mode: "bazi_primary",
    genderPerspective: input.genderPerspective,
    principle:
      "出生时辰未知时，八字作为主要人格定义来源；男女视角仍然进入八字动力解释，不被忽略。",
    ziweiLifeFunctionProfile: null,
    baziGenderFunctionProfile,
    baziDynamicsSupportProfile,
    fiveDimensionProfile,
    summary: buildInterpretationSummary({
      mode: "bazi_primary",
      genderPerspective: input.genderPerspective,
      fiveDimensionSummary: fiveDimensionProfile.summary,
    }),
    debug: {
      doesModifyZiweiProfile: false,
      doesModifyBaziProfile: false,
      doesModifyFinalPersonalityVector: false,
      note: "八字主导模式：不使用默认出生时辰强行解释紫微盘；八字主导，男女视角参与解释。",
    },
  }
}

export function buildPersonalityInterpretationProfileInternal(
  input: BuildPersonalityInterpretationInput
): PersonalityInterpretationProfile {
  const mode = resolveInterpretationMode(input)

  if (mode === "ziwei_primary") {
    return buildZiweiPrimaryInterpretation(input)
  }

  return buildBaziPrimaryInterpretation(input)
}

export function buildGenderPerspectiveComparison(
  input: BuildGenderPerspectiveComparisonInput
): GenderPerspectiveComparison {
  const mode: PersonalityInterpretationMode =
    input.hasBirthHour && input.ziweiProfile
      ? "ziwei_primary"
      : "bazi_primary"

  const maleProfile = buildPersonalityInterpretationProfileInternal({
    ziweiProfile: input.ziweiProfile,
    baziProfile: input.baziProfile,
    finalPersonalityProfile: input.finalPersonalityProfile,
    genderPerspective: "male",
    hasBirthHour: input.hasBirthHour,
  })

  const femaleProfile = buildPersonalityInterpretationProfileInternal({
    ziweiProfile: input.ziweiProfile,
    baziProfile: input.baziProfile,
    finalPersonalityProfile: input.finalPersonalityProfile,
    genderPerspective: "female",
    hasBirthHour: input.hasBirthHour,
  })

  const maleVectorFingerprint = buildFinalVectorFingerprint(
    input.finalPersonalityProfile.vector
  )

  const femaleVectorFingerprint = buildFinalVectorFingerprint(
    input.finalPersonalityProfile.vector
  )

  const conclusion =
    mode === "ziwei_primary"
      ? GENDER_COMPARISON_CONCLUSION
      : "出生时辰未知，系统采用八字主导人格定义模式。男女共用同一套八字动力与最终人格向量，但按男命 / 女命视角生成不同解释。"

  return {
    mode,
    sameBirthStructure: true,
    sameFinalVector: true,
    maleProfile,
    femaleProfile,
    conclusion,
    debug: {
      maleVectorFingerprint,
      femaleVectorFingerprint,
      note:
        mode === "ziwei_primary"
          ? "紫微主导模式：同盘男女共用 ziweiProfile、baziProfile 与 finalPersonalityProfile；差异来自 genderPerspective。"
          : "八字主导模式：出生时辰未知，不使用默认紫微盘；男女共用 baziProfile 与 finalPersonalityProfile；差异来自 genderPerspective。",
    },
  }
}