/**
 * 当前文件职责：审计本地 V2.6 live runtime tick 输出边界。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type { WorldRuntimeAudit, WorldRuntimeEventLog } from "./world-runtime-schema"

export function auditWorldRuntimeTick(input: {
  nextHomeMapState: HomeMapState
  events: WorldRuntimeEventLog[]
  expectedTick?: number
  storeWriteSucceeded?: boolean
}): WorldRuntimeAudit {
  const warnings: string[] = []

  if (input.storeWriteSucceeded === false) {
    warnings.push("Runtime store write failed; previous save record must remain intact.")
  }
  const eventIds = new Set<string>()

  for (const event of input.events) {
    if (eventIds.has(event.id)) {
      warnings.push(`Duplicate runtime event id: ${event.id}.`)
    }
    eventIds.add(event.id)

    if (input.expectedTick !== undefined && event.tick !== input.expectedTick) {
      warnings.push(
        `Runtime event ${event.id} tick ${event.tick} does not match expected tick ${input.expectedTick}.`
      )
    }

    if (!event.createdAt) {
      warnings.push(`Runtime event ${event.id} is missing createdAt.`)
    }

    if (!event.body.trim()) {
      warnings.push(`Runtime event ${event.id} has empty body.`)
    }

    if (containsForbiddenOfficialToken(event.body)) {
      warnings.push(`Runtime event ${event.id} contains forbidden official world token.`)
    }
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

function containsForbiddenOfficialToken(value: string): boolean {
  const forbiddenTokens = ["pet", "incubator", "embryo"]
  const normalizedValue = value.toLowerCase()

  return forbiddenTokens.some((token) => normalizedValue.includes(token))
}
