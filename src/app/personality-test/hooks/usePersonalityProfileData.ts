/**
 * 当前文件负责：根据出生输入和性别视角构建通用生命人格档案。
 */

import { useMemo } from "react"

import {
  buildLifePersonalityProfile,
  type GenderPerspective,
  type LifePersonalityProfileBundle,
} from "../../../ai/gateway"

import { buildBaziProfile } from "../../../ai/bazi-core/bazi-gateway"
import { buildPetTimelineSnapshot } from "../../../ai/timeline-system/timeline-gateway"

import {
  INITIAL_TIMELINE_CLOCK,
} from "./useTimelineTestState"

import type { DynamicGenderInput } from "../types"
import type { BirthInputState } from "./personality-test-state-types"

function resolveGenderPerspective(
  gender: DynamicGenderInput
): GenderPerspective | null {
  if (gender === "male" || gender === "female") {
    return gender
  }

  return null
}

export function usePersonalityProfileData({
  year,
  month,
  day,
  parsedBirthHour,
  hasBirthHour,
  dynamicGender,
}: {
  year: number
  month: number
  day: number
  parsedBirthHour: number | null
  hasBirthHour: boolean
  dynamicGender: DynamicGenderInput
}) {
  const selectedGenderPerspective = useMemo(() => {
    return resolveGenderPerspective(dynamicGender)
  }, [dynamicGender])

  const baziProfile = useMemo(() => {
    return buildBaziProfile({
      year,
      month,
      day,
      hour: hasBirthHour ? parsedBirthHour : null,
    })
  }, [
    year,
    month,
    day,
    parsedBirthHour,
    hasBirthHour,
  ])

  const lifeProfileBundle = useMemo<LifePersonalityProfileBundle | null>(() => {
    if (selectedGenderPerspective === null) {
      return null
    }

    return buildLifePersonalityProfile({
      subjectType: "pet",
      birthInput: {
        year,
        month,
        day,
        hour: hasBirthHour ? parsedBirthHour : null,
      },
      genderPerspective: selectedGenderPerspective,
      hasBirthHour,
    })
  }, [
    year,
    month,
    day,
    parsedBirthHour,
    hasBirthHour,
    selectedGenderPerspective,
  ])

  const initialTimelineSnapshot = useMemo(() => {
    return buildPetTimelineSnapshot({
      day: INITIAL_TIMELINE_CLOCK.day,
      hour: INITIAL_TIMELINE_CLOCK.hour,
      period: INITIAL_TIMELINE_CLOCK.period,
    })
  }, [])

  const profile = lifeProfileBundle?.ziweiProfile ?? null
  const publicView = lifeProfileBundle?.publicPersonalityView ?? null
  const pattern = profile?.pattern ?? null

  const basePersonalityProfile =
    lifeProfileBundle?.basePersonalityProfile ?? null

  const personalityInterpretationProfile =
    lifeProfileBundle?.personalityInterpretationProfile ?? null

  const genderAwareBehaviorBias =
    lifeProfileBundle?.genderAwareBehaviorBias ?? null

  function resetProfileFromBirthInput(_nextBirthInput: BirthInputState) {
    return buildPetTimelineSnapshot({
      day: INITIAL_TIMELINE_CLOCK.day,
      hour: INITIAL_TIMELINE_CLOCK.hour,
      period: INITIAL_TIMELINE_CLOCK.period,
    })
  }

  return {
    profileData: {
      lifeProfileBundle,
      selectedGenderPerspective,

      profile,
      publicView,
      pattern,

      baziProfile,
      basePersonalityProfile,
      personalityInterpretationProfile,
      genderAwareBehaviorBias,

      initialTimelineSnapshot,
    },

    profileActions: {
      resetProfileFromBirthInput,
    },
  }
}