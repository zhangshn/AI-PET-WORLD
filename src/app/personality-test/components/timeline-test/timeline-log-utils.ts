/**
 * 当前文件负责：构建 Timeline 测试操作日志。
 */

import type { PetTimelineSnapshot } from "../../../../ai/gateway"

import type {
  DiffItem,
  TimelineClock,
  TimelineLogEntry
} from "./timeline-types"

export function buildTimelineLogEntry(params: {
  label: string
  beforeClock: TimelineClock
  afterClock: TimelineClock
  diffs: DiffItem[]
  nextSnapshot: PetTimelineSnapshot
}): TimelineLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actionLabel: params.label,
    beforeClock: params.beforeClock,
    afterClock: params.afterClock,
    diffs: params.diffs,
    snapshotSummary: {
      phase: params.nextSnapshot.fortune.phaseTag,
      emotional: params.nextSnapshot.state.emotional.label,
      energy: Math.round(params.nextSnapshot.state.physical.energy),
      hunger: Math.round(params.nextSnapshot.state.physical.hunger),
      cognitive: params.nextSnapshot.state.cognitive.label,
      relational: params.nextSnapshot.state.relational.label,
      drive: params.nextSnapshot.state.drive.primary,
      branch: params.nextSnapshot.trajectory.branchTag
    },
    createdAt: new Date().toLocaleTimeString()
  }
}