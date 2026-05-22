/**
 * 当前文件职责：生成 MVP P-Phone 摘要数据。
 */

import type { MvpButlerExplanationEntry } from "./mvp-butler-explanation"
import type { MvpWorldLogEntry } from "./mvp-world-log"

export type MvpPPhoneMessage = {
  id: string
  title: string
  body: string
  tags: string[]
}

export type MvpPPhoneData = {
  id: string
  statusLabel: string
  messages: MvpPPhoneMessage[]
  tags: string[]
}

export function buildMvpPPhoneData(input: {
  worldId: string
  logs: MvpWorldLogEntry[]
  butlerExplanations: MvpButlerExplanationEntry[]
  warningCount: number
}): MvpPPhoneData {
  return {
    id: `mvp-pphone-${normalizeIdToken(input.worldId)}`,
    statusLabel:
      input.warningCount > 0 ? "MVP 闭环需要检查" : "MVP 闭环运行正常",
    messages: [
      ...input.logs.map((log) => ({
        id: `phone-${log.id}`,
        title: log.title,
        body: log.body,
        tags: ["mvp_pphone_message", ...log.tags],
      })),
      ...input.butlerExplanations.map((item) => ({
        id: `phone-${item.id}`,
        title: item.title,
        body: item.body,
        tags: ["mvp_pphone_message", ...item.tags],
      })),
    ],
    tags: [
      "mvp_pphone_data",
      "read_only_summary",
      "not_world_fact",
      "no_default_companion_entry",
    ],
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
