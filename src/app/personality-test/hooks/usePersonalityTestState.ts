/**
 * 当前文件负责：集中管理 personality-test 页面的输入状态、出生人格包、八字结果、最终人格结果与 Timeline 测试状态。
 */

import { useMemo, useState } from "react"

import {
  buildPetBirthBundle,
  updatePetAiState,
  type PetBirthAiBundle,
  type PetTimelineSnapshot,
  type StateUpdateEvent
} from "../../../ai/gateway"

import { buildBaziProfile } from "../../../ai/bazi-core/bazi-gateway"
import { buildFinalPersonalityProfile } from "../../../ai/personality-vector/vector-gateway"

import type { DynamicGenderInput } from "../types"

import { parseBirthHourInput } from "../components/birth-input/birth-input-utils"

import type {
  DiffItem,
  TimelineClock,
  TimelineLogEntry
} from "../components/timeline-test/timeline-types"

import {
  advanceClock,
  buildTimelineDiffs
} from "../components/timeline-test/timeline-utils"

type BirthInputState = {
  year: number
  month: number
  day: number
  hour: number
}

const INITIAL_TIMELINE_CLOCK: TimelineClock = {
  day: 1,
  hour: 8,
  period: "Morning"
}

export function usePersonalityTestState() {
  const [year, setYear] = useState(1900)
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [birthHourInput, setBirthHourInput] = useState("未知")
  const [dynamicGender, setDynamicGender] = useState<DynamicGenderInput>("")

  const parsedBirthHour = useMemo(() => {
    return parseBirthHourInput(birthHourInput)
  }, [birthHourInput])

  const hasBirthHour = parsedBirthHour !== null
  const ziweiHour = parsedBirthHour ?? 0

  const [timelineClock, setTimelineClock] = useState<TimelineClock>({
    ...INITIAL_TIMELINE_CLOCK
  })

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

  const [timelineSnapshot, setTimelineSnapshot] =
    useState<PetTimelineSnapshot | null>(birthBundle.timelineSnapshot)

  const [lastOperation, setLastOperation] = useState("尚未操作")
  const [lastDiffs, setLastDiffs] = useState<DiffItem[]>([])
  const [timelineLogs, setTimelineLogs] = useState<TimelineLogEntry[]>([])

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

  function resetFromBirthInput(nextBirthInput: BirthInputState) {
    const nextBundle = buildPetBirthBundle({
      birthInput: nextBirthInput,
      time: INITIAL_TIMELINE_CLOCK
    })

    setBirthBundle(nextBundle)
    setTimelineSnapshot(nextBundle.timelineSnapshot)
    setTimelineClock({ ...INITIAL_TIMELINE_CLOCK })
    setLastOperation("根据当前出生输入重新初始化测试快照")
    setLastDiffs([])
    setTimelineLogs([])
  }

  function syncZiweiWhenPossible(nextInput: {
    year: number
    month: number
    day: number
    hour: number | null
  }) {
    if (nextInput.hour === null) {
      setLastOperation("当前出生时间未知，仅使用八字三柱生成统一人格")
      setLastDiffs([])
      setTimelineLogs([])
      return
    }

    resetFromBirthInput({
      year: nextInput.year,
      month: nextInput.month,
      day: nextInput.day,
      hour: nextInput.hour
    })
  }

  function handleDateChange(nextInput: {
    year?: number
    month?: number
    day?: number
  }) {
    const nextYear = nextInput.year ?? year
    const nextMonth = nextInput.month ?? month
    const nextDay = nextInput.day ?? day

    setYear(nextYear)
    setMonth(nextMonth)
    setDay(nextDay)

    syncZiweiWhenPossible({
      year: nextYear,
      month: nextMonth,
      day: nextDay,
      hour: parsedBirthHour
    })
  }

  function handleBirthHourInputChange(value: string) {
    const nextHour = parseBirthHourInput(value)

    setBirthHourInput(value)

    syncZiweiWhenPossible({
      year,
      month,
      day,
      hour: nextHour
    })
  }

  function applyTimelineUpdate(
    label: string,
    events?: StateUpdateEvent[],
    hourDelta: number = 0
  ) {
    if (!timelineSnapshot) {
      return
    }

    const beforeSnapshot = timelineSnapshot
    const beforeClock = timelineClock
    const nextClock = advanceClock(timelineClock, hourDelta)

    const nextSnapshot = updatePetAiState({
      currentSnapshot: timelineSnapshot,
      time: {
        day: nextClock.day,
        hour: nextClock.hour,
        period: nextClock.period
      },
      events,
      tickDelta: hourDelta > 0 ? hourDelta : 0,
      shouldRefreshTrajectory: true
    })

    const diffs = buildTimelineDiffs(beforeSnapshot, nextSnapshot)

    const logEntry: TimelineLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      actionLabel: label,
      beforeClock,
      afterClock: nextClock,
      diffs,
      snapshotSummary: {
        phase: nextSnapshot.fortune.phaseTag,
        emotional: nextSnapshot.state.emotional.label,
        energy: Math.round(nextSnapshot.state.physical.energy),
        hunger: Math.round(nextSnapshot.state.physical.hunger),
        cognitive: nextSnapshot.state.cognitive.label,
        relational: nextSnapshot.state.relational.label,
        drive: nextSnapshot.state.drive.primary,
        branch: nextSnapshot.trajectory.branchTag
      },
      createdAt: new Date().toLocaleTimeString()
    }

    setTimelineClock(nextClock)
    setTimelineSnapshot(nextSnapshot)
    setLastOperation(label)
    setLastDiffs(diffs)
    setTimelineLogs((prev) => [logEntry, ...prev])
  }

  function resetTimeline() {
    resetFromBirthInput({
      year,
      month,
      day,
      hour: ziweiHour
    })
    setLastOperation("已重置 timeline 到初始状态")
  }

  return {
    birthInput: {
      year,
      month,
      day,
      birthHourInput,
      dynamicGender,
      parsedBirthHour,
      hasBirthHour
    },

    profileData: {
      birthBundle,
      profile,
      publicView,
      pattern,
      baziProfile,
      finalPersonalityProfile
    },

    timelineData: {
      timelineClock,
      timelineSnapshot,
      lastOperation,
      lastDiffs,
      timelineLogs
    },

    actions: {
      setDynamicGender,
      handleDateChange,
      handleBirthHourInputChange,
      applyTimelineUpdate,
      resetTimeline
    }
  }
}