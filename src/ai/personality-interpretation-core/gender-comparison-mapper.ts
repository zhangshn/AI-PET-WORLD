/**
 * 当前文件负责：生成同盘男女解释对照结果。
 */

import {
  GENDER_COMPARISON_CONCLUSION,
  PERSONALITY_INTERPRETATION_PRINCIPLE,
} from "./interpretation-constants"
import { adaptBaziDynamicsSupport } from "./bazi-dynamics-adapter"
import { mapFiveDimensionProfile } from "./five-dimension-mapper"
import {
  buildFinalVectorFingerprint,
} from "./interpretation-utils"
import type {
  BuildGenderPerspectiveComparisonInput,
  BuildPersonalityInterpretationInput,
  GenderPerspective,
  GenderPerspectiveComparison,
  PersonalityInterpretationProfile,
} from "./interpretation-schema"
import { mapZiweiToLifeFunctionProfile } from "./ziwei-life-function-mapper"

function buildInterpretationSummary(input: {
  genderPerspective: GenderPerspective
  fiveDimensionSummary: string
}): string {
  const viewpointText =
    input.genderPerspective === "male" ? "男命视角" : "女命视角"

  return `${viewpointText}解释完成。${input.fiveDimensionSummary}`
}

export function buildPersonalityInterpretationProfileInternal(
  input: BuildPersonalityInterpretationInput
): PersonalityInterpretationProfile {
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
    genderPerspective: input.genderPerspective,
    principle: PERSONALITY_INTERPRETATION_PRINCIPLE,
    ziweiLifeFunctionProfile,
    baziDynamicsSupportProfile,
    fiveDimensionProfile,
    summary: buildInterpretationSummary({
      genderPerspective: input.genderPerspective,
      fiveDimensionSummary: fiveDimensionProfile.summary,
    }),
    debug: {
      doesModifyZiweiProfile: false,
      doesModifyBaziProfile: false,
      doesModifyFinalPersonalityVector: false,
      note: "人格解释核心只生成解释结果，不修改紫微原盘、八字原局或 FinalPersonalityVector。",
    },
  }
}

export function buildGenderPerspectiveComparison(
  input: BuildGenderPerspectiveComparisonInput
): GenderPerspectiveComparison {
  const maleProfile = buildPersonalityInterpretationProfileInternal({
    ziweiProfile: input.ziweiProfile,
    baziProfile: input.baziProfile,
    finalPersonalityProfile: input.finalPersonalityProfile,
    genderPerspective: "male",
  })

  const femaleProfile = buildPersonalityInterpretationProfileInternal({
    ziweiProfile: input.ziweiProfile,
    baziProfile: input.baziProfile,
    finalPersonalityProfile: input.finalPersonalityProfile,
    genderPerspective: "female",
  })

  const maleVectorFingerprint = buildFinalVectorFingerprint(
    input.finalPersonalityProfile.vector
  )

  const femaleVectorFingerprint = buildFinalVectorFingerprint(
    input.finalPersonalityProfile.vector
  )

  return {
    sameBirthStructure: true,
    sameFinalVector: true,
    maleProfile,
    femaleProfile,
    conclusion: GENDER_COMPARISON_CONCLUSION,
    debug: {
        maleVectorFingerprint,
        femaleVectorFingerprint,
        note: "同盘男女对照共用同一个 ziweiProfile、baziProfile 与 finalPersonalityProfile；差异只来自 genderPerspective。",
    },
  }
}