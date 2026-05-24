/**
 * 当前文件职责：生成 MVP 世界日志条目。
 */

import type { TownAdoptionCandidate } from "@/world/adoption/town-adoption-precheck-schema"

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
  townAdoptionCandidates: TownAdoptionCandidate[]
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
      id: "mvp-log-town-adoption",
      title: "领养候选观察",
      body: input.townAdoptionCandidates[0]?.reason ?? "当前没有领养候选观察。",
      tags: ["mvp_world_log", "town_adoption_precheck_candidate"],
    },
  ]
}
