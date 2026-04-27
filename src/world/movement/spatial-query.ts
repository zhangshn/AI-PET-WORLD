/**
 * 当前文件负责：提供世界空间距离、范围查询与最近目标查找。
 */

import type { WorldPosition } from "../map/world-map"

export function getWorldDistance(
  a: WorldPosition,
  b: WorldPosition
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y

  return Math.sqrt(dx * dx + dy * dy)
}

export function isWithinRadius(input: {
  from: WorldPosition
  to: WorldPosition
  radius: number
}): boolean {
  return getWorldDistance(input.from, input.to) <= input.radius
}

export function findNearestPosition<T>(input: {
  origin: WorldPosition
  items: T[]
  getPosition: (item: T) => WorldPosition
}): T | null {
  if (input.items.length === 0) return null

  let nearest = input.items[0]
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const item of input.items) {
    const distance = getWorldDistance(
      input.origin,
      input.getPosition(item)
    )

    if (distance < nearestDistance) {
      nearest = item
      nearestDistance = distance
    }
  }

  return nearest
}