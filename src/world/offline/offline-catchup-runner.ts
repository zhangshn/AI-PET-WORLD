/**
 * 当前文件负责：计算世界离线补算计划与补算结果摘要。
 */

import type {
  BuildOfflineCatchupPlanInput,
  BuildOfflineCatchupResultInput,
  OfflineCatchupPlan,
  OfflineCatchupResult,
} from "./offline-catchup-types"

const MIN_OFFLINE_MINUTES_FOR_CATCHUP = 3
const REAL_MINUTES_PER_WORLD_TICK = 5
const MAX_OFFLINE_CATCHUP_TICKS = 24

function clampTickCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(MAX_OFFLINE_CATCHUP_TICKS, Math.floor(value)))
}

export function buildOfflineCatchupPlan(
  input: BuildOfflineCatchupPlanInput
): OfflineCatchupPlan {
  const offlineMs = Math.max(0, input.now - input.lastSavedAt)
  const offlineMinutes = Math.floor(offlineMs / 60_000)

  if (offlineMinutes < MIN_OFFLINE_MINUTES_FOR_CATCHUP) {
    return {
      shouldCatchup: false,
      offlineMs,
      offlineMinutes,
      tickCount: 0,
      reason: "离线时间较短，不进行补算。",
    }
  }

  const rawTickCount = offlineMinutes / REAL_MINUTES_PER_WORLD_TICK
  const tickCount = clampTickCount(rawTickCount)

  if (tickCount <= 0) {
    return {
      shouldCatchup: false,
      offlineMs,
      offlineMinutes,
      tickCount: 0,
      reason: "离线时间不足以形成一个世界 Tick。",
    }
  }

  return {
    shouldCatchup: true,
    offlineMs,
    offlineMinutes,
    tickCount,
    reason: `离线约 ${offlineMinutes} 分钟，补算 ${tickCount} 个世界 Tick。`,
  }
}

export function buildOfflineCatchupResult(
  input: BuildOfflineCatchupResultInput
): OfflineCatchupResult {
  const appliedTickCount = Math.max(0, input.endedAtTick - input.startedAtTick)

  const summary =
    appliedTickCount > 0
      ? `你离开期间，世界继续推进了 ${appliedTickCount} 个 Tick。`
      : "你离开期间，世界状态保持稳定，没有进行额外补算。"

  return {
    plan: input.plan,
    appliedTickCount,
    startedAtTick: input.startedAtTick,
    endedAtTick: input.endedAtTick,
    summary,
  }
}