/**
 * 当前文件职责：根据点、线、面语法生成基础世界对象图形。
 */

import type {
  Point2D,
  Polygon2D,
  SpatialShape,
} from "@/world/spatial/spatial-gateway"

import type {
  BuildGenericShapeGrammarInput,
  BuildHouseShapeGrammarInput,
  BuildRoadShapeGrammarInput,
  BuildTreeShapeGrammarInput,
  ShapeGrammarComposition,
  ShapeGrammarSpatialProjection,
  ShapeGrammarSurface,
} from "./shape-grammar-schema"

export function buildTreeShapeGrammar(
  input: BuildTreeShapeGrammarInput
): ShapeGrammarComposition {
  const scale = input.scale ?? 1
  const tags = input.tags ?? []
  const compositionTags = ["shape_grammar_v0", "object:tree", ...tags]
  const growthPoint = {
    x: input.anchor.x,
    y: input.anchor.y - 0.8 * scale,
  }

  return {
    id: input.id,
    objectKind: "tree",
    anchor: input.anchor,
    points: [
      {
        id: `${input.id}:point:anchor`,
        role: "anchor",
        point: input.anchor,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:trunk_center`,
        role: "center",
        point: input.anchor,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:growth_point`,
        role: "growth_point",
        point: growthPoint,
        tags: compositionTags,
      },
    ],
    lines: [
      {
        id: `${input.id}:line:trunk`,
        role: "trunk",
        line: buildLine({ start: input.anchor, end: growthPoint }),
        tags: compositionTags,
      },
    ],
    surfaces: [
      {
        id: `${input.id}:surface:canopy`,
        role: "canopy",
        polygon: buildRectanglePolygon({
          center: growthPoint,
          width: 1.4 * scale,
          height: 1.2 * scale,
        }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:surface:root_area`,
        role: "root_area",
        polygon: buildRectanglePolygon({
          center: input.anchor,
          width: 1.2 * scale,
          height: 0.7 * scale,
        }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:surface:shadow_area`,
        role: "shadow_area",
        polygon: buildRectanglePolygon({
          center: {
            x: input.anchor.x + 0.2 * scale,
            y: input.anchor.y + 0.4 * scale,
          },
          width: 1.7 * scale,
          height: 0.8 * scale,
        }),
        tags: compositionTags,
      },
    ],
    tags: compositionTags,
  }
}

export function buildHouseShapeGrammar(
  input: BuildHouseShapeGrammarInput
): ShapeGrammarComposition {
  const scale = input.scale ?? 1
  const tags = input.tags ?? []
  const compositionTags = ["shape_grammar_v0", "object:house", ...tags]
  const entrance = { x: input.anchor.x, y: input.anchor.y + 0.9 * scale }
  const leftFront = {
    x: input.anchor.x - 0.8 * scale,
    y: input.anchor.y + 0.6 * scale,
  }
  const rightFront = {
    x: input.anchor.x + 0.8 * scale,
    y: input.anchor.y + 0.6 * scale,
  }
  const leftBack = {
    x: input.anchor.x - 0.8 * scale,
    y: input.anchor.y - 0.6 * scale,
  }
  const rightBack = {
    x: input.anchor.x + 0.8 * scale,
    y: input.anchor.y - 0.6 * scale,
  }

  return {
    id: input.id,
    objectKind: "house",
    anchor: input.anchor,
    points: [
      {
        id: `${input.id}:point:anchor`,
        role: "anchor",
        point: input.anchor,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:entrance`,
        role: "entrance",
        point: entrance,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:support_left_front`,
        role: "support_point",
        point: leftFront,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:support_right_front`,
        role: "support_point",
        point: rightFront,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:support_left_back`,
        role: "support_point",
        point: leftBack,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:support_right_back`,
        role: "support_point",
        point: rightBack,
        tags: compositionTags,
      },
    ],
    lines: [
      {
        id: `${input.id}:line:front_wall`,
        role: "wall",
        line: buildLine({ start: leftFront, end: rightFront }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:back_wall`,
        role: "wall",
        line: buildLine({ start: leftBack, end: rightBack }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:left_wall`,
        role: "wall",
        line: buildLine({ start: leftBack, end: leftFront }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:right_wall`,
        role: "wall",
        line: buildLine({ start: rightBack, end: rightFront }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:roof_ridge`,
        role: "ridge",
        line: buildLine({
          start: {
            x: input.anchor.x - 0.6 * scale,
            y: input.anchor.y - 0.9 * scale,
          },
          end: {
            x: input.anchor.x + 0.6 * scale,
            y: input.anchor.y - 0.9 * scale,
          },
        }),
        tags: compositionTags,
      },
    ],
    surfaces: [
      {
        id: `${input.id}:surface:foundation`,
        role: "foundation",
        polygon: buildRectanglePolygon({
          center: input.anchor,
          width: 2 * scale,
          height: 1.6 * scale,
        }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:surface:interior`,
        role: "interior",
        polygon: buildRectanglePolygon({
          center: input.anchor,
          width: 1.5 * scale,
          height: 1.1 * scale,
        }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:surface:roof`,
        role: "roof",
        polygon: buildRectanglePolygon({
          center: {
            x: input.anchor.x,
            y: input.anchor.y - 0.35 * scale,
          },
          width: 2.2 * scale,
          height: 1.4 * scale,
        }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:surface:collision_area`,
        role: "collision_area",
        polygon: buildRectanglePolygon({
          center: input.anchor,
          width: 2 * scale,
          height: 1.6 * scale,
        }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:surface:support_area`,
        role: "support_area",
        polygon: buildRectanglePolygon({
          center: input.anchor,
          width: 2 * scale,
          height: 1.6 * scale,
        }),
        tags: compositionTags,
      },
    ],
    tags: compositionTags,
  }
}

export function buildRoadShapeGrammar(
  input: BuildRoadShapeGrammarInput
): ShapeGrammarComposition {
  const width = input.width ?? 0.8
  const tags = input.tags ?? []
  const compositionTags = ["shape_grammar_v0", "object:road", ...tags]
  const center = averagePoint({ a: input.start, b: input.end })
  const isHorizontal = isMostlyHorizontalRoad({
    start: input.start,
    end: input.end,
  })
  const boundaryOffset = width / 2
  const leftBoundaryStart = isHorizontal
    ? { x: input.start.x, y: input.start.y - boundaryOffset }
    : { x: input.start.x - boundaryOffset, y: input.start.y }
  const leftBoundaryEnd = isHorizontal
    ? { x: input.end.x, y: input.end.y - boundaryOffset }
    : { x: input.end.x - boundaryOffset, y: input.end.y }
  const rightBoundaryStart = isHorizontal
    ? { x: input.start.x, y: input.start.y + boundaryOffset }
    : { x: input.start.x + boundaryOffset, y: input.start.y }
  const rightBoundaryEnd = isHorizontal
    ? { x: input.end.x, y: input.end.y + boundaryOffset }
    : { x: input.end.x + boundaryOffset, y: input.end.y }
  const roadSurfaceWidth = isHorizontal
    ? Math.abs(input.end.x - input.start.x) + width
    : width
  const roadSurfaceHeight = isHorizontal
    ? width
    : Math.abs(input.end.y - input.start.y) + width

  return {
    id: input.id,
    objectKind: "road",
    anchor: center,
    points: [
      {
        id: `${input.id}:point:start`,
        role: "start",
        point: input.start,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:end`,
        role: "end",
        point: input.end,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:center`,
        role: "center",
        point: center,
        tags: compositionTags,
      },
    ],
    lines: [
      {
        id: `${input.id}:line:road_center`,
        role: "road_center",
        line: buildLine({ start: input.start, end: input.end }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:left_boundary`,
        role: "boundary",
        line: buildLine({ start: leftBoundaryStart, end: leftBoundaryEnd }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:right_boundary`,
        role: "boundary",
        line: buildLine({ start: rightBoundaryStart, end: rightBoundaryEnd }),
        tags: compositionTags,
      },
    ],
    surfaces: [
      {
        id: `${input.id}:surface:road_surface`,
        role: "road_surface",
        polygon: buildRectanglePolygon({
          center,
          width: roadSurfaceWidth,
          height: roadSurfaceHeight,
        }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:surface:influence_area`,
        role: "influence_area",
        polygon: buildRectanglePolygon({
          center,
          width: roadSurfaceWidth + 0.4,
          height: roadSurfaceHeight + 0.4,
        }),
        tags: compositionTags,
      },
    ],
    tags: compositionTags,
  }
}

export function buildGenericShapeGrammar(
  input: BuildGenericShapeGrammarInput
): ShapeGrammarComposition {
  const width = input.width ?? 1
  const height = input.height ?? 1
  const tags = input.tags ?? []
  const compositionTags = ["shape_grammar_v0", "object:generic", ...tags]
  const minX = input.anchor.x - width / 2
  const maxX = input.anchor.x + width / 2
  const minY = input.anchor.y - height / 2
  const maxY = input.anchor.y + height / 2
  const topLeft = { x: minX, y: minY }
  const topRight = { x: maxX, y: minY }
  const bottomRight = { x: maxX, y: maxY }
  const bottomLeft = { x: minX, y: maxY }

  return {
    id: input.id,
    objectKind: "generic",
    anchor: input.anchor,
    points: [
      {
        id: `${input.id}:point:anchor`,
        role: "anchor",
        point: input.anchor,
        tags: compositionTags,
      },
      {
        id: `${input.id}:point:center`,
        role: "center",
        point: input.anchor,
        tags: compositionTags,
      },
    ],
    lines: [
      {
        id: `${input.id}:line:boundary_top`,
        role: "boundary",
        line: buildLine({ start: topLeft, end: topRight }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:boundary_right`,
        role: "boundary",
        line: buildLine({ start: topRight, end: bottomRight }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:boundary_bottom`,
        role: "boundary",
        line: buildLine({ start: bottomRight, end: bottomLeft }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:line:boundary_left`,
        role: "boundary",
        line: buildLine({ start: bottomLeft, end: topLeft }),
        tags: compositionTags,
      },
    ],
    surfaces: [
      {
        id: `${input.id}:surface:collision_area`,
        role: "collision_area",
        polygon: buildRectanglePolygon({
          center: input.anchor,
          width,
          height,
        }),
        tags: compositionTags,
      },
      {
        id: `${input.id}:surface:influence_area`,
        role: "influence_area",
        polygon: buildRectanglePolygon({
          center: input.anchor,
          width: width + 0.4,
          height: height + 0.4,
        }),
        tags: compositionTags,
      },
    ],
    tags: compositionTags,
  }
}

export function projectShapeGrammarToSpatialProjection(
  composition: ShapeGrammarComposition
): ShapeGrammarSpatialProjection {
  const footprintSurface =
    findSurfaceByRole(composition, "foundation") ??
    findSurfaceByRole(composition, "road_surface") ??
    findSurfaceByRole(composition, "root_area") ??
    findSurfaceByRole(composition, "collision_area") ??
    findSurfaceByRole(composition, "influence_area") ??
    composition.surfaces[0]
  const footprint = footprintSurface
    ? buildShapeFromPolygon(footprintSurface.polygon)
    : buildShapeFromPoint(composition.anchor)
  const collisionSurface =
    findSurfaceByRole(composition, "collision_area") ??
    (composition.objectKind === "house"
      ? findSurfaceByRole(composition, "foundation")
      : undefined) ??
    (composition.objectKind === "tree"
      ? findSurfaceByRole(composition, "canopy")
      : undefined)
  const supportSurface =
    findSurfaceByRole(composition, "support_area") ??
    (composition.objectKind === "house"
      ? findSurfaceByRole(composition, "foundation")
      : undefined)
  const influenceSurface =
    findSurfaceByRole(composition, "influence_area") ??
    (composition.objectKind === "tree"
      ? findSurfaceByRole(composition, "root_area") ??
        findSurfaceByRole(composition, "shadow_area")
      : undefined)

  return {
    id: composition.id,
    objectKind: composition.objectKind,
    anchor: composition.anchor,
    footprint,
    collision: collisionSurface
      ? buildShapeFromPolygon(collisionSurface.polygon)
      : composition.objectKind === "generic"
        ? footprint
        : undefined,
    support: supportSurface
      ? buildShapeFromPolygon(supportSurface.polygon)
      : undefined,
    influence: influenceSurface
      ? buildShapeFromPolygon(influenceSurface.polygon)
      : undefined,
    tags: [
      ...composition.tags,
      "shape_grammar_spatial_projection_v0",
    ],
  }
}

function buildRectanglePolygon(input: {
  center: Point2D
  width: number
  height: number
}): Polygon2D {
  const halfWidth = input.width / 2
  const halfHeight = input.height / 2

  return {
    points: [
      { x: input.center.x - halfWidth, y: input.center.y - halfHeight },
      { x: input.center.x + halfWidth, y: input.center.y - halfHeight },
      { x: input.center.x + halfWidth, y: input.center.y + halfHeight },
      { x: input.center.x - halfWidth, y: input.center.y + halfHeight },
    ],
  }
}

function buildLine(input: {
  start: Point2D
  end: Point2D
}): { points: [Point2D, Point2D] } {
  return {
    points: [input.start, input.end],
  }
}

function buildShapeFromPolygon(polygon: Polygon2D): SpatialShape {
  return {
    kind: "polygon",
    polygon,
  }
}

function buildShapeFromPoint(point: Point2D): SpatialShape {
  return {
    kind: "point",
    point,
  }
}

function findSurfaceByRole(
  composition: ShapeGrammarComposition,
  role: ShapeGrammarSurface["role"]
): ShapeGrammarSurface | undefined {
  return composition.surfaces.find((surface) => surface.role === role)
}

function isMostlyHorizontalRoad(input: {
  start: Point2D
  end: Point2D
}): boolean {
  return Math.abs(input.end.x - input.start.x) >=
    Math.abs(input.end.y - input.start.y)
}

function averagePoint(input: {
  a: Point2D
  b: Point2D
}): Point2D {
  return {
    x: (input.a.x + input.b.x) / 2,
    y: (input.a.y + input.b.y) / 2,
  }
}
