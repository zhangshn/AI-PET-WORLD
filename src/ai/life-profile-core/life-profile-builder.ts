/**
 * 当前文件负责：构建通用生命人格档案。
 */

import { buildBaziProfile } from "../bazi-core/bazi-gateway"
import { buildConsciousnessFromPersonality } from "../consciousness/consciousness-gateway"
import {
  buildPersonalityInterpretationBehaviorBias,
  buildPersonalityInterpretationProfile,
} from "../personality-interpretation-core/interpretation-gateway"
import { buildPublicPersonalityView } from "../ziwei-core/public-view"
import { buildPersonalityProfile } from "../ziwei-core/ziwei-gateway"

import type {
  BuildLifePersonalityProfileInput,
  LifePersonalityProfileBundle,
} from "./life-profile-schema"

export function buildLifePersonalityProfile(
  input: BuildLifePersonalityProfileInput
): LifePersonalityProfileBundle {
  const usableBirthHour =
    input.hasBirthHour && typeof input.birthInput.hour === "number"
      ? input.birthInput.hour
      : null

  const ziweiProfile =
    usableBirthHour !== null
      ? buildPersonalityProfile({
          year: input.birthInput.year,
          month: input.birthInput.month,
          day: input.birthInput.day,
          hour: usableBirthHour,
          minute: input.birthInput.minute ?? undefined,
        })
      : null

  const publicPersonalityView = ziweiProfile
    ? buildPublicPersonalityView(ziweiProfile)
    : null

  const baziProfile = buildBaziProfile({
    year: input.birthInput.year,
    month: input.birthInput.month,
    day: input.birthInput.day,
    hour: usableBirthHour,
    minute: input.birthInput.minute ?? null,
  })

  const personalityInterpretationProfile =
    buildPersonalityInterpretationProfile({
      ziweiProfile,
      baziProfile,
      genderPerspective: input.genderPerspective,
      hasBirthHour: usableBirthHour !== null,
    })

  const genderAwareBehaviorBias =
    buildPersonalityInterpretationBehaviorBias({
      interpretationProfile: personalityInterpretationProfile,
    })

  const consciousnessProfile = ziweiProfile
    ? buildConsciousnessFromPersonality(ziweiProfile)
    : null

  return {
    subjectType: input.subjectType,

    mode: personalityInterpretationProfile.mode,
    genderPerspective: input.genderPerspective,
    hasBirthHour: usableBirthHour !== null,

    ziweiProfile,
    publicPersonalityView,

    baziProfile,

    personalityInterpretationProfile,
    genderAwareBehaviorBias,

    consciousnessProfile,

    debug: {
      source: "life_profile_core",
      note:
        "通用生命人格档案：性别先进入紫微或八字映射，直接生成最终性别人格与行为偏置。",
    },
  }
}