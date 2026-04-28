/**
 * 当前文件负责：渲染世界舞台时间氛围遮罩。
 */

import type { Graphics } from "pixi.js"

export type SyncStageOverlayInput = {
  overlay: Graphics | null
  width: number
  height: number
  period?: string
}

export function syncStageOverlay(input: SyncStageOverlayInput) {
  const overlay = input.overlay

  if (!overlay) return

  overlay.clear()
  overlay.rect(0, 0, input.width, input.height).fill({
    color: 0x020617,
    alpha: getOverlayAlpha(input.period),
  })
}

function getOverlayAlpha(period?: string): number {
  if (period === "Morning") return 0.025
  if (period === "Daytime") return 0
  if (period === "Evening") return 0.06
  if (period === "Night") return 0.16

  return 0.02
}