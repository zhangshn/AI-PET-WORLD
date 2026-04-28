/**
 * 当前文件负责：判断舞台点击位置是否命中家园结构。
 */

import type { WorldMapState } from "@/world/map/world-map"

import { resolveStageStructureLayout } from "./structure-layout-resolver"

export type StageHitTestPoint = {
  x: number
  y: number
}

export function isPointInsideShelterStructure(input: {
  map: WorldMapState | null
  point: StageHitTestPoint
}): boolean {
  const layout = resolveStageStructureLayout(input.map)
  const shelter = layout.tempShelter

  return isPointInsideRect(input.point, {
    x: shelter.x - 12,
    y: shelter.y - 22,
    width: 164,
    height: 138,
  })
}

function isPointInsideRect(
  point: StageHitTestPoint,
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}