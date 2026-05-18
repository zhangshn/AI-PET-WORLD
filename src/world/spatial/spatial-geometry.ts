/**
 * 当前文件职责：提供世界空间层的轻量几何纯函数。
 */

import type {
  Point2D,
  Polygon2D,
  SpatialBounds,
  SpatialShape,
} from "./spatial-schema"

export function buildBoundsFromPoints(points: readonly Point2D[]): SpatialBounds {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    }
  }

  const [firstPoint, ...remainingPoints] = points

  return remainingPoints.reduce<SpatialBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: firstPoint.x,
      minY: firstPoint.y,
      maxX: firstPoint.x,
      maxY: firstPoint.y,
    }
  )
}

export function buildBoundsFromShape(shape: SpatialShape): SpatialBounds {
  if (shape.kind === "point") {
    return buildBoundsFromPoints([shape.point])
  }

  if (shape.kind === "line") {
    return buildBoundsFromPoints(shape.line.points)
  }

  if (shape.kind === "polygon") {
    return buildBoundsFromPoints(shape.polygon.points)
  }

  return buildBoundsFromPoints(
    shape.multiPolygon.polygons.flatMap((polygon) => polygon.points)
  )
}

export function isPointInBounds(
  point: Point2D,
  bounds: SpatialBounds
): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  )
}

export function doBoundsOverlap(
  a: SpatialBounds,
  b: SpatialBounds
): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  )
}

export function isPointInPolygon(
  point: Point2D,
  polygon: Polygon2D
): boolean {
  const points = polygon.points
  let isInside = false

  for (
    let currentIndex = 0, previousIndex = points.length - 1;
    currentIndex < points.length;
    previousIndex = currentIndex
  ) {
    const currentPoint = points[currentIndex]
    const previousPoint = points[previousIndex]
    const crossesHorizontalRay =
      currentPoint.y > point.y !== previousPoint.y > point.y

    if (crossesHorizontalRay) {
      const intersectionX =
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
        currentPoint.x

      if (point.x < intersectionX) {
        isInside = !isInside
      }
    }
  }

  return isInside
}

export function doPolygonBoundsOverlap(
  a: Polygon2D,
  b: Polygon2D
): boolean {
  return doBoundsOverlap(
    buildBoundsFromPoints(a.points),
    buildBoundsFromPoints(b.points)
  )
}
