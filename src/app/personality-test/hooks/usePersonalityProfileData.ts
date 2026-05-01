/**
 * 当前文件负责：根据出生输入构建人格出生包、八字底盘与最终融合人格。
 */

import { useMemo, useState } from "react"

import {
  buildPetBirthBundle,
  type PetBirthAiBundle
} from "../../../ai/gateway"

import { buildBaziProfile } from "../../../ai/bazi-core/bazi-gateway"
import { buildFinalPersonalityProfile } from "../../../ai/personality-vector/vector-gateway"

import {
  INITIAL_TIMELINE_CLOCK
} from "./useTimelineTestState"

import type { BirthInputState } from "./personality-test-state-types"

export function usePersonalityProfileData({
  year,
  month,
  day,
  parsedBirthHour,
  hasBirthHour
}: {
  year: number
  month: number
  day: number
  parsedBirthHour: number | null
  hasBirthHour: boolean
}) {
  const [birthBundle, setBirthBundle] = useState<PetBirthAiBundle>(() => {
    return buildPetBirthBundle({
      birthInput: {
        year,
        month,
        day,
        hour: 0
      },
      time: INITIAL_TIMELINE_CLOCK
    })
  })

  const profile = birthBundle.personalityProfile
  const publicView = birthBundle.publicPersonalityView
  const pattern = profile.pattern

  const baziProfile = useMemo(() => {
    return buildBaziProfile({
      year,
      month,
      day,
      hour: parsedBirthHour
    })
  }, [year, month, day, parsedBirthHour])

  const finalPersonalityProfile = useMemo(() => {
    return buildFinalPersonalityProfile({
      ziweiProfile: hasBirthHour ? profile : null,
      baziProfile
    })
  }, [hasBirthHour, profile, baziProfile])

  function buildBundleFromBirthInput(nextBirthInput: BirthInputState) {
    return buildPetBirthBundle({
      birthInput: nextBirthInput,
      time: INITIAL_TIMELINE_CLOCK
    })
  }

  function resetProfileFromBirthInput(nextBirthInput: BirthInputState) {
    const nextBundle = buildBundleFromBirthInput(nextBirthInput)
    setBirthBundle(nextBundle)
    return nextBundle.timelineSnapshot
  }

  return {
    profileData: {
      birthBundle,
      profile,
      publicView,
      pattern,
      baziProfile,
      finalPersonalityProfile
    },

    profileActions: {
      resetProfileFromBirthInput
    }
  }
}