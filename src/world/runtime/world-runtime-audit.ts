/**
 * Redline audit for the local V2.6 live runtime.
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type { WorldRuntimeAudit, WorldRuntimeEventLog } from "./world-runtime-schema"

const FORBIDDEN_RUNTIME_EVENT_TOKENS = [
  "领养" + "候选",
  "候选" + "宠物",
  "伴生" + "生命",
  "生命" + "事件",
  "Life" + "Event",
  "Companion" + "Decision",
]

export function auditWorldRuntimeTick(input: {
  nextHomeMapState: HomeMapState
  events: WorldRuntimeEventLog[]
  storeWriteSucceeded?: boolean
}): WorldRuntimeAudit {
  const warnings = [...auditRuntimeEventTokens(input.events)]

  if (input.storeWriteSucceeded === false) {
    warnings.push("Runtime store write failed; previous save record must remain intact.")
  }

  return {
    ok: warnings.length === 0,
    warnings,
    tags: [
      "world_runtime_audit",
      warnings.length === 0 ? "world_runtime_audit_passed" : "world_runtime_audit_warning",
      "ui_does_not_generate_home_map_state",
      "safe_apply_required",
    ],
  }
}

function auditRuntimeEventTokens(events: WorldRuntimeEventLog[]): string[] {
  const text = events
    .flatMap((event) => [event.title, event.body, event.source, ...event.tags])
    .join(" ")

  return FORBIDDEN_RUNTIME_EVENT_TOKENS.flatMap((token) =>
    text.includes(token)
      ? [`Runtime event contains forbidden token: ${token}`]
      : []
  )
}
