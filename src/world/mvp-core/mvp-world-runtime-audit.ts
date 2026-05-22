/**
 * 当前文件职责：审计 MVP world runtime tick 输出。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

export type MvpWorldRuntimeAudit = {
  stableRuntimeFingerprint: string
  worldId: string
  warnings: string[]
  tags: string[]
}

export function auditMvpWorldRuntimeTick(result: {
  inputHomeMapState: HomeMapState
  nextHomeMapState: HomeMapState
  constructionWarnings: string[]
  tickReason: string
}): MvpWorldRuntimeAudit {
  const warnings = [
    ...auditLineage(result),
    ...result.constructionWarnings.map(
      (warning) => `Construction warning: ${warning}`
    ),
  ]

  return {
    stableRuntimeFingerprint: [
      result.inputHomeMapState.worldId,
      result.inputHomeMapState.ownerId,
      result.inputHomeMapState.seed,
      result.tickReason,
      String(result.nextHomeMapState.updatedAt),
      String(result.nextHomeMapState.mapDiffs.length),
    ].join("::"),
    worldId: result.inputHomeMapState.worldId,
    warnings,
    tags: [
      "mvp_world_runtime_audit",
      warnings.length === 0 ? "mvp_world_runtime_valid" : "mvp_world_runtime_warning",
      "safe_apply_lineage_required",
    ],
  }
}

function auditLineage(result: {
  inputHomeMapState: HomeMapState
  nextHomeMapState: HomeMapState
}): string[] {
  const warnings: string[] = []

  if (result.inputHomeMapState.worldId !== result.nextHomeMapState.worldId) {
    warnings.push("Runtime tick 不能改变 worldId。")
  }
  if (result.inputHomeMapState.ownerId !== result.nextHomeMapState.ownerId) {
    warnings.push("Runtime tick 不能改变 ownerId。")
  }
  if (result.inputHomeMapState.seed !== result.nextHomeMapState.seed) {
    warnings.push("Runtime tick 不能改变 seed。")
  }

  return warnings
}
