/**
 * 当前文件负责：执行有限离线补算。
 */

import type {
  WorldSaveSnapshot,
} from "@/world/persistence/world-save-gateway"

import {
  buildOfflineCatchupPlan,
} from "./offline-catchup-planner"
import type {
  OfflineCatchupResult,
} from "./offline-catchup-schema"

export type OfflineCatchupWorldEngine = {
  restoreFromSnapshot: (snapshot: WorldSaveSnapshot) => void
  update: () => void
  getTick: () => number
  addOfflineCatchupReport: (result: OfflineCatchupResult) => void
}

export type RunOfflineCatchupInput = {
  worldEngine: OfflineCatchupWorldEngine
  snapshot: WorldSaveSnapshot
  now: number
}

export function runOfflineCatchup(
  input: RunOfflineCatchupInput
): OfflineCatchupResult {
  const startedAt = Date.now()
  const plan = buildOfflineCatchupPlan(input.snapshot, input.now)

  input.worldEngine.restoreFromSnapshot(input.snapshot)

  const startedAtTick = input.worldEngine.getTick()

  for (let index = 0; index < plan.tickCount; index += 1) {
    input.worldEngine.update()
  }

  const endedAtTick = input.worldEngine.getTick()

  const result: OfflineCatchupResult = {
    plan,
    appliedTickCount: Math.max(0, endedAtTick - startedAtTick),
    startedAtTick,
    endedAtTick,
    startedAt,
    endedAt: Date.now(),
    tags: [
      "offline_catchup",
      `reason_${plan.reason}`,
      plan.shouldCatchup ? "catchup_applied" : "catchup_skipped",
    ],
  }

  if (result.appliedTickCount > 0) {
    input.worldEngine.addOfflineCatchupReport(result)
  }

  return result
}
