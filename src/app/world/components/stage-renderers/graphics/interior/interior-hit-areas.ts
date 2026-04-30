/**
 * 当前文件负责：定义住所室内可交互区域。
 */

export type StageHitRect = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 室内右侧木门点击区域。
 *
 * 当前门绘制位置来自：
 * drawInteriorDoor(graphic, 1080, 430)
 *
 * 命中区域故意比视觉门稍大一点，方便用户点击。
 */
export const SHELTER_INTERIOR_DOOR_HIT_BOX: StageHitRect = {
  x: 1060,
  y: 400,
  width: 140,
  height: 190,
}

export function isPointInsideStageRect(
  point: {
    x: number
    y: number
  },
  rect: StageHitRect
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}