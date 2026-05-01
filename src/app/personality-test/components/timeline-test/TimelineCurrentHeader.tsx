/**
 * 当前文件负责：展示 Timeline 测试面板顶部的当前时间与上次操作。
 */

import { ValueLine } from "../common/ValueLine"

import { formatClock } from "./timeline-utils"
import type { TimelineClock } from "./timeline-types"

export function TimelineCurrentHeader({
  timelineClock,
  lastOperation
}: {
  timelineClock: TimelineClock
  lastOperation: string
}) {
  return (
    <div style={{ lineHeight: 2, marginBottom: 12 }}>
      <ValueLine label="当前时间" value={formatClock(timelineClock)} />
      <ValueLine label="上次操作" value={lastOperation} />
    </div>
  )
}