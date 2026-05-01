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
    const nextSnapshot = onResetByBirthInput()
    resetTimelineState(nextSnapshot)
    setLastOperation("已重置 timeline 到初始状态")
  }

  function markUnknownBirthHour() {
    setLastOperation("当前出生时间未知，仅使用八字三柱生成统一人格")
    setLastDiffs([])
    setTimelineLogs([])
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