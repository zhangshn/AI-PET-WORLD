/**
 * 当前文件职责：定义点、线、面组成世界图形的基础语法协议。
 */

import type {
  Line2D,
  Point2D,
  Polygon2D,
  SpatialShape,
} from "@/world/spatial/spatial-gateway"

export type ShapeGrammarPrimitiveKind =
  | "point"
  | "line"
  | "surface"

export type ShapeGrammarPointRole =
  | "anchor"
  | "entrance"
  | "growth_point"
  | "support_point"
  | "function_point"
  | "center"
  | "start"
  | "end"

export type ShapeGrammarLineRole =
  | "connection"
  | "boundary"
  | "road_center"
  | "wall"
  | "river"
  | "beam"
  | "trunk"
  | "ridge"

export type ShapeGrammarSurfaceRole =
  | "land"
  | "water"
  | "forest"
  | "foundation"
  | "roof"
  | "interior"
  | "activity_area"
  | "collision_area"
  | "support_area"
  | "influence_area"
  | "canopy"
  | "root_area"
  | "shadow_area"
  | "road_surface"

export type ShapeGrammarObjectKind =
  | "tree"
  | "house"
  | "road"
  | "generic"

export type ShapeGrammarPoint = {
  id: string
  role: ShapeGrammarPointRole
  point: Point2D
  tags: string[]
}

export type ShapeGrammarLine = {
  id: string
  role: ShapeGrammarLineRole
  line: Line2D
  tags: string[]
}

export type ShapeGrammarSurface = {
  id: string
  role: ShapeGrammarSurfaceRole
  polygon: Polygon2D
  tags: string[]
}

export type ShapeGrammarComposition = {
  id: string
  objectKind: ShapeGrammarObjectKind
  anchor: Point2D
  points: ShapeGrammarPoint[]
  lines: ShapeGrammarLine[]
  surfaces: ShapeGrammarSurface[]
  tags: string[]
}

export type ShapeGrammarSpatialProjection = {
  id: string
  objectKind: ShapeGrammarObjectKind
  anchor: Point2D
  footprint: SpatialShape
  collision?: SpatialShape
  support?: SpatialShape
  influence?: SpatialShape
  tags: string[]
}

export type BuildTreeShapeGrammarInput = {
  id: string
  anchor: Point2D
  scale?: number
  tags?: string[]
}

export type BuildHouseShapeGrammarInput = {
  id: string
  anchor: Point2D
  scale?: number
  tags?: string[]
}

export type BuildRoadShapeGrammarInput = {
  id: string
  start: Point2D
  end: Point2D
  width?: number
  tags?: string[]
}

export type BuildGenericShapeGrammarInput = {
  id: string
  anchor: Point2D
  width?: number
  height?: number
  tags?: string[]
}
