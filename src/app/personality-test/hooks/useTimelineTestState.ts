/**
 * 当前文件负责：管理 personality-test 页面的 Timeline 测试状态。
 */

import { useState } from "react"

import {
  updatePetAiState,
  type PetTimelineSnapshot,
  type StateUpdateEvent
} from "../../../ai/gateway"

import type {
  DiffItem,
  TimelineClock,
  TimelineLogEntry
} from "../components/timeline-test/timeline-types"

import {
  advanceClock,
  buildTimelineDiffs
} from "../components/timeline-test/timeline-utils"

import { buildTimelineLogEntry } from "../components/timeline-test/timeline-log-utils"

export const INITIAL_TIMELINE_CLOCK: TimelineClock = {
  day: 1,
  hour: 8,
  period: "Morning"
}

export function useTimelineTestState({
  initialSnapshot,
  onResetByBirthInput
}: {
  initialSnapshot: PetTimelineSnapshot | null
  onResetByBirthInput: () => PetTimelineSnapshot | null
}) {
  const [timelineClock, setTimelineClock] = useState<TimelineClock>({
    ...INITIAL_TIMELINE_CLOCK
  })

  const [timelineSnapshot, setTimelineSnapshot] =
    useState<PetTimelineSnapshot | null>(initialSnapshot)

  const [lastOperation, setLastOperation] = useState("尚未操作")
  const [lastDiffs, setLastDiffs] = useState<DiffItem[]>([])
  const [timelineLogs, setTimelineLogs] = useState<TimelineLogEntry[]>([])

  function resetTimelineState(nextSnapshot: PetTimelineSnapshot | null) {
    setTimelineSnapshot(nextSnapshot)
    setTimelineClock({ ...INITIAL_TIMELINE_CLOCK })
    setLastDiffs([])
    setTimelineLogs([])
  }

  function markBirthInputReset(nextSnapshot: PetTimelineSnapshot | null) {
    resetTimelineState(nextSnapshot)
    setLastOperation("根据当前出生输入重新初始化测试快照")
  }

  function markUnknownBirthHour() {
    setLastOperation("当前出生时间未知，仅使用八字三柱生成统一人格")
    setLastDiffs([])
    setTimelineLogs([])
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
    const afterClock = advanceClock(timelineClock, hourDelta)

    const nextSnapshot = updatePetAiState({
      currentSnapshot: timelineSnapshot,
      time: {
        day: afterClock.day,
        hour: afterClock.hour,
        period: afterClock.period
      },
      events,
      tickDelta: hourDelta > 0 ? hourDelta : 0,
      shouldRefreshTrajectory: true
    })

    const diffs = buildTimelineDiffs(beforeSnapshot, nextSnapshot)

    const logEntry = buildTimelineLogEntry({
      label,
      beforeClock,
      afterClock,
      diffs,
      nextSnapshot
    })

    setTimelineClock(afterClock)
    setTimelineSnapshot(nextSnapshot)
    setLastOperation(label)
    setLastDiffs(diffs)
    setTimelineLogs((prev) => [logEntry, ...prev])
  }

  function resetTimeline() {
    const nextSnapshot = onResetByBirthInput()
    resetTimelineState(nextSnapshot)
    setLastOperation("已重置 timeline 到初始状态")
  }

  return {
    timelineData: {
      timelineClock,
      timelineSnapshot,
      lastOperation,
      lastDiffs,
      timelineLogs
    },

    timelineActions: {
      applyTimelineUpdate,
      resetTimeline,
      markBirthInputReset,
      markUnknownBirthHour
    }
  }
}