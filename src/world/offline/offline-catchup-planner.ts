/**
 * 当前文件负责：根据存档时间计算离线补算计划。
 */

import type {
  WorldSaveSnapshot,
} from "@/world/persistence/world-save-gateway"

import type {
  OfflineCatchupPlan,
  OfflineCatchupReason,
} from "./offline-catchup-schema"

const MIN_OFFLINE_MINUTES_FOR_CATCHUP = 2
const MAX_OFFLINE_CATCHUP_TICKS = 48

function clampTickCount(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(MAX_OFFLINE_CATCHUP_TICKS, Math.floor(value)))
}

function resolveSavedAt(snapshot: WorldSaveSnapshot): number | null {
  const savedAt = snapshot.lastPlayedAt ?? snapshot.savedAt

  if (!Number.isFinite(savedAt) || savedAt <= 0) return null

  return savedAt
}

function buildPlan(input: {
  offlineMinutes: number
  tickCount: number
  reason: OfflineCatchupReason
}): OfflineCatchupPlan {
  return {
    shouldCatchup: input.tickCount > 0,
    offlineMinutes: input.offlineMinutes,
    tickCount: clampTickCount(input.tickCount),
    maxTickCount: MAX_OFFLINE_CATCHUP_TICKS,
    reason: input.reason,
  }
}

export function buildOfflineCatchupPlan(
  snapshot: WorldSaveSnapshot,
  now: number
): OfflineCatchupPlan {
  const savedAt = resolveSavedAt(snapshot)

  if (!savedAt || !Number.isFinite(now) || now <= savedAt) {
    return buildPlan({
      offlineMinutes: 0,
      tickCount: 0,
      reason: "invalid_saved_time",
    })
  }

  const offlineMinutes = Math.floor((now - savedAt) / 60_000)

  if (offlineMinutes < MIN_OFFLINE_MINUTES_FOR_CATCHUP) {
    return buildPlan({
      offlineMinutes,
      tickCount: 0,
      reason: "too_short",
    })
  }

  if (offlineMinutes < 30) {
    return buildPlan({
      offlineMinutes,
      tickCount: Math.max(1, Math.min(6, Math.ceil(offlineMinutes / 5))),
      reason: "short_gap",
    })
  }

  if (offlineMinutes < 360) {
    return buildPlan({
      offlineMinutes,
      tickCount: Math.max(6, Math.min(18, Math.ceil(offlineMinutes / 20))),
      reason: "medium_gap",
    })
  }

  if (offlineMinutes < 1440) {
    return buildPlan({
      offlineMinutes,
      tickCount: Math.max(18, Math.min(36, Math.ceil(offlineMinutes / 30))),
      reason: "long_gap",
    })
  }

  return buildPlan({
    offlineMinutes,
    tickCount: MAX_OFFLINE_CATCHUP_TICKS,
    reason: "very_long_gap",
  })
}
