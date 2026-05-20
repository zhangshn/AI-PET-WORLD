/**
 * 当前文件职责：将地图 placement 转换为规则世界的实体几何描述。
 */

import type { MapPlacement, MapPlacementLayer } from "@/world/map-state/home-map-state-schema"
import {
  buildGenericShapeGrammar,
  buildHouseShapeGrammar,
  buildRoadShapeGrammar,
  buildTreeShapeGrammar,
  projectShapeGrammarToSpatialProjection,
} from "@/world/shape-grammar/shape-grammar-gateway"
import type {
  ShapeGrammarComposition,
  ShapeGrammarObjectKind,
} from "@/world/shape-grammar/shape-grammar-gateway"
import type {
  EntityGeometry,
  Point2D,
  Polygon2D,
  SpatialShape,
} from "@/world/spatial/spatial-gateway"

export type BuildEntityGeometryFromPlacementInput = {
  placement: MapPlacement
  tileSize?: number
}

type LayerFootprintSize = {
  width: number
  height: number
}

type PlacementShapeGrammarKind =
  | "tree"
  | "house"
  | "road"
  | "generic"
  | "fallback"

const DEFAULT_TILE_SIZE = 1

const LAYER_FOOTPRINT_SIZE: Record<MapPlacementLayer, LayerFootprintSize> = {
  ground: { width: 1, height: 1 },
  path: { width: 1, height: 1 },
  edge: { width: 1, height: 1 },
  zone: { width: 1, height: 1 },
  "surface-decoration": { width: 0.5, height: 0.5 },
  nature: { width: 1.2, height: 1.2 },
  facility: { width: 1, height: 1 },
  structure: { width: 2, height: 2 },
  actor: { width: 0.8, height: 0.8 },
  atmosphere: { width: 1, height: 1 },
}

const COLLISION_LAYERS = new Set<MapPlacementLayer>([
  "structure",
  "facility",
  "actor",
  "nature",
])

const SUPPORT_LAYERS = new Set<MapPlacementLayer>([
  "structure",
  "facility",
  "actor",
])

export function buildEntityGeometryFromPlacement(
  input: BuildEntityGeometryFromPlacementInput
): EntityGeometry {
  const { placement } = input
  const tileSize = input.tileSize ?? DEFAULT_TILE_SIZE
  const shapeGrammarKind = inferPlacementShapeGrammarKind(placement)

  if (shapeGrammarKind !== "fallback") {
    const composition = buildShapeGrammarFromPlacement({
      placement,
      shapeGrammarKind,
    })
    const projection = projectShapeGrammarToSpatialProjection(composition)

    return {
      id: placement.id,
      anchor: projection.anchor,
      footprint: projection.footprint,
      collision: projection.collision,
      support: projection.support,
      influence: projection.influence,
      tags: buildGeometryTags(placement, {
        shapeGrammarKind,
        projectionTags: projection.tags,
      }),
    }
  }

  const anchor: Point2D = {
    x: placement.x,
    y: placement.y,
  }
  const footprint = buildFootprintShape(placement, tileSize)

  return {
    id: placement.id,
    anchor,
    footprint,
    collision: buildCollisionShape(placement, footprint, tileSize),
    support: SUPPORT_LAYERS.has(placement.layer) ? footprint : undefined,
    influence: buildInfluenceShape(placement, tileSize),
    tags: buildGeometryTags(placement),
  }
}

function inferPlacementShapeGrammarKind(
  placement: MapPlacement
): PlacementShapeGrammarKind {
  const normalizedAssetId = placement.assetId.toLowerCase()
  const normalizedTags = placement.tags.map((tag) => tag.toLowerCase())

  if (
    placement.layer === "nature" &&
    (normalizedTags.includes("tree") || normalizedAssetId.includes("tree"))
  ) {
    return "tree"
  }

  if (
    placement.layer === "structure" &&
    (normalizedTags.includes("house") ||
      normalizedTags.includes("temporary_shelter") ||
      normalizedTags.includes("shelter") ||
      normalizedTags.includes("foundation") ||
      normalizedAssetId.includes("shelter") ||
      normalizedAssetId.includes("house") ||
      normalizedAssetId.includes("building"))
  ) {
    return "house"
  }

  if (placement.layer === "path") {
    return "road"
  }

  if (
    placement.layer === "facility" ||
    placement.layer === "actor" ||
    placement.layer === "surface-decoration"
  ) {
    return "generic"
  }

  return "fallback"
}

function buildShapeGrammarFromPlacement(input: {
  placement: MapPlacement
  shapeGrammarKind: Exclude<PlacementShapeGrammarKind, "fallback">
}): ShapeGrammarComposition {
  const anchor = {
    x: input.placement.x,
    y: input.placement.y,
  }
  const scale = input.placement.scale

  if (input.shapeGrammarKind === "tree") {
    return buildTreeShapeGrammar({
      id: input.placement.id,
      anchor,
      scale,
      tags: buildShapeGrammarTags(input.placement, "tree"),
    })
  }

  if (input.shapeGrammarKind === "house") {
    return buildHouseShapeGrammar({
      id: input.placement.id,
      anchor,
      scale,
      tags: buildShapeGrammarTags(input.placement, "house"),
    })
  }

  if (input.shapeGrammarKind === "road") {
    const normalizedAssetId = input.placement.assetId.toLowerCase()
    const normalizedTags = input.placement.tags.map((tag) => tag.toLowerCase())
    const isVertical =
      normalizedTags.includes("vertical_path") ||
      normalizedAssetId.includes("vertical")
    const start = isVertical
      ? { x: input.placement.x, y: input.placement.y - 0.5 * scale }
      : { x: input.placement.x - 0.5 * scale, y: input.placement.y }
    const end = isVertical
      ? { x: input.placement.x, y: input.placement.y + 0.5 * scale }
      : { x: input.placement.x + 0.5 * scale, y: input.placement.y }

    return buildRoadShapeGrammar({
      id: input.placement.id,
      start,
      end,
      width: 0.8 * scale,
      tags: buildShapeGrammarTags(input.placement, "road"),
    })
  }

  const size = inferGenericShapeGrammarSize(input.placement)

  return buildGenericShapeGrammar({
    id: input.placement.id,
    anchor,
    width: size.width * scale,
    height: size.height * scale,
    tags: buildShapeGrammarTags(input.placement, "generic"),
  })
}

function inferGenericShapeGrammarSize(
  placement: MapPlacement
): LayerFootprintSize {
  if (placement.layer === "facility") {
    return { width: 1, height: 1 }
  }

  if (placement.layer === "actor") {
    return { width: 0.8, height: 0.8 }
  }

  if (placement.layer === "surface-decoration") {
    return { width: 0.5, height: 0.5 }
  }

  return { width: 1, height: 1 }
}

function buildShapeGrammarTags(
  placement: MapPlacement,
  shapeGrammarKind: ShapeGrammarObjectKind
): string[] {
  return [
    "shape_grammar_adapter_v0",
    `shape_grammar_kind:${shapeGrammarKind}`,
    `placement_layer:${placement.layer}`,
    `asset:${placement.assetId}`,
    `source:${placement.source}`,
    ...placement.tags,
  ]
}

function buildFootprintShape(
  placement: MapPlacement,
  tileSize: number
): SpatialShape {
  const baseSize = LAYER_FOOTPRINT_SIZE[placement.layer]
  return {
    kind: "polygon",
    polygon: buildRectanglePolygon({
      anchor: { x: placement.x, y: placement.y },
      width: baseSize.width * tileSize * placement.scale,
      height: baseSize.height * tileSize * placement.scale,
    }),
  }
}

function buildCollisionShape(
  placement: MapPlacement,
  footprint: SpatialShape,
  tileSize: number
): SpatialShape | undefined {
  if (!COLLISION_LAYERS.has(placement.layer)) {
    return undefined
  }

  if (placement.layer !== "nature") {
    return footprint
  }

  const baseSize = LAYER_FOOTPRINT_SIZE[placement.layer]
  return {
    kind: "polygon",
    polygon: buildRectanglePolygon({
      anchor: { x: placement.x, y: placement.y },
      width: baseSize.width * tileSize * placement.scale * 0.75,
      height: baseSize.height * tileSize * placement.scale * 0.75,
    }),
  }
}

function buildInfluenceShape(
  placement: MapPlacement,
  tileSize: number
): SpatialShape | undefined {
  if (
    placement.layer !== "nature" &&
    placement.layer !== "facility" &&
    placement.layer !== "actor"
  ) {
    return undefined
  }

  const baseSize = LAYER_FOOTPRINT_SIZE[placement.layer]
  const influenceScale = placement.layer === "nature" ? 1.5 : 1.25

  return {
    kind: "polygon",
    polygon: buildRectanglePolygon({
      anchor: { x: placement.x, y: placement.y },
      width: baseSize.width * tileSize * placement.scale * influenceScale,
      height: baseSize.height * tileSize * placement.scale * influenceScale,
    }),
  }
}

function buildRectanglePolygon(input: {
  anchor: Point2D
  width: number
  height: number
}): Polygon2D {
  const halfWidth = input.width / 2
  const halfHeight = input.height / 2

  return {
    points: [
      { x: input.anchor.x - halfWidth, y: input.anchor.y - halfHeight },
      { x: input.anchor.x + halfWidth, y: input.anchor.y - halfHeight },
      { x: input.anchor.x + halfWidth, y: input.anchor.y + halfHeight },
      { x: input.anchor.x - halfWidth, y: input.anchor.y + halfHeight },
    ],
  }
}

function buildGeometryTags(
  placement: MapPlacement,
  input?: {
    shapeGrammarKind?: PlacementShapeGrammarKind
    projectionTags?: string[]
  }
): string[] {
  return uniqueTags([
    ...placement.tags,
    `placement_layer:${placement.layer}`,
    `asset:${placement.assetId}`,
    `source:${placement.source}`,
    input?.shapeGrammarKind
      ? `geometry_source:shape_grammar:${input.shapeGrammarKind}`
      : "geometry_source:fallback_rectangle",
    ...(input?.projectionTags ?? []),
  ])
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
