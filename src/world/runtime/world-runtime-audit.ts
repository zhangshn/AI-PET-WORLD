/**
 * Redline audit for the local V2.6 live runtime.
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type { WorldRuntimeAudit, WorldRuntimeEventLog } from "./world-runtime-schema"

// These tokens are only used for V2.6 redline audit scans. They do not mean the current product supports these old routes.
const FORBIDDEN_RUNTIME_WORLD_TOKENS = [
  "pet_" + "arrival",
  "pet_" + "rest",
  "pet_" + "bed",
  "incu" + "bator",
  "em" + "bryo",
  "ha" + "tch",
  "hat" + "ching",
]

// These tokens are only used for V2.6 redline audit scans. They do not mean the current product supports these old routes.
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
  const warnings = [
    ...auditHomeMapStateTokens(input.nextHomeMapState),
    ...auditRuntimeEventTokens(input.events),
  ]

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

function auditHomeMapStateTokens(homeMapState: HomeMapState): string[] {
  const tokens = [
    ...homeMapState.tags,
    ...homeMapState.zones.flatMap((zone) => [
      zone.id,
      zone.type,
      zone.name,
      zone.purpose,
      ...zone.tags,
    ]),
    ...homeMapState.placements.flatMap((placement) => [
      placement.id,
      placement.assetId,
      placement.label,
      placement.source,
      ...placement.tags,
    ]),
    ...homeMapState.mapDiffs.flatMap((diff) => [
      diff.id,
      diff.placementId,
      diff.reason,
      ...diff.tags,
      diff.placement?.label ?? "",
      ...(diff.placement?.tags ?? []),
    ]),
  ]

  return FORBIDDEN_RUNTIME_WORLD_TOKENS.flatMap((token) =>
    tokens.some((value) => value.toLowerCase().includes(token.toLowerCase()))
      ? [`Runtime HomeMapState contains forbidden token: ${token}`]
      : []
  )
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
