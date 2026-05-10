/**
 * 当前文件负责：渲染世界舞台中的像素交互提示。
 *
 * 注意：这里只画玩家一眼能懂的可进入 / 可观察提示，不显示解释文字。
 */

import { Container, Graphics } from "pixi.js"

import type {
  WorldFocusPoint,
} from "../../focus-points/world-focus-point-gateway"
import {
  getFocusPointByKind,
} from "../../focus-points/world-focus-point-gateway"
import type { WorldStageSceneMode } from "../../orchestrator/stage-scene-mode"

export type SyncStageAffordancesInput = {
  layer: Container
  sceneMode: WorldStageSceneMode
  focusPoints: WorldFocusPoint[]
  phase: number
}

export function syncStageAffordances(input: SyncStageAffordancesInput) {
  input.layer.removeChildren()

  const graphic = new Graphics()

  if (input.sceneMode === "shelterInterior") {
    drawInteriorExitAffordance(graphic, input)
  } else {
    drawExteriorAffordances(graphic, input)
  }

  input.layer.addChild(graphic)
}

function drawExteriorAffordances(
  graphic: Graphics,
  input: SyncStageAffordancesInput
) {
  const pulse = 0.26 + Math.max(0, Math.sin(input.phase * 3.1)) * 0.22
  const shelterEntrance = getFocusPointByKind(
    input.focusPoints,
    "shelter_entrance"
  )
  const gardenObserve = getFocusPointByKind(
    input.focusPoints,
    "garden_observe"
  )
  const incubator = getFocusPointByKind(input.focusPoints, "incubator")

  if (shelterEntrance) {
    drawEnterDoorMarker(graphic, shelterEntrance.x, shelterEntrance.y, pulse)
  }

  if (gardenObserve) {
    drawObservePatchMarker(
      graphic,
      gardenObserve.x,
      gardenObserve.y,
      pulse * 0.72
    )
  }

  if (incubator) {
    drawIncubatorFocusMarker(graphic, incubator.x, incubator.y, pulse)
  }
}

function drawEnterDoorMarker(
  graphic: Graphics,
  x: number,
  y: number,
  alpha: number
) {
  graphic.rect(x - 13, y - 5, 26, 3).fill({ color: 0xfde68a, alpha })
  graphic.rect(x - 9, y - 1, 18, 3).fill({ color: 0x86efac, alpha: alpha * 0.72 })
  graphic.rect(x - 5, y + 4, 10, 3).fill({ color: 0xfde68a, alpha: alpha * 0.52 })
}

function drawObservePatchMarker(
  graphic: Graphics,
  x: number,
  y: number,
  alpha: number
) {
  graphic.rect(x - 10, y, 20, 2).fill({ color: 0x93c5fd, alpha })
  graphic.rect(x - 14, y + 5, 6, 2).fill({ color: 0x93c5fd, alpha: alpha * 0.62 })
  graphic.rect(x + 8, y + 5, 6, 2).fill({ color: 0x93c5fd, alpha: alpha * 0.62 })
}

function drawIncubatorFocusMarker(
  graphic: Graphics,
  x: number,
  y: number,
  alpha: number
) {
  graphic.rect(x - 9, y - 8, 18, 3).fill({ color: 0xa7f3d0, alpha })
  graphic.rect(x - 6, y - 13, 12, 3).fill({ color: 0xfde68a, alpha: alpha * 0.72 })
  graphic.rect(x - 3, y - 18, 6, 3).fill({ color: 0xa7f3d0, alpha: alpha * 0.52 })
}

function drawInteriorExitAffordance(
  graphic: Graphics,
  input: SyncStageAffordancesInput
) {
  const pulse = 0.28 + Math.max(0, Math.sin(input.phase * 3.1)) * 0.22
  const shelterExit = getFocusPointByKind(
    input.focusPoints,
    "shelter_exit"
  )

  if (!shelterExit) return

  drawInteriorExitMarker(graphic, shelterExit.x, shelterExit.y - 14, pulse)
}

function drawInteriorExitMarker(
  graphic: Graphics,
  x: number,
  y: number,
  pulse: number
) {

  graphic.rect(x - 14, y, 28, 3).fill({ color: 0xfde68a, alpha: pulse })
  graphic.rect(x - 8, y + 5, 16, 3).fill({ color: 0x93c5fd, alpha: pulse * 0.66 })
  graphic.rect(x - 4, y + 10, 8, 3).fill({ color: 0xfde68a, alpha: pulse * 0.46 })
}
