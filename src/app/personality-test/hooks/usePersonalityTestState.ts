/**
 * 当前文件负责：组合 personality-test 页面的出生输入、人格数据与 Timeline 测试状态。
 */

import { useBirthInputState } from "./useBirthInputState"
import { usePersonalityProfileData } from "./usePersonalityProfileData"
import { useTimelineTestState } from "./useTimelineTestState"

export function usePersonalityTestState() {
  const {
    birthInput,
    birthInputActions,
  } = useBirthInputState()

  const {
    year,
    month,
    day,
    parsedBirthHour,
    hasBirthHour,
    dynamicGender,
  } = birthInput

  const {
    profileData,
    profileActions,
  } = usePersonalityProfileData({
    year,
    month,
    day,
    parsedBirthHour,
    hasBirthHour,
    dynamicGender,
  })

  const {
    timelineData,
    timelineActions,
  } = useTimelineTestState({
    initialSnapshot: profileData.initialTimelineSnapshot,
    onResetByBirthInput: () => {
      return profileActions.resetProfileFromBirthInput({
        year,
        month,
        day,
        hour: parsedBirthHour,
      })
    },
  })

  function syncTimelineWhenPossible(nextInput: {
    year: number
    month: number
    day: number
    hour: number | null
  }) {
    if (nextInput.hour === null) {
      timelineActions.markUnknownBirthHour()
      return
    }

    const nextSnapshot = profileActions.resetProfileFromBirthInput({
      year: nextInput.year,
      month: nextInput.month,
      day: nextInput.day,
      hour: nextInput.hour,
    })

    timelineActions.markBirthInputReset(nextSnapshot)
  }

  function handleDateChange(nextInput: {
    year?: number
    month?: number
    day?: number
  }) {
    const nextBirthInput = birthInputActions.updateDate(nextInput)

    syncTimelineWhenPossible({
      year: nextBirthInput.year,
      month: nextBirthInput.month,
      day: nextBirthInput.day,
      hour: nextBirthInput.hour,
    })
  }

  function handleBirthHourInputChange(value: string) {
    const nextBirthInput = birthInputActions.updateBirthHourInput(value)

    syncTimelineWhenPossible({
      year: nextBirthInput.year,
      month: nextBirthInput.month,
      day: nextBirthInput.day,
      hour: nextBirthInput.hour,
    })
  }

  return {
    birthInput,
    profileData,
    timelineData,

    actions: {
      setDynamicGender: birthInputActions.setDynamicGender,
      handleDateChange,
      handleBirthHourInputChange,
      applyTimelineUpdate: timelineActions.applyTimelineUpdate,
      resetTimeline: timelineActions.resetTimeline,
    },
  }
}