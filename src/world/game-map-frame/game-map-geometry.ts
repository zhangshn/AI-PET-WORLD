import type { HomeMapPoint, HomeMapRect } from "./home-map-structure-schema"

export type GameMapBounds = HomeMapRect

export function buildSegmentPolygon(
  start: HomeMapPoint,
  end: HomeMapPoint,
  width: number
): HomeMapPoint[] {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)

  if (length === 0) {
    const halfWidth = width / 2
    return rectToPolygon({
      x: start.x - halfWidth,
      y: start.y - halfWidth,
      width,
      height: width,
    })
  }

  const halfWidth = width / 2
  const nx = (-dy / length) * halfWidth
  const ny = (dx / length) * halfWidth

  return [
    { x: start.x + nx, y: start.y + ny },
    { x: end.x + nx, y: end.y + ny },
    { x: end.x - nx, y: end.y - ny },
    { x: start.x - nx, y: start.y - ny },
  ]
}

export function buildPolylineCorridorPolygon(
  points: HomeMapPoint[],
  width: number
): HomeMapPoint[] {
  if (points.length < 2) {
    return points.length === 1
      ? rectToPolygon({
          x: points[0].x - width / 2,
          y: points[0].y - width / 2,
          width,
          height: width,
        })
      : []
  }

  const halfWidth = width / 2
  const leftPoints: HomeMapPoint[] = []
  const rightPoints: HomeMapPoint[] = []

  for (let index = 0; index < points.length; index += 1) {
    const previous = index > 0 ? segmentNormal(points[index - 1], points[index]) : null
    const next = index < points.length - 1 ? segmentNormal(points[index], points[index + 1]) : null
    const normal = averageNormals(previous, next)

    leftPoints.push({
      x: points[index].x + normal.x * halfWidth,
      y: points[index].y + normal.y * halfWidth,
    })
    rightPoints.push({
      x: points[index].x - normal.x * halfWidth,
      y: points[index].y - normal.y * halfWidth,
    })
  }

  return [...leftPoints, ...rightPoints.reverse()]
}

export function rectToPolygon(rect: HomeMapRect): HomeMapPoint[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
}

export function polygonBounds(points: HomeMapPoint[]): GameMapBounds {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function rectsOverlap(left: HomeMapRect, right: HomeMapRect): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  )
}

export function rectWithinBounds(rect: HomeMapRect, bounds: GameMapBounds): boolean {
  return (
    rect.x >= bounds.x &&
    rect.y >= bounds.y &&
    rect.x + rect.width <= bounds.x + bounds.width &&
    rect.y + rect.height <= bounds.y + bounds.height
  )
}

function segmentNormal(start: HomeMapPoint, end: HomeMapPoint): HomeMapPoint {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.max(1, Math.hypot(dx, dy))

  return {
    x: -dy / length,
    y: dx / length,
  }
}

function averageNormals(
  previous: HomeMapPoint | null,
  next: HomeMapPoint | null
): HomeMapPoint {
  if (!previous && next) return next
  if (previous && !next) return previous
  if (!previous || !next) return { x: 0, y: 1 }

  const x = previous.x + next.x
  const y = previous.y + next.y
  const length = Math.hypot(x, y)

  if (length < 0.001) return next

  return {
    x: x / length,
    y: y / length,
  }
}
