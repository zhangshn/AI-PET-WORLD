/**
 * 当前文件负责：提供 Timeline 测试使用的时间推进与快照差异工具。
 */

import type { PetTimelineSnapshot } from "../../../../ai/gateway"
import type {
  DiffItem,
  TimelineClock
} from "./timeline-types"

export function clampHour(hour: number): number {
  return ((hour % 24) + 24) % 24
}

export function getPeriodFromHour(hour: number): string {
  const safeHour = clampHour(hour)

  if (safeHour >= 6 && safeHour < 12) {
    return "Morning"
  }

  if (safeHour >= 12 && safeHour < 18) {
    return "Daytime"
  }

  if (safeHour >= 18 && safeHour < 22) {
    return "Evening"
  }

  return "Night"
}

export function advanceClock(
  current: TimelineClock,
  hourDelta: number
): TimelineClock {
  const totalHours = (current.day - 1) * 24 + current.hour + hourDelta
  const nextDay = Math.floor(totalHours / 24) + 1
  const nextHour = clampHour(totalHours)

  return {
    day: Math.max(1, nextDay),
    hour: nextHour,
    period: getPeriodFromHour(nextHour)
  }
}

export function formatClock(clock: TimelineClock): string {
  return `Day ${clock.day} - ${clock.hour}:00 - ${clock.period}`
}

function snapshotToComparableMap(snapshot: PetTimelineSnapshot) {
  return {
    phase: snapshot.fortune.phaseTag,
    phaseSummary: snapshot.fortune.summary,
    emotional: snapshot.state.emotional.label,
    energy: Math.round(snapshot.state.physical.energy),
    hunger: Math.round(snapshot.state.physical.hunger),
    cognitive: snapshot.state.cognitive.label,
    relational: snapshot.state.relational.label,
    drive: snapshot.state.drive.primary,
    branch: snapshot.trajectory.branchTag,
    trajectorySummary: snapshot.trajectory.summary
  }
}

export function buildTimelineDiffs(
  before: PetTimelineSnapshot,
  after: PetTimelineSnapshot
): DiffItem[] {
  const beforeMap = snapshotToComparableMap(before)
  const afterMap = snapshotToComparableMap(after)

  const labelMap: Record<string, string> = {
    phase: "阶段标签",
    phaseSummary: "阶段摘要",
    emotional: "情绪状态",
    energy: "生理能量",
    hunger: "饥饿程度",
    cognitive: "认知状态",
    relational: "关系状态",
    drive: "当前驱动",
    branch: "生命路径",
    trajectorySummary: "路径摘要"
  }

  const diffs: DiffItem[] = []

  Object.keys(beforeMap).forEach((key) => {
    const typedKey = key as keyof typeof beforeMap

    if (beforeMap[typedKey] !== afterMap[typedKey]) {
      diffs.push({
        label: labelMap[key] || key,
        before: beforeMap[typedKey] as string | number,
        after: afterMap[typedKey] as string | number
      })
    }
  })

  return diffs
}