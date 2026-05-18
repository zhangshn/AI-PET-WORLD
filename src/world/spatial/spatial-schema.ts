/**
 * 当前文件职责：定义世界空间层的点线面几何协议。
 */

export type Point2D = {
  x: number
  y: number
}

export type Line2D = {
  points: [Point2D, Point2D, ...Point2D[]]
}

export type Polygon2D = {
  points: [Point2D, Point2D, Point2D, ...Point2D[]]
}

export type MultiPolygon2D = {
  polygons: [Polygon2D, ...Polygon2D[]]
}

export type SpatialShape =
  | {
      kind: "point"
      point: Point2D
    }
  | {
      kind: "line"
      line: Line2D
    }
  | {
      kind: "polygon"
      polygon: Polygon2D
    }
  | {
      kind: "multiPolygon"
      multiPolygon: MultiPolygon2D
    }

export type SpatialBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Point / Line / Polygon 是世界空间的工程抽象，不是贴图。
 * EntityGeometry 描述实体在规则世界里的锚点、占地、碰撞、承重和影响范围。
 */
export type EntityGeometry = {
  id: string
  anchor: Point2D
  footprint: SpatialShape
  collision?: SpatialShape
  support?: SpatialShape
  influence?: SpatialShape
  tags: string[]
}
