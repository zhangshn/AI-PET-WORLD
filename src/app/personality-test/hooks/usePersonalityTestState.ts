/**
 * 当前文件负责：组合 personality-test 页面的出生输入、人格数据与 Timeline 测试状态。
 */

import { useMemo, useState } from "react"

import {
  buildPetBirthBundle,
  type PetBirthAiBundle
} from "../../../ai/gateway"

import { buildBaziProfile } from "../../../ai/bazi-core/bazi-gateway"
import { buildFinalPersonalityProfile } from "../../../ai/personality-vector/vector-gateway"

import { useBirthInputState } from "./useBirthInputState"
import {
  INITIAL_TIMELINE_CLOCK,
  useTimelineTestState
} from "./useTimelineTestState"

import type { BirthInputState } from "./personality-test-state-types"

export function usePersonalityTestState() {
  const {
    birthInput,
    birthInputActions
  } = useBirthInputState()

  const {
    year,
    month,
    day,
    parsedBirthHour,
    hasBirthHour,
    ziweiHour
  } = birthInput

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

  function resetFromBirthInput(nextBirthInput: BirthInputState) {
    const nextBundle = buildBundleFromBirthInput(nextBirthInput)
    setBirthBundle(nextBundle)
    return nextBundle.timelineSnapshot
  }

  const {
    timelineData,
    timelineActions
  } = useTimelineTestState({
    initialSnapshot: birthBundle.timelineSnapshot,
    onResetByBirthInput: () => {
      return resetFromBirthInput({
        year,
        month,
        day,
        hour: ziweiHour
      })
    }
  })

  function syncZiweiWhenPossible(nextInput: {
    year: number
    month: number
    day: number
    hour: number | null
  }) {
    if (nextInput.hour === null) {
      timelineActions.markUnknownBirthHour()
      return
    }

    const nextSnapshot = resetFromBirthInput({
      year: nextInput.year,
      month: nextInput.month,
      day: nextInput.day,
      hour: nextInput.hour
    })

    timelineActions.markBirthInputReset(nextSnapshot)
  }

  function handleDateChange(nextInput: {
    year?: number
    month?: number
    day?: number
  }) {
    const nextBirthInput = birthInputActions.updateDate(nextInput)

    syncZiweiWhenPossible({
      year: nextBirthInput.year,
      month: nextBirthInput.month,
      day: nextBirthInput.day,
      hour: nextBirthInput.hour
    })
  }

  function handleBirthHourInputChange(value: string) {
    const nextBirthInput = birthInputActions.updateBirthHourInput(value)

    syncZiweiWhenPossible({
      year: nextBirthInput.year,
      month: nextBirthInput.month,
      day: nextBirthInput.day,
      hour: nextBirthInput.hour
    })
  }

  return {
    birthInput,

    profileData: {
      birthBundle,
      profile,
      publicView,
      pattern,
      baziProfile,
      finalPersonalityProfile
    },

    timelineData,

    actions: {
      setDynamicGender: birthInputActions.setDynamicGender,
      handleDateChange,
      handleBirthHourInputChange,
      applyTimelineUpdate: timelineActions.applyTimelineUpdate,
      resetTimeline: timelineActions.resetTimeline
    }
  }
}