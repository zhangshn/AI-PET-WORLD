/**
 * 当前文件职责：生成 MVP 世界日志条目。
 */

import type { LifeEventCandidate } from "@/world/life-event/life-event-schema"

import type { MvpVisualRefreshResult } from "./mvp-visual-refresh"
import type { MvpWorldRuntimeTickResult } from "./mvp-world-runtime-tick"

export type MvpWorldLogEntry = {
  id: string
  title: string
  body: string
  tags: string[]
}

export function buildMvpWorldLogEntries(input: {
  runtimeTick: MvpWorldRuntimeTickResult
  visualRefresh: MvpVisualRefreshResult
  lifeEventCandidates: LifeEventCandidate[]
}): MvpWorldLogEntry[] {
  return [
    {
      id: "mvp-log-runtime",
      title: "建设运行",
      body: input.runtimeTick.report.messages[0] ?? "建设运行已完成。",
      tags: ["mvp_world_log", "runtime"],
    },
    {
      id: "mvp-log-visual",
      title: "视觉刷新",
      body: input.visualRefresh.reason,
      tags: ["mvp_world_log", "visual_refresh"],
    },
    {
      id: "mvp-log-life-event",
      title: "生命事件候选",
      body: input.lifeEventCandidates[0]?.reason ?? "当前没有生命事件候选。",
      tags: ["mvp_world_log", "life_event_candidate"],
    },
  ]
}
