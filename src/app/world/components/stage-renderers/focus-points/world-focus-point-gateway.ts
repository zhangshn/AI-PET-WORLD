/**
 * 当前文件负责：统一导出世界焦点点位入口。
 */

import type {
  WorldFocusPoint,
  WorldFocusPointKind,
  WorldFocusPointPurpose,
} from "./world-focus-point-types"

export {
  buildWorldFocusPoints,
} from "./world-focus-point-builder"

export type {
  BuildWorldFocusPointsInput,
} from "./world-focus-point-builder"

export type {
  WorldFocusPoint,
  WorldFocusPointKind,
  WorldFocusPointPurpose,
} from "./world-focus-point-types"

export function getFocusPointByKind(
  points: WorldFocusPoint[],
  kind: WorldFocusPointKind
): WorldFocusPoint | null {
  return points.find((point) => point.kind === kind && point.enabled) ?? null
}

export function getBestFocusPointByPurpose(
  points: WorldFocusPoint[],
  purpose: WorldFocusPointPurpose
): WorldFocusPoint | null {
  const candidates = points.filter(
    (point) => point.enabled && point.purpose.includes(purpose)
  )

  return [...candidates].sort((a, b) => b.priority - a.priority)[0] ?? null
}
