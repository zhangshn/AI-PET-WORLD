/**
 * Minimal runtime smoke helper. Import and call manually from a Node/TS runner.
 */

import {
  loadOrCreateRuntimeWorld,
  runAndPersistOneRuntimeTick,
} from "./world-runtime-gateway"

export async function runWorldRuntimeSmoke(): Promise<{
  ok: boolean
  initialTick: number
  nextTick: number
  warnings: string[]
}> {
  const initial = await loadOrCreateRuntimeWorld()
  const result = await runAndPersistOneRuntimeTick()
  const reloaded = await loadOrCreateRuntimeWorld()
  const warnings = [
    ...result.audit.warnings,
    ...(reloaded.tick < result.nextSaveRecord.tick
      ? ["Reloaded runtime tick is behind the persisted tick."]
      : []),
  ]

  return {
    ok:
      result.persisted &&
      result.nextSaveRecord.tick >= initial.tick + 1 &&
      reloaded.tick >= result.nextSaveRecord.tick &&
      warnings.length === 0,
    initialTick: initial.tick,
    nextTick: reloaded.tick,
    warnings,
  }
}
