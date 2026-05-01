/**
 * 当前文件负责：展示 Timeline 测试操作日志。
 */

import { formatClock } from "./timeline-utils"
import type { TimelineLogEntry } from "./timeline-types"

export function TimelineLogList({
  timelineLogs
}: {
  timelineLogs: TimelineLogEntry[]
}) {
  return (
    <div style={{ marginTop: 10, lineHeight: 1.8 }}>
      {timelineLogs.length > 0 ? (
        timelineLogs.slice(0, 20).map((item) => {
          return (
            <div
              key={item.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
                background: "#fafafa"
              }}
            >
              <div>
                <strong>{item.actionLabel}</strong>
                <span style={{ color: "#999", marginLeft: 8 }}>
                  {item.createdAt}
                </span>
              </div>
              <div style={{ color: "#666" }}>
                {formatClock(item.beforeClock)} → {formatClock(item.afterClock)}
              </div>
              <div>
                phase: {item.snapshotSummary.phase} | emotional:{" "}
                {item.snapshotSummary.emotional} | energy:{" "}
                {item.snapshotSummary.energy} | hunger:{" "}
                {item.snapshotSummary.hunger} | drive:{" "}
                {item.snapshotSummary.drive}
              </div>
            </div>
          )
        })
      ) : (
        <div style={{ color: "#999" }}>暂无日志</div>
      )}
    </div>
  )
}