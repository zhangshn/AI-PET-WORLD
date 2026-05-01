/**
 * 当前文件负责：组装 Timeline / 状态推进测试面板。
 */

import type {
  PetTimelineSnapshot,
  StateUpdateEvent
} from "../../../../ai/gateway"

import { InfoCard } from "../common/InfoCard"
import { ValueLine } from "../common/ValueLine"

import { TimelineActionButton } from "./TimelineActionButton"
import { TimelineLogList } from "./TimelineLogList"
import { TimelineSnapshotView } from "./TimelineSnapshotView"
import { formatClock } from "./timeline-utils"
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
      <div style={{ lineHeight: 2, marginBottom: 12 }}>
        <ValueLine label="当前时间" value={formatClock(timelineClock)} />
        <ValueLine label="上次操作" value={lastOperation} />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16
        }}
      >
        <TimelineActionButton
          label="推进 +1 小时"
          onClick={() => {
            onApplyTimelineUpdate("推进时间 +1 小时", undefined, 1)
          }}
        />
        <TimelineActionButton
          label="推进 +6 小时"
          onClick={() => {
            onApplyTimelineUpdate("推进时间 +6 小时", undefined, 6)
          }}
        />
        <TimelineActionButton
          label="推进 +1 天"
          onClick={() => {
            onApplyTimelineUpdate("推进时间 +1 天", undefined, 24)
          }}
        />
        <TimelineActionButton
          label="模拟被安抚"
          onClick={() => {
            onApplyTimelineUpdate("模拟被安抚", [
              {
                type: "comforted",
                intensity: 0.75
              }
            ])
          }}
        />
        <TimelineActionButton
          label="模拟环境刺激"
          onClick={() => {
            onApplyTimelineUpdate("模拟环境刺激", [
              {
                type: "stimulated",
                intensity: 0.85
              }
            ])
          }}
        />
        <TimelineActionButton
          label="重置 Timeline"
          onClick={onResetTimeline}
        />
      </div>

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