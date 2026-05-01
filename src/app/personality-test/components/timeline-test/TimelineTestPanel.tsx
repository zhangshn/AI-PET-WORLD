/**
 * 当前文件负责：组装 Timeline / 状态推进测试面板。
 */

import type {
  PetTimelineSnapshot,
  StateUpdateEvent
} from "../../../../ai/gateway"

import { InfoCard } from "../common/InfoCard"

import { TimelineActionGroup } from "./TimelineActionGroup"
import { TimelineCurrentHeader } from "./TimelineCurrentHeader"
import { TimelineLogList } from "./TimelineLogList"
import { TimelineSnapshotView } from "./TimelineSnapshotView"

import type {
  DiffItem,
  TimelineClock,
  TimelineLogEntry
} from "./timeline-types"

export function TimelineTestPanel({
  timelineClock,
  timelineSnapshot,
  lastOperation,
  lastDiffs,
  timelineLogs,
  onApplyTimelineUpdate,
  onResetTimeline
}: {
  timelineClock: TimelineClock
  timelineSnapshot: PetTimelineSnapshot | null
  lastOperation: string
  lastDiffs: DiffItem[]
  timelineLogs: TimelineLogEntry[]
  onApplyTimelineUpdate: (
    label: string,
    events?: StateUpdateEvent[],
    hourDelta?: number
  ) => void
  onResetTimeline: () => void
}) {
  return (
    <InfoCard title="🌱 Timeline / 状态推进测试">
      <TimelineCurrentHeader
        timelineClock={timelineClock}
        lastOperation={lastOperation}
      />

      <TimelineActionGroup
        onApplyTimelineUpdate={onApplyTimelineUpdate}
        onResetTimeline={onResetTimeline}
      />

      {timelineSnapshot && (
        <TimelineSnapshotView
          timelineSnapshot={timelineSnapshot}
          lastDiffs={lastDiffs}
        />
      )}

      <hr
        style={{
          margin: "16px 0",
          border: "none",
          borderTop: "1px solid #eee"
        }}
      />

      <strong>操作日志</strong>
      <TimelineLogList timelineLogs={timelineLogs} />
    </InfoCard>
  )
}