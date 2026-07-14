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

export function polygonsOverlap(
  left: HomeMapPoint[],
  right: HomeMapPoint[]
): boolean {
  if (left.length < 3 || right.length < 3) return false
  if (!rectsOverlap(polygonBounds(left), polygonBounds(right))) return false

  if (left.some((point) => pointInPolygonInterior(point, right))) return true
  if (right.some((point) => pointInPolygonInterior(point, left))) return true

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftStart = left[leftIndex]
    const leftEnd = left[(leftIndex + 1) % left.length]

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightStart = right[rightIndex]
      const rightEnd = right[(rightIndex + 1) % right.length]
      if (segmentsProperlyIntersect(leftStart, leftEnd, rightStart, rightEnd)) return true
    }
  }

  return (
    pointInPolygonInterior(polygonCentroid(left), right) ||
    pointInPolygonInterior(polygonCentroid(right), left)
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

function pointInPolygonInterior(point: HomeMapPoint, polygon: HomeMapPoint[]): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    if (pointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length])) {
      return false
    }
  }

  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[index]
    const end = polygon[previous]
    const crosses =
      start.y > point.y !== end.y > point.y &&
      point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
    if (crosses) inside = !inside
  }
  return inside
}

function segmentsProperlyIntersect(
  leftStart: HomeMapPoint,
  leftEnd: HomeMapPoint,
  rightStart: HomeMapPoint,
  rightEnd: HomeMapPoint
): boolean {
  const leftA = orientation(leftStart, leftEnd, rightStart)
  const leftB = orientation(leftStart, leftEnd, rightEnd)
  const rightA = orientation(rightStart, rightEnd, leftStart)
  const rightB = orientation(rightStart, rightEnd, leftEnd)
  const epsilon = 0.000001

  return (
    leftA * leftB < -epsilon &&
    rightA * rightB < -epsilon
  )
}

function pointOnSegment(
  point: HomeMapPoint,
  start: HomeMapPoint,
  end: HomeMapPoint
): boolean {
  const epsilon = 0.000001
  if (Math.abs(orientation(start, end, point)) > epsilon) return false
  return (
    point.x >= Math.min(start.x, end.x) - epsilon &&
    point.x <= Math.max(start.x, end.x) + epsilon &&
    point.y >= Math.min(start.y, end.y) - epsilon &&
    point.y <= Math.max(start.y, end.y) + epsilon
  )
}

function orientation(start: HomeMapPoint, end: HomeMapPoint, point: HomeMapPoint): number {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x)
}

function polygonCentroid(polygon: HomeMapPoint[]): HomeMapPoint {
  const total = polygon.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  )
  return {
    x: total.x / polygon.length,
    y: total.y / polygon.length,
  }
}
