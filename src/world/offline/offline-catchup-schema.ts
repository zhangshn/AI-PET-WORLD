/**
 * 当前文件负责：定义世界离线补算的最小类型。
 */

export type OfflineCatchupReason =
  | "invalid_saved_time"
  | "too_short"
  | "short_gap"
  | "medium_gap"
  | "long_gap"
  | "very_long_gap"

export type OfflineCatchupPlan = {
  shouldCatchup: boolean
  offlineMinutes: number
  tickCount: number
  maxTickCount: number
  reason: OfflineCatchupReason
}

export type OfflineCatchupResult = {
  plan: OfflineCatchupPlan
  appliedTickCount: number
  startedAtTick: number
  endedAtTick: number
  startedAt: number
  endedAt: number
  tags: string[]
}
