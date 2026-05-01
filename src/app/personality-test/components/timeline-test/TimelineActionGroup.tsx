/**
 * 当前文件负责：展示 Timeline 测试面板中的操作按钮组。
 */

import type { StateUpdateEvent } from "../../../../ai/gateway"

import { TimelineActionButton } from "./TimelineActionButton"

export function TimelineActionGroup({
  onApplyTimelineUpdate,
  onResetTimeline
}: {
  onApplyTimelineUpdate: (
    label: string,
    events?: StateUpdateEvent[],
    hourDelta?: number
  ) => void
  onResetTimeline: () => void
}) {
  return (
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
  )
}